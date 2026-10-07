import * as THREE from "three";
import { ARTERIAL, VENOUS, context, flow, layer, orbit, stream } from "./common";
import { ease, rng, v, type Builder, type Shot, type V3 } from "./JourneyScene";

/*
 * Blood journey: one red cell goes round both circulations. In the body (atlas meshes, see-through) the
 * camera follows it; in the lung and in a thigh muscle the view drops to the capillaries, where it picks
 * up or gives off oxygen. Paths are drawn through the atlas's chambers and vessels; the pulmonary veins and
 * the iliac/femoral vessels aren't in the atlas and are drawn as tubes.
 */

const path = (pts: number[][]) => new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => v(x, y, z)), false, "centripetal");

// Atlas metres; +x is the body's left, +z its front.
const P = {
  svc: path([[-0.042, 1.418, 0.021], [-0.024, 1.404, 0.019], [-0.016, 1.386, 0.016], [-0.015, 1.36, 0.016], [-0.015, 1.335, 0.019]]),
  right: path([[-0.015, 1.335, 0.019], [-0.015, 1.313, 0.02], [-0.006, 1.299, 0.03], [0.011, 1.291, 0.044], [0.024, 1.306, 0.05], [0.028, 1.33, 0.045], [0.026, 1.35, 0.035]]),
  pulm: path([[0.026, 1.35, 0.035], [0.012, 1.356, 0.012], [-0.011, 1.344, -0.004], [-0.035, 1.338, -0.006], [-0.058, 1.322, -0.004], [-0.074, 1.31, 0.0]]),
  left: path([[-0.074, 1.306, -0.012], [-0.05, 1.312, -0.016], [-0.022, 1.318, -0.012], [0.019, 1.322, -0.006], [0.03, 1.306, 0.005], [0.04, 1.29, 0.02], [0.036, 1.302, 0.026], [0.022, 1.318, 0.022]]),
  aorta: path([[0.022, 1.318, 0.022], [0.011, 1.339, 0.022], [0.011, 1.366, 0.013], [0.015, 1.374, -0.002], [0.02, 1.356, -0.02], [0.019, 1.3, -0.028], [0.016, 1.23, -0.02], [0.01, 1.16, -0.002], [0.008, 1.11, 0.012], [0.005, 1.045, 0.016], [-0.03, 1.0, 0.024], [-0.06, 0.95, 0.036], [-0.076, 0.9, 0.044], [-0.086, 0.8, 0.036]]),
  back: path([[-0.074, 0.8, 0.032], [-0.066, 0.9, 0.042], [-0.052, 0.95, 0.034], [-0.022, 1.0, 0.022], [-0.011, 1.05, 0.016], [-0.011, 1.093, 0.016], [-0.015, 1.21, 0.015], [-0.015, 1.27, 0.018], [-0.015, 1.305, 0.02]]),
};

export const bloodJourney: Builder = async (k) => {
  const body = await k.body(false);
  const macro = new THREE.Group();
  k.root.add(macro);
  context(k, body, macro, 0.07, 0.14);
  layer(k, body, macro, (p) => p.group === "lungs", k.ghost("#e79aa2", 0.2), 3);
  layer(k, body, macro, (p) => p.group === "heart" && /^Wall/.test(p.name), k.ghost("#b5343c", 0.26, { side: THREE.DoubleSide }), 2);
  layer(k, body, macro, (p) => p.group === "heart" && /valve|leaflet|cusp/i.test(p.name), k.ghost("#f3dcc8", 0.5), 2);
  layer(k, body, macro, (p) => p.group === "arteries", k.ghost("#d8343a", 0.36), 2);
  layer(k, body, macro, (p) => p.group === "veins", k.ghost("#3c5fb4", 0.36), 2);
  // Vessels the atlas lacks.
  const red = k.ghost("#d8343a", 0.36);
  const blue = k.ghost("#3c5fb4", 0.36);
  k.tube([v(-0.074, 1.306, -0.012), v(-0.05, 1.312, -0.016), v(-0.022, 1.318, -0.012), v(0.012, 1.322, -0.008)], 0.006, red, macro, 24).mesh.renderOrder = 2;
  k.tube([v(0.078, 1.3, -0.012), v(0.055, 1.31, -0.014), v(0.03, 1.32, -0.01)], 0.006, red, macro, 24).mesh.renderOrder = 2;
  k.tube([v(0.005, 1.045, 0.016), v(-0.03, 1.0, 0.024), v(-0.06, 0.95, 0.036), v(-0.076, 0.9, 0.044), v(-0.086, 0.8, 0.036), v(-0.09, 0.7, 0.02)], 0.0045, red, macro, 48).mesh.renderOrder = 2;
  k.tube([v(-0.09, 0.7, 0.016), v(-0.074, 0.8, 0.032), v(-0.066, 0.9, 0.042), v(-0.052, 0.95, 0.034), v(-0.022, 1.0, 0.022), v(-0.011, 1.05, 0.016)], 0.005, blue, macro, 48).mesh.renderOrder = 2;

  // The cell we follow, and others in the same stream.
  const cellMat = k.material({ color: VENOUS, roughness: 0.35, clearcoat: 0.6, sheen: 0.5, sheenColor: new THREE.Color("#ff8f8f"), emissive: VENOUS, emissiveIntensity: 0.25 });
  const cell = new THREE.Mesh(k.redCell(), cellMat);
  cell.scale.setScalar(0.0065);
  macro.add(cell);
  k.label(cell, "ჩვენი ერითროციტი", { stages: [0, 1, 2, 4, 5, 7] });
  const macroCurves = [P.svc, P.right, P.pulm, P.left, P.aorta, P.back];
  const streams = macroCurves.map((c, i) => {
    const s = stream(k, macro, c, { n: i === 4 ? 70 : 26, size: 0.0045, spread: 0.0028, speed: i === 4 ? 0.05 : 0.09, color: () => (i < 3 || i === 5 ? VENOUS : ARTERIAL), seed: i + 1 });
    s.mesh.visible = false;
    return s;
  });

  const A = (p: V3, text: string, stages: number[]) => k.label(k.anchor(macro, p), text, { stages });
  A(v(-0.02, 1.372, 0.018), "ზედა ღრუ ვენა", [0]);
  A(v(-0.026, 1.312, 0.024), "მარჯვენა წინაგული", [0, 1, 7]);
  A(v(0.012, 1.292, 0.052), "მარჯვენა პარკუჭი", [1]);
  A(v(-0.004, 1.298, 0.032), "სამკარიანი სარქველი", [1]);
  A(v(0.03, 1.352, 0.04), "ფილტვის ღერო", [1, 2]);
  A(v(-0.03, 1.342, -0.005), "ფილტვის არტერია", [2]);
  A(v(-0.08, 1.34, 0.01), "მარჯვენა ფილტვი", [2]);
  A(v(-0.05, 1.316, -0.016), "ფილტვის ვენა", [4]);
  A(v(0.02, 1.326, -0.012), "მარცხენა წინაგული", [4]);
  A(v(0.042, 1.288, 0.022), "მარცხენა პარკუჭი", [4]);
  A(v(0.032, 1.303, 0.006), "ორკარიანი სარქველი", [4]);
  A(v(0.016, 1.378, -0.002), "აორტის რკალი", [5]);
  A(v(0.019, 1.27, -0.026), "დაღმავალი აორტა", [5]);
  A(v(0.008, 1.1, 0.014), "მუცლის აორტა", [5]);
  A(v(-0.08, 0.86, 0.042), "ბარძაყის არტერია", [5]);
  A(v(-0.06, 0.92, 0.04), "ბარძაყის ვენა", [7]);
  A(v(-0.013, 1.15, 0.016), "ქვედა ღრუ ვენა", [7]);

  const alveolus = buildAlveolus(k);
  const muscle = buildMuscleCapillary(k);

  const show = (which: "macro" | "alv" | "mus", streamIdx = -1) => {
    macro.visible = which === "macro";
    alveolus.group.visible = which === "alv";
    muscle.group.visible = which === "mus";
    streams.forEach((s, i) => (s.mesh.visible = i === streamIdx));
    // Inside the body it is dark; fog gives depth.
    if (which === "macro") k.mood(null);
    else k.mood(which === "alv" ? "#1b0c10" : "#170a0a", 8, 22);
  };

  const p = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  /** Put the cell on a curve and return a shot that follows it. */
  const follow = (curveIdx: number, u: number, t: number, dt: number, dir: V3, dist: number, oxygen: THREE.Color): Shot => {
    const curve = macroCurves[curveIdx];
    const uu = ease(u) * 0.75 + u * 0.25;
    curve.getPointAt(uu, p);
    curve.getTangentAt(uu, tan);
    cell.position.copy(p);
    cell.quaternion.setFromUnitVectors(up, tan.clone().cross(v(0.3, 1, 0.2)).normalize());
    cell.rotateOnWorldAxis(tan, t * 1.3);
    cellMat.color.copy(oxygen);
    cellMat.emissive.copy(oxygen);
    streams[curveIdx].update(t);
    void dt;
    return { target: p.clone(), pos: p.clone().addScaledVector(dir.clone().normalize(), dist) };
  };

  return {
    stages: [
      { duration: 14, enter: () => show("macro", 0), update: (u, _s, t, dt) => follow(0, u, t, dt, v(-0.5, 0.25, 1), 0.22 - 0.05 * u, VENOUS) },
      { duration: 15, enter: () => show("macro", 1), update: (u, _s, t, dt) => follow(1, u, t, dt, v(0.35, 0.2, 1), 0.17, VENOUS) },
      { duration: 13, enter: () => show("macro", 2), update: (u, _s, t, dt) => follow(2, u, t, dt, v(-0.15, 0.3, 1), 0.2 - 0.16 * ease((u - 0.7) / 0.3), VENOUS) },
      {
        duration: 20,
        cut: true,
        enter: () => show("alv"),
        update: (u, s, t) => {
          alveolus.update(t);
          return orbit(v(0, 0, 0), 6.2 - 1.2 * ease(u), s, { start: -0.5, speed: 0.07, height: 0.32 });
        },
      },
      { duration: 15, cut: true, enter: () => show("macro", 3), update: (u, _s, t, dt) => follow(3, u, t, dt, v(0.2, 0.25, 1), 0.18, ARTERIAL) },
      {
        duration: 18,
        enter: () => show("macro", 4),
        update: (u, _s, t, dt) => {
          const dist = 0.12 + 0.55 * ease(u / 0.6) - 0.62 * ease((u - 0.88) / 0.12);
          return follow(4, u, t, dt, v(0.6, 0.12, 1), dist, ARTERIAL);
        },
      },
      {
        duration: 20,
        cut: true,
        enter: () => show("mus"),
        update: (u, s, t) => {
          muscle.update(t);
          return orbit(v(0, 0, 0), 9 - 1.8 * ease(u), s, { start: 0.25, speed: -0.03, height: 0.3 });
        },
      },
      {
        duration: 17,
        cut: true,
        enter: () => show("macro", 5),
        update: (u, _s, t, dt) => {
          const shot = follow(5, u, t, dt, v(0.5, 0.15, 1), 0.55 - 0.3 * ease(u / 0.7), VENOUS);
          // At the end step back to see the whole loop.
          const end = ease((u - 0.75) / 0.25);
          if (end > 0) {
            shot.target.lerp(v(0, 1.2, 0.01), end);
            shot.pos.lerp(v(0.35, 1.32, 0.95), end);
          }
          return shot;
        },
      },
    ],
  };
};

/** A lung capillary wrapped round an alveolus: cells darken→brighten as O₂ goes in and CO₂ comes out. */
function buildAlveolus(k: Parameters<Builder>[0]) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(11);
  // A cluster of air sacs at the end of a small airway.
  const sac = k.ghost("#f2b3b8", 0.36, { side: THREE.DoubleSide, roughness: 0.45, sheen: 0.7, sheenColor: new THREE.Color("#ffe4e4"), normalMap: k.normalMap("organic", [3, 2]), emissive: "#5a1a22", emissiveIntensity: 0.3 });
  const main = new THREE.Mesh(k.sphere, sac);
  main.scale.setScalar(1.3);
  group.add(main);
  const around = [v(1.7, 0.9, -0.6), v(-1.6, 0.7, -0.9), v(0.4, 1.8, -1.2), v(-0.6, -1.5, -1.1), v(1.4, -1.2, -0.9), v(-1.9, -0.6, 0.6), v(1.9, 0.1, 0.9)];
  for (const c of around) {
    const m = new THREE.Mesh(k.sphere, sac);
    m.position.copy(c);
    m.scale.setScalar(0.9 + r() * 0.3);
    group.add(m);
  }
  k.tube([v(0, 4.2, -1.6), v(0, 2.6, -1.2), v(0.1, 1.5, -0.6)], 0.45, k.ghost("#e9a4aa", 0.35, { side: THREE.DoubleSide }), group, 16, 16);
  // The capillary spirals round the main sac from one side (venous) to the other (arterial).
  const pts: V3[] = [];
  for (let i = 0; i <= 40; i++) {
    const s = i / 40;
    const y = (s * 2 - 1) * 1.15;
    const a = s * Math.PI * 3.2;
    const rr = Math.sqrt(Math.max(0.05, 1.47 ** 2 - y * y));
    pts.push(v(Math.cos(a) * rr, y, Math.sin(a) * rr));
  }
  pts.unshift(pts[0].clone().add(v(-1.4, -0.8, 0.4)));
  pts.push(pts[pts.length - 1].clone().add(v(1.4, 0.8, 0.4)));
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const capGeo = new THREE.TubeGeometry(curve, 240, 0.14, 12);
  const colors = new Float32Array(capGeo.attributes.position.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < capGeo.attributes.position.count; i++) {
    const s = Math.floor(i / 13) / 240;
    c.copy(VENOUS).lerp(ARTERIAL, THREE.MathUtils.smoothstep(s, 0.25, 0.6));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  capGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  group.add(new THREE.Mesh(capGeo, k.ghost("#ffffff", 0.5, { vertexColors: true, normalMap: k.normalMap("organic", [24, 1]), clearcoat: 0.6, roughness: 0.35 })));
  const oxy = (u: number) => c.copy(VENOUS).lerp(ARTERIAL, THREE.MathUtils.smoothstep(u, 0.25, 0.6));
  const cells = stream(k, group, curve, { n: 16, size: 0.2, spread: 0.02, speed: 0.045, color: oxy, seed: 5 });
  // O₂ from the air into the blood, CO₂ the other way.
  const at = (i: number, n: number) => curve.getPointAt(0.25 + (0.35 * i) / n);
  const o2 = flow(k, group, { n: 30, color: "#4aa8e8", size: 0.06, period: 2.4, from: (i) => at(i, 30).multiplyScalar(0.45), to: (i) => at(i, 30), seed: 2 });
  const co2 = flow(k, group, { n: 20, color: "#8d969b", size: 0.06, period: 2.8, from: (i) => at(i + 0.5, 20), to: (i) => at(i + 0.5, 20).multiplyScalar(0.4), seed: 9 });
  k.label(k.anchor(group, v(0.3, 0.5, 0.7)), "ალვეოლი — ჰაერი", { stages: [3] });
  k.label(k.anchor(group, pts[3]), "კაპილარი: ვენური სისხლი", { stages: [3] });
  k.label(k.anchor(group, pts[pts.length - 4]), "არტერიული სისხლი", { stages: [3] });
  k.label(k.anchor(group, at(15, 30).multiplyScalar(0.7)), "O₂ →", { kind: "tag", stages: [3] });
  k.label(k.anchor(group, at(10, 20).multiplyScalar(0.62)), "← CO₂", { kind: "tag", stages: [3] });
  k.label(k.anchor(group, v(0, 3.2, -1.4)), "წვრილი ბრონქი", { stages: [3] });
  return {
    group,
    update: (t: number) => {
      cells.update(t);
      o2.update(t);
      co2.update(t);
    },
  };
}

/** A capillary between muscle fibres: cells give off O₂ and take up CO₂. */
function buildMuscleCapillary(k: Parameters<Builder>[0]) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const stripes = k.stripes(["#b9524a", "#8e3530", "#c76a5f", "#8e3530"], [3, 1, 2, 1], [1, 22]);
  const fibre = k.material({ color: "#ffffff", map: stripes, roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color("#ffd0c8"), normalMap: k.normalMap("fibre", [4, 1]), clearcoat: 0.4 });
  const geo = k.track(new THREE.CylinderGeometry(0.62, 0.62, 12, 28, 1));
  // A bed of fibres behind and beside the capillary, open towards the viewer.
  const lanes = [v(0, 0.75, -0.75), v(0, -0.75, -0.75), v(0, 1.75, 0.35), v(0, -1.75, 0.35), v(0, 0, -2.0), v(0, 2.3, -1.6), v(0, -2.3, -1.6)];
  for (const c of lanes) {
    const m = new THREE.Mesh(geo, fibre);
    m.rotation.z = Math.PI / 2;
    m.position.copy(c);
    group.add(m);
  }
  // The capillary weaves between the fibres.
  const pts: V3[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = -7 + (14 * i) / 24;
    pts.push(v(x, Math.sin(i * 0.9) * 0.35, 0.05 + Math.cos(i * 0.9) * 0.25));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const capGeo = new THREE.TubeGeometry(curve, 200, 0.16, 12);
  const colors = new Float32Array(capGeo.attributes.position.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < capGeo.attributes.position.count; i++) {
    const s = Math.floor(i / 13) / 200;
    c.copy(ARTERIAL).lerp(VENOUS, THREE.MathUtils.smoothstep(s, 0.3, 0.75));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  capGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  group.add(new THREE.Mesh(capGeo, k.ghost("#ffffff", 0.5, { vertexColors: true, normalMap: k.normalMap("organic", [24, 1]), clearcoat: 0.6, roughness: 0.35 })));
  const oxy = (u: number) => c.copy(ARTERIAL).lerp(VENOUS, THREE.MathUtils.smoothstep(u, 0.3, 0.75));
  const cells = stream(k, group, curve, { n: 18, size: 0.22, spread: 0.02, speed: 0.04, color: oxy, seed: 8 });
  const at = (i: number, n: number) => curve.getPointAt(0.3 + (0.45 * i) / n);
  const toFibre = (p: V3, i: number) => lanes[i % 4].clone().setX(p.x).lerp(p, 0.25);
  const o2 = flow(k, group, { n: 30, color: "#4aa8e8", size: 0.07, period: 2.4, from: (i) => at(i, 30), to: (i) => toFibre(at(i, 30), i), seed: 4 });
  const co2 = flow(k, group, { n: 20, color: "#8d969b", size: 0.07, period: 2.8, from: (i) => toFibre(at(i + 0.5, 20), i + 1), to: (i) => at(i + 0.5, 20), seed: 6 });
  k.label(k.anchor(group, v(-4, 1.75, 0.97)), "კუნთის ბოჭკო (უჯრედი)", { stages: [6] });
  k.label(k.anchor(group, pts[3]), "კაპილარი: არტერიული სისხლი", { stages: [6] });
  k.label(k.anchor(group, pts[21]), "ვენური სისხლი", { stages: [6] });
  k.label(k.anchor(group, toFibre(at(14, 30), 2).lerp(at(14, 30), 0.5)), "O₂ → კუნთს", { kind: "tag", stages: [6] });
  k.label(k.anchor(group, toFibre(at(8, 20), 1).lerp(at(8, 20), 0.5)), "CO₂ → სისხლს", { kind: "tag", stages: [6] });
  return {
    group,
    update: (t: number) => {
      cells.update(t);
      o2.update(t);
      co2.update(t);
    },
  };
}
