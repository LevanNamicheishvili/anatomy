/*
 * A small star catalogue for the Polaris lesson: the stars of the Big Dipper, the Little Dipper and
 * Cassiopeia (J2000 right ascension in degrees, declination in degrees), with the lines that join them.
 */

export interface Star {
  id: string;
  name?: string;
  ra: number;
  dec: number;
  /** Visual brightness, 1 = brightest here. */
  mag: number;
}

export interface Constellation {
  id: string;
  name: string;
  stars: Star[];
  /** Pairs of star ids. */
  lines: [string, string][];
}

export const POLARIS: Star = { id: "polaris", name: "პოლარული ვარსკვლავი", ra: 37.95, dec: 89.26, mag: 2 };

export const CONSTELLATIONS: Constellation[] = [
  {
    id: "uma",
    name: "დიდი დათვი (დიდი ციცხვი)",
    stars: [
      { id: "dubhe", name: "დუბჰე", ra: 165.93, dec: 61.75, mag: 1.8 },
      { id: "merak", name: "მერაკი", ra: 165.46, dec: 56.38, mag: 2.4 },
      { id: "phecda", ra: 178.46, dec: 53.69, mag: 2.4 },
      { id: "megrez", ra: 183.86, dec: 57.03, mag: 3.3 },
      { id: "alioth", ra: 193.51, dec: 55.96, mag: 1.8 },
      { id: "mizar", ra: 200.98, dec: 54.93, mag: 2.2 },
      { id: "alkaid", ra: 206.89, dec: 49.31, mag: 1.9 },
    ],
    lines: [
      ["alkaid", "mizar"],
      ["mizar", "alioth"],
      ["alioth", "megrez"],
      ["megrez", "phecda"],
      ["phecda", "merak"],
      ["merak", "dubhe"],
      ["dubhe", "megrez"],
    ],
  },
  {
    id: "umi",
    name: "პატარა დათვი",
    stars: [
      POLARIS,
      { id: "yildun", ra: 263.05, dec: 86.59, mag: 4.4 },
      { id: "eps-umi", ra: 251.49, dec: 82.04, mag: 4.2 },
      { id: "zeta-umi", ra: 236.01, dec: 77.79, mag: 4.3 },
      { id: "eta-umi", ra: 244.38, dec: 75.76, mag: 5 },
      { id: "kochab", ra: 222.68, dec: 74.16, mag: 2.1 },
      { id: "pherkad", ra: 230.18, dec: 71.83, mag: 3 },
    ],
    lines: [
      ["polaris", "yildun"],
      ["yildun", "eps-umi"],
      ["eps-umi", "zeta-umi"],
      ["zeta-umi", "kochab"],
      ["kochab", "pherkad"],
      ["pherkad", "eta-umi"],
      ["eta-umi", "zeta-umi"],
    ],
  },
  {
    id: "cas",
    name: "კასიოპეა",
    stars: [
      { id: "caph", ra: 2.29, dec: 59.15, mag: 2.3 },
      { id: "schedar", ra: 10.13, dec: 56.54, mag: 2.2 },
      { id: "gamma-cas", ra: 14.18, dec: 60.72, mag: 2.2 },
      { id: "ruchbah", ra: 21.45, dec: 60.24, mag: 2.7 },
      { id: "segin", ra: 28.6, dec: 63.67, mag: 3.4 },
    ],
    lines: [
      ["caph", "schedar"],
      ["schedar", "gamma-cas"],
      ["gamma-cas", "ruchbah"],
      ["ruchbah", "segin"],
    ],
  },
];

export const ALL_STARS: Star[] = CONSTELLATIONS.flatMap((c) => c.stars);
export const STAR_BY_ID = Object.fromEntries(ALL_STARS.map((s) => [s.id, s])) as Record<string, Star>;

export const LATITUDES = [
  { name: "ეკვატორი", lat: 0 },
  { name: "კაირო", lat: 30 },
  { name: "თბილისი", lat: 41.7 },
  { name: "მურმანსკი", lat: 69 },
  { name: "ჩრდ. პოლუსი", lat: 90 },
];

/** Places to point at from Tbilisi (azimuth = bearing from Tbilisi). */
export const TBILISI = { lat: 41.72, lon: 44.79 };
export const TARGETS = [
  { name: "ყაზბეგი", lat: 42.66, lon: 44.64 },
  { name: "თელავი", lat: 41.92, lon: 45.47 },
  { name: "ვარძია", lat: 41.38, lon: 43.28 },
  { name: "ბათუმი", lat: 41.64, lon: 41.64 },
];

const D = Math.PI / 180;

/** Initial bearing (azimuth from north, clockwise) from one point to another, degrees 0–360. */
export function bearing(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const f1 = from.lat * D;
  const f2 = to.lat * D;
  const dl = (to.lon - from.lon) * D;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return ((Math.atan2(y, x) / D) % 360 + 360) % 360;
}

/**
 * Horizon direction of a star for an observer at latitude `lat` when the local sidereal time is `lst`
 * (degrees). Scene axes: +y up, −z north, +x east.
 */
export function horizonDir(ra: number, dec: number, lat: number, lst: number, out: { x: number; y: number; z: number }) {
  const h = (lst - ra) * D;
  const d = dec * D;
  const f = lat * D;
  const north = Math.cos(f) * Math.sin(d) - Math.sin(f) * Math.cos(d) * Math.cos(h);
  out.x = -Math.cos(d) * Math.sin(h);
  out.y = Math.sin(f) * Math.sin(d) + Math.cos(f) * Math.cos(d) * Math.cos(h);
  out.z = -north;
  return out;
}

export const compassName = (az: number) => {
  const names = ["ჩრდილოეთი", "ჩრდილო-აღმოსავლეთი", "აღმოსავლეთი", "სამხრეთ-აღმოსავლეთი", "სამხრეთი", "სამხრეთ-დასავლეთი", "დასავლეთი", "ჩრდილო-დასავლეთი"];
  return names[Math.round((((az % 360) + 360) % 360) / 45) % 8];
};
