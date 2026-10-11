"use client";

import { useEffect, useRef, useState } from "react";
import { Play, RotateCcw, Trees } from "lucide-react";
import { cn } from "@/lib/utils";
import { hash01 } from "../fx/particles";
import { HAZARD_INFO, type HazardKind } from "./hazards-data";
import { evaluate, type SlopeInput } from "./slope-math";

/*
 * Topic 7 — a slope you can tilt, soak and load with snow. "Check" runs the model: the soil, debris or
 * snow either holds (a small shudder) or goes down the slope and spreads over the valley floor.
 * The failure is staged like the real thing: cracks open at the head first, then the mass starts slowly,
 * speeds up and stops. Landslide — a hummocky block leaving a raw scarp; mudflow — a thick, slow-looking
 * slurry with a boulder front and surges; avalanche — a dense snow flow under a billowing powder cloud.
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
      const k = reduce ? 1 : Math.min(1, (performance.now() - start) / 3400);
      setAnim(k);
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    tick();
  };

  // The moving mass: soil, debris or snow on the upper part of the slope.
  const u1 = kind === "mudflow" ? 0.05 : 0.12;
  const u2 = kind === "mudflow" ? 0.45 : 0.62;
  const thick = kind === "avalanche" ? 4 + input.snow / 7 : kind === "mudflow" ? 12 : 16;
  const go = res.triggered;
  // Stage 1 (0–18%): cracks open at the head. Stage 2: the mass starts slowly, speeds up, then stops.
  const crack = go ? Math.min(1, anim / 0.18) : 0;
  const x = go ? Math.max(0, (anim - 0.15) / 0.85) : 0;
  const m = x * x * (3 - 2 * x);
  const reach = g.len * (1 - u2) + (kind === "landslide" ? 30 : kind === "mudflow" ? 110 : 140);
  // Mudflow comes in surges: the front jerks forward in pulses.
  const surge = kind === "mudflow" && go ? 4 * Math.sin(anim * 34) * Math.sin(m * Math.PI) : 0;
  const travel = go ? m * reach + surge : 0;
  const shake = !go && ran && anim < 1 ? Math.sin(anim * 60) * 1.6 * (1 - anim) : 0;
  const steps = 40;
  const topEdge: { x: number; y: number }[] = [];
  const bottomEdge: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const q = g.len * (u1 + (u2 - u1) * f);
    // Front of a flow outruns its tail; a landslide moves as one block and slumps a little.
    const s = travel * (kind === "landslide" ? 1 : 0.55 + f * 0.9) + shake;
    let h: number;
    if (kind === "landslide") {
      // Head drops and tilts back, the body breaks into hummocks.
      h = thick * (1 - 0.35 * m * (1 - f)) + 2.2 * m * Math.sin(f * Math.PI * 6 + 1.3) * Math.sin(f * Math.PI);
    } else if (kind === "mudflow") {
      // Thin, wet tail; a thick bulging front ("snout") with a rounded nose; waves run along the surface.
      const body = go ? 0.35 + 0.65 * f ** 1.5 + 0.55 * Math.exp(-(((f - 0.9) / 0.07) ** 2)) : 1;
      const nose = go ? Math.sqrt(Math.max(0, 1 - Math.max(0, (f - 0.94) / 0.06) ** 2)) : 1;
      h = thick * body * nose + (go ? 1.3 * m * Math.sin(f * 30 - anim * 45) * (1 - f) : 0);
    } else {
      h = thick * (go ? 0.6 + 0.4 * f : 1) + (go ? 1.2 * Math.sin(f * 24 + anim * 30) * m : 0);
    }
    topEdge.push(g.along(q + s, Math.max(0.5, h)));
    bottomEdge.push(g.along(q + s, 0));
  }
  const mass = [...topEdge, ...[...bottomEdge].reverse()].map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const front = topEdge[topEdge.length - 1];
  const scar = go && m > 0.02;
  const fill = kind === "landslide" ? "url(#slide-soil)" : kind === "mudflow" ? "url(#mud)" : "#f8fbff";
  const trees = input.forest ? Array.from({ length: 9 }, (_, i) => g.len * (0.06 + i * 0.1)) : [];

  // Raw scarp left behind at the head: from the crown down to where the mass's head is now.
  const crownQ = g.len * u1;
  const headNow = kind === "landslide" ? travel : travel * 0.55;
  const scarp = scar
    ? [g.along(crownQ, kind === "avalanche" ? thick : thick * 0.95), ...Array.from({ length: 8 }, (_, i) => g.along(crownQ + (headNow * (i + 1)) / 8, 0)), g.along(crownQ, 0)]
        .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" ")
    : "";

  // Cracks at the head of the slope (and a couple further up for a landslide): zig-zags that widen.
  const cracks = go
    ? (kind === "mudflow" ? [] : kind === "avalanche" ? [0] : [0, -10, -19]).map((dq, j) => {
        const q = crownQ + dq;
        // The main crack cuts through the moving layer; the ones further up open in the ground itself.
        const depth = (j === 0 ? thick : 7) * crack;
        const from = j === 0 ? thick : 0;
        const pts = Array.from({ length: 5 }, (_, i) => {
          const d = (depth * i) / 4;
          const p = g.along(q + (i % 2 ? 1.6 : -1.6) * crack, from - d);
          return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
        });
        return { pts: pts.join(" "), w: (j === 0 ? 2.6 : 1.4) * crack };
      })
    : [];

  // Debris: clods, boulders or snow blocks riding in the mass, bouncing and tumbling; some run out ahead.
  const debris =
    go && m > 0.01
      ? Array.from({ length: kind === "mudflow" ? 30 : 24 }, (_, i) => {
          const a = hash01(i, 1);
          const b = hash01(i, 2);
          const c = hash01(i, 3);
          // Mudflow boulders gather at the front (they are pushed along by the slurry behind).
          const f = kind === "mudflow" ? 0.55 + 0.45 * Math.sqrt(a) : a;
          const q = g.len * (u1 + (u2 - u1) * f) + travel * (kind === "landslide" ? 1 : 0.55 + f * 0.9) + (kind === "mudflow" ? 0 : b * 28 * m);
          const bounce = Math.abs(Math.sin(anim * Math.PI * (3 + c * 5) + a * 6)) * (kind === "mudflow" ? 2 : 7) * b * Math.sin(m * Math.PI);
          const h = (kind === "mudflow" ? thick * (0.5 + 0.9 * c) : thick * c * 0.9) + bounce;
          const p = g.along(q, h);
          const r = kind === "mudflow" ? 1.8 + b * 3.4 : kind === "avalanche" ? 1.6 + b * 2.4 : 1.4 + b * 2.6;
          const pts = Array.from({ length: 6 }, (_, k) => {
            const ang = (k / 6) * Math.PI * 2;
            const rr = r * (0.7 + 0.5 * hash01(i * 7 + k, 4));
            return `${(Math.cos(ang) * rr).toFixed(1)},${(Math.sin(ang) * rr).toFixed(1)}`;
          }).join(" ");
          return { x: p.x, y: p.y, rot: anim * 900 * (b - 0.4), pts, tone: c };
        })
      : [];

  // Avalanche powder cloud: snow dust thrown up by the front, billowing and growing as it runs.
  const powder =
    kind === "avalanche" && go && m > 0.05
      ? Array.from({ length: 14 }, (_, i) => {
          const back = i * 9 * (0.4 + m);
          const p = g.along(g.len * u2 + travel * 1.45 - back, 0);
          const r = (8 + i * 2.2 + hash01(i, 5) * 8) * Math.min(1, m * 1.8) * (anim < 1 ? 1 : 1.25);
          return { x: p.x + Math.sin(anim * 9 + i) * 2, y: p.y - r * (0.55 + 0.25 * hash01(i, 6)) - thick, r, o: (0.88 - i * 0.035) * (anim < 1 ? 1 : 0.55) };
        })
      : [];

  // Mud splashes thrown off the snout.
  const splash =
    kind === "mudflow" && go && m > 0.05 && m < 0.98
      ? Array.from({ length: 10 }, (_, i) => {
          const ph = (anim * 6 + hash01(i, 7)) % 1;
          return { x: front.x + ph * (6 + hash01(i, 8) * 10), y: front.y - Math.sin(ph * Math.PI) * (6 + hash01(i, 9) * 8), r: 1 + hash01(i, 10) * 1.4 };
        })
      : [];

  const drops = kind !== "avalanche" ? Math.round(input.water * 40) : 0;
  const flakes = kind === "avalanche" ? Math.round(input.snow / 4) : 0;

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_15rem]">
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-[linear-gradient(#cfe6f7,#eef6fb)]" role="img" aria-label={`ფერდობის მოდელი: ${info.name}`}>
          <defs>
            <linearGradient id="slide-soil" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#6d8f45" />
              <stop offset="0.12" stopColor="#8a5a2b" />
              <stop offset="1" stopColor="#5e3b1c" />
            </linearGradient>
            <linearGradient id="mud" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#8a7864" />
              <stop offset="0.6" stopColor="#6b5a48" />
              <stop offset="1" stopColor="#4a3c30" />
            </linearGradient>
            <filter id="powder" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3.2" />
            </filter>
          </defs>
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
          {scar && <polygon points={scarp} fill={kind === "avalanche" ? "#c5ced6" : "#6b4423"} opacity={0.9} />}
          {scar && <polyline points={[0, 0.5, 1].map((f) => g.along(g.len * (u1 + (u2 - u1) * f), 0)).map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={kind === "avalanche" ? "#6b7780" : "#5b3a1e"} strokeWidth={2} strokeDasharray="6 4" />}
          <polygon points={mass} fill={fill} stroke={kind === "avalanche" ? "#c9d6e2" : "#4a3420"} strokeWidth={1} strokeLinejoin="round" />
          {kind === "mudflow" && go && m > 0.02 && (
            // Wet sheen on the slurry surface.
            <polyline points={topEdge.slice(2, -3).map((p) => `${p.x.toFixed(1)},${(p.y + 1.5).toFixed(1)}`).join(" ")} fill="none" stroke="#b9a68d" strokeWidth={1} opacity={0.7} strokeDasharray="10 7" />
          )}
          {cracks.map((c, i) => (
            <polyline key={i} points={c.pts} fill="none" stroke={kind === "avalanche" ? "#7d8a96" : "#2b1a0d"} strokeWidth={c.w} strokeLinejoin="bevel" />
          ))}
          {debris.map((d, i) => (
            <polygon key={i} points={d.pts} transform={`translate(${d.x.toFixed(1)} ${d.y.toFixed(1)}) rotate(${d.rot.toFixed(0)})`} fill={kind === "avalanche" ? (d.tone > 0.5 ? "#ffffff" : "#dfe8f0") : kind === "mudflow" ? (d.tone > 0.5 ? "#6f6a63" : "#57524c") : d.tone > 0.6 ? "#7a7067" : "#6b4423"} stroke={kind === "avalanche" ? "#b8c7d4" : "#2f2a25"} strokeWidth={0.6} />
          ))}
          {splash.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#5a4a3a" />
          ))}
          {powder.length > 0 && (
            <g filter="url(#powder)">
              {powder.map((c, i) => (
                <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={i % 3 ? "#ffffff" : "#e6eef5"} opacity={c.o} />
              ))}
            </g>
          )}
          {trees.map((q, i) => {
            const inMass = q >= g.len * u1 && q <= g.len * u2;
            const p = g.along(q + (inMass ? travel * (kind === "landslide" ? 1 : 0.9) + shake : 0), inMass ? (kind === "landslide" ? thick * (1 - 0.3 * m) : thick) : kind === "avalanche" ? 3 : 0);
            return (
              <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${inMass && res.triggered ? m * (kind === "landslide" ? 18 : 70) : 0})`}>
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
