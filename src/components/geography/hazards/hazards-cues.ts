import type { Cue } from "@/lib/narration-cues";
import type { HazardKind } from "./hazards-data";
import type { ForceEmph } from "./SlopeForces";

/*
 * What the hazards lesson shows while the narration reads it (geography-lessons.ts, "hazards"): on the relief map,
 * which kinds of danger zone are drawn, which places light up and where the camera flies; over the map, either the
 * forces on a slope (a diagram) or the 3D slope model, tilted, soaked or snowed on as the voice says, and set off
 * whenever `go` changes.
 */

export interface HazardShot {
  kinds: HazardKind[];
  lit: string[];
  /** Zone to fly to (null: all Georgia). */
  focus: string | null;
  panel: "forces" | "slope" | null;
  slope: HazardKind;
  angle: number;
  water: number;
  snow: number;
  forest: boolean;
  push: boolean;
  emph: ForceEmph;
  go: number;
}

const ALL: HazardKind[] = ["landslide", "mudflow", "avalanche"];
const MAP = { panel: null, push: false, emph: null } as const;

export const HAZARD_CUES: Cue<HazardShot>[] = [
  // Introduction.
  { at: "საქართველოს ტერიტორიის დიდი ნაწილი", block: 0, set: { kinds: ALL, lit: [], focus: null, ...MAP, slope: "landslide", angle: 28, water: 0.3, snow: 0, forest: false, go: 0 } },
  { at: "შოვი", block: 0, set: { lit: ["shovi", "devdoraki", "vere", "svaneti"] } },
  { at: "სამივეს ერთი", set: { panel: "forces", angle: 32, water: 0, snow: 0, forest: true, emph: "pull" } },
  { at: "ნახე საშიში ადგილები", set: { ...MAP, lit: [] } },
  { at: "გამოსცადე ფერდობი", set: { panel: "slope", slope: "landslide", angle: 28, water: 0.3, snow: 0, forest: false } },
  { at: "დახარე", set: { angle: 40 } },
  { at: "დაასველე", set: { water: 0.9 } },
  { at: "დაათოვლე", set: { slope: "avalanche", angle: 38, water: 0, snow: 80 } },
  // What holds a slope.
  { at: "რა აკავებს ფერდობს", block: 1, set: { go: 0, kinds: ALL, lit: [], focus: null, panel: "forces", angle: 25, water: 0, snow: 0, forest: true, push: false, emph: null } },
  { at: "სიმძიმე ქვემოთ ექაჩება", set: { emph: "pull" } },
  { at: "მას ხახუნი", set: { emph: "hold" } },
  { at: "რაც ციცაბოა ფერდობი", set: { angle: 42, emph: "pull" } },
  { at: "მასა მოძრაობას იწყებს", set: { forest: false, emph: null } },
  { at: "წყალი ამძიმებს და ასრიალებს", set: { angle: 30, water: 0.9 } },
  { at: "ახალი თოვლი ამძიმებს", set: { angle: 34, water: 0, snow: 90 } },
  { at: "მიწისძვრა ან ადამიანის საქმიანობა", set: { angle: 30, snow: 0, push: true } },
  // Landslides.
  { at: "მეწყერი მეწყერი არის", block: 2, set: { go: 0, kinds: ["landslide"], lit: [], focus: null, panel: "slope", slope: "landslide", angle: 32, water: 0.2, snow: 0, forest: false, push: false, emph: null } },
  { at: "თიხის ფენაზე სრიალებს", set: { water: 0.9 } },
  { at: "მეწყერი შეიძლება", block: 2, set: { go: 1 } },
  { at: "საქართველოში ყველაზე მეწყერსაშიშია", set: { panel: null, lit: ["adjara", "guria", "racha"] } },
  { at: "მთიანი აჭარა", set: { lit: ["adjara"], focus: "adjara" } },
  { at: "გურია", block: 2, set: { lit: ["guria"], focus: "guria" } },
  { at: "რაჭა-ლეჩხუმი", block: 2, set: { lit: ["racha"], focus: "racha" } },
  { at: "აქ ბევრი ნალექი", set: { lit: ["adjara", "guria", "racha"], focus: null } },
  // Mudflows.
  { at: "ღვარცოფი ღვარცოფი", block: 3, set: { go: 0, kinds: ["mudflow"], lit: [], focus: null, panel: "slope", slope: "mudflow", angle: 24, water: 0.3, snow: 0, forest: false, push: false, emph: null } },
  { at: "ძლიერი თავსხმის", set: { water: 0.95 } },
  { at: "ის ბეტონივით", set: { go: 2 } },
  { at: "საქართველოში ღვარცოფსაშიშია", set: { panel: null, lit: ["devdoraki", "duruji", "shovi", "vere"] } },
  { at: "დევდორაკი", block: 3, set: { lit: ["devdoraki"], focus: "devdoraki" } },
  { at: "დურუჯი", block: 3, set: { lit: ["duruji"], focus: "duruji" } },
  { at: "შოვი", block: 3, set: { lit: ["shovi"], focus: "shovi" } },
  { at: "თბილისში ვერე", set: { lit: ["vere"], focus: "vere" } },
  // Avalanches.
  { at: "ზვავი ზვავი", block: 4, set: { go: 0, kinds: ["avalanche"], lit: [], focus: null, panel: "slope", slope: "avalanche", angle: 25, water: 0, snow: 20, forest: false, push: false, emph: null } },
  { at: "ყველაზე საშიშია 30°–45°", set: { angle: 40 } },
  { at: "ძლიერი თოვის", set: { snow: 110 } },
  { at: "ზვავი 100–300", set: { go: 3 } },
  { at: "ჩვენთან ზვავსაშიშია", set: { panel: null, lit: ["svaneti"], focus: "svaneti" } },
  { at: "ხევი", block: 4, set: { lit: ["gudauri"], focus: "gudauri" } },
  { at: "თუშეთი", block: 4, set: { lit: ["tusheti"], focus: "tusheti" } },
  { at: "1987 წლის ზამთარში", set: { lit: ["svaneti"], focus: "svaneti" } },
  // Protection.
  { at: "როგორ ვიცავთ თავს", block: 5, set: { go: 0, kinds: ALL, lit: [], focus: null, panel: "forces", angle: 30, water: 0.5, snow: 0, forest: false, push: false, emph: "hold" } },
  { at: "ფესვები გრუნტს ამაგრებს", set: { panel: "slope", slope: "landslide", angle: 28, water: 0.5, forest: true, go: 4 } },
  { at: "ხეები თოვლს აკავებს", set: { slope: "avalanche", angle: 38, water: 0, snow: 60, forest: true, go: 5 } },
  { at: "ასევე აშენებენ", set: { panel: null, kinds: ALL, lit: [], focus: null } },
  { at: "ღვარცოფდამჭერ ჯებირებს", set: { kinds: ["mudflow"], lit: ["duruji"], focus: "duruji" } },
  { at: "ზვავსაწინააღმდეგო ფარებსა და გალერეებს", set: { kinds: ["avalanche"], lit: ["gudauri"], focus: "gudauri" } },
  { at: "არ ავაშენოთ სახლები", set: { kinds: ALL, lit: [], focus: null } },
  { at: "თავსხმისას", set: { kinds: ["mudflow"], lit: ["devdoraki", "duruji", "shovi", "vere"] } },
  { at: "ზამთარში ციცაბო თოვლიან", set: { kinds: ["avalanche"], lit: ["svaneti", "gudauri", "tusheti"] } },
];
