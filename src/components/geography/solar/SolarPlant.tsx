"use client";

import { useEffect, useRef, useState } from "react";
import { Sun, Zap } from "lucide-react";
import { LabeledSlider, PillButton } from "@/components/portal/controls";
import { SEASONS, solarReading, trackerTilt } from "./solar-math";
import { SolarScene } from "./SolarScene";

/*
 * Topic 9 — how a solar power plant works and why the angle matters. Move the sun (noon elevation) and the
 * panel tilt; the read-out shows the angle of incidence and how much power 1 m² of panel gives.
 */

const fmt = (n: number) => Math.round(n).toLocaleString("ka-GE");

const COLOR = "#2f6fb0";

function Slider({ label, value, min, max, onChange, disabled }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return <LabeledSlider label={label} value={value} display={`${value}°`} min={min} max={max} onChange={onChange} disabled={disabled} color={COLOR} />;
}

export function SolarPlant() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SolarScene | null>(null);
  const [elevation, setElevation] = useState<number>(SEASONS[1].elevation);
  const [manualTilt, setTilt] = useState(35);
  const [tracker, setTracker] = useState(false);
  const tilt = tracker ? trackerTilt(elevation) : manualTilt;
  const r = solarReading(elevation, tilt);
  /** Share of the best case on Earth (sun overhead, panel flat). */
  const share = r.electric / solarReading(90, 0).electric;

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const scene = new SolarScene(canvas);
    sceneRef.current = scene;
    const els = [...layer.querySelectorAll<HTMLElement>("[data-at]")];
    scene.onFrame = (project, labels) => {
      for (const el of els) {
        const p = project(labels[el.dataset.at as keyof typeof labels]);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.style.opacity = p.visible ? "1" : "0";
      }
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.set(elevation, tilt, share);
  }, [elevation, tilt, share]);

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-white shadow-card">
      <div className="relative h-[56dvh] min-h-80 w-full sm:h-auto sm:aspect-[16/10] sm:max-h-[72dvh]">
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="მზის ელექტროსადგური" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[12px] font-semibold">
          <span data-at="sun" className="absolute top-0 left-0 rounded bg-[#ffd84d] px-1.5 py-0.5 text-[#111a18] opacity-0 shadow-sm">
            მზე · {elevation}°
          </span>
          <span data-at="normal" className="absolute top-0 left-0 rounded bg-white px-1.5 py-0.5 text-[#111a18] opacity-0 shadow-sm">
            ნორმალი · დაცემის კუთხე {Math.round(r.incidence)}°
          </span>
          <span data-at="inverter" className="absolute top-0 left-0 rounded bg-[#111a18]/80 px-1.5 py-0.5 text-white opacity-0">
            ინვერტორი: მუდმივი → ცვლადი დენი
          </span>
          <span data-at="grid" className="absolute top-0 left-0 rounded bg-[#111a18]/80 px-1.5 py-0.5 text-white opacity-0">
            ⚡ ქსელში
          </span>
        </div>
        <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-white/92 px-3 py-2 shadow-sm">
          <p className="flex items-center gap-1.5 text-sm">
            <Zap className="size-4 text-[#c08a00]" />
            <b className="tabular-nums">{fmt(r.electric)} ვტ</b>
            <span className="text-[#66736f]">1 მ² პანელიდან</span>
          </p>
          <div className="mt-1.5 h-1.5 w-44 overflow-hidden rounded-full bg-[#eef2f0]">
            <div className="h-full rounded-full bg-[#f2b705] transition-[width]" style={{ width: `${Math.min(100, share * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Slider label="მზის სიმაღლე შუადღისას" value={elevation} min={0} max={90} onChange={setElevation} />
          <Slider label="პანელის დახრა" value={tilt} min={0} max={90} onChange={setTilt} disabled={tracker} />
          <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm">
            <input type="checkbox" checked={tracker} onChange={(e) => setTracker(e.target.checked)} className="size-5 shrink-0 accent-[#2f6fb0]" />
            მზის მიმდევარი (ტრეკერი): პანელი ყოველთვის მზისკენ ტრიალდება
          </label>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sun className="size-4 text-[#c08a00]" />
              თბილისი, შუადღე (41,7° ჩ. გ.)
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SEASONS.map((s) => (
                <PillButton key={s.id} onClick={() => setElevation(s.elevation)} pressed={elevation === s.elevation} color={COLOR}>
                  {s.name} · {s.elevation}°
                </PillButton>
              ))}
            </div>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 self-start">
          {[
            { k: "დაცემის კუთხე", v: `${Math.round(r.incidence)}°` },
            { k: "cos (დაცემის კუთხე)", v: r.cosine.toFixed(2) },
            { k: "პირდაპირი სხივი", v: `${fmt(r.beam)} ვტ/მ²` },
            { k: "პანელზე ეცემა", v: `${fmt(r.onPanel)} ვტ/მ²` },
            { k: "ელექტროენერგია (ქ.მ.კ. 20%)", v: `${fmt(r.electric)} ვტ` },
            { k: "საუკეთესო დახრა ახლა", v: `${Math.round(trackerTilt(elevation))}°` },
          ].map((x) => (
            <div key={x.k} className="rounded-lg bg-[#f5f7f6] px-3 py-2.5">
              <dt className="text-[11px] leading-4 text-[#66736f]">{x.k}</dt>
              <dd className="mt-1 text-base leading-5 font-semibold tabular-nums">{x.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-[#97a29e]">მოდელი გამარტივებულია: მზე სამხრეთშია (შუადღე), გათვალისწინებულია მხოლოდ პირდაპირი სხივი და ატმოსფეროს სისქე; გაბნეული შუქი და ტემპერატურა — არა.</p>
    </section>
  );
}
