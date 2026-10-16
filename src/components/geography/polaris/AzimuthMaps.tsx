"use client";

import { VOYAGES } from "../discoveries/voyages-data";
import { GEORGIA_OUTLINES } from "../georgia-outline";
import { SceneInset } from "../lesson/SceneInset";
import { bearing, compassName, TARGETS, TBILISI } from "./sky-data";

/*
 * The azimuth on real maps. Georgia from above (the satellite picture): from Tbilisi a red line points north, and a
 * line to the town the voice names, with the angle swept clockwise from north and its degrees — Kazbegi almost
 * straight north (~353°), Telavi north-east (~68°), Batumi west (~269°). And a route told by azimuths: Vasco da Gama
 * sailed south (~180°) down the Atlantic, and from Malindi turned north-east (~67°) across the Indian Ocean to India.
 * Both maps keep east–west distances to scale with north–south ones, so the angles drawn are the true ones.
 */

// ---- Georgia --------------------------------------------------------------------------------------------------------

/** The satellite picture covers lon 39.9–46.8, lat 43.7–40.95 (scripts/build-georgia-imagery.py). */
const gx = (lon: number) => (lon - 39.9) * 74;
const gy = (lat: number) => (43.7 - lat) * 100;
const GE_PATHS = Object.values(GEORGIA_OUTLINES).map((r) => r.map(([lon, lat], i) => `${i ? "L" : "M"}${gx(lon).toFixed(1)} ${gy(lat).toFixed(1)}`).join(" ") + "Z");
const D = Math.PI / 180;

/** An arc from north, clockwise, to azimuth `az` (degrees) round (x, y). */
function azArc(x: number, y: number, r: number, az: number) {
  const ex = x + r * Math.sin(az * D);
  const ey = y - r * Math.cos(az * D);
  return `M${x} ${y - r} A${r} ${r} 0 ${az > 180 ? 1 : 0} 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}

export function GeorgiaAzimuthCard({ place }: { place: string | null }) {
  const tx = gx(TBILISI.lon);
  const ty = gy(TBILISI.lat);
  const target = TARGETS.find((t) => t.name === place) ?? null;
  const az = target ? bearing(TBILISI, target) : null;
  return (
    <SceneInset title={target && az !== null ? `თბილისიდან ${target.name}: აზიმუტი ${Math.round(az)}°` : "აზიმუტი თბილისიდან"} wide>
      <svg viewBox="0 0 511 275" className="block w-full rounded-lg" role="img" aria-label="საქართველოს რუკა: აზიმუტები თბილისიდან">
        <image href="/geo/georgia-satellite.jpg" x={0} y={0} width={511} height={275} preserveAspectRatio="none" />
        <rect width={511} height={275} fill="#000" opacity={0.18} />
        {GE_PATHS.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="#fff" strokeWidth={1} opacity={0.5} />
        ))}
        {/* North from Tbilisi. */}
        <line x1={tx} y1={ty} x2={tx} y2={14} stroke="#ff4d4d" strokeWidth={3} />
        <path d={`M${tx} 6 l7 13 h-14 z`} fill="#ff4d4d" />
        <text x={tx + 10} y={20} fontSize={15} fontWeight={800} fill="#fff" stroke="#000" strokeWidth={0.6}>
          ჩ — 0°
        </text>
        {/* Every town; the one the voice names lit, with its angle drawn. */}
        {TARGETS.map((t) => {
          const on = t === target;
          const x = gx(t.lon);
          const y = gy(t.lat);
          return (
            <g key={t.name} opacity={on ? 1 : 0.55}>
              <line x1={tx} y1={ty} x2={x} y2={y} stroke={on ? "#ffd166" : "#fff"} strokeWidth={on ? 3 : 1.4} strokeDasharray={on ? undefined : "5 4"} />
              <circle cx={x} cy={y} r={on ? 6 : 4.5} fill={on ? "#ffd166" : "#fff"} stroke="#000" strokeWidth={0.8} />
              <text x={x + (t.lon < 42.5 ? 8 : 9)} y={y - 8} fontSize={on ? 16 : 13} fontWeight={800} fill="#fff" stroke="#000" strokeWidth={0.6}>
                {t.name}
              </text>
            </g>
          );
        })}
        {target && az !== null && (
          <g key={target.name}>
            <path d={azArc(tx, ty, 58, az)} fill="none" stroke="#ffd166" strokeWidth={6} pathLength={100} strokeDasharray="100" strokeDashoffset="100">
              <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.4s" fill="freeze" />
            </path>
            <rect x={10} y={10} width={196} height={50} rx={8} fill="#0d1726" opacity={0.88} />
            <text x={108} y={33} fontSize={20} fontWeight={800} textAnchor="middle" fill="#ffd166">
              აზიმუტი {Math.round(az)}°
            </text>
            <text x={108} y={51} fontSize={13} textAnchor="middle" fill="#fff">
              {target.name}: {compassName(az)}
            </text>
          </g>
        )}
        <circle cx={tx} cy={ty} r={7} fill="#ff3b30" stroke="#fff" strokeWidth={2} />
        <text x={tx - 10} y={ty + 5} fontSize={14} fontWeight={800} textAnchor="end" fill="#fff" stroke="#000" strokeWidth={0.6}>
          თბილისი
        </text>
      </svg>
    </SceneInset>
  );
}

// ---- Vasco da Gama's course -----------------------------------------------------------------------------------------

/** The map: lon −45…90, lat 45…−40, east–west shrunk by the cosine of 5°S (the route's middle) so angles stay true. */
const W0 = -45;
const N0 = 45;
const KX = Math.cos(5 * D);
const vx = (lon: number) => (lon - W0) * KX * 4;
const vy = (lat: number) => (N0 - lat) * 4;
const GAMA = VOYAGES.find((v) => v.id === "gama")!;
const ROUTE = GAMA.stops.map((s, i) => `${i ? "L" : "M"}${vx(s.lon).toFixed(1)} ${vy(s.lat).toFixed(1)}`).join(" ");
const stop = (name: string) => GAMA.stops.find((s) => s.name?.startsWith(name))!;
/** The two legs the lesson names: south down the Atlantic, then from Malindi across the ocean to Calicut. */
const LEGS = [
  { from: stop("მწვანე კონცხის"), to: GAMA.stops[3], az: 180, text: "ჯერ სამხრეთით" },
  { from: stop("მალინდი"), to: stop("კალიკუტი"), az: Math.round(bearing(stop("მალინდი"), stop("კალიკუტი"))), text: "მერე ჩრდილო-აღმოსავლეთით" },
];

export function GamaAzimuthCard() {
  const w = vx(90);
  const h = vy(-40);
  return (
    <SceneInset title="მარშრუტი აზიმუტებით: ვასკო და გამა ინდოეთისკენ" wide>
      <svg viewBox={`0 0 ${w.toFixed(0)} ${h}`} className="block w-full rounded-lg" role="img" aria-label="ვასკო და გამას მარშრუტი და მისი აზიმუტები">
        {/* The world picture, cut and squeezed to the map's frame. */}
        <svg x={0} y={0} width={w} height={h} viewBox={`${W0 + 180} ${90 - N0} ${90 - W0} 85`} preserveAspectRatio="none">
          <image href="/geo/earth-2k.jpg" x={0} y={0} width={360} height={180} preserveAspectRatio="none" />
        </svg>
        <rect width={w} height={h} fill="#000" opacity={0.2} />
        <path d={ROUTE} fill="none" stroke="#22c55e" strokeWidth={3} strokeLinejoin="round" pathLength={100} strokeDasharray="100" strokeDashoffset="100">
          <animate attributeName="stroke-dashoffset" from="100" to="0" dur="2.6s" fill="freeze" />
        </path>
        {LEGS.map((l, i) => {
          // A compass at the leg's middle: north up, the course arrow, the angle between.
          const x = (vx(l.from.lon) + vx(l.to.lon)) / 2;
          const y = (vy(l.from.lat) + vy(l.to.lat)) / 2;
          const r = 30;
          return (
            <g key={l.text} opacity={0}>
              <animate attributeName="opacity" from="0" to="1" dur="0.5s" begin={`${1 + i * 1.3}s`} fill="freeze" />
              <circle cx={x} cy={y} r={r + 4} fill="#0d1726" opacity={0.75} />
              <line x1={x} y1={y} x2={x} y2={y - r} stroke="#ff4d4d" strokeWidth={2.5} />
              <text x={x} y={y - r - 6} fontSize={10} fontWeight={800} textAnchor="middle" fill="#ff8080">
                ჩ
              </text>
              <path d={azArc(x, y, r * 0.6, l.az)} fill="none" stroke="#ffd166" strokeWidth={2.5} />
              <line x1={x} y1={y} x2={x + r * Math.sin(l.az * D)} y2={y - r * Math.cos(l.az * D)} stroke="#ffd166" strokeWidth={3} strokeLinecap="round" />
              <text x={x} y={y + r + 22} fontSize={17} fontWeight={800} textAnchor="middle" fill="#ffd166" stroke="#000" strokeWidth={0.5}>
                ≈ {l.az}°
              </text>
              <text x={x} y={y + r + 38} fontSize={13} fontWeight={700} textAnchor="middle" fill="#fff" stroke="#000" strokeWidth={0.4}>
                {l.text}
              </text>
            </g>
          );
        })}
        {[stop("ლისაბონი"), stop("კეთილი"), stop("მალინდი"), stop("კალიკუტი")].map((s) => (
          <g key={s.name}>
            <circle cx={vx(s.lon)} cy={vy(s.lat)} r={3.5} fill="#22c55e" stroke="#fff" strokeWidth={1} />
            <text x={vx(s.lon) + 5} y={vy(s.lat) - 5} fontSize={12} fontWeight={700} fill="#fff" stroke="#000" strokeWidth={0.4}>
              {s.name!.split(" (")[0]}
            </text>
          </g>
        ))}
      </svg>
      <p className="px-1 pt-1.5 text-[12px] leading-4 text-white/85">მეზღვაური აზიმუტით მიდის: ჯერ ~180°-ით (სამხრეთით) აფრიკის გარშემო, მალინდიდან კი კურსი ~{LEGS[1].az}°-ზე შეცვალა და ინდოეთს მიადგა.</p>
    </SceneInset>
  );
}
