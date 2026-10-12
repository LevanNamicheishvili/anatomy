import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
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

/** Hero models (David's Draco GLBs): LOD0 for the close-up, LOD1 once the camera is pulled back. */
const HERO_DIR = "/models/geography/waterfalls/";
const DRACO_DIR = "/draco/";
/** Camera-to-target distance beyond which LOD1 replaces LOD0 (orbit range is 6…40). */
const LOD1_DISTANCE = 26;

const smooth = (a: number, b: number, x: number) => {
  if (a === b) return x < a ? 0 : 1;
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

const FOG_GLSL = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
vec3 applyFog(vec3 c, vec3 wp) {
  return mix(c, uFogColor, smoothstep(uFogNear, uFogFar, distance(cameraPosition, wp)));
}`;

const SHEET_VERT = /* glsl */ `
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec3 p = position;
  float s = uv.y;
  // The sheet ripples and bulges more and more as it falls and thins out.
  float w = sin(uv.x * 19.0 + uSeed + uTime * 1.6 - s * 8.0) * 0.5 + sin(uv.x * 43.0 - uTime * 2.4 + s * 15.0 + uSeed) * 0.5;
  p.z += w * 0.045 * s * s + 0.02 * sin(uTime * 3.1 + uv.x * 7.0 + s * 20.0) * s;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const SHEET_FRAG = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uStrands;
uniform float uSeed;
uniform float uThick;
uniform vec3 uColor;
uniform vec3 uDeepColor;
uniform vec3 uSky;
uniform vec3 uSun;
varying vec2 vUv;
varying vec3 vWorld;
${GLSL_NOISE}
${FOG_GLSL}
void main() {
  float across = vUv.x;
  float along = vUv.y;
  float t = uTime * uSpeed;
  // Water accelerates, so the same pattern is stretched out the further it has fallen.
  float yc = along * 5.0 / (1.0 + along * 2.0);
  float sc = 1.0 + along * 1.4; // scroll gets quicker with the fall
  float s1 = fbm2(vec2(across * 26.0 + uSeed, yc * 2.0 - t * 1.5 * sc));
  float s2 = vnoise(vec2(across * 74.0 + uSeed * 2.0, yc * 1.1 - t * 2.3 * sc));
  float s3 = fbm2(vec2(across * 8.0 + uSeed, yc * 3.0 - t * 1.0 * sc));
  float streak = s1 * 0.55 + s2 * 0.45;

  float rag = 0.05 + 0.1 * along + 0.05 * vnoise(vec2(along * 9.0 - t * 2.0, uSeed));
  float edge = smoothstep(0.0, rag, across) * smoothstep(1.0, 1.0 - rag, across);
  float strands = 1.0;
  if (uStrands > 0.5) {
    float w = sin(across * uStrands * 6.2831 + fbm2(vec2(across * 4.0, yc * 1.2 + uSeed)) * 2.5);
    strands = mix(1.0, smoothstep(-0.3 + along * 0.3, 0.35, w), 0.6 + 0.4 * along);
  }

  // Thick, glassy water near the lip; thin and ragged below.
  float prof = pow(max(0.0, sin(3.14159 * across)), 0.55);
  float thick = clamp(prof * mix(1.0, 0.45, along) * (0.7 + 0.6 * s3) * (0.6 + 0.5 * uThick), 0.0, 1.0);
  float aer = clamp(smoothstep(0.0, 0.9, along) * 0.85 + 0.4 * (streak - 0.4) + 0.25 * (s3 - 0.4), 0.0, 1.0);
  // Holes open up in the sheet: it breaks into ragged strands towards the bottom.
  float thr = along * along * 0.66;
  float holes = smoothstep(thr - 0.1, thr + 0.1, streak + 0.12 * s3);

  // Normal from screen-space derivatives, roughened by the streaks.
  vec3 N = cross(dFdx(vWorld), dFdy(vWorld));
  N = dot(N, N) > 1e-12 ? normalize(N) : vec3(0.0, 0.0, 1.0);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  N = normalize(N + vec3((s1 - 0.5) * 0.5, (s3 - 0.5) * 0.2, (s2 - 0.5) * 0.35));
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 H = normalize(uSun + V);
  float spec = pow(max(dot(N, H), 0.0), 48.0) * (0.35 + 0.65 * streak);

  // Refraction-like tint: deep blue-green where it is thick and clear, white where it is aerated.
  vec3 body = mix(uColor, uDeepColor, thick * (1.0 - aer));
  vec3 foam = vec3(0.93, 0.96, 0.98);
  vec3 col = mix(body, foam, clamp(aer * 0.95 + s2 * 0.25 * along, 0.0, 1.0));
  col = mix(col, uSky, fres * 0.35);
  col += spec * vec3(1.0, 0.96, 0.88) * 0.7;
  col = applyFog(col, vWorld);

  float a = edge * strands * holes * (0.22 + 0.6 * thick + 0.45 * aer);
  a *= smoothstep(1.0, 0.9, along) * smoothstep(0.0, 0.02, along);
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.94));
  #include <colorspace_fragment>
}`;

const WAVES_GLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uFoam[4];
uniform float uFlow;
${GLSL_NOISE}
// Water surface height: rings running out from every plunge point plus a slow swell.
float waveH(vec2 p) {
  float h = 0.0;
  for (int i = 0; i < 4; i++) {
    float d = length(p - uFoam[i].xy) / max(0.01, uFoam[i].z);
    float env = smoothstep(3.2, 0.25, d) * (0.4 + 0.6 * smoothstep(0.0, 0.5, d));
    h += sin(d * 11.0 - uTime * 3.4) * 0.05 * env * (0.5 + 0.5 * uFlow);
    h += sin(d * 23.0 - uTime * 5.1 + float(i)) * 0.018 * env;
  }
  h += (vnoise(p * 1.7 + vec2(0.0, -uTime * 0.6 * uFlow)) - 0.5) * 0.06;
  return h;
}`;

const POOL_VERT = /* glsl */ `
${WAVES_GLSL}
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  w.y += waveH(w.xz);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const POOL_FRAG = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uSun;
varying vec3 vWorld;
${WAVES_GLSL}
${FOG_GLSL}
void main() {
  vec2 p = vWorld.xz;
  float e = 0.07;
  float h0 = waveH(p);
  float hx = waveH(p + vec2(e, 0.0));
  float hz = waveH(p + vec2(0.0, e));
  float r1 = fbm2(p * 0.9 + vec2(0.0, -uTime * 0.7 * uFlow));
  float r2 = fbm2(p * 2.7 + vec2(uTime * 0.15, -uTime * 1.3 * uFlow));
  vec3 N = normalize(vec3(-(hx - h0) / e, 1.0, -(hz - h0) / e) + vec3((r2 - 0.5) * 0.16, 0.0, (r1 - 0.5) * 0.12));
  vec3 V = normalize(cameraPosition - vWorld);

  float foam = 0.0;
  float depthK = 0.0;
  float near = 0.0;
  for (int i = 0; i < 4; i++) {
    vec2 c = uFoam[i].xy;
    float rr = uFoam[i].z;
    vec2 q = p - c;
    q.y -= max(0.0, q.y) * 0.45; // the foam patch is dragged downstream
    float d = length(q) / max(0.01, rr);
    float churn = fbm2(p * 2.4 + vec2(float(i) * 7.3, -uTime * 1.6));
    float fine = vnoise(p * 7.0 + vec2(float(i) * 3.1, -uTime * 2.2));
    depthK = max(depthK, smoothstep(1.7, 0.2, d));
    near = max(near, smoothstep(3.0, 0.6, d));
    foam += smoothstep(1.3, 0.0, d) * smoothstep(0.26, 0.6, churn + (1.0 - d) * 0.55);
    // The boil ring where the plunging water resurfaces, torn up by noise.
    foam += 0.6 * smoothstep(0.2, 0.0, abs(d - 0.62)) * smoothstep(0.35, 0.7, churn * 0.7 + fine * 0.5);
    // A wider ring that spreads out and thins away.
    float ph = fract(uTime * 0.22 + float(i) * 0.31);
    foam += 0.5 * (1.0 - ph) * smoothstep(0.16, 0.0, abs(d - (0.7 + ph * 1.4))) * smoothstep(0.4, 0.72, churn + fine * 0.35);
  }
  float streaks = smoothstep(0.62, 0.8, fbm2(vec2(p.x * 3.0, p.y * 0.6 - uTime * 0.9 * uFlow)));
  foam = clamp(foam + streaks * (0.12 + 0.3 * near), 0.0, 1.0);

  // Depth tint: darker and bluer where the plunging water has dug the bowl.
  vec3 body = mix(uDeep, uShallow, clamp(0.12 + 0.65 * r1, 0.0, 1.0));
  body = mix(body, uDeep * 0.5, depthK * 0.65);
  body += vec3(0.9, 0.95, 1.0) * pow(r2, 5.0) * 0.35;

  // Sky reflection by fresnel, with a hint of cloud and a sun glint.
  float fres = 0.06 + 0.94 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
  vec3 R = reflect(-V, N);
  vec3 skyCol = mix(uSky * 1.08, vec3(1.0), 0.35 * fbm2(R.xz * 3.0 + 4.0));
  float glint = pow(max(dot(R, uSun), 0.0), 120.0);
  vec3 col = mix(body, skyCol, fres * 0.8);
  col += vec3(1.0, 0.96, 0.85) * glint * 0.9 * (1.0 - foam);
  col = mix(col, vec3(0.95, 0.97, 0.99), foam * 0.96);
  col = applyFog(col, vWorld);
  gl_FragColor = vec4(col, 0.88 + foam * 0.1);
  #include <colorspace_fragment>
}`;

type Kind = "drop" | "spray" | "mist" | "foam" | "splash";

/** Wet, glossy rock: a per-vertex wetness attribute darkens the rock and drops its roughness. */
function rockMaterial(vertexColors: boolean, roughness: number) {
  const m = new THREE.MeshStandardMaterial({ vertexColors, roughness, flatShading: true });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aWet;\nvarying float vWet;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWet = aWet;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vWet;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.5, vWet);")
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.16, vWet);");
  };
  return m;
}

export class WaterfallScene {
  /** Fires once the hero GLB (LOD0) replaces the procedural scene. */
  onHeroLoaded: (() => void) | null = null;
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
  private splash: ParticleCloud;
  private dropP: P[] = [];
  private sprayP: P[] = [];
  private mistP: P[] = [];
  private foamP: P[] = [];
  private splashP: P[] = [];
  /** Procedural rock, ledges, boulders and trees — hidden once the hero model has loaded. */
  private procedural = new THREE.Group();
  /** Procedural animated water (sheets + pools) — replaced by the hero's own water meshes. */
  private proceduralWater = new THREE.Group();
  private heroes: { lod0: THREE.Object3D | null; lod1: THREE.Object3D | null } = { lod0: null, lod1: null };
  private draco: DRACOLoader | null = null;
  private sunDir = new THREE.Vector3(-8, 18, 10).normalize();
  private fogUniforms: Record<string, THREE.IUniform>;
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
    this.scene.fog = new THREE.Fog(preset.sky, 26, 80);
    this.fogUniforms = { uFogColor: { value: new THREE.Color(preset.sky) }, uFogNear: { value: 26 }, uFogFar: { value: 80 } };
    // Warm low sun, a sky-tinted hemisphere above and cool damp earth bounce below.
    const sun = new THREE.DirectionalLight("#ffe6bd", 2.4);
    sun.position.copy(this.sunDir).multiplyScalar(20);
    const skyTint = new THREE.Color(preset.sky).lerp(new THREE.Color("#ffffff"), 0.35);
    this.scene.add(new THREE.HemisphereLight(skyTint, "#3f3a33", 1.0), sun);

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
      this.falls.push({ face: z, top, bottom, lipZ, width: tier.width, vz, T, landZ: lipZ + vz * T, poolR: Math.max(1.2, tier.width * 0.65) * preset.poolScale, weight: tier.width * tier.drop });
      y = bottom;
      z += tier.run;
    }
    this.zEnd = z + 4;
    this.upstreamHalf = preset.tiers[0].width * 0.6 + 0.5;

    this.procedural.add(this.buildTerrain());
    for (const f of this.falls) {
      this.procedural.add(this.buildLedge(f));
      this.proceduralWater.add(this.buildSheet(f, this.falls.indexOf(f)));
    }
    this.procedural.add(this.buildRocks());
    if (preset.trees) this.procedural.add(this.buildTrees());
    this.scene.add(this.procedural, this.proceduralWater);

    // Water: the stream above the first fall, then one pool / bench per tier.
    const foam = [0, 1, 2, 3].map((i) => {
      const f = this.falls[i];
      return f ? new THREE.Vector3(0, f.landZ, f.poolR * 1.2) : new THREE.Vector3(999, 999, 0.01);
    });
    this.poolMat = new THREE.ShaderMaterial({
      vertexShader: POOL_VERT,
      fragmentShader: POOL_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color(preset.deep) },
        uShallow: { value: new THREE.Color(preset.shallow) },
        uFoam: { value: foam },
        uFlow: { value: 0.6 + preset.flow * 0.6 },
        uSky: { value: new THREE.Color(preset.sky) },
        uSun: { value: this.sunDir },
        ...this.fogUniforms,
      },
      transparent: true,
      depthWrite: false,
    });
    const level = (zFrom: number, zTo: number, yy: number, half: number) => {
      // Enough vertices for the ripples to bend the surface, capped for weak GPUs.
      const sx = Math.min(70, Math.max(1, Math.ceil((half * 2) / 0.3)));
      const sz = Math.min(110, Math.max(1, Math.ceil((zTo - zFrom) / 0.3)));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, zTo - zFrom, sx, sz), this.poolMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, yy, (zFrom + zTo) / 2);
      m.renderOrder = 1;
      return m;
    };
    this.proceduralWater.add(level(Z_START, this.falls[0].lipZ - 0.1, this.falls[0].top + 0.14, this.upstreamHalf + 0.6));
    this.falls.forEach((f, i) => {
      const next = this.falls[i + 1];
      // Between two falls the water only covers the bench in front of the next ledge.
      const half = next ? Math.max(f.width, next.width) * 0.75 + 0.6 : preset.halfValley + 1.2;
      this.proceduralWater.add(level(f.face + 0.05, next ? next.lipZ - 0.1 : this.zEnd + 30, f.bottom + 0.14, half));
    });

    // Particles. Each fall gets a share by its size.
    const flow = preset.flow;
    this.drops = new ParticleCloud(Math.round(220 + 160 * flow), { soft: 0.2, order: 3 });
    this.spray = new ParticleCloud(Math.round(380 + 420 * flow), { soft: 0.5, order: 4 });
    this.mist = new ParticleCloud(Math.min(520, Math.round((200 + 220 * flow) * preset.mist)), { soft: 1, order: 5 });
    this.foam = new ParticleCloud(420, { soft: 0.7, order: 2 });
    this.splash = new ParticleCloud(Math.round(140 + 180 * flow), { soft: 0.35, order: 4 });
    const mk = (n: number, life: number): P[] =>
      Array.from({ length: n }, (_, i) => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: life * (0.6 + 0.8 * hash01(i, 3)), fall: this.pickFall(hash01(i, 7)), size: 0.5 + hash01(i, 9), seed: hash01(i, 11) }));
    this.dropP = mk(this.drops.count, 1);
    this.sprayP = mk(this.spray.count, 1.1);
    this.mistP = mk(this.mist.count, 4.5);
    this.foamP = mk(this.foam.count, 3.2);
    this.splashP = mk(this.splash.count, 1.2);
    // Start each particle at a different moment, so they never move in lockstep.
    const kinds = [["drop", this.dropP], ["spray", this.sprayP], ["mist", this.mistP], ["foam", this.foamP], ["splash", this.splashP]] as const;
    for (const [kind, list] of kinds)
      list.forEach((p, i) => {
        this.respawn(list, i, kind);
        p.age = -p.life * p.seed;
      });
    this.scene.add(this.foam.points, this.drops.points, this.spray.points, this.mist.points, this.splash.points);

    const f0 = this.falls.reduce((a, b) => (b.weight > a.weight ? b : a));
    const last = this.falls[this.falls.length - 1];
    this.anchors = {
      cap: new THREE.Vector3(-f0.width / 2 - 0.6, f0.top - 0.2, f0.lipZ),
      soft: new THREE.Vector3(f0.width / 2 + 0.9, f0.top - Math.min(2.2, (f0.top - f0.bottom) * 0.4), f0.face + 0.15),
      pool: new THREE.Vector3(-f0.poolR * 0.9, f0.bottom + 0.35, f0.landZ + 0.4),
      mist: new THREE.Vector3(f0.width * 0.7 + 0.6, f0.bottom + 2.6, f0.landZ + 1.2),
      river: new THREE.Vector3(0.8, last.bottom + 0.5, this.zEnd - 3),
      upstream: new THREE.Vector3(0, this.falls[0].top + 0.6, -6),
    };

    // Warm up so the water is already flowing on the first frame.
    for (let i = 0; i < 120; i++) this.simulate(1 / 30);

    const mid = (this.falls[0].landZ + last.landZ) / 2;
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
    this.loadHeroes();
  }

  /**
   * Swap the procedural valley for the hero model. The procedural scene stays up until LOD0 arrives
   * (and stays for good if loading fails, e.g. 401 when signed out). Particles keep running on top.
   */
  private loadHeroes() {
    this.draco = new DRACOLoader().setDecoderPath(DRACO_DIR);
    const loader = new GLTFLoader().setDRACOLoader(this.draco);
    const id = this.preset.id;
    const prep = (root: THREE.Object3D) => {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.computeVertexNormals();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if (/water|mist/i.test(mat.name)) {
            mat.depthWrite = false;
            mat.transparent = true;
            m.renderOrder = /mist/i.test(mat.name) ? 5 : 1;
          }
        }
      });
      root.visible = false;
      this.scene.add(root);
      return root;
    };
    const load = (file: string) =>
      new Promise<THREE.Object3D | null>((res) => loader.load(HERO_DIR + file, (g) => res(this.disposed ? null : prep(g.scene)), undefined, () => res(null)));
    load(`${id}.glb`).then((lod0) => {
      if (!lod0 || this.disposed) return;
      this.heroes.lod0 = lod0;
      this.procedural.visible = false;
      this.proceduralWater.visible = false;
      this.updateLod();
      this.onHeroLoaded?.();
      // LOD1 only matters once the user zooms out, so fetch it after LOD0 is on screen.
      load(`${id}-lod1.glb`).then((lod1) => {
        if (!lod1 || this.disposed) return;
        this.heroes.lod1 = lod1;
        this.updateLod();
      });
    });
  }

  /** Exactly one hero visible: LOD1 when far and loaded, otherwise LOD0. */
  private updateLod() {
    const { lod0, lod1 } = this.heroes;
    if (!lod0) return;
    const far = !!lod1 && this.camera.position.distanceTo(this.controls.target) > LOD1_DISTANCE;
    lod0.visible = !far;
    if (lod1) lod1.visible = far;
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
      if (d < 1 && z > f.face) floor -= pr.poolDepth * (1 - d * d);
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
    const wet = new Float32Array(nx * nz);
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
        const band = Math.sin(y * 2.2 * pr.beds + fbm(x * 0.25, z * 0.25, 2) * 3);
        if (band < -0.25) c.lerp(soft, 0.7);
        else if (band > 0.55) c.offsetHSL(0, 0, 0.1);
        // Thin bedding planes between the main strata.
        if (Math.sin(y * 7.5 * pr.beds + n * 4) > 0.82) c.offsetHSL(0, 0, -0.06);
        c.offsetHSL(0, 0, 0.07 * noise2(x * 4.1 + z * 2.3, y * 3.7));
        const joint = Math.abs(noise2((z + x) * (pr.ledge === "blocky" ? 3.2 : 1.7), Math.floor(y * 1.1 * pr.beds)));
        if (joint < 0.06) c.lerp(dark, 0.6);
        // Plants hang on to narrow ledges on the walls.
        if (up > 0.3 && pr.vegAmount > 0.5) c.lerp(veg, 0.6 * pr.vegAmount * smooth(0.3, 0.6, up));
      }
      // Wet, darker rock next to the falling water; moss where the mist keeps it damp.
      let wetK = 0;
      for (const f of this.falls) {
        const near = Math.max(0, 1 - Math.hypot(x / (f.width * 0.9 + 1.4), (z - f.face) / 2.8));
        if (near > 0) {
          c.lerp(dark, near * 0.55);
          if (pr.vegAmount > 0.5 && steep > 0.4) c.lerp(moss, near * 0.45 * (0.5 + 0.5 * n));
          wetK = Math.max(wetK, near);
        }
        // Splash zone: rock just above each pool level stays soaked.
        const lvl = f.bottom + 0.14;
        if (z > f.face && Math.abs(x) < this.half(z) + 0.8) wetK = Math.max(wetK, smooth(lvl + 1.4, lvl, y) * smooth(f.landZ + 7, f.landZ + 1, z) * 0.9);
      }
      wet[k] = Math.min(1, wetK * 1.1);
      // Moss and lichen on the upward-facing ledges of the upper walls.
      if (steep > 0.12 && up > 0.42 && y > this.falls[0].top * 0.35) c.lerp(moss, smooth(0.42, 0.8, up) * Math.min(1, pr.vegAmount + 0.2) * 0.6 * (0.4 + 0.6 * (0.5 + 0.5 * n)) * (1 - wetK * 0.4));
      const inChannel = Math.abs(x) < this.half(z) + 0.4;
      if (inChannel && steep < 0.5) c.copy(gravel).lerp(dark, 0.3 + 0.3 * n);
      else if (!inChannel && steep < 0.6) c.lerp(veg, Math.min(1, pr.vegAmount * (0.75 + 0.5 * n)));
      c.toArray(col, k * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aWet", new THREE.BufferAttribute(wet, 1));
    return new THREE.Mesh(geo, rockMaterial(true, 0.92));
  }

  /** The hard cap rock sticking out over the undercut face — water leaves the rock at its edge. */
  private buildLedge(f: Fall) {
    const pr = this.preset;
    const width = (f === this.falls[0] ? this.upstreamHalf : pr.halfValley) * 2 + 1.2;
    const depth = 1.6 + f.lipZ - f.face;
    const thick = pr.ledgeThick;
    const lip = f.lipZ - f.face;
    const geo = new THREE.BoxGeometry(width, thick, depth, 36, 4, 10);
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const wet = new Float32Array(pos.count);
    const moss = new THREE.Color("#4f7a3a");
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
      let recede = lip * (0.15 + 0.85 * smooth(f.width * 0.35 / (width / 2), 1, side)) + 0.25 * side;
      let yy = y < 0 ? y - 0.34 * Math.max(0, fbm(x * 2.1, f.face + 4, 2)) * (1 - side) : y;
      const wx = Math.abs(x) / Math.max(0.4, f.width * 0.5);
      if (pr.ledge === "notched") {
        // The stream has sawn a V into the cap rock: the lip juts out only in the notch, the top dips there.
        recede += lip * 0.6 * smooth(0.6, 1.6, wx);
        if (y > 0) yy -= thick * 0.55 * Math.max(0, 1 - wx * 0.7);
      } else if (pr.ledge === "rounded") {
        // Travertine lip: lime builds a rounded, bulging edge.
        if (y > 0) yy -= thick * 0.6 * smooth(0.55, 1, u);
        if (y < 0) yy += thick * 0.35 * smooth(0.6, 1, u);
      } else {
        // Basalt: square columns, each broken off at a slightly different place.
        const col = Math.floor(x / 0.55 + 100);
        recede += (hash01(col, 31) - 0.5) * 0.45 * (u > 0.5 ? 1 : 0);
        if (y > 0) yy += (hash01(col, 32) - 0.5) * 0.18;
      }
      const zz = -depth / 2 + u * (depth - Math.max(0, recede));
      pos.setXYZ(i, x + 0.05 * n, yy + 0.08 * n, zz + (u > 0.99 ? 0.16 * fbm(x * 1.1, f.face, 3) : 0.05 * n));
      c.copy(cap).lerp(dark, Math.max(0, 0.25 + 0.5 * n) * (y < 0 ? 1.75 : 0.7));
      // Moss creeps over the top of the cap rock away from the stream; the lip and underside stay wet.
      if (y > 0 && u < 0.85) c.lerp(moss, Math.min(1, pr.vegAmount + 0.15) * 0.45 * smooth(0.1, 0.8, side) * (0.5 + 0.5 * n));
      wet[i] = Math.min(1, (u > 0.78 ? 0.85 : 0) + (y < 0 ? 0.55 : 0)) * (1 - 0.6 * smooth(0.5, 1, side));
      c.toArray(colors, i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aWet", new THREE.BufferAttribute(wet, 1));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, rockMaterial(true, 0.85));
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
        pos.push(u * f.width * (1 + this.preset.fan * s), y, z + 0.08 * Math.cos(u * Math.PI) * s);
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
      uniforms: {
        uTime: { value: 0 },
        uSpeed: { value: 1.3 + this.preset.flow },
        uStrands: { value: this.preset.strands },
        uSeed: { value: i * 3.7 },
        uThick: { value: this.preset.flow },
        uColor: { value: new THREE.Color(this.preset.shallow) },
        uDeepColor: { value: new THREE.Color(this.preset.deep) },
        uSky: { value: new THREE.Color(this.preset.sky) },
        uSun: { value: this.sunDir },
        ...this.fogUniforms,
      },
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
    const geo = new THREE.DodecahedronGeometry(0.5, 0);
    // The rock shader reads a wetness attribute: boulders sit in the spray zone, so keep them damp.
    geo.setAttribute("aWet", new THREE.BufferAttribute(new Float32Array(geo.getAttribute("position").count).fill(0.45), 1));
    const mesh = new THREE.InstancedMesh(geo, rockMaterial(false, 0.55), n);
    const d = new THREE.Object3D();
    const base = new THREE.Color(this.preset.rock);
    const darkRock = new THREE.Color(this.preset.rockDark);
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
      // Boulders near the impact are soaked and dark; farther ones dry out.
      const soak = Math.max(0, 1 - Math.abs(z - f.landZ) / 7);
      mesh.setColorAt(placed, c.copy(base).offsetHSL(0, 0, (hash01(i, 12) - 0.5) * 0.12).lerp(darkRock, soak * 0.55));
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

  private respawn(list: P[], i: number, kind: Kind) {
    const p = list[i];
    const f = this.falls[p.fall];
    // A taller drop hits the pool harder and throws water higher.
    const punch = Math.min(1.8, 0.6 + 0.3 * Math.sqrt(f.top - f.bottom));
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
      const sp = 1.2 + r(4) * 3 * (0.6 + this.preset.flow * 0.6);
      p.v.set(Math.cos(a) * sp * 0.9, (1.8 + r(5) * 4) * (punch / 1.2), Math.abs(Math.sin(a)) * sp * 0.9 - 0.3);
      p.life = 0.6 + r(6) * 0.8;
    } else if (kind === "splash") {
      // Small droplets thrown up from the impact, each on its own ballistic arc.
      const a = r(2) * Math.PI * 2;
      const rr = r(3) * f.width * 0.3;
      p.p.set(Math.cos(a) * rr, f.bottom + 0.18, f.landZ + Math.sin(a) * rr * 0.5);
      const sp = 0.5 + r(4) * 2.4 * (0.6 + this.preset.flow * 0.5);
      p.v.set(Math.cos(a) * sp, (2.4 + r(5) * 4.2) * punch, Math.sin(a) * sp * 0.7 + 0.2);
      p.life = (2 * p.v.y) / G + 0.05;
    } else if (kind === "mist") {
      // A low blanket over the whole plunge pool, not a column above one spot.
      const spread = f.poolR * 0.9;
      p.p.set(across * 1.2 + (r(8) - 0.5) * spread, f.bottom + 0.15 + r(2) * 0.45, f.landZ + (r(3) - 0.4) * spread * 1.4);
      p.v.set((r(4) - 0.5) * 0.9, 0.1 + r(5) * 0.5, 0.35 + r(6) * 0.9);
      p.life = 3.5 + r(7) * 3;
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
      this.spray.set(i, p.p, (0.1 + 0.24 * p.size) * (0.7 + 0.6 * k), 0.7 * (1 - k) * (1 - k * 0.4), this.white);
    });
    // Splash droplets: small, bright, clean parabolas.
    this.splashP.forEach((p, i) => {
      p.age += dt;
      if (p.age < 0) return this.splash.hide(i);
      const f = this.falls[p.fall];
      if (p.age > p.life || p.p.y < f.bottom + 0.05) this.respawn(this.splashP, i, "splash");
      p.v.y -= G * dt;
      p.p.addScaledVector(p.v, dt);
      const k = Math.min(1, p.age / p.life);
      this.splash.set(i, p.p, 0.035 + 0.05 * p.size, 0.9 * (1 - smooth(0.75, 1, k)), this.white);
    });
    // Mist: a low, dense volume that billows, rises a little and drifts downstream with the river.
    this.mistP.forEach((p, i) => {
      p.age += dt;
      if (p.age < 0) return this.mist.hide(i);
      if (p.age > p.life) this.respawn(this.mistP, i, "mist");
      const f = this.falls[p.fall];
      const k = p.age / p.life;
      const turb = noise2(p.p.x * 0.55 + p.seed * 9, p.p.z * 0.45 - this.t * 0.35);
      const turb2 = noise2(p.p.z * 0.5 + 17, p.p.x * 0.6 + this.t * 0.3 + p.seed * 5);
      const ceil = f.bottom + 0.5 + this.preset.mist * (0.9 + 1.4 * p.size) + 1.6 * k;
      p.v.x += turb * 0.8 * dt;
      p.v.y += ((ceil - p.p.y) * 0.5 + turb2 * 0.35) * dt;
      p.v.y *= 1 - 0.7 * dt;
      p.v.z += (0.9 + 0.5 * turb2 - p.v.z) * 0.35 * dt;
      p.p.addScaledVector(p.v, dt);
      const a = 0.17 * Math.sin(Math.PI * Math.min(1, k * 1.3 + 0.03)) * (0.5 + this.preset.flow * 0.6) * (0.6 + 0.4 * this.preset.mist);
      this.mist.set(i, p.p, (1.0 + 3.2 * k * (0.6 + p.size * 0.6)) * (0.5 + f.width * 0.2), Math.max(0, a), this.mistC);
    });
    // Foam: spreads out from the impact, then floats downstream on the pool.
    this.foamP.forEach((p, i) => {
      p.age += dt;
      if (p.age < 0) return this.foam.hide(i);
      if (p.age > p.life) this.respawn(this.foamP, i, "foam");
      p.v.x *= 1 - 0.8 * dt;
      p.p.addScaledVector(p.v, dt);
      const k = p.age / p.life;
      this.foam.set(i, p.p, 0.28 + 0.4 * p.size, 0.92 * (1 - k * k), this.tmpC.copy(this.foamC));
    });
    this.drops.commit();
    this.spray.commit();
    this.mist.commit();
    this.foam.commit();
    this.splash.commit();
  }

  private projTmp = new THREE.Vector3();

  private project: Projector = (p) => {
    const v = this.projTmp.copy(p).project(this.camera);
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
    for (const c of [this.drops, this.spray, this.mist, this.foam, this.splash]) c.setViewport(px, this.camera.fov);
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
    this.updateLod();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.project, this.anchors);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.timer.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) mat.dispose();
    });
    this.draco?.dispose();
    this.renderer.dispose();
  }
}
