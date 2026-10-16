import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLSL_NOISE, ParticleCloud, noise2 } from "../fx/particles";

/*
 * Topic 6 — a slice through a subduction zone: the oceanic plate (left) dives under the continental plate
 * (right). Water squeezed out of the sinking plate melts the mantle above it; the magma rises into a
 * chamber and erupts from a volcano. Where the plates stick and slip, an earthquake starts (focus →
 * epicentre, seismic waves) and the uplifted sea floor sends out a tsunami that grows as the sea shallows.
 * 1 scene unit ≈ 20 km across, the height is exaggerated.
 * Realism layer: rock faces get grain and bedding in the shader, the cone is a layered stratovolcano with
 * gullies and an ash-dark summit, magma glows white-yellow → orange → deep red → black crust with cracks,
 * the ash column billows up and spreads into a lit umbrella cloud with lightning, the sky dims, and the sea
 * has swell, pulls back from the shore (bare sea bed) and then steepens into a foaming, spraying crest.
 */

type RockKind = "mantle" | "basalt" | "crust";

/** MeshStandardMaterial plus procedural rock grain / bedding / mantle convection on the cut face. */
function rockMaterial(kind: RockKind) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  // The three variants share one onBeforeCompile source; without a distinct key they would all reuse one program.
  m.customProgramCacheKey = () => `rock-${kind}`;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vRockPos;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvRockPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    const pattern =
      kind === "mantle"
        ? "float g = fbm2(vRockPos.xy * vec2(0.35, 0.6) + vec2(fbm2(vRockPos.xy * 0.4) * 2.0, 0.0)); diffuseColor.rgb *= 0.82 + 0.36 * g;"
        : kind === "basalt"
          ? "float g = fbm2(vRockPos.xy * 3.0); diffuseColor.rgb *= 0.86 + 0.24 * g + 0.05 * sin(vRockPos.y * 14.0 + g * 3.0);"
          : `float g = fbm2(vRockPos.xy * vec2(1.4, 3.2)); float bed = sin(vRockPos.y * 9.0 + fbm2(vRockPos.xy * 0.7) * 5.0); diffuseColor.rgb *= 0.82 + 0.24 * g + 0.11 * bed;
float cone = (1.0 - smoothstep(1.4, 3.3, abs(vRockPos.x - ${VX.toFixed(3)}))) * smoothstep(0.2, 0.9, vRockPos.y);
if (cone > 0.0) {
  float s = vRockPos.y + abs(vRockPos.x - ${VX.toFixed(3)}) * 1.04;
  float lay = sin(s * 15.0 + fbm2(vRockPos.xy * 1.8) * 6.0);
  float gul = fbm2(vec2(vRockPos.x * 9.0, s * 2.0));
  vec3 base = diffuseColor.rgb;
  vec3 layered = base * (0.72 + 0.28 * smoothstep(-0.6, 0.8, lay));
  layered = mix(layered, layered * vec3(1.45, 0.78, 0.6), smoothstep(0.72, 0.95, lay) * 0.55);
  layered *= 0.78 + 0.4 * gul;
  float ash = smoothstep(1.7, 2.9, vRockPos.y + (fbm2(vRockPos.xy * 3.0) - 0.5) * 0.9);
  layered = mix(layered, vec3(0.07, 0.065, 0.06) + 0.05 * gul, ash * 0.7);
  diffuseColor.rgb = mix(base, layered, cone);
}`;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRockPos;\n${GLSL_NOISE}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\nif (abs(abs(vRockPos.z) - ${(DEPTH / 2).toFixed(3)}) < 0.05) { ${pattern} }`);
  };
  return m;
}

/** Temperature → colour: black crust, deep red, orange, yellow, white-yellow core. */
const LAVA_RAMP = /* glsl */ `
vec3 lavaRamp(float t) {
  t = clamp(t, 0.0, 1.2);
  vec3 c = mix(vec3(0.015, 0.012, 0.012), vec3(0.34, 0.02, 0.0), smoothstep(0.0, 0.3, t));
  c = mix(c, vec3(0.95, 0.17, 0.0), smoothstep(0.26, 0.55, t));
  c = mix(c, vec3(1.0, 0.55, 0.05), smoothstep(0.5, 0.78, t));
  c = mix(c, vec3(1.0, 0.93, 0.62), smoothstep(0.78, 1.05, t));
  return c;
}`;

/** Glowing magma: a white-yellow core cooling to orange and deep red, flowing, with dark crust flecks at the rim. */
function glowMaterial(center: THREE.Vector2, radius: THREE.Vector2, strength = 1) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCenter: { value: center }, uRadius: { value: radius }, uStrength: { value: strength } },
    vertexShader: "varying vec2 vP; void main() { vP = (modelMatrix * vec4(position, 1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
uniform float uTime;
uniform vec2 uCenter;
uniform vec2 uRadius;
uniform float uStrength;
varying vec2 vP;
${GLSL_NOISE}
${LAVA_RAMP}
void main() {
  vec2 q = (vP - uCenter) / uRadius;
  float d = length(q);
  float w = fbm2(vP * 1.2 - vec2(0.0, uTime * 0.18));
  float churn = fbm2(vP * 2.4 + vec2(uTime * 0.25, -uTime * 0.55) + w * 2.0);
  float pulse = 0.94 + 0.1 * sin(uTime * 2.1 + churn * 7.0);
  float heat = clamp((1.15 - d) * (0.65 + 0.85 * churn) * uStrength * pulse, 0.0, 1.2);
  float plate = smoothstep(0.52, 0.64, fbm2(vP * 5.5 + vec2(uTime * 0.05, 0.0)));
  heat *= 1.0 - 0.75 * smoothstep(0.5, 0.95, d) * plate;
  heat = max(heat, 0.2);
  vec3 col = lavaRamp(heat);
  col *= 1.0 + 0.3 * smoothstep(0.8, 1.1, heat);
  float a = 1.0 - smoothstep(0.85, 1.25, d);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
  });
}

/** Lava ribbon: a white-hot front, a channel cooling to orange and red, black crust plates with glowing cracks drifting downhill. */
function lavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uProg: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
uniform float uTime;
uniform float uProg;
varying vec2 vUv;
${GLSL_NOISE}
${LAVA_RAMP}
void main() {
  float along = vUv.x;
  float lobe = 0.035 * (vnoise(vec2(vUv.y * 6.0, 3.0)) - 0.5);
  if (along > uProg + lobe) discard;
  float age = clamp((uProg - along) * 2.2, 0.0, 1.0);
  float vent = 1.0 - smoothstep(0.0, 0.12, along);
  float edgeD = abs(vUv.y - 0.5) * 2.0;
  vec2 pc = vec2(along * 24.0 - uTime * 0.5, vUv.y * 3.5);
  float warp = fbm2(pc * 0.6 + 4.0);
  float n = fbm2(pc + warp * 1.6);
  // A hot channel stays open in the middle; the edges and the old parts cool and crust over first.
  float temp = 1.0 - age * (1.0 - vent) * (0.55 + 0.45 * edgeD);
  temp += (n - 0.5) * 0.4 - 0.12 * edgeD + (1.0 - smoothstep(0.0, 0.1, uProg - along)) * 0.25;
  vec2 cp = vec2(along * 34.0 - uTime * 0.18, vUv.y * 6.5);
  float c1 = fbm2(cp + warp * 1.2);
  float crack = 1.0 - smoothstep(0.0, 0.09, abs(c1 - 0.5));
  float c2 = fbm2(cp * 2.1 + 7.0);
  crack = max(crack, (1.0 - smoothstep(0.0, 0.06, abs(c2 - 0.5))) * 0.7);
  float crusted = smoothstep(0.25, 0.7, 1.0 - temp);
  float open = smoothstep(0.55, 0.8, temp);
  float tPlate = clamp(temp * 0.28 + 0.04 * n, 0.0, 0.3);
  float tCrack = clamp(temp + 0.35 + 0.15 * sin(uTime * 1.7 + c1 * 9.0), 0.0, 1.1);
  float tHot = mix(tCrack, temp + 0.1, open);
  float glowMask = clamp(crack * crusted + open, 0.0, 1.0);
  vec3 col = mix(lavaRamp(tPlate) * (0.8 + 0.4 * n), lavaRamp(tHot), glowMask);
  col *= 0.7 + 0.3 * (1.0 - smoothstep(0.75, 1.0, edgeD));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
    side: THREE.DoubleSide,
  });
}

/** Ocean front panel: depth colour, caustic streaks, silt near the sea bed, foam at the surface and on the crest. */
function seaFrontMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCrestX: { value: 0 }, uFoam: { value: 0 } },
    vertexShader: `
attribute vec2 aInfo;
varying vec3 vW;
varying vec2 vInfo;
void main() {
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  vInfo = aInfo;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
uniform float uTime;
uniform float uCrestX;
uniform float uFoam;
varying vec3 vW;
varying vec2 vInfo;
${GLSL_NOISE}
void main() {
  float dep = max(0.0, vInfo.y - vW.y);
  float above = max(0.0, vW.y - vInfo.x);
  vec3 col = mix(vec3(0.05, 0.26, 0.4), vec3(0.01, 0.06, 0.17), 1.0 - exp(-dep * 0.55));
  float cs = fbm2(vec2(vW.x * 1.7 + uTime * 0.12, vW.y * 2.6 - uTime * 0.08));
  col += vec3(0.07, 0.17, 0.2) * pow(1.0 - abs(cs * 2.0 - 1.0), 5.0) * exp(-dep * 0.9);
  col = mix(col, vec3(0.1, 0.085, 0.06), (1.0 - smoothstep(0.0, 0.35, above)) * 0.45);
  float nz = fbm2(vec2(vW.x * 7.0 - uTime * 0.4, vW.y * 7.0));
  float band = exp(-dep * 10.0) * (0.25 + 0.5 * smoothstep(0.35, 0.75, nz));
  float cd = (vW.x - uCrestX) / 0.6;
  float cx = exp(-cd * cd) * uFoam * exp(-dep * 2.0) * smoothstep(0.3, 0.7, nz);
  float foam = clamp(band * 0.55 + cx * 1.2, 0.0, 1.0);
  col = mix(col, vec3(0.88, 0.94, 1.0), foam);
  gl_FragColor = vec4(col, mix(0.86, 0.97, foam));
  #include <colorspace_fragment>
}`,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}

/** Ocean top surface: sky reflection by angle, sun glint, foam streaks on the crest. */
function seaTopMaterial(sky: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCrestX: { value: 0 }, uFoam: { value: 0 }, uSky: { value: sky } },
    vertexShader: `
varying vec3 vN;
varying vec3 vW;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
uniform float uTime;
uniform float uCrestX;
uniform float uFoam;
uniform vec3 uSky;
varying vec3 vN;
varying vec3 vW;
${GLSL_NOISE}
void main() {
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 H = normalize(normalize(vec3(-0.3, 0.8, 0.6)) + V);
  float spec = pow(max(dot(N, H), 0.0), 90.0) * 0.7;
  vec3 col = mix(vec3(0.05, 0.25, 0.4), uSky, fr * 0.6) + spec;
  float nz = fbm2(vec2(vW.x * 6.0 - uTime * 0.5, vW.z * 3.0));
  float cd = (vW.x - uCrestX) / 0.7;
  float cx = exp(-cd * cd) * uFoam * smoothstep(0.25, 0.65, nz);
  col = mix(col, vec3(0.9, 0.95, 1.0), clamp(cx * 1.3, 0.0, 1.0));
  gl_FragColor = vec4(col, 0.9);
  #include <colorspace_fragment>
}`,
    transparent: true,
    side: THREE.DoubleSide,
  });
}

export type VolcanoStep = "plates" | "magma" | "eruption" | "quake" | "tsunami";
export type Projector = (p: THREE.Vector3) => { x: number; y: number; visible: boolean };

const DEPTH = 5;
const FZ = DEPTH / 2 + 0.02;
const TAN = Math.tan((30 * Math.PI) / 180);
export const VX = 7.5;
const X0 = -14;
const X1 = 14;
const BOTTOM = -11;
const CONT_BASE = -3.6;
const QX = -0.5;
const WATER_END = 4.5;
const ASH_N = 900;
const BOMB_N = 70;
const HALO_N = 16;

const smooth = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};
export const slabTop = (x: number) => (x <= -2 ? -1.2 - ((x - X0) / 12) * 0.8 : -2 - (x + 2) * TAN);
const slabBot = (x: number) => slabTop(x) - 1.1;
function land(x: number) {
  if (x < 2) return -2 + 2.1 * smooth((x + 2) / 4);
  let h = 0.1 + 0.35 * Math.min(1, (x - 2) / 3);
  const cone = Math.max(0, 1 - Math.abs(x - VX) / 2.6);
  h += 2.7 * cone;
  // Ridges and gullies cut into the flanks (fade to nothing at the foot of the cone).
  h += cone * (0.14 * (1 - Math.abs(noise2(x * 6, 2.1))) - 0.07 + 0.045 * noise2(x * 13, 5.3));
  const c = Math.abs(x - VX);
  if (c < 0.35) h -= 0.3 * (1 - c / 0.35);
  return h;
}
/** Sea floor or ground surface. */
export const floor = (x: number) => (x < -2 ? slabTop(x) : land(x));
const xAt = (f: (x: number) => number, y: number, a: number, b: number) => {
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if ((f(a) - y) * (f(m) - y) <= 0) b = m;
    else a = m;
  }
  return (a + b) / 2;
};
export const COAST = xAt(land, 0, -2, 2);
const SLAB_END_TOP = xAt(slabTop, BOTTOM, -2, 14);
const SLAB_END_BOT = xAt(slabBot, BOTTOM, -2, 14);
const WEDGE_X = xAt(slabTop, CONT_BASE, -2, 14);
const PEAK = land(VX);
const FOCUS = new THREE.Vector3(QX, slabTop(QX) - 0.1, FZ);

function sample(f: (x: number) => number, a: number, b: number, step = 0.08): [number, number][] {
  const out: [number, number][] = [];
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / step));
  for (let i = 0; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    out.push([x, f(x)]);
  }
  return out;
}

function slab(points: [number, number][], cap: string, side: string, colorAt?: (x: number, y: number) => string | null, kind: RockKind = "crust") {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, steps: 1, curveSegments: 1 });
  geo.translate(0, 0, -DEPTH / 2);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const isCap = Math.abs(Math.abs(pos.getZ(i)) - DEPTH / 2) < 1e-3;
    c.set(isCap ? cap : (colorAt?.(pos.getX(i), pos.getY(i)) ?? side));
    c.toArray(colors, i * 3);
  }
  // Caps and walls share vertices only by position; ExtrudeGeometry is non-indexed, so this colours per face.
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, rockMaterial(kind));
}

/** Flat shape drawn on the front face of the slice. */
function decal(shape: THREE.Shape, color: string, opacity = 1, lift = 0) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 }));
  m.position.z = FZ + lift;
  return m;
}
const ellipse = (x: number, y: number, rx: number, ry: number) => {
  const s = new THREE.Shape();
  s.absellipse(x, y, rx, ry, 0, Math.PI * 2, false, 0);
  return s;
};
function arrow(x: number, y: number, dir: 1 | -1, len = 2.2) {
  const s = new THREE.Shape();
  const h = 0.16;
  const head = 0.55;
  s.moveTo(x, y - h);
  s.lineTo(x + dir * (len - head), y - h);
  s.lineTo(x + dir * (len - head), y - h * 2.6);
  s.lineTo(x + dir * len, y);
  s.lineTo(x + dir * (len - head), y + h * 2.6);
  s.lineTo(x + dir * (len - head), y + h);
  s.lineTo(x, y + h);
  s.closePath();
  return s;
}
function star(x: number, y: number, r: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    if (i) s.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else s.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  s.closePath();
  return s;
}

const ANCHORS = {
  ocean: new THREE.Vector3(-9, -1.75, FZ),
  continent: new THREE.Vector3(11.2, -1.6, FZ),
  trench: new THREE.Vector3(-2, -2.6, FZ),
  mantle: new THREE.Vector3(-5, -7.4, FZ),
  sea: new THREE.Vector3(-10, -0.55, FZ),
  melt: new THREE.Vector3(5.2, slabTop(5.2) + 0.15, FZ),
  chamber: new THREE.Vector3(VX + 2.1, -1.6, FZ),
  crater: new THREE.Vector3(VX, PEAK + 0.55, FZ),
  ash: new THREE.Vector3(VX + 2.4, PEAK + 3.4, FZ),
  lava: new THREE.Vector3(VX + 2.2, 1.6, FZ),
  focus: FOCUS.clone(),
  epicentre: new THREE.Vector3(QX, floor(QX) + 0.35, FZ),
  tsunamiL: new THREE.Vector3(QX, 0.6, FZ),
  tsunamiR: new THREE.Vector3(QX, 0.6, FZ),
  coast: new THREE.Vector3(COAST + 3, 1.3, FZ),
};
export type VolcanoAnchor = keyof typeof ANCHORS;

/** A view looking straight at the cross-section, centred a little below `[x, y]` (subtitles run along the bottom). */
const look = (x: number, y: number, dist: number, up = 0.8) => {
  const target = new THREE.Vector3(x, y - dist * 0.07, 0);
  return [new THREE.Vector3(x, target.y + up, dist), target] as const;
};
/** Where the narration sends the camera. */
export const VOLCANO_VIEWS = {
  overview: [new THREE.Vector3(0, -0.4, 27.5), new THREE.Vector3(0, -3.1, 0)],
  trench: look(-2, -2.6, 14),
  mantle: look(1, -6.5, 17),
  melt: look(5.2, -5.4, 13),
  rise: look(6.4, -3.6, 14),
  chamber: look(7.5, -1.4, 12.5),
  volcano: look(7.5, 1.6, 15),
  eruption: look(7.2, 3.4, 20, 1.2),
  quake: look(-0.5, -2.2, 15),
  ocean: look(-8, -0.6, 15),
  coast: look(COAST + 1.5, 0.2, 13),
} as const;
export type VolcanoView = keyof typeof VOLCANO_VIEWS;

interface Particle {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  life: number;
  /** Per-particle random 0…1, re-rolled when the particle is reborn. */
  r: number;
}
const particle = (life: number, age = 0): Particle => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), age, life, r: Math.random() });

/** Ambient swell: wavenumber, amplitude, angular speed, phase. */
const SWELL: [number, number, number, number][] = [
  [0.9, 0.04, 0.9, 0.3],
  [1.9, 0.028, 1.5, 1.7],
  [3.4, 0.016, 2.1, 4.1],
];

export class VolcanoScene {
  onFrame: ((project: Projector, anchors: typeof ANCHORS, state: { tsunami: number; quake: number }) => void) | null = null;
  readonly anchors = ANCHORS;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private wheelGate: ((e: WheelEvent) => void) | null = null;
  private wheelHost: HTMLElement | null = null;
  private timer = new THREE.Timer();
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private step: VolcanoStep = "plates";
  private t = 0;
  private eventT = 0;
  /** The event of the step waits (the stress before an earthquake builds while the voice tells of it). */
  private held = false;
  private heldT = 0;
  private stress: THREE.Mesh;
  private flight: { from: [THREE.Vector3, THREE.Vector3]; to: readonly [THREE.Vector3, THREE.Vector3]; start: number } | null = null;
  private groups: Record<"plates" | "magma" | "eruption" | "quake", THREE.Group> = { plates: new THREE.Group(), magma: new THREE.Group(), eruption: new THREE.Group(), quake: new THREE.Group() };
  private blobs: THREE.Mesh[] = [];
  private rings: THREE.Mesh[] = [];
  private plateArrows: THREE.Mesh[] = [];
  private lavaMat = lavaMaterial();
  private glows: THREE.ShaderMaterial[] = [];
  private bombs: THREE.InstancedMesh;
  private ash: ParticleCloud;
  private embers: ParticleCloud;
  private trail: ParticleCloud;
  private halo: ParticleCloud;
  private crest: ParticleCloud;
  private emberP: Particle[] = [];
  private crestP: Particle[] = [];
  private craterLight = new THREE.PointLight("#ff7a1a", 0, 9, 1.6);
  private flashLight = new THREE.PointLight("#bcd0ff", 0, 10, 1.6);
  private bolt: THREE.Line;
  private flash = 0;
  private flashCool = 3;
  private flashPos = new THREE.Vector3();
  private chamberHalo: THREE.Mesh;
  private skyDay = new THREE.Color("#a9d4f0");
  private skyDim = new THREE.Color("#4f5663");
  private sky = new THREE.Color("#a9d4f0");
  private dim = 0;
  private hemi = new THREE.HemisphereLight("#eef5ff", "#5a4a3a", 1.2);
  private sun = new THREE.DirectionalLight("#fff4e0", 2);
  private seaFront = seaFrontMaterial();
  private seaTop = seaTopMaterial(this.sky);
  private ashDark = new THREE.Color("#2b2826");
  private ashFresh = new THREE.Color("#5b4a40");
  private ashLit = new THREE.Color("#c4601f");
  private ashTop = new THREE.Color("#8b8782");
  private c = new THREE.Color();
  private tmp = new THREE.Vector3();
  private ventPos = new THREE.Vector3(VX, PEAK, 0);
  private projTmp = new THREE.Vector3();
  private shakeOff = new THREE.Vector3();
  private blobFrom = new THREE.Vector2(5.2, slabTop(5.2) + 0.35);
  private blobTo = new THREE.Vector2(VX, -1.9);
  private bombHot = new THREE.Color("#ffd27a");
  private bombCool = new THREE.Color("#2e2420");
  private mistC = new THREE.Color("#e8f1f7");
  private sprayC = new THREE.Color("#f4f8fb");
  private bombP: Particle[] = [];
  private ashP: Particle[] = [];
  private waterFront: THREE.BufferGeometry;
  private waterTop: THREE.BufferGeometry;
  private waterN = 420;
  private waterX: Float32Array;
  private pulses = { l: QX, r: QX };
  private dummy = new THREE.Object3D();

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.sky;
    this.scene.fog = new THREE.FogExp2(this.sky.clone(), 0.009);
    this.sun.position.set(-4, 12, 8);
    this.scene.add(this.hemi, this.sun);

    // Rock: mantle, oceanic plate, mantle wedge, continental crust.
    const mantleUnder: [number, number][] = [[X0, BOTTOM], ...sample(slabBot, X0, SLAB_END_BOT), [X0, BOTTOM]];
    const wedge: [number, number][] = [[WEDGE_X, CONT_BASE], [X1, CONT_BASE], [X1, BOTTOM], [SLAB_END_TOP, BOTTOM], ...sample(slabTop, SLAB_END_TOP, WEDGE_X)];
    const plate: [number, number][] = [...sample(slabTop, X0, SLAB_END_TOP), [SLAB_END_BOT, BOTTOM], ...sample(slabBot, SLAB_END_BOT, X0)];
    const crust: [number, number][] = [...sample(land, -2, X1, 0.05), [X1, CONT_BASE], [WEDGE_X, CONT_BASE], ...sample(slabTop, WEDGE_X, -2)];
    // Deep mantle below the slice's lower edge, so the view never shows sky under the ground.
    const deep: [number, number][] = [[X0, BOTTOM], [X1, BOTTOM], [X1, BOTTOM - 12], [X0, BOTTOM - 12]];
    this.scene.add(
      slab(deep, "#c4561f", "#b8501f", undefined, "mantle"),
      slab(mantleUnder, "#d0612a", "#b8501f", undefined, "mantle"),
      slab(wedge, "#e07a35", "#c86a2a", undefined, "mantle"),
      slab(plate, "#4a5566", "#3d4757", (x, y) => (x < -2 && y > -1.3 - ((x - X0) / 12) * 0.8 ? "#c8b48a" : null), "basalt"),
      slab(crust, "#8a6a4a", "#5f8a3e", (x, y) => {
        // Ash-dark summit (and a lighter, ash-grey flank), not a snowcap: this cone is erupting.
        if (Math.abs(x - VX) < 2.7 && y > 0.7) return y > 2.2 ? "#4b4540" : "#6b6258";
        return y < -0.2 ? "#a08a66" : null;
      }),
    );
    // Thin layer lines: the continental crust is lighter (granite), oceanic darker (basalt).
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(sample(slabTop, -2, SLAB_END_TOP).map(([x, y]) => new THREE.Vector3(x, y, FZ + 0.01))), new THREE.LineBasicMaterial({ color: "#1f2937" })));

    // Water: a front panel and a top surface whose vertices follow the waves.
    this.waterX = new Float32Array(this.waterN + 1);
    for (let i = 0; i <= this.waterN; i++) this.waterX[i] = X0 + ((WATER_END - X0) * i) / this.waterN;
    this.waterFront = this.strip(FZ - 0.01, true);
    this.waterTop = this.strip(0, false);
    this.scene.add(new THREE.Mesh(this.waterFront, this.seaFront), new THREE.Mesh(this.waterTop, this.seaTop));

    // Plates: arrows of motion, trench. Arrows sit below their HTML labels so they never cover the text.
    const arrowMat = (dir: 1 | -1, x: number, y: number, color: string) => {
      const m = decal(arrow(0, 0, dir), color, 1, 0.01);
      m.position.x = x;
      m.position.y = y;
      this.plateArrows.push(m);
      return m;
    };
    this.groups.plates.add(arrowMat(1, -12, -2.85, "#ffffff"), arrowMat(-1, 13.2, -3.5, "#ffffff"), arrowMat(1, -5, -8.75, "#ffd8b0"));

    // Magma: melting zone, rising blobs, chamber, conduit.
    const meltY = slabTop(5.2) + 0.35;
    const glow = (shape: THREE.Shape, cx: number, cy: number, rx: number, ry: number, strength: number, lift: number) => {
      const mat = glowMaterial(new THREE.Vector2(cx, cy), new THREE.Vector2(rx, ry), strength);
      this.glows.push(mat);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 32), mat);
      m.position.z = FZ + lift;
      return m;
    };
    // Heat halo in the rock around the chamber (additive, faint) under the magma itself.
    const haloMat = new THREE.MeshBasicMaterial({ color: "#ff5a00", transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    this.chamberHalo = new THREE.Mesh(new THREE.ShapeGeometry(ellipse(VX, -1.6, 1.9, 0.95), 32), haloMat);
    this.chamberHalo.position.z = FZ + 0.004;
    // The melting zone is a sponge of partly molten rock, not a lake: weaker glow.
    this.groups.magma.add(this.chamberHalo, glow(ellipse(5.2, meltY, 1.1, 0.45), 5.2, meltY, 1.1, 0.45, 0.65, 0), glow(ellipse(VX, -1.6, 1.15, 0.5), VX, -1.6, 1.15, 0.5, 1.15, 0.01));
    const conduit = new THREE.Shape();
    conduit.moveTo(VX - 0.16, -1.3);
    conduit.lineTo(VX - 0.09, PEAK - 0.05);
    conduit.lineTo(VX + 0.09, PEAK - 0.05);
    conduit.lineTo(VX + 0.16, -1.3);
    conduit.closePath();
    this.groups.magma.add(glow(conduit, VX, (PEAK - 1.3) / 2, 0.28, (PEAK + 1.3) / 2 + 0.4, 1, 0.01));
    const blobGeo = new THREE.CircleGeometry(0.17, 16);
    for (let i = 0; i < 7; i++) {
      const blobMat = glowMaterial(new THREE.Vector2(), new THREE.Vector2(0.17, 0.17), 1.2);
      this.glows.push(blobMat);
      const b = new THREE.Mesh(blobGeo, blobMat);
      b.position.z = FZ + 0.02;
      this.blobs.push(b);
      this.groups.magma.add(b);
    }

    // Eruption: lava streams down both flanks, bombs and ash above the crater.
    // Lava runs down both flanks on the front face and over the top of the cone (a ribbon with uv: x along, y across).
    for (const dir of [1, -1] as const) {
      const n = 90;
      const pos: number[] = [];
      const uv: number[] = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const x = VX + dir * (0.3 + u * 2.7);
        const y = land(x);
        // Thick near the vent, thinner and lumpy downhill.
        const th = (0.4 - u * 0.18) * (0.85 + 0.3 * Math.sin(u * 37 + dir));
        // Drawn over the cut face just under the surface line, so the flow reads as a layer on the cone.
        pos.push(x, y - th, FZ + 0.03, x, y + 0.07, FZ + 0.03);
        uv.push(u, 0, u, 1);
      }
      const idx: number[] = [];
      for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      this.groups.eruption.add(new THREE.Mesh(geo, this.lavaMat));
    }
    // A lava lake glowing in the crater.
    this.groups.eruption.add(glow(ellipse(VX, PEAK - 0.12, 0.33, 0.12), VX, PEAK - 0.12, 0.33, 0.12, 1.4, 0.035));
    const bombMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    this.bombs = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.085, 0), bombMat, BOMB_N);
    this.bombs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(BOMB_N * 3).fill(1), 3);
    this.ash = new ParticleCloud(ASH_N, { soft: 1, order: 3 });
    this.embers = new ParticleCloud(220, { soft: 0.45, additive: true, order: 4 });
    this.trail = new ParticleCloud(BOMB_N * 4, { soft: 0.8, additive: true, order: 4 });
    this.halo = new ParticleCloud(HALO_N, { soft: 1, additive: true, order: 6 });
    this.crest = new ParticleCloud(400, { soft: 0.55, order: 5 });
    for (let i = 0; i < BOMB_N; i++) this.bombP.push(particle(-Math.random() * 1.5));
    for (let i = 0; i < ASH_N; i++) this.ashP.push(particle(-Math.random() * 7));
    for (let i = 0; i < 220; i++) this.emberP.push(particle(-Math.random() * 1.2));
    for (let i = 0; i < 400; i++) this.crestP.push(particle(0, 9));
    this.craterLight.position.set(VX, PEAK + 0.2, FZ + 0.9);
    // A lightning bolt flickers inside the ash cloud.
    const boltGeo = new THREE.BufferGeometry();
    boltGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
    this.bolt = new THREE.Line(boltGeo, new THREE.LineBasicMaterial({ color: "#dfe9ff", transparent: true, opacity: 0 }));
    this.bolt.frustumCulled = false;
    this.bolt.visible = false;
    this.bombs.frustumCulled = false;
    this.groups.eruption.add(this.bombs, this.trail.points, this.ash.points, this.embers.points, this.bolt);
    // Lights stay in the scene (intensity 0 outside the eruption) so toggling the group never changes the light count and recompiles the rock shaders.
    this.scene.add(this.crest.points, this.halo.points, this.craterLight, this.flashLight);

    // Earthquake: focus, epicentre, dashed line between them, expanding seismic waves.
    this.groups.quake.add(decal(star(FOCUS.x, FOCUS.y, 0.42), "#ffe600", 1, 0.02));
    const epi = new THREE.Shape();
    epi.moveTo(QX - 0.22, floor(QX) + 0.3);
    epi.lineTo(QX + 0.22, floor(QX) + 0.3);
    epi.lineTo(QX, floor(QX) + 0.02);
    epi.closePath();
    this.groups.quake.add(decal(epi, "#d61f1f", 1, 0.02));
    const dash = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(QX, FOCUS.y, FZ + 0.02), new THREE.Vector3(QX, floor(QX), FZ + 0.02)]), new THREE.LineDashedMaterial({ color: "#111111", dashSize: 0.15, gapSize: 0.1 }));
    dash.computeLineDistances();
    this.groups.quake.add(dash);
    for (let i = 0; i < 3; i++) {
      const r = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 72), new THREE.MeshBasicMaterial({ color: "#fff3a0", transparent: true, depthWrite: false }));
      r.position.set(FOCUS.x, FOCUS.y, FZ + 0.025);
      this.rings.push(r);
      this.groups.quake.add(r);
    }
    // Stress building where the plates are locked, before they slip.
    this.stress = new THREE.Mesh(new THREE.ShapeGeometry(ellipse(FOCUS.x, FOCUS.y, 1.4, 0.7), 32), new THREE.MeshBasicMaterial({ color: "#ff2a1a", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.stress.position.z = FZ + 0.015;
    this.stress.visible = false;
    this.scene.add(this.groups.plates, this.groups.magma, this.groups.eruption, this.groups.quake, this.stress);

    this.camera.position.set(0, -0.4, 27.5);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, -3.1, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 38;
    this.controls.minAzimuthAngle = -Math.PI / 3;
    this.controls.maxAzimuthAngle = Math.PI / 3;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.addEventListener("start", () => (this.flight = null));
    // Plain wheel scrolls the page; zoom only with Ctrl/Cmd + wheel (trackpad pinch sends ctrlKey).
    this.wheelGate = (e: WheelEvent) => {
      this.controls.enableZoom = e.ctrlKey || e.metaKey;
    };
    canvas.parentElement?.addEventListener("wheel", this.wheelGate, { capture: true, passive: true });
    this.wheelHost = canvas.parentElement;

    this.setStep("plates");
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  /** Two rows of vertices along the water: front panel (bottom → top) or top surface (front → back). */
  private strip(z: number, front: boolean) {
    const n = this.waterN;
    const pos = new Float32Array((n + 1) * 2 * 3);
    const info = new Float32Array((n + 1) * 2 * 2);
    for (let i = 0; i <= n; i++) {
      const x = this.waterX[i];
      if (front) {
        pos.set([x, floor(x), z, x, 0, z], i * 6);
        info.set([floor(x), 0, floor(x), 0], i * 4);
      } else pos.set([x, 0, DEPTH / 2, x, 0, -DEPTH / 2], i * 6);
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    if (front) g.setAttribute("aInfo", new THREE.BufferAttribute(info, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  setStep(step: VolcanoStep) {
    this.step = step;
    const order: VolcanoStep[] = ["plates", "magma", "eruption", "quake", "tsunami"];
    const k = order.indexOf(step);
    this.groups.plates.visible = k === 0 || k >= 3;
    this.groups.magma.visible = k >= 1;
    this.groups.eruption.visible = step === "eruption";
    this.groups.quake.visible = k >= 3;
    this.restart();
  }

  /** Fly the camera to a view (`instant`: be there at once). */
  view(name: VolcanoView, instant = false) {
    const to = VOLCANO_VIEWS[name];
    if (instant || this.reduceMotion) {
      this.flight = null;
      this.camera.position.copy(to[0]);
      this.controls.target.copy(to[1]);
      return;
    }
    this.flight = { from: [this.camera.position.clone(), this.controls.target.clone()], to, start: performance.now() };
  }

  /** Keep the event from starting (the locked plates build up stress) until `restart`. */
  hold() {
    this.held = true;
    this.heldT = 0;
    this.eventT = -1;
  }

  /** Run the event of the current step again (eruption, earthquake, tsunami). */
  restart() {
    this.held = false;
    this.eventT = 0;
    this.pulses = { l: QX, r: QX };
    this.flash = 0;
    this.flashCool = 3;
    for (const p of [...this.bombP, ...this.emberP]) {
      p.life = -Math.random() * 1.5;
      p.age = 0;
    }
    for (const p of this.ashP) {
      p.life = -Math.random() * 7;
      p.age = 0;
    }
    for (const p of this.crestP) p.age = 9;
  }

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
    this.camera.fov = w < h ? 40 / Math.max(0.5, w / h) : 40;
    this.camera.updateProjectionMatrix();
    for (const c of [this.ash, this.embers, this.trail, this.halo, this.crest]) c.setViewport(h * this.renderer.getPixelRatio(), this.camera.fov);
  }

  /** Wave speed in scene units per second (∝ √depth, as for a real tsunami). */
  private speed(x: number) {
    return 0.95 * Math.sqrt(Math.max(0.06, -floor(x)));
  }

  private updateWater(dt: number) {
    const on = this.step === "tsunami" && this.eventT > 0.6;
    const age = this.eventT - 0.6;
    if (on) {
      if (this.pulses.l > X0 - 2) this.pulses.l -= this.speed(this.pulses.l) * dt;
      if (this.pulses.r < COAST + 2.2) this.pulses.r += (this.pulses.r < COAST ? this.speed(this.pulses.r) : 0.45) * dt;
    }
    const d0 = -floor(QX);
    const front = this.waterFront.getAttribute("position") as THREE.BufferAttribute;
    const info = this.waterFront.getAttribute("aInfo") as THREE.BufferAttribute;
    const top = this.waterTop.getAttribute("position") as THREE.BufferAttribute;
    // One pulse's contribution at x (called per vertex, so no per-call allocations).
    const pulse = (x: number, c: number, side: number) => {
      const d = Math.max(0.05, -floor(Math.min(c, COAST - 0.05)));
      const grow = Math.min(2.8, (d0 / d) ** 0.25);
      const width = Math.max(0.28, 0.85 * Math.sqrt(d / d0));
      const inland = side > 0 && c > COAST ? Math.max(0, 1 - (c - COAST) / 2.2) : 1;
      const fade = side < 0 ? Math.max(0, 1 - (QX - c) / 18) : 1;
      const amp = 0.21 * grow * inland * fade * Math.min(1, age * 2);
      // In shallow water the front steepens and the back stretches: the wave leans forward.
      const steep = Math.min(1, Math.max(0, (grow - 1.15) / 1.3));
      const xi = (x - c) * side;
      const w = xi > 0 ? width * (1 - 0.65 * steep) : width * (1 + 0.6 * steep);
      let h = amp * Math.exp(-((xi / w) ** 2));
      // Toward the coast a trough runs ahead of the crest: the sea first draws back from the shore.
      if (side > 0) h -= amp * 0.95 * Math.exp(-(((xi - width * 1.7) / (width * 0.9)) ** 2));
      return h;
    };
    const wave = (x: number) => (on ? pulse(x, this.pulses.l, -1) + pulse(x, this.pulses.r, 1) : 0);
    // Steepness of the shoreward crest (0 in deep water … 1 breaking) and the sea's drawback before it arrives.
    const pr = this.pulses.r;
    let steepR = 0;
    if (on && pr < COAST + 0.3) {
      const d = Math.max(0.05, -floor(Math.min(pr, COAST - 0.05)));
      steepR = Math.min(1, Math.max(0, ((d0 / d) ** 0.25 - 1.15) / 1.3));
    }
    const prog = on ? (pr - QX) / (COAST - QX) : 0;
    const drawAmp = on ? 0.95 * smooth(prog / 0.3) * (1 - smooth((prog - 0.78) / 0.22)) * Math.min(1, age * 1.2) : 0;
    const t = this.t;
    const crestH = on ? wave(pr) : 0;
    const lean = 0.45 * steepR;
    if (steepR > 0 || on) this.updateCrest(dt, pr + lean * Math.max(0, crestH), crestH + 0.02, steepR);
    else this.updateCrest(dt, 0, 0, 0);
    const calm = this.reduceMotion ? 0 : 1;
    for (let i = 0; i <= this.waterN; i++) {
      const x = this.waterX[i];
      const ground = floor(x);
      // Ambient swell: Gerstner-like — heights plus a horizontal shift that bunches the water toward the crests.
      let swell = 0;
      let shift = 0;
      if (x < COAST) {
        const df = Math.min(1, Math.max(0, -ground / 0.8)) * calm;
        for (const [k, a, w, ph] of SWELL) {
          const th = k * x - w * t + ph;
          swell += a * Math.sin(th) * df;
          shift += 1.1 * a * Math.cos(th) * df;
        }
      }
      // Run-up: a wave reaching the shore climbs onto the land.
      const run = this.step === "tsunami" && x > COAST && pr > COAST && x < pr + 0.4 ? Math.max(0, 0.45 * (1 - (x - COAST) / 2.6)) * Math.min(1, (pr - COAST) * 1.5) : 0;
      const w = wave(x);
      // Drawback: the whole nearshore sea level sinks and the sea bed comes into view.
      const drawdown = drawAmp * smooth((x - (QX + 1)) / (COAST - 0.3 - (QX + 1)));
      let level = (x < COAST ? swell : -1) + w - drawdown;
      if (run > 0) level = Math.max(level, ground + run * Math.max(0, 1 - Math.max(0, x - pr) / 0.4));
      const y = Math.max(ground, level);
      // The steep face of the crest leans forward (vertex shift), so it reads as an almost vertical wall.
      const xs = x + shift + lean * Math.max(0, w);
      front.setXY(i * 2, x, ground);
      front.setXY(i * 2 + 1, xs, y);
      info.setXY(i * 2, ground, y);
      info.setXY(i * 2 + 1, ground, y);
      top.setX(i * 2, xs);
      top.setX(i * 2 + 1, xs);
      top.setY(i * 2, y);
      top.setY(i * 2 + 1, y);
    }
    front.needsUpdate = true;
    info.needsUpdate = true;
    top.needsUpdate = true;
    this.waterTop.computeVertexNormals();
    const foam = on ? Math.min(1, steepR * 1.2 + 0.15 * Math.min(1, age)) : 0;
    for (const m of [this.seaFront, this.seaTop]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uCrestX.value = pr + lean * Math.max(0, crestH);
      m.uniforms.uFoam.value = foam;
    }
    this.anchors.tsunamiL.set(Math.max(X0 + 1.5, this.pulses.l), wave(this.pulses.l) + 0.7, FZ);
    this.anchors.tsunamiR.set(Math.min(COAST + 1.2, this.pulses.r), Math.max(0, wave(this.pulses.r)) + 0.9 + Math.max(0, floor(this.pulses.r)), FZ);
  }

  /** Sky dims under the ash; the cloud's lightning briefly lights everything. */
  private updateAtmosphere(dt: number) {
    const target = this.step === "eruption" ? smooth(this.eventT / 6) : 0;
    this.dim = dt > 0 ? this.dim + (target - this.dim) * Math.min(1, dt * 2.5) : target;
    this.flash *= Math.exp(-dt * 6);
    this.sky.copy(this.skyDay).lerp(this.skyDim, this.dim * 0.85);
    (this.scene.fog as THREE.FogExp2).color.copy(this.sky);
    this.hemi.intensity = 1.2 - 0.45 * this.dim + this.flash * 0.6;
    this.sun.intensity = 2 - 1.05 * this.dim;
  }

  /** Big additive glow sprites: the chamber, the crater and the lava front light up their surroundings. */
  private updateHalo() {
    const k = ["plates", "magma", "eruption", "quake", "tsunami"].indexOf(this.step);
    for (let i = 0; i < HALO_N; i++) this.halo.hide(i);
    const t = this.t;
    if (k >= 1) {
      const pulse = 0.85 + 0.15 * Math.sin(t * 1.7);
      this.halo.set(0, this.tmp.set(VX, -1.6, FZ + 0.05), 3.2, 0.26 * pulse, this.c.setRGB(1, 0.32, 0.04));
      this.halo.set(1, this.tmp.set(VX, -1.6, FZ + 0.06), 1.5, 0.3 * pulse, this.c.setRGB(1, 0.5, 0.1));
      this.halo.set(2, this.tmp.set(5.2, slabTop(5.2) + 0.35, FZ + 0.05), 2.1, 0.16 * pulse, this.c.setRGB(1, 0.3, 0.04));
    }
    if (this.step === "eruption") {
      const ramp = smooth(this.eventT / 4);
      const flick = 0.8 + 0.2 * Math.sin(t * 13) * Math.sin(t * 5.3) + 0.08 * Math.sin(t * 31);
      this.halo.set(3, this.tmp.set(VX, PEAK + 0.2, FZ + 0.1), 3.6, 0.3 * ramp * flick, this.c.setRGB(1, 0.33, 0.05));
      this.halo.set(4, this.tmp.set(VX, PEAK + 0.1, FZ + 0.12), 1.3, 0.5 * ramp * flick, this.c.setRGB(1, 0.7, 0.25));
      const prog = this.lavaMat.uniforms.uProg.value as number;
      [1, -1].forEach((dir, di) => {
        for (let j = 0; j < 4; j++) {
          const u = (j + 0.6) / 4;
          if (u > prog) continue;
          const x = VX + dir * (0.3 + u * 2.7);
          this.halo.set(5 + di * 4 + j, this.tmp.set(x, land(x), FZ + 0.1), 0.9 + 0.2 * (1 - u), 0.3 * (1 - u * 0.55) * flick, this.c.setRGB(1, 0.28 + 0.15 * (1 - u), 0.03));
        }
      });
    }
    this.halo.commit();
  }

  private updateEruption(dt: number) {
    const g = -6;
    const ramp = smooth(this.eventT / 4);
    // Own vector: this.tmp is overwritten by the trail code below, which would corrupt respawn positions.
    const vent = this.ventPos;
    const hotC = this.bombHot;
    const coolC = this.bombCool;
    this.bombP.forEach((b, i) => {
      b.life += dt;
      if (b.life < 0) {
        this.dummy.scale.setScalar(0.0001);
        for (let k = 0; k < 4; k++) this.trail.hide(i * 4 + k);
      } else {
        if (b.age === 0 || b.p.y < floor(b.p.x) - 0.05) {
          b.p.copy(vent);
          b.v.set((Math.random() - 0.5) * 3.2, 3.5 + Math.random() * 2.5, (Math.random() - 0.5) * 1.6);
          b.age = 0.0001;
        }
        b.v.y += g * dt;
        b.p.addScaledVector(b.v, dt);
        b.age += dt;
        this.dummy.position.copy(b.p);
        this.dummy.rotation.set(b.age * 5, b.age * 3, 0);
        this.dummy.scale.setScalar(0.7 + (i % 5) * 0.18);
        // Bombs cool in the air: yellow-hot → red → dark crust.
        const heat = Math.max(0, 1 - b.age / 1.6);
        this.bombs.setColorAt(i, this.c.copy(hotC).lerp(coolC, 1 - heat));
        // Faint glowing trail: where the bomb was a moment ago (ballistic arc, no history needed).
        for (let k = 0; k < 4; k++) {
          const s = 0.05 * (k + 1);
          this.tmp.set(b.p.x - b.v.x * s, b.p.y - b.v.y * s + 0.5 * g * s * s, b.p.z - b.v.z * s);
          this.trail.set(i * 4 + k, this.tmp, 0.14 * (1 - k * 0.18), 0.32 * (1 - k / 4) * heat, this.c.setRGB(1, 0.45 * heat + 0.1, 0.05));
        }
      }
      this.dummy.updateMatrix();
      this.bombs.setMatrixAt(i, this.dummy.matrix);
    });
    // Fire fountain: glowing spatter just above the vent.
    this.emberP.forEach((e, i) => {
      e.life += dt;
      if (e.life < 0) return this.embers.hide(i);
      if (e.age === 0 || e.age > 0.9) {
        e.p.set(VX + (Math.random() - 0.5) * 0.2, PEAK - 0.05, (Math.random() - 0.5) * 0.4);
        e.v.set((Math.random() - 0.5) * 1.8, 2.4 + Math.random() * 3, (Math.random() - 0.5) * 0.8);
        e.age = 0.0001;
      }
      e.v.y += g * dt;
      e.p.addScaledVector(e.v, dt);
      e.age += dt;
      const k = e.age / 0.9;
      this.embers.set(i, e.p, 0.2 * (1 - k * 0.5), 0.9 * (1 - k), this.c.setRGB(1, 0.75 - 0.55 * k, 0.3 * (1 - k) * (1 - k)));
    });

    // Lightning inside the umbrella: occasionally a flash with a short jagged bolt.
    this.flashCool -= dt;
    if (ramp > 0.9 && this.eventT > 6 && this.flashCool <= 0) {
      this.flash = 1;
      this.flashCool = 2 + Math.random() * 3.5;
      this.flashPos.set(VX + (Math.random() - 0.2) * 3.2, PEAK + 2.2 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2);
      const bp = this.bolt.geometry.getAttribute("position") as THREE.BufferAttribute;
      let bx = this.flashPos.x;
      let by = this.flashPos.y;
      for (let k = 0; k < 9; k++) {
        bp.setXYZ(k, bx, by, this.flashPos.z + 0.5);
        bx += (Math.random() - 0.5) * 0.4;
        by -= 0.2 + Math.random() * 0.12;
      }
      bp.needsUpdate = true;
    }
    const f = this.flash * (0.65 + 0.35 * Math.sin(this.t * 70));
    this.bolt.visible = f > 0.05;
    (this.bolt.material as THREE.LineBasicMaterial).opacity = Math.min(1, f);
    this.flashLight.position.set(this.flashPos.x, this.flashPos.y, this.flashPos.z + 1.6);
    this.flashLight.intensity = Math.max(0, f) * 30;

    // Ash column: a fast jet, then buoyant rise with billowing; it spreads into an umbrella at its neutral-buoyancy
    // height, expanding and darkening as it ages, wind pushing it right. Lit orange from below by the lava.
    const flick = 0.85 + 0.15 * Math.sin(this.t * 11) * Math.sin(this.t * 4.1);
    this.ashP.forEach((a, i) => {
      a.life += dt;
      if (a.life < 0) return this.ash.hide(i);
      if (a.age === 0 || a.age > 7.5) {
        a.r = Math.random();
        a.p.set(VX + (Math.random() - 0.5) * 0.25, PEAK + 0.1, (Math.random() - 0.5) * 0.5);
        a.v.set((Math.random() - 0.5) * 0.5, 4 + Math.random() * 2.5, (Math.random() - 0.5) * 0.5);
        a.age = 0.0001;
      }
      const h = a.p.y - PEAK;
      const topY = PEAK + 2.5 + a.r * 0.8;
      if (a.p.y < topY) {
        // Jet slows down quickly, buoyancy keeps it rising; billows swirl and the column widens as it pulls in air.
        a.v.y += (1.5 + 0.6 * a.r - a.v.y) * Math.min(1, 1.4 * dt);
        a.v.x += (Math.sin(this.t * 1.3 + i * 0.7) * 0.35 + (a.p.x - VX) * 0.3 + 0.08) * dt;
        a.v.z += (Math.cos(this.t * 1.1 + i * 0.5) * 0.25 + a.p.z * 0.3) * dt;
      } else {
        // Umbrella: stops rising and spreads outward from the axis; the wind pushes it right.
        a.v.y *= 1 - 2.5 * dt;
        a.v.y += (Math.random() - 0.5) * 0.6 * dt - 0.04 * dt;
        const dx = a.p.x - (VX + 0.35);
        a.v.x += ((dx === 0 ? a.r - 0.5 : Math.sign(dx)) * (0.9 + 0.5 * a.r) + 0.3) * dt;
        a.v.z += (Math.sign(a.p.z || a.r - 0.5) * 0.35 + (Math.random() - 0.5) * 0.4) * dt;
        a.v.x *= 1 - 0.3 * dt;
        a.v.z *= 1 - 0.5 * dt;
      }
      a.p.addScaledVector(a.v, dt);
      a.age += dt;
      const k = a.age / 7.5;
      // Fresh ash is brown-hot, then dark charcoal; the top of the umbrella catches a little light.
      this.c.copy(this.ashFresh).lerp(this.ashDark, Math.min(1, a.age * 0.35));
      this.c.lerp(this.ashTop, 0.45 * smooth((a.p.y - (topY - 0.5)) / 1.2) * (0.6 + 0.4 * a.r));
      // Warm underlighting from the lava and crater: strongest low and near the axis.
      const under = Math.exp(-h * 0.65) * flick * ramp * (0.55 + 0.45 * Math.exp(-Math.abs(a.p.x - VX) * 0.35)) + 0.12 * ramp * (a.p.y < topY - 0.3 ? 1 : 0.4) * flick;
      this.c.lerp(this.ashLit, Math.min(0.85, under));
      this.c.multiplyScalar(0.85 + 0.3 * a.r);
      if (f > 0.02) {
        const dx = a.p.x - this.flashPos.x;
        const dy = a.p.y - this.flashPos.y;
        const lit = f * Math.exp(-(dx * dx + dy * dy) / 3.5);
        this.c.r += 0.55 * lit;
        this.c.g += 0.6 * lit;
        this.c.b += 0.85 * lit;
      }
      this.ash.set(i, a.p, 0.45 + Math.min(3.3, Math.max(0, h * 0.55) + a.age * 0.25) * (0.75 + 0.5 * a.r), 0.62 * Math.min(1, a.age * 3) * (1 - Math.pow(k, 2.2)) * (0.75 + 0.25 * a.r), this.c);
    });
    this.ash.commit();
    this.embers.commit();
    this.trail.commit();
    this.bombs.instanceMatrix.needsUpdate = true;
    if (this.bombs.instanceColor) this.bombs.instanceColor.needsUpdate = true;
    this.lavaMat.uniforms.uProg.value = Math.min(1, this.eventT / 7);
    // The crater glows from below; the light flickers like a real lava lake.
    this.craterLight.intensity = ramp * (11 + 4 * Math.sin(this.t * 13) * Math.sin(this.t * 5.3) + 2 * Math.sin(this.t * 29));
  }

  /** White water and mist thrown off the steepening crest of the tsunami. */
  private updateCrest(dt: number, x: number, y: number, steep: number) {
    let spawn = this.step === "tsunami" && steep > 0.15 ? Math.ceil(steep * 10) : 0;
    this.crestP.forEach((p, i) => {
      p.age += dt;
      if (p.age > p.life && spawn > 0) {
        spawn--;
        p.r = Math.random();
        p.p.set(x + (Math.random() - 0.3) * 0.3, y, (Math.random() - 0.5) * DEPTH * 0.95);
        if (p.r < 0.3) {
          // Mist: slow, big, translucent.
          p.v.set(0.5 + Math.random() * 0.8, 0.3 + Math.random() * 0.5, 0);
          p.life = 0.9 + Math.random() * 0.7;
        } else {
          p.v.set(0.7 + Math.random() * 1.4, 0.8 + Math.random() * 1.8 * steep, 0);
          p.life = 0.5 + Math.random() * 0.6;
        }
        p.age = 0;
      }
      if (p.age > p.life) return this.crest.hide(i);
      const k = p.age / p.life;
      if (p.r < 0.3) {
        p.v.y -= 0.8 * dt;
        p.p.addScaledVector(p.v, dt);
        this.crest.set(i, p.p, 0.35 + 0.8 * k, 0.3 * (1 - k), this.mistC);
      } else {
        p.v.y -= 6 * dt;
        p.p.addScaledVector(p.v, dt);
        this.crest.set(i, p.p, 0.14 + 0.2 * k, 0.95 * (1 - k), this.sprayC);
      }
    });
    this.crest.commit();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = this.reduceMotion ? 0 : Math.min(0.05, this.timer.getDelta());
    this.t += dt;
    if (this.held) {
      this.heldT += dt;
      this.eventT = -1;
    } else this.eventT += this.reduceMotion ? 10 : dt;
    this.stress.visible = this.held && (this.step === "quake" || this.step === "tsunami");
    if (this.stress.visible) (this.stress.material as THREE.MeshBasicMaterial).opacity = Math.min(0.75, 0.15 + this.heldT * 0.12) * (0.75 + 0.25 * Math.sin(this.t * 6));
    if (this.flight) {
      const k = Math.min(1, (performance.now() - this.flight.start) / 1700);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      this.camera.position.lerpVectors(this.flight.from[0], this.flight.to[0], e);
      this.controls.target.lerpVectors(this.flight.from[1], this.flight.to[1], e);
      if (k >= 1) this.flight = null;
    }

    // Plate arrows creep in their direction and start again.
    const s = (this.t * 0.35) % 1;
    this.plateArrows.forEach((a, i) => (a.position.x = [-12, 13.2, -5][i] + (i === 1 ? -1 : 1) * s * 0.9));
    // Magma blobs rise from the melting zone to the chamber.
    const from = this.blobFrom;
    const to = this.blobTo;
    this.blobs.forEach((b, i) => {
      const u = (this.t * 0.12 + i / this.blobs.length) % 1;
      b.position.x = from.x + (to.x - from.x) * u + Math.sin(u * 9 + i) * 0.25;
      b.position.y = from.y + (to.y - from.y) * u;
      b.scale.setScalar(0.7 + 0.5 * Math.sin(u * Math.PI));
      const gm = b.material as THREE.ShaderMaterial;
      gm.uniforms.uCenter.value.set(b.position.x, b.position.y);
      gm.uniforms.uRadius.value.setScalar(0.17 * b.scale.x);
    });
    for (const m of this.glows) m.uniforms.uTime.value = this.t;
    this.lavaMat.uniforms.uTime.value = this.t;
    (this.chamberHalo.material as THREE.MeshBasicMaterial).opacity = 0.18 + 0.06 * Math.sin(this.t * 1.7);
    this.updateAtmosphere(dt);
    if (this.step === "eruption") this.updateEruption(dt);
    else {
      this.craterLight.intensity = 0;
      this.flashLight.intensity = 0;
    }
    this.updateHalo();

    // Seismic waves and a short shake.
    const quakeOn = this.step === "quake" || this.step === "tsunami";
    const qt = this.eventT;
    this.rings.forEach((r, i) => {
      const age = qt - i * 0.45;
      const on = quakeOn && age > 0 && age < 3.2;
      r.visible = on;
      if (on) {
        r.scale.setScalar(0.3 + age * 2.6);
        (r.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - age / 3.2);
      }
    });
    this.updateWater(dt);

    this.controls.update();
    const shake = quakeOn && qt >= 0 && qt < 1.6 && !this.reduceMotion ? 0.12 * (1 - qt / 1.6) : 0;
    const off = this.shakeOff.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0);
    this.camera.position.add(off);
    this.renderer.render(this.scene, this.camera);
    this.camera.position.sub(off);
    this.onFrame?.(this.project, this.anchors, { tsunami: this.step === "tsunami" ? this.eventT : 0, quake: quakeOn ? qt : 0 });
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    if (this.wheelGate) this.wheelHost?.removeEventListener("wheel", this.wheelGate, { capture: true });
    this.controls.dispose();
    this.timer.dispose();
    this.bombs.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) mat.dispose();
    });
    this.renderer.dispose();
  }
}
