"use client";

import { useId } from "react";
import { SceneInset } from "./SceneInset";

/*
 * Why a high sun heats more, in plain words and no formulas: the same five sunbeams fall on the ground. When the sun
 * is high they come down almost straight and light a small patch brightly — hot. When it is low they come in slanted
 * and the same light spreads over a long patch — dim and cool. Two pictures side by side (summer and winter noon in
 * Tbilisi by default); the one the voice speaks of is lit up.
 */

const W = 150;
const H = 118;
const GROUND = 92;
const TOP = 24;

export interface SunPanel {
  /** Height of the sun above the horizon, degrees. */
  alt: number;
  title: string;
  note: string;
}

function Panel({ p, x, on, ground }: { p: SunPanel; x: number; on: boolean; ground: string }) {
  const clip = useId();
  const a = (p.alt * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  // Five parallel beams 9 px apart across the bundle; along the ground they lie 9 / sin(height) apart.
  const across = 9 / dy;
  // The lit patch sits right of the middle when the sun is low, so the slanted beams fit in.
  const mid = x + W / 2 + 26 * (1 - dy);
  const beams = [-2, -1, 0, 1, 2].map((k) => ({ x1: mid + k * across - dx * 220, y1: GROUND - dy * 220, x2: mid + k * across, y2: GROUND }));
  // The sun on the middle beam, where it meets the panel's left edge or its top.
  const t = Math.min((mid - (x + 14)) / Math.max(dx, 1e-3), (GROUND - (TOP + 8)) / dy);
  const half = 2 * across + 3;
  return (
    <g opacity={on ? 1 : 0.55}>
      <defs>
        <clipPath id={clip}>
          <rect x={x + 3} y={TOP} width={W - 6} height={GROUND - TOP} />
        </clipPath>
      </defs>
      <rect x={x + 2} y={2} width={W - 4} height={H - 4} rx={8} fill={on ? "#16243a" : "#111b2b"} stroke={on ? "#ffd166" : "#2b3a52"} strokeWidth={on ? 2 : 1} />
      <text x={x + W / 2} y={16} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#fff">
        {p.title}
      </text>
      <g clipPath={`url(#${clip})`}>
        {beams.map((b, i) => (
          <line key={i} {...b} stroke="#ffd84d" strokeWidth={1.6} strokeDasharray="5 3">
            <animate attributeName="stroke-dashoffset" values="16;0" dur="0.6s" repeatCount="indefinite" />
          </line>
        ))}
      </g>
      <circle cx={mid - dx * t} cy={GROUND - dy * t} r={7} fill="#ffd84d" stroke="#fff3b0" strokeWidth={1.5} />
      <line x1={x + 8} y1={GROUND} x2={x + W - 8} y2={GROUND} stroke={ground} strokeWidth={3} />
      {/* The lit patch: the same light, small and bright or long and pale. */}
      <rect x={mid - half} y={GROUND - 2.5} width={half * 2} height={5} rx={2.5} fill={`rgb(255 ${Math.round(110 + 110 * (1 - dy))} 60)`} opacity={0.35 + 0.65 * dy} />
      <text x={x + W / 2} y={GROUND + 16} textAnchor="middle" fontSize={10} fill={dy > 0.7 ? "#ffb4a2" : "#a5d8ff"} fontWeight={700}>
        {p.note}
      </text>
    </g>
  );
}

const HIGH: SunPanel = { alt: 72, title: "ზაფხული: მზე მაღლაა", note: "სხივი პირდაპირ → ცხელა" };
const LOW: SunPanel = { alt: 25, title: "ზამთარი: მზე დაბლაა", note: "სხივი ირიბად → გრილა" };

export function SunAngleCard({
  lit,
  title = "რატომ ცხელა ზაფხულში და გრილა ზამთარში",
  high = HIGH,
  low = LOW,
  note = "ერთი და იგივე სინათლე: პირდაპირი სხივი პატარა ადგილს ძლიერად ათბობს, ირიბი კი დიდ ადგილზე იშლება და სუსტად ათბობს.",
  ground = "#6b8f4e",
}: {
  lit: "high" | "low" | null;
  title?: string;
  high?: SunPanel;
  low?: SunPanel;
  note?: string;
  /** The surface the light falls on: the ground (green) or a solar panel (blue). */
  ground?: string;
}) {
  return (
    <SceneInset title={title}>
      <svg viewBox={`0 0 ${W * 2} ${H}`} className="block w-full" role="img" aria-label={title}>
        <Panel p={high} x={0} on={lit !== "low"} ground={ground} />
        <Panel p={low} x={W} on={lit !== "high"} ground={ground} />
      </svg>
      <p className="px-1 pt-1.5 text-[12px] leading-4 text-white/85">{note}</p>
    </SceneInset>
  );
}
