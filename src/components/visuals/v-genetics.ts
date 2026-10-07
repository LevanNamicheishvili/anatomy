import * as THREE from "three";
import { beads, curve, orbit } from "@/components/journeys/common";
import { ease, rng, v, type Builder, type Kit, type Shot, type V3 } from "@/components/journeys/JourneyScene";
import { bacterium, chromosome, dnaLadder, egg, pea, peaPlant, person, phage, sheep, sperm } from "./micro";
import { grass, ground, outdoor, rabbit, tree, natureMaterials, beetle } from "./nature";

/*
 * Genetics lessons: Mendel's garden and counting, mono- and dihybrid crosses with real-looking peas,
 * probability with gametes drawn at random, the test cross, sex chromosomes, sex-linked inheritance in a
 * pedigree, gene interaction, modification variability, biotechnology, genetic engineering, cloning,
 * human genetics methods, medical biotechnology, and gene transfer between bacteria.
 */

const setText = (el: HTMLDivElement, text: string) => {
  const t = el.querySelector(".blood-label-text") ?? el;
  if (t.textContent !== text) t.textContent = text;
};
const lab = (k: Kit) => k.mood("#141a1c", 25, 60);
const front = (s: number, d: number, at = v(0, 0, 0), h = 0.18): Shot => orbit(at, d, 0, { start: Math.sin(s * 0.15) * 0.18, height: h });
const tag = (k: Kit, parent: THREE.Object3D, p: V3, text: string, stages?: number[]) => k.label(k.anchor(parent, p), text, { kind: "tag", stages });

// ---- Mendel's methods ---------------------------------------------------------------------------------

export const mendel: Builder = async (k) => {
  outdoor(k, "#cfe0d6", 18, 45);
  const g = new THREE.Group();
  k.root.add(g);
  ground(k, g, { radius: 10 });
  grass(k, g, 500, 9, { seed: 3 });
  const M = natureMaterials(k);
  tree(k, M, g, v(-7, 0, -6), { scale: 1 });
  // Four plants showing trait pairs.
  const pairs = [
    { tall: true, flower: "#a46be0", t: "მაღალი" },
    { tall: false, flower: "#a46be0", t: "დაბალი" },
    { tall: true, flower: "#f4f1ea", t: "თეთრი ყვავილი" },
    { tall: true, flower: "#a46be0", t: "იისფერი ყვავილი" },
  ];
  const show = new THREE.Group();
  g.add(show);
  pairs.forEach((p, i) => {
    const pl = peaPlant(k, { tall: p.tall, flower: p.flower, seed: i });
    pl.g.position.set(-3 + i * 2, 0, 0);
    show.add(pl.g);
    tag(k, show, v(-3 + i * 2, p.tall ? 3 : 1.6, 0), p.t, [0]);
  });
  const seeds = [pea(k, true, true, 0.25), pea(k, false, true, 0.25), pea(k, true, false, 0.25), pea(k, false, false, 0.25)];
  seeds.forEach((s, i) => {
    s.position.set(-2.4 + i * 1.6, 0.4, 2);
    show.add(s);
  });
  tag(k, show, v(-0.8, 0.9, 2), "ყვითელი / მწვანე", [0]);
  tag(k, show, v(2.4, 0.9, 2), "გლუვი / დანაოჭებული", [0]);
  // Pure lines: three generations alike.
  const lines = new THREE.Group();
  g.add(lines);
  const gens = [0, 1, 2].map((row) => {
    const rg = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const pl = peaPlant(k, { tall: true, flower: "#a46be0", seed: row * 4 + i });
      pl.g.position.set(-3 + i * 2, 0, -row * 2.5);
      pl.g.scale.setScalar(0.8);
      rg.add(pl.g);
    }
    lines.add(rg);
    tag(k, lines, v(5, 1, -row * 2.5), `თაობა ${row + 1}`, [1]);
    return rg;
  });
  // Cross-pollination with a brush.
  const cross = new THREE.Group();
  g.add(cross);
  const A = peaPlant(k, { flower: "#a46be0", seed: 7 });
  A.g.position.set(-2, 0, 0);
  const B = peaPlant(k, { flower: "#f4f1ea", seed: 8 });
  B.g.position.set(2, 0, 0);
  cross.add(A.g, B.g);
  const brush = new THREE.Group();
  const handle = new THREE.Mesh(k.cylinder, k.material({ color: "#a0703a" }));
  handle.scale.set(0.04, 1.2, 0.04);
  handle.position.y = 0.6;
  const tip = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.07, 0.25, 8).rotateX(Math.PI)), k.material({ color: "#2a2018" }));
  brush.add(handle, tip);
  cross.add(brush);
  const pollen = beads(k, cross, curve([v(-1.8, 2.3, 0.1), v(0, 3.4, 0.4), v(1.8, 2.3, 0.1)]), { n: 14, color: "#f2c230", size: 0.05, speed: 0.15, emissive: 0.8 });
  tag(k, cross, v(-2, 3.2, 0), "მტვრის აღება", [2]);
  tag(k, cross, v(2, 3.2, 0), "დამტვერვა", [2]);
  // Counting.
  const count = new THREE.Group();
  g.add(count);
  const binMat = k.ghost("#dfeff5", 0.3, { side: THREE.DoubleSide, roughness: 0.05, clearcoat: 1 });
  const bins = [-1.6, 1.6].map((x) => {
    const b = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.1, 1, 2.4, 32, 1, true)), binMat);
    b.position.set(x, 1.2, 0);
    count.add(b);
    return b;
  });
  void bins;
  const fillY = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1, 1, 1, 32).translate(0, 0.5, 0)), k.material({ color: "#e9c63a", roughness: 0.4, normalMap: k.normalMap("organic", [6, 6]) }));
  const fillG = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1, 1, 1, 32).translate(0, 0.5, 0)), k.material({ color: "#6aa83a", roughness: 0.4, normalMap: k.normalMap("organic", [6, 6]) }));
  fillY.position.set(-1.6, 0.02, 0);
  fillG.position.set(1.6, 0.02, 0);
  count.add(fillY, fillG);
  const cY = tag(k, count, v(-1.6, 3, 0), "", [3]);
  const cG = tag(k, count, v(1.6, 3, 0), "", [3]);
  const groups = [show, lines, cross, count];
  return {
    stages: [0, 1, 2, 3].map((i) => ({
      duration: 15,
      enter: () => groups.forEach((x, j) => (x.visible = i === j)),
      update: (u: number, s: number, t: number) => {
        if (i === 1) gens.forEach((rg, j) => rg.scale.setScalar(Math.max(0.001, ease(u * 2.5 - j * 0.6))));
        if (i === 2) {
          const f = (s % 5) / 5;
          const p = f < 0.5 ? ease(f * 2) : 1 - ease((f - 0.5) * 2);
          brush.position.set(-1.8 + 3.6 * p, 2.3 + Math.sin(p * Math.PI) * 1.1, 0.2);
          pollen.update(t);
        }
        if (i === 3) {
          const f = ease(u / 0.85);
          fillY.scale.set(1, 0.01 + 2.0 * f, 1);
          fillG.scale.set(1, 0.01 + 0.67 * f, 1);
          setText(cY, `ყვითელი ${Math.round(6022 * f)}`);
          setText(cG, `მწვანე ${Math.round(2001 * f)}`);
        }
        return front(s, i === 1 ? 13 : 10, v(0, 1.2, i === 1 ? -2 : 0), 0.25);
      },
    })),
  };
};

// ---- Monohybrid cross -----------------------------------------------------------------------------------

export const monohybrid: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const P = [pea(k, true, true, 0.8), pea(k, false, true, 0.8)];
  P[0].position.set(-3, 3, 0);
  P[1].position.set(3, 3, 0);
  g.add(...P);
  tag(k, g, v(-3, 4.2, 0), "AA — ყვითელი", [0, 1]);
  tag(k, g, v(3, 4.2, 0), "aa — მწვანე", [0, 1]);
  // Gametes move from the parents to the F₁.
  const gA = new THREE.Mesh(k.sphere, k.material({ color: "#e9c63a", emissive: "#e9c63a", emissiveIntensity: 0.3 }));
  const ga = new THREE.Mesh(k.sphere, k.material({ color: "#6aa83a", emissive: "#6aa83a", emissiveIntensity: 0.3 }));
  gA.scale.setScalar(0.3);
  ga.scale.setScalar(0.3);
  g.add(gA, ga);
  const gAt = k.anchor(g, v(0, 0, 0));
  const gat = k.anchor(g, v(0, 0, 0));
  k.label(gAt, "A", { kind: "tag", stages: [0] });
  k.label(gat, "a", { kind: "tag", stages: [0] });
  const F1 = [0, 1, 2, 3].map((i) => {
    const p = pea(k, true, true, 0.55);
    p.position.set(-2.4 + i * 1.6, 0.6, 0);
    g.add(p);
    return p;
  });
  tag(k, g, v(0, 1.6, 0), "F₁: Aa — ყველა ყვითელი", [1]);
  // F₂ as a Punnett square of peas.
  const F2 = new THREE.Group();
  g.add(F2);
  const cells = [
    ["AA", true],
    ["Aa", true],
    ["Aa", true],
    ["aa", false],
  ] as const;
  cells.forEach(([gt, y], i) => {
    const p = pea(k, y, true, 0.55);
    const x = (i % 2) * 1.6 - 0.8;
    const z = Math.floor(i / 2) * 1.6 - 0.8;
    p.position.set(x, -1.8, z);
    F2.add(p);
    tag(k, F2, v(x, -1.0, z), gt, [2]);
  });
  tag(k, F2, v(-2.2, -1.8, -0.8), "A", [2]);
  tag(k, F2, v(-2.2, -1.8, 0.8), "a", [2]);
  tag(k, F2, v(-0.8, -1.8, -2.2), "A", [2]);
  tag(k, F2, v(0.8, -1.8, -2.2), "a", [2]);
  tag(k, F2, v(0, -3.3, 0), "3 ყვითელი : 1 მწვანე", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number) => {
        const f = i === 0 ? ease((u - 0.2) / 0.6) : 1;
        gA.visible = ga.visible = i === 0;
        gA.position.lerpVectors(v(-3, 3, 0), v(-0.4, 0.8, 0), f);
        ga.position.lerpVectors(v(3, 3, 0), v(0.4, 0.8, 0), f);
        gAt.position.copy(gA.position).add(v(0, 0.5, 0));
        gat.position.copy(ga.position).add(v(0, 0.5, 0));
        F1.forEach((p, j) => (p.visible = i === 1 && u > j * 0.12));
        P.forEach((p) => (p.visible = i < 2));
        F2.visible = i === 2;
        F2.scale.setScalar(Math.max(0.001, i === 2 ? ease(u / 0.3) : 0));
        return front(s, 12, v(0, i === 2 ? -1 : 1.2, 0), i === 2 ? 0.55 : 0.15);
      },
    })),
  };
};

// ---- Probability -------------------------------------------------------------------------------------------

export const probability: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(42);
  // Draws: each is one random gamete from each parent.
  const draws = Array.from({ length: 400 }, () => (r() < 0.5 ? 1 : 0) + (r() < 0.5 ? 1 : 0));
  const bagMat = k.ghost("#dfeff5", 0.25, { side: THREE.DoubleSide, roughness: 0.05, clearcoat: 1 });
  const ballA = k.material({ color: "#e9c63a", emissive: "#e9c63a", emissiveIntensity: 0.2 });
  const balla = k.material({ color: "#6aa83a", emissive: "#6aa83a", emissiveIntensity: 0.2 });
  [-4, 4].forEach((x) => {
    const bag = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.2, 1.2, 2.2, 32, 1, true)), bagMat);
    bag.position.set(x, 3, 0);
    g.add(bag);
    for (let i = 0; i < 16; i++) {
      const b = new THREE.Mesh(k.sphere, i % 2 ? ballA : balla);
      b.scale.setScalar(0.22);
      b.position.set(x + (r() - 0.5) * 1.6, 2.2 + r() * 1.4, (r() - 0.5) * 1.6);
      g.add(b);
    }
    tag(k, g, v(x, 4.6, 0), "Aa — გამეტები A და a");
  });
  // Three bins with growing columns.
  const names = ["AA", "Aa", "aa"];
  const colors = ["#e9c63a", "#c9c43a", "#6aa83a"];
  const cols = names.map((n, i) => {
    const c = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.4, 1, 1.4).translate(0, 0.5, 0)), k.material({ color: colors[i], roughness: 0.5 }));
    c.position.set((i - 1) * 2.2, -2.5, 0);
    g.add(c);
    tag(k, g, v((i - 1) * 2.2, -2.9, 0.9), n);
    return { c, label: tag(k, g, v((i - 1) * 2.2, -1.7, 0.9), "") };
  });
  const fly = [new THREE.Mesh(k.sphere, ballA), new THREE.Mesh(k.sphere, balla)];
  fly.forEach((b) => {
    b.scale.setScalar(0.25);
    g.add(b);
  });
  const ratio = tag(k, g, v(0, 1.6, 0), "");
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number) => {
        const n = i === 0 ? Math.floor(u * 4) : i === 1 ? Math.floor(u * 8.99) : Math.floor(8 + 392 * ease(u / 0.85));
        const tally = [0, 0, 0];
        for (let j = 0; j < n; j++) tally[2 - draws[j]]++;
        const max = Math.max(4, ...tally);
        cols.forEach((c, j) => {
          c.c.scale.y = 0.01 + (4 * tally[j]) / max;
          setText(c.label, String(tally[j]));
        });
        // The current pair flies from the bags to the bins.
        const f = i === 2 ? 1 : (u * (i === 0 ? 4 : 9)) % 1;
        const d = draws[n] ?? 0;
        fly[0].material = d >= 1 ? ballA : balla;
        fly[1].material = d === 2 ? ballA : balla;
        fly[0].position.lerpVectors(v(-4, 3, 0), v((1 - d) * 2.2 - 0.25, 0.5, 0), ease(f));
        fly[1].position.lerpVectors(v(4, 3, 0), v((1 - d) * 2.2 + 0.25, 0.5, 0), ease(f));
        fly.forEach((b) => (b.visible = i < 2));
        const yellow = tally[0] + tally[1];
        setText(ratio, n ? `ყვითელი : მწვანე = ${yellow} : ${tally[2]}  (${tally[2] ? (yellow / tally[2]).toFixed(2) : "–"} : 1)` : "ვიწყებთ…");
        return front(s, 14, v(0, 0.8, 0), 0.12);
      },
    })),
  };
};

// ---- Dihybrid cross ----------------------------------------------------------------------------------------

export const dihybrid: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const P = [pea(k, true, true, 0.7), pea(k, false, false, 0.7)];
  P[0].position.set(-2.5, 4, 0);
  P[1].position.set(2.5, 4, 0);
  g.add(...P);
  tag(k, g, v(-2.5, 5, 0), "AABB", [0]);
  tag(k, g, v(2.5, 5, 0), "aabb", [0]);
  const f1 = pea(k, true, true, 0.7);
  f1.position.set(0, 2, 0);
  g.add(f1);
  tag(k, g, v(0, 3, 0), "F₁: AaBb", [0, 1]);
  const gam = ["AB", "Ab", "aB", "ab"];
  const gameteBalls = gam.map((x, i) => {
    const b = new THREE.Mesh(k.sphere, k.material({ color: x[0] === "A" ? "#e9c63a" : "#6aa83a", roughness: 0.4 }));
    b.scale.setScalar(0.28);
    g.add(b);
    tag(k, b, v(0, 2, 0), x, [1]);
    return { b, i };
  });
  // 4×4 square.
  const grid = new THREE.Group();
  g.add(grid);
  const peas: { m: THREE.Mesh; type: number; home: V3 }[] = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      const a = gam[r][0] === "A" || gam[c][0] === "A";
      const b = gam[r][1] === "B" || gam[c][1] === "B";
      const m = pea(k, a, b, 0.32);
      const home = v((c - 1.5) * 0.9, -1.4 - (r - 1.5) * 0.9, 0);
      m.position.copy(home);
      grid.add(m);
      peas.push({ m, type: (a ? 0 : 2) + (b ? 0 : 1), home });
    }
  gam.forEach((x, i) => {
    tag(k, grid, v((i - 1.5) * 0.9, 0.2, 0), x, [2]);
    tag(k, grid, v(-2.4, -1.4 - (i - 1.5) * 0.9, 0), x, [2]);
  });
  const binNames = ["9 ყვითელი გლუვი", "3 ყვითელი დანაოჭებული", "3 მწვანე გლუვი", "1 მწვანე დანაოჭებული"];
  binNames.forEach((n, i) => tag(k, grid, v(3.2, -0.2 - i * 0.95, 0), n, [2]));
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: i === 2 ? 18 : 14,
      update: (u: number, s: number) => {
        P.forEach((p) => (p.visible = i === 0));
        f1.visible = i < 2;
        gameteBalls.forEach(({ b, i: j }) => {
          b.visible = i === 1;
          const a = (j / 4) * Math.PI * 2;
          b.position.copy(f1.position).add(v(Math.cos(a) * 2.2 * ease(u / 0.5), Math.sin(a) * 1.4 * ease(u / 0.5), 0));
        });
        grid.visible = i === 2;
        // Peas slide from the square into rows by type.
        const sort = i === 2 ? ease((u - 0.4) / 0.4) : 0;
        const counters = [0, 0, 0, 0];
        peas.forEach((p) => {
          const n = counters[p.type]++;
          const to = v(3.2 + 0.8 + n * 0.6, -0.2 - p.type * 0.95 - 0.45, 0);
          p.m.position.lerpVectors(p.home, to, sort);
        });
        return front(s, 12, v(i === 2 ? 1.5 : 0, i === 2 ? -1.4 : 2.5, 0), 0.1);
      },
    })),
  };
};

// ---- Test cross ----------------------------------------------------------------------------------------------

export const testcross: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const q = pea(k, true, true, 0.8);
  q.position.set(-2, 3, 0);
  const rec = pea(k, false, true, 0.8);
  rec.position.set(2, 3, 0);
  g.add(q, rec);
  const qTag = tag(k, g, v(-2, 4.2, 0), "AA თუ Aa ?");
  tag(k, g, v(2, 4.2, 0), "aa");
  tag(k, g, v(0, 3, 0), "×");
  const kids = new THREE.Group();
  g.add(kids);
  const sets = [
    [true, true, true, true],
    [true, false, true, false],
  ].map((row) =>
    row.map((y, i) => {
      const p = pea(k, y, true, 0.5);
      p.position.set(-2.4 + i * 1.6, 0.2, 0);
      kids.add(p);
      return p;
    }),
  );
  const res = tag(k, g, v(0, -1, 0), "");
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number) => {
        kids.visible = i > 0;
        sets.forEach((set, j) => set.forEach((p, n) => (p.visible = i === j + 1 && u > 0.15 + n * 0.1)));
        setText(qTag, i === 0 ? "AA თუ Aa ?" : i === 1 ? "AA" : "Aa");
        setText(res, i === 0 ? "ვაჯვარებთ რეცესიულ ჰომოზიგოტასთან" : i === 1 ? "ყველა ყვითელი → AA" : "1 : 1 → Aa");
        return front(s, 11, v(0, 1.6, 0), 0.12);
      },
    })),
  };
};

// ---- Sex chromosomes ------------------------------------------------------------------------------------------

export const sexChromosomes: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  // Karyotype: 22 pairs by size, then the sex pair.
  const kar = new THREE.Group();
  g.add(kar);
  for (let i = 0; i < 22; i++) {
    const L = 1.6 - i * 0.055;
    for (const s of [0, 1]) {
      const c = chromosome(k, { color: "#8a6ac0", length: L });
      c.scale.setScalar(0.55);
      c.position.set(-6 + (i % 11) * 1.15 + s * 0.42, i < 11 ? 2 : -0.4, 0);
      kar.add(c);
    }
  }
  const x1 = chromosome(k, { color: "#e05a8a", length: 1.3 });
  const x2 = chromosome(k, { color: "#e05a8a", length: 1.3 });
  const yC = chromosome(k, { color: "#4a8ae0", length: 0.55 });
  [x1, x2, yC].forEach((c, i) => {
    c.scale.setScalar(0.55);
    c.position.set(-1 + i * 0.45, -2.8, 0);
    kar.add(c);
  });
  const sexTag = tag(k, kar, v(-0.6, -3.8, 0), "");
  // Egg and sperm.
  const fert = new THREE.Group();
  g.add(fert);
  const e = egg(k, 1.6);
  e.g.position.set(3, 0, 0);
  fert.add(e.g);
  tag(k, fert, v(3, 2.2, 0), "კვერცხუჯრედი: X");
  const sperms = Array.from({ length: 6 }, (_, i) => {
    const sp = sperm(k, i % 2 ? "#a8c8f0" : "#f0b8d0");
    sp.g.scale.setScalar(2);
    fert.add(sp.g);
    const t = k.anchor(fert, v(0, 0, 0));
    k.label(t, i % 2 ? "Y" : "X", { kind: "tag", stages: [1, 2] });
    return { sp, t, y: i % 2 === 1 };
  });
  const result = tag(k, fert, v(3, -2.4, 0), "", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        kar.visible = i === 0;
        fert.visible = i > 0;
        const male = s % 8 > 4;
        x2.visible = !male;
        yC.visible = male;
        yC.position.x = -0.55;
        setText(sexTag, male ? "XY — მამაკაცი" : "XX — ქალი");
        // Sperm swim towards the egg; in the last stage one of them arrives.
        const winner = Math.floor(s / 5) % 2;
        sperms.forEach(({ sp, t: anchor, y }, j) => {
          const lane = (j - 2.5) * 0.7;
          let x = -6 + ((t * 0.9 + j * 0.8) % 6);
          if (i === 2 && j === winner) x = -6 + 7.4 * ease((s % 5) / 4);
          sp.g.position.set(Math.min(x, 1.4), lane * (i === 2 && j === winner ? 1 - ease((s % 5) / 4) : 1), 0);
          sp.g.rotation.y = Math.PI / 2;
          sp.swim(t + j);
          anchor.position.copy(sp.g.position).add(v(0, 0.5, 0));
          void y;
        });
        setText(result, winner === 1 ? "Y + X → XY — ბიჭი" : "X + X → XX — გოგონა");
        return front(s, i === 0 ? 14 : 11, v(i === 0 ? -0.5 : 0, i === 0 ? 0 : 0, 0), 0.08);
      },
    })),
  };
};

// ---- Sex-linked inheritance ------------------------------------------------------------------------------------

export const sexLinked: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const xh = chromosome(k, { color: "#e05a8a", length: 2.2, bands: [{ at: 0.25, color: "#e0242a" }] });
  const xH = chromosome(k, { color: "#e05a8a", length: 2.2, bands: [{ at: 0.25, color: "#2ab060" }] });
  const y = chromosome(k, { color: "#4a8ae0", length: 0.9 });
  xh.position.set(-1.5, 0, 0);
  xH.position.set(0, 0, 0);
  y.position.set(1.5, -0.6, 0);
  const chromos = new THREE.Group();
  chromos.add(xh, xH, y);
  g.add(chromos);
  tag(k, chromos, v(-1.5, 1.8, 0), "Xʰ — ჰემოფილია", [0]);
  tag(k, chromos, v(0, 1.8, 0), "Xᴴ — ჯანმრთელი", [0]);
  tag(k, chromos, v(1.5, 0.4, 0), "Y — ამ გენის გარეშე", [0]);
  // Pedigree.
  const ped = new THREE.Group();
  g.add(ped);
  const mother = person(k, false, "carrier");
  mother.position.set(-1.5, 2, 0);
  const father = person(k, true, "healthy");
  father.position.set(1.5, 2, 0);
  ped.add(mother, father);
  tag(k, ped, v(-1.5, 2.9, 0), "დედა XᴴXʰ");
  tag(k, ped, v(1.5, 2.9, 0), "მამა XᴴY");
  const line = new THREE.Mesh(k.cylinder, k.material({ color: "#c9d1ce" }));
  line.scale.set(0.04, 3, 0.04);
  line.rotation.z = Math.PI / 2;
  line.position.set(0, 2, 0);
  ped.add(line);
  const kids = [
    { male: false, st: "healthy" as const, t: "XᴴXᴴ" },
    { male: false, st: "carrier" as const, t: "XᴴXʰ — მატარებელი" },
    { male: true, st: "healthy" as const, t: "XᴴY" },
    { male: true, st: "affected" as const, t: "XʰY — ავადაა" },
  ].map((c, i) => {
    const p = person(k, c.male, c.st);
    p.position.set(-3.3 + i * 2.2, -0.6, 0);
    ped.add(p);
    const stub = new THREE.Mesh(k.cylinder, k.material({ color: "#c9d1ce" }));
    stub.scale.set(0.04, 1, 0.04);
    stub.position.set(-3.3 + i * 2.2, 0.4, 0);
    ped.add(stub);
    tag(k, ped, v(-3.3 + i * 2.2, -1.6, 0), c.t);
    return p;
  });
  const bar = new THREE.Mesh(k.cylinder, k.material({ color: "#c9d1ce" }));
  bar.scale.set(0.04, 6.6, 0.04);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, 0.9, 0);
  const drop = new THREE.Mesh(k.cylinder, k.material({ color: "#c9d1ce" }));
  drop.scale.set(0.04, 1.1, 0.04);
  drop.position.set(0, 1.45, 0);
  ped.add(bar, drop);
  const note = tag(k, ped, v(0, -2.6, 0), "", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        chromos.visible = i === 0;
        ped.visible = i > 0;
        kids.forEach((p, j) => {
          p.scale.setScalar(Math.max(0.001, i === 1 ? ease(u * 3 - j * 0.4) : 1));
          p.position.y = -0.6 + (i === 2 && j >= 2 ? Math.sin(t * 3) * 0.12 : 0);
        });
        setText(note, "ვაჟებიდან ნახევარი ავადაა: მამაკაცს ერთი X აქვს");
        return front(s, 11, v(0, i === 0 ? 0.3 : 0.6, 0), 0.08);
      },
    })),
  };
};

// ---- Gene interaction ------------------------------------------------------------------------------------------

export const geneInteraction: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  // Pathway: colourless → (enzyme C) → colourless → (enzyme P) → purple.
  const path = new THREE.Group();
  g.add(path);
  const steps = [v(-5, 1, 0), v(0, 1, 0), v(5, 1, 0)];
  const cols = ["#f2f2f2", "#e6dff0", "#7a3ab0"];
  steps.forEach((p, i) => {
    const m = new THREE.Mesh(k.sphere, k.material({ color: cols[i], roughness: 0.4, clearcoat: 0.6 }));
    m.position.copy(p);
    m.scale.setScalar(0.7);
    path.add(m);
  });
  const enz = [v(-2.5, 1.8, 0), v(2.5, 1.8, 0)].map((p, i) => {
    const e = new THREE.Mesh(k.track(new THREE.SphereGeometry(0.5, 24, 16, 0.6, Math.PI * 2 - 1.2)), k.material({ color: i ? "#3fae8f" : "#e0a12a", roughness: 0.4, side: THREE.DoubleSide }));
    e.position.copy(p);
    path.add(e);
    tag(k, path, p.clone().add(v(0, 0.8, 0)), i ? "ფერმენტი P (გენი P)" : "ფერმენტი C (გენი C)", [0]);
    return e;
  });
  const flow = beads(k, path, curve([steps[0], v(-2.5, 1.2, 0), steps[1], v(2.5, 1.2, 0), steps[2]]), { n: 16, color: "#b98ae0", size: 0.15, speed: 0.12 });
  const flowers = [true, false, false, true].map((purple, i) => {
    const f = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const p = new THREE.Mesh(k.sphere, k.material({ color: purple ? "#7a3ab0" : "#f4f1ea", roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color("#ffffff") }));
      const a = (j / 5) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.35, Math.sin(a) * 0.35, 0);
      p.scale.set(0.3, 0.22, 0.06);
      p.rotation.z = a;
      f.add(p);
    }
    f.position.set(-4.5 + i * 3, -2.2, 0);
    path.add(f);
    tag(k, path, v(-4.5 + i * 3, -3.2, 0), ["C_P_", "C_pp", "ccP_", "C_P_"][i], [0]);
    return f;
  });
  void flowers;
  // Pleiotropy: red cells turning sickle.
  const sick = new THREE.Group();
  g.add(sick);
  const rbcGeo = k.redCell();
  const sickleGeo = k.track(new THREE.TorusGeometry(0.5, 0.14, 10, 24, Math.PI * 1.1));
  const cells = Array.from({ length: 24 }, (_, i) => {
    const m = new THREE.Mesh(rbcGeo, k.material({ color: "#c41e25", roughness: 0.35, clearcoat: 0.7 }));
    m.scale.setScalar(1.1);
    m.position.set(-6 + (i % 8) * 1.7, 1.6 - Math.floor(i / 8) * 1.7, 0);
    m.rotation.x = Math.PI / 2;
    sick.add(m);
    return m;
  });
  const sickle = cells.map((c) => {
    const m = new THREE.Mesh(sickleGeo, c.material);
    m.position.copy(c.position);
    m.rotation.z = c.position.x;
    sick.add(m);
    return m;
  });
  const pleTag = tag(k, sick, v(0, 3.2, 0), "", [1]);
  // Polygeny: a row of skin tones by number of "dark" alleles.
  const poly = new THREE.Group();
  g.add(poly);
  const tones = ["#f6dcc7", "#eac3a6", "#d7a37f", "#bd8660", "#9a6747", "#784a32", "#553424"];
  tones.forEach((c, i) => {
    const b = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.1, 1 + [1, 6, 15, 20, 15, 6, 1][i] * 0.18, 1.1).translate(0, 0.5, 0)), k.material({ color: c, roughness: 0.6 }));
    b.position.set(-5 + i * 1.65, -2, 0);
    poly.add(b);
    tag(k, poly, v(-5 + i * 1.65, -2.6, 0.7), `${i} მუქი ალელი`, [2]);
  });
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        path.visible = i === 0;
        sick.visible = i === 1;
        poly.visible = i === 2;
        flow.update(t);
        enz.forEach((e, j) => (e.rotation.z = Math.sin(t * 3 + j) * 0.2));
        const m = i === 1 ? ease((u - 0.3) / 0.4) : 0;
        cells.forEach((c, j) => (c.visible = j / cells.length >= m));
        sickle.forEach((c, j) => (c.visible = j / cells.length < m));
        setText(pleTag, m < 0.5 ? "ნორმალური ერითროციტები" : "ნამგლისებრი ერითროციტები → ანემია, მაგრამ მალარიისადმი მდგრადობა");
        return front(s, 14, v(0, i === 2 ? 0 : 0.3, 0), 0.1);
      },
    })),
  };
};

// ---- Modification variability --------------------------------------------------------------------------------------

export const modification: Builder = async (k) => {
  outdoor(k, "#cfe0e6", 20, 50);
  const g = new THREE.Group();
  k.root.add(g);
  ground(k, g, { radius: 10 });
  grass(k, g, 400, 9);
  // Two halves of one plant: valley (tall) and mountain (short rosette).
  const valley = peaPlant(k, { tall: true, flower: "#f2c230", seed: 3 });
  valley.g.position.set(-2.5, 0, 0);
  valley.g.scale.setScalar(1.4);
  const mountain = peaPlant(k, { tall: false, flower: "#f2c230", seed: 3 });
  mountain.g.position.set(2.5, 0, 0);
  mountain.g.scale.set(1.2, 0.6, 1.2);
  const rockMat = k.material({ color: "#8a8780", roughness: 0.9 });
  const rocks = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const r0 = new THREE.Mesh(k.sphere, rockMat);
    r0.position.set(2.5 + Math.cos(i) * 1.2, 0.1, Math.sin(i) * 1.2);
    r0.scale.set(0.4, 0.25, 0.35);
    rocks.add(r0);
  }
  const plants = new THREE.Group();
  plants.add(valley.g, mountain.g, rocks);
  g.add(plants);
  tag(k, plants, v(-2.5, 4.4, 0), "დაბლობი — მაღალი", [0]);
  tag(k, plants, v(2.5, 1.6, 0), "მთა — დაბალი", [0]);
  tag(k, plants, v(0, 5.2, 0), "ერთი და იგივე გენოტიპი", [0]);
  // Himalayan rabbit, with dark ears, nose and paws; an ice pack on its back.
  const hr = new THREE.Group();
  g.add(hr);
  const rb = rabbit(k, "#f4f1ea");
  rb.g.scale.setScalar(4);
  hr.add(rb.g);
  const dark = k.material({ color: "#2a2420", roughness: 0.9 });
  rb.g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.scale.y > 0.9) m.material = dark; // the ears
  });
  const patch = new THREE.Mesh(k.sphere, dark);
  patch.scale.set(0.12, 0.05, 0.16);
  patch.position.set(0, 0.39, -0.02);
  rb.g.add(patch);
  const ice = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.35, 0.12, 0.4)), k.ghost("#dff2ff", 0.7, { roughness: 0.05, clearcoat: 1 }));
  ice.position.set(0, 0.47, -0.02);
  rb.g.add(ice);
  const hrTag = tag(k, hr, v(0, 2.6, 0), "", [1]);
  // Reaction norm: heights of identical clones in many conditions fall within a range.
  const norm = new THREE.Group();
  g.add(norm);
  const hs = [0.8, 1.4, 2, 2.6, 3.1, 2.7, 2.1, 1.5, 1.0];
  hs.forEach((h, i) => {
    const p = peaPlant(k, { tall: true, flower: "#f2c230", seed: 3 });
    p.g.position.set(-4 + i, 0, 0);
    p.g.scale.set(0.8, h / 2.6, 0.8);
    norm.add(p.g);
  });
  const lo = new THREE.Mesh(k.track(new THREE.BoxGeometry(10, 0.03, 0.03)), k.material({ color: "#0f8a74" }));
  lo.position.set(0, 0.8, 0.6);
  const hi = lo.clone();
  hi.position.y = 3.1;
  norm.add(lo, hi);
  tag(k, norm, v(5.3, 3.1, 0.6), "ზედა ზღვარი", [2]);
  tag(k, norm, v(5.3, 0.8, 0.6), "ქვედა ზღვარი", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        plants.visible = i === 0;
        hr.visible = i === 1;
        norm.visible = i === 2;
        valley.g.scale.y = 1.4 * (i === 0 ? 0.3 + 0.7 * ease(u / 0.6) : 1);
        const darken = i === 1 ? ease((u - 0.35) / 0.5) : 0;
        patch.scale.set(0.12 * darken + 0.001, 0.05, 0.16 * darken + 0.001);
        ice.visible = i === 1 && u > 0.1 && u < 0.85;
        setText(hrTag, u < 0.35 ? "ცივი ადგილები — შავი ბეწვი" : u < 0.85 ? "ზურგზე ყინული → ბეწვი შავდება" : "ნიშანი არ მემკვიდრეობს");
        rb.move(t * 0.5);
        return front(s, i === 1 ? 6 : 11, v(0, i === 1 ? 1 : 1.6, 0), 0.2);
      },
    })),
  };
};

// ---- Biotechnology ------------------------------------------------------------------------------------------------

export const biotech: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(9);
  // Dough rising with bubbles; yeast cells budding.
  const bread = new THREE.Group();
  g.add(bread);
  const bowl = new THREE.Mesh(k.track(new THREE.SphereGeometry(2.2, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), k.material({ color: "#c9b8a0", roughness: 0.5, side: THREE.DoubleSide }));
  const dough = new THREE.Mesh(k.sphere, k.material({ color: "#efe0c0", roughness: 0.8, normalMap: k.normalMap("organic", [3, 3]) }));
  dough.scale.set(2, 0.6, 2);
  bread.add(bowl, dough);
  const bubbles = Array.from({ length: 30 }, () => {
    const b = new THREE.Mesh(k.sphere, k.ghost("#ffffff", 0.5, { roughness: 0.05, clearcoat: 1 }));
    b.position.set((r() - 0.5) * 3, -0.5 + r() * 0.8, (r() - 0.5) * 3);
    b.scale.setScalar(0.05 + r() * 0.1);
    bread.add(b);
    return b;
  });
  const yeast = Array.from({ length: 6 }, (_, i) => {
    const y = new THREE.Mesh(k.sphere, k.material({ color: "#d9c27a", roughness: 0.4, clearcoat: 0.5 }));
    y.scale.set(0.35, 0.28, 0.28);
    y.position.set(3.5 + (i % 3) * 0.8, 1.5 + Math.floor(i / 3) * 0.8, 0);
    bread.add(y);
    const bud = new THREE.Mesh(k.sphere, y.material);
    bud.position.set(0.9, 0.3, 0);
    bud.scale.setScalar(0.5);
    y.add(bud);
    return bud;
  });
  tag(k, bread, v(4.3, 2.8, 0), "საფუარის უჯრედები", [0]);
  tag(k, bread, v(0, 1.4, 0), "CO₂ აფუებს ცომს", [0]);
  // Bioreactor.
  const reactor = new THREE.Group();
  g.add(reactor);
  const tank = new THREE.Mesh(k.track(new THREE.CylinderGeometry(2, 2, 5, 32, 1, true)), k.ghost("#dfeff5", 0.25, { side: THREE.DoubleSide, roughness: 0.05, metalness: 0.4, clearcoat: 1 }));
  const liquid = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.9, 1.9, 3.8, 32)), k.ghost("#e8c46a", 0.45));
  liquid.position.y = -0.5;
  const shaft = new THREE.Mesh(k.cylinder, k.material({ color: "#8a8f94", metalness: 0.8, roughness: 0.3 }));
  shaft.scale.set(0.08, 5.4, 0.08);
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.4, 0.05, 0.3)), shaft.material);
    b.rotation.y = (i / 4) * Math.PI;
    blades.add(b);
  }
  blades.position.y = -1.5;
  reactor.add(tank, liquid, shaft, blades);
  const microbes = beads(k, reactor, curve([v(-1.2, -2, 0), v(1, -1, 1), v(-0.5, 0.5, -1), v(1.2, 1.2, 0.5)]), { n: 40, color: "#7cc66a", size: 0.1, speed: 0.1, spread: 1.2 });
  const product = beads(k, reactor, curve([v(2, -2, 0), v(3, -2, 0), v(4, -2.2, 0), v(5, -2.8, 0)]), { n: 12, color: "#5b8def", size: 0.15, speed: 0.15 });
  tag(k, reactor, v(0, 3.2, 0), "ბიორეაქტორი", [1]);
  tag(k, reactor, v(4.5, -1.6, 0), "პროდუქტი: წამალი, ფერმენტი", [1]);
  // GM crop resisting pests.
  const crop = new THREE.Group();
  g.add(crop);
  const plants = Array.from({ length: 16 }, (_, i) => {
    const p = peaPlant(k, { tall: true, flower: "#f4f1ea", seed: i });
    p.g.position.set(-4.5 + (i % 8) * 1.3, -2, Math.floor(i / 8) * 2 - 1);
    crop.add(p.g);
    return p.g;
  });
  const pests = Array.from({ length: 10 }, (_, i) => {
    const b = beetle(k, "#3a2a1a");
    b.g.scale.setScalar(3);
    crop.add(b.g);
    return { b, i };
  });
  tag(k, crop, v(-2.5, 1.6, 0), "ჩვეულებრივი ჯიში", [2]);
  tag(k, crop, v(3, 1.6, 0), "მავნებლისადმი მდგრადი", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        bread.visible = i === 0;
        reactor.visible = i === 1;
        crop.visible = i === 2;
        dough.scale.y = 0.6 + 0.9 * (i === 0 ? ease(u) : 1);
        dough.position.y = -0.3 + 0.45 * (i === 0 ? ease(u) : 1);
        bubbles.forEach((b, j) => (b.position.y = -0.3 + ((t * 0.3 + j * 0.13) % 1) * dough.scale.y));
        yeast.forEach((b, j) => b.scale.setScalar(0.2 + 0.4 * ((t * 0.2 + j * 0.2) % 1)));
        blades.rotation.y = t * 3;
        microbes.update(t);
        product.update(t);
        // Pests eat the ordinary plants (left), fall off the GM ones (right).
        plants.forEach((p, j) => p.scale.setScalar(j % 8 < 4 ? Math.max(0.3, 1 - 0.7 * ease((u - 0.3) / 0.6)) : 1));
        pests.forEach(({ b, i: j }) => {
          const left = j < 6;
          const x = left ? -4.5 + (j % 4) * 1.3 : 1 + (j % 4) * 1.3;
          b.g.position.set(x, left ? -0.2 : -0.2 - ease((u - 0.3) / 0.3) * 2, (j % 2) * 2 - 1);
          b.g.rotation.z = left ? 0 : ease((u - 0.3) / 0.3) * Math.PI;
          b.move(t * 3 + j);
        });
        return front(s, i === 1 ? 11 : 12, v(0, i === 2 ? -0.5 : 0.5, 0), 0.2);
      },
    })),
  };
};

// ---- Genetic engineering ------------------------------------------------------------------------------------------

export const geneticEngineering: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const human = dnaLadder(k, 30, { highlight: [11, 19] });
  human.position.set(-5, 2.5, 0);
  g.add(human);
  tag(k, g, v(-5 + 15 * 0.34, 3.6, 0), "ინსულინის გენი", [0]);
  tag(k, g, v(-5, 3.6, 0), "ადამიანის დნმ", [0]);
  // The cut-out gene (a copy we move).
  const gene = dnaLadder(k, 8, { highlight: [0, 8] });
  g.add(gene);
  const scissors = new THREE.Group();
  const bladeMat = k.material({ color: "#c9ccd0", metalness: 0.8, roughness: 0.25 });
  const blades = [-1, 1].map((s) => {
    const b = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.4, 0.12, 0.05).translate(0.7, 0, 0)), bladeMat);
    b.rotation.z = s * 0.3;
    scissors.add(b);
    return { b, s };
  });
  g.add(scissors);
  tag(k, scissors, v(0, 0.6, 0), "რესტრიქციული ფერმენტი", [0]);
  // Plasmid ring with a gap.
  const ringMat = k.material({ color: "#e0524a", roughness: 0.4 });
  const ring = new THREE.Mesh(k.track(new THREE.TorusGeometry(1.4, 0.12, 12, 64, Math.PI * 1.6)), ringMat);
  ring.position.set(1.5, -1.5, 0);
  ring.rotation.z = Math.PI * 0.2;
  g.add(ring);
  const closed = new THREE.Mesh(k.track(new THREE.TorusGeometry(1.4, 0.12, 12, 64)), ringMat);
  closed.position.copy(ring.position);
  g.add(closed);
  tag(k, g, v(1.5, 0.3, 0), "პლაზმიდი", [1]);
  // Bacteria multiplying, insulin coming out.
  const colony = new THREE.Group();
  g.add(colony);
  const bacs = Array.from({ length: 8 }, (_, i) => {
    const b = bacterium(k);
    b.g.scale.setScalar(0.7);
    b.g.position.set(-4 + (i % 4) * 2.6, Math.floor(i / 4) * 2 - 1, 0);
    colony.add(b.g);
    return b.g;
  });
  const insulin = beads(k, colony, curve([v(-3, 1.5, 0.5), v(0, 3, 1), v(3, 4.5, 0.5)]), { n: 30, color: "#5b8def", size: 0.14, speed: 0.08, spread: 1.5 });
  tag(k, colony, v(0, 3.6, 0), "ინსულინი", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        human.visible = i === 0;
        scissors.visible = i === 0;
        colony.visible = i === 2;
        ring.visible = i === 1 && u < 0.7;
        closed.visible = i === 1 && u >= 0.7;
        gene.visible = i < 2;
        const cut = i === 0 ? ease((u - 0.3) / 0.3) : 1;
        blades.forEach(({ b, s: side }) => (b.rotation.z = side * 0.35 * (1 - Math.abs(Math.sin(t * 4)) * (i === 0 && u < 0.6 ? 1 : 0))));
        scissors.position.set(-5 + 11 * 0.34 - 1.5 + (u < 0.45 ? 0 : 2.7), 2.5, 0.8);
        // Gene lifts out of the human DNA, then flies into the plasmid's gap.
        const into = i === 1 ? ease(u / 0.6) : 0;
        gene.position.lerpVectors(v(-5 + 11 * 0.34, 2.5 + cut * 1.4, 0), v(1.5 - 1.2, -1.5 + 1.0, 0), into);
        gene.scale.setScalar(1 - 0.45 * into);
        bacs.forEach((b, j) => (b.visible = j < Math.pow(2, Math.floor(u * 4)) && i === 2));
        insulin.update(t, i === 2 ? ease((u - 0.3) / 0.4) : 0);
        return front(s, 12, v(i === 2 ? 0 : -1, i === 0 ? 2.5 : i === 1 ? -0.5 : 0.6, 0), 0.12);
      },
    })),
  };
};

// ---- Cloning ---------------------------------------------------------------------------------------------------------

export const cloning: Builder = async (k) => {
  outdoor(k, "#cfe0d6", 20, 50);
  const g = new THREE.Group();
  k.root.add(g);
  ground(k, g, { radius: 10 });
  grass(k, g, 500, 9);
  const donor = sheep(k, "#f2ede4");
  donor.position.set(-3, 0, 0);
  donor.rotation.y = 0.6;
  const eggDonor = sheep(k, "#2a2420");
  eggDonor.position.set(3, 0, 0);
  eggDonor.rotation.y = -0.6;
  const lamb = sheep(k, "#f2ede4");
  lamb.scale.setScalar(0.55);
  lamb.position.set(0, 0, 2);
  g.add(donor, eggDonor, lamb);
  tag(k, g, v(-3, 1.8, 0), "დონორი — თეთრსახიანი", [0, 2]);
  tag(k, g, v(3, 1.8, 0), "შავსახიანი ცხვარი", [0, 2]);
  // Micro: cell work in a dark dish above.
  const lab0 = new THREE.Group();
  k.root.add(lab0);
  const donorCell = new THREE.Mesh(k.sphere, k.ghost("#f2c8b8", 0.55, { roughness: 0.3, clearcoat: 0.6 }));
  donorCell.scale.setScalar(1.3);
  donorCell.position.set(-3, 0, 0);
  const dNuc = new THREE.Mesh(k.sphere, k.material({ color: "#7a4ab0", roughness: 0.4 }));
  dNuc.scale.setScalar(0.45);
  const e = egg(k, 1.8);
  e.g.position.set(3, 0, 0);
  const pipette = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.06, 0.2, 4, 12).translate(0, 2, 0)), k.ghost("#dfeff5", 0.5, { roughness: 0.05, clearcoat: 1 }));
  lab0.add(donorCell, dNuc, e.g, pipette);
  const spark = new THREE.Mesh(k.sphere, k.material({ color: "#fff2b0", emissive: "#ffd23f", emissiveIntensity: 2, transparent: true }));
  lab0.add(spark);
  const embryo = Array.from({ length: 8 }, (_, i) => {
    const c = new THREE.Mesh(k.sphere, k.material({ color: "#f2c8b8", roughness: 0.4, clearcoat: 0.5 }));
    c.scale.setScalar(0.5);
    c.position.set(3 + (i % 2 ? 0.5 : -0.5), (i & 2 ? 0.5 : -0.5), i & 4 ? 0.5 : -0.5);
    lab0.add(c);
    return c;
  });
  tag(k, lab0, v(-3, 1.8, 0), "სარძევე ჯირკვლის უჯრედი", [1]);
  tag(k, lab0, v(3, 2.4, 0), "კვერცხუჯრედი", [1]);
  const ltag = tag(k, lab0, v(0, -2.4, 0), "", [1]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      cut: i === 1 || i === 2,
      enter: () => {
        g.visible = i !== 1;
        lab0.visible = i === 1;
        if (i === 1) lab(k);
        else outdoor(k, "#cfe0d6", 20, 50);
      },
      update: (u: number, s: number, t: number) => {
        lamb.visible = i === 2;
        lamb.position.y = Math.abs(Math.sin(t * 3)) * 0.1;
        if (i === 1) {
          // Take the egg's nucleus out, put the donor's in, spark, divide.
          const out = ease(u / 0.25);
          const move = ease((u - 0.25) / 0.3);
          e.nuc.visible = out < 0.95;
          e.nuc.position.set(0, out * 3, 0);
          dNuc.position.lerpVectors(v(-3, 0, 0), v(3, 0, 0), move);
          pipette.position.copy(u < 0.25 ? v(3, 0.3 + out * 3, 0) : dNuc.position.clone().add(v(0, 0.3, 0)));
          spark.visible = u > 0.58 && u < 0.66;
          spark.position.set(3, 0, 0);
          spark.scale.setScalar(2 + Math.sin(t * 40));
          const div = ease((u - 0.66) / 0.3);
          const n = div < 0.33 ? 1 : div < 0.66 ? 2 : div < 0.99 ? 4 : 8;
          embryo.forEach((c, j) => (c.visible = u > 0.66 && j < n));
          e.g.visible = u < 0.66;
          dNuc.visible = u < 0.66;
          setText(ltag, u < 0.25 ? "კვერცხუჯრედს ბირთვს აცლიან" : u < 0.58 ? "დონორის ბირთვი გადააქვთ" : u < 0.66 ? "ელექტრული იმპულსი" : "ჩანასახი იყოფა");
          return front(s, 11, v(0, 0.5, 0), 0.15);
        }
        return front(s, 9, v(0, 0.9, 0.5), 0.2);
      },
    })),
  };
};

// ---- Human genetics methods ------------------------------------------------------------------------------------------

export const humanGenetics: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  // Pedigree over three generations (an autosomal recessive trait).
  const ped = new THREE.Group();
  g.add(ped);
  const people: [boolean, "healthy" | "affected" | "carrier", number, number][] = [
    [true, "healthy", -1.5, 3],
    [false, "carrier", 1.5, 3],
    [false, "carrier", -3, 0.5],
    [true, "healthy", -1, 0.5],
    [true, "affected", 1, 0.5],
    [false, "healthy", 3, 0.5],
    [true, "affected", -2, -2],
    [false, "healthy", 0, -2],
  ];
  people.forEach(([m, st, x, y]) => {
    const p = person(k, m, st);
    p.position.set(x, y, 0);
    ped.add(p);
  });
  tag(k, ped, v(0, 4.2, 0), "□ მამაკაცი · ○ ქალი · შეფერილი — ნიშნის მქონე", [0]);
  // Twins.
  const tw = new THREE.Group();
  g.add(tw);
  const skin = k.material({ color: "#e8b79e", roughness: 0.6, sheen: 0.4, sheenColor: new THREE.Color("#fff") });
  const shirt = k.material({ color: "#3f7fd0", roughness: 0.7 });
  [-1.2, 1.2].forEach((x) => {
    const body = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.5, 1.2, 6, 16)), shirt);
    body.position.set(x, 0, 0);
    const head = new THREE.Mesh(k.sphere, skin);
    head.scale.setScalar(0.45);
    head.position.set(x, 1.45, 0);
    tw.add(body, head);
  });
  tag(k, tw, v(0, 2.4, 0), "ერთკვერცხუჯრედიანი ტყუპები — ერთნაირი გენები", [1]);
  // Karyotype with trisomy 21.
  const kar = new THREE.Group();
  g.add(kar);
  for (let i = 0; i < 23; i++) {
    const n = i === 20 ? 3 : 2;
    for (let s = 0; s < n; s++) {
      const c = chromosome(k, { color: i === 20 ? "#e0524a" : "#8a6ac0", length: 1.6 - i * 0.05 });
      c.scale.setScalar(0.5);
      c.position.set(-6 + (i % 12) * 1.1 + s * 0.36, i < 12 ? 1.5 : -1, 0);
      kar.add(c);
    }
  }
  tag(k, kar, v(-6 + 8 * 1.1 + 0.36, -2.2, 0), "21-ე: სამი ქრომოსომა", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number) => {
        ped.visible = i === 0;
        tw.visible = i === 1;
        kar.visible = i === 2;
        return front(s, i === 1 ? 8 : 13, v(0, i === 0 ? 0.6 : 0.3, 0), 0.1);
      },
    })),
  };
};

// ---- Medical biotechnology --------------------------------------------------------------------------------------------

export const medicalBiotech: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const cell = new THREE.Mesh(k.track(new THREE.SphereGeometry(3, 48, 32, 0, Math.PI * 1.5)), k.material({ color: "#e8b0a8", roughness: 0.4, side: THREE.DoubleSide, normalMap: k.normalMap("organic", [4, 3]), clearcoat: 0.4 }));
  cell.rotation.y = Math.PI * 0.75;
  const nucleus = new THREE.Mesh(k.sphere, k.material({ color: "#7a4ab0", roughness: 0.4, emissive: "#f2c230", emissiveIntensity: 0 }));
  nucleus.scale.setScalar(1.1);
  g.add(cell, nucleus);
  // Viral vector.
  const vir = new THREE.Group();
  const capsid = new THREE.Mesh(k.track(new THREE.IcosahedronGeometry(0.6, 1)), k.material({ color: "#b9c4cc", roughness: 0.3, metalness: 0.3 }));
  vir.add(capsid);
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Mesh(k.cylinder, capsid.material);
    const n = v(Math.sin(i * 2.4), Math.cos(i * 1.7), Math.sin(i * 0.9)).normalize();
    sp.position.copy(n.clone().multiplyScalar(0.7));
    sp.quaternion.setFromUnitVectors(v(0, 1, 0), n);
    sp.scale.set(0.04, 0.3, 0.04);
    vir.add(sp);
  }
  g.add(vir);
  const gene = beads(k, g, curve([v(5, 2.5, 2), v(3, 1.6, 1.6), v(1.2, 0.6, 0.6), v(0, 0, 0)]), { n: 14, color: "#f2c230", size: 0.14, speed: 0.15, emissive: 1 });
  tag(k, g, v(5, 3.4, 2), "ვირუსი-გადამტანი", [0]);
  tag(k, g, v(0, 1.4, 0), "ბირთვი: ჯანმრთელი გენი", [0]);
  // Vaccine: spikes on the cell, antibodies arriving.
  const spikes = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const s = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.15, 0.5, 6)), k.material({ color: "#e0524a" }));
    const n = v(Math.cos(a), Math.sin(a) * 0.7, 0.5).normalize();
    s.position.copy(n.clone().multiplyScalar(3.1));
    s.quaternion.setFromUnitVectors(v(0, 1, 0), n);
    g.add(s);
    return s;
  });
  const abMat = k.material({ color: "#5b8def", roughness: 0.4 });
  const antibodies = spikes.map((sp) => {
    const y = new THREE.Group();
    const stem = new THREE.Mesh(k.cylinder, abMat);
    stem.scale.set(0.06, 0.4, 0.06);
    const a1 = new THREE.Mesh(k.cylinder, abMat);
    a1.scale.set(0.05, 0.3, 0.05);
    a1.position.set(-0.1, 0.3, 0);
    a1.rotation.z = 0.6;
    const a2 = a1.clone();
    a2.position.x = 0.1;
    a2.rotation.z = -0.6;
    y.add(stem, a1, a2);
    g.add(y);
    return { y, target: sp.position.clone().multiplyScalar(1.15), from: sp.position.clone().multiplyScalar(2.5), q: sp.quaternion.clone() };
  });
  tag(k, g, v(3.4, 2.2, 1.6), "ვირუსის ცილა", [1]);
  tag(k, g, v(5.6, 3, 2.4), "ანტისხეულები", [1]);
  // Stem cell differentiating.
  const stem = new THREE.Group();
  k.root.add(stem);
  const sc = new THREE.Mesh(k.sphere, k.material({ color: "#b49ad6", roughness: 0.4, clearcoat: 0.5, normalMap: k.normalMap("organic", [2, 1]) }));
  sc.scale.setScalar(1.2);
  stem.add(sc);
  const kinds = [
    { c: "#c41e25", t: "სისხლის უჯრედი", s: v(0.8, 0.3, 0.8) },
    { c: "#b5524a", t: "კუნთის უჯრედი", s: v(1.6, 0.4, 0.4) },
    { c: "#9b7fd0", t: "ნერვის უჯრედი", s: v(0.6, 0.6, 0.6) },
    { c: "#e3a58f", t: "კანის უჯრედი", s: v(0.8, 0.5, 0.8) },
  ].map((x, i) => {
    const m = new THREE.Mesh(k.sphere, k.material({ color: x.c, roughness: 0.4, clearcoat: 0.5 }));
    m.scale.copy(x.s);
    stem.add(m);
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const to = v(Math.cos(a) * 4, Math.sin(a) * 3, 0);
    const lab0 = k.anchor(stem, to.clone().add(v(0, 1, 0)));
    k.label(lab0, x.t, { stages: [2] });
    return { m, to };
  });
  tag(k, stem, v(0, 1.8, 0), "ღეროვანი უჯრედი", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      cut: i === 2,
      enter: () => {
        g.visible = i < 2;
        stem.visible = i === 2;
      },
      update: (u: number, s: number, t: number) => {
        vir.visible = i === 0;
        vir.position.lerpVectors(v(7, 3.5, 3), v(5, 2.5, 2), ease(u / 0.3));
        vir.rotation.y = t;
        gene.update(t, i === 0 && u > 0.3 ? 1 : 0);
        (nucleus.material as THREE.MeshPhysicalMaterial).emissiveIntensity = i === 0 ? 0.6 * ease((u - 0.5) / 0.4) : 0;
        spikes.forEach((sp) => (sp.visible = i === 1));
        antibodies.forEach((a, j) => {
          a.y.visible = i === 1;
          a.y.position.lerpVectors(a.from, a.target, ease((u - 0.2 - j * 0.02) / 0.4));
          a.y.quaternion.copy(a.q).multiply(new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), Math.PI));
        });
        kinds.forEach(({ m, to }) => m.position.lerpVectors(v(0, 0, 0), to, ease((u - 0.15) / 0.5)));
        return front(s, i === 2 ? 13 : 12, v(0.5, 0.3, 0), 0.15);
      },
    })),
  };
};

// ---- Gene transfer in bacteria ---------------------------------------------------------------------------------------------

export const bacterialTransfer: Builder = async (k) => {
  k.mood("#0f1a1c", 20, 50);
  const g = new THREE.Group();
  k.root.add(g);
  const live = bacterium(k, "#7cc66a");
  live.g.position.set(1.5, 0, 0);
  g.add(live.g);
  // Transformation: fragments from a burst cell drift into the live one.
  const dead = bacterium(k, "#8a8f94");
  dead.g.position.set(-4, 0.5, -1);
  g.add(dead.g);
  const frags = Array.from({ length: 6 }, (_, i) => {
    const f = new THREE.Mesh(k.track(new THREE.TorusGeometry(0.25, 0.04, 6, 16, Math.PI)), k.material({ color: "#f2c230", emissive: "#f2c230", emissiveIntensity: 0.4 }));
    g.add(f);
    return { f, from: v(-4 + (i - 2.5) * 0.6, 0.5 + Math.sin(i) * 0.6, -1 + Math.cos(i) * 0.6) };
  });
  // Transduction: a phage lands and injects.
  const ph = phage(k);
  g.add(ph);
  const inject = beads(k, g, curve([v(1.5, 1.4, 0), v(1.5, 0.9, 0), v(1.4, 0.3, 0)]), { n: 10, color: "#e0524a", size: 0.08, speed: 0.3, emissive: 1 });
  // Conjugation: a second bacterium, a pilus bridge, a plasmid crossing.
  const partner = bacterium(k, "#c9a6e0");
  partner.g.position.set(5.4, 0.2, 0);
  g.add(partner.g);
  const pilus = new THREE.Mesh(k.cylinder, k.material({ color: "#cfe8b8", roughness: 0.4 }));
  pilus.rotation.z = Math.PI / 2;
  pilus.scale.set(0.08, 1.5, 0.08);
  pilus.position.set(3.4, 0.1, 0);
  g.add(pilus);
  const traveller = new THREE.Mesh(k.track(new THREE.TorusGeometry(0.22, 0.04, 8, 32)), k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.5 }));
  g.add(traveller);
  const L = (p: V3, t: string, st: number[]) => k.label(k.anchor(g, p), t, { stages: st });
  L(v(-4, 1.6, -1), "დაღუპული ბაქტერიის დნმ", [0]);
  L(v(1.5, 1.4, 0.8), "ბაქტერია იღებს დნმ-ს", [0]);
  L(v(1.5, 3.2, 0), "ბაქტერიოფაგი", [1]);
  L(v(3.4, 0.7, 0), "პილი — ხიდი", [2]);
  L(v(5.4, 1.4, 0), "იღებს პლაზმიდს", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        dead.g.visible = i === 0;
        frags.forEach(({ f, from }, j) => {
          f.visible = i === 0;
          const to = j === 0 ? v(1.2, 0, 0) : from.clone().add(v(Math.sin(t + j) * 0.3, Math.cos(t * 0.7 + j) * 0.3, 0));
          f.position.lerpVectors(from, to, j === 0 ? ease((u - 0.2) / 0.5) : 1);
          f.rotation.set(t + j, t * 0.5, 0);
        });
        (live.body.material as THREE.MeshPhysicalMaterial).color.set(i === 0 && u > 0.7 ? "#e9c63a" : "#7cc66a");
        ph.visible = i === 1;
        ph.position.set(1.5, 0.75 + 3 * (1 - ease(u / 0.35)), 0);
        inject.update(t, i === 1 && u > 0.35 ? 1 : 0);
        partner.g.visible = pilus.visible = traveller.visible = i === 2;
        pilus.scale.y = 1.5 * ease(u / 0.3);
        traveller.position.lerpVectors(v(2.5, 0.2, 0.2), v(4.6, 0.3, 0.2), ease((u - 0.35) / 0.4));
        traveller.rotation.y = t * 2;
        return front(s, 12, v(1, 0.3, 0), 0.25);
      },
    })),
  };
};

