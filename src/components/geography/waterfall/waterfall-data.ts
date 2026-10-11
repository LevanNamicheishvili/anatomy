/*
 * Topic 11 — three Georgian waterfalls as close-up 3D models. Not survey-exact: each preset only tries to
 * catch what makes the place recognisable (rock, shape of the drop, how much water, vegetation).
 */

export type WaterfallId = "gveleti" | "kinchkha" | "makhuntseti";

export interface WaterfallTier {
  /** Height of the drop, scene units (≈ 2–3 m each). */
  drop: number;
  /** Width of the falling water. */
  width: number;
  /** How far the hard cap rock overhangs the undercut face. */
  lip: number;
  /** Distance from this fall's face to the next one (or to the end of the model). */
  run: number;
}

/** Shape of the cap-rock lip: a V-notch cut by the stream, a rounded travertine lip, or square basalt blocks. */
export type LedgeShape = "notched" | "rounded" | "blocky";

export interface WaterfallPreset {
  id: WaterfallId;
  tiers: WaterfallTier[];
  ledge: LedgeShape;
  /** Thickness of the hard cap-rock layer. */
  ledgeThick: number;
  /** How many hard/soft rock beds show on the cliffs (higher = thinner layers). */
  beds: number;
  /** 0…1+ — how much mist hangs in the gorge (confinement matters, not only discharge). */
  mist: number;
  /** Plunge-pool radius multiplier and depth of the bowl. */
  poolScale: number;
  poolDepth: number;
  /** How much the falling sheet fans out on the way down. */
  fan: number;
  /** Half-width of the valley floor below the falls. */
  halfValley: number;
  /** Height of the gorge rim above the top of the falls. */
  wall: number;
  /** Horizontal distance over which the valley walls rise (small = steep gorge). */
  wallSteep: number;
  rock: string;
  rockDark: string;
  cap: string;
  soft: string;
  veg: string;
  /** 0…1 — how green the slopes are. */
  vegAmount: number;
  trees: number;
  deep: string;
  shallow: string;
  /** 0 = one sheet of water; n = the water splits into about n strands. */
  strands: number;
  /** 0…1 — discharge: more spray and mist. */
  flow: number;
  sky: string;
  /** Short facts for the side panel. */
  rockName: string;
  facts: string[];
}

export const WATERFALLS: Record<WaterfallId, WaterfallPreset> = {
  gveleti: {
    id: "gveleti",
    // A short chute in the notch, then one tall, narrow plunge into a tight slot gorge.
    tiers: [
      { drop: 2.2, width: 0.9, lip: 0.2, run: 2.6 },
      { drop: 12.5, width: 1.15, lip: 0.45, run: 11 },
    ],
    ledge: "notched",
    ledgeThick: 0.9,
    beds: 0.9,
    mist: 1.25,
    poolScale: 0.8,
    poolDepth: 1.7,
    fan: 0.14,
    halfValley: 2.2,
    wall: 12,
    wallSteep: 1.3,
    rock: "#80868e",
    rockDark: "#474d55",
    cap: "#a3a8ae",
    soft: "#6a625c",
    veg: "#6f7f4a",
    vegAmount: 0.3,
    trees: 26,
    deep: "#2d5f6e",
    shallow: "#6fa8b5",
    strands: 0,
    flow: 0.85,
    sky: "#b9cfdf",
    rockName: "გრანიტი და ფიქალი",
    facts: [
      "ვიწრო, ღრმა ხევი — კედლები თითქმის ვერტიკალურია, მზე ფსკერამდე ცოტა ხნით აღწევს.",
      "შენაკადის ხევი თერგის ხეობაზე მაღლა „კიდია“: თერგმა უფრო სწრაფად ჩაიჭრა, შენაკადი კი საფეხურიდან ერთი ნაკადით ვარდება.",
      "ზაფხულში, მყინვარებისა და თოვლის დნობისას, წყალი ყველაზე ბევრია — შხეფები და წყლის მტვერი ხევს ავსებს.",
    ],
  },
  kinchkha: {
    id: "kinchkha",
    // A staircase of low limestone steps; each one is wider and the water spreads out more.
    tiers: [
      { drop: 4.6, width: 2.6, lip: 0.35, run: 3.8 },
      { drop: 3.6, width: 3.2, lip: 0.3, run: 3.4 },
      { drop: 2.8, width: 3.9, lip: 0.28, run: 3.2 },
      { drop: 2.2, width: 4.6, lip: 0.25, run: 10 },
    ],
    ledge: "rounded",
    ledgeThick: 0.7,
    beds: 3.4,
    mist: 0.45,
    poolScale: 1.25,
    poolDepth: 0.55,
    fan: 0.5,
    halfValley: 4.6,
    wall: 5,
    wallSteep: 6,
    rock: "#c4b796",
    rockDark: "#857a63",
    cap: "#e0d6ba",
    soft: "#8f7f66",
    veg: "#3f7a34",
    vegAmount: 0.95,
    trees: 130,
    deep: "#1f6f73",
    shallow: "#5fb7b0",
    strands: 6,
    flow: 0.55,
    sky: "#c4dcea",
    rockName: "კირქვა",
    facts: [
      "წყალი ასკის მასივის კირქვის კიდიდან რამდენიმე საფეხურად ჩამოდის — თითოეული საფეხური მაგარი ფენაა, რომელიც წყალმა ვერ გამორეცხა.",
      "კირქვაზე წყალი რამდენიმე ნაკადად იყოფა; ყოველი საფეხურის ძირში პატარა ქვაბულია, საიდანაც წყალი შემდეგ საფეხურზე გადადის.",
      "ფერდობები ხშირი კოლხური ტყითა და ხავსითაა დაფარული — ნოტიო ჰავა და წყლის მტვერი მცენარეებს ჭარბად ასველებს.",
    ],
  },
  makhuntseti: {
    id: "makhuntseti",
    // One wide, even curtain off a thick, deeply undercut basalt shelf into a big round pool.
    tiers: [{ drop: 6.5, width: 5.6, lip: 1.4, run: 12 }],
    ledge: "blocky",
    ledgeThick: 1.8,
    beds: 1.6,
    mist: 0.8,
    poolScale: 1.55,
    poolDepth: 1.5,
    fan: 0.08,
    halfValley: 5.6,
    wall: 6,
    wallSteep: 4.5,
    rock: "#3f3b39",
    rockDark: "#1f1d1c",
    cap: "#55504c",
    soft: "#2f2a27",
    veg: "#2f6a2c",
    vegAmount: 0.85,
    trees: 100,
    deep: "#24505a",
    shallow: "#5e9aa0",
    strands: 0,
    flow: 1,
    sky: "#c9dbe6",
    rockName: "მუქი ვულკანური ქანი",
    facts: [
      "ფართო „ფარდა“: წყალი მუქი, მაგარი ვულკანური ქანის კიდიდან ერთიან ფენად ვარდება.",
      "კარნიზის ქვეშ ქანი რბილია და წყალი მას ამოთხრის — ჩანჩქერის უკან ღრმული ჩნდება.",
      "ძირში ფართო, ღრმა ქვაბულია, შემდეგ წყალი აჭარისწყალს უერთდება; ახლოს თამარის თაღოვანი ქვის ხიდია.",
    ],
  },
};

export const WATERFALL_IDS: WaterfallId[] = ["gveleti", "kinchkha", "makhuntseti"];
