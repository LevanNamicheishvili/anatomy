import * as THREE from "three";
import type { Body, BodyPart } from "./body-model";
import { rng, v, type Kit, type V3 } from "./JourneyScene";

/** Oxygen-poor (venous) and oxygen-rich (arterial) blood. */
export const VENOUS = new THREE.Color("#5e1630");
export const ARTERIAL = new THREE.Color("#e3262f");

/** Some of the body's parts merged into one mesh. */
export function layer(k: Kit, body: Body, parent: THREE.Object3D, filter: (p: BodyPart) => boolean, mat: THREE.Material, order = 0) {
  const m = new THREE.Mesh(body.merged(filter), mat);
  m.renderOrder = order;
  parent.add(m);
  return m;
}

/** Skin and skeleton as faint context around what a journey is about. */
export function context(k: Kit, body: Body, parent: THREE.Object3D, skin = 0.08, bones = 0.16, skip: string[] = []) {
  return {
    skin: skin ? layer(k, body, parent, (p) => p.group === "skin", k.ghost("#e8b79e", skin, { side: THREE.FrontSide }), 6) : null,
    bones: bones ? layer(k, body, parent, (p) => ["skeleton", "femur", "humerus", "radius", "ulna"].includes(p.group) && !skip.includes(p.group), k.ghost("#e3d9c6", bones), 5) : null,
  };
}

/**
 * Small things travelling from one point to another again and again (oxygen leaving the blood, cells
 * leaving the marrow); each grows in and fades out.
 */
export function flow(k: Kit, parent: THREE.Object3D, o: { n: number; geometry?: THREE.BufferGeometry; color: THREE.ColorRepresentation; size: number; from: (i: number) => V3; to: (i: number) => V3; period: number; seed?: number; emissive?: number }) {
  const mat = k.material({ color: o.color, emissive: o.color, emissiveIntensity: o.emissive ?? 0.35, roughness: 0.4 });
  const mesh = new THREE.InstancedMesh(o.geometry ?? k.sphere, mat, o.n);
  mesh.frustumCulled = false;
  parent.add(mesh);
  const r = rng(o.seed ?? 7);
  const phase = Array.from({ length: o.n }, () => r());
  const from = Array.from({ length: o.n }, (_, i) => o.from(i));
  const to = Array.from({ length: o.n }, (_, i) => o.to(i));
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const update = (t: number) => {
    for (let i = 0; i < o.n; i++) {
      const f = (t / o.period + phase[i]) % 1;
      p.lerpVectors(from[i], to[i], f * f * (3 - 2 * f));
      const size = o.size * Math.min(1, Math.sin(Math.PI * f) * 2.5);
      m.compose(p, q, s.setScalar(size));
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { mesh, update };
}

/** Red cells streaming along a curve; `color(u)` gives the colour at each point (oxygen picked up or given off). */
export function stream(k: Kit, parent: THREE.Object3D, curve: THREE.Curve<V3>, o: { n: number; size: number; spread: number; speed: number; color: (u: number) => THREE.Color; seed?: number }) {
  const mat = k.material({ color: "#ffffff", roughness: 0.38, clearcoat: 0.5, sheen: 0.4, sheenColor: new THREE.Color("#ff9a9a") });
  const mesh = new THREE.InstancedMesh(k.redCell(), mat, o.n);
  mesh.frustumCulled = false;
  parent.add(mesh);
  const r = rng(o.seed ?? 3);
  const cells = Array.from({ length: o.n }, () => ({ u: r(), a: r() * 6.28, b: r() * 6.28, off: v(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(o.spread * 2), spin: 0.4 + r() }));
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3().setScalar(o.size);
  const update = (t: number) => {
    cells.forEach((c, i) => {
      const u = (c.u + t * o.speed) % 1;
      curve.getPointAt(u, p).add(c.off);
      q.setFromEuler(e.set(c.a + t * c.spin, c.b, t * c.spin * 0.6));
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, o.color(u));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  update(0);
  return { mesh, update };
}

/** A gentle orbit around a point: angle grows with time. */
export function orbit(target: V3, dist: number, t: number, o: { start?: number; speed?: number; height?: number } = {}) {
  const a = (o.start ?? 0) + t * (o.speed ?? 0.12);
  return { target, pos: target.clone().add(v(Math.sin(a) * dist, (o.height ?? 0.3) * dist, Math.cos(a) * dist)) };
}

export const lerp3 = (a: V3, b: V3, t: number) => a.clone().lerp(b, t);
