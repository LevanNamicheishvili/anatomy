import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { rng, v, type Kit, type V3 } from "@/components/journeys/JourneyScene";
import { fbm } from "@/lib/noise";

/*
 * Shapes for genetics and cell lessons: peas (round or wrinkled), pea plants, chromosomes, bacteria with
 * plasmids, a bacteriophage, sperm and egg, a sheep, pedigree symbols, a DNA ladder.
 */

/** A pea; wrinkled peas get a dented surface. */
export function pea(k: Kit, yellow: boolean, round = true, size = 0.5) {
  let geo: THREE.BufferGeometry = k.sphere;
  if (!round) {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 4).deleteAttribute("normal").deleteAttribute("uv"));
    const p = g.attributes.position as THREE.BufferAttribute;
    const n = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      n.fromBufferAttribute(p, i).normalize();
      const r = 1 - 0.18 * Math.abs(fbm(n.x * 2.5, n.y * 2.5, n.z * 2.5, 3)) * 2;
      p.setXYZ(i, n.x * r, n.y * r * 0.85, n.z * r);
    }
    g.computeVertexNormals();
    geo = k.track(g);
  }
  const m = new THREE.Mesh(geo, k.material({ color: yellow ? "#e9c63a" : "#6aa83a", roughness: 0.35, clearcoat: 0.7, sheen: 0.4, sheenColor: new THREE.Color("#ffffff") }));
  m.scale.setScalar(size);
  return m;
}

/** A pea plant: stem, leaves, flowers, pods. */
export function peaPlant(k: Kit, o: { tall?: boolean; flower?: string; seed?: number } = {}) {
  const g = new THREE.Group();
  const r = rng(o.seed ?? 1);
  const H = o.tall === false ? 1.2 : 2.6;
  const green = k.material({ color: "#5e9e3a", roughness: 0.6, sheen: 0.5, sheenColor: new THREE.Color("#d8f0a0") });
  const pts: V3[] = [];
  for (let i = 0; i <= 8; i++) pts.push(v(Math.sin(i * 0.9) * 0.08, (i / 8) * H, Math.cos(i * 1.1) * 0.08));
  const stem = new THREE.Mesh(k.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.04, 6)), green);
  g.add(stem);
  const flowers: THREE.Mesh[] = [];
  for (let i = 1; i < 8; i++) {
    const p = pts[i];
    const leaf = new THREE.Mesh(k.sphere, green);
    leaf.scale.set(0.22, 0.03, 0.12);
    leaf.position.copy(p).add(v(i % 2 ? 0.2 : -0.2, 0, 0));
    leaf.rotation.z = (i % 2 ? -1 : 1) * 0.3;
    g.add(leaf);
    if (i > 4) {
      const fl = new THREE.Mesh(k.sphere, k.material({ color: o.flower ?? "#a46be0", roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color("#ffffff") }));
      fl.scale.set(0.13, 0.11, 0.08);
      fl.position.copy(p).add(v(i % 2 ? -0.18 : 0.18, 0.08, 0.05));
      g.add(fl);
      flowers.push(fl);
    } else if (r() < 0.8) {
      const pod = new THREE.Mesh(k.sphere, green);
      pod.scale.set(0.05, 0.22, 0.05);
      pod.position.copy(p).add(v(i % 2 ? -0.18 : 0.18, -0.12, 0));
      pod.rotation.z = (i % 2 ? 1 : -1) * 0.4;
      g.add(pod);
    }
  }
  return { g, flowers };
}

/**
 * A chromosome: two sister chromatids joined at the centromere (or one if `single`). Bands as rings of
 * another colour at positions 0..1 along the arm.
 */
export function chromosome(k: Kit, o: { color: string; length?: number; single?: boolean; bands?: { at: number; color: string }[]; y?: boolean }) {
  const g = new THREE.Group();
  const L = o.length ?? 1.6;
  const mat = k.material({ color: o.color, roughness: 0.5, clearcoat: 0.4, normalMap: k.normalMap("organic", [1, 3]) });
  const geo = k.track(new THREE.CapsuleGeometry(0.16, L, 6, 14));
  const arms = o.single ? [0] : [-1, 1];
  for (const s of arms) {
    const c = new THREE.Mesh(geo, mat);
    c.position.x = s * 0.15;
    c.rotation.z = s * 0.12;
    g.add(c);
    for (const b of o.bands ?? []) {
      const band = new THREE.Mesh(k.cylinder, k.material({ color: b.color, roughness: 0.4, emissive: b.color, emissiveIntensity: 0.3 }));
      band.scale.set(0.175, 0.12, 0.175);
      band.position.set(s * 0.15 + s * 0.12 * (b.at - 0.5) * L * -0.12, (b.at - 0.5) * L, 0);
      g.add(band);
    }
  }
  return g;
}

/** A rod bacterium with a plasmid ring showing through. */
export function bacterium(k: Kit, color = "#7cc66a") {
  const g = new THREE.Group();
  const body = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.8, 2.2, 8, 24)), k.ghost(color, 0.45, { roughness: 0.3, clearcoat: 0.8, normalMap: k.normalMap("organic", [3, 2]), side: THREE.DoubleSide }));
  body.rotation.z = Math.PI / 2;
  g.add(body);
  const dna = new THREE.Mesh(k.track(new THREE.TorusKnotGeometry(0.45, 0.04, 120, 6, 3, 5)), k.material({ color: "#5b8def", roughness: 0.4 }));
  dna.scale.set(1.3, 0.8, 0.8);
  g.add(dna);
  const plasmid = new THREE.Mesh(k.track(new THREE.TorusGeometry(0.22, 0.04, 8, 32)), k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.3 }));
  plasmid.position.set(1.0, 0.2, 0.2);
  g.add(plasmid);
  return { g, body, plasmid, dna };
}

export function phage(k: Kit) {
  const g = new THREE.Group();
  const metal = k.material({ color: "#b9c4cc", roughness: 0.3, metalness: 0.4, clearcoat: 0.6 });
  const head = new THREE.Mesh(k.track(new THREE.IcosahedronGeometry(0.5, 0)), metal);
  head.position.y = 1.4;
  const tail = new THREE.Mesh(k.cylinder, metal);
  tail.scale.set(0.09, 0.9, 0.09);
  tail.position.y = 0.6;
  g.add(head, tail);
  for (let i = 0; i < 6; i++) {
    const leg = new THREE.Mesh(k.cylinder, metal);
    const a = (i / 6) * Math.PI * 2;
    leg.scale.set(0.025, 0.6, 0.025);
    leg.position.set(Math.cos(a) * 0.25, 0.0, Math.sin(a) * 0.25);
    leg.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
    g.add(leg);
  }
  return g;
}

export function egg(k: Kit, size = 2) {
  const g = new THREE.Group();
  const cell = new THREE.Mesh(k.sphere, k.ghost("#f3c9b8", 0.55, { roughness: 0.3, clearcoat: 0.6, normalMap: k.normalMap("organic", [2, 2]) }));
  cell.scale.setScalar(size);
  const corona = new THREE.Mesh(k.sphere, k.ghost("#f8e6d0", 0.15, { side: THREE.DoubleSide }));
  corona.scale.setScalar(size * 1.15);
  const nuc = new THREE.Mesh(k.sphere, k.material({ color: "#8a5ab0", roughness: 0.5 }));
  nuc.scale.setScalar(size * 0.3);
  g.add(cell, corona, nuc);
  return { g, nuc };
}

export function sperm(k: Kit, color = "#d8dde0") {
  const g = new THREE.Group();
  const mat = k.material({ color, roughness: 0.4, clearcoat: 0.6 });
  const head = new THREE.Mesh(k.sphere, mat);
  head.scale.set(0.16, 0.1, 0.24);
  g.add(head);
  const pts = Array.from({ length: 12 }, (_, i) => v(0, 0, -0.24 - i * 0.1));
  const tail = new THREE.Mesh(k.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 5)), mat);
  g.add(tail);
  const p = tail.geometry.attributes.position as THREE.BufferAttribute;
  const base = (p.array as Float32Array).slice();
  return {
    g,
    /** Beat the tail. */
    swim: (t: number) => {
      for (let i = 0; i < p.count; i++) {
        const z = base[i * 3 + 2];
        p.setX(i, base[i * 3] + Math.sin(t * 12 + z * 6) * 0.08 * Math.min(1, -z));
      }
      p.needsUpdate = true;
    },
  };
}

export function sheep(k: Kit, face = "#f2ede4") {
  const g = new THREE.Group();
  const wool = k.material({ color: "#f3efe6", roughness: 1, clearcoat: 0, normalMap: k.normalMap("organic", [6, 6]), normalScale: new THREE.Vector2(1.5, 1.5) });
  const faceM = k.material({ color: face, roughness: 0.8 });
  const body = new THREE.Mesh(k.sphere, wool);
  body.scale.set(0.5, 0.42, 0.75);
  body.position.y = 0.85;
  const head = new THREE.Mesh(k.sphere, faceM);
  head.scale.set(0.17, 0.2, 0.26);
  head.position.set(0, 1.05, 0.78);
  head.rotation.x = 0.4;
  g.add(body, head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(k.sphere, faceM);
    ear.scale.set(0.12, 0.04, 0.06);
    ear.position.set(s * 0.2, 1.13, 0.7);
    g.add(ear);
    for (const z of [-0.4, 0.4]) {
      const leg = new THREE.Mesh(k.cylinder, faceM);
      leg.scale.set(0.06, 0.6, 0.06);
      leg.position.set(s * 0.22, 0.3, z);
      g.add(leg);
    }
  }
  return g;
}

/** Pedigree symbol: square (male) or circle (female); filled = has the trait, half = carrier. */
export function person(k: Kit, male: boolean, state: "healthy" | "affected" | "carrier") {
  const g = new THREE.Group();
  const geo = male ? k.track(new THREE.BoxGeometry(0.9, 0.9, 0.25)) : k.track(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 32).rotateX(Math.PI / 2));
  const base = new THREE.Mesh(geo, k.material({ color: state === "affected" ? "#c0392b" : "#f4f1ea", roughness: 0.5 }));
  g.add(base);
  if (state === "carrier") {
    const half = new THREE.Mesh(male ? k.track(new THREE.BoxGeometry(0.45, 0.9, 0.27)) : k.track(new THREE.CylinderGeometry(0.5, 0.5, 0.27, 32, 1, false, 0, Math.PI).rotateX(Math.PI / 2)), k.material({ color: "#c0392b" }));
    if (male) half.position.x = 0.225;
    g.add(half);
  }
  return g;
}

/** A short DNA ladder along x (for cutting and pasting genes). */
export function dnaLadder(k: Kit, n: number, o: { color?: string; highlight?: [number, number]; hl?: string } = {}) {
  const g = new THREE.Group();
  const back = k.material({ color: o.color ?? "#d8d2c4", roughness: 0.4 });
  const gold = k.material({ color: o.hl ?? "#f2c230", emissive: o.hl ?? "#f2c230", emissiveIntensity: 0.3 });
  const rungMats = ["#e8564a", "#f2c230", "#3b82c4", "#4bb36b"].map((c) => k.material({ color: c, roughness: 0.5 }));
  const r = rng(n);
  for (let i = 0; i < n; i++) {
    const inHl = o.highlight && i >= o.highlight[0] && i < o.highlight[1];
    const a = i * 0.6;
    for (const s of [0, Math.PI]) {
      const b = new THREE.Mesh(k.sphere, inHl ? gold : back);
      b.position.set(i * 0.34, Math.cos(a + s) * 0.5, Math.sin(a + s) * 0.5);
      b.scale.setScalar(0.12);
      g.add(b);
    }
    const rung = new THREE.Mesh(k.cylinder, rungMats[Math.floor(r() * 4)]);
    rung.position.set(i * 0.34, 0, 0);
    rung.quaternion.setFromUnitVectors(v(0, 1, 0), v(0, Math.cos(a), Math.sin(a)));
    rung.scale.set(0.05, 1, 0.05);
    g.add(rung);
  }
  return g;
}
