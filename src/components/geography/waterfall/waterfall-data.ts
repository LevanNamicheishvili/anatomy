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

export interface WaterfallPreset {
  id: WaterfallId;
  tiers: WaterfallTier[];
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
    tiers: [{ drop: 9, width: 1.5, lip: 0.55, run: 11 }],
    halfValley: 2.6,
    wall: 11,
    wallSteep: 1.6,
    rock: "#7c7f84",
    rockDark: "#4e5257",
    cap: "#9a9da2",
    soft: "#5f5a55",
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
    tiers: [
      { drop: 6, width: 3.2, lip: 0.8, run: 4 },
      { drop: 4.5, width: 2.6, lip: 0.6, run: 3.6 },
      { drop: 3.5, width: 3.8, lip: 0.5, run: 10 },
    ],
    halfValley: 4.2,
    wall: 5,
    wallSteep: 6,
    rock: "#b8ab90",
    rockDark: "#7d7360",
    cap: "#d3c8ad",
    soft: "#8f7f66",
    veg: "#3f7a34",
    vegAmount: 0.95,
    trees: 130,
    deep: "#1f6f73",
    shallow: "#5fb7b0",
    strands: 4,
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
    tiers: [{ drop: 7, width: 4.4, lip: 1.0, run: 11 }],
    halfValley: 4.8,
    wall: 6,
    wallSteep: 4.5,
    rock: "#4a4542",
    rockDark: "#2c2927",
    cap: "#5d5753",
    soft: "#3a3532",
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
