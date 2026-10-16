"use client";

import { GEORGIA_OUTLINES } from "../georgia-outline";
import { RIVER_LINES } from "./river-lines";

/*
 * Rivers for the narration of the oceans lesson: Georgia from space with its main rivers, water running down them
 * from source to mouth. The voice's words light up the part they name: the source, the mouth, the tributaries, the
 * basins of the Black and the Caspian seas (split along the Likhi range), the Mtkvari, the Rioni; and a delta.
 */

export type RiverMode = "map" | "source" | "mouth" | "tributaries" | "system" | "basins" | "mtkvari" | "rioni" | "delta";

/** The satellite picture covers lon 39.9–46.8, lat 43.7–40.95 (scripts/build-georgia-imagery.py). */
const gx = (lon: number) => (lon - 39.9) * 74;
const gy = (lat: number) => (43.7 - lat) * 100;
const path = (pts: [number, number][]) => pts.map(([lon, lat], i) => `${i ? "L" : "M"}${gx(lon).toFixed(1)} ${gy(lat).toFixed(1)}`).join(" ");
const OUTLINES = Object.values(GEORGIA_OUTLINES).map((r) => `${path(r)}Z`);
const RIONI_TRIBS = ["tskhenistskali", "kvirila"];
const MTKVARI_TRIBS = ["aragvi", "liakhvi", "ksani", "khrami", "alazani", "iori"];
/** The Likhi range, roughly: the watershed between the Black Sea and the Caspian. */
const LIKHI: [number, number][] = [
  [43.75, 42.55],
  [43.62, 42.2],
  [43.55, 41.95],
  [43.4, 41.75],
  [43.2, 41.5],
];

const TITLES: Record<RiverMode, string> = {
  map: "საქართველოს მდინარეები",
  source: "სათავე — სადაც მდინარე იწყება",
  mouth: "შესართავი — სადაც მდინარე ზღვას ერთვის",
  tributaries: "შენაკადები — მდინარეში ჩამდინარე მდინარეები",
  system: "მდინარეთა სისტემა: მთავარი მდინარე და შენაკადები",
  basins: "აუზები: შავი ზღვისა და კასპიის ზღვის",
  mtkvari: "მტკვარი — უგრძესი (1364 კმ), კასპიის ზღვის აუზი",
  rioni: "რიონი — ყველაზე წყალუხვი, შავი ზღვის აუზი",
  delta: "დელტა — მდინარის ნატანი შესართავთან",
};

function River({ id, on, dim, width = 2.2 }: { id: string; on: boolean; dim: boolean; width?: number }) {
  const d = path(RIVER_LINES[id]);
  return (
    <g opacity={dim ? 0.35 : 1}>
      <path d={d} fill="none" stroke={on ? "#5ec8ff" : "#3a8ee6"} strokeWidth={on ? width + 1.6 : width} strokeLinecap="round" strokeLinejoin="round" />
      {on && (
        <path d={d} fill="none" stroke="#e8f8ff" strokeWidth={width * 0.7} strokeDasharray="4 10" strokeLinecap="round">
          <animate attributeName="stroke-dashoffset" from="28" to="0" dur="0.9s" repeatCount="indefinite" />
        </path>
      )}
    </g>
  );
}

function Mark({ lon, lat, text, color, below }: { lon: number; lat: number; text: string; color: string; below?: boolean }) {
  const x = gx(lon);
  const y = gy(lat);
  return (
    <g>
      <circle cx={x} cy={y} r={7} fill="none" stroke={color} strokeWidth={2.5}>
        <animate attributeName="r" values="6;14;6" dur="1.4s" repeatCount="indefinite" />
      </circle>
      <circle cx={x} cy={y} r={4} fill={color} />
      <text x={x} y={below ? y + 24 : y - 14} fontSize={15} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.6} textAnchor="middle">
        {text}
      </text>
    </g>
  );
}

export function RiverPanel({ mode }: { mode: RiverMode }) {
  if (mode === "delta") return <Delta />;
  const rioniOn = ["source", "mouth", "tributaries", "system", "rioni"].includes(mode);
  const mtkvariOn = mode === "mtkvari";
  const tribsOn = mode === "tributaries" || mode === "system";
  const focus = mode !== "map" && mode !== "basins";
  const rioni = RIVER_LINES.rioni;
  const mtkvari = RIVER_LINES.mtkvari;
  return (
    <div className="flex size-full flex-col bg-[#0d1726]">
      <p className="px-4 pt-3 pb-2 text-center text-[15px] font-semibold text-white">{TITLES[mode]}</p>
      <svg viewBox="0 0 511 275" className="min-h-0 w-full flex-1" preserveAspectRatio="xMidYMid meet" role="img" aria-label={TITLES[mode]}>
        <image href="/geo/georgia-satellite.jpg" x={0} y={0} width={511} height={275} preserveAspectRatio="none" />
        {OUTLINES.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#fff" strokeWidth={0.8} opacity={0.4} />
        ))}
        {mode === "basins" && (
          <g>
            <path d={`M0 0 H${gx(43.7)} L${path(LIKHI).slice(1)} L${gx(43.1)} 275 H0 z`} fill="#38a8ff" opacity={0.22} />
            <path d={`M${gx(43.7)} 0 H511 V275 H${gx(43.1)} L${path([...LIKHI].reverse()).slice(1)} z`} fill="#ffb020" opacity={0.2} />
            <path d={path(LIKHI)} fill="none" stroke="#fff" strokeWidth={2} strokeDasharray="6 4" />
            <text x={70} y={250} fontSize={16} fontWeight={700} fill="#bfe6ff" stroke="#000" strokeWidth={0.5}>
              შავი ზღვის აუზი
            </text>
            <text x={330} y={250} fontSize={16} fontWeight={700} fill="#ffd27a" stroke="#000" strokeWidth={0.5}>
              კასპიის ზღვის აუზი →
            </text>
            <text x={gx(43.62) + 6} y={gy(42.2)} fontSize={11} fill="#fff" stroke="#000" strokeWidth={0.4}>
              ლიხის ქედი — წყალგამყოფი
            </text>
          </g>
        )}
        {MTKVARI_TRIBS.map((id) => (
          <River key={id} id={id} on={false} dim={focus && !mtkvariOn} width={1.4} />
        ))}
        {RIONI_TRIBS.map((id) => (
          <River key={id} id={id} on={tribsOn} dim={focus && !rioniOn} width={1.4} />
        ))}
        <River id="enguri" on={false} dim={focus} width={1.4} />
        <River id="mtkvari" on={mtkvariOn || mode === "basins"} dim={focus && !mtkvariOn} width={2.6} />
        <River id="rioni" on={rioniOn || mode === "basins"} dim={focus && !rioniOn} width={2.6} />
        {mode === "source" && <Mark lon={rioni[0][0]} lat={rioni[0][1]} text="სათავე (მყინვარი)" color="#ffffff" below />}
        {(mode === "mouth" || mode === "rioni") && <Mark lon={rioni[rioni.length - 1][0]} lat={rioni[rioni.length - 1][1]} text="შესართავი · ფოთი" color="#ffd76a" />}
        {mode === "tributaries" &&
          RIONI_TRIBS.map((id) => {
            const r = RIVER_LINES[id];
            const [lon, lat] = r[Math.floor(r.length / 2)];
            return <Mark key={id} lon={lon} lat={lat} text={id === "kvirila" ? "ყვირილა" : "ცხენისწყალი"} color="#5ec8ff" />;
          })}
        {mode === "mtkvari" && (
          <g>
            <Mark lon={44.79} lat={41.69} text="თბილისი" color="#ffd76a" below />
            <text x={500} y={gy(mtkvari[mtkvari.length - 1][1]) - 10} fontSize={14} fontWeight={700} fill="#ffd27a" stroke="#000" strokeWidth={0.5} textAnchor="end">
              → კასპიის ზღვამდე
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

/** A delta: the river slows at the sea, drops its silt and splits into arms; the land grows into the sea. */
function Delta() {
  return (
    <div className="flex size-full flex-col bg-[#0d1726]">
      <p className="px-4 pt-3 pb-2 text-center text-[15px] font-semibold text-white">{TITLES.delta}</p>
      <svg viewBox="0 0 400 220" className="min-h-0 w-full flex-1" role="img" aria-label={TITLES.delta}>
        <rect x={0} y={0} width={400} height={220} fill="#2f7fc4" />
        <path d="M0 0 H400 V70 C330 80 300 110 250 120 C200 130 150 112 100 92 C60 78 30 70 0 70 z" fill="#7a9a4a" />
        <path d="M150 112 C190 150 230 160 250 120 C270 160 300 150 330 100" fill="#b39a6a">
          <animate attributeName="d" values="M150 112 C190 120 230 125 250 120 C270 125 300 118 330 100;M150 112 C190 150 230 160 250 120 C270 160 300 150 330 100" dur="5s" repeatCount="indefinite" />
        </path>
        {["M200 0 C205 40 230 80 245 118 L200 150", "M245 118 L250 165", "M245 118 L305 150"].map((d) => (
          <g key={d}>
            <path d={d} fill="none" stroke="#5ec8ff" strokeWidth={5} strokeLinecap="round" />
            <path d={d} fill="none" stroke="#e8f8ff" strokeWidth={2} strokeDasharray="4 9">
              <animate attributeName="stroke-dashoffset" from="26" to="0" dur="0.9s" repeatCount="indefinite" />
            </path>
          </g>
        ))}
        <text x={212} y={30} fontSize={13} fontWeight={700} fill="#fff">
          მდინარე
        </text>
        <text x={330} y={190} fontSize={13} fontWeight={700} fill="#fff" textAnchor="end">
          ნატანი (ქვიშა, თიხა) → ახალი ხმელეთი
        </text>
        <text x={20} y={200} fontSize={13} fontWeight={700} fill="#bfe6ff">
          ზღვა
        </text>
      </svg>
    </div>
  );
}
