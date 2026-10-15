/*
 * Lesson narration: each lesson read aloud by a Gemini voice, with the time of every word for the karaoke text.
 *
 *   npx tsx scripts/narration/build-narration.ts <what> [--voice Charon] [--check]
 *
 *   <what>   geo:<slug> | bio:<grade>:<number> | topic:<slug> | geo | bio | topic | all
 *   --voice  a Gemini prebuilt voice (default Charon)
 *   --check  have Gemini transcribe each section back and report words it did not hear (pronunciation check)
 *   --force  time the words again even if the lesson is up to date (the recordings come from the cache)
 *   --dry    print the text as the voice would get it, record nothing
 *   --parallel <n>  record n lessons at a time (default 1)
 *   --wait   when the daily limit is reached, try again every 5 minutes (up to 8 hours) instead of stopping
 *   --verify afterwards, have Gemini write down each recording and compare it with the text: a lesson where the
 *            voice left out words (3 or more in a row) is listed, and with --redo recorded again — a new take, in
 *            shorter pieces — until it is complete (at most 4 takes; takes are kept in scripts/data/narration-takes.json)
 *
 * Needs GEMINI_API_KEY in .env.local (never in git); GEMINI_API_KEY_2, _3… are used in turn when a key's daily
 * limit runs out (the free tier allows only a few recordings a day). Writes public/narration/<id>.m4a (AAC, made with macOS
 * afconvert) and <id>.json (word timings), and src/lib/narration-manifest.ts. A lesson is read in one go (a long
 * one in two or three pieces, split between sections: one request each, which is what the free tier counts),
 * and every piece is kept in .narration-cache/, so a run that stops (the daily limit, a network error) picks up
 * where it left off, and a lesson whose text has not changed is not recorded again.
 *
 * Word times: Gemini gives none. The pauses in each piece are matched to the punctuation of its text (sentence
 * and paragraph ends to long pauses, commas to short ones) by dynamic programming, choosing the matching whose
 * speaking rate stays most even; between two anchors the words share the time by spoken length.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GEO_LESSONS } from "../../src/lib/geography-lessons";
import { GRADE_8 } from "../../src/lib/lessons/grade-8";
import { GRADE_9 } from "../../src/lib/lessons/grade-9";
import { GRADE_10 } from "../../src/lib/lessons/grade-10";
import { GRADE_11 } from "../../src/lib/lessons/grade-11";
import { GRADE_12 } from "../../src/lib/lessons/grade-12";
import type { LessonContent } from "../../src/lib/lessons/types";
import { bioNarrationId, geoNarrationId, narrationBlocks, narrationHash, narrationWords, topicNarrationBlocks, topicNarrationId, type NarrationBlock } from "../../src/lib/narration";
import { STRINGS } from "../../src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/i18n";
import { TOPICS } from "../../src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/topics";
import { loadSay, sayKey } from "./spoken-forms";

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "public/narration");
const CACHE = path.join(ROOT, ".narration-cache");
const MANIFEST = path.join(ROOT, "src/lib/narration-manifest.ts");
const MODEL = "gemini-3.8-flash-tts";
const CHECK_MODEL = "gemini-3.8-flash";
const STYLE = "Georgian. A warm, clear school teacher explaining a lesson to 12–16 year old pupils: calm, unhurried pace, natural intonation, a short pause at commas, a longer one at full stops and after headings.";
/** Silence between pieces (seconds). */
const GAP = 0.7;
/** Longest text read in one request (characters); longer lessons are split between sections. */
const PIECE_CHARS = 3400;
const RATE = 24000;

const args = process.argv.slice(2);
const what = args.find((a) => !a.startsWith("--")) ?? "";
const voice = args.includes("--voice") ? args[args.indexOf("--voice") + 1] : "Charon";
const check = args.includes("--check");
const force = args.includes("--force");
const waitForQuota = args.includes("--wait");
const dry = args.includes("--dry");
const verify = args.includes("--verify");
const PARALLEL = args.includes("--parallel") ? Math.max(1, Number(args[args.indexOf("--parallel") + 1])) : 1;

/** Run `work` over the items, `n` at a time. */
async function pool<T>(items: T[], n: number, work: (item: T, index: number) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await work(items[i], i);
      }
    }),
  );
}

/**
 * Lines a lesson logs while it is recorded, printed together when it is done (lessons run side by side): the
 * lesson's async work runs in its own context, which `say` writes to.
 */
const logContext = new AsyncLocalStorage<string[]>();
const say = (line: string) => {
  const lines = logContext.getStore();
  if (lines) lines.push(line);
  else console.log(line);
};
const runLogged = <T>(lines: string[], work: () => Promise<T>) => logContext.run(lines, work);
const redo = args.includes("--redo");
const TAKES_FILE = path.join(ROOT, "scripts/data/narration-takes.json");
/** Lessons recorded again because the voice left words out: id → take (1 when absent). */
const TAKES: Record<string, number> = fs.existsSync(TAKES_FILE) ? JSON.parse(fs.readFileSync(TAKES_FILE, "utf8")) : {};
/** Shorter pieces for a second take: the voice leaves words out less often in short texts. */
const RETAKE_CHARS = 1300;
const KEYS = [...fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").matchAll(/^GEMINI_API_KEY(?:_\d+)?=(.+)$/gm)].map((m) => m[1].trim());
if (!KEYS.length) throw new Error("GEMINI_API_KEY is missing from .env.local");
let keyAt = 0;

// ---- Which lessons ----------------------------------------------------------------------------------------------

interface Job {
  id: string;
  title: string;
  blocks: NarrationBlock[];
}

const BIO: Record<number, Record<string, LessonContent>> = { 8: GRADE_8, 9: GRADE_9, 10: GRADE_10, 11: GRADE_11, 12: GRADE_12 };
const geoJobs = (): Job[] => GEO_LESSONS.map((l) => ({ id: geoNarrationId(l.slug), title: l.title, blocks: narrationBlocks(l) }));
const topicJobs = (): Job[] => TOPICS.map((tp) => ({ id: topicNarrationId(tp.slug), title: tp.title, blocks: topicNarrationBlocks(tp, STRINGS.ka.topicFacts, STRINGS.ka.topicHealth) }));
const bioJobs = (): Job[] =>
  Object.entries(BIO).flatMap(([grade, lessons]) =>
    Object.entries(lessons)
      // Lessons the teacher shows (reproduction) are not read aloud at home.
      .filter(([, c]) => !c.sensitive)
      .map(([key, content]) => ({ id: bioNarrationId(Number(grade), key), title: `${grade}: ${key}`, blocks: narrationBlocks(content) })),
  );

function jobs(): Job[] {
  if (what === "geo") return geoJobs();
  if (what === "bio") return bioJobs();
  if (what === "topic") return topicJobs();
  if (what === "all") return [...geoJobs(), ...topicJobs(), ...bioJobs()];
  const [kind, a, b] = what.split(":");
  if (kind === "geo") return geoJobs().filter((j) => j.id === geoNarrationId(a));
  if (kind === "bio") return bioJobs().filter((j) => j.id === bioNarrationId(Number(a), b));
  if (kind === "topic") return topicJobs().filter((j) => j.id === topicNarrationId(a));
  throw new Error("say what to read: geo:<slug>, bio:<grade>:<number>, geo, bio or all");
}

// ---- Text as it is said ---------------------------------------------------------------------------------------------

/** Readings of symbols, numbers and abbreviations in their context (scripts/narration/spoken-forms.ts). */
const READINGS = loadSay();

/** Abbreviations and signs, read out (Georgian textbook usage). The key is the word without its punctuation. */
const SAY: Record<string, string> = {
  "კმ": "კილომეტრი", "კმ²": "კვადრატული კილომეტრი", "მ²": "კვადრატული მეტრი", "მ³": "კუბური მეტრი", "სმ": "სანტიმეტრი", "მმ": "მილიმეტრი",
  "კგ": "კილოგრამი", "გ": "გრამი", "ტ": "ტონა", "ლ": "ლიტრი", "მლ": "მილილიტრი", "ჰპა": "ჰექტოპასკალი", "მ/წმ": "მეტრი წამში", "კმ/სთ": "კილომეტრი საათში",
  "სთ": "საათი", "წთ": "წუთი", "წმ": "წამი", "°C": "გრადუსი", "°": "გრადუსი", "%": "პროცენტი", "მლნ": "მილიონი", "მლრდ": "მილიარდი",
  "ათ.": "ათასი", "მაგ.": "მაგალითად", "ე.ი.": "ესე იგი", "ა.შ.": "ასე შემდეგ", "მკმ": "მიკრომეტრი", "ნმ": "ნანომეტრი",
};
/** Two-word abbreviations: first word → [its reading, the second word, the second's reading]. */
const SAY2: [string, string, string, string][] = [
  ["ჩ.", "გ.", "ჩრდილოეთის", "განედი"],
  ["ს.", "გ.", "სამხრეთის", "განედი"],
  ["აღმ.", "გრ.", "აღმოსავლეთის", "გრძედი"],
  ["დას.", "გრ.", "დასავლეთის", "გრძედი"],
  ["ძვ.", "წ.", "ძველი", "წელთაღრიცხვით"],
];
/**
 * A unit with a case ending joined by a hyphen ("კმ-ზე", "კმ-მდე", "კმ-დან"), read out: the reading drops its
 * final ი (or ა) and takes the ending — -მდე and -დან with their linking vowel (კილომეტრამდე, კილომეტრიდან).
 */
function withEnding(unit: string, ending: string) {
  const stem = /[ია]$/.test(unit) ? unit.slice(0, -1) : unit;
  if (ending.startsWith("მდე")) return `${stem}ა${ending}`;
  if (ending.startsWith("დან") || ending.startsWith("ვით")) return `${stem}ი${ending}`;
  return stem + ending;
}

/**
 * One shown word → what is said for it (punctuation kept round it, so the voice still pauses there). `keys`: the
 * words as the readings file knows them (a heading without the full stop added for the voice).
 */
function spokenWords(words: string[], keys = words) {
  const out = [...words];
  for (let i = 0; i < words.length; i++) {
    const m = words[i].match(/^([„“"«(]*)(.*?)([.,!?:;…»“”")]*)$/u)!;
    const [, lead, core, tail] = m;
    const reading = READINGS[sayKey(keys[i - 1] ?? "", keys[i], keys[i + 1] ?? "")];
    if (reading) {
      out[i] = lead + reading + tail;
      continue;
    }
    for (const [a, b, ra, rb] of SAY2)
      if (words[i] === a && words[i + 1]?.replace(/[,;:)]+$/, "") === b) {
        out[i] = ra;
        out[i + 1] = rb + words[i + 1].slice(b.length);
      }
    if (out[i] !== words[i]) continue;
    // A number with a unit glued to it: "23°C", "5%".
    const glued = core.match(/^([+−-]?\d+(?:[.,]\d+)?)(°C|°|%)$/);
    if (glued) {
      out[i] = `${lead}${glued[1]} ${SAY[glued[2]]}${tail}`;
      continue;
    }
    // A numeric range: "5–10" → "5-დან 10-მდე".
    const range = core.match(/^(\d+(?:[.,]\d+)?)[–-](\d+(?:[.,]\d+)?)(-?.*)$/);
    if (range && !range[3]) {
      out[i] = `${lead}${range[1]}-დან ${range[2]}-მდე${tail}`;
      continue;
    }
    const withCase = core.match(/^(.+?)-(.+)$/);
    if (SAY[core]) out[i] = lead + SAY[core] + tail;
    else if (SAY[core + "."] && tail.startsWith(".")) out[i] = lead + SAY[core + "."] + tail.slice(1);
    else if (withCase && SAY[withCase[1]]) out[i] = lead + withEnding(SAY[withCase[1]], withCase[2]) + tail;
  }
  return out;
}

interface Word {
  text: string;
  /** Spoken length (letters said, numbers counted as their words, roughly). */
  weight: number;
  /** Pause expected after it: 0 none, 1 comma, 2 sentence, 3 heading or paragraph. */
  brk: number;
}

const NUMBER_LETTERS = (n: string) => Math.min(40, 6 + n.replace(/\D/g, "").length * 6);

/** The words of a piece (heading, then its paragraphs), their weights and breaks, and the text sent to the voice. */
function piece(block: NarrationBlock) {
  const words: Word[] = [];
  const said: string[] = [];
  const add = (text: string, last: number, keyText = text) => {
    const shown = narrationWords(text);
    const spoken = spokenWords(shown, narrationWords(keyText));
    shown.forEach((w, i) => {
      const s = spoken[i];
      const letters = (s.match(/[ა-ჰ]/g)?.length ?? 0) + (s.match(/\d/) ? NUMBER_LETTERS(s) : 0) + (s.match(/[a-z]/gi)?.length ?? 0) * 1.5;
      const brk = i === shown.length - 1 ? last : /[.!?…:]["“»)]*$/.test(w) ? 2 : /[,;]["“»)]*$/.test(w) || w === "—" || w === "–" ? 1 : 0;
      words.push({ text: w, weight: w === "—" || w === "–" ? 0 : letters + 1.6, brk });
    });
    said.push(spoken.join(" "));
  };
  if (block.heading) add(/[.!?:]$/.test(block.heading) ? block.heading : `${block.heading}.`, 3, block.heading);
  block.paragraphs.forEach((p) => add(p, 3));
  // Headings get a full stop for the voice only; the page shows them without.
  if (block.heading && !/[.!?:]$/.test(block.heading)) {
    const n = narrationWords(block.heading).length;
    words[n - 1].text = words[n - 1].text.replace(/\.$/, "");
  }
  words[words.length - 1].brk = 0;
  return { words, said: said.join("\n\n") };
}

// ---- Gemini ----------------------------------------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class DailyLimit extends Error {}

async function gemini(url: string, body: unknown) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { method: "POST", headers: { "x-goog-api-key": KEYS[keyAt], "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    const text = await res.text();
    if (res.status === 429 && /PerDay|per day|daily/i.test(text)) {
      const quota = text.match(/"quotaId":\s*"([^"]+)"[\s\S]*?"quotaValue":\s*"(\d+)"/);
      if (quota) console.log(`    ${quota[1]}: ${quota[2]} a day`);
      if (keyAt + 1 >= KEYS.length) throw new DailyLimit(text.slice(0, 300));
      keyAt++;
      console.log(`    daily limit reached; going on with key ${keyAt + 1}`);
      attempt = 0;
      continue;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 8) {
      const retry = Number(text.match(/"retryDelay":\s*"(\d+)/)?.[1] ?? 0);
      const wait = Math.max(retry * 1000, Math.min(120_000, 8000 * attempt));
      console.log(`    ${res.status}, waiting ${Math.round(wait / 1000)} s…`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${res.status}: ${text.slice(0, 400)}`);
  }
}

/** PCM samples (24 kHz mono 16-bit) of one piece, from the cache or the voice. */
const cacheFile = (text: string, take: number) => path.join(CACHE, voice, `${createHash("sha1").update(JSON.stringify(take > 1 ? [MODEL, voice, STYLE, text, take] : [MODEL, voice, STYLE, text])).digest("hex")}.wav`);

async function speak(text: string, take = 1): Promise<Int16Array> {
  const file = cacheFile(text, take);
  if (!fs.existsSync(file)) {
    const body = await gemini("https://generativelanguage.googleapis.com/v1beta/interactions", {
      model: MODEL,
      input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style: STYLE }] }] }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice }] },
    });
    const parts = (body.steps ?? []).flatMap((s: { content?: { data?: string }[] }) => s.content ?? []).filter((c: { data?: string }) => c.data);
    const wav = Buffer.concat(parts.map((p: { data: string }) => Buffer.from(p.data, "base64")));
    if (wav.length < 1000) throw new Error("no audio came back");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, wav);
  }
  return readWav(fs.readFileSync(file));
}

function readWav(buf: Buffer): Int16Array {
  if (buf.toString("ascii", 0, 4) !== "RIFF") return new Int16Array(buf.buffer, buf.byteOffset, buf.length >> 1);
  let at = 12;
  while (at < buf.length) {
    const id = buf.toString("ascii", at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    if (id === "fmt ") {
      const rate = buf.readUInt32LE(at + 12);
      if (rate !== RATE || buf.readUInt16LE(at + 22) !== 16) throw new Error(`unexpected audio: ${rate} Hz`);
    }
    if (id === "data") return new Int16Array(buf.buffer.slice(buf.byteOffset + at + 8, buf.byteOffset + at + 8 + size));
    at += 8 + size + (size & 1);
  }
  throw new Error("no data in the WAV");
}

/** Gemini writes down what it hears; the words of the text it did not hear are reported. */
async function checkPiece(samples: Int16Array, said: string, label: string) {
  const wav = wavBytes(samples);
  const body = await gemini(`https://generativelanguage.googleapis.com/v1beta/models/${CHECK_MODEL}:generateContent`, {
    contents: [{ parts: [{ inline_data: { mime_type: "audio/wav", data: wav.toString("base64") } }, { text: "Transcribe this Georgian speech exactly as spoken, in Georgian script, word for word, numbers as the words said. Output only the transcript." }] }],
  });
  const heard = body.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  const norm = (s: string) => s.toLowerCase().replace(/[^ა-ჰ0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  // Digits are said as words (and case endings after them split off): those cannot be compared.
  const a = norm(said).filter((w) => !/\d/.test(w) && w.length > 3);
  const b = new Set(norm(heard));
  const missed = a.filter((w) => !b.has(w));
  say(`    check ${label}: ${missed.length ? `not heard: ${[...new Set(missed)].join(", ")}` : "all words heard"}`);
}

// ---- Alignment --------------------------------------------------------------------------------------------------------

/** Times (seconds from the start of the piece) of each word. */
function align(samples: Int16Array, words: Word[]): [number, number][] {
  const F = RATE / 100;
  const rms: number[] = [];
  for (let i = 0; i + F <= samples.length; i += F) {
    let s = 0;
    for (let k = i; k < i + F; k++) s += samples[k] * samples[k];
    rms.push(Math.sqrt(s / F));
  }
  const sorted = [...rms].sort((x, y) => x - y);
  const thr = sorted[Math.floor(sorted.length * 0.95)] * 0.04;
  const loud = rms.map((r) => r >= thr);
  const first = loud.indexOf(true) / 100;
  const last = (loud.length - [...loud].reverse().indexOf(true)) / 100;
  const pauses: [number, number][] = [];
  let start = -1;
  loud.forEach((l, i) => {
    if (!l) {
      if (start < 0) start = i;
    } else {
      if (start >= 0 && i - start >= 12 && start / 100 > first) pauses.push([start / 100, i / 100]);
      start = -1;
    }
  });

  const cum = [0];
  for (const w of words) cum.push(cum[cum.length - 1] + w.weight);
  const A: [number, number][] = [[0, 3], ...words.flatMap((w, i) => (w.brk > 0 ? [[i + 1, w.brk] as [number, number]] : [])), [words.length, 3]];
  const P: [number, number][] = [[first, first], ...pauses, [last, last]];
  const speechTotal = last - first - pauses.reduce((s, [a, b]) => s + b - a, 0);
  const rate0 = speechTotal / cum[cum.length - 1];
  const SKIP_BREAK: Record<number, number> = { 1: 0.25, 2: 2, 3: 5 };
  const skipPause = (j: number) => {
    const len = P[j][1] - P[j][0];
    return len >= 0.5 ? 4 : len >= 0.3 ? 1.4 : 0.3;
  };
  const nA = A.length;
  const nP = P.length;
  const best = new Map<number, [number, number | null]>();
  const key = (i: number, j: number) => i * 100000 + j;
  best.set(key(0, 0), [0, null]);
  const WIN_A = 6;
  const WIN_P = 8;
  for (let i = 1; i < nA; i++)
    for (let j = 1; j < nP; j++) {
      if ((i === nA - 1) !== (j === nP - 1)) continue;
      let cand: [number, number] | null = null;
      for (let i2 = Math.max(0, i - WIN_A); i2 < i; i2++)
        for (let j2 = Math.max(0, j - WIN_P); j2 < j; j2++) {
          const prev = best.get(key(i2, j2));
          if (!prev) continue;
          const text = cum[A[i][0]] - cum[A[i2][0]];
          let inner = 0;
          for (let k = j2 + 1; k < j; k++) inner += P[k][1] - P[k][0];
          const audio = P[j][0] - P[j2][1] - inner;
          if (text <= 0 || audio <= 0.05) continue;
          let cost = prev[0] + 5 * Math.abs(Math.log(audio / text / rate0));
          for (let k = i2 + 1; k < i; k++) cost += SKIP_BREAK[A[k][1]];
          for (let k = j2 + 1; k < j; k++) cost += skipPause(k);
          if (A[i][1] >= 2 && P[j][1] - P[j][0] < 0.3) cost += 0.8;
          if (!cand || cost < cand[0]) cand = [cost, key(i2, j2)];
        }
      if (cand) best.set(key(i, j), cand);
    }
  const end = key(nA - 1, nP - 1);
  const times: [number, number][] = new Array(words.length);
  if (!best.has(end)) {
    // No matching: spread the words evenly over the speech.
    words.forEach((_, k) => (times[k] = [first + ((last - first) * cum[k]) / cum[words.length], first + ((last - first) * cum[k + 1]) / cum[words.length]]));
    return times;
  }
  const route: [number, number][] = [];
  for (let node: number | null = end; node !== null; node = best.get(node)![1]) route.push([Math.floor(node / 100000), node % 100000]);
  route.reverse();
  const strong = A.slice(1, -1).filter((a) => a[1] >= 2).length;
  const matched = route.slice(1, -1).filter(([i]) => A[i][1] >= 2).length;
  report.push(`sentence ends on pauses ${matched}/${strong}`);
  for (let r = 0; r + 1 < route.length; r++) {
    const [i2, j2] = route[r];
    const [i, j] = route[r + 1];
    const w0 = A[i2][0];
    const w1 = A[i][0];
    const t0 = P[j2][1];
    const t1 = P[j][0];
    const inner = P.slice(j2 + 1, j);
    const speech = t1 - t0 - inner.reduce((s, [a, b]) => s + b - a, 0);
    const total = cum[w1] - cum[w0] || 1;
    const real = (st: number) => {
      let t = t0 + st;
      for (const [s, e] of inner) if (t > s) t += e - s;
      return t;
    };
    const bounds: number[] = [];
    for (let k = w0; k <= w1; k++) bounds.push(real(((cum[k] - cum[w0]) / total) * speech));
    const starts = bounds.slice(0, -1);
    const ends = bounds.slice(1);
    // The word boundary nearest to each inner pause goes onto the pause.
    for (const [s, e] of inner) {
      let k = -1;
      for (let m = 1; m < bounds.length - 1; m++) if (k < 0 || Math.abs(bounds[m] - (s + e) / 2) < Math.abs(bounds[k] - (s + e) / 2)) k = m;
      if (k > 0) {
        ends[k - 1] = s;
        starts[k] = e;
      }
    }
    // Inside a stretch of speech, a boundary between words moves to the nearest dip in loudness, if there is a
    // clear one close by (the voice drops for a moment between most words).
    for (let m = 1; m < starts.length; m++) {
      if (starts[m] !== ends[m - 1]) continue; // on a pause already
      const c = Math.round(starts[m] * 100);
      let low = c;
      for (let k = c - 9; k <= c + 9; k++) if (k > 0 && k < rms.length && rms[k] < rms[low]) low = k;
      let peak = 0;
      for (let k = low - 12; k <= low + 12; k++) if (k >= 0 && k < rms.length) peak = Math.max(peak, rms[k]);
      const lo = (starts[m - 1] + 0.08) * 100;
      const hi = (ends[m] - 0.08) * 100;
      if (rms[low] < peak * 0.45 && low > lo && low < hi) starts[m] = ends[m - 1] = low / 100;
    }
    for (let m = 0; m < w1 - w0; m++) times[w0 + m] = [starts[m], Math.max(starts[m], ends[m])];
  }
  return times;
}

/** What the alignment of the current piece found (printed with the piece). */
const report: string[] = [];

// ---- Output -------------------------------------------------------------------------------------------------------

function wavBytes(samples: Int16Array) {
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + samples.length * 2, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(samples.length * 2, 40);
  return Buffer.concat([head, Buffer.from(samples.buffer, samples.byteOffset, samples.length * 2)]);
}

function writeManifest() {
  const entries: Record<string, unknown> = {};
  for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT).filter((x) => x.endsWith(".json")).sort() : []) {
    const j = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
    entries[j.id] = { hash: j.hash, rev: j.rev, duration: j.duration, voice: j.voice };
  }
  fs.writeFileSync(
    MANIFEST,
    `// Generated by scripts/narration/build-narration.ts — the lesson narrations in public/narration.\nexport const NARRATION_MANIFEST: Record<string, { hash: string; rev: string; duration: number; voice: string }> = ${JSON.stringify(entries, null, 2)};\n`,
  );
}

/** Sections go together into pieces of up to PIECE_CHARS (most lessons: one piece; a retake: shorter ones). */
function pieceGroups(blocks: NarrationBlock[], take: number) {
  const limit = take > 1 ? RETAKE_CHARS : PIECE_CHARS;
  const groups: NarrationBlock[][] = [];
  for (const block of blocks) {
    const size = JSON.stringify(block).length;
    const last = groups[groups.length - 1];
    if (last && JSON.stringify(last).length + size <= limit) last.push(block);
    else groups.push([block]);
  }
  return groups;
}

/** Returns "done" (recorded now) or "kept" (already up to date). */
async function build(job: Job, forced = force): Promise<"done" | "kept"> {
  const blocks = job.blocks;
  const hash = narrationHash(blocks);
  const take = TAKES[job.id] ?? 1;
  const groups = pieceGroups(blocks, take);
  // What the voice is given: a recording is up to date only if it was made from exactly this (readings change it).
  const speech = createHash("sha1").update(JSON.stringify([voice, take, groups.map((g) => g.map(piece).map((p) => p.said))])).digest("hex").slice(0, 12);
  const jsonPath = path.join(OUT, `${job.id}.json`);
  if (fs.existsSync(jsonPath)) {
    const old = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    if (old.hash === hash && old.speech === speech && !forced) {
      say(`${job.id}: up to date`);
      return "kept";
    }
  }
  say(`${job.id} (${job.title}): ${groups.length} piece${groups.length > 1 ? "s" : ""}`);
  const pieces: Int16Array[] = [];
  const words: [number, number][] = [];
  let offset = 0;
  for (const [g, group] of groups.entries()) {
    const parts = group.map(piece);
    // Within a piece, the end of each block is a paragraph break; the piece's last word ends the speech.
    const ws = parts.flatMap((p, k) => p.words.map((w, i) => (i === p.words.length - 1 && k < parts.length - 1 ? { ...w, brk: 3 } : w)));
    const said = parts.map((p) => p.said).join("\n\n");
    if (dry) {
      say(said);
      continue;
    }
    const samples = await speak(said, take);
    if (check) await checkPiece(samples, said, `piece ${g + 1}`);
    for (const [s, e] of align(samples, ws)) words.push([+(offset + s).toFixed(2), +(offset + e).toFixed(2)]);
    pieces.push(samples);
    offset += samples.length / RATE;
    if (g < groups.length - 1) {
      pieces.push(new Int16Array(Math.round(GAP * RATE)));
      offset += GAP;
    }
    say(`  piece ${g + 1}/${groups.length}: ${(samples.length / RATE).toFixed(1)} s, ${ws.length} words, ${report.splice(0).join(", ")}`);
  }
  if (dry) return "kept";
  const all = new Int16Array(pieces.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of pieces) {
    all.set(p, at);
    at += p.length;
  }
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(os.tmpdir(), `narration-${job.id}.wav`);
  fs.writeFileSync(tmp, wavBytes(all));
  const m4a = path.join(OUT, `${job.id}.m4a`);
  execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "48000", "-q", "127", tmp, m4a]);
  fs.unlinkSync(tmp);
  // New audio or new timings: a new revision, so browsers fetch both again.
  const rev = createHash("sha1").update(fs.readFileSync(m4a)).update(JSON.stringify(words)).digest("hex").slice(0, 10);
  fs.writeFileSync(jsonPath, JSON.stringify({ v: 1, id: job.id, voice, model: MODEL, take, hash, speech, rev, duration: +offset.toFixed(2), words }));
  say(`  → ${path.relative(ROOT, m4a)} (${(fs.statSync(m4a).size / 1024).toFixed(0)} KB, ${Math.floor(offset / 60)}:${String(Math.round(offset % 60)).padStart(2, "0")})`);
  return "done";
}

// ---- Verification: did the voice say every word? ------------------------------------------------------------------

/** Georgian words of a text, for comparing (numbers left out: the voice says them in words, writers in digits). */
const wordsOf = (s: string) => s.toLowerCase().replace(/[^ა-ჰ0-9 ]+/g, " ").split(/\s+/).filter((w) => w && !/\d/.test(w));

/** Runs of 3 or more words of the text that the transcript does not have (longest common subsequence). */
function leftOut(text: string[], heard: string[]) {
  const n = text.length;
  const m = heard.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = text[i] === heard[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const runs: string[] = [];
  let run: string[] = [];
  let i = 0;
  let j = 0;
  const close = () => {
    if (run.length >= 3) runs.push(run.join(" "));
    run = [];
  };
  while (i < n) {
    if (j < m && text[i] === heard[j]) {
      close();
      i++;
      j++;
    } else if (j < m && L[i][j + 1] >= L[i + 1][j]) j++;
    else {
      run.push(text[i]);
      i++;
    }
  }
  close();
  return runs;
}

async function transcribe(samples: Int16Array) {
  const body = await gemini(`https://generativelanguage.googleapis.com/v1beta/models/${CHECK_MODEL}:generateContent`, {
    contents: [{ parts: [{ inline_data: { mime_type: "audio/wav", data: wavBytes(samples).toString("base64") } }, { text: "Transcribe this Georgian speech exactly as spoken, in Georgian script, word for word, writing numbers as words. Output only the transcript." }] }],
  });
  return body.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
}

/** The words the recording of a lesson leaves out (empty: complete; null: not recorded). */
async function missing(job: Job): Promise<string[] | null> {
  const take = TAKES[job.id] ?? 1;
  const runs: string[] = [];
  for (const group of pieceGroups(job.blocks, take)) {
    const said = group.map(piece).map((p) => p.said).join("\n\n");
    const file = cacheFile(said, take);
    if (!fs.existsSync(file)) return null;
    runs.push(...leftOut(wordsOf(said), wordsOf(await transcribe(readWav(fs.readFileSync(file))))));
  }
  return runs;
}

async function verifyAll(list: Job[]) {
  console.log(`\nverifying ${list.length} recordings…`);
  const bad: Job[] = [];
  await pool(list, PARALLEL, async (job, n) => {
    const runs = await missing(job);
    if (runs === null) return;
    if (runs.length) {
      console.log(`  [${n + 1}] ${job.id} (take ${TAKES[job.id] ?? 1}) leaves out: ${runs.map((r) => `„${r}“`).join("; ")}`);
      bad.push(job);
    }
  });
  console.log(`verified: ${list.length - bad.length} complete, ${bad.length} with words left out`);
  return bad;
}

async function main() {
  const list = jobs();
  if (!list.length) throw new Error(`nothing matches "${what}"`);
  const deadline = Date.now() + 8 * 3600_000;
  const tally = { done: 0, kept: 0, failed: [] as string[] };
  console.log(`${list.length} narrations, voice ${voice}${check ? ", with the pronunciation check" : ""}`);
  let stopped = false;
  await pool(list, PARALLEL, async (job, n) => {
    for (;;) {
      if (stopped) return;
      const lines: string[] = [];
      try {
        tally[await runLogged(lines, () => build(job))]++;
        console.log([`[${n + 1}/${list.length}] ${lines[0] ?? job.id}`, ...lines.slice(1)].join("\n"));
        break;
      } catch (err) {
        if (err instanceof DailyLimit) {
          if (waitForQuota && Date.now() < deadline) {
            console.log(`[${n + 1}/${list.length}] ${job.id}: the limit is closed; trying again in 5 minutes…`);
            await sleep(5 * 60_000);
            keyAt = 0;
            continue;
          }
          stopped = true;
          console.log("\nThe daily limit of the Gemini key is used up; run the same command again later to go on (done pieces are kept).");
          return;
        }
        // Anything else: note it and go on with the next lesson.
        console.log(`[${n + 1}/${list.length}] FAILED ${job.id}: ${String(err).slice(0, 300)}`);
        tally.failed.push(job.id);
        break;
      }
    }
    writeManifest();
  });
  writeManifest();
  if (stopped) return;
  console.log(`\nfinished: ${tally.done} recorded, ${tally.kept} already up to date, ${tally.failed.length} failed${tally.failed.length ? `: ${tally.failed.join(", ")}` : ""}`);
  if (!verify || dry) return;
  let bad = await verifyAll(list);
  while (redo && bad.length) {
    const again = bad.filter((j) => (TAKES[j.id] ?? 1) < 4);
    if (!again.length) break;
    for (const job of again) TAKES[job.id] = (TAKES[job.id] ?? 1) + 1;
    fs.writeFileSync(TAKES_FILE, JSON.stringify(TAKES, null, 1));
    await pool(again, PARALLEL, async (job) => {
      const lines: string[] = [];
      await runLogged(lines, () => build(job, true));
      console.log([`re-recorded ${job.id} (take ${TAKES[job.id]}): ${lines[0] ?? ""}`, ...lines.slice(1)].join("\n"));
    });
    writeManifest();
    bad = await verifyAll(again);
  }
}

void main();
