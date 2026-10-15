import type { Cue } from "@/lib/narration-cues";
import type { CoastView } from "./CoastScene";

/*
 * What the sea-breeze scene shows while the narration reads the lesson (geography-lessons.ts, "atmosphere"):
 * the clock (day, night, the calm of the morning), where the camera looks, the sunbeams on the land, the pressure
 * markers, and which of the scene's labels lights up for the words being said.
 */

export type BreezeEmph = "temps" | "land" | "sea" | "lapse" | "mountain" | "pressure" | "low" | "high" | "upper" | "wind";

export interface BreezeShot {
  hour: number;
  pressure: boolean;
  view: CoastView;
  rays: boolean;
  emph: BreezeEmph | null;
}

export const BREEZE_CUES: Cue<BreezeShot>[] = [
  // Introduction.
  { at: "ზაფხულში ბათუმის", set: { hour: 14, pressure: false, view: "overview", rays: false, emph: null } },
  { at: "დღისით ზღვიდან გრილი ნიავი", set: { emph: "wind" } },
  { at: "ღამით კი", set: { hour: 2 } },
  { at: "ეს ბრიზია", set: { hour: 14, emph: null } },
  { at: "როგორ თბება ჰაერი", set: { emph: "temps" } },
  { at: "რატომ ჩნდება წნევის სხვაობა", set: { pressure: true, emph: "pressure" } },
  { at: "საიდან იწყება ქარი", set: { emph: "wind" } },
  { at: "ამოძრავე საათი", set: { emph: null } },
  // What the air's temperature depends on: the sun warms the ground, the ground the air; height.
  { at: "რაზეა დამოკიდებული ჰაერის ტემპერატურა", block: 1, set: { view: "surface", hour: 12, rays: true, pressure: false, emph: "land" } },
  { at: "დაცემის კუთხეზე", set: { hour: 8.5 } },
  { at: "დღის ხანგრძლივობაზე", set: { hour: 12.5 } },
  { at: "ზედაპირის სახეობაზე", set: { view: "coast", emph: "temps" } },
  { at: "ზღვიდან დაშორებაზე", set: { view: "overview", rays: false, emph: null } },
  { at: "სიმაღლის მატებასთან", set: { view: "mountain", hour: 14, emph: "lapse" } },
  { at: "კავკასიონის 4–5 კმ", set: { emph: "mountain" } },
  // Land and sea warm differently.
  { at: "ხმელეთი და ზღვა სხვადასხვანაირად თბება", block: 2, set: { view: "coast", hour: 14, rays: true, emph: "temps" } },
  { at: "ამიტომ ზღვა ნელა თბება", set: { emph: "sea" } },
  { at: "ხმელეთი კი — სწრაფად", set: { emph: "land" } },
  { at: "შედეგად ზაფხულის დღეს", set: { hour: 14, emph: "temps" } },
  { at: "ღამით კი — ცივი", set: { hour: 2, rays: false } },
  { at: "ზღვის მახლობლად ამინდი", set: { hour: 14, view: "overview", emph: null } },
  // Pressure and wind.
  { at: "ატმოსფერული წნევა და ქარი", block: 3, set: { view: "loop", hour: 14, pressure: true, emph: "pressure" } },
  { at: "სიმაღლეზე წნევა ეცემა", set: { emph: "upper" } },
  { at: "თბილი ჰაერი ფართოვდება", set: { emph: "low" } },
  { at: "ცივი ჰაერი მკვრივი", set: { emph: "high" } },
  { at: "ჰაერი ყოველთვის მაღალი", set: { emph: "wind" } },
  // The breeze by day and by night.
  { at: "ბრიზი: დღის და ღამის", block: 4, set: { view: "loop", hour: 14, pressure: true, emph: null } },
  { at: "დღისით ხმელეთი თბება", set: { emph: "low" } },
  { at: "ზღვაზე ჰაერი გრილია", set: { emph: "high" } },
  { at: "ქვემოთ ჰაერი ზღვიდან", set: { emph: "wind" } },
  { at: "ზემოთ კი ჰაერი უკან", set: { emph: "upper" } },
  { at: "ხმელეთზე ამომავალ ჰაერში", set: { view: "clouds", emph: null } },
  { at: "ღამით ხმელეთი სწრაფად ცივდება", set: { view: "loop", hour: 2, emph: "temps" } },
  { at: "ახლა წნევა ხმელეთზეა მაღალი", set: { emph: "high" } },
  { at: "ქარი ხმელეთიდან ზღვისკენ", set: { emph: "wind" } },
  { at: "დილით და საღამოს", set: { view: "coast", hour: 9, emph: "wind" } },
  { at: "ბრიზი მხოლოდ რამდენიმე", set: { view: "overview", hour: 14, emph: null } },
  { at: "მსგავსად, მაგრამ წელიწადის", set: { view: "far" } },
];
