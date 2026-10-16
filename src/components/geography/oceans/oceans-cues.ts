import type { Cue } from "@/lib/narration-cues";
import type { RiverMode } from "./RiverPanel";

/*
 * What the oceans lesson shows while the narration reads it (geography-lessons.ts, "oceans"): which tool is on
 * (the currents globe, the rivers picture, the echo sounder, the tides) and what it shows — the currents drawn and
 * lit and where the globe turns, the part of a river named, the ship's place and its pings (a new number sends
 * one), the Moon's phase and whether the Earth turns.
 */

export type OceansTab = "currents" | "river" | "floor" | "tides";

export interface OceansShot {
  tab: OceansTab;
  show: "all" | "warm" | "cold";
  lit: string[];
  focus: [number, number, number];
  river: RiverMode;
  km: number;
  ping: number;
  day: number;
  turning: boolean;
}

const COLD = ["humboldt", "benguela", "canary", "california"];

export const OCEANS_CUES: Cue<OceansShot>[] = [
  // Introduction.
  { at: "დედამიწის ზედაპირის 71%", block: 0, set: { tab: "currents", show: "all", lit: [], focus: [20, -30, 3.4], river: "map", km: 700, ping: 0, day: 7.4, turning: false } },
  { at: "დინებები მას ათასობით", set: { lit: ["gulf", "nad"], focus: [40, -40, 3.2] } },
  { at: "მთვარე დღეში ორჯერ", set: { tab: "tides", day: 14.8, turning: true } },
  { at: "ფსკერზე კი ხმელეთზე", set: { tab: "floor", km: 1130 } },
  { at: "და ღრმა ღარებია", set: { km: 1880 } },
  { at: "ნახე დინებები გლობუსზე", set: { tab: "currents", lit: [] } },
  { at: "გაზომე სიღრმე ექოლოტით", set: { tab: "floor", km: 700, ping: 1 } },
  { at: "და აამოძრავე მთვარე", set: { tab: "tides", day: 7.4, turning: true } },
  // Rivers.
  { at: "მდინარე სათავიდან შესართავამდე", block: 1, set: { tab: "river", river: "map", turning: false } },
  { at: "მდინარე იწყება სათავით", set: { river: "source" } },
  { at: "და მთავრდება შესართავით", set: { river: "mouth" } },
  { at: "მასში ჩამდინარე მდინარეები", set: { river: "tributaries" } },
  { at: "მთავარი მდინარე შენაკადებით", set: { river: "system" } },
  { at: "ტერიტორია საიდანაც წყალს აგროვებს", set: { river: "basins" } },
  { at: "საქართველოს უგრძესი მდინარეა", set: { river: "mtkvari" } },
  { at: "ყველაზე წყალუხვი", set: { river: "rioni" } },
  { at: "მდინარეები ზღვას ნატანს", set: { river: "delta" } },
  // Currents.
  { at: "ოკეანის დინებები", block: 2, set: { tab: "currents", show: "all", lit: [], focus: [25, -40, 3.4] } },
  { at: "მუდმივი ქარები", set: { lit: ["neq-atl"], focus: [15, -40, 3.2] } },
  { at: "დასავლეთის ქარები", set: { lit: ["nad", "wwd"], focus: [10, -30, 3.6] } },
  { at: "მიმართულებას კი დედამიწის", set: { lit: ["gulf", "nad", "canary", "neq-atl"], focus: [30, -45, 3.3] } },
  { at: "თბილი დინებები ეკვატორიდან", set: { show: "warm", lit: [], focus: [20, -40, 3.6] } },
  { at: "გოლფსტრიმისა და ჩრდილოატლანტიკური", set: { lit: ["gulf", "nad"], focus: [45, -35, 3.1] } },
  { at: "ნორვეგიის ნავსადგურები", set: { lit: ["nad"], focus: [64, 10, 2.6] } },
  { at: "ცივი დინებები პოლუსებიდან", set: { show: "cold", lit: [], focus: [0, -40, 3.6] } },
  { at: "ატაკამა", block: 2, set: { lit: ["humboldt"], focus: [-22, -72, 2.7] } },
  { at: "ნამიბი", block: 2, set: { lit: ["benguela"], focus: [-22, 14, 2.7] } },
  { at: "საჰარა", block: 2, set: { lit: ["canary"], focus: [24, -15, 2.7] } },
  { at: "ცივ დინებებში ბევრი თევზია", set: { lit: COLD, focus: [0, -40, 3.6] } },
  // The ocean floor.
  { at: "ოკეანის სიღრმეები", block: 3, set: { tab: "floor", km: 700, ping: 0 } },
  { at: "ჯერ შელფი იწყება", set: { km: 80, ping: 1 } },
  { at: "შემდეგ კონტინენტური ფერდობი", set: { km: 270, ping: 2 } },
  { at: "ფსკერის უდიდესი ნაწილი", set: { km: 700, ping: 3 } },
  { at: "შუაოკეანური ქედები", block: 3, set: { km: 1130, ping: 4 } },
  { at: "ფილების საზღვრებზე კი ღრმა", set: { km: 1880, ping: 5 } },
  { at: "მარიანის ღარი", set: { ping: 6 } },
  { at: "შავი ზღვის უდიდესი სიღრმე", set: { km: 1980.61, ping: 7 } },
  // The echo sounder.
  { at: "ექოლოტი როგორ ზომავენ", block: 4, set: { tab: "floor", km: 600, ping: 0 } },
  { at: "ბგერით იმპულსს ქვემოთ", set: { ping: 8 } },
  { at: "ბგერა ფსკერამდე ჩადის", set: { ping: 9 } },
  { at: "რადგან ბგერამ გზა ორჯერ", set: { ping: 10 } },
  { at: "თუ ექო 4 წამში", set: { km: 270, ping: 11 } },
  // Tides.
  { at: "მიქცევა-მოქცევა მთვარის", block: 5, set: { tab: "tides", day: 7.4, turning: false } },
  { at: "დედამიწა ბრუნავს და ნაპირი", set: { turning: true } },
  { at: "ახალ- და სავსემთვარეობისას", set: { day: 0 } },
  { at: "ერთ ხაზზეა", set: { day: 14.8 } },
  { at: "მეოთხედებში", set: { day: 7.4 } },
];
