import * as THREE from "three";
import { beads, curve, orbit } from "@/components/journeys/common";
import { ease, rng, v, type Builder, type Kit, type V3 } from "@/components/journeys/JourneyScene";
import { fbm } from "@/lib/noise";
import { beetle, bird, cloud, fish, fox, frog, grass, ground, heightAt, mushroom, natureMaterials, outdoor, rabbit, rock, sun, tree, water, type Animal, plantModel } from "./nature";

/*
 * Ecology lessons: a meadow-and-pond ecosystem, ecological factors, predators and prey with their
 * population curves, food chains and webs, the energy pyramid, the water/carbon/nitrogen cycles,
 * biodiversity, Georgia's relief from real elevation data with a satellite image, conservation, pollution
 * of water, soil and air, and the greenhouse effect on a globe.
 */

const setText = (el: HTMLDivElement, text: string) => {
  const t = el.querySelector(".blood-label-text") ?? el;
  if (t.textContent !== text) t.textContent = text;
};

interface Walker {
  a: Animal;
  x: number;
  z: number;
  dir: number;
  speed: number;
  home: V3;
  range: number;
  alive: boolean;
}

/** Animals that wander round a home spot. */
function walkers(parent: THREE.Object3D, list: { a: Animal; home: V3; range: number; speed: number; scale?: number }[], seed = 1) {
  const r = rng(seed);
  const W: Walker[] = list.map((x) => {
    x.a.g.scale.setScalar(x.scale ?? 1);
    parent.add(x.a.g);
    return { a: x.a, x: x.home.x + (r() - 0.5) * x.range, z: x.home.z + (r() - 0.5) * x.range, dir: r() * 6.28, speed: x.speed, home: x.home, range: x.range, alive: true };
  });
  return {
    W,
    update: (t: number, dt: number) =>
      W.forEach((w, i) => {
        w.a.g.visible = w.alive;
        if (!w.alive) return;
        w.dir += Math.sin(t * 0.7 + i * 2.1) * dt * 0.8;
        w.x += Math.cos(w.dir) * dt * w.speed;
        w.z += Math.sin(w.dir) * dt * w.speed;
        if (Math.hypot(w.x - w.home.x, w.z - w.home.z) > w.range) w.dir = Math.atan2(w.home.z - w.z, w.home.x - w.x);
        w.a.g.position.set(w.x, heightAt(w.x, w.z) + (w.home.y || 0), w.z);
        w.a.g.rotation.y = -w.dir + Math.PI / 2;
        w.a.move(t * 6 + i);
      }),
  };
}

const POND = v(4, 0, 2);

/** The shared meadow with a pond, wood, sun and clouds. */
function diorama(k: Kit, parent: THREE.Object3D, o: { seed?: number } = {}) {
  const M = natureMaterials(k);
  const r = rng(o.seed ?? 3);
  const gr = ground(k, parent, { flat: [v(POND.x, -0.25, POND.z)] });
  const pond = water(k, parent, v(POND.x, -0.08, POND.z), 3.2);
  grass(k, parent, 1500, 13, { avoid: (x, z) => Math.hypot(x - POND.x, z - POND.z) < 3.5 });
  const trees: THREE.Group[] = [];
  for (let i = 0; i < 14; i++) {
    const a = Math.PI * 0.95 + r() * Math.PI * 1.1;
    const d = 6 + r() * 6;
    const x = Math.cos(a) * d - 2;
    const z = Math.sin(a) * d - 1;
    trees.push(tree(k, M, parent, v(x, heightAt(x, z), z), { scale: 0.7 + r() * 0.5, kind: r() < 0.4 ? "pine" : "broad" }));
  }
  // Scanned shrubs and ferns between the trees.
  for (let i = 0; i < 10; i++) {
    const a = r() * Math.PI * 2;
    const d = 5 + r() * 7;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d - 2;
    plantModel(parent, i % 3 ? "fern" : "shrub", v(x, heightAt(x, z), z), i % 3 ? 0.5 + r() * 0.3 : 0.9 + r() * 0.5, r() * 6);
  }
  for (let i = 0; i < 5; i++) rock(k, M, parent, v(POND.x + Math.cos(i * 1.3) * 3.4, -0.1, POND.z + Math.sin(i * 1.3) * 3.4), 0.3 + r() * 0.3, i);
  const shrooms = [v(-3, 0, -2.6), v(-2.6, 0, -2.2), v(-3.3, 0, -2)].map((p) => mushroom(k, parent, v(p.x, heightAt(p.x, p.z), p.z), 2));
  const s = sun(k, parent, v(-12, 14, -18), 1.8);
  cloud(k, parent, v(-6, 10, -12), 1.5);
  cloud(k, parent, v(8, 11, -14), 1.8);
  return { M, gr, pond, trees, shrooms, sun: s };
}

const wide = (s: number, d = 19, at = v(0, 0.5, 0)) => orbit(at, d, s, { start: 0.35, speed: 0.03, height: 0.42 });

// ---- Ecosystem --------------------------------------------------------------------------------------

export const ecosystem: Builder = async (k) => {
  outdoor(k);
  const g = new THREE.Group();
  k.root.add(g);
  const D = diorama(k, g);
  const life = new THREE.Group();
  g.add(life);
  const animals = walkers(life, [
    ...Array.from({ length: 5 }, () => ({ a: rabbit(k), home: v(-1, 0, 3), range: 3, speed: 0.6 })),
    { a: fox(k), home: v(-4, 0, 1), range: 3, speed: 0.8, scale: 1.3 },
    { a: frog(k), home: v(POND.x - 3.3, 0, POND.z), range: 0.4, speed: 0.2, scale: 2 },
    ...Array.from({ length: 3 }, () => ({ a: beetle(k, "#2e5a2a"), home: v(0, 0, 0), range: 3, speed: 0.3, scale: 2.5 })),
  ]);
  const fishes = Array.from({ length: 4 }, (_, i) => {
    const f = fish(k, i % 2 ? "#d98a3a" : "#8aa0b0");
    g.add(f.g);
    return f;
  });
  const birds = Array.from({ length: 3 }, () => {
    const b = bird(k);
    b.g.scale.setScalar(1.6);
    life.add(b.g);
    return b;
  });
  // Energy: sunlight to plants, then along the food chain; matter back through decomposers.
  const rays = [v(-1, 0.5, 3), v(-6, 3, -4), v(2, 0.5, -3)].map((to, i) => beads(k, g, curve([D.sun.position, D.sun.position.clone().lerp(to, 0.5), to]), { n: 20, color: "#ffd23f", size: 0.12, speed: 0.12, seed: i + 1, emissive: 1 }));
  const chain = beads(k, life, curve([v(-1, 0.4, 3), v(-2.5, 1.5, 2.5), v(-4, 0.6, 1)]), { n: 10, color: "#ff8a3a", size: 0.13, speed: 0.15, seed: 5 });
  const back = beads(k, life, curve([v(-4, 0.3, 1), v(-3.3, 0.5, -1.2), v(-3, 0.2, -2.4), v(-1, 0.1, 0)]), { n: 12, color: "#8a6a4a", size: 0.1, speed: 0.12, seed: 6 });
  const L = (p: V3, t: string, st: number[], o: THREE.Object3D = g) => k.label(k.anchor(o, p), t, { stages: st });
  L(D.sun.position, "მზის ენერგია", [0, 2]);
  L(v(POND.x, 0.3, POND.z), "წყალი", [0]);
  L(v(1, 0.3, 5), "ნიადაგი", [0]);
  L(v(5, 5, -6), "ჰაერი", [0]);
  L(v(-6, 4.5, -4), "მწარმოებლები — მცენარეები", [1], life);
  L(v(-1, 1, 3), "მომხმარებლები — ცხოველები", [1], life);
  L(v(-3, 1.2, -2.4), "დამშლელები — სოკოები, ბაქტერიები", [1, 2], life);
  L(v(-2.5, 1.9, 2.5), "ენერგია კვებით ჯაჭვში", [2], life);
  const trees = D.trees;
  let stage = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      enter: () => (stage = i),
      update: (u: number, s: number, t: number, dt: number) => {
        D.pond.update(t);
        // In the biotope stage only the non-living part shows; life grows in after.
        const grow = stage === 0 ? 0.001 : stage === 1 ? Math.max(0.001, ease(u / 0.4)) : 1;
        life.visible = stage > 0;
        trees.forEach((tr, j) => tr.scale.setScalar((0.7 + (j % 3) * 0.2) * grow));
        D.shrooms.forEach((m) => m.scale.setScalar(2 * grow));
        animals.update(t, dt);
        fishes.forEach((f, j) => {
          const a = t * 0.5 + j * 1.6;
          f.g.visible = stage > 0;
          f.g.position.set(POND.x + Math.cos(a) * 1.6, -0.35, POND.z + Math.sin(a) * 1.6);
          f.g.rotation.y = -a;
          f.move(t * 3);
        });
        birds.forEach((b, j) => {
          const a = t * 0.4 + j * 2;
          b.g.position.set(Math.cos(a) * 7, 5 + j, Math.sin(a) * 5 - 2);
          b.g.rotation.y = -a;
          b.move(t * 5);
        });
        rays.forEach((r) => r.update(t, stage === 1 ? 0 : 1));
        chain.update(t, stage === 2 ? 1 : 0);
        back.update(t, stage === 2 ? 1 : 0);
        return wide(s);
      },
    })),
  };
};

// ---- Ecological factors ------------------------------------------------------------------------------

export const ecoFactors: Builder = async (k) => {
  outdoor(k);
  const g = new THREE.Group();
  k.root.add(g);
  const D = diorama(k, g);
  // Abiotic: plants in a row under lamps of increasing brightness.
  const row = new THREE.Group();
  g.add(row);
  const plants = [0, 1, 2, 3, 4].map((i) => {
    const x = -3 + i * 1.5;
    const p = new THREE.Group();
    p.position.set(x, heightAt(x, 4) + 0.02, 4);
    const pot = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.35, 0.25, 0.5, 16)), k.material({ color: "#b5603a", roughness: 0.7 }));
    pot.position.y = 0.25;
    const stem = new THREE.Mesh(k.cylinder, k.material({ color: "#4f8a3a" }));
    const crown = new THREE.Mesh(D.M.crowns[i % 4], D.M.leaf);
    p.add(pot, stem, crown);
    row.add(p);
    const lamp = new THREE.Mesh(k.sphere, k.material({ color: "#fff2b0", emissive: "#ffd23f", emissiveIntensity: 0.2 + i * 0.4 }));
    lamp.position.set(x, 3.2, 4);
    lamp.scale.setScalar(0.25);
    row.add(lamp);
    k.label(k.anchor(row, v(x, 3.6, 4)), ["ძალიან ცოტა", "ცოტა", "ოპტიმუმი", "ბევრი", "ზედმეტი"][i], { kind: "tag", stages: [0] });
    return { stem, crown, i };
  });
  // Biotic: a bee between flowers and the fox after a rabbit.
  const flowers = [v(0, 0, -1), v(1.5, 0, -1.8), v(-1.2, 0, -2)].map((p) => {
    const f = new THREE.Mesh(k.sphere, k.material({ color: "#e05a8a", roughness: 0.5 }));
    f.position.set(p.x, heightAt(p.x, p.z) + 0.6, p.z);
    f.scale.set(0.3, 0.1, 0.3);
    g.add(f);
    return f.position.clone();
  });
  const bee = beetle(k, "#e0a12a");
  bee.g.scale.setScalar(2.5);
  g.add(bee.g);
  const fx = fox(k);
  const rb = rabbit(k);
  g.add(fx.g, rb.g);
  // Anthropogenic: a factory with smoke, felled trees.
  const factory = new THREE.Group();
  g.add(factory);
  const wall = new THREE.Mesh(k.track(new THREE.BoxGeometry(3, 2, 2)), k.material({ color: "#8a8a8a", roughness: 0.8 }));
  wall.position.set(8, 1, -4);
  const chim = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.3, 0.4, 4, 12)), k.material({ color: "#6a5a5a", roughness: 0.8 }));
  chim.position.set(9, 3, -4.4);
  factory.add(wall, chim);
  const smoke = beads(k, factory, curve([v(9, 5, -4.4), v(9.5, 7, -5), v(11, 9, -6), v(13, 10, -8)]), { n: 40, color: "#6a6a6a", size: 0.5, speed: 0.06, spread: 0.6, emissive: 0 });
  const label = k.label(k.anchor(g, v(0, 6, 0)), "", { kind: "tag" });
  k.label(k.anchor(g, v(8, 2.4, -3)), "ქარხანა", { stages: [2] });
  k.label(k.anchor(g, flowers[0].clone().add(v(0, 0.4, 0))), "დამტვერვა", { stages: [1] });
  let stage = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      enter: () => (stage = i),
      update: (u: number, s: number, t: number) => {
        D.pond.update(t);
        row.visible = stage === 0;
        // Growth follows the light up to the optimum, then falls (too much light and heat).
        plants.forEach(({ stem, crown, i: j }) => {
          const best = [0.35, 0.7, 1, 0.8, 0.45][j] * ease(stage === 0 ? u / 0.6 : 1);
          stem.scale.set(0.05, 0.4 + 1.6 * best, 0.05);
          stem.position.y = 0.5 + stem.scale.y / 2;
          crown.position.y = 0.6 + stem.scale.y;
          crown.scale.setScalar(0.15 + 0.45 * best);
          (crown.material as THREE.MeshPhysicalMaterial).color.set("#4f8a3a");
        });
        bee.g.visible = fx.g.visible = rb.g.visible = stage === 1;
        if (stage === 1) {
          const f = (t / 2) % flowers.length;
          const a = flowers[Math.floor(f)];
          const b = flowers[(Math.floor(f) + 1) % flowers.length];
          bee.g.position.lerpVectors(a, b, ease(f % 1)).add(v(0, 0.3 + Math.sin(ease(f % 1) * Math.PI) * 0.8, 0));
          bee.move(t * 4);
          const c = (s % 6) / 6;
          rb.g.position.set(-2 + c * 6, heightAt(-2 + c * 6, 3), 3);
          rb.g.rotation.y = Math.PI / 2;
          rb.move(t * 9);
          fx.g.position.set(-4 + c * 6, heightAt(-4 + c * 6, 3), 3);
          fx.g.rotation.y = Math.PI / 2;
          fx.g.scale.setScalar(1.3);
          fx.move(t * 10);
        }
        factory.visible = stage === 2;
        smoke.update(t, stage === 2 ? 1 : 0);
        // Trees fall one by one.
        D.trees.forEach((tr, j) => (tr.rotation.z = stage === 2 && j < 6 ? -Math.PI / 2 * ease((u - j * 0.1) / 0.15) : 0));
        setText(label, ["აბიოტური: სინათლე", "ბიოტური: ცოცხალი ორგანიზმები", "ანთროპოგენური: ადამიანი"][stage]);
        return wide(s, stage === 0 ? 12 : 19, stage === 0 ? v(0, 1, 3) : v(0, 0.5, 0));
      },
    })),
  };
};

// ---- Predators and prey ------------------------------------------------------------------------------

export const predatorPrey: Builder = async (k) => {
  outdoor(k);
  const g = new THREE.Group();
  k.root.add(g);
  diorama(k, g, { seed: 7 });
  const R = walkers(g, Array.from({ length: 24 }, () => ({ a: rabbit(k), home: v(-1, 0, 1), range: 6, speed: 0.7 })), 2);
  const F = walkers(g, Array.from({ length: 6 }, () => ({ a: fox(k), home: v(-1, 0, 1), range: 6, speed: 1, scale: 1.3 })), 3);
  const extra = walkers(g, [...Array.from({ length: 4 }, () => ({ a: frog(k), home: v(POND.x, 0, POND.z), range: 3.5, speed: 0.2, scale: 2 })), ...Array.from({ length: 5 }, () => ({ a: beetle(k, "#6a3a2a"), home: v(0, 0, 0), range: 4, speed: 0.3, scale: 2.5 }))], 4);
  // A chart that draws the two populations over time.
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const tex = k.track(new THREE.CanvasTexture(cv));
  tex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(k.track(new THREE.PlaneGeometry(8, 4)), k.material({ map: tex, roughness: 0.9, clearcoat: 0, side: THREE.DoubleSide }));
  panel.position.set(0, 7.5, -8);
  g.add(panel);
  const ctx = cv.getContext("2d")!;
  // Lotka–Volterra-like curves (rabbits lead, foxes lag).
  const rab = (x: number) => 0.55 + 0.35 * Math.sin(x);
  const fx = (x: number) => 0.45 + 0.3 * Math.sin(x - 1.2);
  const draw = (upto: number) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = "#ccd5d2";
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 10, 470, 220);
    for (const [f, col] of [
      [rab, "#8a6a4a"],
      [fx, "#d9622a"],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let i = 0; i <= 200 * upto; i++) {
        const x = 30 + (470 * i) / 200;
        const y = 230 - 210 * f((i / 200) * Math.PI * 4);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = "#8a6a4a";
    ctx.fillText("კურდღლები", 40, 32);
    ctx.fillStyle = "#d9622a";
    ctx.fillText("მელიები", 200, 32);
    tex.needsUpdate = true;
  };
  let stage = 0;
  let lastDraw = -1;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 18,
      enter: () => {
        stage = i;
        lastDraw = -1;
      },
      update: (u: number, s: number, t: number, dt: number) => {
        const x = (stage === 0 ? u * 0.5 : stage === 1 ? 0.5 + u * 0.5 : 1) * Math.PI * 4;
        const nr = Math.round(24 * rab(x));
        const nf = Math.round(6 * fx(x));
        R.W.forEach((w, j) => (w.alive = j < nr));
        F.W.forEach((w, j) => (w.alive = j < nf));
        R.update(t, dt);
        F.update(t, dt);
        extra.W.forEach((w) => (w.alive = stage === 2));
        extra.update(t, dt);
        const upto = Math.min(1, x / (Math.PI * 4));
        if (Math.abs(upto - lastDraw) > 0.01) {
          draw(upto);
          lastDraw = upto;
        }
        return stage === 1 ? { target: v(0, 6, -6), pos: v(0, 7, 6) } : wide(s, 20, v(0, 1.5, -1));
      },
    })),
  };
};

// ---- Food chain and web --------------------------------------------------------------------------------

export const foodChain: Builder = async (k) => {
  outdoor(k);
  const g = new THREE.Group();
  k.root.add(g);
  const D = diorama(k, g, { seed: 11 });
  const at = { grass: v(-4.5, 0, 4), rabbit: v(-1.5, 0, 5), fox: v(1.2, 0, 6), bird: v(-1, 3.2, 2), beetle: v(-3.5, 0, 1.5), frog: v(0.6, 0, 1.6) };
  for (const p of Object.values(at)) p.y = heightAt(p.x, p.z) + p.y;
  const tuft = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.06, 0.9, 4).translate(0, 0.45, 0)), k.material({ color: "#5e9e3a" }));
    b.position.set(Math.cos(i) * 0.3, 0, Math.sin(i * 1.7) * 0.3);
    b.rotation.set(Math.sin(i) * 0.3, 0, Math.cos(i) * 0.3);
    tuft.add(b);
  }
  tuft.position.copy(at.grass);
  tuft.scale.setScalar(1.6);
  g.add(tuft);
  const rb = rabbit(k);
  rb.g.position.copy(at.rabbit);
  rb.g.scale.setScalar(1.6);
  const fx = fox(k);
  fx.g.position.copy(at.fox);
  fx.g.scale.setScalar(1.7);
  fx.g.rotation.y = -Math.PI / 2;
  rb.g.rotation.y = -Math.PI / 2;
  const web = new THREE.Group();
  const bd = bird(k, "#4a5a7a");
  bd.g.position.copy(at.bird);
  bd.g.scale.setScalar(2.5);
  const bt = beetle(k, "#2e5a2a");
  bt.g.position.copy(at.beetle);
  bt.g.scale.setScalar(4);
  const fr = frog(k);
  fr.g.position.copy(at.frog);
  fr.g.scale.setScalar(3.5);
  web.add(bd.g, bt.g, fr.g);
  g.add(rb.g, fx.g, web);
  const arc = (a: V3, b: V3, h = 1.6) => curve([a.clone().add(v(0, 0.6, 0)), a.clone().lerp(b, 0.5).add(v(0, h, 0)), b.clone().add(v(0, 0.6, 0))]);
  const sunToGrass = beads(k, g, curve([D.sun.position, D.sun.position.clone().lerp(at.grass, 0.5), at.grass.clone().add(v(0, 1, 0))]), { n: 24, color: "#ffd23f", size: 0.12, speed: 0.12, emissive: 1 });
  const flows = [
    [at.grass, at.rabbit, 0],
    [at.rabbit, at.fox, 0],
    [at.grass, at.beetle, 1],
    [at.beetle, at.frog, 1],
    [at.frog, at.bird, 1],
    [at.beetle, at.bird, 1],
    [at.fox, D.shrooms[0].position, 1],
  ].map(([a, b, webOnly], i) => ({ b: beads(k, g, arc(a as V3, b as V3), { n: 10, color: i === 6 ? "#8a6a4a" : "#ff8a3a", size: 0.14, speed: 0.18, seed: i + 3 }), webOnly }));
  const L = (p: V3, t: string, st: number[]) => k.label(k.anchor(g, p.clone().add(v(0, 1.4, 0))), t, { stages: st });
  L(at.grass, "ბალახი — მწარმოებელი", [0, 1, 2]);
  L(at.rabbit, "კურდღელი — I რიგის მომხმარებელი", [1, 2]);
  L(at.fox, "მელა — II რიგის მომხმარებელი", [1, 2]);
  L(D.shrooms[0].position, "სოკოები — დამშლელები", [2]);
  L(at.bird, "ფრინველი", [2]);
  L(at.beetle, "ხოჭო", [2]);
  L(at.frog, "ბაყაყი", [2]);
  let stage = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      enter: () => (stage = i),
      update: (_u: number, s: number, t: number) => {
        D.pond.update(t);
        sunToGrass.update(t);
        rb.g.visible = fx.g.visible = stage >= 1;
        web.visible = stage === 2;
        flows.forEach(({ b, webOnly }) => b.update(t, stage === 0 ? 0 : webOnly && stage < 2 ? 0 : 1));
        bd.move(t * 3);
        rb.move(t * 2);
        return orbit(v(-1.5, 1, 4), stage === 0 ? 9 : 12, s, { start: 0.1, speed: 0.025, height: 0.3 });
      },
    })),
  };
};

// ---- Energy pyramid -----------------------------------------------------------------------------------

export const pyramid: Builder = async (k) => {
  k.mood("#e7eef0", 30, 70);
  const g = new THREE.Group();
  k.root.add(g);
  const levels = [
    { w: 9, c: "#5e9e3a", t: "მწარმოებლები — 1000 კჯ" },
    { w: 6, c: "#c9a03a", t: "I რიგის მომხმარებლები — 100 კჯ" },
    { w: 3.6, c: "#d9622a", t: "II რიგის მომხმარებლები — 10 კჯ" },
    { w: 1.8, c: "#a83a2a", t: "III რიგის მომხმარებელი — 1 კჯ" },
  ];
  const H = 1.4;
  const steps = levels.map((L, i) => {
    const m = new THREE.Mesh(k.track(new THREE.BoxGeometry(L.w, H, L.w)), k.material({ color: L.c, roughness: 0.6, clearcoat: 0.3 }));
    m.position.y = H / 2 + i * H;
    g.add(m);
    k.label(k.anchor(g, v(L.w / 2 + 0.2, H / 2 + i * H, L.w / 2)), L.t, { stages: [0, 1] });
    return m;
  });
  // Occupants for the numbers pyramid.
  const occ = new THREE.Group();
  g.add(occ);
  const M = natureMaterials(k);
  const r = rng(4);
  for (let i = 0; i < 30; i++) tree(k, M, occ, v((r() - 0.5) * 8, H, (r() - 0.5) * 8), { scale: 0.18 + r() * 0.06, seed: i });
  for (let i = 0; i < 10; i++) {
    const a = rabbit(k);
    a.g.position.set((r() - 0.5) * 5, 2 * H, (r() - 0.5) * 5);
    a.g.rotation.y = r() * 6;
    a.g.scale.setScalar(0.9);
    occ.add(a.g);
  }
  for (let i = 0; i < 3; i++) {
    const a = fox(k);
    a.g.position.set((i - 1) * 1.1, 3 * H, (r() - 0.5) * 2);
    a.g.scale.setScalar(0.9);
    occ.add(a.g);
  }
  const eagle = bird(k, "#5a4030");
  eagle.g.position.set(0, 4 * H + 0.3, 0);
  eagle.g.scale.setScalar(2.4);
  occ.add(eagle.g);
  // Energy rising; most of it leaves each level as heat.
  const up = beads(k, g, curve([v(0, 0.2, 4.6), v(0, 2.2, 3.1), v(0, 3.6, 1.9), v(0, 5.0, 1), v(0, 5.9, 0.4)]), { n: 30, color: "#ffd23f", size: 0.16, speed: 0.08, emissive: 1 });
  const heat = [0, 1, 2].map((i) =>
    beads(k, g, curve([v(0, H * (i + 0.7), levels[i].w / 2), v(1.5 + i, H * (i + 1.2), levels[i].w / 2 + 1.5), v(4 + i, H * (i + 2), levels[i].w / 2 + 3)]), { n: 16, color: "#e0524a", size: 0.13, speed: 0.15, seed: 10 + i, emissive: 0.8 }),
  );
  k.label(k.anchor(g, v(4, H * 2.2, 6)), "≈90% — სითბოდ იფანტება", { kind: "tag", stages: [1] });
  let stage = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      enter: () => (stage = i),
      update: (u: number, s: number, t: number) => {
        steps.forEach((m, j) => m.scale.set(1, stage === 0 ? Math.max(0.001, ease(u * 2.2 - j * 0.35)) : 1, 1));
        steps.forEach((m, j) => (m.position.y = H * j + (H * m.scale.y) / 2));
        occ.visible = stage === 2;
        up.update(t, stage >= 1 ? 1 : 0);
        heat.forEach((h) => h.update(t, stage === 1 ? 1 : 0));
        eagle.move(t * 3);
        return orbit(v(0, 2.6, 0), 17, s, { start: 0.5, speed: 0.03, height: 0.35 });
      },
    })),
  };
};

// ---- Cycles -----------------------------------------------------------------------------------------------

export const cycles: Builder = async (k) => {
  outdoor(k, "#bcd8ea", 30, 75);
  const g = new THREE.Group();
  k.root.add(g);
  const M = natureMaterials(k);
  // A coast: land rising to a mountain on the left, the sea on the right.
  const geo = k.track(new THREE.PlaneGeometry(40, 24, 160, 96).rotateX(-Math.PI / 2));
  const p = geo.attributes.position as THREE.BufferAttribute;
  const cols = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const h = Math.max(-1.5, 7 * Math.exp(-(((x + 12) / 6) ** 2) - ((z + 4) / 6) ** 2) + 0.8 * fbm(x * 0.15, 0, z * 0.15, 3) - 0.12 * (x + 2));
    p.setY(i, h);
    c.set(h > 5 ? "#e8eef0" : h > 2.5 ? "#7a7a6a" : h > 0.1 ? "#6f9c48" : "#c9b48a");
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.computeVertexNormals();
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.add(new THREE.Mesh(geo, k.material({ color: "#ffffff", vertexColors: true, roughness: 0.95, clearcoat: 0, normalMap: k.normalMap("organic", [20, 12]), normalScale: new THREE.Vector2(0.4, 0.4) })));
  const sea = water(k, g, v(10, -0.15, 0), 16, "#2f6f95");
  const forest = [v(-4, 0, 2), v(-6, 0, 5), v(-2, 0, 4), v(-7, 0, 1), v(-3, 0, -1)].map((q, i) => tree(k, M, g, v(q.x, 0.5, q.z), { scale: 0.8, seed: i, kind: i % 2 ? "pine" : "broad" }));
  void forest;
  const s = sun(k, g, v(14, 16, -16), 2);
  const cl = cloud(k, g, v(-4, 11, -2), 2.2);
  const rabbits = [rabbit(k), rabbit(k)];
  rabbits.forEach((a, i) => {
    a.g.position.set(-1 + i, 0.6, 4);
    a.g.scale.setScalar(1.5);
    g.add(a.g);
  });
  const fac = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.4, 0.5, 4, 12)), k.material({ color: "#6a5a5a" }));
  fac.position.set(1.5, 2, -4);
  g.add(fac);
  const r = rng(3);
  // Water.
  const evap = Array.from({ length: 3 }, (_, i) => beads(k, g, curve([v(6 + i * 3, 0, 0), v(4 + i * 2, 5, -1), v(-2, 10.5, -2)]), { n: 14, color: "#9fd0f0", size: 0.16, speed: 0.08, seed: i + 1, spread: 0.8 }));
  const rain = new THREE.InstancedMesh(k.sphere, k.material({ color: "#6fb0e0", emissive: "#6fb0e0", emissiveIntensity: 0.3 }), 160);
  rain.frustumCulled = false;
  g.add(rain);
  const drops = Array.from({ length: 160 }, () => ({ x: -4 + (r() - 0.5) * 5, z: -2 + (r() - 0.5) * 3, y: r() * 10, sp: 3 + r() * 2 }));
  const river = beads(k, g, curve([v(-10, 4, -3), v(-7, 2, -1), v(-4, 0.6, 0.5), v(0, 0.2, 1.5), v(5, -0.1, 1)]), { n: 30, color: "#4a90c8", size: 0.18, speed: 0.08, seed: 9 });
  // Carbon.
  const co2Geo = k.track(new THREE.SphereGeometry(1, 10, 8));
  const toTrees = beads(k, g, curve([v(2, 7, -2), v(-1, 5, 0), v(-4, 3.5, 2)]), { n: 24, color: "#555555", size: 0.17, speed: 0.08, seed: 21, spread: 1, geometry: co2Geo, emissive: 0.1 });
  const fromAnimals = beads(k, g, curve([v(-0.5, 1, 4), v(0.5, 3.5, 2), v(2, 7, -2)]), { n: 14, color: "#555555", size: 0.17, speed: 0.08, seed: 22, spread: 0.5, geometry: co2Geo, emissive: 0.1 });
  const fromFactory = beads(k, g, curve([v(1.5, 4.2, -4), v(2, 6, -3), v(2, 7, -2)]), { n: 18, color: "#333333", size: 0.2, speed: 0.1, seed: 23, spread: 0.4, geometry: co2Geo, emissive: 0 });
  // Nitrogen.
  const nIn = beads(k, g, curve([v(-6, 8, 3), v(-6, 3, 3), v(-5, 0.3, 3)]), { n: 18, color: "#7a5ad0", size: 0.15, speed: 0.1, seed: 31, spread: 0.5 });
  const nUp = beads(k, g, curve([v(-5, 0.3, 3), v(-4.5, 1.5, 2.5), v(-4, 3, 2)]), { n: 12, color: "#7a5ad0", size: 0.15, speed: 0.12, seed: 32 });
  const nAnimal = beads(k, g, curve([v(-4, 2.5, 2), v(-2, 2, 3.5), v(-0.5, 1, 4)]), { n: 12, color: "#7a5ad0", size: 0.15, speed: 0.12, seed: 33 });
  const L = (q: V3, t: string, st: number[]) => k.label(k.anchor(g, q), t, { stages: st });
  L(v(6, 3, 0), "აორთქლება", [0]);
  L(v(-4, 12.5, -2), "კონდენსაცია — ღრუბელი", [0]);
  L(v(-4, 6, -2), "ნალექი", [0]);
  L(v(0, 0.8, 1.5), "მდინარე → ზღვა", [0]);
  L(v(-1, 5, 0), "CO₂ → ფოტოსინთეზი", [1]);
  L(v(0.5, 3.5, 2), "სუნთქვა → CO₂", [1]);
  L(v(2, 5.5, -3.5), "წვა → CO₂", [1]);
  L(v(-6, 5, 3), "ჰაერის აზოტი (N₂)", [2]);
  L(v(-5, 0.6, 3.4), "კოჟრის ბაქტერიები", [2]);
  L(v(-2, 2.4, 3.6), "ცილები → ცხოველს", [2]);
  const m4 = new THREE.Matrix4();
  let stage = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 17,
      enter: () => (stage = i),
      update: (_u: number, s0: number, t: number) => {
        sea.update(t);
        evap.forEach((b) => b.update(t, stage === 0 ? 1 : 0));
        river.update(t, stage === 0 ? 1 : 0);
        rain.visible = stage === 0;
        if (stage === 0) {
          drops.forEach((d, j) => {
            let y = (d.y - t * d.sp) % 10;
            if (y < 0) y += 10;
            m4.compose(v(d.x, y + 0.5, d.z), new THREE.Quaternion(), v(0.05, 0.14, 0.05));
            rain.setMatrixAt(j, m4);
          });
          rain.instanceMatrix.needsUpdate = true;
        }
        toTrees.update(t, stage === 1 ? 1 : 0);
        fromAnimals.update(t, stage === 1 ? 1 : 0);
        fromFactory.update(t, stage === 1 ? 1 : 0);
        nIn.update(t, stage === 2 ? 1 : 0);
        nUp.update(t, stage === 2 ? 1 : 0);
        nAnimal.update(t, stage === 2 ? 1 : 0);
        rabbits.forEach((a, j) => a.move(t * 2 + j));
        void s;
        void cl;
        return orbit(v(-1, 3, 0), 26, s0, { start: 0.15, speed: 0.02, height: 0.35 });
      },
    })),
  };
};

// ---- Biodiversity ------------------------------------------------------------------------------------------

export const biodiversity: Builder = async (k) => {
  outdoor(k);
  const g = new THREE.Group();
  k.root.add(g);
  const D = diorama(k, g, { seed: 21 });
  const rich = new THREE.Group();
  g.add(rich);
  const r = rng(9);
  const flowerMats = ["#e05a8a", "#f2c230", "#7a5ad0", "#ffffff"].map((c) => k.material({ color: c, roughness: 0.5 }));
  const flowers: THREE.Mesh[] = [];
  for (let i = 0; i < 60; i++) {
    const x = (r() - 0.5) * 12;
    const z = (r() - 0.5) * 8 + 2;
    if (Math.hypot(x - POND.x, z - POND.z) < 3.5) continue;
    const f = new THREE.Mesh(k.sphere, flowerMats[i % 4]);
    f.position.set(x, heightAt(x, z) + 0.45, z);
    f.scale.set(0.16, 0.08, 0.16);
    rich.add(f);
    flowers.push(f);
  }
  const fauna = walkers(rich, [
    ...Array.from({ length: 4 }, () => ({ a: rabbit(k), home: v(-1, 0, 2), range: 4, speed: 0.6 })),
    { a: fox(k), home: v(-3, 0, 0), range: 3, speed: 0.8, scale: 1.3 },
    ...Array.from({ length: 3 }, () => ({ a: frog(k), home: v(POND.x, 0, POND.z), range: 3.6, speed: 0.2, scale: 2 })),
  ]);
  const bees = Array.from({ length: 6 }, () => {
    const b = beetle(k, "#e0a12a");
    b.g.scale.setScalar(2.4);
    rich.add(b.g);
    return b;
  });
  const birds = Array.from({ length: 4 }, (_, i) => {
    const b = bird(k, ["#4a6fa5", "#a5404a", "#5a8a3a", "#6a5a48"][i]);
    b.g.scale.setScalar(1.6);
    rich.add(b.g);
    return b;
  });
  // A wheat field for the monoculture.
  const field = new THREE.Group();
  g.add(field);
  const wheatMat = k.material({ color: "#d9b44a", roughness: 0.7 });
  const wheatGeo = k.track(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 4).translate(0, 0.6, 0));
  const N = 900;
  const wheat = new THREE.InstancedMesh(wheatGeo, wheatMat, N);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < N; i++) {
    const x = -7 + (i % 45) * 0.3;
    const z = -1 + Math.floor(i / 45) * 0.35;
    m4.compose(v(x, heightAt(x, z), z), new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2)), v(1, 0.9 + r() * 0.2, 1));
    wheat.setMatrixAt(i, m4);
  }
  field.add(wheat);
  const pests = Array.from({ length: 40 }, () => {
    const b = beetle(k, "#3a2a1a");
    b.g.scale.setScalar(2);
    b.g.position.set(-7 + r() * 13, 0, -1 + r() * 7);
    field.add(b.g);
    return b;
  });
  const tag = k.label(k.anchor(g, v(0, 5.5, 0)), "", { kind: "tag" });
  let stage = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      enter: () => (stage = i),
      update: (u: number, s: number, t: number, dt: number) => {
        D.pond.update(t);
        rich.visible = stage !== 1;
        field.visible = stage === 1;
        D.pond.mesh.visible = stage !== 1;
        D.trees.forEach((tr) => (tr.visible = stage !== 1));
        fauna.update(t, dt);
        // Pollinators vanish in the last stage; flowers set no fruit and the birds leave.
        const loss = stage === 2 ? ease((u - 0.1) / 0.5) : 0;
        bees.forEach((b, j) => {
          b.g.visible = j >= 6 * loss;
          const f = flowers[(Math.floor(t / 2) + j * 7) % flowers.length];
          b.g.position.copy(f.position).add(v(Math.sin(t * 3 + j) * 0.4, 0.4 + Math.sin(t * 5 + j) * 0.2, Math.cos(t * 3 + j) * 0.4));
          b.move(t * 4);
        });
        flowers.forEach((f) => f.scale.set(0.16 * (1 - 0.6 * loss), 0.08, 0.16 * (1 - 0.6 * loss)));
        birds.forEach((b, j) => {
          const a = t * 0.4 + j * 1.5;
          const leave = stage === 2 ? ease((u - 0.5) / 0.4) : 0;
          b.g.position.set(Math.cos(a) * 6 + leave * 20, 4 + j * 0.6 + leave * 6, Math.sin(a) * 4);
          b.g.rotation.y = -a;
          b.move(t * 5);
        });
        pests.forEach((p, j) => {
          p.g.visible = stage === 1 && j < 5 + 35 * ease(u);
          p.g.position.y = heightAt(p.g.position.x, p.g.position.z) + 1.1;
          p.move(t * 3 + j);
        });
        setText(tag, ["ბევრი სახეობა — ბევრი კავშირი", "ერთი სახეობა — მავნებლები მრავლდება", loss < 0.5 ? "დამტვერავები ქრებიან…" : "…ყვავილები ნაყოფს არ იძლევა, ფრინველები მიდიან"][stage]);
        return wide(s, 17);
      },
    })),
  };
};

// ---- Georgia: relief from elevation data with the satellite image ------------------------------------------

interface GeoMeta {
  width: number;
  height: number;
  detail: [number, number];
  lon: [number, number];
  lat: [number, number];
}

export const georgiaBio: Builder = async (k) => {
  k.mood("#cfdde6", 60, 160);
  const [meta, buf, sat] = await Promise.all([
    fetch("/geo/georgia-terrain.json?v=2026-10-04").then((r) => r.json() as Promise<GeoMeta>),
    fetch("/geo/georgia-terrain.bin.gz?v=2026-10-04").then((r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()),
    new THREE.TextureLoader().loadAsync("/geo/georgia-satellite.jpg?v=2026-10-04"),
  ]);
  sat.colorSpace = THREE.SRGBColorSpace;
  sat.anisotropy = 8;
  k.track(sat);
  const [DW, DH] = meta.detail;
  const coded = new Int16Array(buf, 0, DW * DH);
  // Heights (each row: first value, then differences), sampled down to a light grid.
  const step = 6;
  const GW = Math.floor(DW / step);
  const GH = Math.floor(DH / step);
  const rowVals = new Int16Array(DW);
  const hgrid = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) {
    const row = j * step;
    let val = 0;
    for (let i = 0; i < DW; i++) {
      const kk = row * DW + i;
      val = i === 0 ? coded[kk] : val + coded[kk];
      rowVals[i] = val;
    }
    for (let i = 0; i < GW; i++) hgrid[j * GW + i] = rowVals[i * step];
  }
  const SIZE = 60;
  const aspect = DH / DW;
  const geo = k.track(new THREE.PlaneGeometry(SIZE, SIZE * aspect, GW - 1, GH - 1).rotateX(-Math.PI / 2));
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(0, hgrid[i]) * 0.0016);
  geo.computeVertexNormals();
  const terrain = new THREE.Mesh(geo, k.material({ map: sat, roughness: 0.95, clearcoat: 0 }));
  const g = new THREE.Group();
  k.root.add(g);
  g.add(terrain);
  const sea = new THREE.Mesh(k.track(new THREE.PlaneGeometry(SIZE * 1.4, SIZE * aspect * 1.4).rotateX(-Math.PI / 2)), k.material({ color: "#2f6f95", roughness: 0.1, clearcoat: 1 }));
  sea.position.y = 0.02;
  g.add(sea);
  // Lon/lat → scene.
  const at = (lon: number, lat: number, lift = 0.6) => {
    const x = ((lon - meta.lon[0]) / (meta.lon[1] - meta.lon[0]) - 0.5) * SIZE;
    const z = ((lat - meta.lat[0]) / (meta.lat[1] - meta.lat[0]) - 0.5) * SIZE * aspect;
    const gi = Math.round(((x / SIZE + 0.5) * (GW - 1)));
    const gj = Math.round(((z / (SIZE * aspect) + 0.5) * (GH - 1)));
    const h = Math.max(0, hgrid[THREE.MathUtils.clamp(gj, 0, GH - 1) * GW + THREE.MathUtils.clamp(gi, 0, GW - 1)]) * 0.0016;
    return v(x, h + lift, z);
  };
  const zones: [number, number, string][] = [
    [41.65, 42.0, "კოლხეთის დაბლობი — ტენიანი ტყეები"],
    [43.4, 41.85, "ფოთლოვანი ტყეები"],
    [44.65, 42.65, "ალპური მდელოები, მყინვარები"],
    [45.7, 41.4, "ნახევარუდაბნო — ვაშლოვანი"],
  ];
  zones.forEach(([lo, la, t]) => k.label(k.anchor(g, at(lo, la)), t, { stages: [0] }));
  const endemics: [number, number, string][] = [
    [45.2, 42.5, "კავკასიური ჯიხვი"],
    [43.0, 42.9, "კავკასიური როჭო"],
    [42.1, 41.75, "კავკასიური სალამანდრა"],
    [45.9, 41.85, "კავკასიური ირემი (ლაგოდეხი)"],
  ];
  endemics.forEach(([lo, la, t]) => k.label(k.anchor(g, at(lo, la)), t, { stages: [1] }));
  const parks: [number, number, string][] = [
    [43.3, 41.85, "ბორჯომ-ხარაგაული"],
    [45.6, 42.4, "თუშეთი"],
    [46.2, 41.85, "ლაგოდეხი"],
    [46.0, 41.25, "ვაშლოვანი"],
    [41.75, 42.05, "კოლხეთი"],
    [42.65, 42.45, "მტირალა / ატაპი"],
  ];
  const pinMat = k.material({ color: "#0f8a74", emissive: "#0f8a74", emissiveIntensity: 0.5 });
  const pins = parks.map(([lo, la, t]) => {
    const pin = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.35, 1.2, 12).rotateX(Math.PI)), pinMat);
    pin.position.copy(at(lo, la, 0.8));
    g.add(pin);
    k.label(k.anchor(g, at(lo, la, 1.6)), t, { stages: [2] });
    return pin;
  });
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      enter: () => pins.forEach((x) => (x.visible = i === 2)),
      update: (_u: number, s: number) => orbit(v(2, 0, 0), 50, s, { start: 0.0 + Math.sin(s * 0.1) * 0.15, speed: 0, height: 0.75 }),
    })),
  };
};

// ---- Conservation ---------------------------------------------------------------------------------------------

export const conservation: Builder = async (k) => {
  outdoor(k);
  const g = new THREE.Group();
  k.root.add(g);
  const D = diorama(k, g, { seed: 31 });
  const stumpMat = k.material({ color: "#8a6a4a", roughness: 0.9 });
  const stumps = D.trees.map((tr) => {
    const st = new THREE.Mesh(k.cylinder, stumpMat);
    st.position.copy(tr.position).add(v(0, 0.2, 0));
    st.scale.set(0.22, 0.4, 0.22);
    g.add(st);
    return st;
  });
  const fauna = walkers(g, [...Array.from({ length: 5 }, () => ({ a: rabbit(k), home: v(-1, 0, 2), range: 4, speed: 0.6 })), { a: fox(k), home: v(-3, 0, 0), range: 3, speed: 0.8, scale: 1.3 }]);
  // The reserve's fence.
  const fence = new THREE.Group();
  g.add(fence);
  const postMat = k.material({ color: "#7a5a3a", roughness: 0.9 });
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const x = Math.cos(a) * 11;
    const z = Math.sin(a) * 9;
    const post = new THREE.Mesh(k.cylinder, postMat);
    post.position.set(x, heightAt(x, z) + 0.5, z);
    post.scale.set(0.07, 1, 0.07);
    fence.add(post);
  }
  // Seed bank: shelves with jars, and a red book.
  const bank = new THREE.Group();
  k.root.add(bank);
  const shelfMat = k.material({ color: "#c9c4b8", roughness: 0.6, metalness: 0.3 });
  const jarMat = k.ghost("#dfeff5", 0.4, { roughness: 0.05, clearcoat: 1 });
  const seedMats = ["#c9a03a", "#7a5a3a", "#5e9e3a", "#a83a2a"].map((c) => k.material({ color: c, roughness: 0.7 }));
  for (let row = 0; row < 3; row++) {
    const shelf = new THREE.Mesh(k.track(new THREE.BoxGeometry(8, 0.12, 1.2)), shelfMat);
    shelf.position.set(0, row * 1.4, 0);
    bank.add(shelf);
    for (let j = 0; j < 9; j++) {
      const jar = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 16)), jarMat);
      jar.position.set(-3.6 + j * 0.9, row * 1.4 + 0.52, 0);
      const seeds = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.27, 0.27, 0.45, 16)), seedMats[(j + row) % 4]);
      seeds.position.set(-3.6 + j * 0.9, row * 1.4 + 0.3, 0);
      bank.add(jar, seeds);
    }
  }
  const book = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.6, 0.3, 2.2)), k.material({ color: "#b5262a", roughness: 0.5, clearcoat: 0.4 }));
  book.position.set(5.5, 0.2, 1);
  book.rotation.y = 0.3;
  bank.add(book);
  k.label(k.anchor(bank, v(0, 3.6, 0)), "თესლების ბანკი", { stages: [2] });
  k.label(k.anchor(bank, v(5.5, 0.6, 1)), "წითელი ნუსხა", { stages: [2] });
  k.label(k.anchor(g, v(11, 1.4, 0)), "ნაკრძალის საზღვარი", { stages: [1] });
  const tag = k.label(k.anchor(g, v(0, 6, 0)), "", { kind: "tag", stages: [0, 1] });
  let stage = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      cut: i === 2 || i === 0,
      enter: () => {
        stage = i;
        g.visible = i < 2;
        bank.visible = i === 2;
        outdoor(k, i === 2 ? "#e7eef0" : "#bcd8ea");
      },
      update: (u: number, s: number, t: number, dt: number) => {
        if (stage < 2) {
          D.pond.update(t);
          fence.visible = stage === 1;
          // Felling: trees vanish into stumps; in the reserve saplings grow back.
          D.trees.forEach((tr, j) => {
            const cut = stage === 0 ? ease((u - (j / D.trees.length) * 0.6) / 0.1) : 1;
            const regrow = stage === 1 ? ease((u - 0.1 - (j % 5) * 0.08) / 0.4) : 0;
            tr.scale.setScalar(Math.max(0.001, (1 - cut) * 0.9 + regrow * 0.8));
            stumps[j].visible = cut > 0.5 && regrow < 0.5;
          });
          const leaving = stage === 0 ? ease((u - 0.4) / 0.4) : 1 - ease((u - 0.4) / 0.4);
          fauna.W.forEach((w, j) => (w.alive = j / fauna.W.length >= leaving));
          fauna.update(t, dt);
          setText(tag, stage === 0 ? "ტყის ჭრა — ცხოველები ტოვებენ" : "ნაკრძალი: ტყე აღდგება, ცხოველები ბრუნდებიან");
          return wide(s, 20);
        }
        return orbit(v(0, 1.5, 0), 11, s, { start: 0.25, speed: 0.03, height: 0.2 });
      },
    })),
  };
};

// ---- Water and soil pollution ----------------------------------------------------------------------------------

export const waterPollution: Builder = async (k) => {
  outdoor(k);
  const g = new THREE.Group();
  k.root.add(g);
  const M = natureMaterials(k);
  ground(k, g, { flat: [v(0, -0.3, 0)] });
  // A river across the scene.
  const riverMat = k.material({ color: "#3d7fa6", roughness: 0.08, clearcoat: 1, transparent: true, opacity: 0.9, normalMap: k.normalMap("organic", [8, 2]), normalScale: new THREE.Vector2(0.3, 0.3) });
  const river = new THREE.Mesh(k.track(new THREE.PlaneGeometry(34, 4, 1, 1).rotateX(-Math.PI / 2)), riverMat);
  river.position.y = -0.1;
  g.add(river);
  grass(k, g, 1000, 13, { avoid: (_x, z) => Math.abs(z) < 2.6 });
  for (let i = 0; i < 8; i++) {
    const x = -12 + i * 3.4;
    const z = i % 2 ? -7 : 7;
    tree(k, M, g, v(x, heightAt(x, z), z), { scale: 0.8, seed: i });
  }
  // Factory with an outflow pipe.
  const factory = new THREE.Group();
  const wall = new THREE.Mesh(k.track(new THREE.BoxGeometry(4, 2.6, 3)), k.material({ color: "#8a8a8a", roughness: 0.8 }));
  wall.position.set(-6, 1.3, -5.5);
  const pipe = k.tube([v(-6, 0.4, -4), v(-6, 0.2, -2.2), v(-6, 0, -1.6)], 0.25, k.material({ color: "#5a5a5a", metalness: 0.5, roughness: 0.4 }), factory, 10, 10);
  void pipe;
  factory.add(wall);
  g.add(factory);
  const plume = beads(k, g, curve([v(-6, 0, -1.5), v(-4, -0.05, -0.5), v(0, -0.05, 0.2), v(6, -0.05, 0.4), v(12, -0.05, 0)]), { n: 70, color: "#3a3226", size: 0.28, speed: 0.05, spread: 0.7, emissive: 0 });
  // Fields and fertiliser runoff.
  const fieldMat = k.material({ color: "#8a6a3a", roughness: 0.95, normalMap: k.normalMap("fibre", [12, 1]) });
  const field = new THREE.Mesh(k.track(new THREE.PlaneGeometry(10, 5).rotateX(-Math.PI / 2)), fieldMat);
  field.position.set(5, 0.15, 5.5);
  g.add(field);
  const runoff = beads(k, g, curve([v(5, 0.2, 5), v(5, 0.1, 3.5), v(5.5, -0.05, 1.5)]), { n: 30, color: "#7ac040", size: 0.16, speed: 0.1, spread: 2, emissive: 0.3 });
  const algae = new THREE.Color("#4a7a2a");
  const clean = new THREE.Color("#3d7fa6");
  const fishes = Array.from({ length: 6 }, (_, i) => {
    const f = fish(k, i % 2 ? "#d98a3a" : "#8aa0b0");
    f.g.scale.setScalar(1.6);
    g.add(f.g);
    return f;
  });
  // Soil cut-away with rubbish.
  const soil = new THREE.Group();
  k.root.add(soil);
  const layersC = ["#5a3e26", "#7a5a3c", "#9a7a54"];
  layersC.forEach((c, i) => {
    const b = new THREE.Mesh(k.track(new THREE.BoxGeometry(10, 1.4, 5)), k.material({ color: c, roughness: 0.95, normalMap: k.normalMap("bone", [4, 1]) }));
    b.position.y = -i * 1.4;
    soil.add(b);
  });
  const grassTop = new THREE.Mesh(k.track(new THREE.BoxGeometry(10, 0.15, 5)), k.material({ color: "#6f9c48", roughness: 0.9 }));
  grassTop.position.y = 0.77;
  soil.add(grassTop);
  const rubbish = [
    { geo: new THREE.CylinderGeometry(0.25, 0.25, 1, 12), c: "#4aa0d0", p: v(-2.5, -0.4, 2.52), r: 1.2 },
    { geo: new THREE.CylinderGeometry(0.25, 0.25, 1, 12), c: "#5ab060", p: v(1.5, -1.8, 2.52), r: 0.3 },
    { geo: new THREE.BoxGeometry(1, 0.05, 0.8), c: "#e0e0e0", p: v(-0.5, -1.2, 2.52), r: 0.5 },
    { geo: new THREE.TorusGeometry(0.3, 0.1, 8, 16), c: "#222222", p: v(3, -0.6, 2.52), r: 0 },
  ];
  rubbish.forEach((x) => {
    const m = new THREE.Mesh(k.track(x.geo), k.material({ color: x.c, roughness: 0.3, clearcoat: 0.6, transparent: x.c === "#4aa0d0", opacity: 0.8 }));
    m.position.copy(x.p);
    m.rotation.z = x.r;
    soil.add(m);
  });
  const oil = new THREE.Mesh(k.track(new THREE.CircleGeometry(1, 32)), k.material({ color: "#111111", roughness: 0.1, clearcoat: 1 }));
  oil.position.set(-3.5, -1.6, 2.53);
  soil.add(oil);
  k.label(k.anchor(soil, v(-2.5, 0.2, 2.6)), "პლასტმასის ბოთლი — 450 წელი", { stages: [2] });
  k.label(k.anchor(soil, v(-3.5, -1.6, 2.6)), "ნავთობპროდუქტები", { stages: [2] });
  k.label(k.anchor(soil, v(3, -0.3, 2.6)), "საბურავი", { stages: [2] });
  k.label(k.anchor(g, v(-6, 3, -5.5)), "ქარხანა", { stages: [0] });
  k.label(k.anchor(g, v(5, 0.6, 5.5)), "მინდორი სასუქით", { stages: [1] });
  const tag = k.label(k.anchor(g, v(0, 4, 0)), "", { kind: "tag", stages: [0, 1] });
  let stage = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      cut: i === 2 || i === 0,
      enter: () => {
        stage = i;
        g.visible = i < 2;
        soil.visible = i === 2;
        outdoor(k, i === 2 ? "#e7eef0" : "#bcd8ea");
      },
      update: (u: number, s: number, t: number) => {
        if (stage === 2) {
          oil.scale.setScalar(0.3 + 1.2 * ease(u / 0.8));
          return orbit(v(0, -0.6, 0), 12, s, { start: 0.15, speed: 0.025, height: 0.12 });
        }
        riverMat.normalMap!.offset.set(t * 0.03, 0);
        plume.update(t, stage === 0 ? ease(u / 0.3) : 0);
        runoff.update(t, stage === 1 ? 1 : 0);
        const bloom = stage === 1 ? ease((u - 0.2) / 0.5) : 0;
        riverMat.color.copy(clean).lerp(algae, bloom);
        const dying = stage === 0 ? ease((u - 0.4) / 0.4) : bloom > 0.6 ? ease((u - 0.6) / 0.3) : 0;
        fishes.forEach((f, j) => {
          const dead = j < 6 * dying;
          const a = t * 0.4 + j;
          f.g.position.set(-8 + ((j * 3 + (dead ? 0 : t)) % 16), dead ? 0.0 : -0.4, Math.sin(a) * 1.2);
          f.g.rotation.set(0, Math.PI / 2, dead ? Math.PI : 0);
          if (!dead) f.move(t * 3);
        });
        setText(tag, stage === 0 ? (dying < 0.3 ? "ჩამდინარე წყალი მდინარეში" : "თევზები იღუპებიან") : bloom < 0.5 ? "სასუქი წყალში ჩაირეცხა" : "წყალმცენარეები აყვავდა — ჟანგბადი ცოტაა");
        return orbit(v(0, 0.5, 0), 17, s, { start: 0.3, speed: 0.02, height: 0.5 });
      },
    })),
  };
};

// ---- Air pollution ---------------------------------------------------------------------------------------------

export const airPollution: Builder = async (k) => {
  outdoor(k, "#bcd8ea", 25, 70);
  const g = new THREE.Group();
  k.root.add(g);
  const M = natureMaterials(k);
  ground(k, g, { flat: [v(-5, 0, 0)] });
  const r = rng(5);
  // A town.
  const bmats = ["#c9c4b8", "#a9a49a", "#d8cfc0"].map((c) => k.material({ color: c, roughness: 0.8 }));
  for (let i = 0; i < 16; i++) {
    const h = 1.5 + r() * 4;
    const b = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.4, h, 1.4)), bmats[i % 3]);
    b.position.set(-9 + (i % 4) * 2, h / 2, -4 + Math.floor(i / 4) * 2);
    g.add(b);
  }
  const stacks = [v(-2, 0, -5), v(0, 0, -6)].map((p) => {
    const c = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.4, 0.55, 6, 12)), k.material({ color: "#7a6a6a", roughness: 0.8 }));
    c.position.copy(p).add(v(0, 3, 0));
    g.add(c);
    return p;
  });
  const smoke = stacks.map((p, i) => beads(k, g, curve([p.clone().add(v(0, 6.2, 0)), p.clone().add(v(1, 8, -1)), p.clone().add(v(4, 10, -3)), p.clone().add(v(9, 11, -5))]), { n: 40, color: "#5a5550", size: 0.55, speed: 0.06, spread: 0.7, seed: i + 1, emissive: 0 }));
  const cleanSmoke = stacks.map((p, i) => beads(k, g, curve([p.clone().add(v(0, 6.2, 0)), p.clone().add(v(0.5, 7.5, -0.5)), p.clone().add(v(1.5, 8.5, -1))]), { n: 10, color: "#ffffff", size: 0.4, speed: 0.08, spread: 0.3, seed: i + 5, emissive: 0.4 }));
  // A road with cars.
  const road = new THREE.Mesh(k.track(new THREE.PlaneGeometry(30, 1.6).rotateX(-Math.PI / 2)), k.material({ color: "#3a3a3a", roughness: 0.9 }));
  road.position.set(0, 0.05, 3);
  g.add(road);
  const cars = Array.from({ length: 4 }, (_, i) => {
    const c = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.2, 0.5, 0.6)), k.material({ color: ["#c0392b", "#2c6fb0", "#e0a12a", "#eeeeee"][i], roughness: 0.3, clearcoat: 1, metalness: 0.4 }));
    g.add(c);
    return c;
  });
  // A forest the acid rain falls on.
  const forest = Array.from({ length: 8 }, (_, i) => tree(k, M, g, v(5 + (i % 4) * 2, 0, -4 + Math.floor(i / 4) * 2.5), { scale: 0.8, seed: i + 3 }));
  const sick = k.material({ color: "#8a7a3a", roughness: 0.8 });
  const acidCloud = cloud(k, g, v(8, 9, -3), 2.2, k.material({ color: "#8a8a7a", roughness: 1 }));
  const rain = new THREE.InstancedMesh(k.sphere, k.material({ color: "#b5c86a", emissive: "#b5c86a", emissiveIntensity: 0.3 }), 160);
  rain.frustumCulled = false;
  g.add(rain);
  const drops = Array.from({ length: 160 }, () => ({ x: 8 + (r() - 0.5) * 7, z: -3 + (r() - 0.5) * 5, y: r() * 9, sp: 3 + r() * 2 }));
  // Clean energy.
  const green = new THREE.Group();
  g.add(green);
  const turbines = [v(-11, 0, 6), v(-8, 0, 7.5), v(-5, 0, 8)].map((p) => {
    const tw = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.1, 0.18, 6, 10)), k.material({ color: "#f2f2f2", roughness: 0.4 }));
    tw.position.copy(p).add(v(0, 3 + heightAt(p.x, p.z), 0));
    const rotor = new THREE.Group();
    rotor.position.copy(p).add(v(0, 6 + heightAt(p.x, p.z), 0.2));
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.15, 2.2, 0.05).translate(0, 1.1, 0)), k.material({ color: "#ffffff" }));
      blade.rotation.z = (b / 3) * Math.PI * 2;
      rotor.add(blade);
    }
    green.add(tw, rotor);
    return rotor;
  });
  for (let i = 0; i < 6; i++) {
    const panel = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.4, 0.05, 0.9)), k.material({ color: "#1d3a6a", metalness: 0.6, roughness: 0.2, clearcoat: 1 }));
    panel.position.set(2 + (i % 3) * 1.6, 0.6, 6 + Math.floor(i / 3) * 1.2);
    panel.rotation.x = -0.5;
    green.add(panel);
  }
  const tag = k.label(k.anchor(g, v(-2, 9, -3)), "", { kind: "tag" });
  const m4 = new THREE.Matrix4();
  const leafMats = forest.map((t) => t.children.slice(1) as THREE.Mesh[]);
  let stage = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      enter: () => {
        stage = i;
        outdoor(k, i === 2 ? "#bcd8ea" : "#c9c0a8", i === 2 ? 25 : 14, i === 2 ? 70 : 45);
      },
      update: (u: number, s: number, t: number) => {
        smoke.forEach((b) => b.update(t, stage < 2 ? 1 : 0));
        cleanSmoke.forEach((b) => b.update(t, stage === 2 ? 1 : 0));
        cars.forEach((c, j) => {
          const x = ((t * (2 + j * 0.4) + j * 7) % 30) - 15;
          c.position.set(x, 0.35, 3 + (j % 2 ? 0.4 : -0.4));
        });
        acidCloud.visible = rain.visible = stage === 1;
        if (stage === 1) {
          drops.forEach((d, j) => {
            let y = (d.y - t * d.sp) % 9;
            if (y < 0) y += 9;
            m4.compose(v(d.x, y, d.z), new THREE.Quaternion(), v(0.05, 0.14, 0.05));
            rain.setMatrixAt(j, m4);
          });
          rain.instanceMatrix.needsUpdate = true;
        }
        const damage = stage === 1 ? ease((u - 0.2) / 0.6) : 0;
        leafMats.forEach((ms) =>
          ms.forEach((m) => {
            m.material = damage > 0.5 ? sick : M.leaf;
            m.scale.setScalar(Math.max(0.3, m.scale.x));
          }),
        );
        forest.forEach((tr) => tr.children.slice(1).forEach((c) => c.scale.setScalar((c.userData.s ??= c.scale.x) * (1 - 0.5 * damage))));
        green.visible = stage === 2;
        turbines.forEach((r0) => (r0.rotation.z = t * 1.5));
        setText(tag, ["სმოგი: ჭვარტლი და აირები", damage < 0.5 ? "მჟავა წვიმა" : "ხეები ზიანდება", "ფილტრები, ქარი, მზე — სუფთა ჰაერი"][stage]);
        return orbit(v(-1, 2, 0), 22, s, { start: 0.3, speed: 0.02, height: 0.35 });
      },
    })),
  };
};

// ---- Greenhouse effect ---------------------------------------------------------------------------------------------

export const greenhouse: Builder = async (k) => {
  k.mood("#05070c", 60, 140);
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(2);
  const earthTex = k.canvasTexture(512, 256, (ctx) => {
    const img = ctx.createImageData(512, 256);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 512; x++) {
        const lon = (x / 512) * Math.PI * 2;
        const lat = (y / 256) * Math.PI;
        const nx = Math.sin(lat) * Math.cos(lon);
        const ny = Math.cos(lat);
        const nz = Math.sin(lat) * Math.sin(lon);
        const n = fbm(nx * 2.2 + 3, ny * 2.2, nz * 2.2, 5);
        const i = (y * 512 + x) * 4;
        const land = n > 0.05;
        const c = land ? (Math.abs(ny) > 0.3 && n < 0.25 ? [120, 140, 80] : n > 0.3 ? [160, 140, 100] : [70, 120, 60]) : [20, 60, 120];
        img.data.set([c[0], c[1], c[2], 255], i);
      }
    ctx.putImageData(img, 0, 0);
  });
  const earth = new THREE.Mesh(k.track(new THREE.SphereGeometry(5, 64, 48)), k.material({ map: earthTex, roughness: 0.7, clearcoat: 0.3 }));
  g.add(earth);
  const ice = [1, -1].map((s) => {
    const cap = new THREE.Mesh(k.track(new THREE.SphereGeometry(5.03, 48, 12, 0, Math.PI * 2, 0, 0.55)), k.material({ color: "#f4f8fb", roughness: 0.5 }));
    if (s < 0) cap.rotation.x = Math.PI;
    g.add(cap);
    return cap;
  });
  const atmo = new THREE.Mesh(k.track(new THREE.SphereGeometry(6.4, 64, 48)), k.ghost("#7fb8ff", 0.15, { side: THREE.DoubleSide, emissive: "#3f78c0", emissiveIntensity: 0.3 }));
  g.add(atmo);
  const sunM = sun(k, g, v(-28, 4, -6), 4);
  void sunM;
  // Sunlight in (yellow), heat out (red); some heat is turned back by the gases.
  const incoming = Array.from({ length: 5 }, (_, i) => beads(k, g, curve([v(-24, 4 + (i - 2) * 1.5, -5 + i), v(-4.9, (i - 2) * 1.3, -0.5 + i * 0.3)]), { n: 8, color: "#ffd23f", size: 0.22, speed: 0.15, seed: i + 1, emissive: 1.2 }));
  const escaping = Array.from({ length: 5 }, (_, i) => beads(k, g, curve([v(-4.6, (i - 2) * 1.2, 1 + i * 0.3), v(-8, (i - 2) * 2.4 + 1, 4 + i), v(-14, (i - 2) * 4, 9 + i)]), { n: 8, color: "#e0524a", size: 0.2, speed: 0.12, seed: i + 10, emissive: 1 }));
  const trapped = Array.from({ length: 6 }, (_, i) => {
    const a = -2.6 + i * 0.35;
    const from = v(Math.cos(a) * 5, Math.sin(a) * 5 * 0.8, 1.2);
    const peak = from.clone().normalize().multiplyScalar(6.3);
    return beads(k, g, curve([from, peak, from.clone().applyAxisAngle(v(0, 0, 1), 0.25)]), { n: 6, color: "#ff7a3a", size: 0.2, speed: 0.2, seed: i + 20, emissive: 1 });
  });
  // CO₂ molecules in the atmosphere.
  const molMats = { c: k.material({ color: "#333333" }), o: k.material({ color: "#e0524a" }) };
  const mols = Array.from({ length: 70 }, () => {
    const m = new THREE.Group();
    const cAtom = new THREE.Mesh(k.sphere, molMats.c);
    cAtom.scale.setScalar(0.1);
    const o1 = new THREE.Mesh(k.sphere, molMats.o);
    o1.scale.setScalar(0.09);
    o1.position.x = 0.16;
    const o2 = o1.clone();
    o2.position.x = -0.16;
    m.add(cAtom, o1, o2);
    const n = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    m.position.copy(n.multiplyScalar(5.5 + r() * 0.8));
    m.rotation.set(r() * 3, r() * 3, 0);
    g.add(m);
    return m;
  });
  const temp = k.label(k.anchor(g, v(0, 7.6, 0)), "", { kind: "tag" });
  k.label(k.anchor(g, v(-15, 6, -5)), "მზის სინათლე", { stages: [0, 1, 2] });
  k.label(k.anchor(g, v(-10, -3, 8)), "სითბო (ინფრაწითელი) კოსმოსში", { stages: [0, 1] });
  k.label(k.anchor(g, v(0, 6.6, 0.5)), "ატმოსფერო", { stages: [0] });
  k.label(k.anchor(g, mols[3].position), "CO₂", { kind: "tag", stages: [1, 2] });
  let stage = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      enter: () => (stage = i),
      update: (u: number, s: number, t: number) => {
        earth.rotation.y = t * 0.05;
        incoming.forEach((b) => b.update(t));
        const trap = stage === 0 ? 0 : stage === 1 ? 0.5 : 0.5 + 0.5 * ease(u / 0.6);
        escaping.forEach((b, j) => b.update(t, j / escaping.length >= trap * 0.8 ? 1 : 0));
        trapped.forEach((b) => b.update(t, stage === 0 ? 0 : trap));
        mols.forEach((m, j) => {
          m.visible = stage > 0 && j < 70 * (stage === 1 ? 0.45 : 0.45 + 0.55 * ease(u / 0.6));
          m.rotation.z = t + j;
        });
        const melt = stage === 2 ? ease((u - 0.3) / 0.6) : 0;
        // Ice caps shrink as it warms.
        ice.forEach((c) => c.scale.set(1 - 0.35 * melt, 1, 1 - 0.35 * melt));
        setText(temp, stage === 0 ? "სათბურის აირების გარეშე: −18 °C" : stage === 1 ? "ბუნებრივი ეფექტი: +15 °C" : `CO₂ მატულობს: +${(15 + 1.5 * ease(u / 0.6)).toFixed(1)} °C`);
        return orbit(v(-4, 0, 0), 26, s, { start: -0.25, speed: 0.01, height: 0.15 });
      },
    })),
  };
};
