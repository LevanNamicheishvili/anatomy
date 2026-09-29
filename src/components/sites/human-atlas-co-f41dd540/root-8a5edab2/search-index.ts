import type { AtlasManifest, AtlasPart } from "./atlas-data";
import { georgianName } from "./georgian-names";

/** A searchable group of atlas pieces, always labelled in Georgian. */
export interface SearchEntry {
  key: string;
  name: string;
  conceptId: string;
  ids: string[];
  /** English source names, used only for matching (never displayed). */
  en: string;
  /** Whole organs / systems rank above individual pieces. */
  priority?: boolean;
  /** Topic slug with a full Georgian explanation, when one exists. */
  topic?: string;
}

interface OrganGroup {
  name: string;
  concepts?: string[];
  match?: (p: AtlasPart) => boolean;
  topic?: string;
}

// Whole organs and systems pupils usually look for; built from FMA concepts or name rules.
const ORGANS: OrganGroup[] = [
  { name: "გული", concepts: ["heart"], topic: "heart" },
  { name: "ღვიძლი", concepts: ["liver"], topic: "liver" },
  { name: "ფილტვები", concepts: ["right lung", "left lung"], topic: "lungs" },
  { name: "მარჯვენა ფილტვი", concepts: ["right lung"] },
  { name: "მარცხენა ფილტვი", concepts: ["left lung"] },
  { name: "თავის ტვინი", concepts: ["brain"], topic: "brain" },
  { name: "ხერხემალი", concepts: ["vertebral column"], topic: "spine" },
  { name: "თავის ქალა", concepts: ["skull"] },
  { name: "წვრილი ნაწლავი", concepts: ["small intestine"], topic: "digestion" },
  { name: "მსხვილი ნაწლავი", concepts: ["large intestine"], topic: "digestion" },
  { name: "კუჭი", concepts: ["stomach"], topic: "stomach" },
  { name: "თირკმელები", match: (p) => /kidney/i.test(p.name), topic: "kidneys" },
  {
    name: "თვალი",
    match: (p) => p.system === "sensory" && /eyeball|cornea|lens|iris|retina|sclera|choroid|vitreous|corona ciliaris/i.test(p.name),
    topic: "eye",
  },
  { name: "ნეკნები", match: (p) => /\brib\b/i.test(p.name) },
  { name: "კბილები", match: (p) => /tooth/i.test(p.name) },
  { name: "ჩონჩხი", match: (p) => p.system === "skeletal", topic: "skeleton" },
  { name: "კუნთები", match: (p) => p.system === "muscular", topic: "muscles" },
  { name: "არტერიები", match: (p) => p.system === "arterial", topic: "circulation" },
  { name: "ვენები", match: (p) => p.system === "venous", topic: "circulation" },
  { name: "ნერვები", match: (p) => p.system === "nervous" },
  { name: "საჭმლის მომნელებელი სისტემა", match: (p) => p.system === "digestive", topic: "digestion" },
];

const SIDE = /^(მარცხენა|მარჯვენა) /;

/**
 * Index every structure under its Georgian name. Left/right pairs are also grouped under the
 * side-less name, so "ბარძაყის ძვალი" selects both femurs.
 */
export function buildSearchIndex(manifest: AtlasManifest): SearchEntry[] {
  const byKey = new Map<string, SearchEntry>();
  const add = (name: string, conceptId: string, id: string, en: string) => {
    const key = name.toLowerCase();
    const entry = byKey.get(key);
    if (entry) {
      if (!entry.ids.includes(id)) entry.ids.push(id);
    } else {
      byKey.set(key, { key, name, conceptId, ids: [id], en: en.toLowerCase() });
    }
  };
  const partIds = new Set(manifest.parts.map((p) => p.id));
  for (const organ of ORGANS) {
    const ids = new Set<string>();
    let conceptId = "";
    for (const c of manifest.concepts) {
      if (!organ.concepts?.includes(c.name)) continue;
      conceptId ||= c.id;
      c.elements.forEach((id) => partIds.has(id) && ids.add(id));
    }
    if (organ.match) for (const p of manifest.parts) if (organ.match(p)) ids.add(p.id);
    if (!ids.size) continue;
    const first = manifest.parts.find((p) => ids.has(p.id));
    byKey.set(organ.name, {
      key: organ.name,
      name: organ.name,
      conceptId: conceptId || first?.conceptId || "",
      ids: [...ids],
      en: organ.concepts?.join(" ") ?? "",
      priority: true,
      topic: organ.topic,
    });
  }

  for (const p of manifest.parts) {
    const g = georgianName(p.name, p.system);
    if (!g.exact) continue;
    add(g.name, p.conceptId, p.id, p.name);
    const sideless = g.name.replace(SIDE, "");
    if (sideless !== g.name) add(sideless, p.conceptId, p.id, p.name.replace(/^(left|right) /i, ""));
  }
  return Array.from(byKey.values());
}

// Everyday Georgian words → names used in the index (so pupils can type what they know).
const SYNONYMS: [string, string][] = [
  ["სასულ", "ტრაქეა"],
  ["ნაწლავ", "წვრილი ნაწლავი"],
  ["ყბ", "ყბა"],
];

/** Drop common Georgian case endings so "ღვიძლს", "ღვიძლის" and "ღვიძლი" all match. */
function stem(word: string): string {
  const w = word.trim();
  if (w.length <= 3) return w;
  const endings = ["ებისთვის", "ისთვის", "ებით", "ების", "ებს", "ებში", "ებზე", "ისა", "ის", "ით", "ში", "ზე", "ს", "ი", "ა", "ო", "ე"];
  for (const e of endings) if (w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, -e.length);
  return w;
}

export function searchIndex(index: SearchEntry[], query: string, limit = 40): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const georgian = /[Ⴀ-ჿ]/.test(q);
  let stems = q.split(/\s+/).filter(Boolean).map(stem);
  if (georgian) {
    const syn = SYNONYMS.find(([s]) => q.startsWith(s));
    if (syn && !index.some((e) => e.key.includes(stems[0]))) stems = syn[1].split(" ").map(stem);
  }

  const scored: { entry: SearchEntry; score: number }[] = [];
  for (const entry of index) {
    const hay = georgian ? entry.key : entry.en;
    if (!stems.every((s) => hay.includes(s))) continue;
    const first = stems[0];
    const at = hay.indexOf(first);
    let score = hay === q ? 0 : at === 0 ? 1 : /\s/.test(hay[at - 1] ?? "") ? 2 : 3;
    if (SIDE.test(entry.name)) score += 0.5; // prefer the grouped (left + right) result
    if (entry.priority) score -= 2;
    score += hay.length / 200;
    scored.push({ entry, score });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.entry);
}

const QUESTION_WORDS = new Set(
  "რა რას რის რისთვის როგორ სად რატომ რომელი რომელ რამდენი არის აქვს აქვთ ფუნქცია ფუნქციას ფუნქციები როლი როლს მუშაობს მუშაობენ გვჭირდება საჭიროა ადამიანის ადამიანს სხეულში სხეულის სხეული მდებარეობს მოთავსებული შენი ჩემი და თუ ეს ის აკეთებს ემსახურება what is are the of how where why which does do role function".split(
    " ",
  ),
);

/** Resolve a free-form (Georgian) question to the best matching structure, fully offline. */
export function answerQuestion(index: SearchEntry[], question: string): SearchEntry | null {
  const words = question
    .toLowerCase()
    .replace(/[?!.,;:«»"“”()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !QUESTION_WORDS.has(w));
  if (!words.length) return null;
  // Prefer the longest phrase that matches, e.g. "ბარძაყის ძვალი" before "ძვალი".
  for (let size = Math.min(words.length, 4); size >= 1; size--) {
    const hits: SearchEntry[] = [];
    for (let i = 0; i + size <= words.length; i++) {
      const hit = searchIndex(index, words.slice(i, i + size).join(" "), 1)[0];
      if (hit) hits.push(hit);
    }
    // A whole organ ("ჩონჩხი") beats a single piece ("ინის ძვალი") mentioned in the same question.
    const best = hits.find((h) => h.priority) ?? hits[0];
    if (best) return best;
  }
  return null;
}
