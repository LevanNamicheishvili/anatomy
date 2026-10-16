"use client";

import { cn } from "@/lib/utils";
import { landslideFS } from "./slope-math";

/*
 * What holds a slope, drawn for the narration: a block of ground on a slope, the pull of its weight down the
 * slope (red) and what holds it (green: friction, the grip of the soil, roots). The arrows follow the same model
 * as the slope simulation (slope-math.ts): a steeper slope pulls harder, water and fresh snow add weight and make
 * the ground slip, roots hold it. When the pull wins, the block slides.
 */

export type ForceEmph = "pull" | "hold" | null;

const D = Math.PI / 180;
const X0 = 60;
const Y0 = 250;
const RUN = 330;

export function SlopeForces({ angle, water, snow, roots, push, emph }: { angle: number; water: number; snow: number; roots: boolean; push: boolean; emph: ForceEmph }) {
  const t = angle * D;
  const top = Y0 - RUN * Math.tan(t);
  const load = 1 + snow / 100;
  const fs = landslideFS({ angle, water, snow, forest: roots }) * (snow ? 1 / (1 + snow / 300) : 1);
  const slides = fs < 1;
  const pull = 70 * Math.sin(t) * load + 18;
  const hold = Math.min(pull * Math.min(fs, 1.7), 150);
  // The block sits halfway up; its centre, the slope's direction (down the slope) and the normal.
  const along = 0.55;
  const bx = X0 + RUN * along;
  const by = Y0 - RUN * along * Math.tan(t);
  const down = { x: -Math.cos(t), y: Math.sin(t) };
  const slide = slides ? 120 : 0;
  const arrow = (len: number, dir: { x: number; y: number }) => `M0 0 L${dir.x * len} ${dir.y * len}`;
  return (
    <svg viewBox="0 0 440 280" className="size-full bg-[linear-gradient(#cfe6f7,#eef6fb)]" role="img" aria-label="ფერდობის ძალები">
      <defs>
        {(["#d62828", "#2a9d3f", "#334155"] as const).map((c) => (
          <marker key={c} id={`head-${c.slice(1)}`} viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={c} />
          </marker>
        ))}
      </defs>
      <path d={`M${X0} ${Y0} L${X0 + RUN} ${top} L${X0 + RUN} ${Y0 + 30} L${X0 - 40} ${Y0 + 30} L${X0 - 40} ${Y0} z`} fill="#8a6a4a" />
      <path d={`M${X0} ${Y0} L${X0 + RUN} ${top}`} stroke="#5f8a3e" strokeWidth={6} />
      {roots &&
        [0.25, 0.42, 0.72, 0.88].map((k) => {
          const x = X0 + RUN * k;
          const y = Y0 - RUN * k * Math.tan(t);
          return (
            <g key={k}>
              <path d={`M${x} ${y} l-4 14 M${x} ${y} l5 16 M${x} ${y} l0 18`} stroke="#3f6b2a" strokeWidth={2} />
              <path d={`M${x} ${y - 2} v-16`} stroke="#5b3a1e" strokeWidth={3} />
              <circle cx={x} cy={y - 24} r={10} fill="#2f7d32" />
            </g>
          );
        })}
      <text x={X0 + 30} y={Y0 - 8} fontSize={15} fontWeight={700} fill="#0d1726">
        {angle}°
      </text>
      <path d={`M${X0 + 26} ${Y0} A26 26 0 0 0 ${X0 + 26 * Math.cos(t)} ${Y0 - 26 * Math.sin(t)}`} fill="none" stroke="#0d1726" strokeWidth={1.5} />

      <g className="transition-transform duration-[1600ms] ease-in" style={{ transform: `translate(${bx + down.x * slide}px, ${by + down.y * slide}px)` }}>
        <g style={{ transform: `rotate(${-angle}deg)` }}>
          <g>
            {push && <animateTransform attributeName="transform" type="translate" values="0 0; 3 -2; -3 1; 2 2; 0 0" dur="0.25s" repeatCount="indefinite" />}
            <rect x={-38} y={-34} width={76} height={34} rx={3} fill="#a47b52" stroke="#6b4a2c" strokeWidth={2} />
            {snow > 0 && <rect x={-38} y={-34 - snow / 6} width={76} height={snow / 6} rx={3} fill="#f8fbff" stroke="#c9d6e2" />}
            {water > 0.05 &&
              Array.from({ length: Math.round(water * 8) }, (_, i) => <circle key={i} cx={-28 + (i % 4) * 18} cy={-24 + Math.floor(i / 4) * 12} r={3.2} fill="#3a8ee6" />)}
          </g>
        </g>
        <path d="M0 -17 V58" stroke="#334155" strokeWidth={3} markerEnd="url(#head-334155)" opacity={0.7} />
        <text x={6} y={66} fontSize={12} fill="#334155" fontWeight={700}>
          სიმძიმე
        </text>
        <path d={arrow(pull, down)} stroke="#d62828" strokeWidth={emph === "pull" ? 7 : 5} markerEnd="url(#head-d62828)" transform="translate(0 -17)" />
        <path d={arrow(hold, { x: -down.x, y: -down.y })} stroke="#2a9d3f" strokeWidth={emph === "hold" ? 7 : 5} markerEnd="url(#head-2a9d3f)" transform="translate(0 -17)" />
      </g>

      <g fontSize={14} fontWeight={700}>
        <text x={14} y={26} fill="#d62828" className={cn(emph === "hold" && "opacity-40")}>
          ↙ სიმძიმე ქვემოთ ექაჩება
        </text>
        <text x={14} y={46} fill="#2a9d3f" className={cn(emph === "pull" && "opacity-40")}>
          ↗ აკავებს: ხახუნი, შეჭიდულობა{roots ? ", ფესვები" : ""}
        </text>
        {push && (
          <text x={14} y={66} fill="#b45309">
            ⚡ ბიძგი: მიწისძვრა, ჩეხვა, ძირის ჩაჭრა
          </text>
        )}
        <text x={426} y={26} textAnchor="end" fill={slides ? "#b91c1c" : "#15803d"}>
          {slides ? "მასა მოძრაობს!" : "ფერდობი მდგრადია"}
        </text>
      </g>
    </svg>
  );
}
