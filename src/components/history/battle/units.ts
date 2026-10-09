import * as THREE from "three";
import { v, type Kit, type V3 } from "@/components/journeys/JourneyScene";
import { along, blob, BoneSet, box, keys, limb, Parts, rowMatrix, solveRig, TINT, type Pose, type RigJoint } from "./crowd";

/*
 * The soldiers of 1121 and their horses. Horse: Quaternius' "Horse" (CC0), baked by scripts/history/bake-horse.mjs
 * into three levels of detail and seven animation clips. People are built from simple solids on a 14-joint
 * skeleton: mail or kaftan, the conical nasal helmet (Georgian and Frankish), the Turkic spiked helmet with
 * turban, the Kipchak fur cap; kite or round shields, lances, spears, swords and recurve bows.
 */

// ---- Horse data --------------------------------------------------------------------------------------------

interface HorseMeta {
  joints: number;
  jointNames: string[];
  jointPos: [number, number, number][];
  attach: number;
  rows: number;
  clips: { name: string; row: number; frames: number; duration: number; loop: boolean }[];
  arrays: Record<string, { offset: number; length: number }>;
}

export interface HorseData {
  joints: number;
  attach: number;
  head: number;
  bones: Float32Array;
  clips: Map<string, { row: number; frames: number; fps: number; loop: boolean }>;
  lods: THREE.BufferGeometry[];
}

const HORSE_VERSION = "2026-10-08b";

export async function loadHorse(): Promise<HorseData> {
  const [meta, buf] = await Promise.all([
    fetch(`/history/horse.json?v=${HORSE_VERSION}`).then((r) => r.json() as Promise<HorseMeta>),
    fetch(`/history/horse.bin.gz?v=${HORSE_VERSION}`).then((r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()),
  ]);
  const arr = <T extends Float32Array | Uint8Array | Uint16Array>(name: string, C: { new (b: ArrayBuffer, o: number, l: number): T }) => {
    const a = meta.arrays[name];
    return new C(buf, a.offset, a.length);
  };
  const half = arr("bones", Uint16Array);
  const bones = new Float32Array(half.length);
  for (let i = 0; i < half.length; i++) bones[i] = THREE.DataUtils.fromHalfFloat(half[i]);
  const lods = ["lod0", "lod1", "lod2"].map((n) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr(`${n}.position`, Float32Array).slice(), 3));
    g.setAttribute("normal", new THREE.BufferAttribute(arr(`${n}.normal`, Float32Array).slice(), 3));
    g.setAttribute("color", new THREE.BufferAttribute(arr(`${n}.color`, Float32Array).slice(), 3));
    g.setAttribute("aJoints", new THREE.BufferAttribute(arr(`${n}.skinIndex`, Uint8Array).slice(), 4));
    g.setAttribute("aWeights", new THREE.BufferAttribute(arr(`${n}.skinWeight`, Uint8Array).slice(), 4, true));
    const part = arr(`${n}.part`, Uint8Array);
    const count = part.length;
    const mat = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Coat, mane and tail take the instance's colours; muzzle, hooves and eyes keep their own.
      mat[i * 3] = 0;
      mat[i * 3 + 1] = part[i] === 1 ? 0.58 : part[i] === 2 ? 0.8 : 0.4;
      mat[i * 3 + 2] = part[i] === 1 ? TINT.coat : part[i] === 2 ? TINT.hair : TINT.none;
    }
    g.setAttribute("aMat", new THREE.BufferAttribute(mat, 3));
    g.setIndex(new THREE.BufferAttribute(arr(`${n}.index`, Uint16Array).slice(), 1));
    return g;
  });
  const clips = new Map(meta.clips.map((c) => [c.name, { row: c.row, frames: c.frames, fps: c.frames / c.duration, loop: c.loop }]));
  return { joints: meta.joints, attach: meta.attach, head: meta.jointNames.indexOf("Head"), bones, clips, lods };
}

// ---- People: skeleton and body -------------------------------------------------------------------------------

/** Joints of the people's skeleton. */
export const J = { pelvis: 0, torso: 1, head: 2, uaR: 3, faR: 4, uaL: 5, faL: 6, lance: 7, sword: 8, bow: 9, thighR: 10, shinR: 11, thighL: 12, shinL: 13 } as const;

interface BodyPoints {
  pelvis: V3;
  waist: V3;
  neck: V3;
  headC: V3;
  shoulderR: V3;
  elbowR: V3;
  wristR: V3;
  shoulderL: V3;
  elbowL: V3;
  wristL: V3;
  hipR: V3;
  kneeR: V3;
  ankleR: V3;
  toeR: V3;
  hipL: V3;
  kneeL: V3;
  ankleL: V3;
  toeL: V3;
}

const mirror = (p: V3) => v(-p.x, p.y, p.z);

function points(r: Omit<BodyPoints, "shoulderL" | "elbowL" | "wristL" | "hipL" | "kneeL" | "ankleL" | "toeL">): BodyPoints {
  return { ...r, shoulderL: mirror(r.shoulderR), elbowL: mirror(r.elbowR), wristL: mirror(r.wristR), hipL: mirror(r.hipR), kneeL: mirror(r.kneeR), ankleL: mirror(r.ankleR), toeL: mirror(r.toeR) };
}

/** A rider in the saddle, in the horse's frame (horse faces +z; the rider's right is −x). */
const SEATED = points({
  pelvis: v(0, 1.63, -0.15),
  waist: v(0, 1.7, -0.15),
  neck: v(0, 2.17, -0.13),
  headC: v(0, 2.3, -0.11),
  shoulderR: v(-0.2, 2.1, -0.14),
  elbowR: v(-0.25, 1.85, -0.06),
  wristR: v(-0.2, 1.74, 0.15),
  hipR: v(-0.12, 1.61, -0.12),
  kneeR: v(-0.27, 1.33, 0.12),
  ankleR: v(-0.28, 0.97, 0.03),
  toeR: v(-0.28, 0.93, 0.17),
});

/** A man on foot, facing +z, feet on y = 0. */
const STANDING = points({
  pelvis: v(0, 0.95, 0),
  waist: v(0, 1.02, 0),
  neck: v(0, 1.5, 0.01),
  headC: v(0, 1.63, 0.02),
  shoulderR: v(-0.2, 1.43, 0),
  elbowR: v(-0.24, 1.15, -0.02),
  wristR: v(-0.22, 1.02, 0.22),
  hipR: v(-0.1, 0.92, 0),
  kneeR: v(-0.11, 0.5, 0.02),
  ankleR: v(-0.11, 0.09, -0.01),
  toeR: v(-0.11, 0.03, 0.14),
});

function rig(P: BodyPoints): RigJoint[] {
  return [
    { parent: -1, pivot: P.pelvis },
    { parent: J.pelvis, pivot: P.waist },
    { parent: J.torso, pivot: P.neck },
    { parent: J.torso, pivot: P.shoulderR },
    { parent: J.uaR, pivot: P.elbowR },
    { parent: J.torso, pivot: P.shoulderL },
    { parent: J.uaL, pivot: P.elbowL },
    { parent: J.faR, pivot: P.wristR },
    { parent: J.faR, pivot: P.wristR },
    { parent: J.faL, pivot: P.wristL },
    { parent: J.pelvis, pivot: P.hipR },
    { parent: J.thighR, pivot: P.kneeR },
    { parent: J.pelvis, pivot: P.hipL },
    { parent: J.thighL, pivot: P.kneeL },
  ];
}

export interface Look {
  armour: "mail" | "lamellar" | "kaftan" | "gambeson";
  head: "nasal" | "spiked" | "turban" | "furcap";
  shield: "kite" | "round" | "none";
  /** Main weapon. */
  weapon: "lance" | "bow" | "spear";
  /** Pattern on the shield, and its colour (gold by default). */
  emblem?: "cross" | "boss" | "rings";
  emblemColor?: string;
  trousers?: string;
  beard?: string;
  /** A rider (true) or a man on foot. */
  mounted: boolean;
  commander?: { age: number; color: string; trim: string };
}

const SKIN = ["#c69676", "#b9876a", "#d2a585", "#a97a5c"];
const MAIL = "#767c82";
const IRON = "#5d6167";
const LEATHER = "#4a3424";
const WOOD = "#7a5838";
const GOLD = "#c8a24a";

/**
 * A soldier's body as parts on the skeleton (joint numbers + `jointBase`). lod 0 is full detail, 2 a few
 * dozen faces for far away.
 */
function person(parts: Parts, look: Look, lod: number, jointBase: number, skin: string) {
  const P = look.mounted ? SEATED : STANDING;
  const seg = [look.commander ? 28 : 12, 6, 3][lod];
  const jb = (j: number) => j + jointBase;
  const near = lod === 0;
  // Far away a soldier is a few dozen faces: no hands, feet, neck, mail curtain or second layers.
  const far = lod === 2;
  const trousers = look.trousers ?? "#3b2f27";

  // Legs.
  for (const [hip, knee, ankle, toe, thigh, shin] of [
    [P.hipR, P.kneeR, P.ankleR, P.toeR, J.thighR, J.shinR],
    [P.hipL, P.kneeL, P.ankleL, P.toeL, J.thighL, J.shinL],
  ] as const) {
    parts.add(limb(hip, knee, 0.085, 0.066, seg), look.armour === "mail" ? MAIL : trousers, jb(thigh), look.armour === "mail" ? "mail" : "cloth");
    if (lod < 2) parts.add(blob(knee, v(0.066, 0.066, 0.066), seg, Math.max(3, seg / 2)), look.armour === "mail" ? MAIL : trousers, jb(thigh), "cloth");
    parts.add(limb(knee, ankle, 0.062, 0.048, seg), LEATHER, jb(shin), "leather");
    if (!far) parts.add(limb(ankle.clone().add(v(0, 0.02, -0.03)), toe, 0.052, 0.04, seg), LEATHER, jb(shin), "leather");
  }

  // Hips and the skirts of hauberk and coat.
  if (!far) parts.add(blob(P.pelvis, v(0.16, 0.1, 0.12), seg, Math.max(3, seg / 2)), trousers, jb(J.pelvis), "cloth");
  const skirt = (top: number, bottom: number, r0: number, r1: number, color: string, tint: number, mat: "cloth" | "mail") => {
    const g = new THREE.CylinderGeometry(r0, r1, top - bottom, seg * 2, 1, true).scale(1, 1, 1.12);
    g.translate(P.waist.x, (top + bottom) / 2, P.waist.z + (look.mounted ? 0.02 : 0));
    parts.add(g, color, jb(J.pelvis), mat, tint);
  };
  const wy = P.waist.y;
  if (look.mounted) {
    if (look.armour === "mail" && !far) skirt(wy + 0.04, wy - 0.33, 0.165, 0.31, MAIL, TINT.none, "mail");
    skirt(wy + 0.05, wy - (look.armour === "mail" ? 0.25 : 0.34), 0.17, look.armour === "mail" ? 0.3 : 0.33, "#ffffff", TINT.a, "cloth");
  } else {
    if (look.armour === "mail" && !far) skirt(wy + 0.04, 0.5, 0.165, 0.27, MAIL, TINT.none, "mail");
    skirt(wy + 0.05, look.armour === "mail" ? 0.6 : 0.52, 0.17, look.armour === "mail" ? 0.25 : 0.28, look.armour === "gambeson" ? "#b49d78" : "#ffffff", look.armour === "gambeson" ? TINT.none : TINT.a, "cloth");
  }

  // Torso: a lathe of the chest, then the coat over it.
  const torsoLen = P.neck.y - P.waist.y;
  const prof = (scale: number) =>
    [
      [0.15, 0],
      [0.165, 0.25],
      [0.19, 0.6],
      [0.2, 0.82],
      [0.15, 0.95],
      [0.065, 1.0],
    ].map(([r, y]) => new THREE.Vector2(r * scale, y * torsoLen));
  const torso = (scale: number, color: string, tint: number, mat: "cloth" | "mail" | "iron", cut = 1) => {
    const pts = prof(scale).filter((p) => p.y <= torsoLen * cut + 1e-6);
    const g = new THREE.LatheGeometry(pts, seg * 2).scale(1.12, 1, 0.8);
    g.translate(P.waist.x, P.waist.y, P.waist.z + (look.mounted ? 0.01 : 0));
    parts.add(g, color, jb(J.torso), mat, tint);
  };
  if (far) {
    torso(1.03, "#ffffff", TINT.a, "cloth");
  } else if (look.armour === "mail") {
    torso(1, MAIL, TINT.none, "mail");
    torso(1.05, "#ffffff", TINT.a, "cloth", 0.8);
  } else if (look.armour === "lamellar") {
    torso(1, "#ffffff", TINT.a, "cloth");
    torso(1.06, "#6b6458", TINT.none, "iron", 0.82);
  } else if (look.armour === "gambeson") {
    torso(1, "#b49d78", TINT.none, "cloth");
    torso(1.05, "#ffffff", TINT.a, "cloth", 0.8);
  } else {
    torso(1, "#ffffff", TINT.a, "cloth");
    // Kaftan: the crossed front edge in the second colour.
    if (lod < 2) parts.add(box(P.waist.clone().add(v(0.03, torsoLen * 0.45, 0.145)), v(0.05, torsoLen * 0.8, 0.02), new THREE.Euler(0, 0, -0.25)), "#ffffff", jb(J.torso), "cloth", TINT.b);
  }
  if (lod < 2) {
    const belt = new THREE.TorusGeometry(0.168, 0.022, 4, seg * 2).rotateX(Math.PI / 2).scale(1.12, 1, 0.82);
    belt.translate(P.waist.x, P.waist.y + 0.03, P.waist.z + (look.mounted ? 0.01 : 0));
    parts.add(belt, LEATHER, jb(J.torso), "leather");
    if (near) parts.add(box(P.waist.clone().add(v(0, 0.03, 0.14)), v(0.05, 0.045, 0.02)), GOLD, jb(J.torso), "gold");
  }

  // Arms.
  const sleeve = look.armour === "mail" ? MAIL : "#ffffff";
  const sleeveTint = look.armour === "mail" ? TINT.none : TINT.a;
  const sleeveMat = look.armour === "mail" ? "mail" : "cloth";
  for (const [sh, el, wr, ua, fa] of [
    [P.shoulderR, P.elbowR, P.wristR, J.uaR, J.faR],
    [P.shoulderL, P.elbowL, P.wristL, J.uaL, J.faL],
  ] as const) {
    if (!far) parts.add(blob(sh, v(0.075, 0.075, 0.075), seg, Math.max(3, seg / 2)), sleeve, jb(ua), sleeveMat, sleeveTint);
    parts.add(limb(sh, el, 0.064, 0.054, seg), sleeve, jb(ua), sleeveMat, sleeveTint);
    if (lod < 2) parts.add(blob(el, v(0.055, 0.055, 0.055), seg, Math.max(3, seg / 2)), sleeve, jb(fa), sleeveMat, sleeveTint);
    parts.add(limb(el, wr, 0.052, 0.043, seg), sleeve, jb(fa), sleeveMat, sleeveTint);
    const hand = wr.clone().add(wr.clone().sub(el).normalize().multiplyScalar(0.05));
    if (!far) parts.add(blob(hand, v(0.045, 0.05, 0.045), seg, Math.max(3, seg / 2)), look.armour === "mail" ? LEATHER : skin, jb(fa), look.armour === "mail" ? "leather" : "skin");
  }

  // Neck and head.
  if (!far) parts.add(limb(P.neck.clone().add(v(0, -0.04, 0)), P.headC.clone().add(v(0, -0.07, 0)), 0.055, 0.05, seg), skin, jb(J.head), "skin");
  const hc = P.headC;
  const head = blob(hc, v(0.092, 0.112, 0.102), seg, Math.max(4, seg - 2));
  if (near && look.commander) {
    const position = head.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const y = (position.getY(i) - hc.y) / 0.112;
      // A tapered jaw and broader cheekbones instead of a spherical face.
      const taper = y < -0.15 ? 0.78 + 0.22 * (y + 1) / 0.85 : 1;
      position.setX(i, hc.x + (position.getX(i) - hc.x) * taper);
    }
    head.computeVertexNormals();
  }
  parts.add(head, skin, jb(J.head), "skin");
  if (lod < 2 && look.beard) parts.add(blob(hc.clone().add(v(0, -0.07, 0.045)), v(0.078, 0.07, 0.065), seg, Math.max(3, seg / 2)), look.beard, jb(J.head), "hair");
  if (near && !look.commander) parts.add(blob(hc.clone().add(v(0, -0.005, 0.1)), v(0.013, 0.025, 0.022), 10, 8), skin, jb(J.head), "skin");
  if (near && look.commander) commanderDetails(parts, P, look, jointBase, skin);
  const top = hc.y + 0.06;
  if (look.head === "nasal" || look.head === "spiked") {
    const h = look.head === "nasal" ? 0.2 : 0.26;
    parts.add(new THREE.ConeGeometry(0.114, h, seg * 2).translate(hc.x, top + h / 2, hc.z), IRON, jb(J.head), "iron");
    if (lod < 2) parts.add(new THREE.CylinderGeometry(0.116, 0.116, 0.04, seg * 2, 1, true).translate(hc.x, top + 0.01, hc.z), look.head === "nasal" ? IRON : GOLD, jb(J.head), look.head === "nasal" ? "iron" : "gold");
    if (look.head === "nasal" && lod < 2) parts.add(box(v(hc.x, hc.y + 0.0, hc.z + 0.112), v(0.022, 0.12, 0.012)), IRON, jb(J.head), "iron");
    if (look.head === "spiked" && near) parts.add(blob(v(hc.x, top + h + 0.02, hc.z), v(0.02, 0.03, 0.02), 6, 4), GOLD, jb(J.head), "gold");
    // Mail curtain (aventail) round the neck, open at the face.
    if (!far) {
      const av = new THREE.CylinderGeometry(0.118, 0.15, 0.17, seg * 2, 1, true, 0.55, Math.PI * 2 - 1.1);
      parts.add(av.translate(hc.x, top - 0.09, hc.z - 0.005), MAIL, jb(J.head), "mail");
    }
    if (look.head === "spiked" && lod < 2) parts.add(new THREE.TorusGeometry(0.12, 0.03, 4, seg * 2).rotateX(Math.PI / 2).translate(hc.x, top + 0.02, hc.z), "#ffffff", jb(J.head), "cloth", TINT.b);
  } else if (look.head === "turban") {
    for (let i = 0; i < (lod < 2 ? 3 : 1); i++) parts.add(new THREE.TorusGeometry(0.1 - i * 0.015, 0.04, 5, seg * 2).rotateX(Math.PI / 2).translate(hc.x, top + i * 0.045, hc.z - 0.005), "#e9e2d0", jb(J.head), "cloth");
    parts.add(blob(v(hc.x, top + 0.07, hc.z), v(0.08, 0.08, 0.08), seg, Math.max(3, seg / 2)), "#e9e2d0", jb(J.head), "cloth");
  } else {
    parts.add(new THREE.CylinderGeometry(0.118, 0.122, 0.09, seg * 2).translate(hc.x, top + 0.0, hc.z), "#5a3f28", jb(J.head), "fur");
    parts.add(new THREE.ConeGeometry(0.1, 0.17, seg * 2).translate(hc.x, top + 0.12, hc.z), "#ffffff", jb(J.head), "felt", TINT.b);
  }

  // Shield on the left forearm, facing out.
  const fa = P.wristL.clone().sub(P.elbowL);
  const sc = P.elbowL.clone().add(fa.clone().multiplyScalar(0.5)).add(v(0.09, 0, 0));
  if (look.shield === "kite") {
    const W = 0.25;
    const H = look.mounted ? 0.86 : 0.92;
    const s = new THREE.Shape();
    s.moveTo(-W, H * 0.3);
    s.quadraticCurveTo(0, H * 0.45, W, H * 0.3);
    s.quadraticCurveTo(W * 0.95, -H * 0.15, 0, -H * 0.55);
    s.quadraticCurveTo(-W * 0.95, -H * 0.15, -W, H * 0.3);
    const curve = (g: THREE.BufferGeometry, bend: number) => {
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - bend * (p.getX(i) / W) ** 2);
      g.computeVertexNormals();
      return g;
    };
    const face = curve(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false, curveSegments: lod === 0 ? 6 : 3 }), 0.06);
    const place = (g: THREE.BufferGeometry, out: number) => g.rotateY(Math.PI / 2).rotateZ(look.mounted ? 0.12 : 0.05).translate(sc.x + out, sc.y - (look.mounted ? 0.18 : 0.12), sc.z);
    parts.add(place(face, 0.01), "#ffffff", jb(J.faL), "leather", TINT.b);
    if (lod < 2) {
      const rim = curve(new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: lod === 0 ? 6 : 3 }), 0.06).scale(1.07, 1.05, 1).translate(0, 0, -0.008);
      parts.add(place(rim, 0.0), IRON, jb(J.faL), "iron");
    }
    if (lod < 2 && look.emblem === "cross") {
      const ec = look.emblemColor ?? GOLD;
      const em = look.emblemColor ? "cloth" : "gold";
      parts.add(place(box(v(0, -0.05, 0.03), v(0.045, H * 0.8, 0.01)), 0.012), ec, jb(J.faL), em);
      parts.add(place(box(v(0, H * 0.13, 0.03), v(W * 1.5, 0.045, 0.01)), 0.012), ec, jb(J.faL), em);
    }
    if (near) parts.add(place(blob(v(0, H * 0.08, 0.035), v(0.045, 0.045, 0.025), 8, 5), 0.012), IRON, jb(J.faL), "iron");
  } else if (look.shield === "round") {
    const R = look.mounted ? 0.3 : 0.34;
    const place = (g: THREE.BufferGeometry) => g.rotateZ(Math.PI / 2).translate(sc.x + 0.03, sc.y - 0.05, sc.z);
    parts.add(place(new THREE.CylinderGeometry(R, R, 0.03, seg * 2)), "#ffffff", jb(J.faL), "leather", TINT.b);
    if (lod < 2) parts.add(place(new THREE.TorusGeometry(R, 0.018, 4, seg * 2).rotateX(Math.PI / 2).translate(0, 0.015, 0)), look.emblem === "rings" ? GOLD : IRON, jb(J.faL), look.emblem === "rings" ? "gold" : "iron");
    if (lod < 2) parts.add(place(blob(v(0, 0.02, 0), v(0.06, 0.04, 0.06), 8, 5)), GOLD, jb(J.faL), "gold");
    if (near && look.emblem === "rings") parts.add(place(new THREE.TorusGeometry(R * 0.6, 0.02, 4, seg * 2).rotateX(Math.PI / 2).translate(0, 0.018, 0)), "#ffffff", jb(J.faL), "cloth", TINT.a);
  }

  // Weapons. All are built pointing straight up from the hand; poses aim them.
  const handR = P.wristR.clone().add(P.wristR.clone().sub(P.elbowR).normalize().multiplyScalar(0.05));
  const handL = P.wristL.clone().add(P.wristL.clone().sub(P.elbowL).normalize().multiplyScalar(0.05));
  const up = v(0, 1, 0);
  if (look.weapon === "lance" || look.weapon === "spear") {
    const lance = look.weapon === "lance";
    const below = lance ? 1.0 : 0.85;
    const above = lance ? 2.75 : 1.6;
    parts.add(limb(handR.clone().add(v(0, -below, 0)), handR.clone().add(v(0, above, 0)), 0.022, 0.018, Math.max(4, seg - 2), false), WOOD, jb(J.lance), "wood");
    parts.add(along(new THREE.ConeGeometry(0.03, 0.24, Math.max(4, seg - 2)).translate(0, 0.12, 0), up, handR.clone().add(v(0, above, 0))), IRON, jb(J.lance), "iron");
    if (lance && lod < 2) {
      const pen = new THREE.BufferGeometry();
      const y0 = above - 0.12;
      const vs = [0, y0, 0, 0, y0 - 0.32, 0, 0.0, y0 - 0.16, 0.42];
      pen.setAttribute("position", new THREE.Float32BufferAttribute([...vs, ...vs], 3));
      pen.setIndex([0, 1, 2, 5, 4, 3]);
      pen.computeVertexNormals();
      pen.translate(handR.x, handR.y, handR.z);
      parts.add(pen, "#ffffff", jb(J.lance), "cloth", TINT.b);
    }
  }
  if (look.weapon === "bow") {
    const pts = [
      [-0.56, 0.0],
      [-0.5, 0.06],
      [-0.4, 0.1],
      [-0.2, 0.12],
      [0, 0.08],
      [0.2, 0.12],
      [0.4, 0.1],
      [0.5, 0.06],
      [0.56, 0.0],
    ].map(([y, z]) => handL.clone().add(v(0, y, z)));
    parts.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), lod === 0 ? 16 : 6, lod === 0 ? 0.013 : 0.018, lod === 0 ? 5 : 3), "#5a3a22", jb(J.bow), "wood");
    if (near) parts.add(limb(pts[0], pts[8], 0.003, 0.003, 3), "#d8d0bc", jb(J.bow), "cloth");
    // Quiver on the right hip.
    if (lod < 2) {
      const q0 = P.pelvis.clone().add(v(-0.2, -0.12, -0.05));
      const q1 = q0.clone().add(v(-0.02, 0.5, -0.12));
      parts.add(limb(q0, q1, 0.05, 0.065, Math.max(4, seg - 2)), LEATHER, jb(J.pelvis), "leather");
      if (near) for (let i = 0; i < 3; i++) parts.add(along(new THREE.ConeGeometry(0.018, 0.08, 4), v(-0.04, 1, -0.24), q1.clone().add(v(-0.01 + i * 0.02, 0.06, 0))), "#e8e2d4", jb(J.pelvis), "cloth");
    }
  }
  // A sword for close combat (hidden until drawn), and its scabbard on the left hip.
  if (!far) {
    parts.add(box(handR.clone().add(v(0, 0.5, 0)), v(0.045, 0.82, 0.01)), "#b8bec4", jb(J.sword), "iron");
    if (lod < 2) parts.add(box(handR.clone().add(v(0, 0.07, 0)), v(0.17, 0.025, 0.03)), IRON, jb(J.sword), "iron");
    if (lod < 2) {
      const s0 = P.pelvis.clone().add(v(0.2, look.mounted ? 0.0 : -0.02, 0.04));
      parts.add(limb(s0, s0.clone().add(v(0.06, -0.7, -0.32)), 0.024, 0.02, 4), LEATHER, jb(J.pelvis), "leather");
    }
  }
}

/** Higher resolution details are created only for the four named commanders. */
function commanderDetails(parts: Parts, P: BodyPoints, look: Look, base: number, skin: string) {
  const identity = look.commander!;
  const headJoint = base + J.head;
  const torsoJoint = base + J.torso;
  const hc = P.headC;
  const face = (offset: V3, scale: V3, color: string, mat: "skin" | "eye" | "hair" = "skin") =>
    parts.add(blob(hc.clone().add(offset), scale, 20, 14), color, headJoint, mat);
  for (const side of [-1, 1]) {
    face(v(side * 0.086, -0.005, 0), v(0.012, 0.025, 0.014), skin); // ears
    // Deep-set eyes under a brow ridge, the upper lid half over the iris — not round, staring eyes.
    face(v(side * 0.035, 0.039, 0.093), v(0.03, 0.011, 0.014), skin); // brow ridge
    face(v(side * 0.035, 0.022, 0.093), v(0.014, 0.0058, 0.004), "#b3a28d", "eye");
    face(v(side * 0.035, 0.0215, 0.0965), v(0.0052, 0.0052, 0.0018), "#3a291c", "eye");
    face(v(side * 0.035, 0.0215, 0.0982), v(0.0024, 0.0024, 0.0008), "#120f0d", "eye");
    face(v(side * 0.035, 0.0272, 0.0955), v(0.0155, 0.0042, 0.0052), skin); // upper lid
    face(v(side * 0.035, 0.0165, 0.0945), v(0.0135, 0.0026, 0.0038), skin); // lower lid
    face(v(side * 0.036, 0.047, 0.1), v(0.022, 0.0042, 0.0055), look.beard ?? "#33231c", "hair"); // eyebrow
    face(v(side * 0.049, -0.006, 0.073), v(0.026, 0.016, 0.012), skin); // cheekbones
    face(v(side * 0.012, -0.019, 0.106), v(0.0085, 0.008, 0.009), skin); // nostril wings
    if (identity.age >= 45) {
      parts.add(limb(hc.clone().add(v(side * 0.047, 0.016, 0.098)), hc.clone().add(v(side * 0.06, 0.012, 0.088)), 0.0012, 0.0012, 4), "#8c6251", headJoint, "skin");
    }
  }
  face(v(0, 0.006, 0.099), v(0.0105, 0.03, 0.016), skin); // bridge of the nose
  face(v(0, -0.016, 0.113), v(0.0125, 0.0095, 0.011), skin); // tip
  face(v(0, -0.045, 0.097), v(0.021, 0.0045, 0.0055), "#8a5446"); // lips
  // Individual beard locks break up the silhouette and catch the side light.
  for (let row = 0; row < 4; row++) for (let col = -4; col <= 4; col++) {
    const x = col * 0.013;
    const y = -0.057 - row * 0.012;
    const z = 0.087 - Math.abs(col) * 0.004 - row * 0.002;
    face(v(x, y, z), v(0.009, 0.022, 0.009), look.beard ?? "#33231c", "hair");
  }
  // Gilded helmet rivets; no invented modern national emblems or ceremonial crown.
  if (look.head !== "turban") for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2;
    parts.add(blob(hc.clone().add(v(Math.sin(a) * 0.117, 0.077, Math.cos(a) * 0.117)), v(0.006, 0.006, 0.006), 8, 6), identity.trim, headJoint, "gold");
  }
  // Interlinked mail around the neck, explicit geometry in the hero model.
  if (look.armour === "mail") for (let row = 0; row < 4; row++) for (let col = 0; col < 30; col++) {
    const a = (col + (row % 2) * 0.5) / 30 * Math.PI * 2;
    const radius = 0.087 + row * 0.021;
    const ring = new THREE.TorusGeometry(0.009, 0.002, 4, 8).rotateX(0.25).rotateY(a);
    ring.translate(P.neck.x + Math.sin(a) * radius, P.neck.y - 0.025 - row * 0.015, P.neck.z + Math.cos(a) * radius);
    parts.add(ring, MAIL, torsoJoint, "mail");
  }
  // A folded wool/silk mantle, sewn at the shoulders and falling behind the saddle.
  const cols = 24, rows = 22;
  const cape = new THREE.PlaneGeometry(1, 1, cols, rows);
  const cp = cape.attributes.position as THREE.BufferAttribute;
  const edge: V3[][] = [[], []];
  for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
    const t = row / rows, q = col / cols * 2 - 1;
    const x = q * (0.22 + 0.18 * t);
    const y = P.neck.y - 0.08 - t * 0.78;
    const z = P.neck.z - 0.11 - 0.40 * t - 0.025 * Math.cos(q * Math.PI * 5) * Math.sin(t * Math.PI * 0.8);
    cp.setXYZ(row * (cols + 1) + col, x, y, z);
    if (col === 0 || col === cols) edge[col === 0 ? 0 : 1].push(v(x, y, z));
  }
  cape.computeVertexNormals();
  const back = cape.clone();
  const indices = back.index!;
  for (let i = 0; i < indices.count; i += 3) { const a = indices.getX(i); indices.setX(i, indices.getX(i + 2)); indices.setX(i + 2, a); }
  back.computeVertexNormals();
  parts.add(cape, identity.color, torsoJoint, "cloth");
  parts.add(back, identity.color, torsoJoint, "cloth");
  for (const points of edge) parts.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.007, 6, false), identity.trim, torsoJoint, "gold");
  for (const side of [-1, 1]) parts.add(blob(P.neck.clone().add(v(side * 0.15, -0.07, 0.07)), v(0.028, 0.028, 0.009), 16, 10), identity.trim, torsoJoint, "gold");
  parts.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([P.neck.clone().add(v(-0.15, -0.07, 0.09)), P.neck.clone().add(v(0, -0.13, 0.16)), P.neck.clone().add(v(0.15, -0.07, 0.09))]), 24, 0.005, 6), identity.trim, torsoJoint, "gold");
}

// ---- Horse tack ----------------------------------------------------------------------------------------------

function tack(parts: Parts, horse: HorseData, lod: number) {
  const a = horse.attach;
  const seg = [12, 8, 5][lod];
  // Saddle cloth over the back and flanks, in the regiment's second colour.
  const cloth = new THREE.CylinderGeometry(0.275, 0.275, 0.66, seg * 2, 1, true, Math.PI - 1.7, 3.4).rotateX(Math.PI / 2);
  parts.add(cloth.translate(0, 1.21, -0.17), "#ffffff", a, "cloth", TINT.b);
  parts.add(box(v(0, 1.505, -0.15), v(0.32, 0.07, 0.46)), "#3d2a1c", a, "leather");
  if (lod < 2) {
    parts.add(box(v(0, 1.57, -0.37), v(0.3, 0.13, 0.05), new THREE.Euler(-0.2, 0, 0)), "#3d2a1c", a, "leather");
    parts.add(box(v(0, 1.56, 0.07), v(0.2, 0.1, 0.05), new THREE.Euler(0.3, 0, 0)), "#3d2a1c", a, "leather");
    // Stirrup leathers and irons.
    for (const s of [-1, 1]) {
      parts.add(box(v(s * 0.27, 1.22, 0.0), v(0.02, 0.5, 0.035)), LEATHER, a, "leather");
      parts.add(box(v(s * 0.28, 0.95, 0.06), v(0.05, 0.02, 0.12)), IRON, a, "iron");
    }
  }
}

// ---- Figure types ----------------------------------------------------------------------------------------------

export interface FigureType {
  id: string;
  mounted: boolean;
  role: "lancer" | "archer" | "spear" | "bowman";
  lods: THREE.BufferGeometry[];
}

/** Geometry (3 levels of detail) of one kind of soldier, mounted or on foot. */
export function figureType(id: string, look: Look, role: FigureType["role"], horse: HorseData | null, seed = 0): FigureType {
  const lods = [0, 1, 2].map((lod) => {
    const parts = new Parts();
    if (look.mounted && horse) {
      parts.addRaw(horse.lods[lod].clone());
      tack(parts, horse, lod);
      person(parts, look, lod, horse.joints, SKIN[seed % SKIN.length]);
    } else person(parts, look, lod, 0, SKIN[seed % SKIN.length]);
    const g = parts.build();
    g.computeBoundingSphere();
    return g;
  });
  return { id, mounted: look.mounted, role, lods };
}

// ---- Animation ---------------------------------------------------------------------------------------------------

const d3 = (x: number, y: number, z: number) => v(x, y, z).normalize();
const UPV = v(0, 1, 0);
/** Interpolated direction between keyed directions. */
function keyDir(p: number, ks: [number, V3][], loop = true) {
  const x = keys(p, ks.map(([t, d]) => [t, d.x]), loop);
  const y = keys(p, ks.map(([t, d]) => [t, d.y]), loop);
  const z = keys(p, ks.map(([t, d]) => [t, d.z]), loop);
  return v(x, y, z).normalize();
}

type PoseFn = (p: number) => Pose;

const ARCHER_HIDE = [J.lance, J.sword];
const LANCER_HIDE = [J.sword, J.bow];
const SWORD_HIDE = [J.lance, J.bow];

// Rider poses. Rest: seated, hands forward on the reins, weapon upright.
const reins = { [J.uaL]: [-0.15, 0, 0.05] as [number, number, number], [J.faL]: [-0.2, 0, 0] as [number, number, number] };
const shieldUp = { [J.uaL]: [-0.55, 0, 0.25] as [number, number, number], [J.faL]: [-0.85, 0, 0] as [number, number, number] };

const riderPoses: Record<string, PoseFn> = {
  idle_l: (p) => ({
    rot: { [J.torso]: [0.04 + 0.02 * Math.sin(p * Math.PI * 2), 0, 0], [J.head]: [0.05, 0.35 * Math.sin(p * Math.PI * 2 + 1), 0], [J.uaR]: [0.1, 0, -0.05], [J.faR]: [-0.15, 0, 0], ...reins },
    aim: { [J.lance]: [UPV, d3(0.04, 1, 0.12)] },
    hide: LANCER_HIDE,
  }),
  idle_b: (p) => ({
    rot: { [J.torso]: [0.05 + 0.02 * Math.sin(p * Math.PI * 2), 0, 0], [J.head]: [0.05, 0.4 * Math.sin(p * Math.PI * 2 + 2), 0], [J.uaL]: [-0.2, 0, 0.1], [J.faL]: [-0.3, 0, 0] },
    aim: { [J.bow]: [UPV, d3(0.3, 0.75, 0.55)] },
    hide: ARCHER_HIDE,
  }),
  walk_l: (p) => ({
    rot: { [J.torso]: [0.08 + 0.03 * Math.sin(p * Math.PI * 4), 0, 0.02 * Math.sin(p * Math.PI * 2)], [J.head]: [0.05, 0.1 * Math.sin(p * Math.PI * 2), 0], [J.uaR]: [0.1, 0, -0.05], [J.faR]: [-0.15, 0, 0], ...reins },
    aim: { [J.lance]: [UPV, d3(0.04, 1, 0.18)] },
    hide: LANCER_HIDE,
  }),
  walk_b: (p) => ({
    rot: { [J.torso]: [0.08 + 0.03 * Math.sin(p * Math.PI * 4), 0, 0.02 * Math.sin(p * Math.PI * 2)], [J.head]: [0.05, 0.1 * Math.sin(p * Math.PI * 2), 0], [J.uaL]: [-0.2, 0, 0.1], [J.faL]: [-0.3, 0, 0] },
    aim: { [J.bow]: [UPV, d3(0.3, 0.75, 0.55)] },
    hide: ARCHER_HIDE,
  }),
  // The 200 riding up as if to surrender: heads bowed, bows down.
  humble: (p) => ({
    rot: { [J.torso]: [0.18 + 0.03 * Math.sin(p * Math.PI * 4), 0, 0], [J.head]: [0.55, 0, 0], [J.uaL]: [0.05, 0, 0.05], [J.faL]: [-0.2, 0, 0] },
    aim: { [J.bow]: [UPV, d3(0.15, -0.6, 0.75)] },
    hide: ARCHER_HIDE,
  }),
  // Lance couched under the right arm, leaning into the charge.
  gallop_l: (p) => ({
    rot: { [J.torso]: [0.32 + 0.05 * Math.sin(p * Math.PI * 2), 0, 0], [J.head]: [-0.25, 0, 0], [J.uaR]: [0.35, 0, -0.12], [J.faR]: [-1.0, 0, 0], ...shieldUp },
    aim: { [J.lance]: [UPV, d3(0.11, -0.04, 1)] },
    hide: LANCER_HIDE,
  }),
  gallop_s: (p) => ({
    rot: { [J.torso]: [0.25 + 0.05 * Math.sin(p * Math.PI * 2), 0, 0], [J.head]: [-0.2, 0, 0], [J.uaR]: [-2.55, 0, -0.25], [J.faR]: [-0.55, 0, 0], ...shieldUp },
    aim: { [J.sword]: [UPV, d3(-0.1, 0.75, -0.65)] },
    hide: SWORD_HIDE,
  }),
  gallop_b: (p) => ({
    rot: { [J.torso]: [0.28 + 0.05 * Math.sin(p * Math.PI * 2), 0, 0], [J.head]: [-0.2, 0, 0], [J.uaL]: [-0.35, 0, 0.1], [J.faL]: [-0.4, 0, 0] },
    aim: { [J.bow]: [UPV, d3(0.25, 0.8, 0.5)] },
    hide: ARCHER_HIDE,
  }),
};

/** Drawing, loosing and reaching for the next arrow (phase 0..1 per shot), twisted to the left-front. */
function shootPose(s: number, lean: number): Pose {
  return {
    rot: {
      [J.torso]: [lean, 0.55, 0],
      [J.head]: [-0.1, 0.1, 0],
      [J.uaL]: [keys(s, [[0, -0.5], [0.3, -1.5], [0.72, -1.5], [0.9, -0.5]]), 0, keys(s, [[0, 0.1], [0.3, 0.3], [0.72, 0.3], [0.9, 0.1]])],
      [J.faL]: [keys(s, [[0, -0.7], [0.3, -0.05], [0.72, -0.05], [0.9, -0.7]]), 0, 0],
      [J.uaR]: [keys(s, [[0, 0.25], [0.15, -0.2], [0.32, -1.45], [0.6, -1.5], [0.66, -1.3], [0.85, 0.2]]), 0, keys(s, [[0, 0], [0.32, -0.3], [0.6, -0.42], [0.66, -0.55], [0.85, 0]])],
      [J.faR]: [keys(s, [[0, -0.4], [0.32, -1.6], [0.6, -2.05], [0.66, -2.3], [0.85, -0.5]]), 0, 0],
    },
    aim: { [J.bow]: [UPV, keyDir(s, [[0, d3(0.3, 0.7, 0.6)], [0.3, d3(0.18, 1, 0.1)], [0.72, d3(0.18, 1, 0.1)], [0.9, d3(0.3, 0.7, 0.6)]])] },
    hide: ARCHER_HIDE,
  };
}

/** One sword cut (phase 0..1): raise, strike across, recover; shield held up. */
function swingPose(s: number, lean: number): Pose {
  return {
    rot: {
      [J.torso]: [lean + keys(s, [[0, 0.02], [0.42, 0], [0.56, 0.28], [0.8, 0.12]]), keys(s, [[0, 0.3], [0.42, 0.42], [0.56, -0.32], [0.8, -0.15]]), 0],
      [J.head]: [-0.1, 0, 0],
      [J.uaR]: [keys(s, [[0, -2.5], [0.42, -2.9], [0.56, -0.75], [0.8, -1.2]]), 0, keys(s, [[0, -0.35], [0.42, -0.4], [0.56, 0.05], [0.8, -0.2]])],
      [J.faR]: [keys(s, [[0, -1.0], [0.42, -1.35], [0.56, -0.1], [0.8, -0.4]]), 0, 0],
      ...shieldUp,
    },
    aim: { [J.sword]: [UPV, keyDir(s, [[0, d3(0.3, 0.6, -0.8)], [0.42, d3(0.35, 0.3, -1)], [0.56, d3(-0.35, -0.55, 1)], [0.8, d3(-0.1, 0.4, 0.4)]])] },
    hide: SWORD_HIDE,
  };
}

/** Riders falling with their horse (the horse rolls onto its left side). */
function riderDeath(p: number): Pose {
  return {
    rot: {
      [J.torso]: [keys(p, [[0, 0.1], [0.3, -0.4], [1, -0.85]], false), 0, keys(p, [[0, 0], [1, 0.35]], false)],
      [J.head]: [keys(p, [[0, 0], [1, -0.5]], false), 0.3, 0],
      [J.uaR]: [-0.6, 0, keys(p, [[0, 0], [1, -1.3]], false)],
      [J.faR]: [-0.3, 0, 0],
      [J.uaL]: [-0.4, 0, keys(p, [[0, 0], [1, 1.2]], false)],
      [J.faL]: [-0.2, 0, 0],
      [J.thighR]: [keys(p, [[0, 0], [1, -0.5]], false), 0, keys(p, [[0, 0], [1, -0.6]], false)],
      [J.thighL]: [keys(p, [[0, 0], [1, 0.4]], false), 0, keys(p, [[0, 0], [1, 0.3]], false)],
    },
    hide: p > 0.12 ? [J.lance, J.sword, J.bow] : [J.sword],
  };
}

// Men on foot. Rest: standing, forearms forward, spear upright.
function walkLegs(p: number, amp: number, knee: number): Pose["rot"] {
  const s = Math.sin(p * Math.PI * 2);
  const c = Math.cos(p * Math.PI * 2);
  return {
    [J.thighR]: [-amp * s, 0, 0],
    [J.shinR]: [knee * Math.max(0, c), 0, 0],
    [J.thighL]: [amp * s, 0, 0],
    [J.shinL]: [knee * Math.max(0, -c), 0, 0],
  };
}

const footPoses: Record<string, PoseFn> = {
  idle_sp: (p) => ({
    rot: { [J.torso]: [0.02 * Math.sin(p * Math.PI * 2), 0, 0], [J.head]: [0, 0.3 * Math.sin(p * Math.PI * 2 + 1), 0], [J.uaL]: [-0.2, 0, 0.1], [J.faL]: [-0.6, 0, 0] },
    aim: { [J.lance]: [UPV, d3(0, 1, 0.05)] },
    hide: LANCER_HIDE,
  }),
  walk_sp: (p) => ({
    offset: [0, -0.03 * Math.abs(Math.sin(p * Math.PI * 2)), 0],
    rot: { ...walkLegs(p, 0.45, 0.55), [J.torso]: [0.05, 0.08 * Math.sin(p * Math.PI * 2), 0], [J.uaR]: [0.15 * Math.sin(p * Math.PI * 2), 0, 0], [J.uaL]: [-0.2, 0, 0.1], [J.faL]: [-0.6, 0, 0] },
    aim: { [J.lance]: [UPV, d3(0, 1, 0.12)] },
    hide: LANCER_HIDE,
  }),
  run_sp: (p) => ({
    offset: [0, -0.06 * Math.abs(Math.cos(p * Math.PI * 2)), 0],
    rot: { ...walkLegs(p, 0.8, 1.3), [J.torso]: [0.28, 0.12 * Math.sin(p * Math.PI * 2), 0], [J.head]: [-0.2, 0, 0], [J.uaR]: [0.3, 0, -0.1], [J.faR]: [-0.9, 0, 0], [J.uaL]: [-0.5, 0, 0.2], [J.faL]: [-0.8, 0, 0] },
    aim: { [J.lance]: [UPV, d3(0.05, 0.05, 1)] },
    hide: LANCER_HIDE,
  }),
  melee_sp: (p) => {
    const s = (p * 2) % 1;
    return {
      offset: [0, -0.06, 0],
      rot: {
        [J.thighR]: [0.35, 0, -0.08],
        [J.shinR]: [0.3, 0, 0],
        [J.thighL]: [-0.45, 0, 0.08],
        [J.shinL]: [0.4, 0, 0],
        [J.torso]: [0.15 + keys(s, [[0, 0], [0.4, -0.05], [0.55, 0.25], [0.8, 0.1]]), keys(s, [[0, 0.25], [0.4, 0.3], [0.55, -0.2], [0.8, 0]]), 0],
        [J.uaR]: [keys(s, [[0, -2.3], [0.4, -2.6], [0.55, -1.5], [0.8, -2.0]]), 0, -0.2],
        [J.faR]: [keys(s, [[0, -0.5], [0.4, -0.7], [0.55, -0.05], [0.8, -0.3]]), 0, 0],
        [J.uaL]: [-0.6, 0, 0.3],
        [J.faL]: [-0.9, 0, 0],
      },
      aim: { [J.lance]: [UPV, keyDir(s, [[0, d3(0, -0.15, 1)], [0.4, d3(0, -0.05, 1)], [0.55, d3(0, -0.3, 1)], [0.8, d3(0, -0.15, 1)]])] },
      hide: LANCER_HIDE,
    };
  },
  idle_bw: (p) => ({
    rot: { [J.torso]: [0.02 * Math.sin(p * Math.PI * 2), 0, 0], [J.head]: [0, 0.3 * Math.sin(p * Math.PI * 2 + 2), 0], [J.uaL]: [0.05, 0, 0.1], [J.faL]: [-0.4, 0, 0] },
    aim: { [J.bow]: [UPV, d3(0.2, 0.85, 0.4)] },
    hide: ARCHER_HIDE,
  }),
  walk_bw: (p) => ({
    offset: [0, -0.03 * Math.abs(Math.sin(p * Math.PI * 2)), 0],
    rot: { ...walkLegs(p, 0.45, 0.55), [J.torso]: [0.05, 0.08 * Math.sin(p * Math.PI * 2), 0], [J.uaR]: [0.2 * Math.sin(p * Math.PI * 2), 0, 0], [J.uaL]: [0.05, 0, 0.1], [J.faL]: [-0.4, 0, 0] },
    aim: { [J.bow]: [UPV, d3(0.2, 0.85, 0.4)] },
    hide: ARCHER_HIDE,
  }),
  run_bw: (p) => ({
    offset: [0, -0.06 * Math.abs(Math.cos(p * Math.PI * 2)), 0],
    rot: { ...walkLegs(p, 0.8, 1.3), [J.torso]: [0.28, 0.12 * Math.sin(p * Math.PI * 2), 0], [J.head]: [-0.2, 0, 0], [J.uaR]: [0.5 * Math.sin(p * Math.PI * 2), 0, 0], [J.uaL]: [-0.3, 0, 0.1], [J.faL]: [-0.5, 0, 0] },
    aim: { [J.bow]: [UPV, d3(0.2, 0.85, 0.4)] },
    hide: ARCHER_HIDE,
  }),
  shoot_bw: (p) => {
    const pose = shootPose(p, 0.05);
    pose.rot = { ...pose.rot, [J.thighR]: [0.2, 0, -0.1], [J.thighL]: [-0.25, 0, 0.1], [J.shinL]: [0.15, 0, 0] };
    return pose;
  },
  melee_sw: (p) => {
    const pose = swingPose((p * 2) % 1, 0.1);
    pose.offset = [0, -0.05, 0];
    pose.rot = { ...pose.rot, [J.thighR]: [0.35, 0, -0.08], [J.shinR]: [0.3, 0, 0], [J.thighL]: [-0.45, 0, 0.08], [J.shinL]: [0.4, 0, 0] };
    return pose;
  },
  death: (p) => ({
    offset: [0, keys(p, [[0, 0], [0.35, -0.2], [0.75, -0.7], [1, -0.82]], false), keys(p, [[0, 0], [1, -0.25]], false)],
    rot: {
      [J.pelvis]: [keys(p, [[0, 0], [0.35, -0.3], [1, -1.5]], false), 0, keys(p, [[0, 0], [1, 0.15]], false)],
      [J.torso]: [keys(p, [[0, 0], [0.3, 0.35], [1, 0.05]], false), 0, 0],
      [J.head]: [keys(p, [[0, 0], [0.4, 0.3], [1, -0.2]], false), 0.4, 0],
      [J.uaR]: [-0.5, 0, keys(p, [[0, 0], [1, -0.9]], false)],
      [J.uaL]: [-0.4, 0, keys(p, [[0, 0], [1, 0.9]], false)],
      [J.thighR]: [keys(p, [[0, 0], [0.4, -0.5], [1, -0.15]], false), 0, 0],
      [J.shinR]: [keys(p, [[0, 0], [0.4, 1.0], [1, 0.2]], false), 0, 0],
      [J.thighL]: [keys(p, [[0, 0], [0.4, -0.3], [1, -0.05]], false), 0, 0.1],
      [J.shinL]: [keys(p, [[0, 0], [0.4, 0.8], [1, 0.1]], false), 0, 0],
    },
    hide: [J.sword],
  }),
};

/** Bone clips for every mounted type: the horse's clip plus the rider's pose on its moving back. */
export function cavalryBones(k: Kit, horse: HorseData) {
  const HJ = horse.joints;
  const bones = new BoneSet(HJ + 14, 640);
  const R = rig(SEATED);
  const mats = R.map(() => new THREE.Matrix4());
  const tmp = new THREE.Matrix4();
  const base = new THREE.Matrix4();
  const add = (name: string, horseClip: string, repeat: number, pose: (p: number, f: number) => Pose) => {
    const hc = horse.clips.get(horseClip)!;
    const frames = hc.frames * repeat;
    bones.addClip(name, frames, hc.fps, hc.loop, (f, write) => {
      const hf = f % hc.frames;
      for (let j = 0; j < HJ; j++) write(j, rowMatrix(horse.bones, (hc.row + hf) * HJ + j, tmp));
      rowMatrix(horse.bones, (hc.row + hf) * HJ + horse.attach, base);
      solveRig(R, pose(f / frames, f), mats, base);
      for (let j = 0; j < mats.length; j++) write(HJ + j, mats[j]);
    });
  };
  for (const n of ["idle_l", "idle_b"]) add(n, "Idle", 1, riderPoses[n]);
  for (const n of ["walk_l", "walk_b", "humble"]) add(n, "Walk", 1, riderPoses[n]);
  for (const n of ["gallop_l", "gallop_s", "gallop_b"]) add(n, "Gallop", 1, riderPoses[n]);
  add("gallop_shoot", "Gallop", 4, (p) => shootPose(p, 0.25));
  add("idle_shoot", "Idle", 1, (p) => shootPose((p * 2) % 1, 0.05));
  add("melee", "Idle_2", 1, (p) => swingPose((p * 2) % 1, 0.08));
  add("melee_walk", "Walk", 1, (p) => swingPose(p, 0.12));
  add("death", "Death", 1, (p) => riderDeath(p));
  add("hit", "Idle_HitReact_Left", 1, (p) => ({ ...riderPoses.idle_l(0), rot: { [J.torso]: [-0.25 * Math.sin(Math.PI * Math.min(1, p * 1.5)), 0, 0] } }));
  return bones.finish(k);
}

/** Bone clips for men on foot. */
export function infantryBones(k: Kit) {
  const bones = new BoneSet(14, 400);
  const R = rig(STANDING);
  const mats = R.map(() => new THREE.Matrix4());
  const add = (name: string, frames: number, loop: boolean, pose: PoseFn) =>
    bones.addClip(name, frames, 30, loop, (f, write) => {
      solveRig(R, pose(loop ? f / frames : f / (frames - 1)), mats);
      mats.forEach((m, j) => write(j, m));
    });
  add("idle_sp", 60, true, footPoses.idle_sp);
  add("walk_sp", 34, true, footPoses.walk_sp);
  add("run_sp", 22, true, footPoses.run_sp);
  add("melee_sp", 40, true, footPoses.melee_sp);
  add("idle_bw", 60, true, footPoses.idle_bw);
  add("walk_bw", 34, true, footPoses.walk_bw);
  add("run_bw", 22, true, footPoses.run_bw);
  add("shoot_bw", 66, true, footPoses.shoot_bw);
  add("melee_sw", 44, true, footPoses.melee_sw);
  add("death", 36, false, footPoses.death);
  return bones.finish(k);
}

/** Horse coats (sRGB) with mane colours: bay, dark bay, chestnut, black, grey, dun. */
export const COATS: [string, string][] = [
  ["#6b3d22", "#1b1612"],
  ["#41271a", "#14100d"],
  ["#8a4724", "#5a2c16"],
  ["#211d1a", "#0f0d0c"],
  ["#a8a49c", "#d8d4cc"],
  ["#a8834f", "#2a2018"],
];
