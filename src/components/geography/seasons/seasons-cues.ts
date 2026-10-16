import type { Cue } from "@/lib/narration-cues";

/*
 * What the seasons lesson shows while the narration reads it (geography-lessons.ts, "seasons"): the date and the
 * clock (they glide, so the Earth is seen turning and running round the Sun), whether the Earth spins by itself or
 * runs round its orbit, the time zones, where the camera looks — at the globe, or out at the Sun and the orbit —,
 * what lights up, and a picture over the scene (the slant of the sunbeams, New Year in Sydney).
 */

/**
 * Camera views. On the globe: sideways to the sun (day and night halves), the lit side, over a pole, or a place on
 * the Earth. Out in space: the whole orbit from the side or from above, or beside the Earth with the Sun in view.
 */
export type SeasonsView = "side" | "day" | "north" | "south" | "tbilisi" | "greenwich" | "dateline" | "australia" | "cities" | "orbit" | "orbit-top" | "orbit-near";

export type SeasonsLit =
  | "terminator"
  | "daynight"
  | "axis"
  | "polaris"
  | "four"
  | "distance"
  | "tropic-n"
  | "tropic-s"
  | "equator"
  | "arctic"
  | "antarctic"
  | "cities"
  | "tbilisi"
  | "london"
  | "zones"
  | "dateline";

export interface SeasonsShot {
  day: number;
  /** Tbilisi clock. */
  time: number;
  /** The Earth turning by itself (day), running round the sun (year), or still. */
  run: "day" | "year" | null;
  zones: boolean;
  view: SeasonsView;
  lit: SeasonsLit | null;
  /** The picture of the sunbeams falling straight (high sun) or slanted (low sun). */
  beams: "high" | "low" | null;
  /** New Year on the beach in Sydney, in the snow at home. */
  card: "newyear" | null;
}

const CLEAR = { beams: null, card: null } as const;

export const SEASONS_CUES: Cue<SeasonsShot>[] = [
  // Introduction.
  { at: "როცა თბილისში მზე ამოდის", set: { day: 79, time: 6.3, run: null, zones: false, view: "cities", lit: "cities", ...CLEAR } },
  { at: "ზაფხულში დღე გრძელია", set: { day: 172, time: 13, view: "side", lit: "tropic-n" } },
  { at: "ზამთარში — მოკლე", set: { day: 355, lit: "tropic-s" } },
  { at: "ორივე მოვლენას ერთი მიზეზი", set: { day: 172, lit: "axis" } },
  { at: "ამავდროულად მზის გარშემო", set: { run: "year", view: "orbit", lit: null } },
  { at: "ამოძრავე საათი და თარიღი", set: { run: null, day: 172, time: 16, view: "side" } },
  // Day and night: the Earth turning.
  { at: "დღე და ღამე: დედამიწის ბრუნვა", block: 1, set: { day: 79, run: "day", view: "side", lit: "axis", ...CLEAR } },
  { at: "მზე ყოველთვის დედამიწის მხოლოდ ნახევარს", set: { run: "day", view: "orbit-near", lit: "daynight" } },
  { at: "დღისა და ღამის საზღვარს", set: { run: null, view: "side", lit: "terminator" } },
  { at: "ბრუნვის გამო ყოველი ადგილი", set: { time: 4.5, run: "day", view: "tbilisi", lit: "tbilisi" } },
  { at: "რადგან დედამიწა აღმოსავლეთისკენ", set: { view: "north", lit: "terminator" } },
  // The seasons: the Earth round the Sun with its axis leaning one way.
  { at: "წელიწადის დროები: ღერძის დახრა", block: 2, set: { run: null, day: 172, time: 16, view: "orbit", lit: "four", ...CLEAR } },
  { at: "დედამიწა მზის გარშემო ერთ ბრუნს", set: { run: "year", lit: null } },
  { at: "მისი ღერძი ორბიტის სიბრტყის", set: { run: null, day: 172, lit: "polaris" } },
  { at: "ამიტომ ივნისში", set: { day: 172, view: "orbit-near", lit: null } },
  { at: "სხივები თითქმის მართობულად", set: { beams: "high" } },
  { at: "დეკემბერში მზისკენ", set: { day: 355, beams: null } },
  { at: "სხივები ირიბად ეცემა", set: { beams: "low" } },
  { at: "ავსტრალიაში ამ დროს", set: { day: 365, time: 6, view: "australia", lit: null, beams: null, card: "newyear" } },
  { at: "მნიშვნელოვანია: წელიწადის", set: { day: 3, view: "orbit-top", lit: "distance", card: null } },
  // Equinoxes and solstices.
  { at: "ბუნიობა და მზედგომა", block: 3, set: { day: 79, time: 16, run: null, view: "orbit", lit: "four", ...CLEAR } },
  { at: "მზე შუადღისას ზენიტშია ეკვატორზე", set: { view: "side", lit: "equator" } },
  { at: "ტერმინატორი ორივე პოლუსზე", set: { lit: "terminator" } },
  { at: "ზაფხულის მზედგომისას", set: { day: 172, lit: "tropic-n" } },
  { at: "თბილისში დაახლოებით 15 საათი", set: { view: "tbilisi", lit: "tbilisi" } },
  { at: "ჩრდილოეთის პოლარული წრის იქით", set: { view: "north", run: "day", lit: "arctic" } },
  { at: "ზამთრის მზედგომისას", set: { day: 355, run: null, time: 16, view: "side", lit: "tropic-s" } },
  { at: "თბილისში დღე სულ", set: { view: "tbilisi", lit: "tbilisi" } },
  { at: "არქტიკაში კი პოლარული ღამეა", set: { view: "north", run: "day", lit: "arctic" } },
  // Time zones.
  { at: "საათის სარტყლები", block: 4, set: { day: 172, time: 16, run: null, zones: true, view: "tbilisi", lit: "zones", ...CLEAR } },
  { at: "ათვლა იწყება გრინვიჩის", set: { view: "greenwich", lit: "london" } },
  { at: "აღმოსავლეთით დრო მატულობს", set: { lit: "zones" } },
  { at: "საქართველო იყენებს", set: { view: "cities", lit: "cities" } },
  { at: "სარტყლების საზღვრები ზუსტად", set: { lit: "zones" } },
  { at: "180-ე მერიდიანის მახლობლად", set: { view: "dateline", lit: "dateline" } },
];
