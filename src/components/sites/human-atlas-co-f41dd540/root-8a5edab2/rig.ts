import * as THREE from "three";
import type { AtlasManifest, AtlasPart } from "./atlas-data";

/**
 * A simple rigid-body rig built from the BodyParts3D bones.
 * Every mesh belongs to one body segment; segments rotate around real joint centres
 * (shoulder, elbow, wrist, hip, knee, ankle, neck, lumbar spine) using forward kinematics.
 */

export type Segment =
  | "root"
  | "upperBody"
  | "head"
  | "upperArmL"
  | "forearmL"
  | "handL"
  | "upperArmR"
  | "forearmR"
  | "handR"
  | "thighL"
  | "shinL"
  | "footL"
  | "thighR"
  | "shinR"
  | "footR";

/** Parent-before-child order, so matrices can be computed in one pass. */
export const SEGMENTS: Segment[] = [
  "root",
  "upperBody",
  "head",
  "upperArmL",
  "forearmL",
  "handL",
  "upperArmR",
  "forearmR",
  "handR",
  "thighL",
  "shinL",
  "footL",
  "thighR",
  "shinR",
  "footR",
];

export const PARENT: Record<Segment, Segment | null> = {
  root: null,
  upperBody: "root",
  head: "upperBody",
  upperArmL: "upperBody",
  forearmL: "upperArmL",
  handL: "forearmL",
  upperArmR: "upperBody",
  forearmR: "upperArmR",
  handR: "forearmR",
  thighL: "root",
  shinL: "thighL",
  footL: "shinL",
  thighR: "root",
  shinR: "thighR",
  footR: "shinR",
};

export type PoseKey =
  | "standing"
  | "armsUp"
  | "tPose"
  | "sitting"
  | "squat"
  | "bendForward"
  | "walk"
  | "wave"
  | "jumpingJack"
  | "squatExercise";

export const STATIC_POSES: PoseKey[] = ["standing", "armsUp", "tPose", "sitting", "squat", "bendForward"];
export const ANIMATED_POSES: PoseKey[] = ["walk", "wave", "jumpingJack", "squatExercise"];

interface LimbJoints {
  shoulder: THREE.Vector3;
  elbow: THREE.Vector3;
  wrist: THREE.Vector3;
  hip: THREE.Vector3;
  knee: THREE.Vector3;
  ankle: THREE.Vector3;
}

export interface Rig {
  pivots: Record<Segment, THREE.Vector3>;
  restAnkleY: number;
  segmentOf: (part: AtlasPart) => Segment;
  joints: { L: LimbJoints; R: LimbJoints; neck: THREE.Vector3; waist: THREE.Vector3 };
}

/** Index of each segment in the shader's matrix array; slot 15 is always identity. */
export const SEGMENT_INDEX = Object.fromEntries(SEGMENTS.map((s, i) => [s, i])) as Record<Segment, number>;
export const IDENTITY_SLOT = 15;

type Box = { min: THREE.Vector3; max: THREE.Vector3 };

function sideOf(part: AtlasPart): "L" | "R" | null {
  if (/\bleft\b/i.test(part.name)) return "L";
  if (/\bright\b/i.test(part.name)) return "R";
  const x = (part.bounds[0][0] + part.bounds[1][0]) / 2;
  return Math.abs(x) > 0.02 ? (x > 0 ? "L" : "R") : null;
}

const HAND = /metacarpal|phalanx of .*(finger|thumb)|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate/i;
const FOREARM = /\bradius\b|\bulna\b|interosseous membrane of .*forearm/i;
const UPPER_ARM = /humerus/i;
const FOOT = /metatarsal|phalanx of .*toe|calcaneus|talus|cuboid|cuneiform|navicular bone of .*foot|sesamoid bone of .*foot|calcaneal tendon|long plantar/i;
const SHIN = /\btibia\b|\bfibula\b|patella|interosseous membrane of .*leg/i;
const THIGH = /femur/i;
const HEAD = /frontal bone|parietal bone|occipital bone|temporal bone|sphenoid|ethmoid|nasal bone|maxilla|zygomatic|mandible|vomer|palatine|lacrimal|tooth|gingiva/i;

export function buildRig(manifest: AtlasManifest): Rig {
  const boxes = new Map<string, Box>();
  for (const p of manifest.parts) {
    const key = p.name.toLowerCase();
    if (boxes.has(key)) continue;
    boxes.set(key, { min: new THREE.Vector3(...p.bounds[0]), max: new THREE.Vector3(...p.bounds[1]) });
  }
  const box = (name: string): Box | undefined => boxes.get(name);
  const mid = (b: Box) => b.min.clone().add(b.max).multiplyScalar(0.5);

  const limb = (side: "L" | "R") => {
    const s = side === "L" ? 1 : -1;
    const n = side === "L" ? "left" : "right";
    const hum = box(`${n} humerus`);
    const uln = box(`${n} ulna`);
    const rad = box(`${n} radius`);
    const fem = box(`${n} femur`);
    const tib = box(`${n} tibia`);
    const medial = (b: Box) => (side === "L" ? b.min.x : b.max.x);
    const shoulder = hum
      ? new THREE.Vector3(medial(hum) + s * 0.03, hum.max.y - 0.025, mid(hum).z)
      : new THREE.Vector3(s * 0.17, 1.39, -0.025);
    const elbow = uln
      ? new THREE.Vector3(mid(uln).x, uln.max.y - 0.012, mid(uln).z)
      : new THREE.Vector3(s * 0.22, 1.12, -0.03);
    const wrist = rad
      ? new THREE.Vector3(mid(rad).x, rad.min.y + 0.006, mid(rad).z)
      : new THREE.Vector3(s * 0.27, 0.86, 0);
    const hip = fem
      ? new THREE.Vector3(medial(fem) + s * 0.045, fem.max.y - 0.035, mid(fem).z + 0.01)
      : new THREE.Vector3(s * 0.08, 0.88, -0.01);
    const knee = fem
      ? new THREE.Vector3(mid(fem).x + s * 0.02, fem.min.y + 0.02, mid(fem).z)
      : new THREE.Vector3(s * 0.08, 0.47, -0.02);
    const ankle = tib
      ? new THREE.Vector3(mid(tib).x, tib.min.y + 0.015, mid(tib).z)
      : new THREE.Vector3(s * 0.08, 0.07, -0.03);
    return { shoulder, elbow, wrist, hip, knee, ankle };
  };

  const L = limb("L");
  const R = limb("R");
  const atlas = box("atlas");
  const lumbar = box("third lumbar vertebra");
  const neck = atlas ? new THREE.Vector3(0, atlas.min.y, mid(atlas).z) : new THREE.Vector3(0, 1.54, -0.035);
  const waist = lumbar ? new THREE.Vector3(0, mid(lumbar).y, mid(lumbar).z + 0.02) : new THREE.Vector3(0, 1.067, -0.01);

  const pivots: Record<Segment, THREE.Vector3> = {
    root: new THREE.Vector3(),
    upperBody: waist,
    head: neck,
    upperArmL: L.shoulder,
    forearmL: L.elbow,
    handL: L.wrist,
    upperArmR: R.shoulder,
    forearmR: R.elbow,
    handR: R.wrist,
    thighL: L.hip,
    shinL: L.knee,
    footL: L.ankle,
    thighR: R.hip,
    shinR: R.knee,
    footR: R.ankle,
  };

  const segmentOf = (part: AtlasPart): Segment => {
    const side = sideOf(part);
    const c = new THREE.Vector3(...part.bounds[0]).add(new THREE.Vector3(...part.bounds[1])).multiplyScalar(0.5);
    const J = side === "R" ? R : L;
    const S = side === "R" ? "R" : "L";

    // Bones and connective tissue: assign by name (precise).
    if (part.system === "skeletal" || part.system === "connective") {
      if (side && HAND.test(part.name)) return `hand${S}`;
      if (side && FOREARM.test(part.name)) return `forearm${S}`;
      if (side && UPPER_ARM.test(part.name)) return `upperArm${S}`;
      if (side && FOOT.test(part.name)) return `foot${S}`;
      if (side && SHIN.test(part.name)) return `shin${S}`;
      if (side && THIGH.test(part.name)) return `thigh${S}`;
      if (HEAD.test(part.name)) return "head";
    }

    // Everything else: assign by where its centre lies relative to the joints.
    if (c.y >= neck.y - 0.01 && Math.abs(c.x) < 0.13) return "head";
    if (side && Math.abs(c.x) > 0.185 && c.y > 0.6 && c.y < J.shoulder.y + 0.06) {
      if (c.y > J.elbow.y) return `upperArm${S}`;
      if (c.y > J.wrist.y) return `forearm${S}`;
      return `hand${S}`;
    }
    if (side && c.y < J.hip.y - 0.02 && Math.abs(c.x) > 0.035) {
      if (c.y > J.knee.y) return `thigh${S}`;
      if (c.y > J.ankle.y) return `shin${S}`;
      return `foot${S}`;
    }
    return c.y > waist.y ? "upperBody" : "root";
  };

  return { pivots, restAnkleY: Math.min(L.ankle.y, R.ankle.y), segmentOf, joints: { L, R, neck, waist } };
}

// ---- Soft-tissue skinning ------------------------------------------------------------------------

/**
 * Drop triangles that bridge two body parts that are not joined by a joint (e.g. where the resting
 * forearm touched the hip in the scan). When the arm lifts they would stretch into long slivers.
 */
export function removeBridgeTriangles(indices: Uint32Array, segIndex: Uint8Array, segWeight: Uint8Array): Uint32Array {
  const joined = (a: number, b: number) => {
    if (a === b) return true;
    const sa = SEGMENTS[a];
    const sb = SEGMENTS[b];
    return PARENT[sa] === sb || PARENT[sb] === sa;
  };
  const keep: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    let ok = true;
    for (let i = 0; i < 3 && ok; i++) {
      for (let j = i + 1; j < 3; j++) {
        const u = indices[t + i];
        const v = indices[t + j];
        const su = segIndex[u * 4];
        const sv = segIndex[v * 4];
        if (segWeight[u * 4] > 150 && segWeight[v * 4] > 150 && !joined(su, sv)) {
          ok = false;
          break;
        }
      }
    }
    if (ok) keep.push(indices[t], indices[t + 1], indices[t + 2]);
  }
  return keep.length === indices.length ? indices : Uint32Array.from(keep);
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Per-vertex segment weights for soft tissue (skin, muscles, vessels, organs), blended across
 * each joint so the surface bends smoothly instead of tearing. Up to four segments per vertex.
 */
export function skinWeights(
  rig: Rig,
  positions: Float32Array,
  indices: Uint32Array,
): { index: Uint8Array; weight: Uint8Array; indices: Uint32Array } {
  const count = positions.length / 3;
  const index = new Uint8Array(count * 4);
  const weight = new Uint8Array(count * 4);
  const { neck, waist } = rig.joints;
  const w = new Float32Array(SEGMENTS.length);
  const raw = new Float32Array(count * SEGMENTS.length);
  const order: number[] = [];

  // Arm "capsules": distance to the bone line decides what follows the arm. Using distance (not
  // sideways position) keeps hip skin that touches the hanging hand attached to the body.
  // `medial` radii apply on the body-facing side, so the chest wall and hips stay with the trunk.
  type Capsule = { a: THREE.Vector3; b: THREE.Vector3; rin: number; rout: number; medial?: [number, number] };
  const capsules = (side: "L" | "R"): Capsule[] => {
    const J = rig.joints[side];
    const tip = J.wrist.clone().add(J.wrist.clone().sub(J.elbow).setLength(0.25));
    return [
      { a: J.shoulder, b: J.elbow, rin: 0.058, rout: 0.08, medial: [0.038, 0.05] },
      { a: J.elbow, b: J.wrist, rin: 0.055, rout: 0.075, medial: [0.035, 0.048] },
      { a: J.wrist, b: tip, rin: 0.075, rout: 0.1, medial: [0.045, 0.06] },
    ];
  };
  const legCapsules = (side: "L" | "R"): Capsule[] => {
    const J = rig.joints[side];
    const toe = J.ankle.clone().add(new THREE.Vector3(0, -0.05, 0.2));
    return [
      { a: J.hip, b: J.knee, rin: 0.1, rout: 0.14 },
      { a: J.knee, b: J.ankle, rin: 0.07, rout: 0.1 },
      { a: J.ankle, b: toe, rin: 0.07, rout: 0.1 },
    ];
  };
  const arm = { L: capsules("L"), R: capsules("R") };
  const leg = { L: legCapsules("L"), R: legCapsules("R") };
  const ab = new THREE.Vector3();
  const ap = new THREE.Vector3();
  const pt = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const segDist = (c: Capsule) => {
    ab.subVectors(c.b, c.a);
    ap.subVectors(pt, c.a);
    const t = Math.min(1, Math.max(0, ap.dot(ab) / ab.lengthSq()));
    closest.copy(c.a).addScaledVector(ab, t);
    return ap.addScaledVector(ab, -t).length();
  };
  /** 1 inside the capsule, fading to 0 at its edge; tighter on the side facing the body. */
  const influence = (c: Capsule) => {
    const d = segDist(c);
    const towardBody = c.medial && Math.abs(pt.x) < Math.abs(closest.x);
    const [rin, rout] = towardBody && c.medial ? c.medial : [c.rin, c.rout];
    return 1 - smooth(rin, rout, d);
  };

  for (let v = 0; v < count; v++) {
    const x = positions[v * 3];
    const y = positions[v * 3 + 1];
    const ax = Math.abs(x);
    const S = x >= 0 ? "L" : "R";
    const J = rig.joints[S];
    w.fill(0);

    // How much of this vertex belongs to the arm / leg / trunk.
    pt.set(x, y, positions[v * 3 + 2]);
    let near = 0;
    for (const c of arm[S]) near = Math.max(near, influence(c));
    // Never let the arm grab the chest or belly near the midline.
    let armness = near * smooth(0.09, 0.13, ax);
    // Below the wrist and further out than the thighs, it can only be the hand (fingertips included).
    if (y < J.wrist.y) armness = Math.max(armness, smooth(0.19, 0.215, ax));
    // Legs: near the leg bones (so hanging hands are not dragged along) and below the hip joint.
    let legNear = 0;
    for (const c of leg[S]) legNear = Math.max(legNear, influence(c));
    const legness = legNear * (1 - smooth(J.hip.y - 0.12, J.hip.y + 0.02, y)) * smooth(0.015, 0.05, ax) * (1 - armness);
    const body = Math.max(0, 1 - armness - legness);

    if (armness > 0) {
      const upper = smooth(J.elbow.y - 0.035, J.elbow.y + 0.035, y);
      const hand = 1 - smooth(J.wrist.y - 0.025, J.wrist.y + 0.02, y);
      w[SEGMENT_INDEX[`upperArm${S}`]] += armness * upper;
      w[SEGMENT_INDEX[`forearm${S}`]] += armness * (1 - upper) * (1 - hand);
      w[SEGMENT_INDEX[`hand${S}`]] += armness * (1 - upper) * hand;
    }
    if (legness > 0) {
      const thigh = smooth(J.knee.y - 0.04, J.knee.y + 0.04, y);
      const foot = 1 - smooth(J.ankle.y - 0.02, J.ankle.y + 0.03, y);
      w[SEGMENT_INDEX[`thigh${S}`]] += legness * thigh;
      w[SEGMENT_INDEX[`shin${S}`]] += legness * (1 - thigh) * (1 - foot);
      w[SEGMENT_INDEX[`foot${S}`]] += legness * (1 - thigh) * foot;
    }
    if (body > 0) {
      const head = ax < 0.15 ? smooth(neck.y - 0.02, neck.y + 0.03, y) : 0;
      const upper = smooth(waist.y - 0.09, waist.y + 0.09, y);
      w[SEGMENT_INDEX.head] += body * head;
      w[SEGMENT_INDEX.upperBody] += body * (1 - head) * upper;
      w[SEGMENT_INDEX.root] += body * (1 - head) * (1 - upper);
    }

    raw.set(w, v * SEG_COUNT);
  }

  // 1. Drop triangles that bridge unjoined parts (e.g. resting hand touching the hip in the scan),
  //    both so they cannot stretch and so smoothing cannot leak weights across them.
  const cleaned = dropBridges(indices, raw);

  // 2. Smooth the weights across the surface (Laplacian diffusion) so the skin bends gradually
  //    at the joints instead of tearing where the classification changes abruptly.
  smoothOverMesh(raw, cleaned, count, 14);

  // 3. Keep the four strongest influences and quantise to bytes that sum to 255.
  for (let v = 0; v < count; v++) {
    const base = v * SEG_COUNT;
    order.length = 0;
    for (let i = 0; i < SEG_COUNT; i++) if (raw[base + i] > 0.002) order.push(i);
    order.sort((a, b) => raw[base + b] - raw[base + a]);
    const n = Math.min(4, order.length);
    let total = 0;
    for (let k = 0; k < n; k++) total += raw[base + order[k]];
    let used = 0;
    for (let k = 0; k < 4; k++) {
      const o = v * 4 + k;
      if (k < n) {
        index[o] = order[k];
        // Clamp so the bytes can never sum past 255 (an overflow would wrap and fling the vertex away).
        const q = Math.max(0, Math.min(255 - used, k === n - 1 ? 255 - used : Math.round((raw[base + order[k]] / total) * 255)));
        weight[o] = q;
        used += q;
      } else {
        index[o] = IDENTITY_SLOT;
        weight[o] = 0;
      }
    }
    if (n === 0) {
      index[v * 4] = SEGMENT_INDEX.root;
      weight[v * 4] = 255;
    }
  }
  return { index, weight, indices: cleaned };
}

const SEG_COUNT = SEGMENTS.length;

function dominant(raw: Float32Array, v: number): [number, number] {
  let best = 0;
  let bestW = -1;
  let sum = 0;
  for (let i = 0; i < SEG_COUNT; i++) {
    const x = raw[v * SEG_COUNT + i];
    sum += x;
    if (x > bestW) {
      bestW = x;
      best = i;
    }
  }
  return [best, sum > 0 ? bestW / sum : 0];
}

function dropBridges(indices: Uint32Array, raw: Float32Array): Uint32Array {
  const joined = (a: number, b: number) => a === b || PARENT[SEGMENTS[a]] === SEGMENTS[b] || PARENT[SEGMENTS[b]] === SEGMENTS[a];
  const keep: number[] = [];
  for (let t = 0; t < indices.length; t += 3) {
    const d = [dominant(raw, indices[t]), dominant(raw, indices[t + 1]), dominant(raw, indices[t + 2])];
    let ok = true;
    for (let i = 0; i < 3 && ok; i++)
      for (let j = i + 1; j < 3; j++)
        if (d[i][1] > 0.6 && d[j][1] > 0.6 && !joined(d[i][0], d[j][0])) {
          ok = false;
          break;
        }
    if (ok) keep.push(indices[t], indices[t + 1], indices[t + 2]);
  }
  return keep.length === indices.length ? indices : Uint32Array.from(keep);
}

function smoothOverMesh(raw: Float32Array, indices: Uint32Array, count: number, iterations: number) {
  // Compressed adjacency lists built from the triangle edges.
  const degree = new Uint32Array(count + 1);
  for (let t = 0; t < indices.length; t += 3)
    for (let i = 0; i < 3; i++) degree[indices[t + i]] += 2;
  const start = new Uint32Array(count + 1);
  for (let v = 0; v < count; v++) start[v + 1] = start[v] + degree[v];
  const fill = start.slice(0, count);
  const nbr = new Uint32Array(start[count]);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t];
    const b = indices[t + 1];
    const c = indices[t + 2];
    nbr[fill[a]++] = b;
    nbr[fill[a]++] = c;
    nbr[fill[b]++] = a;
    nbr[fill[b]++] = c;
    nbr[fill[c]++] = a;
    nbr[fill[c]++] = b;
  }
  let src: Float32Array = raw;
  let dst: Float32Array = new Float32Array(raw.length);
  for (let it = 0; it < iterations; it++) {
    for (let v = 0; v < count; v++) {
      const s = start[v];
      const e = start[v + 1];
      const base = v * SEG_COUNT;
      if (e === s) {
        for (let i = 0; i < SEG_COUNT; i++) dst[base + i] = src[base + i];
        continue;
      }
      const inv = 1 / (e - s);
      for (let i = 0; i < SEG_COUNT; i++) {
        let acc = 0;
        for (let k = s; k < e; k++) acc += src[nbr[k] * SEG_COUNT + i];
        dst[base + i] = 0.5 * src[base + i] + 0.5 * acc * inv;
      }
    }
    const tmp = src;
    src = dst;
    dst = tmp;
  }
  if (src !== raw) raw.set(src);
}

// ---- Poses -----------------------------------------------------------------------------------------

type Angles = Partial<Record<Segment, [number, number, number]>>;

/** Anatomical helpers: all angles in degrees, positive = the movement named. */
class PoseBuilder {
  a: Angles = {};
  private add(seg: Segment, x: number, y: number, z: number) {
    const cur = this.a[seg] ?? [0, 0, 0];
    this.a[seg] = [cur[0] + x, cur[1] + y, cur[2] + z];
    return this;
  }
  shoulderFlex(side: "L" | "R", d: number) {
    return this.add(`upperArm${side}`, -d, 0, 0);
  }
  shoulderAbduct(side: "L" | "R", d: number) {
    return this.add(`upperArm${side}`, 0, 0, side === "L" ? d : -d);
  }
  elbowFlex(side: "L" | "R", d: number) {
    return this.add(`forearm${side}`, -d, 0, 0);
  }
  forearmSwing(side: "L" | "R", d: number) {
    return this.add(`forearm${side}`, 0, 0, side === "L" ? d : -d);
  }
  hipFlex(side: "L" | "R", d: number) {
    return this.add(`thigh${side}`, -d, 0, 0);
  }
  hipAbduct(side: "L" | "R", d: number) {
    return this.add(`thigh${side}`, 0, 0, side === "L" ? d : -d);
  }
  kneeFlex(side: "L" | "R", d: number) {
    return this.add(`shin${side}`, d, 0, 0);
  }
  ankleDorsiflex(side: "L" | "R", d: number) {
    return this.add(`foot${side}`, -d, 0, 0);
  }
  trunkBend(d: number) {
    return this.add("upperBody", d, 0, 0);
  }
  headNod(d: number) {
    return this.add("head", d, 0, 0);
  }
  headTurn(d: number) {
    return this.add("head", 0, d, 0);
  }
  both(fn: (b: PoseBuilder, side: "L" | "R") => void) {
    fn(this, "L");
    fn(this, "R");
    return this;
  }
}

const SIDES = ["L", "R"] as const;

/** Joint angles for a pose at time t (seconds). Animated poses loop over time. */
export function evaluatePose(key: PoseKey, t: number): Angles {
  const b = new PoseBuilder();
  const TAU = Math.PI * 2;
  switch (key) {
    case "standing":
      break;
    case "armsUp":
      b.both((p, s) => p.shoulderAbduct(s, 150).elbowFlex(s, 8));
      break;
    case "tPose":
      b.both((p, s) => p.shoulderAbduct(s, 88));
      break;
    case "sitting":
      b.both((p, s) => p.hipFlex(s, 90).kneeFlex(s, 90).shoulderFlex(s, 20).elbowFlex(s, 65));
      break;
    case "squat":
      b.both((p, s) => p.hipFlex(s, 115).kneeFlex(s, 125).ankleDorsiflex(s, 28).shoulderFlex(s, 85));
      b.trunkBend(30);
      break;
    case "bendForward":
      b.trunkBend(75).headNod(10);
      b.both((p, s) => p.shoulderFlex(s, 72).hipFlex(s, 10));
      break;
    case "walk": {
      const phase = (t / 1.15) * TAU;
      for (const s of SIDES) {
        const ph = s === "L" ? phase : phase + Math.PI;
        const swing = Math.sin(ph);
        const forward = Math.max(0, Math.cos(ph));
        b.hipFlex(s, 24 * swing)
          .kneeFlex(s, 6 + 48 * forward * forward)
          .ankleDorsiflex(s, 10 * forward)
          .shoulderFlex(s, -20 * swing)
          .elbowFlex(s, 18 + 12 * Math.max(0, -swing));
      }
      b.headTurn(3 * Math.sin(phase));
      break;
    }
    case "wave": {
      const w = Math.sin((t / 0.55) * TAU);
      b.shoulderAbduct("R", 135).elbowFlex("R", 25).forearmSwing("R", 22 * w);
      b.shoulderAbduct("L", 6);
      b.headTurn(-12).headNod(-4);
      break;
    }
    case "jumpingJack": {
      const open = 0.5 - 0.5 * Math.cos((t / 1.1) * TAU);
      b.both((p, s) => p.shoulderAbduct(s, 8 + 140 * open).hipAbduct(s, 2 + 14 * open).kneeFlex(s, 10 * (1 - open)));
      break;
    }
    case "squatExercise": {
      const down = 0.5 - 0.5 * Math.cos((t / 2.6) * TAU);
      b.both((p, s) =>
        p
          .hipFlex(s, 105 * down)
          .kneeFlex(s, 115 * down)
          .ankleDorsiflex(s, 25 * down)
          .shoulderFlex(s, 85 * down),
      );
      b.trunkBend(28 * down);
      break;
    }
  }
  return b.a;
}

const tmpEuler = new THREE.Euler();
const tmpQ = new THREE.Quaternion();
const tA = new THREE.Matrix4();
const tR = new THREE.Matrix4();
const tB = new THREE.Matrix4();

export function anglesToQuaternion(angles: [number, number, number] | undefined, out: THREE.Quaternion) {
  if (!angles) return out.identity();
  const d = THREE.MathUtils.degToRad;
  tmpEuler.set(d(angles[0]), d(angles[1]), d(angles[2]), "XYZ");
  return out.setFromEuler(tmpEuler);
}

/** Forward kinematics: world matrix of every segment for the given rotations and root offset. */
export function solveSegments(
  rig: Rig,
  rotations: Record<Segment, THREE.Quaternion>,
  rootOffset: THREE.Vector3,
  out: Record<Segment, THREE.Matrix4>,
) {
  for (const seg of SEGMENTS) {
    const p = rig.pivots[seg];
    tA.makeTranslation(p.x, p.y, p.z);
    tR.makeRotationFromQuaternion(tmpQ.copy(rotations[seg]));
    tB.makeTranslation(-p.x, -p.y, -p.z);
    const local = out[seg].copy(tA).multiply(tR).multiply(tB);
    const parent = PARENT[seg];
    if (parent) local.premultiply(out[parent]);
    else local.premultiply(tA.makeTranslation(rootOffset.x, rootOffset.y, rootOffset.z));
  }
}

/** Vertical shift that keeps the lowest ankle at its resting height (feet stay on the floor). */
export function groundOffset(rig: Rig, matrices: Record<Segment, THREE.Matrix4>) {
  const l = rig.pivots.footL.clone().applyMatrix4(matrices.footL);
  const r = rig.pivots.footR.clone().applyMatrix4(matrices.footR);
  return rig.restAnkleY - Math.min(l.y, r.y);
}
