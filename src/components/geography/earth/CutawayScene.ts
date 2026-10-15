import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { latLonToVec3 } from "../globe/coords";
import { atmosphereMesh, earthMesh, starField } from "../globe/earth";
import { globePath, pathTube } from "../globe/paths";
import { drawnRadius, LAYERS, type LayerId } from "./layers";
import { PLATE_BOUNDARIES } from "./plates";

/*
 * The Earth cut open. Every layer is a full sphere; two clipping planes through the axis remove a wedge
 * `opening` degrees wide (0 = whole planet, 90 = the classic quarter cut, 180 = half). On each cut face
 * flat half-rings show the layers in their colours. React places labels through `onFrame(project)`.
 */

const D = Math.PI / 180;
export type Projector = (p: THREE.Vector3) => { x: number; y: number; visible: boolean };

function halfRings() {
  const g = new THREE.Group();
  const mats = new Map<LayerId, THREE.MeshStandardMaterial>();
  for (const l of LAYERS) {
    const mat = new THREE.MeshStandardMaterial({ color: l.color, emissive: l.color, emissiveIntensity: l.glow, roughness: 0.9, side: THREE.DoubleSide });
    // Half-ring in the XY plane on the +x side (from straight down to straight up).
    const geo = new THREE.RingGeometry(Math.max(0.0001, l.rBottom), l.rTop, 96, 1, -Math.PI / 2, Math.PI);
    g.add(new THREE.Mesh(geo, mat));
    mats.set(l.id, mat);
  }
  return { group: g, mats };
}

/** Where the compass stands (Georgia). */
const COMPASS_AT = { lat: 42, lon: 44 };
const georgia = latLonToVec3(COMPASS_AT.lat, COMPASS_AT.lon, 1);

/** A view looking at `subject` from direction `dir`, `dist` away; the subject sits a little above the middle (subtitles run along the bottom). */
function shot(dir: [number, number, number], dist: number, subject: [number, number, number]) {
  const lift = dist * Math.tan(17.5 * D) * 0.2;
  const target = new THREE.Vector3(...subject).sub(new THREE.Vector3(0, lift, 0));
  return [new THREE.Vector3(...dir).normalize().multiplyScalar(dist).add(target), target] as const;
}

/** Camera views the narration sends the camera to: position and the point looked at. */
export const CUT_VIEWS = {
  whole: shot([2.6, 1.2, 2.6], 4.4, [0, 0, 0]),
  face: shot([1.6, 0.5, 3.2], 4.3, [0.3, 0, 0]),
  crust: shot([0.6, 0.38, 1], 0.9, [0.73, 0.6, 0]),
  mantle: shot([0.3, 0.12, 1], 2.5, [0.5, 0.3, 0]),
  core: shot([0.25, 0.08, 1], 2.15, [0.24, 0, 0]),
  inner: shot([0.3, 0.1, 1], 1.75, [0.12, 0, 0]),
  field: shot([4.6, 1.9, 4.4], 5.4, [0, 0, 0]),
  compass: shot([georgia.x, georgia.y + 0.2, georgia.z], 2.2, [georgia.x * 0.7, georgia.y * 0.7, georgia.z * 0.7]),
} as const;
export type CutView = keyof typeof CUT_VIEWS;

/** What the scene can show besides the layers (the narration turns them on). */
export type CutFx = "waves" | "convection" | "core" | "magma" | "field" | "plates" | "compass";
/** A depth range lit on the cut faces (km). */
export const BANDS = { lithosphere: [0, 100], asthenosphere: [100, 250] } as const;
export type CutBand = keyof typeof BANDS;

/**
 * Particles running round oval cells on cut face A: mantle convection (neighbouring cells turn opposite ways, hot
 * rock rising, cooled rock sinking) and the swirling liquid iron of the outer core.
 */
interface FlowSpec {
  r0: number;
  r1: number;
  /** Centres of the cells (degrees above the equator) and their half-width. */
  cells: number[];
  span: number;
  count: number;
  speed: number;
  /** Point size (three.js units: pixels at 1 unit away per half the canvas height). */
  size: number;
  /** Draw each cell's loop faintly, red where it rises and blue where it sinks. */
  outline: boolean;
  color: (rising: boolean, k: number, out: THREE.Color) => void;
}
const MANTLE_FLOW: FlowSpec = {
  r0: 0.6,
  r1: 0.92,
  cells: [-44, -6, 32, 69],
  span: 17,
  count: 300,
  speed: 0.07,
  size: 0.085,
  outline: true,
  // Rising: hot, orange-yellow; sinking: cooled, blue.
  color: (rising, k, c) => (rising ? c.setRGB(1, 0.45 + 0.3 * (1 - k), 0.15) : c.setRGB(0.35 + 0.3 * (1 - k), 0.65, 1)),
};
const CORE_FLOW: FlowSpec = {
  r0: 0.23,
  r1: 0.52,
  cells: [-48, 0, 48],
  span: 21,
  count: 200,
  speed: 0.12,
  size: 0.07,
  outline: false,
  color: (_rising, k, c) => c.setRGB(1, 0.96, 0.7 + 0.25 * k),
};

/** A round, soft dot for the particles. */
function dot() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.95)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function flowPoints(spec: FlowSpec) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(spec.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(spec.count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const points = new THREE.Points(g, new THREE.PointsMaterial({ size: spec.size, map: dot(), vertexColors: true, transparent: true, opacity: 0.95, depthTest: false }));
  points.renderOrder = 6;
  points.visible = false;
  // Spread evenly round each cell (golden-ratio steps).
  const per = Math.ceil(spec.count / spec.cells.length);
  const phase = Float32Array.from({ length: spec.count }, (_, i) => ((i % per) * 0.618034) % 1);
  if (spec.outline) {
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    spec.cells.forEach((centre, cell) => {
      const dir = cell % 2 ? 1 : -1;
      for (let k = 0; k < 96; k++)
        for (const j of [k, k + 1]) {
          const u = (j / 96) * Math.PI * 2;
          const r = (spec.r0 + spec.r1) / 2 + ((spec.r1 - spec.r0) / 2) * 0.8 * Math.sin(u);
          const e = (centre + spec.span * 0.8 * Math.cos(u)) * D;
          pos.push(r * Math.cos(e), r * Math.sin(e), 0.005);
          spec.color(Math.cos(u) * dir > 0, 1, c);
          col.push(c.r, c.g, c.b);
        }
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    lg.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    const loops = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthTest: false }));
    loops.renderOrder = 5;
    points.add(loops);
  }
  return { points, phase, spec };
}
type Flow = ReturnType<typeof flowPoints>;

/** Earthquake waves on cut face A: fronts running out from a focus near the surface, faster in some layers. */
const WAVE_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const WAVE_FRAG = /* glsl */ `
uniform float uTime;
uniform vec2 uFocus;
varying vec2 vP;
void main() {
  float r = length(vP);
  // Wave speed by layer (drawn radii): slow in the crust, fast in the mantle, slower in the liquid outer core.
  float v = r > 0.955 ? 0.55 : r > 0.546 ? 1.0 : r > 0.192 ? 0.62 : 0.85;
  float d = distance(vP, uFocus);
  float x = fract(uTime * 0.5 - d / v * 2.0);
  float front = pow(1.0 - x, 5.0) * (1.0 - smoothstep(0.3, 2.0, d));
  float focus = smoothstep(0.06, 0.0, d) * (0.6 + 0.4 * sin(uTime * 12.0));
  float a = clamp(front * 0.9 + focus, 0.0, 1.0);
  gl_FragColor = vec4(1.0, 0.97, 0.86, a);
}`;

export class CutawayScene {
  onFrame: ((project: Projector) => void) | null = null;
  /** Opening of the cut, degrees (0…180). */
  opening = 90;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private planeA = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  private planeB = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  private clipped: THREE.Material[] = [];
  private faceA: ReturnType<typeof halfRings>;
  private spheres = new Map<LayerId, THREE.MeshStandardMaterial>();
  private faceB: ReturnType<typeof halfRings>;
  private probe: THREE.Mesh;
  private tween: { from: number; to: number; start: number } | null = null;
  private probeOn = true;
  /** A plane that clips nothing (keeps the shader the same when the planet is whole). */
  private noClip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 5);
  private flight: { from: [THREE.Vector3, THREE.Vector3]; to: readonly [THREE.Vector3, THREE.Vector3]; start: number } | null = null;
  /** What the narration shows: on cut face A (only drawn while the face is turned to the camera) and round the planet. */
  private faceFx = new THREE.Group();
  private flows: Flow[] = [];
  private mantleFlow: Flow;
  private coreFlow: Flow;
  private magma: THREE.Points;
  private waves: THREE.Mesh;
  private waveUniforms = { uTime: { value: 0 }, uFocus: { value: new THREE.Vector2(Math.cos(62 * D), Math.sin(62 * D)) } };
  private bands: THREE.Mesh[] = [];
  private bandMat = new THREE.MeshBasicMaterial({ color: "#fff3b0", transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  private field = new THREE.Group();
  private fieldMat = new THREE.LineBasicMaterial({ color: "#7cc7ff", transparent: true, opacity: 0.75 });
  private plates = new THREE.Group();
  private plateMat = new THREE.MeshBasicMaterial({ color: "#ff6a3d" });
  private compass = new THREE.Group();
  private needle = new THREE.Group();
  private compassShown = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;

    this.scene.add(new THREE.AmbientLight("#ffffff", 0.9));
    const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
    sun.position.set(4, 3, 5);
    this.scene.add(sun, starField(), atmosphereMesh(1));

    const surface = earthMesh(1);
    this.clip(surface.material as THREE.Material);
    this.scene.add(surface);
    // Inner layers: plain spheres, seen only through the cut.
    for (const l of LAYERS.slice(1)) {
      const mat = new THREE.MeshStandardMaterial({ color: l.color, emissive: l.color, emissiveIntensity: l.glow, roughness: 0.9, side: THREE.DoubleSide });
      this.spheres.set(l.id, mat);
      this.clip(mat);
      this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(l.rTop, 64, 48), mat));
    }
    this.faceA = halfRings();
    this.faceB = halfRings();
    this.scene.add(this.faceA.group, this.faceB.group);

    // On cut face A: mantle convection, the flowing outer core, magma rising, earthquake waves, lit depth bands.
    this.mantleFlow = flowPoints(MANTLE_FLOW);
    this.coreFlow = flowPoints(CORE_FLOW);
    this.flows = [this.mantleFlow, this.coreFlow];
    const mg = new THREE.BufferGeometry();
    mg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(48 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    this.magma = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.05, map: dot(), color: "#ffb02e", transparent: true, opacity: 0.95, depthTest: false }));
    this.magma.renderOrder = 6;
    this.magma.visible = false;
    this.waves = new THREE.Mesh(
      new THREE.CircleGeometry(1, 128, -Math.PI / 2, Math.PI),
      new THREE.ShaderMaterial({ uniforms: this.waveUniforms, vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG, transparent: true, depthWrite: false }),
    );
    this.waves.position.z = 0.004;
    this.waves.renderOrder = 4;
    this.waves.visible = false;
    this.faceFx.add(this.mantleFlow.points, this.coreFlow.points, this.magma, this.waves);
    // Depth bands on both cut faces (face B turns with the opening).
    for (let i = 0; i < 2; i++) {
      const band = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 96, 1, -Math.PI / 2, Math.PI), this.bandMat);
      band.renderOrder = 3;
      band.visible = false;
      this.bands.push(band);
    }
    this.faceA.group.add(this.bands[0]);
    this.faceB.group.add(this.bands[1]);
    // The plates' boundaries on the surface (cut away with the planet).
    this.clip(this.plateMat);
    for (const line of PLATE_BOUNDARIES) this.plates.add(pathTube(globePath(line.map(([lat, lon]) => ({ lat, lon })), 1, 0.004, 2), 0.0055, this.plateMat).mesh);
    this.plates.visible = false;
    // A compass on Georgia: the needle (red end north) settles along the field.
    this.buildCompass();
    // The magnetic field: dipole lines r = L cos²(latitude) round the axis, outside the planet.
    for (const L of [1.35, 1.75, 2.25, 2.9])
      for (let k = 0; k < 6; k++) {
        const pts: THREE.Vector3[] = [];
        const lim = Math.acos(Math.sqrt(1 / L));
        for (let i = 0; i <= 64; i++) {
          const lat = -lim + (2 * lim * i) / 64;
          const r = L * Math.cos(lat) ** 2;
          const a = (k / 6) * Math.PI * 2;
          pts.push(new THREE.Vector3(r * Math.cos(lat) * Math.cos(a), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(a)));
        }
        this.field.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), this.fieldMat));
      }
    this.field.visible = false;
    this.scene.add(this.faceFx, this.field, this.plates, this.compass);

    this.probe = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: "#ffffff", depthTest: false }));
    this.probe.renderOrder = 5;
    this.scene.add(this.probe);

    this.camera.position.set(2.6, 1.2, 2.6);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 7;
    this.controls.rotateSpeed = 0.5;
    this.controls.addEventListener("start", () => (this.flight = null));

    this.setOpening(90);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  private clip(mat: THREE.Material) {
    mat.clippingPlanes = [this.planeA, this.planeB];
    mat.clipIntersection = true;
    this.clipped.push(mat);
  }

  /** Point on cut face A (the plane z = 0, x > 0) at a radius and an angle above the equator. */
  facePoint(r: number, elev: number, out = new THREE.Vector3()) {
    return out.set(r * Math.cos(elev * D), r * Math.sin(elev * D), 0.002);
  }

  setOpening(deg: number) {
    this.opening = THREE.MathUtils.clamp(deg, 0, 180);
    const a = this.opening * D;
    this.planeB.normal.set(-Math.sin(a), 0, Math.cos(a));
    const open = this.opening > 0.5;
    for (const m of this.clipped) m.clippingPlanes = open ? [this.planeA, this.planeB] : [this.noClip, this.noClip];
    this.faceA.group.visible = open;
    this.faceB.group.visible = open;
    this.faceB.group.rotation.y = -a;
    this.probe.visible = open && this.probeOn;
  }

  /** Glide the cut open or closed. */
  animateTo(deg: number) {
    if (this.reduceMotion) return this.setOpening(deg);
    this.tween = { from: this.opening, to: deg, start: performance.now() };
  }

  /** Probe marker at a depth (km), at an angle above the equator on cut face A. */
  setProbe(depth: number, elev = -28) {
    this.facePoint(drawnRadius(depth), elev, this.probe.position);
  }

  /** Light up one layer or several (the others darken). */
  select(id: LayerId | LayerId[] | null) {
    const ids = id === null ? [] : Array.isArray(id) ? id : [id];
    for (const l of LAYERS) {
      const on = ids.includes(l.id);
      const dim = ids.length > 0 && !on;
      for (const m of [this.faceA.mats.get(l.id), this.faceB.mats.get(l.id), this.spheres.get(l.id)]) {
        if (!m) continue;
        m.color.set(l.color).multiplyScalar(dim ? 0.4 : 1);
        m.emissiveIntensity = on ? Math.max(0.6, l.glow + 0.45) : dim ? l.glow * 0.3 : l.glow;
      }
    }
  }

  /** The probe shown or hidden. */
  showProbe(on: boolean) {
    this.probeOn = on;
    this.probe.visible = on && this.opening > 0.5;
  }

  /** Fly the camera to one of the views (`instant`: be there at once). */
  view(name: CutView, instant = false) {
    const to = CUT_VIEWS[name];
    // Close-ups come nearer than the user may zoom by hand.
    this.controls.minDistance = Math.min(1.6, to[0].distanceTo(to[1]) * 0.95);
    if (instant || this.reduceMotion) {
      this.flight = null;
      this.camera.position.copy(to[0]);
      this.controls.target.copy(to[1]);
      return;
    }
    this.flight = { from: [this.camera.position.clone(), this.controls.target.clone()], to, start: performance.now() };
  }

  /** What is shown besides the layers: the effects listed, and one lit depth band (or none). */
  show(fx: CutFx[], band: CutBand | null) {
    const on = new Set(fx);
    this.mantleFlow.points.visible = on.has("convection");
    this.coreFlow.points.visible = on.has("core");
    this.magma.visible = on.has("magma");
    this.waves.visible = on.has("waves");
    this.field.visible = on.has("field");
    this.plates.visible = on.has("plates");
    if (on.has("compass") && !this.compass.visible) this.compassShown = performance.now();
    this.compass.visible = on.has("compass");
    for (const b of this.bands) {
      b.visible = !!band;
      if (band) {
        const [top, bottom] = BANDS[band];
        b.geometry.dispose();
        b.geometry = new THREE.RingGeometry(drawnRadius(bottom), drawnRadius(top) + 0.001, 96, 1, -Math.PI / 2, Math.PI);
        b.position.z = 0.003;
      }
    }
  }

  private buildCompass() {
    const up = georgia.clone().normalize();
    const north = latLonToVec3(COMPASS_AT.lat + 1, COMPASS_AT.lon, 1).sub(georgia).normalize();
    const west = new THREE.Vector3().crossVectors(up, north).normalize();
    // Local axes: x west, y up (out of the ground), z north.
    this.compass.matrixAutoUpdate = false;
    this.compass.matrix.makeBasis(west, up, north).setPosition(georgia.clone().multiplyScalar(1.012));
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.014, 40), new THREE.MeshStandardMaterial({ color: "#f3efe4", roughness: 0.6 }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 8, 40), new THREE.MeshStandardMaterial({ color: "#8a6d3b", metalness: 0.4, roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2;
    const red = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.09, 12), new THREE.MeshBasicMaterial({ color: "#e0322b" }));
    red.rotation.x = Math.PI / 2;
    red.position.z = 0.045;
    const white = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.09, 12), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
    white.rotation.x = -Math.PI / 2;
    white.position.z = -0.045;
    this.needle.add(red, white);
    this.needle.position.y = 0.016;
    this.compass.add(dial, rim, this.needle);
    this.compass.visible = false;
  }

  private moveFlow({ points, phase, spec }: Flow, dt: number) {
    const pos = points.geometry.getAttribute("position") as THREE.BufferAttribute;
    const col = points.geometry.getAttribute("color") as THREE.BufferAttribute;
    const { r0, r1, cells, span, count, speed } = spec;
    const mid = (r0 + r1) / 2;
    const h = (r1 - r0) / 2;
    const per = Math.ceil(count / cells.length);
    for (let i = 0; i < count; i++) {
      const cell = Math.floor(i / per);
      // Neighbouring cells turn opposite ways, as real convection cells do.
      const dir = cell % 2 ? 1 : -1;
      phase[i] = (phase[i] + dt * speed * dir + 1) % 1;
      const u = phase[i] * Math.PI * 2 + (i % 3) * 0.6;
      const lane = 0.6 + (0.4 * ((i * 7) % 5)) / 4;
      this.facePoint(mid + h * lane * Math.sin(u), cells[cell] + span * lane * Math.cos(u), this.v);
      pos.setXYZ(i, this.v.x, this.v.y, 0.006);
      // r grows as d(sin u)/dt = cos u · u' > 0: rising.
      const rising = Math.cos(u) * dir > 0;
      spec.color(rising, Math.abs(Math.cos(u)), this.c);
      col.setXYZ(i, this.c.r, this.c.g, this.c.b);
    }
    pos.needsUpdate = col.needsUpdate = true;
  }

  /** Magma: drops rising from the asthenosphere into the crust under the close-up of the crust. */
  private moveMagma(now: number) {
    const pos = this.magma.geometry.getAttribute("position") as THREE.BufferAttribute;
    const from = drawnRadius(BANDS.asthenosphere[1]);
    for (let i = 0; i < pos.count; i++) {
      const k = (now / 5200 + i / pos.count) % 1;
      const elev = 18 + ((i * 37) % 48) * 0.6 + Math.sin(now / 900 + i) * 0.6;
      this.facePoint(from + (0.985 - from) * k, elev, this.v);
      pos.setXYZ(i, this.v.x, this.v.y, 0.006);
    }
    pos.needsUpdate = true;
  }

  private project: Projector = (p) => {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };

  /** Face A is turned towards the camera. */
  faceVisible() {
    return this.opening > 5 && this.camera.position.z > 0.05;
  }

  /** The labels on face A can be read (the face is turned to the camera and not far off). */
  labelsReadable() {
    return this.faceVisible() && this.camera.position.distanceTo(this.controls.target) < 4.9;
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 35 / Math.max(0.55, w / h) : 35;
    this.camera.updateProjectionMatrix();
  }

  private v = new THREE.Vector3();
  private c = new THREE.Color();
  private last = performance.now();

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.faceFx.visible = this.faceVisible();
    const still = this.reduceMotion ? 0 : dt;
    for (const f of this.flows) if (f.points.visible) this.moveFlow(f, still);
    if (this.magma.visible) this.moveMagma(this.reduceMotion ? 2600 : now);
    this.waveUniforms.uTime.value = this.reduceMotion ? 0.8 : now / 1000;
    if (this.field.visible) this.fieldMat.opacity = 0.55 + 0.25 * Math.sin(now / 400);
    if (this.bands[0].visible) this.bandMat.opacity = 0.42 + 0.22 * Math.sin(now / 320);
    if (this.plates.visible) this.plateMat.color.setHSL(0.04, 1, 0.55 + 0.1 * Math.sin(now / 300));
    if (this.compass.visible) {
      // The needle swings and settles pointing north.
      const t = (now - this.compassShown) / 1000;
      this.needle.rotation.y = this.reduceMotion ? 0 : 2.2 * Math.exp(-1.1 * t) * Math.cos(5 * t);
    }
    if (this.flight) {
      const k = Math.min(1, (now - this.flight.start) / 1700);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      this.camera.position.lerpVectors(this.flight.from[0], this.flight.to[0], e);
      this.controls.target.lerpVectors(this.flight.from[1], this.flight.to[1], e);
      if (k >= 1 || this.reduceMotion) this.flight = null;
    }
    if (this.tween) {
      const k = Math.min(1, (performance.now() - this.tween.start) / 1100);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.setOpening(this.tween.from + (this.tween.to - this.tween.from) * e);
      if (k >= 1) this.tween = null;
    }
    this.controls.update();
    // The probe keeps about the same size on the screen, near or far.
    this.probe.scale.setScalar(THREE.MathUtils.clamp(this.camera.position.distanceTo(this.controls.target) / 3.6, 0.3, 1.3));
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.project);
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
      for (const mat of mats) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}
