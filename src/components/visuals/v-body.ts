import * as THREE from "three";
import { beads, context, curve, flow, layer, orbit } from "@/components/journeys/common";
import { ease, rng, v, type Builder, type Kit, type Shot, type V3 } from "@/components/journeys/JourneyScene";
import { beetle } from "./nature";
import { bacterium } from "./micro";
import { loadNatureAssets, model } from "./nature-assets";

/*
 * Body lessons: bone chemistry, joints, injuries, posture (the atlas spine, vertebra by vertebra), how
 * animals move, breathing control (atlas diaphragm and lungs), respiratory disease, nutrients and food
 * energy, gut disease and hygiene, the healthy plate, exchange with the environment, the nephron, skin,
 * and excretory organs across animals.
 */

const setText = (el: HTMLDivElement, text: string) => {
  const t = el.querySelector(".blood-label-text") ?? el;
  if (t.textContent !== text) t.textContent = text;
};
const lab = (k: Kit) => k.mood("#141a1c", 25, 60);
const front = (s: number, d: number, at = v(0, 0, 0), h = 0.18, side = 0): Shot => orbit(at, d, 0, { start: side + Math.sin(s * 0.15) * 0.18, height: h });
const tag = (k: Kit, parent: THREE.Object3D, p: V3, text: string, stages?: number[]) => k.label(k.anchor(parent, p), text, { kind: "tag", stages });
const L = (k: Kit, parent: THREE.Object3D, p: V3, text: string, stages?: number[]) => k.label(k.anchor(parent, p), text, { stages });

/** A long bone along y (shaft + knobbly ends) that can bend. */
function longBone(k: Kit, mat: THREE.Material, len = 6) {
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 60; i++) {
    const y = -len / 2 + (len * i) / 60;
    const a = Math.abs(y) / (len / 2);
    let r = 0.32 + 0.38 * THREE.MathUtils.smoothstep(a, 0.6, 0.95);
    if (a > 0.95) r *= Math.sqrt(Math.max(0, 1 - ((a - 0.95) / 0.05) ** 2));
    prof.push(new THREE.Vector2(Math.max(0.001, r), y));
  }
  const geo = k.track(new THREE.LatheGeometry(prof, 32));
  const base = (geo.attributes.position.array as Float32Array).slice();
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh,
    bend: (amount: number) => {
      const p = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const y = base[i * 3 + 1];
        p.setX(i, base[i * 3] + amount * (y * y) * 0.25);
      }
      p.needsUpdate = true;
      geo.computeVertexNormals();
    },
  };
}

const boneMat = (k: Kit) => k.material({ color: "#eadfc6", roughness: 0.55, clearcoat: 0.2, normalMap: k.normalMap("bone", [2, 4]) });

// ---- 8 2.4 Bone chemistry ----------------------------------------------------------------------------------

export const boneChemistry: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const mat = boneMat(k);
  const bone = longBone(k, mat);
  g.add(bone.mesh);
  // Composition ring: 2/3 mineral, 1/3 collagen.
  const ring = new THREE.Group();
  const min = new THREE.Mesh(k.track(new THREE.TorusGeometry(1.4, 0.35, 16, 64, Math.PI * 2 * (2 / 3))), k.material({ color: "#dfe3e8", roughness: 0.4 }));
  const org = new THREE.Mesh(k.track(new THREE.TorusGeometry(1.4, 0.35, 16, 64, Math.PI * 2 * (1 / 3))), k.material({ color: "#e07a4a", roughness: 0.4 }));
  org.rotation.z = Math.PI * 2 * (2 / 3);
  ring.add(min, org);
  ring.position.set(4, 0.5, 0);
  g.add(ring);
  tag(k, ring, v(-1.2, 1.4, 0.5), "მარილები ≈ 2/3 — სიმტკიცე", [0]);
  tag(k, ring, v(1.2, -1.4, 0.5), "კოლაგენი ≈ 1/3 — დრეკადობა", [0]);
  // Beaker of acid.
  const beaker = new THREE.Group();
  const glass = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.6, 1.6, 7, 32, 1, true)), k.ghost("#dfeff5", 0.2, { side: THREE.DoubleSide, roughness: 0.05, clearcoat: 1 }));
  const acid = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.55, 1.55, 6, 32)), k.ghost("#c8e86a", 0.25));
  acid.position.y = -0.4;
  beaker.add(glass, acid);
  g.add(beaker);
  // Flame.
  const fire = new THREE.Group();
  const flames = [0, 1, 2, 3, 4].map((i) => {
    const f = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.35, 1.6, 10)), k.material({ color: i % 2 ? "#ff9a2a" : "#ffd23f", emissive: i % 2 ? "#ff6a00" : "#ffb000", emissiveIntensity: 1.4, transparent: true, opacity: 0.85 }));
    f.position.set((i - 2) * 0.45, -3.4, 0.3);
    fire.add(f);
    return f;
  });
  g.add(fire);
  const crumbs = Array.from({ length: 40 }, (_, i) => {
    const c = new THREE.Mesh(k.track(new THREE.DodecahedronGeometry(0.12 + (i % 5) * 0.03)), k.material({ color: "#d8d2c8", roughness: 0.9 }));
    g.add(c);
    return { c, x: (Math.sin(i * 7.1) * 0.5) * 0.6, y: -3 + (i / 40) * 6, d: (i % 7) * 0.05 };
  });
  // Child vs old: slices with pores.
  const slices = new THREE.Group();
  g.add(slices);
  const r = rng(4);
  [-2, 2].forEach((x, side) => {
    const disc = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1.4, 1.4, 0.4, 48)), side ? k.material({ color: "#e6dcc6", roughness: 0.8 }) : k.material({ color: "#efd9c0", roughness: 0.5 }));
    disc.rotation.x = Math.PI / 2;
    disc.position.set(x, 0, 0);
    slices.add(disc);
    for (let i = 0; i < (side ? 40 : 6); i++) {
      const hole = new THREE.Mesh(k.cylinder, k.material({ color: "#2a2420" }));
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * 1.15;
      hole.position.set(x + Math.cos(a) * d, Math.sin(a) * d, 0.21);
      hole.rotation.x = Math.PI / 2;
      hole.scale.set(0.06 + r() * (side ? 0.12 : 0.04), 0.02, 0.06 + r() * (side ? 0.12 : 0.04));
      slices.add(hole);
    }
    tag(k, slices, v(x, 1.9, 0), side ? "ხანდაზმული — ფოროვანი, მყიფე" : "ბავშვი — დრეკადი", [3]);
  });
  const status = tag(k, g, v(0, 4.2, 0), "", [1, 2]);
  return {
    stages: [0, 1, 2, 3].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        ring.visible = i === 0;
        beaker.visible = i === 1;
        fire.visible = i === 2;
        slices.visible = i === 3;
        bone.mesh.visible = i < 3;
        const soft = i === 1 ? ease((u - 0.2) / 0.6) : 0;
        bone.bend(soft * 1.6 * (0.6 + 0.4 * Math.sin(t * 1.5)));
        mat.color.set("#eadfc6").lerp(new THREE.Color(i === 1 ? "#f0e8b0" : "#3a3430"), i === 1 ? soft * 0.6 : i === 2 ? ease(u / 0.5) * 0.8 : 0);
        mat.transparent = i === 1;
        mat.opacity = i === 1 ? 1 - 0.3 * soft : 1;
        flames.forEach((f, j) => f.scale.set(1, 0.8 + 0.3 * Math.sin(t * 10 + j), 1));
        const crumble = i === 2 ? ease((u - 0.55) / 0.35) : 0;
        bone.mesh.visible = i < 2 || (i === 2 && crumble < 0.5);
        crumbs.forEach((c) => {
          c.c.visible = i === 2 && crumble > 0.3;
          c.c.position.set(c.x, c.y - crumble * (c.y + 3.8) * (0.6 + c.d), 0.2);
        });
        setText(status, i === 1 ? (soft < 0.5 ? "მჟავა მარილებს ხსნის…" : "ძვალი იღუნება!") : crumble < 0.3 ? "ორგანული ნივთიერება იწვის…" : "ძვალი იფშვნება");
        return front(s, 13, v(i === 0 ? 2 : 0, i === 2 ? -0.6 : 0, 0), 0.12);
      },
    })),
  };
};

// ---- 8 2.5 Joints ----------------------------------------------------------------------------------------------

/** A ball-and-socket joint, cut open: head, socket, cartilage, capsule, synovial fluid. */
function ballJoint(k: Kit) {
  const g = new THREE.Group();
  const bm = boneMat(k);
  const shaft = longBone(k, bm, 5);
  shaft.mesh.position.y = -2.6;
  const head = new THREE.Mesh(k.sphere, bm);
  head.scale.setScalar(0.9);
  const arm = new THREE.Group();
  arm.add(shaft.mesh, head);
  const cart = new THREE.Mesh(k.track(new THREE.SphereGeometry(0.95, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.6)), k.material({ color: "#bfe0ea", roughness: 0.25, clearcoat: 1 }));
  arm.add(cart);
  g.add(arm);
  const socket = new THREE.Mesh(k.track(new THREE.SphereGeometry(1.1, 32, 24, 0, Math.PI * 1.5, 0, Math.PI * 0.55)), k.material({ color: "#e6dabd", roughness: 0.55, side: THREE.DoubleSide, normalMap: k.normalMap("bone", [2, 2]) }));
  socket.rotation.y = Math.PI * 0.75;
  const pelvis = new THREE.Mesh(k.track(new THREE.BoxGeometry(3, 1.2, 1.6)), bm);
  pelvis.position.y = 1.5;
  const fluid = new THREE.Mesh(k.sphere, k.ghost("#f2d36b", 0.35));
  fluid.scale.setScalar(1.05);
  const capsule = new THREE.Mesh(k.track(new THREE.SphereGeometry(1.45, 32, 24, 0, Math.PI * 1.4)), k.ghost("#e8b8a8", 0.35, { side: THREE.DoubleSide }));
  capsule.rotation.y = Math.PI * 0.8;
  g.add(socket, pelvis, fluid, capsule);
  return { g, arm, head, socket, capsule };
}

export const joints: Builder = async (k) => {
  const body = await k.body({ organs: true });
  lab(k);
  // Skull: each bone its own colour so the sutures show.
  const skull = new THREE.Group();
  k.root.add(skull);
  const skullBones = body.parts((p) => p.group === "skeleton" && /frontal|parietal|occipital|temporal|sphenoid|zygomatic|maxilla|nasal|mandible/i.test(p.name));
  const palette = ["#efe4c9", "#d9c49a", "#f4ecdc", "#c9b48a", "#e6d2a6"];
  skullBones.forEach((p, i) => {
    const m = new THREE.Mesh(body.geometry(p), k.material({ color: palette[i % palette.length], roughness: 0.55, clearcoat: 0.2 }));
    skull.add(m);
  });
  const sc = new THREE.Box3().setFromObject(skull).getCenter(new THREE.Vector3());
  L(k, skull, sc.clone().add(v(0, 0.085, 0.02)), "ნაკერი — უძრავი შეერთება", [0]);
  // Spine with discs.
  const spine = new THREE.Group();
  k.root.add(spine);
  layer(k, body, spine, (p) => p.group === "skeleton" && /vertebra|sacrum/i.test(p.name), k.material({ color: "#eadfc6", roughness: 0.55 }));
  const discs = layer(k, body, spine, (p) => p.group === "discs", k.material({ color: "#6fa8dc", roughness: 0.35, clearcoat: 0.6, emissive: "#3f78c0", emissiveIntensity: 0.2 }));
  const dc = discs.geometry.boundingBox!.getCenter(new THREE.Vector3());
  L(k, spine, v(dc.x + 0.03, 1.12, -0.03), "ხრტილოვანი დისკო", [1]);
  L(k, spine, v(dc.x - 0.03, 1.18, -0.06), "მალა", [1]);
  // Movable joint close-up.
  const jt = ballJoint(k);
  k.root.add(jt.g);
  tag(k, jt.g, v(0, 0.2, 1.6), "სასახსრე სითხე", [2]);
  tag(k, jt.g, v(-1.4, 0, 1), "სახსრის ჩანთა", [2]);
  tag(k, jt.g, v(0.9, 0.6, 0.9), "ხრტილი", [2]);
  tag(k, jt.g, v(0, -2.5, 0.8), "ძვლის თავი", [2]);
  tag(k, jt.g, v(1.2, 1.4, 0.8), "სასახსრე ფოსო", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => {
        skull.visible = i === 0;
        spine.visible = i === 1;
        jt.g.visible = i === 2;
      },
      update: (_u: number, s: number, t: number) => {
        jt.arm.rotation.set(Math.sin(t * 0.8) * 0.5, 0, Math.cos(t * 0.6) * 0.4);
        if (i === 0) return orbit(sc, 0.32, s, { start: 0.6, speed: 0.08, height: 0.25 });
        if (i === 1) return orbit(v(dc.x, 1.15, dc.z), 0.5, s, { start: 1.5, speed: 0.05, height: 0.05 });
        return front(s, 8, v(0, -0.5, 0), 0.15, 0.3);
      },
    })),
  };
};

// ---- 8 2.6 Injuries ----------------------------------------------------------------------------------------------

export const injuries: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  // A hinge joint (ankle-like): two bones and two ligaments.
  const hinge = new THREE.Group();
  g.add(hinge);
  const bm = boneMat(k);
  const upper = longBone(k, bm, 4);
  upper.mesh.position.y = 2.3;
  const lower = new THREE.Mesh(k.track(new THREE.BoxGeometry(3, 0.9, 1.4)), bm);
  lower.position.y = -0.2;
  const ligMat = k.material({ color: "#efe7d8", roughness: 0.4, clearcoat: 0.5, emissive: "#e0242a", emissiveIntensity: 0 });
  const ligs = [-1, 1].map((sx) => {
    const l = new THREE.Mesh(k.cylinder, ligMat);
    l.position.set(sx * 0.75, 0.6, 0.3);
    l.rotation.z = sx * 0.4;
    l.scale.set(0.12, 1.3, 0.12);
    hinge.add(l);
    return l;
  });
  const swell = new THREE.Mesh(k.sphere, k.ghost("#e88a8a", 0.25));
  swell.position.y = 0.6;
  hinge.add(upper.mesh, lower, swell);
  tag(k, hinge, v(1.4, 1.2, 0.5), "იოგი", [0]);
  // Dislocation.
  const jt = ballJoint(k);
  g.add(jt.g);
  // Fracture with splint.
  const frac = new THREE.Group();
  g.add(frac);
  const a = longBone(k, bm, 6);
  const top = new THREE.Mesh(a.mesh.geometry, bm);
  top.scale.y = 0.5;
  const bottom = top.clone();
  frac.add(top, bottom);
  const splintMat = k.material({ color: "#c9a36a", roughness: 0.8 });
  const splints = [-1, 1].map((sx) => {
    const sp = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.15, 6.4, 0.8)), splintMat);
    sp.position.x = sx * 1.1;
    frac.add(sp);
    return sp;
  });
  const wraps = [-2.2, -0.8, 0.8, 2.2].map((y) => {
    const w = new THREE.Mesh(k.track(new THREE.TorusGeometry(1.15, 0.12, 8, 32)), k.material({ color: "#f4f1ea", roughness: 0.9 }));
    w.rotation.x = Math.PI / 2;
    w.position.y = y;
    frac.add(w);
    return w;
  });
  const note = tag(k, g, v(0, 4.2, 0), "");
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => {
        hinge.visible = i === 0;
        jt.g.visible = i === 1;
        frac.visible = i === 2;
      },
      update: (u: number, s: number, t: number) => {
        if (i === 0) {
          const st = ease((u - 0.2) / 0.4);
          ligs.forEach((l) => (l.scale.y = 1.3 * (1 + 0.35 * st)));
          ligMat.emissiveIntensity = st * (0.4 + 0.3 * Math.sin(t * 5));
          upper.mesh.rotation.z = 0.35 * st;
          swell.scale.setScalar(0.4 + 1.2 * ease((u - 0.5) / 0.4));
          setText(note, st < 0.5 ? "იოგი იჭიმება" : "შეშუპება — სიცივე და უძრაობა");
        }
        if (i === 1) {
          const out = ease((u - 0.2) / 0.4);
          jt.arm.position.set(out * 1.6, -out * 0.9, out * 0.6);
          jt.arm.rotation.z = out * 0.5;
          setText(note, out < 0.5 ? "სახსარი" : "ძვლის თავი ფოსოდან ამოვარდა");
        }
        if (i === 2) {
          const brk = ease((u - 0.15) / 0.2);
          top.position.set(brk * 0.25, 1.5 + brk * 0.15, 0);
          top.rotation.z = brk * 0.12;
          bottom.position.set(-brk * 0.15, -1.5, 0);
          const fix = ease((u - 0.5) / 0.3);
          top.position.lerp(v(0, 1.5, 0), fix);
          top.rotation.z *= 1 - fix;
          bottom.position.lerp(v(0, -1.5, 0), fix);
          splints.forEach((sp) => (sp.visible = fix > 0.05));
          splints.forEach((sp, j) => (sp.position.z = (1 - fix) * (j ? 2 : -2)));
          wraps.forEach((w, j) => w.scale.setScalar(Math.max(0.001, ease((u - 0.7 - j * 0.05) / 0.15))));
          setText(note, brk < 0.5 ? "" : fix < 0.5 ? "მოტეხილობა" : "არტაშანი — ორ სახსარს აფიქსირებს");
        }
        return front(s, 10, v(0, 0.5, 0), 0.15, 0.25);
      },
    })),
  };
};

// ---- 8 2.9 Posture ---------------------------------------------------------------------------------------------------

export const posture: Builder = async (k) => {
  const body = await k.body(false);
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.05, 0.14);
  // Vertebrae one by one, so the column can be bent.
  const verts = body.parts((p) => p.group === "skeleton" && /vertebra|^atlas$|^axis$/i.test(p.name)).map((p) => {
    const geo = body.geometry(p);
    geo.computeBoundingBox();
    const c = geo.boundingBox!.getCenter(new THREE.Vector3());
    geo.translate(-c.x, -c.y, -c.z);
    const m = new THREE.Mesh(geo, k.material({ color: /cervical|atlas|axis/i.test(p.name) ? "#e6b84a" : /thoracic/i.test(p.name) ? "#e07a4a" : "#6fa8dc", roughness: 0.5, clearcoat: 0.3 }));
    m.position.copy(c);
    g.add(m);
    return { m, c };
  });
  const ys = verts.map((x) => x.c.y);
  const top = Math.max(...ys);
  const bot = Math.min(...ys);
  L(k, g, v(0, 1.48, -0.02), "კისრის მრუდი", [0]);
  L(k, g, v(0, 1.3, -0.1), "გულმკერდის მრუდი", [0]);
  L(k, g, v(0, 1.08, -0.02), "წელის მრუდი", [0]);
  const status = tag(k, g, v(0, 1.62, 0), "", [1, 2]);
  const pose = (scol: number, kyph: number, lord: number) => {
    for (const x of verts) {
      const f = (x.c.y - bot) / (top - bot);
      const dx = scol * 0.035 * Math.sin(Math.PI * f * 1.6);
      const thor = Math.exp(-(((x.c.y - 1.3) / 0.08) ** 2));
      const lumb = Math.exp(-(((x.c.y - 1.07) / 0.05) ** 2));
      x.m.position.set(x.c.x + dx, x.c.y, x.c.z - kyph * 0.03 * thor + lord * 0.025 * lumb);
      x.m.rotation.z = scol * 0.25 * Math.cos(Math.PI * f * 1.6);
    }
  };
  const at = v(0, 1.25, -0.04);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number) => {
        if (i === 0) pose(0, 0, 0);
        if (i === 1) pose(ease((u - 0.15) / 0.5), 0, 0);
        if (i === 2) pose(0, ease((u - 0.1) / 0.35), ease((u - 0.55) / 0.35));
        setText(status, i === 1 ? "სკოლიოზი — გვერდითი გამრუდება" : u < 0.5 ? "კიფოზი" : "ლორდოზი");
        // Side view for the curves, back view for scoliosis.
        return orbit(at, 0.85, s, { start: i === 1 ? Math.PI : Math.PI / 2 + 0.2, speed: 0.02, height: 0.05 });
      },
    })),
  };
};

// ---- 12 Locomotion -------------------------------------------------------------------------------------------------

export const locomotion: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  // Amoeba: a blob whose pseudopod reaches forward.
  const ameGeo = k.track(new THREE.IcosahedronGeometry(1, 5));
  const ameBase = (ameGeo.attributes.position.array as Float32Array).slice();
  const amoeba = new THREE.Mesh(ameGeo, k.ghost("#a58bd0", 0.75, { roughness: 0.25, clearcoat: 0.8, normalMap: k.normalMap("organic", [3, 3]) }));
  amoeba.scale.set(1.6, 0.6, 1.6);
  const nuc = new THREE.Mesh(k.sphere, k.material({ color: "#5a3d8a" }));
  nuc.scale.setScalar(0.35);
  amoeba.add(nuc);
  g.add(amoeba);
  // Earthworm: segments in a row.
  const worm = new THREE.Group();
  g.add(worm);
  const segMat = k.material({ color: "#c47a7a", roughness: 0.3, clearcoat: 0.9, normalMap: k.normalMap("fibre", [1, 4]) });
  const segs = Array.from({ length: 24 }, () => {
    const s = new THREE.Mesh(k.sphere, segMat);
    worm.add(s);
    return s;
  });
  // Exoskeleton vs endoskeleton.
  const skel = new THREE.Group();
  g.add(skel);
  const bug = beetle(k, "#2e4a6a");
  bug.g.scale.setScalar(14);
  bug.g.position.set(-2.5, 0, 0);
  skel.add(bug.g);
  const body = await k.body(false);
  const human = new THREE.Group();
  layer(k, body, human, (p) => ["skeleton", "femur", "humerus", "radius", "ulna"].includes(p.group), k.material({ color: "#eadfc6", roughness: 0.55 }));
  human.scale.setScalar(2.4);
  human.position.set(2.5, -2.1, 0);
  skel.add(human);
  tag(k, skel, v(-2.5, 1.6, 0), "გარეთა ჩონჩხი — ქიტინი", [2]);
  tag(k, skel, v(2.5, 2.4, 0), "შიგნითა ჩონჩხი — ძვლები", [2]);
  tag(k, g, v(0, 1.6, 0), "ცრუფეხი", [0]);
  tag(k, worm, v(0, 1.2, 0), "წრიული და სიგრძივი კუნთები მონაცვლეობით", [1]);
  const p = new THREE.Vector3();
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (_u: number, s: number, t: number) => {
        amoeba.visible = i === 0;
        worm.visible = i === 1;
        skel.visible = i === 2;
        if (i === 0) {
          const pos = ameGeo.attributes.position as THREE.BufferAttribute;
          const dir = v(Math.cos(t * 0.3), 0, Math.sin(t * 0.3) * 0.3).normalize();
          for (let j = 0; j < pos.count; j++) {
            p.set(ameBase[j * 3], ameBase[j * 3 + 1], ameBase[j * 3 + 2]);
            const d = p.dot(dir);
            const bulge = Math.max(0, d - 0.3) ** 2 * (1.2 + 0.6 * Math.sin(t * 1.5));
            const wob = 0.06 * Math.sin(t * 2 + p.x * 4 + p.z * 3);
            p.multiplyScalar(1 + bulge + wob);
            pos.setXYZ(j, p.x, p.y, p.z);
          }
          pos.needsUpdate = true;
          ameGeo.computeVertexNormals();
          amoeba.position.x = ((t * 0.25) % 6) - 3;
        }
        if (i === 1) {
          let x = ((t * 0.35) % 6) - 6;
          segs.forEach((sg, j) => {
            const w = Math.sin(t * 3 - j * 0.5);
            const r0 = 0.32 * (1 + 0.25 * w);
            sg.scale.set(0.28 * (1 - 0.25 * w), r0, r0);
            sg.position.set(x, 0, 0);
            x += 0.42 * (1 - 0.2 * w);
          });
        }
        bug.move(t);
        return front(s, i === 2 ? 11 : 9, v(i === 1 ? -1 : 0, 0.3, 0), 0.3);
      },
    })),
  };
};

// ---- 8 3.12 Breathing control ---------------------------------------------------------------------------------------

export const breathingControl: Builder = async (k) => {
  const body = await k.body({ organs: true, brain: true });
  k.mood("#0e1416", 3, 8);
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.06, 0.16);
  layer(k, body, g, (p) => p.group === "brain" && !/medulla/i.test(p.name), k.ghost("#e8c7c0", 0.25), 3);
  const medMat = k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0.3 });
  const medulla = layer(k, body, g, (p) => /medulla oblongata/i.test(p.name), medMat, 1);
  const lungs = layer(k, body, g, (p) => p.group === "lungs", k.material({ color: "#e8a0a4", roughness: 0.55, sheen: 0.6, sheenColor: new THREE.Color("#ffd8d8"), transparent: true, opacity: 0.85 }), 2);
  const lc = lungs.geometry.boundingBox!.getCenter(new THREE.Vector3());
  lungs.geometry.translate(-lc.x, -lc.y, -lc.z);
  lungs.position.copy(lc);
  const dia = layer(k, body, g, (p) => p.group === "diaphragm", k.material({ color: "#b5524a", roughness: 0.45, clearcoat: 0.4, normalMap: k.normalMap("fibre", [3, 3]) }), 1);
  layer(k, body, g, (p) => p.group === "airways", k.material({ color: "#e6d2c4", roughness: 0.5 }), 1);
  const mc = medulla.geometry.boundingBox!.getCenter(new THREE.Vector3());
  const dc = dia.geometry.boundingBox!.getCenter(new THREE.Vector3());
  const nerve = curve([mc, mc.clone().add(v(-0.01, -0.05, 0.01)), v(-0.025, 1.45, 0.0), v(-0.035, 1.35, 0.02), v(-0.045, dc.y + 0.03, 0.02)]);
  k.tube(nerve.getPoints(40), 0.0015, k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0.3 }), g, 80, 6);
  const pulses = beads(k, g, nerve, { n: 3, color: "#ffd23f", size: 0.004, speed: 0.4, emissive: 1.5 });
  const air = beads(k, g, curve([v(0, 1.53, 0.06), v(0, 1.47, 0.0), v(0, 1.4, -0.006), v(-0.03, 1.34, -0.01), v(-0.06, 1.3, 0)]), { n: 30, color: "#9fd0f0", size: 0.003, speed: 0.2 });
  const co2 = beads(k, g, curve([v(-0.06, 1.3, 0.0), v(-0.03, 1.34, -0.01), v(0, 1.4, -0.006), v(0, 1.47, 0.0), v(0, 1.53, 0.06)]), { n: 20, color: "#8d8d8d", size: 0.003, speed: 0.2, seed: 4 });
  L(k, g, mc, "სასუნთქი ცენტრი — მოგრძო ტვინი", [0, 2]);
  L(k, g, v(-0.035, 1.38, 0.025), "ნერვი", [0]);
  L(k, g, dc.clone().add(v(0.05, 0, 0.05)), "დიაფრაგმა", [0, 1]);
  const phase = tag(k, g, v(0.12, 1.3, 0.05), "", [1, 2]);
  let ph = 0;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number, dt: number) => {
        const rate = i === 2 ? 14 + 22 * ease((u - 0.2) / 0.5) : 14;
        ph += (dt * rate) / 60;
        const b = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2);
        lungs.scale.set(1 + 0.05 * b, 1 + 0.07 * b, 1 + 0.05 * b);
        dia.position.y = -0.018 * b;
        medMat.emissiveIntensity = 0.3 + 0.5 * Math.max(0, Math.sin(ph * Math.PI * 2));
        pulses.update(t);
        air.update(t, Math.sin(ph * Math.PI * 2) > 0 ? 1 : 0);
        co2.update(t, Math.sin(ph * Math.PI * 2) <= 0 ? 1 : 0);
        setText(phase, i === 2 ? `CO₂ ↑ — ${Math.round(rate)} სუნთქვა/წთ` : Math.sin(ph * Math.PI * 2) > 0 ? "ჩასუნთქვა: დიაფრაგმა ქვევით" : "ამოსუნთქვა: დიაფრაგმა მაღლა");
        return i === 0 ? orbit(v(-0.01, 1.45, 0), 0.6, s, { start: 0.5, speed: 0.03, height: 0.05 }) : orbit(v(0, 1.3, 0), 0.6, s, { start: 0.3, speed: 0.03, height: 0.08 });
      },
    })),
  };
};

// ---- 8 3.13 Respiratory disease --------------------------------------------------------------------------------------

export const respiratoryDisease: Builder = async (k) => {
  k.mood("#160c0e", 8, 26);
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(6);
  // An airway wall seen from inside with viruses landing.
  const wall = new THREE.Group();
  g.add(wall);
  const cellMat = k.material({ color: "#e6b3ad", roughness: 0.45, normalMap: k.normalMap("organic", [1, 1]), clearcoat: 0.3, emissive: "#e0242a", emissiveIntensity: 0 });
  const cells: THREE.Mesh[] = [];
  for (let x = -5; x <= 5; x++)
    for (let z = -3; z <= 3; z++) {
      const c = new THREE.Mesh(k.sphere, x === 0 || (x + z) % 4 === 0 ? cellMat : k.material({ color: "#e6b3ad", roughness: 0.45, normalMap: k.normalMap("organic", [1, 1]) }));
      c.scale.set(0.48, 0.3, 0.48);
      c.position.set(x + (z % 2) * 0.5, 0, z * 0.9);
      wall.add(c);
      cells.push(c);
    }
  const virusGeo = k.track(new THREE.IcosahedronGeometry(1, 1));
  const vMat = k.material({ color: "#c9d4dc", roughness: 0.3, metalness: 0.3 });
  const viruses = Array.from({ length: 14 }, () => {
    const vg = new THREE.Group();
    const core = new THREE.Mesh(virusGeo, vMat);
    vg.add(core);
    for (let j = 0; j < 10; j++) {
      const sp = new THREE.Mesh(k.cylinder, k.material({ color: "#e0524a" }));
      const n = v(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      sp.position.copy(n.clone().multiplyScalar(1.15));
      sp.quaternion.setFromUnitVectors(v(0, 1, 0), n);
      sp.scale.set(0.08, 0.4, 0.08);
      vg.add(sp);
    }
    vg.scale.setScalar(0.18);
    wall.add(vg);
    return { vg, from: v((r() - 0.5) * 10, 4 + r() * 2, (r() - 0.5) * 6), to: v((r() - 0.5) * 8, 0.45, (r() - 0.5) * 5), d: r() * 0.4 };
  });
  tag(k, wall, v(0, 3, 0), "გრიპის ვირუსი", [0]);
  // Bronchus cross-sections: normal and asthma.
  const bron = new THREE.Group();
  g.add(bron);
  const ringGeo = (inner: number) => k.track(new THREE.RingGeometry(inner, 1.8, 48, 1));
  const wallMat = k.material({ color: "#d98a8a", roughness: 0.4, side: THREE.DoubleSide, normalMap: k.normalMap("organic", [2, 2]) });
  const normal = new THREE.Mesh(ringGeo(1.1), wallMat);
  normal.position.x = -2.4;
  const asthma = new THREE.Mesh(ringGeo(1.1), wallMat);
  asthma.position.x = 2.4;
  const mucus = new THREE.Mesh(k.track(new THREE.CircleGeometry(0.5, 32)), k.material({ color: "#e8dc9a", roughness: 0.2, clearcoat: 1 }));
  mucus.position.set(2.4, -0.4, 0.01);
  bron.add(normal, asthma, mucus);
  tag(k, bron, v(-2.4, 2.3, 0), "ჯანმრთელი ბრონქი", [1]);
  const aTag = tag(k, bron, v(2.4, 2.3, 0), "ასთმა", [1]);
  // Alveoli filling with fluid; bacteria.
  const alv = new THREE.Group();
  g.add(alv);
  const sacMat = k.ghost("#f2b3b8", 0.35, { side: THREE.DoubleSide, normalMap: k.normalMap("organic", [3, 2]), sheen: 0.6, sheenColor: new THREE.Color("#fff") });
  const fluidMat = k.ghost("#9fc8e8", 0.6);
  const fills: THREE.Mesh[] = [];
  [v(0, 0, 0), v(1.8, 0.5, -0.4), v(-1.7, 0.4, -0.5), v(0.4, 1.8, -0.8), v(-0.5, -1.6, -0.6), v(1.4, -1.2, -0.4)].forEach((c) => {
    const s = new THREE.Mesh(k.sphere, sacMat);
    s.position.copy(c);
    alv.add(s);
    const f = new THREE.Mesh(k.track(new THREE.SphereGeometry(0.97, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), fluidMat);
    f.position.copy(c);
    alv.add(f);
    fills.push(f);
  });
  const bugs = Array.from({ length: 10 }, (_, j) => {
    const b = bacterium(k, "#b9a36a");
    b.g.scale.setScalar(0.12);
    b.g.position.set((r() - 0.5) * 3, (r() - 0.5) * 2, 0.9);
    b.g.rotation.z = j;
    alv.add(b.g);
    return b.g;
  });
  tag(k, alv, v(0, 2.9, 0), "ალვეოლებში სითხე — პნევმონია", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => {
        wall.visible = i === 0;
        bron.visible = i === 1;
        alv.visible = i === 2;
      },
      update: (u: number, s: number, t: number) => {
        viruses.forEach((x) => {
          const f = ease((u - x.d) / 0.5);
          x.vg.position.lerpVectors(x.from, x.to, f);
          x.vg.rotation.set(t, t * 0.7, 0);
        });
        cellMat.emissiveIntensity = i === 0 ? 0.5 * ease((u - 0.6) / 0.3) : 0;
        // Asthma: the wall thickens and the lumen narrows, then relaxes.
        const sq = i === 1 ? 0.5 - 0.5 * Math.cos(Math.min(1, u * 1.4) * Math.PI) : 0;
        asthma.geometry.dispose();
        asthma.geometry = ringGeo(1.1 - 0.75 * sq);
        mucus.scale.setScalar(0.4 + sq);
        setText(aTag, sq > 0.5 ? "ასთმა — სანათური ვიწროა" : "ასთმა");
        fills.forEach((f, j) => f.scale.set(1, Math.max(0.001, i === 2 ? ease((u - j * 0.08) / 0.5) * 1.6 : 0.001), 1));
        bugs.forEach((b, j) => (b.visible = i === 2 && u > 0.1 + j * 0.04));
        return i === 1 ? front(s, 8, v(0, 0, 0), 0.05) : orbit(v(0, 0.3, 0), i === 0 ? 9 : 7, s, { start: 0.3, speed: 0.04, height: i === 0 ? 0.55 : 0.3 });
      },
    })),
  };
};

// ---- 8 3.14 Nutrients ---------------------------------------------------------------------------------------------------

export const nutrients: Builder = async (k) => {
  await loadNatureAssets().catch(() => null);
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const hexGeo = k.track(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 6));
  // Bread → starch chain → glucose.
  const bread = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.9, 1.4, 8, 16)), k.material({ color: "#c98a4a", roughness: 0.6, normalMap: k.normalMap("organic", [3, 3]) }));
  bread.rotation.z = Math.PI / 2;
  bread.position.set(-4, 0, 0);
  // The scanned bread replaces the drawn loaf when available.
  const realBread = model("bread", 2.6);
  if (realBread) {
    // Hide the drawn loaf but keep it as the parent; the loaf is turned 90°, so its local x is world up.
    (bread.material as THREE.Material).visible = false;
    realBread.root.rotation.z = -Math.PI / 2;
    realBread.root.position.x = -0.6;
    bread.add(realBread.root);
  }
  const glu = k.material({ color: "#f4f1ea", roughness: 0.4, emissive: "#ffffff", emissiveIntensity: 0.1 });
  const chain = Array.from({ length: 12 }, () => {
    const h = new THREE.Mesh(hexGeo, glu);
    h.rotation.x = Math.PI / 2;
    g.add(h);
    return h;
  });
  // Meat → protein (folded chain of coloured beads) → amino acids.
  const meat = new THREE.Mesh(k.sphere, k.material({ color: "#a8463a", roughness: 0.5, clearcoat: 0.4, normalMap: k.normalMap("fibre", [2, 2]) }));
  meat.scale.set(1.3, 0.45, 0.9);
  meat.position.set(-4, 0, 0);
  const aaCols = ["#e8564a", "#3b82c4", "#4bb36b", "#f2c230", "#a46be0"].map((c) => k.material({ color: c, roughness: 0.4 }));
  const aminos = Array.from({ length: 16 }, (_, i) => {
    const a = new THREE.Mesh(k.sphere, aaCols[i % 5]);
    a.scale.setScalar(0.22);
    g.add(a);
    return a;
  });
  // Oil → glycerol + fatty acids; vitamins, minerals, water.
  const oil = new THREE.Mesh(k.sphere, k.ghost("#e8c43a", 0.7, { roughness: 0.05, clearcoat: 1 }));
  oil.scale.setScalar(0.9);
  oil.position.set(-4, 0, 0);
  const glycerol = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.25, 1.4, 0.25)), k.material({ color: "#8ac8e8" }));
  const fatty = [0, 1, 2].map(() => {
    const f = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6).rotateZ(Math.PI / 2)), k.material({ color: "#e8c43a" }));
    g.add(f);
    return f;
  });
  g.add(bread, meat, oil, glycerol);
  const extras = [
    ...Array.from({ length: 4 }, (_, i) => ({ m: new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.12, 0.25, 4, 8)), k.material({ color: ["#f08a2a", "#e0524a", "#4bb36b", "#f2c230"][i] })), p: v(2 + i * 0.6, -1.8, 0) })),
    ...Array.from({ length: 4 }, (_, i) => ({ m: new THREE.Mesh(k.track(new THREE.OctahedronGeometry(0.18)), k.material({ color: "#c9ccd0", metalness: 0.6, roughness: 0.3 })), p: v(2 + i * 0.6, -2.5, 0) })),
    ...Array.from({ length: 4 }, (_, i) => ({ m: new THREE.Mesh(k.sphere, k.ghost("#6fb0e0", 0.7, { roughness: 0.05, clearcoat: 1 })), p: v(2 + i * 0.6, -3.2, 0) })),
  ];
  extras.forEach((x) => {
    x.m.position.copy(x.p);
    if (x.m.geometry === k.sphere) x.m.scale.setScalar(0.18);
    g.add(x.m);
  });
  const titles = ["პური → სახამებელი → გლუკოზა", "ხორცი → ცილა → ამინომჟავები", "ზეთი → გლიცერინი + ცხიმოვანი მჟავები"];
  const head = tag(k, g, v(0, 2.6, 0), "");
  tag(k, g, v(4.6, -1.8, 0), "ვიტამინები", [2]);
  tag(k, g, v(4.6, -2.5, 0), "მინერალები", [2]);
  tag(k, g, v(4.6, -3.2, 0), "წყალი", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        bread.visible = i === 0;
        meat.visible = i === 1;
        oil.visible = glycerol.visible = i === 2;
        fatty.forEach((f) => (f.visible = i === 2));
        extras.forEach((x) => (x.m.visible = i === 2));
        const split = ease((u - 0.45) / 0.35);
        chain.forEach((h, j) => {
          h.visible = i === 0 && u > 0.15;
          const chainPos = v(-1 + j * 0.42, Math.sin(j * 0.8) * 0.2, 0);
          const free = v(-1 + (j % 6) * 0.9 + Math.sin(t + j) * 0.1, (Math.floor(j / 6) - 0.5) * 1.2 + Math.cos(t * 0.8 + j) * 0.1, 0);
          h.position.lerpVectors(chainPos, free, split);
        });
        aminos.forEach((a, j) => {
          a.visible = i === 1 && u > 0.15;
          const ang = j * 0.7;
          const folded = v(1 + Math.cos(ang) * 1.1, Math.sin(ang * 1.3) * 1.1, Math.sin(ang) * 0.6);
          const free = v(-1 + (j % 8) * 0.7, (Math.floor(j / 8) - 0.5) * 1, 0);
          a.position.lerpVectors(folded, free, split);
        });
        glycerol.position.set(0.5, 0.2, 0);
        fatty.forEach((f, j) => f.position.set(0.5 + 1.25 + split * 0.8, 0.2 + (j - 1) * 0.5, 0));
        setText(head, titles[i]);
        return front(s, 11, v(0, -0.3, 0), 0.1);
      },
    })),
  };
};

// ---- 8 3.15 Food energy ----------------------------------------------------------------------------------------------------

function foodModels(k: Kit) {
  const mk = (geo: THREE.BufferGeometry, color: string, scale: V3, extra: THREE.MeshPhysicalMaterialParameters = {}): THREE.Object3D => {
    const m = new THREE.Mesh(geo, k.material({ color, roughness: 0.5, ...extra }));
    m.scale.copy(scale);
    return m;
  };
  const real = (name: "bread" | "apple", size: number) => {
    const r = model(name, size);
    if (!r) return null;
    r.root.position.y = -size * 0.4;
    const g = new THREE.Group();
    g.add(r.root);
    return g;
  };
  return [
    { name: "ზეთი", kcal: 900, m: mk(k.track(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 24)), "#e8c43a", v(1, 1, 1), { transparent: true, opacity: 0.8, clearcoat: 1 }) },
    { name: "შაქარი", kcal: 400, m: mk(k.track(new THREE.BoxGeometry(0.7, 0.7, 0.7)), "#f8f8f8", v(1, 1, 1)) },
    { name: "პური", kcal: 250, m: real("bread", 1.1) ?? mk(k.track(new THREE.CapsuleGeometry(0.35, 0.6, 6, 12).rotateZ(Math.PI / 2)), "#c98a4a", v(1, 1, 1)) },
    { name: "ხორცი", kcal: 200, m: mk(k.sphere, "#a8463a", v(0.6, 0.25, 0.45)) },
    { name: "ვაშლი", kcal: 50, m: real("apple", 0.75) ?? mk(k.sphere, "#c0392b", v(0.4, 0.4, 0.4), { clearcoat: 1 }) },
    { name: "კიტრი", kcal: 15, m: mk(k.track(new THREE.CapsuleGeometry(0.18, 0.8, 6, 12).rotateZ(Math.PI / 2)), "#4b8a3a", v(1, 1, 1)) },
  ];
}

export const foodEnergy: Builder = async (k) => {
  await loadNatureAssets().catch(() => null);
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  // Calorimeter.
  const cal = new THREE.Group();
  g.add(cal);
  const tube = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.6, 0.6, 3, 24, 1, true)), k.ghost("#dfeff5", 0.25, { side: THREE.DoubleSide, roughness: 0.05, clearcoat: 1 }));
  tube.position.y = 1.5;
  const waterM = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.57, 0.57, 1.6, 24)), k.ghost("#6fb0e0", 0.5));
  waterM.position.y = 0.9;
  const thermo = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.05, 0.05, 1, 8).translate(0, 0.5, 0)), k.material({ color: "#e0242a", emissive: "#e0242a", emissiveIntensity: 0.4 }));
  thermo.position.set(0.2, 0.4, 0);
  const nut = new THREE.Mesh(k.sphere, k.material({ color: "#c9a06a", roughness: 0.6 }));
  nut.scale.set(0.35, 0.25, 0.25);
  nut.position.y = -1.2;
  const flames = [0, 1, 2].map((j) => {
    const f = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.2, 0.9, 10)), k.material({ color: "#ffb02e", emissive: "#ff7a00", emissiveIntensity: 1.5, transparent: true, opacity: 0.85 }));
    f.position.set((j - 1) * 0.15, -0.6, 0);
    cal.add(f);
    return f;
  });
  cal.add(tube, waterM, thermo, nut);
  const temp = tag(k, cal, v(1.4, 2.4, 0), "", [0]);
  tag(k, cal, v(-1.4, -1.2, 0), "საკვები იწვის", [0]);
  // Bars per 100 g.
  const bars = new THREE.Group();
  g.add(bars);
  const foods = foodModels(k);
  const cols = foods.map((f, i) => {
    const b = new THREE.Mesh(k.track(new THREE.BoxGeometry(0.9, 1, 0.9).translate(0, 0.5, 0)), k.material({ color: "#f2a23a", roughness: 0.5 }));
    b.position.set(-4.5 + i * 1.8, -2, 0);
    bars.add(b);
    f.m.position.set(-4.5 + i * 1.8, -2.6, 0.9);
    bars.add(f.m);
    tag(k, bars, v(-4.5 + i * 1.8, -3.2, 0.9), f.name, [1]);
    return { b, f, t: tag(k, bars, v(-4.5 + i * 1.8, -1.5, 0.6), "", [1]) };
  });
  // Composition: protein / fat / carbs / fibre per item.
  const comp = new THREE.Group();
  g.add(comp);
  const parts = [
    { name: "ტკბილი სასმელი", v: [0, 0, 10, 0] },
    { name: "ვაშლი", v: [0.3, 0.2, 12, 2.4] },
    { name: "თევზი", v: [20, 5, 0, 0] },
    { name: "ლობიო", v: [9, 0.5, 22, 7] },
  ];
  const pc = ["#e8564a", "#f2c230", "#c9a06a", "#4bb36b"].map((c) => k.material({ color: c, roughness: 0.5 }));
  parts.forEach((p, i) => {
    let y = -2;
    p.v.forEach((val, j) => {
      if (!val) return;
      const h = val * 0.15;
      const b = new THREE.Mesh(k.track(new THREE.BoxGeometry(1, h, 1)), pc[j]);
      b.position.set(-3.3 + i * 2.2, y + h / 2, 0);
      comp.add(b);
      y += h;
    });
    tag(k, comp, v(-3.3 + i * 2.2, -2.5, 0.6), p.name, [2]);
  });
  tag(k, comp, v(3.8, 2.4, 0), "■ ცილა ■ ცხიმი ■ ნახშირწყალი ■ ბოჭკო", [2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (u: number, s: number, t: number) => {
        cal.visible = i === 0;
        bars.visible = i === 1;
        comp.visible = i === 2;
        flames.forEach((f, j) => f.scale.set(1, 0.8 + 0.3 * Math.sin(t * 12 + j), 1));
        thermo.scale.y = 0.5 + 2.2 * ease(u / 0.9);
        nut.scale.setScalar(0.35 * (1 - 0.6 * ease(u)));
        setText(temp, `${(20 + 30 * ease(u / 0.9)).toFixed(0)} °C`);
        cols.forEach((c, j) => {
          const h = ease(u * 1.4 - j * 0.08) * c.f.kcal * 0.0055;
          c.b.scale.y = Math.max(0.01, h);
          c.f.m.rotation.y = t * 0.5;
          setText(c.t, `${Math.round(c.f.kcal * ease(u * 1.4 - j * 0.08))} კკალ`);
        });
        return front(s, i === 0 ? 7 : 12, v(i === 0 ? 0 : 0, i === 0 ? 0.6 : 0, 0), 0.1);
      },
    })),
  };
};

// ---- 8 3.20 Gut disease ------------------------------------------------------------------------------------------------------

export const gutDisease: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(12);
  // Food with bacteria multiplying.
  const food = new THREE.Group();
  g.add(food);
  const plate = new THREE.Mesh(k.track(new THREE.CylinderGeometry(2.6, 2.2, 0.2, 48)), k.material({ color: "#f4f4f2", roughness: 0.3, clearcoat: 1 }));
  const meat = new THREE.Mesh(k.sphere, k.material({ color: "#b06a4a", roughness: 0.6, normalMap: k.normalMap("fibre", [2, 2]) }));
  meat.scale.set(1.6, 0.45, 1.1);
  meat.position.y = 0.4;
  food.add(plate, meat);
  const bacGeo = k.track(new THREE.CapsuleGeometry(0.05, 0.15, 3, 6));
  const bac = new THREE.InstancedMesh(bacGeo, k.material({ color: "#6fbf5a", emissive: "#6fbf5a", emissiveIntensity: 0.4 }), 300);
  food.add(bac);
  const bacPos = Array.from({ length: 300 }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    return v(Math.cos(a) * d * 1.5, 0.4 + 0.42 * Math.sqrt(Math.max(0, 1 - d * d)), Math.sin(a) * d * 1.0);
  });
  const ft = tag(k, food, v(0, 1.6, 0), "", [0]);
  // Stomach wall with an ulcer.
  const wall = new THREE.Group();
  g.add(wall);
  const layers = [
    { c: "#e8dc9a", h: 0.3, y: 0.45, t: "ლორწო" },
    { c: "#d97a7a", h: 0.6, y: 0, t: "ლორწოვანი გარსი" },
    { c: "#b5524a", h: 0.8, y: -0.7, t: "კუნთოვანი შრე" },
  ];
  layers.forEach((x) => {
    const b = new THREE.Mesh(k.track(new THREE.BoxGeometry(8, x.h, 3)), k.material({ color: x.c, roughness: 0.4, clearcoat: 0.4, normalMap: k.normalMap("organic", [4, 2]), transparent: x.t === "ლორწო", opacity: 0.7 }));
    b.position.y = x.y;
    wall.add(b);
    tag(k, wall, v(-4.6, x.y, 1.6), x.t, [1]);
  });
  const crater = new THREE.Mesh(k.track(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2)), k.material({ color: "#7a1f22", roughness: 0.6, side: THREE.BackSide }));
  crater.rotation.x = Math.PI;
  crater.position.y = 0.6;
  wall.add(crater);
  const acid = beads(k, wall, curve([v(-3, 3, 0), v(-1, 2, 0.3), v(0.2, 0.9, 0)]), { n: 20, color: "#f2e24a", size: 0.1, speed: 0.15, spread: 1.2, emissive: 0.6 });
  const pylori = Array.from({ length: 8 }, (_, j) => {
    const pts: V3[] = [];
    for (let q = 0; q < 16; q++) pts.push(v(q * 0.04, Math.sin(q * 0.9) * 0.05, Math.cos(q * 0.9) * 0.05));
    const m = new THREE.Mesh(k.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.025, 6)), k.material({ color: "#6fbf5a" }));
    m.position.set((r() - 0.5) * 2, 0.62, (r() - 0.5) * 1.5);
    m.rotation.y = j;
    wall.add(m);
    return m;
  });
  tag(k, wall, v(0, 1.6, 0), "მჟავა", [1]);
  const ut = tag(k, wall, v(0, -0.2, 1.7), "", [1]);
  // Hand washing.
  const hand = new THREE.Group();
  g.add(hand);
  const skin = k.material({ color: "#e8b79e", roughness: 0.55, sheen: 0.5, sheenColor: new THREE.Color("#fff") });
  const palm = new THREE.Mesh(k.track(new THREE.BoxGeometry(2, 0.5, 2.2)), skin);
  hand.add(palm);
  for (let f = 0; f < 5; f++) {
    const fg = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.17, f === 0 ? 0.7 : 1.1, 4, 10)), skin);
    fg.rotation.x = Math.PI / 2;
    fg.position.set(f === 0 ? 1.2 : -0.75 + (f - 1) * 0.5, 0, f === 0 ? 0.3 : 1.7);
    if (f === 0) fg.rotation.z = 0.8;
    hand.add(fg);
  }
  const germs = new THREE.InstancedMesh(bacGeo, k.material({ color: "#6fbf5a", emissive: "#6fbf5a", emissiveIntensity: 0.5 }), 80);
  const germPos = Array.from({ length: 80 }, () => v((r() - 0.5) * 2, 0.27, (r() - 0.5) * 3.2));
  hand.add(germs);
  const bubbles = Array.from({ length: 30 }, () => {
    const b = new THREE.Mesh(k.sphere, k.ghost("#ffffff", 0.45, { roughness: 0.05, clearcoat: 1, iridescence: 1 }));
    b.scale.setScalar(0.1 + r() * 0.15);
    b.position.set((r() - 0.5) * 2.2, 0.35 + r() * 0.3, (r() - 0.5) * 3);
    hand.add(b);
    return b;
  });
  const ht = tag(k, hand, v(0, 1.6, 0), "", [2]);
  const m4 = new THREE.Matrix4();
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: true,
      enter: () => {
        food.visible = i === 0;
        wall.visible = i === 1;
        hand.visible = i === 2;
      },
      update: (u: number, s: number, t: number) => {
        if (i === 0) {
          const n = Math.floor(10 * Math.pow(30, ease(u)));
          bacPos.forEach((p, j) => {
            m4.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, j, Math.PI / 2)), v(1, 1, 1).multiplyScalar(j < n ? 1 : 0));
            bac.setMatrixAt(j, m4);
          });
          bac.instanceMatrix.needsUpdate = true;
          setText(ft, `სითბოში ბაქტერიები მრავლდება: ${Math.min(300, n)}`);
        }
        if (i === 1) {
          acid.update(t);
          const ulcer = ease((u - 0.3) / 0.5);
          crater.scale.set(0.9 * ulcer + 0.001, 0.7 * ulcer + 0.001, 0.9 * ulcer + 0.001);
            pylori.forEach((p, j) => (p.rotation.x = t * 3 + j));
          setText(ut, ulcer < 0.4 ? "ლორწო კედელს მჟავისგან იცავს" : "დაცვა დაირღვა — წყლული");
        }
        if (i === 2) {
          const wash = ease((u - 0.25) / 0.5);
          germPos.forEach((p, j) => {
            const gone = j / germPos.length < wash;
            m4.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, j, 0)), v(1, 1, 1).multiplyScalar(gone ? 0 : 1.6));
            germs.setMatrixAt(j, m4);
          });
          germs.instanceMatrix.needsUpdate = true;
          bubbles.forEach((b, j) => (b.visible = u > 0.2 && u < 0.85 && j < 30 * ease((u - 0.2) / 0.2)));
          setText(ht, wash < 0.1 ? "ხელზე მიკრობებია" : wash < 0.95 ? "საპონი და წყალი — 20 წამი" : "სუფთა ხელები");
        }
        return orbit(v(0, 0.4, 0.3), 7.5, s, { start: 0.3, speed: 0.03, height: 0.55 });
      },
    })),
  };
};

// ---- 8 4.3 Healthy plate ------------------------------------------------------------------------------------------------------

export const healthyPlate: Builder = async (k) => {
  k.mood("#e7eef0", 20, 50);
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(3);
  const plateG = new THREE.Group();
  g.add(plateG);
  const plate = new THREE.Mesh(k.track(new THREE.CylinderGeometry(3, 2.6, 0.25, 64)), k.material({ color: "#fafafa", roughness: 0.25, clearcoat: 1 }));
  plateG.add(plate);
  const piece = (color: string, ang0: number, ang1: number, n: number, geo: THREE.BufferGeometry, scale: number) => {
    const mat = k.material({ color, roughness: 0.5, clearcoat: 0.3 });
    for (let i = 0; i < n; i++) {
      const a = ang0 + r() * (ang1 - ang0);
      const d = 0.4 + r() * 2;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(a) * d, 0.25, Math.sin(a) * d);
      m.rotation.set(r() * 3, r() * 3, r() * 3);
      m.scale.setScalar(scale * (0.7 + r() * 0.6));
      plateG.add(m);
    }
  };
  piece("#4b8a3a", 0, Math.PI * 0.6, 25, k.sphere, 0.22);
  piece("#d9462a", Math.PI * 0.6, Math.PI, 14, k.sphere, 0.2);
  piece("#c9a06a", Math.PI, Math.PI * 1.5, 30, k.track(new THREE.CapsuleGeometry(0.05, 0.2, 3, 6)), 1);
  piece("#e8a07a", Math.PI * 1.5, Math.PI * 2, 4, k.sphere, 0.45);
  const glass = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.6, 0.5, 2, 24)), k.ghost("#bfe0f0", 0.35, { roughness: 0.05, clearcoat: 1 }));
  glass.position.set(3.8, 1, -1);
  plateG.add(glass);
  tag(k, plateG, v(1, 0.9, 1.2), "½ ბოსტნეული და ხილი", [0]);
  tag(k, plateG, v(-1.2, 0.9, -1), "¼ მარცვლეული", [0]);
  tag(k, plateG, v(1.2, 0.9, -1.6), "¼ ცილა", [0]);
  tag(k, plateG, v(3.8, 2.4, -1), "წყალი", [0]);
  // Balance.
  const bal = new THREE.Group();
  g.add(bal);
  const metal = k.material({ color: "#b9bec4", metalness: 0.7, roughness: 0.3 });
  const post = new THREE.Mesh(k.cylinder, metal);
  post.scale.set(0.12, 3, 0.12);
  post.position.y = 1.5;
  const beam = new THREE.Group();
  beam.position.y = 3;
  const bar = new THREE.Mesh(k.track(new THREE.BoxGeometry(6, 0.15, 0.2)), metal);
  beam.add(bar);
  const pans = [-3, 3].map((x) => {
    const pan = new THREE.Group();
    pan.position.x = x;
    const dish = new THREE.Mesh(k.track(new THREE.CylinderGeometry(1, 0.8, 0.12, 32)), metal);
    dish.position.y = -1.4;
    const string = new THREE.Mesh(k.cylinder, metal);
    string.scale.set(0.02, 1.4, 0.02);
    string.position.y = -0.7;
    pan.add(dish, string);
    beam.add(pan);
    return pan;
  });
  bal.add(post, beam);
  const intake = Array.from({ length: 6 }, (_, i) => {
    const m = new THREE.Mesh(k.sphere, k.material({ color: ["#c98a4a", "#e8c43a", "#c0392b", "#a8463a", "#f8f8f8", "#4b8a3a"][i] }));
    m.scale.setScalar(0.25);
    m.position.set((i % 3 - 1) * 0.5, -1.15 + Math.floor(i / 3) * 0.4, 0);
    pans[0].add(m);
    return m;
  });
  const shoe = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(0.25, 0.7, 4, 12).rotateZ(Math.PI / 2)), k.material({ color: "#3f7fd0" }));
  shoe.position.y = -1.1;
  pans[1].add(shoe);
  tag(k, bal, v(-3, 3.8, 0), "მიღებული ენერგია", [1, 2]);
  tag(k, bal, v(3, 3.8, 0), "დახარჯული ენერგია", [1, 2]);
  const bt = tag(k, bal, v(0, 4.6, 0), "", [1, 2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      cut: i === 1,
      enter: () => {
        plateG.visible = i === 0;
        bal.visible = i > 0;
      },
      update: (u: number, s: number) => {
        let tilt = 0;
        if (i === 1) tilt = 0;
        if (i === 2) tilt = u < 0.5 ? -0.25 * ease(u / 0.3) : 0.25 * ease((u - 0.5) / 0.3);
        beam.rotation.z = -tilt;
        pans.forEach((p) => (p.rotation.z = tilt));
        intake.forEach((m, j) => (m.visible = i === 1 ? j < 4 : u < 0.5 ? true : j < 2));
        setText(bt, i === 1 ? "ბალანსი — წონა არ იცვლება" : u < 0.5 ? "ჭარბი კვება → სიმსუქნე" : "ნაკლები კვება → წონის კლება, დაღლილობა");
        return i === 0 ? orbit(v(0.5, 0, 0), 9, s, { start: 0.2, speed: 0.04, height: 0.75 }) : front(s, 11, v(0, 2.2, 0), 0.1);
      },
    })),
  };
};

// ---- 8 3.21 Exchange with the environment ----------------------------------------------------------------------------------

export const metabolismExchange: Builder = async (k) => {
  const body = await k.body({ organs: true });
  k.mood("#0e1416", 3, 8);
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.1, 0.12);
  layer(k, body, g, (p) => p.group === "lungs", k.ghost("#e8a0a4", 0.45), 2);
  layer(k, body, g, (p) => p.group === "digestive" && /stomach|colon|ileum|jejunum|duodenum|esophagus/i.test(p.name), k.ghost("#d9a38f", 0.4), 2);
  layer(k, body, g, (p) => p.group === "urinary", k.material({ color: "#9c4a3a", roughness: 0.45 }), 1);
  const mouth = v(0, 1.53, 0.07);
  const ins = [
    beads(k, g, curve([v(0, 1.6, 0.4), mouth, v(0, 1.45, -0.004), v(-0.05, 1.32, 0)]), { n: 18, color: "#6fb0e0", size: 0.005, speed: 0.15, seed: 1 }),
    beads(k, g, curve([v(0.1, 1.55, 0.4), mouth, v(0.005, 1.4, -0.01), v(0.04, 1.18, 0.04)]), { n: 14, color: "#e8a03a", size: 0.006, speed: 0.12, seed: 2 }),
  ];
  const outs = [
    beads(k, g, curve([v(0.05, 1.32, 0), v(0, 1.45, -0.004), mouth, v(-0.1, 1.6, 0.4)]), { n: 18, color: "#8d8d8d", size: 0.005, speed: 0.15, seed: 3 }),
    beads(k, g, curve([v(-0.054, 1.1, -0.008), v(-0.04, 1.0, 0.0), v(0.002, 0.9, 0.0), v(0, 0.8, 0.04)]), { n: 14, color: "#f2d36b", size: 0.005, speed: 0.12, seed: 4 }),
  ];
  const sweat = flow(k, g, { n: 40, color: "#bfe0f0", size: 0.004, period: 3, from: (i) => v(Math.sin(i) * 0.14, 1.0 + (i % 10) * 0.05, 0.1), to: (i) => v(Math.sin(i) * 0.2, 1.05 + (i % 10) * 0.05, 0.2), seed: 5 });
  const heat = flow(k, g, { n: 30, color: "#e0524a", size: 0.006, period: 4, from: (i) => v(Math.cos(i * 2) * 0.12, 0.9 + (i % 8) * 0.09, Math.sin(i * 2) * 0.08), to: (i) => v(Math.cos(i * 2) * 0.35, 0.95 + (i % 8) * 0.09, Math.sin(i * 2) * 0.3), seed: 6 });
  L(k, g, v(-0.1, 1.62, 0.3), "O₂ — ჰაერიდან", [0]);
  L(k, g, v(0.12, 1.55, 0.3), "საკვები და წყალი", [0]);
  L(k, g, v(-0.12, 1.6, 0.3), "CO₂ და წყლის ორთქლი", [2]);
  L(k, g, v(0.0, 0.85, 0.06), "შარდი — შარდოვანა, წყალი", [2]);
  L(k, g, v(0.2, 1.15, 0.2), "ოფლი", [2]);
  L(k, g, v(-0.3, 1.0, 0.2), "სითბო", [2]);
  // A cell: glucose + O₂ in, CO₂ + water out, energy (ATP) glowing.
  const cellG = new THREE.Group();
  k.root.add(cellG);
  const cell = new THREE.Mesh(k.track(new THREE.SphereGeometry(3, 48, 32, 0, Math.PI * 1.5)), k.material({ color: "#e8b0a8", roughness: 0.4, side: THREE.DoubleSide, normalMap: k.normalMap("organic", [4, 3]), clearcoat: 0.4 }));
  cell.rotation.y = Math.PI * 0.75;
  const mito = new THREE.Mesh(k.sphere, k.material({ color: "#e48c3f", roughness: 0.4, clearcoat: 0.5, emissive: "#ffb000", emissiveIntensity: 0.2 }));
  mito.scale.set(1, 0.45, 0.45);
  cellG.add(cell, mito);
  const inC = [beads(k, cellG, curve([v(-6, 2, 2), v(-2.5, 1, 1.5), v(0, 0, 0)]), { n: 12, color: "#f4f1ea", size: 0.15, speed: 0.15, seed: 7 }), beads(k, cellG, curve([v(-6, -1, 2), v(-2.5, -0.5, 1.5), v(0, 0, 0)]), { n: 12, color: "#6fb0e0", size: 0.13, speed: 0.15, seed: 8 })];
  const outC = [beads(k, cellG, curve([v(0, 0, 0), v(2.5, 1, 1.5), v(6, 2, 2)]), { n: 12, color: "#8d8d8d", size: 0.13, speed: 0.15, seed: 9 }), beads(k, cellG, curve([v(0, 0, 0), v(2.5, -1, 1.5), v(6, -1.5, 2)]), { n: 12, color: "#9fd0f0", size: 0.12, speed: 0.15, seed: 10 })];
  const atp = flow(k, cellG, { n: 20, color: "#ffd23f", size: 0.1, period: 2, from: () => v(0, 0, 0), to: (i) => v(Math.cos(i) * 2, Math.sin(i * 1.7) * 1.6, Math.sin(i) * 1.5), seed: 11, emissive: 1.5 });
  tag(k, cellG, v(-5, 2.6, 2), "გლუკოზა", [1]);
  tag(k, cellG, v(-5, -0.4, 2), "O₂", [1]);
  tag(k, cellG, v(5, 2.6, 2), "CO₂", [1]);
  tag(k, cellG, v(5, -1, 2), "H₂O", [1]);
  tag(k, cellG, v(0, 0.9, 0.5), "მიტოქონდრია: ენერგია (ატფ)", [1]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      cut: true,
      enter: () => {
        g.visible = i !== 1;
        cellG.visible = i === 1;
        k.mood(i === 1 ? "#140b0d" : "#0e1416", i === 1 ? 9 : 3, i === 1 ? 26 : 8);
      },
      update: (_u: number, s: number, t: number) => {
        ins.forEach((b) => b.update(t, i === 0 ? 1 : 0));
        outs.forEach((b) => b.update(t, i === 2 ? 1 : 0));
        sweat.update(i === 2 ? t : 0);
        heat.update(i === 2 ? t : 0);
        sweat.mesh.visible = heat.mesh.visible = i === 2;
        inC.forEach((b) => b.update(t));
        outC.forEach((b) => b.update(t));
        atp.update(t);
        return i === 1 ? orbit(v(0, 0, 0), 12, s, { start: -0.2, speed: 0.03, height: 0.2 }) : orbit(v(0, 1.2, 0.02), 1.5, s, { start: 0.3, speed: 0.03, height: 0.05 });
      },
    })),
  };
};

// ---- 8 3.23 Nephron --------------------------------------------------------------------------------------------------------

export const nephron: Builder = async (k) => {
  k.mood("#160c0e", 12, 32);
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(5);
  // Glomerulus: a ball of capillary loops in a cup (Bowman's capsule).
  const capMat = k.material({ color: "#c62f36", roughness: 0.35, clearcoat: 0.6 });
  const G0 = v(-5, 3, 0);
  for (let i = 0; i < 8; i++) {
    const pts: V3[] = [];
    for (let j = 0; j < 10; j++) pts.push(G0.clone().add(v(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(1.6)));
    k.tube(pts, 0.1, capMat, g, 40, 6);
  }
  const cup = new THREE.Mesh(k.track(new THREE.SphereGeometry(1.4, 32, 24, 0, Math.PI * 2, 0.6, Math.PI - 0.6)), k.ghost("#e8c0b0", 0.4, { side: THREE.DoubleSide }));
  cup.position.copy(G0);
  g.add(cup);
  // The tubule: convoluted part, loop of Henle, distal part, collecting duct.
  const tubPts = [G0.clone().add(v(0.5, -1.3, 0)), v(-3.5, 1, 0.5), v(-2.5, 2, -0.5), v(-1.5, 1, 0.6), v(-0.5, 1.8, -0.4), v(0.3, 0.8, 0), v(0.4, -3, 0), v(0.8, -5.5, 0), v(1.3, -3, 0), v(1.5, 1, 0), v(2.5, 2, 0.5), v(3.4, 1.2, -0.5), v(4.2, 2.2, 0), v(5, 1.5, 0)];
  const tub = k.tube(tubPts, 0.32, k.ghost("#e8d2a0", 0.55, { normalMap: k.normalMap("organic", [20, 1]) }), g, 240, 12);
  const duct = k.tube([v(5, 3, 0), v(5.2, 0, 0), v(5.4, -4, 0), v(5.5, -6.5, 0)], 0.45, k.ghost("#e8d2a0", 0.5), g, 40, 12);
  // Filtration, then most of it back to the blood.
  const filt = beads(k, g, tub.curve, { n: 60, color: "#f2d36b", size: 0.12, speed: 0.06, seed: 1 });
  const back = Array.from({ length: 5 }, (_, i) => {
    const from = tub.curve.getPointAt(0.12 + i * 0.16);
    return beads(k, g, curve([from, from.clone().add(v(0, 0.8, 1)), from.clone().add(v(0, 1.2, 2))]), { n: 8, color: "#6fb0e0", size: 0.12, speed: 0.25, seed: 10 + i });
  });
  const urine = beads(k, g, duct.curve, { n: 14, color: "#f2c230", size: 0.14, speed: 0.08, seed: 30 });
  const jar = new THREE.Mesh(k.track(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 24)), k.ghost("#f2e08a", 0.75, { roughness: 0.05, clearcoat: 1 }));
  jar.position.set(7.4, -5.5, 0);
  g.add(jar);
  L(k, g, G0.clone().add(v(0, 1.8, 0)), "გორგალი და კაფსულა", [0]);
  L(k, g, v(-2, 2.6, 0), "მილაკი", [0, 1]);
  L(k, g, v(0.8, -5.6, 0.6), "ჰენლეს მარყუჟი", [1]);
  L(k, g, v(5.6, -2, 0.6), "შემკრები მილი", [1, 2]);
  const bt = tag(k, g, v(0, 4.8, 0), "", [1, 2]);
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        filt.update(t);
        back.forEach((b) => b.update(t, i >= 1 ? 1 : 0));
        urine.update(t, i >= 1 ? (i === 2 ? (u < 0.5 ? 0.3 : 1) : 0.5) : 0);
        const conc = i === 2 ? (u < 0.5 ? 1 : 0) : 0.5;
        (jar.material as THREE.MeshPhysicalMaterial).color.set(conc > 0.7 ? "#d9a020" : conc < 0.3 ? "#f6eebc" : "#f2e08a");
        jar.scale.y = i === 2 ? (u < 0.5 ? 0.5 : 1.3) : 1;
        setText(bt, i === 1 ? "≈ 99% წყლისა სისხლში ბრუნდება" : u < 0.5 ? "ცოტა დავლიეთ: შარდი ცოტა და მუქი" : "ბევრი დავლიეთ: შარდი ბევრი და ღია");
        return orbit(v(1, -1, 0), 21, s, { start: 0.1, speed: 0.02, height: 0.15 });
      },
    })),
  };
};

// ---- 8 3.24 Skin -----------------------------------------------------------------------------------------------------------

export const skinSection: Builder = async (k) => {
  k.mood("#160e0c", 14, 34);
  const g = new THREE.Group();
  k.root.add(g);
  const r = rng(8);
  const W = 8;
  const D = 4;
  const epi = new THREE.Mesh(k.track(new THREE.BoxGeometry(W, 0.4, D)), k.material({ color: "#e8b79e", roughness: 0.6, normalMap: k.normalMap("organic", [6, 3]) }));
  epi.position.y = 2.2;
  const derm = new THREE.Mesh(k.track(new THREE.BoxGeometry(W, 2.4, D)), k.material({ color: "#e89a90", roughness: 0.5, transparent: true, opacity: 0.55, depthWrite: false, normalMap: k.normalMap("fibre", [4, 2]) }));
  derm.position.y = 0.8;
  const hypo = new THREE.Mesh(k.track(new THREE.BoxGeometry(W, 1.6, D)), k.material({ color: "#f2d98a", roughness: 0.5, transparent: true, opacity: 0.35, depthWrite: false }));
  hypo.position.y = -1.2;
  g.add(epi, derm, hypo);
  const fatMat = k.material({ color: "#f2d36b", roughness: 0.3, clearcoat: 0.8 });
  for (let i = 0; i < 40; i++) {
    const f = new THREE.Mesh(k.sphere, fatMat);
    f.position.set((r() - 0.5) * W * 0.9, -1.2 + (r() - 0.5) * 1.2, (r() - 0.5) * D * 0.8);
    f.scale.setScalar(0.25 + r() * 0.15);
    g.add(f);
  }
  // Hair follicles with hairs.
  for (const x of [-2.8, 1.8]) {
    k.tube([v(x, -0.4, 0), v(x + 0.2, 1, 0), v(x + 0.4, 2.4, 0)], 0.18, k.material({ color: "#c9806a", roughness: 0.5 }), g, 20, 10);
    k.tube([v(x, -0.3, 0), v(x + 0.4, 2.4, 0), v(x + 0.9, 4.2, 0)], 0.04, k.material({ color: "#3a2a20", roughness: 0.5 }), g, 20, 6);
  }
  // Sweat gland: a coil deep in the dermis and a duct to the surface.
  const coil: V3[] = [];
  for (let i = 0; i <= 40; i++) coil.push(v(-0.4 + Math.cos(i * 0.6) * 0.45, -0.6 + i * 0.012, Math.sin(i * 0.6) * 0.45));
  coil.push(v(-0.3, 0.5, 0), v(-0.2, 1.6, 0), v(-0.1, 2.42, 0));
  const gland = k.tube(coil, 0.1, k.material({ color: "#8ac0e0", roughness: 0.3, clearcoat: 0.6 }), g, 200, 8);
  const sweat = beads(k, g, gland.curve, { n: 20, color: "#bfe0f0", size: 0.09, speed: 0.12, emissive: 0.4 });
  const drops = Array.from({ length: 10 }, (_, i) => {
    const d = new THREE.Mesh(k.sphere, k.ghost("#bfe0f0", 0.7, { roughness: 0.05, clearcoat: 1 }));
    d.position.set(-0.1 + (i - 5) * 0.55, 2.5, (r() - 0.5) * 2);
    d.scale.set(0.15, 0.1, 0.15);
    g.add(d);
    return d;
  });
  // Vessels that widen in heat.
  const art = k.tube([v(-W / 2, 0.3, 1), v(-1, 0.6, 1.2), v(1, 0.4, 1), v(W / 2, 0.7, 1.1)], 1, k.material({ color: "#c62f36", roughness: 0.35, clearcoat: 0.6, emissive: "#ff3b2f", emissiveIntensity: 0 }), g, 48, 10);
  const vein = k.tube([v(-W / 2, 0.1, -1), v(-1, 0.3, -1.2), v(1, 0.2, -1), v(W / 2, 0.4, -1.1)], 1, k.material({ color: "#3d5fb0", roughness: 0.35 }), g, 48, 10);
  const steam = flow(k, g, { n: 24, color: "#ffffff", size: 0.08, period: 3, from: (i) => v(-3 + (i % 12) * 0.5, 2.5, ((i * 7) % 5) - 2), to: (i) => v(-3 + (i % 12) * 0.5, 4.5, ((i * 7) % 5) - 2), seed: 2, emissive: 0.6 });
  L(k, g, v(-W / 2 + 0.3, 2.4, D / 2), "ეპიდერმისი", [0]);
  L(k, g, v(-W / 2 + 0.3, 0.9, D / 2), "დერმა", [0]);
  L(k, g, v(-W / 2 + 0.3, -1.2, D / 2), "კანქვეშა ცხიმი", [0]);
  L(k, g, v(-2.4, 1.2, 0.3), "თმის ბოლქვი", [0]);
  L(k, g, v(-0.4, -0.6, 0.6), "ოფლის ჯირკვალი", [0, 1]);
  L(k, g, v(1, 0.5, 1.4), "სისხლძარღვები", [0, 2]);
  const ht = tag(k, g, v(0, 4.8, 0), "", [2]);
  const setVessel = (m: THREE.Mesh, curveObj: THREE.CatmullRomCurve3, rad: number) => {
    m.geometry.dispose();
    m.geometry = new THREE.TubeGeometry(curveObj, 48, rad, 10);
  };
  let lastRad = -1;
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 16,
      update: (u: number, s: number, t: number) => {
        sweat.update(t, i >= 1 ? 1 : 0);
        drops.forEach((d, j) => (d.visible = i >= 1 && u > 0.2 + j * 0.04 && !(i === 2 && u > 0.6)));
        const hot = i === 2 ? (u < 0.6 ? 1 : 0) : 0.5;
        const rad = 0.1 + 0.12 * hot;
        if (Math.abs(rad - lastRad) > 0.005) {
          setVessel(art.mesh, art.curve, rad);
          setVessel(vein.mesh, vein.curve, rad * 1.1);
          lastRad = rad;
        }
        (art.mesh.material as THREE.MeshPhysicalMaterial).emissiveIntensity = i === 2 && u < 0.6 ? 0.4 : 0;
        steam.update(i === 2 && u < 0.6 ? t : 0);
        steam.mesh.visible = i === 2 && u < 0.6;
        setText(ht, u < 0.6 ? "სიცხე: სისხლძარღვები ფართოვდება, ოფლი ორთქლდება" : "სიცივე: სისხლძარღვები ვიწროვდება");
        return orbit(v(0, 0.6, 0), 11, s, { start: 0.35, speed: 0.03, height: 0.3 });
      },
    })),
  };
};

// ---- 12 Excretion in animals --------------------------------------------------------------------------------------------------

export const animalExcretion: Builder = async (k) => {
  lab(k);
  const g = new THREE.Group();
  k.root.add(g);
  // Flatworm with branching tubules and flickering flame cells.
  const flat = new THREE.Group();
  const fw = new THREE.Mesh(k.sphere, k.ghost("#d9c8b0", 0.55, { roughness: 0.3, clearcoat: 0.6 }));
  fw.scale.set(1.2, 0.15, 3);
  flat.add(fw);
  const flames: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const pts = [v(s * 0.5, 0, -2.4), v(s * 0.7, 0, -1), v(s * 0.6, 0, 0.5), v(s * 0.5, 0, 2.2)];
    k.tube(pts, 0.04, k.material({ color: "#5b8def" }), flat, 30, 6);
    for (let j = 0; j < 6; j++) {
      const f = new THREE.Mesh(k.sphere, k.material({ color: "#f2c230", emissive: "#ffb000", emissiveIntensity: 1 }));
      f.scale.setScalar(0.08);
      f.position.set(s * 0.95, 0.05, -2 + j * 0.8);
      flat.add(f);
      flames.push(f);
    }
  }
  flat.position.set(-6, 0, 0);
  g.add(flat);
  // Earthworm with a pair of nephridia per segment.
  const worm = new THREE.Group();
  const segMat = k.ghost("#c47a7a", 0.5, { roughness: 0.3, clearcoat: 0.9 });
  for (let i = 0; i < 12; i++) {
    const sgm = new THREE.Mesh(k.sphere, segMat);
    sgm.scale.set(0.35, 0.35, 0.3);
    sgm.position.z = -2.4 + i * 0.44;
    worm.add(sgm);
    for (const s of [-1, 1]) {
      const n = new THREE.Mesh(k.track(new THREE.TorusKnotGeometry(0.08, 0.02, 32, 5, 2, 3)), k.material({ color: "#5b8def" }));
      n.position.set(s * 0.18, 0, -2.4 + i * 0.44);
      worm.add(n);
    }
  }
  worm.position.set(-2, 0, 0);
  g.add(worm);
  // Insect: Malpighian tubules into the gut.
  const ins = new THREE.Group();
  const shell = new THREE.Mesh(k.sphere, k.ghost("#2e4a6a", 0.35, { clearcoat: 1 }));
  shell.scale.set(0.9, 0.6, 1.8);
  ins.add(shell);
  const gut = k.tube([v(0, 0, -1.6), v(0, 0.1, 0), v(0, 0, 1.6)], 0.12, k.material({ color: "#c9a06a" }), ins, 20, 8);
  void gut;
  for (let j = 0; j < 8; j++) {
    const a = (j / 8) * Math.PI * 2;
    k.tube([v(0, 0, 0.2), v(Math.cos(a) * 0.5, Math.sin(a) * 0.3, 0.4), v(Math.cos(a) * 0.7, Math.sin(a) * 0.4, -0.8)], 0.03, k.material({ color: "#f2c230" }), ins, 16, 5);
  }
  ins.position.set(2, 0, 0);
  g.add(ins);
  // Vertebrate kidney.
  const kid = new THREE.Group();
  for (const s of [-1, 1]) {
    const bean = new THREE.Mesh(k.sphere, k.material({ color: "#9c4a3a", roughness: 0.4, clearcoat: 0.5, normalMap: k.normalMap("organic", [2, 2]) }));
    bean.scale.set(0.5, 0.9, 0.35);
    bean.position.x = s * 0.8;
    kid.add(bean);
    k.tube([v(s * 0.5, -0.3, 0), v(s * 0.3, -1.2, 0), v(0, -2.2, 0)], 0.05, k.material({ color: "#e8d2a0" }), kid, 16, 6);
  }
  const bladder = new THREE.Mesh(k.sphere, k.ghost("#f2d36b", 0.6));
  bladder.scale.setScalar(0.45);
  bladder.position.y = -2.4;
  kid.add(bladder);
  kid.position.set(6, 0.8, 0);
  g.add(kid);
  tag(k, g, v(-6, 1.2, 0), "ბრტყელი ჭია: პროტონეფრიდიები", [0]);
  tag(k, g, v(-2, 1.2, 0), "ჭიაყელა: მეტანეფრიდიები", [1]);
  tag(k, g, v(2, 1.4, 0), "მწერი: მალპიგის მილაკები", [2]);
  tag(k, g, v(6, 2.2, 0), "ხერხემლიანი: თირკმელი", [2]);
  const focus = [v(-6, 0, 0), v(-2, 0, 0), v(4, 0, 0)];
  return {
    stages: [0, 1, 2].map((i) => ({
      duration: 15,
      update: (_u: number, s: number, t: number) => {
        flames.forEach((f, j) => f.scale.setScalar(0.06 + 0.04 * Math.abs(Math.sin(t * 12 + j))));
        return orbit(focus[i], i === 2 ? 11 : 7, s, { start: 0.5, speed: 0.04, height: 0.55 });
      },
    })),
  };
};
