import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { fbm } from "@/lib/noise";
import { daylight, type BreezeState } from "./breeze-math";

/*
 * Georgia's Black Sea coast, seen from the south, west on the left: the sea with its waves and surf, the beach
 * and the boulevard palms of Poti, the Rioni running out to sea, the fields and orchards of the Colchis lowland,
 * the forested foothills and the snowy Caucasus, fading into the haze. A physical sky follows the clock (the sun rises over the mountains and sets into the
 * sea; at night the stars, the moon and the town's windows).
 *
 * The breeze is a loop of air: by day from the sea onto the land along the ground, up over the warm land, back
 * out to sea aloft and down over the cool water; at night the other way. Thousands of air parcels run round it,
 * coloured by their temperature, big translucent arrows show the loop, clouds build where the air rises, and the
 * flag on the beach, the smoke from the chimney and the sailing boat all lean with the wind.
 *
 * Units: about a kilometre (heights a little exaggerated, the trees and houses a lot, so that they show).
 * +x is east (inland), +y up, +z towards the viewer.
 */

export interface CoastAnchors {
  sea: THREE.Vector3;
  land: THREE.Vector3;
  mountain: THREE.Vector3;
  seaHigh: THREE.Vector3;
  landHigh: THREE.Vector3;
  seaLow: THREE.Vector3;
  landLow: THREE.Vector3;
  wind: THREE.Vector3;
  km1: THREE.Vector3;
  km2: THREE.Vector3;
  km3: THREE.Vector3;
  town: THREE.Vector3;
  river: THREE.Vector3;
  lowland: THREE.Vector3;
}
export type CoastAnchor = keyof CoastAnchors;

/** Where the camera can be sent (the narration shows what it talks about): position and point looked at. */
export const COAST_VIEWS = {
  overview: [new THREE.Vector3(0, 7, 22), new THREE.Vector3(0.5, 2.2, 0)],
  surface: [new THREE.Vector3(3.2, 1.7, 8.5), new THREE.Vector3(2.4, 0.4, 0)],
  coast: [new THREE.Vector3(-1.2, 2.8, 10), new THREE.Vector3(0, 0.5, 0)],
  mountain: [new THREE.Vector3(17, 4.6, 16.5), new THREE.Vector3(9, 2.6, 2)],
  loop: [new THREE.Vector3(-1, 5.5, 19.5), new THREE.Vector3(-1.2, 2.8, 0)],
  clouds: [new THREE.Vector3(7, 6.2, 11), new THREE.Vector3(5, 5, 0)],
  far: [new THREE.Vector3(0, 12, 34), new THREE.Vector3(0, 2, 0)],
} as const;
export type CoastView = keyof typeof COAST_VIEWS;
export type Projector = (p: THREE.Vector3) => { x: number; y: number; visible: boolean };

/** The detailed part round the breeze: x from the open sea to the mountains, z from behind the loop (−Z) to
 *  the foreground (NEAR). The loop of air stands in the plane z ≈ 0, ±Z deep. */
const X0 = -13;
const X1 = 13;
const Z = 5;
const NEAR = 14;
/** The world goes on to the horizon, coarser. */
const WX0 = -46;
const WX1 = 36;
const WZ = -44;
const WNEAR = 30;
const FLOOR = -1.45;
/** The breeze loop: a rounded rectangle round this centre. */
const LOOP = { cx: -1.5, cy: 2.9, a: 7, b: 2.3 };
const PARCELS = 420;
const WARM = new THREE.Color("#ff7a2e");
const MID = new THREE.Color("#f3efe4");
const COLD = new THREE.Color("#4fa8ff");
/** Added to the sky at night (linear, before exposure). */
const NIGHT_SKY = new THREE.Color(0.012, 0.022, 0.06);

const smooth = THREE.MathUtils.smoothstep;
const rand = (() => {
  let s = 23;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
})();

/** The Rioni's course across the lowland (z as a function of x). */
const riverZ = (x: number) => -1.7 + 0.45 * Math.sin(x * 0.75 + 0.6);

/** Height of the ground (or the sea floor) at (x, z). */
function ground(x: number, z: number) {
  const n = fbm(x * 0.55 + 10, z * 0.55, 1.7, 3);
  // Sea floor: a shallow shelf, then the slope into the deep.
  const d = Math.max(0, -x);
  const bed = -0.05 - Math.min(1.1, 0.04 * d + Math.max(0, d - 3.5) * 0.11) + 0.02 * n;
  const beach = 0.02 + 0.12 * smooth(x, 0, 0.45);
  // Colchis lowland, then the foothills and the high mountains.
  const t = smooth(x, 4.6, 10.6);
  const ridges = Math.abs(fbm(x * 0.38, z * 0.42, 5.3, 4));
  const mountains = 4.05 * t + t * (0.75 * ridges - 0.2) + t * t * 0.45 * fbm(x * 0.9, z * 0.9, 8.1, 3);
  let land = 0.15 + 0.012 * x + 0.04 * n + mountains;
  // The river valley.
  const dz = (z - riverZ(x)) / (0.32 + 0.25 * t);
  land -= (0.06 + 0.5 * t) * Math.exp(-dz * dz) * smooth(x, 0.3, 1.2);
  if (x < 0) return THREE.MathUtils.lerp(bed, beach, smooth(x, -0.3, 0));
  return THREE.MathUtils.lerp(beach, land, smooth(x, 0.25, 0.65));
}

/** Where the town is (Poti, on the coast north of the river mouth). */
const inTown = (x: number, z: number) => x > 0.5 && x < 2.1 && z > riverZ(x) + 0.55 && z < 8;

function terrainColor(x: number, z: number, y: number, up: number, out: THREE.Color) {
  const n = fbm(x * 2.3, z * 2.3, 4.4, 2);
  if (x < 0.02 && y < 0.03) return out.set("#9a8a66").lerp(new THREE.Color("#6f6a52"), smooth(-y, 0.1, 0.8)); // sea floor
  if (x < 0.42) return out.set("#d9c896").offsetHSL(0, 0, n * 0.04); // sand
  if (y > 3.95 + 0.25 * n && up > 0.55) return out.set("#eef2f6"); // snow
  if (up < 0.72 || y > 3.45 + 0.2 * n) return out.set("#7a746a").offsetHSL(0, 0, n * 0.06); // rock
  if (y > 2.9 + 0.2 * n) return out.set("#7d8a4c").offsetHSL(0, 0, n * 0.05); // alpine meadows
  if (y > 0.55) return out.set("#34532a").lerp(new THREE.Color("#4a6b33"), 0.5 + n); // forest
  if (inTown(x, z)) return out.set("#9a9a92").offsetHSL(0, 0, n * 0.05);
  // Fields, tea and orchards: a patchwork.
  const cell = Math.floor(x / 0.33) * 7.13 + Math.floor((z + Math.floor(x / 0.33) * 0.17) / 0.28) * 3.71;
  const h = Math.abs(Math.sin(cell) * 43758.5453) % 1;
  return out.set(["#5f8a3a", "#7ea24c", "#a8a35c", "#4d7a34", "#8fa956", "#6b9442"][Math.floor(h * 6)]).offsetHSL(0, 0, n * 0.04);
}

function heightfield(x0: number, x1: number, z0: number, z1: number, nx: number, nz: number, hide?: (x: number, z: number) => boolean) {
  const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
  geo.rotateX(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, ground(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.getAttribute("normal") as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    terrainColor(pos.getX(i), pos.getZ(i), pos.getY(i), nrm.getY(i), c).toArray(col, i * 3);
    // Under the detailed part: sunk out of sight.
    if (hide?.(pos.getX(i), pos.getZ(i))) pos.setY(i, FLOOR - 2);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

function terrainMeshes() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const near = new THREE.Mesh(heightfield(X0, X1, -Z, NEAR, 300, 220), mat);
  near.receiveShadow = true;
  // The rest of the world on a 1-unit grid; its lines run along the detailed part's edges, so the two meet.
  const far = new THREE.Mesh(heightfield(WX0, WX1, WZ, WNEAR, WX1 - WX0, WNEAR - WZ, (x, z) => x > X0 + 1e-3 && x < X1 - 1e-3 && z > -Z + 1e-3 && z < NEAR - 1e-3), mat);
  far.receiveShadow = true;
  return [near, far];
}

const WATER_VERTEX = /* glsl */ `
  uniform float uTime;
  varying vec3 vPos;
  void main() {
    vec3 p = position;
    p.y += 0.008 * sin(p.x * 3.1 + uTime * 1.2) + 0.006 * sin(p.z * 4.3 - uTime * 1.6 + p.x);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uSun;
  uniform vec3 uSky;
  uniform vec3 uHorizon;
  uniform float uLight;
  uniform float uWind;
  uniform vec3 uFog;
  varying vec3 vPos;
  // Slope of a few travelling waves (the small ones run with the wind).
  vec2 slope(vec2 p) {
    vec2 g = vec2(0.0);
    vec4 waves[5];
    waves[0] = vec4(normalize(vec2(1.0, 0.35)), 2.3, 0.012);
    waves[1] = vec4(normalize(vec2(0.8, -0.6)), 3.7, 0.008);
    waves[2] = vec4(normalize(vec2(-0.3, 1.0)), 6.1, 0.005);
    waves[3] = vec4(vec2(sign(uWind + 1e-4), 0.15), 17.0, 0.0025 * (0.4 + abs(uWind)));
    waves[4] = vec4(normalize(vec2(sign(uWind + 1e-4), -0.4)), 29.0, 0.0016 * (0.4 + abs(uWind)));
    for (int i = 0; i < 5; i++) {
      float ph = dot(waves[i].xy, p) * waves[i].z - uTime * sqrt(waves[i].z) * 1.4;
      g += waves[i].xy * waves[i].z * waves[i].w * cos(ph);
    }
    return g;
  }
  void main() {
    vec2 g = slope(vPos.xz);
    // Calmer far away, where the waves are smaller than a pixel.
    float far = smoothstep(8.0, 30.0, length(cameraPosition - vPos));
    vec3 n = normalize(vec3(-g.x * 2.0 * (1.0 - 0.75 * far), 1.0, -g.y * 2.0 * (1.0 - 0.75 * far)));
    vec3 v = normalize(cameraPosition - vPos);
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    vec3 r = reflect(-v, n);
    vec3 sky = mix(uHorizon, uSky, clamp(r.y * 1.6, 0.0, 1.0));
    float shelf = smoothstep(-3.5, 0.0, vPos.x);
    vec3 deep = mix(vec3(0.006, 0.05, 0.09), vec3(0.02, 0.16, 0.2), shelf);
    vec3 col = mix(deep * (0.15 + 0.85 * uLight), sky, fres);
    float spec = pow(max(dot(r, uSun), 0.0), 220.0) * 3.0 + pow(max(dot(r, uSun), 0.0), 18.0) * 0.12;
    col += vec3(1.0, 0.92, 0.78) * spec * uLight;
    // Surf along the beach.
    float edge = vPos.x + 0.05 * sin(vPos.z * 6.0 + uTime * 0.9) + 0.03 * sin(vPos.z * 17.0 - uTime * 1.7);
    float foam = smoothstep(-0.22, -0.02, edge) * (0.55 + 0.45 * sin(vPos.z * 40.0 + vPos.x * 25.0 + uTime * 2.0));
    foam += smoothstep(-0.5, -0.42, edge) * smoothstep(-0.32, -0.42, edge) * 0.6 * (0.5 + 0.5 * sin(uTime * 1.3 + vPos.z * 2.0));
    col = mix(col, vec3(0.92, 0.95, 0.96) * (0.25 + 0.75 * uLight), clamp(foam, 0.0, 1.0) * 0.85);
    col = mix(col, uFog, smoothstep(26.0, 75.0, length(cameraPosition - vPos)));
    gl_FragColor = vec4(col, 0.94);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function waterUniforms() {
  return {
    uTime: { value: 0 },
    uSun: { value: new THREE.Vector3(0, 1, 0) },
    uSky: { value: new THREE.Color("#4f86c6") },
    uHorizon: { value: new THREE.Color("#b9d3e6") },
    uLight: { value: 1 },
    uWind: { value: 0 },
    uFog: { value: new THREE.Color("#c5d5e2") },
  };
}

function waterMeshes(uniforms: ReturnType<typeof waterUniforms>) {
  const surfaceGeo = new THREE.PlaneGeometry(-WX0 + 0.5, WNEAR - WZ, 240, 200);
  surfaceGeo.rotateX(-Math.PI / 2);
  surfaceGeo.translate((WX0 + 0.5) / 2, 0, (WZ + WNEAR) / 2);
  const surface = new THREE.Mesh(surfaceGeo, new THREE.ShaderMaterial({ uniforms, vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, transparent: true, depthWrite: false }));
  surface.renderOrder = 2;
  return [surface];
}

/** Soft white puff for clouds and smoke. */
function puffTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 9; i++) {
    const x = 64 + (rand() - 0.5) * 40;
    const y = 64 + (rand() - 0.5) * 30;
    const r = 24 + rand() * 22;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.6, "rgba(255,255,255,0.3)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.25, "rgba(240,244,255,0.85)");
  r.addColorStop(0.5, "rgba(200,215,255,0.18)");
  r.addColorStop(1, "rgba(200,215,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** House fronts: walls with rows of windows; the emissive map lights some windows at night. */
function facadeTextures() {
  const make = (lit: boolean) => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = lit ? "#000" : "#ece6da";
    g.fillRect(0, 0, 64, 128);
    for (let y = 8; y < 124; y += 14)
      for (let x = 6; x < 60; x += 14) {
        const on = rand() < 0.3;
        g.fillStyle = lit ? (on ? "#ffcf7a" : "#000") : "#3b4a5a";
        g.fillRect(x, y, 8, 9);
      }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return { map: make(false), emissive: make(true) };
}

/** A geometry with one flat colour, for merging trees and palms into one mesh. */
function painted(geo: THREE.BufferGeometry, color: string) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute("uv");
  const c = new THREE.Color(color);
  const n = g.getAttribute("position").count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}

function treeGeometries() {
  const trunk = painted(new THREE.CylinderGeometry(0.004, 0.006, 0.04, 5).translate(0, 0.02, 0), "#4a3826");
  const fir = mergeGeometries([trunk, painted(new THREE.ConeGeometry(0.03, 0.09, 7).translate(0, 0.075, 0), "#ffffff")]);
  const leafy = mergeGeometries([trunk, painted(new THREE.IcosahedronGeometry(0.032, 1).scale(1, 0.85, 1).translate(0, 0.06, 0), "#ffffff")]);
  // Palm: a slim trunk and drooping fronds.
  const parts = [painted(new THREE.CylinderGeometry(0.0035, 0.005, 0.12, 5).translate(0, 0.06, 0), "#7a6146")];
  for (let k = 0; k < 7; k++) {
    const frond = new THREE.BoxGeometry(0.05, 0.002, 0.011).translate(0.025, 0, 0);
    frond.rotateZ(-0.45 - 0.2 * (k % 2));
    frond.rotateY((k / 7) * Math.PI * 2);
    frond.translate(0, 0.12, 0);
    parts.push(painted(frond, "#3f7a2e"));
  }
  return { fir, leafy, palm: mergeGeometries(parts) };
}

/** A curved ribbon arrow along the loop from angle a0 to a1 (the head at a1). */
function loopArrow(a0: number, a1: number, z: number) {
  const pts: THREE.Vector3[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) pts.push(loopPoint(a0 + ((a1 - a0) * i) / N, 1, new THREE.Vector3(), z));
  const p: number[] = [];
  const idx: number[] = [];
  const alpha: number[] = [];
  const side = new THREE.Vector3();
  const headStart = N - 7;
  for (let i = 0; i <= N; i++) {
    const t = pts[Math.min(N, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
    side.set(-t.y, t.x, 0);
    const w = i < headStart ? 0.16 : 0.42 * (1 - (i - headStart) / (N - headStart)) + 0.001;
    const a = pts[i].clone().addScaledVector(side, w);
    const b = pts[i].clone().addScaledVector(side, -w);
    p.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const fade = Math.min(1, i / 6);
    alpha.push(fade, fade);
    if (i) idx.push((i - 1) * 2, i * 2, (i - 1) * 2 + 1, i * 2, i * 2 + 1, (i - 1) * 2 + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("alpha", new THREE.Float32BufferAttribute(alpha, 1));
  g.setIndex(idx);
  return g;
}

/** Point on the breeze loop at angle a (counter-clockwise: along the ground towards the land first). */
function loopPoint(a: number, lane: number, out: THREE.Vector3, z = 0) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const e = 0.5; // 2 / n for a rounded rectangle (n = 4)
  return out.set(LOOP.cx + LOOP.a * lane * Math.sign(c) * Math.abs(c) ** e, LOOP.cy + LOOP.b * lane * Math.sign(s) * Math.abs(s) ** e, z);
}

const PARCEL_VERTEX = /* glsl */ `
  attribute vec3 color;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const PARCEL_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, uOpacity * smoothstep(0.5, 0.15, d));
  }`;

export class CoastScene {
  onFrame: ((project: Projector, anchors: CoastAnchors) => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1200);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private last = performance.now();
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private sky = new Sky();
  private hemi = new THREE.HemisphereLight("#dfefff", "#4a5a3a", 0.8);
  private sunLight = new THREE.DirectionalLight("#fff3d6", 3);
  private moonLight = new THREE.DirectionalLight("#9fb4ff", 0);
  private sunDir = new THREE.Vector3(0, 1, 0);
  /** Camera on its way to a view: from, to, start time. */
  private flight: { from: [THREE.Vector3, THREE.Vector3]; to: readonly [THREE.Vector3, THREE.Vector3]; start: number } | null = null;
  /** Sunbeams falling on the land ("the sun warms the ground, the ground the air"). */
  private rays = new THREE.Group();
  private rayMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vY;
      varying float vFacing;
      void main() {
        vY = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying float vY;
      varying float vFacing;
      void main() {
        float pulse = 0.6 + 0.4 * smoothstep(0.6, 1.0, fract(vY * 5.0 + uTime * 0.8));
        float fade = smoothstep(0.0, 0.1, vY) * smoothstep(1.0, 0.6, vY);
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.38) * pulse, 0.55 * fade * vFacing * vFacing);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  private water = waterUniforms();
  private stars: THREE.Points;
  private moon: THREE.Sprite;
  private night = 0;
  private light = 1;
  private houses: THREE.MeshStandardMaterial;
  // Air.
  private k = 0;
  private parcels: THREE.Points;
  private parcelMat: THREE.ShaderMaterial;
  private trails: THREE.LineSegments;
  private lane = new Float32Array(PARCELS);
  private angle = new Float32Array(PARCELS);
  private depth = new Float32Array(PARCELS);
  private arrows: { day: THREE.Mesh[]; night: THREE.Mesh[] } = { day: [], night: [] };
  private arrowMat: THREE.ShaderMaterial;
  // Clouds, smoke, flag, boat.
  private landClouds = new THREE.Group();
  private seaClouds = new THREE.Group();
  private smoke: THREE.Sprite[] = [];
  private chimneyTop = new THREE.Vector3(1.75, 0, 2.9);
  private flag: THREE.Mesh;
  private flagTop = new THREE.Vector3(0.3, 0, 4.2);
  private sail: THREE.Group;
  private v = new THREE.Vector3();
  private tint = new THREE.Color();
  readonly anchors: CoastAnchors = {
    sea: new THREE.Vector3(-6, 0.2, 3.8),
    land: new THREE.Vector3(3.2, 0.5, 3.8),
    mountain: new THREE.Vector3(10.5, 5.3, 0),
    seaLow: new THREE.Vector3(-6, 1.1, 0),
    landLow: new THREE.Vector3(3, 1.5, 0),
    seaHigh: new THREE.Vector3(-6, 6.3, 0),
    landHigh: new THREE.Vector3(3, 6.3, 0),
    wind: new THREE.Vector3(-1.5, 0.95, 4.2),
    km1: new THREE.Vector3(10.6, 1, Z),
    km2: new THREE.Vector3(10.6, 2, Z),
    km3: new THREE.Vector3(10.6, 3, Z),
    town: new THREE.Vector3(1.3, 0.55, 3.2),
    river: new THREE.Vector3(3.5, 0.32, riverZ(3.5)),
    lowland: new THREE.Vector3(3.4, 0.4, 8.5),
  };

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.55;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const u = this.sky.material.uniforms;
    u.turbidity.value = 2;
    u.rayleigh.value = 1.2;
    u.mieCoefficient.value = 0.003;
    u.mieDirectionalG.value = 0.85;
    u.cloudCoverage.value = 0.18;
    u.cloudDensity.value = 0.3;
    // Below the horizon the block floats over a dark backdrop (not the sky's white haze).
    // and the night sky is deep blue, not black.
    u.uBackdrop = { value: new THREE.Color("#2e3a44") };
    u.uNightSky = { value: new THREE.Color(0, 0, 0) };
    this.sky.material.fragmentShader = this.sky.material.fragmentShader
      .replace("void main() {", "uniform vec3 uBackdrop;\nuniform vec3 uNightSky;\nvoid main() {")
      .replace("gl_FragColor = vec4( texColor, 1.0 );", "texColor += uNightSky * ( 0.4 + 0.6 * ( 1.0 - max( direction.y, 0.0 ) ) );\ntexColor = mix( texColor, uBackdrop, smoothstep( 0.01, -0.14, direction.y ) );\ngl_FragColor = vec4( texColor, 1.0 );");
    this.sky.scale.setScalar(900);
    this.scene.add(this.sky);
    // Haze: the far coast and mountains fade into the horizon.
    this.scene.fog = new THREE.Fog("#c5d5e2", 26, 75);

    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.0006;
    this.sunLight.shadow.normalBias = 0.02;
    Object.assign(this.sunLight.shadow.camera, { left: -16, right: 16, top: 13, bottom: -13, near: 1, far: 80 });
    this.scene.add(this.hemi, this.sunLight, this.moonLight);

    this.scene.add(...terrainMeshes(), ...waterMeshes(this.water));
    this.buildRiver();
    this.houses = this.buildTown();
    this.buildTrees();

    // Night sky: stars and the moon.
    const starPos: number[] = [];
    for (let i = 0; i < 1400; i++) {
      const a = rand() * Math.PI * 2;
      const e = Math.asin(0.05 + rand() * 0.95);
      starPos.push(Math.cos(e) * Math.cos(a) * 400, Math.sin(e) * 400, Math.cos(e) * Math.sin(a) * 400);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: "#e8eeff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: "#f4f6ff", transparent: true, depthWrite: false, fog: false }));
    this.moon.scale.setScalar(22);
    this.scene.add(this.stars, this.moon);
    for (let i = 0; i < 6; i++) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 10, 1, true), this.rayMat);
      beam.renderOrder = 4;
      this.rays.add(beam);
    }
    this.rays.visible = false;
    this.scene.add(this.rays);

    // Air parcels and their short trails.
    this.parcelMat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 60 }, uOpacity: { value: 1 } }, vertexShader: PARCEL_VERTEX, fragmentShader: PARCEL_FRAGMENT, transparent: true, depthWrite: false });
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARCELS * 3), 3).setUsage(THREE.DynamicDrawUsage));
    pGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PARCELS * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.parcels = new THREE.Points(pGeo, this.parcelMat);
    this.parcels.frustumCulled = false;
    this.parcels.renderOrder = 6;
    const tGeo = new THREE.BufferGeometry();
    tGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARCELS * 6), 3).setUsage(THREE.DynamicDrawUsage));
    tGeo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PARCELS * 8), 4).setUsage(THREE.DynamicDrawUsage));
    this.trails = new THREE.LineSegments(tGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
    this.trails.frustumCulled = false;
    this.trails.renderOrder = 6;
    for (let i = 0; i < PARCELS; i++) {
      this.lane[i] = 0.7 + rand() * 0.45;
      this.angle[i] = rand() * Math.PI * 2;
      this.depth[i] = (rand() * 2 - 1) * (Z - 0.6);
    }
    this.scene.add(this.trails, this.parcels);

    // The loop's arrows (one set for each direction), just in front of the cut.
    this.arrowMat = new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0.5 }, uColor: { value: new THREE.Color("#ffffff") } },
      vertexShader: /* glsl */ `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform vec3 uColor;
        varying float vAlpha;
        void main() { gl_FragColor = vec4(uColor, uOpacity * vAlpha); }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const centres = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    for (const c of centres) {
      // Each arrow takes the colour of its air: warm where it rises, cool where it sinks.
      const day = new THREE.Mesh(loopArrow(c - 0.42, c + 0.42, Z + 0.3), this.arrowMat.clone());
      const night = new THREE.Mesh(loopArrow(c + 0.42, c - 0.42, Z + 0.3), this.arrowMat.clone());
      this.warmth(c, 1, day.material.uniforms.uColor.value);
      this.warmth(c, -1, night.material.uniforms.uColor.value);
      day.renderOrder = night.renderOrder = 7;
      this.arrows.day.push(day);
      this.arrows.night.push(night);
      this.scene.add(day, night);
    }

    // Clouds: cumulus over the land by day, a few over the sea at night.
    const puff = puffTexture();
    const cumulus = (group: THREE.Group, x: number, y: number, z: number, size: number) => {
      const c = new THREE.Group();
      c.position.set(x, y, z);
      for (let i = 0; i < 16; i++) {
        const top = rand();
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
        s.position.set((rand() - 0.5) * 1.8 * size, (top - 0.3) * 0.8 * size, (rand() - 0.5) * 1.1 * size);
        s.scale.setScalar((0.8 + rand() * 0.7) * size);
        c.add(s);
      }
      group.add(c);
    };
    cumulus(this.landClouds, 4.2, 5.1, -1.5, 1.1);
    cumulus(this.landClouds, 6, 5.5, 1.5, 1.3);
    cumulus(this.landClouds, 3.2, 5.3, 2.8, 0.9);
    cumulus(this.seaClouds, -7.5, 4.7, -1, 0.9);
    cumulus(this.seaClouds, -9.2, 4.9, 2, 0.8);
    this.scene.add(this.landClouds, this.seaClouds);

    // Smoke from the chimney by the port.
    this.chimneyTop.y = ground(this.chimneyTop.x, this.chimneyTop.z) + 0.32;
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.32, 8), new THREE.MeshStandardMaterial({ color: "#8a6f5c", roughness: 0.9 }));
    chimney.position.copy(this.chimneyTop).setY(this.chimneyTop.y - 0.16);
    chimney.castShadow = true;
    this.scene.add(chimney);
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: "#d9dcde", transparent: true, depthWrite: false, toneMapped: false }));
      this.smoke.push(s);
      this.scene.add(s);
    }

    // The flag on the beach.
    this.flagTop.y = ground(this.flagTop.x, this.flagTop.z) + 0.3;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.3, 6), new THREE.MeshStandardMaterial({ color: "#d9dde0", metalness: 0.5, roughness: 0.4 }));
    pole.position.copy(this.flagTop).setY(this.flagTop.y - 0.15);
    const flagGeo = new THREE.PlaneGeometry(1, 1, 10, 5);
    this.flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ map: this.flagTexture(), side: THREE.DoubleSide, roughness: 0.8 }));
    this.scene.add(pole, this.flag);

    // A sailing boat off the coast.
    this.sail = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.012, 0.16, 8, 1).rotateZ(Math.PI / 2).scale(1, 0.5, 0.45), new THREE.MeshStandardMaterial({ color: "#f2f2ee", roughness: 0.5 }));
    hull.position.y = 0.01;
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.2, 5), new THREE.MeshStandardMaterial({ color: "#c9c9c9" }));
    mast.position.y = 0.11;
    const sailShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0, 0.18), new THREE.Vector2(0.09, 0.01)]);
    const sailMesh = new THREE.Mesh(new THREE.ShapeGeometry(sailShape), new THREE.MeshStandardMaterial({ color: "#fbfbf6", side: THREE.DoubleSide, roughness: 0.7 }));
    sailMesh.position.y = 0.025;
    sailMesh.name = "sail";
    this.sail.add(hull, mast, sailMesh);
    this.sail.position.set(-3.6, 0, 3.3);
    this.scene.add(this.sail);

    this.camera.position.set(0, 7, 22);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0.5, 2.2, 0);
    // Dragging the scene takes the camera back from the narration.
    this.controls.addEventListener("start", () => (this.flight = null));
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 34;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.minAzimuthAngle = -Math.PI / 2.5;
    this.controls.maxAzimuthAngle = Math.PI / 2.5;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  private flagTexture() {
    // Georgia's flag on the beach.
    const c = document.createElement("canvas");
    c.width = 90;
    c.height = 60;
    const g = c.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, 90, 60);
    g.fillStyle = "#e8112d";
    g.fillRect(39, 0, 12, 60);
    g.fillRect(0, 24, 90, 12);
    for (const [x, y] of [[19, 12], [71, 12], [19, 48], [71, 48]]) {
      g.fillRect(x - 6, y - 1.5, 12, 3);
      g.fillRect(x - 1.5, y - 6, 3, 12);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private buildRiver() {
    const pts: THREE.Vector3[] = [];
    for (let x = -0.15; x <= 8.5; x += 0.05) pts.push(new THREE.Vector3(x, 0, riverZ(x)));
    const p: number[] = [];
    const idx: number[] = [];
    pts.forEach((q, i) => {
      const w = 0.05 + 0.05 * smooth(-q.x, -1.5, 0.1);
      for (const s of [-1, 1]) {
        const z = q.z + s * w;
        p.push(q.x, Math.max(ground(q.x, q.z) + 0.006, 0.004), z);
      }
      if (i) idx.push((i - 1) * 2, (i - 1) * 2 + 1, i * 2, i * 2, (i - 1) * 2 + 1, i * 2 + 1);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const river = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: "#5b7f86", roughness: 0.25, metalness: 0.1 }));
    river.receiveShadow = true;
    this.scene.add(river);
  }

  private buildTown() {
    const { map, emissive } = facadeTextures();
    const mat = new THREE.MeshStandardMaterial({ map, emissiveMap: emissive, emissive: new THREE.Color("#ffffff"), emissiveIntensity: 0, roughness: 0.85 });
    const spots: THREE.Matrix4[] = [];
    const tints: THREE.Color[] = [];
    for (let x = 0.55; x < 2.1; x += 0.085)
      for (let z = -1; z < 8; z += 0.085) {
        const jx = x + (rand() - 0.5) * 0.03;
        const jz = z + (rand() - 0.5) * 0.03;
        if (!inTown(jx, jz) || rand() < 0.28) continue;
        // Taller blocks by the sea, low houses inland.
        const h = 0.04 + (rand() ** 2.2) * (jx < 1.1 ? 0.3 : 0.09);
        const w = 0.045 + rand() * 0.03;
        spots.push(new THREE.Matrix4().compose(new THREE.Vector3(jx, ground(jx, jz) + h / 2, jz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rand() - 0.5) * 0.3, 0)), new THREE.Vector3(w, h, w * (0.8 + rand() * 0.6))));
        tints.push(new THREE.Color().setHSL(0.08 + rand() * 0.06, 0.25, 0.75 + rand() * 0.2));
      }
    const town = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, spots.length);
    spots.forEach((m, i) => {
      town.setMatrixAt(i, m);
      town.setColorAt(i, tints[i]);
    });
    town.castShadow = town.receiveShadow = true;
    // A pier at the port, by the river mouth.
    const pier = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.07), new THREE.MeshStandardMaterial({ color: "#8f8b84", roughness: 0.9 }));
    pier.position.set(-0.3, 0.02, riverZ(0) + 0.5);
    this.scene.add(town, pier);
    return mat;
  }

  private buildTrees() {
    const { fir, leafy, palm } = treeGeometries();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    const firs: THREE.Matrix4[] = [];
    const leaves: THREE.Matrix4[] = [];
    const palms: THREE.Matrix4[] = [];
    const m = (x: number, z: number, s: number) => new THREE.Matrix4().compose(new THREE.Vector3(x, ground(x, z) - 0.004, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 6, 0)), new THREE.Vector3(s, s * (0.85 + rand() * 0.3), s));
    // Forest on the foothills: broadleaf low down, firs higher up.
    for (let i = 0; i < 5200 && firs.length + leaves.length < 2600; i++) {
      const x = 4.4 + rand() * 8.4;
      const z = -Z + rand() * (Z + NEAR - 0.2);
      const y = ground(x, z);
      if (y < 0.5 || y > 3.1) continue;
      const slope = Math.abs(ground(x + 0.05, z) - ground(x - 0.05, z)) / 0.1 + Math.abs(ground(x, z + 0.05) - ground(x, z - 0.05)) / 0.1;
      if (slope > 2.2 || rand() < 0.15) continue;
      (y > 1.7 + rand() * 0.5 ? firs : leaves).push(m(x, z, 1.4 + rand() * 1.1));
    }
    // Orchards and tree lines on the lowland; palms on the boulevard.
    for (let i = 0; i < 1800 && leaves.length < 3400; i++) {
      const x = 0.6 + rand() * 4;
      const z = -Z + rand() * (Z + NEAR - 0.2);
      if (inTown(x, z) || Math.abs(z - riverZ(x)) < 0.18) continue;
      if (rand() < 0.5 && Math.abs(Math.sin(x * 9) * Math.sin(z * 7)) > 0.4) continue;
      leaves.push(m(x, z, 0.9 + rand() * 0.6));
    }
    for (let z = -Z + 0.3; z < NEAR - 0.2; z += 0.3) {
      if (Math.abs(z - riverZ(0.4)) < 0.4) continue;
      palms.push(m(0.38 + rand() * 0.05, z, 0.9 + rand() * 0.3));
    }
    const add = (geo: THREE.BufferGeometry, list: THREE.Matrix4[], hue: [number, number], light: [number, number]) => {
      const inst = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((mm, i) => {
        inst.setMatrixAt(i, mm);
        inst.setColorAt(i, new THREE.Color().setHSL(hue[0] + rand() * (hue[1] - hue[0]), 0.45, light[0] + rand() * (light[1] - light[0])));
      });
      inst.castShadow = true;
      this.scene.add(inst);
    };
    // Instance colours multiply the vertex colours: the crowns are painted white so they take the tint.
    add(fir, firs, [0.36, 0.42], [0.16, 0.22]);
    add(leafy, leaves, [0.2, 0.3], [0.2, 0.34]);
    add(palm, palms, [0, 0.02], [0.98, 1]);
  }

  /** Fly the camera to one of the views. */
  view(name: CoastView) {
    this.flight = { from: [this.camera.position.clone(), this.controls.target.clone()], to: COAST_VIEWS[name], start: performance.now() };
  }

  /** Sunbeams on the land, on or off. */
  setRays(on: boolean) {
    this.rays.visible = on;
    this.placeRays();
  }

  private placeRays() {
    const up = new THREE.Vector3(0, 1, 0);
    this.rays.children.forEach((beam, i) => {
      const x = 0.9 + i * 1.0;
      const z = 2.2 + (i % 3) * 1.4;
      const hit = new THREE.Vector3(x, ground(x, z) + 0.02, z);
      const len = 9;
      beam.scale.set(1, len, 1);
      beam.position.copy(hit).addScaledVector(this.sunDir, len / 2);
      beam.quaternion.setFromUnitVectors(up, this.sunDir);
      beam.visible = this.sunDir.y > 0.05;
    });
  }

  /** Hour of the day and the breeze it produces. */
  set(hour: number, b: BreezeState) {
    this.k = b.k;
    const light = daylight(hour);
    this.light = light;
    // The sun rises over the mountains (east) and sets into the sea (west), passing south of the zenith.
    const a = ((hour - 6) / 12) * Math.PI;
    // We look north, so the sun is behind us (south): it lights the faces we see.
    const dir = this.sunDir.set(Math.cos(a), Math.sin(a) * 0.82, 0.4).normalize();
    this.sky.material.uniforms.sunPosition.value.copy(dir);
    this.sunLight.position.copy(dir).multiplyScalar(40);
    if (this.rays.visible) this.placeRays();
    const up = smooth(dir.y, -0.02, 0.3);
    this.sunLight.intensity = 3.2 * up;
    this.sunLight.color.set("#ff9a55").lerp(new THREE.Color("#fff4e2"), smooth(dir.y, 0.02, 0.4));
    this.night = 1 - smooth(dir.y, -0.15, 0.05);
    this.hemi.intensity = 0.15 + 0.75 * up;
    this.hemi.color.set("#22304d").lerp(new THREE.Color("#dcebff"), up);
    this.moonLight.intensity = 0.35 * this.night;
    this.moonLight.position.set(-dir.x * 30, 25, 12);
    (this.stars.material as THREE.PointsMaterial).opacity = this.night;
    this.moon.position.set(-dir.x * 300, Math.max(60, -dir.y * 300), -260);
    this.moon.visible = this.night > 0.05;
    (this.moon.material as THREE.SpriteMaterial).opacity = this.night;
    this.renderer.toneMappingExposure = 0.5 + 0.12 * up + 0.35 * this.night;
    this.houses.emissiveIntensity = 0.7 * this.night;
    this.sky.material.uniforms.uNightSky.value.setScalar(0).lerp(NIGHT_SKY, this.night);

    // Water: what the sea reflects.
    const w = this.water;
    w.uSun.value.copy(dir);
    w.uLight.value = 0.12 + 0.88 * smooth(dir.y, -0.1, 0.25);
    w.uSky.value.set("#0a1430").lerp(new THREE.Color("#3f78b8"), up);
    w.uHorizon.value.set("#1b2540").lerp(new THREE.Color("#e2a172"), smooth(dir.y, -0.1, 0.05) * (1 - smooth(dir.y, 0.15, 0.4))).lerp(new THREE.Color("#b9d3e6"), smooth(dir.y, 0.2, 0.5));
    w.uWind.value = b.k;

    const s = Math.abs(b.k);
    this.parcelMat.uniforms.uOpacity.value = 0.35 + 0.6 * s;
    for (const m of [...this.arrows.day, ...this.arrows.night]) (m.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.7 * smooth(s, 0.06, 0.4);
    (this.sky.material.uniforms.uBackdrop.value as THREE.Color).set("#070b14").lerp(new THREE.Color("#46545e"), up);
    const haze = new THREE.Color("#0c1424").lerp(new THREE.Color("#d9a078"), smooth(dir.y, -0.12, 0.04)).lerp(new THREE.Color("#c3d3e0"), smooth(dir.y, 0.12, 0.4));
    this.scene.fog!.color.copy(haze);
    this.water.uFog.value.copy(haze);
    for (const m of this.arrows.day) m.visible = b.k > 0.06;
    for (const m of this.arrows.night) m.visible = b.k < -0.06;
    const grow = smooth(b.k, 0.15, 0.85);
    this.landClouds.scale.setScalar(Math.max(0.001, grow));
    this.landClouds.position.y = (1 - grow) * 0.8;
    this.landClouds.visible = grow > 0.01;
    const seaGrow = smooth(-b.k, 0.2, 0.9) * 0.8;
    this.seaClouds.scale.setScalar(Math.max(0.001, seaGrow));
    this.seaClouds.visible = seaGrow > 0.01;
    // Cloud colour follows the light (orange at sunset, grey-blue at night).
    const tint = new THREE.Color("#40486a").lerp(new THREE.Color("#ffb27a"), smooth(dir.y, -0.1, 0.05)).lerp(new THREE.Color("#ffffff"), smooth(dir.y, 0.12, 0.4));
    for (const g of [this.landClouds, this.seaClouds])
      g.traverse((o) => {
        if (o instanceof THREE.Sprite) o.material.color.copy(tint).multiplyScalar(0.78 + 0.22 * THREE.MathUtils.clamp(o.position.y + 0.3, 0, 1));
      });
  }

  /**
   * Colour of the air at angle a of the loop, for a breeze in direction `sign` (1 by day): warmer than the air
   * round it where it rises (over the warm side), cooler where it sinks, in between along the ground and aloft.
   */
  private warmth(a: number, sign: number, out: THREE.Color) {
    const w = 0.5 + 0.5 * sign * Math.cos(a);
    if (w > 0.5) return out.copy(MID).lerp(WARM, (w - 0.5) * 2);
    return out.copy(MID).lerp(COLD, (0.5 - w) * 2);
  }

  private updateAir(dt: number) {
    const speed = this.reduceMotion ? 0 : this.k * 0.32;
    const pos = this.parcels.geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = this.parcels.geometry.getAttribute("color") as THREE.BufferAttribute;
    const tPos = this.trails.geometry.getAttribute("position") as THREE.BufferAttribute;
    const tCol = this.trails.geometry.getAttribute("color") as THREE.BufferAttribute;
    const p = this.v;
    const c = this.tint;
    const sign = Math.sign(this.k) || 1;
    const tail = Math.sign(this.k) * (0.05 + 0.12 * Math.abs(this.k));
    for (let i = 0; i < PARCELS; i++) {
      // Parcels on the inner lanes go round faster (the loop is shorter there).
      this.angle[i] += dt * speed * (1.25 - this.lane[i] * 0.4);
      loopPoint(this.angle[i], this.lane[i], p, this.depth[i]);
      pos.setXYZ(i, p.x, p.y, p.z);
      this.warmth(this.angle[i], sign, c);
      col.setXYZ(i, c.r, c.g, c.b);
      tPos.setXYZ(i * 2, p.x, p.y, p.z);
      loopPoint(this.angle[i] - tail, this.lane[i], p, this.depth[i]);
      tPos.setXYZ(i * 2 + 1, p.x, p.y, p.z);
      const a = 0.25 + 0.5 * Math.abs(this.k);
      tCol.setXYZW(i * 2, c.r, c.g, c.b, a);
      tCol.setXYZW(i * 2 + 1, c.r, c.g, c.b, 0);
    }
    pos.needsUpdate = col.needsUpdate = tPos.needsUpdate = tCol.needsUpdate = true;
  }

  private updateProps(t: number) {
    const wind = this.k; // + blows inland at the surface
    const strength = Math.abs(wind);
    const dirX = Math.sign(wind || 1);
    // Flag: streams out downwind, hangs when it is calm.
    const pos = this.flag.geometry.getAttribute("position") as THREE.BufferAttribute;
    const L = 0.11;
    const H = 0.07;
    const reach = 0.2 + 0.8 * smooth(strength, 0.05, 0.6);
    for (let i = 0; i < pos.count; i++) {
      const u = ((i % 11) / 10);
      const v = Math.floor(i / 11) / 5;
      const flap = Math.sin(u * 7 - t * (5 + 8 * strength)) * 0.012 * u * (0.4 + strength);
      pos.setXYZ(i, this.flagTop.x + dirX * u * L * reach, this.flagTop.y - v * H - (1 - reach) * u * L * 0.95, this.flagTop.z + flap);
    }
    pos.needsUpdate = true;
    this.flag.geometry.computeVertexNormals();
    // Smoke: rises and drifts with the wind.
    this.smoke.forEach((s, i) => {
      const age = (t * 0.18 + i / this.smoke.length) % 1;
      s.position.copy(this.chimneyTop).add(this.v.set(dirX * age * (0.15 + 1.6 * strength), age * (0.55 - 0.25 * strength), Math.sin(age * 9 + i) * 0.03));
      s.scale.setScalar(0.06 + age * 0.35);
      (s.material as THREE.SpriteMaterial).opacity = 0.5 * (1 - age) * smooth(age, 0, 0.08);
    });
    // Boat: bobs, leans away from the wind, the sail swings to the lee side.
    this.sail.position.y = 0.006 * Math.sin(t * 1.4);
    this.sail.rotation.z = -dirX * 0.18 * strength + 0.03 * Math.sin(t * 1.1);
    const sail = this.sail.getObjectByName("sail")!;
    sail.rotation.y = dirX > 0 ? -0.5 - strength * 0.4 : Math.PI + 0.5 + strength * 0.4;
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
    this.camera.fov = w < h ? 40 / Math.max(0.5, w / h) : 40;
    this.camera.updateProjectionMatrix();
    this.parcelMat.uniforms.uScale.value = 0.26 * h * this.renderer.getPixelRatio();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const t = this.reduceMotion ? 0 : now / 1000;
    this.water.uTime.value = t;
    this.sky.material.uniforms.time.value = t;
    this.updateAir(dt);
    this.updateProps(t);
    this.rayMat.uniforms.uTime.value = t;
    if (this.flight) {
      const k = Math.min(1, (now - this.flight.start) / 1800);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      this.camera.position.lerpVectors(this.flight.from[0], this.flight.to[0], e);
      this.controls.target.lerpVectors(this.flight.from[1], this.flight.to[1], e);
      if (k >= 1 || this.reduceMotion) {
        this.camera.position.copy(this.flight.to[0]);
        this.controls.target.copy(this.flight.to[1]);
        this.flight = null;
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.project, this.anchors);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    const seen = new Set<THREE.Texture>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const key of ["map", "emissiveMap"] as const) {
          const tex = (mat as THREE.MeshStandardMaterial)[key];
          if (tex && !seen.has(tex)) {
            seen.add(tex);
            tex.dispose();
          }
        }
        mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}
