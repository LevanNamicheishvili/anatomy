import * as THREE from "three";

/*
 * Soft round particles (spray, mist, ash, foam, glow) with their own size, opacity and colour per particle —
 * one draw call for hundreds of them. Sizes are in scene units, so particles get smaller with distance.
 * Call setViewport() from the scene's resize() so the sizes stay right.
 */

export interface CloudOptions {
  /** Edge softness: 0 — a hard dot, 1 — a fuzzy puff (mist, ash). */
  soft?: number;
  additive?: boolean;
  /** Draw order among transparent objects (higher draws later). */
  order?: number;
}

const VERT = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.001, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform float uSoft;
varying float vAlpha;
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0 || vAlpha <= 0.0) discard;
  float edge = mix(1.0 - smoothstep(0.75, 1.0, d), pow(1.0 - d * d, 1.6), uSoft);
  gl_FragColor = vec4(vColor, vAlpha * edge);
  #include <colorspace_fragment>
}`;

export class ParticleCloud {
  readonly points: THREE.Points;
  readonly count: number;
  private pos: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private color: Float32Array;
  private geo = new THREE.BufferGeometry();
  private mat: THREE.ShaderMaterial;

  constructor(count: number, opts: CloudOptions = {}) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.size = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.color = new Float32Array(count * 3).fill(1);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(this.color, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uScale: { value: 400 }, uSoft: { value: opts.soft ?? 0.8 } },
      transparent: true,
      depthWrite: false,
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = opts.order ?? 2;
  }

  /** Canvas height in device pixels and the camera's vertical field of view (degrees). */
  setViewport(heightPx: number, fovDeg: number) {
    this.mat.uniforms.uScale.value = heightPx / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  set(i: number, p: THREE.Vector3, size: number, alpha: number, color?: THREE.Color) {
    this.pos[i * 3] = p.x;
    this.pos[i * 3 + 1] = p.y;
    this.pos[i * 3 + 2] = p.z;
    this.size[i] = size;
    this.alpha[i] = alpha;
    if (color) color.toArray(this.color, i * 3);
  }

  hide(i: number) {
    this.alpha[i] = 0;
  }

  /** Upload the changes made with set() / hide() this frame. */
  commit() {
    for (const name of ["position", "aSize", "aAlpha", "aColor"]) this.geo.getAttribute(name).needsUpdate = true;
  }
}

/** Small deterministic value noise (no textures needed): 2D, roughly −1…1. */
export function noise2(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (a: number, b: number) => {
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi) + (h(xi + 1, yi) - h(xi, yi)) * u;
  const b = h(xi, yi + 1) + (h(xi + 1, yi + 1) - h(xi, yi + 1)) * u;
  return a + (b - a) * v;
}

/** A few octaves of noise2 — rough rock and terrain. */
export function fbm(x: number, y: number, octaves = 4) {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    s += amp * noise2(x * f, y * f);
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}

/** Deterministic 0…1 hash for particle i (stable between renders — safe in React render code). */
export const hash01 = (i: number, salt = 0) => {
  const s = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** GLSL value noise + fbm, shared by the water, lava and magma shaders. */
export const GLSL_NOISE = /* glsl */ `
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm2(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}`;
