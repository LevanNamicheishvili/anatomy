/*
 * Topic 1 — the Earth's layers, with real depths (km) and the radius each one is drawn at. The crust is only
 * ~35 km thick (0,5% of the radius), so it is drawn much thicker; everything below is to scale.
 */

export const EARTH_R_KM = 6371;

export type LayerId = "crust" | "upper-mantle" | "lower-mantle" | "outer-core" | "inner-core";

export interface EarthLayer {
  id: LayerId;
  name: string;
  /** Depth range, km. */
  top: number;
  bottom: number;
  /** Drawn radius (Earth radii) at the top and bottom of the layer. */
  rTop: number;
  rBottom: number;
  color: string;
  glow: number;
  state: string;
  matter: string;
  temp: string;
  density: string;
  note: string;
}

export const LAYERS: EarthLayer[] = [
  {
    id: "crust",
    name: "დედამიწის ქერქი",
    top: 0,
    bottom: 35,
    rTop: 1,
    rBottom: 0.955,
    color: "#8a6a4a",
    glow: 0,
    state: "მყარი",
    matter: "გრანიტი (კონტინენტზე), ბაზალტი (ოკეანის ქვეშ)",
    temp: "+15°C ზედაპირზე → ~700°C ძირში",
    density: "2,7–3 გ/სმ³",
    note: "ყველაზე თხელი ფენა: ოკეანის ქვეშ 5–10 კმ, კონტინენტზე საშუალოდ 35–40 კმ, მაღალი მთების ქვეშ — 70 კმ-მდე. ქერქი და ზედა მანტიის მყარი ნაწილი ერთად ქმნის ლითოსფეროს, რომელიც ფილებადაა დაყოფილი.",
  },
  {
    id: "upper-mantle",
    name: "ზედა მანტია",
    top: 35,
    bottom: 660,
    rTop: 0.955,
    rBottom: 0.896,
    color: "#e0742c",
    glow: 0.15,
    state: "მყარი, მაგრამ „პლასტიკური“ — ნელა მიედინება",
    matter: "პერიდოტიტი (რკინით და მაგნიუმით მდიდარი ქანი)",
    temp: "~700°C → ~1900°C",
    density: "3,3–4 გ/სმ³",
    note: "100–250 კმ სიღრმეზე არის ასთენოსფერო — ნაწილობრივ გამდნარი, რბილი შრე. მასზე „დაცურავს“ ლითოსფეროს ფილები. აქ წარმოიქმნება ვულკანების მაგმის დიდი ნაწილი.",
  },
  {
    id: "lower-mantle",
    name: "ქვედა მანტია",
    top: 660,
    bottom: 2900,
    rTop: 0.896,
    rBottom: 0.546,
    color: "#c2451e",
    glow: 0.2,
    state: "მყარი (უზარმაზარი წნევის გამო)",
    matter: "სილიკატები რკინითა და მაგნიუმით",
    temp: "~1900°C → ~3700°C",
    density: "4,4–5,6 გ/სმ³",
    note: "მანტია დედამიწის მოცულობის ~84%-ია. მისი ნივთიერება ძალიან ნელა — წელიწადში რამდენიმე სანტიმეტრით — მოძრაობს (კონვექცია): ცხელი ადის, ცივი ეშვება. ეს მოძრაობა ამოძრავებს ლითოსფეროს ფილებს.",
  },
  {
    id: "outer-core",
    name: "გარე ბირთვი",
    top: 2900,
    bottom: 5150,
    rTop: 0.546,
    rBottom: 0.192,
    color: "#f2a22a",
    glow: 0.45,
    state: "თხევადი",
    matter: "გამდნარი რკინა და ნიკელი",
    temp: "~4000°C → ~5000°C",
    density: "9,9–12,2 გ/სმ³",
    note: "თხევადი რკინის მოძრაობა ქმნის დედამიწის მაგნიტურ ველს — სწორედ ამიტომ აჩვენებს კომპასის ისარი ჩრდილოეთს. მაგნიტური ველი გვიცავს მზის ქარისგან.",
  },
  {
    id: "inner-core",
    name: "შიდა ბირთვი",
    top: 5150,
    bottom: EARTH_R_KM,
    rTop: 0.192,
    rBottom: 0,
    color: "#fff1b0",
    glow: 0.8,
    state: "მყარი",
    matter: "რკინა და ნიკელი",
    temp: "~5200–5400°C (მზის ზედაპირივით ცხელი)",
    density: "12,8–13 გ/სმ³",
    note: "აქ მზის ზედაპირის მსგავსი ტემპერატურაა, მაგრამ რკინა მაინც მყარია — წნევა ზედაპირზე ~3,6 მილიონჯერ მეტია და ლითონს დნობის საშუალებას არ აძლევს.",
  },
];

const T_TABLE: [number, number][] = [
  [0, 15],
  [35, 700],
  [100, 1300],
  [660, 1900],
  [2900, 3700],
  [2900.001, 4000],
  [5150, 5000],
  [EARTH_R_KM, 5400],
];
const P_TABLE: [number, number][] = [
  [0, 0.0001],
  [35, 1],
  [660, 24],
  [2900, 136],
  [5150, 330],
  [EARTH_R_KM, 364],
];

function lerpTable(t: [number, number][], x: number) {
  for (let i = 1; i < t.length; i++) {
    if (x <= t[i][0]) {
      const [x0, y0] = t[i - 1];
      const [x1, y1] = t[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return t[t.length - 1][1];
}

/** Approximate temperature (°C) at a depth (km). */
export const tempAt = (depth: number) => lerpTable(T_TABLE, depth);
/** Approximate pressure (gigapascals) at a depth (km). 1 GPa ≈ 10 000 atmospheres. */
export const pressureAt = (depth: number) => lerpTable(P_TABLE, depth);

export function layerAt(depth: number) {
  return LAYERS.find((l) => depth <= l.bottom) ?? LAYERS[LAYERS.length - 1];
}

/** Drawn radius (Earth radii) for a real depth (km). */
export function drawnRadius(depth: number) {
  const l = layerAt(depth);
  const k = (depth - l.top) / (l.bottom - l.top);
  return l.rTop + (l.rBottom - l.rTop) * k;
}
