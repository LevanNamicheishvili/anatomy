import * as THREE from "three";
import { armRig, armShot } from "@/components/journeys/journey-arm";
import { beads, context, curve, layer, orbit } from "@/components/journeys/common";
import { ease, rng, v, type Builder, type Kit, type Shot, type V3 } from "@/components/journeys/JourneyScene";
import { fish, fox } from "./nature";

/*
 * Nervous system and senses: neurons and nerves, the impulse and myelin, a withdrawal reflex on the atlas
 * arm, central and peripheral systems with sympathetic/parasympathetic control of the heart, Pavlov's dog,
 * nervous systems across animals, analysers to the brain's cortex, the eye's refraction and its defects,
 * eye care, the ear, and hearing loss.
 */

const setText = (el: HTMLDivElement, text: string) => {
  const t = el.querySelector(".blood-label-text") ?? el;
  if (t.textContent !== text) t.textContent = text;
};
const lab = (k: Kit, c = "#0f1218") => k.mood(c, 25, 60);
const front = (s: number, d: number, at = v(0, 0, 0), h = 0.18, side = 0): Shot => orbit(at, d, 0, { start: side + Math.sin(s * 0.15) * 0.18, height: h });
const tag = (k: Kit, parent: THREE.Object3D, p: V3, text: string, stages?: number[]) => k.label(k.anchor(parent, p), text, { kind: "tag", stages });
const L = (k: Kit, parent: THREE.Object3D, p: V3, text: string, stages?: number[]) => k.label(k.anchor(parent, p), text, { stages });

/** A neuron: soma, dendrites, axon with myelin segments and branching terminals; axon along +x. */
function neuron(k: Kit, o: { len?: number; color?: string; myelin?: boolean; seed?: number } = {}) {
  const g = new THREE.Group();
  const r = rng(o.seed ?? 1);
  const len = o.len ?? 8;
  const mat = k.material({ color: o.color ?? "#b49ad6", roughness: 0.4, clearcoat: 0.5, normalMap: k.normalMap("organic", [2, 2]), emissive: o.color ?? "#b49ad6", emissiveIntensity: 0.08 });
  const soma = new THREE.Mesh(k.sphere, mat);
  soma.scale.set(0.7, 0.6, 0.6);
  g.add(soma);
  const nuc = new THREE.Mesh(k.sphere, k.material({ color: "#5a3d8a" }));
  nuc.scale.setScalar(0.25);
  g.add(nuc);
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 0.5 + (i / 6) * Math.PI + (r() - 0.5) * 0.3;
    const d = v(Math.cos(a), Math.sin(a) * 1.2, (r() - 0.5) * 0.8).normalize();
    const p1 = d.clone().multiplyScalar(0.6);
    const p2 = d.clone().multiplyScalar(1.5).add(v(0, (r() - 0.5) * 0.5, (r() - 0.5) * 0.5));
    const p3 = d.clone().multiplyScalar(2.3).add(v((r() - 0.5) * 0.6, (r() - 0.5) * 0.6, 0));
    k.tube([p1, p2, p3], (t) => 0.1 * (1 - 0.75 * t), mat, g, 16, 6);
  }
  const axon = k.tube([v(0.6, 0, 0), v(len * 0.5, 0.1, 0), v(len, 0, 0)], 0.08, mat, g, 40, 8);
  const sheaths: THREE.Mesh[] = [];
  if (o.myelin !== false) {
    const myelin = k.material({ color: "#f1e6cf", roughness: 0.35, clearcoat: 0.6 });
    for (let x = 1.2; x < len - 0.6; x += 0.9) {
      const m = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.2, 0.55, 6, 14).rotateZ(Math.PI / 2)), myelin);
      m.position.set(x + 0.35, 0.05, 0);
      g.add(m);
      sheaths.push(m);
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 4 - 0.5) * 1.6;
    const end = v(len + 0.9 * Math.cos(a), 0.9 * Math.sin(a), 0);
    k.tube([v(len, 0, 0), v(len + 0.4, 0.4 * Math.sin(a), 0), end], 0.05, mat, g, 10, 6);
    const b = new THREE.Mesh(k.sphere, mat);
    b.position.copy(end);
    b.scale.setScalar(0.13);
    g.add(b);
  }
  return { g, axon: axon.curve, sheaths, mat };
}

// ---- 9 1.2 Neuron types and nerves -------------------------------------------------------------------

export const neuronTypes: Builder = async (k) => {
  lab(k);
  const one = new THREE.Group();
  k.root.add(one);
  const n = neuron(k, { len: 8 });
  n.g.position.x = -4;
  one.add(n.g);
  tag(k, one, v(-4, 1.2, 0), "სხეული", [0]);
  tag(k, one, v(-5.6, 2.2, 0), "დენდრიტები", [0]);
  tag(k, one, v(0, 0.7, 0), "აქსონი — მიელინის გარსით", [0]);
  tag(k, one, v(4.6, 1.2, 0), "დაბოლოებები", [0]);
  const pulse = beads(k, one, curve(n.axon.getPoints(10).map((p) => p.clone().add(v(-4, 0, 0)))), { n: 2, color: "#ffd23f", size: 0.22, speed: 0.4, emissive: 1.5 });
  // Three types in a chain: skin → sensory → interneuron → motor → muscle.
  const chain = new THREE.Group();
  k.root.add(chain);
  const sens = neuron(k, { len: 5, color: "#6fb0e0", seed: 2 });
  sens.g.position.set(-7, 1.5, 0);
  const inter = neuron(k, { len: 2, color: "#f2c230", myelin: false, seed: 3 });
  inter.g.position.set(-0.6, 0, 0);
  const motor = neuron(k, { len: 5, color: "#e0524a", seed: 4 });
  motor.g.position.set(2.6, -1.5, 0);
  chain.add(sens.g, inter.g, motor.g);
  const muscle = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.6, 2, 8, 16).rotateZ(Math.PI / 2)), k.material({ color: "#b5524a", roughness: 0.45, normalMap: k.normalMap("fibre", [2, 1]) }));
  muscle.position.set(9.5, -1.5, 0);
  const skin = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.4, 2, 2)), k.material({ color: "#e8b79e", roughness: 0.6 }));
  skin.position.set(-9.8, 1.5, 0);
  chain.add(muscle, skin);
  const route = curve([v(-9.6, 1.5, 0), v(-7, 1.5, 0), v(-2, 1.5, 0), v(-0.6, 0.2, 0), v(1.4, 0, 0), v(2.6, -1.5, 0), v(7.6, -1.5, 0), v(9, -1.5, 0)]);
  const sig = beads(k, chain, route, { n: 3, color: "#ffd23f", size: 0.25, speed: 0.25, emissive: 1.5 });
  tag(k, chain, v(-7, 3, 0), "მგრძნობიარე", [1]);
  tag(k, chain, v(-0.6, 1.4, 0), "ჩანართი", [1]);
  tag(k, chain, v(2.6, -0.1, 0), "მამოძრავებელი", [1]);
  tag(k, chain, v(-9.8, 2.9, 0), "კანი", [1]);
  tag(k, chain, v(9.5, -0.4, 0), "კუნთი", [1]);
  // A nerve, cut across.
  const nerve = new THREE.Group();
  k.root.add(nerve);
  const r = rng(9);
  const sheath = new THREE.Mesh(k.track(new THREE.CylinderGeometry(2.6, 2.6, 6, 48, 1, true)), k.ghost("#e8d8c0", 0.35, { side: THREE.DoubleSide }));
  sheath.rotation.z = Math.PI / 2;
  nerve.add(sheath);
  const ax = new THREE.InstancedMesh(k.track(new THREE.CylinderGeometry(0.12, 0.12, 6.4, 10)), k.material({ color: "#c9b6ea", roughness: 0.4 }), 160);
  const my = new THREE.InstancedMesh(k.track(new THREE.CylinderGeometry(0.2, 0.2, 6.2, 12, 1, true)), k.material({ color: "#f1e6cf", roughness: 0.4, side: THREE.DoubleSide }), 160);
  const m4 = new THREE.Matrix4();
  const fasc = [v(0, 1, 0.6), v(0, -1, 0.9), v(0, 0.2, -1.2)];
  let idx = 0;
  for (const f of fasc) {
    const fs = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.05, 1.05, 6.1, 32, 1, true)), k.ghost("#d9c0a0", 0.4, { side: THREE.DoubleSide }));
    fs.rotation.z = Math.PI / 2;
    fs.position.copy(f);
    nerve.add(fs);
    for (let i = 0; i < 50 && idx < 160; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 0.85;
      m4.compose(v(0, f.y + Math.cos(a) * d, f.z + Math.sin(a) * d), new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), Math.PI / 2), v(1, 1, 1));
      ax.setMatrixAt(idx, m4);
      my.setMatrixAt(idx, m4);
      idx++;
    }
  }
  ax.count = my.count = idx;
  nerve.add(ax, my);
  k.tube([v(-3, 1.9, -1.6), v(0, 2.1, -1.7), v(3, 1.8, -1.5)], 0.18, k.material({ color: "#c62f36" }), nerve, 16, 8);
  tag(k, nerve, v(3.3, 1, 0.6), "აქსონები მიელინით", [2]);
  tag(k, nerve, v(3.3, -1, 0.9), "კონა", [2]);
  tag(k, nerve, v(3.3, 2.7, 0), "გარსი", [2]);
  tag(k, nerve, v(-3, 2.3, -1.6), "სისხლძარღვი", [2]);
  const groups = [one, chain, nerve];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => groups.forEach((x, j) => (x.visible = i === j)),
      update: (_u: number, s: number, t: number) => {
        pulse.update(t);
        sig.update(t);
        return i === 2 ? orbit(v(0, 0, 0), 10, s, { start: 1.0, speed: 0.04, height: 0.2 }) : front(s, i === 1 ? 17 : 12, v(0, 0.3, 0), 0.15);
      },
    })),
  };
};

// ---- 12 Impulse and myelin ---------------------------------------------------------------------------

export const impulseMyelin: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const n = neuron(k, { len: 9 });
  n.g.position.x = -4.5;
  g.add(n.g);
  const hill = new THREE.Mesh(k.sphere, k.material({ color: "#ffd23f", emissive: "#ffb000", emissiveIntensity: 0.6 }));
  hill.scale.setScalar(0.25);
  hill.position.set(-3.8, 0, 0);
  g.add(hill);
  tag(k, g, v(-3.8, 0.7, 0), "აქსონის ბორცვი — აქ იწყება იმპულსი", [0]);
  // Membrane patch with ions and a pump.
  const mem = new THREE.Group();
  k.root.add(mem);
  const lipid = new THREE.Mesh(k.track(new THREE.BoxGeometry(10, 0.5, 4)), k.material({ color: "#f2d9a0", roughness: 0.4, normalMap: k.normalMap("organic", [10, 4]) }));
  mem.add(lipid);
  const r = rng(3);
  const ion = (color: string, y0: number, y1: number, n0: number) =>
    Array.from({ length: n0 }, () => {
      const m = new THREE.Mesh(k.sphere, k.material({ color, emissive: color, emissiveIntensity: 0.4 }));
      m.scale.setScalar(0.16);
      m.position.set((r() - 0.5) * 9, y0 + r() * (y1 - y0), (r() - 0.5) * 3.6);
      mem.add(m);
      return { m, base: m.position.clone() };
    });
  const na = ion("#f2c230", 0.6, 2.4, 40);
  const kk = ion("#7a5ad0", -2.4, -0.6, 40);
  const pump = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 16)), k.material({ color: "#3fae8f", roughness: 0.4 }));
  mem.add(pump);
  tag(k, mem, v(-4.6, 2.8, 0), "გარეთ: Na⁺ ბევრი, „+“", [1]);
  tag(k, mem, v(-4.6, -2.8, 0), "შიგნით: K⁺, „−“ (−70 მვ)", [1]);
  tag(k, mem, v(0, 1.2, 0), "Na⁺/K⁺ ტუმბო", [1]);
  // Myelinated vs bare axon, impulse racing.
  const race = new THREE.Group();
  k.root.add(race);
  const fast = neuron(k, { len: 12, seed: 5 });
  fast.g.position.set(-6, 1.4, 0);
  const slow = neuron(k, { len: 12, myelin: false, seed: 6 });
  slow.g.position.set(-6, -1.4, 0);
  race.add(fast.g, slow.g);
  const glowMat = k.material({ color: "#fff2b0", emissive: "#ffd23f", emissiveIntensity: 2 });
  const fastGlow = new THREE.Mesh(k.sphere, glowMat);
  const slowGlow = new THREE.Mesh(k.sphere, glowMat);
  fastGlow.scale.setScalar(0.3);
  slowGlow.scale.setScalar(0.3);
  race.add(fastGlow, slowGlow);
  tag(k, race, v(0, 2.4, 0), "მიელინით — ნახტომებით, სწრაფად", [2]);
  tag(k, race, v(0, -0.4, 0), "მიელინის გარეშე — ნელა", [2]);
  const groups = [g, mem, race];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => groups.forEach((x, j) => (x.visible = i === j)),
      update: (_u: number, s: number, t: number) => {
        (hill.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.4 + 0.5 * Math.abs(Math.sin(t * 3));
        na.forEach((x, j) => x.m.position.set(x.base.x + Math.sin(t + j) * 0.15, x.base.y + Math.cos(t * 1.3 + j) * 0.1, x.base.z));
        kk.forEach((x, j) => x.m.position.set(x.base.x + Math.sin(t * 0.9 + j) * 0.15, x.base.y + Math.cos(t * 1.1 + j) * 0.1, x.base.z));
        pump.rotation.y = t * 2;
        // Fast: hops node to node; slow: creeps.
        const nodes = fast.sheaths.length;
        const hop = Math.floor((t * 4) % (nodes + 1));
        fastGlow.position.set(-6 + 1.2 + hop * 0.9, 1.45, 0.3);
        slowGlow.position.set(-6 + 0.6 + ((t * 0.9) % 11.4), -1.4, 0.3);
        return front(s, i === 1 ? 11 : 14, v(0, 0, 0), 0.15);
      },
    })),
  };
};

// ---- 9 1.3 Reflex on the arm ----------------------------------------------------------------------------

export const reflexHand: Builder = async (k) => {
  const body = await k.body(false);
  k.mood("#0e1416", 3, 8);
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.06, 0.18, ["humerus", "radius", "ulna"]);
  const arm = armRig(k, body, g);
  const spine = body.data.spine.map(([x, y, z]) => v(x, y, z));
  k.tube([v(0.003, 1.572, -0.033), ...spine.slice(0, 21)], (t) => 0.0062 - 0.0022 * t, k.ghost("#efe1c2", 0.6), g, 120, 12);
  // Hot plate under the hand.
  const plate = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 32)), k.material({ color: "#c0392b", emissive: "#ff5a1a", emissiveIntensity: 0.8, roughness: 0.3 }));
  plate.position.set(-0.24, 0.755, 0.02);
  g.add(plate);
  const horn = spine[5].clone().add(v(-0.002, 0, 0.002));
  const sensPath = curve([v(-0.25, 0.79, 0.02), v(-0.24, 0.95, 0.0), v(-0.205, 1.12, 0.0), v(-0.17, 1.3, -0.01), v(-0.13, 1.4, -0.015), v(-0.07, 1.45, -0.03), v(-0.025, 1.47, -0.045), horn.clone().add(v(0, 0, -0.004))]);
  const motPath = curve([horn, v(-0.03, 1.466, -0.035), v(-0.08, 1.44, -0.02), v(-0.135, 1.395, -0.012), v(-0.17, 1.32, -0.004), v(-0.188, 1.248, 0.01)]);
  k.tube(sensPath.getPoints(50), 0.0015, k.material({ color: "#6fb0e0", emissive: "#6fb0e0", emissiveIntensity: 0.3 }), g, 100, 6);
  k.tube(motPath.getPoints(40), 0.0018, k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.3 }), g, 80, 6);
  const glow = new THREE.Mesh(k.sphere, k.material({ color: "#fff2b0", emissive: "#ffd23f", emissiveIntensity: 2 }));
  glow.scale.setScalar(0.005);
  g.add(glow);
  L(k, g, v(-0.25, 0.77, 0.06), "ცხელი ზედაპირი", [0]);
  L(k, g, v(-0.24, 0.95, 0.02), "მგრძნობიარე ნეირონი", [1]);
  L(k, g, horn, "ზურგის ტვინი — ჩანართი ნეირონი", [1, 2]);
  L(k, g, v(-0.17, 1.32, 0.0), "მამოძრავებელი ნეირონი", [2]);
  k.label(arm.labels.biceps, "კუნთი იკუმშება", { stages: [2] });
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 14,
      update: (u: number, s: number) => {
        let p = v(-0.25, 0.79, 0.02);
        if (i === 1) p = sensPath.getPointAt(ease(u / 0.85));
        if (i === 2) p = motPath.getPointAt(ease(Math.min(1, u / 0.45)));
        glow.position.copy(p);
        glow.visible = !(i === 2 && u > 0.45);
        (plate.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.6 + 0.3 * Math.sin(s * 6);
        const lift = i === 2 ? ease((u - 0.45) / 0.2) : 0;
        arm.pose(70 * lift, { biceps: lift, triceps: 0 });
        if (i === 1) return { target: v(-0.12, 1.2, -0.02), pos: v(-0.12, 1.2, -0.02).add(v(-0.5, 0.15, 0.55)) };
        return armShot(i === 0 ? 0.8 : 1.3, i === 0 ? v(-0.24, 0.85, 0.03) : v(-0.18, 1.15, 0.03));
      },
    })),
  };
};

// ---- 9 1.7 Peripheral nervous system -----------------------------------------------------------------

export const peripheral: Builder = async (k) => {
  const body = await k.body({ brain: true });
  k.mood("#0e1416", 3, 9);
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.05, 0.12);
  const cnsMat = k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0.35 });
  layer(k, body, g, (p) => p.group === "brain", cnsMat, 1);
  const spine = body.data.spine.map(([x, y, z]) => v(x, y, z));
  k.tube([v(0.003, 1.572, -0.033), ...spine.slice(0, 21)], (t) => 0.007 - 0.0025 * t, cnsMat, g, 120, 12);
  // Peripheral nerves: a pair at each level, plus the big limb nerves.
  const pnsMat = k.material({ color: "#e08a3a", emissive: "#e08a3a", emissiveIntensity: 0.25 });
  spine.slice(0, 21).forEach((p) => {
    for (const s of [-1, 1]) k.tube([p, p.clone().add(v(s * 0.03, -0.01, 0.01)), p.clone().add(v(s * 0.08, -0.03, 0.04))], 0.0012, pnsMat, g, 8, 4);
  });
  const limbs = [
    [spine[5], v(-0.09, 1.43, -0.02), v(-0.17, 1.3, -0.01), v(-0.22, 1.05, 0.0), v(-0.25, 0.85, 0.02)],
    [spine[5], v(0.09, 1.43, -0.02), v(0.17, 1.3, -0.01), v(0.22, 1.05, 0.0), v(0.25, 0.85, 0.02)],
    [spine[20], v(-0.04, 1.0, -0.02), v(-0.08, 0.8, -0.01), v(-0.09, 0.45, -0.01), v(-0.09, 0.1, 0.0)],
    [spine[20], v(0.04, 1.0, -0.02), v(0.08, 0.8, -0.01), v(0.09, 0.45, -0.01), v(0.09, 0.1, 0.0)],
  ];
  limbs.forEach((pts) => k.tube(pts, 0.0025, pnsMat, g, 60, 6));
  const legSig = beads(k, g, curve(limbs[2]), { n: 3, color: "#ffd23f", size: 0.006, speed: 0.35, emissive: 1.5 });
  // Heart and vagus nerve.
  const heartMat = k.material({ color: "#b3363d", roughness: 0.42, clearcoat: 0.5 });
  const heart = layer(k, body, g, (p) => p.group === "heart" && /^Wall/.test(p.name), heartMat, 1);
  const hc = heart.geometry.boundingBox!.getCenter(new THREE.Vector3());
  heart.geometry.translate(-hc.x, -hc.y, -hc.z);
  heart.position.copy(hc);
  const vagus = curve([v(0.0, 1.57, -0.03), v(0.02, 1.5, -0.01), v(0.025, 1.4, 0.0), hc.clone().add(v(0.0, 0.03, 0))]);
  const vagMat = k.material({ color: "#6fb0e0", emissive: "#6fb0e0", emissiveIntensity: 0.4 });
  k.tube(vagus.getPoints(30), 0.002, vagMat, g, 60, 6);
  const symp = curve([spine[9], spine[9].clone().add(v(-0.03, -0.01, 0.03)), hc.clone().add(v(-0.03, 0.01, 0))]);
  k.tube(symp.getPoints(20), 0.002, k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.4 }), g, 40, 6);
  const vSig = beads(k, g, vagus, { n: 3, color: "#9fd0f0", size: 0.005, speed: 0.4, emissive: 1.5 });
  const sSig = beads(k, g, symp, { n: 3, color: "#ff8a6a", size: 0.005, speed: 0.6, emissive: 1.5 });
  L(k, g, v(0.0, 1.66, 0.0), "თავის ტვინი", [0]);
  L(k, g, spine[12], "ზურგის ტვინი", [0]);
  L(k, g, v(0.17, 1.3, -0.01), "ნერვები — პერიფერიული სისტემა", [0]);
  L(k, g, v(-0.09, 0.45, 0.0), "სომატური: კუნთისკენ", [1]);
  L(k, g, v(0.025, 1.42, 0.01), "ცთომილი ნერვი — პარასიმპათიკური", [2]);
  const bpm = tag(k, g, hc.clone().add(v(0.09, 0.05, 0)), "", [2]);
  let ph = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number, dt: number) => {
        legSig.update(t, i === 1 ? 1 : 0);
        const sympOn = i === 2 && u < 0.5;
        vSig.update(t, i === 2 && !sympOn ? 1 : 0);
        sSig.update(t, sympOn ? 1 : 0);
        const rate = i === 2 ? (sympOn ? 70 + 50 * ease(u / 0.3) : 120 - 55 * ease((u - 0.5) / 0.3)) : 70;
        ph += (dt * rate) / 60;
        heart.scale.setScalar(1 - 0.05 * Math.max(0, Math.sin(ph * Math.PI * 2)) ** 4);
        setText(bpm, `${sympOn ? "სიმპათიკური" : "პარასიმპათიკური"}: ♥ ${Math.round(rate)}/წთ`);
        if (i === 2) return orbit(v(0.01, 1.4, 0), 0.6, s, { start: 0.4, speed: 0.03, height: 0.05 });
        return orbit(v(0, 0.95, 0), 2.2, s, { start: 0.3, speed: 0.03, height: 0.05 });
      },
    })),
  };
};

// ---- 9 1.8 Pavlov --------------------------------------------------------------------------------------

export const pavlov: Builder = async (k) => {
  k.mood("#e7eef0", 20, 50);
  const g = new THREE.Group();
  k.root.add(g);
  const floor = new THREE.Mesh(k.track(new THREE.CircleGeometry(8, 48).rotateX(-Math.PI / 2)), k.material({ color: "#c9b8a0", roughness: 0.8 }));
  g.add(floor);
  const dog = fox(k);
  dog.g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const mat = m.material as THREE.MeshPhysicalMaterial;
      if (mat.color.getHex() === new THREE.Color("#c8642a").getHex()) mat.color.set("#9a6a3a");
    }
  });
  dog.g.scale.setScalar(3.2);
  dog.g.rotation.y = Math.PI / 2;
  dog.g.position.set(-2, 0, 0);
  g.add(dog.g);
  const bowl = new THREE.Group();
  const b = new THREE.Mesh(k.track(new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), k.material({ color: "#c0392b", roughness: 0.4, side: THREE.DoubleSide }));
  b.position.y = 0.6;
  const food = new THREE.Mesh(k.sphere, k.material({ color: "#8a5a3a", roughness: 0.8 }));
  food.scale.set(0.5, 0.15, 0.5);
  food.position.y = 0.5;
  bowl.add(b, food);
  bowl.position.set(1.5, 0, 0);
  g.add(bowl);
  const bell = new THREE.Group();
  const post = new THREE.Mesh(k.cylinder, k.material({ color: "#6a5a4a" }));
  post.scale.set(0.05, 3, 0.05);
  post.position.y = 1.5;
  const cup = new THREE.Group();
  cup.position.y = 3;
  const bellM = new THREE.Mesh(k.track(new THREE.SphereGeometry(0.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2)), k.material({ color: "#d9a520", metalness: 0.8, roughness: 0.25, side: THREE.DoubleSide }));
  bellM.rotation.x = Math.PI;
  cup.add(bellM);
  bell.add(post, cup);
  bell.position.set(2, 0, -1.5);
  g.add(bell);
  const rings = [0, 1, 2].map(() => {
    const r0 = new THREE.Mesh(k.track(new THREE.TorusGeometry(1, 0.02, 6, 48)), k.material({ color: "#d9a520", emissive: "#d9a520", emissiveIntensity: 0.6, transparent: true }));
    r0.position.set(2, 2.8, -1.5);
    g.add(r0);
    return r0;
  });
  const saliva = beads(k, g, curve([v(-0.25, 2.0, 0.05), v(-0.2, 1.4, 0.05), v(-0.15, 0.6, 0.05), v(-0.1, 0.05, 0.05)]), { n: 8, color: "#bfe0f0", size: 0.06, speed: 0.4, emissive: 0.4 });
  const st = tag(k, g, v(0, 4, 0), "");
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        const cycle = (s % 7.5) / 7.5;
        const ring = i >= 1 && cycle < 0.4;
        const fed = i <= 1 && cycle > 0.35;
        food.visible = fed;
        cup.rotation.z = ring ? Math.sin(t * 25) * 0.4 : 0;
        rings.forEach((r0, j) => {
          r0.visible = ring;
          const f = ((t * 1.5 + j / 3) % 1);
          r0.scale.setScalar(0.3 + f * 1.5);
          (r0.material as THREE.MeshPhysicalMaterial).opacity = 1 - f;
        });
        const drool = i === 0 ? fed : i === 1 ? fed : cycle > 0.15 && cycle < 0.8;
        saliva.update(t, drool ? 1 : 0);
        dog.move(fed ? t * 3 : 0);
        setText(st, i === 0 ? "საკვები → ნერწყვი (უპირობო)" : i === 1 ? "ზარი + საკვები — ბევრჯერ" : "მხოლოდ ზარი → ნერწყვი (პირობითი)");
        void u;
        return front(s, 9, v(0, 1.4, 0), 0.25, 0.2);
      },
    })),
  };
};

// ---- 12 Nervous system evolution ---------------------------------------------------------------------

export const nerveEvolution: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(2);
  const nerveMat = k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0.5 });
  // Hydra: a cylinder with tentacles and a net of nerves on its surface.
  const hydra = new THREE.Group();
  const hb = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.5, 0.35, 3, 24, 1, true)), k.ghost("#a8d8a0", 0.45, { side: THREE.DoubleSide }));
  hb.position.y = 1.5;
  hydra.add(hb);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    k.tube([v(Math.cos(a) * 0.45, 3, Math.sin(a) * 0.45), v(Math.cos(a) * 1, 3.8, Math.sin(a) * 1), v(Math.cos(a) * 1.4, 3.4 + Math.sin(i) * 0.3, Math.sin(a) * 1.4)], (t) => 0.08 * (1 - 0.7 * t), k.ghost("#a8d8a0", 0.6), hydra, 16, 6);
  }
  const pts = Array.from({ length: 40 }, () => {
    const a = r() * Math.PI * 2;
    const y = r() * 3;
    const rad = 0.5 - 0.15 * (1 - y / 3);
    return v(Math.cos(a) * rad, y, Math.sin(a) * rad);
  });
  pts.forEach((p, i) => {
    const q = pts.map((x, j) => ({ j, d: x.distanceTo(p) })).filter((x) => x.j !== i).sort((a, b) => a.d - b.d)[0];
    k.tube([p, pts[q.j]], 0.015, nerveMat, hydra, 2, 4);
  });
  hydra.position.set(-6, -1.5, 0);
  g.add(hydra);
  // Earthworm: ventral cord with ganglia.
  const worm = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const sg = new THREE.Mesh(k.sphere, k.ghost("#c47a7a", 0.35));
    sg.scale.set(0.32, 0.35, 0.32);
    sg.position.x = -2.6 + i * 0.42;
    worm.add(sg);
    const gang = new THREE.Mesh(k.sphere, nerveMat);
    gang.scale.setScalar(0.09);
    gang.position.set(-2.6 + i * 0.42, -0.2, 0);
    worm.add(gang);
  }
  k.tube([v(-2.6, -0.2, 0), v(3, -0.2, 0)], 0.03, nerveMat, worm, 10, 6);
  const head = new THREE.Mesh(k.sphere, nerveMat);
  head.scale.setScalar(0.15);
  head.position.set(-2.75, 0.15, 0);
  worm.add(head);
  worm.position.set(0, 0, 0);
  g.add(worm);
  // Vertebrate: a fish with brain and spinal cord along its back.
  const fsh = fish(k, "#7a90a0");
  fsh.g.scale.setScalar(9);
  fsh.g.rotation.y = -Math.PI / 2;
  fsh.g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      const mat = (m.material as THREE.MeshPhysicalMaterial).clone();
      mat.transparent = true;
      mat.opacity = 0.35;
      mat.depthWrite = false;
      m.material = k.track(mat);
    }
  });
  const vert = new THREE.Group();
  vert.add(fsh.g);
  const brain = new THREE.Mesh(k.sphere, nerveMat);
  brain.scale.set(0.35, 0.25, 0.25);
  brain.position.set(-1.8, 0.5, 0);
  vert.add(brain);
  k.tube([v(-1.6, 0.5, 0), v(0, 0.6, 0), v(2.2, 0.4, 0), v(3.6, 0.2, 0)], (t) => 0.08 * (1 - 0.6 * t), nerveMat, vert, 30, 8);
  vert.position.set(6.5, 0, 0);
  g.add(vert);
  tag(k, g, v(-6, 3.2, 0), "ჰიდრა — დიფუზური ბადე", [0]);
  tag(k, g, v(0, 1, 0), "ჭიაყელა — ნერვული ჯაჭვი და განგლიები", [1]);
  tag(k, g, v(6.5, 1.8, 0), "თევზი — თავის და ზურგის ტვინი", [2]);
  const focus = [v(-6, 0.3, 0), v(0, 0, 0), v(6.5, 0.3, 0)];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (_u: number, s: number, t: number) => {
        nerveMat.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 3);
        fsh.move(t);
        return orbit(focus[i], 8, s, { start: 0.4, speed: 0.04, height: 0.3 });
      },
    })),
  };
};

// ---- 9 2.1 Analysers --------------------------------------------------------------------------------

export const analyzers: Builder = async (k) => {
  const body = await k.body({ brain: true });
  k.mood("#0e1416", 3, 8);
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.08, 0.1);
  layer(k, body, g, (p) => p.group === "brain" && !/occipital|temporal gyrus|postcentral/i.test(p.name), k.ghost("#e8c7c0", 0.3), 3);
  const zone = (re: RegExp, color: string) => layer(k, body, g, (p) => p.group === "brain" && re.test(p.name), k.material({ color, emissive: color, emissiveIntensity: 0.3 }), 1);
  const occ = zone(/occipital lobe/i, "#5b8def");
  const temp = zone(/temporal gyrus/i, "#4bb36b");
  const post = zone(/postcentral/i, "#e0524a");
  const oc = occ.geometry.boundingBox!.getCenter(new THREE.Vector3());
  const tc = temp.geometry.boundingBox!.getCenter(new THREE.Vector3());
  const pc = post.geometry.boundingBox!.getCenter(new THREE.Vector3());
  const eyeMat = k.material({ color: "#f4f6f8", roughness: 0.2, clearcoat: 1 });
  const eyes = [-1, 1].map((sx) => {
    const e = new THREE.Mesh(k.sphere, eyeMat);
    e.scale.setScalar(0.012);
    e.position.set(sx * 0.032, 1.638, 0.075);
    g.add(e);
    const iris = new THREE.Mesh(k.sphere, k.material({ color: "#4a6a3a" }));
    iris.scale.setScalar(0.006);
    iris.position.set(sx * 0.032, 1.638, 0.086);
    g.add(iris);
    return e.position.clone();
  });
  const optic = eyes.map((e) => curve([e, e.clone().add(v(0, -0.01, -0.03)), v(0, 1.618, 0.005), v(Math.sign(e.x) * 0.02, 1.62, -0.04), oc.clone().setX(Math.sign(e.x) * 0.018)]));
  const ear = v(-0.075, 1.62, -0.012);
  const aud = curve([ear, ear.clone().add(v(0.02, 0, 0)), tc.clone().setX(-Math.abs(tc.x))]);
  const hand = v(-0.25, 0.82, 0.02);
  const spine = body.data.spine.map(([x, y, z]) => v(x, y, z));
  const touch = curve([hand, v(-0.21, 1.0, 0.0), v(-0.17, 1.3, -0.01), v(-0.07, 1.45, -0.03), spine[5], spine[1], v(0.0, 1.6, -0.03), pc.clone().setX(Math.abs(pc.x))]);
  const nm = k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0.4 });
  [...optic, aud, touch].forEach((c) => k.tube(c.getPoints(40), 0.0012, nm, g, 80, 5));
  const sigs = [...optic, aud, touch].map((c, i) => beads(k, g, c, { n: 2, color: "#ffd23f", size: 0.004, speed: i === 3 ? 0.25 : 0.5, emissive: 1.5, seed: i + 1 }));
  L(k, g, eyes[0].clone().add(v(-0.01, 0, 0.01)), "თვალი — რეცეპტორი", [0, 1]);
  L(k, g, oc, "კეფის წილი — მხედველობა", [0, 1]);
  L(k, g, ear, "ყური", [1]);
  L(k, g, tc.clone().setX(-Math.abs(tc.x)), "საფეთქლის წილი — სმენა", [1]);
  L(k, g, hand, "კანი", [2]);
  L(k, g, pc.clone().setX(Math.abs(pc.x)), "უკანა ცენტრალური ხვეული — შეხება", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (_u: number, s: number, t: number) => {
        sigs[0].update(t, i <= 1 ? 1 : 0);
        sigs[1].update(t, i <= 1 ? 1 : 0);
        sigs[2].update(t, i === 1 ? 1 : 0);
        sigs[3].update(t, i === 2 ? 1 : 0);
        for (const [m, on] of [
          [occ, i <= 1],
          [temp, i === 1],
          [post, i === 2],
        ] as const)
          (m.material as THREE.MeshPhysicalMaterial).emissiveIntensity = on ? 0.4 + 0.3 * Math.sin(t * 4) : 0.1;
        if (i === 2) return orbit(v(-0.08, 1.25, 0), 1.6, s, { start: -0.5, speed: 0.03, height: 0.1 });
        return orbit(v(0, 1.63, -0.01), 0.42, s, { start: i === 0 ? 0.9 : -1.0, speed: 0.04, height: 0.25 });
      },
    })),
  };
};

// ---- Eye cross-section, rays and lenses -------------------------------------------------------------------

function eyeSection(k: Kit) {
  const g = new THREE.Group();
  const ball = new THREE.Group();
  g.add(ball);
  // The back half of the eyeball (z ≤ 0), so we look into it; the retina lines its rear (+x).
  const sclera = new THREE.Mesh(k.track(new THREE.SphereGeometry(2, 48, 32, Math.PI, Math.PI)), k.material({ color: "#f4f1ea", roughness: 0.45, side: THREE.DoubleSide }));
  const retina = new THREE.Mesh(k.track(new THREE.SphereGeometry(1.93, 48, 32, Math.PI, Math.PI * 0.3, Math.PI * 0.18, Math.PI * 0.64)), k.material({ color: "#d9625a", roughness: 0.5, side: THREE.DoubleSide, emissive: "#d9625a", emissiveIntensity: 0.15 }));
  const vitreous = new THREE.Mesh(k.sphere, k.ghost("#dfeff5", 0.15));
  vitreous.scale.setScalar(1.9);
  ball.add(sclera, retina, vitreous);
  const cornea = new THREE.Mesh(k.track(new THREE.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.35)), k.ghost("#bfe0f0", 0.5, { roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide }));
  cornea.rotation.z = Math.PI / 2;
  cornea.position.x = -1.25;
  const lensMat = k.ghost("#e8f4ff", 0.6, { roughness: 0.05, clearcoat: 1 });
  const lens = new THREE.Mesh(k.sphere, lensMat);
  lens.scale.set(0.3, 0.75, 0.75);
  lens.position.x = -1.1;
  const nerve = new THREE.Mesh(k.cylinder, k.material({ color: "#f2d36b", roughness: 0.5 }));
  nerve.rotation.z = Math.PI / 2;
  nerve.scale.set(0.3, 1.4, 0.3);
  nerve.position.x = 2.6;
  g.add(cornea, lens, nerve);
  // Light rays as lines.
  const rays = [-0.6, -0.3, 0, 0.3, 0.6].map(() => {
    const geo = k.track(new THREE.BufferGeometry().setFromPoints([v(0, 0, 0), v(0, 0, 0), v(0, 0, 0), v(0, 0, 0)]));
    const line = new THREE.Line(geo, k.track(new THREE.LineBasicMaterial({ color: "#ffd23f" })));
    g.add(line);
    return line;
  });
  const focusDot = new THREE.Mesh(k.sphere, k.material({ color: "#fff2b0", emissive: "#ffd23f", emissiveIntensity: 2 }));
  focusDot.scale.setScalar(0.07);
  g.add(focusDot);
  const glasses = new THREE.Mesh(k.sphere, k.ghost("#bfe0f0", 0.45, { roughness: 0.05, clearcoat: 1 }));
  glasses.position.x = -3.2;
  g.add(glasses);
  /** Eye length factor (1 normal) and a corrective lens (−1 concave, +1 convex, 0 none). */
  const set = (length: number, correction: number) => {
    ball.scale.set(length, 1, 1);
    const retinaX = 1.92 * length;
    // Uncorrected the optics focus at 1.92; the right lens moves the focus onto the retina.
    const f = correction ? retinaX : 1.92;
    glasses.visible = correction !== 0;
    glasses.scale.set(0.12 + 0.06 * Math.abs(correction), 0.8, 0.8);
    const spread = correction < 0 ? 1.25 : correction > 0 ? 0.8 : 1;
    rays.forEach((ln, i) => {
      const y0 = [-0.6, -0.3, 0, 0.3, 0.6][i];
      const yL = y0 * spread;
      const yEnd = yL * (1 - (retinaX + 1.45) / (f + 1.45));
      const p = ln.geometry.attributes.position as THREE.BufferAttribute;
      p.setXYZ(0, -6, y0, 0);
      p.setXYZ(1, -3.2, y0, 0);
      p.setXYZ(2, -1.45, yL, 0);
      p.setXYZ(3, retinaX, yEnd, 0);
      p.needsUpdate = true;
    });
    focusDot.position.set(f, 0, 0);
  };
  return { g, set, lens, lensMat, cornea };
}

export const visionDefects: Builder = async (k) => {
  lab(k);
  const eye = eyeSection(k);
  k.root.add(eye.g);
  tag(k, eye.g, v(-1.45, 1.1, 0), "რქოვანა", [0]);
  tag(k, eye.g, v(-1.1, -1.0, 0), "ბროლი", [0]);
  tag(k, eye.g, v(1.9, 1.2, 0), "ბადურა", [0, 1, 2]);
  tag(k, eye.g, v(3.3, 0.4, 0), "მხედველობის ნერვი", [0]);
  const st = tag(k, eye.g, v(0, 2.6, 0), "");
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number) => {
        if (i === 0) {
          eye.set(1, 0);
          setText(st, "ფოკუსი ბადურაზე — მკაფიო");
        }
        if (i === 1) {
          const fix = u > 0.55;
          eye.set(1.2, fix ? -1 : 0);
          setText(st, fix ? "ჩაზნექილი ლინზა — ფოკუსი ბადურაზე" : "ფოკუსი ბადურის წინ — შორს ბუნდოვანი");
        }
        if (i === 2) {
          const fix = u > 0.55;
          eye.set(0.85, fix ? 1 : 0);
          setText(st, fix ? "ამოზნექილი ლინზა — ფოკუსი ბადურაზე" : "ფოკუსი ბადურის უკან — ახლოს ბუნდოვანი");
        }
        return front(s, 10, v(-1.2, 0.3, 0), 0.05);
      },
    })),
  };
};

export const eyeCare: Builder = async (k) => {
  lab(k);
  const eye = eyeSection(k);
  k.root.add(eye.g);
  eye.set(1, 0);
  const newLens = new THREE.Mesh(k.sphere, k.ghost("#f4fbff", 0.7, { roughness: 0.02, clearcoat: 1 }));
  newLens.scale.set(0.3, 0.75, 0.75);
  eye.g.add(newLens);
  const laser = new THREE.Mesh(k.cylinder, k.material({ color: "#ff3a5a", emissive: "#ff1a3a", emissiveIntensity: 2, transparent: true, opacity: 0.8 }));
  laser.rotation.z = Math.PI / 2;
  laser.scale.set(0.04, 4, 0.04);
  laser.position.x = -3.6;
  eye.g.add(laser);
  const screen = new THREE.Group();
  const monitor = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.2, 2.4, 3.6)), k.material({ color: "#22262a", roughness: 0.4 }));
  const glow = new THREE.Mesh(k.track(new THREE.PlaneGeometry(3.3, 2.1)), k.material({ color: "#bfe0ff", emissive: "#8ac0ff", emissiveIntensity: 0.8 }));
  glow.rotation.y = Math.PI / 2;
  glow.position.x = 0.11;
  screen.add(monitor, glow);
  screen.position.x = -8;
  k.root.add(screen);
  const st = tag(k, eye.g, v(0, 2.6, 0), "");
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        eye.lens.visible = !(i === 0 && u > 0.6);
        eye.lensMat.color.set("#e8f4ff").lerp(new THREE.Color("#c9c0a8"), i === 0 ? ease(u / 0.4) : 0);
        eye.lensMat.opacity = i === 0 ? 0.6 + 0.35 * ease(u / 0.4) : 0.6;
        newLens.visible = i === 0 && u > 0.6;
        newLens.position.set(-1.1, 2.5 * (1 - ease((u - 0.6) / 0.3)), 0);
        laser.visible = i === 1 && u > 0.25 && u < 0.7;
        laser.scale.x = 0.04 + 0.02 * Math.sin(t * 40);
        eye.cornea.scale.set(i === 1 ? 1 - 0.25 * ease((u - 0.3) / 0.4) : 1, 1, 1);
        screen.visible = i === 2;
        setText(st, i === 0 ? (u < 0.6 ? "ბროლი იმღვრევა — კატარაქტა" : "ხელოვნური ბროლი") : i === 1 ? "ლაზერი რქოვანას აბრტყელებს" : "20 წუთი ეკრანთან → 20 წამი შორს ყურება");
        return front(s, i === 2 ? 14 : 10, v(i === 2 ? -3 : -1.2, 0.3, 0), 0.08);
      },
    })),
  };
};

// ---- Ear -------------------------------------------------------------------------------------------------

function earModel(k: Kit) {
  const g = new THREE.Group();
  const skin = k.material({ color: "#e8b79e", roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color("#fff") });
  const pinna = new THREE.Mesh(k.track(new THREE.TorusGeometry(1.2, 0.35, 16, 48, Math.PI * 1.5)), skin);
  pinna.rotation.set(0, Math.PI / 2, Math.PI * 0.6);
  pinna.position.set(-4.2, 0.4, 0);
  pinna.scale.set(1, 1.3, 0.5);
  g.add(pinna);
  const canal = k.tube([v(-4, 0, 0), v(-2.8, 0.15, 0), v(-1.6, 0, 0)], 0.42, k.ghost("#e8b79e", 0.45, { side: THREE.DoubleSide }), g, 20, 16);
  void canal;
  const drum = new THREE.Mesh(k.track(new THREE.CircleGeometry(0.45, 32)), k.material({ color: "#e8c8b0", roughness: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
  drum.rotation.y = Math.PI / 2;
  drum.position.x = -1.55;
  g.add(drum);
  const boneM = k.material({ color: "#eadfc6", roughness: 0.5 });
  const malleus = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8)), boneM);
  malleus.position.set(-1.35, 0.1, 0);
  const incus = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.12, 0.3, 4, 8)), boneM);
  incus.position.set(-1.0, 0.35, 0);
  incus.rotation.z = 1;
  const stapes = new THREE.Mesh(k.track(new THREE.TorusGeometry(0.15, 0.04, 6, 16)), boneM);
  stapes.position.set(-0.65, 0.2, 0);
  stapes.rotation.y = Math.PI / 2;
  g.add(malleus, incus, stapes);
  const spiral: V3[] = [];
  for (let i = 0; i <= 80; i++) {
    const a = i * 0.2;
    const r0 = 0.9 - i * 0.009;
    spiral.push(v(0.3 + Math.cos(a) * r0 * 0.5, -0.2 + Math.sin(a) * r0, 0.25 + i * 0.006));
  }
  const coch = k.tube(spiral, (t) => 0.22 * (1 - 0.6 * t), k.material({ color: "#f2c8a0", roughness: 0.35, clearcoat: 0.6, transparent: true, opacity: 0.85 }), g, 160, 10);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(k.track(new THREE.TorusGeometry(0.45, 0.07, 8, 32, Math.PI * 1.6)), k.material({ color: "#f2c8a0", roughness: 0.35 }));
    c.position.set(-0.1, 1.2, 0);
    c.rotation.set(i === 1 ? Math.PI / 2 : 0, i === 2 ? Math.PI / 2 : 0, 0);
    g.add(c);
  }
  const nerveM = k.material({ color: "#f2d36b", emissive: "#f2b400", emissiveIntensity: 0.2 });
  const nerve = k.tube([v(0.4, -0.2, 0.5), v(1.2, 0, 0.3), v(2.6, 0.3, 0)], 0.12, nerveM, g, 20, 8);
  const waves = [0, 1, 2, 3].map(() => {
    const w = new THREE.Mesh(k.track(new THREE.TorusGeometry(1, 0.03, 6, 48)), k.material({ color: "#9fd0f0", emissive: "#6fb0e0", emissiveIntensity: 0.8, transparent: true }));
    w.rotation.y = Math.PI / 2;
    g.add(w);
    return w;
  });
  const fluid = beads(k, g, coch.curve, { n: 14, color: "#6fb0e0", size: 0.08, speed: 0.3, emissive: 0.8 });
  const sig = beads(k, g, nerve.curve, { n: 3, color: "#ffd23f", size: 0.1, speed: 0.6, emissive: 1.5 });
  return {
    g,
    update: (t: number, loud = 1) => {
      waves.forEach((w, i) => {
        const f = (t * 0.8 + i / 4) % 1;
        w.position.set(-7 + f * 5, 0, 0);
        w.scale.setScalar(1.6 - f * 1.1);
        (w.material as THREE.MeshPhysicalMaterial).opacity = Math.min(1, (1 - f) * 2);
      });
      const vib = Math.sin(t * 30) * 0.05 * loud;
      drum.position.x = -1.55 + vib;
      malleus.position.x = -1.35 + vib;
      incus.position.x = -1.0 + vib * 0.8;
      stapes.position.x = -0.65 + vib * 0.6;
      fluid.update(t);
      sig.update(t);
    },
  };
}

export const ear: Builder = async (k) => {
  lab(k);
  const e = earModel(k);
  k.root.add(e.g);
  tag(k, e.g, v(-4.4, 2.2, 0), "ყურის ნიჟარა", [0]);
  tag(k, e.g, v(-2.8, 0.7, 0), "გარეთა სასმენი მილი", [0]);
  tag(k, e.g, v(-1.55, -0.7, 0), "დაფის აპკი", [0, 1]);
  tag(k, e.g, v(-1.2, 0.9, 0), "ჩაქუჩი, გრდემლი, უზანგი", [1]);
  tag(k, e.g, v(0.4, -1.4, 0.5), "ლოკოკინა", [2]);
  tag(k, e.g, v(-0.1, 2, 0), "ნახევარრკალოვანი მილები (წონასწორობა)", [2]);
  tag(k, e.g, v(2.4, 0.8, 0), "სმენის ნერვი", [2]);
  const focus = [v(-3.4, 0.2, 0), v(-1.1, 0.2, 0), v(0.6, 0.2, 0)];
  const dist = [8, 4.5, 6];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (_u: number, s: number, t: number) => {
        e.update(t);
        return orbit(focus[i], dist[i], s, { start: 0.25, speed: 0.03, height: 0.2 });
      },
    })),
  };
};

export const hearingLoss: Builder = async (k) => {
  lab(k, "#100f16");
  const g = new THREE.Group();
  k.root.add(g);
  const cellMat = k.material({ color: "#e8b8c0", roughness: 0.4, clearcoat: 0.5, normalMap: k.normalMap("organic", [1, 2]) });
  const dead = k.material({ color: "#8a8a8a", roughness: 0.7 });
  const cells = Array.from({ length: 12 }, (_, i) => {
    const c = new THREE.Group();
    const body = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.3, 1.2, 6, 12)), cellMat);
    c.add(body);
    const bundle = new THREE.Group();
    bundle.position.y = 0.9;
    for (let j = 0; j < 7; j++) {
      const h = new THREE.Mesh(k.cylinder, k.material({ color: "#f4e6c8" }));
      h.scale.set(0.03, 0.25 + j * 0.06, 0.03);
      h.position.set((j - 3) * 0.07, (0.25 + j * 0.06) / 2, 0);
      bundle.add(h);
    }
    c.add(bundle);
    c.position.set((i - 5.5) * 0.9, 0, 0);
    g.add(c);
    return { c, body, bundle };
  });
  const memb = new THREE.Mesh(k.track(new THREE.BoxGeometry(12, 0.15, 1.6)), k.ghost("#bfe0f0", 0.4));
  memb.position.y = 1.55;
  g.add(memb);
  const meter = tag(k, g, v(0, 3, 0), "");
  // Ear canal with wax and fluid behind the drum.
  const mid = new THREE.Group();
  k.root.add(mid);
  const e = earModel(k);
  mid.add(e.g);
  const wax = new THREE.Mesh(k.sphere, k.material({ color: "#c9952a", roughness: 0.5 }));
  wax.scale.set(0.5, 0.35, 0.35);
  wax.position.set(-2.4, 0.08, 0);
  const fluid = new THREE.Mesh(k.sphere, k.ghost("#f2e08a", 0.55));
  fluid.scale.set(0.5, 0.5, 0.5);
  fluid.position.set(-1.0, -0.1, 0);
  mid.add(wax, fluid);
  tag(k, mid, v(-2.4, 0.8, 0), "გოგირდის საცობი", [2]);
  tag(k, mid, v(-1.0, -0.8, 0), "სითხე შუა ყურში — ოტიტი", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: i === 2,
      enter: () => {
        g.visible = i < 2;
        mid.visible = i === 2;
      },
      update: (u: number, s: number, t: number) => {
        const db = i === 0 ? 50 : 50 + 60 * ease(u / 0.6);
        const amp = (db - 40) / 70;
        cells.forEach((x, j) => {
          const broken = i === 1 && j % 3 !== 0 && u > 0.5 + (j % 4) * 0.08;
          x.bundle.rotation.z = broken ? 1.3 : Math.sin(t * 8 + j * 0.6) * 0.25 * amp;
          x.body.material = broken ? dead : cellMat;
        });
        memb.position.y = 1.55 + Math.sin(t * 8) * 0.05 * amp;
        setText(meter, `${Math.round(db)} დბ ${db > 85 ? "— საშიში!" : ""}`);
        e.update(t, 0.3);
        return i === 2 ? orbit(v(-1.6, 0.2, 0), 6, s, { start: 0.3, speed: 0.03, height: 0.2 }) : front(s, 11, v(0, 0.8, 0), 0.25);
      },
    })),
  };
};
