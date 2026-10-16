import type { Cue } from "@/lib/narration-cues";
import type { SkyLit, SkyView } from "./SkyScene";

/*
 * What the night sky shows while the narration reads the lesson (geography-lessons.ts, "polaris"): where the
 * camera looks, the latitude and the sky's turn (sidereal time, hours), whether the sky turns by itself, what
 * lights up, the pointer line drawn out to Polaris, the stars' circles round the pole, the axis to the celestial
 * pole, the altitude arc, and the azimuth arrow on the ground (a pair sweeps from the first angle to the second).
 */

export interface PolarisShot {
  view: SkyView;
  lat: number;
  time: number;
  turning: boolean;
  lit: SkyLit[];
  pointer: "off" | "on" | "grow";
  trails: boolean;
  axis: boolean;
  arc: boolean;
  /** Azimuth arrow (degrees from north, clockwise), [from, to] to sweep, null: hidden. */
  az: number | [number, number] | null;
  azArc: boolean;
  /** The place the azimuth points to (from Tbilisi). */
  place: string | null;
}

const TBILISI_LAT = 41.7;
/** Sidereal time when the Big Dipper stands west of Polaris, beside it (the pointer runs across). */
const DIPPER_SIDE = 18;
/** The Big Dipper low over the northern horizon, Cassiopeia high above Polaris. */
const DIPPER_LOW = 0.5;
const CLEAR = { pointer: "off", trails: false, axis: false, arc: false, az: null, azArc: false, place: null } as const;

export const POLARIS_CUES: Cue<PolarisShot>[] = [
  // Introduction.
  { at: "კომპასამდე მეზღვაურები", block: 0, set: { view: "sky", lat: TBILISI_LAT, time: DIPPER_SIDE, turning: false, lit: [], ...CLEAR } },
  { at: "ჩრდილოეთის ცაზე ერთი ვარსკვლავი", set: { view: "north", turning: true, lit: ["polaris"] } },
  { at: "ის ჩრდილოეთს გვიჩვენებს", set: { view: "ground", turning: false, lit: ["polaris", "n"], az: 0 } },
  { at: "მისი სიმაღლე კი", set: { view: "side", lit: ["polaris"], az: null, arc: true } },
  { at: "დაატრიალე ცა", set: { view: "north", arc: false, turning: true, lit: [] } },
  { at: "შეცვალე განედი", set: { turning: false, view: "side", arc: true, lat: 69 } },
  { at: "ისწავლე აზიმუტით", set: { view: "ground", arc: false, lat: TBILISI_LAT, az: [0, 120], azArc: true } },
  // Why Polaris does not move.
  { at: "რატომ არ მოძრაობს", block: 1, set: { view: "north", lat: TBILISI_LAT, time: DIPPER_SIDE, turning: false, lit: ["polaris"], ...CLEAR } },
  { at: "დედამიწის ბრუნვის გამო", set: { turning: true, lit: [] } },
  { at: "ბრუნვის ღერძი", set: { axis: true } },
  { at: "პოლარული ვარსკვლავი ამ წერტილთან", set: { lit: ["polaris"] } },
  { at: "დანარჩენი ვარსკვლავები კი", set: { trails: true, lit: [] } },
  { at: "პოლარული ვარსკვლავი ცაზე ყველაზე კაშკაშა", set: { turning: false, trails: false, axis: false, lit: ["polaris"] } },
  { at: "დიდი დათვის", block: 1, set: { view: "dipper", time: DIPPER_SIDE, lit: ["uma"] } },
  { at: "რომელიც საქართველოდან მთელი წლის", set: { view: "north", turning: true, trails: true } },
  // How to find north.
  { at: "როგორ ვიპოვოთ ჩრდილოეთი", block: 2, set: { view: "dipper", lat: TBILISI_LAT, time: DIPPER_SIDE, turning: false, lit: ["uma"], ...CLEAR } },
  { at: "კიდის ორ ვარსკვლავს", set: { lit: ["uma", "pointers"] } },
  { at: "გაავლე ხაზი", set: { pointer: "grow" } },
  { at: "მიხვალ პოლარულ ვარსკვლავამდე", set: { lit: ["polaris", "pointers"] } },
  { at: "ის პატარა დათვის კუდის", set: { lit: ["umi", "polaris"] } },
  { at: "თუ დიდი დათვი ჰორიზონტთან", set: { view: "north", time: DIPPER_LOW, pointer: "off", lit: ["uma"] } },
  { at: "დაგეხმარება კასიოპეა", set: { view: "cas", lit: ["cas"] } },
  { at: "პოლარულის მეორე მხარეს", set: { lit: ["cas", "polaris"] } },
  { at: "დადექი პოლარული ვარსკვლავისკენ", set: { view: "ground", time: DIPPER_SIDE, lit: ["polaris"], az: 0 } },
  { at: "შენ წინ ჩრდილოეთია", set: { lit: ["n"], az: 0 } },
  { at: "ზურგს უკან", set: { lit: ["s"], az: 180 } },
  { at: "მარჯვენა ხელის მხარეს", set: { lit: ["e"], az: 90 } },
  { at: "მარცხენა ხელის მხარეს", set: { lit: ["w"], az: 270 } },
  // The height of Polaris is the latitude.
  { at: "პოლარულის სიმაღლე = განედი", block: 3, set: { view: "side", lat: TBILISI_LAT, time: DIPPER_SIDE, turning: false, lit: ["polaris"], ...CLEAR, arc: true } },
  { at: "ეკვატორზე (0°)", set: { lat: 0 } },
  { at: "ჩრდილოეთ პოლუსზე (90°)", set: { lat: 90 } },
  { at: "თბილისში (41,7°", set: { lat: TBILISI_LAT } },
  { at: "ასე ადგენდნენ მეზღვაურები", set: { view: "north" } },
  { at: "სამხრეთ ნახევარსფეროში", set: { view: "side", lat: -30, time: 12.5, arc: false } },
  { at: "სამხრეთის ჯვარს", set: { view: "south", lit: ["crux"] } },
  // Azimuth.
  { at: "აზიმუტი", block: 4, set: { view: "ground", lat: TBILISI_LAT, time: DIPPER_SIDE, turning: false, lit: ["n"], ...CLEAR, az: 0, azArc: true } },
  { at: "საათის ისრის მოძრაობით", set: { az: [0, 359], lit: [] } },
  { at: "ჩრდილოეთი — 0°", block: 4, set: { az: 0, lit: ["n"] } },
  { at: "აღმოსავლეთი — 90°", set: { az: 90, lit: ["e"] } },
  { at: "სამხრეთი — 180°", set: { az: 180, lit: ["s"] } },
  { at: "დასავლეთი — 270°", set: { az: 270, lit: ["w"] } },
  { at: "აზიმუტს კომპასით", set: { az: [0, 60], lit: ["n"] } },
  { at: "თბილისიდან ყაზბეგი", set: { az: 353.3, lit: [], place: "ყაზბეგი" } },
  { at: "თელავი", block: 4, set: { az: 68.2, place: "თელავი" } },
  { at: "ბათუმი", block: 4, set: { az: 269.1, place: "ბათუმი" } },
  { at: "ტყეში ან მთაში", set: { place: null } },
];
