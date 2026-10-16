/*
 * Where each stage of a biology lesson's animation begins in the lesson read aloud. Every stage caption retells a
 * part of the lesson text; this finds, for each stage, the sentence of the text that says the same (shared word
 * stems, rare words counting more), keeping the stages in order, and writes the first words of that sentence as
 * the stage's anchor to src/components/visuals/stage-anchors.ts. Anchors written by hand there (marked `// set`)
 * are kept.
 *
 *   npx tsx scripts/narration/stage-anchors.ts           write the anchors
 *   npx tsx scripts/narration/stage-anchors.ts --show    print each stage with the sentence it starts at
 */
import fs from "node:fs";
import path from "node:path";
import { LESSON_VISUALS } from "../../src/components/visuals/lesson-visuals";
import { GRADE_8 } from "../../src/lib/lessons/grade-8";
import { GRADE_9 } from "../../src/lib/lessons/grade-9";
import { GRADE_10 } from "../../src/lib/lessons/grade-10";
import { GRADE_11 } from "../../src/lib/lessons/grade-11";
import { GRADE_12 } from "../../src/lib/lessons/grade-12";
import type { LessonContent } from "../../src/lib/lessons/types";
import { narrationBlocks, narrationWords } from "../../src/lib/narration";

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "src/components/visuals/stage-anchors.ts");
const LESSONS: Record<number, Record<string, LessonContent>> = { 8: GRADE_8, 9: GRADE_9, 10: GRADE_10, 11: GRADE_11, 12: GRADE_12 };

const STOP = new Set("და რომ არის ის ეს მისი მათი მათ როგორც ან კი რა თუ არ უფრო ერთი ყველა მხოლოდ ასევე მაგრამ როცა სადაც რომელიც რომლებიც შეიძლება ხდება აქვს აქვთ იმ ამ თავის ჩვენ ძალიან ორი სამი მას მის მით ამიტომ ანუ თან კიდევ".split(" "));
const stem = (w: string) => {
  const c = w.toLowerCase().replace(/[^ა-ჰa-z0-9]/g, "");
  if (c.length < 3 || STOP.has(c)) return null;
  return c.slice(0, c.length >= 7 ? 6 : 5);
};
const stems = (text: string) => new Set(narrationWords(text).map(stem).filter((s): s is string => !!s));

interface Sentence {
  block: number;
  words: string[];
  stems: Set<string>;
}

/** A place a stage can start: a sentence's start, or a word inside it that names the stage. */
interface Spot {
  sentence: number;
  /** Word within the sentence. */
  at: number;
}

function sentences(content: LessonContent): Sentence[] {
  const out: Sentence[] = [];
  narrationBlocks(content).forEach((b, block) => {
    for (const p of [...(b.heading ? [b.heading] : []), ...b.paragraphs]) {
      let cur: string[] = [];
      for (const w of narrationWords(p)) {
        cur.push(w);
        if (/[.!?:;]["“»)]*$/.test(w)) {
          out.push({ block, words: cur, stems: stems(cur.join(" ")) });
          cur = [];
        }
      }
      if (cur.length) out.push({ block, words: cur, stems: stems(cur.join(" ")) });
    }
  });
  return out;
}

/**
 * Stage k starts at spot at[k] (stage 0 at the very start), in order: a sentence that shares the most rare stems
 * with the stage's caption, or — when a sentence lists several stages — the word in it that names the stage.
 */
function align(stages: { title: string; text: string }[], sents: Sentence[]): Spot[] {
  const df = new Map<string, number>();
  for (const s of sents) for (const t of s.stems) df.set(t, (df.get(t) ?? 0) + 1);
  const idf = (t: string) => Math.log((sents.length + 1) / ((df.get(t) ?? 0) + 0.5));
  const sentScore = (k: number, j: number) => {
    const title = stems(stages[k].title);
    const body = stems(stages[k].text);
    let s = 0;
    for (const [jj, w] of [
      [j, 1],
      [j + 1, 0.5],
      [j + 2, 0.25],
    ] as const) {
      const sent = sents[jj];
      if (!sent) continue;
      for (const t of sent.stems) s += w * idf(t) * ((title.has(t) ? 2 : 0) + (body.has(t) ? 1 : 0));
    }
    return s;
  };
  // Every spot in reading order: sentence starts, and words inside sentences that are in some stage's title.
  const titleStems = new Set(stages.flatMap((st) => [...stems(st.title)]));
  const spots: Spot[] = [];
  sents.forEach((sent, j) => {
    spots.push({ sentence: j, at: 0 });
    sent.words.forEach((w, i) => {
      const t = stem(w);
      if (i > 0 && t && titleStems.has(t)) spots.push({ sentence: j, at: i });
    });
  });
  const score = (k: number, p: Spot) => {
    if (p.at === 0) return sentScore(k, p.sentence);
    // Inside a sentence: only for the stage its word names, weighed by how rare that word is.
    const t = stem(sents[p.sentence].words[p.at])!;
    return stems(stages[k].title).has(t) ? 3 * idf(t) + 0.3 * sentScore(k, p.sentence) : -Infinity;
  };
  const K = stages.length;
  const P = spots.length;
  const best = Array.from({ length: K }, () => new Array<number>(P).fill(-Infinity));
  const from = Array.from({ length: K }, () => new Array<number>(P).fill(-1));
  best[0][0] = 0;
  for (let k = 1; k < K; k++)
    for (let q = 1; q < P; q++) {
      const sc = score(k, spots[q]);
      if (sc === -Infinity) continue;
      let b = -Infinity;
      let arg = -1;
      for (let p = 0; p < q; p++)
        if (best[k - 1][p] > b) {
          b = best[k - 1][p];
          arg = p;
        }
      if (arg < 0) continue;
      best[k][q] = b + sc;
      from[k][q] = arg;
    }
  let q = 0;
  for (let i = 0; i < P; i++) if (best[K - 1][i] > best[K - 1][q]) q = i;
  const at: Spot[] = new Array(K).fill(spots[0]);
  for (let k = K - 1; k > 0; k--) {
    at[k] = spots[q];
    q = from[k][q];
  }
  // A stage whose title the text says word for word starts where it says it (the nearest such place), even out of
  // the animation's order: the voice may list them differently (the animation can go to any stage).
  const flat = sents.flatMap((s, j) => s.words.map((w, i) => ({ t: stem(w), spot: { sentence: j, at: i } })));
  const index = (p: Spot) => flat.findIndex((f) => f.spot.sentence === p.sentence && f.spot.at === p.at);
  for (let k = 1; k < K; k++) {
    const title = narrationWords(stages[k].title).map(stem).filter((t): t is string => !!t);
    if (!title.length) continue;
    const hits: number[] = [];
    for (let i = 0; i + title.length <= flat.length; i++) if (title.every((t, d) => flat[i + d].t === t)) hits.push(i);
    if (!hits.length) continue;
    const near = index(at[k]);
    const hit = hits.reduce((a, b) => (Math.abs(b - near) < Math.abs(a - near) ? b : a));
    if (flat[hit].spot.sentence !== at[k].sentence || flat[hit].spot.at !== at[k].at) at[k] = flat[hit].spot;
  }
  return at;
}

/** The anchor phrase: four words from the spot (a phrase unlikely to come earlier in its block). */
const anchor = (sents: Sentence[], p: Spot) => sents[p.sentence].words.slice(p.at, p.at + 4).join(" ").replace(/[„“"«»]/g, "");
const shown = (sents: Sentence[], p: Spot) => {
  const w = sents[p.sentence].words;
  return `${w.slice(0, p.at).join(" ")}${p.at ? " ⟦" : "⟦"}${w.slice(p.at).join(" ")}`.slice(0, 170);
};

function main() {
  const show = process.argv.includes("--show");
  const kept = fs.existsSync(OUT) ? fs.readFileSync(OUT, "utf8") : "";
  const lines = [
    "/*",
    " * Where each stage of a biology lesson's animation begins in the lesson read aloud: the first words of the sentence",
    " * that tells it, and the block it is in (0: the introduction, 1…: the sections); a third number names the stage",
    " * when the text takes them in another order. Stage 0 runs from the start.",
    " * Written by scripts/narration/stage-anchors.ts; a lesson marked `// set` was checked by hand and is kept.",
    " */",
    "import type { StageAnchor } from \"./lesson-visuals\";",
    "",
    "export const STAGE_ANCHORS: Record<string, StageAnchor[]> = {",
  ];
  for (const [key, def] of Object.entries(LESSON_VISUALS)) {
    const [g, n] = key.split("|");
    const content = LESSONS[Number(g)]?.[n];
    if (!content || content.sensitive || def.stages.length < 2) continue;
    const handSet = kept.split("\n").find((l) => l.startsWith(`  ${JSON.stringify(key)}: [`) && l.endsWith("], // set"));
    if (handSet) {
      lines.push(handSet);
      continue;
    }
    const sents = sentences(content);
    const at = align(def.stages, sents);
    if (show) {
      console.log(`\n=== ${key} (${def.id})`);
      def.stages.forEach((st, k) => console.log(`  ${k}. ${st.title}\n     → [${sents[at[k].sentence].block}] ${shown(sents, at[k])}`));
    }
    const list = at.slice(1).map((p) => `[${JSON.stringify(anchor(sents, p))}, ${sents[p.sentence].block}]`);
    lines.push(`  ${JSON.stringify(key)}: [${list.join(", ")}],`);
  }
  lines.push("};", "");
  fs.writeFileSync(OUT, lines.join("\n"));
  console.log(`\nwrote ${OUT}`);
}

main();
