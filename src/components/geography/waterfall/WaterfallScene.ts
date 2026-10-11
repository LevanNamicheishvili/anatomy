import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLSL_NOISE, ParticleCloud, fbm, hash01, noise2 } from "../fx/particles";
import type { WaterfallPreset } from "./waterfall-data";

/*
 * Topic 11 — a waterfall up close. The valley is one height field: a river channel that drops in steps
 * (one per tier), plunge pools under each step and gorge walls on both sides. On top of it: an overhanging
 * cap-rock ledge (hard rock over an undercut soft layer), a falling sheet of water that follows a real
 * projectile curve, and particles for falling drops, spray, rising mist and foam drifting downstream.
 */

export type Projector = (p: THREE.Vector3) => { x: number; y: number; visible: boolean };
export type WaterfallAnchor = "cap" | "soft" | "pool" | "mist" | "river" | "upstream";

const G = 9.8;
const X_HALF = 17;
const Z_START = -24;

interface Fall {
  face: number;
  top: number;
  bottom: number;
  lipZ: number;
  width: number;
  vz: number;
  /** Time of flight from the lip to the pool. */
  T: number;
  landZ: number;
  poolR: number;
  weight: number;
}

interface P {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  life: number;
  fall: number;
  size: number;
  seed: number;
}

const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

const SHEET_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SHEET_FRAG = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uStrands;
uniform float uSeed;
uniform vec3 uColor;
varying vec2 vUv;
${GLSL_NOISE}
void main() {
  float across = vUv.x;
  float along = vUv.y;
  float n = fbm2(vec2(across * 14.0 + uSeed, along * 2.5 - uTime * uSpeed));
  float streak = fbm2(vec2(across * 46.0 + uSeed, along * 1.2 - uTime * uSpeed * 1.35));
  float rag = 0.08 + 0.06 * vnoise(vec2(along * 9.0 - uTime * uSpeed * 2.0, uSeed));
  float edge = smoothstep(0.0, rag, across) * smoothstep(1.0, 1.0 - rag, across);
  float strands = 1.0;
  if (uStrands > 0.5) {
    float w = sin(across * uStrands * 6.2831 + fbm2(vec2(across * 4.0, along * 1.5 + uSeed)) * 2.5);
    strands = smoothstep(-0.25, 0.35, w);
  }
  float aer = smoothstep(0.0, 0.7, along);
  vec3 col = mix(uColor, vec3(0.94, 0.97, 1.0), clamp(0.3 + 0.6 * aer * n + 0.45 * streak, 0.0, 1.0));
  float a = edge * strands * (0.5 + 0.5 * n + 0.25 * streak) * (0.7 + 0.3 * aer);
  a *= smoothstep(1.0, 0.86, along);
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.96));
  #include <colorspace_fragment>
}`;

const POOL_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const POOL_FRAG = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam[3];
uniform float uFlow;
varying vec3 vWorld;
${GLSL_NOISE}
void main() {
  vec2 p = vWorld.xz;
  float r1 = fbm2(p * 0.9 + vec2(0.0, -uTime * 0.7 * uFlow));
  float r2 = fbm2(p * 2.7 + vec2(uTime * 0.15, -uTime * 1.3 * uFlow));
  vec3 col = mix(uDeep, uShallow, clamp(0.15 + 0.7 * r1, 0.0, 1.0));
  col += vec3(0.9, 0.95, 1.0) * pow(r2, 5.0) * 0.9;
  float foam = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 c = uFoam[i].xy;
    float rr = uFoam[i].z;
    vec2 q = p - c;
    q.y -= max(0.0, q.y) * 0.45; // the foam patch is dragged downstream
    float d = length(q) / max(0.01, rr);
    float churn = fbm2(p * 2.2 + vec2(float(i) * 7.3, -uTime * 1.6));
    foam += smoothstep(1.15, 0.0, d) * smoothstep(0.28, 0.62, churn + (1.0 - d) * 0.45);
  }
  float streaks = smoothstep(0.62, 0.8, fbm2(vec2(p.x * 3.0, p.y * 0.6 - uTime * 0.9 * uFlow)));
  foam = clamp(foam + streaks * 0.35, 0.0, 1.0);
  col = mix(col, vec3(0.93, 0.96, 0.98), foam * 0.92);
  gl_FragColor = vec4(col, 0.86 + foam * 0.12);
  #include <colorspace_fragment>
}`;

export class WaterfallScene {
  onFrame: ((project: Projector, anchors: Record<WaterfallAnchor, THREE.Vector3>) => void) | null = null;
  readonly anchors: Record<WaterfallAnchor, THREE.Vector3>;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private timer = new THREE.Timer();
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private t = 0;
  private falls: Fall[] = [];
  private zEnd: number;
  private upstreamHalf: number;
  private sheetMats: THREE.ShaderMaterial[] = [];
  private poolMat: THREE.ShaderMaterial;
  private drops: ParticleCloud;
  private spray: ParticleCloud;
  private mist: ParticleCloud;
  private foam: ParticleCloud;
  private dropP: P[] = [];
  private sprayP: P[] = [];
  private mistP: P[] = [];
  private foamP: P[] = [];
  private tmpC = new THREE.Color();
  private white = new THREE.Color("#f4f8fb");
  private mistC = new THREE.Color("#e8eff4");
  private foamC = new THREE.Color("#f3f6f7");

  constructor(
    private canvas: HTMLCanvasElement,
    private preset: WaterfallPreset,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(preset.sky);
    this.scene.fog = new THREE.Fog(preset.sky, 30, 75);
    const sun = new THREE.DirectionalLight("#fff3dc", 2.1);
    sun.position.set(-8, 18, 10);
    this.scene.add(new THREE.HemisphereLight("#eaf3ff", "#4b4237", 1.15), sun);

    // Lay out the tiers from the top down; the first face sits at z = 0.
    const total = preset.tiers.reduce((s, t) => s + t.drop, 0);
    let y = total;
    let z = 0;
    for (const tier of preset.tiers) {
      const top = y;
      const bottom = y - tier.drop;
      const vz = 0.9 + preset.flow * 0.9;
      const T = Math.sqrt((2 * (tier.drop + 0.1)) / G);
      const lipZ = z + tier.lip;
      this.falls.push({ face: z, top, bottom, lipZ, width: tier.width, vz, T, landZ: lipZ + vz * T, poolR: Math.max(1.6, tier.width * 0.65), weight: tier.width * tier.drop });
      y = bottom;
      z += tier.run;
    }
    this.zEnd = z + 4;
    this.upstreamHalf = preset.tiers[0].width * 0.6 + 0.5;

    this.scene.add(this.buildTerrain());
    for (const f of this.falls) this.scene.add(this.buildLedge(f), this.buildSheet(f, this.falls.indexOf(f)));
    this.scene.add(this.buildRocks());
    if (preset.trees) this.scene.add(this.buildTrees());

    // Water: the stream above the first fall, then one pool / bench per tier.
    const foam = [0, 1, 2].map((i) => {
      const f = this.falls[i];
      return f ? new THREE.Vector3(0, f.landZ, f.poolR) : new THREE.Vector3(999, 999, 0.01);
    });
    this.poolMat = new THREE.ShaderMaterial({
      vertexShader: POOL_VERT,
      fragmentShader: POOL_FRAG,
      uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color(preset.deep) }, uShallow: { value: new THREE.Color(preset.shallow) }, uFoam: { value: foam }, uFlow: { value: 0.6 + preset.flow * 0.6 } },
      transparent: true,
      depthWrite: false,
    });
    const level = (zFrom: number, zTo: number, yy: number, half: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, zTo - zFrom), this.poolMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, yy, (zFrom + zTo) / 2);
      m.renderOrder = 1;
      return m;
    };
    this.scene.add(level(Z_START, this.falls[0].lipZ - 0.1, this.falls[0].top + 0.14, this.upstreamHalf + 0.6));
    this.falls.forEach((f, i) => {
      const next = this.falls[i + 1];
      // Between two falls the water only covers the bench in front of the next ledge.
      const half = next ? Math.max(f.width, next.width) * 0.75 + 0.6 : preset.halfValley + 1.2;
      this.scene.add(level(f.face + 0.05, next ? next.lipZ - 0.1 : this.zEnd + 30, f.bottom + 0.14, half));
    });

    // Particles. Each fall gets a share by its size.
    const flow = preset.flow;
    this.drops = new ParticleCloud(Math.round(220 + 160 * flow), { soft: 0.2, order: 3 });
    this.spray = new ParticleCloud(Math.round(240 + 260 * flow), { soft: 0.5, order: 4 });
    this.mist = new ParticleCloud(Math.round(80 + 110 * flow), { soft: 1, order: 5 });
    this.foam = new ParticleCloud(220, { soft: 0.7, order: 2 });
    const mk = (n: number, life: number): P[] =>
      Array.from({ length: n }, (_, i) => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: life * (0.6 + 0.8 * hash01(i, 3)), fall: this.pickFall(hash01(i, 7)), size: 0.5 + hash01(i, 9), seed: hash01(i, 11) }));
    this.dropP = mk(this.drops.count, 1);
    this.sprayP = mk(this.spray.count, 1.1);
    this.mistP = mk(this.mist.count, 4.5);
    this.foamP = mk(this.foam.count, 3.2);
    // Start each particle at a different moment, so they never move in lockstep.
    const kinds = [["drop", this.dropP], ["spray", this.sprayP], ["mist", this.mistP], ["foam", this.foamP]] as const;
    for (const [kind, list] of kinds)
      list.forEach((p, i) => {
        this.respawn(list, i, kind);
        p.age = -p.life * p.seed;
      });
    this.scene.add(this.foam.points, this.drops.points, this.spray.points, this.mist.points);

    const f0 = this.falls[0];
    const last = this.falls[this.falls.length - 1];
    this.anchors = {
      cap: new THREE.Vector3(-f0.width / 2 - 0.6, f0.top - 0.2, f0.lipZ),
      soft: new THREE.Vector3(f0.width / 2 + 0.9, f0.top - Math.min(2.2, (f0.top - f0.bottom) * 0.4), f0.face + 0.15),
      pool: new THREE.Vector3(-f0.poolR * 0.9, f0.bottom + 0.35, f0.landZ + 0.4),
      mist: new THREE.Vector3(f0.width * 0.7 + 0.6, f0.bottom + 2.6, f0.landZ + 1.2),
      river: new THREE.Vector3(0.8, last.bottom + 0.5, this.zEnd - 3),
      upstream: new THREE.Vector3(0, f0.top + 0.6, -6),
    };

    // Warm up so the water is already flowing on the first frame.
    for (let i = 0; i < 120; i++) this.simulate(1 / 30);

    const mid = (f0.landZ + last.landZ) / 2;
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, total * 0.45, mid);
    this.camera.position.set(1.8, total * 0.75 + 2.5, last.landZ + 13 + total * 0.55);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI * 0.53;
    this.controls.minAzimuthAngle = -Math.PI * 0.6;
    this.controls.maxAzimuthAngle = Math.PI * 0.6;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  private pickFall(r: number) {
    const sum = this.falls.reduce((s, f) => s + f.weight, 0);
    let acc = 0;
    for (let i = 0; i < this.falls.length; i++) {
      acc += this.falls[i].weight / sum;
      if (r <= acc) return i;
    }
    return this.falls.length - 1;
  }

  /** Valley-floor half-width: narrow stream above the first fall, the gorge below it. */
  private half(z: number) {
    return this.upstreamHalf + (this.preset.halfValley - this.upstreamHalf) * smooth(this.falls[0].face - 0.4, this.falls[0].face + 2.5, z);
  }

  /** Ground height. */
  height(x: number, z: number) {
    const pr = this.preset;
    let floor = this.falls[0].top;
    for (const f of this.falls) {
      const zf = f.face + 0.22 * noise2(x * 0.9, f.face * 3.1);
      floor -= (f.top - f.bottom) * smooth(zf - 0.02, zf + 0.22, z);
      // Plunge pool: a bowl dug by the falling water.
      const d = Math.hypot(x / 1.15, z - f.landZ) / (f.poolR + 0.4);
      if (d < 1 && z > f.face) floor -= 1.1 * (1 - d * d);
    }
    // Rubble and an uneven bed.
    floor += 0.12 * fbm(x * 0.8, z * 0.8, 3);
    const h = this.half(z);
    const ax = Math.abs(x) + 0.7 * fbm(x * 0.35 + 9, z * 0.35, 3);
    const wall = smooth(h, h + pr.wallSteep, ax);
    const rim = this.falls[0].top + pr.wall + 1.6 * fbm(x * 0.15, z * 0.15, 3) + 0.25 * Math.max(0, ax - h - pr.wallSteep);
    // Ledges on the gorge walls: a few hard beds stick out a little.
    const beds = 0.9 * Math.pow(Math.max(0, Math.sin((floor + (rim - floor) * wall) * 1.1 + 0.6 * noise2(z * 0.3, x * 0.1))), 3) * wall * (1 - wall) * 4 * (0.3 + 0.7 * Math.max(0, noise2(z * 0.25 + 5, x * 0.2)));
    return floor + (rim - floor) * wall + beds;
  }

  private buildTerrain() {
    const pr = this.preset;
    const xs: number[] = [];
    for (let x = -X_HALF; x <= X_HALF + 1e-6; x += 0.16) xs.push(x);
    const zSet: number[] = [];
    for (let z = Z_START; z <= this.zEnd + 30; z += 0.22) zSet.push(z);
    // Extra rows on each cliff, so the step is sharp.
    for (const f of this.falls) for (let z = f.face - 0.5; z <= f.face + 0.7; z += 0.035) zSet.push(z);
    const zs = [...new Set(zSet.map((z) => Math.round(z * 1000) / 1000))].sort((a, b) => a - b);
    const nx = xs.length;
    const nz = zs.length;
    const pos = new Float32Array(nx * nz * 3);
    const col = new Float32Array(nx * nz * 3);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) pos.set([xs[i], this.height(xs[i], zs[j]), zs[j]], (j * nx + i) * 3);
    const idx: number[] = [];
    for (let j = 0; j < nz - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const nrm = geo.getAttribute("normal") as THREE.BufferAttribute;
    const rock = new THREE.Color(pr.rock);
    const dark = new THREE.Color(pr.rockDark);
    const soft = new THREE.Color(pr.soft);
    const veg = new THREE.Color(pr.veg);
    const moss = new THREE.Color("#4f7a3a");
    const gravel = new THREE.Color("#8b8478");
    const c = new THREE.Color();
    for (let k = 0; k < nx * nz; k++) {
      const x = pos[k * 3];
      const y = pos[k * 3 + 1];
      const z = pos[k * 3 + 2];
      const up = nrm.getY(k);
      const steep = 1 - smooth(0.55, 0.85, up);
      // On cliffs the pattern runs sideways (rock beds), on flat ground it is patchy.
      const n = steep > 0.5 ? fbm(z * 0.3, y * 0.9, 3) : fbm(x * 0.6, z * 0.6, 3);
      c.copy(rock).lerp(dark, Math.max(0, 0.3 + 0.55 * n));
      if (steep > 0.3) {
        // Hard (light) and soft (dark) beds, cut by vertical joints into blocks.
        const band = Math.sin(y * 2.2 + fbm(x * 0.25, z * 0.25, 2) * 3);
        if (band < -0.25) c.lerp(soft, 0.55);
        else if (band > 0.55) c.offsetHSL(0, 0, 0.07);
        const joint = Math.abs(noise2((z + x) * 1.7, Math.floor(y * 1.1)));
        if (joint < 0.06) c.lerp(dark, 0.6);
        // Plants hang on to narrow ledges on the walls.
        if (up > 0.3 && pr.vegAmount > 0.5) c.lerp(veg, 0.6 * pr.vegAmount * smooth(0.3, 0.6, up));
      }
      // Wet, darker rock next to the falling water; moss where the mist keeps it damp.
      for (const f of this.falls) {
        const near = Math.max(0, 1 - Math.hypot(x / (f.width * 0.9 + 1.4), (z - f.face) / 2.8));
        if (near > 0) {
          c.lerp(dark, near * 0.55);
          if (pr.vegAmount > 0.5 && steep > 0.4) c.lerp(moss, near * 0.45 * (0.5 + 0.5 * n));
        }
      }
      const inChannel = Math.abs(x) < this.half(z) + 0.4;
      if (inChannel && steep < 0.5) c.copy(gravel).lerp(dark, 0.3 + 0.3 * n);
      else if (!inChannel && steep < 0.6) c.lerp(veg, Math.min(1, pr.vegAmount * (0.75 + 0.5 * n)));
      c.toArray(col, k * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
  }

  /** The hard cap rock sticking out over the undercut face — water leaves the rock at its edge. */
  private buildLedge(f: Fall) {
    const pr = this.preset;
    const width = (f === this.falls[0] ? this.upstreamHalf : pr.halfValley) * 2 + 1.2;
    const depth = 1.6 + f.lipZ - f.face;
    const thick = 0.95;
    const lip = f.lipZ - f.face;
    const geo = new THREE.BoxGeometry(width, thick, depth, 36, 4, 10);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const cap = new THREE.Color(pr.cap);
    const dark = new THREE.Color(pr.rockDark);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const n = fbm(x * 1.3 + f.face, y * 2 + z * 1.3, 3);
      // Each vertex keeps its share of the depth; the overhang shrinks away from the water (a rounded lip).
      const u = (z + depth / 2) / depth;
      const side = Math.min(1, Math.abs(x) / (width / 2));
      const recede = lip * (0.15 + 0.85 * smooth(f.width * 0.35 / (width / 2), 1, side)) + 0.25 * side;
      const zz = -depth / 2 + u * (depth - recede);
      // The underside is ragged where blocks have already broken off.
      const yy = y < 0 ? y - 0.18 * Math.max(0, fbm(x * 2.1, f.face + 4, 2)) * (1 - side) : y;
      pos.setXYZ(i, x + 0.05 * n, yy + 0.08 * n, zz + (u > 0.99 ? 0.16 * fbm(x * 1.1, f.face, 3) : 0.05 * n));
      c.copy(cap).lerp(dark, Math.max(0, 0.25 + 0.5 * n) * (y < 0 ? 1.3 : 0.7));
      c.toArray(colors, i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
    m.position.set(0, f.top - thick / 2 + 0.08, f.lipZ - depth / 2);
    return m;
  }

  /** The falling water: a sheet bent along the projectile path y = y₀ − g·t²/2, z = z₀ + v·t. */
  private buildSheet(f: Fall, i: number) {
    const nu = 28;
    const nv = 44;
    const pos: number[] = [];
    const uv: number[] = [];
    for (let j = 0; j <= nv; j++) {
      const s = j / nv;
      const t = s * f.T;
      const y = f.top + 0.12 - 0.5 * G * t * t;
      const z = f.lipZ + f.vz * t;
      for (let k = 0; k <= nu; k++) {
        const u = k / nu - 0.5;
        pos.push(u * f.width * (1 + 0.28 * s), y, z + 0.08 * Math.cos(u * Math.PI) * s);
        uv.push(k / nu, s);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < nv; j++)
      for (let k = 0; k < nu; k++) {
        const a = j * (nu + 1) + k;
        idx.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: SHEET_VERT,
      fragmentShader: SHEET_FRAG,
      uniforms: { uTime: { value: 0 }, uSpeed: { value: 1.3 + this.preset.flow }, uStrands: { value: this.preset.strands }, uSeed: { value: i * 3.7 }, uColor: { value: new THREE.Color(this.preset.shallow) } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.sheetMats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 3;
    return m;
  }

  private buildRocks() {
    const n = 46;
    const mesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), n);
    const d = new THREE.Object3D();
    const base = new THREE.Color(this.preset.rock);
    const c = new THREE.Color();
    let placed = 0;
    for (let i = 0; i < n * 3 && placed < n; i++) {
      const f = this.falls[Math.floor(hash01(i, 1) * this.falls.length)];
      const z = f.landZ + 1 + hash01(i, 2) * (i % 3 === 0 ? 10 : 4);
      const h = this.half(z);
      const x = (hash01(i, 3) * 2 - 1) * (h + 0.3);
      if (Math.abs(x) < f.width * 0.4 && Math.abs(z - f.landZ) < f.poolR) continue;
      d.position.set(x, this.height(x, z) + 0.05, z);
      d.rotation.set(hash01(i, 4) * 3, hash01(i, 5) * 3, hash01(i, 6) * 3);
      const s = 0.35 + hash01(i, 8) * (Math.abs(x) > h - 0.6 ? 1.3 : 0.7);
      d.scale.set(s, s * (0.55 + hash01(i, 9) * 0.4), s * (0.8 + hash01(i, 10) * 0.4));
      d.updateMatrix();
      mesh.setMatrixAt(placed, d.matrix);
      mesh.setColorAt(placed, c.copy(base).offsetHSL(0, 0, (hash01(i, 12) - 0.5) * 0.12));
      placed++;
    }
    mesh.count = placed;
    return mesh;
  }

  private buildTrees() {
    const pr = this.preset;
    const n = pr.trees;
    const geo = new THREE.ConeGeometry(0.55, 2.1, 7);
    geo.translate(0, 1.05, 0);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), n);
    const d = new THREE.Object3D();
    const base = new THREE.Color(pr.veg).offsetHSL(0, 0, -0.08);
    const c = new THREE.Color();
    let placed = 0;
    for (let i = 0; i < n * 8 && placed < n; i++) {
      const x = (hash01(i, 21) * 2 - 1) * X_HALF * 0.95;
      const z = Z_START + 2 + hash01(i, 22) * (this.zEnd - Z_START);
      if (Math.abs(x) < this.half(z) + 1) continue;
      const y = this.height(x, z);
      const slope = Math.abs(this.height(x + 0.3, z) - y) + Math.abs(this.height(x, z + 0.3) - y);
      if (slope > 0.35) continue;
      d.position.set(x, y - 0.1, z);
      const s = 0.6 + hash01(i, 23) * 0.9;
      d.scale.set(s, s * (0.9 + hash01(i, 24) * 0.6), s);
      d.rotation.y = hash01(i, 25) * 6;
      d.updateMatrix();
      mesh.setMatrixAt(placed, d.matrix);
      mesh.setColorAt(placed, c.copy(base).offsetHSL((hash01(i, 26) - 0.5) * 0.04, 0, (hash01(i, 27) - 0.5) * 0.12));
      placed++;
    }
    mesh.count = placed;
    return mesh;
  }

  private respawn(list: P[], i: number, kind: "drop" | "spray" | "mist" | "foam") {
    const p = list[i];
    const f = this.falls[p.fall];
    const r = (s: number) => hash01(i + this.t * 977, s);
    p.age = 0;
    const across = (r(1) - 0.5) * f.width;
    if (kind === "drop") {
      // Drops break off the edges and the face of the sheet.
      const edge = r(2) < 0.5 ? Math.sign(across || 1) * f.width * (0.42 + r(3) * 0.15) : across;
      p.p.set(edge, f.top + 0.1, f.lipZ + 0.05);
      p.v.set((r(4) - 0.5) * 0.5, -r(5) * 0.6, f.vz * (0.85 + r(6) * 0.35));
      p.life = f.T * (1 + r(7) * 0.25);
    } else if (kind === "spray") {
      p.p.set(across * 1.15, f.bottom + 0.15, f.landZ + (r(2) - 0.5) * 0.6);
      const a = r(3) * Math.PI * 2;
      const sp = 1 + r(4) * 2.4 * (0.6 + this.preset.flow * 0.6);
      p.v.set(Math.cos(a) * sp * 0.8, 1.4 + r(5) * 3.2, Math.abs(Math.sin(a)) * sp * 0.9 - 0.3);
      p.life = 0.6 + r(6) * 0.8;
    } else if (kind === "mist") {
      p.p.set(across * 1.3, f.bottom + 0.3 + r(2) * 0.5, f.landZ + (r(3) - 0.3) * 1.2);
      p.v.set((r(4) - 0.5) * 0.7, 0.35 + r(5) * 0.7, 0.25 + r(6) * 0.6);
      p.life = 3 + r(7) * 2.5;
    } else {
      const a = r(2) * Math.PI * 2;
      const rr = r(3) * f.width * 0.45;
      p.p.set(Math.cos(a) * rr, f.bottom + 0.17, f.landZ + Math.sin(a) * rr * 0.6);
      p.v.set(Math.cos(a) * (0.4 + r(4) * 0.6), 0, 0.35 + Math.abs(Math.sin(a)) * 0.5 + r(5) * 0.4);
      p.life = 2.2 + r(6) * 2;
    }
  }

  private simulate(dt: number) {
    this.t += dt;
    // Falling drops: free fall from the lip, gone at the pool.
    this.dropP.forEach((p, i) => {
      p.age += dt;
      if (p.age < 0) return this.drops.hide(i);
      const f = this.falls[p.fall];
      if (p.age > p.life || p.p.y < f.bottom + 0.1) this.respawn(this.dropP, i, "drop");
      p.v.y -= G * dt;
      p.p.addScaledVector(p.v, dt);
      const k = p.age / p.life;
      this.drops.set(i, p.p, 0.04 + 0.06 * p.size, 0.5 * smooth(0, 0.6, k * p.size) * (1 - k * 0.5), this.white);
    });
    // Spray: thrown out of the plunge pool, falls back.
    this.sprayP.forEach((p, i) => {
      p.age += dt;
      if (p.age < 0) return this.spray.hide(i);
      const f = this.falls[p.fall];
      if (p.age > p.life || p.p.y < f.bottom) this.respawn(this.sprayP, i, "spray");
      p.v.y -= G * 0.8 * dt;
      p.v.multiplyScalar(1 - 0.6 * dt);
      p.p.addScaledVector(p.v, dt);
      const k = p.age / p.life;
      this.spray.set(i, p.p, 0.1 + 0.18 * p.size, 0.6 * (1 - k), this.white);
    });
    // Mist: tiny droplets rise in the air pushed out by the fall, drift downstream and evaporate.
    this.mistP.forEach((p, i) => {
      p.age += dt;
      if (p.age < 0) return this.mist.hide(i);
      if (p.age > p.life) this.respawn(this.mistP, i, "mist");
      p.v.y *= 1 - 0.25 * dt;
      p.p.addScaledVector(p.v, dt);
      const k = p.age / p.life;
      const a = 0.16 * Math.sin(Math.PI * Math.min(1, k * 1.4 + 0.05)) * (0.5 + this.preset.flow * 0.6);
      const f = this.falls[p.fall];
      this.mist.set(i, p.p, (0.8 + 3 * k * (0.6 + p.size * 0.6)) * (0.45 + f.width * 0.18), Math.max(0, a), this.mistC);
    });
    // Foam: spreads out from the impact, then floats downstream on the pool.
    this.foamP.forEach((p, i) => {
      p.age += dt;
      if (p.age < 0) return this.foam.hide(i);
      if (p.age > p.life) this.respawn(this.foamP, i, "foam");
      p.v.x *= 1 - 0.8 * dt;
      p.p.addScaledVector(p.v, dt);
      const k = p.age / p.life;
      this.foam.set(i, p.p, 0.22 + 0.3 * p.size, 0.8 * (1 - k), this.tmpC.copy(this.foamC));
    });
    this.drops.commit();
    this.spray.commit();
    this.mist.commit();
    this.foam.commit();
  }

  private project: Projector = (p) => {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 42 / Math.max(0.5, w / h) : 42;
    this.camera.updateProjectionMatrix();
    const px = h * this.renderer.getPixelRatio();
    for (const c of [this.drops, this.spray, this.mist, this.foam]) c.setViewport(px, this.camera.fov);
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = this.reduceMotion ? 0 : Math.min(0.05, this.timer.getDelta());
    if (dt > 0) this.simulate(dt);
    for (const m of this.sheetMats) m.uniforms.uTime.value = this.t;
    this.poolMat.uniforms.uTime.value = this.t;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.project, this.anchors);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) mat.dispose();
    });
    this.renderer.dispose();
  }
}
