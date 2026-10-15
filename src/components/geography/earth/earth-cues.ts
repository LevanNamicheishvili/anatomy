import type { Cue } from "@/lib/narration-cues";
import type { CutBand, CutFx, CutView } from "./CutawayScene";
import type { LayerId } from "./layers";

/*
 * What the cut-open Earth shows while the narration reads the lesson (geography-lessons.ts, "earth-structure"):
 * how wide the cut is, where the camera looks, which layers light up, where the depth probe stands (a pair glides
 * from the first depth to the second), and what else is drawn — earthquake waves, mantle convection, the flowing
 * outer core, magma, the plates, the magnetic field, a compass.
 */

export interface EarthShot {
  opening: number;
  view: CutView;
  lit: LayerId[];
  /** Probe depth (km), or [from, to] to glide down while the voice speaks. */
  depth: number | [number, number];
  /** Where the probe stands on the cut face (degrees above the equator); null hides it. */
  probeAt: number | null;
  band: CutBand | null;
  fx: CutFx[];
}

const MANTLE: LayerId[] = ["upper-mantle", "lower-mantle"];
const CORE: LayerId[] = ["outer-core", "inner-core"];
/** The probe beside the close-up of the crust. */
const NEAR = 30;
const FAR = -28;

export const EARTH_CUES: Cue<EarthShot>[] = [
  // Introduction: the way to the centre, the deepest borehole, the earthquake waves that show the inside.
  { at: "დედამიწის ცენტრამდე", block: 0, set: { opening: 90, view: "face", lit: [], depth: 0, probeAt: FAR, band: null, fx: [] } },
  { at: "6371 კილომეტრია", set: { depth: [0, 6371] } },
  { at: "ადამიანმა კი სულ 12", set: { view: "crust", lit: ["crust"], depth: [0, 12], probeAt: NEAR } },
  { at: "მაინც ვიცით", set: { view: "face", lit: [], probeAt: null, fx: ["waves"] } },
  { at: "გახსენი პლანეტა", set: { view: "whole", opening: 180, fx: [] } },
  { at: "ჩადი ცენტრამდე", set: { depth: [0, 6371] } },
  // Three shells, like an egg.
  { at: "სამი ძირითადი გარსი", block: 1, set: { opening: 90, view: "face", lit: [], depth: 0, probeAt: null, fx: [] } },
  { at: "თხელი ნაჭუჭი", set: { lit: ["crust"] } },
  { at: "სქელი ცილა", set: { lit: MANTLE } },
  { at: "და გული ბირთვი", set: { lit: CORE } },
  { at: "სიღრმესთან ერთად", set: { lit: [], depth: [0, 6371], probeAt: FAR } },
  { at: "მძიმე ლითონები", set: { lit: CORE, probeAt: null } },
  { at: "მსუბუქი ქანები", set: { lit: ["crust"] } },
  // The crust.
  { at: "დედამიწის ქერქი", block: 2, set: { opening: 90, view: "crust", lit: ["crust"], depth: 35, probeAt: NEAR, band: null, fx: [] } },
  { at: "ოკეანეების ქვეშ", set: { depth: 7 } },
  { at: "კონტინენტებზე საშუალოდ", set: { depth: 38 } },
  { at: "მაღალი მთების ქვეშ", set: { depth: 70 } },
  { at: "თუ დედამიწას ვაშლად", set: { view: "whole", probeAt: null } },
  { at: "ქერქი და ზედა მანტიის", set: { view: "crust", lit: [], band: "lithosphere", depth: 100, probeAt: NEAR } },
  { at: "ლითოსფერო დიდ ფილებადაა", set: { opening: 0, view: "whole", band: null, fx: ["plates"] } },
  // The mantle: convection moves the plates; the asthenosphere and magma.
  { at: "მანტია", block: 3, set: { opening: 90, view: "mantle", lit: MANTLE, depth: 35, probeAt: FAR, band: null, fx: [] } },
  { at: "2900 კმ-მდე ვრცელდება", set: { depth: [35, 2900] } },
  { at: "დედამიწის მოცულობის", set: { opening: 180, view: "whole", probeAt: null } },
  { at: "ის მყარია", set: { opening: 90, view: "mantle", lit: [], fx: ["convection"] } },
  { at: "ეს მოძრაობა ამოძრავებს", set: { view: "face", band: "lithosphere" } },
  { at: "ზედა მანტიაში", set: { view: "crust", band: "asthenosphere", depth: 175, probeAt: NEAR, fx: [] } },
  { at: "აქ წარმოიქმნება ვულკანების", set: { fx: ["magma"] } },
  // The core: liquid outer core and the magnetic field, the solid inner core.
  { at: "ბირთვი", block: 4, set: { opening: 90, view: "core", lit: ["outer-core"], depth: [2900, 4000], probeAt: FAR, band: null, fx: ["core"] } },
  { at: "მისი მოძრაობა ქმნის", set: { view: "field", probeAt: null, fx: ["core", "field"] } },
  { at: "ამიტომ მუშაობს კომპასი", set: { view: "compass", fx: ["field", "compass"] } },
  { at: "შიდა ბირთვი", set: { view: "inner", lit: ["inner-core"], depth: [5150, 5800], probeAt: FAR, fx: [] } },
  { at: "ისეთივე ცხელია", set: { depth: 6371 } },
];
