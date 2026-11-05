"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { latLonToVec3 } from "@/components/geography/globe/coords";
import { GlobeScene } from "@/components/geography/globe/GlobeScene";
import { GEORGIA_OUTLINES } from "@/components/geography/georgia-outline";
import { ease, type StageProps } from "./stage";

/*
 * The Earth in space, the camera coming slowly round to Georgia, its regions drawn in gold. Opens and closes the
 * presentation; `far`: stay further out (the closing screen, the words over the planet).
 */

const GEORGIA = { lat: 42.2, lon: 43.5 };
const FLIGHT = 14;

/** Georgia's outlines as thin tubes (a WebGL line is one pixel wide: too thin for a projector). */
function georgiaLines(radius: number) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color: "#ffd76a" });
  for (const ring of Object.values(GEORGIA_OUTLINES)) {
    const points = ring.map(([lon, lat]) => latLonToVec3(lat, lon, radius * 1.003));
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true, "centripetal"), Math.max(32, ring.length * 2), radius * 0.0024, 5, true), material));
  }
  return group;
}

/** A soft golden glow over Georgia, so it finds the eye from the back of a hall. */
function georgiaGlow(radius: number) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,215,106,0.75)");
  g.addColorStop(0.35, "rgba(255,190,70,0.28)");
  g.addColorStop(1, "rgba(255,180,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
  latLonToVec3(GEORGIA.lat, GEORGIA.lon, radius * 1.01, sprite.position);
  sprite.scale.setScalar(radius * 0.34);
  return sprite;
}

export default function GlobeStage({ onReady, far = false }: StageProps & { far?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const globe = new GlobeScene(canvas, { sun: new THREE.Vector3(3, 1.4, 3.4) });
    globe.setMapVisible(false);
    globe.controls.enabled = false;
    const glow = georgiaGlow(globe.radius);
    globe.earth.add(georgiaLines(globe.radius), glow);
    const to = globe.position(GEORGIA.lat - 9, GEORGIA.lon).setLength(far ? 3 : 2.3);
    const from = globe.position(18, -38).setLength(far ? 3.6 : 4.4);
    const turn = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
    const q = new THREE.Quaternion();
    const start = performance.now();
    let told = false;
    globe.onFrame = (project) => {
      const t = (performance.now() - start) / 1000;
      glow.material.opacity = 0.7 + 0.3 * Math.sin(t * 1.8);
      const p = project(GEORGIA.lat + 2.4, GEORGIA.lon, 0.01);
      const name = nameRef.current;
      if (name) {
        name.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
        name.style.opacity = p.visible && t > FLIGHT * 0.6 ? "1" : "0";
      }
      const k = ease(Math.min(1, t / FLIGHT));
      q.identity().slerp(turn, k);
      globe.camera.position.copy(from).normalize().applyQuaternion(q).setLength(THREE.MathUtils.lerp(from.length(), to.length(), k));
      if (!told) {
        told = true;
        // The photo of the Earth is loading by now: give it a moment before the curtain opens.
        window.setTimeout(() => readyRef.current(), 500);
      }
    };
    return () => globe.dispose();
  }, [far]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label="დედამიწა და საქართველო" />
      <span ref={nameRef} className="pointer-events-none absolute top-0 left-0 font-heading text-[clamp(1.1rem,2vw,2.2rem)] text-[#ffd76a] opacity-0 transition-opacity duration-700 [text-shadow:0_2px_10px_rgba(0,0,0,0.9)]">
        საქართველო
      </span>
    </>
  );
}
