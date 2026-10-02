"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Mountain, RotateCcw, ShieldAlert } from "lucide-react";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { cn } from "@/lib/utils";
import { CITIES, COUNTRY, PEAKS, REGIONS, REGION_BY_ID, type City, type Peak, type Region } from "./georgia-data";
import { ELEVATION_LEGEND, GeorgiaScene, type MapSelection } from "./GeorgiaScene";

type Selection = { kind: "country" } | { kind: "region"; region: Region } | { kind: "city"; city: City } | { kind: "peak"; peak: Peak };

/** Cities labelled even on the whole-country view. */
const MAJOR = new Set(["tbilisi", "batumi", "kutaisi", "sokhumi"]);

/** Labels on the map, where the full name doesn't fit. */
const SHORT_NAMES: Record<string, string> = {
  "samegrelo-zemo-svaneti": "სამეგრელო",
  "racha-lechkhumi": "რაჭა",
  "mtskheta-mtianeti": "მცხეთა-მთიანეთი",
};

export function GeorgiaMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GeorgiaScene | null>(null);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "country" });
  const [hover, setHover] = useState<string | null>(null);

  const select = (s: Selection) => {
    setSelection(s);
    const scene = sceneRef.current;
    if (!scene) return;
    if (s.kind === "country") {
      scene.select(null);
      scene.home();
    } else if (s.kind === "region") {
      const c = scene.regionCentre(s.region.id);
      scene.select({ kind: "region", id: s.region.id }, c ?? undefined);
    } else if (s.kind === "city") {
      scene.select({ kind: "city", id: s.city.id }, { lon: s.city.lon, lat: s.city.lat, span: 1.4 });
    } else {
      scene.select({ kind: "peak", id: s.peak.id }, { lon: s.peak.lon, lat: s.peak.lat, span: 1.8 });
    }
  };
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const scene = new GeorgiaScene(canvas, {
      onReady: () => setReady(true),
      onHoverRegion: setHover,
      onSelect: (s: MapSelection) => {
        if (!s) return selectRef.current({ kind: "country" });
        if (s.kind === "region") return selectRef.current({ kind: "region", region: REGION_BY_ID[s.id] });
        if (s.kind === "city") return selectRef.current({ kind: "city", city: CITIES.find((c) => c.id === s.id)! });
        selectRef.current({ kind: "peak", peak: PEAKS.find((p) => p.id === s.id)! });
      },
    });
    sceneRef.current = scene;
    scene.setPins([
      ...CITIES.map((c) => ({ id: c.id, lon: c.lon, lat: c.lat, kind: "city" as const, capital: c.capital })),
      ...PEAKS.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, kind: "peak" as const })),
    ]);

    // Labels follow the 3D view; they are moved directly, not re-rendered.
    const els = new Map<string, HTMLElement>();
    for (const el of layer.querySelectorAll<HTMLElement>("[data-label]")) els.set(el.dataset.label!, el);
    scene.onFrame = (project, distance) => {
      for (const [key, el] of els) {
        const [kind, id] = key.split(":");
        let p: { x: number; y: number; visible: boolean } | null = null;
        let show = false;
        if (kind === "region") {
          const c = scene.regionCentre(id);
          if (c) p = project(c.lon, c.lat, 0.04);
          show = distance > 3.2;
        } else if (kind === "city") {
          const c = CITIES.find((x) => x.id === id)!;
          p = project(c.lon, c.lat, 0.11);
          show = MAJOR.has(c.id) || (c.centre && distance < 6) || distance < 4 || el.dataset.active === "1";
        } else {
          const k = PEAKS.find((x) => x.id === id)!;
          p = project(k.lon, k.lat, 0.11);
          show = distance < 4.5 || el.dataset.active === "1";
        }
        const visible = !!p?.visible && show;
        el.style.opacity = visible ? "1" : "0";
        if (p) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      }
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setHoverRegion(hover);
  }, [hover]);

  const activeRegion = selection.kind === "region" ? selection.region.id : selection.kind === "city" ? selection.city.region : null;
  const activeKey = selection.kind === "city" ? `city:${selection.city.id}` : selection.kind === "peak" ? `peak:${selection.peak.id}` : null;

  const detail = (() => {
    if (selection.kind === "region") {
      const r = selection.region;
      return {
        eyebrow: r.kind === "capital" ? "დედაქალაქი" : r.kind === "autonomous" ? "ავტონომიური რესპუბლიკა" : "მხარე",
        title: r.name,
        text: r.text,
        facts: r.facts,
        occupied: r.occupied,
        list: CITIES.filter((c) => c.region === r.id),
      };
    }
    if (selection.kind === "city") {
      const c = selection.city;
      return {
        eyebrow: c.capital ? "დედაქალაქი" : `ქალაქი · ${REGION_BY_ID[c.region].name}`,
        title: c.name,
        text: c.text,
        facts: c.facts,
        occupied: c.region === "abkhazia" ? REGION_BY_ID.abkhazia.occupied : undefined,
        list: [],
      };
    }
    if (selection.kind === "peak") {
      const k = selection.peak;
      return { eyebrow: "მწვერვალი", title: k.name, text: k.text, facts: [`სიმაღლე — ${String(k.height).replace(/(\d)(\d{3})$/, "$1 $2")} მ`], occupied: undefined, list: [] };
    }
    return { eyebrow: "ქვეყანა", title: COUNTRY.name, text: COUNTRY.text, facts: COUNTRY.facts, occupied: undefined, list: [] };
  })();

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "გეოგრაფია", href: "/geography" }} topic="საქართველოს რუკა" color="#2f6fb0" icon="map" />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[56dvh_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-1">


        <div className="relative min-h-0 overflow-hidden bg-[#dfeaf1]">
          <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="საქართველოს 3D რუკა" />
          <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden">
            {REGIONS.filter((r) => r.id !== "tbilisi").map((r) => (
              <span
                key={r.id}
                data-label={`region:${r.id}`}
                className="absolute top-0 left-0 text-[13px] font-semibold whitespace-nowrap text-[#33413e] opacity-0 transition-opacity duration-300 [text-shadow:0_0_4px_#fff,0_0_8px_#fff]"
              >
                {SHORT_NAMES[r.id] ?? r.name}
              </span>
            ))}
            {CITIES.map((c) => (
              <button
                key={c.id}
                type="button"
                data-label={`city:${c.id}`}
                data-active={activeKey === `city:${c.id}` ? "1" : "0"}
                onClick={() => select({ kind: "city", city: c })}
                className={cn(
                  "pointer-events-auto absolute top-0 left-0 rounded-md border px-2 py-0.5 text-[12.5px] font-semibold whitespace-nowrap opacity-0 shadow-sm transition-[opacity,background-color] duration-300",
                  activeKey === `city:${c.id}` ? "border-[#1d4f84] bg-[#1d4f84] text-white" : c.capital ? "border-[#b8232b] bg-white text-[#8f1c22]" : "border-[#d5dcd9] bg-white/95 text-[#111a18]",
                )}
              >
                {c.name}
              </button>
            ))}
            {PEAKS.map((k) => (
              <button
                key={k.id}
                type="button"
                data-label={`peak:${k.id}`}
                data-active={activeKey === `peak:${k.id}` ? "1" : "0"}
                onClick={() => select({ kind: "peak", peak: k })}
                className={cn(
                  "pointer-events-auto absolute top-0 left-0 flex items-center gap-1 rounded-md border px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap opacity-0 shadow-sm transition-opacity duration-300",
                  activeKey === `peak:${k.id}` ? "border-[#1d4f84] bg-[#1d4f84] text-white" : "border-[#d8cfc4] bg-[#fbf8f4]/95 text-[#5b4a3a]",
                )}
              >
                <Mountain className="size-3" />
                {k.name.split(" ")[0]} · {k.height}
              </button>
            ))}
          </div>

          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium shadow-sm">
                <Loader2 className="size-4 animate-spin text-[#2f6fb0]" />
                რელიეფი იტვირთება…
              </span>
            </div>
          )}

          <button
            type="button"
            aria-label="საწყისი ხედი"
            title="მთელი საქართველო"
            onClick={() => select({ kind: "country" })}
            className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-lg border border-[#d5dcd9] bg-white shadow-sm hover:bg-[#f5f7f6]"
          >
            <RotateCcw className="size-4" />
          </button>

          {/* Elevation legend */}
          <div className="absolute bottom-3 left-3 rounded-lg border border-[#d5dcd9] bg-white/95 px-3 py-2 shadow-sm">
            <p className="text-[11px] font-semibold text-[#66736f]">სიმაღლე, მ</p>
            <div className="mt-1.5 flex items-end gap-0">
              {ELEVATION_LEGEND.map((s) => (
                <div key={s.height} className="flex w-9 flex-col items-center">
                  <span className="h-2.5 w-full" style={{ background: s.color }} />
                  <span className="mt-1 text-[10px] text-[#66736f]">{s.height}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <article className="atlas-scroll min-h-0 overflow-y-auto border-[#e2e7e5] bg-white px-6 py-6 max-lg:border-t lg:border-s">
          <p className="text-xs font-semibold text-[#2f6fb0]">{detail.eyebrow}</p>
          <h2 className="mt-1 text-2xl">{detail.title}</h2>
          {detail.occupied && (
            <p className="mt-3 flex items-start gap-2 rounded-md bg-[#fdf3f2] px-3 py-2 text-sm leading-6 text-[#912018]">
              <ShieldAlert className="mt-1 size-4 shrink-0" />
              {detail.occupied}
            </p>
          )}
          <p className="mt-4 text-[15px] leading-7 text-[#33413e]">{detail.text}</p>
          <ul className="mt-5 flex flex-col gap-2">
            {detail.facts.map((f) => (
              <li key={f} className="rounded-lg bg-[#f5f7f6] px-3 py-2 text-sm text-[#111a18]">
                {f}
              </li>
            ))}
          </ul>
          {detail.list.length > 0 && (
            <section className="mt-6">
              <h3 className="text-xs font-semibold text-[#66736f]">ქალაქები</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => select({ kind: "city", city: c })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d5dcd9] px-3 text-[13px] font-medium hover:bg-[#f5f7f6]"
                  >
                    <MapPin className="size-3.5 text-[#2f6fb0]" />
                    {c.name}
                  </button>
                ))}
              </div>
            </section>
          )}
          {(selection.kind === "country" || selection.kind === "region") && (
            <section className="mt-7 border-t border-[#e2e7e5] pt-5">
              <h3 className="text-xs font-semibold text-[#66736f]">მხარეები</h3>
              <ul className="mt-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-1">
                {REGIONS.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => select({ kind: "region", region: r })}
                      onMouseEnter={() => setHover(r.id)}
                      onMouseLeave={() => setHover(null)}
                      aria-current={activeRegion === r.id ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                        activeRegion === r.id ? "bg-[#e7f0f8] font-semibold text-[#1d4f84]" : hover === r.id ? "bg-[#f5f7f6]" : "text-[#33413e] hover:bg-[#f5f7f6]",
                      )}
                    >
                      <span className={cn("size-2 shrink-0 rounded-full", activeRegion === r.id ? "bg-[#1d4f84]" : "bg-[#c3ccc9]")} />
                      {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {selection.kind === "country" && (
            <p className="mt-6 rounded-lg border border-[#e2e7e5] px-3 py-2.5 text-sm leading-6 text-[#66736f]">
              აირჩიე მხარე, ქალაქი ან მწვერვალი რუკაზე. რუკის შემობრუნება — გადათრევით, გადიდება — ბორბლით ან თითებით.
            </p>
          )}
          {selection.kind !== "country" && (
            <button type="button" onClick={() => select({ kind: "country" })} className="mt-6 text-sm font-semibold text-[#2f6fb0] hover:underline">
              ← მთელი საქართველო
            </button>
          )}
          <p className="mt-8 text-[11px] leading-5 text-[#97a29e]">
            რელიეფი: AWS Terrain Tiles (Mapzen); საზღვრები: geoBoundaries (CC BY 3.0); მდინარეები გამოთვლილია რელიეფიდან; სიმაღლეები 6-ჯერ გაზრდილია. აფხაზეთი და ცხინვალის რეგიონი საქართველოს განუყოფელი ნაწილია.
          </p>
        </article>
      </div>
    </div>
  );
}
