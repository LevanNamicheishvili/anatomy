import * as THREE from "three";
import { armRig, armShot } from "@/components/journeys/journey-arm";
import { beads, context, curve, layer, orbit } from "@/components/journeys/common";
import { ease, rng, v, type Builder, type Kit, type V3 } from "@/components/journeys/JourneyScene";
import { fbm } from "@/lib/noise";

/*
 * Health lessons: smoke in the airways (cilia, tar, a smoker's lung beside a healthy one), alcohol (absorbed,
 * slowing the brain, fat in liver cells), drugs at a synapse (reuptake blocked, receptors lost), and
 * exercise (heart rate, a working arm, deeper breathing). Body from the atlas, close-ups drawn in code.
 */

const setText = (el: HTMLDivElement, text: string) => {
  const t = el.querySelector(".blood-label-text") ?? el;
  if (t.textContent !== text) t.textContent = text;
};

// ---- 8 4.1 Smoking ------------------------------------------------------------------------------

export const smoking: Builder = async (k) => {
  const body = await k.body({ organs: true });
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.08, 0.12);
  layer(k, body, g, (p) => p.group === "airways", k.material({ color: "#e6d2c4", roughness: 0.5 }), 1);
  const lungs = layer(k, body, g, (p) => p.group === "lungs", k.ghost("#e79aa2", 0.35), 2);
  const smoke = beads(k, g, curve([v(0, 1.53, 0.06), v(0, 1.5, 0.02), v(0, 1.45, -0.004), v(0, 1.4, -0.006), v(-0.02, 1.35, -0.015), v(-0.05, 1.32, -0.01), v(-0.07, 1.29, 0.0)]), { n: 60, color: "#8d8d8d", size: 0.004, speed: 0.12, spread: 0.004, emissive: 0.1 });
  const smoke2 = beads(k, g, curve([v(0, 1.53, 0.06), v(0, 1.5, 0.02), v(0, 1.45, -0.004), v(0, 1.4, -0.006), v(0.025, 1.35, -0.02), v(0.06, 1.31, -0.01), v(0.075, 1.28, 0.0)]), { n: 60, color: "#8d8d8d", size: 0.004, speed: 0.12, spread: 0.004, seed: 9, emissive: 0.1 });
  k.label(k.anchor(g, v(0, 1.43, 0.0)), "ტრაქეა", { stages: [0] });
  k.label(k.anchor(g, v(-0.035, 1.34, -0.015)), "ბრონქი", { stages: [0] });
  k.label(k.anchor(g, v(-0.08, 1.3, 0.02)), "ფილტვი", { stages: [0] });

  // Comparison: two lungs side by side, the smoker's darkened with tar.
  const cmp = new THREE.Group();
  k.root.add(cmp);
  const lungGeo = lungs.geometry;
  const healthy = new THREE.Mesh(lungGeo, k.material({ color: "#e8a0a4", roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color("#ffd8d8"), clearcoat: 0.3 }));
  const tarGeo = lungGeo.clone();
  const pos = tarGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const n = fbm(pos.getX(i) * 60, pos.getY(i) * 60, pos.getZ(i) * 60, 4);
    c.set("#b98a85").lerp(new THREE.Color("#2b2422"), THREE.MathUtils.clamp(0.55 + n * 1.2, 0, 1));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  tarGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  k.track(tarGeo);
  const smoker = new THREE.Mesh(tarGeo, k.material({ color: "#ffffff", vertexColors: true, roughness: 0.6, clearcoat: 0.2 }));
  const lc = lungGeo.boundingBox!.getCenter(new THREE.Vector3());
  healthy.position.set(-lc.x - 0.13, -lc.y, -lc.z);
  smoker.position.set(-lc.x + 0.13, -lc.y, -lc.z);
  cmp.add(healthy, smoker);
  k.label(k.anchor(cmp, v(-0.13, 0.12, 0.02)), "ჯანმრთელი ფილტვი", { stages: [3] });
  k.label(k.anchor(cmp, v(0.13, 0.12, 0.02)), "მწეველის ფილტვი", { stages: [3] });

  const cilia = ciliaScene(k);
  const alv = tarAlveoli(k);
  const show = (which: "body" | "cilia" | "alv" | "cmp") => {
    g.visible = which === "body";
    cilia.group.visible = which === "cilia";
    alv.group.visible = which === "alv";
    cmp.visible = which === "cmp";
    k.mood(which === "cilia" || which === "alv" ? "#150c0c" : null, 9, 26);
  };
  return {
    stages: [
      {
        duration: 15,
        enter: () => show("body"),
        update: (_u, s, t) => {
          smoke.update(t);
          smoke2.update(t);
          return orbit(v(0, 1.38, 0.0), 0.55, s, { start: 0.35, speed: 0.04, height: 0.1 });
        },
      },
      { duration: 18, cut: true, enter: () => show("cilia"), update: (u, s, t) => (cilia.update(t, s), orbit(v(0, 0.8, 0), 10.5 - 1.5 * ease(u), 0, { start: 0.45 + Math.sin(s * 0.2) * 0.12, height: 0.35 })) },
      { duration: 16, cut: true, enter: () => show("alv"), update: (u, s, t) => (alv.update(u, t), orbit(v(0, 0, 0), 8 - 1.2 * ease(u), s, { start: -0.3, speed: 0.05, height: 0.3 })) },
      { duration: 15, cut: true, enter: () => show("cmp"), update: (_u, s) => ({ target: v(0, 0, 0), pos: v(Math.sin(s * 0.15) * 0.15, 0.03, 0.62) }) },
    ],
  };
};

/** Ciliated epithelium: cilia beat in a wave and push mucus — until smoke stops them. */
function ciliaScene(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(71);
  const cellMat = k.material({ color: "#e6b3ad", roughness: 0.45, normalMap: k.normalMap("organic", [1, 2]), sheen: 0.5, sheenColor: new THREE.Color("#ffffff"), clearcoat: 0.3 });
  const cellGeo = k.track(new THREE.CapsuleGeometry(0.42, 2.2, 4, 12));
  const COLS = 12;
  const ROWS = 5;
  const cells = new THREE.InstancedMesh(cellGeo, cellMat, COLS * ROWS);
  const m = new THREE.Matrix4();
  const tops: V3[] = [];
  let i = 0;
  for (let x = 0; x < COLS; x++)
    for (let z = 0; z < ROWS; z++) {
      const p = v((x - COLS / 2) * 0.92, -1.2, (z - ROWS / 2) * 0.92);
      m.compose(p, new THREE.Quaternion(), v(1, 1, 1));
      cells.setMatrixAt(i++, m);
      tops.push(p.clone().add(v(0, 1.55, 0)));
    }
  group.add(cells);
  // Cilia: many thin rods on each cell top.
  const ciliumGeo = k.track(new THREE.CylinderGeometry(0.025, 0.03, 0.9, 5).translate(0, 0.45, 0));
  const ciliaPos: V3[] = [];
  for (const t of tops) for (let j = 0; j < 14; j++) ciliaPos.push(t.clone().add(v((r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6)));
  const ciliaMat = k.material({ color: "#f4d6cf", roughness: 0.4 });
  const ci = new THREE.InstancedMesh(ciliumGeo, ciliaMat, ciliaPos.length);
  group.add(ci);
  // Mucus layer with dust; tar collects on it.
  const mucus = new THREE.Mesh(k.track(new THREE.BoxGeometry(COLS * 0.92 + 1, 0.35, ROWS * 0.92 + 0.6)), k.ghost("#e8dc9a", 0.4, { roughness: 0.2, clearcoat: 1 }));
  mucus.position.y = 1.35 + 0.3;
  group.add(mucus);
  const dust = Array.from({ length: 40 }, () => ({ x: (r() - 0.5) * COLS * 0.92, z: (r() - 0.5) * ROWS * 0.92, tar: r() < 0.6 }));
  const dustMesh = new THREE.InstancedMesh(k.sphere, k.material({ color: "#6b5a48", roughness: 0.7 }), dust.length);
  group.add(dustMesh);
  const smoke = beads(k, group, curve([v(-6, 5, 0), v(-2, 3.5, 0.5), v(2, 2.4, -0.3), v(6, 2.0, 0.2)]), { n: 50, color: "#8d8d8d", size: 0.12, speed: 0.08, spread: 1.2, emissive: 0.05 });
  const status = k.label(k.anchor(group, v(0, 3.6, 0)), "წამწამები ლორწოს გარეთ აგდებს", { kind: "tag", stages: [1] });
  k.label(k.anchor(group, v(-4.8, 0, 2.6)), "წამწამოვანი ეპითელიუმი", { stages: [1] });
  k.label(k.anchor(group, v(3.5, 1.75, 2.7)), "ლორწო მტვრით", { stages: [1] });
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let shift = 0;
  return {
    group,
    update: (t: number, s: number) => {
      // Beating for the first half, slowing to a stop once the smoke arrives.
      const beat = 1 - ease((s - 7) / 4);
      ciliaPos.forEach((p, j) => {
        const a = beat * 0.55 * Math.sin(t * 9 - p.x * 1.4);
        q.setFromEuler(e.set(0, 0, a + (1 - beat) * 0.35));
        m.compose(p, q, v(1, 1, 1));
        ci.setMatrixAt(j, m);
      });
      ci.instanceMatrix.needsUpdate = true;
      shift += 0.012 * beat;
      const tarAmount = ease((s - 7) / 6);
      dust.forEach((d, j) => {
        let x = d.x + shift * 4;
        x = ((x + COLS * 0.46) % (COLS * 0.92)) - COLS * 0.46;
        const visible = !d.tar || tarAmount > 0;
        m.compose(v(x, 1.65, d.z), q.identity(), v(1, 1, 1).multiplyScalar(visible ? (d.tar ? 0.08 + 0.16 * tarAmount : 0.09) : 0));
        dustMesh.setMatrixAt(j, m);
      });
      dustMesh.instanceMatrix.needsUpdate = true;
      smoke.update(t, s > 5 ? 1 : 0);
      ciliaMat.color.set(beat > 0.5 ? "#f4d6cf" : "#a99a8d");
      setText(status, beat > 0.5 ? "წამწამები ლორწოს გარეთ აგდებს" : "კვამლმა წამწამები გააჩერა — ლორწო გროვდება");
    },
  };
}

/** Alveoli darkening with tar, walls breaking down. */
function tarAlveoli(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(81);
  const sacMat = k.ghost("#f0aeb3", 0.45, { side: THREE.DoubleSide, normalMap: k.normalMap("organic", [3, 2]), sheen: 0.6, sheenColor: new THREE.Color("#fff"), emissive: "#5a1a22", emissiveIntensity: 0.25 });
  const centres = [v(0, 0, 0), v(1.8, 0.6, -0.4), v(-1.7, 0.5, -0.6), v(0.5, 1.9, -1), v(-0.6, -1.7, -0.8), v(1.5, -1.3, -0.6), v(-2, -0.7, 0.6), v(2, 0, 1)];
  centres.forEach((c) => {
    const m = new THREE.Mesh(k.sphere, sacMat);
    m.position.copy(c);
    m.scale.setScalar(1.05);
    group.add(m);
  });
  const spots: { p: V3; n: V3 }[] = [];
  for (let i = 0; i < 160; i++) {
    const c = centres[Math.floor(r() * centres.length)];
    const n = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    spots.push({ p: c.clone().addScaledVector(n, 1.06), n });
  }
  const tar = new THREE.InstancedMesh(k.sphere, k.material({ color: "#2e241e", roughness: 0.8 }), spots.length);
  group.add(tar);
  k.label(k.anchor(group, v(0.2, 0.6, 1.1)), "ალვეოლი", { stages: [2] });
  const tag = k.label(k.anchor(group, v(0, 2.8, 0)), "ფისი ილექება", { kind: "tag", stages: [2] });
  const m = new THREE.Matrix4();
  return {
    group,
    update: (u: number, t: number) => {
      const shown = Math.floor(spots.length * ease(u / 0.8));
      spots.forEach((s, i) => {
        const size = i < shown ? 0.07 + 0.05 * Math.sin(i) ** 2 : 0;
        m.compose(s.p, new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), s.n), v(size, size * 0.3, size));
        tar.setMatrixAt(i, m);
      });
      tar.instanceMatrix.needsUpdate = true;
      sacMat.color.set("#f0aeb3").lerp(new THREE.Color("#7a6560"), ease(u / 0.9) * 0.6);
      setText(tag, u < 0.6 ? "ფისი ილექება" : "კედლები ზიანდება — ნაკლები ჟანგბადი");
      void t;
    },
  };
}

// ---- 8 4.2 Alcohol ------------------------------------------------------------------------------

export const alcohol: Builder = async (k) => {
  const body = await k.body({ organs: true, brain: true });
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.07, 0.1);
  layer(k, body, g, (p) => p.group === "digestive" && /stomach|duodenum|ileum|jejunum|colon/i.test(p.name), k.ghost("#d9a38f", 0.4), 2);
  layer(k, body, g, (p) => p.group === "brain", k.ghost("#e8c7c0", 0.4), 2);
  layer(k, body, g, (p) => p.group === "heart" && /^Wall/.test(p.name), k.ghost("#b5343c", 0.35), 2);
  // The liver, drawn (the atlas has only its ducts): a wedge under the right ribs.
  const liver = new THREE.Mesh(k.sphere, k.material({ color: "#7a2e26", roughness: 0.4, clearcoat: 0.6, normalMap: k.normalMap("organic", [2, 2]) }));
  liver.scale.set(0.085, 0.045, 0.06);
  liver.position.set(-0.035, 1.2, 0.04);
  liver.rotation.z = -0.25;
  g.add(liver);
  const toLiver = beads(k, g, curve([v(-0.01, 1.03, 0.04), v(-0.02, 1.1, 0.03), v(-0.03, 1.17, 0.04), v(-0.035, 1.2, 0.04)]), { n: 26, color: "#79c3f0", size: 0.0035, speed: 0.15, seed: 2 });
  const toBrain = beads(k, g, curve([v(-0.03, 1.21, 0.03), v(-0.015, 1.27, 0.02), v(0.017, 1.31, 0.02), v(0.012, 1.37, 0.012), v(0.015, 1.45, 0.01), v(0.01, 1.55, 0.005), v(0.0, 1.63, 0.0)]), { n: 36, color: "#79c3f0", size: 0.0035, speed: 0.1, seed: 3 });
  const fromStomach = beads(k, g, curve([v(0.039, 1.17, 0.04), v(0.02, 1.15, 0.035), v(-0.01, 1.14, 0.035), v(-0.035, 1.2, 0.04)]), { n: 16, color: "#79c3f0", size: 0.0035, speed: 0.15, seed: 4 });
  k.label(k.anchor(g, v(0.039, 1.18, 0.05)), "კუჭი", { stages: [0] });
  k.label(k.anchor(g, v(0.0, 1.03, 0.05)), "წვრილი ნაწლავი", { stages: [0] });
  k.label(k.anchor(g, v(-0.05, 1.21, 0.07)), "ღვიძლი", { stages: [0] });
  k.label(k.anchor(g, v(0.0, 1.66, 0.02)), "თავის ტვინი", { stages: [0] });
  const net = neuronNet(k);
  const hep = liverCells(k);
  const show = (i: number) => {
    g.visible = i === 0;
    net.group.visible = i === 1;
    hep.group.visible = i === 2;
    k.mood(i === 0 ? null : i === 1 ? "#0d0b16" : "#150b09", 9, 26);
  };
  return {
    stages: [
      {
        duration: 15,
        enter: () => show(0),
        update: (_u, s, t) => {
          toLiver.update(t);
          toBrain.update(t);
          fromStomach.update(t);
          return orbit(v(0, 1.32, 0.02), 1.15, s, { start: 0.3, speed: 0.03, height: 0.05 });
        },
      },
      { duration: 17, cut: true, enter: () => show(1), update: (u, s, t) => (net.update(t, u), orbit(v(0, 0, 0), 12, s, { start: 0.2, speed: 0.04, height: 0.3 })) },
      { duration: 17, cut: true, enter: () => show(2), update: (u, s, t) => (hep.update(u, t), orbit(v(0, 0, 0), 11 - 1.5 * ease(u), s, { start: -0.2, speed: 0.04, height: 0.5 })) },
    ],
  };
};

/** A small network of neurons; impulses run along it, slowing and fading as `slow` grows. */
function neuronNet(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(91);
  const somaMat = k.material({ color: "#9b7fd0", emissive: "#7d5ba6", emissiveIntensity: 0.25, roughness: 0.4, normalMap: k.normalMap("organic", [1, 1]), clearcoat: 0.4 });
  const axonMat = k.material({ color: "#c9b6ea", roughness: 0.45 });
  const nodes = Array.from({ length: 12 }, () => v((r() - 0.5) * 12, (r() - 0.5) * 6, (r() - 0.5) * 6));
  for (const n of nodes) {
    const s = new THREE.Mesh(k.sphere, somaMat);
    s.position.copy(n);
    s.scale.setScalar(0.45);
    group.add(s);
  }
  const links: THREE.CatmullRomCurve3[] = [];
  nodes.forEach((a, i) => {
    const near = nodes.map((b, j) => ({ j, d: a.distanceTo(b) })).filter((x) => x.j > i).sort((x, y) => x.d - y.d).slice(0, 2);
    for (const x of near) {
      const b = nodes[x.j];
      const mid = a.clone().lerp(b, 0.5).add(v(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.5));
      links.push(k.tube([a, mid, b], 0.06, axonMat, group, 24, 6).curve);
    }
  });
  const pulses = links.map((c, i) => beads(k, group, c, { n: 2, color: "#ffd23f", size: 0.22, speed: 0.35, seed: i + 1, emissive: 1.2 }));
  const tag = k.label(k.anchor(group, v(0, 4, 0)), "ნორმალური სიჩქარე", { kind: "tag", stages: [1] });
  k.label(k.anchor(group, nodes[0]), "ნეირონი", { stages: [1] });
  let clock = 0;
  let last = 0;
  return {
    group,
    update: (t: number, u: number) => {
      const slow = ease((u - 0.3) / 0.5);
      clock += (t - last) * (1 - 0.8 * slow);
      last = t;
      pulses.forEach((p) => {
        p.update(clock);
        (p.mat as THREE.MeshPhysicalMaterial).emissiveIntensity = 1.2 * (1 - 0.7 * slow);
      });
      setText(tag, slow < 0.3 ? "ნორმალური სიჩქარე" : "ალკოჰოლი — იმპულსები ნელდება");
    },
  };
}

/** Liver cells (hepatocytes) filling with fat droplets. */
function liverCells(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(101);
  const cellMat = k.material({ color: "#b9705a", roughness: 0.45, normalMap: k.normalMap("organic", [1, 1]), clearcoat: 0.4, transparent: true, opacity: 0.85 });
  const nucMat = k.material({ color: "#4b2f6b", roughness: 0.5 });
  const fatMat = k.material({ color: "#f5d36b", roughness: 0.2, clearcoat: 1, emissive: "#8a6a10", emissiveIntensity: 0.2 });
  const cellGeo = k.track(new THREE.BoxGeometry(1.7, 1.7, 1.7, 3, 3, 3));
  // Round the boxes a little.
  const pg = cellGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pg.count; i++) {
    const p = v(pg.getX(i), pg.getY(i), pg.getZ(i));
    const round = p.clone().normalize().multiplyScalar(1.2);
    p.lerp(round, 0.35);
    pg.setXYZ(i, p.x, p.y, p.z);
  }
  cellGeo.computeVertexNormals();
  const fats: { m: THREE.Mesh; max: number; delay: number }[] = [];
  for (let x = -2; x <= 2; x++)
    for (let z = -1; z <= 1; z++) {
      const c = v(x * 1.9, 0, z * 1.9);
      const cell = new THREE.Mesh(cellGeo, cellMat);
      cell.position.copy(c);
      cell.renderOrder = 2;
      group.add(cell);
      const nuc = new THREE.Mesh(k.sphere, nucMat);
      nuc.position.copy(c).add(v(0.3, 0.2, 0.2));
      nuc.scale.setScalar(0.28);
      group.add(nuc);
      for (let j = 0; j < 4; j++) {
        const f = new THREE.Mesh(k.sphere, fatMat);
        f.position.copy(c).add(v(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9));
        f.scale.setScalar(0.001);
        group.add(f);
        fats.push({ m: f, max: 0.2 + r() * 0.35, delay: r() * 0.5 });
      }
    }
  k.label(k.anchor(group, v(-3.8, 1.1, 1.9)), "ღვიძლის უჯრედი", { stages: [2] });
  const tag = k.label(k.anchor(group, v(0, 1.9, 0)), "ცხიმის წვეთები გროვდება", { kind: "tag", stages: [2] });
  return {
    group,
    update: (u: number, t: number) => {
      for (const f of fats) f.m.scale.setScalar(0.001 + f.max * ease((u - f.delay * 0.6) / 0.5));
      cellMat.color.set("#b9705a").lerp(new THREE.Color("#d3a46a"), ease((u - 0.4) / 0.5));
      setText(tag, u < 0.6 ? "ცხიმის წვეთები გროვდება" : "ცხიმოვანი ღვიძლი");
      void t;
    },
  };
}

// ---- 9 1.9 Drugs at a synapse ---------------------------------------------------------------------

export const drugs: Builder = async (k) => {
  k.mood("#0d0b16", 10, 30);
  const group = new THREE.Group();
  k.root.add(group);
  const r = rng(111);
  const organic = k.normalMap("organic", [3, 2]);
  // Presynaptic terminal above, postsynaptic membrane below.
  const pre = new THREE.Mesh(k.track(new THREE.SphereGeometry(4, 64, 32, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), k.material({ color: "#a98bd6", roughness: 0.4, clearcoat: 0.5, normalMap: organic, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false }));
  pre.scale.set(1, 0.7, 1);
  pre.position.y = 3.6;
  const post = new THREE.Mesh(k.track(new THREE.SphereGeometry(5, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2)), k.material({ color: "#d79aa8", roughness: 0.4, clearcoat: 0.5, normalMap: organic, side: THREE.DoubleSide }));
  post.scale.set(1, 0.25, 1);
  post.position.y = -1.6;
  group.add(pre, post);
  // Vesicles inside the terminal.
  const vesMat = k.ghost("#ffe7a3", 0.6, { roughness: 0.2, clearcoat: 1 });
  for (let i = 0; i < 12; i++) {
    const ve = new THREE.Mesh(k.sphere, vesMat);
    ve.position.set((r() - 0.5) * 4, 1.6 + r() * 1.3, (r() - 0.5) * 4);
    ve.scale.setScalar(0.35);
    group.add(ve);
  }
  // Receptors on the postsynaptic side, pumps on the presynaptic side.
  const recs: { p: V3; m: THREE.Mesh; mat: THREE.MeshPhysicalMaterial }[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rad = 1 + (i % 3) * 1.1;
    const p = v(Math.cos(a) * rad, -1.6 + 1.25 * Math.sqrt(Math.max(0, 1 - (rad / 5) ** 2)), Math.sin(a) * rad);
    const mat = k.material({ color: "#3d7bd9", emissive: "#3d7bd9", emissiveIntensity: 0.2, roughness: 0.4 });
    const m = new THREE.Mesh(k.cylinder, mat);
    m.scale.set(0.2, 0.45, 0.2);
    m.position.copy(p).add(v(0, 0.2, 0));
    group.add(m);
    recs.push({ p: p.clone().add(v(0, 0.48, 0)), m, mat });
  }
  const pumps: { p: V3; plug: THREE.Mesh }[] = [];
  const pumpMat = k.material({ color: "#3fae8f", roughness: 0.4 });
  const drugMat = k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.5 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const p = v(Math.cos(a) * 2.6, 3.6 - 0.7 * Math.sqrt(16 - 2.6 * 2.6) + 0.05, Math.sin(a) * 2.6);
    const m = new THREE.Mesh(k.cylinder, pumpMat);
    m.scale.set(0.28, 0.5, 0.28);
    m.position.copy(p);
    group.add(m);
    const plug = new THREE.Mesh(k.sphere, drugMat);
    plug.scale.setScalar(0.24);
    plug.position.copy(p).add(v(0, -0.35, 0));
    group.add(plug);
    pumps.push({ p: p.clone().add(v(0, -0.3, 0)), plug });
  }
  // Transmitter molecules.
  const molMat = k.material({ color: "#ffd23f", emissive: "#ffb000", emissiveIntensity: 0.6 });
  const mols = Array.from({ length: 36 }, (_, i) => {
    const m = new THREE.Mesh(k.sphere, molMat);
    m.scale.setScalar(0.13);
    group.add(m);
    return { m, phase: i / 36, rec: recs[i % recs.length], pump: pumps[i % pumps.length], wander: v(r() - 0.5, r() - 0.5, r() - 0.5) };
  });
  const release = v(0, 0.9, 0);
  k.label(k.anchor(group, v(-3.2, 3.2, 1)), "ნეირონის დაბოლოება", { stages: [0, 1, 2] });
  k.label(k.anchor(group, v(3.6, -0.6, 1)), "მეორე ნეირონი", { stages: [0, 1, 2] });
  k.label(k.anchor(group, recs[0].p), "რეცეპტორი", { stages: [0, 2] });
  k.label(k.anchor(group, pumps[0].p), "ტუმბო (უკუშეწოვა)", { stages: [0, 1] });
  k.label(k.anchor(group, v(0, 0.3, 3)), "სინაფსური ნაპრალი", { stages: [0] });
  k.label(k.anchor(group, pumps[1].p.clone().add(v(0, -0.3, 0))), "ნარკოტიკი ბლოკავს ტუმბოს", { stages: [1] });
  let mode = 0;
  const p = new THREE.Vector3();
  const update = (t: number, u: number) => {
    pumps.forEach((x) => (x.plug.visible = mode >= 1));
    // Fewer receptors once the brain adapts.
    recs.forEach((x, i) => {
      const gone = mode === 2 && i % 2 === 1 ? ease((u - 0.2) / 0.5) : 0;
      x.m.scale.set(0.2 * (1 - gone), 0.45 * (1 - gone), 0.2 * (1 - gone));
    });
    let bound = 0;
    mols.forEach((m, i) => {
      const f = (t / 5 + m.phase) % 1;
      if (mode === 0) {
        if (f < 0.3) p.lerpVectors(release, m.rec.p, ease(f / 0.3));
        else if (f < 0.5) p.copy(m.rec.p);
        else p.lerpVectors(m.rec.p, m.pump.p, ease((f - 0.5) / 0.5));
        if (f >= 0.3 && f < 0.5) bound++;
      } else {
        // Pumps blocked: transmitter stays in the cleft, hitting receptors again and again.
        const w = Math.sin(t * 0.8 + i) * 0.5 + 0.5;
        p.lerpVectors(release, m.rec.p, w).add(m.wander.clone().multiplyScalar(2.5 * Math.sin(t * 0.5 + i)));
        p.y = THREE.MathUtils.clamp(p.y, -1, 0.9);
        if (w > 0.85) bound++;
      }
      m.m.position.copy(p);
      m.m.visible = mode > 0 || f > 0.02;
    });
    recs.forEach((x) => (x.mat.emissiveIntensity = 0.2 + (mode === 0 ? 0.4 * Math.min(1, bound / 6) : 0.9)));
  };
  return {
    stages: [
      { duration: 16, enter: () => (mode = 0), update: (u, s, t) => (update(t, u), orbit(v(0, 0.8, 0), 14, s, { start: 0.3, speed: 0.04, height: 0.12 })) },
      { duration: 16, enter: () => (mode = 1), update: (u, s, t) => (update(t, u), orbit(v(0, 0.8, 0), 14, s, { start: 0.6, speed: 0.04, height: 0.14 })) },
      { duration: 16, enter: () => (mode = 2), update: (u, s, t) => (update(t, u), orbit(v(0, 0.2, 0), 14, s, { start: 0.9, speed: 0.04, height: 0.3 })) },
    ],
  };
};

// ---- 8 4.4 Exercise -----------------------------------------------------------------------------

export const exercise: Builder = async (k) => {
  const body = await k.body(false);
  // Heart, beating faster.
  const heartG = new THREE.Group();
  k.root.add(heartG);
  const hm = layer(k, body, heartG, (p) => p.group === "heart" && /^Wall/.test(p.name), k.material({ color: "#b3363d", roughness: 0.42, clearcoat: 0.5, sheen: 0.4, sheenColor: new THREE.Color("#ffb3b3") }));
  layer(k, body, heartG, (p) => p.group === "arteries" && /aorta|carotid|subclavian/i.test(p.name) && !/abdominal|descending/i.test(p.name), k.material({ color: "#c9343a", roughness: 0.4 }));
  layer(k, body, heartG, (p) => p.group === "veins" && !/inferior/i.test(p.name), k.material({ color: "#4062b0", roughness: 0.4 }));
  const hc = hm.geometry.boundingBox!.getCenter(new THREE.Vector3());
  const bpm = k.label(k.anchor(heartG, hc.clone().add(v(0.07, 0.04, 0))), "♥ 70 / წთ", { kind: "tag", stages: [0] });
  // Arm lifting a weight.
  const armG = new THREE.Group();
  k.root.add(armG);
  context(k, body, armG, 0, 0.2, ["humerus", "radius", "ulna"]);
  const arm = armRig(k, body, armG);
  arm.load.visible = true;
  k.label(arm.labels.biceps, "კუნთი მუშაობს — ძლიერდება", { stages: [1] });
  // Lungs breathing.
  const lungG = new THREE.Group();
  k.root.add(lungG);
  context(k, body, lungG, 0.06, 0.25);
  const lungs = layer(k, body, lungG, (p) => p.group === "lungs", k.material({ color: "#e8a0a4", roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color("#ffd8d8"), transparent: true, opacity: 0.9 }), 1);
  const lc = lungs.geometry.boundingBox!.getCenter(new THREE.Vector3());
  lungs.geometry.translate(-lc.x, -lc.y, -lc.z);
  lungs.position.copy(lc);
  const rate = k.label(k.anchor(lungG, lc.clone().add(v(0.13, 0.1, 0))), "16 სუნთქვა / წთ", { kind: "tag", stages: [2] });
  const show = (i: number) => {
    heartG.visible = i === 0;
    armG.visible = i === 1;
    lungG.visible = i === 2;
  };
  let beatPhase = 0;
  let breathPhase = 0;
  return {
    stages: [
      {
        duration: 15,
        enter: () => show(0),
        update: (u, s, t, dt) => {
          const hr = 70 + 80 * ease((u - 0.15) / 0.6);
          beatPhase += (dt * hr) / 60;
          const b = Math.max(0, Math.sin(beatPhase * Math.PI * 2)) ** 4;
          hm.scale.setScalar(1);
          heartG.scale.setScalar(1 - 0.05 * b);
          heartG.position.copy(hc).multiplyScalar(0.05 * b);
          setText(bpm, `♥ ${Math.round(hr)} / წთ`);
          void t;
          return orbit(hc, 0.3, s, { start: 0.2, speed: 0.08, height: 0.12 });
        },
      },
      {
        duration: 16,
        cut: true,
        enter: () => show(1),
        update: (_u, s) => {
          const f = (s % 3) / 3;
          const c = f < 0.5 ? ease(f / 0.5) : 1 - ease((f - 0.5) / 0.5);
          arm.pose(110 * c, { biceps: c > 0.05 ? 0.4 + 0.6 * c : 0, triceps: 0 });
          return armShot(1.3, v(-0.2, 1.13, 0.07));
        },
      },
      {
        duration: 15,
        cut: true,
        enter: () => show(2),
        update: (u, s, _t, dt) => {
          const br = 16 + 24 * ease((u - 0.15) / 0.6);
          breathPhase += (dt * br) / 60;
          const depth = 0.03 + 0.06 * ease((u - 0.15) / 0.6);
          const b = 0.5 - 0.5 * Math.cos(breathPhase * Math.PI * 2);
          lungs.scale.set(1 + depth * b, 1 + depth * 1.3 * b, 1 + depth * b);
          setText(rate, `${Math.round(br)} სუნთქვა / წთ`);
          return orbit(lc, 0.75, s, { start: 0.1, speed: 0.04, height: 0.1 });
        },
      },
    ],
  };
};
