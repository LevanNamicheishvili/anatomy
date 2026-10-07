import * as THREE from "three";
import { context, layer, orbit } from "./common";
import { ease, rng, v, type Builder, type Kit, type V3 } from "./JourneyScene";

/*
 * Zooming in, level by level: the body (atlas), the heart (atlas), cardiac muscle tissue, one cardiac
 * muscle cell, its nucleus and the DNA in it. The last four are drawn from code after textbook figures;
 * sizes between levels are not to scale (each level is ~10–1000× smaller than the one before).
 */

export const zoomJourney: Builder = async (k) => {
  const body = await k.body(false);
  const bodyGroup = new THREE.Group();
  const heartGroup = new THREE.Group();
  k.root.add(bodyGroup, heartGroup);
  const ctx = context(k, body, bodyGroup, 0.32, 0.2);
  if (ctx.skin) ctx.skin.material = k.ghost("#e8b79e", 0.32, { side: THREE.FrontSide, depthWrite: true });
  layer(k, body, bodyGroup, (p) => p.group === "lungs", k.ghost("#e79aa2", 0.3), 3);
  const heartMat = k.material({ color: "#b3363d", roughness: 0.42, clearcoat: 0.5, sheen: 0.4, sheenColor: new THREE.Color("#ffb3b3") });
  const vesselMat = { a: k.material({ color: "#c9343a", roughness: 0.4 }), v: k.material({ color: "#4062b0", roughness: 0.4 }) };
  const heartParts = (g: THREE.Group) => {
    layer(k, body, g, (p) => p.group === "heart" && /^Wall/.test(p.name), heartMat);
    layer(k, body, g, (p) => p.group === "arteries" && /aorta|carotid|subclavian/i.test(p.name) && !/abdominal/i.test(p.name), vesselMat.a);
    layer(k, body, g, (p) => p.group === "veins" && !/inferior vena cava/i.test(p.name), vesselMat.v);
  };
  heartParts(bodyGroup);
  heartParts(heartGroup);
  const heartCentre = v(0.017, 1.315, 0.02);
  k.label(k.anchor(bodyGroup, heartCentre), "გული", { stages: [0] });
  k.label(k.anchor(bodyGroup, v(-0.08, 1.36, 0.02)), "ფილტვი", { stages: [0] });
  k.label(k.anchor(heartGroup, v(0.05, 1.29, 0.03)), "პარკუჭის კედელი — კუნთოვანი ქსოვილი", { stages: [1] });
  k.label(k.anchor(heartGroup, v(0.012, 1.375, 0.0)), "აორტა", { stages: [1] });
  k.label(k.anchor(heartGroup, v(-0.016, 1.312, 0.03)), "მარჯვენა წინაგული", { stages: [1] });

  const tissue = buildTissue(k);
  const cell = buildCell(k);
  const nucleus = buildNucleus(k);
  const dna = buildDNA(k);
  const levels = [bodyGroup, heartGroup, tissue.group, cell.group, nucleus.group, dna.group];
  const moods: [string | null, number, number][] = [[null, 0, 0], [null, 0, 0], ["#140a0c", 9, 26], ["#120a0e", 8, 22], ["#0d0a14", 6, 16], ["#060a12", 8, 20]];
  const show = (i: number) => {
    levels.forEach((g, j) => (g.visible = i === j));
    k.mood(...moods[i]);
  };
  const wall = v(0.05, 1.29, 0.04);

  return {
    stages: [
      {
        duration: 13,
        enter: () => show(0),
        update: (u) => {
          const e = ease(u / 0.85);
          const target = v(0, 0.95, 0).lerp(heartCentre, e);
          return { target, pos: target.clone().add(v(0.25, 0.12, 2.7).lerp(v(0.12, 0.05, 0.42), e)) };
        },
      },
      {
        duration: 15,
        cut: true,
        enter: () => show(1),
        update: (u, s) => {
          const shot = orbit(heartCentre, 0.27, s, { start: 0.3, speed: 0.12, height: 0.15 });
          const e = ease((u - 0.65) / 0.35);
          shot.target.lerp(wall, e);
          shot.pos.lerp(wall.clone().add(v(0.03, -0.004, 0.018)), e);
          return shot;
        },
      },
      {
        duration: 17,
        cut: true,
        enter: () => show(2),
        update: (u, s, t) => {
          tissue.update(t);
          return orbit(v(0, 0, 0), 15 - 4 * ease(u), s, { start: 0.45, speed: 0.05, height: 0.42 });
        },
      },
      {
        duration: 17,
        cut: true,
        enter: () => show(3),
        update: (u, s, t) => {
          cell.update(t);
          return orbit(v(0, 0, 0), 12.5 - 2.5 * ease(u), s, { start: 0.55, speed: -0.05, height: 0.38 });
        },
      },
      {
        duration: 16,
        cut: true,
        enter: () => show(4),
        update: (u, s, t) => {
          nucleus.update(t);
          return orbit(v(0, 0, 0), 8.5 - 1.8 * ease(u), s, { start: -0.7, speed: -0.04, height: 0.25 });
        },
      },
      {
        duration: 17,
        cut: true,
        enter: () => show(5),
        update: (u, _s, t) => {
          dna.update(t);
          const target = v(-3 + 6 * ease(u), 0, 0);
          return { target, pos: target.clone().add(v(2.5, 2.8, 9.5 - 2.5 * ease(u))) };
        },
      },
    ],
  };
};

/** Cardiac muscle: branched striated cells joined end to end by intercalated discs, capillaries between. */
function buildTissue(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(21);
  const stripes = k.stripes(["#d07a73", "#a4433f", "#d98b82", "#a4433f"], [3, 1, 2, 1], [1, 14]);
  const cellMat = k.material({ color: "#ffffff", map: stripes, roughness: 0.42, transparent: true, opacity: 0.88, sheen: 0.6, sheenColor: new THREE.Color("#ffd6d0"), normalMap: k.normalMap("fibre", [3, 1]), clearcoat: 0.5 });
  const cellGeo = k.track(new THREE.CapsuleGeometry(0.5, 2.3, 6, 18));
  const discMat = k.material({ color: "#5d1d22", roughness: 0.6 });
  const nucMat = k.material({ color: "#5b3f8c", roughness: 0.5 });
  const cells: { p: V3; rot: number }[] = [];
  const discs: V3[] = [];
  const nuclei: V3[] = [];
  for (let layerZ = -1; layerZ <= 1; layerZ++) {
    for (let row = -2; row <= 2; row++) {
      const shift = ((row + layerZ) & 1) * 1.6;
      for (let col = -2; col <= 2; col++) {
        const p = v(col * 3.3 + shift, row * 1.15 + (r() - 0.5) * 0.1, layerZ * 1.25);
        cells.push({ p, rot: (r() - 0.5) * 0.06 });
        nuclei.push(p.clone());
        discs.push(p.clone().add(v(1.65, 0, 0)));
        // Some cells branch into the row above.
        if (r() < 0.28 && row < 2) cells.push({ p: p.clone().add(v(1.4, 0.58, 0)), rot: 0.42 });
      }
    }
  }
  const im = new THREE.InstancedMesh(cellGeo, cellMat, cells.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  cells.forEach((c, i) => {
    q.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2 + c.rot));
    m.compose(c.p, q, v(1, 1, 1));
    im.setMatrixAt(i, m);
  });
  im.renderOrder = 2;
  group.add(im);
  const dm = new THREE.InstancedMesh(k.cylinder, discMat, discs.length);
  discs.forEach((p, i) => {
    m.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), v(0.46, 0.06, 0.46));
    dm.setMatrixAt(i, m);
  });
  group.add(dm);
  const nm = new THREE.InstancedMesh(k.sphere, nucMat, nuclei.length);
  nuclei.forEach((p, i) => {
    m.compose(p, q.identity(), v(0.5, 0.2, 0.2));
    nm.setMatrixAt(i, m);
  });
  group.add(nm);
  // Capillaries along the gaps.
  const capMat = k.material({ color: "#c62f36", roughness: 0.35, clearcoat: 0.5 });
  for (const [y, z] of [
    [0.58, 0.62],
    [-0.58, -0.62],
    [1.72, -0.62],
    [-1.72, 0.62],
  ])
    k.tube(Array.from({ length: 9 }, (_, i) => v(-8.5 + i * 2.2, y + Math.sin(i) * 0.12, z + Math.cos(i * 1.3) * 0.12)), 0.13, capMat, group, 64);
  const beat = new THREE.Group();
  group.add(beat);
  k.label(k.anchor(group, v(-3.3, 1.15 * 2 + 0.5, 1.25)), "გულის კუნთის უჯრედი", { stages: [2] });
  k.label(k.anchor(group, discs[discs.length - 3].clone().add(v(0, 0.48, 0))), "ჩანართი დისკო", { stages: [2] });
  k.label(k.anchor(group, nuclei[nuclei.length - 8].clone().add(v(0, 0, 0.3))), "ბირთვი", { stages: [2] });
  k.label(k.anchor(group, v(4.5, 0.58, 0.75)), "კაპილარი", { stages: [2] });
  k.label(k.anchor(group, v(-6.2, -1.15, 1.75)), "განივი ზოლები", { kind: "tag", stages: [2] });
  return {
    group,
    // The whole sheet contracts a little with each beat.
    update: (t: number) => {
      const b = Math.max(0, Math.sin(t * 7.5)) ** 3;
      group.scale.set(1 - 0.05 * b, 1 + 0.02 * b, 1 + 0.02 * b);
    },
  };
}

/** One cardiomyocyte: myofibrils with sarcomeres, rows of mitochondria, a central nucleus. */
function buildCell(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(31);
  const L = 7;
  const membrane = new THREE.Mesh(k.track(new THREE.CapsuleGeometry(1.75, L, 8, 32)), k.ghost("#f3a6a6", 0.22, { side: THREE.DoubleSide, sheen: 0.8, sheenColor: new THREE.Color("#ffffff"), normalMap: k.normalMap("organic", [6, 2]), clearcoat: 0.6 }));
  membrane.rotation.z = Math.PI / 2;
  membrane.renderOrder = 3;
  group.add(membrane);
  // Sarcomeres: Z line, light I band, dark A band with a lighter H zone.
  const sarc = k.stripes(["#5a1f26", "#f0c3bd", "#b6555a", "#d98a87", "#b6555a", "#f0c3bd"], [0.4, 2, 2.6, 0.9, 2.6, 2], [1, 9]);
  const fibMat = k.material({ color: "#ffffff", map: sarc, roughness: 0.45, normalMap: k.normalMap("fibre", [2, 1]), clearcoat: 0.3 });
  const fibGeo = k.track(new THREE.CylinderGeometry(0.27, 0.27, L + 1.4, 18, 1));
  const mitoMat = k.material({ color: "#e48c3f", roughness: 0.4, clearcoat: 0.5, normalMap: k.normalMap("organic", [2, 2]) });
  const fibrils: V3[] = [];
  for (let a = 0; a < 6; a++) {
    for (const rad of [0.95, 1.45]) {
      const ang = (a / 6) * Math.PI * 2 + (rad > 1 ? Math.PI / 6 : 0);
      fibrils.push(v(0, Math.cos(ang) * rad, Math.sin(ang) * rad));
    }
  }
  for (const f of fibrils) {
    const m = new THREE.Mesh(fibGeo, fibMat);
    m.rotation.z = Math.PI / 2;
    m.position.copy(f);
    group.add(m);
  }
  // Mitochondria in rows between the fibrils.
  const mitos: THREE.Matrix4[] = [];
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2 + Math.PI / 6;
    for (let x = -L / 2 + 0.3; x < L / 2; x += 0.95) {
      if (Math.abs(x) < 1.4 && a % 2 === 0) continue;
      const p = v(x + (r() - 0.5) * 0.2, Math.cos(ang) * 1.2, Math.sin(ang) * 1.2);
      mitos.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), v(0.42, 0.17, 0.17)));
    }
  }
  const mm = new THREE.InstancedMesh(k.sphere, mitoMat, mitos.length);
  mitos.forEach((m, i) => mm.setMatrixAt(i, m));
  group.add(mm);
  const nucleus = new THREE.Mesh(k.sphere, k.material({ color: "#6a4aa0", roughness: 0.45, clearcoat: 0.4 }));
  nucleus.scale.set(1.2, 0.55, 0.55);
  group.add(nucleus);
  const disc = k.material({ color: "#5d1d22", roughness: 0.6 });
  for (const s of [-1, 1]) {
    const d = new THREE.Mesh(k.cylinder, disc);
    d.rotation.z = Math.PI / 2;
    d.scale.set(1.78, 0.12, 1.78);
    d.position.x = s * (L / 2 + 0.75);
    group.add(d);
  }
  k.label(k.anchor(group, v(0, 0.55, 0)), "ბირთვი", { stages: [3] });
  k.label(k.anchor(group, fibrils[0].clone().add(v(-2.4, 0.27, 0))), "მიოფიბრილი — სარკომერები", { stages: [3] });
  k.label(k.anchor(group, mitos.length ? new THREE.Vector3().setFromMatrixPosition(mitos[2]) : v(0, 0, 0)), "მიტოქონდრია", { stages: [3] });
  k.label(k.anchor(group, v(L / 2 + 0.75, 1.5, 0)), "ჩანართი დისკო", { stages: [3] });
  k.label(k.anchor(group, v(-1.5, 1.72, 0.3)), "უჯრედის მემბრანა", { stages: [3] });
  return {
    group,
    update: (t: number) => {
      const b = Math.max(0, Math.sin(t * 7.5)) ** 3;
      group.scale.set(1 - 0.06 * b, 1 + 0.03 * b, 1 + 0.03 * b);
    },
  };
}

/** The nucleus cut open: double envelope with pores, chromatin threads, nucleolus. */
function buildNucleus(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(41);
  const R = 2.6;
  // A quarter is cut away so we see inside.
  const shell = (rad: number, color: string) => {
    const g = k.track(new THREE.SphereGeometry(rad, 64, 40, Math.PI * 0.5, Math.PI * 1.5));
    return new THREE.Mesh(g, k.material({ color, roughness: 0.45, side: THREE.DoubleSide, sheen: 0.5, sheenColor: new THREE.Color("#ffffff"), normalMap: k.normalMap("organic", [5, 3]), clearcoat: 0.4 }));
  };
  group.add(shell(R, "#9c86c9"), shell(R - 0.12, "#bba8de"));
  const poreGeo = k.track(new THREE.TorusGeometry(0.11, 0.045, 8, 16));
  const poreMat = k.material({ color: "#4b3480", roughness: 0.5 });
  const pores: THREE.Matrix4[] = [];
  for (let i = 0; i < 90; i++) {
    const n = v(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize();
    // Skip the cut-away quarter (x<0, z>0).
    if (n.x < 0 && n.z > 0) continue;
    pores.push(new THREE.Matrix4().compose(n.clone().multiplyScalar(R + 0.02), new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), n), v(1, 1, 1)));
  }
  const pm = new THREE.InstancedMesh(poreGeo, poreMat, pores.length);
  pores.forEach((m, i) => pm.setMatrixAt(i, m));
  group.add(pm);
  const nucleolus = new THREE.Mesh(k.sphere, k.material({ color: "#3e2468", roughness: 0.65 }));
  nucleolus.scale.setScalar(0.7);
  nucleolus.position.set(-0.6, 0.3, -0.5);
  group.add(nucleolus);
  const chromMat = k.material({ color: "#c2558f", roughness: 0.5 });
  const hl = k.material({ color: "#f2c230", emissive: "#f2c230", emissiveIntensity: 0.4, roughness: 0.4 });
  let highlight: V3 = v(0, 0, 0);
  for (let c = 0; c < 16; c++) {
    let p = v(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).multiplyScalar(1.4);
    const pts: V3[] = [p.clone()];
    for (let i = 0; i < 26; i++) {
      p = p.clone().add(v(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.7));
      if (p.length() > R - 0.4) p.multiplyScalar((R - 0.4) / p.length());
      pts.push(p);
    }
    const isHl = c === 0;
    if (isHl) highlight = pts[12];
    k.tube(pts, isHl ? 0.06 : 0.045, isHl ? hl : chromMat, group, 160, 6);
  }
  k.label(k.anchor(group, v(R * 0.55, R * 0.75, 0.6)), "ბირთვის ორმაგი გარსი", { stages: [4] });
  k.label(k.anchor(group, new THREE.Vector3().setFromMatrixPosition(pores[3] ?? new THREE.Matrix4())), "ბირთვის ფორა", { stages: [4] });
  k.label(k.anchor(group, nucleolus.position.clone().add(v(0, 0.7, 0))), "ბირთვაკი", { stages: [4] });
  k.label(k.anchor(group, highlight), "ქრომატინი: დნმ + ცილები", { stages: [4] });
  return {
    group,
    update: (t: number) => {
      group.rotation.y = Math.sin(t * 0.2) * 0.15;
    },
  };
}

/** A stretch of DNA: two sugar–phosphate strands, base pairs A·T and G·C. */
function buildDNA(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const helix = new THREE.Group();
  group.add(helix);
  const r = rng(51);
  const N = 40;
  const rise = 0.34 * 1.4;
  const R = 1;
  const minor = Math.PI * 0.75;
  const x0 = -(N * rise) / 2;
  const strand = (off: number) => Array.from({ length: N * 3 + 1 }, (_, i) => {
    const a = (i / 3) * ((2 * Math.PI) / 10) + off;
    return v(x0 + (i / 3) * rise, Math.cos(a) * R, Math.sin(a) * R);
  });
  const bb = k.material({ color: "#e7e2d6", roughness: 0.4, clearcoat: 0.5 });
  k.tube(strand(0), 0.13, bb, helix, 480, 10);
  k.tube(strand(minor), 0.13, bb, helix, 480, 10);
  const BASE: Record<string, string> = { A: "#e8564a", T: "#f2c230", G: "#3b82c4", C: "#4bb36b" };
  const pair: Record<string, string> = { A: "T", T: "A", G: "C", C: "G" };
  const mats = Object.fromEntries(Object.entries(BASE).map(([b, c]) => [b, k.material({ color: c, roughness: 0.45 })]));
  const up = v(0, 1, 0);
  const tagged: { p: V3; b: string }[] = [];
  for (let i = 0; i < N; i++) {
    const b = "ATGC"[Math.floor(r() * 4)];
    const a1 = i * ((2 * Math.PI) / 10);
    const p1 = v(x0 + i * rise, Math.cos(a1) * R, Math.sin(a1) * R);
    const p2 = v(x0 + i * rise, Math.cos(a1 + minor) * R, Math.sin(a1 + minor) * R);
    const mid = p1.clone().lerp(p2, 0.5);
    for (const [from, base] of [
      [p1, b],
      [p2, pair[b]],
    ] as const) {
      const m = new THREE.Mesh(k.cylinder, mats[base]);
      const d = mid.clone().sub(from);
      m.position.copy(from).addScaledVector(d, 0.5);
      m.quaternion.setFromUnitVectors(up, d.clone().normalize());
      m.scale.set(0.09, d.length(), 0.09);
      helix.add(m);
      if (i >= 16 && i < 20) tagged.push({ p: from.clone().addScaledVector(d, 0.55), b: base });
    }
  }
  for (const t of tagged) k.label(k.anchor(helix, t.p), t.b, { kind: "tag", stages: [5] });
  k.label(k.anchor(helix, strand(0)[30]), "შაქარ-ფოსფატის ჯაჭვი", { stages: [5] });
  k.label(k.anchor(helix, v(x0 + 26 * rise, 0, 0)), "ფუძეთა წყვილი", { stages: [5] });
  return {
    group,
    update: (t: number) => {
      helix.rotation.x = t * 0.25;
    },
  };
}
