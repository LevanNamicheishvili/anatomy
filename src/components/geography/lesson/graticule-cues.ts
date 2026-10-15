import type { Cue } from "@/lib/narration-cues";

/*
 * What the degree-grid globe shows while the narration reads the lesson (geography-lessons.ts, "lat-lon"): where
 * the camera looks, which lines light up (the parallels, the meridians, one of the named lines), and the marker
 * with its coordinates on the place the voice names.
 */

export type GridLit = "grid" | "parallels" | "meridians" | "equator" | "prime" | "tropics" | "polar" | "special" | "between";

export interface GridShot {
  /** Latitude, longitude and distance of the camera's view. */
  view: [number, number, number];
  lit: GridLit | null;
  /** The marker (a parallel and a meridian through the point, and its coordinates). */
  mark: [number, number] | null;
}

const TBILISI: [number, number] = [41.72, 44.79];

export const GRID_CUES: Cue<GridShot>[] = [
  // Introduction.
  { at: "ნებისმიერი ადგილის ზუსტი მისამართი", set: { view: [32, 30, 3.5], lit: null, mark: null } },
  { at: "განედი და გრძედი", set: { mark: [41.9, 12.5], view: [38, 15, 3.2] } },
  { at: "წარმოსახვითი ხაზების ბადით", set: { lit: "grid", mark: null, view: [25, 25, 3.6] } },
  { at: "მიიტანე კურსორი", set: { lit: null } },
  // Parallels and latitude.
  { at: "პარალელები და განედი", block: 1, set: { view: [20, 30, 3.6], lit: "parallels", mark: null } },
  { at: "ეკვატორი (0°)", set: { view: [5, 20, 3.4], lit: "equator" } },
  { at: "პოლუსებისკენ პარალელები", set: { view: [62, 20, 3.3], lit: "parallels" } },
  { at: "პოლუსი კი უბრალოდ წერტილია", set: { view: [84, 20, 3.0], mark: [89.99, 0] } },
  { at: "განედი არის ადგილის", set: { view: [25, 30, 3.5], lit: "equator", mark: null } },
  { at: "41° ჩ. გ.", set: { view: [38, 44.8, 3.2], mark: [41, 44.8], lit: null } },
  { at: "34° ს. გ.", set: { view: [-30, 18.4, 3.2], mark: [-34, 18.4] } },
  // Meridians and longitude.
  { at: "მერიდიანები და გრძედი", block: 2, set: { view: [20, 0, 3.6], lit: "meridians", mark: null } },
  { at: "ყველა მერიდიანი ერთნაირი", set: { view: [32, -30, 3.8] } },
  { at: "საწყისად 1884 წლიდან", set: { view: [48, 0, 3.2], lit: "prime", mark: [51.48, 0] } },
  { at: "გრძედი არის ადგილის", set: { view: [22, 20, 3.6], mark: null } },
  { at: "44° აღმ. გრ.", set: { view: [36, 44, 3.3], mark: [41.7, 44], lit: "prime" } },
  { at: "74° დას. გრ.", set: { view: [36, -74, 3.3], mark: [40.7, -74] } },
  // The named parallels.
  { at: "განსაკუთრებული პარალელები", block: 3, set: { view: [22, 30, 3.8], lit: "special", mark: null } },
  { at: "ჩრდილოეთისა და სამხრეთის ტროპიკები", set: { view: [0, 30, 3.7], lit: "tropics" } },
  { at: "პოლარული წრეები", set: { view: [58, 30, 3.6], lit: "polar" } },
  { at: "საქართველო დაახლოებით", set: { view: [42, 44, 2.1], lit: null } },
  { at: "ზომიერ სარტყელში", set: { view: [45, 44, 3.4], lit: "between" } },
  { at: "თბილისის კოორდინატებია", set: { view: [41.72, 44.79, 2.1], mark: TBILISI, lit: null } },
  // What the grid is for.
  { at: "რისთვის გვჭირდება ბადე", block: 4, set: { view: [30, 20, 3.6], mark: null, lit: "grid" } },
  { at: "GPS ტელეფონში", set: { view: [41.72, 44.79, 2.6], mark: TBILISI, lit: null } },
  { at: "ერთი გრადუსი განედი", set: { lit: "parallels" } },
];
