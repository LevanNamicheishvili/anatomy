import * as THREE from "three";
import type { Body } from "./body-model";
import { context, layer } from "./common";
import { ease, v, type Builder, type Kit, type Shot, type V3 } from "./JourneyScene";

/*
 * The right arm from the atlas, rigged at the elbow: the forearm bones turn about the elbow's axis, the
 * biceps (with brachialis) shortens and thickens, its tendon pulls the radius; the triceps stretches.
 * Used by the muscle journey and by the end of the nerve-impulse journey.
 */

const MUSCLE = new THREE.Color("#b3443d");
const TENDON = new THREE.Color("#efe7d8");

function arrow(k: Kit, color: string) {
  const g = new THREE.Group();
  const mat = k.material({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4 });
  const shaft = new THREE.Mesh(k.cylinder, mat);
  const head = new THREE.Mesh(k.track(new THREE.ConeGeometry(1, 1, 16)), mat);
  g.add(shaft, head);
  /** Point from `from` along `dir` for `len` metres. */
  const set = (from: V3, dir: V3, len: number) => {
    g.position.copy(from);
    g.quaternion.setFromUnitVectors(v(0, 1, 0), dir.clone().normalize());
    shaft.scale.set(0.0025, len * 0.75, 0.0025);
    shaft.position.y = len * 0.375;
    head.scale.set(0.007, len * 0.25, 0.007);
    head.position.y = len * 0.875;
  };
  return { group: g, set };
}

export function armRig(k: Kit, body: Body, parent: THREE.Object3D) {
  const elbow = v(...body.data.elbow);
  const axis = v(...body.data.elbowAxis).normalize();
  const boneMat = k.material({ color: "#ece2cb", roughness: 0.6, clearcoat: 0.15 });
  const humerus = layer(k, body, parent, (p) => p.group === "humerus", boneMat);
  const hb = humerus.geometry.boundingBox!;
  const shoulder = v((hb.min.x + hb.max.x) / 2, hb.max.y - 0.02, (hb.min.z + hb.max.z) / 2);
  const pivot = new THREE.Group();
  pivot.position.copy(elbow);
  parent.add(pivot);
  const forearm = new THREE.Group();
  forearm.position.copy(elbow).negate();
  pivot.add(forearm);
  const radius = layer(k, body, forearm, (p) => p.group === "radius", boneMat);
  layer(k, body, forearm, (p) => p.group === "ulna", boneMat);
  const rb = radius.geometry.boundingBox!;
  const hand = v((rb.min.x + rb.max.x) / 2 - 0.01, rb.min.y - 0.06, (rb.min.z + rb.max.z) / 2 + 0.01);
  const load = new THREE.Mesh(k.sphere, k.material({ color: "#59636a", metalness: 0.6, roughness: 0.35 }));
  load.scale.setScalar(0.022);
  load.position.copy(hand);
  load.visible = false;
  forearm.add(load);

  const muscle = (group: "biceps" | "triceps", tendonBelow: number) => {
    const geo = body.merged((p) => p.group === group);
    const base = (geo.attributes.position.array as Float32Array).slice();
    const top = geo.boundingBox!.max.y;
    const colors = new Float32Array(base.length);
    const c = new THREE.Color();
    for (let i = 0; i < base.length; i += 3) {
      const y = base[i + 1];
      const tendon = y < elbow.y + tendonBelow || y > top - 0.03;
      c.copy(tendon ? TENDON : MUSCLE);
      colors.set([c.r, c.g, c.b], i);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = k.material({ color: "#ffffff", vertexColors: true, roughness: 0.45, clearcoat: 0.35, sheen: 0.4, sheenColor: new THREE.Color("#ffc4bc"), emissive: "#ff3b2f", emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    parent.add(mesh);
    return { mesh, geo, base, top, mat };
  };
  const biceps = muscle("biceps", 0.03);
  const triceps = muscle("triceps", 0.035);

  const line = shoulder.clone().sub(elbow);
  const lineLen = line.length();
  line.normalize();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const c = new THREE.Vector3();
  const deform = (m: typeof biceps, angle: number, bulge: number) => {
    const pos = m.geo.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const span = m.top - elbow.y - 0.03;
    for (let i = 0; i < arr.length; i += 3) {
      p.set(m.base[i], m.base[i + 1], m.base[i + 2]);
      // Thicken (or thin) the belly away from the humerus.
      const t = (p.y - elbow.y - 0.03) / span;
      if (t > 0 && t < 1 && bulge) {
        const s = THREE.MathUtils.clamp(p.clone().sub(elbow).dot(line), 0, lineLen);
        c.copy(elbow).addScaledVector(line, s);
        p.sub(c).multiplyScalar(1 + bulge * Math.sin(Math.PI * t) ** 1.5).add(c);
        // A contracting muscle also shortens towards its origin.
        p.addScaledVector(line, bulge * 0.05 * Math.sin(Math.PI * t * 0.5));
      }
      // The lower end goes with the forearm.
      const w = 1 - THREE.MathUtils.smoothstep(m.base[i + 1], elbow.y - 0.01, elbow.y + 0.06);
      if (w > 0 && angle) {
        q.setFromAxisAngle(axis, angle * w);
        p.sub(elbow).applyQuaternion(q).add(elbow);
      }
      arr[i] = p.x;
      arr[i + 1] = p.y;
      arr[i + 2] = p.z;
    }
    pos.needsUpdate = true;
    m.geo.computeVertexNormals();
  };

  // Lever: fulcrum at the elbow, the muscle's pull at its insertion, the load in the hand.
  const lever = new THREE.Group();
  lever.visible = false;
  parent.add(lever);
  const fulcrum = new THREE.Mesh(k.sphere, k.material({ color: "#f2c230", emissive: "#f2c230", emissiveIntensity: 0.5, depthTest: false }));
  fulcrum.renderOrder = 10;
  fulcrum.scale.setScalar(0.009);
  fulcrum.position.copy(elbow);
  lever.add(fulcrum);
  const effort = arrow(k, "#d63b2f");
  const weight = arrow(k, "#4b5a63");
  lever.add(effort.group, weight.group);
  const insertion = new THREE.Object3D();
  insertion.position.copy(elbow).add(v(-0.004, -0.04, 0.016));
  forearm.add(insertion);

  const labels = {
    tendon: k.anchor(forearm, elbow.clone().add(v(-0.006, -0.035, 0.02))),
    hand: k.anchor(forearm, hand.clone().add(v(0, 0.035, 0))),
    biceps: k.anchor(parent, v(-0.19, 1.26, 0.012)),
    triceps: k.anchor(parent, v(-0.195, 1.23, -0.065)),
    humerus: k.anchor(parent, v(-0.176, 1.32, -0.03)),
    radius: k.anchor(forearm, v(-0.25, 0.98, 0.0)),
    ulna: k.anchor(forearm, v(-0.215, 1.02, -0.03)),
    elbow: k.anchor(parent, elbow.clone().add(v(-0.012, 0, 0))),
  };

  let lastAngle = NaN;
  let lastBulge = NaN;
  const w1 = new THREE.Vector3();
  const w2 = new THREE.Vector3();
  /** Flex the elbow by `deg` degrees; `act` lights the muscle that is working. */
  const pose = (deg: number, act: { biceps: number; triceps: number }) => {
    const angle = THREE.MathUtils.degToRad(deg);
    pivot.quaternion.setFromAxisAngle(axis, angle);
    const bulge = 0.3 * (deg / 100) * (0.6 + 0.4 * act.biceps);
    if (angle !== lastAngle || bulge !== lastBulge) {
      deform(biceps, angle, bulge);
      deform(triceps, angle, -0.07 * (deg / 100));
      lastAngle = angle;
      lastBulge = bulge;
    }
    biceps.mat.emissiveIntensity = 0.45 * act.biceps;
    triceps.mat.emissiveIntensity = 0.45 * act.triceps;
    if (lever.visible) {
      pivot.updateMatrixWorld(true);
      insertion.getWorldPosition(w1);
      effort.set(w1, shoulder.clone().sub(w1), 0.11);
      load.getWorldPosition(w2);
      weight.set(w2.add(v(0, -0.032, 0)), v(0, -1, 0), 0.08);
    }
  };
  pose(0, { biceps: 0, triceps: 0 });

  return { elbow, pose, lever, load, labels, biceps, triceps };
}

/** Camera from the right side of the body, looking at the arm in profile. */
export const armShot = (zoom = 1, at?: V3): Shot => {
  const target = at ?? v(-0.2, 1.16, 0.03);
  return { target, pos: target.clone().add(v(-0.52, 0.06, 0.2).multiplyScalar(zoom)) };
};

/** 0 → 1 → 0 over `period` seconds, with a pause at the top. */
const cycle = (s: number, period: number) => {
  const f = (s % period) / period;
  return f < 0.4 ? ease(f / 0.4) : f < 0.6 ? 1 : 1 - ease((f - 0.6) / 0.4);
};

export const muscleJourney: Builder = async (k) => {
  const body = await k.body(false);
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0, 0.2, ["humerus", "radius", "ulna"]);
  const arm = armRig(k, body, g);
  const L = arm.labels;
  k.label(L.humerus, "მხრის ძვალი", { stages: [0] });
  k.label(L.radius, "სხივის ძვალი", { stages: [0] });
  k.label(L.ulna, "იდაყვის ძვალი", { stages: [0] });
  k.label(L.biceps, "ბიცეფსი — მხრის ორთავა კუნთი", { stages: [0, 1, 4] });
  k.label(L.triceps, "ტრიცეფსი — სამთავა კუნთი", { stages: [0, 4] });
  k.label(L.tendon, "მყესი", { stages: [2, 3] });
  k.label(L.elbow, "საყრდენი — იდაყვის სახსარი", { stages: [3] });
  k.label(L.hand, "ტვირთი", { stages: [3] });
  let prev = 0;

  return {
    stages: [
      {
        duration: 13,
        enter: () => {
          arm.lever.visible = false;
          arm.load.visible = false;
        },
        update: (u) => {
          arm.pose(0, { biceps: 0, triceps: 0 });
          const shot = armShot(1.15 - 0.15 * ease(u), v(-0.2, 1.2, 0.0));
          return shot;
        },
      },
      {
        duration: 15,
        update: (_u, s) => {
          const f = cycle(Math.max(0, s - 1), 6);
          arm.pose(100 * f, { biceps: f, triceps: 0 });
          return armShot(1.3, v(-0.2, 1.13, 0.07));
        },
      },
      {
        duration: 14,
        update: (_u, s) => {
          const f = cycle(s, 6);
          arm.pose(100 * f, { biceps: f, triceps: 0 });
          return armShot(0.6, v(-0.205, 1.12, 0.03));
        },
      },
      {
        duration: 16,
        enter: () => {
          arm.lever.visible = true;
          arm.load.visible = true;
        },
        update: (_u, s) => {
          const f = cycle(s, 7);
          arm.pose(95 * f, { biceps: f, triceps: 0 });
          return armShot(1.35, v(-0.21, 1.1, 0.09));
        },
      },
      {
        duration: 18,
        enter: () => {
          arm.lever.visible = false;
          arm.load.visible = false;
        },
        update: (_u, s, _t, dt) => {
          const f = cycle(s, 6);
          // Whichever muscle is shortening is the one working.
          const d = dt ? (f - prev) / dt : 0;
          prev = f;
          arm.pose(100 * f, { biceps: d > 0.02 ? 1 : f > 0.98 ? 0.6 : 0, triceps: d < -0.02 ? 1 : 0 });
          return armShot(1.3, v(-0.2, 1.15, 0.05));
        },
      },
    ],
  };
};

export const impulseJourney: Builder = async (k) => {
  const body = await k.body(true);
  const g = new THREE.Group();
  k.root.add(g);
  context(k, body, g, 0.05, 0.2, ["humerus", "radius", "ulna"]);
  const arm = armRig(k, body, g);
  const brainMat = k.material({ color: "#e8c7c0", roughness: 0.55, transparent: true, opacity: 0.95, sheen: 0.3, sheenColor: new THREE.Color("#ffffff") });
  const brain = layer(k, body, g, (p) => p.group === "brain" && p.id !== "FJ1800" && !/canal|tentorium/i.test(p.name), brainMat, 1);
  const gyrusMat = k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0.2, roughness: 0.45 });
  const gyrus = layer(k, body, g, (p) => p.id === "FJ1800", gyrusMat, 0);
  void brain;
  // The surface of the arm area: the gyrus's most lateral-upper point.
  const gp = gyrus.geometry.attributes.position as THREE.BufferAttribute;
  const out = v(1, 0.55, 0.1).normalize();
  const surface = new THREE.Vector3();
  let best = -Infinity;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < gp.count; i++) {
    tmp.fromBufferAttribute(gp, i);
    const d = tmp.dot(out);
    if (d > best) {
      best = d;
      surface.copy(tmp);
    }
  }
  const normal = surface.clone().sub(v(0, 1.64, -0.02)).normalize();
  const soma = surface.clone().addScaledVector(normal, -0.006);

  // Spinal cord (not in the atlas): a tube down the vertebral canal to L1–L2.
  const spine = body.data.spine.map(([x, y, z]) => v(x, y, z));
  const cordPts = [v(0.003, 1.572, -0.033), ...spine.slice(0, 21)];
  const cord = k.tube(cordPts, (t) => 0.0062 - 0.0022 * t, k.ghost("#efe1c2", 0.55, { side: THREE.DoubleSide }), g, 120, 16);
  cord.mesh.renderOrder = 2;
  const horn = spine[5].clone().add(v(-0.002, 0, 0.002));
  const P1 = new THREE.CatmullRomCurve3(
    [soma, soma.clone().addScaledVector(normal, -0.014), v(0.0191, 1.639, -0.0081), v(0.0115, 1.6166, -0.0097), v(0.0075, 1.5945, -0.0212), v(0.004, 1.576, -0.03), v(-0.001, 1.565, -0.036), ...spine.slice(0, 5).map((p) => p.clone().add(v(-0.003, 0, -0.001))), horn],
    false,
    "centripetal",
  );
  const P2 = new THREE.CatmullRomCurve3([horn, horn.clone().add(v(-0.01, -0.002, 0.004)), v(-0.03, 1.466, -0.04), v(-0.06, 1.45, -0.028), v(-0.1, 1.425, -0.018), v(-0.135, 1.395, -0.012), v(-0.16, 1.35, -0.006), v(-0.176, 1.29, 0.003), v(-0.188, 1.248, 0.01)], false, "centripetal");
  const tract = k.material({ color: "#f2c230", emissive: "#f2b400", emissiveIntensity: 0.25, roughness: 0.4 });
  k.tube(P1.getPoints(80), 0.0011, tract, g, 200, 6);
  k.tube(P2.getPoints(60), 0.0022, tract, g, 160, 8);
  // The two motor neurons' cell bodies.
  const somaMat = k.material({ color: "#7d5ba6", emissive: "#7d5ba6", emissiveIntensity: 0.2, roughness: 0.45 });
  const lower = new THREE.Mesh(k.sphere, somaMat);
  lower.scale.setScalar(0.0022);
  lower.position.copy(horn);
  g.add(lower);
  const neuron = pyramidalNeuron(k, somaMat);
  neuron.position.copy(soma);
  neuron.quaternion.setFromUnitVectors(v(0, 1, 0), normal);
  neuron.scale.setScalar(0.011);
  g.add(neuron);

  // The impulse: a glowing bead with a short tail.
  const glowTex = k.canvasTexture(64, 64, (ctx) => {
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,240,170,1)");
    gr.addColorStop(0.35, "rgba(255,210,63,0.6)");
    gr.addColorStop(1, "rgba(255,210,63,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, 64, 64);
  });
  const pulse = new THREE.Group();
  const halo = new THREE.Sprite(k.track(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })));
  halo.scale.setScalar(0.012);
  halo.renderOrder = 10;
  const bead = new THREE.Mesh(k.sphere, k.material({ color: "#fff3b0", emissive: "#ffd23f", emissiveIntensity: 1.2 }));
  bead.scale.setScalar(0.0022);
  pulse.add(halo, bead);
  g.add(pulse);
  const flash = new THREE.Sprite(k.track(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, opacity: 0 })));
  flash.renderOrder = 10;
  g.add(flash);
  const place = (curve: THREE.Curve<V3>, u: number) => {
    curve.getPointAt(THREE.MathUtils.clamp(u, 0, 1), pulse.position);
    return pulse.position.clone();
  };
  const burst = (at: V3, f: number, size: number) => {
    flash.position.copy(at);
    flash.scale.setScalar(size * (0.6 + f));
    (flash.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - f);
  };
  const near = (p: V3, dir: V3, dist: number): Shot => ({ target: p.clone(), pos: p.clone().addScaledVector(dir.clone().normalize(), dist) });

  const A = (o: THREE.Object3D, text: string, stages: number[]) => k.label(o, text, { stages });
  const at = (p: V3) => k.anchor(g, p);
  A(at(surface), "წინა ცენტრალური ხვეული — მამოძრავებელი ქერქი", [0]);
  A(at(v(0.0152, 1.59, -0.06)), "ნათხემი", [0]);
  A(at(v(0.008, 1.592, -0.018)), "ტვინის ღერო", [0]);
  A(at(v(0.05, 1.655, 0.02)), "მარცხენა ნახევარსფერო", [0]);
  A(k.anchor(neuron, v(0, 0, 0)), "ნეირონის სხეული", [1]);
  A(k.anchor(neuron, v(0.05, 1.6, 0)), "დენდრიტები", [1]);
  A(at(P1.getPointAt(0.12)), "აქსონი", [1]);
  A(at(v(-0.001, 1.565, -0.036)), "გზა გადადის მარჯვნივ", [2]);
  A(at(spine[2].clone().add(v(-0.006, 0, 0))), "ზურგის ტვინი", [2]);
  A(at(horn), "სინაფსი: მეორე ნეირონი (C5–C6)", [2, 3]);
  A(at(v(-0.06, 1.45, -0.028)), "მხრის წნული", [3]);
  A(at(v(-0.172, 1.31, 0.002)), "კუნთ-კანის ნერვი", [3]);
  A(at(v(-0.188, 1.248, 0.012)), "ნერვ-კუნთოვანი სინაფსი", [4]);
  k.label(arm.labels.biceps, "ბიცეფსი იკუმშება", { stages: [4] });

  const look = (o: number) => {
    brainMat.opacity = o;
    brainMat.depthWrite = o > 0.9;
    // Once we are inside, the gyrus turns see-through too so the neuron shows.
    gyrusMat.transparent = o < 0.9;
    gyrusMat.opacity = o < 0.9 ? 0.35 : 1;
    gyrusMat.depthWrite = o > 0.9;
    gyrusMat.needsUpdate = true;
  };

  return {
    stages: [
      {
        duration: 13,
        enter: () => look(0.95),
        update: (u, s) => {
          pulse.visible = false;
          gyrusMat.emissiveIntensity = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(s * 3));
          const a = 0.95 - 0.25 * ease(u);
          return { target: v(0.008, 1.635, -0.02), pos: v(0.008, 1.635, -0.02).add(v(Math.sin(a) * 0.3, 0.13, Math.cos(a) * 0.3)) };
        },
      },
      {
        duration: 15,
        enter: () => look(0.3),
        update: (u) => {
          pulse.visible = u > 0.25;
          const p = place(P1, 0.2 * ease((u - 0.25) / 0.75));
          gyrusMat.emissiveIntensity = 0.3;
          const target = soma.clone().lerp(p, ease((u - 0.3) / 0.7));
          return near(target, normal.clone().add(v(0.2, 0.1, 0.9)), 0.1);
        },
      },
      {
        duration: 16,
        enter: () => look(0.25),
        update: (u) => {
          pulse.visible = u < 0.9;
          const p = place(P1, 0.2 + 0.8 * ease(u / 0.88));
          burst(horn, Math.max(0, (u - 0.86) / 0.14), 0.03);
          return near(p, v(0.9, 0.2, -0.35), 0.2);
        },
      },
      {
        duration: 14,
        enter: () => look(0.25),
        update: (u) => {
          pulse.visible = true;
          (flash.material as THREE.SpriteMaterial).opacity = 0;
          const p = place(P2, ease(u));
          return near(p, v(-0.35, 0.3, 1), 0.17 + 0.05 * u);
        },
      },
      {
        duration: 16,
        enter: () => look(0.25),
        update: (_u, s) => {
          // The impulse arrives, the muscle contracts and holds, then relaxes and it starts again.
          const f = (s % 6) / 6;
          pulse.visible = f < 0.12;
          place(P2, 0.85 + 0.15 * (f / 0.12));
          burst(P2.getPointAt(1), Math.max(0, (f - 0.1) / 0.2), 0.035);
          const c = f < 0.12 ? 0 : f < 0.45 ? ease((f - 0.12) / 0.33) : f < 0.75 ? 1 : 1 - ease((f - 0.75) / 0.25);
          arm.pose(100 * c, { biceps: f < 0.75 ? Math.max(c, f > 0.1 ? 0.6 : 0) : 0, triceps: 0 });
          return armShot(1.05, v(-0.19, 1.2, 0.02));
        },
      },
    ],
  };
};

/** A pyramidal neuron in local units (soma at the origin, apex up): apical and basal dendrites, axon down. */
function pyramidalNeuron(k: Kit, mat: THREE.Material) {
  const n = new THREE.Group();
  const soma = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.28, 0.75, 20)), mat);
  n.add(soma);
  const branch = (pts: V3[], r: number) => k.tube(pts, (t) => r * (1 - 0.7 * t), mat, n, 24, 6);
  branch([v(0, 0.3, 0), v(0.05, 1, 0.02), v(-0.05, 1.8, 0), v(0, 2.6, 0.05)], 0.07);
  branch([v(0, 1.1, 0), v(0.45, 1.6, 0.1), v(0.7, 2.1, 0.2)], 0.035);
  branch([v(0, 1.5, 0), v(-0.4, 2.0, -0.1), v(-0.6, 2.4, -0.2)], 0.035);
  branch([v(0, 2.2, 0), v(0.3, 2.7, 0.1)], 0.03);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    branch([v(Math.cos(a) * 0.2, -0.2, Math.sin(a) * 0.2), v(Math.cos(a) * 0.7, -0.45, Math.sin(a) * 0.7), v(Math.cos(a + 0.4) * 1.1, -0.6, Math.sin(a + 0.4) * 1.1)], 0.04);
  }
  return n;
}
