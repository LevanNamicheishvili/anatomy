import type { Cue } from "@/lib/narration-cues";

/*
 * What the degree-grid globe shows while the narration reads the lesson (geography-lessons.ts, "lat-lon"): where
 * the camera looks, which lines light up (the parallels, the meridians, one of the named lines, Georgia's box), the
 * marker with a forecast-style card of its coordinates on the place the voice names, the arrows of the two
 * directions (latitude: north or south; longitude: east or west), and a picture over the scene.
 */

export type GridLit = "grid" | "parallels" | "meridians" | "equator" | "prime" | "tropics" | "polar" | "special" | "between" | "lengths" | "georgia";

export interface GridShot {
  /** Latitude, longitude and distance of the camera's view. */
  view: [number, number, number];
  lit: GridLit | null;
  /** The marker (a parallel and a meridian through the point, and its coordinates). */
  mark: [number, number] | null;
  /** The marked place's name on its card. */
  place: string | null;
  /** Arrows: latitude goes north or south (from the equator), longitude east or west (from Greenwich). */
  dirs: "lat" | "lon" | null;
  /** A picture over the scene: the parallels' lengths, or all meridians being the same length. */
  inset: "lengths" | "meridians" | null;
}

const TBILISI: [number, number] = [41.72, 44.79];
const CLEAR = { mark: null, place: null, dirs: null, inset: null } as const;

export const GRID_CUES: Cue<GridShot>[] = [
  // Introduction.
  { at: "ნებისმიერი ადგილის ზუსტი მისამართი", set: { view: [32, 30, 3.5], lit: null, ...CLEAR } },
  { at: "განედი და გრძედი", set: { mark: [41.9, 12.5], place: "რომი", view: [38, 15, 3.2] } },
  { at: "წარმოსახვითი ხაზების ბადით", set: { lit: "grid", mark: null, place: null, view: [25, 25, 3.6] } },
  { at: "მიიტანე კურსორი", set: { lit: null } },
  // Parallels and latitude.
  { at: "პარალელები და განედი", block: 1, set: { view: [20, 30, 3.6], lit: "parallels", ...CLEAR } },
  { at: "ეკვატორი (0°)", set: { view: [5, 20, 3.4], lit: "equator" } },
  { at: "პოლუსებისკენ პარალელები", set: { view: [40, 20, 3.7], lit: "lengths", inset: "lengths" } },
  { at: "პოლუსი კი უბრალოდ წერტილია", set: { view: [84, 20, 3.0], mark: [89.99, 0], place: "ჩრდილოეთ პოლუსი" } },
  { at: "განედი არის ადგილის", set: { view: [-8, 30, 4.1], lit: "equator", ...CLEAR, dirs: "lat" } },
  { at: "41° ჩ. გ.", set: { view: [38, 44.8, 3.2], mark: [41, 44.8], place: "საქართველო", lit: null, dirs: null } },
  { at: "34° ს. გ.", set: { view: [-30, 18.4, 3.2], mark: [-34, 18.4], place: "კეიპტაუნი (სამხრეთ აფრიკა)" } },
  // Meridians and longitude.
  { at: "მერიდიანები და გრძედი", block: 2, set: { view: [20, 0, 3.6], lit: "meridians", ...CLEAR } },
  { at: "ყველა მერიდიანი ერთნაირი", set: { view: [32, -30, 3.8], inset: "meridians" } },
  { at: "საწყისად 1884 წლიდან", set: { view: [48, 0, 3.2], lit: "prime", mark: [51.48, 0], place: "გრინვიჩი (ლონდონი)", inset: null } },
  { at: "გრძედი არის ადგილის", set: { view: [12, 0, 3.7], ...CLEAR, dirs: "lon" } },
  { at: "44° აღმ. გრ.", set: { view: [36, 44, 3.3], mark: [41.7, 44], place: "საქართველო", lit: "prime", dirs: null } },
  { at: "74° დას. გრ.", set: { view: [36, -74, 3.3], mark: [40.7, -74], place: "ნიუ-იორკი" } },
  // The named parallels.
  { at: "განსაკუთრებული პარალელები", block: 3, set: { view: [22, 30, 3.8], lit: "special", ...CLEAR } },
  { at: "ჩრდილოეთისა და სამხრეთის ტროპიკები", set: { view: [0, 30, 3.7], lit: "tropics" } },
  { at: "პოლარული წრეები", set: { view: [58, 30, 3.6], lit: "polar" } },
  { at: "საქართველო დაახლოებით", set: { view: [42.2, 43.6, 1.42], lit: "georgia" } },
  { at: "ზომიერ სარტყელში", set: { view: [45, 44, 3.4], lit: "between" } },
  { at: "თბილისის კოორდინატებია", set: { view: [41.72, 44.79, 2.1], mark: TBILISI, place: "თბილისი", lit: null } },
  // What the grid is for.
  { at: "რისთვის გვჭირდება ბადე", block: 4, set: { view: [30, 20, 3.6], lit: "grid", ...CLEAR } },
  { at: "GPS ტელეფონში", set: { view: [41.72, 44.79, 2.6], mark: TBILISI, place: "თბილისი", lit: null } },
  { at: "ერთი გრადუსი განედი", set: { lit: "parallels", mark: null, place: null } },
];
