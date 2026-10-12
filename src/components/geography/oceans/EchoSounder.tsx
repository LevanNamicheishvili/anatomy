"use client";

import { useEffect, useRef, useState } from "react";
import { Radio } from "lucide-react";
import { LabeledSlider } from "@/components/portal/controls";
import { depthAt, PROFILE, PROFILE_PARTS, SOUND_WATER } from "./ocean-data";

/*
 * Topic 10 — the ocean floor in profile and an echo sounder. The ship sends a sound pulse down; it bounces
 * off the bottom and comes back after t seconds. Sound travels ~1500 m/s in sea water, and the pulse goes
 * there and back, so depth = 1500 × t ÷ 2.
 */

const W = 640;
const H = 300;
const SEA = 46;
const MAX_KM = 2040;
const MAX_M = 11500;
const sx = (km: number) => 20 + (km / MAX_KM) * (W - 40);
const sy = (m: number) => SEA + (m / MAX_M) * (H - SEA - 12);
/** 12345 → "12 345" (Georgian style: a space between thousands). */
const nf = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const f2 = (v: number) => v.toFixed(2).replace(".", ",");

export function EchoSounder() {
  const [km, setKm] = useState(700);
  const [anim, setAnim] = useState<number | null>(null);
  const frame = useRef(0);
  const depth = depthAt(km);
  const t = (2 * depth) / SOUND_WATER;
  const part = PROFILE_PARTS.find((p) => km >= p.from && km <= p.to);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const ping = () => {
    cancelAnimationFrame(frame.current);
    const dur = Math.max(600, t * 300);
    const start = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / dur);
      setAnim(k);
      if (k < 1) frame.current = requestAnimationFrame(tick);
    };
    tick();
  };
  const move = (v: number) => {
    cancelAnimationFrame(frame.current);
    setAnim(null);
    setKm(v);
  };

  const floorPts = PROFILE.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" ");
  const shipX = sx(km);
  const bottomY = sy(depth);
  // Pulse: down for the first half of the animation, back up for the second.
  const pulseY = anim === null ? null : anim < 0.5 ? SEA + (bottomY - SEA) * (anim * 2) : bottomY - (bottomY - SEA) * ((anim - 0.5) * 2);
  const done = anim !== null && anim >= 1;

  return (
    <div className="px-5 py-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-[#e8f3fb]" role="img" aria-label="ოკეანის ფსკერის პროფილი და ექოლოტი">
        <defs>
          <linearGradient id="echo-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5aa9e0" />
            <stop offset="0.35" stopColor="#1f5f99" />
            <stop offset="1" stopColor="#0a1e3d" />
          </linearGradient>
        </defs>
        <rect x={0} y={0} width={W} height={SEA} fill="#cfe8f8" />
        <polygon points={`${sx(0)},${SEA} ${floorPts} ${sx(MAX_KM)},${SEA}`} fill="url(#echo-water)" />
        <polygon points={`0,${SEA} ${sx(0)},${SEA} ${floorPts} ${W},${SEA} ${W},${H} 0,${H}`} fill="#8a6a4a" />
        <polyline points={floorPts} fill="none" stroke="#5b3f26" strokeWidth={1.5} />
        {/* Depth scale */}
        {[0, 2000, 4000, 6000, 8000, 10000].map((m) => (
          <g key={m}>
            <line x1={W - 18} x2={W - 12} y1={sy(m)} y2={sy(m)} stroke="#ffffff" opacity={0.7} />
            <text x={W - 20} y={sy(m) + 3} fontSize={9} textAnchor="end" fill="#ffffff" opacity={0.85}>
              {m / 1000} კმ
            </text>
          </g>
        ))}
        {PROFILE_PARTS.map((p) => (
          <text key={p.name} x={sx((p.from + p.to) / 2)} y={Math.min(H - 6, sy(depthAt((p.from + p.to) / 2)) + 16)} fontSize={10} fontWeight={600} textAnchor="middle" fill="#fff6e8">
            {p.name}
          </text>
        ))}
        {/* Ship */}
        <g transform={`translate(${shipX} ${SEA})`}>
          <polygon points="-16,-4 16,-4 11,5 -11,5" fill="#e2483d" />
          <rect x={-6} y={-13} width={12} height={9} fill="#ffffff" stroke="#33413e" strokeWidth={0.6} />
          <line x1={0} x2={0} y1={-21} y2={-13} stroke="#33413e" />
        </g>
        {pulseY !== null && !done && (
          <g>
            <line x1={shipX} x2={shipX} y1={SEA + 5} y2={pulseY} stroke="#ffe066" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />
            <path d={`M ${shipX - 14} ${pulseY} Q ${shipX} ${pulseY + (anim! < 0.5 ? 8 : -8)} ${shipX + 14} ${pulseY}`} fill="none" stroke="#ffe066" strokeWidth={2.5} />
          </g>
        )}
        {done && <line x1={shipX} x2={shipX} y1={SEA + 5} y2={bottomY} stroke="#ffe066" strokeWidth={1.5} />}
        {done && (
          <text x={shipX + (shipX > W - 140 ? -8 : 8)} y={(SEA + bottomY) / 2} fontSize={12} fontWeight={700} fill="#ffe066" textAnchor={shipX > W - 140 ? "end" : "start"}>
            {nf(depth)} მ
          </text>
        )}
      </svg>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-3">
          <LabeledSlider label="გემის ადგილი" value={km} display={`ნაპირიდან ${nf(km)} კმ`} min={10} max={2030} step={5} onChange={move} color="#1f5f99" />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={ping} className="flex h-11 items-center gap-2 rounded-lg bg-[#1f5f99] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#194e7f]">
              <Radio className="size-4" />
              ბგერითი სიგნალი
            </button>
            <span className="text-sm text-copy tabular-nums">
              წამზომი: <b>{anim === null ? "0,00" : f2(t * anim)} წმ</b>
            </span>
          </div>
          <p className="min-h-14 rounded-lg bg-subtle px-3 py-2.5 text-[15px] leading-7 text-copy tabular-nums">
            {done ? (
              <>
                ექო დაბრუნდა <b>{f2(t)} წმ</b>-ში. სიღრმე = 1500 მ/წმ × {f2(t)} წმ ÷ 2 = <b>{nf(depth)} მ</b>
              </>
            ) : (
              "დააჭირე „ბგერითი სიგნალი“: ბგერა ფსკერამდე ჩადის, აირეკლება და უკან ბრუნდება. ჩვენ ვზომავთ დროს."
            )}
          </p>
          {part && (
            <p className="text-[15px] leading-7 text-copy">
              <b>{part.name}:</b> {part.note}
            </p>
          )}
        </div>
        <ul className="flex flex-col gap-1.5 rounded-lg border border-line p-3 text-[14px] leading-6 text-copy">
          <li>მსოფლიო ოკეანის საშუალო სიღრმე — <b>~3700 მ</b></li>
          <li>მარიანის ღარი (წყნარი ოკ.) — <b>~10 994 მ</b>, ყველაზე ღრმა ადგილი დედამიწაზე</li>
          <li>შავი ზღვა — <b>2212 მ</b>-მდე; ~150–200 მ-ის ქვემოთ წყალში გოგირდწყალბადია და თითქმის არაფერი ცოცხლობს</li>
          <li>ბგერა წყალში ~1500 მ/წმ-ით მოძრაობს — ჰაერზე (~340 მ/წმ) 4-ჯერ სწრაფად</li>
        </ul>
      </div>
    </div>
  );
}
