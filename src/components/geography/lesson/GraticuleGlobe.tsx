"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Crosshair, Grid3x3, MapPin, RotateCw } from "lucide-react";
import { sceneFrame } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { cn } from "@/lib/utils";
import { useNarrationDirector } from "@/components/portal/NarrationScene";
import { formatLat, formatLon, latLonToVec3, type LatLon } from "../globe/coords";
import { buildCrosshair, buildGraticule, meridian, parallel, SPECIAL_LINES, type SpecialLine } from "../globe/graticule";
import { GRID_CUES, type GridLit, type GridShot } from "./graticule-cues";
import { GlobeScene } from "../globe/GlobeScene";
import { MapButton } from "../globe/MapButton";

/*
 * Topic 4 — the degree grid. A globe with parallels and meridians every 15°, the named lines in colour,
 * a live read-out of latitude/longitude under the cursor (tap on touch screens) and a small task:
 * find Tbilisi by its coordinates.
 */

const PARALLELS = [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75];
const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180];
const TBILISI: LatLon = { lat: 41.72, lon: 44.79 };

const parLabel = (v: number) => (v === 0 ? "0°" : `${Math.abs(v)}° ${v > 0 ? "ჩ" : "ს"}`);
const merLabel = (v: number) => (v === 0 || v === 180 ? `${v}°` : `${Math.abs(v)}° ${v > 0 ? "აღმ" : "დას"}`);

/** Which lines light up for each cue: named lines by id, and the whole sets of parallels and meridians. */
const LIT_LINES: Record<GridLit, string[]> = {
  grid: ["parallels", "meridians"],
  parallels: ["parallels"],
  meridians: ["meridians"],
  equator: ["equator"],
  prime: ["prime"],
  tropics: ["tropic-n", "tropic-s"],
  polar: ["arctic", "antarctic"],
  special: ["equator", "tropic-n", "tropic-s", "arctic", "antarctic"],
  between: ["tropic-n", "arctic"],
};

const GOTO: { name: string; lat: number; lon: number }[] = [
  { name: "თბილისი", lat: TBILISI.lat, lon: TBILISI.lon },
  { name: "0° / 0°", lat: 0, lon: 0 },
  { name: "ჩრდილოეთი", lat: 72, lon: 30 },
  { name: "სამხრეთი", lat: -72, lon: 30 },
];

function Coord({ p, title }: { p: LatLon; title: string }) {
  const la = formatLat(p.lat);
  const lo = formatLon(p.lon);
  return (
    <div>
      <p className="text-[11px] font-semibold text-mute">{title}</p>
      <p className="mt-0.5 text-sm leading-5 tabular-nums">
        <span className="text-mute">განედი:</span> <b>{la.text}</b> {la.letter && <span className="text-faint">({la.letter})</span>}
      </p>
      <p className="text-sm leading-5 tabular-nums">
        <span className="text-mute">გრძედი:</span> <b>{lo.text}</b> {lo.letter && <span className="text-faint">({lo.letter})</span>}
      </p>
    </div>
  );
}

export function GraticuleGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GlobeScene | null>(null);
  const gridRef = useRef<{ visible: boolean } | null>(null);
  /** The narration's lights: halos round the named lines, the sets of parallels and meridians, and the marker. */
  const fxRef = useRef<{ light: (ids: string[]) => void; mark: (p: [number, number] | null) => void } | null>(null);
  const [lit, setLit] = useState<GridLit | null>(null);
  const [hover, setHover] = useState<LatLon | null>(null);
  const [picked, setPicked] = useState<LatLon | null>(null);
  const [grid, setGrid] = useState(true);
  const [line, setLine] = useState<SpecialLine | null>(null);
  const [spin, setSpin] = useState(true);
  const [map, setMap] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const scene = new GlobeScene(canvas, { autoRotate: true, flatLight: true });
    sceneRef.current = scene;
    // The task is to find Tbilisi by its coordinates: the map does not name it.
    scene.map.setHidden(["თბილისი"]);
    scene.map.avoid(layer);
    const graticule = buildGraticule(scene.radius);
    gridRef.current = graticule;
    const cross = buildCrosshair(scene.radius);
    scene.earth.add(graticule, cross.group);
    // Halos the narration lights up (pulsing in onFrame).
    const halos = new Map<string, THREE.Object3D>();
    const haloMats: THREE.MeshBasicMaterial[] = [];
    const halo = (color: string) => {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      haloMats.push(m);
      return m;
    };
    const r = scene.radius * 1.004;
    for (const l of SPECIAL_LINES) {
      const h = l.kind === "parallel" ? parallel(r, l.value, scene.radius * 0.022, halo(l.color)) : meridian(r, l.value, scene.radius * 0.022, halo(l.color));
      h.visible = false;
      halos.set(l.id, h);
      scene.earth.add(h);
    }
    const sets = { parallels: new THREE.Group(), meridians: new THREE.Group() };
    const setMat = halo("#ffe066");
    for (let v = -75; v <= 75; v += 15) if (v) sets.parallels.add(parallel(r, v, scene.radius * 0.007, setMat));
    for (let v = -165; v <= 180; v += 15) if (v) sets.meridians.add(meridian(r, v, scene.radius * 0.007, setMat));
    for (const [id, g] of Object.entries(sets)) {
      g.visible = false;
      halos.set(id, g);
      scene.earth.add(g);
    }
    fxRef.current = {
      light: (ids) => {
        for (const [id, h] of halos) h.visible = ids.includes(id);
      },
      mark: (p) => {
        if (!p) return cross.hide();
        cross.place(p[0], p[1], latLonToVec3(p[0], p[1], scene.radius));
      },
    };

    scene.onHover = (p) => {
      if (p) cross.place(p.lat, p.lon, p.point);
      else cross.hide();
      setHover(p ? { lat: p.lat, lon: p.lon } : null);
    };
    scene.onPick = (p) => {
      setPicked(p);
      setSpin(false);
    };

    const els = [...layer.querySelectorAll<HTMLElement>("[data-kind]")];
    scene.onFrame = (project) => {
      const pulse = 0.5 + 0.3 * Math.sin(performance.now() / 260);
      for (const m of haloMats) m.opacity = pulse;
      const view = scene.viewCenter();
      for (const el of els) {
        const v = Number(el.dataset.v);
        const kind = el.dataset.kind;
        let lat = v;
        let lon = view.lon;
        if (kind === "mer") {
          lon = v;
          lat = Math.max(-55, Math.min(55, view.lat - 8));
        } else if (kind === "line") {
          const isMer = el.dataset.m === "1";
          lat = isMer ? Math.max(-60, Math.min(60, view.lat + 22)) : v;
          lon = isMer ? v : view.lon - 30;
        } else if (kind === "place") {
          lat = Number(el.dataset.lat);
          lon = Number(el.dataset.lon);
        }
        const p = project(lat, lon, 0.01);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.style.opacity = p.visible ? "1" : "0";
      }
    };
    return () => {
      scene.dispose();
      sceneRef.current = null;
      gridRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (gridRef.current) gridRef.current.visible = grid;
    labelsRef.current?.classList.toggle("invisible", !grid);
  }, [grid]);
  useEffect(() => {
    sceneRef.current?.setAutoRotate(spin);
  }, [spin]);
  useEffect(() => {
    sceneRef.current?.setMapVisible(map);
  }, [map]);

  // The narration drives the globe: the camera goes where the voice is, the lines it talks about light up, and the
  // marker stands on the place it names (with its coordinates in the read-out).
  const direct = useCallback((s: Partial<GridShot>) => {
    const scene = sceneRef.current;
    const fx = fxRef.current;
    setSpin(false);
    setGrid(true);
    const lines = s.lit ? LIT_LINES[s.lit] : [];
    setLit(s.lit ?? null);
    setLine(lines.length === 1 ? (SPECIAL_LINES.find((l) => l.id === lines[0]) ?? null) : null);
    fx?.light(lines);
    fx?.mark(s.mark ?? null);
    setHover(s.mark ? { lat: s.mark[0], lon: s.mark[1] } : null);
    if (scene && s.view) scene.focus(s.view[0], s.view[1], s.view[2]);
  }, []);
  useNarrationDirector(GRID_CUES, direct);
  const litIds = lit ? LIT_LINES[lit] : [];
  const glowCls = "rounded ring-4 ring-[#ffd76a] scale-115 z-10";

  const pickLine = (l: SpecialLine) => {
    setLine(l);
    setSpin(false);
    const view = sceneRef.current?.viewCenter();
    if (l.kind === "parallel") sceneRef.current?.focus(l.value * 0.8, view?.lon ?? 0);
    else sceneRef.current?.focus(15, l.value);
  };
  const found = picked && Math.abs(picked.lat - TBILISI.lat) < 1.5 && Math.abs(picked.lon - TBILISI.lon) < 1.5;

  return (
    <section ref={fsRef} className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative bg-[radial-gradient(ellipse_at_center,#14233a_0%,#05080f_80%)]", sceneFrame)} data-scene>
        <canvas ref={canvasRef} className="absolute inset-0 size-full cursor-crosshair touch-none" aria-label="გლობუსი გრადუსთა ბადით" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden">
          {PARALLELS.map((v) => (
            <span key={`p${v}`} data-kind="par" data-v={v} className={cn("absolute top-0 left-0 text-[11px] font-semibold whitespace-nowrap text-white/85 opacity-0 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]", litIds.includes("parallels") && glowCls)}>
              {parLabel(v)}
            </span>
          ))}
          {MERIDIANS.map((v) => (
            <span key={`m${v}`} data-kind="mer" data-v={v} className={cn("absolute top-0 left-0 text-[11px] font-semibold whitespace-nowrap text-white/70 opacity-0 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]", litIds.includes("meridians") && glowCls)}>
              {merLabel(v)}
            </span>
          ))}
          {SPECIAL_LINES.map((l) => (
            <span
              key={l.id}
              data-kind="line"
              data-v={l.value}
              data-m={l.kind === "meridian" ? "1" : "0"}
              className={cn("absolute top-0 left-0 rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-ink opacity-0 shadow-sm", litIds.includes(l.id) && glowCls)}
              style={{ backgroundColor: l.color }}
            >
              {l.name}
            </span>
          ))}
          <span data-kind="place" data-lat={TBILISI.lat} data-lon={TBILISI.lon} className="absolute top-0 left-0 flex items-center gap-1 text-[11px] font-semibold text-white opacity-0 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
            {found && (
              <>
                <span className="size-2 rounded-full bg-[#ff3b30] ring-2 ring-white" />
                თბილისი
              </>
            )}
          </span>
        </div>

        <div className="pointer-events-none absolute top-3 left-3 min-w-52 rounded-lg bg-card/92 px-3 py-2 shadow-sm">
          {hover ? <Coord p={hover} title="კურსორის ქვეშ" /> : <p className="text-sm text-mute">მიიტანე კურსორი გლობუსზე (ან შეეხე)</p>}
        </div>

        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" onClick={() => setGrid((g) => !g)} aria-pressed={grid} title="ბადე" className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", grid ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
            <Grid3x3 className="size-5" />
          </button>
          <button type="button" onClick={() => setSpin((s) => !s)} aria-pressed={spin} title="ბრუნვა" className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", spin ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
            <RotateCw className="size-5" />
          </button>
          <MapButton on={map} onClick={() => setMap((m) => !m)} />
          <FullscreenButton full={fsOn} onClick={fsToggle} />
        </div>

        <div className="absolute inset-x-0 bottom-3 flex flex-wrap justify-center gap-1.5 px-3">
          {GOTO.map((g) => (
            <button
              key={g.name}
              type="button"
              onClick={() => {
                setSpin(false);
                sceneRef.current?.focus(g.lat, g.lon, 3.2);
              }}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-card/92 px-3 text-sm font-semibold text-ink shadow-sm hover:bg-card"
            >
              <Crosshair className="size-4 text-[#2f6fb0]" />
              {g.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_auto]">
        <div>
          <h2 className="text-base font-semibold">მთავარი ხაზები</h2>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {SPECIAL_LINES.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  onClick={() => pickLine(l)}
                  aria-pressed={line?.id === l.id}
                  className={cn("flex h-9 items-center gap-2 rounded-full px-3 text-sm transition-colors", line?.id === l.id ? "bg-deep font-semibold text-white" : "bg-[#f1f4f3] text-copy hover:bg-[#e6ecea]")}
                >
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.name}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 min-h-12 text-[15px] leading-7 text-copy">{line ? line.note : "აირჩიე ხაზი — გლობუსი მისკენ შეტრიალდება და გაიგებ, რატომ არის ის მნიშვნელოვანი."}</p>
        </div>
        <div className="rounded-lg border border-line p-3 sm:w-64">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <MapPin className="size-4 text-[#ff3b30]" />
            დავალება: იპოვე თბილისი
          </p>
          <p className="mt-1 text-[13px] leading-5 text-mute">41°43′ ჩ. გ., 44°47′ აღმ. გრ. — დააჭირე ამ წერტილს გლობუსზე.</p>
          {picked && (
            <div className="mt-2 border-t border-chip pt-2">
              <Coord p={picked} title="შენი წერტილი" />
              <p className={cn("mt-1.5 text-sm font-semibold", found ? "text-brand" : "text-[#b8232b]")}>{found ? "სწორია! ეს თბილისია." : "ჯერ არა — შეადარე განედი და გრძედი."}</p>
            </div>
          )}
        </div>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-faint">დედამიწის სურათი: NASA Visible Earth (Blue Marble), საჯარო საკუთრება; საზღვრები და სახელები: Natural Earth, Wikidata.</p>
    </section>
  );
}
