import type { SystemKey } from "./atlas-data";

/**
 * School stages of the Georgian general education system. The quiz, flashcards and topic list only
 * show what fits the chosen stage (each stage also includes everything from the earlier ones).
 * Which structures belong to which stage is our own teaching choice; a biology teacher should confirm it.
 */
export type Level = "primary" | "basic" | "secondary";

export const LEVELS: { key: Level; name: string; grades: string }[] = [
  { key: "primary", name: "დაწყებითი", grades: "I–VI კლასი" },
  { key: "basic", name: "საბაზო", grades: "VII–IX კლასი" },
  { key: "secondary", name: "საშუალო", grades: "X–XII კლასი" },
];

const RANK: Record<Level, number> = { primary: 0, basic: 1, secondary: 2 };
export const fitsLevel = (item: Level, chosen: Level) => RANK[item] <= RANK[chosen];

/** Systems shown while asking about a structure, so it is visible and not hidden under others. */
const ORGANS: SystemKey[] = ["cardiac", "respiratory", "digestive", "urinary", "nervous", "lymphatic", "endocrine", "sensory"];
const BONES: SystemKey[] = ["skeletal"];
const MUSCLES: SystemKey[] = ["skeletal", "muscular"];

export interface LearnItem {
  /** Exact name in the search index (all names here are verified textbook terms). */
  name: string;
  level: Level;
  show: SystemKey[];
  /** Answer choices are drawn from the same group, so they are plausible. */
  group: "organ" | "bone" | "muscle";
}

const item = (name: string, level: Level, group: LearnItem["group"]): LearnItem => ({
  name,
  level,
  group,
  show: group === "organ" ? ORGANS : group === "bone" ? BONES : MUSCLES,
});

export const LEARN_ITEMS: LearnItem[] = [
  // Primary: the big organs and bones every pupil meets first.
  item("გული", "primary", "organ"),
  item("ფილტვები", "primary", "organ"),
  item("თავის ტვინი", "primary", "organ"),
  item("კუჭი", "primary", "organ"),
  item("ღვიძლი", "primary", "organ"),
  item("თირკმელები", "primary", "organ"),
  item("წვრილი ნაწლავი", "primary", "organ"),
  item("მსხვილი ნაწლავი", "primary", "organ"),
  item("თვალი", "primary", "organ"),
  item("თავის ქალა", "primary", "bone"),
  item("ხერხემალი", "primary", "bone"),
  item("ნეკნები", "primary", "bone"),
  item("ბარძაყის ძვალი", "primary", "bone"),
  item("კბილები", "primary", "bone"),
  // Basic: the skeleton in detail, main muscles, smaller organs.
  item("მხრის ძვალი", "basic", "bone"),
  item("სხივის ძვალი", "basic", "bone"),
  item("იდაყვის ძვალი", "basic", "bone"),
  item("დიდი წვივის ძვალი", "basic", "bone"),
  item("მცირე წვივის ძვალი", "basic", "bone"),
  item("ლავიწი", "basic", "bone"),
  item("ბეჭი", "basic", "bone"),
  item("მენჯის ძვალი", "basic", "bone"),
  item("კვირისთავი", "basic", "bone"),
  item("ქვედა ყბა", "basic", "bone"),
  item("დიაფრაგმა", "basic", "muscle"),
  item("ბარძაყის სწორი კუნთი", "basic", "muscle"),
  item("თერძის კუნთი", "basic", "muscle"),
  item("დუნდულოს დიდი კუნთი", "basic", "muscle"),
  item("მხრის კუნთი", "basic", "muscle"),
  item("ელენთა", "basic", "organ"),
  item("ნაღვლის ბუშტი", "basic", "organ"),
  item("შარდის ბუშტი", "basic", "organ"),
  item("კუჭქვეშა ჯირკვალი", "basic", "organ"),
  // Secondary: individual skull and hand/foot bones, more muscles.
  item("შუბლის ძვალი", "secondary", "bone"),
  item("კეფის ძვალი", "secondary", "bone"),
  item("თხემის ძვალი", "secondary", "bone"),
  item("საფეთქლის ძვალი", "secondary", "bone"),
  item("ზედა ყბა", "secondary", "bone"),
  item("ყვრიმალის ძვალი", "secondary", "bone"),
  item("ქუსლის ძვალი", "secondary", "bone"),
  item("მაჯის ძვალი", "secondary", "bone"),
  item("წინა დაკბილული კუნთი", "secondary", "muscle"),
  item("მუცლის გარეთა ირიბი კუნთი", "secondary", "muscle"),
  item("დიდი მომზიდველი კუნთი", "secondary", "muscle"),
  item("დიდი წვივის წინა კუნთი", "secondary", "muscle"),
  item("ბარძაყის გარეთა განიერი კუნთი", "secondary", "muscle"),
  item("მცირე გულმკერდის კუნთი", "secondary", "muscle"),
];

/** Topics suited to primary school; every topic is shown from the basic stage on. */
export const PRIMARY_TOPICS = new Set(["heart", "lungs", "skeleton", "muscles", "brain", "stomach", "eye", "digestion"]);

export const topicFitsLevel = (slug: string, level: Level) => level !== "primary" || PRIMARY_TOPICS.has(slug);

// ---- Saved progress (per browser) -------------------------------------------------------------

const safeGet = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeSet = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or blocked storage: progress just isn't remembered.
  }
};

export function loadLevel(): Level {
  const v = safeGet("atlas-level");
  return v === "primary" || v === "basic" || v === "secondary" ? v : "basic";
}
export const saveLevel = (level: Level) => safeSet("atlas-level", level);

/** Flashcard boxes (Leitner system): 1 = still learning … 5 = known well. */
export function loadBoxes(): Record<string, number> {
  try {
    const v = JSON.parse(safeGet("atlas-cards") ?? "{}") as unknown;
    return v && typeof v === "object" ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}
export const saveBoxes = (boxes: Record<string, number>) => safeSet("atlas-cards", JSON.stringify(boxes));

/** Next card: lower boxes come up far more often; never the same card twice in a row. */
export function nextCard(items: LearnItem[], boxes: Record<string, number>, last: string | null): LearnItem | null {
  const pool = items.filter((i) => i.name !== last);
  if (!pool.length) return items[0] ?? null;
  const weights = pool.map((i) => 1 / 2 ** ((boxes[i.name] ?? 1) - 1));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < pool.length; k++) {
    r -= weights[k];
    if (r <= 0) return pool[k];
  }
  return pool[pool.length - 1];
}

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
