import type { Cue } from "@/lib/narration-cues";
import type { VoyageId } from "./voyages-data";

/*
 * What the voyages globe shows while the narration reads the lesson (geography-lessons.ts, "discoveries"): which
 * voyage, the named stop the ship sails to while the voice tells that leg (the camera riding along), all the
 * routes and the continents, or the camera on a place the voice talks about; and the navigators' instruments.
 */

export interface VoyageShot {
  voyage: VoyageId;
  /** Index of the stop (voyages-data.ts) the ship sails to. */
  to: number;
  /** All three routes and the continents. */
  all: boolean;
  /** Where the camera looks when it does not ride with the ship: latitude, longitude, distance. */
  look: [number, number, number] | null;
  /** The compass and the astrolabe drawn over the scene. */
  tools: boolean;
}

export const VOYAGE_CUES: Cue<VoyageShot>[] = [
  // Introduction.
  { at: "XV საუკუნის ბოლოს", set: { voyage: "columbus", to: 0, all: false, look: [42, 25, 3.3], tools: false } },
  { at: "ოკეანეები გადაცურეს", set: { all: true, look: [15, -25, 4.2] } },
  { at: "გაჰყევი სამ ყველაზე", set: { look: [10, -10, 4.6] } },
  // Why they went to sea.
  { at: "რატომ წავიდნენ ზღვაში", block: 1, set: { all: false, look: [32, 55, 3.6] } },
  { at: "ესპანეთი და პორტუგალია", set: { look: [39, -7, 3.0] } },
  { at: "ამას ახალი ტექნიკა", set: { voyage: "columbus", to: 0, look: [37.2, -6.9, 1.7] } },
  { at: "კომპასი, ასტროლაბია", set: { tools: true } },
  // Columbus.
  { at: "კოლუმბი: ამერიკა", block: 2, set: { voyage: "columbus", to: 0, all: false, look: null, tools: false } },
  { at: "კანარის კუნძულებიდან", set: { to: 1 } },
  { at: "12 ოქტომბერს ბაჰამის", set: { to: 4 } },
  { at: "შემდეგ კუბა", set: { to: 6 } },
  { at: "კოლუმბს ეგონა", set: { look: [22, -72, 3.4] } },
  { at: "კონტინენტს მისი სახელი", set: { all: true, look: [8, -80, 4.2] } },
  // Vasco da Gama.
  { at: "ვასკო და გამა: ზღვით", block: 3, set: { voyage: "gama", to: 0, all: false, look: null } },
  { at: "დიდი რკალი შემოხაზა", set: { to: 4 } },
  { at: "კეთილი იმედის კონცხი შემოუარა", set: { to: 5 } },
  { at: "აფრიკის აღმოსავლეთ სანაპიროს", set: { to: 9 } },
  { at: "მალინდიდან ინდოეთის ოკეანე", set: { to: 10 } },
  { at: "კალიკუტში ჩავიდა", set: { to: 12 } },
  { at: "ზღვის გზა ევროპიდან", set: { look: [12, 40, 4.0] } },
  // Magellan and Elcano.
  { at: "მაგელანი და ელკანო", block: 4, set: { voyage: "magellan", to: 0, all: false, look: null } },
  { at: "სამხრეთ ამერიკის გასწვრივ", set: { to: 6 } },
  { at: "ვიწრო სრუტე იპოვა", set: { to: 7 } },
  { at: "უზარმაზარი ოკეანე დახვდა", set: { to: 9 } },
  { at: "მისი გადაკვეთა", set: { to: 13 } },
  { at: "მაგელანი ფილიპინებზე დაიღუპა", set: { to: 15 } },
  { at: "ელკანომ დაასრულა", set: { to: 21 } },
  { at: "1522 წელს ესპანეთში", set: { to: 24 } },
  { at: "პირველად დამტკიცდა", set: { all: true, look: [0, 20, 5.2] } },
  // The other continents.
  { at: "დანარჩენი კონტინენტები", block: 5, set: { all: true, look: [-25, 134, 3.6] } },
  { at: "ჯეიმს კუკმა", set: { look: [-28, 150, 3.0] } },
  { at: "ანტარქტიდა აღმოაჩინა", set: { look: [-72, 20, 3.6] } },
];
