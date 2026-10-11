"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Pause, Play, Ship } from "lucide-react";
import { cn } from "@/lib/utils";
import { latLonToVec3 } from "../globe/coords";
import { GlobeScene } from "../globe/GlobeScene";
import { globePath, pathTube, type GlobePath } from "../globe/paths";
import { CONTINENTS, VOYAGES, type Voyage, type VoyageId } from "./voyages-data";

/*
 * Topic 2 — the great voyages of discovery on the globe: Columbus, Vasco da Gama, Magellan–Elcano. The route
 * draws itself as the ship sails; the camera follows the ship until the user grabs the globe.
 */

interface Built {
  voyage: Voyage;
  path: GlobePath;
  trim: (k: number) => void;
  ghost: THREE.Mesh;
  line: THREE.Mesh;
  ship: THREE.Group;
}

function shipMesh(color: string) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 10), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
  hull.rotation.x = Math.PI / 2; // nose along +z
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.028, 0.038, 32), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
  halo.rotation.x = Math.PI / 2;
  g.add(hull, halo);
  return g;
}

/** 12345 → "12 345" (Georgian style: a space between thousands). */
const nf = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** Paths on the unit globe (GlobeScene radius = 1), built once. */
const PATHS = Object.fromEntries(VOYAGES.map((v) => [v.id, globePath(v.stops, 1)])) as Record<VoyageId, GlobePath>;

export function VoyagesGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ globe: GlobeScene; built: Map<VoyageId, Built> } | null>(null);
  const followRef = useRef(true);
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
      const ship = shipMesh(v.color);
      globe.earth.add(ghost, tube.mesh, ship);
      for (const s of v.stops) {
        if (!s.name) continue;
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), new THREE.MeshBasicMaterial({ color: v.color }));
        latLonToVec3(s.lat, s.lon, globe.radius * 1.007, dot.position);
        tube.mesh.add(dot);
      }
      built.set(v.id, { voyage: v, path, trim: tube.trim, ghost, line: tube.mesh, ship });
    }
    sceneRef.current = { globe, built };
    globe.controls.addEventListener("start", () => (followRef.current = false));
    globe.camera.position.copy(globe.position(25, -30)).setLength(3.4);

    const els = [...layer.querySelectorAll<HTMLElement>("[data-lat]")];
    const shipLabel = layer.querySelector<HTMLElement>("[data-ship]");
    const tmp = new THREE.Vector3();
    globe.onFrame = (project) => {
      for (const el of els) {
        const p = project(Number(el.dataset.lat), Number(el.dataset.lon), 0.02);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(6px, -50%)`;
        el.style.opacity = p.visible && el.dataset.on === "1" ? "1" : "0";
      }
      const cur = sceneRef.current && [...sceneRef.current.built.values()].find((b) => b.ship.visible && b.ship.userData.active);
      if (cur && shipLabel) {
        tmp.copy(cur.ship.position);
        const p = tmp.clone().project(globe.camera);
        const facing = tmp.clone().normalize().dot(globe.camera.position.clone().sub(tmp).normalize()) > 0.05;
        shipLabel.style.transform = `translate(${((p.x + 1) / 2) * canvas.clientWidth}px, ${((1 - p.y) / 2) * canvas.clientHeight}px) translate(-50%, -150%)`;
        shipLabel.style.opacity = facing ? "1" : "0";
        if (followRef.current) {
          const len = globe.camera.position.length();
          const want = tmp.clone().normalize().add(new THREE.Vector3(0, 0.25, 0)).setLength(len);
          globe.camera.position.lerp(want, 0.035).setLength(len);
        }
      }
    };
    return () => {
      globe.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Which routes show, how much of the active one is drawn, and where its ship is.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const t = new THREE.Vector3();
    for (const b of s.built.values()) {
      const active = b.voyage.id === id;
      const k = active ? progress : showAll ? 1 : 0;
      b.ghost.visible = active || showAll;
      b.line.visible = k > 0;
      b.trim(k);
      b.ship.visible = active;
      b.ship.userData.active = active;
      if (active) {
        b.path.curve.getPointAt(Math.min(1, Math.max(0, progress)), b.ship.position);
        b.path.curve.getTangentAt(Math.min(0.999, Math.max(0.001, progress)), t);
        b.ship.up.copy(b.ship.position).normalize();
        b.ship.lookAt(b.ship.position.clone().add(t));
      }
    }
  }, [id, progress, showAll]);

  // Sailing: the whole voyage takes ~25 seconds whatever its length.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setProgress((p) => {
        const n = p + 0.0016;
        if (n >= 1) {
          setPlaying(false);
          return 1;
        }
        return n;
      });
    }, 40);
    return () => window.clearInterval(timer);
  }, [playing]);

  const choose = (v: VoyageId) => {
    setId(v);
    setProgress(0);
    setPlaying(true);
    followRef.current = true;
  };
  const toggle = () => {
    if (!playing && progress >= 1) setProgress(0);
    followRef.current = true;
    setPlaying((p) => !p);
  };
  const jump = (i: number) => {
    setPlaying(false);
    setProgress(at[i] ?? 0);
    followRef.current = true;
  };

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-[#d5dcd9] bg-white">
      <div className="relative aspect-[16/10] max-h-[70vh] min-h-80 w-full bg-[radial-gradient(ellipse_at_center,#14233a_0%,#05080f_80%)]">
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
            <span key={c.name} data-lat={c.lat} data-lon={c.lon} data-on={showAll ? "1" : "0"} className="absolute top-0 left-0 rounded bg-white/90 px-1.5 py-0.5 text-[#111a18] opacity-0">
              {c.name}
            </span>
          ))}
          <span data-ship className="absolute top-0 left-0 rounded px-1.5 py-0.5 text-white opacity-0" style={{ backgroundColor: voyage.color }}>
            {next && progress > 0 ? `→ ${next.name}` : (current?.when ?? voyage.years)}
          </span>
        </div>

        <div className="absolute top-3 left-3 flex max-w-[calc(100%-4.5rem)] flex-wrap gap-1.5">
          {VOYAGES.map((v) => (
            <button key={v.id} type="button" onClick={() => choose(v.id)} aria-pressed={id === v.id} className={cn("flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold shadow-sm", id === v.id ? "text-white" : "bg-white/92 text-[#111a18]")} style={id === v.id ? { backgroundColor: v.color } : undefined}>
              <span className="size-2.5 rounded-full" style={{ backgroundColor: id === v.id ? "#fff" : v.color }} />
              {v.name.split(" — ")[0]} <span className="font-normal opacity-80">{v.years.split("–")[0]}</span>
            </button>
          ))}
        </div>
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <button type="button" onClick={toggle} aria-pressed={playing} title={playing ? "გაჩერება" : "გაცურვა"} className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", playing ? "bg-[#2f6fb0] text-white" : "bg-white/90 text-[#111a18]")}>
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
          <button type="button" onClick={() => setShowAll((s) => !s)} aria-pressed={showAll} title="სამივე მარშრუტი და კონტინენტები" className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", showAll ? "bg-[#2f6fb0] text-white" : "bg-white/90 text-[#111a18]")}>
            <Ship className="size-5" />
          </button>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-white/92 px-3 py-2 text-sm shadow-sm">
          <p className="font-semibold">{current?.name}</p>
          <p className="text-[13px] text-[#66736f] tabular-nums">
            {current?.when} · გავლილია ~{nf(Math.round((PATHS[id].km * progress) / 100) * 100)} კმ
          </p>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="flex justify-between text-sm">
              <span className="font-semibold">მოგზაურობის მსვლელობა</span>
              <span className="tabular-nums text-[#33413e]">{Math.round(progress * 100)}%</span>
            </span>
            <input type="range" min={0} max={1} step={0.002} value={progress} onChange={(e) => { setPlaying(false); setProgress(Number(e.target.value)); followRef.current = true; }} className="mt-1 w-full" style={{ accentColor: voyage.color }} aria-label="მოგზაურობის მსვლელობა" />
          </label>
          <div>
            <h2 className="text-lg">{voyage.name}</h2>
            <p className="mt-1 text-sm text-[#66736f]">
              {voyage.captain} · {voyage.years} · {voyage.ships}
            </p>
            <p className="mt-2 text-[15px] leading-7 text-[#33413e]">{current?.note ?? voyage.result}</p>
            {current?.note && <p className="mt-2 text-[14px] leading-6 text-[#66736f]">{voyage.result}</p>}
          </div>
          {showAll && (
            <ul className="flex flex-col gap-1.5 rounded-lg bg-[#f5f7f6] p-3 text-[14px] leading-6 text-[#33413e]">
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
                    <span className="block text-[12px] text-[#66736f]">{s.when}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="px-5 pb-3 text-[11px] leading-4 text-[#97a29e]">მარშრუტები გამარტივებულია (სასკოლო ატლასის სიზუსტით); ნაჩვენებია მხოლოდ გზა „იქით“. დედამიწის სურათი: NASA Blue Marble.</p>
    </section>
  );
}
