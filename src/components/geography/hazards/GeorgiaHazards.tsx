"use client";

import { useEffect, useRef, useState } from "react";
import { useNarrationDirector } from "@/components/portal/NarrationScene";
import { Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { sceneFrame } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { cn } from "@/lib/utils";
import { GeorgiaScene } from "../GeorgiaScene";
import { HeroView } from "../heroes/HeroView";
import { HAZARD_CUES, type HazardShot } from "./hazards-cues";
import { HAZARD_INFO, HAZARD_ZONES, type HazardKind, type HazardZone } from "./hazards-data";
import { SlopeForces } from "./SlopeForces";
import { SlopeSim, SlopeView } from "./SlopeSim";

/*
 * Topic 7 — landslides, mudflows and avalanches. Top: the Georgia relief map (the same GeorgiaScene as the
 * map page and the landforms lesson) with the well-known danger areas as halos. Below: a 3D model of a mudflow
 * or an avalanche, and a slope model.
 */

const KINDS: HazardKind[] = ["landslide", "mudflow", "avalanche"];

export function GeorgiaHazards() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GeorgiaScene | null>(null);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<HazardKind>("landslide");
  const [active, setActive] = useState<HazardZone | null>(null);
  const info = HAZARD_INFO[kind];
  /** Set by the narration. */
  const [shot, setShot] = useState<Partial<HazardShot> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const scene = new GeorgiaScene(canvas, { onReady: () => setReady(true), onHover: () => {}, onSelect: () => {} });
    sceneRef.current = scene;
    scene.setLayer("physical");
    scene.setOverlays({ rivers: true, lakes: false, cities: false, peaks: false });
    const forwardWheel = (e: WheelEvent) => {
      e.preventDefault();
      canvas.dispatchEvent(new WheelEvent("wheel", e));
    };
    layer.addEventListener("wheel", forwardWheel, { passive: false });
    const els = [...layer.querySelectorAll<HTMLElement>("[data-id]")];
    scene.onFrame = (project) => {
      for (const el of els) {
        const z = HAZARD_ZONES.find((x) => x.id === el.dataset.id)!;
        const c = project(z.lon, z.lat, 0.02);
        const e = project(z.lon + z.r, z.lat, 0.02);
        const r = Math.max(14, Math.hypot(e.x - c.x, e.y - c.y));
        const on = el.dataset.on === "1" && c.visible;
        el.style.transform = `translate(${c.x}px, ${c.y}px)`;
        el.style.opacity = on ? "1" : "0";
        el.style.pointerEvents = on ? "" : "none";
        const halo = el.firstElementChild as HTMLElement | null;
        if (halo) {
          halo.style.width = `${r * 2}px`;
          halo.style.height = `${r * 2}px`;
        }
      }
    };
    return () => {
      layer.removeEventListener("wheel", forwardWheel);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const open = (z: HazardZone) => {
    setActive(z);
    setKind(z.kind);
    sceneRef.current?.flyTo(z.lon, z.lat, Math.max(0.5, z.r * 5), Math.max(0.4, z.r * 3.5));
  };
  const pickKind = (k: HazardKind) => {
    setKind(k);
    setActive(null);
  };

  const last = useRef<Partial<HazardShot>>({});
  const direct = (s: Partial<HazardShot>, jump: boolean) => {
    const before = last.current;
    last.current = s;
    if (jump || s.focus !== before.focus) {
      const z = HAZARD_ZONES.find((x) => x.id === s.focus);
      if (z) sceneRef.current?.flyTo(z.lon, z.lat, Math.max(0.5, z.r * 5), Math.max(0.4, z.r * 3.5));
      else sceneRef.current?.home();
    }
    if (s.kinds?.length === 1) setKind(s.kinds[0]);
    setActive(null);
    setShot(s);
  };
  const driving = useNarrationDirector(HAZARD_CUES, direct);
  const narr = driving ? shot : null;
  const shownKinds = narr?.kinds ?? [kind];
  const lit = new Set(narr?.lit ?? []);

  return (
    <section ref={fsRef} className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative bg-[#dfe7ea]", sceneFrame)} data-scene>
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="საქართველოს რუკა: მეწყრის, ღვარცოფისა და ზვავის საშიში ზონები" />
        <FullscreenButton full={fsOn} onClick={fsToggle} className="absolute top-[3.75rem] right-3" />
        <div ref={labelsRef} className="absolute inset-0 overflow-hidden">
          {HAZARD_ZONES.map((z) => (
            <button key={z.id} type="button" data-id={z.id} data-on={shownKinds.includes(z.kind) || lit.has(z.id) ? "1" : "0"} onClick={() => open(z)} className={cn("absolute top-0 left-0 size-0 opacity-0 transition-opacity", (active?.id === z.id || lit.has(z.id)) && "z-10")}>
              <span className="pointer-events-none absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full border-2" style={{ borderColor: HAZARD_INFO[z.kind].color, backgroundColor: `${HAZARD_INFO[z.kind].color}33` }} />
              <span className={cn("absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[12px] font-semibold whitespace-nowrap text-white shadow-md", active?.id === z.id && "ring-2 ring-white", lit.has(z.id) && "text-[15px] ring-2 ring-[#ffd76a]")} style={{ backgroundColor: HAZARD_INFO[z.kind].color }}>
                {z.name}
              </span>
            </button>
          ))}
        </div>
        {narr?.panel && (
          <div className="absolute inset-x-3 top-14 bottom-24 z-20 mx-auto max-w-4xl overflow-hidden rounded-xl shadow-xl ring-1 ring-black/10 sm:bottom-28">
            {narr.panel === "forces" ? (
              <SlopeForces angle={narr.angle ?? 30} water={narr.water ?? 0} snow={narr.snow ?? 0} roots={!!narr.forest} push={!!narr.push} emph={narr.emph ?? null} />
            ) : (
              <SlopeView kind={narr.slope ?? "landslide"} input={{ angle: narr.angle ?? 28, water: narr.water ?? 0, snow: narr.snow ?? 0, forest: !!narr.forest }} run={narr.go ?? 0} />
            )}
          </div>
        )}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center gap-2 rounded-full bg-card/90 px-4 py-2 text-sm font-semibold text-copy shadow-sm">
              <Loader2 className="size-4 animate-spin" />
              რუკა იტვირთება…
            </span>
          </div>
        )}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button key={k} type="button" onClick={() => pickKind(k)} aria-pressed={kind === k} className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold shadow-sm", kind === k ? "text-white" : "bg-card/92 text-ink")} style={kind === k ? { backgroundColor: HAZARD_INFO[k].color } : undefined}>
              {HAZARD_INFO[k].plural}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => { setActive(null); sceneRef.current?.home(); }} title="მთელი საქართველო" aria-label="მთელი საქართველო" className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-lg bg-card/92 text-ink shadow-sm">
          <RotateCcw className="size-5" />
        </button>
      </div>

      <div className="grid gap-5 px-5 pt-4 lg:grid-cols-2">
        <div>
          <h2 className="text-lg">{active ? active.name : `${info.plural} საქართველოში`}</h2>
          {active ? (
            <p className="mt-2 text-[15px] leading-7 text-copy">{active.text}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {HAZARD_ZONES.filter((z) => z.kind === kind).map((z) => (
                <li key={z.id}>
                  <button type="button" onClick={() => open(z)} className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left hover:border-faint">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: info.color }} />
                    <span className="font-semibold">{z.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="text-lg">როგორ ხდება: {info.name}</h2>
          <p className="mt-1 text-[15px] leading-7 text-copy">{info.what}</p>
          <ol className="mt-2 flex list-decimal flex-col gap-2 ps-5 text-[15px] leading-7 text-copy">
            {info.how.map((h) => (
              <li key={h.slice(0, 24)}>{h}</li>
            ))}
          </ol>
        </div>
      </div>

      {kind !== "landslide" && (
        <div className="mx-5 mt-5 border-t border-chip pt-4">
          <h2 className="text-lg">3D მოდელი: {info.name}</h2>
          <div className="max-w-3xl">
            <HeroView key={kind} id={kind} />
          </div>
        </div>
      )}

      <div className="mx-5 mt-5 border-t border-chip pt-4">
        <h2 className="text-lg">ფერდობის მოდელი: {info.name}</h2>
        <div className="mt-3">
          <SlopeSim key={kind} kind={kind} />
        </div>
      </div>

      <div className="mx-5 mt-4 rounded-lg border border-[#cfe3d2] bg-[#f1f8f2] p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#2f6b34]">
          <ShieldCheck className="size-4" />
          როგორ დავიცვათ თავი
        </p>
        <ul className="mt-2 flex list-disc flex-col gap-1 ps-5 text-[14px] leading-6 text-copy">
          {info.safety.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <p className="px-5 py-3 text-[11px] leading-4 text-faint">ზონები მიახლოებითია და სასწავლოა — ეს არ არის ოფიციალური საფრთხის რუკა. რელიეფი: AWS Terrain Tiles (Mapzen); მდინარეები: OpenStreetMap.</p>
    </section>
  );
}
