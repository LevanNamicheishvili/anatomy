"use client";

import { useEffect, useRef, useState } from "react";
import { useNarrationDirector } from "@/components/portal/NarrationScene";
import { Sun, Zap } from "lucide-react";
import { LabeledSlider, PillButton } from "@/components/portal/controls";
import { sceneFrame } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { cn } from "@/lib/utils";
import { SEASONS, solarReading, trackerTilt } from "./solar-math";
import { SolarInsetCard } from "./insets";
import { SOLAR_CUES, type SolarLit, type SolarShot } from "./solar-cues";
import { SolarScene } from "./SolarScene";

/** The angle of incidence in plain words. */
const plainAngle = (a: number) => (a <= 10 ? "სხივი პირდაპირ ეცემა" : a <= 45 ? "სხივი ცოტა ირიბად ეცემა" : a < 90 ? "სხივი ძალიან ირიბად ეცემა" : "სხივი პანელს არ ეცემა");

/*
 * Topic 9 — how a solar power plant works and why the angle matters. Move the sun (noon elevation) and the
 * panel tilt; the read-out shows the angle of incidence and how much power 1 m² of panel gives.
 */

const fmt = (n: number) => Math.round(n).toLocaleString("ka-GE");

const COLOR = "#2f6fb0";
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
/** Rings round what the voice names. */
const LIT = "ring-2 ring-[#ffd76a] text-[14px]";

function Slider({ label, value, min, max, onChange, disabled }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return <LabeledSlider label={label} value={value} display={`${value}°`} min={min} max={max} onChange={onChange} disabled={disabled} color={COLOR} />;
}

export function SolarPlant() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SolarScene | null>(null);
  const [elevation, setElevation] = useState<number>(SEASONS[1].elevation);
  const [manualTilt, setTilt] = useState(35);
  const [tracker, setTracker] = useState(false);
  /** Set by the narration. */
  const [shot, setShot] = useState<Partial<SolarShot> | null>(null);
  const glides = useRef({ elevation: 0, tilt: 0 });
  const now = useRef({ elevation, tilt: manualTilt });
  useEffect(() => {
    now.current = { elevation, tilt: manualTilt };
  }, [elevation, manualTilt]);
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
        el.style.opacity = p.visible && !el.dataset.off ? "1" : "0";
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

  /** The sun's height or the panels' tilt glides to a value in step with the voice. */
  const glide = (key: "elevation" | "tilt", to: number, set: (v: number) => void) => {
    cancelAnimationFrame(glides.current[key]);
    const from = now.current[key];
    const start = performance.now();
    const dur = Math.min(2200, 300 + Math.abs(to - from) * 30);
    const step = () => {
      const k = Math.min(1, (performance.now() - start) / dur);
      set(Math.round(from + (to - from) * ease(k)));
      if (k < 1) glides.current[key] = requestAnimationFrame(step);
    };
    step();
  };
  useEffect(() => {
    const g = glides.current;
    return () => {
      cancelAnimationFrame(g.elevation);
      cancelAnimationFrame(g.tilt);
    };
  }, []);
  const last = useRef<Partial<SolarShot>>({});
  const direct = (s: Partial<SolarShot>, jump: boolean) => {
    const before = last.current;
    last.current = s;
    if (s.elevation !== undefined && !s.sweep && (jump || s.elevation !== before.elevation || before.sweep)) {
      if (jump) setElevation(s.elevation);
      else glide("elevation", s.elevation, setElevation);
    }
    if (s.tilt !== undefined && (jump || s.tilt !== before.tilt)) {
      if (jump) setTilt(s.tilt);
      else glide("tilt", s.tilt, setTilt);
    }
    setTracker(!!s.tracker);
    if (s.view && (jump || s.view !== before.view)) sceneRef.current?.view(s.view, jump);
    setShot(s);
  };
  const driving = useNarrationDirector(SOLAR_CUES, direct);
  const narr = driving ? shot : null;
  const lit = (k: SolarLit) => !!narr?.lit?.includes(k);
  // The sun goes through the year's noon heights (winter ↔ summer) while the voice speaks of the whole year.
  const sweep = !!narr?.sweep;
  useEffect(() => {
    if (!sweep) return;
    cancelAnimationFrame(glides.current.elevation);
    const start = performance.now();
    let id = 0;
    const step = () => {
      const t = (performance.now() - start) / 1000;
      setElevation(Math.round(48.5 - 23.5 * Math.cos(t * 1.1)));
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [sweep]);

  return (
    <section ref={fsRef} className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative", sceneFrame)} data-scene>
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="მზის ელექტროსადგური" />
        <FullscreenButton full={fsOn} onClick={fsToggle} className="absolute top-3 right-3" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[12px] font-semibold">
          <span data-at="sun" className={cn("absolute top-0 left-0 rounded bg-[#ffd84d] px-1.5 py-0.5 text-ink opacity-0 shadow-sm", lit("sun") && LIT)}>
            მზე · {elevation}°
          </span>
          <span data-at="normal" className={cn("absolute top-0 left-0 rounded bg-card px-1.5 py-0.5 text-ink opacity-0 shadow-sm", lit("normal") && LIT)}>
            დაცემის კუთხე {Math.round(r.incidence)}° · {plainAngle(r.incidence)}
          </span>
          <span data-at="inverter" className={cn("absolute top-0 left-0 rounded bg-deep/80 px-1.5 py-0.5 text-white opacity-0", lit("inverter") && LIT)}>
            ინვერტორი: მუდმივი → ცვლადი დენი
          </span>
          <span data-at="grid" className={cn("absolute top-0 left-0 rounded bg-deep/80 px-1.5 py-0.5 text-white opacity-0", lit("grid") && LIT)}>
            ⚡ ქსელში
          </span>
          {/* Shown only while the voice speaks (the labels are found once, so they are always there). */}
          <span data-at="transformer" data-off={narr ? undefined : "1"} className={cn("absolute top-0 left-0 rounded bg-deep/80 px-1.5 py-0.5 text-white opacity-0", lit("transformer") && LIT)}>
            ტრანსფორმატორი: ძაბვა იზრდება
          </span>
          <span data-at="south" data-off={narr ? undefined : "1"} className={cn("absolute top-0 left-0 rounded bg-[#d61f1f] px-1.5 py-0.5 text-white opacity-0", lit("south") && LIT)}>
            ← სამხრეთი (პანელები აქეთ იყურება)
          </span>
          <span data-at="tilt" data-off={narr ? undefined : "1"} className={cn("absolute top-0 left-0 rounded bg-card px-1.5 py-0.5 text-ink opacity-0 shadow-sm", lit("tilt") && LIT)}>
            დახრა {Math.round(tilt)}°
          </span>
        </div>
        {narr?.inset && <SolarInsetCard key={narr.inset} inset={narr.inset} />}
        <div className={cn("pointer-events-none absolute top-3 left-3 rounded-lg bg-card/92 px-3 py-2 shadow-sm", lit("power") && "ring-2 ring-[#ffd76a]")}>
          <p className="flex items-center gap-1.5 text-sm">
            <Zap className="size-4 text-[#c08a00]" />
            <b className="tabular-nums">{fmt(r.electric)} ვტ</b>
            <span className="text-mute">1 მ² პანელიდან</span>
          </p>
          <div className="mt-1.5 h-1.5 w-44 overflow-hidden rounded-full bg-chip">
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
            { k: "დაცემის კუთხე (0° — სხივი პირდაპირ ეცემა)", v: `${Math.round(r.incidence)}°` },
            { k: "პანელს ხვდება სხივის სინათლის", v: `${Math.round(Math.max(0, r.cosine) * 100)}%` },
            { k: "პირდაპირი სხივი", v: `${fmt(r.beam)} ვტ/მ²` },
            { k: "პანელზე ეცემა", v: `${fmt(r.onPanel)} ვტ/მ²` },
            { k: "ელექტროენერგია (ქ.მ.კ. 20%)", v: `${fmt(r.electric)} ვტ` },
            { k: "საუკეთესო დახრა ახლა", v: `${Math.round(trackerTilt(elevation))}°` },
          ].map((x) => (
            <div key={x.k} className="rounded-lg bg-subtle px-3 py-2.5">
              <dt className="text-[11px] leading-4 text-mute">{x.k}</dt>
              <dd className="mt-1 text-base leading-5 font-semibold tabular-nums">{x.v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-faint">მოდელი გამარტივებულია: მზე სამხრეთშია (შუადღე), გათვალისწინებულია მხოლოდ პირდაპირი სხივი და ატმოსფეროს სისქე; გაბნეული შუქი და ტემპერატურა — არა.</p>
    </section>
  );
}
