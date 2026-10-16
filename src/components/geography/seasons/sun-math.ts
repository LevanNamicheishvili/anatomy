import { AXIAL_TILT } from "../globe/graticule";

/*
 * Simple school-level sun geometry for the seasons lesson (no equation of time, no leap years).
 * The year is pinned to the four turning points, so the presets give exactly 0° / ±23,44°.
 */

const D = Math.PI / 180;

export const MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Month (0–11) of a day of the year (1–365). */
export function monthOf(day: number) {
  let d = Math.round(day);
  for (let m = 0; m < 12; m++) {
    if (d <= MONTH_DAYS[m]) return m;
    d -= MONTH_DAYS[m];
  }
  return 11;
}

export type Season = "winter" | "spring" | "summer" | "autumn";
export const SEASON_NAMES: Record<Season, string> = { winter: "ზამთარი", spring: "გაზაფხული", summer: "ზაფხული", autumn: "შემოდგომა" };

/** The season by the calendar months (winter: December–February), in the northern or the southern half. */
export function seasonOf(day: number, south = false): Season {
  const order: Season[] = ["winter", "spring", "summer", "autumn"];
  const k = Math.floor(((monthOf(day) + 1) % 12) / 3);
  return order[south ? (k + 2) % 4 : k];
}

/** Day of the year (1–365) → "21 ივნისი". */
export function dateLabel(day: number) {
  let d = Math.round(day);
  for (let m = 0; m < 12; m++) {
    if (d <= MONTH_DAYS[m]) return `${d} ${MONTHS[m]}`;
    d -= MONTH_DAYS[m];
  }
  return `31 დეკემბერი`;
}

export interface TurningPoint {
  id: string;
  name: string;
  short: string;
  day: number;
  /** Orbit angle from the June solstice, degrees. */
  angle: number;
  note: string;
}

export const TURNING_POINTS: TurningPoint[] = [
  { id: "march", name: "გაზაფხულის ბუნიობა", short: "20 მარტი", day: 79, angle: 270, note: "მზე ზენიტშია ეკვატორზე. დღე და ღამე მთელ დედამიწაზე თითქმის თანაბარია — 12 საათი." },
  { id: "june", name: "ზაფხულის მზედგომა", short: "21 ივნისი", day: 172, angle: 0, note: "ჩრდილოეთ ნახევარსფერო მზისკენაა დახრილი: მზე ზენიტშია ჩრდილოეთის ტროპიკზე; ჩვენთან ყველაზე გრძელი დღეა, პოლარული წრის იქით — პოლარული დღე." },
  { id: "september", name: "შემოდგომის ბუნიობა", short: "23 სექტემბერი", day: 266, angle: 90, note: "მზე ისევ ეკვატორზეა ზენიტში. დღე ღამეს უტოლდება, შემდეგ კი ჩრდილოეთში ღამე იწყებს დაგრძელებას." },
  { id: "december", name: "ზამთრის მზედგომა", short: "21 დეკემბერი", day: 355, angle: 180, note: "ჩრდილოეთ ნახევარსფერო მზეს „ზურგს აქცევს“: მზე ზენიტშია სამხრეთის ტროპიკზე; ჩვენთან ყველაზე მოკლე დღეა, არქტიკაში — პოლარული ღამე." },
];

/** Orbit angle (degrees from the June solstice, 0–360) for a day of the year, linear between the turning points. */
export function orbitAngle(day: number) {
  // March equinox = −90°, June = 0°, September = 90°, December = 180°, next March = 270°.
  const anchors = [
    [79, -90],
    [172, 0],
    [266, 90],
    [355, 180],
    [444, 270],
  ];
  const d = day < 79 ? day + 365 : day;
  for (let i = 0; i < anchors.length - 1; i++) {
    const [d0, a0] = anchors[i];
    const [d1, a1] = anchors[i + 1];
    if (d >= d0 && d <= d1) return (((a0 + ((d - d0) / (d1 - d0)) * (a1 - a0)) % 360) + 360) % 360;
  }
  return 0;
}

/** Latitude where the noon sun is overhead (the sun's declination), degrees. */
export function declination(day: number) {
  return Math.asin(Math.sin(AXIAL_TILT * D) * Math.cos(orbitAngle(day) * D)) / D;
}

/** Hours of daylight at a latitude (no refraction). */
export function dayLength(lat: number, decl: number) {
  const x = -Math.tan(lat * D) * Math.tan(decl * D);
  if (x <= -1) return 24;
  if (x >= 1) return 0;
  return (2 * Math.acos(x)) / D / 15;
}

/** Height of the noon sun above the horizon. */
export function noonAltitude(lat: number, decl: number) {
  return 90 - Math.abs(lat - decl);
}

export interface City {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Standard UTC offset, hours. */
  utc: number;
  /** Summer time (+1 h) from the first day to the second (round the new year when the first is later). */
  dst?: [number, number];
  /** Average temperature of each month, °C (climate normals, rounded). */
  temps: number[];
}

export const CITIES: City[] = [
  { id: "tbilisi", name: "თბილისი", lat: 41.72, lon: 44.79, utc: 4, temps: [1, 3, 7, 13, 18, 22, 25, 25, 20, 14, 7, 3] },
  { id: "london", name: "ლონდონი", lat: 51.5, lon: -0.13, utc: 0, dst: [88, 298], temps: [5, 5, 7, 10, 13, 16, 19, 18, 16, 12, 8, 6] },
  { id: "new-york", name: "ნიუ-იორკი", lat: 40.71, lon: -74.01, utc: -5, dst: [68, 305], temps: [0, 2, 6, 12, 17, 22, 25, 25, 21, 14, 9, 3] },
  { id: "tokyo", name: "ტოკიო", lat: 35.68, lon: 139.69, utc: 9, temps: [5, 6, 9, 15, 19, 22, 26, 27, 24, 18, 13, 8] },
  { id: "sydney", name: "სიდნეი", lat: -33.87, lon: 151.21, utc: 10, dst: [278, 96], temps: [23, 23, 22, 19, 16, 13, 12, 13, 16, 18, 20, 22] },
];

export function cityOffset(c: City, day: number) {
  if (!c.dst) return c.utc;
  const [a, b] = c.dst;
  return c.utc + ((a < b ? day >= a && day < b : day >= a || day < b) ? 1 : 0);
}

/** The month's average temperature in a city, as a forecast shows it: "+25°". */
export function cityTemp(c: City, day: number) {
  const t = c.temps[monthOf(day)];
  return `${t > 0 ? "+" : t < 0 ? "−" : ""}${Math.abs(t)}°`;
}

export const TBILISI_UTC = 4;

/** 13.5 → "13:30" (wraps round the day). */
export function clock(hours: number) {
  const m = Math.round((((hours % 24) + 24) % 24) * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Day shift relative to UTC date: −1, 0 or +1. */
export function dayShift(utcHours: number, offset: number) {
  return Math.floor((utcHours + offset) / 24);
}

export const utcLabel = (n: number) => (n === 0 ? "UTC" : `UTC${n > 0 ? "+" : "−"}${Math.abs(n)}`);
