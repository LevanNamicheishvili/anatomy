import * as THREE from "three";
import { beads, context, curve, layer, orbit } from "@/components/journeys/common";
import { ease, rng, v, type Builder, type Kit, type Shot, type V3 } from "@/components/journeys/JourneyScene";
import { dnaLadder } from "./micro";
import { bird, fish, fox, natureMaterials, outdoor, rabbit, tree } from "./nature";

/*
 * Cell chemistry and tissues: water and hydrogen bonds, mineral ions in the body, pH and buffers, protein
 * structure and functions, carbohydrates, ATP; animal and plant tissues, a stem and root tip, levels of
 * organisation, symmetry, and what alcohol and tobacco do to a cell. Molecules in CPK colours.
 */

const setText = (el: HTMLDivElement, text: string) => {
  const t = el.querySelector(".blood-label-text") ?? el;
  if (t.textContent !== text) t.textContent = text;
};
const lab = (k: Kit, c = "#11161a") => k.mood(c, 25, 60);
const front = (s: number, d: number, at = v(0, 0, 0), h = 0.18, side = 0): Shot => orbit(at, d, 0, { start: side + Math.sin(s * 0.15) * 0.2, height: h });
const tag = (k: Kit, parent: THREE.Object3D, p: V3, text: string, stages?: number[]) => k.label(k.anchor(parent, p), text, { kind: "tag", stages });

const CPK: Record<string, string> = { O: "#e0242a", H: "#f4f4f4", C: "#3a3a3a", N: "#3b62d8", P: "#f08a2a", Na: "#a46be0", Cl: "#3fae5a" };

function atom(k: Kit, el: string, r = 0.3) {
  const m = new THREE.Mesh(k.sphere, k.material({ color: CPK[el] ?? "#cccccc", roughness: 0.3, clearcoat: 0.8 }));
  m.scale.setScalar(r);
  return m;
}

function bond(k: Kit, parent: THREE.Object3D, a: V3, b: V3, r = 0.07, color = "#d0d4d8") {
  const m = new THREE.Mesh(k.cylinder, k.material({ color, roughness: 0.4 }));
  const d = b.clone().sub(a);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(v(0, 1, 0), d.clone().normalize());
  m.scale.set(r, d.length(), r);
  parent.add(m);
  return m;
}

/** A water molecule, O at the origin, H's at 104.5°. */
function water(k: Kit, s = 1) {
  const g = new THREE.Group();
  g.add(atom(k, "O", 0.42 * s));
  const a = THREE.MathUtils.degToRad(104.5 / 2);
  for (const sx of [-1, 1]) {
    const h = atom(k, "H", 0.26 * s);
    h.position.set(sx * Math.sin(a) * 0.62 * s, -Math.cos(a) * 0.62 * s, 0);
    g.add(h);
  }
  return g;
}

// ---- Water ------------------------------------------------------------------------------------------

export const waterVisual: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const big = water(k, 3);
  g.add(big);
  tag(k, g, v(0, 1.8, 0), "δ−", [0]);
  tag(k, g, v(-1.9, -1.9, 0), "δ+", [0]);
  tag(k, g, v(1.9, -1.9, 0), "δ+", [0]);
  tag(k, g, v(0, -0.6, 0.5), "104,5°", [0]);
  // A network with hydrogen bonds.
  const net = new THREE.Group();
  g.add(net);
  const r = rng(3);
  const mols: { m: THREE.Group; p: V3 }[] = [];
  for (let i = 0; i < 26; i++) {
    const m = water(k, 1);
    const p = v((r() - 0.5) * 8, (r() - 0.5) * 5, (r() - 0.5) * 4);
    m.position.copy(p);
    m.rotation.set(r() * 6, r() * 6, r() * 6);
    net.add(m);
    mols.push({ m, p });
  }
  const dash = k.material({ color: "#6fb0e0", emissive: "#6fb0e0", emissiveIntensity: 0.6, transparent: true, opacity: 0.8 });
  mols.forEach((a, i) => {
    const near = mols.map((b, j) => ({ j, d: b.p.distanceTo(a.p) })).filter((x) => x.j > i && x.d < 2.2).slice(0, 2);
    for (const n of near) {
      const b = mols[n.j].p;
      for (let q = 0; q < 4; q++) {
        const seg = new THREE.Mesh(k.sphere, dash);
        seg.position.lerpVectors(a.p, b, 0.25 + q * 0.17);
        seg.scale.setScalar(0.06);
        net.add(seg);
      }
    }
  });
  tag(k, net, v(0, 3.2, 0), "წყალბადური ბმები", [1]);
  // Salt dissolving.
  const salt = new THREE.Group();
  g.add(salt);
  const ions: { m: THREE.Mesh; home: V3; out: V3; na: boolean }[] = [];
  for (let x = 0; x < 3; x++)
    for (let y = 0; y < 3; y++)
      for (let z = 0; z < 3; z++) {
        const na = (x + y + z) % 2 === 0;
        const m = atom(k, na ? "Na" : "Cl", na ? 0.3 : 0.42);
        const home = v((x - 1) * 0.8, (y - 1) * 0.8, (z - 1) * 0.8);
        m.position.copy(home);
        salt.add(m);
        ions.push({ m, home, out: home.clone().normalize().multiplyScalar(3 + r() * 2).add(v(r() - 0.5, r() - 0.5, r() - 0.5)), na });
      }
  const shells = ions.map((ion) => {
    const sh = new THREE.Group();
    for (let j = 0; j < 4; j++) {
      const w = water(k, 0.45);
      const a = (j / 4) * Math.PI * 2;
      w.position.set(Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0);
      // Oxygen faces Na⁺, hydrogens face Cl⁻.
      w.rotation.z = a + (ion.na ? Math.PI / 2 : -Math.PI / 2);
      sh.add(w);
    }
    salt.add(sh);
    return sh;
  });
  tag(k, salt, v(-3, 2.6, 0), "Na⁺ — წყალი ჟანგბადით", [2]);
  tag(k, salt, v(3, 2.6, 0), "Cl⁻ — წყალი წყალბადებით", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        big.visible = i === 0;
        net.visible = i === 1;
        salt.visible = i === 2;
        big.rotation.y = Math.sin(t * 0.4) * 0.5;
        mols.forEach((x, j) => x.m.position.copy(x.p).add(v(Math.sin(t + j) * 0.05, Math.cos(t * 1.3 + j) * 0.05, 0)));
        const d = i === 2 ? ease((u - 0.15) / 0.6) : 0;
        ions.forEach((ion, j) => {
          ion.m.position.lerpVectors(ion.home, ion.out, d);
          shells[j].position.copy(ion.m.position);
          shells[j].visible = d > 0.4;
          shells[j].rotation.z = t * 0.5 + j;
        });
        return front(s, i === 0 ? 9 : 12, v(0, 0, 0), 0.15);
      },
    })),
  };
};

// ---- Minerals ------------------------------------------------------------------------------------------

export const minerals: Builder = async (k) => {
  const body = await k.body({ organs: true, brain: false });
  k.mood("#0e1416", 3, 8);
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.07, 0.0);
  const bones = layer(k, body, g, (p) => ["skeleton", "femur", "humerus", "radius", "ulna"].includes(p.group), k.material({ color: "#eadfc6", roughness: 0.55, emissive: "#ffffff", emissiveIntensity: 0 }), 2);
  const bm = bones.material as THREE.MeshPhysicalMaterial;
  const heart = layer(k, body, g, (p) => p.group === "heart" && /^Wall/.test(p.name), k.material({ color: "#b3363d", roughness: 0.4, emissive: "#ff3b2f", emissiveIntensity: 0 }), 1);
  const hm = heart.material as THREE.MeshPhysicalMaterial;
  const r = rng(5);
  const ionBeads = (color: string, to: () => V3, n: number, seed: number) => {
    const m = new THREE.InstancedMesh(k.sphere, k.material({ color, emissive: color, emissiveIntensity: 0.8 }), n);
    m.frustumCulled = false;
    g.add(m);
    const items = Array.from({ length: n }, () => ({ from: v((r() - 0.5) * 0.8, 0.6 + r() * 1.2, 0.5 + r() * 0.3), to: to(), ph: r() }));
    const m4 = new THREE.Matrix4();
    return {
      mesh: m,
      update: (t: number, on: boolean) => {
        m.visible = on;
        items.forEach((it, j) => {
          const f = Math.min(1, ((t * 0.25 + it.ph) % 1.3));
          const p = it.from.clone().lerp(it.to, ease(f));
          m4.compose(p, new THREE.Quaternion(), v(1, 1, 1).multiplyScalar(0.006));
          m.setMatrixAt(j, m4);
        });
        m.instanceMatrix.needsUpdate = true;
        void seed;
      },
    };
  };
  const spine = body.data.spine.map(([x, y, z]) => v(x, y, z));
  const ca = ionBeads("#f4f4f4", () => (r() < 0.5 ? spine[Math.floor(r() * 20)].clone() : v((r() - 0.5) * 0.2, 0.3 + r() * 0.6, 0)), 70, 1);
  const na = ionBeads("#a46be0", () => spine[Math.floor(r() * 20)].clone().add(v((r() - 0.5) * 0.02, 0, 0)), 50, 2);
  const fe = ionBeads("#c0392b", () => v(0.017, 1.31, 0.02).add(v((r() - 0.5) * 0.06, (r() - 0.5) * 0.06, (r() - 0.5) * 0.05)), 50, 3);
  const st = k.label(k.anchor(g, v(0.25, 1.6, 0.05)), "", { kind: "tag" });
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (_u: number, s: number, t: number) => {
        bones.visible = i === 0 || i === 1;
        bm.emissiveIntensity = i === 0 ? 0.25 + 0.15 * Math.sin(t * 3) : 0;
        hm.emissiveIntensity = i === 2 ? 0.3 + 0.2 * Math.sin(t * 3) : 0;
        ca.update(t, i === 0);
        na.update(t, i === 1);
        fe.update(t, i === 2);
        setText(st, ["Ca²⁺, PO₄³⁻ → ძვლები, კბილები", "Na⁺, K⁺ → ნერვები, კუნთები", "Fe²⁺ → ჰემოგლობინი; I → ფარისებრი ჯირკვალი"][i]);
        return orbit(v(0, i === 2 ? 1.3 : 1.0, 0), i === 2 ? 0.7 : 2.2, s, { start: 0.3, speed: 0.03, height: 0.05 });
      },
    })),
  };
};

// ---- Buffer --------------------------------------------------------------------------------------------

export const buffer: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  // pH strip 0–14.
  const strip = new THREE.Group();
  const cols = ["#d42a2a", "#e0502a", "#e8782a", "#f0a02a", "#f2c230", "#d8d23a", "#a8c83a", "#5eb04a", "#3fa080", "#3a88a8", "#3a68c0", "#4a50c0", "#5a3ab0", "#6a2aa0", "#7a1a90"];
  cols.forEach((c, i) => {
    const b = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.6, 0.6, 0.3)), k.material({ color: c, roughness: 0.5 }));
    b.position.set(-4.2 + i * 0.6, 3.4, 0);
    strip.add(b);
    if (i % 7 === 0) tag(k, strip, v(-4.2 + i * 0.6, 2.8, 0.2), String(i));
  });
  const pointer = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.2, 0.5, 12)), k.material({ color: "#ffffff" }));
  pointer.rotation.x = Math.PI;
  strip.add(pointer);
  g.add(strip);
  const ph = tag(k, strip, v(0, 4.4, 0), "");
  // Two beakers: water and buffer.
  const beaker = (x: number, color: string) => {
    const b = new THREE.Group();
    const glass = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.4, 1.4, 3, 32, 1, true)), k.ghost("#dfeff5", 0.2, { side: THREE.DoubleSide, roughness: 0.05, clearcoat: 1 }));
    const liquid = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.35, 1.35, 2.4, 32)), k.ghost(color, 0.45));
    liquid.position.y = -0.3;
    b.add(glass, liquid);
    b.position.set(x, 0, 0);
    g.add(b);
    return { b, liquid };
  };
  const W = beaker(-2.2, "#9fd0f0");
  const B = beaker(2.2, "#a8e0c0");
  tag(k, g, v(-2.2, -2.1, 1.4), "წყალი", [1, 2]);
  tag(k, g, v(2.2, -2.1, 1.4), "ბუფერი", [2]);
  const r = rng(4);
  const hPlus = (x: number, n: number) =>
    Array.from({ length: n }, () => {
      const m = new THREE.Mesh(k.sphere, k.material({ color: "#e0242a", emissive: "#e0242a", emissiveIntensity: 0.6 }));
      m.scale.setScalar(0.1);
      g.add(m);
      return { m, x: x + (r() - 0.5) * 2, y: -1.2 + r() * 2, z: (r() - 0.5) * 2, d: r() };
    });
  const hW = hPlus(-2.2, 30);
  const hB = hPlus(2.2, 30);
  const traps = Array.from({ length: 30 }, (_, i) => {
    const m = new THREE.Mesh(k.sphere, k.material({ color: "#3a88a8", roughness: 0.4 }));
    m.scale.setScalar(0.17);
    m.position.copy(v(2.2 + (r() - 0.5) * 2, -1.2 + r() * 2, (r() - 0.5) * 2));
    g.add(m);
    return { m, home: m.position.clone(), i };
  });
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        W.b.visible = i >= 1;
        B.b.visible = i === 2;
        traps.forEach((x) => (x.m.visible = i === 2));
        const add = i >= 1 ? ease((u - 0.15) / 0.5) : 0;
        hW.forEach((h) => {
          h.m.visible = i >= 1 && h.d < add;
          h.m.position.set(h.x + Math.sin(t + h.d * 9) * 0.1, h.m.visible ? h.y : 3, h.z);
        });
        hB.forEach((h, j) => {
          const caught = traps[j];
          h.m.visible = i === 2 && h.d < add;
          if (h.m.visible) h.m.position.copy(caught.home).add(v(0.2, 0.1, 0));
        });
        const value = i === 0 ? 7.4 : i === 1 ? 7 - 4 * add : 7.4 - 0.15 * add;
        const showVal = i === 2 && u > 0.5 ? 7.4 - 0.15 * add : value;
        pointer.position.set(-4.2 + showVal * 0.6, 4.0, 0);
        setText(ph, i === 2 ? `წყალი: pH ${(7 - 4 * add).toFixed(1)} · ბუფერი: pH ${showVal.toFixed(1)}` : `pH ${value.toFixed(1)}`);
        (W.liquid.material as THREE.MeshPhysicalMaterial).color.set(i >= 1 ? cols[Math.round(7 - 4 * add)] : "#9fd0f0");
        if (i === 2) pointer.position.x = -4.2 + (7 - 4 * add) * 0.6;
        return front(s, 12, v(0, 1, 0), 0.12);
      },
    })),
  };
};

// ---- Protein structure -------------------------------------------------------------------------------------

const AA = ["#e8564a", "#3b82c4", "#4bb36b", "#f2c230", "#a46be0", "#f08a2a", "#5ad0d0"];

function chain(k: Kit, n: number, seed = 1) {
  const r = rng(seed);
  const mats = AA.map((c) => k.material({ color: c, roughness: 0.35, clearcoat: 0.6 }));
  return Array.from({ length: n }, () => {
    const m = new THREE.Mesh(k.sphere, mats[Math.floor(r() * mats.length)]);
    m.scale.setScalar(0.22);
    return m;
  });
}

export const proteinStructure: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const N = 40;
  const beadsA = chain(k, N, 2);
  beadsA.forEach((b) => g.add(b));
  const line = beadsA.map((_, i) => v(-6 + i * 0.32, 0, 0));
  const helix = beadsA.map((_, i) => v(-3 + i * 0.15, Math.cos(i * 1.75) * 0.6, Math.sin(i * 1.75) * 0.6));
  const fold = (() => {
    const r = rng(9);
    let p = v(0, 0, 0);
    const pts = [p.clone()];
    for (let i = 1; i < N; i++) {
      p = p.clone().add(v(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(0.42));
      if (p.length() > 1.6) p.multiplyScalar(1.6 / p.length());
      pts.push(p);
    }
    return pts;
  })();
  // Quaternary: four folded subunits.
  const quat = new THREE.Group();
  g.add(quat);
  const subCols = ["#d64a3a", "#e07a4a", "#c0392b", "#e0a04a"];
  subCols.forEach((c, i) => {
    const blob = new THREE.Mesh(k.track(new THREE.IcosahedronGeometry(1, 3)), k.material({ color: c, roughness: 0.45, clearcoat: 0.5, normalMap: k.normalMap("organic", [2, 2]) }));
    blob.position.set(i % 2 ? 0.9 : -0.9, i < 2 ? 0.9 : -0.9, (i % 3) * 0.3 - 0.3);
    quat.add(blob);
    const heme = new THREE.Mesh(k.sphere, k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0.6 }));
    heme.position.copy(blob.position).multiplyScalar(1.5);
    heme.scale.setScalar(0.18);
    quat.add(heme);
  });
  tag(k, quat, v(0, 2.4, 0), "ჰემოგლობინი: 4 ჯაჭვი + ჰემი (რკინა)", [2]);
  const st = tag(k, g, v(0, 2.6, 0), "", [0, 1]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        quat.visible = i === 2 && u > 0.35;
        beadsA.forEach((b, j) => {
          b.visible = !(i === 2 && u > 0.35);
          let p: V3;
          if (i === 0) p = line[j].clone().setX(line[j].x * ease(u * 1.5 + 0.2));
          else if (i === 1) p = u < 0.5 ? line[j].clone().lerp(helix[j], ease(u / 0.5)) : helix[j].clone().lerp(fold[j], ease((u - 0.5) / 0.4));
          else p = fold[j].clone().multiplyScalar(1 - 0.5 * ease(u / 0.35));
          b.position.copy(p);
        });
        quat.rotation.y = t * 0.3;
        setText(st, i === 0 ? "ამინომჟავების ჯაჭვი — პირველადი" : u < 0.5 ? "α-სპირალი — მეორეული" : "გორგალი — მესამეული");
        return front(s, i === 0 ? 14 : 9, v(0, 0, 0), 0.2);
      },
    })),
  };
};

// ---- Protein functions ------------------------------------------------------------------------------------

export const proteinFunctions: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  // Enzyme with an active site; substrate split in two.
  const enz = new THREE.Group();
  g.add(enz);
  const body = new THREE.Mesh(k.track(new THREE.SphereGeometry(1.4, 48, 32, 0.5, Math.PI * 2 - 1)), k.material({ color: "#3fae8f", roughness: 0.4, clearcoat: 0.6, side: THREE.DoubleSide, normalMap: k.normalMap("organic", [2, 2]) }));
  enz.add(body);
  const sub = [0, 1].map((j) => {
    const m = new THREE.Mesh(k.sphere, k.material({ color: j ? "#f2c230" : "#e0a12a", roughness: 0.4 }));
    m.scale.set(0.45, 0.45, 0.45);
    enz.add(m);
    return m;
  });
  tag(k, enz, v(-1.8, 1.6, 0), "ფერმენტი", [0]);
  tag(k, enz, v(2.4, 1.2, 0), "სუბსტრატი", [0]);
  // Hemoglobin with O₂ and an antibody grabbing a microbe.
  const trans = new THREE.Group();
  g.add(trans);
  const hb = new THREE.Mesh(k.track(new THREE.IcosahedronGeometry(1.2, 3)), k.material({ color: "#c0392b", roughness: 0.45, clearcoat: 0.5, normalMap: k.normalMap("organic", [2, 2]) }));
  hb.position.x = -2.5;
  trans.add(hb);
  const o2 = [0, 1, 2, 3].map((j) => {
    const pair = new THREE.Group();
    pair.add(atom(k, "O", 0.18));
    const o = atom(k, "O", 0.18);
    o.position.x = 0.3;
    pair.add(o);
    trans.add(pair);
    return { pair, j };
  });
  const ab = new THREE.Group();
  const abMat = k.material({ color: "#5b8def", roughness: 0.4 });
  const stem = new THREE.Mesh(k.cylinder, abMat);
  stem.scale.set(0.15, 1.2, 0.15);
  const armL = new THREE.Mesh(k.cylinder, abMat);
  armL.scale.set(0.13, 0.9, 0.13);
  armL.position.set(-0.35, 0.95, 0);
  armL.rotation.z = 0.6;
  const armR = armL.clone();
  armR.position.x = 0.35;
  armR.rotation.z = -0.6;
  ab.add(stem, armL, armR);
  ab.position.set(2.5, -0.6, 0);
  const microbe = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.35, 0.8, 6, 12)), k.material({ color: "#7cc66a", roughness: 0.4 }));
  microbe.rotation.z = Math.PI / 2;
  trans.add(ab, microbe);
  tag(k, trans, v(-2.5, 1.8, 0), "ჰემოგლობინი + O₂", [1]);
  tag(k, trans, v(2.5, -2, 0), "ანტისხეული", [1]);
  // Collagen triple helix and actin/myosin.
  const str = new THREE.Group();
  g.add(str);
  ["#e8d8b0", "#d8c090", "#f0e4c8"].forEach((c, j) => {
    const pts: V3[] = [];
    for (let i = 0; i <= 60; i++) pts.push(v(-4 + i * 0.13, Math.cos(i * 0.35 + (j * Math.PI * 2) / 3) * 0.25 + 1.5, Math.sin(i * 0.35 + (j * Math.PI * 2) / 3) * 0.25));
    k.tube(pts, 0.1, k.material({ color: c, roughness: 0.4 }), str, 120, 8);
  });
  const actin = [-0.6, 0.6].map((y) => {
    const a = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.08, 0.08, 4, 8).rotateZ(Math.PI / 2)), k.material({ color: "#e0524a" }));
    a.position.y = y - 1.5;
    str.add(a);
    return a;
  });
  const myosin = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.15, 0.15, 3, 8).rotateZ(Math.PI / 2)), k.material({ color: "#5b8def" }));
  myosin.position.y = -1.5;
  str.add(myosin);
  tag(k, str, v(0, 2.1, 0), "კოლაგენი — სამმაგი სპირალი", [2]);
  tag(k, str, v(0, -2.6, 0), "აქტინი და მიოზინი — შეკუმშვა", [2]);
  const groups = [enz, trans, str];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => groups.forEach((x, j) => (x.visible = i === j)),
      update: (_u: number, s: number, t: number) => {
        const f = (s % 5) / 5;
        const into = ease(f / 0.35);
        const split = ease((f - 0.5) / 0.3);
        sub[0].position.set(3 - 2.6 * into - split * 1.5, 0.2 * (1 - into) + split * 1.2, 0);
        sub[1].position.set(3.6 - 2.6 * into + split * 1.5, 0.2 * (1 - into) - split * 1.2, 0);
        body.rotation.y = Math.sin(t) * 0.1;
        o2.forEach(({ pair, j }) => {
          const a = (j / 4) * Math.PI * 2 + t * 0.5;
          const bound = Math.sin(t * 0.8 + j) > 0;
          pair.position.set(-2.5 + Math.cos(a) * (bound ? 1.3 : 2.4), Math.sin(a) * (bound ? 1.3 : 2.4), 0.3);
        });
        const grab = ease(((s % 6) / 6) / 0.5);
        microbe.position.set(2.5, 2.8 - 1.2 * grab, 0);
        actin.forEach((a, j) => (a.position.x = (j ? -1 : 1) * 0.8 * (0.5 + 0.5 * Math.sin(t * 2))));
        return front(s, 10, v(0, 0, 0), 0.12);
      },
    })),
  };
};

// ---- Carbohydrates -----------------------------------------------------------------------------------------

function sugar(k: Kit, color: string, five = false) {
  const m = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.4, 0.4, 0.14, five ? 5 : 6)), k.material({ color, roughness: 0.35, clearcoat: 0.6 }));
  m.rotation.x = Math.PI / 2;
  return m;
}

export const carbohydrates: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const mono = new THREE.Group();
  g.add(mono);
  const glu = sugar(k, "#f4f1ea");
  glu.position.x = -2.5;
  glu.scale.setScalar(2.5);
  const fru = sugar(k, "#f2c230", true);
  fru.position.x = 0;
  fru.scale.setScalar(2.5);
  const rib = sugar(k, "#a46be0", true);
  rib.position.x = 2.5;
  rib.scale.setScalar(2.5);
  mono.add(glu, fru, rib);
  tag(k, mono, v(-2.5, 1.5, 0), "გლუკოზა", [0]);
  tag(k, mono, v(0, 1.5, 0), "ფრუქტოზა", [0]);
  tag(k, mono, v(2.5, 1.5, 0), "რიბოზა", [0]);
  const di = new THREE.Group();
  g.add(di);
  const pairs = [
    ["#f4f1ea", "#f2c230", "საქაროზა — შაქარი", true],
    ["#f4f1ea", "#e8a0c0", "ლაქტოზა — რძის შაქარი", false],
  ] as const;
  const diParts = pairs.map(([a, b, name, five], i) => {
    const s1 = sugar(k, a);
    const s2 = sugar(k, b, five);
    s1.scale.setScalar(2);
    s2.scale.setScalar(2);
    di.add(s1, s2);
    tag(k, di, v(0, 1.6 - i * 3, 0), name, [1]);
    return { s1, s2, y: 0.4 - i * 3 };
  });
  const poly = new THREE.Group();
  g.add(poly);
  const ring = (p: V3, color = "#f4f1ea") => {
    const m = sugar(k, color);
    m.position.copy(p);
    m.scale.setScalar(0.7);
    poly.add(m);
  };
  for (let i = 0; i < 40; i++) ring(v(-4.5 + i * 0.12, 2 + Math.cos(i * 0.6) * 0.45, Math.sin(i * 0.6) * 0.45));
  const branch = (from: V3, dir: V3, n: number, depth: number) => {
    let p = from.clone();
    for (let i = 0; i < n; i++) {
      p = p.clone().addScaledVector(dir, 0.3);
      ring(p, "#f0d8c0");
      if (depth > 0 && i === Math.floor(n / 2)) branch(p, dir.clone().applyAxisAngle(v(0, 0, 1), 0.8), n - 2, depth - 1);
    }
  };
  branch(v(-1, -0.4, 0), v(1, 0, 0), 9, 2);
  branch(v(-1, -0.4, 0), v(-1, 0.3, 0).normalize(), 6, 1);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 14; i++) ring(v(-2 + i * 0.32, -2.6 - row * 0.5, 0), "#d8e8c0");
  tag(k, poly, v(-2, 3, 0), "სახამებელი — სპირალი", [2]);
  tag(k, poly, v(1.5, 0.8, 0), "გლიკოგენი — დატოტვილი", [2]);
  tag(k, poly, v(0, -4.2, 0), "ცელულოზა — სწორი ძაფები", [2]);
  const groups = [mono, di, poly];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      enter: () => groups.forEach((x, j) => (x.visible = i === j)),
      update: (u: number, s: number, t: number) => {
        [glu, fru, rib].forEach((m, j) => (m.rotation.y = t * 0.5 + j));
        diParts.forEach((d) => {
          const join = ease((u - 0.2) / 0.4);
          d.s1.position.set(-2.5 + join * 1.9, d.y, 0);
          d.s2.position.set(2.5 - join * 1.9, d.y, 0);
        });
        return front(s, i === 2 ? 12 : 9, v(0, i === 1 ? -1.2 : 0, 0), 0.12);
      },
    })),
  };
};

// ---- ATP ------------------------------------------------------------------------------------------------------

export const atpVisual: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const adenine = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.7, 0.7, 0.25, 6)), k.material({ color: "#3b82c4", roughness: 0.35, clearcoat: 0.6 }));
  adenine.rotation.x = Math.PI / 2;
  adenine.position.set(-3.2, 0.6, 0);
  const ribose = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.6, 0.6, 0.25, 5)), k.material({ color: "#a46be0", roughness: 0.35, clearcoat: 0.6 }));
  ribose.rotation.x = Math.PI / 2;
  ribose.position.set(-1.8, 0, 0);
  g.add(adenine, ribose);
  bond(k, g, adenine.position, ribose.position, 0.08);
  const pMat = k.material({ color: "#f08a2a", roughness: 0.35, clearcoat: 0.6, emissive: "#f08a2a", emissiveIntensity: 0.15 });
  const phos = [0, 1, 2].map((i) => {
    const p = new THREE.Mesh(k.sphere, pMat);
    p.scale.setScalar(0.45);
    p.position.set(-0.6 + i * 1.1, 0, 0);
    g.add(p);
    return p;
  });
  const bonds = [bond(k, g, ribose.position, phos[0].position), bond(k, g, phos[0].position, phos[1].position, 0.08, "#ffd23f"), bond(k, g, phos[1].position, phos[2].position, 0.08, "#ffd23f")];
  const flash = new THREE.Mesh(k.sphere, k.material({ color: "#fff2b0", emissive: "#ffd23f", emissiveIntensity: 2, transparent: true }));
  g.add(flash);
  const mito = new THREE.Mesh(k.sphere, k.material({ color: "#e48c3f", roughness: 0.4, clearcoat: 0.5, normalMap: k.normalMap("organic", [2, 1]) }));
  mito.scale.set(2.2, 1, 1);
  mito.position.set(1.5, -3, -1);
  g.add(mito);
  tag(k, g, v(-3.2, 1.6, 0), "ადენინი", [0]);
  tag(k, g, v(-1.8, -1, 0), "რიბოზა", [0]);
  tag(k, g, v(0.5, 1, 0), "3 ფოსფატი", [0]);
  tag(k, g, v(1.5, -1.6, -1), "მიტოქონდრია", [2]);
  const st = tag(k, g, v(0, 2.6, 0), "", [1, 2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        mito.visible = i === 2;
        let off = 0;
        if (i === 1) off = ease((u - 0.3) / 0.25) * 2.5;
        if (i === 2) off = 2.5 * (1 - ease((u - 0.3) / 0.4));
        phos[2].position.set(1.6 + off, off * 0.4, 0);
        bonds[2].visible = off < 0.2;
        const burst = i === 1 ? Math.max(0, 1 - Math.abs(u - 0.4) * 6) : 0;
        flash.visible = burst > 0;
        flash.position.set(1.3, 0, 0);
        flash.scale.setScalar(0.3 + burst * 1.5);
        (flash.material as THREE.MeshPhysicalMaterial).opacity = burst;
        mito.rotation.y = t * 0.3;
        setText(st, i === 1 ? (u < 0.4 ? "ატფ" : "ადფ + ფოსფატი + ენერგია") : u < 0.7 ? "მიტოქონდრიაში ფოსფატი ბრუნდება" : "ისევ ატფ");
        return front(s, 10, v(-0.5, i === 2 ? -0.8 : 0.3, 0), 0.12);
      },
    })),
  };
};

// ---- Animal tissues --------------------------------------------------------------------------------------------

export const animalTissues: Builder = async (k) => {
  lab(k, "#15100f");
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(3);
  const organic = k.normalMap("organic", [1, 1]);
  // Epithelium: a sheet of packed cells on top; connective tissue below: few cells, fibres.
  const epi = new THREE.Group();
  g.add(epi);
  const cellGeo = k.track(new THREE.CylinderGeometry(0.42, 0.42, 0.8, 6));
  const em = new THREE.InstancedMesh(cellGeo, k.material({ color: "#e8a8a0", roughness: 0.45, normalMap: organic, clearcoat: 0.3 }), 120);
  let n = 0;
  const m4 = new THREE.Matrix4();
  for (let x = 0; x < 12; x++)
    for (let z = 0; z < 10; z++) {
      m4.compose(v((x - 5.5) * 0.74 + (z % 2) * 0.37, 1.2, (z - 4.5) * 0.64), new THREE.Quaternion(), v(1, 1, 1));
      em.setMatrixAt(n++, m4);
    }
  epi.add(em);
  const matrix = new THREE.Mesh(k.track(new THREE.BoxGeometry(9, 2, 6.6)), k.ghost("#f0e0c8", 0.35));
  matrix.position.y = -0.3;
  epi.add(matrix);
  for (let i = 0; i < 30; i++) {
    const p1 = v((r() - 0.5) * 8, -0.3 + (r() - 0.5) * 1.6, (r() - 0.5) * 6);
    const p2 = p1.clone().add(v((r() - 0.5) * 3, (r() - 0.5) * 0.6, (r() - 0.5) * 3));
    k.tube([p1, p2], 0.03, k.material({ color: i % 3 ? "#f4f0e0" : "#e0c070" }), epi, 4, 4);
  }
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Mesh(k.sphere, k.material({ color: "#c98aa0", normalMap: organic }));
    c.scale.set(0.35, 0.2, 0.25);
    c.position.set((r() - 0.5) * 8, -0.3 + (r() - 0.5) * 1.4, (r() - 0.5) * 6);
    epi.add(c);
  }
  tag(k, epi, v(-3.5, 2, 2.8), "ეპითელიუმი", [0]);
  tag(k, epi, v(-3.5, -0.6, 3.4), "შემაერთებელი: ბოჭკოები, უჯრედშორისი ნივთიერება", [0]);
  // Muscle: three kinds.
  const mus = new THREE.Group();
  g.add(mus);
  const striped = k.stripes(["#c46a6a", "#8e3530"], [2, 1], [1, 16]);
  const skel = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.5, 0.5, 6, 24)), k.material({ color: "#ffffff", map: striped, roughness: 0.5 }));
  skel.rotation.z = Math.PI / 2;
  skel.position.y = 1.8;
  const smoothMat = k.material({ color: "#d88a80", roughness: 0.5, normalMap: organic });
  for (let i = 0; i < 6; i++) {
    const sm = new THREE.Mesh(k.sphere, smoothMat);
    sm.scale.set(1.3, 0.22, 0.22);
    sm.position.set(-2.5 + i * 1, -1.6 + (i % 2) * 0.35, 0);
    mus.add(sm);
  }
  const cardiac = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.35, 1.2, 4, 12)), k.material({ color: "#ffffff", map: striped, roughness: 0.5 }));
    c.rotation.z = Math.PI / 2 + (i % 2 ? 0.3 : -0.2);
    c.position.set(-2.4 + i * 1.6, 0, 0);
    cardiac.add(c);
  }
  mus.add(skel, cardiac);
  tag(k, mus, v(3.4, 1.8, 0), "ჩონჩხის — განივზოლიანი", [1]);
  tag(k, mus, v(3.4, 0, 0), "გულის — დატოტვილი", [1]);
  tag(k, mus, v(3.4, -1.6, 0), "გლუვი — ღეროსებრი", [1]);
  // Nervous tissue.
  const ner = new THREE.Group();
  g.add(ner);
  const nm = k.material({ color: "#b49ad6", roughness: 0.4, emissive: "#7d5ba6", emissiveIntensity: 0.2 });
  const somas = Array.from({ length: 10 }, () => v((r() - 0.5) * 8, (r() - 0.5) * 4, (r() - 0.5) * 3));
  somas.forEach((p, i) => {
    const s = new THREE.Mesh(k.sphere, nm);
    s.position.copy(p);
    s.scale.setScalar(0.35);
    ner.add(s);
    const q = somas[(i + 3) % somas.length];
    k.tube([p, p.clone().lerp(q, 0.5).add(v(0, 0.8, 0)), q], 0.05, nm, ner, 20, 5);
  });
  for (let i = 0; i < 25; i++) {
    const gl = new THREE.Mesh(k.sphere, k.material({ color: "#e8d8a0", roughness: 0.6 }));
    gl.position.set((r() - 0.5) * 8, (r() - 0.5) * 4, (r() - 0.5) * 3);
    gl.scale.setScalar(0.15);
    ner.add(gl);
  }
  const pulses = somas.map((p, i) => beads(k, ner, curve([p, p.clone().lerp(somas[(i + 3) % somas.length], 0.5).add(v(0, 0.8, 0)), somas[(i + 3) % somas.length]]), { n: 1, color: "#ffd23f", size: 0.15, speed: 0.4, emissive: 1.5, seed: i }));
  tag(k, ner, somas[0].clone().add(v(0, 0.6, 0)), "ნეირონი", [2]);
  tag(k, ner, v(3, -2.4, 0), "დამხმარე უჯრედები", [2]);
  const groups = [epi, mus, ner];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => groups.forEach((x, j) => (x.visible = i === j)),
      update: (_u: number, s: number, t: number) => {
        const c = 1 - 0.06 * Math.max(0, Math.sin(t * 3)) ** 3;
        skel.scale.set(1 + (1 - c), c, 1 + (1 - c));
        cardiac.scale.set(c, 1, 1);
        pulses.forEach((p) => p.update(t));
        return orbit(v(0, 0.3, 0), i === 0 ? 11 : 10, s, { start: 0.4, speed: 0.04, height: i === 0 ? 0.45 : 0.2 });
      },
    })),
  };
};

// ---- Plant tissues: a leaf in section ----------------------------------------------------------------------

function leafSection(k: Kit) {
  const g = new THREE.Group();
  const r = rng(6);
  const organic = k.normalMap("organic", [1, 1]);
  const epiMat = k.material({ color: "#cfe8a8", roughness: 0.3, clearcoat: 0.9, normalMap: organic });
  const pal = k.material({ color: "#5ea83a", roughness: 0.45, normalMap: organic });
  const spongy = k.material({ color: "#8ac860", roughness: 0.5, normalMap: organic });
  const chloro = k.material({ color: "#2f7f2a", roughness: 0.4 });
  const W = 10;
  for (const y of [2.2, -1.6]) {
    for (let x = 0; x < 16; x++) {
      const c = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.6, 0.35, 2.4)), epiMat);
      c.position.set(-W / 2 + 0.31 + x * 0.62, y, 0);
      g.add(c);
    }
  }
  for (let x = 0; x < 14; x++) {
    const c = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.28, 1, 4, 10)), pal);
    c.position.set(-W / 2 + 0.6 + x * 0.68, 1.3, 0);
    g.add(c);
    for (let q = 0; q < 6; q++) {
      const ch = new THREE.Mesh(k.sphere, chloro);
      ch.scale.set(0.09, 0.05, 0.05);
      ch.position.set(c.position.x + (r() - 0.5) * 0.4, 1.3 + (r() - 0.5) * 1, 0.25);
      g.add(ch);
    }
  }
  for (let i = 0; i < 22; i++) {
    const c = new THREE.Mesh(k.sphere, spongy);
    const x = (r() - 0.5) * (W - 1);
    if (Math.abs(x - 1) < 1.1) continue;
    c.position.set(x, -0.6 + (r() - 0.5) * 0.9, (r() - 0.5) * 1.2);
    c.scale.set(0.42, 0.3, 0.35);
    g.add(c);
  }
  // Vascular bundle.
  const xy = k.material({ color: "#b5946a", roughness: 0.4 });
  const ph = k.material({ color: "#e8d8a0", roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const t = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.15, 0.15, 2.4, 10, 1, true)), xy);
    t.rotation.x = Math.PI / 2;
    t.position.set(0.6 + (i % 3) * 0.32, 0.1 + Math.floor(i / 3) * 0.3, 0);
    g.add(t);
    const p = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.09, 0.09, 2.4, 8)), ph);
    p.rotation.x = Math.PI / 2;
    p.position.set(0.6 + (i % 3) * 0.32, -0.55 - Math.floor(i / 3) * 0.2, 0);
    g.add(p);
  }
  // Stoma: two guard cells in the lower epidermis.
  const guard = k.material({ color: "#4f9a3a", roughness: 0.4 });
  const stoma = [-1, 1].map((s) => {
    const m = new THREE.Mesh(k.sphere, guard);
    m.scale.set(0.3, 0.22, 0.5);
    m.position.set(-3 + s * 0.28, -1.6, 0.9);
    g.add(m);
    return m;
  });
  const gas = beads(k, g, curve([v(-3, -3, 1), v(-3, -1.6, 0.9), v(-2.6, -0.5, 0.3)]), { n: 10, color: "#9fd0f0", size: 0.08, speed: 0.2 });
  const sap = beads(k, g, curve([v(0.6, 0.1, -1.4), v(0.6, 0.1, 0), v(0.6, 0.1, 1.4)]), { n: 8, color: "#6fb0e0", size: 0.08, speed: 0.3 });
  return { g, stoma, gas, sap };
}

export const plantTissues: Builder = async (k) => {
  lab(k, "#0f160f");
  const leaf = leafSection(k);
  k.root.add(leaf.g);
  tag(k, leaf.g, v(-5.3, 2.2, 1.2), "ზედა ეპიდერმისი", [0]);
  tag(k, leaf.g, v(-3, -2.2, 1.2), "ბაგე", [0]);
  tag(k, leaf.g, v(-5.3, 1.3, 0.5), "სვეტისებრი ქსოვილი", [1]);
  tag(k, leaf.g, v(-4, -0.6, 0.6), "ღრუბლისებრი ქსოვილი", [1]);
  tag(k, leaf.g, v(1, 0.7, 1.3), "ქსილემა", [1]);
  tag(k, leaf.g, v(1, -1.1, 1.3), "ფლოემა", [1]);
  // A shoot tip with dividing meristem cells.
  const tip = new THREE.Group();
  k.root.add(tip);
  const cells = Array.from({ length: 40 }, (_, i) => {
    const c = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.5, 0.45, 0.5)), k.material({ color: i < 12 ? "#b8e08a" : "#8ac860", roughness: 0.45, normalMap: k.normalMap("organic", [1, 1]) }));
    const row = Math.floor(i / 6);
    c.position.set(((i % 6) - 2.5) * 0.52 * (1 - row * 0.06), 2.6 - row * (0.5 + row * 0.06), 0);
    c.scale.y = 1 + row * 0.15;
    tip.add(c);
    return c;
  });
  tag(k, tip, v(0, 3.2, 0), "მერისტემა — იყოფა", [2]);
  tag(k, tip, v(2.2, -0.5, 0), "უჯრედები იჭიმება და სპეციალიზდება", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: i === 2,
      enter: () => {
        leaf.g.visible = i < 2;
        tip.visible = i === 2;
      },
      update: (_u: number, s: number, t: number) => {
        const open = 0.5 + 0.5 * Math.sin(t * 0.8);
        leaf.stoma.forEach((m, j) => (m.position.x = -3 + (j ? 1 : -1) * (0.22 + 0.12 * open)));
        leaf.gas.update(t);
        leaf.sap.update(t);
        cells.slice(0, 12).forEach((c, j) => c.scale.set(1, 1 + 0.15 * Math.max(0, Math.sin(t * 2 + j)), 1));
        return i === 2 ? front(s, 9, v(0, 0.8, 0), 0.1) : orbit(v(-1, 0.3, 0), 11, s, { start: 0.35, speed: 0.03, height: 0.2 });
      },
    })),
  };
};

// ---- Stem, root tip, blood -----------------------------------------------------------------------------------

export const stemAndBlood: Builder = async (k) => {
  lab(k, "#11160f");
  const g = new THREE.Group();
  k.root.add(g);
  // Stem cross-section with a ring of bundles.
  const stem = new THREE.Group();
  g.add(stem);
  const disc = new THREE.Mesh(k.track(new THREE.CylinderGeometry(3, 3, 1.5, 64)), k.material({ color: "#cfe8a8", roughness: 0.5, normalMap: k.normalMap("organic", [6, 6]) }));
  disc.rotation.x = Math.PI / 2;
  const bark = new THREE.Mesh(k.track(new THREE.CylinderGeometry(3.1, 3.1, 1.52, 64, 1, true)), k.material({ color: "#5a8a3a", roughness: 0.6, side: THREE.DoubleSide }));
  bark.rotation.x = Math.PI / 2;
  stem.add(disc, bark);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const ph = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.35, 0.35, 1.54, 16)), k.material({ color: "#e8d8a0" }));
    ph.rotation.x = Math.PI / 2;
    ph.position.set(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0);
    const xy = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.35, 0.35, 1.56, 16)), k.material({ color: "#b5946a" }));
    xy.rotation.x = Math.PI / 2;
    xy.position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0);
    stem.add(ph, xy);
  }
  const camb = new THREE.Mesh(k.track(new THREE.TorusGeometry(1.9, 0.05, 6, 64)), k.material({ color: "#3fae5a", emissive: "#3fae5a", emissiveIntensity: 0.5 }));
  camb.position.z = 0.78;
  stem.add(camb);
  tag(k, stem, v(2.6, 1.0, 0.8), "ფლოემა", [0]);
  tag(k, stem, v(1.0, 1.2, 0.8), "ქსილემა", [0]);
  tag(k, stem, v(-1.9, -0.6, 0.9), "კამბიუმი", [0]);
  // Root tip.
  const root = new THREE.Group();
  g.add(root);
  const rcells = Array.from({ length: 36 }, (_, i) => {
    const c = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.5, 0.4, 0.5)), k.material({ color: i > 23 ? "#e8d8a0" : "#d8e8b0", roughness: 0.45 }));
    root.add(c);
    return { c, row: Math.floor(i / 4), col: i % 4 };
  });
  const cap = new THREE.Mesh(k.track(new THREE.SphereGeometry(1.2, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), k.material({ color: "#c9a06a", roughness: 0.6 }));
  cap.position.y = -2.6;
  root.add(cap);
  tag(k, root, v(1.6, -2.8, 0), "ფესვის ფარი", [1]);
  tag(k, root, v(1.6, -1.6, 0), "გაყოფის ზონა", [1]);
  tag(k, root, v(1.6, 1.5, 0), "გაჭიმვის ზონა", [1]);
  // Blood.
  const blood = new THREE.Group();
  g.add(blood);
  const plasma = new THREE.Mesh(k.track(new THREE.CylinderGeometry(2.5, 2.5, 10, 32, 1, true)), k.ghost("#f2d36b", 0.15, { side: THREE.DoubleSide }));
  plasma.rotation.z = Math.PI / 2;
  blood.add(plasma);
  const rbcGeo = k.redCell();
  const r = rng(7);
  const cells = Array.from({ length: 50 }, (_, i) => {
    const kind = i < 42 ? 0 : i < 46 ? 1 : 2;
    const m = new THREE.Mesh(kind === 0 ? rbcGeo : k.sphere, k.material({ color: kind === 0 ? "#c41e25" : kind === 1 ? "#f0ecf7" : "#e8c48a", roughness: 0.35, clearcoat: 0.6 }));
    m.scale.setScalar(kind === 0 ? 0.8 : kind === 1 ? 0.5 : 0.15);
    m.position.set((r() - 0.5) * 9, (r() - 0.5) * 3.6, (r() - 0.5) * 3.6);
    m.rotation.set(r() * 3, r() * 3, 0);
    blood.add(m);
    return { m, kind };
  });
  tag(k, blood, v(0, 2.8, 0), "პლაზმა — თხევადი უჯრედშორისი ნივთიერება", [2]);
  const groups = [stem, root, blood];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => groups.forEach((x, j) => (x.visible = i === j)),
      update: (u: number, s: number, t: number) => {
        rcells.forEach(({ c, row, col }) => {
          const stretch = row > 3 ? 1 + (row - 3) * 0.35 * (0.5 + 0.5 * ease(u)) : 1;
          c.scale.y = stretch;
          let y = -2.2;
          for (let rr = 0; rr < row; rr++) y += 0.42 * (rr > 3 ? 1 + (rr - 3) * 0.35 * (0.5 + 0.5 * ease(u)) : 1);
          c.position.set((col - 1.5) * 0.52, y, 0);
        });
        cells.forEach(({ m }, j) => {
          m.position.x = ((m.position.x + 4.5 + 0.02) % 9) - 4.5;
          m.rotation.y = t + j;
        });
        return i === 1 ? front(s, 11, v(0, 0.5, 0), 0.08) : orbit(v(0, 0, 0), i === 0 ? 10 : 10, s, { start: 0.3, speed: 0.03, height: 0.2 });
      },
    })),
  };
};

// ---- Levels of organisation ------------------------------------------------------------------------------------

export const levels: Builder = async (k) => {
  const body = await k.body(false);
  outdoor(k, "#dfe8ec", 60, 140);
  const g = new THREE.Group();
  k.root.add(g);
  // Stations along a path: molecule, cell, tissue, organ, system, organism, population, ecosystem, biosphere.
  const at = (i: number) => v(i * 7, 0, 0);
  const dna = dnaLadder(k, 14);
  dna.scale.setScalar(0.6);
  dna.position.copy(at(0)).add(v(-2, 0, 0));
  g.add(dna);
  const cell = new THREE.Mesh(k.track(new THREE.SphereGeometry(1.5, 32, 24, 0, Math.PI * 1.5)), k.material({ color: "#e8b0a8", side: THREE.DoubleSide, roughness: 0.4, normalMap: k.normalMap("organic", [3, 2]) }));
  cell.position.copy(at(1));
  const nuc = new THREE.Mesh(k.sphere, k.material({ color: "#7a4ab0" }));
  nuc.scale.setScalar(0.5);
  nuc.position.copy(at(1));
  g.add(cell, nuc);
  const tissue = new THREE.InstancedMesh(k.track(new THREE.CapsuleGeometry(0.25, 0.9, 4, 10)), k.material({ color: "#c46a6a", roughness: 0.45 }), 30);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 30; i++) {
    m4.compose(at(2).add(v((i % 6) * 0.6 - 1.5, Math.floor(i / 6) * 0.55 - 1.1, 0)), new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), Math.PI / 2), v(1, 1, 1));
    tissue.setMatrixAt(i, m4);
  }
  g.add(tissue);
  const organG = new THREE.Group();
  const heart = layer(k, body, organG, (p) => p.group === "heart" && /^Wall/.test(p.name), k.material({ color: "#b3363d", roughness: 0.42, clearcoat: 0.5 }));
  const hc = heart.geometry.boundingBox!.getCenter(new THREE.Vector3());
  organG.position.copy(at(3)).sub(hc.clone().multiplyScalar(20));
  organG.scale.setScalar(20);
  g.add(organG);
  const sysG = new THREE.Group();
  layer(k, body, sysG, (p) => p.group === "heart" && /^Wall/.test(p.name), k.material({ color: "#b3363d" }));
  layer(k, body, sysG, (p) => p.group === "arteries" || p.group === "veins", k.material({ color: "#c9343a" }));
  sysG.scale.setScalar(6);
  sysG.position.copy(at(4)).add(v(0, -7.8, 0));
  g.add(sysG);
  const orgG = new THREE.Group();
  layer(k, body, orgG, (p) => p.group === "skin", k.material({ color: "#e8b79e", roughness: 0.55 }));
  orgG.scale.setScalar(2.2);
  orgG.position.copy(at(5)).add(v(0, -1.9, 0));
  g.add(orgG);
  const popG = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = rabbit(k);
    a.g.position.copy(at(6)).add(v((i % 4) * 0.8 - 1.2, -1, Math.floor(i / 4) * 0.8 - 0.4));
    a.g.rotation.y = i;
    a.g.scale.setScalar(1.4);
    popG.add(a.g);
  }
  g.add(popG);
  const eco = new THREE.Group();
  const M = natureMaterials(k);
  const disk = new THREE.Mesh(k.track(new THREE.CylinderGeometry(2.6, 2.6, 0.3, 48)), k.material({ color: "#6f9c48", roughness: 0.9 }));
  eco.add(disk);
  tree(k, M, eco, v(-1, 0.15, -0.8), { scale: 0.35 });
  tree(k, M, eco, v(1, 0.15, -1), { scale: 0.3, kind: "pine" });
  const fx = fox(k);
  fx.g.position.set(0.6, 0.15, 0.8);
  const b0 = bird(k);
  b0.g.position.set(-0.5, 1.6, 0.4);
  const f0 = fish(k);
  f0.g.position.set(-1.2, 0.3, 1.2);
  eco.add(fx.g, b0.g, f0.g);
  eco.position.copy(at(7)).add(v(0, -1, 0));
  g.add(eco);
  const earth = new THREE.Mesh(k.sphere, k.material({ color: "#2f6f95", roughness: 0.5, normalMap: k.normalMap("organic", [3, 2]), emissive: "#3f8f4a", emissiveIntensity: 0.15 }));
  earth.scale.setScalar(2.2);
  earth.position.copy(at(8));
  g.add(earth);
  const names = ["მოლეკულა", "უჯრედი", "ქსოვილი", "ორგანო", "ორგანოთა სისტემა", "ორგანიზმი", "პოპულაცია", "ეკოსისტემა", "ბიოსფერო"];
  names.forEach((n, i) => tag(k, g, at(i).add(v(0, 2.8, 0)), n));
  const ranges: [number, number][] = [
    [0, 2],
    [3, 5],
    [6, 8],
  ];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 17,
      update: (u: number, s: number, t: number) => {
        const [a, b] = ranges[i];
        const x = a * 7 + (b - a) * 7 * ease(u / 0.9);
        earth.rotation.y = t * 0.2;
        b0.move(t * 4);
        return { target: v(x, 0.3, 0), pos: v(x + Math.sin(s * 0.2) * 1.5, 2.2, 11) };
      },
    })),
  };
};

// ---- Symmetry -----------------------------------------------------------------------------------------------------

export const symmetry: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  // Starfish: five arms; mirror planes appear one by one.
  const star = new THREE.Group();
  const sm = k.material({ color: "#e07a3a", roughness: 0.5, normalMap: k.normalMap("bone", [2, 2]) });
  const centre = new THREE.Mesh(k.sphere, sm);
  centre.scale.set(0.9, 0.3, 0.9);
  star.add(centre);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.5, 2.6, 16).rotateZ(-Math.PI / 2).translate(1.3, 0, 0)), sm);
    arm.scale.set(1, 0.4, 1);
    arm.rotation.y = -a;
    star.add(arm);
  }
  g.add(star);
  const planeMat = k.ghost("#6fb0e0", 0.25, { side: THREE.DoubleSide });
  const planes = [0, 1, 2, 3, 4].map((i) => {
    const p = new THREE.Mesh(k.track(new THREE.PlaneGeometry(6, 2)), planeMat);
    p.rotation.y = (i / 5) * Math.PI;
    star.add(p);
    return p;
  });
  // Butterfly: bilateral.
  const fly = new THREE.Group();
  const wingTex = k.canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = "#f2a23a";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#1d1a17";
    ctx.fillRect(0, 0, 128, 12);
    ctx.beginPath();
    ctx.arc(80, 60, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(80, 60, 6, 0, Math.PI * 2);
    ctx.fill();
  });
  const wingMat = k.material({ map: wingTex, roughness: 0.6, side: THREE.DoubleSide });
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Group();
    const up = new THREE.Mesh(k.track(new THREE.CircleGeometry(1.3, 32)), wingMat);
    up.position.set(s * 1.2, 0.6, 0);
    const lo = new THREE.Mesh(k.track(new THREE.CircleGeometry(0.9, 32)), wingMat);
    lo.position.set(s * 0.9, -0.8, 0);
    w.add(up, lo);
    fly.add(w);
    return { w, s };
  });
  const bodyF = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.15, 2, 4, 10)), k.material({ color: "#2a2420" }));
  fly.add(bodyF);
  const mirror = new THREE.Mesh(k.track(new THREE.PlaneGeometry(4, 4)), planeMat);
  mirror.rotation.y = Math.PI / 2;
  fly.add(mirror);
  g.add(fly);
  // Amoeba: no symmetry.
  const am = new THREE.Mesh(k.track(new THREE.IcosahedronGeometry(1, 4)), k.ghost("#a58bd0", 0.75, { roughness: 0.25, clearcoat: 0.8 }));
  const amBase = (am.geometry.attributes.position.array as Float32Array).slice();
  am.scale.set(1.6, 0.6, 1.6);
  g.add(am);
  const groups = [star, fly, am];
  const p = new THREE.Vector3();
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      enter: () => groups.forEach((x, j) => (x.visible = i === j)),
      update: (u: number, s: number, t: number) => {
        planes.forEach((pl, j) => (pl.visible = u > j * 0.12 + 0.1));
        star.rotation.y = t * 0.2;
        wings.forEach(({ w, s: side }) => (w.rotation.y = side * Math.sin(t * 2) * 0.5));
        const pos = am.geometry.attributes.position as THREE.BufferAttribute;
        for (let j = 0; j < pos.count; j++) {
          p.set(amBase[j * 3], amBase[j * 3 + 1], amBase[j * 3 + 2]);
          p.multiplyScalar(1 + 0.25 * Math.sin(t * 1.3 + p.x * 3) * Math.cos(t * 0.9 + p.z * 2));
          pos.setXYZ(j, p.x, p.y, p.z);
        }
        pos.needsUpdate = true;
        am.geometry.computeVertexNormals();
        return orbit(v(0, 0, 0), 8, s, { start: i === 1 ? 0 : 0.3, speed: i === 1 ? 0 : 0.04, height: i === 0 ? 0.9 : 0.15 });
      },
    })),
  };
};

// ---- Alcohol and tobacco on the cell ----------------------------------------------------------------------------------

export const toxinsCell: Builder = async (k) => {
  lab(k, "#130f14");
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(2);
  // A lipid bilayer patch: heads (spheres) and tails.
  const bil = new THREE.Group();
  g.add(bil);
  const head = new THREE.InstancedMesh(k.sphere, k.material({ color: "#e8a03a", roughness: 0.4 }), 2 * 18 * 8);
  const tail = new THREE.InstancedMesh(k.track(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 5)), k.material({ color: "#f2e0a0", roughness: 0.5 }), 2 * 18 * 8);
  bil.add(head, tail);
  const lipids: { p: V3; up: number; gap: number }[] = [];
  for (const up of [1, -1]) for (let x = 0; x < 18; x++) for (let z = 0; z < 8; z++) lipids.push({ p: v((x - 8.5) * 0.4, up * 0.9, (z - 3.5) * 0.4), up, gap: Math.hypot(x - 8.5, z - 3.5) });
  const alc = Array.from({ length: 24 }, () => {
    const m = new THREE.Group();
    const c = atom(k, "C", 0.12);
    const c2 = atom(k, "C", 0.12);
    c2.position.x = 0.22;
    const o = atom(k, "O", 0.12);
    o.position.x = 0.42;
    m.add(c, c2, o);
    bil.add(m);
    return { m, from: v((r() - 0.5) * 7, 3 + r() * 2, (r() - 0.5) * 3), to: v((r() - 0.5) * 3, (r() - 0.5) * 1, (r() - 0.5) * 2) };
  });
  const leak = beads(k, bil, curve([v(0, -3, 0), v(0.2, 0, 0.1), v(0, 3, 0)]), { n: 12, color: "#a46be0", size: 0.12, speed: 0.2, emissive: 0.6 });
  // Nicotine at receptors and a vessel narrowing.
  const nic = new THREE.Group();
  g.add(nic);
  const vessel = k.tube([v(-5, 0, 0), v(0, 0.2, 0), v(5, 0, 0)], 1, k.ghost("#c62f36", 0.45, { side: THREE.DoubleSide }), nic, 40, 24);
  const vesselCurve = vessel.curve;
  const recs = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(k.track(new THREE.TorusGeometry(0.25, 0.08, 8, 16)), k.material({ color: "#3d7bd9", emissive: "#3d7bd9", emissiveIntensity: 0.2 }));
    m.position.set(-3.5 + i * 1.4, 2.6, 0);
    nic.add(m);
    return m;
  });
  const nics = recs.map((rc) => {
    const m = new THREE.Mesh(k.sphere, k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.5 }));
    m.scale.setScalar(0.15);
    nic.add(m);
    return { m, to: rc.position.clone() };
  });
  // Damaged cell: swollen mitochondria and DNA breaks.
  const dmg = new THREE.Group();
  g.add(dmg);
  const cellM = new THREE.Mesh(k.track(new THREE.SphereGeometry(3, 48, 32, 0, Math.PI * 1.5)), k.material({ color: "#c9a0a0", roughness: 0.45, side: THREE.DoubleSide, normalMap: k.normalMap("organic", [4, 3]) }));
  cellM.rotation.y = Math.PI * 0.75;
  dmg.add(cellM);
  const mitos = Array.from({ length: 5 }, (_, i) => {
    const m = new THREE.Mesh(k.sphere, k.material({ color: "#e48c3f", roughness: 0.4 }));
    m.scale.set(0.6, 0.28, 0.28);
    m.position.set(Math.cos(i) * 1.8, Math.sin(i * 1.7) * 1.2, -0.5);
    dmg.add(m);
    return m;
  });
  const dna = dnaLadder(k, 18);
  dna.scale.setScalar(0.45);
  dna.position.set(-1.8, 0.2, 0.5);
  dmg.add(dna);
  const breaks = Array.from({ length: 3 }, (_, i) => {
    const m = new THREE.Mesh(k.sphere, k.material({ color: "#ff3a3a", emissive: "#ff2020", emissiveIntensity: 1.2 }));
    m.scale.setScalar(0.12);
    m.position.set(-1.8 + 0.6 + i * 0.9, 0.2, 0.6);
    dmg.add(m);
    return m;
  });
  tag(k, bil, v(0, 2.6, 0), "მემბრანა — ფოსფოლიპიდები", [0]);
  tag(k, nic, v(0, 3.4, 0), "ნიკოტინი რეცეპტორზე", [1]);
  const vt = tag(k, nic, v(0, -1.6, 0), "", [1]);
  tag(k, dmg, v(-1.8, 1.1, 0.6), "დნმ-ის დაზიანება", [2]);
  tag(k, dmg, v(1.8, 1.6, -0.4), "შეშუპებული მიტოქონდრია", [2]);
  const groups = [bil, nic, dmg];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => groups.forEach((x, j) => (x.visible = i === j)),
      update: (u: number, s: number, t: number) => {
        const disorder = i === 0 ? ease((u - 0.3) / 0.5) : 0;
        const m4 = new THREE.Matrix4();
        lipids.forEach((l, j) => {
          const push = disorder * Math.max(0, 1.6 - l.gap * 0.35);
          const p = l.p.clone().add(v(l.p.x * 0.15 * push, Math.sin(t * 2 + j) * 0.05 + l.up * 0.4 * push, l.p.z * 0.15 * push));
          m4.compose(p, new THREE.Quaternion(), v(0.17, 0.17, 0.17));
          head.setMatrixAt(j, m4);
          m4.compose(p.clone().add(v(0, -l.up * 0.45, 0)), new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), push * 0.6 * l.up), v(1, 1, 1));
          tail.setMatrixAt(j, m4);
        });
        head.instanceMatrix.needsUpdate = true;
        tail.instanceMatrix.needsUpdate = true;
        alc.forEach((a, j) => a.m.position.lerpVectors(a.from, a.to, ease((u - j * 0.01) / 0.4)));
        leak.update(t, disorder > 0.5 ? 1 : 0);
        nics.forEach((n0, j) => n0.m.position.lerpVectors(n0.to.clone().add(v(0, 2.5, 1)), n0.to, ease((u - j * 0.05) / 0.3)));
        recs.forEach((rc) => ((rc.material as THREE.MeshPhysicalMaterial).emissiveIntensity = i === 1 && u > 0.3 ? 0.8 : 0.2));
        const narrow = i === 1 ? 1 - 0.45 * ease((u - 0.4) / 0.4) : 1;
        vessel.mesh.geometry.dispose();
        vessel.mesh.geometry = new THREE.TubeGeometry(vesselCurve, 40, narrow, 24);
        setText(vt, narrow < 0.8 ? "სისხლძარღვი ვიწროვდება" : "სისხლძარღვი");
        mitos.forEach((m) => m.scale.set(0.6 + 0.4 * (i === 2 ? ease(u / 0.6) : 0), 0.28 + 0.3 * (i === 2 ? ease(u / 0.6) : 0), 0.28 + 0.3 * (i === 2 ? ease(u / 0.6) : 0)));
        breaks.forEach((b, j) => (b.visible = i === 2 && u > 0.3 + j * 0.15));
        return orbit(v(0, 0.3, 0), i === 2 ? 10 : 11, s, { start: 0.3, speed: 0.03, height: 0.25 });
      },
    })),
  };
};
