import * as THREE from "three";
import { context, layer, orbit } from "@/components/journeys/common";
import { ease, rng, v, type Builder, type Kit, type Shot, type V3 } from "@/components/journeys/JourneyScene";
import { beetle, bird, cloud, fish, fox, frog, giraffe, grass, ground, heightAt, moth, mushroom, natureMaterials, outdoor, rabbit, sun, tree, water, type Animal } from "./nature";

/*
 * Evolution lessons: the tree of life and the ranks of classification, Lamarck's and Darwin's giraffes,
 * a beetle population under mutation, drift, isolation and selection, the struggle for existence, the
 * peppered moth, adaptations, antibiotic resistance, speciation on islands, and the evidence (homologous
 * limbs, embryos, fossil strata, a transitional form, rudiments).
 */

const setText = (el: HTMLDivElement, text: string) => {
  const t = el.querySelector(".blood-label-text") ?? el;
  if (t.textContent !== text) t.textContent = text;
};

const place = (a: Animal, x: number, z: number, rotY = 0, s = 1) => {
  a.g.position.set(x, heightAt(x, z), z);
  a.g.rotation.y = rotY;
  a.g.scale.setScalar(s);
  return a;
};

/** A meadow with trees, grass and sky. */
function meadow(k: Kit, parent: THREE.Object3D, o: { grassColor?: string; trees?: number; seed?: number; pond?: V3; behind?: boolean } = {}) {
  const M = natureMaterials(k);
  const r = rng(o.seed ?? 3);
  ground(k, parent, { grass: o.grassColor, flat: o.pond ? [o.pond] : [] });
  grass(k, parent, 1400, 13, { color: o.grassColor, avoid: (x, z) => !!o.pond && Math.hypot(x - o.pond.x, z - o.pond.z) < 3.4 });
  for (let i = 0; i < (o.trees ?? 7); i++) {
    const a = o.behind ? Math.PI + 0.3 + r() * (Math.PI - 0.6) : r() * Math.PI * 2;
    const d = (o.behind ? 11 : 8) + r() * 4;
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d - 3;
    tree(k, M, parent, v(x, heightAt(x, z), z), { scale: 0.8 + r() * 0.5, kind: r() < 0.35 ? "pine" : "broad" });
  }
  cloud(k, parent, v(-8, 11, -14), 1.6);
  cloud(k, parent, v(9, 12, -16), 2);
  return M;
}

// ---- 11 2.1 Tree of life ----------------------------------------------------------------------------

export const treeOfLife: Builder = async (k) => {
  k.mood("#0f1418", 30, 70);
  const g = new THREE.Group();
  k.root.add(g);
  const bark = k.material({ color: "#c9b38a", roughness: 0.6, normalMap: k.normalMap("fibre", [2, 6]) });
  const branch = (pts: V3[], r0: number) => k.tube(pts, (t) => r0 * (1 - 0.6 * t), bark, g, 40, 10);
  const root = v(0, -5, 0);
  const eu = v(2.5, 1.2, 0);
  branch([root, v(0, -2.5, 0), v(0.5, 0, 0)], 0.5);
  const tips = {
    bacteria: v(-5.5, 4, -1),
    archaea: v(-1.5, 5, 1.5),
  };
  branch([v(0.5, 0, 0), v(-2, 1.6, -0.4), tips.bacteria], 0.32);
  branch([v(0.5, 0, 0), v(-0.6, 2.5, 0.8), tips.archaea], 0.3);
  branch([v(0.5, 0, 0), eu], 0.34);
  const kingdomTips = { protists: v(1.2, 5.5, -1.5), fungi: v(3.5, 6, 1.5), plants: v(6, 5.2, -1), animals: v(7.5, 3.2, 1.5) };
  const kingdoms = new THREE.Group();
  g.add(kingdoms);
  const kb = (to: V3) => k.tube([eu, eu.clone().lerp(to, 0.5).add(v(0, 0.6, 0)), to], (t) => 0.25 * (1 - 0.6 * t), bark, kingdoms, 32, 8);
  Object.values(kingdomTips).forEach(kb);
  // Little organisms at the tips.
  const capsule = k.track(new THREE.CapsuleGeometry(0.25, 0.7, 4, 12));
  const bac = new THREE.Mesh(capsule, k.material({ color: "#6fbf5a", roughness: 0.4, clearcoat: 0.5 }));
  bac.position.copy(tips.bacteria).add(v(0, 0.6, 0));
  bac.rotation.z = 1;
  const arc = new THREE.Mesh(capsule, k.material({ color: "#e08a3a", roughness: 0.4, clearcoat: 0.5 }));
  arc.position.copy(tips.archaea).add(v(0, 0.6, 0));
  arc.rotation.z = 0.4;
  g.add(bac, arc);
  const amoeba = new THREE.Mesh(k.sphere, k.material({ color: "#a58bd0", roughness: 0.3, transparent: true, opacity: 0.8, normalMap: k.normalMap("organic", [2, 2]) }));
  amoeba.position.copy(kingdomTips.protists).add(v(0, 0.6, 0));
  amoeba.scale.set(0.7, 0.4, 0.6);
  kingdoms.add(amoeba);
  mushroom(k, kingdoms, kingdomTips.fungi.clone().add(v(0, 0.1, 0)), 3);
  const M = natureMaterials(k);
  tree(k, M, kingdoms, kingdomTips.plants.clone().add(v(0, 0.1, 0)), { scale: 0.32 });
  const fx = fox(k);
  fx.g.position.copy(kingdomTips.animals).add(v(0, 0.1, 0));
  fx.g.scale.setScalar(1.5);
  fx.g.rotation.y = -0.6;
  kingdoms.add(fx.g);
  const L = (p: V3, text: string, stages: number[]) => k.label(k.anchor(g, p), text, { stages });
  L(tips.bacteria.clone().add(v(0, 1.4, 0)), "ბაქტერიები", [0]);
  L(tips.archaea.clone().add(v(0, 1.4, 0)), "არქეები", [0]);
  L(eu.clone().add(v(0.6, -0.2, 0)), "ევკარიოტები", [0, 1]);
  L(root, "საერთო წინაპარი", [0]);
  L(kingdomTips.protists.clone().add(v(0, 1.4, 0)), "პროტისტები", [1]);
  L(kingdomTips.fungi.clone().add(v(0, 1.4, 0)), "სოკოები", [1]);
  L(kingdomTips.plants.clone().add(v(0, 2.3, 0)), "მცენარეები", [1]);
  L(kingdomTips.animals.clone().add(v(0, 1.4, 0)), "ცხოველები", [1]);

  // Ranks: stacked rings narrowing to one species.
  const ranks = new THREE.Group();
  k.root.add(ranks);
  const names: [string, string][] = [
    ["სამეფო: ცხოველები", "#3d6f8f"],
    ["ტიპი: ქორდიანები", "#3f7f7a"],
    ["კლასი: ძუძუმწოვრები", "#4f8a5a"],
    ["რიგი: მტაცებლები", "#7a8a45"],
    ["ოჯახი: ძაღლისებრნი", "#9a7a3a"],
    ["გვარი: მელია", "#a8603a"],
    ["სახეობა: ჩვეულებრივი მელია — Vulpes vulpes", "#b5462f"],
  ];
  const members: Animal[][] = [
    [fish(k), beetle(k, "#2e6f3a"), frog(k)],
    [bird(k)],
    [rabbit(k)],
    [fox(k)],
    [fox(k)],
    [fox(k)],
    [fox(k)],
  ];
  names.forEach(([text, color], i) => {
    const R = 7 - i * 0.95;
    const ring = new THREE.Mesh(k.track(new THREE.CylinderGeometry(R, R, 0.3, 64)), k.material({ color, roughness: 0.6, clearcoat: 0.3 }));
    ring.position.y = i * 0.3;
    ranks.add(ring);
    k.label(k.anchor(ranks, v(R * 0.72, i * 0.3 + 0.2, R * 0.72)), text, { stages: [2] });
    members[i].forEach((a, j) => {
      const ang = j * 1.3 + i * 0.7 + 2.4;
      const d = i === 6 ? 0 : R - 0.55;
      a.g.position.set(Math.cos(ang) * d, i * 0.3 + 0.15, Math.sin(ang) * d);
      a.g.scale.setScalar(i === 6 ? 2.2 : 1.6);
      ranks.add(a.g);
    });
  });
  const show = (tree: boolean) => {
    g.visible = tree;
    ranks.visible = !tree;
  };
  return {
    stages: [
      {
        duration: 15,
        enter: () => show(true),
        update: (_u, s) => {
          kingdoms.visible = false;
          return orbit(v(0, 1, 0), 17, s, { start: 0.1, speed: 0.04, height: 0.15 });
        },
      },
      {
        duration: 15,
        enter: () => show(true),
        update: (u, s, t) => {
          kingdoms.visible = true;
          kingdoms.scale.setScalar(Math.max(0.01, ease(u / 0.3)));
          kingdoms.position.copy(eu).multiplyScalar(1 - kingdoms.scale.x);
          fx.move(t * 4);
          return orbit(v(3, 2.5, 0), 15, s, { start: 0.3, speed: 0.04, height: 0.15 });
        },
      },
      {
        duration: 18,
        cut: true,
        enter: () => show(false),
        update: (u, s) => {
          const target = v(0, 2, 0);
          const d = 22 - 12 * ease(u);
          const a = 0.6 + s * 0.04;
          return { target, pos: v(Math.sin(a) * d * 0.7, d * 0.75, Math.cos(a) * d * 0.7) };
        },
      },
    ],
  };
};

// ---- 11 2.2 Giraffes -------------------------------------------------------------------------------

export const giraffes: Builder = async (k) => {
  outdoor(k, "#e9dcc0", 25, 60);
  const g = new THREE.Group();
  k.root.add(g);
  const M = meadow(k, g, { grassColor: "#b5a65c", trees: 4, seed: 9, behind: true });
  sun(k, g, v(14, 16, -20), 1.8);
  // An acacia: flat crown on a tall trunk.
  const acacia = new THREE.Group();
  g.add(acacia);
  const trunk = new THREE.Mesh(k.cylinder, M.bark);
  trunk.scale.set(0.3, 5.5, 0.3);
  trunk.position.y = 2.75;
  acacia.add(trunk);
  const low = new THREE.Group();
  acacia.add(low);
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(M.crowns[i % 4], M.leaf);
    const a = (i / 7) * Math.PI * 2;
    b.position.set(Math.cos(a) * 1.8, 5.8 + (i % 2) * 0.3, Math.sin(a) * 1.8);
    b.scale.set(1.5, 0.6, 1.5);
    acacia.add(b);
  }
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(M.crowns[i % 4], M.leaf);
    const a = (i / 5) * Math.PI * 2;
    b.position.set(Math.cos(a) * 1.4, 3.6, Math.sin(a) * 1.4);
    b.scale.set(1, 0.45, 1);
    low.add(b);
  }
  acacia.position.set(0, heightAt(0, -1), -1);
  // Lamarck's giraffe and its calf.
  const lam = giraffe(k, 0.8);
  place(lam, 1.6, 1.2, -2.4);
  const calf = giraffe(k, 1.3);
  place(calf, 3.4, 2.2, -2.2, 0.55);
  g.add(lam.g, calf.g);
  // Darwin's herd.
  const herd = [0.7, 1.35, 0.85, 1.2, 0.75, 1.0, 1.4].map((n, i) => {
    const gf = giraffe(k, n);
    const a = (i / 7) * Math.PI * 2 + 0.3;
    place(gf, Math.cos(a) * 3.2, Math.sin(a) * 3.2 - 1, -a - Math.PI / 2);
    g.add(gf.g);
    return { gf, n };
  });
  const lamLabel = k.anchor(g, v(0, 0, 0));
  k.label(lamLabel, "კისერს წელავს…", { kind: "tag", stages: [0] });
  k.label(k.anchor(g, v(3.4, 2.4, 2.2)), "…შვილს გრძელი კისერი აქვს?", { stages: [0] });
  k.label(k.anchor(g, v(-3.1, 4.6, -1)), "ქვედა ფოთლები შეჭამეს", { stages: [1] });
  const tag2 = k.label(k.anchor(g, v(0, 7.4, -1)), "გრძელკისრიანები საკვებს წვდებიან", { kind: "tag", stages: [2] });
  const shot = (s: number, d = 14): Shot => orbit(v(0, 2.8, 0), d, s, { start: 0.5, speed: 0.04, height: 0.25 });
  const setHerd = (on: boolean) => herd.forEach(({ gf }) => (gf.g.visible = on));
  return {
    stages: [
      {
        duration: 16,
        enter: () => {
          setHerd(false);
          lam.g.visible = true;
          low.visible = false;
        },
        update: (u, s, t) => {
          lam.setNeck(0.8 + 0.5 * ease(u / 0.7));
          calf.g.visible = u > 0.75;
          lam.move(t * 0.5);
          lamLabel.position.set(1.6, 5 + 1.5 * ease(u / 0.7), 1.2);
          return shot(s, 12);
        },
      },
      {
        duration: 15,
        enter: () => {
          setHerd(true);
          lam.g.visible = calf.g.visible = false;
          low.visible = false;
          herd.forEach(({ gf }) => gf.g.scale.setScalar(1));
        },
        update: (_u, s, t) => {
          herd.forEach(({ gf }, i) => gf.move(t * 1.5 + i));
          return shot(s);
        },
      },
      {
        duration: 17,
        enter: () => {
          setHerd(true);
          lam.g.visible = calf.g.visible = false;
        },
        update: (u, s, t) => {
          // Short necks fade away; the survivors' young all have long necks.
          herd.forEach(({ gf, n }, i) => {
            const short = n < 1.05;
            gf.g.scale.setScalar(short ? Math.max(0.001, 1 - ease((u - 0.15) / 0.35)) : 1);
            if (!short && u > 0.6) gf.setNeck(n + (1.35 - n) * ease((u - 0.6) / 0.3));
            gf.move(t * 1.5 + i);
          });
          setText(tag2, u < 0.55 ? "მოკლეკისრიანებს საკვები არ ჰყოფნით" : "შემდეგ თაობაში — მხოლოდ გრძელი კისერი");
          return shot(s);
        },
      },
    ],
  };
};

// ---- 11 2.3 Microevolution ---------------------------------------------------------------------------

interface Bug {
  a: Animal;
  mat: THREE.MeshPhysicalMaterial;
  x: number;
  z: number;
  dir: number;
  color: "green" | "brown" | "blue";
  alive: number;
  side: number;
}

const BUG_COLORS = { green: "#3f8f3a", brown: "#7a5530", blue: "#3a62c9" };

function bugs(k: Kit, parent: THREE.Object3D, n: number, seed: number) {
  const r = rng(seed);
  const list: Bug[] = [];
  for (let i = 0; i < n; i++) {
    const color = r() < 0.5 ? "green" : "brown";
    const a = beetle(k, BUG_COLORS[color]);
    const mat = (a.g.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
    a.g.scale.setScalar(2.2);
    parent.add(a.g);
    list.push({ a, mat, x: (r() - 0.5) * 9, z: (r() - 0.5) * 7, dir: r() * 6.28, color, alive: 1, side: 0 });
  }
  return list;
}

export const microevolution: Builder = async (k) => {
  outdoor(k, "#cfe0e6", 18, 45);
  const g = new THREE.Group();
  k.root.add(g);
  ground(k, g, { grass: "#8a6a45", soil: "#6a4c30", radius: 9 });
  grass(k, g, 260, 8, { color: "#7a8a40", seed: 2 });
  const r = rng(77);
  const B = bugs(k, g, 70, 5);
  const initial = B.map((b) => ({ x: b.x, z: b.z, color: b.color }));
  // Things that act on the population.
  const foot = new THREE.Mesh(k.sphere, k.material({ color: "#3b3027", roughness: 0.8 }));
  foot.scale.set(1.3, 0.5, 2.4);
  g.add(foot);
  const river = water(k, g, v(0, 0.25, 0), 1, "#3d7fa6");
  river.mesh.scale.set(0.001, 1, 9);
  const birds = [bird(k, "#5a4a3a"), bird(k, "#4a4a5a")];
  birds.forEach((b) => {
    b.g.scale.setScalar(3);
    g.add(b.g);
  });
  const count = k.label(k.anchor(g, v(0, 4.2, 0)), "", { kind: "tag" });
  let stage = 0;
  const reset = (i: number) => {
    stage = i;
    B.forEach((b, j) => {
      b.x = initial[j].x;
      b.z = initial[j].z;
      b.color = initial[j].color;
      b.alive = 1;
      b.side = 0;
      // Earlier stages' effects carry on: one blue line from stage 1, a river from stage 3.
      if (i >= 1 && j % 9 === 0) b.color = "blue";
      b.mat.color.set(BUG_COLORS[b.color]);
    });
    river.mesh.scale.x = i >= 3 ? 1.3 : 0.001;
  };
  const stomps = [v(-2.5, 0, 1), v(2, 0, -1.5)];
  return {
    stages: [0, 1, 2, 3, 4].map((i) => ({
      duration: i === 4 ? 18 : 15,
      enter: () => reset(i),
      update: (u: number, s: number, t: number, dt: number) => {
        river.update(t);
        if (stage === 3) river.mesh.scale.x = 0.001 + 1.3 * ease(u / 0.3);
        // Mutation spreads blue to a few more.
        if (stage === 1) B.forEach((b, j) => {
          const want = j % 9 === 0 && j < 70 * ease(u) ? "blue" : initial[j].color;
          if (b.color !== want) {
            b.color = want;
            b.mat.color.set(BUG_COLORS[want]);
          }
        });
        // Drift: two random stomps.
        foot.visible = stage === 2;
        if (stage === 2) {
          const which = s < 7 ? 0 : 1;
          const ph = (s % 7) / 7;
          const at = stomps[which];
          foot.position.set(at.x, 0.3 + 6 * Math.max(0, 1 - ph * 3) + (ph > 0.6 ? (ph - 0.6) * 15 : 0), at.z);
          if (ph > 0.33 && ph < 0.6) B.forEach((b) => Math.hypot(b.x - at.x, b.z - at.z) < 1.7 && (b.alive = 0));
        }
        // Selection: birds take green beetles.
        birds.forEach((bd, j) => {
          bd.g.visible = stage === 4;
          if (stage !== 4) return;
          const victims = B.filter((b) => b.alive && b.color === "green");
          const ph = ((s + j * 1.5) % 3) / 3;
          const v0 = victims[(Math.floor((s + j * 1.5) / 3) * 7 + j * 3) % Math.max(1, victims.length)];
          if (!v0) {
            bd.g.position.set(20, 10, 0);
            return;
          }
          const tx = v0.x;
          const tz = v0.z;
          const p = ph < 0.5 ? ease(ph * 2) : 1 - ease((ph - 0.5) * 2);
          bd.g.position.set(tx + (1 - p) * (j ? 8 : -8), 0.5 + (1 - p) * 7, tz);
          bd.g.lookAt(tx, 0.5, tz);
          bd.move(t * 6);
          if (ph > 0.48 && ph < 0.52) v0.alive = 0;
        });
        // Walk.
        let alive = 0;
        const tally = { green: 0, brown: 0, blue: 0 };
        B.forEach((b, j) => {
          if (b.alive) {
            b.dir += (r() - 0.5) * 0.3;
            b.x += Math.cos(b.dir) * dt * 0.5;
            b.z += Math.sin(b.dir) * dt * 0.5;
            if (Math.hypot(b.x, b.z) > 5) b.dir += Math.PI;
            // The river keeps the two halves apart.
            if (river.mesh.scale.x > 0.5 && Math.abs(b.x) < 1.4) {
              b.x = Math.sign(b.x || 1) * 1.45;
              b.dir = Math.PI - b.dir;
            }
            alive++;
            tally[b.color]++;
          }
          b.a.g.visible = b.alive > 0;
          b.a.g.position.set(b.x, heightAt(b.x, b.z, 9) + 0.02, b.z);
          b.a.g.rotation.y = -b.dir + Math.PI / 2;
          b.a.move(t * 4 + j);
        });
        setText(count, `მწვანე ${tally.green} · მურა ${tally.brown}${tally.blue ? ` · ლურჯი ${tally.blue}` : ""}`);
        void alive;
        return orbit(v(0, 0, 0), 11.5, s, { start: 0.2, speed: 0.03, height: 0.75 });
      },
    })),
  };
};

// ---- 11 2.4 Struggle for existence ---------------------------------------------------------------------

export const struggle: Builder = async (k) => {
  outdoor(k);
  const g = new THREE.Group();
  k.root.add(g);
  const gr = ground(k, g, {});
  const M = natureMaterials(k);
  grass(k, g, 900, 13, { seed: 4 });
  for (const [x, z] of [[-9, -6], [8, -7], [-6, -10], [10, 2]]) tree(k, M, g, v(x, heightAt(x, z), z), { scale: 1 });
  const r = rng(31);
  // Seedlings in a patch.
  const sproutGeo = k.track(new THREE.ConeGeometry(0.08, 0.9, 5).translate(0, 0.45, 0));
  const leafGeo = k.track(new THREE.SphereGeometry(1, 8, 6));
  const live = k.material({ color: "#5e9e3a", roughness: 0.7 });
  const dead = k.material({ color: "#8a6a3a", roughness: 0.9 });
  const seedlings = Array.from({ length: 110 }, (_, i) => {
    const sg = new THREE.Group();
    const stem = new THREE.Mesh(sproutGeo, live);
    const l1 = new THREE.Mesh(leafGeo, live);
    l1.scale.set(0.18, 0.04, 0.08);
    l1.position.set(0.12, 0.8, 0);
    const l2 = l1.clone();
    l2.position.x = -0.12;
    sg.add(stem, l1, l2);
    const x = (r() - 0.5) * 6 - 2;
    const z = (r() - 0.5) * 5 + 1;
    sg.position.set(x, heightAt(x, z), z);
    g.add(sg);
    return { sg, parts: [stem, l1, l2], winner: i % 18 === 0, delay: r() };
  });
  const winners = seedlings.filter((x) => x.winner).map((x) => tree(k, M, g, x.sg.position.clone(), { scale: 0.001, seed: Math.round(x.delay * 100) }));
  // Rabbits and a fox.
  const rabbits = Array.from({ length: 7 }, (_, i) => {
    const a = rabbit(k);
    g.add(a.g);
    return { a, x: 3 + (r() - 0.5) * 5, z: (r() - 0.5) * 5, dir: r() * 6, alive: true, i };
  });
  const fx = fox(k);
  g.add(fx.g);
  fx.g.scale.setScalar(1.5);
  // Snow.
  const snowMat = k.material({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.4 });
  const flakes = new THREE.InstancedMesh(k.sphere, snowMat, 500);
  flakes.frustumCulled = false;
  g.add(flakes);
  const flakeData = Array.from({ length: 500 }, () => ({ x: (r() - 0.5) * 26, z: (r() - 0.5) * 26, y: r() * 14, sp: 0.6 + r() }));
  const tag = k.label(k.anchor(g, v(-2, 3, 1)), "", { kind: "tag" });
  const m4 = new THREE.Matrix4();
  let stage = 0;
  return {
    stages: [0, 1, 2, 3].map((i) => ({
      duration: 15,
      enter: () => {
        stage = i;
        rabbits.forEach((rb) => (rb.alive = true));
      },
      update: (u: number, s: number, t: number, dt: number) => {
        // Seedlings: sprout, then most wither while a few grow into saplings.
        seedlings.forEach((x) => {
          const grow = stage === 0 ? ease((u - x.delay * 0.5) / 0.4) : 1;
          const wither = stage >= 1 && !x.winner ? ease((stage === 1 ? u : 1) * 1.6 - x.delay * 0.6) : 0;
          x.sg.scale.setScalar(Math.max(0.001, grow * (1 - 0.7 * wither)));
          for (const p of x.parts) p.material = wither > 0.5 ? dead : live;
          x.sg.visible = !(x.winner && stage >= 1);
        });
        winners.forEach((w) => w.scale.setScalar(stage >= 1 ? 0.15 + 0.35 * (stage === 1 ? ease(u) : 1) : 0.001));
        // Predator and prey.
        fx.g.visible = stage === 2;
        rabbits.forEach((rb) => {
          rb.a.g.visible = stage >= 2 && rb.alive;
          if (!rb.a.g.visible) return;
          rb.dir += (Math.sin(t + rb.i) * 0.5) * dt;
          rb.x += Math.cos(rb.dir) * dt * 0.8;
          rb.z += Math.sin(rb.dir) * dt * 0.8;
          if (Math.hypot(rb.x - 3, rb.z) > 4) rb.dir += Math.PI;
          rb.a.g.position.set(rb.x, heightAt(rb.x, rb.z), rb.z);
          rb.a.g.rotation.y = -rb.dir + Math.PI / 2;
          rb.a.move(t * 8 + rb.i);
        });
        if (stage === 2) {
          const prey = rabbits.find((rb) => rb.alive);
          if (prey) {
            const fp = fx.g.position;
            const to = v(prey.x - fp.x, 0, prey.z - fp.z);
            if (to.length() < 0.4) prey.alive = false;
            else fp.add(to.normalize().multiplyScalar(dt * 1.6));
            fp.y = heightAt(fp.x, fp.z);
            fx.g.rotation.y = Math.atan2(to.x, to.z);
            fx.move(t * 10);
          }
        } else fx.g.position.set(8, 0, 5);
        // Winter.
        const snow = stage === 3 ? ease(u / 0.6) : 0;
        flakes.visible = stage === 3;
        if (stage === 3) {
          flakeData.forEach((f, j) => {
            const y = (f.y - t * f.sp * 1.5) % 14;
            m4.compose(v(f.x + Math.sin(t + j) * 0.3, y < 0 ? y + 14 : y, f.z), new THREE.Quaternion(), v(0.06, 0.06, 0.06));
            flakes.setMatrixAt(j, m4);
          });
          flakes.instanceMatrix.needsUpdate = true;
        }
        gr.mat.emissive.set("#ffffff");
        gr.mat.emissiveIntensity = snow * 0.55;
        setText(tag, ["ბევრი აღმონაცენი", "სინათლისა და წყლისთვის ბრძოლა", "მტაცებელი და მსხვერპლი", "ყინვა"][stage]);
        return orbit(stage === 2 ? v(3, 0.5, 0) : v(-2, 0.4, 1), stage === 0 ? 6 : 8, s, { start: 0.3, speed: 0.035, height: 0.45 });
      },
    })),
  };
};

// ---- 11 2.5 Peppered moth ------------------------------------------------------------------------------

function barkTexture(k: Kit, sooty: boolean) {
  const r = rng(sooty ? 2 : 1);
  return k.canvasTexture(256, 512, (ctx) => {
    ctx.fillStyle = sooty ? "#2f2c29" : "#e9e4da";
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 900; i++) {
      const c = sooty ? 20 + r() * 40 : 150 + r() * 90;
      ctx.fillStyle = `rgba(${c},${c},${c - 6},0.7)`;
      ctx.fillRect(r() * 256, r() * 512, 2 + r() * 10, 1 + r() * 2);
    }
    if (!sooty)
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = "rgba(40,36,32,0.85)";
        ctx.fillRect(r() * 256, r() * 512, 10 + r() * 30, 2 + r() * 3);
      }
  });
}

export const pepperedMoth: Builder = async (k) => {
  outdoor(k, "#c9d6dc", 14, 40);
  const g = new THREE.Group();
  k.root.add(g);
  const light = k.material({ map: barkTexture(k, false), roughness: 0.85, normalMap: k.normalMap("fibre", [1, 2]) });
  const sooty = k.material({ map: barkTexture(k, true), roughness: 0.9, normalMap: k.normalMap("fibre", [1, 2]) });
  const trunk = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.4, 1.6, 14, 40)), light);
  trunk.position.y = 4;
  g.add(trunk);
  const r = rng(5);
  const moths = Array.from({ length: 16 }, (_, i) => {
    const dark = i % 2;
    const a = moth(k, dark, i + 1);
    const ang = -0.9 + (i / 16) * 1.8 + (r() - 0.5) * 0.15;
    const y = 1 + (i % 8) * 0.8 + r() * 0.3;
    a.g.position.set(Math.sin(ang) * 1.5, y, Math.cos(ang) * 1.5);
    a.g.lookAt(Math.sin(ang) * 3, y, Math.cos(ang) * 3);
    a.g.rotateX(-Math.PI / 2);
    a.g.scale.setScalar(2.2);
    g.add(a.g);
    return { a, dark, ang, y };
  });
  const hunter = bird(k, "#6a5a48");
  hunter.g.scale.setScalar(2.8);
  g.add(hunter.g);
  // Generations chart.
  const chart = new THREE.Group();
  k.root.add(chart);
  const barL = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.6, 1, 1.6).translate(0, 0.5, 0)), k.material({ color: "#e9e4da", roughness: 0.6 }));
  const barD = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.6, 1, 1.6).translate(0, 0.5, 0)), k.material({ color: "#2f2c29", roughness: 0.6 }));
  barL.position.x = -1.3;
  barD.position.x = 1.3;
  const base = new THREE.Mesh(k.track(new THREE.BoxGeometry(6, 0.2, 3)), k.material({ color: "#8a9a95", roughness: 0.7 }));
  base.position.y = -0.1;
  chart.add(barL, barD, base);
  const lA = k.label(k.anchor(chart, v(-1.3, 0, 0.9)), "", { kind: "tag", stages: [2] });
  const lB = k.label(k.anchor(chart, v(1.3, 0, 0.9)), "", { kind: "tag", stages: [2] });
  const gen = k.label(k.anchor(chart, v(0, 8.3, 0)), "", { kind: "tag", stages: [2] });
  k.label(k.anchor(g, v(0, 9.5, 1.6)), "არყის ქერქი", { stages: [0, 1] });
  const tag = k.label(k.anchor(g, v(2.6, 6, 1.2)), "", { kind: "tag", stages: [0, 1] });
  let sootyBark = false;
  const eaten = new Set<number>();
  const hunt = (s: number, t: number) => {
    // The bird takes a conspicuous moth every 3 s.
    const idx = Math.floor(s / 3);
    const ph = (s % 3) / 3;
    const targets = moths.map((m, i) => ({ m, i })).filter(({ m }) => (sootyBark ? !m.dark : m.dark));
    const target = targets[idx % targets.length];
    moths.forEach((m, i) => (m.a.g.visible = !eaten.has(i)));
    if (!target) return;
    const tp = v(Math.sin(target.m.ang) * 1.9, target.m.y, Math.cos(target.m.ang) * 1.9);
    const p = ph < 0.5 ? ease(ph * 2) : 1 - ease((ph - 0.5) * 2);
    hunter.g.position.copy(tp).add(v(4 * (1 - p), 3 * (1 - p), 6 * (1 - p)));
    hunter.g.lookAt(tp);
    hunter.move(t * 6);
    if (ph > 0.5) eaten.add(target.i);
  };
  const show = (tree: boolean) => {
    g.visible = tree;
    chart.visible = !tree;
  };
  return {
    stages: [
      {
        duration: 16,
        enter: () => {
          show(true);
          sootyBark = false;
          trunk.material = light;
          eaten.clear();
        },
        update: (_u, s, t) => {
          hunt(s, t);
          setText(tag, "მუქი პეპელა თვალში საცემია");
          return orbit(v(0, 4, 0), 9, 0, { start: Math.sin(s * 0.15) * 0.25, height: 0.12 });
        },
      },
      {
        duration: 16,
        enter: () => {
          show(true);
          sootyBark = true;
          trunk.material = sooty;
          eaten.clear();
        },
        update: (_u, s, t) => {
          hunt(s, t);
          setText(tag, "ახლა ღია პეპელა ჩანს");
          return orbit(v(0, 4, 0), 9, 0, { start: Math.sin(s * 0.15) * 0.25, height: 0.12 });
        },
      },
      {
        duration: 16,
        cut: true,
        enter: () => show(false),
        update: (u, s) => {
          const darkShare = 0.02 + 0.93 * ease(u / 0.85);
          barL.scale.y = 7 * (1 - darkShare) + 0.01;
          barD.scale.y = 7 * darkShare + 0.01;
          setText(lA, `ღია ${Math.round((1 - darkShare) * 100)}%`);
          setText(lB, `მუქი ${Math.round(darkShare * 100)}%`);
          setText(gen, `თაობა ${Math.round(1 + 50 * ease(u / 0.85))}`);
          return orbit(v(0, 3.5, 0), 13, s, { start: 0.25, speed: 0.02, height: 0.15 });
        },
      },
    ],
  };
};

// ---- 11 2.6 Adaptations --------------------------------------------------------------------------------

function wasp(k: Kit, scale = 1) {
  const g = new THREE.Group();
  const tex = k.canvasTexture(64, 64, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#1d1a14" : "#f2c230";
      ctx.fillRect(0, i * 8, 64, 8);
    }
  });
  const body = k.material({ map: tex, roughness: 0.35, clearcoat: 0.8 });
  const dark = k.material({ color: "#1d1a14", roughness: 0.4 });
  const abd = new THREE.Mesh(k.sphere, body);
  abd.scale.set(0.12, 0.12, 0.25);
  abd.rotation.x = Math.PI / 2;
  abd.position.z = -0.22;
  const thorax = new THREE.Mesh(k.sphere, dark);
  thorax.scale.setScalar(0.1);
  const head = new THREE.Mesh(k.sphere, body);
  head.scale.setScalar(0.08);
  head.position.z = 0.14;
  g.add(abd, thorax, head);
  const wingMat = k.ghost("#dfe8ee", 0.45, { side: THREE.DoubleSide, roughness: 0.1, clearcoat: 1 });
  const wings = [-1, 1].map((s) => {
    const w = new THREE.Mesh(k.track(new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2)), wingMat);
    w.scale.set(0.12, 1, 0.3);
    w.position.set(s * 0.12, 0.08, -0.1);
    g.add(w);
    return { w, s };
  });
  g.scale.setScalar(scale);
  return { g, move: (ph: number) => wings.forEach(({ w, s }) => (w.rotation.z = s * Math.sin(ph * 20) * 0.4)) };
}

export const adaptations: Builder = async (k) => {
  outdoor(k, "#cfe0d6", 10, 30);
  const g = new THREE.Group();
  k.root.add(g);
  const M = natureMaterials(k);
  // Scene 1: a twig with a stick insect, and bark with a pale moth.
  const s1 = new THREE.Group();
  g.add(s1);
  const twig = k.tube([v(-4, 0, 0), v(-1, 0.3, 0.2), v(2, 0.2, -0.1), v(4.5, 0.6, 0)], 0.12, M.bark, s1, 40, 8);
  const stick = k.tube([v(-0.8, 0.45, 0.1), v(0.4, 0.5, 0.05), v(1.6, 0.42, 0.0)], 0.07, M.bark, s1, 20, 6);
  void stick;
  for (let i = 0; i < 6; i++) {
    const leg = new THREE.Mesh(k.cylinder, M.bark);
    leg.scale.set(0.025, 0.7, 0.025);
    leg.position.set(-0.3 + (i % 3) * 0.6, 0.25, i < 3 ? 0.3 : -0.25);
    leg.rotation.x = i < 3 ? 0.7 : -0.7;
    s1.add(leg);
  }
  void twig;
  const barkSlab = new THREE.Mesh(k.track(new THREE.BoxGeometry(3, 3, 0.4)), k.material({ map: barkTexture(k, false), roughness: 0.85, normalMap: k.normalMap("fibre", [1, 1]) }));
  barkSlab.position.set(1, -2.2, -0.6);
  s1.add(barkSlab);
  const pale = moth(k, 0, 3);
  pale.g.position.set(1.2, -2.0, -0.38);
  pale.g.rotation.x = Math.PI / 2;
  pale.g.scale.setScalar(5);
  s1.add(pale.g);
  k.label(k.anchor(s1, v(0.4, 0.8, 0.1)), "ჩხირა — ტოტს ჰგავს", { stages: [0] });
  k.label(k.anchor(s1, v(1.2, -1.4, -0.3)), "პეპელა ქერქზე", { stages: [0] });
  // Scene 2: a poison frog and a wasp; a bird turns away.
  const s2 = new THREE.Group();
  g.add(s2);
  const leaf = new THREE.Mesh(k.track(new THREE.SphereGeometry(1, 24, 12)), M.leaf);
  leaf.scale.set(2.6, 0.12, 1.6);
  s2.add(leaf);
  const fr = frog(k);
  ((fr.g.children[0] as THREE.Mesh).material as THREE.MeshPhysicalMaterial).color.set("#2f6fd6");
  fr.g.scale.setScalar(6);
  fr.g.position.set(-0.8, 0.1, 0);
  s2.add(fr.g);
  const w1 = wasp(k, 3.5);
  w1.g.position.set(1.3, 1.2, 0.3);
  s2.add(w1.g);
  const watcher = bird(k, "#8a6a4a");
  watcher.g.scale.setScalar(5);
  s2.add(watcher.g);
  k.label(k.anchor(s2, v(-0.8, 1.4, 0)), "შხამიანი ბაყაყი", { stages: [1] });
  k.label(k.anchor(s2, v(1.3, 2.0, 0.3)), "კრაზანა", { stages: [1] });
  const btag = k.label(k.anchor(s2, v(0, 3.6, 2)), "ფრინველი გაურბის", { kind: "tag", stages: [1] });
  void btag;
  // Scene 3: wasp and hoverfly on a flower.
  const s3 = new THREE.Group();
  g.add(s3);
  const petalMat = k.material({ color: "#f3f0e6", roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color("#ffffff") });
  for (let i = 0; i < 10; i++) {
    const p = new THREE.Mesh(k.sphere, petalMat);
    const a = (i / 10) * Math.PI * 2;
    p.position.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
    p.scale.set(0.9, 0.06, 0.35);
    p.rotation.y = -a;
    s3.add(p);
  }
  const centre = new THREE.Mesh(k.sphere, k.material({ color: "#f2b632", roughness: 0.7 }));
  centre.scale.set(0.5, 0.2, 0.5);
  s3.add(centre);
  const w2 = wasp(k, 3);
  w2.g.position.set(-0.6, 0.5, 0);
  const hover = wasp(k, 2.6);
  hover.g.position.set(0.9, 0.5, 0.4);
  // A hoverfly: same colours, but one pair of wings and big eyes.
  const eyeMat = k.material({ color: "#6a2a1a", roughness: 0.2, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(k.sphere, eyeMat);
    e.scale.setScalar(0.06);
    e.position.set(s * 0.05, 0.03, 0.17);
    hover.g.add(e);
  }
  s3.add(w2.g, hover.g);
  k.label(k.anchor(s3, v(-0.6, 1.4, 0)), "კრაზანა (ნესტრით)", { stages: [2] });
  k.label(k.anchor(s3, v(0.9, 1.4, 0.4)), "ბზუალა — უვნებელი ბუზი", { stages: [2] });
  const scenes = [s1, s2, s3];
  const show = (i: number) => scenes.forEach((x, j) => (x.visible = i === j));
  return {
    stages: [
      { duration: 15, enter: () => show(0), update: (_u, s) => orbit(v(0.3, -0.6, 0), 8, s, { start: 0.1, speed: 0.04, height: 0.2 }) },
      {
        duration: 15,
        cut: true,
        enter: () => show(1),
        update: (_u, s, t) => {
          w1.move(t);
          // The bird comes close, then veers off.
          const ph = (s % 5) / 5;
          const p = ph < 0.5 ? ease(ph * 2) : 1 - ease((ph - 0.5) * 2);
          watcher.g.position.set(-3 + p * 2.5, 3 - p * 1.4, 2 - p * 0.8);
          watcher.g.lookAt(0, 0.5, 0);
          watcher.move(t * 6);
          return orbit(v(0, 0.8, 0), 7.5, s, { start: 0.2, speed: 0.03, height: 0.35 });
        },
      },
      {
        duration: 15,
        cut: true,
        enter: () => show(2),
        update: (_u, s, t) => {
          w2.move(t);
          hover.move(t + 1);
          return orbit(v(0.2, 0.5, 0), 5.5, s, { start: 0.3, speed: 0.04, height: 0.45 });
        },
      },
    ],
  };
};

// ---- 12 Antibiotic resistance -----------------------------------------------------------------------------

export const antibiotic: Builder = async (k) => {
  k.mood("#1a1f22", 20, 50);
  const g = new THREE.Group();
  k.root.add(g);
  const dish = new THREE.Mesh(k.track(new THREE.CylinderGeometry(6, 6, 1, 64, 1, true)), k.ghost("#dfeff5", 0.25, { side: THREE.DoubleSide, roughness: 0.05, clearcoat: 1 }));
  dish.position.y = 0.3;
  const agar = new THREE.Mesh(k.track(new THREE.CylinderGeometry(5.9, 5.9, 0.4, 64)), k.material({ color: "#e8cf8a", roughness: 0.3, clearcoat: 0.8, transparent: true, opacity: 0.9 }));
  g.add(dish, agar);
  const r = rng(13);
  const N = 520;
  const cells = Array.from({ length: N }, (_, i) => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 5.4;
    return { x: Math.cos(a) * d, z: Math.sin(a) * d, rot: r() * 3, resistant: i % 25 === 0, born: r() };
  });
  // Survivors' offspring cluster round them.
  const resist = cells.filter((c) => c.resistant);
  const offspring = Array.from({ length: 360 }, () => {
    const p = resist[Math.floor(r() * resist.length)];
    return { x: p.x + (r() - 0.5) * 2.4, z: p.z + (r() - 0.5) * 2.4, rot: r() * 3, born: r() };
  }).filter((c) => Math.hypot(c.x, c.z) < 5.6);
  const geo = k.track(new THREE.CapsuleGeometry(0.06, 0.18, 3, 8).rotateZ(Math.PI / 2));
  const blue = new THREE.InstancedMesh(geo, k.material({ color: "#4a86d8", roughness: 0.4, clearcoat: 0.6 }), N);
  const orange = new THREE.InstancedMesh(geo, k.material({ color: "#f08a2a", emissive: "#f08a2a", emissiveIntensity: 0.2, roughness: 0.4, clearcoat: 0.6 }), N + offspring.length);
  g.add(blue, orange);
  const drops = Array.from({ length: 6 }, (_, i) => {
    const d = new THREE.Mesh(k.sphere, k.ghost("#ffffff", 0.7, { roughness: 0.05, clearcoat: 1 }));
    d.scale.setScalar(0.25);
    g.add(d);
    return { d, x: Math.cos(i) * 3, z: Math.sin(i * 1.7) * 3, delay: i * 0.08 };
  });
  k.label(k.anchor(g, v(0, 0.6, 5.2)), "პეტრის ჯამი", { stages: [0] });
  const tag = k.label(k.anchor(g, v(0, 2.4, 0)), "", { kind: "tag" });
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  let stage = 0;
  const draw = (u: number) => {
    let bi = 0;
    let oi = 0;
    for (const c of cells) {
      const present = stage === 0 ? (c.born < 0.3 + 0.7 * ease(u) ? 1 : 0) : 1;
      const dying = !c.resistant && stage >= 1 ? ease(stage === 1 ? (u - 0.3) / 0.5 : 1) : 0;
      const sz = present * (1 - dying);
      q.setFromEuler(e.set(0, c.rot, 0));
      m.compose(v(c.x, 0.26, c.z), q, v(sz, sz, sz));
      if (c.resistant) orange.setMatrixAt(oi++, m);
      else blue.setMatrixAt(bi++, m);
    }
    for (const c of offspring) {
      const sz = stage === 2 ? ease(u * 1.5 - c.born * 0.5) : 0;
      q.setFromEuler(e.set(0, c.rot, 0));
      m.compose(v(c.x, 0.26, c.z), q, v(sz, sz, sz));
      orange.setMatrixAt(oi++, m);
    }
    blue.instanceMatrix.needsUpdate = true;
    orange.instanceMatrix.needsUpdate = true;
  };
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      enter: () => (stage = i),
      update: (u: number, s: number) => {
        draw(u);
        drops.forEach((d) => {
          const f = stage === 1 ? ease((u - d.delay) / 0.25) : stage === 2 ? 1 : 0;
          d.d.visible = stage === 1 && f < 1;
          d.d.position.set(d.x, 6 - 5.7 * f, d.z);
        });
        setText(tag, ["ბაქტერიები მრავლდება · მდგრადი — ნარინჯისფერი", "ანტიბიოტიკი: მგრძნობიარენი იღუპებიან", "მდგრადები მრავლდებიან"][stage]);
        return orbit(v(0, 0, 0), 12, s, { start: 0.3, speed: 0.03, height: 0.9 });
      },
    })),
  };
};

// ---- 11 2.7 Speciation ---------------------------------------------------------------------------------------

export const speciation: Builder = async (k) => {
  outdoor(k, "#bcd8ea", 30, 70);
  const g = new THREE.Group();
  k.root.add(g);
  const M = natureMaterials(k);
  // One island made of two hills joined by a low neck of land; the sea rises over the neck.
  const land = new THREE.Mesh(
    (() => {
      const geo = k.track(new THREE.PlaneGeometry(30, 18, 120, 72).rotateX(-Math.PI / 2));
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        const hill = (cx: number) => 2.2 * Math.exp(-(((x - cx) / 4.2) ** 2) - (z / 4) ** 2);
        p.setY(i, Math.max(hill(-6), hill(6)) + 0.6 * Math.exp(-((x / 4) ** 2) - (z / 2) ** 2) - 0.8);
      }
      geo.computeVertexNormals();
      return geo;
    })(),
    k.material({ color: "#8fae5a", roughness: 0.9, clearcoat: 0, normalMap: k.normalMap("organic", [16, 10]) }),
  );
  g.add(land);
  const sea = water(k, g, v(0, -0.6, 0), 30, "#2f6f95");
  for (const [x, z] of [[-7, -1.5], [-5, 1.5], [6.5, -1], [5, 2]]) tree(k, M, g, v(x, 1.3, z), { scale: 0.45, kind: x < 0 ? "broad" : "pine" });
  const r = rng(8);
  const flock = Array.from({ length: 14 }, (_, i) => {
    const b = bird(k, "#5a4030");
    b.g.scale.setScalar(2.2);
    g.add(b.g);
    return { b, home: i % 2 ? -1 : 1, ph: r() * 6, rad: 2 + r() * 2 };
  });
  k.label(k.anchor(g, v(-6, 3.6, 0)), "კუნძული A — მაგარი თესლი", { stages: [1, 2, 3] });
  k.label(k.anchor(g, v(6, 3.6, 0)), "კუნძული B — მწერები", { stages: [1, 2, 3] });
  const tag = k.label(k.anchor(g, v(0, 4.5, 0)), "", { kind: "tag" });
  let stage = 0;
  return {
    stages: [0, 1, 2, 3].map((i) => ({
      duration: 15,
      enter: () => (stage = i),
      update: (u: number, s: number, t: number) => {
        sea.update(t);
        sea.mesh.position.y = stage === 0 ? -0.6 : stage === 1 ? -0.6 + 0.75 * ease(u / 0.6) : 0.15;
        const diverge = stage === 2 ? ease(u / 0.8) : stage === 3 ? 1 : 0;
        flock.forEach((f, j) => {
          // Before the split birds roam the whole island; after, each stays home.
          const mixing = stage === 0 || (stage === 1 && u < 0.3);
          const cx = mixing ? Math.sin(t * 0.2 + j) * 6 : f.home * 6;
          const a = t * 0.6 + f.ph;
          f.b.g.position.set(cx + Math.cos(a) * f.rad, 2.6 + Math.sin(a * 2) * 0.4, Math.sin(a) * f.rad);
          f.b.g.rotation.y = -a;
          f.b.move(t * 5 + j);
          const big = f.home < 0;
          f.b.beak.scale.set(0.3 * (1 + (big ? 0.9 : -0.3) * diverge), 0.3 * (1 + (big ? 0.9 : -0.3) * diverge), 0.8 * (1 + (big ? -0.2 : 0.6) * diverge));
          f.b.body.color.set("#5a4030").lerp(new THREE.Color(big ? "#4a3a2a" : "#b59a5a"), diverge);
        });
        // In the last stage two birds from different islands meet and don't pair.
        if (stage === 3) {
          const p = ease(((s % 6) / 6) * 2);
          flock[0].b.g.position.set(-1.5 * (1 - p) - 0.5, 2.4, 0);
          flock[1].b.g.position.set(1.5 * (1 - p) + 0.5, 2.4, 0);
        }
        setText(tag, ["ერთი პოპულაცია — ყველა ერთად მრავლდება", "წყალი იმატებს — ხმელეთი იყოფა", "ნისკარტები და ფერი განსხვავდება", "ვეღარ მრავლდებიან — ორი სახეობა"][stage]);
        return orbit(v(0, 1.5, 0), 20, s, { start: 0.2, speed: 0.025, height: 0.5 });
      },
    })),
  };
};

// ---- 11 2.8 Evidence -------------------------------------------------------------------------------------------

/** A limb from coloured bones: upper bone (red), two forearm bones (yellow), wrist (green), fingers (blue). */
function limb(k: Kit, o: { upper: number; fore: number; fingers: number[]; spread: number; thick: number; skin?: THREE.Material; skinScale?: V3 }) {
  const g = new THREE.Group();
  const mat = (c: string) => k.material({ color: c, roughness: 0.45, clearcoat: 0.4 });
  const red = mat("#d64a3a");
  const yellow = mat("#e9b13a");
  const green = mat("#4fa35a");
  const blue = mat("#3f7fd0");
  const bone = (m: THREE.Material, from: V3, to: V3, r: number) => {
    const b = new THREE.Mesh(k.cylinder, m);
    const d = to.clone().sub(from);
    b.position.copy(from).addScaledVector(d, 0.5);
    b.quaternion.setFromUnitVectors(v(0, 1, 0), d.clone().normalize());
    b.scale.set(r, d.length(), r);
    g.add(b);
  };
  const t = o.thick;
  const shoulder = v(0, 0, 0);
  const elbow = v(o.upper, 0, 0);
  const wrist = v(o.upper + o.fore, 0, 0);
  bone(red, shoulder, elbow, 0.12 * t);
  bone(yellow, elbow, wrist.clone().add(v(0, 0.08, 0)), 0.07 * t);
  bone(yellow, elbow.clone().add(v(0, -0.05, 0)), wrist.clone().add(v(0, -0.08, 0)), 0.06 * t);
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(k.sphere, green);
    c.position.copy(wrist).add(v(0.12, (i - 1.5) * 0.11 * t, 0));
    c.scale.setScalar(0.07 * t);
    g.add(c);
  }
  o.fingers.forEach((len, i) => {
    const a = (i - (o.fingers.length - 1) / 2) * o.spread;
    const from = wrist.clone().add(v(0.2, (i - (o.fingers.length - 1) / 2) * 0.1 * t, 0));
    const dir = v(Math.cos(a), Math.sin(a), 0);
    bone(blue, from, from.clone().addScaledVector(dir, len), 0.035 * t);
  });
  if (o.skin) {
    const s = new THREE.Mesh(k.sphere, o.skin);
    s.position.copy(wrist).add(v(0.6, 0, 0));
    s.scale.copy(o.skinScale ?? v(1, 1, 0.05));
    g.add(s);
  }
  return g;
}

/** Rock layers with fossils; older below. */
function strata(k: Kit, parent: THREE.Object3D, stages: number[]) {
  const g = new THREE.Group();
  parent.add(g);
  const layers = [
    { c: "#9a8a72", y: 0, label: "≈ 500 მლნ წ. — ტრილობიტები" },
    { c: "#b9a07a", y: 1.2, label: "≈ 350 მლნ წ. — თევზები" },
    { c: "#8f7f6a", y: 2.4, label: "≈ 150 მლნ წ. — ამონიტები, დინოზავრები" },
    { c: "#c8b28a", y: 3.6, label: "≈ 20 მლნ წ. — ძუძუმწოვრები" },
  ];
  layers.forEach((L) => {
    const box = new THREE.Mesh(k.track(new THREE.BoxGeometry(9, 1.2, 4)), k.material({ color: L.c, roughness: 0.95, clearcoat: 0, normalMap: k.normalMap("bone", [4, 1]) }));
    box.position.y = L.y;
    g.add(box);
    k.label(k.anchor(g, v(4.6, L.y, 2)), L.label, { stages });
  });
  const fossil = k.material({ color: "#efe6d0", roughness: 0.7 });
  // Trilobite: a segmented oval.
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.Mesh(k.sphere, fossil);
    seg.scale.set(0.45 - Math.abs(i - 3) * 0.05, 0.06, 0.1);
    seg.position.set(-2 + 0, 0.05, 2.02);
    seg.position.y = -0.3 + i * 0.1;
    seg.rotation.x = Math.PI / 2;
    g.add(seg);
  }
  // Fish skeleton.
  k.tube([v(-1, 1.2, 2.02), v(0.5, 1.25, 2.02), v(1.6, 1.15, 2.02)], 0.03, fossil, g, 12, 6);
  for (let i = 0; i < 9; i++) {
    const rib = new THREE.Mesh(k.cylinder, fossil);
    rib.scale.set(0.02, 0.45, 0.02);
    rib.position.set(-0.8 + i * 0.25, 1.2, 2.02);
    g.add(rib);
  }
  // Ammonite: a spiral.
  const spiral: V3[] = [];
  for (let i = 0; i < 60; i++) {
    const a = i * 0.25;
    const r = 0.05 + a * 0.05;
    spiral.push(v(-2.5 + Math.cos(a) * r, 2.4 + Math.sin(a) * r, 2.02));
  }
  k.tube(spiral, (t) => 0.02 + 0.08 * t, fossil, g, 100, 6);
  // Dinosaur bones.
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(k.cylinder, fossil);
    b.scale.set(0.08, 0.9, 0.08);
    b.position.set(1.2 + i * 0.4, 2.4, 2.02);
    b.rotation.z = 1.2 + i * 0.3;
    g.add(b);
  }
  // A small mammal skull.
  const skull = new THREE.Mesh(k.sphere, fossil);
  skull.scale.set(0.35, 0.22, 0.05);
  skull.position.set(0.5, 3.6, 2.02);
  g.add(skull);
  return g;
}

export const evidence: Builder = async (k) => {
  k.mood("#141a1c", 20, 50);
  const g = new THREE.Group();
  k.root.add(g);
  const membrane = k.ghost("#6a5a5a", 0.5, { side: THREE.DoubleSide });
  const flipper = k.ghost("#5a6a7a", 0.55, { side: THREE.DoubleSide });
  const limbs = [
    { g: limb(k, { upper: 1.3, fore: 1.1, fingers: [0.5, 0.65, 0.7, 0.65, 0.55], spread: 0.18, thick: 1 }), name: "ადამიანის ხელი" },
    { g: limb(k, { upper: 1.0, fore: 1.5, fingers: [0.3, 1.8, 2.0, 1.8, 1.5], spread: 0.35, thick: 0.7, skin: membrane, skinScale: v(1.4, 1.6, 0.02) }), name: "ღამურის ფრთა" },
    { g: limb(k, { upper: 0.5, fore: 0.6, fingers: [0.8, 1.3, 1.4, 1.1, 0.7], spread: 0.12, thick: 1.6, skin: flipper, skinScale: v(1.2, 0.7, 0.12) }), name: "ვეშაპის ფარფლი" },
    { g: limb(k, { upper: 1.0, fore: 1.2, fingers: [0.3, 0.9], spread: 0.1, thick: 0.8 }), name: "ფრინველის ფრთა" },
  ];
  limbs.forEach((L, i) => {
    L.g.position.set(-2, 3.6 - i * 2.4, 0);
    g.add(L.g);
    k.label(k.anchor(g, v(-2.6, 3.6 - i * 2.4, 0)), L.name, { stages: [0] });
  });
  // Embryos: identical early, different later.
  const emb = new THREE.Group();
  k.root.add(emb);
  const embMat = k.material({ color: "#f0c2b0", roughness: 0.35, clearcoat: 0.6, transparent: true, opacity: 0.92, normalMap: k.normalMap("organic", [2, 2]) });
  const names = ["თევზი", "ფრინველი", "ადამიანი"];
  const extras = names.map((name, i) => {
    const e = new THREE.Group();
    e.position.x = (i - 1) * 4;
    emb.add(e);
    const pts: V3[] = [];
    for (let j = 0; j <= 30; j++) {
      const a = (j / 30) * Math.PI * 1.4 + 0.6;
      pts.push(v(Math.cos(a) * 1.1, Math.sin(a) * 1.3, 0));
    }
    k.tube(pts, (t) => 0.15 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 1.2)) * (t < 0.85 ? 1 : 0.5), embMat, e, 60, 14);
    const head = new THREE.Mesh(k.sphere, embMat);
    head.position.copy(pts[30]).add(v(-0.1, 0.1, 0));
    head.scale.setScalar(0.6);
    e.add(head);
    // Gill slits.
    for (let s = 0; s < 4; s++) {
      const slit = new THREE.Mesh(k.track(new THREE.TorusGeometry(0.12, 0.03, 6, 12)), k.material({ color: "#c27a6a" }));
      slit.position.copy(pts[24 - s * 2]).add(v(0.2, 0, 0.35));
      e.add(slit);
    }
    const later = new THREE.Group();
    e.add(later);
    if (i === 0) {
      const fin = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.4, 0.9, 4)), embMat);
      fin.position.copy(pts[5]).add(v(0.4, 0, 0));
      later.add(fin);
    } else if (i === 1) {
      const beakBud = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.15, 0.5, 8).rotateZ(-Math.PI / 2)), k.material({ color: "#e0a12a" }));
      beakBud.position.copy(head.position).add(v(0.6, -0.1, 0));
      later.add(beakBud);
      const wing = new THREE.Mesh(k.sphere, embMat);
      wing.scale.set(0.5, 0.2, 0.15);
      wing.position.copy(pts[18]).add(v(0.5, 0, 0.3));
      later.add(wing);
    } else {
      const big = new THREE.Mesh(k.sphere, embMat);
      big.scale.setScalar(0.9);
      big.position.copy(head.position).add(v(0, 0.3, 0));
      later.add(big);
      for (const y of [12, 20]) {
        const bud = new THREE.Mesh(k.sphere, embMat);
        bud.scale.set(0.45, 0.18, 0.18);
        bud.position.copy(pts[y]).add(v(0.5, 0, 0.3));
        later.add(bud);
      }
    }
    k.label(k.anchor(e, v(0, -2, 0)), name, { stages: [1] });
    return later;
  });
  const embTag = k.label(k.anchor(emb, v(0, 2.6, 0)), "", { kind: "tag", stages: [1] });
  const rocks = new THREE.Group();
  k.root.add(rocks);
  strata(k, rocks, [2]);
  const show = (i: number) => {
    g.visible = i === 0;
    emb.visible = i === 1;
    rocks.visible = i === 2;
  };
  return {
    stages: [
      { duration: 16, enter: () => show(0), update: (_u, s) => orbit(v(0.6, 0, 0), 12.5, s, { start: 0.15, speed: 0.03, height: 0.08 }) },
      {
        duration: 16,
        cut: true,
        enter: () => show(1),
        update: (u, s) => {
          extras.forEach((x) => x.scale.setScalar(Math.max(0.001, ease((u - 0.45) / 0.3))));
          setText(embTag, u < 0.45 ? "ადრეული ჩანასახები — თითქმის ერთნაირი" : "მოგვიანებით — განსხვავებული");
          return orbit(v(0, 0, 0), 13, s, { start: 0.1, speed: 0.02, height: 0.1 });
        },
      },
      { duration: 16, cut: true, enter: () => show(2), update: (_u, s) => orbit(v(0, 1.8, 0), 14, s, { start: 0.35, speed: 0.025, height: 0.15 }) },
    ],
  };
};

// ---- 12 Comparative biology and palaeontology -------------------------------------------------------------------

export const paleontology: Builder = async (k) => {
  const rocks = new THREE.Group();
  k.root.add(rocks);
  strata(k, rocks, [0]);
  // Archaeopteryx: a feathered bird with teeth, clawed wings and a long bony tail.
  const ar = new THREE.Group();
  k.root.add(ar);
  const b = bird(k, "#7a5a3a");
  b.g.scale.setScalar(9);
  ar.add(b.g);
  const toothMat = k.material({ color: "#f3efe6" });
  for (let i = 0; i < 5; i++) {
    const tooth = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.03, 0.12, 5).rotateX(Math.PI)), toothMat);
    tooth.position.set((i - 2) * 0.06, 0.55, 2.5 + i * 0.05);
    ar.add(tooth);
  }
  const tailMat = k.material({ color: "#6a4a2a", roughness: 0.6 });
  for (let i = 0; i < 14; i++) {
    const seg = new THREE.Mesh(k.sphere, tailMat);
    seg.scale.set(0.12, 0.1, 0.18);
    seg.position.set(0, -0.1 - i * 0.03, -2 - i * 0.28);
    ar.add(seg);
    const feather = new THREE.Mesh(k.sphere, k.material({ color: "#8a6a48", roughness: 0.7, side: THREE.DoubleSide }));
    feather.scale.set(0.5, 0.02, 0.14);
    feather.position.copy(seg.position);
    ar.add(feather);
  }
  const claws = [-1, 1].map((s) => {
    const c = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.05, 0.25, 6)), k.material({ color: "#2a2018" }));
    c.position.set(s * 2.2, 0.4, 0.6);
    c.rotation.z = s * 1.2;
    ar.add(c);
    return c;
  });
  void claws;
  k.label(k.anchor(ar, v(0, 0.7, 2.6)), "კბილები", { stages: [1] });
  k.label(k.anchor(ar, v(2.2, 0.6, 0.6)), "კლანჭები ფრთაზე", { stages: [1] });
  k.label(k.anchor(ar, v(0, -0.2, -4.5)), "გრძელი ძვლოვანი კუდი", { stages: [1] });
  k.label(k.anchor(ar, v(-1.5, 0.6, 0)), "ბუმბული და ფრთები", { stages: [1] });
  // Rudiments in the human body.
  const body = await k.body({ organs: true });
  const hb = new THREE.Group();
  k.root.add(hb);
  context(k, body, hb, 0.08, 0.14);
  layer(k, body, hb, (p) => p.group === "digestive" && /colon|ileum|jejunum|rectum|cecum/i.test(p.name), k.ghost("#d9a38f", 0.35), 2);
  const app = layer(k, body, hb, (p) => /appendix/i.test(p.name), k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.4 }), 1);
  const coccyx = layer(k, body, hb, (p) => p.group === "skeleton" && /coccyx/i.test(p.name), k.material({ color: "#f2c230", emissive: "#f2c230", emissiveIntensity: 0.4 }), 1);
  const ac = app.geometry.boundingBox!.getCenter(new THREE.Vector3());
  const cc = coccyx.geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? v(0, 0.93, -0.06);
  k.label(k.anchor(hb, ac), "ჭიაყელასებრი დანამატი", { stages: [2] });
  k.label(k.anchor(hb, cc), "კუდუსუნი", { stages: [2] });
  const show = (i: number) => {
    rocks.visible = i === 0;
    ar.visible = i === 1;
    hb.visible = i === 2;
    k.mood(i === 2 ? null : "#141a1c", 20, 50);
  };
  return {
    stages: [
      { duration: 16, enter: () => show(0), update: (_u, s) => orbit(v(0, 1.8, 0), 14, s, { start: 0.35, speed: 0.025, height: 0.15 }) },
      {
        duration: 16,
        cut: true,
        enter: () => show(1),
        update: (_u, s, t) => {
          b.move(t * 1.5);
          return orbit(v(0, 0, -0.8), 9, s, { start: 0.9, speed: 0.05, height: 0.35 });
        },
      },
      { duration: 15, cut: true, enter: () => show(2), update: (_u, s) => orbit(v(-0.02, 0.98, 0.0), 0.65, s, { start: -0.6, speed: 0.06, height: 0.1 }) },
    ],
  };
};
