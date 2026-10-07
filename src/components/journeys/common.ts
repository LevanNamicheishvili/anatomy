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
  // Wet, slightly translucent-looking red cells.
  const mat = k.material({ color: "#ffffff", roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.6, sheenColor: new THREE.Color("#ff8a8a"), emissive: "#3a0508", emissiveIntensity: 0.4 });
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

/**
 * Give an atlas mesh (which has no UVs) cylindrical UVs round an axis — u round it, v along it in metres
 * × `perMetre` — so a fibre or bone normal map can run along the muscle or bone.
 */
export function cylinderUV(geo: THREE.BufferGeometry, origin: V3, axis: V3, perMetre = 20) {
  const a = axis.clone().normalize();
  const e1 = new THREE.Vector3().crossVectors(a, Math.abs(a.z) < 0.9 ? v(0, 0, 1) : v(1, 0, 0)).normalize();
  const e2 = new THREE.Vector3().crossVectors(a, e1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).sub(origin);
    uv[i * 2] = (Math.atan2(p.dot(e2), p.dot(e1)) / (2 * Math.PI) + 0.5) * 4;
    uv[i * 2 + 1] = p.dot(a) * perMetre;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

/** Beads (molecules, hormone, smoke) travelling along a curve again and again. */
export function beads(k: Kit, parent: THREE.Object3D, curve: THREE.Curve<V3>, o: { n: number; color: THREE.ColorRepresentation; size: number; speed: number; spread?: number; seed?: number; emissive?: number; geometry?: THREE.BufferGeometry }) {
  const mat = k.material({ color: o.color, emissive: o.color, emissiveIntensity: o.emissive ?? 0.5, roughness: 0.35 });
  const mesh = new THREE.InstancedMesh(o.geometry ?? k.sphere, mat, o.n);
  mesh.frustumCulled = false;
  parent.add(mesh);
  const r = rng(o.seed ?? 17);
  const items = Array.from({ length: o.n }, () => ({ u: r(), off: v(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar((o.spread ?? 0) * 2), spin: r() * 6 }));
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const s = new THREE.Vector3();
  const update = (t: number, amount = 1) => {
    items.forEach((it, i) => {
      const u = (it.u + t * o.speed) % 1;
      curve.getPointAt(u, p).add(it.off);
      const fade = Math.min(1, u * 8, (1 - u) * 8) * (i < o.n * amount ? 1 : 0);
      q.setFromEuler(e.set(it.spin + t, it.spin * 2, 0));
      m.compose(p, q, s.setScalar(o.size * fade));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { mesh, mat, update };
}

export const curve = (pts: V3[]) => new THREE.CatmullRomCurve3(pts, false, "centripetal");

/** Make a part glow (pulse) — for the organ the stage is about. */
export function glow(mat: THREE.MeshPhysicalMaterial, t: number, on: boolean, base = 0.15) {
  mat.emissiveIntensity = on ? base + 0.35 * (0.5 + 0.5 * Math.sin(t * 4)) : 0;
}
