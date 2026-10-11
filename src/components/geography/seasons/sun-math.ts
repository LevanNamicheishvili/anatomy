import { AXIAL_TILT } from "../globe/graticule";

/*
 * Simple school-level sun geometry for the seasons lesson (no equation of time, no leap years).
 * The year is pinned to the four turning points, so the presets give exactly 0° / ±23,44°.
 */

const D = Math.PI / 180;

export const MONTHS = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

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
  /** Summer time (+1 h) between these days of the year, if the country uses it. */
  dst?: [number, number];
}

export const CITIES: City[] = [
  { id: "tbilisi", name: "თბილისი", lat: 41.72, lon: 44.79, utc: 4 },
  { id: "london", name: "ლონდონი", lat: 51.5, lon: -0.13, utc: 0, dst: [88, 298] },
  { id: "new-york", name: "ნიუ-იორკი", lat: 40.71, lon: -74.01, utc: -5, dst: [68, 305] },
  { id: "tokyo", name: "ტოკიო", lat: 35.68, lon: 139.69, utc: 9 },
];

export function cityOffset(c: City, day: number) {
  return c.utc + (c.dst && day >= c.dst[0] && day < c.dst[1] ? 1 : 0);
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
