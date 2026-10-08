import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Kit, V3 } from "@/components/journeys/JourneyScene";

/*
 * GPU crowds: thousands of animated figures drawn as instances. A figure type is one geometry whose vertices
 * are bound to joints (the horse's real skeleton, or a small procedural one for people). Every animation clip
 * is baked into a texture of bone matrices — one row per frame, three RGBA texels per joint — and the vertex
 * shader skins each instance at its own clip and frame, so a charge of a thousand riders costs a few draw calls.
 */

export interface ClipInfo {
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
}

/** Bone matrices of all the clips of one skeleton, as a float texture. */
export class BoneSet {
  private data: Float32Array;
  private rows = 0;
  readonly clips = new Map<string, ClipInfo>();
  texture: THREE.DataTexture | null = null;

  constructor(
    readonly joints: number,
    private capacity: number,
  ) {
    this.data = new Float32Array(joints * 12 * capacity);
  }

  /** Adds a clip; `fill(frame, write)` writes every joint's matrix for that frame. */
  addClip(name: string, frames: number, fps: number, loop: boolean, fill: (frame: number, write: (joint: number, m: THREE.Matrix4) => void) => void) {
    if (this.rows + frames > this.capacity) {
      // Grow.
      this.capacity = Math.max(this.capacity * 2, this.rows + frames);
      const d = new Float32Array(this.joints * 12 * this.capacity);
      d.set(this.data);
      this.data = d;
    }
    const row0 = this.rows;
    for (let f = 0; f < frames; f++) {
      const base = (row0 + f) * this.joints * 12;
      fill(f, (j, m) => {
        const e = m.elements;
        const o = base + j * 12;
        const d = this.data;
        d[o] = e[0];
        d[o + 1] = e[4];
        d[o + 2] = e[8];
        d[o + 3] = e[12];
        d[o + 4] = e[1];
        d[o + 5] = e[5];
        d[o + 6] = e[9];
        d[o + 7] = e[13];
        d[o + 8] = e[2];
        d[o + 9] = e[6];
        d[o + 10] = e[10];
        d[o + 11] = e[14];
      });
    }
    this.rows += frames;
    const info = { row: row0, frames, fps, loop };
    this.clips.set(name, info);
    return info;
  }

  /** Raw rows copied from baked data (12 floats per joint per frame). */
  addRaw(name: string, frames: number, fps: number, loop: boolean, src: Float32Array, srcRow: number, srcJoints: number) {
    return this.addClip(name, frames, fps, loop, (f, write) => {
      const m = new THREE.Matrix4();
      for (let j = 0; j < srcJoints; j++) write(j, rowMatrix(src, (srcRow + f) * srcJoints + j, m));
    });
  }

  finish(k: Kit) {
    // Half floats: plenty for positions within a few metres, half the memory, and kinder to some GPUs.
    const src = this.data.subarray(0, this.rows * this.joints * 12);
    const half = new Uint16Array(src.length);
    for (let i = 0; i < src.length; i++) half[i] = THREE.DataUtils.toHalfFloat(src[i]);
    const tex = new THREE.DataTexture(half, this.joints * 3, Math.max(1, this.rows), THREE.RGBAFormat, THREE.HalfFloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    this.texture = k.track(tex);
    return this;
  }

  clip(name: string) {
    const c = this.clips.get(name);
    if (!c) throw new Error(`no clip ${name}`);
    return c;
  }
}

/** Matrix number `i` (3×4 rows) of a baked array. */
export function rowMatrix(src: Float32Array, i: number, out: THREE.Matrix4) {
  const o = i * 12;
  return out.set(src[o], src[o + 1], src[o + 2], src[o + 3], src[o + 4], src[o + 5], src[o + 6], src[o + 7], src[o + 8], src[o + 9], src[o + 10], src[o + 11], 0, 0, 0, 1);
}

// ---- Material ---------------------------------------------------------------------------------------------

const SKIN_PARS = /* glsl */ `
uniform sampler2D uBones;
attribute vec4 aJoints;
attribute vec4 aWeights;
attribute vec4 iAnim;
mat4 boneAt(float j, float row) {
  ivec2 size = textureSize(uBones, 0);
  int x = clamp(int(j) * 3, 0, size.x - 3);
  int y = clamp(int(row), 0, size.y - 1);
  vec4 a = texelFetch(uBones, ivec2(x, y), 0);
  vec4 b = texelFetch(uBones, ivec2(x + 1, y), 0);
  vec4 c = texelFetch(uBones, ivec2(x + 2, y), 0);
  return mat4(a.x, b.x, c.x, 0.0, a.y, b.y, c.y, 0.0, a.z, b.z, c.z, 0.0, a.w, b.w, c.w, 1.0);
}
mat4 skinAt(float row) {
  #if CROWD_TAPS == 1
    return boneAt(aJoints.x, row);
  #else
    mat4 m = aWeights.x * boneAt(aJoints.x, row) + aWeights.y * boneAt(aJoints.y, row);
    #if CROWD_TAPS > 2
      m += aWeights.z * boneAt(aJoints.z, row) + aWeights.w * boneAt(aJoints.w, row);
    #endif
    return m;
  #endif
}
mat4 crowdSkin() {
  float n = iAnim.y;
  float f0 = floor(iAnim.z);
  float r0 = iAnim.w > 0.5 ? mod(f0, n) : min(f0, n - 1.0);
  mat4 m = skinAt(iAnim.x + r0);
  #ifdef CROWD_LERP
    float r1 = iAnim.w > 0.5 ? mod(f0 + 1.0, n) : min(f0 + 1.0, n - 1.0);
    m = m + (skinAt(iAnim.x + r1) - m) * (iAnim.z - f0);
  #endif
  return m;
}
`;

const COLOR_PARS = /* glsl */ `
attribute vec3 aMat;
attribute vec3 iColA;
attribute vec3 iColB;
attribute vec4 iCoat;
varying vec2 vMat;
`;

/**
 * The figures' material: vertex colours, per-vertex metal/roughness (mail shines, cloth doesn't), and colour
 * slots filled per instance — 1: the regiment's colour, 2: its second colour, 3: horse coat, 4: mane (its
 * brightness only, in iCoat.w: WebGL allows just 16 attributes per vertex).
 */
export function crowdMaterial(k: Kit, bones: BoneSet, taps: 1 | 2 | 4, lerp: boolean, cheap = false) {
  const defines: Record<string, string | number> = { CROWD_TAPS: taps };
  if (lerp) defines.CROWD_LERP = "";
  const uBones = { value: bones.texture };
  // `cheap`: diffuse light only (weak computers); the metal/roughness lines then simply don't apply.
  const mat = cheap ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 1, roughness: 1 });
  mat.defines = { ...defines };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uBones = uBones;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${SKIN_PARS}\n${COLOR_PARS}`)
      .replace("#include <skinbase_vertex>", "mat4 cSkin = crowdSkin();\nobjectNormal = mat3(cSkin) * objectNormal;")
      .replace("#include <skinning_vertex>", "transformed = (cSkin * vec4(transformed, 1.0)).xyz;")
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
        float tint = aMat.z;
        vColor.rgb *= tint < 0.5 ? vec3(1.0) : tint < 1.5 ? iColA : tint < 2.5 ? iColB : tint < 3.5 ? iCoat.rgb : iCoat.w * vec3(1.15, 0.95, 0.8);
        vMat = aMat.xy;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vMat;")
      .replace("#include <metalnessmap_fragment>", "float metalnessFactor = vMat.x;")
      .replace("#include <roughnessmap_fragment>", "float roughnessFactor = vMat.y;");
  };
  mat.customProgramCacheKey = () => `crowd-${taps}-${lerp}-${cheap}`;
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.defines = { ...defines };
  depth.onBeforeCompile = (sh) => {
    sh.uniforms.uBones = uBones;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${SKIN_PARS}`)
      .replace("#include <skinbase_vertex>", "mat4 cSkin = crowdSkin();")
      .replace("#include <skinning_vertex>", "transformed = (cSkin * vec4(transformed, 1.0)).xyz;");
  };
  depth.customProgramCacheKey = () => `crowd-depth-${taps}-${lerp}`;
  k.track(mat);
  k.track(depth);
  return { mat, depth };
}

// ---- Instances ---------------------------------------------------------------------------------------------

/** One instanced mesh of one figure type at one level of detail; filled again every frame. */
export class CrowdLayer {
  readonly mesh: THREE.InstancedMesh;
  private anim: THREE.InstancedBufferAttribute;
  private cols: THREE.InstancedBufferAttribute[];
  count = 0;

  constructor(
    k: Kit,
    geo: THREE.BufferGeometry,
    m: { mat: THREE.Material; depth: THREE.Material },
    readonly capacity: number,
  ) {
    const dyn = <T extends THREE.BufferAttribute>(a: T) => a.setUsage(THREE.DynamicDrawUsage) as T;
    this.anim = dyn(new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4));
    geo.setAttribute("iAnim", this.anim);
    this.cols = (["iColA", "iColB", "iCoat"] as const).map((name) => {
      const size = name === "iCoat" ? 4 : 3;
      const a = dyn(new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size));
      geo.setAttribute(name, a);
      return a;
    });
    this.mesh = new THREE.InstancedMesh(k.track(geo), m.mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.customDepthMaterial = m.depth;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.userData.noShadowFit = true;
  }

  begin() {
    this.count = 0;
  }

  /** Adds an instance: matrix (16, column-major), clip, frame, and 12 colour values (A, B, coat, hair). */
  push(matrix: ArrayLike<number>, clip: ClipInfo, frame: number, colors: Float32Array, colorOffset: number) {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    (this.mesh.instanceMatrix.array as Float32Array).set(matrix as Float32Array, i * 16);
    const a = this.anim.array as Float32Array;
    a[i * 4] = clip.row;
    a[i * 4 + 1] = clip.frames;
    a[i * 4 + 2] = frame;
    a[i * 4 + 3] = clip.loop ? 1 : 0;
    for (let c = 0; c < 2; c++) {
      const arr = this.cols[c].array as Float32Array;
      arr[i * 3] = colors[colorOffset + c * 3];
      arr[i * 3 + 1] = colors[colorOffset + c * 3 + 1];
      arr[i * 3 + 2] = colors[colorOffset + c * 3 + 2];
    }
    const coat = this.cols[2].array as Float32Array;
    const o = colorOffset + 6;
    coat[i * 4] = colors[o];
    coat[i * 4 + 1] = colors[o + 1];
    coat[i * 4 + 2] = colors[o + 2];
    coat[i * 4 + 3] = colors[o + 3] * 0.3 + colors[o + 4] * 0.59 + colors[o + 5] * 0.11;
  }

  end() {
    const n = this.count;
    this.mesh.count = n;
    if (!n) return;
    const im = this.mesh.instanceMatrix;
    im.clearUpdateRanges();
    im.addUpdateRange(0, n * 16);
    im.needsUpdate = true;
    for (const a of [this.anim, ...this.cols]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
  }
}

// ---- Geometry from parts -----------------------------------------------------------------------------------

/** Metalness, roughness of the materials figures are made of. */
export const MAT = {
  cloth: [0, 0.88],
  felt: [0, 0.95],
  leather: [0, 0.68],
  mail: [0.9, 0.42],
  iron: [0.85, 0.36],
  skin: [0, 0.55],
  hair: [0, 0.8],
  wood: [0, 0.72],
  gold: [1, 0.3],
  fur: [0, 1],
  horse: [0, 0.6],
  hoof: [0, 0.5],
  eye: [0, 0.15],
} as const satisfies Record<string, readonly [number, number]>;
export type MatName = keyof typeof MAT;

/** Tint slots (see crowdMaterial). */
export const TINT = { none: 0, a: 1, b: 2, coat: 3, hair: 4 } as const;

/** Collects coloured, jointed pieces and merges them into one figure geometry. */
export class Parts {
  private list: THREE.BufferGeometry[] = [];

  /** A rigid piece on one joint. `color` is sRGB hex (multiplied by the tint slot's colour when tinted). */
  add(g: THREE.BufferGeometry, color: THREE.ColorRepresentation, joint: number, mat: MatName, tint: number = TINT.none) {
    const geo = g.index ? g : withIndex(g);
    for (const name of Object.keys(geo.attributes)) if (name !== "position" && name !== "normal") geo.deleteAttribute(name);
    const n = geo.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    const jo = new Uint8Array(n * 4);
    const we = new Uint8Array(n * 4);
    const ma = new Float32Array(n * 3);
    const [metal, rough] = MAT[mat];
    for (let i = 0; i < n; i++) {
      col.set([c.r, c.g, c.b], i * 3);
      jo[i * 4] = joint;
      we[i * 4] = 255;
      ma[i * 3] = metal;
      ma[i * 3 + 1] = rough;
      ma[i * 3 + 2] = tint;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aJoints", new THREE.BufferAttribute(jo, 4));
    geo.setAttribute("aWeights", new THREE.BufferAttribute(we, 4, true));
    geo.setAttribute("aMat", new THREE.BufferAttribute(ma, 3));
    this.list.push(geo);
    return this;
  }

  /** A ready geometry with all the attributes (e.g. the horse). */
  addRaw(g: THREE.BufferGeometry) {
    this.list.push(g);
    return this;
  }

  build() {
    const m = mergeGeometries(this.list, false);
    for (const g of this.list) g.dispose();
    this.list = [];
    if (!m) throw new Error("merge failed");
    return m;
  }
}

function withIndex(g: THREE.BufferGeometry) {
  const n = g.attributes.position.count;
  const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);

/** A tapered cylinder from a (radius ra) to b (radius rb). */
export function limb(a: V3, b: V3, ra: number, rb: number, radial: number, caps = true) {
  const d = b.clone().sub(a);
  const len = d.length();
  const g = new THREE.CylinderGeometry(rb, ra, len, radial, 1, !caps);
  g.translate(0, len / 2, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  g.translate(a.x, a.y, a.z);
  return g;
}

/** An ellipsoid at c with radii r. */
export function blob(c: V3, r: V3, w: number, h: number) {
  return new THREE.SphereGeometry(1, w, h).scale(r.x, r.y, r.z).translate(c.x, c.y, c.z);
}

/** A box of size s at c, turned by euler e. */
export function box(c: V3, s: V3, e?: THREE.Euler) {
  const g = new THREE.BoxGeometry(s.x, s.y, s.z);
  if (e) g.applyQuaternion(new THREE.Quaternion().setFromEuler(e));
  return g.translate(c.x, c.y, c.z);
}

/** Geometry turned so its +y axis points along `dir`, then moved to `at`. */
export function along(g: THREE.BufferGeometry, dir: V3, at: V3) {
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.clone().normalize()));
  return g.translate(at.x, at.y, at.z);
}

// ---- Procedural skeleton -----------------------------------------------------------------------------------

export interface RigJoint {
  parent: number;
  pivot: V3;
}

export interface Pose {
  /** Local rotation per joint (x: lean/swing, y: twist, z: sideways), radians. */
  rot?: Record<number, [number, number, number]>;
  /** Root (joint 0) translation. */
  offset?: [number, number, number];
  /** Joints shrunk to nothing (weapons not in use). */
  hide?: number[];
  /** Weapons pointed in a direction (in the figure's own frame): joint → [rest direction, wanted direction]. */
  aim?: Record<number, [V3, V3]>;
}

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _t1 = new THREE.Matrix4();
const _t2 = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const ZERO = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4);

/** Deformation matrices of a procedural skeleton for a pose (`base` is applied to all, e.g. the horse's back). */
export function solveRig(joints: RigJoint[], pose: Pose, out: THREE.Matrix4[], base?: THREE.Matrix4) {
  for (let j = 0; j < joints.length; j++) {
    const { parent, pivot } = joints[j];
    const m = out[j];
    if (parent < 0) m.identity();
    else m.copy(out[parent]);
    if (j === 0 && pose.offset) m.multiply(_t1.makeTranslation(pose.offset[0], pose.offset[1], pose.offset[2]));
    const aim = pose.aim?.[j];
    if (aim) {
      // Local rotation that makes the world direction come out as wanted.
      _q.setFromRotationMatrix(_r.extractRotation(m)).invert();
      _q2.setFromUnitVectors(aim[0].clone().normalize(), aim[1].clone().normalize());
      _q.multiply(_q2);
      _r.makeRotationFromQuaternion(_q);
    } else {
      const r = pose.rot?.[j];
      _r.makeRotationFromEuler(_e.set(r?.[0] ?? 0, r?.[1] ?? 0, r?.[2] ?? 0, "YXZ"));
    }
    m.multiply(_t1.makeTranslation(pivot.x, pivot.y, pivot.z)).multiply(_r);
    if (pose.hide?.includes(j)) m.multiply(ZERO);
    m.multiply(_t2.makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  }
  if (base) for (const m of out) m.premultiply(base);
  return out;
}

/** Smooth step between keyframes: value at phase p of [p0, v0], [p1, v1], … (looping if `loop`). */
export function keys(p: number, ks: [number, number][], loop = true) {
  if (loop) {
    p = ((p % 1) + 1) % 1;
    if (p < ks[0][0]) p += 1;
  }
  for (let i = 0; i < ks.length; i++) {
    const [p1, v1] = ks[i];
    const [p2, v2] = i + 1 < ks.length ? ks[i + 1] : loop ? [ks[0][0] + 1, ks[0][1]] : ks[i];
    if (p >= p1 && p <= p2) {
      const t = p2 > p1 ? (p - p1) / (p2 - p1) : 0;
      return v1 + (v2 - v1) * t * t * (3 - 2 * t);
    }
  }
  return p < ks[0][0] ? (loop ? ks[ks.length - 1][1] : ks[0][1]) : ks[ks.length - 1][1];
}
