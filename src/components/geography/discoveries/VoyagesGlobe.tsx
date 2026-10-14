"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Pause, Play, Ship } from "lucide-react";
import { LabeledSlider } from "@/components/portal/controls";
import { sceneFrame } from "@/components/portal/ui";
import { cn } from "@/lib/utils";
import { latLonToVec3 } from "../globe/coords";
import { GlobeScene } from "../globe/GlobeScene";
import { globePath, pathTube, type GlobePath } from "../globe/paths";
import { VoyageShip } from "./ship";
import { CONTINENTS, VOYAGES, type Voyage, type VoyageId } from "./voyages-data";

/*
 * Topic 2 — the great voyages of discovery on the globe: Columbus, Vasco da Gama, Magellan–Elcano. A ship
 * sails the route and the line draws itself in her wake; the camera follows her until the user grabs the globe.
 */

interface Built {
  voyage: Voyage;
  path: GlobePath;
  /** Length of the path on the unit globe. */
  len: number;
  trim: (k: number) => void;
  ghost: THREE.Mesh;
  line: THREE.Mesh;
}

/** 12345 → "12 345" (Georgian style: a space between thousands). */
const nf = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** Paths on the unit globe (GlobeScene radius = 1), built once. They lie low so the hull covers the line under it. */
const PATHS = Object.fromEntries(VOYAGES.map((v) => [v.id, globePath(v.stops, 1, 0.004)])) as Record<VoyageId, GlobePath>;
/** Seconds a voyage takes on the screen: a longer route sails longer, so the ship never races. */
const sailTime = (km: number) => 16 + km / 2200;
/**
 * The camera looks from the south of the ship, so she stands upright on the screen and shows her side, not
 * only her deck. She rides this far above the middle: a share of the half-height of the view, or of the
 * globe's disc when the whole globe is in view.
 */
const RIDE = 0.48;
/** …but the camera never looks from under the South Pole (degrees of latitude). */
const SOUTHMOST = -68;

/** Angle (radians) between the ship and the point under the camera that puts her `RIDE` up the screen. */
function tiltFor(camera: THREE.PerspectiveCamera, distance: number) {
  const m = RIDE * Math.min(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), 1 / Math.sqrt(Math.max(0.01, distance * distance - 1)));
  return Math.asin(Math.min(1, (m * distance) / Math.hypot(1, m))) - Math.atan(m);
}

export function VoyagesGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const followRef = useRef(true);
  /** What the scene draws; read every frame. The state below repeats it for the page a few times a second. */
  const simRef = useRef({ id: "columbus" as VoyageId, progress: 0, playing: false, showAll: false });
  const [id, setId] = useState<VoyageId>("columbus");
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const voyage = VOYAGES.find((v) => v.id === id)!;

  const named = voyage.stops.map((s, i) => ({ ...s, i })).filter((s) => s.name);
  const at = PATHS[id].stopAt;
  const reached = named.filter((s) => (at[s.i] ?? 1) <= progress + 1e-6);
  const current = reached[reached.length - 1] ?? named[0];
  const next = named.find((s) => (at[s.i] ?? 1) > progress + 1e-6);
  /** Only the last few ports reached keep their labels on the globe (fewer overlaps). */
  const labelled = new Set(reached.slice(-4).map((s) => s.i));

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const globe = new GlobeScene(canvas, { flatLight: true });
    const built = new Map<VoyageId, Built>();
    for (const v of VOYAGES) {
      const path = PATHS[v.id];
      const ghost = pathTube(path, 0.004, new THREE.MeshBasicMaterial({ color: v.color, transparent: true, opacity: 0.3, depthWrite: false })).mesh;
      const tube = pathTube(path, 0.0075, new THREE.MeshBasicMaterial({ color: v.color }));
      globe.earth.add(ghost, tube.mesh);
      for (const s of v.stops) {
        if (!s.name) continue;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), new THREE.MeshBasicMaterial({ color: v.color }));
        latLonToVec3(s.lat, s.lon, globe.radius * 1.007, dot.position);
        tube.mesh.add(dot);
      }
      built.set(v.id, { voyage: v, path, len: path.curve.getLength(), trim: tube.trim, ghost, line: tube.mesh });
    }
    const ship = new VoyageShip();
    globe.earth.add(ship.wake, ship.group);
    // Turning the globe by hand lets go of the ship; zooming with the wheel does not.
    const letGo = () => (followRef.current = false);
    canvas.addEventListener("pointerdown", letGo);
    const home = VOYAGES[0].stops[0];
    globe.camera.position.copy(globe.position(home.lat - THREE.MathUtils.radToDeg(tiltFor(globe.camera, 3.4)), home.lon)).setLength(3.4);

    // Names on the globe: `side` 1 = to the right of the dot, −1 = to the left, 0 = under it.
    const names = [...layer.querySelectorAll<HTMLElement>("[data-lat]")].map((el) => ({ el, lat: Number(el.dataset.lat), lon: Number(el.dataset.lon), width: el.offsetWidth, x: 0, y: 0, side: 1 }));
    const shown: typeof names = [];
    const left = (n: (typeof names)[number]) => n.x + ((n.side - 1) / 2) * n.width + 6 * n.side;
    const shipLabel = layer.querySelector<HTMLElement>("[data-ship]");
    const top = new THREE.Vector3();
    const hull = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const want = new THREE.Vector3();
    const axis = new THREE.Vector3();
    const north = new THREE.Vector3(0, 1, 0);
    let pennant: VoyageId | null = null;
    let last = performance.now();
    let told = 0;
    globe.onFrame = (project) => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const sim = simRef.current;
      const cur = built.get(sim.id)!;

      // Sailing. The page hears about it a few times a second; the ship moves every frame.
      const sailing = sim.playing;
      if (sailing) {
        sim.progress = Math.min(1, sim.progress + dt / sailTime(cur.path.km));
        if (sim.progress >= 1) {
          sim.playing = false;
          setPlaying(false);
          setProgress(1);
        } else if (now - told > 90) {
          told = now;
          setProgress(sim.progress);
        }
      }
      if (pennant !== sim.id) {
        pennant = sim.id;
        ship.setColor(cur.voyage.color);
      }
      ship.place(cur.path, cur.len, sim.progress, globe.camera, dt, sailing);
      for (const b of built.values()) {
        const active = b === cur;
        // The drawn line ends under the stern.
        const k = active ? Math.max(0, sim.progress - (0.4 * ship.size) / b.len) : sim.showAll ? 1 : 0;
        b.ghost.visible = active || sim.showAll;
        b.line.visible = k > 0;
        b.trim(k);
      }

      // Where the ship is on the screen: her hull, her masthead and her length in pixels.
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ship.top(top);
      const facing = dir.copy(top).normalize().dot(want.copy(globe.camera.position).sub(top).normalize()) > 0.05;
      const px = (ship.size / globe.camera.position.distanceTo(top) / Math.tan(THREE.MathUtils.degToRad(globe.camera.fov / 2))) * (h / 2);
      top.project(globe.camera);
      hull.copy(ship.group.position).project(globe.camera);
      const sx = ((hull.x + 1) / 2) * w;
      const sy = ((1 - hull.y) / 2) * h;
      // A name stands to the right of its dot. Near the ship it keeps to the side away from her, and goes
      // under the dot of the port she lies in; names that would cover one another move down.
      shown.length = 0;
      for (const n of names) {
        const p = project(n.lat, n.lon, 0.02);
        const on = p.visible && n.el.dataset.on === "1";
        n.el.style.opacity = on ? "1" : "0";
        if (!on) continue;
        const dx = p.x - sx;
        const near = facing ? 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, p.y - sy), px * 0.9, px * 1.4) : 0;
        n.side = THREE.MathUtils.lerp(1, THREE.MathUtils.clamp(dx / (px * 0.3), -1, 1), near);
        // …and clear of her hull.
        n.x = p.x + Math.sign(n.side) * near * Math.abs(n.side) * Math.max(0, px * 0.75 - Math.abs(dx));
        n.y = p.y + px * 0.45 * (1 - Math.abs(n.side));
        shown.push(n);
      }
      shown.sort((a, b) => a.y - b.y);
      for (let i = 1; i < shown.length; i++) {
        const n = shown[i];
        for (let j = 0; j < i; j++) {
          const o = shown[j];
          if (Math.abs(n.y - o.y) < 20 && left(n) < left(o) + o.width + 4 && left(o) < left(n) + n.width + 4) n.y = o.y + 20;
        }
      }
      for (const n of shown) n.el.style.transform = `translate(${n.x}px, ${n.y}px) translate(calc(${(n.side - 1) * 50}% + ${6 * n.side}px), -50%)`;
      if (shipLabel) {
        shipLabel.style.transform = `translate(${((top.x + 1) / 2) * w}px, ${((1 - top.y) / 2) * h}px) translate(-50%, -120%)`;
        shipLabel.style.opacity = facing ? "1" : "0";
      }
      if (followRef.current) {
        const len = globe.camera.position.length();
        dir.copy(ship.group.position).normalize();
        const south = THREE.MathUtils.degToRad(THREE.MathUtils.radToDeg(Math.asin(dir.y)) - SOUTHMOST);
        const tilt = Math.max(0, Math.min(tiltFor(globe.camera, len), south));
        want.copy(dir).applyAxisAngle(axis.crossVectors(dir, north).normalize(), -tilt).setLength(len);
        globe.camera.position.lerp(want, 1 - Math.exp(-dt * 2.2)).setLength(len);
      }
    };
    return () => {
      canvas.removeEventListener("pointerdown", letGo);
      globe.dispose();
    };
  }, []);

  /** Put the ship at `p` (0…1) and sail on or stop; the camera follows her again. */
  const sail = (p: number, play: boolean) => {
    simRef.current.progress = p;
    simRef.current.playing = play;
    setProgress(p);
    setPlaying(play);
    followRef.current = true;
  };
  const choose = (v: VoyageId) => {
    simRef.current.id = v;
    setId(v);
    sail(0, true);
  };
  const toggle = () => {
    const s = simRef.current;
    sail(!s.playing && s.progress >= 1 ? 0 : s.progress, !s.playing);
  };
  const jump = (i: number) => sail(at[i] ?? 0, false);
  const toggleAll = () => {
    simRef.current.showAll = !showAll;
    setShowAll(!showAll);
  };

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className={cn("relative bg-[radial-gradient(ellipse_at_center,#14233a_0%,#05080f_80%)]", sceneFrame)}>
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="დიდი გეოგრაფიული აღმოჩენების მარშრუტები გლობუსზე" />
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[11px] font-semibold whitespace-nowrap">
          {VOYAGES.flatMap((v) =>
            v.stops.map((s, i) =>
              s.name ? (
                <span key={`${v.id}-${i}`} data-lat={s.lat} data-lon={s.lon} data-on={v.id === id && labelled.has(i) ? "1" : "0"} className="absolute top-0 left-0 rounded bg-black/60 px-1.5 py-0.5 text-white opacity-0 transition-opacity">
                  {s.name}
                </span>
              ) : null,
            ),
          )}
          {CONTINENTS.map((c) => (
            <span key={c.name} data-lat={c.lat} data-lon={c.lon} data-on={showAll ? "1" : "0"} className="absolute top-0 left-0 rounded bg-card/90 px-1.5 py-0.5 text-ink opacity-0">
              {c.name}
            </span>
          ))}
          <span data-ship className="absolute top-0 left-0 rounded px-1.5 py-0.5 text-white opacity-0" style={{ backgroundColor: voyage.color }}>
            {next && progress > 0 ? `→ ${next.name}` : (current?.when ?? voyage.years)}
          </span>
        </div>

        <div className="absolute top-3 left-3 flex max-w-[calc(100%-4.5rem)] flex-wrap gap-1.5">
          {VOYAGES.map((v) => (
            <button key={v.id} type="button" onClick={() => choose(v.id)} aria-pressed={id === v.id} className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold shadow-sm", id === v.id ? "text-white" : "bg-card/92 text-ink")} style={id === v.id ? { backgroundColor: v.color } : undefined}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: id === v.id ? "#fff" : v.color }} />
              {v.name.split(" — ")[0]} <span className="font-normal opacity-80 max-sm:hidden">{v.years.split("–")[0]}</span>
            </button>
          ))}
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" onClick={toggle} aria-pressed={playing} title={playing ? "გაჩერება" : "გაცურვა"} className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", playing ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button type="button" onClick={toggleAll} aria-pressed={showAll} title="სამივე მარშრუტი და კონტინენტები" className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", showAll ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
            <Ship className="size-5" />
          </button>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-lg bg-card/92 px-3 py-2 text-sm shadow-sm">
          <p className="font-semibold">{current?.name}</p>
          <p className="text-[13px] text-mute tabular-nums">
            {current?.when} · გავლილია ~{nf(Math.round((PATHS[id].km * progress) / 100) * 100)} კმ
          </p>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-3">
          <LabeledSlider
            label="მოგზაურობის მსვლელობა"
            value={progress}
            display={`${Math.round(progress * 100)}%`}
            min={0}
            max={1}
            step={0.002}
            onChange={(v) => sail(v, false)}
            color={voyage.color}
          />
          <div>
            <h2 className="text-lg">{voyage.name}</h2>
            <p className="mt-1 text-sm text-mute">
              {voyage.captain} · {voyage.years} · {voyage.ships}
            </p>
            <p className="mt-2 text-[15px] leading-7 text-copy">{current?.note ?? voyage.result}</p>
            {current?.note && <p className="mt-2 text-[14px] leading-6 text-mute">{voyage.result}</p>}
          </div>
          {showAll && (
            <ul className="flex flex-col gap-1.5 rounded-lg bg-subtle p-3 text-[14px] leading-6 text-copy">
              {CONTINENTS.map((c) => (
                <li key={c.name}>
                  <b>{c.name}:</b> {c.who}
                </li>
              ))}
            </ul>
          )}
        </div>
        <ol className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {named.map((s) => {
            const done = (at[s.i] ?? 1) <= progress + 1e-6;
            return (
              <li key={s.i}>
                <button type="button" onClick={() => jump(s.i)} className={cn("flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[#f1f4f3]", current?.i === s.i && "bg-[#f1f4f3]")}>
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full border-2" style={{ borderColor: voyage.color, backgroundColor: done ? voyage.color : "transparent" }} />
                  <span>
                    <span className="block font-semibold">{s.name}</span>
                    <span className="block text-[12px] text-mute">{s.when}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-faint">მარშრუტები გამარტივებულია (სასკოლო ატლასის სიზუსტით); ნაჩვენებია მხოლოდ გზა „იქით“. დედამიწის სურათი: NASA Blue Marble.</p>
    </section>
  );
}
