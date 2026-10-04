"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Droplets, Layers, Loader2, MapPin, Mountain, RotateCcw, ShieldAlert, Waves } from "lucide-react";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { cn } from "@/lib/utils";
import {
  BASIN_NAMES,
  CITIES,
  CLIMATES,
  COUNTRY,
  LAKES,
  LANDFORMS,
  LANDFORM_KINDS,
  LAYERS,
  PEAKS,
  REGIONS,
  REGION_BY_ID,
  REGION_COLORS,
  RIVERS,
  ZONES,
  type City,
  type Lake,
  type Landform,
  type MapLayer,
  type Peak,
  type Region,
  type River,
} from "./georgia-data";
import { ELEVATION_LEGEND, GeorgiaScene, type HoverInfo, type MapSelection, type Overlays } from "./GeorgiaScene";

type Selection =
  | { kind: "country" }
  | { kind: "region"; region: Region }
  | { kind: "city"; city: City }
  | { kind: "peak"; peak: Peak }
  | { kind: "river"; river: River }
  | { kind: "lake"; lake: Lake }
  | { kind: "landform"; landform: Landform };

type Tab = "regions" | "cities" | "rivers" | "relief" | "lakes";
type Labels = Overlays & { landforms: boolean };

const TABS: { id: Tab; name: string }[] = [
  { id: "regions", name: "მხარეები" },
  { id: "cities", name: "ქალაქები" },
  { id: "rivers", name: "მდინარეები" },
  { id: "relief", name: "რელიეფი" },
  { id: "lakes", name: "ტბები" },
];

const TOGGLES: { id: keyof Labels; name: string }[] = [
  { id: "rivers", name: "მდინარეები" },
  { id: "lakes", name: "ტბები" },
  { id: "cities", name: "ქალაქები" },
  { id: "peaks", name: "მწვერვალები" },
  { id: "landforms", name: "რელიეფის ფორმები" },
];

/** Cities labelled even on the whole-country view. */
const MAJOR = new Set(["tbilisi", "batumi", "kutaisi", "sokhumi"]);
/** Landforms labelled on the whole-country view (the rest appear when zoomed in). */
const MAJOR_LANDFORMS = new Set(["greater-caucasus", "lesser-caucasus", "likhi", "kolkheti", "alazani-valley", "iori-plateau", "javakheti"]);
/** Rivers labelled on the whole-country view. */
const MAJOR_RIVERS = new Set(["mtkvari", "rioni", "alazani", "enguri", "iori"]);

/** Labels on the map, where the full name doesn't fit. */
const SHORT_NAMES: Record<string, string> = {
  "samegrelo-zemo-svaneti": "სამეგრელო",
  "racha-lechkhumi": "რაჭა",
  "mtskheta-mtianeti": "მცხეთა-მთიანეთი",
};

const LANDFORM_SPAN: Record<string, number> = { "greater-caucasus": 4.6, "lesser-caucasus": 2.6 };
const fmt = (n: number) => String(n).replace(/(\d)(\d{3})$/, "$1 $2");

function Swatches({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="mt-2 grid gap-1">
      {items.map((z) => (
        <li key={z.label} className="flex items-center gap-2 text-[12px] leading-4 text-[#33413e]">
          <span className="size-3 shrink-0 rounded-sm border border-black/10" style={{ background: z.color }} />
          {z.label}
        </li>
      ))}
    </ul>
  );
}

interface Stat {
  value: number;
  year: number | null;
}
interface MediaEntry {
  wiki?: { title: string; url: string; lang: string; intro?: string };
  wikidata?: string;
  stats?: Partial<Record<"population" | "elevation" | "area" | "length" | "depth" | "basin" | "discharge", Stat>>;
  image?: { src: string; width: number; height: number; author: string; license: string; page: string };
}
type MediaKind = "region" | "city" | "peak" | "river" | "lake" | "landform";
type Media = Partial<Record<MediaKind, Record<string, MediaEntry>>>;

/** Georgian number style: spaces between thousands, a comma for decimals. */
const num = (v: number, digits = 0) => {
  const [int, dec] = v.toFixed(digits).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec && Number(dec) ? `${grouped},${dec.replace(/0+$/, "")}` : grouped;
};

/** Which Wikidata figures to show for each kind of place, and how. */
const STAT_ROWS: Record<MediaKind, { key: keyof NonNullable<MediaEntry["stats"]>; label: string; unit: string; digits?: number }[]> = {
  region: [
    { key: "population", label: "მოსახლეობა", unit: "" },
    { key: "area", label: "ფართობი", unit: "კმ²" },
  ],
  city: [
    { key: "population", label: "მოსახლეობა", unit: "" },
    { key: "elevation", label: "სიმაღლე ზ.დ.", unit: "მ" },
    { key: "area", label: "ფართობი", unit: "კმ²", digits: 1 },
  ],
  peak: [],
  river: [
    { key: "length", label: "სიგრძე", unit: "კმ" },
    { key: "basin", label: "აუზის ფართობი", unit: "კმ²" },
    { key: "discharge", label: "საშუალო ხარჯი", unit: "მ³/წმ", digits: 1 },
  ],
  lake: [
    { key: "area", label: "ფართობი", unit: "კმ²", digits: 1 },
    { key: "elevation", label: "სიმაღლე ზ.დ.", unit: "მ" },
    { key: "depth", label: "უდიდესი სიღრმე", unit: "მ", digits: 1 },
    { key: "length", label: "სიგრძე", unit: "კმ", digits: 1 },
  ],
  landform: [{ key: "length", label: "სიგრძე", unit: "კმ" }],
};

function Photo({ image, alt }: { image: NonNullable<MediaEntry["image"]>; alt: string }) {
  return (
    <figure className="-mx-6 -mt-6 mb-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- local, pre-sized photos */}
      <img src={image.src} alt={alt} width={image.width} height={image.height} className="aspect-[16/10] w-full bg-[#eef2f0] object-cover" />
      <figcaption className="px-6 pt-1.5 text-[10.5px] leading-4 text-[#97a29e]">
        ფოტო:{" "}
        <a href={image.page} target="_blank" rel="noreferrer" className="hover:underline">
          {image.author} · {image.license}
        </a>{" "}
        · Wikimedia Commons
      </figcaption>
    </figure>
  );
}

function Stats({ kind, entry }: { kind: MediaKind; entry?: MediaEntry }) {
  const rows = STAT_ROWS[kind].filter((r) => entry?.stats?.[r.key]);
  if (!rows.length) return null;
  return (
    <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
      {rows.map((r) => {
        const st = entry!.stats![r.key]!;
        return (
          <div key={r.key} className="rounded-lg bg-[#f5f7f6] px-3 py-2.5">
            <dt className="text-[11px] leading-4 text-[#66736f]">
              {r.label}
              {st.year ? ` (${st.year})` : ""}
            </dt>
            <dd className="mt-1 text-base leading-5 font-semibold tabular-nums">
              {num(st.value, r.digits ?? 0)} {r.unit}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function WikiIntro({ entry }: { entry?: MediaEntry }) {
  if (!entry?.wiki) return null;
  return (
    <section className="mt-6 rounded-xl border border-[#e2e7e5] p-4">
      <h3 className="text-xs font-semibold text-[#66736f]">ვიკიპედიიდან</h3>
      {entry.wiki.intro && <p className="mt-2 text-sm leading-6 text-[#33413e]">{entry.wiki.intro}</p>}
      <a href={entry.wiki.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-semibold text-[#2f6fb0] hover:underline">
        სრული სტატია: {entry.wiki.title} →
      </a>
      <p className="mt-2 text-[10.5px] leading-4 text-[#97a29e]">
        ტექსტი: ვიკიპედია, CC BY-SA 4.0{entry.wikidata ? ` · ციფრები: ვიკიმონაცემები (${entry.wikidata})` : ""}
      </p>
    </section>
  );
}

function Thumb({ entry }: { entry?: MediaEntry }) {
  if (!entry?.image) return null;
  // eslint-disable-next-line @next/next/no-img-element -- small local thumbnail
  return <img src={entry.image.src} alt="" loading="lazy" className="size-9 shrink-0 rounded-md bg-[#eef2f0] object-cover" />;
}

function ListItem({
  active,
  onClick,
  onEnter,
  onLeave,
  children,
}: {
  active: boolean;
  onClick: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
          active ? "bg-[#e7f0f8] font-semibold text-[#1d4f84]" : "text-[#33413e] hover:bg-[#f5f7f6]",
        )}
      >
        {children}
      </button>
    </li>
  );
}

export function GeorgiaMap({ initialLayer = "satellite" }: { initialLayer?: MapLayer }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GeorgiaScene | null>(null);
  const [ready, setReady] = useState(false);
  const [selection, setSelection] = useState<Selection>({ kind: "country" });
  const [hover, setHover] = useState<string | null>(null);
  const [point, setPoint] = useState<HoverInfo | null>(null);
  const [media, setMedia] = useState<Media>({});
  useEffect(() => {
    fetch("/geo/georgia-media.json?v=2026-10-04")
      .then((r) => r.json() as Promise<Media>)
      .then(setMedia)
      .catch(() => setMedia({}));
  }, []);
  const [layer, setLayer] = useState<MapLayer>(initialLayer);
  const [labels, setLabels] = useState<Labels>({ rivers: true, lakes: true, cities: true, peaks: true, landforms: true });
  const [tab, setTab] = useState<Tab>("regions");
  /** null = not touched yet: open on wide screens, closed on phones (it would cover the map). */
  const [layersOpen, setLayersOpen] = useState<boolean | null>(null);
  const labelsState = useRef({ ...labels, political: initialLayer === "political" });

  const select = (s: Selection) => {
    setSelection(s);
    const scene = sceneRef.current;
    if (!scene) return;
    if (s.kind === "country") {
      scene.select(null);
      scene.home();
    } else if (s.kind === "region") {
      scene.select({ kind: "region", id: s.region.id }, scene.regionCentre(s.region.id) ?? undefined);
    } else if (s.kind === "city") {
      scene.select({ kind: "city", id: s.city.id }, { lon: s.city.lon, lat: s.city.lat, span: 1.4 });
    } else if (s.kind === "peak") {
      const p = scene.peakPosition(s.peak.id) ?? s.peak;
      scene.select({ kind: "peak", id: s.peak.id }, { lon: p.lon, lat: p.lat, span: 1.6 });
    } else if (s.kind === "river") {
      setLabels((l) => ({ ...l, rivers: true }));
      scene.select({ kind: "river", id: s.river.id }, scene.riverInfo(s.river.id)?.focus);
    } else if (s.kind === "lake") {
      setLabels((l) => ({ ...l, lakes: true }));
      scene.select({ kind: "lake", id: s.lake.id }, { lon: s.lake.lon, lat: s.lake.lat, span: 0.7 });
    } else {
      const span = LANDFORM_SPAN[s.landform.id] ?? 1.3;
      scene.select(null, { lon: s.landform.lon, lat: s.landform.lat, span, depth: span * 0.6 });
    }
  };
  const selectRef = useRef(select);
  useEffect(() => {
    selectRef.current = select;
    labelsState.current = { ...labels, political: layer === "political" };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const layerEl = labelsRef.current;
    if (!canvas || !layerEl) return;
    const scene = new GeorgiaScene(canvas, {
      onReady: () => setReady(true),
      onHover: (h) => {
        setPoint(h);
        setHover(h?.region ?? null);
      },
      onSelect: (s: MapSelection) => {
        const go = selectRef.current;
        if (!s) return go({ kind: "country" });
        if (s.kind === "region") return go({ kind: "region", region: REGION_BY_ID[s.id] });
        if (s.kind === "city") return go({ kind: "city", city: CITIES.find((c) => c.id === s.id)! });
        if (s.kind === "river") return go({ kind: "river", river: RIVERS.find((r) => r.id === s.id)! });
        if (s.kind === "lake") return go({ kind: "lake", lake: LAKES.find((l) => l.id === s.id)! });
        go({ kind: "peak", peak: PEAKS.find((p) => p.id === s.id)! });
      },
    });
    sceneRef.current = scene;
    scene.setLayer(initialLayer);
    scene.setPins([
      ...CITIES.map((c) => ({ id: c.id, lon: c.lon, lat: c.lat, kind: "city" as const, capital: c.capital })),
      ...PEAKS.map((p) => ({ id: p.id, lon: p.lon, lat: p.lat, kind: "peak" as const })),
    ]);
    scene.setLakes(LAKES);

    // Labels follow the 3D view; they are moved directly, not re-rendered.
    const els = new Map<string, HTMLElement>();
    for (const el of layerEl.querySelectorAll<HTMLElement>("[data-label]")) els.set(el.dataset.label!, el);
    // Label sizes, measured once (they don't change).
    const sizes = new Map<HTMLElement, { w: number; h: number }>();
    const size = (el: HTMLElement) => {
      let s = sizes.get(el);
      if (!s || !s.w) {
        s = { w: el.offsetWidth, h: el.offsetHeight };
        sizes.set(el, s);
      }
      return s;
    };
    /** Lower number wins when labels overlap. */
    const priority = (kind: string, id: string, active: boolean) => {
      if (active) return 0;
      if (kind === "city") return CITIES.find((c) => c.id === id)?.capital ? 1 : MAJOR.has(id) ? 2 : 3;
      return { peak: 4, river: 5, lake: 6, landform: 7, region: 8 }[kind] ?? 9;
    };
    scene.onFrame = (project, distance) => {
      const on = labelsState.current;
      const shown: { el: HTMLElement; x: number; y: number; w: number; h: number; prio: number }[] = [];
      for (const [key, el] of els) {
        const [kind, id] = key.split(":");
        const active = el.dataset.active === "1";
        let p: { x: number; y: number; visible: boolean } | null = null;
        let show = false;
        if (kind === "region") {
          const c = scene.regionCentre(id);
          if (c) p = project(c.lon, c.lat, 0.04);
          show = distance > 3.2 && (on.political || !on.landforms);
        } else if (kind === "city") {
          const c = CITIES.find((x) => x.id === id)!;
          p = project(c.lon, c.lat, 0.11);
          show = on.cities && (MAJOR.has(c.id) || (c.centre && distance < 6) || distance < 4 || active);
        } else if (kind === "peak") {
          const k = scene.peakPosition(id) ?? PEAKS.find((x) => x.id === id)!;
          p = project(k.lon, k.lat, 0.11);
          show = on.peaks && (distance < 4.5 || active);
        } else if (kind === "river") {
          const info = scene.riverInfo(id);
          if (info) p = project(info.label.lon, info.label.lat, 0.01);
          show = on.rivers && (MAJOR_RIVERS.has(id) || distance < 4.2 || active);
        } else if (kind === "lake") {
          const l = LAKES.find((x) => x.id === id)!;
          p = project(l.lon, l.lat, 0.02);
          show = on.lakes && (distance < 4 || active);
        } else {
          const f = LANDFORMS.find((x) => x.id === id)!;
          p = project(f.lon, f.lat, 0.05);
          show = on.landforms && !on.political && ((distance > 1.6 && (distance < 4.2 || MAJOR_LANDFORMS.has(id))) || active);
        }
        const pinned = kind === "city" || kind === "peak";
        if (p) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, ${pinned ? "-100%" : "-50%"})`;
        if (p?.visible && show) {
          const { w, h } = size(el);
          // Box in screen space (labels on pins sit above their point).
          shown.push({ el, x: p.x - w / 2, y: pinned ? p.y - h : p.y - h / 2, w, h, prio: priority(kind, id, active) });
        } else {
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
        }
      }
      // Hide labels that would overlap a more important one.
      shown.sort((a, b) => a.prio - b.prio);
      const placed: typeof shown = [];
      for (const l of shown) {
        const hit = placed.some((q) => l.x < q.x + q.w + 3 && q.x < l.x + l.w + 3 && l.y < q.y + q.h + 2 && q.y < l.y + l.h + 2);
        l.el.style.opacity = hit ? "0" : "1";
        l.el.style.pointerEvents = hit ? "none" : "";
        if (!hit) placed.push(l);
      }
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [initialLayer]);

  useEffect(() => {
    sceneRef.current?.setHoverRegion(hover);
  }, [hover]);
  useEffect(() => {
    sceneRef.current?.setLayer(layer);
  }, [layer]);
  useEffect(() => {
    sceneRef.current?.setOverlays(labels);
  }, [labels]);

  const activeRegion = selection.kind === "region" ? selection.region.id : selection.kind === "city" ? selection.city.region : null;
  const activeKey =
    selection.kind === "city"
      ? `city:${selection.city.id}`
      : selection.kind === "peak"
        ? `peak:${selection.peak.id}`
        : selection.kind === "river"
          ? `river:${selection.river.id}`
          : selection.kind === "lake"
            ? `lake:${selection.lake.id}`
            : selection.kind === "landform"
              ? `landform:${selection.landform.id}`
              : null;
  const layerInfo = LAYERS.find((l) => l.id === layer)!;
  const mediaKey: [MediaKind, string] | null =
    selection.kind === "country"
      ? null
      : [
          selection.kind,
          selection.kind === "region"
            ? selection.region.id
            : selection.kind === "city"
              ? selection.city.id
              : selection.kind === "peak"
                ? selection.peak.id
                : selection.kind === "river"
                  ? selection.river.id
                  : selection.kind === "lake"
                    ? selection.lake.id
                    : selection.landform.id,
        ];
  const detailMedia = mediaKey ? media[mediaKey[0]]?.[mediaKey[1]] : undefined;

  const detail = (() => {
    switch (selection.kind) {
      case "region": {
        const r = selection.region;
        return {
          eyebrow: r.kind === "capital" ? "დედაქალაქი" : r.kind === "autonomous" ? "ავტონომიური რესპუბლიკა" : "მხარე",
          title: r.name,
          text: r.text,
          facts: r.facts,
          occupied: r.occupied,
        };
      }
      case "city": {
        const c = selection.city;
        return {
          eyebrow: c.capital ? "დედაქალაქი" : `ქალაქი · ${REGION_BY_ID[c.region].name}`,
          title: c.name,
          text: c.text,
          facts: c.facts,
          occupied: c.region === "abkhazia" ? REGION_BY_ID.abkhazia.occupied : undefined,
        };
      }
      case "peak":
        return { eyebrow: "მწვერვალი", title: selection.peak.name, text: selection.peak.text, facts: [`სიმაღლე — ${fmt(selection.peak.height)} მ`] };
      case "river":
        return { eyebrow: `მდინარე · ${BASIN_NAMES[selection.river.basin]}`, title: selection.river.name, text: selection.river.text, facts: selection.river.facts };
      case "lake":
        return { eyebrow: selection.lake.kind === "lake" ? "ტბა" : "წყალსაცავი", title: selection.lake.name, text: selection.lake.text, facts: selection.lake.facts };
      case "landform":
        return { eyebrow: LANDFORM_KINDS[selection.landform.kind], title: selection.landform.name, text: selection.landform.text, facts: selection.landform.facts };
      default:
        return null;
    }
  })();

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "გეოგრაფია", href: "/geography" }} topic="საქართველოს რუკა" color="#2f6fb0" icon="map" />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[58dvh_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_400px] lg:grid-rows-1">
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
            {LANDFORMS.map((f) => (
              <button
                key={f.id}
                type="button"
                data-label={`landform:${f.id}`}
                data-active={activeKey === `landform:${f.id}` ? "1" : "0"}
                onClick={() => select({ kind: "landform", landform: f })}
                className={cn(
                  "pointer-events-auto absolute top-0 left-0 text-[12.5px] font-semibold tracking-[0.08em] whitespace-nowrap opacity-0 transition-opacity duration-300 [text-shadow:0_0_3px_#fff,0_0_6px_#fff,0_0_10px_#fff]",
                  activeKey === `landform:${f.id}`
                    ? "text-[#1d4f84]"
                    : layer === "satellite"
                      ? "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_8px_rgba(0,0,0,0.6)]"
                      : f.kind === "range"
                        ? "text-[#6b4a2e]"
                        : "text-[#4b6a35]",
                )}
              >
                {f.name}
              </button>
            ))}
            {RIVERS.map((r) => (
              <button
                key={r.id}
                type="button"
                data-label={`river:${r.id}`}
                data-active={activeKey === `river:${r.id}` ? "1" : "0"}
                onClick={() => select({ kind: "river", river: r })}
                className={cn(
                  "pointer-events-auto absolute top-0 left-0 text-[12px] font-semibold whitespace-nowrap italic opacity-0 transition-opacity duration-300 [text-shadow:0_0_3px_#fff,0_0_6px_#fff]",
                  activeKey === `river:${r.id}`
                    ? "text-[#0b4fb0]"
                    : layer === "satellite"
                      ? "text-[#cfe6ff] [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_6px_rgba(0,0,0,0.6)]"
                      : "text-[#2366a8]",
                )}
              >
                {r.name}
              </button>
            ))}
            {LAKES.map((l) => (
              <button
                key={l.id}
                type="button"
                data-label={`lake:${l.id}`}
                data-active={activeKey === `lake:${l.id}` ? "1" : "0"}
                onClick={() => select({ kind: "lake", lake: l })}
                className={cn(
                  "pointer-events-auto absolute top-0 left-0 mt-4 rounded px-1 text-[11.5px] font-semibold whitespace-nowrap opacity-0 transition-opacity duration-300 [text-shadow:0_0_3px_#fff,0_0_6px_#fff]",
                  activeKey === `lake:${l.id}`
                    ? "bg-[#1d4f84] text-white [text-shadow:none]"
                    : layer === "satellite"
                      ? "text-[#cfe6ff] [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_0_6px_rgba(0,0,0,0.6)]"
                      : "text-[#1f5f99]",
                )}
              >
                {l.name}
              </button>
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
                {k.name.replace(/ \(.*\)$/, "")} · {fmt(k.height)}
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

          {/* Layers */}
          <div className="absolute top-3 left-3 max-w-[calc(100%-4.5rem)] rounded-xl border border-[#d5dcd9] bg-white/95 shadow-sm backdrop-blur">
            <button
              type="button"
              onClick={() => setLayersOpen(!(layersOpen ?? window.matchMedia("(min-width: 1024px)").matches))}
              aria-expanded={layersOpen ?? undefined}
              className="flex w-full items-center gap-2 px-3 py-2 text-[13px] font-semibold"
            >
              <Layers className="size-4 text-[#2f6fb0]" />
              შრეები
              <span className="ms-auto text-xs font-medium text-[#66736f]">{layerInfo.name}</span>
            </button>
            {layersOpen !== false && (
              <div className={cn("border-t border-[#e2e7e5] p-2", layersOpen === null && "max-lg:hidden")}>
                <div className="flex flex-wrap gap-1">
                  {LAYERS.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={layer === l.id}
                      onClick={() => setLayer(l.id)}
                      className={cn(
                        "h-9 grow rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors",
                        layer === l.id ? "bg-[#111a18] text-white" : "bg-[#f1f4f3] text-[#33413e] hover:bg-[#e6ebe9]",
                      )}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {TOGGLES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      aria-pressed={labels[t.id]}
                      onClick={() => setLabels((s) => ({ ...s, [t.id]: !s[t.id] }))}
                      className={cn(
                        "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-[12px] font-medium whitespace-nowrap transition-colors",
                        labels[t.id] ? "border-[#2f6fb0] bg-[#eaf2fa] text-[#1d4f84]" : "border-[#d5dcd9] bg-white text-[#66736f] hover:bg-[#f5f7f6]",
                      )}
                    >
                      {labels[t.id] && <Check className="size-3.5" />}
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label="საწყისი ხედი"
            title="მთელი საქართველო"
            onClick={() => select({ kind: "country" })}
            className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-lg border border-[#d5dcd9] bg-white shadow-sm hover:bg-[#f5f7f6]"
          >
            <RotateCcw className="size-4" />
          </button>

          {/* Legend of the active layer */}
          <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-lg border border-[#d5dcd9] bg-white/95 px-3 py-2 shadow-sm">
            {layer === "satellite" && (
              <>
                <p className="text-[11px] font-semibold text-[#66736f]">სატელიტური სურათი</p>
                <p className="mt-1 text-[12px] text-[#33413e]">Sentinel-2, 2024 · ღრუბლების გარეშე</p>
              </>
            )}
            {layer === "physical" && (
              <>
                <p className="text-[11px] font-semibold text-[#66736f]">სიმაღლე ზღვის დონიდან, მ</p>
                <div className="mt-1.5 flex items-end">
                  {ELEVATION_LEGEND.map((s) => (
                    <div key={s.height} className="flex w-9 flex-col items-center">
                      <span className="h-2.5 w-full" style={{ background: s.color }} />
                      <span className="mt-1 text-[10px] text-[#66736f]">{s.height}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {layer === "political" && (
              <>
                <p className="text-[11px] font-semibold text-[#66736f]">ადმინისტრაციული ერთეულები</p>
                <p className="mt-1 text-[12px] text-[#33413e]">9 მხარე · 2 ავტონომიური რესპუბლიკა · დედაქალაქი</p>
              </>
            )}
            {layer === "zones" && (
              <>
                <p className="text-[11px] font-semibold text-[#66736f]">ბუნებრივი ზონები</p>
                <Swatches items={ZONES} />
              </>
            )}
            {layer === "climate" && (
              <>
                <p className="text-[11px] font-semibold text-[#66736f]">ჰავის ტიპები</p>
                <Swatches items={CLIMATES} />
              </>
            )}
          </div>

          {point && (
            <div className="pointer-events-none absolute right-3 bottom-3 rounded-lg border border-[#d5dcd9] bg-white/95 px-3 py-2 text-right shadow-sm">
              <p className="text-base leading-5 font-semibold tabular-nums">{fmt(Math.max(0, point.height))} მ</p>
              <p className="mt-0.5 text-[11px] text-[#66736f] tabular-nums">
                {point.lat.toFixed(2)}° ჩ.გ. · {point.lon.toFixed(2)}° ა.გ.{point.region ? ` · ${REGION_BY_ID[point.region].name}` : ""}
              </p>
            </div>
          )}
        </div>

        <article className="atlas-scroll min-h-0 overflow-y-auto border-[#e2e7e5] bg-white px-6 py-6 max-lg:border-t lg:border-s">
          {detail ? (
            <>
              {detailMedia?.image && <Photo key={detailMedia.image.src} image={detailMedia.image} alt={detail.title} />}
              <p className="text-xs font-semibold text-[#2f6fb0]">{detail.eyebrow}</p>
              <h2 className="mt-1 text-2xl">{detail.title}</h2>
              {"occupied" in detail && detail.occupied && (
                <p className="mt-3 flex items-start gap-2 rounded-md bg-[#fdf3f2] px-3 py-2 text-sm leading-6 text-[#912018]">
                  <ShieldAlert className="mt-1 size-4 shrink-0" />
                  {detail.occupied}
                </p>
              )}
              {mediaKey && <Stats kind={mediaKey[0]} entry={detailMedia} />}
              <p className="mt-4 text-[15px] leading-7 text-[#33413e]">{detail.text}</p>
              <ul className="mt-5 flex flex-col gap-2">
                {detail.facts.map((f) => (
                  <li key={f} className="rounded-lg bg-[#f5f7f6] px-3 py-2 text-sm text-[#111a18]">
                    {f}
                  </li>
                ))}
              </ul>
              {selection.kind === "region" && (
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {CITIES.filter((c) => c.region === selection.region.id).map((c) => (
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
              )}
              <WikiIntro entry={detailMedia} />
              <button type="button" onClick={() => select({ kind: "country" })} className="mt-6 text-sm font-semibold text-[#2f6fb0] hover:underline">
                ← მთელი საქართველო
              </button>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-[#2f6fb0]">შრე · {layerInfo.name}</p>
              <h2 className="mt-1 text-2xl">{layerInfo.title}</h2>
              <div className="mt-4 flex flex-col gap-3">
                {layerInfo.paragraphs.map((p) => (
                  <p key={p.slice(0, 30)} className="text-[15px] leading-7 text-[#33413e]">
                    {p}
                  </p>
                ))}
              </div>
              {layer === "political" && (
                <Swatches items={REGIONS.map((r) => ({ color: REGION_COLORS[r.id], label: r.name }))} />
              )}
              <h3 className="mt-7 text-xs font-semibold text-[#66736f]">{COUNTRY.name}</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {COUNTRY.facts.map((f) => (
                  <li key={f} className="rounded-lg bg-[#f5f7f6] px-3 py-2 text-sm text-[#111a18]">
                    {f}
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Everything on the map, as lists. */}
          <section className="mt-8 border-t border-[#e2e7e5] pt-5">
            <div role="tablist" aria-label="რუკის ობიექტები" className="flex gap-1 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "h-8 shrink-0 rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
                    tab === t.id ? "bg-[#111a18] text-white" : "text-[#33413e] hover:bg-[#f1f4f3]",
                  )}
                >
                  {t.name}
                </button>
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-1">
              {tab === "regions" &&
                REGIONS.map((r) => (
                  <ListItem
                    key={r.id}
                    active={activeRegion === r.id}
                    onClick={() => select({ kind: "region", region: r })}
                    onEnter={() => setHover(r.id)}
                    onLeave={() => setHover(null)}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: activeRegion === r.id ? "#1d4f84" : REGION_COLORS[r.id] }} />
                    {r.name}
                  </ListItem>
                ))}
              {tab === "cities" &&
                CITIES.map((c) => (
                  <ListItem key={c.id} active={activeKey === `city:${c.id}`} onClick={() => select({ kind: "city", city: c })}>
                    {media.city?.[c.id]?.image ? <Thumb entry={media.city[c.id]} /> : <MapPin className={cn("size-3.5 shrink-0", c.capital ? "text-[#b8232b]" : "text-[#66736f]")} />}
                    {c.name}
                    <span className="ms-auto text-xs font-normal text-[#97a29e]">{REGION_BY_ID[c.region].name}</span>
                  </ListItem>
                ))}
              {tab === "rivers" &&
                RIVERS.map((r) => (
                  <ListItem key={r.id} active={activeKey === `river:${r.id}`} onClick={() => select({ kind: "river", river: r })}>
                    {media.river?.[r.id]?.image ? <Thumb entry={media.river[r.id]} /> : <Waves className="size-3.5 shrink-0 text-[#2f6fb0]" />}
                    {r.name}
                    <span className="ms-auto text-xs font-normal text-[#97a29e]">{r.basin === "black" ? "შავი ზღვა" : "კასპიის ზღვა"}</span>
                  </ListItem>
                ))}
              {tab === "relief" &&
                LANDFORMS.map((f) => (
                  <ListItem key={f.id} active={activeKey === `landform:${f.id}`} onClick={() => select({ kind: "landform", landform: f })}>
                    {media.landform?.[f.id]?.image ? (
                      <Thumb entry={media.landform[f.id]} />
                    ) : (
                      <span className={cn("size-2.5 shrink-0 rounded-sm", f.kind === "range" ? "bg-[#a07c5c]" : f.kind === "lowland" ? "bg-[#86b46f]" : "bg-[#cfc785]")} />
                    )}
                    {f.name}
                    <span className="ms-auto text-xs font-normal text-[#97a29e]">{LANDFORM_KINDS[f.kind]}</span>
                  </ListItem>
                ))}
              {tab === "relief" &&
                PEAKS.map((k) => (
                  <ListItem key={k.id} active={activeKey === `peak:${k.id}`} onClick={() => select({ kind: "peak", peak: k })}>
                    {media.peak?.[k.id]?.image ? <Thumb entry={media.peak[k.id]} /> : <Mountain className="size-3.5 shrink-0 text-[#7b6a58]" />}
                    {k.name}
                    <span className="ms-auto text-xs font-normal text-[#97a29e] tabular-nums">{fmt(k.height)} მ</span>
                  </ListItem>
                ))}
              {tab === "lakes" &&
                LAKES.map((l) => (
                  <ListItem key={l.id} active={activeKey === `lake:${l.id}`} onClick={() => select({ kind: "lake", lake: l })}>
                    {media.lake?.[l.id]?.image ? <Thumb entry={media.lake[l.id]} /> : <Droplets className="size-3.5 shrink-0 text-[#2f6fb0]" />}
                    {l.name}
                    <span className="ms-auto text-xs font-normal text-[#97a29e]">{l.kind === "lake" ? "ტბა" : "წყალსაცავი"}</span>
                  </ListItem>
                ))}
            </ul>
          </section>

          <p className="mt-8 text-[11px] leading-5 text-[#97a29e]">
            სატელიტური სურათი: EOxCloudless https://cloudless.eox.at, EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024), CC BY-NC-SA 4.0; ტბები და მდინარეები: © OpenStreetMap contributors (ODbL); ფოტოები: Wikimedia Commons (ავტორები მითითებულია ფოტოსთან); რელიეფი: AWS Terrain Tiles (Mapzen); საზღვრები: geoBoundaries (CC BY 3.0); სიმაღლეები 6-ჯერ გაზრდილია; ბუნებრივი ზონებისა და ჰავის რუკები განზოგადებულია. აფხაზეთი და ცხინვალის რეგიონი საქართველოს განუყოფელი ნაწილია.
          </p>
        </article>
      </div>
    </div>
  );
}
