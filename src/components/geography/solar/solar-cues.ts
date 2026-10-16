import type { Cue } from "@/lib/narration-cues";
import type { SolarInset } from "./insets";
import type { SolarView } from "./SolarScene";

/*
 * What the solar plant shows while the narration reads the lesson (geography-lessons.ts, "solar-power"): where the
 * camera looks, the noon sun's height and the panels' tilt (both glide), the sun tracker, the sun going through the
 * year's heights (`sweep`), which labels light up, and a picture over the scene for what it cannot show.
 */

export type SolarLit = "sun" | "normal" | "inverter" | "transformer" | "grid" | "south" | "tilt" | "power";

export interface SolarShot {
  view: SolarView;
  elevation: number;
  tilt: number;
  tracker: boolean;
  sweep: boolean;
  lit: SolarLit[];
  inset: SolarInset | null;
}

const EQUINOX = 48;
const RESET: Partial<SolarShot> = { elevation: EQUINOX, tilt: 35, tracker: false, sweep: false, lit: [], inset: null };

export const SOLAR_CUES: Cue<SolarShot>[] = [
  // Introduction.
  { at: "მზის ელექტროსადგური მზის სინათლეს", block: 0, set: { view: "overview", ...RESET } },
  { at: "პირდაპირ ელექტროენერგიად აქცევს", set: { lit: ["grid"] } },
  { at: "რამდენ დენს მისცემს პანელი", set: { lit: ["power"] } },
  { at: "რა კუთხით ეცემა მას სხივი", set: { view: "panel", lit: ["sun", "normal"] } },
  { at: "შეცვალე მზის სიმაღლე", set: { elevation: 25, lit: ["sun", "power"] } },
  { at: "და პანელის დახრა", set: { tilt: 60, lit: ["normal", "power"] } },
  // How a panel works.
  { at: "როგორ მუშაობს მზის პანელი", block: 1, set: { view: "panel", ...RESET } },
  { at: "პანელი სილიციუმის", set: { inset: "cell" } },
  { at: "სადგურში ბევრი პანელი", set: { inset: null, view: "overview" } },
  { at: "ინვერტორი მუდმივ დენს", set: { view: "station", lit: ["inverter"], inset: "dcac" } },
  { at: "ტრანსფორმატორი ძაბვას ზრდის", set: { lit: ["transformer"], inset: null } },
  { at: "და ენერგია ელექტროქსელში", set: { view: "grid", lit: ["grid"] } },
  // Why the angle matters.
  { at: "რატომ არის მნიშვნელოვანი კუთხე", block: 2, set: { view: "panel", ...RESET, lit: ["normal"] } },
  { at: "სხივის დაცემის კუთხე არის", set: { lit: ["normal", "sun"] } },
  { at: "როცა სხივი პანელს მართობულად", set: { tilt: 90 - EQUINOX, lit: ["normal"] } },
  { at: "1 მ²-ზე ყველაზე მეტი", set: { lit: ["power"] } },
  { at: "დახრილი სხივი", set: { elevation: 45, tilt: 0, lit: ["normal", "power"], inset: "spread" } },
  { at: "დაბალი მზის შუქი", set: { elevation: 12, tilt: 35, lit: ["sun"], inset: "airmass" } },
  { at: "ამიტომ ზამთარში", set: { view: "overview", elevation: 25, lit: ["sun", "power"], inset: null } },
  { at: "ვიდრე ზაფხულში", set: { elevation: 72 } },
  // How panels are set up.
  { at: "როგორ აყენებენ პანელებს", block: 3, set: { view: "overview", ...RESET } },
  { at: "პანელებს სამხრეთისკენ აბრუნებენ", set: { view: "side", lit: ["south"] } },
  { at: "უძრავ პანელს", set: { view: "side", tilt: 0, lit: ["tilt"] } },
  { at: "საქართველოში ~30°–40°", set: { tilt: 38 } },
  { at: "ეს წლის განმავლობაში", set: { sweep: true, lit: ["power"] } },
  { at: "ტრეკერი", block: 3, set: { tracker: true, lit: ["normal", "power"] } },
  { at: "მწკრივებს ერთმანეთისგან", set: { tracker: false, sweep: false, elevation: 25, tilt: 35, lit: [] } },
  { at: "ზამთრის დაბალ მზეზე", set: { elevation: 20 } },
];
