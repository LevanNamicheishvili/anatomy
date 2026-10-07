import * as THREE from "three";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { rng, v, type Kit, type V3 } from "@/components/journeys/JourneyScene";
import { fbm } from "@/lib/noise";
import { model, natureAssets } from "./nature-assets";

/*
 * A small nature kit for the ecology and evolution lessons: rolling ground, trees, grass, water, sky,
 * and animals built from shapes (rabbit, fox, bird, fish, moth, giraffe, frog, beetle, mushroom).
 * Units are metres-ish: a rabbit is ~0.5, a tree 4–7, the ground ~30 across.
 */

/** Height of the ground at (x, z): gentle hills, dropping away at the rim. */
export const heightAt = (x: number, z: number, radius = 15) => {
  const d = Math.hypot(x, z);
  return 0.9 * fbm(x * 0.08, 0, z * 0.08, 3) - 4 * THREE.MathUtils.smoothstep(d, radius * 0.8, radius * 1.15);
};

export function ground(k: Kit, parent: THREE.Object3D, o: { radius?: number; grass?: string; soil?: string; flat?: V3[] } = {}) {
  const R = o.radius ?? 15;
  const geo = k.track(new THREE.PlaneGeometry(R * 2.6, R * 2.6, 110, 110).rotateX(-Math.PI / 2));
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const g1 = new THREE.Color(o.grass ?? "#6f9c48");
  const g2 = new THREE.Color("#a3b85a");
  const soil = new THREE.Color(o.soil ?? "#7a5a3c");
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let y = heightAt(x, z, R);
    // Flatten round given spots (a pond, a town).
    for (const f of o.flat ?? []) y = THREE.MathUtils.lerp(f.y, y, THREE.MathUtils.smoothstep(Math.hypot(x - f.x, z - f.z), 2.5, 5));
    pos.setY(i, y);
    const n = fbm(x * 0.3, 1, z * 0.3, 3);
    c.copy(g1).lerp(g2, THREE.MathUtils.clamp(0.5 + n, 0, 1));
    c.lerp(soil, THREE.MathUtils.smoothstep(Math.hypot(x, z), R * 0.85, R * 1.05));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const A = natureAssets();
  // A photo-scanned grass-and-soil texture, tinted by the vertex colours above.
  const map = A ? k.track(A.ground.clone()) : null;
  const nor = A ? k.track(A.groundNor.clone()) : null;
  for (const t of [map, nor]) if (t) {
    t.repeat.set(R * 0.6, R * 0.6);
    t.needsUpdate = true;
  }
  const mat = k.material({ color: "#ffffff", vertexColors: true, roughness: 0.95, clearcoat: 0, map, normalMap: nor ?? k.normalMap("organic", [30, 30]), normalScale: new THREE.Vector2(0.8, 0.8) });
  const mesh = new THREE.Mesh(geo, mat);
  parent.add(mesh);
  return { mesh, mat };
}

/** A noisy blob (crowns, rocks, clouds). */
function blobGeo(k: Kit, seed: number, amount = 0.25, detail = 3) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute("normal").deleteAttribute("uv"));
  const p = g.attributes.position as THREE.BufferAttribute;
  const n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    const r = 1 + amount * fbm(n.x * 1.8 + seed, n.y * 1.8, n.z * 1.8 - seed, 3);
    p.setXYZ(i, n.x * r, n.y * r, n.z * r);
  }
  g.computeVertexNormals();
  return k.track(g);
}

export interface Materials {
  bark: THREE.MeshPhysicalMaterial;
  leaf: THREE.MeshPhysicalMaterial;
  pine: THREE.MeshPhysicalMaterial;
  rock: THREE.MeshPhysicalMaterial;
  /** Shared crown shapes for broad-leaved trees. */
  crowns: THREE.BufferGeometry[];
}

export function natureMaterials(k: Kit): Materials {
  return {
    bark: k.material({ color: "#6b4a32", roughness: 0.9, clearcoat: 0, normalMap: k.normalMap("fibre", [3, 2]) }),
    leaf: k.material({ color: "#4f8a3a", roughness: 0.75, clearcoat: 0, sheen: 0.6, sheenColor: new THREE.Color("#c7e58a"), normalMap: k.normalMap("organic", [3, 3]) }),
    pine: k.material({ color: "#2f5f3a", roughness: 0.8, clearcoat: 0, normalMap: k.normalMap("fibre", [6, 2]) }),
    rock: k.material({ color: "#8a8780", roughness: 0.9, clearcoat: 0, normalMap: k.normalMap("bone", [2, 2]) }),
    crowns: [0, 1, 2, 3].map((i) => blobGeo(k, i * 3.1, 0.3)),
  };
}

/**
 * A tree from photographed bark and leaf sprays: a tapering trunk with branches and a crown of ~80 leaf
 * cards (alpha-cut, so the light comes through and the shadow is leafy). One draw call for the crown.
 */
function cardTree(k: Kit, parent: THREE.Object3D, at: V3, s: number, seed: number, pine: boolean) {
  const A = natureAssets()!;
  const r = rng(seed);
  const t = new THREE.Group();
  t.position.copy(at);
  t.scale.setScalar(s);
  const barkMap = k.track(A.bark.clone());
  const barkNor = k.track(A.barkNor.clone());
  for (const x of [barkMap, barkNor]) {
    x.repeat.set(1, 3);
    x.needsUpdate = true;
  }
  const bark = k.material({ color: "#c8b8a8", map: barkMap, normalMap: barkNor, roughness: 0.9, clearcoat: 0 });
  const H = pine ? 5.5 : 4.6;
  const lean = v((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3);
  k.tube([v(0, -0.1, 0), v(0, H * 0.3, 0).add(lean.clone().multiplyScalar(0.4)), v(0, H * 0.62, 0).add(lean), v(0, H * (pine ? 0.95 : 0.8), 0).add(lean)], (u) => (pine ? 0.2 : 0.24) * (1 - 0.8 * u) + 0.02, bark, t, 24, 10);
  if (!pine)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + r();
      const y = H * (0.45 + r() * 0.2);
      const base = v(0, y, 0).add(lean.clone().multiplyScalar(y / H));
      k.tube([base, base.clone().add(v(Math.cos(a) * 0.6, 0.5, Math.sin(a) * 0.6)), base.clone().add(v(Math.cos(a) * 1.3, 1.1 + r() * 0.4, Math.sin(a) * 1.3))], (u) => 0.09 * (1 - 0.7 * u), bark, t, 10, 6);
    }
  const leafMat = new THREE.MeshStandardMaterial({ map: A.leaves, normalMap: A.leavesNor, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: pine ? "#6f8f6a" : "#ffffff" });
  k.track(leafMat);
  const N = pine ? 90 : 80;
  const cards = new THREE.InstancedMesh(k.track(new THREE.PlaneGeometry(1.7, 1.7)), leafMat, N);
  cards.customDepthMaterial = k.track(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: A.leaves, alphaTest: 0.45 }));
  cards.castShadow = true;
  cards.userData.noShadowFit = true;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    let p: V3;
    if (pine) {
      const h = r();
      const rad = (1 - h) * 1.7 * Math.sqrt(r());
      const a = r() * Math.PI * 2;
      p = v(Math.cos(a) * rad, H * (0.25 + 0.75 * h), Math.sin(a) * rad);
    } else {
      const d = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(Math.cbrt(r()));
      p = v(d.x * 2.1, H * 0.8 + d.y * 1.4, d.z * 2.1);
    }
    p.add(lean);
    q.setFromEuler(new THREE.Euler(r() * Math.PI, r() * Math.PI * 2, r() * Math.PI));
    m4.compose(p, q, v(1, 1, 1).multiplyScalar(0.7 + r() * 0.6));
    cards.setMatrixAt(i, m4);
    cards.setColorAt(i, c.setHSL(0.24 + r() * 0.06, 0.35 + r() * 0.2, 0.42 + r() * 0.16));
  }
  t.add(cards);
  parent.add(t);
  return t;
}

export function tree(k: Kit, M: Materials, parent: THREE.Object3D, at: V3, o: { scale?: number; kind?: "broad" | "pine"; seed?: number; leaf?: THREE.Material } = {}) {
  if (natureAssets() && !o.leaf) return cardTree(k, parent, at, (o.scale ?? 1) * 1.15, o.seed ?? Math.round(at.x * 13 + at.z * 7 + 101), o.kind === "pine");
  const s = o.scale ?? 1;
  const r = rng(o.seed ?? Math.round(at.x * 13 + at.z * 7));
  const t = new THREE.Group();
  t.position.copy(at);
  t.scale.setScalar(s);
  const trunk = new THREE.Mesh(k.cylinder, M.bark);
  if (o.kind === "pine") {
    trunk.scale.set(0.18, 1.6, 0.18);
    trunk.position.y = 0.8;
    t.add(trunk);
    for (let i = 0; i < 4; i++) {
      const cone = new THREE.Mesh(k.track(new THREE.ConeGeometry(1.5 - i * 0.3, 1.9, 9)), o.leaf ?? M.pine);
      cone.position.y = 1.6 + i * 0.95;
      cone.rotation.y = r() * 3;
      t.add(cone);
    }
  } else {
    trunk.scale.set(0.2, 2.6, 0.2);
    trunk.position.y = 1.3;
    t.add(trunk);
    const C = M.crowns;
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(C[i % C.length], o.leaf ?? M.leaf);
      const a = (i / 6) * Math.PI * 2;
      b.position.set(i === 0 ? 0 : Math.cos(a) * 0.9, 3.2 + (i === 0 ? 0.6 : r() * 0.6), i === 0 ? 0 : Math.sin(a) * 0.9);
      b.scale.setScalar(i === 0 ? 1.3 : 0.85 + r() * 0.3);
      t.add(b);
    }
  }
  parent.add(t);
  return t;
}

export function grass(k: Kit, parent: THREE.Object3D, n: number, radius: number, o: { seed?: number; avoid?: (x: number, z: number) => boolean; color?: string } = {}) {
  const r = rng(o.seed ?? 5);
  // A curved, tapering blade: dark at the base, lighter at the tip.
  const geo = k.track(new THREE.PlaneGeometry(0.07, 0.65, 1, 5).translate(0, 0.325, 0));
  const bp = geo.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(bp.count * 3);
  for (let i = 0; i < bp.count; i++) {
    const h = bp.getY(i) / 0.65;
    bp.setX(i, bp.getX(i) * (1 - 0.85 * h));
    bp.setZ(i, 0.12 * h * h);
    const c = 0.35 + 0.65 * h;
    cols.set([c, c, c], i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  geo.computeVertexNormals();
  const mat = k.material({ color: o.color ?? "#7aa84a", vertexColors: true, roughness: 0.7, clearcoat: 0, side: THREE.DoubleSide, sheen: 0.4, sheenColor: new THREE.Color("#e8f4b0") });
  const im = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let placed = 0;
  for (let i = 0; i < n * 3 && placed < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * radius;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (o.avoid?.(x, z)) continue;
    q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4));
    m.compose(v(x, heightAt(x, z) - 0.05, z), q, v(1, 0.5 + r() * 0.8, 1));
    im.setColorAt(placed, new THREE.Color().setHSL(0.2 + r() * 0.07, 0.4, 0.45 + r() * 0.2));
    im.setMatrixAt(placed++, m);
  }
  im.count = placed;
  parent.add(im);
  return im;
}

export function water(k: Kit, parent: THREE.Object3D, at: V3, radius: number, color = "#3d7fa6") {
  const nm = k.normalMap("organic", [6, 6]);
  const mat = k.material({ color, roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.88, normalMap: nm, normalScale: new THREE.Vector2(0.3, 0.3) });
  const mesh = new THREE.Mesh(k.track(new THREE.CircleGeometry(radius, 64).rotateX(-Math.PI / 2)), mat);
  mesh.position.copy(at);
  parent.add(mesh);
  return { mesh, mat, update: (t: number) => nm.offset.set(t * 0.01, t * 0.007) };
}

export function rock(k: Kit, M: Materials, parent: THREE.Object3D, at: V3, size: number, seed = 1) {
  const real = model("rock", size * 2.2);
  if (real) {
    real.root.position.copy(at).add(v(0, -size * 0.3, 0));
    real.root.rotation.y = seed * 1.7;
    parent.add(real.root);
    return real.root;
  }
  const m = new THREE.Mesh(blobGeo(k, seed, 0.35, 2), M.rock);
  m.position.copy(at);
  m.scale.set(size, size * 0.6, size * 0.9);
  parent.add(m);
  return m;
}

export function cloud(k: Kit, parent: THREE.Object3D, at: V3, size = 1, mat?: THREE.Material) {
  const g = new THREE.Group();
  const cm = mat ?? k.material({ color: "#ffffff", roughness: 1, clearcoat: 0, emissive: "#ffffff", emissiveIntensity: 0.25, transparent: true, opacity: 0.95 });
  const r = rng(Math.round(at.x * 10));
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(k.sphere, cm);
    b.position.set((i - 2.5) * 0.7, r() * 0.4, (r() - 0.5) * 0.6);
    b.scale.setScalar(0.6 + r() * 0.5);
    g.add(b);
  }
  g.position.copy(at);
  g.scale.setScalar(size);
  parent.add(g);
  return g;
}

export function sun(k: Kit, parent: THREE.Object3D, at: V3, size = 1.4) {
  const s = new THREE.Mesh(k.sphere, k.material({ color: "#fff2b0", emissive: "#ffd23f", emissiveIntensity: 1.6 }));
  s.position.copy(at);
  s.scale.setScalar(size);
  parent.add(s);
  return s;
}

/** Sky colour + fog for outdoor scenes. */
export const outdoor = (k: Kit, sky = "#bcd8ea", near = 25, far = 70) => k.mood(sky, near, far, true);

// ---- Animals --------------------------------------------------------------------------------------

const part = (k: Kit, mat: THREE.Material, parent: THREE.Object3D, p: V3, s: V3, geo?: THREE.BufferGeometry) => {
  const m = new THREE.Mesh(geo ?? k.sphere, mat);
  m.position.copy(p);
  m.scale.copy(s);
  parent.add(m);
  return m;
};
const fur = (k: Kit, color: string) => k.material({ color, roughness: 0.85, clearcoat: 0, sheen: 0.8, sheenColor: new THREE.Color("#ffffff"), normalMap: k.normalMap("fibre", [4, 4]), normalScale: new THREE.Vector2(0.5, 0.5) });
const eye = (k: Kit) => k.material({ color: "#111111", roughness: 0.1, clearcoat: 1 });

export interface Animal {
  g: THREE.Group;
  /** Walk / hop / flap cycle, phase in radians. */
  move(phase: number): void;
}

export function rabbit(k: Kit, color = "#9b8a76"): Animal {
  const g = new THREE.Group();
  const m = fur(k, color);
  const body = part(k, m, g, v(0, 0.22, 0), v(0.2, 0.18, 0.28));
  const head = part(k, m, g, v(0, 0.36, 0.24), v(0.12, 0.11, 0.13));
  for (const s of [-1, 1]) {
    const ear = part(k, m, head, v(s * 0.35, 1.4, -0.2), v(0.25, 1.1, 0.12));
    ear.rotation.z = -s * 0.15;
    part(k, eye(k), head, v(s * 0.6, 0.25, 0.55), v(0.18, 0.18, 0.18));
  }
  part(k, k.material({ color: "#f3f0ea", roughness: 0.9 }), g, v(0, 0.28, -0.28), v(0.07, 0.07, 0.07));
  return {
    g,
    move: (ph) => {
      const hop = Math.max(0, Math.sin(ph));
      body.position.y = 0.22 + hop * 0.15;
      head.position.y = 0.36 + hop * 0.15;
    },
  };
}

export function fox(k: Kit): Animal {
  const real = model("fox", 1.25);
  if (real) {
    // The scanned fox walks along +z like the drawn one; its walk cycle follows `move`.
    const mixer = new THREE.AnimationMixer(real.root);
    const clip = real.animations.find((a) => /walk/i.test(a.name)) ?? real.animations[0];
    if (clip) mixer.clipAction(clip).play();
    const d = real.dims;
    if (d.x > d.z) real.root.children[0].rotation.y += Math.PI / 2;
    return { g: real.root, move: (ph) => clip && mixer.setTime(((ph / (Math.PI * 2)) * clip.duration) % clip.duration) };
  }
  const g = new THREE.Group();
  const m = fur(k, "#c8642a");
  const white = fur(k, "#f2ece2");
  const dark = k.material({ color: "#2a1e18", roughness: 0.8 });
  part(k, m, g, v(0, 0.45, 0), v(0.22, 0.2, 0.5));
  const head = part(k, m, g, v(0, 0.62, 0.52), v(0.17, 0.15, 0.17));
  const snout = part(k, white, head, v(0, -0.25, 0.9), v(0.4, 0.35, 0.7), k.track(new THREE.ConeGeometry(1, 1.4, 8).rotateX(Math.PI / 2)));
  void snout;
  for (const s of [-1, 1]) {
    part(k, m, head, v(s * 0.55, 1.1, -0.1), v(0.35, 0.6, 0.15), k.track(new THREE.ConeGeometry(1, 1.4, 4)));
    part(k, eye(k), head, v(s * 0.45, 0.3, 0.75), v(0.14, 0.14, 0.14));
  }
  const tail = part(k, m, g, v(0, 0.5, -0.65), v(0.12, 0.12, 0.38));
  tail.rotation.x = 0.5;
  part(k, white, tail, v(0, 0, -1), v(0.8, 0.8, 0.4));
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => part(k, dark, g, v(sx * 0.12, 0.2, sz * 0.32), v(0.05, 0.4, 0.05), k.cylinder)));
  return {
    g,
    move: (ph) => legs.forEach((l, i) => (l.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0)) * 0.5)),
  };
}

export function bird(k: Kit, color = "#4a6fa5"): Animal & { beak: THREE.Mesh; body: THREE.MeshPhysicalMaterial } {
  const g = new THREE.Group();
  const m = k.material({ color, roughness: 0.6, clearcoat: 0.3, sheen: 0.6, sheenColor: new THREE.Color("#ffffff") });
  part(k, m, g, v(0, 0, 0), v(0.12, 0.11, 0.24));
  const head = part(k, m, g, v(0, 0.08, 0.2), v(0.08, 0.08, 0.08));
  const beak = part(k, k.material({ color: "#e0a12a", roughness: 0.5 }), head, v(0, -0.1, 1.2), v(0.3, 0.3, 0.8), k.track(new THREE.ConeGeometry(1, 1.2, 6).rotateX(Math.PI / 2)));
  part(k, eye(k), head, v(0.55, 0.25, 0.5), v(0.2, 0.2, 0.2));
  part(k, eye(k), head, v(-0.55, 0.25, 0.5), v(0.2, 0.2, 0.2));
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    w.position.set(s * 0.08, 0.04, 0);
    part(k, m, w, v(s * 0.22, 0, 0), v(0.24, 0.02, 0.12));
    g.add(w);
    return { w, s };
  });
  return { g, beak, body: m, move: (ph) => wings.forEach(({ w, s }) => (w.rotation.z = s * Math.sin(ph * 2) * 0.7)) };
}

export function fish(k: Kit, color = "#d98a3a"): Animal {
  const g = new THREE.Group();
  const m = k.material({ color, roughness: 0.3, clearcoat: 1, metalness: 0.2, normalMap: k.normalMap("organic", [6, 3]) });
  part(k, m, g, v(0, 0, 0), v(0.08, 0.14, 0.32));
  const tail = part(k, m, g, v(0, 0, -0.38), v(0.02, 0.16, 0.12), k.track(new THREE.ConeGeometry(1, 1, 4).rotateX(-Math.PI / 2)));
  part(k, eye(k), g, v(0.06, 0.04, 0.22), v(0.025, 0.025, 0.025));
  part(k, eye(k), g, v(-0.06, 0.04, 0.22), v(0.025, 0.025, 0.025));
  return { g, move: (ph) => (tail.rotation.y = Math.sin(ph * 3) * 0.5) };
}

/** A moth with speckled wings; `dark` 0 = pale form, 1 = dark (melanic) form. */
export function moth(k: Kit, dark: number, seed = 1): Animal {
  const g = new THREE.Group();
  const r = rng(seed);
  const tex = k.canvasTexture(64, 64, (ctx) => {
    const base = Math.round(THREE.MathUtils.lerp(225, 45, dark));
    ctx.fillStyle = `rgb(${base},${base - 4},${base - 12})`;
    ctx.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 120; i++) {
      const c = Math.round(THREE.MathUtils.lerp(70, 20, dark) + r() * 30);
      ctx.fillStyle = `rgba(${c},${c},${c},0.8)`;
      ctx.fillRect(r() * 64, r() * 64, 1 + r() * 3, 1 + r() * 2);
    }
  });
  const wingMat = k.material({ map: tex, roughness: 0.85, clearcoat: 0, side: THREE.DoubleSide });
  const bodyMat = k.material({ color: dark > 0.5 ? "#2a2724" : "#a9a395", roughness: 0.8 });
  part(k, bodyMat, g, v(0, 0, 0), v(0.03, 0.025, 0.12));
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    part(k, wingMat, w, v(s * 0.11, 0, 0.02), v(0.11, 0.005, 0.09), k.track(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2).scale(1, 1, 1)));
    g.add(w);
    return { w, s };
  });
  return { g, move: (ph) => wings.forEach(({ w, s }) => (w.rotation.z = s * Math.max(0, Math.sin(ph * 3)) * 1.0)) };
}

export function beetle(k: Kit, color: string): Animal {
  const g = new THREE.Group();
  const m = k.material({ color, roughness: 0.25, clearcoat: 1, metalness: 0.3 });
  part(k, m, g, v(0, 0.06, 0), v(0.08, 0.05, 0.12));
  part(k, k.material({ color: "#1d1a17", roughness: 0.4 }), g, v(0, 0.06, 0.12), v(0.045, 0.035, 0.04));
  const legs = [-1, 1].flatMap((s) => [-0.06, 0, 0.06].map((z) => part(k, k.material({ color: "#1d1a17" }), g, v(s * 0.09, 0.03, z), v(0.06, 0.006, 0.006), k.cylinder)));
  legs.forEach((l) => (l.rotation.z = Math.PI / 2));
  return { g, move: (ph) => legs.forEach((l, i) => (l.rotation.y = Math.sin(ph * 3 + i) * 0.4)) };
}

export function frog(k: Kit): Animal {
  const g = new THREE.Group();
  const m = k.material({ color: "#4d9a3c", roughness: 0.3, clearcoat: 1, normalMap: k.normalMap("organic", [3, 3]) });
  part(k, m, g, v(0, 0.08, 0), v(0.12, 0.08, 0.15));
  for (const s of [-1, 1]) {
    part(k, m, g, v(s * 0.06, 0.15, 0.08), v(0.04, 0.04, 0.04));
    part(k, eye(k), g, v(s * 0.07, 0.17, 0.1), v(0.02, 0.02, 0.02));
    part(k, m, g, v(s * 0.12, 0.04, -0.08), v(0.05, 0.04, 0.1));
  }
  return { g, move: (ph) => (g.children[0].position.y = 0.08 + Math.max(0, Math.sin(ph)) * 0.08) };
}

export function mushroom(k: Kit, parent: THREE.Object3D, at: V3, s = 1) {
  const g = new THREE.Group();
  part(k, k.material({ color: "#efe6d2", roughness: 0.8 }), g, v(0, 0.12, 0), v(0.05, 0.24, 0.05), k.cylinder);
  part(k, k.material({ color: "#b5462f", roughness: 0.5, clearcoat: 0.4 }), g, v(0, 0.25, 0), v(0.16, 0.09, 0.16), k.track(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)));
  g.position.copy(at);
  g.scale.setScalar(s);
  parent.add(g);
  return g;
}

/**
 * A giraffe; `neck` is the neck length factor (1 = normal). The neck is a group so it can be stretched.
 */
export function giraffe(k: Kit, neck = 1): Animal & { setNeck(n: number): void } {
  const g = new THREE.Group();
  const r = rng(Math.round(neck * 100));
  const tex = k.canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#f2d9a0";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#9a5a26";
    for (let y = 0; y < 128; y += 22)
      for (let x = 0; x < 128; x += 22) {
        ctx.beginPath();
        ctx.ellipse(x + 11 + (r() - 0.5) * 6, y + 11 + (r() - 0.5) * 6, 8, 7, r() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const m = k.material({ map: tex, roughness: 0.8, clearcoat: 0, sheen: 0.5, sheenColor: new THREE.Color("#fff3d0") });
  const dark = k.material({ color: "#5a3a20", roughness: 0.8 });
  part(k, m, g, v(0, 1.75, 0), v(0.35, 0.38, 0.75));
  const legs = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => part(k, m, g, v(sx * 0.2, 0.8, sz * 0.5), v(0.07, 1.6, 0.07), k.cylinder)));
  const neckG = new THREE.Group();
  neckG.position.set(0, 1.9, 0.55);
  neckG.rotation.x = 0.35;
  g.add(neckG);
  const neckMesh = part(k, m, neckG, v(0, 0.75, 0), v(0.12, 1.5, 0.12), k.cylinder);
  const head = new THREE.Group();
  neckG.add(head);
  part(k, m, head, v(0, 0, 0.12), v(0.12, 0.12, 0.25));
  for (const s of [-1, 1]) {
    part(k, dark, head, v(s * 0.06, 0.16, 0), v(0.02, 0.12, 0.02), k.cylinder);
    part(k, eye(k), head, v(s * 0.1, 0.04, 0.12), v(0.025, 0.025, 0.025));
  }
  const setNeck = (n: number) => {
    neckMesh.scale.y = 1.5 * n;
    neckMesh.position.y = 0.75 * n;
    head.position.y = 1.5 * n + 0.05;
  };
  setNeck(neck);
  return { g, setNeck, move: (ph) => legs.forEach((l, i) => (l.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0)) * 0.25)) };
}

/** A real scanned plant (shrub, fern, flower, dandelion, potted plant) if loaded; null otherwise. */
export function plantModel(parent: THREE.Object3D, name: "shrub" | "fern" | "flower" | "dandelion" | "potted-plant", at: V3, size: number, rotY = 0) {
  const m = model(name, size, "height");
  if (!m) return null;
  m.root.position.copy(at);
  m.root.rotation.y = rotY;
  parent.add(m.root);
  return m.root;
}

/** A crown of leaf cards (photo leaves) filling an ellipsoid; for trees drawn in a scene's own way. */
export function leafCrown(k: Kit, parent: THREE.Object3D, centre: V3, radii: V3, n: number, seed = 1, tint = "#ffffff") {
  const A = natureAssets();
  if (!A) return null;
  const r = rng(seed);
  const mat = k.track(new THREE.MeshStandardMaterial({ map: A.leaves, normalMap: A.leavesNor, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: tint }));
  const im = new THREE.InstancedMesh(k.track(new THREE.PlaneGeometry(1.7, 1.7)), mat, n);
  im.customDepthMaterial = k.track(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: A.leaves, alphaTest: 0.45 }));
  im.castShadow = true;
  im.userData.noShadowFit = true;
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const d = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(Math.cbrt(r()));
    m4.compose(centre.clone().add(d.multiply(radii)), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * Math.PI, r() * 6.3, r() * Math.PI)), v(1, 1, 1).multiplyScalar(0.7 + r() * 0.6));
    im.setMatrixAt(i, m4);
    im.setColorAt(i, new THREE.Color().setHSL(0.24 + r() * 0.06, 0.35 + r() * 0.2, 0.42 + r() * 0.16));
  }
  parent.add(im);
  return im;
}

/** A small leaf (photo leaf card) for seedlings; null if the textures are not loaded. */
export function leafMaterial(k: Kit, tint = "#ffffff") {
  const A = natureAssets();
  if (!A) return null;
  return k.track(new THREE.MeshStandardMaterial({ map: A.leaves, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, color: tint }));
}
