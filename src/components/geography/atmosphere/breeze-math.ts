/*
 * School-level numbers for the sea-breeze lesson: how land and sea warm up and cool down over a day on
 * Georgia's Black Sea coast (summer), the pressure difference that follows and the breeze it drives.
 */

const TAU = Math.PI * 2;

/** Air over land: warmest ~15:00, coolest ~03:00 (°C). */
export const landTemp = (h: number) => 22 + 8 * Math.sin(((h - 9) / 24) * TAU);
/** Air over the sea barely changes during the day. */
export const seaTemp = (h: number) => 22 + 1 * Math.sin(((h - 11) / 24) * TAU);

export interface BreezeState {
  land: number;
  sea: number;
  /** Land − sea (°C): positive by day (sea breeze), negative at night (land breeze). */
  diff: number;
  /** −1 … 1: strength and direction of the loop (positive = sea → land at the surface). */
  k: number;
  /** Surface pressure, hPa. */
  pLand: number;
  pSea: number;
  /** Rough breeze speed, m/s. */
  speed: number;
  kind: "sea" | "land" | "calm";
}

export function breeze(h: number): BreezeState {
  const land = landTemp(h);
  const sea = seaTemp(h);
  const diff = land - sea;
  const k = Math.max(-1, Math.min(1, diff / 8));
  return {
    land,
    sea,
    diff,
    k,
    pLand: 1013 - diff * 0.35,
    pSea: 1013 + diff * 0.35,
    speed: Math.abs(diff) * 0.6,
    kind: Math.abs(diff) < 1 ? "calm" : diff > 0 ? "sea" : "land",
  };
}

/** Air cools about 6 °C for every kilometre up (in still, unsaturated air ~10 °C; on average ~6 °C). */
export const LAPSE = 6;

/** Sun height factor 0…1 for the sky colour and the light. */
export const daylight = (h: number) => Math.max(0, Math.sin(((h - 6) / 12) * Math.PI));
