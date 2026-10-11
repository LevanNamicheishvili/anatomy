/*
 * Topic 9 — the numbers behind a solar panel. The sun is due south (noon), the panel faces south and is
 * tilted by `tilt` from the horizontal. Then the angle of incidence (between the sunbeam and the panel's
 * normal) is |90° − (elevation + tilt)|, and the panel catches cos(incidence) of the direct sunlight.
 */

/** Sunlight above the atmosphere, W/m² (solar constant). */
export const SOLAR_CONSTANT = 1361;
/** Typical silicon panel efficiency. */
export const EFFICIENCY = 0.2;
/** Tbilisi's latitude: noon sun elevation = 90° − latitude ± 23.44° by season. */
export const TBILISI_LAT = 41.7;

export const SEASONS = [
  { id: "summer", name: "ზაფხული (22 ივნისი)", elevation: Math.round(90 - TBILISI_LAT + 23.44) },
  { id: "equinox", name: "ბუნიობა (21 მარტი / 23 სექტემბერი)", elevation: Math.round(90 - TBILISI_LAT) },
  { id: "winter", name: "ზამთარი (22 დეკემბერი)", elevation: Math.round(90 - TBILISI_LAT - 23.44) },
] as const;

export interface SolarReading {
  /** Angle between sunbeam and panel normal, degrees. */
  incidence: number;
  /** Share of the direct beam the panel catches (cos of the incidence angle). */
  cosine: number;
  /** Direct sunlight reaching the ground on a surface facing the sun, W/m². */
  beam: number;
  /** Sunlight falling on 1 m² of the panel, W/m². */
  onPanel: number;
  /** Electric power from 1 m² of panel, W. */
  electric: number;
}

export function solarReading(elevation: number, tilt: number): SolarReading {
  if (elevation <= 0) return { incidence: 90, cosine: 0, beam: 0, onPanel: 0, electric: 0 };
  const rad = Math.PI / 180;
  const incidence = Math.abs(90 - (elevation + tilt));
  const cosine = Math.max(0, Math.cos(incidence * rad));
  // Low sun: light crosses more air (air mass ≈ 1 / sin elevation) and more of it is scattered.
  const airMass = 1 / Math.sin(Math.max(1, elevation) * rad);
  const beam = SOLAR_CONSTANT * 0.7 ** (airMass ** 0.678);
  const onPanel = beam * cosine;
  return { incidence, cosine, beam, onPanel, electric: onPanel * EFFICIENCY };
}

/** Best tilt for a given sun elevation: panel square to the beam (what a sun tracker does). */
export const trackerTilt = (elevation: number) => Math.max(0, Math.min(90, 90 - elevation));
