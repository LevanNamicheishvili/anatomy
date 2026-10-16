import type { Cue } from "@/lib/narration-cues";
import type { CourseZone, FallStage } from "./LandformDiagrams";
import type { LandformKind } from "./landforms-data";

/*
 * What the river landforms lesson shows while the narration reads it (geography-lessons.ts,
 * "georgia-landforms"): which kinds of place are pinned on the relief map of Georgia, which light up and where the
 * camera flies (a place, an area [lon, lat, span], or all Georgia), and a diagram over the map for how the land is
 * made: a river's course, a valley cut as the mountains rise, a limestone canyon, a waterfall, a delta.
 */

export type LandformPanel = "course" | "uplift" | "canyon" | "waterfall" | "delta";

export interface LandformShot {
  kinds: LandformKind[];
  lit: string[];
  focus: string | [number, number, number] | null;
  panel: LandformPanel | null;
  zone: CourseZone;
  stage: FallStage;
}

const ALL: LandformKind[] = ["gorge", "waterfall", "delta"];

export const LANDFORM_CUES: Cue<LandformShot>[] = [
  // Introduction.
  { at: "მდინარე არა მარტო მიედინება", block: 0, set: { kinds: ALL, lit: [], focus: null, panel: null, zone: null, stage: "layers" } },
  { at: "მთებში კალაპოტს ჭრის", set: { kinds: ["gorge"], lit: ["dariali"], focus: "dariali" } },
  { at: "საფეხურებზე ჩანჩქერად ეშვება", set: { kinds: ["waterfall"], lit: ["kinchkha"], focus: "kinchkha" } },
  { at: "ზღვასთან კი", set: { kinds: ["delta"], lit: ["rioni"], focus: "rioni" } },
  { at: "ახალ ხმელეთს", set: { panel: "delta" } },
  { at: "ნახე ეს ადგილები", set: { panel: null, kinds: ALL, lit: [], focus: null } },
  // Erosion, transport, deposition.
  { at: "მდინარის სამი საქმე", block: 1, set: { kinds: ALL, lit: [], focus: null, panel: "course", zone: null } },
  { at: "ზემო წელში", set: { zone: "upper" } },
  { at: "შუა წელში", set: { zone: "middle" } },
  { at: "ქვემო წელში", set: { zone: "lower" } },
  { at: "ამიტომ მთებში ვხედავთ", set: { panel: null, kinds: ["gorge", "waterfall"], lit: ["dariali", "kinchkha"], focus: null } },
  { at: "დაბლობზე კი", set: { kinds: ["delta"], lit: ["rioni", "chorokhi"], focus: [41.9, 42.0, 1.1] } },
  // Gorges and canyons.
  { at: "ხეობა და კანიონი", block: 2, set: { kinds: ["gorge"], lit: [], focus: null, panel: null } },
  { at: "კავკასიონი დღესაც მაღლდება", set: { panel: "uplift" } },
  { at: "ასე წარმოიქმნა დარიალის", set: { panel: null, lit: ["dariali"], focus: "dariali" } },
  { at: "კირქვიან ადგილებში", set: { panel: "canyon" } },
  { at: "მარტვილისა", block: 2, set: { panel: null, lit: ["martvili"], focus: "martvili" } },
  { at: "ოკაცეს კანიონები", set: { lit: ["okatse"], focus: "okatse" } },
  // Waterfalls.
  { at: "ჩანჩქერი ჩანჩქერი", block: 3, set: { kinds: ["waterfall"], lit: [], focus: null, panel: "waterfall", stage: "layers" } },
  { at: "ან შენაკადის ხეობა", set: { panel: null, lit: ["kinchkha"], focus: "kinchkha" } },
  { at: "ძირში წყალი ქვაბულს", set: { panel: "waterfall", stage: "pool" } },
  { at: "კარნიზი ინგრევა", set: { stage: "retreat" } },
  // Deltas.
  { at: "დელტა დელტა", block: 4, set: { kinds: ["delta"], lit: [], focus: null, panel: "delta" } },
  { at: "საქართველოში ასეთია ჭოროხის", set: { panel: null, lit: ["chorokhi"], focus: "chorokhi" } },
  { at: "რიონის შესართავი ფოთთან", set: { lit: ["rioni"], focus: "rioni" } },
  { at: "კოლხეთის დაბლობის", set: { focus: [42.0, 42.15, 1.3] } },
];
