"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Globe2, MapPin, Minus, Mountain, Plus, RotateCcw, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { CITIES, COUNTRY, PEAKS, REGIONS, REGION_BY_ID, type City, type Peak, type Region } from "./georgia-data";
import { MAP_HEIGHT, MAP_WIDTH, REGION_SHAPES, project } from "./georgia-shapes";

type Selection = { kind: "country" } | { kind: "region"; region: Region } | { kind: "city"; city: City } | { kind: "peak"; peak: Peak };

// Soft, distinct region tints (same palette family as the rest of the portal).
const TINTS: Record<string, string> = {
  tbilisi: "#e9d5cf",
  adjara: "#d8e9df",
  abkhazia: "#e6e2d4",
  "samegrelo-zemo-svaneti": "#d9e4ee",
  guria: "#e4ecd6",
  imereti: "#efe3cf",
  "racha-lechkhumi": "#dde8e3",
  "samtskhe-javakheti": "#e8dfea",
  "shida-kartli": "#e7ecd9",
  "mtskheta-mtianeti": "#d6e6ea",
  "kvemo-kartli": "#efe0d6",
  kakheti: "#e2dcec",
};

/** Labels on the map, where the full name doesn't fit inside the region. */
const SHORT_NAMES: Record<string, string> = {
  "samegrelo-zemo-svaneti": "სამეგრელო-ზ. სვანეთი",
  "racha-lechkhumi": "რაჭა-ლეჩხუმი",
};

export function GeorgiaMap() {
  const [selection, setSelection] = useState<Selection>({ kind: "country" });
  const [hover, setHover] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const activeRegion = selection.kind === "region" ? selection.region.id : selection.kind === "city" ? selection.city.region : null;
  const cities = useMemo(() => CITIES.map((c) => ({ c, p: project(c.lon, c.lat) })), []);
  const peaks = useMemo(() => PEAKS.map((k) => ({ k, p: project(k.lon, k.lat) })), []);
  const s = 1 / zoom; // keep markers and labels the same size on screen while zooming

  const zoomBy = (f: number) => setZoom((z) => Math.min(6, Math.max(1, z * f)));
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelection({ kind: "country" });
  };
  // Mouse/touch drag pans; a short tap still selects.
  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const svg = svgRef.current;
    if (!d || !svg) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 4) d.moved = true;
    if (!d.moved || zoom === 1) return;
    const k = MAP_WIDTH / svg.clientWidth / zoom;
    setPan({ x: d.px + dx * k, y: d.py + dy * k });
  };
  const onUp = () => setTimeout(() => (drag.current = null), 0);
  const tap = (fn: () => void) => () => {
    if (!drag.current?.moved) fn();
  };

  const vw = MAP_WIDTH / zoom;
  const vh = MAP_HEIGHT / zoom;
  const vx = (MAP_WIDTH - vw) / 2 - pan.x;
  const vy = (MAP_HEIGHT - vh) / 2 - pan.y;

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
      return { eyebrow: c.capital ? "დედაქალაქი" : `ქალაქი · ${REGION_BY_ID[c.region].name}`, title: c.name, text: c.text, facts: c.facts, occupied: c.region === "abkhazia" ? REGION_BY_ID.abkhazia.occupied : undefined, list: [] };
    }
    if (selection.kind === "peak") {
      const k = selection.peak;
      return { eyebrow: "მწვერვალი", title: k.name, text: k.text, facts: [`სიმაღლე — ${k.height.toLocaleString("en").replace(",", " ")} მ`], occupied: undefined, list: [] };
    }
    return { eyebrow: "ქვეყანა", title: COUNTRY.name, text: COUNTRY.text, facts: COUNTRY.facts, occupied: undefined, list: [] };
  })();

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#e2e7e5] bg-white px-4">
        <Link href="/dashboard" aria-label="პორტალზე დაბრუნება" className="flex size-9 items-center justify-center rounded-md text-[#33413e] hover:bg-[#eef2f0]">
          <ArrowLeft className="size-[18px]" />
        </Link>
        <span className="flex size-8 items-center justify-center rounded-md bg-[#2f6fb0] text-white">
          <Globe2 className="size-[18px]" />
        </span>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-[16px]">საქართველოს რუკა</h1>
          <p className="truncate text-xs text-[#66736f]">გეოგრაფია</p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_48dvh_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)_380px] lg:grid-rows-1">
        {/* Regions list */}
        <nav aria-label="მხარეები" className="atlas-scroll overflow-y-auto border-[#e2e7e5] bg-white max-lg:border-b lg:border-e">
          <ol className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0.5 lg:p-3">
            {REGIONS.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelection({ kind: "region", region: r })}
                  onMouseEnter={() => setHover(r.id)}
                  onMouseLeave={() => setHover(null)}
                  aria-current={activeRegion === r.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:whitespace-normal",
                    activeRegion === r.id ? "bg-[#e7f0f8] font-semibold text-[#1d4f84]" : "text-[#33413e] hover:bg-[#f5f7f6]",
                  )}
                >
                  <span className="size-3 shrink-0 rounded-sm border border-black/10" style={{ background: TINTS[r.id] }} />
                  {r.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Map */}
        <div className="relative min-h-0 overflow-hidden bg-[#dbe9f2]">
          <svg
            ref={svgRef}
            viewBox={`${vx} ${vy} ${vw} ${vh}`}
            className={cn("size-full touch-none select-none", zoom > 1 ? "cursor-grab active:cursor-grabbing" : "")}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={onUp}
            onWheel={(e) => zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2)}
            role="img"
            aria-label="საქართველოს ინტერაქტიული რუკა"
          >
            <text x={60} y={170} className="fill-[#7fa6c6] text-[22px] italic" style={{ fontSize: 22 * s }}>
              შავი ზღვა
            </text>
            {REGION_SHAPES.map((r) => {
              const active = activeRegion === r.id;
              const hovered = hover === r.id;
              return (
                <path
                  key={r.id}
                  d={r.d}
                  fill={TINTS[r.id]}
                  stroke={active ? "#1d4f84" : "#ffffff"}
                  strokeWidth={(active ? 2.4 : 1.2) * s}
                  strokeLinejoin="round"
                  className="cursor-pointer transition-[filter] duration-150"
                  style={{ filter: active ? "brightness(0.92) saturate(1.6)" : hovered ? "brightness(0.95) saturate(1.3)" : undefined }}
                  onMouseEnter={() => setHover(r.id)}
                  onMouseLeave={() => setHover(null)}
                  onClick={tap(() => setSelection({ kind: "region", region: REGION_BY_ID[r.id] }))}
                >
                  <title>{REGION_BY_ID[r.id].name}</title>
                </path>
              );
            })}
            {/* Region names (hidden when zoomed in, where city names take over) */}
            {zoom < 2 &&
              REGION_SHAPES.filter((r) => r.id !== "tbilisi").map((r) => (
                <text key={r.id} x={r.cx} y={r.cy} textAnchor="middle" className="pointer-events-none fill-[#66736f] font-semibold" style={{ fontSize: 12.5 * s }}>
                  {SHORT_NAMES[r.id] ?? REGION_BY_ID[r.id].name}
                </text>
              ))}
            {peaks.map(({ k, p }) => (
              <g key={k.id} transform={`translate(${p[0]} ${p[1]})`} className="cursor-pointer" onClick={tap(() => setSelection({ kind: "peak", peak: k }))}>
                <path d={`M0 ${-9 * s} L${8 * s} ${5 * s} L${-8 * s} ${5 * s} Z`} fill={selection.kind === "peak" && selection.peak.id === k.id ? "#1d4f84" : "#7b6a58"} stroke="#fff" strokeWidth={1.2 * s} />
                <title>{`${k.name} — ${k.height} მ`}</title>
              </g>
            ))}
            {cities.map(({ c, p }) => {
              const active = selection.kind === "city" && selection.city.id === c.id;
              const r = (c.capital ? 7 : c.centre ? 5 : 3.8) * s;
              const showName = c.capital || c.centre || zoom >= 2 || active;
              return (
                <g key={c.id} transform={`translate(${p[0]} ${p[1]})`} className="cursor-pointer" onClick={tap(() => setSelection({ kind: "city", city: c }))}>
                  <circle r={r + 6 * s} fill="transparent" />
                  {c.capital && <circle r={r + 3.5 * s} fill="none" stroke="#b8232b" strokeWidth={1.6 * s} />}
                  <circle r={r} fill={active ? "#1d4f84" : c.capital ? "#b8232b" : "#111a18"} stroke="#fff" strokeWidth={1.6 * s} />
                  {showName && (
                    <text x={r + 4 * s} y={4 * s} className="fill-[#111a18] font-semibold" style={{ fontSize: (c.capital ? 15 : 12.5) * s, paintOrder: "stroke", stroke: "#ffffff", strokeWidth: 3.5 * s }}>
                      {c.name}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="absolute right-3 bottom-3 flex flex-col overflow-hidden rounded-lg border border-[#d5dcd9] bg-white shadow-sm">
            <button type="button" aria-label="გადიდება" onClick={() => zoomBy(1.4)} className="flex size-10 items-center justify-center hover:bg-[#f5f7f6]">
              <Plus className="size-[18px]" />
            </button>
            <button type="button" aria-label="დაპატარავება" onClick={() => zoomBy(1 / 1.4)} className="flex size-10 items-center justify-center border-t border-[#e2e7e5] hover:bg-[#f5f7f6]">
              <Minus className="size-[18px]" />
            </button>
            <button type="button" aria-label="საწყისი ხედი" onClick={reset} className="flex size-10 items-center justify-center border-t border-[#e2e7e5] hover:bg-[#f5f7f6]">
              <RotateCcw className="size-4" />
            </button>
          </div>
          <div className="absolute bottom-3 left-3 flex gap-3 rounded-lg border border-[#d5dcd9] bg-white/95 px-3 py-2 text-xs text-[#33413e] shadow-sm">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border-2 border-[#b8232b] bg-[#b8232b]" />
              დედაქალაქი
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[#111a18]" />
              ქალაქი
            </span>
            <span className="flex items-center gap-1.5">
              <Mountain className="size-3.5 text-[#7b6a58]" />
              მწვერვალი
            </span>
          </div>
        </div>

        {/* Details */}
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
              <h3 className="text-xs font-semibold text-[#66736f]">ქალაქები რუკაზე</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.list.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelection({ kind: "city", city: c })}
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d5dcd9] px-3 text-[13px] font-medium hover:bg-[#f5f7f6]"
                  >
                    <MapPin className="size-3.5 text-[#2f6fb0]" />
                    {c.name}
                  </button>
                ))}
              </div>
            </section>
          )}
          {selection.kind !== "country" && (
            <button type="button" onClick={() => setSelection({ kind: "country" })} className="mt-6 text-sm font-semibold text-[#2f6fb0] hover:underline">
              ← მთელი საქართველო
            </button>
          )}
          <p className="mt-8 text-[11px] leading-5 text-[#97a29e]">საზღვრები: geoBoundaries (CC BY 3.0). აფხაზეთი და ცხინვალის რეგიონი საქართველოს განუყოფელი ნაწილია.</p>
        </article>
      </div>
    </div>
  );
}
