import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLSL_NOISE, ParticleCloud } from "../fx/particles";

/*
 * Topic 6 — a slice through a subduction zone: the oceanic plate (left) dives under the continental plate
 * (right). Water squeezed out of the sinking plate melts the mantle above it; the magma rises into a
 * chamber and erupts from a volcano. Where the plates stick and slip, an earthquake starts (focus →
 * epicentre, seismic waves) and the uplifted sea floor sends out a tsunami that grows as the sea shallows.
 * 1 scene unit ≈ 20 km across, the height is exaggerated.
 * Realism layer: rock faces get grain and bedding in the shader, magma glows and churns, the ash column
 * rises and spreads into an umbrella cloud, lava crusts over as it cools, and the tsunami pulls the sea
 * back before its steepening crest arrives.
 */

type RockKind = "mantle" | "basalt" | "crust";

/** MeshStandardMaterial plus procedural rock grain / bedding / mantle convection on the cut face. */
function rockMaterial(kind: RockKind) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vRockPos;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvRockPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    const pattern =
      kind === "mantle"
        ? "float g = fbm2(vRockPos.xy * vec2(0.35, 0.6) + vec2(fbm2(vRockPos.xy * 0.4) * 2.0, 0.0)); diffuseColor.rgb *= 0.82 + 0.36 * g;"
        : kind === "basalt"
          ? "float g = fbm2(vRockPos.xy * 3.0); diffuseColor.rgb *= 0.86 + 0.24 * g + 0.05 * sin(vRockPos.y * 14.0 + g * 3.0);"
          : "float g = fbm2(vRockPos.xy * vec2(1.4, 3.2)); float bed = sin(vRockPos.y * 9.0 + fbm2(vRockPos.xy * 0.7) * 5.0); diffuseColor.rgb *= 0.82 + 0.24 * g + 0.11 * bed;";
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vRockPos;\n${GLSL_NOISE}`)
      .replace("#include <color_fragment>", `#include <color_fragment>\nif (abs(abs(vRockPos.z) - ${(DEPTH / 2).toFixed(3)}) < 0.05) { ${pattern} }`);
  };
  return m;
}

/** Glowing magma: a hot core fading to a dull red rim, churning slowly. Works on any flat shape. */
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
void main() {
  vec2 q = (vP - uCenter) / uRadius;
  float d = length(q);
  float churn = fbm2(vP * 2.2 + vec2(uTime * 0.25, -uTime * 0.4));
  float heat = clamp((1.15 - d) * (0.75 + 0.5 * churn) * uStrength, 0.0, 1.0);
  vec3 col = mix(vec3(0.45, 0.04, 0.0), vec3(1.0, 0.35, 0.02), smoothstep(0.1, 0.55, heat));
  col = mix(col, vec3(1.0, 0.9, 0.45), smoothstep(0.65, 1.0, heat));
  float a = smoothstep(1.25, 0.85, d);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
  });
}

/** Lava ribbon: a glowing front, a crust that darkens as it cools, and bright cracks in the crust. */
function lavaMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uProg: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `
uniform float uTime;
uniform float uProg;
varying vec2 vUv;
${GLSL_NOISE}
void main() {
  float along = vUv.x;
  float lobe = 0.035 * (vnoise(vec2(vUv.y * 6.0, 3.0)) - 0.5);
  if (along > uProg + lobe) discard;
  float age = clamp((uProg - along) * 2.2, 0.0, 1.0);
  float vent = smoothstep(0.12, 0.0, along);
  // A hot channel stays open in the middle; the edges and the old parts crust over first.
  float cool = age * (1.0 - vent) * (0.45 + 0.55 * abs(vUv.y - 0.5) * 2.0);
  float flow = fbm2(vec2(along * 26.0 - uTime * 0.7, vUv.y * 3.0));
  float crack = 1.0 - smoothstep(0.0, 0.07, abs(fbm2(vec2(along * 40.0, vUv.y * 5.0 + 2.0)) - 0.5));
  vec3 hot = mix(vec3(1.0, 0.32, 0.02), vec3(1.0, 0.82, 0.3), flow);
  vec3 crust = mix(vec3(0.07, 0.06, 0.06), vec3(0.18, 0.14, 0.13), flow);
  vec3 col = mix(hot, crust, smoothstep(0.15, 0.85, cool));
  col = mix(col, hot, crack * cool * 0.9);
  float edge = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
  col *= 0.75 + 0.25 * edge;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
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

const smooth = (t: number) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};
export const slabTop = (x: number) => (x <= -2 ? -1.2 - ((x - X0) / 12) * 0.8 : -2 - (x + 2) * TAN);
const slabBot = (x: number) => slabTop(x) - 1.1;
function land(x: number) {
  if (x < 2) return -2 + 2.1 * smooth((x + 2) / 4);
  let h = 0.1 + 0.35 * Math.min(1, (x - 2) / 3);
  h += 2.7 * Math.max(0, 1 - Math.abs(x - VX) / 2.6);
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

interface Particle {
  p: THREE.Vector3;
  v: THREE.Vector3;
  age: number;
  life: number;
}

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
  private timer = new THREE.Timer();
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private step: VolcanoStep = "plates";
  private t = 0;
  private eventT = 0;
  private groups: Record<"plates" | "magma" | "eruption" | "quake", THREE.Group> = { plates: new THREE.Group(), magma: new THREE.Group(), eruption: new THREE.Group(), quake: new THREE.Group() };
  private blobs: THREE.Mesh[] = [];
  private rings: THREE.Mesh[] = [];
  private plateArrows: THREE.Mesh[] = [];
  private lavaMat = lavaMaterial();
  private glows: THREE.ShaderMaterial[] = [];
  private bombs: THREE.InstancedMesh;
  private ash: ParticleCloud;
  private embers: ParticleCloud;
  private crest: ParticleCloud;
  private emberP: Particle[] = [];
  private crestP: Particle[] = [];
  private craterLight = new THREE.PointLight("#ff7a1a", 0, 9, 1.6);
  private chamberHalo: THREE.Mesh;
  private ashLow = new THREE.Color("#3f3631");
  private ashLit = new THREE.Color("#8a4a24");
  private ashHigh = new THREE.Color("#8d8984");
  private c = new THREE.Color();
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
    this.scene.background = new THREE.Color("#a9d4f0");
    const sun = new THREE.DirectionalLight("#fff4e0", 2);
    sun.position.set(-4, 12, 8);
    this.scene.add(new THREE.HemisphereLight("#eef5ff", "#5a4a3a", 1.2), sun);

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
        if (Math.abs(x - VX) < 2.7 && y > 0.7) return y > 2.4 ? "#eef1f4" : "#6b6258";
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
    this.scene.add(
      new THREE.Mesh(this.waterFront, new THREE.MeshBasicMaterial({ color: "#2f7fbf", transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })),
      new THREE.Mesh(this.waterTop, new THREE.MeshStandardMaterial({ color: "#3b8fd0", roughness: 0.3, transparent: true, opacity: 0.85, side: THREE.DoubleSide })),
    );

    // Plates: arrows of motion, trench.
    const arrowMat = (dir: 1 | -1, x: number, y: number, color: string) => {
      const m = decal(arrow(0, 0, dir), color, 1, 0.01);
      m.position.x = x;
      m.position.y = y;
      this.plateArrows.push(m);
      return m;
    };
    this.groups.plates.add(arrowMat(1, -12, -1.75, "#ffffff"), arrowMat(-1, 13.2, -2.6, "#ffffff"), arrowMat(1, -5, -7.9, "#ffd8b0"));

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
    this.groups.eruption.add(decal(ellipse(VX, PEAK - 0.12, 0.33, 0.12), "#ffb03a", 1, 0.035));
    const bombMat = new THREE.MeshBasicMaterial({ color: "#ffffff" });
    this.bombs = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.085, 0), bombMat, 70);
    this.bombs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(70 * 3).fill(1), 3);
    this.ash = new ParticleCloud(520, { soft: 1, order: 3 });
    this.embers = new ParticleCloud(220, { soft: 0.45, additive: true, order: 4 });
    this.crest = new ParticleCloud(180, { soft: 0.55, order: 5 });
    for (let i = 0; i < 70; i++) this.bombP.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: -Math.random() * 1.5 });
    for (let i = 0; i < 520; i++) this.ashP.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: -Math.random() * 7 });
    for (let i = 0; i < 220; i++) this.emberP.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 0, life: -Math.random() * 1.2 });
    for (let i = 0; i < 180; i++) this.crestP.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), age: 9, life: 0 });
    this.craterLight.position.set(VX, PEAK + 0.6, FZ + 1.2);
    this.groups.eruption.add(this.bombs, this.ash.points, this.embers.points, this.craterLight);
    this.scene.add(this.crest.points);

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
    this.scene.add(this.groups.plates, this.groups.magma, this.groups.eruption, this.groups.quake);

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
    for (let i = 0; i <= n; i++) {
      const x = this.waterX[i];
      if (front) pos.set([x, floor(x), z, x, 0, z], i * 6);
      else pos.set([x, 0, DEPTH / 2, x, 0, -DEPTH / 2], i * 6);
    }
    const idx: number[] = [];
    for (let i = 0; i < n; i++) idx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
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

  /** Run the event of the current step again (eruption, earthquake, tsunami). */
  restart() {
    this.eventT = 0;
    this.pulses = { l: QX, r: QX };
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
    for (const c of [this.ash, this.embers, this.crest]) c.setViewport(h * this.renderer.getPixelRatio(), this.camera.fov);
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
    const top = this.waterTop.getAttribute("position") as THREE.BufferAttribute;
    const wave = (x: number) => {
      if (!on) return 0;
      let h = 0;
      for (const [c, side] of [[this.pulses.l, -1], [this.pulses.r, 1]] as const) {
        const d = Math.max(0.05, -floor(Math.min(c, COAST - 0.05)));
        const grow = Math.min(2.8, (d0 / d) ** 0.25);
        const width = Math.max(0.28, 0.85 * Math.sqrt(d / d0));
        const inland = side > 0 && c > COAST ? Math.max(0, 1 - (c - COAST) / 2.2) : 1;
        const fade = side < 0 ? Math.max(0, 1 - (QX - c) / 18) : 1;
        const amp = 0.17 * grow * inland * fade * Math.min(1, age * 2);
        // In shallow water the front steepens and the back stretches: the wave leans forward.
        const steep = Math.min(1, Math.max(0, (grow - 1.15) / 1.3));
        const xi = (x - c) * side;
        const w = xi > 0 ? width * (1 - 0.65 * steep) : width * (1 + 0.6 * steep);
        h += amp * Math.exp(-((xi / w) ** 2));
        // Toward the coast a trough runs ahead of the crest: the sea first draws back from the shore.
        if (side > 0) h -= amp * 0.55 * Math.exp(-(((xi - width * 1.7) / (width * 0.9)) ** 2));
      }
      return h;
    };
    const t = this.t;
    if (on && this.pulses.r < COAST + 0.3) {
      const d = Math.max(0.05, -floor(Math.min(this.pulses.r, COAST - 0.05)));
      const steep = Math.min(1, Math.max(0, ((-floor(QX) / d) ** 0.25 - 1.15) / 1.3));
      this.updateCrest(dt, this.pulses.r, wave(this.pulses.r) + 0.02, steep);
    } else {
      this.updateCrest(dt, 0, 0, 0);
    }
    for (let i = 0; i <= this.waterN; i++) {
      const x = this.waterX[i];
      const ground = floor(x);
      const ripple = this.reduceMotion ? 0 : 0.025 * Math.sin(x * 2.2 - t * 1.6);
      // Run-up: a wave reaching the shore climbs onto the land.
      const run = this.step === "tsunami" && x > COAST && this.pulses.r > COAST && x < this.pulses.r + 0.4 ? Math.max(0, 0.45 * (1 - (x - COAST) / 2.6)) * Math.min(1, (this.pulses.r - COAST) * 1.5) : 0;
      let level = (x < COAST ? ripple : -1) + wave(x);
      if (run > 0) level = Math.max(level, ground + run * Math.max(0, 1 - Math.max(0, x - this.pulses.r) / 0.4));
      const y = Math.max(ground, level);
      front.setXY(i * 2, x, ground);
      front.setXY(i * 2 + 1, x, y);
      top.setY(i * 2, y);
      top.setY(i * 2 + 1, y);
    }
    front.needsUpdate = true;
    top.needsUpdate = true;
    this.waterTop.computeVertexNormals();
    this.anchors.tsunamiL.set(Math.max(X0 + 1.5, this.pulses.l), wave(this.pulses.l) + 0.7, FZ);
    this.anchors.tsunamiR.set(Math.min(COAST + 1.2, this.pulses.r), Math.max(0, wave(this.pulses.r)) + 0.9 + Math.max(0, floor(this.pulses.r)), FZ);
  }

  private updateEruption(dt: number) {
    const g = -6;
    const cr = new THREE.Vector3(VX, PEAK, 0);
    const hotC = new THREE.Color("#ffd27a");
    const coolC = new THREE.Color("#2e2420");
    this.bombP.forEach((b, i) => {
      b.life += dt;
      if (b.life < 0) {
        this.dummy.scale.setScalar(0.0001);
      } else {
        if (b.age === 0 || b.p.y < floor(b.p.x) - 0.05) {
          b.p.copy(cr);
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
        this.bombs.setColorAt(i, this.c.copy(hotC).lerp(coolC, Math.min(1, b.age / 1.6)));
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
        e.v.set((Math.random() - 0.5) * 1.6, 2.4 + Math.random() * 2.6, (Math.random() - 0.5) * 0.8);
        e.age = 0.0001;
      }
      e.v.y += g * dt;
      e.p.addScaledVector(e.v, dt);
      e.age += dt;
      const k = e.age / 0.9;
      this.embers.set(i, e.p, 0.22 * (1 - k * 0.5), 0.9 * (1 - k), this.c.setRGB(1, 0.55 - 0.35 * k, 0.12 * (1 - k)));
    });
    // Ash column: a fast jet, then buoyant rise, then the umbrella cloud spreads and drifts with the wind.
    const top = PEAK + 2;
    this.ashP.forEach((a, i) => {
      a.life += dt;
      if (a.life < 0) return this.ash.hide(i);
      if (a.age === 0 || a.age > 7.5) {
        a.p.set(VX + (Math.random() - 0.5) * 0.25, PEAK + 0.1, (Math.random() - 0.5) * 0.5);
        a.v.set((Math.random() - 0.5) * 0.4, 4 + Math.random() * 2.5, (Math.random() - 0.5) * 0.4);
        a.age = 0.0001;
      }
      const h = a.p.y - PEAK;
      if (a.p.y < top) {
        // Jet slows down quickly, buoyancy keeps it rising; the column widens as it pulls in air.
        a.v.y += (1.6 - a.v.y) * Math.min(1, 1.4 * dt);
        a.v.x += (Math.random() - 0.5) * 0.9 * dt + 0.08 * dt;
      } else {
        // Umbrella: stops rising (neutral buoyancy) and spreads sideways, wind pushes it right.
        a.v.y *= 1 - 2.5 * dt;
        a.v.x += (Math.sign(a.v.x || 1) * 0.5 + 0.35) * dt;
      }
      a.v.z += (Math.random() - 0.5) * 0.4 * dt;
      a.p.addScaledVector(a.v, dt);
      a.age += dt;
      const k = a.age / 7.5;
      // Lit orange from below near the vent, grey and lighter higher up.
      this.c.copy(this.ashLit).lerp(this.ashLow, Math.min(1, h / 1.2)).lerp(this.ashHigh, Math.min(1, Math.max(0, h - 1) / 3));
      this.ash.set(i, a.p, 0.6 + Math.min(2.8, h * 0.5 + a.age * 0.3), 0.62 * Math.min(1, a.age * 4) * (1 - k * k), this.c);
    });
    this.ash.commit();
    this.embers.commit();
    this.bombs.instanceMatrix.needsUpdate = true;
    if (this.bombs.instanceColor) this.bombs.instanceColor.needsUpdate = true;
    this.lavaMat.uniforms.uProg.value = Math.min(1, this.eventT / 7);
    this.craterLight.intensity = 9 + 4 * Math.sin(this.t * 13) * Math.sin(this.t * 5.3);
  }

  /** White water thrown off the steepening crest of the tsunami. */
  private updateCrest(dt: number, x: number, y: number, steep: number) {
    let spawn = this.step === "tsunami" && steep > 0.25 ? Math.ceil(steep * 4) : 0;
    this.crestP.forEach((p, i) => {
      p.age += dt;
      if (p.age > p.life && spawn > 0) {
        spawn--;
        p.p.set(x + (Math.random() - 0.3) * 0.25, y, (Math.random() - 0.5) * DEPTH * 0.95);
        p.v.set(0.6 + Math.random() * 1.2, 0.6 + Math.random() * 1.4 * steep, 0);
        p.age = 0;
        p.life = 0.5 + Math.random() * 0.5;
      }
      if (p.age > p.life) return this.crest.hide(i);
      p.v.y -= 6 * dt;
      p.p.addScaledVector(p.v, dt);
      this.crest.set(i, p.p, 0.12 + 0.12 * (p.age / p.life), 0.9 * (1 - p.age / p.life), this.c.set("#f4f8fb"));
    });
    this.crest.commit();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = this.reduceMotion ? 0 : Math.min(0.05, this.timer.getDelta());
    this.t += dt;
    this.eventT += this.reduceMotion ? 10 : dt;

    // Plate arrows creep in their direction and start again.
    const s = (this.t * 0.35) % 1;
    this.plateArrows.forEach((a, i) => (a.position.x = [-12, 13.2, -5][i] + (i === 1 ? -1 : 1) * s * 0.9));
    // Magma blobs rise from the melting zone to the chamber.
    const from = new THREE.Vector2(5.2, slabTop(5.2) + 0.35);
    const to = new THREE.Vector2(VX, -1.9);
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
    if (this.step === "eruption") this.updateEruption(dt);

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
    const shake = quakeOn && qt < 1.6 && !this.reduceMotion ? 0.12 * (1 - qt / 1.6) : 0;
    const off = new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0);
    this.camera.position.add(off);
    this.renderer.render(this.scene, this.camera);
    this.camera.position.sub(off);
    this.onFrame?.(this.project, this.anchors, { tsunami: this.step === "tsunami" ? this.eventT : 0, quake: quakeOn ? qt : 0 });
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
