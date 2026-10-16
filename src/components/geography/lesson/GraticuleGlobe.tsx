"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Crosshair, Grid3x3, MapPin, RotateCw } from "lucide-react";
import { sceneFrame } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { cn } from "@/lib/utils";
import { useNarrationDirector } from "@/components/portal/NarrationScene";
import { dms, latLonToVec3, type LatLon } from "../globe/coords";
import { buildCrosshair, buildGraticule, meridian, parallel, SPECIAL_LINES, type SpecialLine } from "../globe/graticule";
import { globePath, pathTube } from "../globe/paths";
import { GRID_CUES, type GridLit, type GridShot } from "./graticule-cues";
import { GlobeScene } from "../globe/GlobeScene";
import { MapButton } from "../globe/MapButton";
import { SceneInset } from "./SceneInset";

/*
 * Topic 4 — the degree grid. A globe with parallels and meridians every 15°, the named lines in colour,
 * a live read-out of latitude/longitude under the cursor (tap on touch screens) and a small task:
 * find Tbilisi by its coordinates. Both words begin with the same letter, so the two are told apart by their
 * direction and colour everywhere: latitude (განედი) blue, north or south ↕; longitude (გრძედი) pink, east or west ↔.
 */

const PARALLELS = [-75, -60, -45, -30, -15, 0, 15, 30, 45, 60, 75];
const MERIDIANS = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150, 180];
const TBILISI: LatLon = { lat: 41.72, lon: 44.79 };
/** Latitude blue, longitude pink: on the globe (bright) and on light cards (dark). */
const LAT_C = "#4aa8ff";
const LON_C = "#ff6fb5";
const LAT_INK = "text-[#1d6fd1]";
const LON_INK = "text-[#c2267a]";
/** Length of a parallel (km): the equator's 40 075 km times the cosine of the latitude. */
const parallelKm = (lat: number) => (lat === 0 ? 40075 : Math.round((40075 * Math.cos((lat * Math.PI) / 180)) / 100) * 100);
const km = (v: number) => `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} კმ`;

const parLabel = (v: number) => (v === 0 ? "0°" : `${Math.abs(v)}° ${v > 0 ? "ჩ" : "ს"}`);
const merLabel = (v: number) => (v === 0 || v === 180 ? `${v}°` : `${Math.abs(v)}° ${v > 0 ? "აღმ" : "დას"}`);
/** 41 → "41°", 41.72 → "41°43′". */
const deg = (v: number) => (Math.abs(Math.abs(v) - Math.round(Math.abs(v))) < 1 / 120 ? `${Math.round(Math.abs(v))}°` : dms(v));
const latText = (lat: number) => (Math.abs(lat) < 1 / 120 ? "0° (ეკვატორი)" : `${deg(lat)} ${lat > 0 ? "ჩრდ." : "სამხრ."} განედი`);
const lonText = (lon: number) => (Math.abs(lon) < 1 / 120 ? "0° (გრინვიჩი)" : Math.abs(Math.abs(lon) - 180) < 1 / 120 ? "180°" : `${deg(lon)} ${lon > 0 ? "აღმ." : "დას."} გრძედი`);

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
  lengths: ["parallels", "equator"],
  georgia: [],
};

/** Georgia between two parallels and two meridians (the lesson's round numbers). */
const GE = { s: 41, n: 43.5, w: 40, e: 46.7 };

/** Arrows of the two directions, with their labels on the globe. */
const DIRS = {
  lat: [
    { lat: 36, lon: 30, text: "↑ ჩრდილოეთით" },
    { lat: -30, lon: 30, text: "↓ სამხრეთით" },
  ],
  lon: [
    { lat: 7, lon: 58, text: "აღმოსავლეთით →" },
    { lat: 7, lon: -58, text: "← დასავლეთით" },
  ],
} as const;

const GOTO: { name: string; lat: number; lon: number }[] = [
  { name: "თბილისი", lat: TBILISI.lat, lon: TBILISI.lon },
  { name: "0° / 0°", lat: 0, lon: 0 },
  { name: "ჩრდილოეთი", lat: 72, lon: 30 },
  { name: "სამხრეთი", lat: -72, lon: 30 },
];

/** Latitude and longitude, each in its colour with its direction arrow. */
function Coord({ p, title }: { p: LatLon; title: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-mute">{title}</p>
      <p className="mt-0.5 text-sm leading-5 tabular-nums">
        <span className={cn("font-semibold", LAT_INK)}>განედი ↕</span> <b>{latText(p.lat)}</b>
      </p>
      <p className="text-sm leading-5 tabular-nums">
        <span className={cn("font-semibold", LON_INK)}>გრძედი ↔</span> <b>{lonText(p.lon)}</b>
      </p>
    </div>
  );
}

/** A curved arrow along the globe (from the first point to the last), lying just above the ground. */
function globeArrow(points: LatLon[], color: string) {
  const path = globePath(points, 1, 0.012);
  const mat = new THREE.MeshBasicMaterial({ color });
  const g = new THREE.Group();
  g.add(pathTube(path, 0.011, mat).mesh);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 16), mat);
  head.position.copy(path.curve.getPoint(1));
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), path.curve.getTangent(1));
  g.add(head);
  return g;
}

/** A piece of a parallel (lat fixed) or of a meridian (lon fixed), as a tube following the line exactly. */
function gridPiece(from: LatLon, to: LatLon, color: string) {
  const pts = Array.from({ length: 25 }, (_, i) => ({ lat: from.lat + ((to.lat - from.lat) * i) / 24, lon: from.lon + ((to.lon - from.lon) * i) / 24 }));
  return pathTube(globePath(pts, 1, 0.004, 0.3), 0.0028, new THREE.MeshBasicMaterial({ color })).mesh;
}

export function GraticuleGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GlobeScene | null>(null);
  const gridRef = useRef<{ visible: boolean } | null>(null);
  /** The narration's lights: halos round the named lines, the sets of parallels and meridians, and the marker. */
  const fxRef = useRef<{ light: (ids: string[]) => void; mark: (p: [number, number] | null) => void; dirs: (d: GridShot["dirs"]) => void; georgia: (on: boolean) => void } | null>(null);
  const [lit, setLit] = useState<GridLit | null>(null);
  const [hover, setHover] = useState<LatLon | null>(null);
  const [picked, setPicked] = useState<LatLon | null>(null);
  const [grid, setGrid] = useState(true);
  const [line, setLine] = useState<SpecialLine | null>(null);
  const [spin, setSpin] = useState(true);
  const [map, setMap] = useState(true);
  /** Set by the narration: the place card, the direction arrows, the picture over the scene. */
  const [narr, setNarr] = useState<Pick<GridShot, "mark" | "place" | "dirs" | "inset">>({ mark: null, place: null, dirs: null, inset: null });

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
    // The two directions: latitude north and south from the equator, longitude east and west from Greenwich.
    const arrows = {
      lat: new THREE.Group().add(
        globeArrow([{ lat: 0, lon: 30 }, { lat: 74, lon: 30 }], LAT_C),
        globeArrow([{ lat: 0, lon: 30 }, { lat: -74, lon: 30 }], LAT_C),
      ),
      lon: new THREE.Group().add(
        globeArrow([{ lat: 0, lon: 0 }, { lat: 0, lon: 74 }], LON_C),
        globeArrow([{ lat: 0, lon: 0 }, { lat: 0, lon: -74 }], LON_C),
      ),
    };
    // Georgia's box: two parallels (blue) and two meridians (pink).
    const box = new THREE.Group().add(
      gridPiece({ lat: GE.s, lon: GE.w }, { lat: GE.s, lon: GE.e }, LAT_C),
      gridPiece({ lat: GE.n, lon: GE.w }, { lat: GE.n, lon: GE.e }, LAT_C),
      gridPiece({ lat: GE.s, lon: GE.w }, { lat: GE.n, lon: GE.w }, LON_C),
      gridPiece({ lat: GE.s, lon: GE.e }, { lat: GE.n, lon: GE.e }, LON_C),
    );
    for (const g of [arrows.lat, arrows.lon, box]) {
      g.visible = false;
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
      dirs: (d) => {
        arrows.lat.visible = d === "lat";
        arrows.lon.visible = d === "lon";
      },
      georgia: (on) => {
        box.visible = on;
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
        } else if (kind === "place" || kind === "card" || kind === "dir" || kind === "ge") {
          lat = Number(el.dataset.lat);
          lon = Number(el.dataset.lon);
        }
        const p = project(lat, lon, 0.01);
        // The place card stands to the right of its point, its arrow pointing at it.
        el.style.transform = kind === "card" ? `translate(${p.x}px, ${p.y}px) translate(14px, -50%)` : `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        el.style.opacity = p.visible && el.dataset.hidden !== "1" ? "1" : "0";
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
    labelsRef.current?.querySelectorAll<HTMLElement>("[data-grid]").forEach((el) => el.classList.toggle("invisible", !grid));
  }, [grid]);
  useEffect(() => {
    sceneRef.current?.setAutoRotate(spin);
  }, [spin]);
  useEffect(() => {
    sceneRef.current?.setMapVisible(map);
  }, [map]);

  // The narration drives the globe: the camera goes where the voice is, the lines it talks about light up, the
  // marker stands on the place it names with a card of its coordinates, and the arrows show the two directions.
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
    fx?.dirs(s.dirs ?? null);
    fx?.georgia(s.lit === "georgia");
    setNarr({ mark: s.mark ?? null, place: s.place ?? null, dirs: s.dirs ?? null, inset: s.inset ?? null });
    setHover(null);
    if (scene && s.view) scene.focus(s.view[0], s.view[1], s.view[2]);
  }, []);
  const driving = useNarrationDirector(GRID_CUES, direct);
  // When the voice stops, its lights go out and the globe is the pupil's again.
  useEffect(() => {
    if (driving) return;
    const fx = fxRef.current;
    fx?.light([]);
    fx?.dirs(null);
    fx?.georgia(false);
  }, [driving]);
  const shown = driving ? narr : { mark: null, place: null, dirs: null, inset: null };
  const litIds = lit && driving ? LIT_LINES[lit] : [];
  const glowCls = "rounded ring-4 ring-[#ffd76a] scale-115 z-10";
  const lengths = driving && lit === "lengths";

  const pickLine = (l: SpecialLine) => {
    setLine(l);
    setSpin(false);
    const view = sceneRef.current?.viewCenter();
    if (l.kind === "parallel") sceneRef.current?.focus(l.value * 0.8, view?.lon ?? 0);
    else sceneRef.current?.focus(15, l.value);
  };
  const found = picked && Math.abs(picked.lat - TBILISI.lat) < 1.5 && Math.abs(picked.lon - TBILISI.lon) < 1.5;
  const card = shown.mark && shown.place ? { lat: shown.mark[0], lon: shown.mark[1], name: shown.place } : null;
  const georgia = driving && lit === "georgia";

  return (
    <section ref={fsRef} className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative bg-[radial-gradient(ellipse_at_center,#14233a_0%,#05080f_80%)]", sceneFrame)} data-scene>
        <canvas ref={canvasRef} className="absolute inset-0 size-full cursor-crosshair touch-none" aria-label="გლობუსი გრადუსთა ბადით" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden">
          {PARALLELS.map((v) => (
            <span key={`p${v}`} data-kind="par" data-grid data-v={v} className={cn("absolute top-0 left-0 text-[11px] font-semibold whitespace-nowrap text-white/85 opacity-0 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]", litIds.includes("parallels") && glowCls, lengths && "rounded bg-[#0d1726]/80 px-1 text-[12px] text-[#9fd0ff]")}>
              {parLabel(v)}
              {lengths && ` · ${km(parallelKm(v))}`}
            </span>
          ))}
          {MERIDIANS.map((v) => (
            <span key={`m${v}`} data-kind="mer" data-grid data-v={v} className={cn("absolute top-0 left-0 text-[11px] font-semibold whitespace-nowrap text-white/70 opacity-0 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]", litIds.includes("meridians") && glowCls)}>
              {merLabel(v)}
            </span>
          ))}
          {SPECIAL_LINES.map((l) => (
            <span
              key={l.id}
              data-kind="line"
              data-grid
              data-v={l.value}
              data-m={l.kind === "meridian" ? "1" : "0"}
              className={cn("absolute top-0 left-0 rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-ink opacity-0 shadow-sm", litIds.includes(l.id) && glowCls)}
              style={{ backgroundColor: l.color }}
            >
              {l.name}
              {lengths && l.id === "equator" && ` · ${km(40075)} — ყველაზე გრძელი`}
            </span>
          ))}
          {/* The two directions, named on their arrows. */}
          {(["lat", "lon"] as const).flatMap((d) =>
            DIRS[d].map((x) => (
              <span key={x.text} data-kind="dir" data-lat={x.lat} data-lon={x.lon} data-hidden={shown.dirs === d ? "0" : "1"} className="absolute top-0 left-0 rounded-lg px-2 py-1 text-[14px] font-bold whitespace-nowrap text-white opacity-0 shadow-md" style={{ backgroundColor: d === "lat" ? "#1d6fd1" : "#c2267a" }}>
                {d === "lat" ? "განედი " : "გრძედი "}
                {x.text}
              </span>
            )),
          )}
          {/* Georgia's box: its parallels and meridians, numbered. */}
          {[
            { lat: GE.n, lon: GE.w - 1.6, text: "43,5° ჩრდ.", c: "#1d6fd1" },
            { lat: GE.s, lon: GE.w - 1.6, text: "41° ჩრდ.", c: "#1d6fd1" },
            { lat: GE.n + 0.7, lon: GE.w, text: "40° აღმ.", c: "#c2267a" },
            { lat: GE.n + 0.7, lon: GE.e, text: "46,7° აღმ.", c: "#c2267a" },
          ].map((x) => (
            <span key={x.text} data-kind="ge" data-lat={x.lat} data-lon={x.lon} data-hidden={georgia ? "0" : "1"} className="absolute top-0 left-0 rounded px-1.5 py-0.5 text-[13px] font-bold whitespace-nowrap text-white opacity-0 shadow" style={{ backgroundColor: x.c }}>
              {x.text}
            </span>
          ))}
          <span data-kind="card" data-lat={(GE.s + GE.n) / 2} data-lon={GE.e + 0.3} data-hidden={georgia ? "0" : "1"} className="absolute top-0 left-0 w-max rounded-xl bg-[#0d1726]/92 px-3 py-2 text-white opacity-0 shadow-lg ring-1 ring-white/20">
            <span className="flex items-center gap-1.5 text-[15px] font-bold">
              <MapPin className="size-4 text-[#ff5a4f]" />
              საქართველო
            </span>
            <span className="mt-1 block text-[14px] tabular-nums">
              <b style={{ color: LAT_C }}>განედი ↕</b> 41°–43,5° ჩრდ.
            </span>
            <span className="block text-[14px] tabular-nums">
              <b style={{ color: LON_C }}>გრძედი ↔</b> 40°–46,7° აღმ.
            </span>
          </span>
          {/* The place the voice names, with its coordinates — as a weather forecast shows a city. */}
          <span data-kind="card" data-lat={card?.lat ?? 0} data-lon={card?.lon ?? 0} data-hidden={card ? "0" : "1"} className="absolute top-0 left-0 w-max rounded-xl bg-[#0d1726]/92 px-3 py-2 text-white opacity-0 shadow-lg ring-1 ring-white/20">
            {card && (
              <>
                <span className="absolute top-1/2 -left-1.5 size-3 -translate-y-1/2 rotate-45 bg-[#0d1726]/92" />
                <span className="flex items-center gap-1.5 text-[15px] font-bold">
                  <MapPin className="size-4 text-[#ff5a4f]" />
                  {card.name}
                </span>
                <span className="mt-1 block text-[14px] tabular-nums">
                  <b style={{ color: LAT_C }}>განედი ↕</b> {latText(card.lat)}
                </span>
                {Math.abs(card.lat) < 89.9 && (
                  <span className="block text-[14px] tabular-nums">
                    <b style={{ color: LON_C }}>გრძედი ↔</b> {lonText(card.lon)}
                  </span>
                )}
              </>
            )}
          </span>
          <span data-kind="place" data-lat={TBILISI.lat} data-lon={TBILISI.lon} className="absolute top-0 left-0 flex items-center gap-1 text-[11px] font-semibold text-white opacity-0 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
            {found && (
              <>
                <span className="size-2 rounded-full bg-[#ff3b30] ring-2 ring-white" />
                თბილისი
              </>
            )}
          </span>
        </div>

        <div className="pointer-events-none absolute top-3 left-3 max-w-[calc(100%-4.5rem)] rounded-lg sm:min-w-52 bg-card/92 px-3 py-2 shadow-sm">
          {hover ? (
            <Coord p={hover} title="კურსორის ქვეშ" />
          ) : (
            <div className="text-sm leading-5">
              <p>
                <b className={LAT_INK}>განედი ↕</b> <span className="max-sm:hidden">ჩრდილოეთით ან სამხრეთით</span>
                <span className="sm:hidden">ჩრდ. / სამხრ.</span>
              </p>
              <p>
                <b className={LON_INK}>გრძედი ↔</b> <span className="max-sm:hidden">აღმოსავლეთით ან დასავლეთით</span>
                <span className="sm:hidden">აღმ. / დას.</span>
              </p>
              <p className="mt-1 text-[12px] text-mute max-sm:hidden">მიიტანე კურსორი გლობუსზე (ან შეეხე)</p>
            </div>
          )}
        </div>

        {shown.inset === "lengths" && <LengthsInset />}
        {shown.inset === "meridians" && <MeridiansInset />}

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
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p className="rounded-lg bg-[#e8f2ff] px-3 py-2 text-[14px] leading-6 text-copy">
              <b className={LAT_INK}>განედი ↕</b> — რამდენად ჩრდილოეთით ან სამხრეთით ხარ ეკვატორიდან (0°-დან 90°-მდე). ითვლება პარალელებით.
            </p>
            <p className="rounded-lg bg-[#fdebf4] px-3 py-2 text-[14px] leading-6 text-copy">
              <b className={LON_INK}>გრძედი ↔</b> — რამდენად აღმოსავლეთით ან დასავლეთით ხარ გრინვიჩიდან (0°-დან 180°-მდე). ითვლება მერიდიანებით.
            </p>
          </div>
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

/** The parallels get shorter from the equator to the pole: one bar for every 15°. */
function LengthsInset() {
  const rows = [0, 15, 30, 45, 60, 75, 90];
  return (
    <SceneInset title="პარალელის სიგრძე: პოლუსისკენ მოკლდება">
      <svg viewBox="0 0 240 150" className="block w-full" role="img" aria-label="პარალელების სიგრძე">
        {rows.map((lat, i) => {
          const y = 140 - i * 20;
          const w = 150 * Math.cos((lat * Math.PI) / 180);
          return (
            <g key={lat}>
              <text x={30} y={y + 4} textAnchor="end" fontSize={10.5} fontWeight={700} fill="#cfe6ff">
                {lat === 0 ? "0°" : `${lat}°`}
              </text>
              <rect x={36} y={y - 6} width={Math.max(w, 2)} height={12} rx={3} fill={lat === 0 ? "#ff5a4f" : LAT_C} opacity={lat === 0 ? 1 : 0.85}>
                <animate attributeName="width" from={0} to={Math.max(w, 2)} dur="0.9s" begin={`${i * 0.15}s`} fill="freeze" />
              </rect>
              <text x={40 + Math.max(w, 2)} y={y + 4} fontSize={10} fill="#fff">
                {lat === 90 ? "წერტილი" : km(parallelKm(lat))}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="px-1 pt-1 text-[12px] leading-4 text-white/85">ეკვატორი ყველაზე გრძელი პარალელია; პოლუსზე პარალელი წერტილად იქცევა.</p>
    </SceneInset>
  );
}

/** Every meridian runs pole to pole: all of them the same length. */
function MeridiansInset() {
  const ells = [0.25, 0.6, 0.92];
  return (
    <SceneInset title="ყველა მერიდიანი ერთნაირი სიგრძისაა">
      <svg viewBox="0 0 240 130" className="block w-full" role="img" aria-label="მერიდიანები">
        <circle cx={70} cy={65} r={55} fill="#14325a" stroke="#5f7fa8" />
        {ells.map((k) => (
          <ellipse key={k} cx={70} cy={65} rx={55 * k} ry={55} fill="none" stroke={LON_C} strokeWidth={2} />
        ))}
        <line x1={70} y1={10} x2={70} y2={120} stroke={LON_C} strokeWidth={2} />
        <text x={70} y={7} textAnchor="middle" fontSize={9} fill="#fff">
          ჩრდ. პოლუსი
        </text>
        <text x={70} y={129} textAnchor="middle" fontSize={9} fill="#fff">
          სამხრ. პოლუსი
        </text>
        <text x={134} y={44} fontSize={11} fontWeight={700} fill="#fff">
          პოლუსიდან
        </text>
        <text x={134} y={58} fontSize={11} fontWeight={700} fill="#fff">
          პოლუსამდე
        </text>
        <text x={134} y={80} fontSize={14} fontWeight={700} fill={LON_C}>
          ≈ 20 000 კმ
        </text>
        <text x={134} y={97} fontSize={10} fill="#cbd5e1">
          ყოველი მერიდიანი
        </text>
      </svg>
    </SceneInset>
  );
}
