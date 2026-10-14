"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { sceneFrame } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { cn } from "@/lib/utils";
import { GeorgiaScene } from "../GeorgiaScene";
import { WaterfallView } from "../waterfall/WaterfallView";
import { WATERFALL_IDS, type WaterfallId } from "../waterfall/waterfall-data";
import { KIND_INFO, RIVER_LANDFORMS, type LandformKind, type RiverLandform } from "./landforms-data";

/*
 * Topic 11 — gorges, waterfalls and deltas on the real relief of Georgia. Reuses the Georgia map scene
 * (terrain, rivers, satellite/physical colouring) and only adds its own labels and a guided list. For
 * waterfalls a close-up 3D model (WaterfallView) opens under the map.
 */

const KINDS: LandformKind[] = ["gorge", "waterfall", "delta"];

export function GeorgiaLandforms() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GeorgiaScene | null>(null);
  const [ready, setReady] = useState(false);
  const [kind, setKind] = useState<LandformKind>("gorge");
  const [active, setActive] = useState<RiverLandform | null>(null);
  const [fall, setFall] = useState<WaterfallId>("kinchkha");

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const scene = new GeorgiaScene(canvas, { onReady: () => setReady(true), onHover: () => {}, onSelect: () => {} });
    sceneRef.current = scene;
    scene.setLayer("satellite");
    scene.setOverlays({ rivers: true, lakes: false, cities: false, peaks: false });
    // Labels sit above the canvas: pass the wheel on, so zooming works with the cursor over a label too.
    const forwardWheel = (e: WheelEvent) => {
      e.preventDefault();
      canvas.dispatchEvent(new WheelEvent("wheel", e));
    };
    layer.addEventListener("wheel", forwardWheel, { passive: false });
    const els = [...layer.querySelectorAll<HTMLElement>("[data-id]")];
    scene.onFrame = (project) => {
      for (const el of els) {
        const f = RIVER_LANDFORMS.find((x) => x.id === el.dataset.id)!;
        const p = project(f.lon, f.lat, 0.1);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        const on = el.dataset.on === "1";
        el.style.opacity = p.visible && on ? "1" : "0";
        el.style.pointerEvents = p.visible && on ? "" : "none";
      }
    };
    return () => {
      layer.removeEventListener("wheel", forwardWheel);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const open = (f: RiverLandform) => {
    setActive(f);
    setKind(f.kind);
    if ((WATERFALL_IDS as string[]).includes(f.id)) setFall(f.id as WaterfallId);
    sceneRef.current?.flyTo(f.lon, f.lat, f.span, f.span * 0.7);
  };
  const home = () => {
    setActive(null);
    sceneRef.current?.home();
  };
  const info = KIND_INFO[kind];

  return (
    <section ref={fsRef} className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative bg-[#dfe7ea]", sceneFrame)} data-scene>
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="საქართველოს რელიეფი: ხეობები, ჩანჩქერები და დელტები" />
        <FullscreenButton full={fsOn} onClick={fsToggle} className="absolute top-[3.75rem] right-3" />
        <div ref={labelsRef} className="absolute inset-0 overflow-hidden">
          {RIVER_LANDFORMS.map((f) => (
            <button
              key={f.id}
              type="button"
              data-id={f.id}
              data-on={f.kind === kind ? "1" : "0"}
              onClick={() => open(f)}
              className={cn(
                "absolute top-0 left-0 flex flex-col items-center opacity-0 transition-opacity",
                active?.id === f.id ? "z-10" : "",
              )}
            >
              <span className={cn("rounded-md px-2 py-1 text-[12px] font-semibold whitespace-nowrap text-white shadow-md", active?.id === f.id && "ring-2 ring-white")} style={{ backgroundColor: KIND_INFO[f.kind].color }}>
                {f.name}
              </span>
              <span className="h-3 w-0.5 bg-card" />
              <span className="size-2 rounded-full border-2 border-white" style={{ backgroundColor: KIND_INFO[f.kind].color }} />
            </button>
          ))}
        </div>
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
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setActive(null);
              }}
              aria-pressed={kind === k}
              className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold shadow-sm", kind === k ? "text-white" : "bg-card/92 text-ink")}
              style={kind === k ? { backgroundColor: KIND_INFO[k].color } : undefined}
            >
              {KIND_INFO[k].plural}
            </button>
          ))}
        </div>
        <button type="button" onClick={home} title="მთელი საქართველო" aria-label="მთელი საქართველო" className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-lg bg-card/92 text-ink shadow-sm">
          <RotateCcw className="size-5" />
        </button>
      </div>

      <div className="grid gap-5 px-5 py-4 lg:grid-cols-2">
        <div>
          <h2 className="text-lg">როგორ წარმოიქმნება: {info.name}</h2>
          <ol className="mt-2 flex list-decimal flex-col gap-2 ps-5 text-[15px] leading-7 text-copy">
            {info.how.map((h) => (
              <li key={h.slice(0, 24)}>{h}</li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-lg">{active ? active.name : `${info.plural} საქართველოში`}</h2>
          {active ? (
            <>
              <p className="mt-1 text-sm text-mute">მდინარე: {active.river}</p>
              <p className="mt-2 text-[15px] leading-7 text-copy">{active.text}</p>
            </>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {RIVER_LANDFORMS.filter((f) => f.kind === kind).map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => open(f)} className="flex w-full items-center gap-3 rounded-lg border border-line px-3 py-2.5 text-left hover:border-faint">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: KIND_INFO[f.kind].color }} />
                    <span className="min-w-0">
                      <span className="block font-semibold">{f.name}</span>
                      <span className="block text-[13px] text-mute">მდ. {f.river}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {kind === "waterfall" && (
        <div className="mx-5 mb-4 border-t border-chip pt-4">
          <h2 className="text-lg">ჩანჩქერი ახლოდან</h2>
          <div className="mt-3">
            <WaterfallView
              id={fall}
              onPick={(id) => {
                setFall(id);
                const f = RIVER_LANDFORMS.find((x) => x.id === id);
                if (f) {
                  setActive(f);
                  sceneRef.current?.flyTo(f.lon, f.lat, f.span, f.span * 0.7);
                }
              }}
            />
          </div>
        </div>
      )}
      <p className="px-5 pb-3 text-[11px] leading-4 text-faint">რელიეფი: AWS Terrain Tiles (Mapzen); მდინარეები: OpenStreetMap. სიმაღლე გაზრდილია, რომ რელიეფი კარგად ჩანდეს.</p>
    </section>
  );
}
