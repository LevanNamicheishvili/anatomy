import type { Cue } from "@/lib/narration-cues";

/*
 * What the seasons globe shows while the narration reads the lesson (geography-lessons.ts, "seasons"): the
 * date and the clock (they glide, so the Earth is seen turning and its axis swinging round the year), whether the
 * Earth spins by itself or runs round its orbit, the time zones, where the camera looks, and what lights up.
 */

/** Camera views: sideways to the sun (day and night halves), the lit side, over a pole, or a place on the Earth. */
export type SeasonsView = "side" | "day" | "north" | "south" | "tbilisi" | "greenwich" | "dateline" | "australia" | "cities";

export type SeasonsLit = "terminator" | "axis" | "tropic-n" | "tropic-s" | "equator" | "arctic" | "antarctic" | "cities" | "tbilisi" | "london" | "zones" | "dateline";

export interface SeasonsShot {
  day: number;
  /** Tbilisi clock. */
  time: number;
  /** The Earth turning by itself (day), running round the sun (year), or still. */
  run: "day" | "year" | null;
  zones: boolean;
  view: SeasonsView;
  lit: SeasonsLit | null;
}

export const SEASONS_CUES: Cue<SeasonsShot>[] = [
  // Introduction.
  { at: "როცა თბილისში მზე ამოდის", set: { day: 79, time: 6.3, run: null, zones: false, view: "cities", lit: "cities" } },
  { at: "ზაფხულში დღე გრძელია", set: { day: 172, time: 13, view: "side", lit: "tropic-n" } },
  { at: "ზამთარში — მოკლე", set: { day: 355, lit: "tropic-s" } },
  { at: "ორივე მოვლენას ერთი მიზეზი", set: { day: 172, lit: "axis" } },
  { at: "ამავდროულად მზის გარშემო", set: { run: "year", lit: null } },
  { at: "ამოძრავე საათი და თარიღი", set: { run: null, day: 172, time: 16, view: "side" } },
  // Day and night: the Earth turning.
  { at: "დღე და ღამე: დედამიწის ბრუნვა", block: 1, set: { day: 79, run: "day", view: "side", lit: "axis" } },
  { at: "მზე ყოველთვის დედამიწის მხოლოდ ნახევარს", set: { run: null, view: "day", lit: "terminator" } },
  { at: "დღისა და ღამის საზღვარს", set: { view: "side", lit: "terminator" } },
  { at: "ბრუნვის გამო ყოველი ადგილი", set: { time: 4.5, run: "day", view: "tbilisi", lit: "tbilisi" } },
  { at: "რადგან დედამიწა აღმოსავლეთისკენ", set: { view: "north", lit: "terminator" } },
  // The seasons: the tilted axis.
  { at: "წელიწადის დროები: ღერძის დახრა", block: 2, set: { run: null, day: 172, time: 16, view: "side", lit: "axis" } },
  { at: "დედამიწა მზის გარშემო ერთ ბრუნს", set: { run: "year", lit: null } },
  { at: "მისი ღერძი ორბიტის სიბრტყის", set: { run: null, day: 172, lit: "axis" } },
  { at: "ამიტომ ივნისში", set: { day: 172, view: "side", lit: "tropic-n" } },
  { at: "დეკემბერში მზისკენ", set: { day: 355, lit: "tropic-s" } },
  { at: "ავსტრალიაში ამ დროს", set: { view: "australia", lit: "tropic-s" } },
  { at: "მნიშვნელოვანია: წელიწადის", set: { day: 3, view: "side", lit: null } },
  // Equinoxes and solstices.
  { at: "ბუნიობა და მზედგომა", block: 3, set: { day: 79, time: 16, view: "side", lit: "equator" } },
  { at: "ტერმინატორი ორივე პოლუსზე", set: { lit: "terminator" } },
  { at: "ზაფხულის მზედგომისას", set: { day: 172, lit: "tropic-n" } },
  { at: "თბილისში დაახლოებით 15 საათი", set: { view: "tbilisi", lit: "tbilisi" } },
  { at: "ჩრდილოეთის პოლარული წრის იქით", set: { view: "north", run: "day", lit: "arctic" } },
  { at: "ზამთრის მზედგომისას", set: { day: 355, run: null, time: 16, view: "side", lit: "tropic-s" } },
  { at: "თბილისში დღე სულ", set: { view: "tbilisi", lit: "tbilisi" } },
  { at: "არქტიკაში კი პოლარული ღამეა", set: { view: "north", run: "day", lit: "arctic" } },
  // Time zones.
  { at: "საათის სარტყლები", block: 4, set: { day: 172, time: 16, run: null, zones: true, view: "tbilisi", lit: "zones" } },
  { at: "ათვლა იწყება გრინვიჩის", set: { view: "greenwich", lit: "london" } },
  { at: "აღმოსავლეთით დრო მატულობს", set: { lit: "zones" } },
  { at: "საქართველო იყენებს", set: { view: "cities", lit: "cities" } },
  { at: "სარტყლების საზღვრები ზუსტად", set: { lit: "zones" } },
  { at: "180-ე მერიდიანის მახლობლად", set: { view: "dateline", lit: "dateline" } },
];
