/*
 * How the narration says what is not plain Georgian words: Latin letters and symbols (CO₂, pH, Aa, F₁, XV, N),
 * signs and units (°C, %, ×, ÷, ≈, ~, კმ-მდე, 200 მ-ის), abbreviations (დნმ, კჯ), decimals and ranges.
 * Many depend on where they stand (C before „ვიტამინი“ is „ცე“, in a list of elements „ნახშირბადი“), so every
 * occurrence is collected with the words round it and Gemini writes how a Georgian teacher reads it aloud.
 * The answers go to scripts/data/narration-say.json — keyed by the word with its neighbours, reviewed by hand,
 * committed — and build-narration.ts reads them.
 *
 *   npx tsx scripts/narration/spoken-forms.ts            add the occurrences not in the file yet
 *   npx tsx scripts/narration/spoken-forms.ts --list     print the file (to review it)
 */
import fs from "node:fs";
import path from "node:path";
import { GEO_LESSONS } from "../../src/lib/geography-lessons";
import { GRADE_8 } from "../../src/lib/lessons/grade-8";
import { GRADE_9 } from "../../src/lib/lessons/grade-9";
import { GRADE_10 } from "../../src/lib/lessons/grade-10";
import { GRADE_11 } from "../../src/lib/lessons/grade-11";
import { GRADE_12 } from "../../src/lib/lessons/grade-12";
import { STRINGS } from "../../src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/i18n";
import { TOPICS } from "../../src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/topics";
import { narrationBlocks, narrationWords, topicNarrationBlocks, type NarrationBlock } from "../../src/lib/narration";

const ROOT = path.resolve(__dirname, "../..");
const FILE = path.join(ROOT, "scripts/data/narration-say.json");
const MODEL = "gemini-3.8-flash";

/** A word that needs a reading: Latin, digits with signs, special signs, or a Georgian abbreviation (no vowels). */
export function needsReading(word: string, prev: string) {
  const core = word.replace(/^[„“"«(]+|[.,!?:;…»“”")]+$/g, "");
  if (!core) return false;
  if (/[A-Za-z°%²³₀-₉⁰-⁹⁺⁻×÷=≈~√·+<>≤≥/ᴴʰ]/.test(core)) return true;
  if (/\d[.,:–-]\d/.test(core) || /^\d.*-[ა-ჰ]/.test(core)) return true;
  const base = core.split("-")[0];
  if (/^[ა-ჰ]{1,5}$/.test(base) && !/[აეიოუ]/.test(base)) return true;
  // A one-letter unit after a number: „5047 მ“.
  return /^[ა-ჰ]$/.test(base) && /\d/.test(prev);
}

/** The key of an occurrence: the word with one word either side. */
export const sayKey = (prev: string, word: string, next: string) => `${prev} ⟨${word}⟩ ${next}`;

export function loadSay(): Record<string, string> {
  return fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
}

function allBlocks(): NarrationBlock[][] {
  const bio = [GRADE_8, GRADE_9, GRADE_10, GRADE_11, GRADE_12].flatMap((m) => Object.values(m).filter((c) => !c.sensitive));
  return [...GEO_LESSONS.map((l) => narrationBlocks(l)), ...bio.map((c) => narrationBlocks(c)), ...TOPICS.map((t) => topicNarrationBlocks(t, STRINGS.ka.topicFacts, STRINGS.ka.topicHealth))];
}

/** Every occurrence: key, the word, and a stretch of text round it. */
function occurrences() {
  const out = new Map<string, { word: string; context: string }>();
  for (const blocks of allBlocks())
    for (const b of blocks)
      for (const text of [b.heading ?? "", ...b.paragraphs]) {
        const w = narrationWords(text);
        w.forEach((word, i) => {
          if (!needsReading(word, w[i - 1] ?? "")) return;
          const key = sayKey(w[i - 1] ?? "", word, w[i + 1] ?? "");
          if (!out.has(key)) out.set(key, { word, context: w.slice(Math.max(0, i - 8), i + 8).join(" ") });
        });
      }
  return out;
}

const PROMPT = `You prepare a Georgian school lesson for a text-to-speech voice. For each item, write how a Georgian teacher reads the WORD aloud in that sentence, in Georgian letters only, as it is said: numbers as words (with the case ending the word has), units and signs spelled out (°C → გრადუსი, % → პროცენტი, კმ-მდე → კილომეტრამდე, 200 მ-ის → ორასი მეტრის, × → გამრავლებული, ÷ → გაყოფილი, = → უდრის, ≈ → დაახლოებით, ~ → დაახლოებით, ranges 5–10 → ხუთიდან ათამდე), decimals with a comma as Georgians say them (1,5 → ერთი მთელი ხუთი მეათედი), Roman numerals as ordinals when they number something (XV საუკუნე → მეთხუთმეტე), abbreviations as said (დნმ → დე-ენ-ემი, კჯ → კილოჯოული), chemical formulas and ions in words (CO₂ → ნახშირორჟანგი, K⁺ → კალიუმის იონი, NaCl → ნატრიუმის ქლორიდი, pH → პე-აში), element symbols in a list as the element names (O → ჟანგბადი, Fe → რკინა), a letter in brackets after an element's name as the letter (აზოტი (N) → ენ), vitamin letters as Georgian letter names (C ვიტამინი → ცე), alleles and genotypes as Georgian teachers say them (A → დიდი ა, a → პატარა ა, Aa → დიდი ა პატარა ა, F₁ → ეფ-ერთი), sex chromosomes (XY → იქს-იგრეკი). Keep the case ending and any hyphen-joined part of the word (CO₂-ს → ნახშირორჟანგს, pH-ზე → პე-აშზე). Do not add words that are not there; keep punctuation out. Answer with one JSON object: {"<id>": "<spoken form>", ...} for every id.`;

async function ask(items: { id: string; word: string; context: string }[], key: string) {
  const body = {
    contents: [{ parts: [{ text: `${PROMPT}\n\nItems:\n${JSON.stringify(items.map(({ id, word, context }) => ({ id, word, context })), null, 1)}` }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
  };
  for (let attempt = 1; attempt < 8; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, { method: "POST", headers: { "x-goog-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      const j = await res.json();
      return JSON.parse(j.candidates[0].content.parts.map((p: { text?: string }) => p.text ?? "").join("")) as Record<string, string>;
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 6000 * attempt));
      continue;
    }
    throw new Error(`${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  throw new Error("Gemini did not answer");
}

async function main() {
  const say = loadSay();
  if (process.argv.includes("--list")) {
    for (const [k, v] of Object.entries(say)) console.log(`${k}  →  ${v}`);
    return;
  }
  const key = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").match(/^GEMINI_API_KEY=(.+)$/m)?.[1].trim();
  if (!key) throw new Error("GEMINI_API_KEY is missing from .env.local");
  const todo = [...occurrences()].filter(([k]) => !(k in say)).map(([k, v], i) => ({ id: String(i), key: k, ...v }));
  console.log(`${todo.length} occurrences to read`);
  for (let i = 0; i < todo.length; i += 60) {
    const batch = todo.slice(i, i + 60);
    const answers = await ask(batch, key);
    for (const it of batch) if (answers[it.id]) say[it.key] = answers[it.id].trim();
    fs.writeFileSync(FILE, JSON.stringify(say, null, 1));
    console.log(`  ${Math.min(i + 60, todo.length)}/${todo.length}`);
  }
}

if (require.main === module) void main();
