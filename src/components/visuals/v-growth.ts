import * as THREE from "three";
import { beads, context, curve, flow, layer, orbit } from "@/components/journeys/common";
import { ease, rng, v, type Builder, type Kit, type Shot, type V3 } from "@/components/journeys/JourneyScene";
import { chromosome, sperm } from "./micro";
import { beetle, natureMaterials, tree } from "./nature";

/*
 * Plants (minerals, transport, flowers and fertilisation, phototropism, hormones) and human reproduction
 * and development, drawn as schematic textbook figures: gametogenesis, embryo, puberty, the reproductive
 * organs, the cycle, the fetus and placenta, protecting the fetus, infections, and the maturing brain.
 */

const setText = (el: HTMLDivElement, text: string) => {
  const t = el.querySelector(".blood-label-text") ?? el;
  if (t.textContent !== text) t.textContent = text;
};
const lab = (k: Kit, c = "#11161a") => k.mood(c, 25, 60);
const front = (s: number, d: number, at = v(0, 0, 0), h = 0.18, side = 0): Shot => orbit(at, d, 0, { start: side + Math.sin(s * 0.15) * 0.2, height: h });
const tag = (k: Kit, parent: THREE.Object3D, p: V3, text: string, stages?: number[]) => k.label(k.anchor(parent, p), text, { kind: "tag", stages });

/** A potted plant whose leaves can be recoloured. */
function plant(k: Kit, leafColor: string, seed = 1) {
  const g = new THREE.Group();
  const r = rng(seed);
  const pot = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.7, 0.5, 1, 24)), k.material({ color: "#b5603a", roughness: 0.7 }));
  pot.position.y = 0.5;
  const soil = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.66, 0.66, 0.08, 24)), k.material({ color: "#4a3424", roughness: 0.95 }));
  soil.position.y = 0.98;
  g.add(pot, soil);
  const stem = k.tube([v(0, 1, 0), v(0.05, 2, 0), v(-0.05, 3, 0)], 0.06, k.material({ color: "#4f8a3a" }), g, 16, 6);
  void stem;
  const leafMat = k.material({ color: leafColor, roughness: 0.6, side: THREE.DoubleSide, sheen: 0.5, sheenColor: new THREE.Color("#ffffff") });
  const leaves: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const l = new THREE.Mesh(k.sphere, leafMat);
    l.scale.set(0.45, 0.04, 0.22);
    const a = i * 2.4;
    l.position.set(Math.cos(a) * 0.35, 1.4 + i * 0.25, Math.sin(a) * 0.35);
    l.rotation.y = -a;
    l.rotation.z = 0.3 + r() * 0.2;
    g.add(l);
    leaves.push(l);
  }
  return { g, leafMat, leaves };
}

// ---- Plant minerals ---------------------------------------------------------------------------------

export const plantMinerals: Builder = async (k) => {
  k.mood("#e7eef0", 20, 50);
  const g = new THREE.Group();
  k.root.add(g);
  // Soil cut-away with roots taking up ions.
  const soilG = new THREE.Group();
  g.add(soilG);
  const block = new THREE.Mesh(k.track(new THREE.BoxGeometry(8, 4, 3)), k.material({ color: "#6a4c30", roughness: 0.95, normalMap: k.normalMap("bone", [4, 2]) }));
  block.position.y = -2;
  soilG.add(block);
  const rootMat = k.material({ color: "#efe0c0", roughness: 0.6 });
  const roots: THREE.CatmullRomCurve3[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 6 - 0.5) * 2;
    const pts = [v(0, 0, 1.55), v(a * 0.8, -1.2, 1.55), v(a * 2, -2.6, 1.55), v(a * 2.6, -3.6, 1.55)];
    k.tube(pts, (t) => 0.12 * (1 - 0.7 * t), rootMat, soilG, 30, 6);
    roots.push(new THREE.CatmullRomCurve3(pts));
  }
  const p0 = plant(k, "#4f9a3a");
  p0.g.position.set(0, -1, 1.2);
  p0.g.children[0].visible = false;
  p0.g.children[1].visible = false;
  soilG.add(p0.g);
  const ionCols = ["#5b8def", "#f08a2a", "#a46be0", "#4bb36b"];
  const ions = flow(k, soilG, { n: 60, color: "#ffffff", size: 0.08, period: 3, from: (i) => v((((i * 37) % 70) / 10) - 3.5, -0.5 - ((i * 13) % 30) / 10, 1.56), to: (i) => roots[i % roots.length].getPointAt(0.3 + ((i * 7) % 6) / 10).clone().setZ(1.6), seed: 3, emissive: 0.5 });
  ions.mesh.material = k.material({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.3 });
  for (let i = 0; i < 60; i++) ions.mesh.setColorAt(i, new THREE.Color(ionCols[i % 4]));
  tag(k, soilG, v(-3, -0.4, 1.6), "N · P · K · Mg იონები", [0]);
  // Deficiency row.
  const row = new THREE.Group();
  g.add(row);
  const kinds = [
    { c: "#4f9a3a", t: "ნორმა" },
    { c: "#d8c84a", t: "N — ყვითელი ფოთლები" },
    { c: "#7a4a8a", t: "P — მოიისფრო" },
    { c: "#9a7a3a", t: "K — ხმება კიდეები" },
  ];
  const plants = kinds.map((x, i) => {
    const p = plant(k, x.c, i + 2);
    p.g.position.set(-4.5 + i * 3, -1, 0);
    p.g.scale.setScalar(i === 0 ? 1 : 0.8);
    row.add(p.g);
    tag(k, row, v(-4.5 + i * 3, 3.2, 0), x.t, [1, 2]);
    return p;
  });
  const fert = beads(k, row, curve([v(-6, 4, 0), v(-1.5, 3, 0), v(-1.5, 0.2, 0)]), { n: 20, color: "#e8e8e8", size: 0.1, speed: 0.15 });
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: i === 1,
      enter: () => {
        soilG.visible = i === 0;
        row.visible = i > 0;
      },
      update: (u: number, s: number, t: number) => {
        ions.update(t);
        fert.update(t, i === 2 ? 1 : 0);
        if (i === 2) plants[1].leafMat.color.set("#d8c84a").lerp(new THREE.Color("#4f9a3a"), ease((u - 0.2) / 0.6));
        if (i === 2) plants[1].g.scale.setScalar(0.8 + 0.2 * ease((u - 0.2) / 0.6));
        return front(s, i === 0 ? 10 : 13, v(0, i === 0 ? -1 : 1, 0), 0.15);
      },
    })),
  };
};

// ---- Transport in plants ------------------------------------------------------------------------------

export const plantTransport: Builder = async (k) => {
  k.mood("#dfe8ec", 25, 60);
  const g = new THREE.Group();
  k.root.add(g);
  const M = natureMaterials(k);
  const tr = tree(k, M, g, v(0, 0, 0), { scale: 1.5 });
  tr.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material === M.leaf) m.material = k.ghost("#4f8a3a", 0.45);
    if (m.isMesh && m.material === M.bark) m.material = k.ghost("#6b4a32", 0.4);
  });
  const ground0 = new THREE.Mesh(k.track(new THREE.BoxGeometry(10, 3, 4)), k.ghost("#6a4c30", 0.6));
  ground0.position.y = -1.5;
  g.add(ground0);
  const rootMat = k.material({ color: "#efe0c0" });
  for (let i = 0; i < 6; i++) {
    const a = (i / 5 - 0.5) * 2.4;
    k.tube([v(0, 0, 0), v(a * 0.8, -1, 0), v(a * 2, -2.6, 0.3)], 0.08, rootMat, g, 20, 6);
  }
  const xylem = curve([v(-0.05, -2.4, 0.2), v(-0.05, -1, 0.05), v(-0.05, 2, 0.05), v(-0.05, 3.8, 0), v(-0.8, 5, 0.3), v(-1.5, 5.4, 0.6)]);
  const phloem = curve([v(1.2, 5.3, 0.5), v(0.5, 4.8, 0.1), v(0.08, 3.6, 0.05), v(0.08, 1, 0.05), v(0.08, -1, 0.05), v(0.8, -2.2, 0.2)]);
  const water = beads(k, g, xylem, { n: 30, color: "#4a90d8", size: 0.12, speed: 0.12, emissive: 0.6 });
  const sugar = beads(k, g, phloem, { n: 24, color: "#f2c230", size: 0.12, speed: 0.1, emissive: 0.6 });
  const vapour = flow(k, g, { n: 40, color: "#bfe0f0", size: 0.1, period: 3, from: (i) => v(Math.cos(i) * 1.6, 5 + Math.sin(i * 2) * 0.6, Math.sin(i) * 1.6), to: (i) => v(Math.cos(i) * 3, 7 + Math.sin(i * 2) * 0.6, Math.sin(i) * 3), seed: 4, emissive: 0.4 });
  tag(k, g, v(-0.6, 1.5, 0.3), "ქსილემა: წყალი ↑", [0, 1]);
  tag(k, g, v(-2, -2.6, 0.3), "ფესვი შეიწოვს", [0]);
  tag(k, g, v(2.8, 7, 0), "ტრანსპირაცია", [1]);
  tag(k, g, v(0.8, 1.2, 0.3), "ფლოემა: შაქარი ↓", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (_u: number, s: number, t: number) => {
        water.update(t, i < 2 ? 1 : 0.3);
        sugar.update(t, i === 2 ? 1 : 0);
        vapour.update(i === 1 ? t : 0);
        vapour.mesh.visible = i === 1;
        return orbit(v(0, i === 1 ? 4 : 1.5, 0), i === 1 ? 12 : 14, s, { start: 0.3, speed: 0.03, height: 0.1 });
      },
    })),
  };
};

// ---- Flower and double fertilisation ------------------------------------------------------------------

export const flowerVisual: Builder = async (k) => {
  lab(k, "#10160f");
  const g = new THREE.Group();
  k.root.add(g);
  const petalMat = k.material({ color: "#e05a8a", roughness: 0.45, side: THREE.DoubleSide, sheen: 0.8, sheenColor: new THREE.Color("#ffd0e0"), transparent: true, opacity: 0.85 });
  const petals = Array.from({ length: 6 }, (_, i) => {
    const p = new THREE.Mesh(k.sphere, petalMat);
    const a = (i / 6) * Math.PI * 2;
    p.scale.set(1.4, 0.08, 0.7);
    p.position.set(Math.cos(a) * 1.3, 0.3, Math.sin(a) * 1.3);
    p.rotation.y = -a;
    p.rotation.z = 0.5;
    g.add(p);
    return p;
  });
  void petals;
  // Pistil: ovary, style, stigma — cut open to show the ovules.
  const pist = k.material({ color: "#8ac860", roughness: 0.4, transparent: true, opacity: 0.55, depthWrite: false });
  const ovary = new THREE.Mesh(k.sphere, pist);
  ovary.scale.set(0.6, 0.7, 0.6);
  ovary.position.y = 0.2;
  const style = new THREE.Mesh(k.cylinder, pist);
  style.scale.set(0.12, 2, 0.12);
  style.position.y = 1.9;
  const stigma = new THREE.Mesh(k.sphere, k.material({ color: "#c9e070", roughness: 0.6 }));
  stigma.scale.set(0.3, 0.15, 0.3);
  stigma.position.y = 2.95;
  g.add(ovary, style, stigma);
  const ovules = [-0.2, 0.2].map((y) => {
    const o = new THREE.Mesh(k.sphere, k.material({ color: "#f2e0a0", roughness: 0.4 }));
    o.scale.setScalar(0.18);
    o.position.set(0.15, 0.2 + y, 0);
    g.add(o);
    return o;
  });
  // Stamens.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const fil = k.tube([v(Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4), v(Math.cos(a) * 0.7, 1.4, Math.sin(a) * 0.7), v(Math.cos(a) * 0.8, 2.2, Math.sin(a) * 0.8)], 0.03, k.material({ color: "#f4f1ea" }), g, 12, 5);
    void fil;
    const anther = new THREE.Mesh(k.sphere, k.material({ color: "#f2b632", roughness: 0.6 }));
    anther.scale.set(0.12, 0.2, 0.12);
    anther.position.set(Math.cos(a) * 0.8, 2.3, Math.sin(a) * 0.8);
    g.add(anther);
  }
  // A bee bringing pollen; the pollen tube growing down.
  const bee = beetle(k, "#e0a12a");
  bee.g.scale.setScalar(6);
  g.add(bee.g);
  const pollen = Array.from({ length: 8 }, () => {
    const p = new THREE.Mesh(k.sphere, k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0.4 }));
    p.scale.setScalar(0.07);
    g.add(p);
    return p;
  });
  const tubeMat = k.material({ color: "#f2e0a0", emissive: "#f2c230", emissiveIntensity: 0.5 });
  const tubePath = curve([v(0, 3, 0), v(0.05, 2, 0.02), v(0.05, 1, 0.03), v(0.15, 0.4, 0)]);
  let tubeMesh: THREE.Mesh | null = null;
  let lastLen = -1;
  const sperms = [0, 1].map(() => {
    const s = new THREE.Mesh(k.sphere, k.material({ color: "#5b8def", emissive: "#5b8def", emissiveIntensity: 0.8 }));
    s.scale.setScalar(0.06);
    g.add(s);
    return s;
  });
  const seedG = new THREE.Group();
  g.add(seedG);
  const fruit = new THREE.Mesh(k.sphere, k.material({ color: "#c0392b", roughness: 0.3, clearcoat: 1, transparent: true, opacity: 0.85 }));
  seedG.add(fruit);
  tag(k, g, v(1.6, 0.8, 1.2), "ფურცელი", [0]);
  tag(k, g, v(0.9, 2.5, 0.8), "მტვრიანა", [0]);
  tag(k, g, v(0, 3.4, 0), "დინგი", [0, 1]);
  tag(k, g, v(-0.7, 0.2, 0.6), "ნასკვი — თესლკვირტები", [0, 2]);
  const st = tag(k, g, v(0, 4.2, 0), "", [1, 2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        bee.g.visible = i === 1 && u < 0.5;
        const fly = ease(u / 0.35);
        bee.g.position.set(4 - 4 * fly, 3.3 + Math.sin(t * 6) * 0.1, 1 - fly);
        bee.move(t * 4);
        pollen.forEach((p, j) => {
          p.visible = i === 1 && u > 0.3;
          p.position.set(Math.cos(j) * 0.15, 3.05, Math.sin(j) * 0.15);
        });
        const len = i === 1 ? ease((u - 0.45) / 0.45) : i === 2 ? 1 : 0;
        if (Math.abs(len - lastLen) > 0.02) {
          if (tubeMesh) {
            g.remove(tubeMesh);
            tubeMesh.geometry.dispose();
          }
          tubeMesh = null;
          if (len > 0.02) {
            const pts = tubePath.getPoints(30).slice(0, Math.max(2, Math.round(30 * len)));
            tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.03, 6), tubeMat);
            g.add(tubeMesh);
          }
          lastLen = len;
        }
        sperms.forEach((sp, j) => {
          sp.visible = i === 2 && u < 0.4;
          sp.position.copy(tubePath.getPointAt(0.8 + 0.2 * ease(u / 0.35))).add(v(0, j * 0.1, 0));
        });
        ovules.forEach((o) => (o.scale.setScalar(0.18 + (i === 2 ? 0.2 * ease((u - 0.4) / 0.4) : 0))));
        fruit.visible = i === 2 && u > 0.55;
        fruit.scale.setScalar(0.6 + 0.7 * ease((u - 0.55) / 0.35));
        fruit.position.y = 0.2;
        petalMat.opacity = i === 2 ? 0.85 * (1 - ease((u - 0.5) / 0.3)) : 0.85;
        setText(st, i === 1 ? (u < 0.45 ? "ფუტკარი მტვერს დინგზე ტოვებს" : "მტვრის მილი იზრდება") : u < 0.4 ? "ორი სპერმიუმი — ორი განაყოფიერება" : "თესლი და ნაყოფი");
        return orbit(v(0, 1.4, 0), 8, s, { start: 0.3, speed: 0.04, height: 0.25 });
      },
    })),
  };
};

// ---- Phototropism ---------------------------------------------------------------------------------------

export const phototropism: Builder = async (k) => {
  k.mood("#e7eef0", 20, 50);
  const g = new THREE.Group();
  k.root.add(g);
  const lamp = new THREE.Mesh(k.sphere, k.material({ color: "#fff2b0", emissive: "#ffd23f", emissiveIntensity: 2 }));
  lamp.scale.setScalar(0.5);
  lamp.position.set(5, 3, 0);
  g.add(lamp);
  const rays = beads(k, g, curve([v(5, 3, 0), v(0, 2, 0)]), { n: 12, color: "#ffd23f", size: 0.06, speed: 0.4, emissive: 1.5, spread: 0.3 });
  /** A seedling of segments that can bend towards +x. */
  const seedling = (x: number, capTip: boolean, capBelow: boolean) => {
    const sg = new THREE.Group();
    sg.position.x = x;
    const pot = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.4, 0.3, 0.6, 16)), k.material({ color: "#b5603a" }));
    pot.position.y = 0.3;
    sg.add(pot);
    const segs: THREE.Group[] = [];
    let parent: THREE.Object3D = sg;
    const mat = k.material({ color: "#8ac860", roughness: 0.5 });
    for (let i = 0; i < 8; i++) {
      const seg = new THREE.Group();
      seg.position.y = i === 0 ? 0.6 : 0.3;
      const m = new THREE.Mesh(k.cylinder, mat);
      m.scale.set(0.07, 0.3, 0.07);
      m.position.y = 0.15;
      seg.add(m);
      parent.add(seg);
      parent = seg;
      segs.push(seg);
    }
    const cap = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.12, 0.35, 12)), k.material({ color: "#2a2420" }));
    cap.position.y = 0.35;
    if (capTip) segs[7].add(cap);
    const sleeve = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 12)), k.material({ color: "#2a2420" }));
    sleeve.position.y = 0.15;
    if (capBelow) segs[3].add(sleeve);
    g.add(sg);
    // Auxin on the shaded side.
    const aux = Array.from({ length: 6 }, (_, j) => {
      const a = new THREE.Mesh(k.sphere, k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.6 }));
      a.scale.setScalar(0.04);
      a.position.set(-0.08, 0.05 * j, 0.05);
      segs[Math.min(7, 2 + j)].add(a);
      return a;
    });
    return { segs, aux };
  };
  const a = seedling(-1, false, false);
  const b = seedling(-3, true, false);
  const c = seedling(1, false, true);
  tag(k, g, v(-1, 3.4, 0), "", undefined);
  tag(k, g, v(-3, 3.6, 0), "წვერი დაფარულია — არ იხრება", [1]);
  tag(k, g, v(1, 3.6, 0), "წვერის ქვემოთ დაფარული — იხრება", [1]);
  tag(k, g, v(-1.3, 2, 0.3), "აუქსინი ჩრდილოვან მხარეს", [2]);
  const bend = (sd: ReturnType<typeof seedling>, amt: number) => sd.segs.forEach((s0, i) => (s0.rotation.z = -amt * (i > 2 ? 0.12 : 0.02)));
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        rays.update(t);
        const amt = ease(u / 0.7) * (i === 0 ? 1 : 1);
        bend(a, i === 1 ? 1 : amt);
        b.segs[0].parent!.visible = i === 1;
        c.segs[0].parent!.visible = i === 1;
        bend(b, 0);
        bend(c, i === 1 ? amt : 0);
        a.aux.forEach((x) => (x.visible = i === 2));
        return front(s, i === 1 ? 10 : 7, v(i === 1 ? -0.5 : -0.5, 1.8, 0), 0.1);
      },
    })),
  };
};

// ---- Plant hormones -----------------------------------------------------------------------------------

export const plantHormones: Builder = async (k) => {
  k.mood("#e7eef0", 20, 50);
  const g = new THREE.Group();
  k.root.add(g);
  // Auxin/gibberellin: two plants, one growing tall.
  const s0 = new THREE.Group();
  g.add(s0);
  const short = plant(k, "#4f9a3a", 1);
  short.g.position.x = -2;
  const tall = plant(k, "#4f9a3a", 2);
  tall.g.position.x = 2;
  s0.add(short.g, tall.g);
  const seed = new THREE.Mesh(k.sphere, k.material({ color: "#c9a06a" }));
  seed.scale.set(0.3, 0.2, 0.2);
  seed.position.set(0, 0.3, 1.5);
  s0.add(seed);
  const sprout = new THREE.Mesh(k.cylinder, k.material({ color: "#8ac860" }));
  sprout.position.set(0, 0.4, 1.5);
  s0.add(sprout);
  tag(k, s0, v(2, 4.6, 0), "გიბერელინი — ღერო გრძელდება", [0]);
  tag(k, s0, v(0, 1.2, 1.5), "თესლი ღივდება", [0]);
  // Cytokinin / ABA: dividing cells and closing stomata.
  const s1 = new THREE.Group();
  g.add(s1);
  const cells = Array.from({ length: 16 }, (_, i) => {
    const c = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.6, 0.6, 0.6)), k.material({ color: "#8ac860", roughness: 0.5, normalMap: k.normalMap("organic", [1, 1]) }));
    c.position.set(-3 + (i % 4) * 0.65, 1 + Math.floor(i / 4) * 0.65, 0);
    s1.add(c);
    return c;
  });
  const guards = [-1, 1].map((sx) => {
    const m = new THREE.Mesh(k.sphere, k.material({ color: "#4f9a3a" }));
    m.scale.set(0.5, 0.35, 1);
    m.position.set(2.5 + sx * 0.5, 1.8, 0);
    s1.add(m);
    return m;
  });
  tag(k, s1, v(-2, 3.8, 0), "ციტოკინინი — უჯრედები იყოფა", [1]);
  tag(k, s1, v(2.5, 3.2, 0), "აბსციზინის მჟავა — ბაგე იხურება", [1]);
  // Ethylene: ripening bananas.
  const s2 = new THREE.Group();
  g.add(s2);
  const bananas = Array.from({ length: 5 }, (_, i) => {
    const pts = Array.from({ length: 10 }, (_, j) => v(-2 + i * 0.9, 1 + j * 0.25, Math.sin(j * 0.3) * 0.5));
    const b = k.tube(pts, (t) => 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.02)) + 0.05, k.material({ color: "#6aa83a", roughness: 0.5 }), s2, 20, 10);
    return b.mesh;
  });
  const apple = new THREE.Mesh(k.sphere, k.material({ color: "#c0392b", roughness: 0.3, clearcoat: 1 }));
  apple.scale.setScalar(0.5);
  apple.position.set(3, 1, 0);
  s2.add(apple);
  const gas = flow(k, s2, { n: 30, color: "#d8d8e0", size: 0.07, period: 3, from: () => v(3, 1, 0), to: (i) => v(-2 + (i % 5) * 0.9, 1.5 + (i % 3) * 0.6, 0.4), seed: 2, emissive: 0.6 });
  tag(k, s2, v(3, 1.9, 0), "მწიფე ვაშლი — ეთილენი", [2]);
  const groups = [s0, s1, s2];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => groups.forEach((x, j) => (x.visible = i === j)),
      update: (u: number, s: number, t: number) => {
        tall.g.scale.set(1, 1 + 0.8 * ease(u / 0.7), 1);
        sprout.scale.set(0.04, 0.05 + 0.8 * ease(u / 0.7), 0.04);
        sprout.position.y = 0.4 + sprout.scale.y / 2;
        cells.forEach((c, j) => (c.visible = j < 4 * Math.pow(2, Math.floor(ease(u) * 2))));
        guards.forEach((m, j) => (m.position.x = 2.5 + (j ? 1 : -1) * (0.5 - 0.2 * ease((u - 0.4) / 0.4))));
        bananas.forEach((b) => (b.material as THREE.MeshPhysicalMaterial).color.set("#6aa83a").lerp(new THREE.Color("#f2d33a"), ease((u - 0.15) / 0.6)));
        gas.update(t);
        return front(s, 9, v(0, 2, 0), 0.12);
      },
    })),
  };
};

// ---- Gametogenesis ---------------------------------------------------------------------------------------

export const gametogenesis: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const cellMat = (c: string) => k.material({ color: c, roughness: 0.4, clearcoat: 0.5, transparent: true, opacity: 0.85, normalMap: k.normalMap("organic", [2, 2]) });
  // Two columns: sperm line (left), egg line (right).
  const rows = [3.5, 1.5, -0.5, -2.5];
  const make = (x: number, n: number, y: number, c: string, size: number) =>
    Array.from({ length: n }, (_, i) => {
      const m = new THREE.Mesh(k.sphere, cellMat(c));
      m.position.set(x + (i - (n - 1) / 2) * size * 2.3, y, 0);
      m.scale.setScalar(size);
      g.add(m);
      return m;
    });
  const left = [make(-4, 1, rows[0], "#a8c8f0", 0.5), make(-4, 2, rows[1], "#a8c8f0", 0.45), make(-4, 2, rows[2], "#8ab0e8", 0.4), make(-4, 4, rows[3], "#8ab0e8", 0.3)];
  const right = [make(4, 1, rows[0], "#f0b8d0", 0.5), make(4, 1, rows[1], "#f0b8d0", 0.75), make(4, 1, rows[2], "#e8a0c0", 0.7), make(4, 1, rows[3], "#e8a0c0", 0.8)];
  const polar = make(5.5, 3, rows[3], "#e8a0c0", 0.15);
  polar.forEach((p, i) => p.position.set(5.4 + i * 0.4, rows[3] + 0.6, 0));
  const sperms = Array.from({ length: 4 }, (_, i) => {
    const s0 = sperm(k);
    s0.g.scale.setScalar(2);
    s0.g.rotation.y = Math.PI / 2;
    s0.g.position.set(-5.5 + i * 1, rows[3] - 1.6, 0);
    g.add(s0.g);
    return s0;
  });
  const chromosomesIn = (cells: THREE.Mesh[], n: number) =>
    cells.forEach((c) => {
      for (let j = 0; j < n; j++) {
        const ch = chromosome(k, { color: j % 2 ? "#e05a8a" : "#4a8ae0", length: 0.6, single: n === 2 });
        ch.scale.setScalar(0.3);
        ch.position.set((j - (n - 1) / 2) * 0.18, 0, 0.3);
        c.add(ch);
        ch.scale.divideScalar(c.scale.x);
      }
    });
  left.forEach((r0, i) => chromosomesIn(r0, i < 2 ? 4 : 2));
  right.forEach((r0, i) => chromosomesIn(r0, i < 2 ? 4 : 2));
  tag(k, g, v(-4, 4.6, 0), "სპერმატოგენეზი", [0, 1, 2]);
  tag(k, g, v(4, 4.6, 0), "ოოგენეზი", [0, 1, 2]);
  tag(k, g, v(-7.5, 2.5, 0), "გამრავლება — მიტოზი (2n)", [0]);
  tag(k, g, v(-7.5, -1.5, 0), "მეიოზი → n", [1]);
  tag(k, g, v(-4, -4.6, 0), "4 სპერმატოზოიდი", [2]);
  tag(k, g, v(4, -4.2, 0), "1 კვერცხუჯრედი + 3 მიმმართველი სხეული", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        const show = (cells: THREE.Mesh[], on: boolean) => cells.forEach((c) => (c.visible = on));
        show(left[0], true);
        show(right[0], true);
        show(left[1], i >= 0 && (i > 0 || u > 0.4));
        show(right[1], i > 0 || u > 0.4);
        show(left[2], i >= 1 && (i > 1 || u > 0.3));
        show(right[2], i >= 1 && (i > 1 || u > 0.3));
        show(left[3], i >= 1 && (i > 1 || u > 0.7));
        show(right[3], i >= 1 && (i > 1 || u > 0.7));
        show(polar, i === 2);
        sperms.forEach((sp) => {
          sp.g.visible = i === 2 && u > 0.3;
          sp.swim(t);
        });
        return front(s, 16, v(0, 0, 0), 0.08);
      },
    })),
  };
};

// ---- Embryo ------------------------------------------------------------------------------------------------

export const embryo: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const mat = k.material({ color: "#f2c8b8", roughness: 0.4, clearcoat: 0.6, normalMap: k.normalMap("organic", [1, 1]) });
  const cells: THREE.Mesh[] = [];
  for (let i = 0; i < 64; i++) {
    const m = new THREE.Mesh(k.sphere, mat);
    g.add(m);
    cells.push(m);
  }
  // Positions for 1, 2, 4, 8, 16, 32 (morula) and blastula shell; gastrula: one side pushed in.
  const fib = (n: number, R: number) =>
    Array.from({ length: n }, (_, i) => {
      const y = 1 - (2 * (i + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const a = i * 2.39996;
      return v(Math.cos(a) * r * R, y * R, Math.sin(a) * r * R);
    });
  const layerCols = { ecto: new THREE.Color("#5b8def"), meso: new THREE.Color("#e0524a"), endo: new THREE.Color("#f2c230") };
  const germ = new THREE.Group();
  g.add(germ);
  const tube = new THREE.Mesh(k.track(new THREE.TorusGeometry(1.2, 0.35, 16, 48, Math.PI * 1.4)), k.material({ color: "#5b8def", roughness: 0.4 }));
  const mid = new THREE.Mesh(k.track(new THREE.TorusGeometry(0.85, 0.25, 16, 48, Math.PI * 1.4)), k.material({ color: "#e0524a", roughness: 0.4 }));
  const gut = new THREE.Mesh(k.track(new THREE.TorusGeometry(0.5, 0.18, 16, 48, Math.PI * 1.4)), k.material({ color: "#f2c230", roughness: 0.4 }));
  germ.add(tube, mid, gut);
  tag(k, germ, v(-1.8, 1, 0.4), "ექტოდერმა → კანი, ნერვული სისტემა", [2]);
  tag(k, germ, v(1.8, 0.2, 0.4), "მეზოდერმა → კუნთი, ძვალი, სისხლი", [2]);
  tag(k, germ, v(0, -0.9, 0.4), "ენდოდერმა → ნაწლავი, ფილტვი", [2]);
  const st = tag(k, g, v(0, 2.8, 0), "", [0, 1]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        germ.visible = i === 2;
        if (i === 0) {
          const step = Math.min(5, Math.floor(u * 6.5));
          const n = Math.pow(2, step);
          const R = n === 1 ? 0 : 0.6 + step * 0.12;
          const pts = n === 1 ? [v(0, 0, 0)] : fib(n, R);
          cells.forEach((c, j) => {
            c.visible = j < n;
            if (j < n) {
              c.position.copy(pts[j]);
              c.scale.setScalar(n === 1 ? 1.4 : 1.4 / Math.cbrt(n) * 1.15);
              (c.material as THREE.MeshPhysicalMaterial).color.set("#f2c8b8");
            }
          });
          setText(st, n === 1 ? "ზიგოტა" : n >= 16 ? `მორულა — ${n} უჯრედი` : `${n} უჯრედი`);
        } else if (i === 1) {
          const pts = fib(64, 1.6);
          const inv = ease((u - 0.45) / 0.45);
          cells.forEach((c, j) => {
            c.visible = true;
            const p = pts[j].clone();
            if (p.y < -0.4) p.y = -0.4 + (p.y + 0.4) * (1 - 2.2 * inv);
            c.position.copy(p);
            c.scale.setScalar(0.32);
            (c.material as THREE.MeshPhysicalMaterial).color.copy(p.y < 0 && inv > 0.3 ? layerCols.endo : layerCols.ecto).lerp(new THREE.Color("#f2c8b8"), 1 - inv);
          });
          setText(st, u < 0.45 ? "ბლასტულა — ღრუიანი სფერო" : "გასტრულა — ჩაზნექა");
        } else cells.forEach((c) => (c.visible = false));
        germ.rotation.y = t * 0.3;
        return orbit(v(0, 0, 0), 7, s, { start: 0.3, speed: 0.05, height: 0.25 });
      },
    })),
  };
};

// ---- Puberty ------------------------------------------------------------------------------------------------

export const puberty: Builder = async (k) => {
  const body = await k.body({ organs: true, brain: true });
  k.mood("#0e1416", 3, 10);
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.08, 0.1);
  layer(k, body, g, (p) => p.group === "brain", k.ghost("#e8c7c0", 0.25), 3);
  const pit = layer(k, body, g, (p) => p.id === "FJ1796", k.material({ color: "#d9822b", emissive: "#d9822b", emissiveIntensity: 0.6 }), 1);
  const pc = pit.geometry.boundingBox!.getCenter(new THREE.Vector3());
  const toGonads = beads(k, g, curve([pc, pc.clone().add(v(0.01, -0.05, 0.01)), v(0.02, 1.4, 0.02), v(0.02, 1.1, 0.03), v(0.0, 0.85, 0.04)]), { n: 30, color: "#d9822b", size: 0.004, speed: 0.12 });
  // Growth chart.
  const chart = new THREE.Group();
  k.root.add(chart);
  const ages = [8, 10, 12, 14, 16, 18];
  const girls = [128, 139, 151, 160, 163, 164];
  const boys = [128, 138, 149, 163, 172, 176];
  const bars = ages.map((a, i) => {
    const gb = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.5, 1, 0.5).translate(0, 0.5, 0)), k.material({ color: "#e05a8a" }));
    const bb = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.5, 1, 0.5).translate(0, 0.5, 0)), k.material({ color: "#4a8ae0" }));
    gb.position.set(-4 + i * 1.6, -2, 0);
    bb.position.set(-3.45 + i * 1.6, -2, 0);
    chart.add(gb, bb);
    tag(k, chart, v(-3.7 + i * 1.6, -2.4, 0.4), `${a} წ.`, [1]);
    return { gb, bb, i };
  });
  tag(k, chart, v(-3.5, 3.4, 0), "■ გოგონები ■ ბიჭები — სიმაღლე, სმ", [1]);
  // Frontal lobe maturing.
  const front0 = layer(k, body, g, (p) => p.group === "brain" && /frontal gyrus/i.test(p.name), k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0 }), 1);
  const fm = front0.material as THREE.MeshPhysicalMaterial;
  const st = tag(k, g, v(0.12, 1.7, 0.05), "", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: i === 1 || i === 2,
      enter: () => {
        g.visible = i !== 1;
        chart.visible = i === 1;
        k.mood(i === 1 ? "#11161a" : "#0e1416", i === 1 ? 25 : 3, i === 1 ? 60 : 10);
      },
      update: (u: number, s: number, t: number) => {
        toGonads.update(t, i === 0 ? 1 : 0);
        bars.forEach(({ gb, bb, i: j }) => {
          const f = ease(u * 1.6 - j * 0.12);
          gb.scale.y = Math.max(0.01, ((girls[j] - 100) / 20) * f);
          bb.scale.y = Math.max(0.01, ((boys[j] - 100) / 20) * f);
        });
        const age = 12 + 13 * ease(u / 0.85);
        fm.emissiveIntensity = i === 2 ? 0.1 + 0.8 * ((age - 12) / 13) : 0;
        setText(st, `ასაკი: ${Math.round(age)} — შუბლის წილი მწიფდება`);
        if (i === 1) return front(s, 13, v(0.4, 0.8, 0), 0.08);
        return i === 0 ? orbit(v(0, 1.25, 0), 1.7, s, { start: 0.3, speed: 0.03, height: 0.05 }) : orbit(v(0, 1.64, 0), 0.4, s, { start: 0.9, speed: 0.04, height: 0.2 });
      },
    })),
  };
};

// ---- Reproductive system (schematic) -----------------------------------------------------------------------

export const reproSystem: Builder = async (k) => {
  const body = await k.body({ organs: true });
  lab(k, "#130f14");
  // Female: a schematic uterus with tubes and ovaries.
  const fem = new THREE.Group();
  k.root.add(fem);
  const pink = k.material({ color: "#e89aa8", roughness: 0.4, clearcoat: 0.5, normalMap: k.normalMap("organic", [2, 2]) });
  const uterus = new THREE.Mesh(k.track(new THREE.SphereGeometry(1, 32, 24)), pink);
  uterus.scale.set(1.1, 1.3, 0.8);
  fem.add(uterus);
  const cervix = new THREE.Mesh(k.cylinder, pink);
  cervix.scale.set(0.35, 1, 0.35);
  cervix.position.y = -1.5;
  fem.add(cervix);
  const tubes = [-1, 1].map((sx) => {
    const c = curve([v(sx * 0.9, 0.9, 0), v(sx * 1.8, 1.4, 0), v(sx * 2.7, 1.0, 0), v(sx * 3.0, 0.3, 0)]);
    k.tube(c.getPoints(30), 0.12, pink, fem, 40, 8);
    const ov = new THREE.Mesh(k.sphere, k.material({ color: "#f2c8b8", roughness: 0.5 }));
    ov.scale.set(0.45, 0.3, 0.3);
    ov.position.set(sx * 2.6, 0.0, 0);
    fem.add(ov);
    return c;
  });
  const eggCell = new THREE.Mesh(k.sphere, k.material({ color: "#fff2e0", emissive: "#ffd0a0", emissiveIntensity: 0.4 }));
  eggCell.scale.setScalar(0.12);
  fem.add(eggCell);
  tag(k, fem, v(2.6, -0.5, 0), "საკვერცხე", [0]);
  tag(k, fem, v(1.8, 1.8, 0), "ფალოპის მილი", [0]);
  tag(k, fem, v(0, 0.2, 0.9), "საშვილოსნო", [0]);
  // Male: the atlas pelvis region with the testes and ducts.
  const male = new THREE.Group();
  k.root.add(male);
  context(k, body, male, 0.06, 0.18);
  layer(k, body, male, (p) => p.group === "gonads", k.material({ color: "#d98aa0", emissive: "#d98aa0", emissiveIntensity: 0.3 }), 1);
  layer(k, body, male, (p) => p.group === "urinary" && /bladder|ureter/i.test(p.name), k.ghost("#f2d36b", 0.5), 2);
  tag(k, male, v(0.03, 0.8, 0.07), "სათესლეები", [1]);
  tag(k, male, v(0.0, 0.9, -0.02), "შარდის ბუშტი", [1]);
  // Hygiene stage: a simple calendar/clock and water drops.
  const hyg = new THREE.Group();
  k.root.add(hyg);
  const shield = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.4, 1.4, 0.2, 6)), k.material({ color: "#0f8a74", emissive: "#0f8a74", emissiveIntensity: 0.3, roughness: 0.4 }));
  shield.rotation.x = Math.PI / 2;
  hyg.add(shield);
  const cross = new THREE.Group();
  for (const r of [0, Math.PI / 2]) {
    const bar = new THREE.Mesh(k.track(new THREE.BoxGeometry(1.4, 0.35, 0.3)), k.material({ color: "#ffffff" }));
    bar.rotation.z = r;
    bar.position.z = 0.15;
    cross.add(bar);
  }
  hyg.add(cross);
  tag(k, hyg, v(0, 2, 0), "ჰიგიენა · ექიმი · პატივისცემა", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => {
        fem.visible = i === 0;
        male.visible = i === 1;
        hyg.visible = i === 2;
        k.mood(i === 1 ? "#0e1416" : "#130f14", i === 1 ? 3 : 25, i === 1 ? 8 : 60);
      },
      update: (u: number, s: number, t: number) => {
        eggCell.position.copy(tubes[1].getPointAt(1 - ease(u / 0.8)));
        shield.rotation.z = t * 0.3;
        if (i === 1) return orbit(v(0, 0.9, 0.02), 0.55, s, { start: 0.3, speed: 0.04, height: 0.1 });
        return front(s, i === 2 ? 7 : 9, v(0, 0.3, 0), 0.1);
      },
    })),
  };
};

// ---- Menstrual cycle --------------------------------------------------------------------------------------------

export const cycle: Builder = async (k) => {
  lab(k, "#130f14");
  const g = new THREE.Group();
  k.root.add(g);
  // Ovary with a follicle; uterus lining as a slab.
  const ovary = new THREE.Mesh(k.sphere, k.material({ color: "#f2c8b8", roughness: 0.5, transparent: true, opacity: 0.7, normalMap: k.normalMap("organic", [2, 2]) }));
  ovary.scale.set(1.4, 1, 1);
  ovary.position.set(-3.5, 1.5, 0);
  const follicle = new THREE.Mesh(k.sphere, k.ghost("#f2e0a0", 0.75));
  follicle.position.set(-3.1, 1.6, 0.5);
  const eggC = new THREE.Mesh(k.sphere, k.material({ color: "#fff2e0", emissive: "#ffd0a0", emissiveIntensity: 0.5 }));
  eggC.scale.setScalar(0.12);
  const body0 = new THREE.Mesh(k.sphere, k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0.3 }));
  body0.position.copy(follicle.position);
  g.add(ovary, follicle, eggC, body0);
  const lining = new THREE.Mesh(k.track(new THREE.BoxGeometry(4, 1, 1.6).translate(0, 0.5, 0)), k.material({ color: "#d9625a", roughness: 0.4, normalMap: k.normalMap("organic", [4, 2]) }));
  lining.position.set(2.5, -1.2, 0);
  const wall = new THREE.Mesh(k.track(new THREE.BoxGeometry(4, 0.5, 1.6)), k.material({ color: "#b5524a", roughness: 0.5 }));
  wall.position.set(2.5, -1.45, 0);
  g.add(lining, wall);
  // Hormone chart drawn as two lines plus a day marker.
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 200;
  const tex = k.track(new THREE.CanvasTexture(cv));
  tex.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(k.track(new THREE.PlaneGeometry(7, 2.7)), k.material({ map: tex, roughness: 0.9 }));
  panel.position.set(0, 4.3, -0.5);
  g.add(panel);
  const ctx = cv.getContext("2d")!;
  const est = (d: number) => 0.2 + 0.7 * Math.exp(-(((d - 13) / 3) ** 2)) + 0.3 * Math.exp(-(((d - 21) / 4) ** 2));
  const pro = (d: number) => 0.1 + 0.8 * Math.exp(-(((d - 21) / 4) ** 2));
  const draw = (day: number) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 512, 200);
    for (const [f, c] of [
      [est, "#e05a8a"],
      [pro, "#5b8def"],
    ] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = 5;
      ctx.beginPath();
      for (let d = 0; d <= 28; d += 0.25) {
        const x = 20 + (d / 28) * 470;
        const y = 180 - f(d) * 150;
        if (d === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#111a18";
    ctx.fillRect(20 + (day / 28) * 470 - 2, 10, 4, 180);
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = "#e05a8a";
    ctx.fillText("ესტროგენი", 30, 30);
    ctx.fillStyle = "#5b8def";
    ctx.fillText("პროგესტერონი", 180, 30);
    ctx.fillStyle = "#111a18";
    ctx.fillText(`დღე ${Math.round(day)}`, 400, 30);
    tex.needsUpdate = true;
  };
  const tubePath = curve([v(-3.1, 1.6, 0.5), v(-2, 2.4, 0.3), v(0, 2.2, 0), v(1.5, 0.5, 0), v(2.2, -0.2, 0)]);
  const shed = flow(k, g, { n: 30, color: "#c0392b", size: 0.1, period: 2.5, from: (i) => v(1 + (i % 10) * 0.33, -0.3, (i % 3) * 0.4 - 0.4), to: (i) => v(1.5 + (i % 10) * 0.2, -3, 0), seed: 3 });
  tag(k, g, v(-3.5, 2.8, 0), "საკვერცხე", [0, 1]);
  tag(k, g, v(2.5, 0.3, 0.9), "საშვილოსნოს გარსი", [0, 2]);
  const st = tag(k, g, v(0, 2.6, 0.5), "");
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        const day = i === 0 ? 1 + 12 * u : i === 1 ? 13 + 12 * u : 25 + 3 * u;
        draw(day);
        follicle.visible = day < 14.5;
        follicle.scale.setScalar(0.15 + 0.4 * Math.min(1, day / 14));
        eggC.visible = day > 13;
        eggC.position.copy(day < 14.5 ? follicle.position : tubePath.getPointAt(Math.min(1, (day - 14.5) / 10)));
        body0.visible = day >= 14.5 && day < 27;
        body0.scale.setScalar(0.3 + 0.2 * Math.min(1, (day - 14.5) / 5) - (day > 24 ? (day - 24) * 0.08 : 0));
        lining.scale.y = day < 28 && i < 2 ? 0.3 + 0.9 * Math.min(1, day / 21) : Math.max(0.15, 1.2 - ease(u) * 1.05);
        shed.update(i === 2 ? t : 0);
        shed.mesh.visible = i === 2;
        setText(st, i === 0 ? "ფოლიკული მწიფდება" : day < 15 ? "ოვულაცია" : "ყვითელი სხეული — პროგესტერონი", );
        if (i === 2) setText(st, "მენსტრუაცია — ახალი ციკლი");
        return front(s, 12, v(0, 1.3, 0), 0.08);
      },
    })),
  };
};

// ---- Fetus -----------------------------------------------------------------------------------------------------

/** A curled fetus from shapes, scale ~1 at term. */
function fetusModel(k: Kit) {
  const g = new THREE.Group();
  const skin = k.material({ color: "#f0b8a0", roughness: 0.4, clearcoat: 0.6, sheen: 0.6, sheenColor: new THREE.Color("#ffe0d0"), normalMap: k.normalMap("organic", [2, 2]) });
  const head = new THREE.Mesh(k.sphere, skin);
  head.scale.set(0.55, 0.6, 0.55);
  head.position.set(0, 0.55, 0.2);
  const torso = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.45, 0.6, 8, 16)), skin);
  torso.rotation.x = 0.6;
  torso.position.set(0, -0.2, 0);
  const limbs = [
    [v(0.35, 0, 0.3), v(0.3, -0.3, 0.6), 0.12],
    [v(-0.35, 0, 0.3), v(-0.3, -0.3, 0.6), 0.12],
    [v(0.3, -0.7, 0.1), v(0.25, -0.5, 0.7), 0.16],
    [v(-0.3, -0.7, 0.1), v(-0.25, -0.5, 0.7), 0.16],
  ] as const;
  g.add(head, torso);
  for (const [a, b, r] of limbs) k.tube([a, a.clone().lerp(b, 0.5).add(v(0, 0.1, 0.1)), b], r, skin, g, 10, 8);
  return g;
}

export const fetus: Builder = async (k) => {
  lab(k, "#150c0e");
  const g = new THREE.Group();
  k.root.add(g);
  const sac = new THREE.Mesh(k.sphere, k.ghost("#f2d8c8", 0.25, { side: THREE.DoubleSide, roughness: 0.1, clearcoat: 1 }));
  g.add(sac);
  const f = fetusModel(k);
  g.add(f);
  const placenta = new THREE.Mesh(k.track(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3)), k.material({ color: "#9a3a3a", roughness: 0.5, normalMap: k.normalMap("organic", [4, 4]), side: THREE.DoubleSide }));
  g.add(placenta);
  const cord = curve([v(0, -0.1, 0.4), v(0.8, 0.4, 0.6), v(1.2, 1.4, 0.2), v(0.8, 2.1, 0)]);
  // The cord grows with the fetus.
  const cg = new THREE.Group();
  g.add(cg);
  k.tube(cord.getPoints(30), 0.08, k.material({ color: "#e8d0c8", roughness: 0.4, clearcoat: 0.5 }), cg, 40, 8);
  const nutr = beads(k, cg, cord, { n: 14, color: "#f2c230", size: 0.06, speed: -0.2, emissive: 0.8 });
  const sizeTag = tag(k, g, v(0, -2.6, 0), "");
  tag(k, g, v(0.8, 2.6, 0), "პლაცენტა", [1]);
  tag(k, g, v(1.5, 1, 0.5), "ჭიპლარი", [1]);
  tag(k, g, v(-2, 0.5, 0), "სანაყოფე წყალი", [1]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        const week = i === 0 ? 4 + 8 * ease(u) : i === 1 ? 20 : 20 + 20 * ease(u);
        const scale = 0.15 + 0.85 * Math.pow(week / 40, 1.3);
        f.scale.setScalar(scale);
        cg.scale.setScalar(scale);
        sac.scale.setScalar(0.6 + 1.6 * scale);
        placenta.scale.setScalar(0.5 + 0.9 * scale);
        placenta.position.set(0, 0.6 + 1.2 * scale, 0);
        placenta.rotation.x = 0;
        nutr.update(-t, i === 1 ? 1 : 0.3);
        f.rotation.y = Math.sin(t * 0.3) * 0.3;
        setText(sizeTag, `${Math.round(week)} კვირა · ≈ ${week < 12 ? Math.round(week * 0.6) : Math.round(week * 1.25)} სმ`);
        return orbit(v(0, 0.3, 0), 3.4 + 2.4 * scale, s, { start: 0.4, speed: 0.04, height: 0.15 });
      },
    })),
  };
};

// ---- Factors affecting the fetus ---------------------------------------------------------------------------------

export const fetalFactors: Builder = async (k) => {
  lab(k, "#150c0e");
  const g = new THREE.Group();
  k.root.add(g);
  const f = fetusModel(k);
  f.scale.setScalar(0.8);
  f.position.set(2, 0, 0);
  g.add(f);
  const barrier = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.4, 4, 3)), k.material({ color: "#9a3a3a", roughness: 0.5, transparent: true, opacity: 0.7, normalMap: k.normalMap("organic", [2, 4]) }));
  g.add(barrier);
  tag(k, g, v(0, 2.4, 0), "პლაცენტა", [0, 1, 2]);
  tag(k, g, v(-3, 2.4, 0), "დედის სისხლი", [0, 1]);
  const lanes = [-1.2, -0.4, 0.4, 1.2];
  const good = lanes.map((y, j) => beads(k, g, curve([v(-4, y, 0), v(0, y, 0), v(1.8, 0, 0)]), { n: 6, color: "#4bb36b", size: 0.12, speed: 0.2, emissive: 0.6, seed: j + 1 }));
  const bad = lanes.map((y, j) => beads(k, g, curve([v(-4, y + 0.2, 0.3), v(0, y + 0.2, 0.3), v(1.8, 0.2, 0.3)]), { n: 6, color: "#e0242a", size: 0.13, speed: 0.2, emissive: 0.8, seed: j + 10 }));
  const shield = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.15, 4, 3)), k.material({ color: "#0f8a74", emissive: "#0f8a74", emissiveIntensity: 0.4, transparent: true, opacity: 0.6 }));
  shield.position.x = -1.6;
  g.add(shield);
  const st = tag(k, g, v(-2, -2.4, 0), "");
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (_u: number, s: number, t: number) => {
        good.forEach((b) => b.update(t, 1));
        bad.forEach((b) => b.update(t, i === 1 ? 1 : 0));
        shield.visible = i === 2;
        setText(st, ["O₂, გლუკოზა, ვიტამინები → ნაყოფს", "ალკოჰოლი, ნიკოტინი, ვირუსები — გადის!", "სწორი კვება და მავნე ნივთიერებებზე უარი"][i]);
        return front(s, 10, v(0, 0.2, 0), 0.15);
      },
    })),
  };
};

// ---- STIs ---------------------------------------------------------------------------------------------------------

export const sti: Builder = async (k) => {
  lab(k, "#10101a");
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(4);
  // Pathogens.
  const path = new THREE.Group();
  g.add(path);
  const spir: V3[] = [];
  for (let i = 0; i < 40; i++) spir.push(v(-3 + i * 0.07, Math.sin(i * 0.8) * 0.2, Math.cos(i * 0.8) * 0.2));
  k.tube(spir, 0.05, k.material({ color: "#7cc66a" }), path, 80, 6);
  const cocci = [0, 1].map((j) => {
    const c = new THREE.Mesh(k.sphere, k.material({ color: "#e0a12a" }));
    c.scale.setScalar(0.3);
    c.position.set(0 + j * 0.55, 0, 0);
    path.add(c);
    return c;
  });
  void cocci;
  const virus = new THREE.Group();
  virus.add(new THREE.Mesh(k.track(new THREE.IcosahedronGeometry(0.5, 1)), k.material({ color: "#c9d4dc", roughness: 0.3 })));
  virus.position.set(2.5, 0, 0);
  path.add(virus);
  tag(k, path, v(-1.6, 0.7, 0), "ბაქტერია (სიფილისი)", [0]);
  tag(k, path, v(0.3, 0.7, 0), "ბაქტერია (გონორეა)", [0]);
  tag(k, path, v(2.5, 0.9, 0), "ვირუსი (აივ)", [0]);
  // HIV infecting T cells.
  const tcells = Array.from({ length: 10 }, (_, i) => {
    const c = new THREE.Mesh(k.sphere, k.material({ color: "#c8b8f0", roughness: 0.4, normalMap: k.normalMap("organic", [2, 2]) }));
    c.scale.setScalar(0.55);
    c.position.set(-4 + (i % 5) * 2, i < 5 ? 1.2 : -1.2, 0);
    g.add(c);
    return c;
  });
  const virions = Array.from({ length: 20 }, () => {
    const vv = new THREE.Mesh(k.track(new THREE.IcosahedronGeometry(0.12, 0)), k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.5 }));
    g.add(vv);
    return { vv, from: v((r() - 0.5) * 10, (r() - 0.5) * 5, 2), d: r() };
  });
  const count = tag(k, g, v(0, 3, 0), "", [1]);
  // Protection: a shield blocking particles.
  const prot = new THREE.Group();
  g.add(prot);
  const sh = new THREE.Mesh(k.track(new THREE.CylinderGeometry(2, 2, 0.2, 6)), k.material({ color: "#0f8a74", emissive: "#0f8a74", emissiveIntensity: 0.3, transparent: true, opacity: 0.8 }));
  sh.rotation.z = Math.PI / 2;
  prot.add(sh);
  const blocked = Array.from({ length: 16 }, (_, i) => {
    const p = new THREE.Mesh(k.sphere, k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.5 }));
    p.scale.setScalar(0.12);
    prot.add(p);
    return { p, y: (i % 4) * 0.6 - 0.9, z: Math.floor(i / 4) * 0.6 - 0.9, d: i * 0.06 };
  });
  tag(k, prot, v(0, 2.6, 0), "ბარიერი · ვაქცინა · ტესტი", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      enter: () => {
        path.visible = i === 0;
        prot.visible = i === 2;
        tcells.forEach((c) => (c.visible = i === 1));
        virions.forEach((x) => (x.vv.visible = i === 1));
      },
      update: (u: number, s: number, t: number) => {
        path.rotation.y = Math.sin(t * 0.3) * 0.3;
        virions.forEach((x, j) => {
          const target = tcells[j % 10].position;
          x.vv.position.lerpVectors(x.from, target, ease((u - x.d * 0.3) / 0.3));
        });
        const lost = Math.floor(10 * ease((u - 0.4) / 0.5));
        tcells.forEach((c, j) => c.scale.setScalar(j < lost ? 0.15 : 0.55));
        setText(count, `T-ლიმფოციტები: ${10 - lost} / 10`);
        blocked.forEach((b) => {
          const f = ((t * 0.4 + b.d) % 1);
          b.p.position.set(-4 + Math.min(f, 0.5) * 7.5 - Math.max(0, f - 0.5) * 3, b.y, b.z);
        });
        return front(s, 11, v(0, 0, 0), 0.1);
      },
    })),
  };
};

// ---- Brain maturity --------------------------------------------------------------------------------------------------

export const brainMaturity: Builder = async (k) => {
  const body = await k.body({ brain: true });
  k.mood("#0e1416", 0.5, 3);
  const g = new THREE.Group();
  k.root.add(g);
  layer(k, body, g, (p) => p.group === "brain" && !/frontal|amygdala|hippocamp/i.test(p.name), k.ghost("#e8c7c0", 0.35), 3);
  const frontal = layer(k, body, g, (p) => p.group === "brain" && /frontal/i.test(p.name), k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0 }), 1);
  const limbic = layer(k, body, g, (p) => p.group === "brain" && /amygdala|hippocamp/i.test(p.name), k.material({ color: "#e0524a", emissive: "#e0524a", emissiveIntensity: 0.6 }), 1);
  void limbic;
  const fm = frontal.material as THREE.MeshPhysicalMaterial;
  const fc = frontal.geometry.boundingBox!.getCenter(new THREE.Vector3());
  k.label(k.anchor(g, fc.clone().add(v(0, 0.02, 0.03))), "შუბლის წილი — გადაწყვეტილებები", { stages: [0, 2] });
  k.label(k.anchor(g, v(0.025, 1.616, 0)), "ემოციების ცენტრები — ადრე მწიფდება", { stages: [0] });
  const age = k.label(k.anchor(g, v(0, 1.72, 0)), "", { kind: "tag" });
  // Risks as icons around the head.
  const risks = new THREE.Group();
  g.add(risks);
  const ic = ["#e0524a", "#a46be0", "#f08a2a", "#5b8def"];
  const texts = ["ორსულობა", "ინფექციები", "განათლება", "სტრესი"];
  texts.forEach((t0, i) => {
    const a = (i / 4) * Math.PI * 2;
    const m = new THREE.Mesh(k.track(new THREE.OctahedronGeometry(0.012)), k.material({ color: ic[i], emissive: ic[i], emissiveIntensity: 0.6 }));
    m.position.set(Math.cos(a) * 0.12, 1.64 + Math.sin(a) * 0.08, 0.04);
    risks.add(m);
    k.label(k.anchor(risks, m.position.clone().add(v(0, 0.02, 0))), t0, { kind: "tag", stages: [1] });
  });
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        const yrs = i === 0 ? 12 + 13 * ease(u / 0.85) : i === 1 ? 16 : 25;
        fm.emissiveIntensity = 0.05 + 0.8 * ((yrs - 12) / 13);
        risks.visible = i === 1;
        risks.rotation.z = t * 0.2;
        setText(age, i === 2 ? "გააზრებული, თავისუფალი, დროული არჩევანი" : `ასაკი: ${Math.round(yrs)}`);
        return orbit(v(0.01, 1.64, 0), 0.38, s, { start: 0.8, speed: 0.04, height: 0.2 });
      },
    })),
  };
};
