"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { sceneFrame } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { cn } from "@/lib/utils";
import { GlobeScene } from "../globe/GlobeScene";
import { MapButton } from "../globe/MapButton";
import { globePath, pathTube, type GlobePath } from "../globe/paths";
import { CURRENTS, type Current } from "./ocean-data";

/*
 * Topic 10 — warm (red) and cold (blue) surface currents on the globe; dots drift along each one in the
 * direction of flow. Click a label to read what the current does to the climate of the coast it washes.
 */

const WARM = "#ef4444";
const COLD = "#3b82f6";
const DOTS = 7;
const PATHS: GlobePath[] = CURRENTS.map((c) => globePath(c.path, 1, 0.008));

/** What the narration sets: which currents are drawn, which light up, where the globe turns to. */
export interface CurrentsNarr {
  show: "all" | "warm" | "cold";
  lit: string[];
  /** Latitude, longitude, distance (Earth radii). */
  focus: [number, number, number];
}

export function CurrentsGlobe({ narr }: { narr?: CurrentsNarr | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const labelsRef = useRef<HTMLDivElement>(null);
  const [chosen, setShow] = useState<"all" | "warm" | "cold">("all");
  const [picked, setActive] = useState<Current>(CURRENTS[1]);
  const show = narr?.show ?? chosen;
  const lit = new Set(narr?.lit ?? []);
  const active = CURRENTS.find((c) => c.id === narr?.lit[0]) ?? picked;
  const [map, setMap] = useState(true);
  const meshes = useRef<THREE.Object3D[][]>([]);
  const globeRef = useRef<GlobeScene | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const layer = labelsRef.current;
    if (!canvas || !layer) return;
    const globe = new GlobeScene(canvas, { flatLight: true, autoRotate: true });
    globe.map.avoid(layer);
    globeRef.current = globe;
    const dotGeo = new THREE.ConeGeometry(0.012, 0.035, 8);
    dotGeo.rotateX(Math.PI / 2);
    const runners: { mesh: THREE.Mesh; path: GlobePath; i: number; speed: number }[] = [];
    meshes.current = CURRENTS.map((c, k) => {
      const color = c.warm ? WARM : COLD;
      const tube = pathTube(PATHS[k], 0.0055, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 })).mesh;
      const objs: THREE.Object3D[] = [tube];
      const mat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
      const n = Math.max(3, Math.round((DOTS * PATHS[k].km) / 6000));
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(dotGeo, mat);
        runners.push({ mesh: m, path: PATHS[k], i: i / n, speed: 2200 / PATHS[k].km });
        objs.push(m);
      }
      globe.earth.add(...objs);
      return objs;
    });
    globe.camera.position.copy(globe.position(30, -40)).setLength(3.5);

    const els = [...layer.querySelectorAll<HTMLElement>("[data-lat]")];
    const tan = new THREE.Vector3();
    const start = performance.now();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    globe.onFrame = (project) => {
      const t = still ? 0 : (performance.now() - start) / 1000;
      for (const r of runners) {
        const u = (r.i + t * r.speed * 0.02) % 1;
        r.path.curve.getPointAt(u, r.mesh.position);
        r.path.curve.getTangentAt(u, tan);
        r.mesh.up.copy(r.mesh.position).normalize();
        r.mesh.lookAt(r.mesh.position.clone().add(tan));
      }
      for (const el of els) {
        const p = project(Number(el.dataset.lat), Number(el.dataset.lon), 0.03);
        el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
        const on = p.visible && el.dataset.on === "1";
        el.style.opacity = on ? "1" : "0";
        el.style.pointerEvents = on ? "auto" : "none";
      }
    };
    return () => {
      globe.dispose();
      globeRef.current = null;
      meshes.current = [];
    };
  }, []);

  useEffect(() => {
    globeRef.current?.setMapVisible(map);
  }, [map]);

  const focus = narr?.focus.join(" ");
  useEffect(() => {
    if (!focus) return;
    const [lat, lon, dist] = focus.split(" ").map(Number);
    globeRef.current?.focus(lat, lon, dist);
  }, [focus]);

  useEffect(() => {
    CURRENTS.forEach((c, k) => {
      const on = show === "all" || (show === "warm") === c.warm;
      for (const o of meshes.current[k] ?? []) o.visible = on;
    });
  }, [show]);

  return (
    <div ref={fsRef}>
      <div className={cn("relative bg-[radial-gradient(ellipse_at_center,#14233a_0%,#05080f_80%)]", sceneFrame)} data-scene>
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label="ოკეანის თბილი და ცივი დინებები გლობუსზე" />
        <div className="absolute top-3 right-3 flex flex-col gap-1.5">
          <MapButton on={map} onClick={() => setMap((m) => !m)} />
          <FullscreenButton full={fsOn} onClick={fsToggle} />
        </div>
        <div ref={labelsRef} className="pointer-events-none absolute inset-0 overflow-hidden text-[11px] font-semibold whitespace-nowrap">
          {CURRENTS.map((c) => {
            const at = c.path[c.labelAt];
            const on = show === "all" || (show === "warm") === c.warm;
            return (
              <button key={c.id} type="button" data-lat={at.lat} data-lon={at.lon} data-on={on ? "1" : "0"} onClick={() => setActive(c)} className={cn("absolute top-0 left-0 rounded px-1.5 py-0.5 text-white opacity-0 shadow", active.id === c.id && "ring-2 ring-white", lit.has(c.id) && "z-10 text-[14px] ring-2 ring-[#ffd76a]")} style={{ backgroundColor: c.warm ? WARM : COLD }}>
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {(
            [
              ["all", "ყველა დინება"],
              ["warm", "თბილი"],
              ["cold", "ცივი"],
            ] as const
          ).map(([k, name]) => (
            <button key={k} type="button" onClick={() => setShow(k)} aria-pressed={show === k} className={cn("h-9 rounded-lg px-3 text-sm font-semibold shadow-sm", show === k ? "text-white" : "bg-card/92 text-ink")} style={show === k ? { backgroundColor: k === "warm" ? WARM : k === "cold" ? COLD : "#2f6fb0" } : undefined}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_15rem]">
        <div>
          <h2 className="flex items-center gap-2 text-lg">
            <span className="size-3 rounded-full" style={{ backgroundColor: active.warm ? WARM : COLD }} />
            {active.name} დინება
            <span className="text-sm font-normal text-mute">· {active.warm ? "თბილი" : "ცივი"}</span>
          </h2>
          <p className="mt-2 text-[15px] leading-7 text-copy">{active.effect}</p>
        </div>
        <div className="rounded-lg bg-subtle p-3 text-[14px] leading-6 text-copy">
          <b>თბილი დინება</b> ნაპირის ჰავას ათბობს და ატენიანებს — მეტი ნალექი. <b>ცივი დინება</b> აგრილებს და ამშრალებს: მის ნაპირზე ხშირად უდაბნოებია.
        </div>
      </div>
    </div>
  );
}
