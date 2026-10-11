import type { HazardKind } from "./hazards-data";

/*
 * Topic 7 — a deliberately simple slope model for the classroom.
 * Landslide: the "infinite slope" safety factor FS = c / (sin θ · cos θ) + (1 − 0,5·m) · tan φ / tan θ,
 * where m is how soaked the ground is (0…1), φ = 30° the friction angle and c the grip of the roots
 * (forest) and clay. FS > 1 — the slope holds; FS < 1 — it slides.
 * Mudflow and avalanche: a 0…1 risk from the slope angle, the water or the new snow, and the forest.
 */

const D = Math.PI / 180;
const PHI = 30 * D;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export interface SlopeInput {
  angle: number;
  /** Rain / soaked ground, 0…1. */
  water: number;
  /** New snow, cm. */
  snow: number;
  forest: boolean;
}

export interface SlopeResult {
  /** 0…1 (≥ 0,5 — it goes). */
  risk: number;
  triggered: boolean;
  /** Landslide only. */
  fs?: number;
  reason: string;
}

export function landslideFS({ angle, water, forest }: SlopeInput) {
  const t = Math.max(1, angle) * D;
  const c = forest ? 0.11 : 0.04;
  return c / (Math.sin(t) * Math.cos(t)) + ((1 - 0.5 * water) * Math.tan(PHI)) / Math.tan(t);
}

function avalancheAngle(a: number) {
  if (a < 20) return 0;
  if (a < 30) return 0.15 + ((a - 20) / 10) * 0.85;
  if (a <= 45) return 1;
  if (a < 55) return 1 - ((a - 45) / 10) * 0.65;
  return 0.3;
}

export function evaluate(kind: HazardKind, s: SlopeInput): SlopeResult {
  if (kind === "landslide") {
    const fs = landslideFS(s);
    const risk = clamp01(1.5 - fs);
    return {
      fs,
      risk,
      triggered: fs < 1,
      reason:
        fs >= 1
          ? s.forest
            ? "ფესვები და ხახუნი გრუნტს აკავებს — ფერდობი მდგრადია."
            : "ხახუნი ჯერ კიდევ აკავებს გრუნტს. სცადე: მეტი წვიმა ან უფრო ციცაბო ფერდობი."
          : s.water > 0.6
            ? "წყლით გაჯერებული გრუნტი დამძიმდა და ხახუნი შემცირდა — მეწყერი!"
            : "ფერდობი ძალიან ციცაბოა — სიმძიმე ხახუნს სძლევს, მეწყერი!",
    };
  }
  if (kind === "mudflow") {
    const channel = clamp01((s.angle - 8) / 17);
    const risk = clamp01(s.water * channel * (s.forest ? 0.55 : 1) * 1.25);
    return {
      risk,
      triggered: risk >= 0.5,
      reason:
        risk >= 0.5
          ? "თავსხმამ ხევში დაგროვილი ქვები და ტალახი წაიღო — ღვარცოფი!"
          : s.angle < 12
            ? "ხევი დამრეცია — წყალი ნატანს ვერ ამოძრავებს."
            : s.water < 0.5
              ? "წვიმა ცოტაა — ნატანი ადგილზე რჩება."
              : "ტყე და მცენარეები ნატანს აკავებს.",
    };
  }
  const load = clamp01((s.snow - 15) / 50);
  const risk = clamp01(avalancheAngle(s.angle) * load * (s.forest ? 0.35 : 1));
  return {
    risk,
    triggered: risk >= 0.5,
    reason:
      risk >= 0.5
        ? "ახალი თოვლის მძიმე ფენა ძველს მოწყდა და ფერდობზე დაეშვა — ზვავი!"
        : s.angle < 25
          ? "ფერდობი დამრეცია — თოვლი მყარად დევს."
          : s.angle > 50
            ? "ძალიან ციცაბოა — თოვლი ბევრი ვერ გროვდება, პატარა ნაყარებად ცვივა."
            : s.snow < 35
              ? "ახალი თოვლი ცოტაა — საფარი მდგრადია."
              : "ტყე თოვლს აკავებს.",
  };
}
