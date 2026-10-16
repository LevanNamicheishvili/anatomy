"use client";

import { useId } from "react";
import { SceneInset } from "./SceneInset";

/*
 * The navigators' instruments, drawn so a pupil sees what they look like and how they are used: the mariner's
 * astrolabe and the sextant (both measure how high a star stands above the horizon — that height is the latitude),
 * and the compass (north, and the azimuth measured from it). Brass and glass in plain SVG; the moving parts move.
 */

const D = Math.PI / 180;

function BrassGradient({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#fbe3a0" />
      <stop offset="0.45" stopColor="#d4a347" />
      <stop offset="1" stopColor="#8f5f17" />
    </linearGradient>
  );
}

/** A part's name with a thin line to it. */
function Tag({ x, y, tx, ty, text, anchor = "start" }: { x: number; y: number; tx: number; ty: number; text: string; anchor?: "start" | "end" | "middle" }) {
  return (
    <g>
      <line x1={x} y1={y} x2={tx} y2={ty} stroke="#e2e8f0" strokeWidth={0.7} opacity={0.8} />
      <circle cx={x} cy={y} r={1.6} fill="#fff" />
      <text x={tx + (anchor === "start" ? 2 : anchor === "end" ? -2 : 0)} y={ty + 3} fontSize={9} fill="#fff" fontWeight={700} textAnchor={anchor} stroke="#0d1726" strokeWidth={2.4} paintOrder="stroke">
        {text}
      </text>
    </g>
  );
}

/**
 * The sextant, arc down, its index arm swinging from 0 to `reading`. The arc spans 60° but is marked to 120°
 * (the mirrors double the angle), so the arm turns half the reading.
 */
export function Sextant({ reading = 42, x = 0, y = 0 }: { reading?: number; x?: number; y?: number }) {
  const brass = useId();
  const P = { x: 90, y: 22 };
  const R = 118;
  const pt = (deg: number, r: number) => [P.x + r * Math.cos(deg * D), P.y + r * Math.sin(deg * D)] as const;
  const at = (deg: number, r: number) => pt(deg, r).map((v) => v.toFixed(1)).join(" ");
  const arm = reading / 2 - 30; // rotation from straight down
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <BrassGradient id={brass} />
      </defs>
      {/* The wooden handle behind the frame. */}
      <rect x={146} y={40} width={16} height={62} rx={7} fill="#7a4a23" stroke="#4a2a10" transform="rotate(-12 154 71)" />
      {/* The frame: a 60° slice with cut-outs. */}
      <path d={`M${P.x} ${P.y} L${at(120, R + 6)} A${R + 6} ${R + 6} 0 0 0 ${at(60, R + 6)} Z`} fill={`url(#${brass})`} stroke="#6b4310" strokeWidth={1} />
      <path d={`M${at(66, 34)} L${at(66, R - 16)} A${R - 16} ${R - 16} 0 0 1 ${at(86, R - 16)} L${at(86, 34)} Z`} fill="#0d1726" opacity={0.92} />
      <path d={`M${at(94, 34)} L${at(94, R - 16)} A${R - 16} ${R - 16} 0 0 1 ${at(114, R - 16)} L${at(114, 34)} Z`} fill="#0d1726" opacity={0.92} />
      {/* The scale: 0 on the right, 120 on the left. */}
      <path d={`M${at(120, R - 2)} A${R - 2} ${R - 2} 0 0 0 ${at(60, R - 2)}`} fill="none" stroke="#f5f0e1" strokeWidth={9} />
      {Array.from({ length: 25 }, (_, i) => {
        const k = i * 5;
        const th = 60 + k / 2;
        const [x1, y1] = pt(th, R - 6.5);
        const [x2, y2] = pt(th, k % 30 === 0 ? R + 2.5 : R - 1);
        return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3b2a10" strokeWidth={k % 30 === 0 ? 1.1 : 0.6} />;
      })}
      {[0, 30, 60, 90, 120].map((k) => {
        const [tx, ty] = pt(60 + k / 2, R + 12);
        return (
          <text key={k} x={tx} y={ty + 3} fontSize={8} textAnchor="middle" fill="#fde68a" fontWeight={700}>
            {k}
          </text>
        );
      })}
      {/* The telescope, aimed at the horizon mirror. */}
      <rect x={92} y={66} width={62} height={10} rx={2} fill="#2b2f36" stroke="#9aa4b2" strokeWidth={0.8} />
      <rect x={152} y={64} width={10} height={14} rx={2} fill="#1d2127" stroke="#9aa4b2" strokeWidth={0.8} />
      {/* The horizon mirror: half silvered, half clear glass. */}
      <g transform={`rotate(-30 66 71)`}>
        <rect x={58} y={63} width={8} height={16} fill="#cfe3f0" stroke="#5b6b7c" />
        <rect x={66} y={63} width={8} height={16} fill="#9fd4ff" opacity={0.35} stroke="#5b6b7c" />
      </g>
      {/* Coloured shades against the sun's glare. */}
      {["#16a34a", "#2563eb", "#b91c1c"].map((c, i) => (
        <rect key={c} x={58 + i * 5} y={34 + i * 3} width={4} height={14} fill={c} opacity={0.55} transform={`rotate(-40 ${60 + i * 5} ${41 + i * 3})`} />
      ))}
      {/* The index arm with its mirror, swinging to the reading. */}
      <g>
        <animateTransform attributeName="transform" type="rotate" values={`-30 ${P.x} ${P.y}; ${arm} ${P.x} ${P.y}`} dur="2.2s" begin="0.3s" fill="freeze" />
        <path d={`M${P.x - 5} ${P.y} L${P.x - 3} ${P.y + R + 2} L${P.x + 3} ${P.y + R + 2} L${P.x + 5} ${P.y} Z`} fill={`url(#${brass})`} stroke="#6b4310" strokeWidth={0.8} />
        <rect x={P.x - 7} y={P.y + R - 6} width={14} height={11} rx={1.5} fill="#e7d9b0" stroke="#6b4310" />
        <line x1={P.x} y1={P.y + R - 6} x2={P.x} y2={P.y + R + 5} stroke="#b91c1c" strokeWidth={1.2} />
        <rect x={P.x - 12} y={P.y - 13} width={24} height={9} fill="#cfe3f0" stroke="#5b6b7c" />
        <circle cx={P.x} cy={P.y} r={4} fill="#8f5f17" stroke="#fde68a" />
      </g>
      <Tag x={P.x + 8} y={P.y - 9} tx={P.x + 34} ty={P.y - 12} text="სარკე" />
      <Tag x={124} y={71} tx={136} ty={92} text="ჭოგრიტი" />
      <Tag x={64} y={68} tx={22} ty={58} text="სარკე" anchor="end" />
      <Tag x={P.x - 2} y={P.y + 70} tx={44} ty={112} text="ისარი" anchor="end" />
    </g>
  );
}

/** The mariner's astrolabe hanging from its ring, the sighting rule turned to a star `angle` above the horizon. */
export function Astrolabe({ angle = 42, x = 0, y = 0 }: { angle?: number; x?: number; y?: number }) {
  const brass = useId();
  const C = { x: 60, y: 76 };
  const R = 50;
  const rule = -angle; // degrees, rotation from horizontal (up = negative in SVG)
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <BrassGradient id={brass} />
      </defs>
      {/* Hanging ring. */}
      <circle cx={C.x} cy={C.y - R - 13} r={7} fill="none" stroke={`url(#${brass})`} strokeWidth={3} />
      <rect x={C.x - 4} y={C.y - R - 8} width={8} height={9} rx={2} fill={`url(#${brass})`} />
      {/* The heavy ring and its cross (thicker at the bottom, so it hangs still in the wind). */}
      <circle cx={C.x} cy={C.y} r={R} fill="none" stroke={`url(#${brass})`} strokeWidth={9} />
      <rect x={C.x - 3.5} y={C.y - R} width={7} height={R * 2} fill={`url(#${brass})`} />
      <rect x={C.x - R} y={C.y - 3} width={R * 2} height={6} fill={`url(#${brass})`} />
      <path d={`M${C.x - R * 0.7} ${C.y + R * 0.7} A${R} ${R} 0 0 0 ${C.x + R * 0.7} ${C.y + R * 0.7} L${C.x} ${C.y + 6} Z`} fill={`url(#${brass})`} opacity={0.9} />
      {/* Degrees on the upper rim: 0 at the horizon, 90 straight up. */}
      {Array.from({ length: 19 }, (_, i) => {
        const a = (180 + i * 10) * D;
        const r1 = R - 4.5;
        const r2 = i % 3 === 0 ? R + 4.5 : R + 1.5;
        return <line key={i} x1={C.x + r1 * Math.cos(a)} y1={C.y + r1 * Math.sin(a)} x2={C.x + r2 * Math.cos(a)} y2={C.y + r2 * Math.sin(a)} stroke="#3b2a10" strokeWidth={0.8} />;
      })}
      {/* The sighting rule with its two pin-hole vanes, and the line of sight to the star. */}
      <line x1={C.x - 90 * Math.cos(angle * D)} y1={C.y + 90 * Math.sin(angle * D)} x2={C.x + 120 * Math.cos(angle * D)} y2={C.y - 120 * Math.sin(angle * D)} stroke="#ffd166" strokeWidth={0.9} strokeDasharray="3 3" opacity={0.8} />
      <g transform={`rotate(${rule} ${C.x} ${C.y})`}>
        <rect x={C.x - R + 4} y={C.y - 2.5} width={(R - 4) * 2} height={5} rx={1.5} fill="#5c3a0e" stroke="#fde68a" strokeWidth={0.6} />
        <rect x={C.x - R + 8} y={C.y - 9} width={4} height={18} fill="#5c3a0e" stroke="#fde68a" strokeWidth={0.6} />
        <rect x={C.x + R - 12} y={C.y - 9} width={4} height={18} fill="#5c3a0e" stroke="#fde68a" strokeWidth={0.6} />
      </g>
      <circle cx={C.x} cy={C.y} r={3} fill="#fde68a" />
      <text x={C.x + 112 * Math.cos(angle * D)} y={C.y - 112 * Math.sin(angle * D) + 4} fontSize={14} textAnchor="middle" fill="#ffd166">
        ★
      </text>
      <Tag x={C.x + 6} y={C.y - R - 14} tx={C.x + 26} ty={C.y - R - 18} text="საკიდი" />
      <Tag x={C.x + 26 * Math.cos(angle * D)} y={C.y - 26 * Math.sin(angle * D)} tx={C.x + 52} ty={C.y + 24} text="სამიზნე" />
      <Tag x={C.x - R * Math.cos(20 * D)} y={C.y - R * Math.sin(20 * D)} tx={C.x - R + 4} ty={C.y + R + 16} text="გრადუსები" />
    </g>
  );
}

/**
 * A compass: the needle always points north; with `az`, a yellow arrow points to a thing and the arc from north to
 * it, clockwise, is its azimuth.
 */
export function Compass({ az, x = 0, y = 0, r = 52 }: { az?: number; x?: number; y?: number; r?: number }) {
  const brass = useId();
  const C = { x: r + 10, y: r + 10 };
  const p = (deg: number, rr: number) => ({ x: C.x + rr * Math.sin(deg * D), y: C.y - rr * Math.cos(deg * D) });
  const arcEnd = az === undefined ? null : p(az, r * 0.62);
  return (
    <g transform={`translate(${x} ${y})`}>
      <defs>
        <BrassGradient id={brass} />
      </defs>
      <circle cx={C.x} cy={C.y} r={r + 6} fill={`url(#${brass})`} />
      <circle cx={C.x} cy={C.y} r={r} fill="#f5f0e1" />
      {Array.from({ length: 36 }, (_, i) => {
        const a = p(i * 10, r - (i % 9 === 0 ? 9 : 5));
        const b = p(i * 10, r - 1);
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#3b2a10" strokeWidth={i % 9 === 0 ? 1.4 : 0.7} />;
      })}
      {[
        { d: 0, t: "ჩ", c: "#c81e1e" },
        { d: 90, t: "აღმ", c: "#1f2937" },
        { d: 180, t: "ს", c: "#1f2937" },
        { d: 270, t: "დას", c: "#1f2937" },
      ].map((k) => {
        const q = p(k.d, r - 18);
        return (
          <text key={k.d} x={q.x} y={q.y + 4} fontSize={10} fontWeight={800} textAnchor="middle" fill={k.c}>
            {k.t}
          </text>
        );
      })}
      {az !== undefined && arcEnd && (
        <g>
          <path d={`M${C.x} ${C.y - r * 0.62} A${r * 0.62} ${r * 0.62} 0 ${az > 180 ? 1 : 0} 1 ${arcEnd.x} ${arcEnd.y}`} fill="none" stroke="#e09f00" strokeWidth={3} />
          <line x1={C.x} y1={C.y} x2={p(az, r - 4).x} y2={p(az, r - 4).y} stroke="#e09f00" strokeWidth={3.5} strokeLinecap="round" />
          <circle cx={p(az, r - 4).x} cy={p(az, r - 4).y} r={4} fill="#e09f00" />
          <text x={p(az / 2, r * 0.36).x} y={p(az / 2, r * 0.36).y + 4} fontSize={11} fontWeight={800} textAnchor="middle" fill="#8a5a00">
            {Math.round(az)}°
          </text>
        </g>
      )}
      {/* The needle: red end north. */}
      <g>
        <animateTransform attributeName="transform" type="rotate" values={`28 ${C.x} ${C.y}; -9 ${C.x} ${C.y}; 4 ${C.x} ${C.y}; 0 ${C.x} ${C.y}`} dur="1.8s" fill="freeze" />
        <path d={`M${C.x} ${C.y - r + 12} L${C.x + 5} ${C.y} L${C.x - 5} ${C.y} Z`} fill="#d62828" />
        <path d={`M${C.x} ${C.y + r - 12} L${C.x + 5} ${C.y} L${C.x - 5} ${C.y} Z`} fill="#e5e7eb" stroke="#9ca3af" strokeWidth={0.5} />
      </g>
      <circle cx={C.x} cy={C.y} r={3} fill="#3b2a10" />
    </g>
  );
}

export type InstrumentsKind = "star-height" | "tools" | "azimuth";

const TITLES: Record<InstrumentsKind, string> = {
  "star-height": "ასტროლაბია და სექსტანტი: ვარსკვლავის სიმაღლის საზომი",
  tools: "მეზღვაურების ხელსაწყოები: კომპასი და ასტროლაბია",
  azimuth: "აზიმუტი კომპასით",
};

const NOTES: Record<InstrumentsKind, string> = {
  "star-height": "ორივეთი ზომავდნენ, რა სიმაღლეზეა ვარსკვლავი ჰორიზონტის ზემოთ. სექსტანტში ისარს ატრიალებენ, სანამ სარკეში ვარსკვლავი ჰორიზონტზე „დაჯდება“, და შკალაზე კუთხეს კითხულობენ: პოლარული 42°-ზე — განედიც 42°-ია.",
  tools: "კომპასის ისარი ყოველთვის ჩრდილოეთს აჩვენებს — ასე იგებდნენ, საით მიცურავს გემი. ასტროლაბიით ვარსკვლავის სიმაღლეს ზომავდნენ — ეს განედია, ანუ რამდენად ჩრდილოეთით ან სამხრეთით არის გემი.",
  azimuth: "ისარი ჩრდილოეთზეა (0°). საგნისკენ კუთხეს ვითვლით საათის ისრის მიმართულებით — აქ 60°.",
};

export function InstrumentsCard({ kind }: { kind: InstrumentsKind }) {
  return (
    <SceneInset title={TITLES[kind]} wide={kind !== "azimuth"}>
      {kind === "star-height" && (
        <svg viewBox="0 0 320 168" className="block w-full" role="img" aria-label={TITLES[kind]}>
          <Astrolabe x={6} y={10} />
          <Sextant x={128} y={4} />
        </svg>
      )}
      {kind === "tools" && (
        <svg viewBox="0 0 320 184" className="block w-full" role="img" aria-label={TITLES[kind]}>
          <Compass x={14} y={22} />
          <text x={76} y={176} fontSize={12} fontWeight={800} fill="#fde68a" textAnchor="middle">
            კომპასი
          </text>
          <Astrolabe x={170} y={10} />
          <text x={250} y={176} fontSize={12} fontWeight={800} fill="#fde68a" textAnchor="middle">
            ასტროლაბია
          </text>
        </svg>
      )}
      {kind === "azimuth" && (
        <svg viewBox="0 0 124 124" className="mx-auto block w-1/2" role="img" aria-label={TITLES[kind]}>
          <Compass az={60} />
        </svg>
      )}
      <p className="px-1 pt-1.5 text-[12px] leading-4 text-white/85">{NOTES[kind]}</p>
    </SceneInset>
  );
}
