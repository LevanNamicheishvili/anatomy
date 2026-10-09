import * as THREE from "three";
import { ARMY_TOTALS, COMMANDERS, DIDGORI_PLACE, type CommanderId } from "./battle/identity";
import { orbit } from "@/components/journeys/common";
import { ease, v, type Builder, type Shot, type V3 } from "@/components/journeys/JourneyScene";
import { campaignMap } from "./battle/campaign";
import { CrowdLayer, crowdMaterial, type BoneSet } from "./battle/crowd";
import { buildForest } from "./battle/forest";
import { Arrows, banner, camp, groundArrow, Particles, waveBanners, type Banner, type BannerKind } from "./battle/fx";
import { BattleSim, type Cmd, type RegimentDef, type Setup, type StageScript, type XZ } from "./battle/sim";
import { loadTerrain, MAX_MARKS, skyDome } from "./battle/terrain";
import { cavalryBones, figureType, infantryBones, loadHorse, type FigureType, type Look } from "./battle/units";

/*
 * The Battle of Didgori, 12 August 1121, on the real ground (an 11 × 7 km window round the Didgori field).
 * About 5000 figures, one for every ≈ 20 men on the Georgian side (the coalition's numbers are disputed; it
 * is shown at ≈ 60 000): mail-clad Georgian lancers and Frankish knights, Kipchak horse archers, Turkmen
 * horse archers and lancers, Arab riders and footmen. The course of the fight follows the sources (the
 * feigned surrender of the 200, the frontal charge, the attacks on the flanks by King David and his son
 * Demetre, rout and pursuit); the exact places are a reconstruction.
 */

// ---- Who fought ------------------------------------------------------------------------------------------

const LOOKS: Record<string, { look: Look; role: FigureType["role"] }> = {
  gHeavy: { look: { mounted: true, armour: "mail", head: "nasal", shield: "kite", weapon: "lance", emblem: "cross", beard: "#2a1d14" }, role: "lancer" },
  frank: { look: { mounted: true, armour: "mail", head: "nasal", shield: "kite", weapon: "lance", emblem: "cross", emblemColor: "#a3171b", beard: "#5a4430" }, role: "lancer" },
  kipchak: { look: { mounted: true, armour: "kaftan", head: "furcap", shield: "round", weapon: "bow", emblem: "rings", trousers: "#4a3a2a", beard: "#2a1d14" }, role: "archer" },
  gSpear: { look: { mounted: false, armour: "gambeson", head: "nasal", shield: "kite", weapon: "spear", emblem: "cross", beard: "#2a1d14" }, role: "spear" },
  gBow: { look: { mounted: false, armour: "gambeson", head: "nasal", shield: "none", weapon: "bow", beard: "#3a2a1c" }, role: "bowman" },
  turkBow: { look: { mounted: true, armour: "kaftan", head: "spiked", shield: "round", weapon: "bow", emblem: "rings", trousers: "#3a3530", beard: "#1d1712" }, role: "archer" },
  turkLance: { look: { mounted: true, armour: "lamellar", head: "spiked", shield: "round", weapon: "lance", emblem: "boss", trousers: "#2f2a26", beard: "#1d1712" }, role: "lancer" },
  arab: { look: { mounted: true, armour: "kaftan", head: "turban", shield: "round", weapon: "lance", emblem: "rings", trousers: "#d8d0bc", beard: "#1d1712" }, role: "lancer" },
  cSpear: { look: { mounted: false, armour: "kaftan", head: "turban", shield: "round", weapon: "spear", emblem: "boss", beard: "#1d1712" }, role: "spear" },
};

interface Unit extends RegimentDef {
  banner?: BannerKind;
  /** Stages in which its name is shown. */
  label?: number[];
}

/** The Georgians on the memorial plateau face west-south-west down the ridge; the coalition faces them. */
const G = -1.12;
const C = 2.02;
const W = -Math.PI / 2;

const UNITS: Unit[] = [
  { id: "gHeavy", name: "ქართველი მძიმე ცხენოსნები", side: 0, type: "gHeavy", n: 600, files: 34, gap: [2.3, 4.2], loose: 0.5, colA: ["#8f1d21", "#7a1a20", "#a3262a"], colB: ["#5e1216", "#8a1c1c"], coats: [0, 1, 2, 3], banner: "georgia", label: [1, 3] },
  { id: "franks", name: "ფრანგი რაინდები", side: 0, type: "frank", n: 10, files: 10, gap: [2.6, 4.5], colA: ["#e6e0d0"], colB: ["#ebe5d8"], coats: [4, 3], banner: "frank", label: [1, 3] },
  { id: "david", name: "მეფე დავითის რაზმი", side: 0, type: "gHeavy", n: 300, files: 24, gap: [2.4, 4.3], loose: 1, colA: ["#6d1424", "#7a1a2a"], colB: ["#b08a3a", "#6d1424"], coats: [0, 1, 3], banner: "royal", label: [1, 4] },
  { id: "demetre", name: "დემეტრეს რაზმი", side: 0, type: "gHeavy", n: 300, files: 24, gap: [2.4, 4.3], loose: 1, colA: ["#a5321f", "#b8402e"], colB: ["#5a1a12"], coats: [0, 2, 1], banner: "georgia", label: [1, 4] },
  { id: "kipchak", name: "ყივჩაყები", side: 0, type: "kipchak", n: 700, files: 25, gap: [3, 4.6], loose: 2.5, colA: ["#9a4a24", "#8a5a2a", "#a0522d"], colB: ["#5a3a22", "#7a3a1e"], coats: [5, 0, 2], banner: "kipchak", label: [1, 5] },
  { id: "alans", name: "ალანები", side: 0, type: "gHeavy", n: 25, files: 13, gap: [2.5, 4.2], colA: ["#6b2a3a"], colB: ["#3a2a2a"], coats: [0, 3], banner: "georgia" },
  { id: "ruse", name: "200 მხედარი", side: 0, type: "kipchak", n: 10, files: 5, gap: [3, 4.5], colA: ["#9a4a24"], colB: ["#5a3a22"], coats: [5], label: [2] },
  { id: "gSpear", name: "ქართველი ქვეითები", side: 0, type: "gSpear", n: 200, files: 40, gap: [1.0, 1.3], loose: 0.2, colA: ["#8a2a24", "#9a3328"], colB: ["#7a1d1d"], banner: "georgia", label: [1, 4] },
  { id: "gBow", name: "მშვილდოსნები", side: 0, type: "gBow", n: 120, files: 30, gap: [1.2, 1.4], loose: 0.3, colA: ["#8a2a24"], colB: ["#7a1d1d"] },
  { id: "cVan", name: "მოწინავე რაზმი (მშვილდოსანი ცხენოსნები)", side: 1, type: "turkBow", n: 500, files: 28, gap: [3, 4.5], loose: 2, colA: ["#2c3f6e", "#26406a", "#33507a"], colB: ["#3b5f8a", "#6a7fa8"], coats: [0, 2, 4, 5], banner: "tugh", label: [1, 3] },
  { id: "cLeft", name: "კოალიციის მარცხენა ფრთა", side: 1, type: "turkBow", n: 450, files: 24, gap: [3, 4.6], loose: 2.5, colA: ["#24365e", "#2a4a6a"], colB: ["#6b7fa8", "#e2dccb"], coats: [0, 1, 4, 5], banner: "tugh", label: [1, 4] },
  { id: "cRight", name: "კოალიციის მარჯვენა ფრთა", side: 1, type: "turkLance", n: 450, files: 24, gap: [2.8, 4.4], loose: 2, colA: ["#1f3f5f", "#283c66"], colB: ["#4a6a9a"], coats: [0, 2, 3, 4], banner: "tugh", label: [1, 4] },
  { id: "cGuard", name: "მეთაურთა დაცვა", side: 1, type: "turkLance", n: 80, files: 16, gap: [2.6, 4.3], colA: ["#1b2a4a"], colB: ["#c9a54a"], coats: [3, 4], banner: "black" },
  { id: "cCmd", name: "ილღაზი და დუბაისი", side: 1, type: "turkLance", n: 6, files: 6, gap: [3, 4], colA: ["#1b2240"], colB: ["#c9a54a"], coats: [4], banner: "tugh", label: [2, 5] },
  { id: "cArab", name: "დუბაისის არაბები", side: 1, type: "arab", n: 250, files: 20, gap: [2.7, 4.4], loose: 1.5, colA: ["#2f4f86", "#d8d2c2"], colB: ["#1f3e6e"], coats: [4, 0], banner: "arab", label: [1] },
  { id: "cInf", name: "კოალიციის ქვეითები", side: 1, type: "cSpear", n: 300, files: 24, gap: [1.1, 1.4], loose: 0.6, colA: ["#34507a", "#4a5a7a"], colB: ["#8a8270"], banner: "tugh" },
  { id: "cRear", name: "ზურგის რაზმები", side: 1, type: "turkBow", n: 300, files: 20, gap: [3, 4.6], loose: 3, colA: ["#2a4060"], colB: ["#7a8aa8"], coats: [0, 1, 2, 5], banner: "tugh", label: [1] },
  { id: "cCamp1", name: "ბანაკი", side: 1, type: "cSpear", n: 300, files: 20, gap: [2.5, 2.5], loose: 6, colA: ["#4a5a7a", "#5a5a6a"], colB: ["#8a8270"], label: [1] },
  { id: "cCamp2", name: "ბანაკები მანგლისისკენ", side: 1, type: "turkBow", n: 250, files: 20, gap: [3.5, 4.5], loose: 6, colA: ["#3a4a6a"], colB: ["#8a8270"], coats: [0, 1, 2, 3, 5], label: [1] },
];

// ---- Where, and what happens ---------------------------------------------------------------------------------
//
// The terrain window is centred on today's Didgori memorial (identity.ts). The open ground there is a ridge
// corridor 150–250 m wide running west-south-west from the memorial plateau, with forest on both sides — the
// "narrow, forested mountains" of the sources, where the coalition could not deploy its whole strength. The
// positions below sit on that open ground (checked against slope and forest); they are a reconstruction.

/** The road of flight: back along the ridge, then over the open plateau south-west towards Manglisi. */
const ROUT: XZ[] = [
  [4650, 3120],
  [4100, 3200],
  [3520, 2900],
  [3270, 3140],
  [2890, 3610],
  [2620, 4210],
  [2080, 4770],
  [1720, 5190],
  [900, 6340],
];

const BASE: Record<string, Setup> = {
  gHeavy: { pos: [5170, 2815], face: G },
  franks: { pos: [5130, 2835], face: G },
  david: { pos: [4480, 2930], face: 0.33, hidden: true },
  demetre: { pos: [4320, 3430], face: Math.PI, hidden: true },
  kipchak: { pos: [5215, 3150], face: -1.6 },
  alans: { pos: [5400, 2740], face: G },
  ruse: { pos: [5040, 2880], face: G },
  gSpear: { pos: [5330, 2790], face: G },
  gBow: { pos: [5350, 2860], face: G },
  cVan: { pos: [4900, 2975], face: C },
  cLeft: { pos: [4520, 3140], face: C },
  cRight: { pos: [4320, 3250], face: C },
  cGuard: { pos: [4630, 3110], face: C },
  cCmd: { pos: [4650, 3140], face: C },
  cArab: { pos: [4060, 3185], face: C },
  cInf: { pos: [3880, 3110], face: C },
  cRear: { pos: [3600, 2960], face: C },
  cCamp1: { pos: [3390, 2650], face: C },
  cCamp2: { pos: [3060, 3420], face: C },
};

const PAVILION: XZ = [4615, 3178];

/** Open ground of the ridge corridor where the armies stand (x, z, radius). */
const CLEARINGS: [number, number, number][] = [
  [5200, 2830, 170],
  [4960, 2950, 110],
  [4780, 3040, 100],
  [4620, 3130, 100],
  [4470, 3170, 90],
  [4320, 3240, 90],
  [4100, 3200, 90],
  [3900, 3120, 90],
  [3650, 2980, 90],
];

function setup(over: Record<string, Partial<Setup>>): Record<string, Setup> {
  const out: Record<string, Setup> = {};
  for (const [id, s] of Object.entries(BASE)) out[id] = { ...s, ...(over[id] ?? {}) };
  return out;
}

const routAll = (list: [string, number][]): Record<string, Cmd[]> => Object.fromEntries(list.map(([id, at]) => [id, [{ at, do: "rout", path: ROUT }]]));

const SCRIPTS: Record<number, StageScript> = {
  1: {
    timeScale: 1,
    odds: [0, 0],
    setup: setup({ cRear: { pos: [3350, 2900] } }),
    cmds: { cRear: [{ at: 0, do: "move", path: [[3600, 2960]], gait: "walk", face: C }] },
  },
  2: {
    timeScale: 1.5,
    odds: [0.1, 0.03],
    setup: setup({}),
    cmds: {
      ruse: [
        { at: 0, do: "pose", clip: "humble" },
        { at: 0, do: "move", path: [[4960, 2925]], gait: "trot" },
        { at: 0.33, do: "place", pos: [4722, 3080], face: -0.84 },
        { at: 0.335, do: "move", path: [[4690, 3105]], gait: "walk" },
        { at: 0.43, do: "pose", clip: null },
        { at: 0.44, do: "shoot", target: "cGuard" },
        { at: 0.7, do: "move", path: [[4760, 3030], [4990, 2905], [5110, 2860]], gait: "gallop" },
      ],
      cGuard: [
        { at: 0.56, do: "panic" },
        { at: 0.88, do: "hold" },
      ],
      cCmd: [
        { at: 0.6, do: "panic" },
        { at: 0.9, do: "hold" },
      ],
      cVan: [
        { at: 0.72, do: "shoot", target: "ruse" },
        { at: 0.97, do: "hold" },
      ],
      gHeavy: [{ at: 0.2, do: "move", path: [[5075, 2860]], gait: "trot", face: G }],
      franks: [{ at: 0.2, do: "move", path: [[5037, 2878]], gait: "trot", face: G }],
    },
  },
  3: {
    timeScale: 2,
    odds: [0.12, 0.045],
    setup: setup({ gHeavy: { pos: [5075, 2860] }, franks: { pos: [5037, 2878] }, ruse: { pos: [5150, 2950] }, cGuard: { dead: 0.12, deadAt: [4630, 3110] } }),
    cmds: {
      cVan: [{ at: 0, do: "shoot", target: "gHeavy" }],
      gHeavy: [
        { at: 0.02, do: "move", path: [[5050, 2872]], gait: "walk" },
        { at: 0.14, do: "charge", target: "cVan", gait: "gallop" },
      ],
      franks: [
        { at: 0.02, do: "move", path: [[5012, 2890]], gait: "walk" },
        { at: 0.14, do: "charge", target: "cVan", gait: "gallop" },
      ],
      gSpear: [{ at: 0.3, do: "move", path: [[5200, 2850]], gait: "walk" }],
      gBow: [{ at: 0.3, do: "move", path: [[5230, 2890]], gait: "walk" }],
      kipchak: [{ at: 0.2, do: "move", path: [[5150, 3120]], gait: "trot", face: -1.6 }],
    },
  },
  4: {
    timeScale: 1.8,
    odds: [0.16, 0.04],
    setup: setup({
      gHeavy: { pos: [4945, 2952], dead: 0.05, deadAt: [4990, 2930] },
      franks: { pos: [4938, 2956] },
      cVan: { pos: [4895, 2978], dead: 0.22, deadAt: [4930, 2965] },
      cGuard: { dead: 0.12, deadAt: [4630, 3110] },
      ruse: { pos: [5100, 2950] },
      gSpear: { pos: [5200, 2850] },
      gBow: { pos: [5230, 2890] },
      kipchak: { pos: [5150, 3120] },
      alans: { pos: [5060, 2880] },
    }),
    cmds: {
      david: [
        { at: 0.02, do: "move", path: [[4500, 3010]], gait: "walk" },
        { at: 0.1, do: "charge", target: "cLeft", gait: "gallop" },
      ],
      demetre: [
        { at: 0.03, do: "move", path: [[4320, 3360]], gait: "walk" },
        { at: 0.11, do: "charge", target: "cRight", gait: "gallop" },
      ],
      alans: [{ at: 0.15, do: "charge", target: "cGuard", gait: "gallop" }],
      gSpear: [{ at: 0.05, do: "charge", target: "cVan", gait: "trot" }],
      gBow: [{ at: 0.05, do: "shoot", target: "cVan", advance: true }],
      kipchak: [{ at: 0.1, do: "shoot", target: "cVan", advance: true }],
      cArab: [{ at: 0.4, do: "charge", target: "david", gait: "gallop" }],
    },
  },
  5: {
    timeScale: 2,
    odds: [0.2, 0.02],
    setup: setup({
      gHeavy: { pos: [4840, 3005], dead: 0.08, deadAt: [4920, 2970] },
      franks: { pos: [4832, 3008] },
      cVan: { pos: [4800, 3020], dead: 0.45, deadAt: [4880, 2985] },
      david: { pos: [4540, 3110], hidden: false, dead: 0.06, deadAt: [4530, 3080] },
      cLeft: { pos: [4530, 3150], dead: 0.35, deadAt: [4530, 3140] },
      demetre: { pos: [4330, 3290], hidden: false, dead: 0.06, deadAt: [4330, 3300] },
      cRight: { pos: [4320, 3255], dead: 0.35, deadAt: [4320, 3250] },
      cGuard: { dead: 0.15, deadAt: [4630, 3110] },
      cArab: { pos: [4300, 3215], dead: 0.25, deadAt: [4400, 3190] },
      gSpear: { pos: [4950, 2955], dead: 0.05, deadAt: [4960, 2950] },
      gBow: { pos: [5060, 2900] },
      kipchak: { pos: [5000, 3040] },
      alans: { pos: [4600, 3090] },
      ruse: { pos: [5100, 2950] },
    }),
    cmds: {
      ...routAll([
        ["cCmd", 0.03],
        ["cGuard", 0.05],
        ["cVan", 0.14],
        ["cLeft", 0.2],
        ["cRight", 0.24],
        ["cArab", 0.28],
        ["cInf", 0.33],
        ["cRear", 0.4],
        ["cCamp1", 0.48],
        ["cCamp2", 0.55],
      ]),
      kipchak: [{ at: 0.15, do: "pursue", path: ROUT }],
      gHeavy: [{ at: 0.22, do: "pursue", path: ROUT }],
      franks: [{ at: 0.22, do: "pursue", path: ROUT }],
      david: [{ at: 0.28, do: "pursue", path: ROUT }],
      demetre: [{ at: 0.3, do: "pursue", path: ROUT }],
      alans: [{ at: 0.3, do: "pursue", path: ROUT }],
      ruse: [{ at: 0.2, do: "pursue", path: ROUT }],
      gSpear: [{ at: 0.3, do: "move", path: [[4880, 2990]], gait: "walk" }],
      gBow: [{ at: 0.3, do: "move", path: [[4960, 2950]], gait: "walk" }],
    },
  },
  6: {
    timeScale: 3,
    odds: [0.25, 0.01],
    setup: setup({
      cCmd: { pos: [1720, 5190], face: W, rout: ROUT },
      cGuard: { pos: [2080, 4770], face: W, rout: ROUT, dead: 0.2, deadAt: [4630, 3110] },
      cVan: { pos: [2890, 3610], face: W, rout: ROUT, dead: 0.6, deadAt: [4880, 2985] },
      cLeft: { pos: [3270, 3140], face: W, rout: ROUT, dead: 0.55, deadAt: [4530, 3140] },
      cRight: { pos: [2620, 4210], face: W, rout: ROUT, dead: 0.5, deadAt: [4320, 3250] },
      cArab: { pos: [2400, 4450], face: W, rout: ROUT, dead: 0.45, deadAt: [4380, 3200] },
      cInf: { pos: [3520, 2900], face: W, rout: ROUT, dead: 0.5, deadAt: [3950, 3130] },
      cRear: { pos: [2300, 4550], face: W, rout: ROUT, dead: 0.3, deadAt: [3620, 2960] },
      cCamp1: { pos: [3350, 2950], face: W, rout: ROUT, dead: 0.3, deadAt: [3390, 2650] },
      cCamp2: { pos: [2200, 4650], face: W, rout: ROUT, dead: 0.2, deadAt: [3060, 3420] },
      kipchak: { pos: [3420, 2950], face: W },
      gHeavy: { pos: [3700, 2980], face: W, dead: 0.1, deadAt: [4900, 2970] },
      franks: { pos: [3690, 2985], face: W },
      david: { pos: [3640, 3000], face: W, hidden: false, dead: 0.08, deadAt: [4520, 3100] },
      demetre: { pos: [3600, 3020], face: W, hidden: false, dead: 0.08, deadAt: [4320, 3270] },
      alans: { pos: [3560, 2990], face: W },
      ruse: { pos: [3380, 3000], face: W },
      gSpear: { pos: [4950, 2955], dead: 0.06, deadAt: [4960, 2950] },
      gBow: { pos: [5060, 2900] },
    }),
    cmds: Object.fromEntries(["kipchak", "gHeavy", "franks", "david", "demetre", "alans", "ruse"].map((id) => [id, [{ at: 0, do: "pursue", path: ROUT } as Cmd]])),
  },
};

// ---- Cameras ------------------------------------------------------------------------------------------------------

interface Cam {
  pos: V3;
  target: V3;
  fov?: number;
}

/** One shot of a stage. */
interface Beat {
  /** Ends at this point of the stage (0..1). */
  to: number;
  cam: (b: number, u: number) => Cam;
  /** Regiment names and footprints shown. */
  map?: boolean;
  /** Radius of sharp shadows round the target (m). */
  shadow?: number;
}

// ---- The scene ------------------------------------------------------------------------------------------------------

/** Morning sun from the east, a little south. */
const SUN = new THREE.Vector3(0.88, 0.42, 0.2).normalize();
const HAZE = "#b9cde0";

export interface BattleView {
  camera: "cinematic" | "tactical";
  commander?: CommanderId | null;
  portrait?: boolean;
}

export const createDidgori = (view: BattleView): Builder => async (k) => {
  const low = k.lowPower;
  const [terrain, horse, map] = await Promise.all([loadTerrain(k), loadHorse(), campaignMap(k)]);
  const { field, marks } = terrain;
  // The corridor's open ground is kept clear of the odd tree the forest map puts at its edges.
  const forest = await buildForest(k, field, low ? 3 : 9, CLEARINGS);
  const battle = new THREE.Group();
  k.root.add(battle);
  battle.add(terrain.group, forest.group);
  const sky = skyDome(k, SUN, HAZE);
  battle.add(sky);

  // Figure types, bones, and instanced layers per type and level of detail.
  const cavB = cavalryBones(k, horse);
  const footB = infantryBones(k);
  const types = new Map<string, FigureType>();
  Object.entries(LOOKS).forEach(([id, d], i) => types.set(id, figureType(id, d.look, d.role, d.look.mounted ? horse : null, i)));
  const units: Unit[] = UNITS.map((u) => (low ? { ...u, n: Math.max(4, Math.round(u.n / 4)), files: Math.max(3, Math.round(u.files / 2)) } : u));
  const sim = new BattleSim(field, units, types, cavB, footB);
  const mats = new Map<BoneSet, ReturnType<typeof crowdMaterial>[]>();
  for (const b of [cavB, footB]) mats.set(b, [crowdMaterial(k, b, low ? 2 : 4, !low, low), crowdMaterial(k, b, 2, false, low), crowdMaterial(k, b, 1, false, low)]);
  const layers = new Map<string, CrowdLayer[]>();
  for (const [id, t] of types) {
    const cap = units.filter((u) => u.type === id).reduce((s, u) => s + u.n, 0);
    if (!cap) continue;
    const ms = mats.get(t.mounted ? cavB : footB)!;
    layers.set(
      id,
      t.lods.map((g, lod) => {
        const l = new CrowdLayer(k, g, ms[lod], cap);
        l.mesh.castShadow = lod < 2;
        l.mesh.receiveShadow = lod === 0;
        battle.add(l.mesh);
        return l;
      }),
    );
  }

  // Four individual rigged figures, sharing the troop animation but retaining their own geometry.
  const heroes = new Map<CommanderId, number>();
  for (const commander of COMMANDERS) {
    const reg = sim.byId.get(commander.regiment)!;
    const index = reg.first + Math.min(commander.offset, reg.count - 1);
    heroes.set(commander.id, index);
    const source = commander.id === "ilghazi" ? LOOKS.turkLance : commander.id === "dubays" ? LOOKS.arab : LOOKS.gHeavy;
    const id = `hero-${commander.id}`;
    const type = figureType(id, { ...source.look, beard: commander.beard, commander }, "lancer", horse, commander.side);
    const material = crowdMaterial(k, cavB, 4, true);
    layers.set(id, type.lods.map((geometry) => {
      const layer = new CrowdLayer(k, geometry, material, 1);
      layer.mesh.castShadow = true;
      layer.mesh.receiveShadow = true;
      battle.add(layer.mesh);
      return layer;
    }));
    sim.featured.set(index, id);
    for (const [slot, color] of [[0, commander.color], [3, commander.trim]] as const) {
      const c = new THREE.Color(color);
      sim.colors.set([c.r, c.g, c.b], index * 12 + slot);
    }
  }

  // Banners carried by the first man of each regiment.
  const banners: { b: Banner; reg: number }[] = [];
  units.forEach((u, i) => {
    if (!u.banner) return;
    const b = banner(k, u.banner, types.get(u.type)!.mounted);
    battle.add(b.group);
    banners.push({ b, reg: i });
  });

  // The coalition's camps, the commanders' pavilion, camp fires.
  const spots: { x: number; z: number; kind: "yurt" | "tent" | "pavilion"; rot?: number }[] = [{ x: PAVILION[0], z: PAVILION[1], kind: "pavilion" }];
  const fires: XZ[] = [];
  {
    let s = 9;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (const [cx, cz, n] of [
      [3390, 2650, 18],
      [3060, 3420, 14],
      [3700, 3000, 5],
    ] as const) {
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 30 + rnd() * 120;
        spots.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r * 0.7, kind: rnd() < 0.6 ? "yurt" : "tent", rot: rnd() * 6 });
      }
      for (let i = 0; i < 3; i++) fires.push([cx + (rnd() - 0.5) * 120, cz + (rnd() - 0.5) * 80]);
    }
    for (let i = 0; i < 6; i++) spots.push({ x: PAVILION[0] - 40 + (i % 3) * 35, z: PAVILION[1] + 45 + Math.floor(i / 3) * 25, kind: "tent", rot: i });
  }
  const campOut = camp(k, field, spots);
  battle.add(campOut.group);
  const pavilion = campOut.pavilions[0];

  const arrows = new Arrows(k, low ? 400 : 1600);
  const dust = new Particles(k, low ? 1200 : 5000, "#b4a07c", 2.2, 0.32);
  const smoke = new Particles(k, low ? 200 : 600, "#9a9a98", 3.2, 0.45);
  battle.add(arrows.mesh, dust.points, smoke.points);

  // Manoeuvres drawn on the ground.
  const moves = [
    groundArrow(k, field, [[4480, 2930], [4500, 3030], [4520, 3125]], 34, "#c0392b"),
    groundArrow(k, field, [[4320, 3430], [4320, 3340], [4320, 3265]], 34, "#c0392b"),
    groundArrow(k, field, [[5200, 2850], [5060, 2905], [4935, 2960]], 28, "#d0563f"),
  ];
  const flight = groundArrow(k, field, [[4700, 3090], [4100, 3200], [3520, 2900], [3270, 3140], [2890, 3610]], 60, "#2f5fd0");
  for (const m of [...moves, flight]) {
    m.set(0, 0);
    battle.add(m.mesh);
  }

  // Totals stay attached to the two armies, independent of rendering density or simulated casualties.
  const armyAnchors = ([ARMY_TOTALS.georgia, ARMY_TOTALS.coalition] as const).map((army) => {
    const anchor = new THREE.Object3D();
    battle.add(anchor);
    const label = k.label(anchor, `${army.name} · ${army.count}\n${army.note}`, { kind: "tag", stages: [1, 2, 3, 4, 5, 6] });
    label.classList.add("battle-army-label");
    return anchor;
  });
  const heroAnchors = COMMANDERS.map((commander) => {
    const anchor = new THREE.Object3D();
    battle.add(anchor);
    k.label(anchor, commander.name, { kind: "tag", stages: [1, 2, 3, 4, 5, 6] });
    return { anchor, id: commander.id };
  });

  // Labels: regiments (they follow them) and places.
  const regAnchors = units.map((u) => {
    const a = new THREE.Object3D();
    battle.add(a);
    if (u.label) k.label(a, u.name, { kind: "tag", stages: u.label });
    return a;
  });
  let labelsOn = true;
  const placeLabels = new THREE.Group();
  battle.add(placeLabels);
  const place = (x: number, z: number, text: string, stages: number[]) => {
    const a = new THREE.Object3D();
    a.position.copy(field.p(x, z, 40));
    placeLabels.add(a);
    k.label(a, text, { stages });
  };
  const [memorialX, memorialZ] = field.xz(DIDGORI_PLACE.lon, DIDGORI_PLACE.lat);
  place(memorialX, memorialZ, "დიდგორის ველი · დღევანდელი მემორიალის მიდამოები", [1, 3, 4, 6]);
  place(1300, 5700, "მანგლისისკენ", [5, 6]);
  place(8800, 1600, "თბილისისკენ", [1]);
  const dayAnchor = new THREE.Object3D();
  battle.add(dayAnchor);
  const dayTag = k.label(dayAnchor, "", { kind: "tag", stages: [6] });

  // The campaign map lives beside the battlefield (the battle group is hidden on the map stages).
  k.root.add(map.group);
  map.group.visible = false;

  // ---- Stage control ----
  let lastStage = -1;
  let lastU = 0;
  let beatIdx = -1;
  let showMap = false;
  let shadowR = 200;
  const focus = new THREE.Vector3();
  const at = (id: string, lift = 0) => {
    const r = sim.byId.get(id)!;
    return field.p(r.mx, r.mz, lift);
  };
  const ground = (x: number, z: number, h: number) => field.p(x, z, h);
  /** Where the mass of the fleeing coalition is. */
  const fleeing = () => {
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (const r of sim.regs)
      if (r.def.side === 1 && r.alive > 0 && r.routed) {
        sx += r.mx * r.alive;
        sz += r.mz * r.alive;
        n += r.alive;
      }
    return n ? ground(sx / n, sz / n, 0) : ground(2890, 3610, 0);
  };
  const keepAbove = (p: V3) => {
    const y = field.y(p.x, p.z) + 2.2;
    if (p.y < y) p.y = y;
    return p;
  };

  const enterBattle = (stage: number) => {
    showMap = false;
    battle.visible = true;
    map.group.visible = false;
    k.mood(HAZE, 3500, 40000, true, HAZE);
    // 1 m keeps the depth buffer sharp over 40 km; the face close-ups lower it (see frame()).
    k.clip = [1, 40000];
    k.noAO = true;
    k.ground = (x, z) => field.y(x, z);
    k.sun = { dir: SUN, focus, radius: shadowR, color: "#ffe2bf", intensity: 3.4, ambient: 0.22, exposure: 1.15 };
    // Playing on from the previous stage continues the fight; a jump sets the stage up afresh.
    const natural = lastStage === stage - 1 && lastU > 0.97 && stage > 1;
    if (natural) sim.begin(SCRIPTS[stage], stage);
    else {
      sim.reset(SCRIPTS[stage], stage);
      arrows.clear();
      dust.clear();
    }
    beatIdx = -1;
    lastStage = stage;
    lastU = 0;
  };
  const enterMap = (stage: number) => {
    showMap = true;
    battle.visible = false;
    map.group.visible = true;
    k.mood("#c8d4da", 80, 300, true);
    k.clip = null;
    k.noAO = false;
    k.sun = null;
    k.ground = null;
    lastStage = stage;
    lastU = 0;
    beatIdx = -1;
  };

  /** Runs the battle one frame and returns the camera of the active shot. */
  const run = (stage: number, beats: Beat[], u: number, dt: number, extra?: (u: number) => void): Shot => {
    lastU = u;
    const script = SCRIPTS[stage];
    sim.step(dt, u);
    sim.animate(dt);
    for (const m of [...moves, flight]) m.set(0, 0);
    extra?.(u);
    arrows.update(dt * script.timeScale, sim, field, stage === 2 ? [0.02, 0.35] : stage >= 5 ? [0.01, 0.1] : [0.012, 0.05]);
    // Dust from galloping horses, smoke from the camp fires.
    const d = sim.dust;
    for (let i = 0; i + 2 < d.length && i < 240; i += 3) {
      const y = field.y(d[i], d[i + 1]);
      dust.emit(d[i], y + 0.5, d[i + 1], (Math.random() - 0.5) * 2, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 2, 1.2 + Math.random(), 2.5 + Math.random() * 1.5);
    }
    d.length = 0;
    if (stage <= 4 && Math.random() < dt * fires.length * 3) {
      const [fx, fz] = fires[Math.floor(Math.random() * fires.length)];
      smoke.emit(fx, field.y(fx, fz) + 1.5, fz, 0.6, 1.4 + Math.random() * 0.6, 0.2, 2.5, 9);
    }
    dust.update(dt);
    smoke.update(dt);
    // The commanders' pavilion comes down when the 200 shoot (and stays down).
    const fall = stage === 2 ? ease((u - 0.62) / 0.08) : stage > 2 ? 1 : 0;
    pavilion.rotation.set(fall * 0.5, 0, fall * 0.12);
    pavilion.scale.y = 1 - fall * 0.65;
    // The shot for this moment.
    let b = beats.findIndex((x) => u <= x.to);
    if (b < 0) b = beats.length - 1;
    const from = b > 0 ? beats[b - 1].to : 0;
    const beat = beats[b];
    const tactical = view.camera === "tactical";
    let cam = tactical
      ? { pos: ground(4750, 4500, 1900), target: ground(4250, 3050, 0), fov: 48 }
      : beat.cam((u - from) / Math.max(1e-3, beat.to - from), u);
    if (view.commander) {
      const index = heroes.get(view.commander)!;
      const h = sim.head[index];
      const p = ground(sim.x[index], sim.z[index], 0);
      const distance = view.portrait ? 1.0 : 5.0;
      const angle = h + 0.35;
      const target = p.clone().add(v(0, view.portrait ? 2.30 : 1.8, view.portrait ? 0 : 0));
      // The rider sits slightly behind the horse's origin.
      if (view.portrait) target.add(v(-Math.sin(h) * 0.11, 0, -Math.cos(h) * 0.11));
      cam = { pos: target.clone().add(v(Math.sin(angle) * distance, view.portrait ? 0.06 : 0.6, Math.cos(angle) * distance)), target, fov: view.portrait ? 30 : 38 };
    }
    const cut = b !== beatIdx;
    beatIdx = b;
    labelsOn = !view.commander && (tactical || !!beat.map);
    marks.overlay.value += ((tactical || beat.map ? 1 : 0) - marks.overlay.value) * (cut ? 1 : Math.min(1, dt * 3));
    shadowR = view.commander ? 12 : tactical ? 700 : beat.shadow ?? 220;
    focus.copy(cam.target);
    if (k.sun) k.sun.radius = shadowR;
    return { pos: keepAbove(cam.pos), target: cam.target, fov: cam.fov ?? 35, cut };
  };

  // ---- Every frame (also while paused, so the crowd follows a camera the user moves) ----
  const markColor = [new THREE.Color("#e0392b"), new THREE.Color("#2f62d6")];
  const frame = (camera: THREE.PerspectiveCamera) => {
    if (showMap) return;
    const near = view.commander ? 0.05 : 1;
    if (camera.near !== near) {
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    sky.position.copy(camera.position);
    forest.update(camera, focus, shadowR);
    sim.draw(camera, layers, low ? [35, 170] : [110, 620]);
    waveBanners(performance.now() / 1000);
    armyAnchors.forEach((anchor, side) => {
      let x = 0, z = 0, weight = 0;
      for (const reg of sim.regs) if (reg.def.side === side && reg.alive > 0) {
        x += reg.mx * reg.alive; z += reg.mz * reg.alive; weight += reg.alive;
      }
      // Only in the overview shots (in close-ups the totals panel beside the scene says it).
      anchor.visible = labelsOn && !view.commander && weight > 0;
      if (weight) anchor.position.copy(ground(x / weight, z / weight, 90));
    });
    for (const { anchor, id } of heroAnchors) {
      const index = heroes.get(id)!;
      anchor.visible = labelsOn && sim.isAlive(index);
      anchor.position.copy(ground(sim.x[index], sim.z[index], 6));
    }
    // Banners with their bearers.
    for (const { b, reg } of banners) {
      const r = sim.regs[reg];
      let bearer = -1;
      for (let i = r.first; i < r.first + r.count; i++)
        if (sim.isAlive(i) && sim.state[i] !== 2) {
          bearer = i;
          break;
        }
      b.group.visible = bearer >= 0 && !r.routed;
      if (bearer < 0) continue;
      const hd = sim.head[bearer];
      const x = sim.x[bearer] - Math.cos(hd) * 0.45;
      const z = sim.z[bearer] + Math.sin(hd) * 0.45;
      b.group.position.set(x, field.y(x, z) + (b.mounted ? 1.15 : 0.25), z);
      b.group.rotation.y = hd + Math.PI;
    }
    // Regiment names and footprints on the ground.
    let m = 0;
    units.forEach((u, i) => {
      const r = sim.regs[i];
      const a = regAnchors[i];
      a.visible = labelsOn && r.alive > 0 && !r.routed;
      a.position.set(r.mx, field.y(r.mx, r.mz) + 26, r.mz);
      if (m < MAX_MARKS && r.alive > 2 && !r.routed && u.n >= 20) {
        marks.pos.value[m].set(r.mx, r.mz, r.ext[0], r.ext[1]);
        marks.rot.value[m].set(Math.cos(r.face), Math.sin(r.face));
        const c = markColor[u.side];
        marks.col.value[m].set(c.r, c.g, c.b, r.hidden ? 0.45 : 0.85);
        m++;
      }
    });
    marks.n.value = m;
    placeLabels.visible = labelsOn;
    for (const g of [...moves, flight]) g.fade(marks.overlay.value);
  };

  return {
    frame,
    stages: [
      {
        duration: 24,
        cut: true,
        enter: () => enterMap(0),
        update: (u, s, t) => {
          map.routes.forEach((b) => b.update(t));
          map.flag.visible = false;
          const zoom = ease((u - 0.2) / 0.72);
          const target = v(0, 0, 0).lerp(map.battleAt, zoom);
          const distance = 80 * Math.pow(5 / 80, zoom);
          map.ring.scale.setScalar(1 + 0.18 * Math.sin(s * 3));
          return { pos: target.clone().add(v(0, distance * 0.9, distance * 0.45)), target, fov: 42 };
        },
      },
      {
        duration: 24,
        cut: true,
        enter: () => enterBattle(1),
        update: (u, _s, _t, dt) =>
          run(
            1,
            [
              { to: 0.4, map: true, shadow: 450, cam: (b) => ({ pos: ground(2500 + 1400 * b, 3800 - 450 * b, 480 - 160 * b), target: ground(4850, 3000, 0), fov: 38 }) },
              {
                to: 0.72,
                shadow: 110,
                cam: (b) => {
                  const c = at("gHeavy");
                  return { pos: c.clone().add(v(-70 + 25 * b, 7, -95 + 40 * b)), target: c.clone().add(v(10, 2.5, 0)), fov: 30 };
                },
              },
              { to: 1, map: true, shadow: 450, cam: (b) => ({ pos: ground(5750 - 150 * b, 4250 - 150 * b, 900), target: ground(4500, 3050, 0), fov: 36 }) },
            ],
            u,
            dt,
          ),
      },
      {
        duration: 26,
        enter: () => enterBattle(2),
        update: (u, _s, _t, dt) =>
          run(
            2,
            [
              {
                to: 0.33,
                shadow: 100,
                cam: () => {
                  const c = at("ruse");
                  return { pos: c.clone().add(v(42, 6, 22)), target: c.clone().add(v(-90, 1, -10)), fov: 32 };
                },
              },
              {
                to: 0.7,
                shadow: 110,
                cam: (b) => {
                  const p = ground(PAVILION[0], PAVILION[1], 0);
                  return { pos: p.clone().add(v(-42 + 12 * b, 8, -58 + 8 * b)), target: p.clone().lerp(at("ruse"), 0.6).add(v(0, 3, 0)), fov: 36 };
                },
              },
              { to: 1, shadow: 260, map: true, cam: (b) => ({ pos: ground(5060 + 40 * b, 3420, 190), target: ground(4760, 3050, 0), fov: 36 }) },
            ],
            u,
            dt,
          ),
      },
      {
        duration: 28,
        enter: () => enterBattle(3),
        update: (u, _s, _t, dt) => {
          const clash = () => at("gHeavy").lerp(at("cVan"), 0.5);
          return run(
            3,
            [
              {
                to: 0.16,
                shadow: 120,
                cam: () => {
                  // Behind the Georgian lancers, looking down the ridge at the vanguard.
                  const c = at("gHeavy");
                  return { pos: c.clone().add(v(43, 5, -21)), target: at("cVan", 3), fov: 30 };
                },
              },
              {
                to: 0.38,
                shadow: 110,
                cam: () => {
                  // Beside the charge (on its right, the north edge of the plateau).
                  const c = at("gHeavy");
                  return { pos: c.clone().add(v(-46, 3.5, -61)), target: c.clone().add(v(-45, 2, -1)), fov: 30 };
                },
              },
              {
                to: 0.8,
                shadow: 90,
                cam: (b) => {
                  // At the clash, low, from the north side of the corridor.
                  const p = clash();
                  return { pos: p.clone().add(v(-26 + 8 * b, 2.6, -54 + 6 * b)), target: p.clone().add(v(-6, 1.8, -13)), fov: 32 };
                },
              },
              {
                to: 1,
                shadow: 260,
                cam: (b) => {
                  const p = clash();
                  return { pos: p.clone().add(v(130, 60 + 50 * b, -170)), target: p, fov: 36 };
                },
              },
            ],
            u,
            dt,
          );
        },
      },
      {
        duration: 28,
        enter: () => enterBattle(4),
        update: (u, _s, _t, dt) =>
          run(
            4,
            [
              { to: 0.3, map: true, shadow: 450, cam: (b) => ({ pos: ground(5350 - 60 * b, 3850, 780), target: ground(4550, 3100, 0), fov: 36 }) },
              {
                to: 0.6,
                shadow: 120,
                cam: () => {
                  // From the open ridge, looking north at the forest edge David's riders burst out of.
                  const c = at("cLeft");
                  return { pos: c.clone().add(v(38, 5, 28)), target: at("david", 3), fov: 34 };
                },
              },
              {
                to: 0.84,
                shadow: 100,
                cam: (b) => {
                  const p = at("cLeft");
                  return { pos: p.clone().add(v(62 - 10 * b, 3, 52)), target: p.clone().add(v(-5, 2, -22)), fov: 32 };
                },
              },
              { to: 1, map: true, shadow: 450, cam: (b) => ({ pos: ground(5000 - 40 * b, 3750, 450), target: ground(4450, 3150, 0), fov: 36 }) },
            ],
            u,
            dt,
            (uu) => moves.forEach((m, i) => m.set(ease((uu - 0.04 - i * 0.04) / 0.22), uu < 0.3 ? 0.75 : Math.max(0, 0.75 - (uu - 0.3) * 4))),
          ),
      },
      {
        duration: 24,
        enter: () => enterBattle(5),
        update: (u, _s, _t, dt) =>
          run(
            5,
            [
              {
                to: 0.3,
                shadow: 120,
                cam: () => {
                  const c = at("cCmd");
                  return { pos: c.clone().add(v(32, 7, -22)), target: c.clone().add(v(-40, 1.5, 18)), fov: 32 };
                },
              },
              { to: 0.65, map: true, shadow: 450, cam: (b) => ({ pos: ground(4900 - 100 * b, 3950, 650), target: ground(3950, 3150, 0), fov: 38 }) },
              {
                to: 1,
                shadow: 130,
                cam: () => {
                  // Ahead of the fleeing vanguard on its road, looking back at the riders coming.
                  const c = at("cVan");
                  return { pos: c.clone().add(v(-62, 7, 40)), target: c.clone().add(v(15, 2, -8)), fov: 34 };
                },
              },
            ],
            u,
            dt,
            (uu) => flight.set(ease((uu - 0.3) / 0.3), uu > 0.3 && uu < 0.68 ? 0.7 : 0),
          ),
      },
      {
        duration: 22,
        enter: () => enterBattle(6),
        update: (u, _s, _t, dt) => {
          // Follow the mass of the fleeing.
          const c = fleeing();
          dayAnchor.position.copy(c).add(v(0, 60, 0));
          (dayTag.querySelector(".blood-label-text") ?? dayTag).textContent = `დევნა: დღე ${Math.min(3, 1 + Math.floor(u * 3))}`;
          return run(
            6,
            [
              { to: 0.62, shadow: 300, map: true, cam: () => ({ pos: c.clone().add(v(240, 150, 170)), target: c, fov: 36 }) },
              { to: 1, shadow: 120, cam: (b) => ({ pos: ground(4995 - 20 * b, 2905, 7), target: ground(4890, 2975, 1.5), fov: 34 }) },
            ],
            u,
            dt,
            (uu) => flight.set(1, uu < 0.62 ? 0.5 : 0),
          );
        },
      },
      {
        duration: 16,
        cut: true,
        enter: () => enterMap(7),
        update: (_u, s, t) => {
          map.routes.forEach((b) => b.update(t, 0));
          map.flag.visible = true;
          map.cloth.rotation.y = Math.sin(t * 2) * 0.3;
          return orbit(map.at(44.65, 41.72, 0), 16, s, { start: 0.15, speed: 0.01, height: 0.7 });
        },
      },
    ],
  };
};

export const didgori = createDidgori({ camera: "cinematic" });
