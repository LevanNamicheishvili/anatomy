import * as THREE from "three";
import type { Body } from "@/components/journeys/body-model";
import { beads, context, curve, glow, layer, orbit } from "@/components/journeys/common";
import { ease, rng, v, type Builder, type Kit, type Shot, type V3 } from "@/components/journeys/JourneyScene";

/*
 * Hormone lessons: the endocrine glands in the atlas body (pituitary, pineal, thymus, adrenals, pancreas,
 * testes; the thyroid is drawn, the atlas lacks it), hormones as beads in the blood, and close-ups drawn
 * in code (receptor on a target cell, thyroid follicles, an islet of Langerhans).
 */

interface Gland {
  mesh: THREE.Mesh;
  mat: THREE.MeshPhysicalMaterial;
  at: V3;
}

const box = (m: THREE.Mesh) => m.geometry.boundingBox!.getCenter(new THREE.Vector3());

/** The body with its glands lit; returns them by name. */
async function glandsBody(k: Kit, brain = false) {
  const body = await k.body({ organs: true, brain });
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.07, 0.12);
  layer(k, body, g, (p) => p.group === "heart" && /^Wall/.test(p.name), k.ghost("#b5343c", 0.25), 2);
  layer(k, body, g, (p) => p.group === "arteries", k.ghost("#d8343a", 0.25), 2);
  layer(k, body, g, (p) => p.group === "urinary", k.ghost("#9c5a4a", 0.25), 2);
  layer(k, body, g, (p) => p.group === "digestive" && /stomach|duodenum|colon/i.test(p.name), k.ghost("#d9a38f", 0.16), 3);
  const brainMat = brain ? k.ghost("#e8c7c0", 0.3) : null;
  if (brain && brainMat) layer(k, body, g, (p) => p.group === "brain" && !/hypothalamus|canal/i.test(p.name), brainMat, 3);
  const gland = (filter: (p: Body["data"]["parts"][number]) => boolean, color: string): Gland => {
    const mat = k.material({ color, emissive: color, emissiveIntensity: 0.15, roughness: 0.4, clearcoat: 0.5, normalMap: undefined });
    const mesh = layer(k, body, g, filter, mat, 1);
    return { mesh, mat, at: box(mesh) };
  };
  const G = {
    pituitary: gland((p) => p.id === "FJ1796", "#d9822b"),
    pineal: gland((p) => p.id === "FJ1795", "#b5651d"),
    thymus: gland((p) => p.id === "FJ3150" || p.id === "FJ3151", "#e2b07a"),
    adrenals: gland((p) => p.id === "FJ3129" || p.id === "FJ3130", "#e0a12a"),
    pancreas: gland((p) => p.id === "FJ1895", "#e9b67b"),
    gonads: gland((p) => p.group === "gonads", "#d98aa0"),
    thyroid: thyroid(k, body, g),
    hypothalamus: brain ? gland((p) => /hypothalamus/i.test(p.name), "#7d5ba6") : null,
  };
  return { body, g, G, brainMat };
}

/** The thyroid (not in the atlas): two lobes and an isthmus over the trachea, below the larynx. */
function thyroid(k: Kit, body: Body, parent: THREE.Object3D): Gland {
  const trachea = body.parts((p) => p.id === "FJ2541")[0];
  const tg = trachea ? body.geometry(trachea) : null;
  tg?.computeBoundingBox();
  const top = tg ? tg.boundingBox!.max.y : 1.47;
  const front = tg ? tg.boundingBox!.max.z : 0.01;
  tg?.dispose();
  const mat = k.material({ color: "#c0504d", emissive: "#c0504d", emissiveIntensity: 0.15, roughness: 0.4, clearcoat: 0.5, sheen: 0.4, sheenColor: new THREE.Color("#ffd0d0"), normalMap: k.normalMap("organic", [2, 2]) });
  const grp = new THREE.Group();
  const at = v(0, top - 0.028, front - 0.004);
  grp.position.copy(at);
  for (const s of [-1, 1]) {
    const lobe = new THREE.Mesh(k.sphere, mat);
    lobe.scale.set(0.009, 0.02, 0.008);
    lobe.position.set(s * 0.013, 0.002, -0.004);
    lobe.rotation.z = s * 0.15;
    grp.add(lobe);
  }
  const isth = new THREE.Mesh(k.sphere, mat);
  isth.scale.set(0.012, 0.005, 0.004);
  isth.position.set(0, -0.006, 0.002);
  grp.add(isth);
  parent.add(grp);
  return { mesh: isth, mat, at };
}

const torso = (t: number, s: number, at = v(0, 1.2, 0.02), dist = 1.15): Shot => orbit(at, dist, s, { start: -0.25 + Math.sin(t * 0.1) * 0.1, speed: 0.04, height: 0.05 });

// ---- 9 1.10 Endocrine system --------------------------------------------------------------------

export const endocrineSystem: Builder = async (k) => {
  const { g, G } = await glandsBody(k, true);
  const order: [keyof typeof G, string][] = [
    ["pituitary", "ჰიპოფიზი"],
    ["pineal", "ეპიფიზი"],
    ["thyroid", "ფარისებრი ჯირკვალი"],
    ["thymus", "მკერდუკანა ჯირკვალი"],
    ["adrenals", "თირკმელზედა ჯირკვლები"],
    ["pancreas", "პანკრეასი"],
    ["gonads", "სასქესო ჯირკვლები"],
  ];
  for (const [key, text] of order) {
    const gl = G[key];
    if (gl) k.label(k.anchor(g, gl.at), text, { stages: [0] });
  }
  // Adrenaline: adrenal → vena cava → heart → aorta → muscles of the thigh.
  const adr = G.adrenals.at;
  const route = curve([adr, v(-0.012, 1.17, 0.015), v(-0.014, 1.27, 0.018), v(0.017, 1.31, 0.02), v(0.012, 1.36, 0.012), v(0.016, 1.37, -0.004), v(0.018, 1.3, -0.026), v(0.01, 1.12, 0.01), v(-0.03, 1.0, 0.024), v(-0.075, 0.9, 0.044), v(-0.088, 0.75, 0.03)]);
  const adrenaline = beads(k, g, route, { n: 60, color: "#ffb02e", size: 0.004, speed: 0.07, spread: 0.004, seed: 3 });
  k.label(k.anchor(g, adr.clone().add(v(0, 0, 0.02))), "ადრენალინი გამოიყოფა", { stages: [1] });
  k.label(k.anchor(g, v(0.017, 1.31, 0.03)), "გული ხშირად ცემს", { stages: [1] });
  k.label(k.anchor(g, v(-0.088, 0.78, 0.04)), "კუნთები", { stages: [1] });

  // Feedback loop: hypothalamus → pituitary → thyroid → back.
  const hyp = G.hypothalamus?.at ?? v(0, 1.62, 0);
  const pit = G.pituitary.at;
  const thy = G.thyroid.at;
  const down = curve([hyp, pit, pit.clone().add(v(0.01, -0.03, 0.01)), v(0.015, 1.5, 0.01), thy.clone().add(v(0.01, 0.01, 0))]);
  const up = curve([thy.clone().add(v(-0.01, 0.005, 0)), v(-0.016, 1.5, 0.005), pit.clone().add(v(-0.01, -0.02, 0)), hyp]);
  const tsh = beads(k, g, down, { n: 26, color: "#5b8def", size: 0.0028, speed: 0.12, seed: 5 });
  const thx = beads(k, g, up, { n: 26, color: "#ffb02e", size: 0.0028, speed: 0.12, seed: 6 });
  k.label(k.anchor(g, hyp), "ჰიპოთალამუსი", { stages: [3] });
  k.label(k.anchor(g, v(0.017, 1.53, 0.012)), "ბრძანება (თსჰ) ↓", { kind: "tag", stages: [3] });
  k.label(k.anchor(g, v(-0.018, 1.52, 0.006)), "↑ თიროქსინი ამუხრუჭებს", { kind: "tag", stages: [3] });
  k.label(k.anchor(g, thy), "ფარისებრი ჯირკვალი", { stages: [3] });

  const cell = receptorScene(k);
  const showMacro = (on: boolean) => {
    g.visible = on;
    cell.group.visible = !on;
    k.mood(on ? null : "#120c14", 9, 26);
  };
  const glands = Object.values(G).filter((x): x is Gland => !!x);

  return {
    stages: [
      {
        duration: 18,
        enter: () => showMacro(true),
        update: (_u, s, t) => {
          // Light the glands one by one, then all.
          const i = Math.floor(s / 1.8);
          order.forEach(([key], j) => {
            const gl = G[key];
            if (gl) glow(gl.mat, t, i >= order.length || i === j, 0.25);
          });
          adrenaline.update(t, 0);
          tsh.update(t, 0);
          thx.update(t, 0);
          return torso(t, s, v(0, 1.22, 0.02), 1.45);
        },
      },
      {
        duration: 16,
        enter: () => showMacro(true),
        update: (_u, s, t) => {
          for (const gl of glands) glow(gl.mat, t, gl === G.adrenals, 0.3);
          adrenaline.update(t);
          tsh.update(t, 0);
          thx.update(t, 0);
          return torso(t, s, v(-0.02, 1.08, 0.02), 0.95);
        },
      },
      {
        duration: 18,
        cut: true,
        enter: () => showMacro(false),
        update: (u, s, t) => {
          cell.update(t);
          return orbit(v(0, 0.6, 0), 11 - 2 * ease(u), s, { start: 0.35, speed: 0.04, height: 0.42 });
        },
      },
      {
        duration: 18,
        cut: true,
        enter: () => showMacro(true),
        update: (_u, s, t) => {
          for (const gl of glands) glow(gl.mat, t, gl === G.thyroid || gl === G.pituitary || gl === G.hypothalamus, 0.3);
          adrenaline.update(t, 0);
          tsh.update(t);
          thx.update(t);
          const at = v(0, 1.555, 0.005);
          return { target: at, pos: at.clone().add(v(0.24, 0.02, 0.2 + Math.sin(s * 0.2) * 0.03)) };
        },
      },
    ],
  };
};

/** A target cell with receptors; matching hormone molecules dock and a signal spreads inside. */
function receptorScene(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(12);
  // Two cells: left one has receptors, right one does not.
  const mem = (x: number, color: string) => {
    const m = new THREE.Mesh(k.track(new THREE.SphereGeometry(4, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2)), k.material({ color, roughness: 0.4, clearcoat: 0.6, sheen: 0.6, sheenColor: new THREE.Color("#ffffff"), normalMap: k.normalMap("organic", [6, 3]), side: THREE.DoubleSide }));
    m.scale.set(1, 0.45, 1);
    m.position.set(x, -0.6, 0);
    group.add(m);
    return m;
  };
  mem(-2.4, "#d79aa8");
  mem(6.6, "#b9a3c9");
  const recMat = k.material({ color: "#3d7bd9", emissive: "#3d7bd9", emissiveIntensity: 0.2, roughness: 0.4 });
  const receptors: { tip: V3; mat: THREE.MeshPhysicalMaterial }[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.3;
    const rad = 1.2 + r() * 2.2;
    const x = -2.4 + Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const y = -0.6 + 0.45 * Math.sqrt(Math.max(0, 16 - rad * rad));
    const mat = recMat.clone();
    k.track(mat);
    const rec = new THREE.Group();
    rec.position.set(x, y, z);
    const stem = new THREE.Mesh(k.cylinder, mat);
    stem.scale.set(0.09, 0.5, 0.09);
    stem.position.y = 0.2;
    const armL = new THREE.Mesh(k.cylinder, mat);
    armL.scale.set(0.07, 0.35, 0.07);
    armL.position.set(-0.12, 0.55, 0);
    armL.rotation.z = 0.6;
    const armR = armL.clone();
    armR.position.x = 0.12;
    armR.rotation.z = -0.6;
    rec.add(stem, armL, armR);
    group.add(rec);
    receptors.push({ tip: v(x, y + 0.62, z), mat });
  }
  // Hormone molecules: each docks to its receptor, stays, leaves; others drift past the right cell.
  const hMat = k.material({ color: "#ffb02e", emissive: "#ffb02e", emissiveIntensity: 0.5, roughness: 0.35 });
  const hormones = receptors.map((rc, i) => {
    const m = new THREE.Mesh(k.sphere, hMat);
    m.scale.setScalar(0.17);
    group.add(m);
    return { m, rc, phase: i / receptors.length, from: v(-2.4 + (r() - 0.5) * 9, 5 + r() * 2, (r() - 0.5) * 6) };
  });
  const passers = Array.from({ length: 8 }, (_, i) => {
    const m = new THREE.Mesh(k.sphere, hMat);
    m.scale.setScalar(0.17);
    group.add(m);
    return { m, phase: i / 8, z: (r() - 0.5) * 6 };
  });
  // Signal inside the cell: a ring that grows from the receptor.
  const ringMat = k.material({ color: "#ffe08a", emissive: "#ffd23f", emissiveIntensity: 1, transparent: true, opacity: 0.8, depthWrite: false });
  const ring = new THREE.Mesh(k.track(new THREE.TorusGeometry(1, 0.05, 8, 48)), ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);
  // A vessel above, where hormones come from.
  k.tube([v(-9, 5.5, -3), v(0, 6, -3.4), v(10, 5.4, -3)], 0.9, k.ghost("#c62f36", 0.3, { side: THREE.DoubleSide }), group, 32, 18);
  k.label(k.anchor(group, v(-2.4, 1.4, 3.6)), "სამიზნე უჯრედი", { stages: [2] });
  k.label(k.anchor(group, receptors[0].tip), "რეცეპტორი", { stages: [2] });
  k.label(k.anchor(group, v(6.6, 1.3, 3.6)), "უჯრედი რეცეპტორის გარეშე — ჰორმონი არ მოქმედებს", { stages: [2] });
  k.label(k.anchor(group, v(0, 6.2, -2.6)), "სისხლძარღვი", { stages: [2] });
  const tagAnchor = k.anchor(group, v(0, 0, 0));
  k.label(tagAnchor, "ჰორმონი", { kind: "tag", stages: [2] });
  const p = new THREE.Vector3();
  return {
    group,
    update: (t: number) => {
      let lit = -1;
      hormones.forEach((h, i) => {
        const f = (t / 9 + h.phase) % 1;
        if (f < 0.45) p.lerpVectors(h.from, h.rc.tip, ease(f / 0.45)).add(v(Math.sin(t * 2 + i) * 0.2 * (1 - f / 0.45), 0, 0));
        else if (f < 0.8) p.copy(h.rc.tip);
        else p.lerpVectors(h.rc.tip, h.rc.tip.clone().add(v(0, 3, 0)), (f - 0.8) / 0.2);
        h.m.position.copy(p);
        h.m.visible = f < 0.97;
        const bound = f >= 0.45 && f < 0.8;
        h.rc.mat.emissiveIntensity = bound ? 0.9 : 0.2;
        if (bound && lit < 0) lit = i;
        if (i === 0) tagAnchor.position.copy(p).add(v(0, 0.45, 0));
      });
      if (lit >= 0) {
        const h = hormones[lit];
        const f = (((t / 9 + h.phase) % 1) - 0.45) / 0.35;
        ring.visible = true;
        ring.position.set(h.rc.tip.x, h.rc.tip.y - 0.9, h.rc.tip.z);
        ring.scale.setScalar(0.3 + f * 2.5);
        ringMat.opacity = 0.8 * (1 - f);
      } else ring.visible = false;
      passers.forEach((q) => {
        const f = (t / 7 + q.phase) % 1;
        q.m.position.set(1 + f * 11, 4.5 - Math.sin(f * Math.PI) * 2.6, q.z);
      });
    },
  };
}

// ---- 9 1.11 Pituitary ---------------------------------------------------------------------------

export const pituitary: Builder = async (k) => {
  const { body, g, G } = await glandsBody(k, true);
  const pit = G.pituitary.at;
  const hyp = G.hypothalamus?.at ?? v(0, 1.62, 0);
  // Routes from the pituitary down the neck to each target, through the heart region.
  const via = (to: V3, side: number) => curve([pit, pit.clone().add(v(side * 0.01, -0.04, 0)), v(side * 0.02, 1.48, 0.01), v(side * 0.025, 1.36, 0.02), to]);
  const targets = [
    { to: G.thyroid.at, color: "#5b8def", side: 1 },
    { to: G.adrenals.at, color: "#e0a12a", side: -1 },
    { to: G.gonads.at, color: "#d98aa0", side: 1 },
  ];
  const tropic = targets.map((x, i) => beads(k, g, via(x.to, x.side), { n: 30, color: x.color, size: 0.0035, speed: 0.08, seed: 20 + i }));
  // Growth hormone to the bones (the femur).
  const femur = layer(k, body, g, (p) => p.group === "femur", k.material({ color: "#efe4c9", emissive: "#ffd23f", emissiveIntensity: 0, roughness: 0.55 }));
  const femurMat = femur.material as THREE.MeshPhysicalMaterial;
  const gh = beads(k, g, via(box(femur).add(v(0, 0.12, 0.02)), -1), { n: 40, color: "#7cc66a", size: 0.0035, speed: 0.07, seed: 30 });
  // ADH to the kidneys; water drops back to the blood.
  const kidneys = layer(k, body, g, (p) => /kidney/i.test(p.name), k.material({ color: "#9c4a3a", emissive: "#4aa8e8", emissiveIntensity: 0, roughness: 0.45, clearcoat: 0.4 }));
  const kidneyMat = kidneys.material as THREE.MeshPhysicalMaterial;
  const kc = box(kidneys);
  const adh = beads(k, g, via(kc.clone().add(v(-0.05, 0, 0)), -1), { n: 30, color: "#a46be0", size: 0.0035, speed: 0.08, seed: 31 });
  const water = beads(k, g, curve([v(-0.054, 1.1, -0.008), v(-0.03, 1.12, 0.005), v(-0.012, 1.15, 0.015)]), { n: 16, color: "#4aa8e8", size: 0.003, speed: 0.25, seed: 32 });
  k.label(k.anchor(g, hyp), "ჰიპოთალამუსი", { stages: [0] });
  k.label(k.anchor(g, pit), "ჰიპოფიზი", { stages: [0, 1, 2, 3] });
  k.label(k.anchor(g, pit.clone().add(v(0, 0.008, -0.002))), "ძაბრი", { kind: "tag", stages: [0] });
  k.label(k.anchor(g, G.thyroid.at), "ფარისებრი ჯირკვალი", { stages: [1] });
  k.label(k.anchor(g, G.adrenals.at), "თირკმელზედა ჯირკვლები", { stages: [1] });
  k.label(k.anchor(g, G.gonads.at), "სასქესო ჯირკვლები", { stages: [1] });
  k.label(k.anchor(g, box(femur).add(v(0, 0.1, 0.03))), "ძვლის ზრდა", { stages: [2] });
  k.label(k.anchor(g, kc.clone().add(v(-0.06, 0, 0.01))), "თირკმელი: წყალი ბრუნდება სისხლში", { stages: [3] });
  const off = () => {
    tropic.forEach((b) => b.update(0, 0));
    gh.update(0, 0);
    adh.update(0, 0);
    water.update(0, 0);
  };
  return {
    stages: [
      {
        duration: 15,
        update: (_u, s, t) => {
          off();
          glow(G.pituitary.mat, t, true, 0.3);
          if (G.hypothalamus) glow(G.hypothalamus.mat, t + 1.5, true, 0.2);
          const at = v(0, 1.61, 0);
          return { target: at, pos: at.clone().add(v(0.17 + Math.sin(s * 0.2) * 0.02, 0.03, 0.12)) };
        },
      },
      {
        duration: 16,
        update: (_u, s, t) => {
          off();
          tropic.forEach((b) => b.update(t));
          for (const gl of [G.thyroid, G.adrenals, G.gonads]) glow(gl.mat, t, true, 0.25);
          return torso(t, s, v(0, 1.2, 0.02), 1.55);
        },
      },
      {
        duration: 15,
        update: (_u, s, t) => {
          off();
          gh.update(t);
          femurMat.emissiveIntensity = 0.15 + 0.15 * Math.sin(t * 3);
          return torso(t, s, v(-0.03, 1.05, 0.02), 1.7);
        },
      },
      {
        duration: 15,
        update: (_u, s, t) => {
          off();
          femurMat.emissiveIntensity = 0;
          adh.update(t);
          water.update(t);
          kidneyMat.emissiveIntensity = 0.15 + 0.1 * Math.sin(t * 3);
          return torso(t, s, v(-0.02, 1.25, 0.0), 1.05);
        },
      },
    ],
  };
};

// ---- 9 1.12 Thyroid -----------------------------------------------------------------------------

export const thyroidGland: Builder = async (k) => {
  const { body, g, G } = await glandsBody(k, false);
  layer(k, body, g, (p) => p.group === "airways" && p.id === "FJ2541", k.material({ color: "#e8d7c8", roughness: 0.5, normalMap: undefined }), 0);
  const thy = G.thyroid;
  const grp = thy.mesh.parent!;
  // Thyroxine to the body: heart, arms, legs, brain.
  const spread = [v(0.017, 1.31, 0.02), v(-0.2, 1.15, 0.0), v(0.2, 1.15, 0.0), v(-0.09, 0.75, 0.03), v(0.09, 0.75, 0.03), v(0, 1.66, 0)].map((to, i) => beads(k, g, curve([thy.at, thy.at.clone().lerp(to, 0.3).add(v(0, 0, 0.02)), to]), { n: 18, color: "#ffb02e", size: 0.004, speed: 0.1, seed: 40 + i }));
  k.label(k.anchor(g, thy.at.clone().add(v(0.016, 0.004, 0))), "ფარისებრი ჯირკვლის წილი", { stages: [0] });
  k.label(k.anchor(g, thy.at.clone().add(v(0, -0.007, 0.004))), "ყელი", { kind: "tag", stages: [0] });
  k.label(k.anchor(g, thy.at.clone().add(v(0, 0.035, -0.004))), "ხორხი", { stages: [0] });
  k.label(k.anchor(g, thy.at.clone().add(v(0, -0.045, -0.006))), "ტრაქეა", { stages: [0] });
  k.label(k.anchor(g, v(0.017, 1.31, 0.03)), "გულისცემა აჩქარდება", { stages: [2] });
  k.label(k.anchor(g, thy.at.clone().add(v(0.03, 0, 0.01))), "გადიდებული ჯირკვალი — ჩიყვი", { stages: [3] });
  const foll = follicles(k);
  const show = (macro: boolean) => {
    g.visible = macro;
    foll.group.visible = !macro;
    k.mood(macro ? null : "#140b0b", 9, 26);
  };
  const neck = (s: number, zoom = 1): Shot => {
    const at = thy.at.clone().add(v(0, 0.005, 0));
    return { target: at, pos: at.clone().add(v(0.07 * Math.sin(s * 0.2), 0.02, 0.17).multiplyScalar(zoom)) };
  };
  return {
    stages: [
      {
        duration: 14,
        enter: () => show(true),
        update: (_u, s, t) => {
          grp.scale.setScalar(1);
          spread.forEach((b) => b.update(t, 0));
          glow(thy.mat, t, true, 0.2);
          return neck(s);
        },
      },
      {
        duration: 18,
        cut: true,
        enter: () => show(false),
        update: (u, s, t) => {
          foll.update(t);
          return orbit(v(0, 0, 0), 12 - 2 * ease(u), s, { start: 0.3, speed: 0.05, height: 0.45 });
        },
      },
      {
        duration: 15,
        cut: true,
        enter: () => show(true),
        update: (_u, s, t) => {
          spread.forEach((b) => b.update(t));
          glow(thy.mat, t, true, 0.3);
          return torso(t, s, v(0, 1.25, 0.02), 1.4);
        },
      },
      {
        duration: 15,
        update: (u, s, t) => {
          spread.forEach((b) => b.update(t, 0));
          grp.scale.setScalar(1 + 0.9 * ease(u / 0.5));
          glow(thy.mat, t, true, 0.15);
          return neck(s, 1.3);
        },
      },
    ],
  };
};

/** Thyroid follicles: rings of cells round colloid; iodine in from the capillary, thyroxine out. */
function follicles(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(51);
  const cellMat = k.material({ color: "#d9837a", roughness: 0.45, clearcoat: 0.4, normalMap: k.normalMap("organic", [1, 1]), sheen: 0.5, sheenColor: new THREE.Color("#ffe0dc") });
  const colloid = k.ghost("#f2c46b", 0.75, { roughness: 0.25, clearcoat: 0.9, depthWrite: true });
  const centres = [v(0, 0, 0), v(3.4, 0.4, -0.6), v(-3.3, 0.2, -0.4), v(1.6, 0.2, -3.2), v(-1.8, -0.1, -3.1), v(1.8, -0.3, 3), v(-1.7, 0.3, 2.9)];
  const cells: THREE.Matrix4[] = [];
  for (const c of centres) {
    const R = 1.25 + r() * 0.3;
    const core = new THREE.Mesh(k.sphere, colloid);
    core.scale.setScalar(R * 0.82);
    core.position.copy(c);
    group.add(core);
    // A shell of cells over the colloid (a fibonacci sphere).
    const n = 60;
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n;
      const rad = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      const nrm = v(Math.cos(a) * rad, y, Math.sin(a) * rad);
      if (c === centres[0] && nrm.z > 0.35 && nrm.y > -0.3) continue; // open the front follicle
      cells.push(new THREE.Matrix4().compose(c.clone().addScaledVector(nrm, R), new THREE.Quaternion().setFromUnitVectors(v(0, 1, 0), nrm), v(0.3, 0.2, 0.3)));
    }
  }
  const cm = new THREE.InstancedMesh(k.sphere, cellMat, cells.length);
  cells.forEach((m, i) => cm.setMatrixAt(i, m));
  group.add(cm);
  const cap = k.tube([v(-6, -1.9, 1.5), v(-2, -2.1, 1.2), v(2, -1.8, 1.4), v(6, -2.2, 1)], 0.35, k.material({ color: "#c62f36", roughness: 0.35, clearcoat: 0.6, normalMap: k.normalMap("organic", [10, 1]) }), group, 48, 14);
  const iodine = beads(k, group, curve([cap.curve.getPointAt(0.3), v(-0.6, -1.1, 0.9), v(0, -0.4, 0.4), v(0, 0, 0)]), { n: 14, color: "#8e5bd6", size: 0.11, speed: 0.12, seed: 1 });
  const t4 = beads(k, group, curve([v(0.2, 0.1, 0.2), v(0.8, -0.8, 0.9), v(1.4, -1.4, 1.2), cap.curve.getPointAt(0.68)]), { n: 14, color: "#ffb02e", size: 0.13, speed: 0.1, seed: 2 });
  k.label(k.anchor(group, v(0, 0.4, 0.6)), "კოლოიდი", { stages: [1] });
  k.label(k.anchor(group, v(3.4, 1.9, -0.6)), "ფოლიკული", { stages: [1] });
  k.label(k.anchor(group, cap.curve.getPointAt(0.12)), "კაპილარი", { stages: [1] });
  k.label(k.anchor(group, v(-0.6, -1.1, 1.1)), "იოდი →", { kind: "tag", stages: [1] });
  k.label(k.anchor(group, v(1.1, -1.1, 1.3)), "თიროქსინი →", { kind: "tag", stages: [1] });
  return {
    group,
    update: (t: number) => {
      iodine.update(t);
      t4.update(t);
    },
  };
}

// ---- 9 1.13 Glucose -----------------------------------------------------------------------------

export const glucose: Builder = async (k) => {
  const { body, g, G } = await glandsBody(k, false);
  layer(k, body, g, (p) => p.id === "FJ2561", k.ghost("#7a3b5a", 0.4), 2);
  layer(k, body, g, (p) => p.group === "digestive" && /stomach|duodenum/i.test(p.name), k.ghost("#d9a38f", 0.32), 2);
  k.label(k.anchor(g, G.pancreas.at), "პანკრეასი", { stages: [0] });
  k.label(k.anchor(g, v(0.039, 1.19, 0.05)), "კუჭი", { stages: [0] });
  k.label(k.anchor(g, v(-0.025, 1.1, 0.035)), "თორმეტგოჯა ნაწლავი", { stages: [0] });
  k.label(k.anchor(g, v(0.087, 1.17, -0.01)), "ელენთა", { stages: [0] });
  const islet = isletScene(k);
  const show = (macro: boolean) => {
    g.visible = macro;
    islet.group.visible = !macro;
    k.mood(macro ? null : "#120c0e", 10, 30);
  };
  const shot = (s: number, u: number) => orbit(v(0.8, 0.5, 0), 16 - 1.5 * ease(u), s, { start: 0.12, speed: 0.025, height: 0.36 });
  return {
    stages: [
      {
        duration: 14,
        enter: () => show(true),
        update: (_u, s, t) => {
          glow(G.pancreas.mat, t, true, 0.25);
          return torso(t, s, G.pancreas.at.clone().add(v(0, 0.02, 0)), 0.5);
        },
      },
      { duration: 15, cut: true, enter: () => show(false), update: (u, s, t) => (islet.update(t, "idle"), shot(s, u)) },
      { duration: 18, enter: () => show(false), update: (u, s, t) => (islet.update(t, "fed"), shot(s, u)) },
      { duration: 18, enter: () => show(false), update: (u, s, t) => (islet.update(t, "fasting"), shot(s, u)) },
    ],
  };
};

/** An islet among acini, a capillary, and a liver/muscle cell; glucose level as a glass column. */
function isletScene(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(61);
  const organic = k.normalMap("organic", [1, 1]);
  const acinarMat = k.material({ color: "#e3a58f", roughness: 0.5, normalMap: organic, sheen: 0.4, sheenColor: new THREE.Color("#ffffff") });
  const beta = k.material({ color: "#5b8def", emissive: "#5b8def", emissiveIntensity: 0.1, roughness: 0.4, normalMap: organic, clearcoat: 0.5 });
  const alpha = k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.1, roughness: 0.4, normalMap: organic, clearcoat: 0.5 });
  const ISLET = v(-4, 0.6, 0);
  const m = new THREE.Matrix4();
  // Acinar cells around, islet cells in a ball.
  const acini: THREE.Matrix4[] = [];
  for (let i = 0; i < 90; i++) {
    const p = v((r() - 0.5) * 9, (r() - 0.5) * 3 + 0.4, (r() - 0.5) * 7).add(v(-4, 0, 0));
    if (p.distanceTo(ISLET) < 2.3) continue;
    acini.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), v(1, 1, 1).multiplyScalar(0.4 + r() * 0.15)));
  }
  const am = new THREE.InstancedMesh(k.sphere, acinarMat, acini.length);
  acini.forEach((x, i) => am.setMatrixAt(i, x));
  group.add(am);
  const betaCells: V3[] = [];
  const alphaCells: V3[] = [];
  for (let i = 0; i < 70; i++) {
    const d = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize().multiplyScalar(Math.cbrt(r()) * 1.8);
    (d.length() > 1.3 && r() < 0.6 ? alphaCells : betaCells).push(ISLET.clone().add(d));
  }
  for (const [list, mat] of [
    [betaCells, beta],
    [alphaCells, alpha],
  ] as const) {
    const im = new THREE.InstancedMesh(k.sphere, mat, list.length);
    list.forEach((p, i) => {
      m.compose(p, new THREE.Quaternion(), v(1, 1, 1).multiplyScalar(0.36));
      im.setMatrixAt(i, m);
    });
    group.add(im);
  }
  const cap = k.tube([v(-9, -1.6, 1.8), v(-4, -1.5, 2.1), v(0, -1.8, 1.6), v(4, -1.5, 1.2), v(9, -1.7, 0.6)], 0.42, k.ghost("#c62f36", 0.55, { normalMap: k.normalMap("organic", [12, 1]), clearcoat: 0.6, roughness: 0.35 }), group, 64, 16);
  // Target cell (liver/muscle) on the right, half cut open.
  const TC = v(4.5, 1.2, -0.5);
  const target = new THREE.Mesh(k.track(new THREE.SphereGeometry(1.9, 48, 32, 0, Math.PI * 1.5)), k.material({ color: "#c79a74", roughness: 0.45, side: THREE.DoubleSide, normalMap: organic, clearcoat: 0.4 }));
  target.position.copy(TC);
  target.rotation.y = Math.PI * 0.75;
  group.add(target);
  // Glycogen granules inside the target cell.
  const glyMat = k.material({ color: "#f1e2b8", roughness: 0.5 });
  const gly = Array.from({ length: 28 }, () => {
    const s = new THREE.Mesh(k.sphere, glyMat);
    s.position.copy(TC).add(v(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(2));
    s.scale.setScalar(0.12);
    group.add(s);
    return s;
  });
  const glucoseGeo = k.track(new THREE.CylinderGeometry(1, 1, 0.6, 6));
  const insulin = beads(k, group, curve([ISLET.clone().add(v(0.4, -0.9, 0.8)), cap.curve.getPointAt(0.42), cap.curve.getPointAt(0.62), v(2.9, -0.4, 0.6), TC.clone().add(v(-1.6, -0.6, 0.6))]), { n: 22, color: "#5b8def", size: 0.13, speed: 0.1, seed: 4 });
  const glucagon = beads(k, group, curve([ISLET.clone().add(v(1.2, -1.0, 0.6)), cap.curve.getPointAt(0.45), cap.curve.getPointAt(0.64), v(2.9, -0.3, 0.6), TC.clone().add(v(-1.6, -0.5, 0.6))]), { n: 22, color: "#e0524a", size: 0.13, speed: 0.1, seed: 5 });
  const intoCell = beads(k, group, curve([cap.curve.getPointAt(0.7), v(3.4, -0.6, 0.8), TC.clone().add(v(-0.8, -0.3, 0.4)), TC]), { n: 18, color: "#ffffff", size: 0.16, speed: 0.12, seed: 6, geometry: glucoseGeo, emissive: 0.3 });
  const outOfCell = beads(k, group, curve([TC, TC.clone().add(v(-0.8, -0.4, 0.5)), v(3.4, -0.7, 0.9), cap.curve.getPointAt(0.82)]), { n: 18, color: "#ffffff", size: 0.16, speed: 0.12, seed: 7, geometry: glucoseGeo, emissive: 0.3 });
  const inBlood = beads(k, group, cap.curve, { n: 36, color: "#ffffff", size: 0.15, speed: 0.04, spread: 0.18, seed: 8, geometry: glucoseGeo, emissive: 0.3 });
  // Glucose level: a glass column with a coloured fill.
  const G0 = v(7.6, -1.2, -1.5);
  const glass = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.45, 0.45, 4.4, 24, 1, true)), k.ghost("#ffffff", 0.18, { side: THREE.DoubleSide }));
  glass.position.copy(G0).add(v(0, 2.2, 0));
  const fill = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.4, 0.4, 1, 24).translate(0, 0.5, 0)), k.material({ color: "#f2c230", emissive: "#f2c230", emissiveIntensity: 0.35 }));
  fill.position.copy(G0);
  const normal = new THREE.Mesh(k.track(new THREE.TorusGeometry(0.5, 0.04, 6, 32)), k.material({ color: "#0f8a74", emissive: "#0f8a74", emissiveIntensity: 0.6 }));
  normal.rotation.x = Math.PI / 2;
  normal.position.copy(G0).add(v(0, 2.0, 0));
  group.add(glass, fill, normal);
  k.label(k.anchor(group, G0.clone().add(v(0, 4.6, 0))), "გლუკოზა სისხლში", { stages: [1, 2, 3] });
  k.label(k.anchor(group, normal.position.clone().add(v(0.55, 0, 0))), "ნორმა", { kind: "tag", stages: [1, 2, 3] });
  k.label(k.anchor(group, ISLET.clone().add(v(0, 2.1, 0))), "ლანგერჰანსის კუნძული", { stages: [1] });
  k.label(k.anchor(group, betaCells[0]), "ბეტა-უჯრედი — ინსულინი", { stages: [1, 2] });
  k.label(k.anchor(group, alphaCells[0] ?? ISLET), "ალფა-უჯრედი — გლუკაგონი", { stages: [1, 3] });
  k.label(k.anchor(group, v(-7.5, 1.6, -1.5)), "მომნელებელი წვენის უჯრედები", { stages: [1] });
  k.label(k.anchor(group, TC.clone().add(v(0, 2.1, 0))), "ღვიძლის უჯრედი", { stages: [1, 2, 3] });
  k.label(k.anchor(group, TC.clone().add(v(0.3, -0.2, 0.6))), "გლიკოგენი", { kind: "tag", stages: [2, 3] });
  k.label(k.anchor(group, cap.curve.getPointAt(0.05)), "კაპილარი", { stages: [1] });
  let level = 2.0;
  return {
    group,
    update: (t: number, mode: "idle" | "fed" | "fasting") => {
      const want = mode === "idle" ? 2.0 : mode === "fed" ? (t % 18 < 4 ? 3.6 : 2.0) : t % 18 < 4 ? 1.1 : 2.0;
      level += (want - level) * 0.01;
      fill.scale.y = level;
      insulin.update(t, mode === "fed" ? 1 : 0);
      glucagon.update(t, mode === "fasting" ? 1 : 0);
      intoCell.update(t, mode === "fed" ? 1 : 0);
      outOfCell.update(t, mode === "fasting" ? 1 : 0);
      inBlood.update(t, Math.min(1, level / 3.6));
      beta.emissiveIntensity = mode === "fed" ? 0.5 + 0.3 * Math.sin(t * 4) : 0.1;
      alpha.emissiveIntensity = mode === "fasting" ? 0.5 + 0.3 * Math.sin(t * 4) : 0.1;
      // Glycogen grows when fed, shrinks when fasting.
      const gs = mode === "fed" ? 0.16 : mode === "fasting" ? 0.07 : 0.12;
      for (const x of gly) x.scale.setScalar(x.scale.x + (gs - x.scale.x) * 0.02);
    },
  };
}
