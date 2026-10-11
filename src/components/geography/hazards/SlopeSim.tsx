"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { HAZARD_INFO, type HazardKind } from "./hazards-data";
import { evaluate, type SlopeInput } from "./slope-math";

/*
 * Topic 7 — a slope you can tilt, soak and load with snow. "Check" runs the model: the soil, debris or
 * snow either holds (a small shudder) or goes down the slope and spreads over the valley floor.
 */

const W = 440;
const H = 260;
const BASE = 220;
const LEFT = 30;
const D = Math.PI / 180;

const PRESETS: Record<HazardKind, SlopeInput> = {
  landslide: { angle: 28, water: 0.3, snow: 0, forest: false },
  mudflow: { angle: 22, water: 0.3, snow: 0, forest: false },
  avalanche: { angle: 38, water: 0, snow: 20, forest: false },
};

function geometry(angle: number) {
  const t = Math.max(5, angle) * D;
  const run = Math.min(320, 175 / Math.tan(t));
  const top = { x: LEFT + 40, y: BASE - run * Math.tan(t) };
  const bottom = { x: top.x + run, y: BASE };
  const len = Math.hypot(run, BASE - top.y);
  const d = { x: Math.cos(t), y: Math.sin(t) };
  const n = { x: Math.sin(t), y: -Math.cos(t) };
  /** Point `q` px down the slope from the top, `h` px above the ground; past the bottom it runs along the valley. */
  const along = (q: number, h: number) => (q <= len ? { x: top.x + d.x * q + n.x * h, y: top.y + d.y * q + n.y * h } : { x: bottom.x + (q - len), y: BASE - h });
  return { top, bottom, len, along };
}

export function SlopeSim({ kind }: { kind: HazardKind }) {
  const [input, setInput] = useState<SlopeInput>(PRESETS[kind]);
  const [anim, setAnim] = useState(0);
  const [ran, setRan] = useState(false);
  const frame = useRef(0);
  const info = HAZARD_INFO[kind];
  const res = evaluate(kind, input);
  const g = geometry(input.angle);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const set = (patch: Partial<SlopeInput>) => {
    cancelAnimationFrame(frame.current);
    setInput((s) => ({ ...s, ...patch }));
    setAnim(0);
    setRan(false);
  };
  const run = () => {
    cancelAnimationFrame(frame.current);
    setRan(true);
    const start = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      const k = reduce ? 1 : Math.min(1, (performance.now() - start) / 2600);
      setAnim(k);
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    tick();
  };

  // The moving mass: soil, debris or snow on the upper part of the slope.
  const u1 = kind === "mudflow" ? 0.05 : 0.12;
  const u2 = kind === "mudflow" ? 0.45 : 0.62;
  const thick = kind === "avalanche" ? 4 + input.snow / 7 : kind === "mudflow" ? 9 : 16;
  const travel = res.triggered ? (1 - Math.pow(1 - anim, 2.2)) * (g.len * (1 - u2) + (kind === "landslide" ? 30 : 120)) : 0;
  const shake = !res.triggered && ran && anim < 1 ? Math.sin(anim * 60) * 1.6 * (1 - anim) : 0;
  const steps = 24;
  const topEdge: { x: number; y: number }[] = [];
  const bottomEdge: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const q = g.len * (u1 + (u2 - u1) * f);
    // Front of a flow outruns its tail; a landslide moves as one block and slumps a little.
    const s = travel * (kind === "landslide" ? 1 : 0.55 + f * 0.9) + shake;
    const h = kind === "landslide" && res.triggered ? thick * (1 - 0.35 * anim * (1 - f)) : thick * (kind === "mudflow" && res.triggered ? 1 - 0.4 * anim : 1);
    topEdge.push(g.along(q + s, h));
    bottomEdge.push(g.along(q + s, 0));
  }
  const mass = [...topEdge, ...bottomEdge.reverse()].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const scar = res.triggered && anim > 0.05;
  const fill = kind === "landslide" ? "#8a5a2b" : kind === "mudflow" ? "#6b5a48" : "#f8fbff";
  const trees = input.forest ? Array.from({ length: 9 }, (_, i) => g.len * (0.06 + i * 0.1)) : [];

  const drops = kind !== "avalanche" ? Math.round(input.water * 40) : 0;
  const flakes = kind === "avalanche" ? Math.round(input.snow / 4) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_15rem]">
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-[linear-gradient(#cfe6f7,#eef6fb)]" role="img" aria-label={`ფერდობის მოდელი: ${info.name}`}>
          {/* Rain or snow */}
          <g>
            {Array.from({ length: drops }, (_, i) => {
              const x = 20 + ((i * 97) % (W - 40));
              const y = 10 + ((i * 53) % 120);
              return <line key={i} x1={x} y1={y} x2={x - 3} y2={y + 9} stroke="#4a86b8" strokeWidth={1.2} opacity={0.7} />;
            })}
            {Array.from({ length: flakes }, (_, i) => (
              <circle key={i} cx={20 + ((i * 89) % (W - 40))} cy={8 + ((i * 47) % 110)} r={1.8} fill="#ffffff" stroke="#b9cde0" strokeWidth={0.5} />
            ))}
            {(drops > 0 || flakes > 0) && <animateTransform attributeName="transform" type="translate" values="0 -12; 0 12" dur={flakes ? "2.4s" : "0.5s"} repeatCount="indefinite" />}
          </g>
          {/* Mountain and valley */}
          <polygon points={`0,${g.top.y} ${g.top.x},${g.top.y} ${g.bottom.x},${BASE} ${W},${BASE} ${W},${H} 0,${H}`} fill={kind === "avalanche" ? "#9aa5ad" : "#7da35a"} />
          <polygon points={`0,${g.top.y + 6} ${g.top.x},${g.top.y + 6} ${g.bottom.x},${BASE + 6} ${W},${BASE + 6} ${W},${H} 0,${H}`} fill={kind === "avalanche" ? "#7d8790" : "#9b7653"} />
          {kind === "avalanche" && <polygon points={`0,${g.top.y} ${g.top.x},${g.top.y} ${g.bottom.x},${BASE} ${W},${BASE} ${W},${BASE + 3} ${g.bottom.x},${BASE + 3} ${g.top.x},${g.top.y + 3} 0,${g.top.y + 3}`} fill="#ffffff" />}
          {/* Sliding surface left behind */}
          {scar && <polyline points={[0, 0.5, 1].map((f) => g.along(g.len * (u1 + (u2 - u1) * f), 0)).map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={kind === "avalanche" ? "#6b7780" : "#5b3a1e"} strokeWidth={3} strokeDasharray="6 4" />}
          <polygon points={mass} fill={fill} stroke={kind === "avalanche" ? "#c9d6e2" : "#4a3420"} strokeWidth={1} />
          {trees.map((q, i) => {
            const inMass = q >= g.len * u1 && q <= g.len * u2;
            const p = g.along(q + (inMass ? travel * (kind === "landslide" ? 1 : 0.9) + shake : 0), inMass ? thick : kind === "avalanche" ? 3 : 0);
            return (
              <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${inMass && res.triggered ? anim * (kind === "landslide" ? 18 : 70) : 0})`}>
                <rect x={-1.2} y={-6} width={2.4} height={6} fill="#5b3a1e" />
                <polygon points="0,-24 -7,-5 7,-5" fill="#2f6b34" />
              </g>
            );
          })}
          {/* Angle */}
          <path d={`M ${g.bottom.x - 34} ${BASE} A 34 34 0 0 0 ${g.bottom.x - 34 * Math.cos(input.angle * D)} ${BASE - 34 * Math.sin(input.angle * D)}`} fill="none" stroke="#111a18" strokeWidth={1.2} />
          <text x={g.bottom.x - 52} y={BASE - 6} fontSize={12} fontWeight={700} fill="#111a18">
            {input.angle}°
          </text>
          {ran && anim >= 1 && (
            <text x={W / 2} y={24} textAnchor="middle" fontSize={15} fontWeight={700} fill={res.triggered ? "#b91c1c" : "#15803d"}>
              {res.triggered ? `${info.name}!` : "ფერდობი გაუძლო"}
            </text>
          )}
        </svg>
        <p className={cn("mt-2 min-h-12 text-[15px] leading-6", ran && anim >= 1 ? (res.triggered ? "text-[#b91c1c]" : "text-[#15803d]") : "text-[#33413e]")}>
          {ran && anim >= 1 ? res.reason : "შეცვალე ფერდობის დახრილობა, წვიმა ან თოვლი, ტყე — და დააჭირე „შემოწმება“."}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <label className="block text-sm">
          <span className="flex justify-between">
            <span className="font-semibold">ფერდობის დახრილობა</span>
            <span className="tabular-nums">{input.angle}°</span>
          </span>
          <input type="range" min={5} max={60} value={input.angle} onChange={(e) => set({ angle: Number(e.target.value) })} className="w-full" style={{ accentColor: info.color }} />
        </label>
        {kind === "avalanche" ? (
          <label className="block text-sm">
            <span className="flex justify-between">
              <span className="font-semibold">ახალი თოვლი</span>
              <span className="tabular-nums">{input.snow} სმ</span>
            </span>
            <input type="range" min={0} max={150} step={5} value={input.snow} onChange={(e) => set({ snow: Number(e.target.value) })} className="w-full" style={{ accentColor: info.color }} />
          </label>
        ) : (
          <label className="block text-sm">
            <span className="flex justify-between">
              <span className="font-semibold">{kind === "mudflow" ? "თავსხმა / მყინვარის დნობა" : "წვიმა — გრუნტის გაჯერება"}</span>
              <span className="tabular-nums">{Math.round(input.water * 100)}%</span>
            </span>
            <input type="range" min={0} max={1} step={0.05} value={input.water} onChange={(e) => set({ water: Number(e.target.value) })} className="w-full" style={{ accentColor: info.color }} />
          </label>
        )}
        <button type="button" onClick={() => set({ forest: !input.forest })} aria-pressed={input.forest} className={cn("flex h-9 items-center justify-center gap-2 rounded-lg border text-sm font-semibold", input.forest ? "border-[#2f6b34] bg-[#e8f3e9] text-[#2f6b34]" : "border-[#d5dcd9] text-[#33413e]")}>
          <Trees className="size-4" />
          {input.forest ? "ფერდობზე ტყეა" : "ტყე გაჩეხილია"}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={run} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: info.color }}>
            <Play className="size-4" />
            შემოწმება
          </button>
          <button type="button" onClick={() => set(PRESETS[kind])} title="თავიდან" aria-label="თავიდან" className="flex size-10 items-center justify-center rounded-lg border border-[#d5dcd9]">
            <RotateCcw className="size-4" />
          </button>
        </div>
        <div className="rounded-lg bg-[#f5f7f6] px-3 py-2.5">
          <p className="text-[11px] leading-4 text-[#66736f]">{kind === "landslide" ? "მდგრადობის კოეფიციენტი (>1 — მდგრადია)" : "საშიშროება"}</p>
          <p className="mt-1 text-base font-semibold tabular-nums">{kind === "landslide" ? res.fs!.toFixed(2).replace(".", ",") : `${Math.round(res.risk * 100)}%`}</p>
          <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-[#e2e7e5]">
            <span className="block h-full rounded-full transition-all" style={{ width: `${Math.round(res.risk * 100)}%`, backgroundColor: res.risk >= 0.5 ? "#dc2626" : res.risk >= 0.3 ? "#f59e0b" : "#16a34a" }} />
          </span>
        </div>
      </div>
    </div>
  );
}
