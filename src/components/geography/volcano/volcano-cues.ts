import type { Cue } from "@/lib/narration-cues";
import type { VolcanoInset } from "./insets";
import type { VolcanoAnchor, VolcanoStep, VolcanoView } from "./VolcanoScene";

/*
 * What the volcano cross-section shows while the narration reads the lesson (geography-lessons.ts, "volcanoes"):
 * the step (plates, magma, eruption, earthquake, tsunami), where the camera looks, which labels light up, a picture
 * over the section for what it cannot show (the world's plates, boundary kinds, the magnitude, Georgia), and the
 * event: held while the stress builds, set off again whenever `go` changes.
 */

export interface VolcanoShot {
  step: VolcanoStep;
  view: VolcanoView;
  lit: VolcanoAnchor[];
  inset: VolcanoInset | null;
  hold: boolean;
  go: number;
}

const PLATES: VolcanoAnchor[] = ["ocean", "continent"];

export const VOLCANO_CUES: Cue<VolcanoShot>[] = [
  // Introduction.
  { at: "ვულკანები მიწისძვრები და ცუნამები", block: 0, set: { step: "plates", view: "overview", lit: [], inset: null, hold: false, go: 0 } },
  { at: "ლითოსფეროს ფილები მოძრაობს", set: { lit: PLATES } },
  { at: "სადაც ისინი ერთმანეთს ეჯახება", set: { view: "trench", lit: ["trench"] } },
  { at: "დედამიწის სიღრმიდან მაგმა", set: { step: "magma", view: "rise", lit: ["melt", "chamber"] } },
  { at: "და ქანები ზანზარებს", set: { step: "quake", view: "quake", lit: ["focus"], go: 1 } },
  { at: "გაიარე ხუთი ნაბიჯი", set: { step: "plates", view: "overview", lit: [] } },
  // Plates and their boundaries.
  { at: "ფილები და მათი საზღვრები", block: 1, set: { step: "plates", view: "overview", lit: [], inset: null, hold: false } },
  { at: "ლითოსფერო 7 დიდ", set: { inset: "world" } },
  { at: "ისინი წელიწადში", set: { inset: null, lit: PLATES } },
  { at: "ვულკანების და მიწისძვრების უმეტესობა", set: { inset: "world", lit: [] } },
  { at: "წყნარი ოკეანის", set: { inset: "ring" } },
  { at: "საზღვრები სამი სახისაა", set: { inset: null } },
  { at: "სადაც ფილები ერთმანეთს შორდება", set: { inset: "diverge" } },
  { at: "სადაც ეჯახება", set: { inset: "subduct", view: "trench", lit: ["trench"] } },
  { at: "ან ორივე ზემოთ იწევს", set: { inset: "collide" } },
  { at: "და სადაც გვერდიგვერდ სრიალებს", set: { inset: "transform", view: "overview", lit: [] } },
  // Magma and the eruption.
  { at: "როგორ წარმოიქმნება მაგმა", block: 2, set: { step: "magma", view: "overview", lit: [], inset: null, hold: false } },
  { at: "მანტია მყარია", set: { view: "mantle", lit: ["mantle"] } },
  { at: "მას წყალი ემატება", set: { view: "melt", lit: ["melt"] } },
  { at: "წნევა მცირდება", set: { inset: "diverge" } },
  { at: "ან ძალიან ცხელი ნაკადი", set: { inset: "hotspot" } },
  { at: "გამდნარ ქანს მაგმა ჰქვია", set: { inset: null, view: "melt", lit: ["melt"] } },
  { at: "მაგმა მსუბუქია და ადის", set: { view: "rise", lit: ["melt", "chamber"] } },
  { at: "ქერქში მაგმის კერაში", set: { view: "chamber", lit: ["chamber"] } },
  { at: "როცა წნევა ქანს გაარღვევს", set: { step: "eruption", view: "volcano", lit: ["crater"] } },
  { at: "ლავად იღვრება", set: { lit: ["lava"] } },
  { at: "ფერფლად და ვულკანურ ბომბებად", set: { view: "eruption", lit: ["ash"] } },
  { at: "ვულკანი მოქმედია", set: { view: "volcano", lit: ["crater"] } },
  { at: "ჩამქრალი", block: 2, set: { step: "plates" } },
  // The earthquake: stress builds, the rock gives way, the waves run out.
  { at: "მიწისძვრა ფილები ერთმანეთზე", block: 3, set: { step: "quake", view: "quake", lit: PLATES, inset: null, hold: true } },
  { at: "დაძაბულობა წლობით გროვდება", set: { lit: ["focus"] } },
  { at: "შემდეგ ქანები უეცრად წყდება", set: { hold: false, go: 2, lit: [] } },
  { at: "ადგილს სადაც სიღრმეში", set: { lit: ["focus"], go: 3 } },
  { at: "მის ზემოთ ზედაპირზე", set: { lit: ["epicentre"] } },
  { at: "მიწისძვრის ენერგიას მაგნიტუდით", set: { inset: "magnitude", lit: [] } },
  // The tsunami.
  { at: "ცუნამი როცა", block: 4, set: { step: "tsunami", view: "overview", lit: [], inset: null, hold: true } },
  { at: "ფსკერს უეცრად აწევს", set: { hold: false, go: 4, lit: ["epicentre"] } },
  { at: "მთელი წყლის სვეტი", set: { lit: ["tsunamiL", "tsunamiR"] } },
  { at: "ღია ოკეანეში ის დაბალია", set: { view: "ocean", lit: ["tsunamiL"] } },
  { at: "მიქრის", block: 4, set: { inset: "speed" } },
  { at: "ნაპირთან წყალმარჩხში", set: { inset: null, view: "coast", lit: ["coast"] } },
  { at: "2004 წელს", set: { inset: "tsunamis", lit: [] } },
  { at: "თუ ნაპირიდან ზღვა", set: { inset: null, view: "coast", lit: ["coast"] } },
  // Georgia.
  { at: "საქართველოში საქართველოში", block: 5, set: { step: "plates", view: "overview", lit: [], inset: "georgia", hold: false } },
  { at: "ყაზბეგი", block: 5, set: { step: "magma", view: "volcano", lit: ["crater"], inset: "ge-kazbegi" } },
  { at: "ჯავახეთის ზეგანი", set: { step: "plates", lit: [], inset: "ge-javakheti" } },
  { at: "ბორჯომის მინერალური", set: { inset: "ge-borjomi" } },
  { at: "საქართველო არაბეთისა", set: { view: "overview", lit: PLATES, inset: "ge-plates" } },
  { at: "ყველაზე ძლიერი იყო რაჭის", set: { step: "quake", view: "quake", lit: ["epicentre"], inset: "ge-racha", go: 5 } },
];
