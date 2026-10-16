"use client";

import { PLATE_BOUNDARIES } from "../earth/plates";
import { GEORGIA_OUTLINES } from "../georgia-outline";

/*
 * Small pictures the narration puts over the volcano cross-section when the voice speaks of something the section
 * cannot show: the world's plates and the Ring of Fire, the three kinds of plate boundary and a hot spot (animated
 * diagrams), the magnitude scale, the tsunami speed, and Georgia's volcanoes and earthquakes on a satellite map.
 */

export type VolcanoInset =
  | "world"
  | "ring"
  | "tsunamis"
  | "diverge"
  | "subduct"
  | "collide"
  | "transform"
  | "hotspot"
  | "magnitude"
  | "speed"
  | "georgia"
  | "ge-kazbegi"
  | "ge-javakheti"
  | "ge-borjomi"
  | "ge-plates"
  | "ge-racha";

const TITLES: Record<VolcanoInset, string> = {
  world: "ლითოსფეროს ფილების საზღვრები და ვულკანები",
  ring: "წყნარი ოკეანის „ცეცხლოვანი რგოლი“",
  tsunamis: "დიდი ცუნამები: 2004 და 2011",
  diverge: "ფილები შორდება — შუაოკეანური ქედი",
  subduct: "ფილები ეჯახება — სუბდუქცია",
  collide: "ფილები ეჯახება — მთები ჩნდება",
  transform: "ფილები გვერდიგვერდ სრიალებს",
  hotspot: "ცხელი წერტილი (ჰავაის კუნძულები)",
  magnitude: "მაგნიტუდა: +1 ≈ 32-ჯერ მეტი ენერგია",
  speed: "ცუნამის სიჩქარე: v = √(g·h)",
  georgia: "საქართველო: ვულკანური მთები",
  "ge-kazbegi": "ყაზბეგი — „მძინარე“ სტრატოვულკანი",
  "ge-javakheti": "ჯავახეთის ზეგანი — ჩამქრალი ვულკანები",
  "ge-borjomi": "ბორჯომის მინერალური წყალი",
  "ge-plates": "არაბეთისა და ევრაზიის ფილების შეხვედრა",
  "ge-racha": "რაჭის მიწისძვრა (1991, მაგნიტუდა 7,0)",
};

export function VolcanoInsetCard({ inset }: { inset: VolcanoInset }) {
  return (
    <figure className="pointer-events-none absolute top-14 right-3 z-10 w-[min(46%,23rem)] overflow-hidden rounded-xl bg-[#0d1726]/88 p-2 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm">
      <figcaption className="px-1 pb-1.5 text-[13px] leading-4 font-semibold">{TITLES[inset]}</figcaption>
      {inset === "world" || inset === "ring" || inset === "tsunamis" ? (
        <WorldMap mode={inset} />
      ) : inset === "georgia" || inset.startsWith("ge-") ? (
        <GeorgiaVolcanoes lit={inset} />
      ) : (
        <Diagram kind={inset} />
      )}
    </figure>
  );
}

// ---- The world, Pacific in the middle -----------------------------------------------------------------------------

/** Longitude unwrapped so the map runs 20°E → 380°E (the Pacific in the middle). */
const ux = (lon: number) => (lon < 20 ? lon + 360 : lon);

/** SVG paths of a line on the map, broken where it crosses the map's edge. */
function lines(path: [number, number][]) {
  const out: string[] = [];
  let d = "";
  let prev: number | null = null;
  for (const [lat, lon] of path) {
    const x = ux(lon);
    const jump = prev === null || Math.abs(x - prev) > 180;
    if (jump && d) out.push(d);
    d = `${jump ? "" : d}${jump ? "M" : "L"}${x.toFixed(1)} ${(-lat).toFixed(1)} `;
    prev = x;
  }
  if (d) out.push(d);
  return out;
}

const PLATE_PATHS = PLATE_BOUNDARIES.flatMap(lines);
/** Well-known volcanoes [lat, lon]. */
const VOLCANOES: [number, number][] = [
  [46.2, -122.2], [40.5, -121.5], [19, -98.6], [14.5, -90.9], [-0.7, -78.4], [-16.4, -71.4], [-39.4, -71.9], [58.3, -155], [56.1, 160.6], [35.4, 138.7],
  [15.1, 120.4], [13.3, 123.7], [-6.1, 105.4], [-7.5, 110.4], [-8.3, 118], [-39.3, 175.6], [-15.4, 167.8], [19.4, -155.3], [37.8, 15], [40.8, 14.4],
  [64, -19.7], [-3.1, 37.4], [43.4, 42.4], [42.7, 44.5], [39.7, 44.3], [44.4, -110.6],
];
const RING: [number, number][] = [
  [-46, -76], [-30, -72], [-18, -71], [-5, -81], [8, -84], [15, -95], [20, -105], [32, -117], [40, -124], [48, -125], [56, -135], [59, -150], [55, -160],
  [52, -175], [52, 170], [56, 162], [50, 157], [43, 147], [36, 141], [30, 142], [20, 145], [13, 145], [10, 126], [0, 125], [-6, 105], [-9, 115], [-9, 125],
  [-6, 148], [-10, 162], [-20, 172], [-30, -177], [-40, 176], [-46, 167],
];
const RING_PATH = RING.map(([lat, lon], i) => `${i ? "L" : "M"}${ux(lon)} ${-lat}`).join(" ");
const TSUNAMIS = [
  { lat: 3.3, lon: 95.9, text: "2004" },
  { lat: 38.3, lon: 142.4, text: "2011" },
];

function WorldMap({ mode }: { mode: "world" | "ring" | "tsunamis" }) {
  return (
    <svg viewBox="20 -75 360 150" className="block w-full rounded-lg" role="img" aria-label={TITLES[mode]}>
      <image href="/geo/earth-2k.jpg" x={-180} y={-90} width={360} height={180} preserveAspectRatio="none" />
      <image href="/geo/earth-2k.jpg" x={180} y={-90} width={360} height={180} preserveAspectRatio="none" />
      <rect x={20} y={-75} width={360} height={150} fill="#000" opacity={mode === "world" ? 0.12 : 0.3} />
      {PLATE_PATHS.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#ff7a45" strokeWidth={mode === "world" ? 1.3 : 0.8} opacity={mode === "world" ? 1 : 0.6} />
      ))}
      {mode === "ring" && (
        <path d={RING_PATH} fill="none" stroke="#ffb020" strokeWidth={5} strokeLinejoin="round" opacity={0.55} pathLength={100} strokeDasharray="100" strokeDashoffset="100">
          <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2.6s" fill="freeze" />
        </path>
      )}
      {mode !== "tsunamis" &&
        VOLCANOES.map(([lat, lon]) => (
          <path key={`${lat},${lon}`} d={`M${ux(lon)} ${-lat - 3.2} l2.8 4.6 h-5.6 z`} fill="#ff3b1f" stroke="#fff" strokeWidth={0.5} />
        ))}
      {mode === "tsunamis" &&
        TSUNAMIS.map((t) => (
          <g key={t.text}>
            {[0, 1].map((k) => (
              <circle key={k} cx={ux(t.lon)} cy={-t.lat} r={3} fill="none" stroke="#7fd1ff" strokeWidth={1.2}>
                <animate attributeName="r" values="3;22" dur="2.4s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0" dur="2.4s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
              </circle>
            ))}
            <circle cx={ux(t.lon)} cy={-t.lat} r={2.6} fill="#ffe14d" />
            <text x={ux(t.lon) + 4} y={-t.lat - 4} fontSize={11} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.4}>
              {t.text}
            </text>
          </g>
        ))}
    </svg>
  );
}

// ---- Georgia ----------------------------------------------------------------------------------------------------

/** The satellite picture covers lon 39.9–46.8, lat 43.7–40.95 (scripts/build-georgia-imagery.py). */
const gx = (lon: number) => (lon - 39.9) * 74;
const gy = (lat: number) => (43.7 - lat) * 100;
const GE_PATHS = Object.values(GEORGIA_OUTLINES).map((r) => r.map(([lon, lat], i) => `${i ? "L" : "M"}${gx(lon).toFixed(1)} ${gy(lat).toFixed(1)}`).join(" ") + "Z");
const GE_MARKS = [
  { id: "ge-kazbegi", lon: 44.518, lat: 42.697, text: "ყაზბეგი 5047 მ", kind: "volcano" },
  { id: "ge-javakheti", lon: 43.62, lat: 41.43, text: "დიდი აბული 3301 მ", kind: "volcano" },
  { id: "ge-javakheti", lon: 43.73, lat: 41.57, text: "სამსარი", kind: "volcano" },
  { id: "ge-borjomi", lon: 43.38, lat: 41.84, text: "ბორჯომი", kind: "water" },
  { id: "ge-racha", lon: 43.67, lat: 42.45, text: "რაჭა, 1991", kind: "quake" },
] as const;

function GeorgiaVolcanoes({ lit }: { lit: VolcanoInset }) {
  const all = lit === "georgia";
  return (
    <svg viewBox="0 0 511 275" className="block w-full rounded-lg" role="img" aria-label={TITLES[lit]}>
      <image href="/geo/georgia-satellite.jpg" x={0} y={0} width={511} height={275} preserveAspectRatio="none" />
      {GE_PATHS.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#fff" strokeWidth={1} opacity={0.55} />
      ))}
      {lit === "ge-javakheti" && (
        <ellipse cx={gx(43.6)} cy={gy(41.45)} rx={42} ry={24} fill="#ff8a2a" opacity={0.25} stroke="#ffb020" strokeWidth={1.5}>
          <animate attributeName="opacity" values="0.15;0.4;0.15" dur="1.6s" repeatCount="indefinite" />
        </ellipse>
      )}
      {lit === "ge-plates" && (
        <g>
          <path d="M255 268 V200" stroke="#ffd166" strokeWidth={6} markerEnd="url(#ge-arrow)" />
          <defs>
            <marker id="ge-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="#ffd166" />
            </marker>
          </defs>
          <text x={265} y={262} fontSize={14} fontWeight={700} fill="#ffd166" stroke="#000" strokeWidth={0.5}>
            არაბეთის ფილა ↑
          </text>
          <text x={16} y={22} fontSize={14} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.5}>
            ევრაზიის ფილა
          </text>
        </g>
      )}
      {GE_MARKS.map((m) => {
        const on = all || m.id === lit;
        const x = gx(m.lon);
        const y = gy(m.lat);
        return (
          <g key={m.text} opacity={on ? 1 : 0.45}>
            {m.id === lit && (
              <circle cx={x} cy={y} r={10} fill="none" stroke="#ffd76a" strokeWidth={2}>
                <animate attributeName="r" values="8;16;8" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}
            {m.kind === "volcano" ? (
              <path d={`M${x} ${y - 8} l7 11 h-14 z`} fill="#ff3b1f" stroke="#fff" strokeWidth={1} />
            ) : m.kind === "water" ? (
              <circle cx={x} cy={y} r={5.5} fill="#38a8ff" stroke="#fff" strokeWidth={1} />
            ) : (
              <path d={`M${x} ${y - 8} L${x + 2.5} ${y - 2.5} L${x + 8} ${y - 2} L${x + 4} ${y + 2} L${x + 5} ${y + 8} L${x} ${y + 5} L${x - 5} ${y + 8} L${x - 4} ${y + 2} L${x - 8} ${y - 2} L${x - 2.5} ${y - 2.5} z`} fill="#ffe600" stroke="#c00" strokeWidth={1} />
            )}
            {on && (
              <text x={x + 10} y={y + 4} fontSize={13} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.5}>
                {m.text}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ---- Diagrams -------------------------------------------------------------------------------------------------

const ROCK = "#7b8494";
const CRUST = "#a07850";
const MANTLE = "#e07a35";
const MAGMA = "#ff3b1f";
const SEA = "#2f7fc4";

function Arrow({ x, y, dir, color = "#fff" }: { x: number; y: number; dir: 1 | -1; color?: string }) {
  return <path d={`M${x} ${y} h${dir * 16} m${-dir * 5} -5 l${dir * 5} 5 l${-dir * 5} 5`} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />;
}

function Diagram({ kind }: { kind: VolcanoInset }) {
  return (
    <svg viewBox="0 0 240 130" className="block w-full rounded-lg bg-[#9fd0ef]" role="img" aria-label={TITLES[kind]}>
      {kind === "diverge" && (
        <g>
          <rect x={0} y={40} width={240} height={30} fill={SEA} />
          <rect x={0} y={78} width={240} height={52} fill={MANTLE} />
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0; -9 0" dur="2.4s" repeatCount="indefinite" />
            <path d="M-10 70 H108 L112 64 V78 H-10 z" fill={ROCK} />
          </g>
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0; 9 0" dur="2.4s" repeatCount="indefinite" />
            <path d="M250 70 H132 L128 64 V78 H250 z" fill={ROCK} />
          </g>
          {[0, 0.8, 1.6].map((b) => (
            <circle key={b} cx={120} r={5} fill={MAGMA}>
              <animate attributeName="cy" values="122;64" dur="2.4s" begin={`${b}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.3" dur="2.4s" begin={`${b}s`} repeatCount="indefinite" />
            </circle>
          ))}
          <path d="M112 62 L120 52 L128 62 z" fill="#5a3a2a" />
          <Arrow x={70} y={60} dir={-1} />
          <Arrow x={170} y={60} dir={1} />
          <text x={120} y={30} fontSize={10} fill="#0d1726" textAnchor="middle" fontWeight={700}>
            ახალი ქერქი ჩნდება
          </text>
        </g>
      )}
      {kind === "subduct" && (
        <g>
          <rect x={0} y={44} width={110} height={20} fill={SEA} />
          <rect x={0} y={64} width={240} height={66} fill={MANTLE} />
          <path d="M0 64 H100 L190 130 H160 L92 76 H0 z" fill={ROCK} />
          <path d="M104 64 L132 50 H240 V96 H170 Z" fill={CRUST} />
          <path d="M168 50 L180 30 L192 50 z" fill="#5a4a40" />
          <circle cx={150} cy={96} r={7} fill={MAGMA} opacity={0.8}>
            <animate attributeName="opacity" values="0.4;0.9;0.4" dur="1.4s" repeatCount="indefinite" />
          </circle>
          <circle r={4} fill="#fff">
            <animateMotion path="M20 70 H96 L176 128" dur="3s" repeatCount="indefinite" />
          </circle>
          <Arrow x={40} y={56} dir={1} />
          <Arrow x={220} y={60} dir={-1} />
          <text x={100} y={40} fontSize={10} fill="#0d1726" textAnchor="middle" fontWeight={700}>
            ღრმა ღარი ↓
          </text>
        </g>
      )}
      {kind === "collide" && (
        <g>
          <rect x={0} y={84} width={240} height={46} fill={MANTLE} />
          <path d="M0 70 H112 V100 H0 z" fill={CRUST} />
          <path d="M240 70 H128 V100 H240 z" fill={CRUST} />
          <path d="M84 70 L104 34 L120 50 L136 24 L156 70 z" fill="#6d5a48">
            <animate attributeName="d" values="M84 70 L104 64 L120 66 L136 62 L156 70 z;M84 70 L104 34 L120 50 L136 24 L156 70 z" dur="2.6s" repeatCount="indefinite" />
          </path>
          <path d="M126 31 L136 24 L144 38 z" fill="#fff" opacity={0.85}>
            <animate attributeName="opacity" values="0;0;0.85" dur="2.6s" repeatCount="indefinite" />
          </path>
          <Arrow x={30} y={85} dir={1} />
          <Arrow x={210} y={85} dir={-1} />
        </g>
      )}
      {kind === "transform" && (
        <g>
          <rect x={0} y={0} width={240} height={65} fill="#8fae6a" />
          <rect x={0} y={65} width={240} height={65} fill="#a3bd7d" />
          <line x1={0} y1={65} x2={240} y2={65} stroke="#5a3a2a" strokeWidth={2.5} strokeDasharray="6 3" />
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0; -24 0" dur="3s" repeatCount="indefinite" />
            <rect x={112} y={0} width={16} height={65} fill="#d9d2c0" />
          </g>
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0; 24 0" dur="3s" repeatCount="indefinite" />
            <rect x={112} y={65} width={16} height={65} fill="#d9d2c0" />
          </g>
          <Arrow x={60} y={32} dir={-1} color="#0d1726" />
          <Arrow x={180} y={98} dir={1} color="#0d1726" />
          <text x={232} y={14} fontSize={9} fill="#0d1726" textAnchor="end" fontWeight={700}>
            ზემოდან ხედი
          </text>
        </g>
      )}
      {kind === "hotspot" && (
        <g>
          <rect x={0} y={40} width={240} height={24} fill={SEA} />
          <rect x={0} y={74} width={240} height={56} fill={MANTLE} />
          <path d="M108 130 C110 104 114 90 112 74 H128 C126 90 130 104 132 130 z" fill={MAGMA} opacity={0.85}>
            <animate attributeName="opacity" values="0.6;1;0.6" dur="1.6s" repeatCount="indefinite" />
          </path>
          <g>
            <animateTransform attributeName="transform" type="translate" values="0 0; 40 0" dur="4s" repeatCount="indefinite" />
            <rect x={-60} y={64} width={360} height={10} fill={ROCK} />
            {/* Formed over the plume, carried off by the plate: the older, the further and the more worn. */}
            {[120, 160, 200, 240, 280].map((x, i) => (
              <path key={x} d={`M${x - 16 + i * 2} 64 L${x} ${38 + i * 6} L${x + 16 - i * 2} 64 z`} fill={i === 0 ? "#7a3a20" : "#4f6b3a"} />
            ))}
          </g>
          <Arrow x={180} y={86} dir={1} />
          <text x={120} y={18} fontSize={9} fill="#0d1726" textAnchor="middle" fontWeight={700}>
            ფილა მოძრაობს, ცხელი წერტილი — ადგილზე
          </text>
        </g>
      )}
      {kind === "magnitude" && (
        <g>
          <rect x={0} y={0} width={240} height={130} fill="#0d1726" />
          <text x={34} y={28} fontSize={14} fill="#fff" fontWeight={700} textAnchor="middle">
            M 6
          </text>
          <rect x={28} y={56} width={12} height={12} fill="#ffd166" />
          <text x={150} y={28} fontSize={14} fill="#fff" fontWeight={700} textAnchor="middle">
            M 7
          </text>
          {Array.from({ length: 32 }, (_, i) => (
            <rect key={i} x={98 + (i % 8) * 13} y={44 + Math.floor(i / 8) * 13} width={12} height={12} fill="#ff8a2a">
              <animate attributeName="opacity" values="0;1" dur="0.05s" begin={`${i * 0.05}s`} fill="freeze" />
            </rect>
          ))}
          <text x={120} y={120} fontSize={10} fill="#fff" textAnchor="middle">
            ერთი ერთეულით მეტი — ~32-ჯერ მეტი ენერგია
          </text>
        </g>
      )}
      {kind === "speed" && (
        <g>
          <rect x={0} y={0} width={240} height={130} fill="#0d1726" />
          <text x={120} y={30} fontSize={17} fill="#fff" fontWeight={700} textAnchor="middle">
            v = √(g · h)
          </text>
          <text x={12} y={62} fontSize={11} fill="#7fd1ff">
            ღია ოკეანე, h = 4000 მ
          </text>
          <text x={228} y={62} fontSize={12} fill="#fff" fontWeight={700} textAnchor="end">
            ≈ 713 კმ/სთ
          </text>
          <text x={12} y={90} fontSize={11} fill="#7fd1ff">
            წყალმარჩხი, h = 10 მ
          </text>
          <text x={228} y={90} fontSize={12} fill="#fff" fontWeight={700} textAnchor="end">
            ≈ 36 კმ/სთ
          </text>
          <text x={120} y={118} fontSize={9.5} fill="#cbd5e1" textAnchor="middle">
            g ≈ 9,8 მ/წმ² · h — ოკეანის სიღრმე
          </text>
        </g>
      )}
    </svg>
  );
}
