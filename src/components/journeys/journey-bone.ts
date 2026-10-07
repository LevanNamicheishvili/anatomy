import * as THREE from "three";
import { context, flow, layer, orbit } from "./common";
import { ease, rng, v, type Builder, type Kit, type V3 } from "./JourneyScene";

/*
 * Inside a bone: the atlas femur, then a long bone cut lengthwise (a textbook diagram: compact wall, spongy
 * ends, marrow cavity), osteons of compact bone, the trabecular lattice of spongy bone, and red marrow
 * making blood cells. Everything after the femur is drawn from code; not to scale.
 */

export const boneJourney: Builder = async (k) => {
  const body = await k.body(false);
  const leg = new THREE.Group();
  k.root.add(leg);
  context(k, body, leg, 0.1, 0.18, ["femur"]);
  const femur = layer(k, body, leg, (p) => p.group === "femur", k.material({ color: "#eadfc6", roughness: 0.62, clearcoat: 0.15 }));
  const box = femur.geometry.boundingBox!;
  const fc = box.getCenter(new THREE.Vector3());
  k.label(k.anchor(leg, v(fc.x, fc.y, box.max.z)), "დიაფიზი — ძვლის სხეული", { stages: [0] });
  k.label(k.anchor(leg, v(fc.x + 0.02, box.max.y - 0.02, fc.z + 0.02)), "ზედა ეპიფიზი — თავი", { stages: [0] });
  k.label(k.anchor(leg, v(fc.x, box.min.y + 0.03, box.max.z - 0.01)), "ქვედა ეპიფიზი", { stages: [0] });

  const cut = buildCutBone(k);
  const compact = buildOsteons(k);
  const spongy = buildSpongy(k);
  const marrow = buildMarrow(k);
  const levels = [leg, cut.group, compact.group, spongy.group, marrow.group];
  const show = (i: number) => levels.forEach((g, j) => (g.visible = i === j));

  return {
    stages: [
      {
        duration: 13,
        enter: () => show(0),
        update: (u, s) => {
          const shot = orbit(fc, 0.95 - 0.2 * ease(u), s, { start: -0.5, speed: 0.12, height: 0.12 });
          return shot;
        },
      },
      {
        duration: 17,
        cut: true,
        enter: () => show(1),
        update: (u, s) => {
          const e = ease((u - 0.7) / 0.3);
          const target = v(0, 0.3, 0).lerp(v(0.62, -0.5, 0), e);
          const a = -0.25 + Math.sin(s * 0.2) * 0.15;
          return { target, pos: target.clone().add(v(Math.sin(a) * 17, 1.5, Math.cos(a) * 17).lerp(v(0.4, 0.2, 2.2), e)) };
        },
      },
      {
        duration: 19,
        cut: true,
        enter: () => show(2),
        update: (u, s, t) => {
          compact.update(t);
          return orbit(v(0, 0.8, 0), 12 - 2.5 * ease(u), s, { start: 0.55, speed: 0.06, height: 0.42 });
        },
      },
      {
        duration: 17,
        cut: true,
        enter: () => show(3),
        update: (u, s) => {
          // Fly into the lattice.
          const a = 0.3 + s * 0.06;
          const d = 11 - 7.5 * ease(u);
          return { target: v(0, 0, 0), pos: v(Math.sin(a) * d, 0.25 * d, Math.cos(a) * d) };
        },
      },
      {
        duration: 20,
        cut: true,
        enter: () => show(4),
        update: (u, s, t) => {
          marrow.update(t);
          return orbit(v(0.6, -0.5, 0), 11 - 1.5 * ease(u), s, { start: 0.2, speed: 0.05, height: 0.28 });
        },
      },
    ],
  };
};

/** Radius of the schematic long bone at height y (shaft in the middle, wide rounded ends). */
const LEN = 5.2;
const outer = (y: number) => {
  const a = Math.abs(y);
  const flare = THREE.MathUtils.smoothstep(a, 2.6, 4.4);
  const r = 0.78 + 0.78 * flare;
  // Round off the ends.
  if (a > 4.4) return r * Math.sqrt(Math.max(0, 1 - ((a - 4.4) / (LEN - 4.4)) ** 2));
  return r;
};
/** Thickness of compact bone: thick in the shaft, a thin shell over the ends. */
const wall = (y: number) => 0.3 - 0.22 * THREE.MathUtils.smoothstep(Math.abs(y), 2.4, 3.8);

function buildCutBone(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  // Back half of the bone surface.
  const prof: THREE.Vector2[] = [];
  for (let i = 0; i <= 120; i++) {
    const y = -LEN + (2 * LEN * i) / 120;
    prof.push(new THREE.Vector2(Math.max(1e-3, outer(y)), y));
  }
  const shell = new THREE.Mesh(k.track(new THREE.LatheGeometry(prof, 64, Math.PI / 2, Math.PI)), k.material({ color: "#e6d9bd", roughness: 0.6, side: THREE.DoubleSide }));
  group.add(shell);
  // The cut face, painted like a textbook figure.
  const W = 2 * 1.6;
  const H = 2 * LEN;
  const PX = 64;
  const shape = new THREE.Shape();
  prof.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.y) : shape.lineTo(p.x, p.y)));
  for (let i = prof.length - 1; i >= 0; i--) shape.lineTo(-prof[i].x, prof[i].y);
  const face = k.track(new THREE.ShapeGeometry(shape, 4));
  const uv = face.attributes.uv as THREE.BufferAttribute;
  const pos = face.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + W / 2) / W, (pos.getY(i) + LEN) / H);
  const r = rng(61);
  const tex = k.canvasTexture(W * PX, H * PX, (ctx) => {
    const X = (x: number) => (x + W / 2) * PX;
    const Y = (y: number) => (LEN - y) * PX;
    const inner = new Path2D();
    for (let i = 0; i <= 200; i++) {
      const y = -LEN + 0.06 + ((2 * LEN - 0.12) * i) / 200;
      const x = Math.max(0, outer(y) - wall(y));
      if (i === 0) inner.moveTo(X(x), Y(y));
      else inner.lineTo(X(x), Y(y));
    }
    for (let i = 200; i >= 0; i--) {
      const y = -LEN + 0.06 + ((2 * LEN - 0.12) * i) / 200;
      inner.lineTo(X(-Math.max(0, outer(y) - wall(y))), Y(y));
    }
    // Compact bone everywhere, with faint lines of osteons.
    ctx.fillStyle = "#efe6d0";
    ctx.fillRect(0, 0, W * PX, H * PX);
    ctx.strokeStyle = "rgba(160,140,100,0.35)";
    ctx.lineWidth = 1;
    for (let x = -W / 2; x < W / 2; x += 0.07) {
      ctx.beginPath();
      ctx.moveTo(X(x), 0);
      ctx.lineTo(X(x), H * PX);
      ctx.stroke();
    }
    ctx.save();
    ctx.clip(inner);
    // Spongy bone with red marrow in the ends.
    ctx.fillStyle = "#c2433f";
    ctx.fillRect(0, 0, W * PX, H * PX);
    ctx.strokeStyle = "#f1e6cd";
    ctx.lineCap = "round";
    for (let i = 0; i < 1500; i++) {
      const y = (r() * 2 - 1) * LEN;
      const x = (r() * 2 - 1) * outer(y);
      // Struts follow the lines of stress: arching from the wall towards the joint.
      const ang = Math.PI / 2 + Math.sign(y) * x * 0.5 + (r() - 0.5) * 0.9;
      const len = 0.12 + r() * 0.22;
      ctx.lineWidth = 2 + r() * 3;
      ctx.beginPath();
      ctx.moveTo(X(x), Y(y));
      ctx.lineTo(X(x + Math.cos(ang) * len), Y(y + Math.sin(ang) * len));
      ctx.stroke();
    }
    // Yellow marrow fills the shaft's cavity.
    const g = ctx.createLinearGradient(0, Y(2.9), 0, Y(-2.9));
    g.addColorStop(0, "rgba(240,205,110,0)");
    g.addColorStop(0.12, "rgba(240,205,110,1)");
    g.addColorStop(0.88, "rgba(240,205,110,1)");
    g.addColorStop(1, "rgba(240,205,110,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, Y(2.9), W * PX, Y(-2.9) - Y(2.9));
    ctx.restore();
    // A nutrient artery entering the shaft.
    ctx.strokeStyle = "#c62f36";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(X(-outer(-0.6)), Y(-0.6));
    ctx.lineTo(X(-0.35), Y(-0.2));
    ctx.lineTo(X(0.1), Y(0.6));
    ctx.stroke();
  });
  const faceMesh = new THREE.Mesh(face, k.material({ map: tex, roughness: 0.7, clearcoat: 0 }));
  faceMesh.position.z = 0.001;
  group.add(faceMesh);
  // Articular cartilage on the head, periosteum round the shaft.
  const cart: THREE.Vector2[] = prof.filter((p) => p.y > 4.3).map((p) => new THREE.Vector2(p.x + 0.07, p.y + 0.04));
  group.add(new THREE.Mesh(k.track(new THREE.LatheGeometry(cart, 48, Math.PI / 2, Math.PI)), k.ghost("#a9d4e0", 0.6, { side: THREE.DoubleSide })));
  const peri = prof.filter((p) => Math.abs(p.y) < 4.2).map((p) => new THREE.Vector2(p.x + 0.035, p.y));
  group.add(new THREE.Mesh(k.track(new THREE.LatheGeometry(peri, 48, Math.PI / 2, Math.PI)), k.ghost("#e9a59a", 0.35, { side: THREE.DoubleSide })));
  const A = (p: V3, text: string) => k.label(k.anchor(group, p), text, { stages: [1] });
  A(v(-0.66, -1.2, 0.02), "კომპაქტური ძვალი");
  A(v(0.3, 4.2, 0.02), "ღრუბლოვანი ძვალი, წითელი ტვინი");
  A(v(0.1, -0.2, 0.02), "ძვლის ტვინის ღრუ — ყვითელი ტვინი");
  A(v(0.5, 5.15, 0.0), "სახსრის ხრტილი");
  A(v(-0.82, 1.6, -0.2), "ძვლისაზრდელა");
  A(v(-0.75, -0.6, 0.02), "სისხლძარღვი");
  return { group };
}

/** Compact bone: osteons with concentric lamellae round a central canal; one osteon pulled out. */
function buildOsteons(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(71);
  const ringTex = k.canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = "#efe4c8";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(128, 128, 22 + i * 12, 0, Math.PI * 2);
      ctx.strokeStyle = i % 2 ? "#d9c9a2" : "#c8b483";
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    // Osteocytes in their lacunae, between lamellae.
    ctx.fillStyle = "#6b5634";
    for (let i = 0; i < 40; i++) {
      const rad = 28 + Math.floor(r() * 8) * 12;
      const a = r() * Math.PI * 2;
      ctx.save();
      ctx.translate(128 + Math.cos(a) * rad, 128 + Math.sin(a) * rad);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.ellipse(0, 0, 4.5, 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(128, 128, 15, 0, Math.PI * 2);
    ctx.fillStyle = "#7a2a2a";
    ctx.fill();
  });
  const side = k.stripes(["#eadcbc", "#dccaa0"], [1, 1], [8, 1]);
  const capMat = k.material({ map: ringTex, roughness: 0.65 });
  const sideMat = k.material({ color: "#ffffff", map: side, roughness: 0.65 });
  const H = 5;
  const RO = 1;
  const osteonGeo = k.track(new THREE.CylinderGeometry(RO, RO, H, 40, 1));
  const spots: V3[] = [];
  for (let q = -2; q <= 2; q++)
    for (let w = -1; w <= 1; w++) {
      const p = v(q * 1.75 + (w & 1) * 0.87, 0, w * 1.52);
      if (Math.abs(q) === 2 && w !== 0) continue;
      spots.push(p);
    }
  const pulled = spots.findIndex((p) => p.x > 0.8 && p.x < 1.0 && p.z > 1);
  spots.forEach((p, i) => {
    if (i === pulled) return;
    const m = new THREE.Mesh(osteonGeo, [sideMat, capMat, capMat]);
    m.position.copy(p);
    group.add(m);
  });
  // The pulled-out osteon: lamellae as nested shells, the inner ones sticking out further.
  const lamA = k.stripes(["#efe2c2", "#d8c393"], [1, 1], [10, 6]);
  const lamB = k.stripes(["#e9d9b2", "#cdb684"], [1, 1], [10, 6]);
  lamA.rotation = 0.5;
  lamB.rotation = -0.5;
  const base = spots[pulled] ?? v(0.87, 0, 1.52);
  const out = new THREE.Group();
  out.position.copy(base).add(v(0.4, 0.6, 2.4));
  group.add(out);
  const radii = [1, 0.82, 0.64, 0.46];
  radii.forEach((rad, i) => {
    const h = H - 0.2 + i * 0.75;
    const g = k.track(new THREE.CylinderGeometry(rad, rad, h, 40, 1, true));
    const m = new THREE.Mesh(g, k.material({ color: "#ffffff", map: i % 2 ? lamA : lamB, roughness: 0.6, side: THREE.DoubleSide }));
    m.position.y = (h - H) / 2;
    out.add(m);
  });
  const top = H / 2 + 3 * 0.75;
  k.tube([v(0.08, -H / 2 - 1, 0), v(0.08, top + 1.3, 0)], 0.1, k.material({ color: "#c62f36", roughness: 0.4 }), out, 8);
  k.tube([v(-0.1, -H / 2 - 1, 0.04), v(-0.1, top + 1.3, 0.04)], 0.12, k.material({ color: "#3e63b8", roughness: 0.4 }), out, 8);
  k.tube([v(0, -H / 2 - 1, -0.12), v(0, top + 1.5, -0.12)], 0.05, k.material({ color: "#f2c230", roughness: 0.4 }), out, 8);
  // Osteocytes on the lamellae.
  const cells: THREE.Matrix4[] = [];
  radii.forEach((rad, i) => {
    for (let j = 0; j < 22; j++) {
      const a = r() * Math.PI * 2;
      const y = -H / 2 + 0.2 + r() * (H - 0.4 + i * 0.75);
      cells.push(new THREE.Matrix4().compose(v(Math.cos(a) * (rad + 0.01), y, Math.sin(a) * (rad + 0.01)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), v(0.04, 0.09, 0.14)));
    }
  });
  const om = new THREE.InstancedMesh(k.sphere, k.material({ color: "#6b5634", roughness: 0.6 }), cells.length);
  cells.forEach((m, i) => om.setMatrixAt(i, m));
  out.add(om);
  // A Volkmann canal: a cross vessel linking two osteons.
  k.tube([v(-3.5, -0.8, 0), v(-1.75, -0.8, 0), v(0, -0.8, 0)], 0.09, k.material({ color: "#c62f36", roughness: 0.4 }), group, 8);
  const A = (o: THREE.Object3D, p: V3, text: string) => k.label(k.anchor(o, p), text, { stages: [2] });
  A(group, v(-1.75, H / 2, 0), "ოსტეონი");
  A(out, v(0.25, top + 0.9, 0), "ჰავერსის არხი: არტერია, ვენა, ნერვი");
  A(out, v(radii[1], H / 2 - 0.4, 0.2), "ძვლის ფირფიტები");
  A(out, new THREE.Vector3().setFromMatrixPosition(cells[5]), "ოსტეოციტი");
  A(group, v(-2.6, -0.8, 0.1), "ფოლკმანის არხი");
  return {
    group,
    update: (t: number) => {
      out.position.y = base.y + 0.6 + Math.sin(t * 0.8) * 0.12;
    },
  };
}

/** Spongy bone: a lattice of trabeculae with red marrow in the spaces. */
function buildSpongy(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(81);
  const nodes: V3[] = [];
  while (nodes.length < 230) {
    const p = v(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).multiplyScalar(4.2);
    if (p.length() > 4.2) continue;
    if (nodes.some((q) => q.distanceTo(p) < 0.75)) continue;
    // Stretched along y: the lattice follows the load.
    nodes.push(p.multiply(v(0.9, 1.15, 0.9)));
  }
  const struts: [V3, V3][] = [];
  nodes.forEach((p, i) => {
    const near = nodes
      .map((q, j) => ({ j, d: q.distanceTo(p) }))
      .filter((x) => x.j > i && x.d < 1.6)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    for (const n of near) struts.push([p, nodes[n.j]]);
  });
  const boneMat = k.material({ color: "#efe4c9", roughness: 0.6, clearcoat: 0.15 });
  const sm = new THREE.InstancedMesh(k.cylinder, boneMat, struts.length);
  const m = new THREE.Matrix4();
  const up = v(0, 1, 0);
  struts.forEach(([a, b], i) => {
    const d = b.clone().sub(a);
    const w = 0.07 + r() * 0.07;
    m.compose(a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize()), v(w, d.length(), w));
    sm.setMatrixAt(i, m);
  });
  group.add(sm);
  const nm = new THREE.InstancedMesh(k.sphere, boneMat, nodes.length);
  nodes.forEach((p, i) => {
    m.compose(p, new THREE.Quaternion(), v(1, 1, 1).multiplyScalar(0.13 + r() * 0.06));
    nm.setMatrixAt(i, m);
  });
  group.add(nm);
  // Red marrow in the spaces.
  const blobs: V3[] = [];
  for (let i = 0; i < 400 && blobs.length < 120; i++) {
    const p = v(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).multiplyScalar(4);
    if (p.length() > 4) continue;
    if (nodes.some((q) => q.distanceTo(p) < 0.42)) continue;
    blobs.push(p);
  }
  const bm = new THREE.InstancedMesh(k.sphere, k.ghost("#c73a3e", 0.3, { roughness: 0.5 }), blobs.length);
  blobs.forEach((p, i) => {
    m.compose(p, new THREE.Quaternion(), v(1, 1, 1).multiplyScalar(0.14 + r() * 0.1));
    bm.setMatrixAt(i, m);
  });
  bm.renderOrder = 2;
  group.add(bm);
  k.label(k.anchor(group, struts[4][0].clone().lerp(struts[4][1], 0.5)), "ტრაბეკულა — ძვლოვანი ძელაკი", { stages: [3] });
  k.label(k.anchor(group, blobs[2] ?? v(0, 0, 0)), "წითელი ძვლის ტვინი", { stages: [3] });
  return { group };
}

/** Red marrow: a stem cell gives rise to red cells, white cells and platelets that enter a sinusoid. */
function buildMarrow(k: Kit) {
  const group = new THREE.Group();
  group.visible = false;
  k.root.add(group);
  const r = rng(91);
  const stem = new THREE.Mesh(k.sphere, k.material({ color: "#b49ad6", roughness: 0.45, sheen: 0.6, sheenColor: new THREE.Color("#ffffff") }));
  stem.scale.setScalar(0.85);
  stem.position.set(-1.5, 1.4, 0);
  const stemNuc = new THREE.Mesh(k.sphere, k.material({ color: "#5a3d8a", roughness: 0.5 }));
  stemNuc.scale.setScalar(0.5);
  stemNuc.position.copy(stem.position).add(v(0.2, 0.15, 0.45));
  group.add(stem, stemNuc);
  // Precursors around the stem cell.
  const prec = new THREE.InstancedMesh(k.sphere, k.material({ color: "#d9a0b4", roughness: 0.5 }), 14);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    m.compose(stem.position.clone().add(v(Math.cos(a) * 2, Math.sin(a) * 1.6, (r() - 0.5) * 1.6)), new THREE.Quaternion(), v(1, 1, 1).multiplyScalar(0.32 + r() * 0.12));
    prec.setMatrixAt(i, m);
  }
  group.add(prec);
  // The sinusoid: a wide, leaky capillary below.
  const sinPts = [v(-6, -2.2, -0.5), v(-2, -2.5, 0), v(2, -2.2, 0.3), v(6, -2.6, 0)];
  const sin = k.tube(sinPts, 0.95, k.ghost("#d9524f", 0.28, { side: THREE.DoubleSide }), group, 64, 24);
  sin.mesh.renderOrder = 3;
  // Trabeculae round the edge.
  const boneMat = k.material({ color: "#efe4c9", roughness: 0.6 });
  k.tube([v(-6, 4.2, -2), v(-2, 3.6, -2.4), v(3, 4.4, -2.2), v(6.5, 3.4, -1.8)], 0.35, boneMat, group, 32);
  k.tube([v(4.5, 4.5, -2), v(4.2, 1, -2.5), v(5, -1, -2.2)], 0.3, boneMat, group, 32);
  // New cells leave the stem area for the sinusoid, then ride along it.
  const into = (i: number, n: number) => sin.curve.getPointAt(0.25 + (0.5 * i) / n);
  const from = () => stem.position.clone().add(v((r() - 0.5) * 2, (r() - 0.5) * 1.4, (r() - 0.5) * 1.2));
  const rbc = flow(k, group, { n: 16, geometry: k.redCell(), color: "#d42a30", size: 0.5, period: 5, from, to: (i) => into(i, 16), seed: 12, emissive: 0.2 });
  const wbc = flow(k, group, { n: 6, color: "#f1edf7", size: 0.36, period: 6, from, to: (i) => into(i + 0.3, 6), seed: 13, emissive: 0.1 });
  const plt = flow(k, group, { n: 10, color: "#e8c48a", size: 0.12, period: 4.4, from, to: (i) => into(i + 0.6, 10), seed: 14, emissive: 0.2 });
  const riding = flow(k, group, { n: 18, geometry: k.redCell(), color: "#d42a30", size: 0.5, period: 6, from: (i) => sin.curve.getPointAt(0.2 + (i % 6) * 0.04), to: (i) => sin.curve.getPointAt(0.98 - (i % 4) * 0.02).add(v(0, (i % 3) * 0.2 - 0.2, 0)), seed: 15, emissive: 0.2 });
  const A = (p: V3, text: string) => k.label(k.anchor(group, p), text, { stages: [4] });
  A(stem.position.clone().add(v(0, 0.9, 0)), "ღეროვანი უჯრედი");
  A(sin.curve.getPointAt(0.85).add(v(0, 1, 0)), "სისხლძარღვი (სინუსოიდი)");
  A(v(-4.6, 2.2, 0), "წინამორბედი უჯრედები");
  A(v(3.8, 4.6, -2), "ძვლის ძელაკი");
  const tags = [
    { flow: wbc, text: "ლეიკოციტი" },
    { flow: plt, text: "თრომბოციტი" },
  ].map((x) => ({ ...x, anchor: k.anchor(group, v(0, 0, 0)) }));
  tags.forEach((x) => k.label(x.anchor, x.text, { kind: "tag", stages: [4] }));
  const rbcAnchor = k.anchor(group, v(0, 0, 0));
  k.label(rbcAnchor, "ერითროციტი", { kind: "tag", stages: [4] });
  const tmp = new THREE.Matrix4();
  const follow = (mesh: THREE.InstancedMesh, anchor: THREE.Object3D) => {
    mesh.getMatrixAt(1, tmp);
    anchor.position.setFromMatrixPosition(tmp).add(v(0, 0.55, 0));
  };
  return {
    group,
    update: (t: number) => {
      rbc.update(t);
      wbc.update(t);
      plt.update(t);
      riding.update(t);
      follow(rbc.mesh, rbcAnchor);
      tags.forEach((x) => follow(x.flow.mesh, x.anchor));
      stem.scale.setScalar(0.85 + Math.sin(t * 1.4) * 0.03);
    },
  };
}
