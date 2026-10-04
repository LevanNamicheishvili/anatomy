import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { fbm, smoothstep } from "@/lib/noise";
import { MEIOSIS_PHASES, MITOSIS_PHASES, ORGANELLES, type CellView, type OrganelleId } from "./cell-data";

/*
 * Cells built from code, textbook style: each cell is cut open (a quarter removed) so the inside shows.
 * Organelles in the animal and plant cells can be picked. Cell division is a keyframed animation of
 * chromatids, spindle, nuclei and a membrane that pinches in two. Units: an animal cell has radius 3.
 */

interface Callbacks {
  onPick: (id: OrganelleId | null) => void;
  onPhase: (index: number) => void;
}

interface Label {
  target: THREE.Object3D;
  offset: THREE.Vector3;
  el: HTMLDivElement;
  /** Organelle labels can be switched off; others always show. */
  organelle?: OrganelleId;
}

type V3 = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const Y = v(0, 1, 0);

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Two planes whose intersection removes the quarter of a cell facing the camera (+x, +z). */
const cutAt = (c: V3) => [new THREE.Plane(v(0, 0, -1), c.z), new THREE.Plane(v(-1, 0, 0), c.x)];
const isCut = (p: V3, c: V3) => p.x > c.x + 0.01 && p.z > c.z + 0.01;

/** Soft, slightly uneven sphere (optionally scaled), with optional two-tone noise colouring. */
function blob(radius: number, amount: number, seed: number, detail = 4, scale = v(1, 1, 1), colors?: [string, string], freq = 1.6) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute("normal").deleteAttribute("uv"));
  const p = g.attributes.position;
  const n = new THREE.Vector3();
  const col = colors ? new Float32Array(p.count * 3) : null;
  const a = new THREE.Color(colors?.[0]);
  const b = new THREE.Color(colors?.[1]);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    const f = fbm(n.x * freq + seed, n.y * freq - seed, n.z * freq + seed * 0.3, 4);
    const r = radius * (1 + amount * f);
    p.setXYZ(i, n.x * r * scale.x, n.y * r * scale.y, n.z * r * scale.z);
    if (col) {
      const t = smoothstep(-0.25, 0.35, fbm(n.x * 7 + seed, n.y * 7, n.z * 7 - seed, 3));
      c.copy(a).lerp(b, t);
      col.set([c.r, c.g, c.b], i * 3);
    }
  }
  if (col) g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** Evenly spread directions on a sphere. */
function fibonacci(n: number) {
  const out: V3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    out.push(v(Math.cos(ga * i) * r, y, Math.sin(ga * i) * r));
  }
  return out;
}

/** A wandering, smooth path inside an ellipsoid (for chromatin, ER tubes, bacterial DNA). */
function wander(rand: () => number, start: V3, steps: number, step: number, bounds: V3, avoid?: { c: V3; r: number }) {
  const pts = [start.clone()];
  const dir = v(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
  const p = start.clone();
  for (let i = 0; i < steps; i++) {
    dir.add(v(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.9)).normalize();
    // Turn back towards the middle when stuck at an edge.
    const next = p.clone().addScaledVector(dir, step);
    const e = (next.x / bounds.x) ** 2 + (next.y / bounds.y) ** 2 + (next.z / bounds.z) ** 2;
    if (e > 1 || (avoid && next.distanceTo(avoid.c) < avoid.r)) {
      dir.copy(p).multiplyScalar(-1).normalize();
      continue;
    }
    p.copy(next);
    pts.push(p.clone());
  }
  return pts;
}

/** Capsule profile for lathes: radius along the long axis. */
function capsuleProfile(len: number, rad: number, n = 36) {
  const pts: THREE.Vector2[] = [];
  const h = len / 2 + rad;
  for (let i = 0; i <= n; i++) {
    const y = -h + (2 * h * i) / n;
    const a = Math.abs(y) - len / 2;
    pts.push(new THREE.Vector2(a > 0 ? Math.sqrt(Math.max(0, rad * rad - a * a)) : rad, y));
  }
  pts[0].x = pts[n].x = 0.0001;
  return pts;
}

// ---- Cell division ----------------------------------------------------------------------------------

interface Chromatid {
  p: V3;
  d: V3;
}
interface Keyframe {
  c: Chromatid[];
  cond: number;
  tip: number;
  spindle: number;
  poles: V3[];
  nuclei: { c: V3; r: number; o: number }[];
  /** Membranes: A (whole cell, divides along x) and B, C (daughter cells of meiosis I, divide along y). */
  mem: { sep: number; vis: number }[];
}

/** Maternal red/orange, paternal blue/teal; pairs: long (0, 1) and short (2, 3). */
const CHROMOSOMES = [
  { color: "#d9434f", len: 0.95 },
  { color: "#3474d4", len: 0.95 },
  { color: "#f08a3c", len: 0.6 },
  { color: "#2fb3c9", len: 0.6 },
];

/** Two sister chromatids joined at the centromere, forming an X. */
function xShape(p: V3, d: V3, o: V3): Chromatid[] {
  const dn = d.clone().normalize();
  return [
    { p: p.clone().addScaledVector(o, 0.05), d: dn.clone().addScaledVector(o, 0.24).normalize() },
    { p: p.clone().addScaledVector(o, -0.05), d: dn.clone().addScaledVector(o, -0.24).normalize() },
  ];
}

const NONUCLEI = () => [0, 1, 2, 3].map(() => ({ c: v(0, 0, 0), r: 1, o: 0 }));

function interphase(rand: () => number): Keyframe {
  const c: Chromatid[] = [];
  for (let i = 0; i < 8; i++) c.push({ p: v(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.1), d: v(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize() });
  const nuclei = NONUCLEI();
  nuclei[0] = { c: v(0, 0, 0), r: 1.15, o: 1 };
  return { c, cond: 0, tip: 0, spindle: 0, poles: Array.from({ length: 8 }, () => v(0.1, 1.45, 0.35)), nuclei, mem: [{ sep: 0, vis: 1 }, { sep: 0, vis: 0 }, { sep: 0, vis: 0 }] };
}

function mitosisKeys(): Keyframe[] {
  const R = 2.4;
  const rand = rng(11);
  const ys = [1.47, 0.4, -0.45, -1.15];
  const zs = [0.3, -0.3, 0.3, -0.3];
  const K0 = interphase(rand);
  const pro = [v(-0.45, 0.4, 0.1), v(0.4, 0.35, -0.2), v(-0.3, -0.45, 0.2), v(0.45, -0.35, 0)];
  const poleS = (s: number, x: number, y = 0) => v(s === 0 ? x : -x, y, 0);
  const K1: Keyframe = {
    c: pro.flatMap((p, k) => xShape(p, v(Math.sin(k * 2.1), Math.cos(k * 1.3), 0.4), v(Math.cos(k), 0, Math.sin(k)))),
    cond: 1,
    tip: 0,
    spindle: 0.35,
    poles: Array.from({ length: 8 }, (_, i) => poleS(i % 2, 1.45, 0.95)),
    nuclei: [{ c: v(0, 0, 0), r: 1.15, o: 0.35 }, ...NONUCLEI().slice(1)],
    mem: [{ sep: 0, vis: 1 }, { sep: 0, vis: 0 }, { sep: 0, vis: 0 }],
  };
  const K2: Keyframe = {
    c: ys.flatMap((y, k) => xShape(v(0, y, zs[k]), v(0, 1, k % 2 ? 0.25 : -0.25), v(1, 0, 0))),
    cond: 1,
    tip: 0,
    spindle: 1,
    poles: Array.from({ length: 8 }, (_, i) => poleS(i % 2, 2.05)),
    nuclei: NONUCLEI(),
    mem: [{ sep: 0, vis: 1 }, { sep: 0, vis: 0 }, { sep: 0, vis: 0 }],
  };
  const K3: Keyframe = {
    c: ys.flatMap((y, k) => [0, 1].map((s) => ({ p: v(s ? -1.4 : 1.4, y * 0.6, zs[k] * 0.6), d: v(s ? -1 : 1, y * 0.15, 0).normalize() }))),
    cond: 1,
    tip: 0,
    spindle: 1,
    poles: Array.from({ length: 8 }, (_, i) => poleS(i % 2, 2.55)),
    nuclei: NONUCLEI(),
    mem: [{ sep: 0.7, vis: 1 }, { sep: 0, vis: 0 }, { sep: 0, vis: 0 }],
  };
  const tel = NONUCLEI();
  tel[0] = { c: v(-1.75, 0, 0), r: 0.85, o: 0.7 };
  tel[1] = { c: v(1.75, 0, 0), r: 0.85, o: 0.7 };
  const K4: Keyframe = {
    c: ys.flatMap((y, k) => [0, 1].map((s) => ({ p: v(s ? -1.75 : 1.75, y * 0.4, zs[k] * 0.4), d: v(Math.sin(k + s), Math.cos(k * 2), 0.5).normalize() }))),
    cond: 0.45,
    tip: 0,
    spindle: 0.15,
    poles: Array.from({ length: 8 }, (_, i) => poleS(i % 2, 2.55, 0.8)),
    nuclei: tel,
    mem: [{ sep: 1.75, vis: 1 }, { sep: 0, vis: 0 }, { sep: 0, vis: 0 }],
  };
  const done = NONUCLEI();
  done[0] = { c: v(-R, 0, 0), r: 1.0, o: 1 };
  done[1] = { c: v(R, 0, 0), r: 1.0, o: 1 };
  const K5: Keyframe = {
    c: K4.c.map((ch, i) => ({ p: v(i % 2 ? -R : R, ch.p.y * 0.5, ch.p.z * 0.5), d: ch.d.clone() })),
    cond: 0,
    tip: 0,
    spindle: 0,
    poles: Array.from({ length: 8 }, (_, i) => v(i % 2 ? -R : R, 1.4, 0.35)),
    nuclei: done,
    mem: [{ sep: R, vis: 1 }, { sep: 0, vis: 0 }, { sep: 0, vis: 0 }],
  };
  return [K0, K1, K2, K3, K4, K5];
}

function meiosisKeys(): Keyframe[] {
  const R = 2;
  const rand = rng(21);
  const M0 = interphase(rand);
  const memA = (sep: number) => [{ sep, vis: 1 }, { sep: 0, vis: 0 }, { sep: 0, vis: 0 }];
  const memBC = (sep: number) => [{ sep: R, vis: 0 }, { sep, vis: 1 }, { sep, vis: 1 }];
  // Prophase I: homologues side by side.
  const M1: Keyframe = {
    c: [
      ...xShape(v(-0.42, 0.35, 0), v(0.25, 1, 0.1), v(1, 0, 0)),
      ...xShape(v(-0.12, 0.35, 0.05), v(0.25, 1, 0.1), v(1, 0, 0)),
      ...xShape(v(0.25, -0.4, 0), v(-0.3, 1, 0.1), v(1, 0, 0)),
      ...xShape(v(0.52, -0.4, 0.05), v(-0.3, 1, 0.1), v(1, 0, 0)),
    ],
    cond: 1,
    tip: 1,
    spindle: 0.3,
    poles: Array.from({ length: 8 }, (_, i) => v(i < 2 || i > 5 ? 1.25 : -1.25, 0.85, 0)),
    nuclei: [{ c: v(0, 0, 0), r: 1.15, o: 0.35 }, ...NONUCLEI().slice(1)],
    mem: memA(0),
  };
  // Metaphase I: pairs on the equator; which homologue faces which pole is random.
  const side = [1, -1, -1, 1];
  const ys = [0.75, 0.75, -0.7, -0.7];
  const M2: Keyframe = {
    c: [0, 1, 2, 3].flatMap((k) => xShape(v(side[k] * 0.32, ys[k], k % 2 ? 0.15 : -0.15), v(0, 1, 0.2), v(1, 0, 0))),
    cond: 1,
    tip: 1,
    spindle: 1,
    poles: [0, 1, 2, 3].flatMap((k) => [v(side[k] * 1.75, 0, 0), v(side[k] * 1.75, 0, 0)]),
    nuclei: NONUCLEI(),
    mem: memA(0),
  };
  const M3: Keyframe = {
    c: [0, 1, 2, 3].flatMap((k) => xShape(v(side[k] * 1.25, ys[k] * 0.8, 0), v(side[k], 0.25, 0.3), v(0, 1, 0))),
    cond: 1,
    tip: 1,
    spindle: 1,
    poles: [0, 1, 2, 3].flatMap((k) => [v(side[k] * 2.3, 0, 0), v(side[k] * 2.3, 0, 0)]),
    nuclei: NONUCLEI(),
    mem: memA(0.6),
  };
  const tel1 = NONUCLEI();
  tel1[0] = { c: v(-R, 0, 0), r: 0.85, o: 0.35 };
  tel1[1] = { c: v(R, 0, 0), r: 0.85, o: 0.35 };
  const M4: Keyframe = {
    c: [0, 1, 2, 3].flatMap((k) => xShape(v(side[k] * R, ys[k] * 0.6, 0), v(0.3, 1, 0.3), v(1, 0, 0))),
    cond: 0.8,
    tip: 1,
    spindle: 0,
    poles: [0, 1, 2, 3].flatMap((k) => [v(side[k] * R, 1.3, 0), v(side[k] * R, 1.3, 0)]),
    nuclei: tel1,
    mem: memA(R),
  };
  // Meiosis II: in each cell the chromosomes line up across the cell and the sisters part along y.
  const cx = (k: number) => side[k] * R;
  const off = [0.8, -0.8, 0.8, -0.8];
  const M5: Keyframe = {
    c: [0, 1, 2, 3].flatMap((k) => xShape(v(cx(k) + off[k], 0, 0), v(1, 0, 0.25), v(0, 1, 0))),
    cond: 1,
    tip: 1,
    spindle: 1,
    poles: [0, 1, 2, 3].flatMap((k) => [v(cx(k), 1.6, 0), v(cx(k), -1.6, 0)]),
    nuclei: NONUCLEI(),
    mem: memBC(0),
  };
  const M6: Keyframe = {
    c: [0, 1, 2, 3].flatMap((k) => [0, 1].map((s) => ({ p: v(cx(k) + off[k] * 0.6, s ? -1.15 : 1.15, 0), d: v(0.15, s ? -1 : 1, 0.2).normalize() }))),
    cond: 1,
    tip: 1,
    spindle: 1,
    poles: [0, 1, 2, 3].flatMap((k) => [v(cx(k), 2.1, 0), v(cx(k), -2.1, 0)]),
    nuclei: NONUCLEI(),
    mem: memBC(0.6),
  };
  const four = [v(-R, R, 0), v(-R, -R, 0), v(R, R, 0), v(R, -R, 0)].map((c) => ({ c, r: 0.7, o: 1 }));
  const M7: Keyframe = {
    c: [0, 1, 2, 3].flatMap((k) => [0, 1].map((s) => ({ p: v(cx(k) + off[k] * 0.3, s ? -R : R, 0), d: v(0.3, s ? -1 : 1, 0.2).normalize() }))),
    cond: 0,
    tip: 1,
    spindle: 0,
    poles: [0, 1, 2, 3].flatMap((k) => [v(cx(k), R + 0.9, 0.3), v(cx(k), -R + 0.9, 0.3)]),
    nuclei: four,
    mem: memBC(R),
  };
  return [M0, M1, M2, M3, M4, M5, M6, M7];
}

/** Crossing over in meiosis: non-sister chromatids swap their tips (index → colour of the partner). */
const CROSSOVER_TIPS: Record<number, string> = { 1: CHROMOSOMES[1].color, 2: CHROMOSOMES[0].color, 5: CHROMOSOMES[3].color, 6: CHROMOSOMES[2].color };

// -----------------------------------------------------------------------------------------------------

export class CellScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.05, 300);
  private controls: OrbitControls;
  private content = new THREE.Group();
  private labels: Label[] = [];
  private frame = 0;
  private clock = new THREE.Clock();
  private tickers: ((t: number, dt: number) => void)[] = [];
  private disposables: { dispose(): void }[] = [];
  private disposed = false;
  private observer: ResizeObserver;
  private reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private env: THREE.WebGLRenderTarget;
  private view: CellView | null = null;

  // Organelle picking
  private picking = false;
  private organelleMats = new Map<OrganelleId, THREE.MeshStandardMaterial[]>();
  private organelleAnchors = new Map<OrganelleId, THREE.Object3D>();
  private selected: OrganelleId | null = null;
  private labelsOn = true;
  private down: { x: number; y: number } | null = null;
  private ray = new THREE.Raycaster();

  // Division
  private divTime = 0;
  private playing = true;
  private phase = -1;
  private phaseCount = 0;

  private sphere = new THREE.IcosahedronGeometry(1, 2);
  private sphereLow = new THREE.IcosahedronGeometry(1, 1);
  private cylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
  private shared = new Set<THREE.BufferGeometry>([this.sphere, this.sphereLow, this.cylinder]);

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    private callbacks: Callbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.localClippingEnabled = true;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.env.texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight("#ffffff", 1.4);
    key.position.set(5, 8, 7);
    const fill = new THREE.DirectionalLight("#f3ecff", 0.6);
    fill.position.set(-6, -2, 4);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#d9e2df", 0.75), key, fill, this.content);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.autoRotateSpeed = 0.6;
    this.ray.params.Line = { threshold: 0.06 };

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  // ---- Views ----------------------------------------------------------------------------------------

  setView(view: CellView) {
    if (view === this.view) return;
    this.view = view;
    this.clear();
    const builders: Record<CellView, () => { distance: number; dir?: V3; target?: V3; rotate?: boolean; width?: number }> = {
      cells: () => this.buildCells(),
      membrane: () => this.buildMembrane(),
      animal: () => {
        this.picking = true;
        this.animalCell(v(0, 0, 0), 1, true);
        return { distance: 13.5, dir: v(0.45, 0.45, 0.77) };
      },
      nucleus: () => this.buildNucleus(),
      energy: () => this.buildEnergy(),
      plant: () => {
        this.picking = true;
        this.plantCell(v(0, 0, 0), 1, true);
        return { distance: 15 };
      },
      bacterium: () => this.buildBacterium(),
      mitosis: () => this.buildDivision(mitosisKeys(), MITOSIS_PHASES.length),
      meiosis: () => this.buildDivision(meiosisKeys(), MEIOSIS_PHASES.length),
    };
    const built = builders[view]();
    const dir = (built.dir ?? v(0.62, 0.42, 0.66)).normalize();
    let distance = built.distance * Math.max(1, 1.35 / this.camera.aspect);
    if (built.width) {
      // Wide scenes: step back until the whole width fits the screen.
      const h = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect);
      distance = Math.max(distance, (built.width / 2 / Math.tan(h)) * 1.05);
    }
    const target = built.target ?? v(0, 0, 0);
    this.camera.position.copy(target).addScaledVector(dir, distance);
    this.controls.target.copy(target);
    this.controls.minDistance = distance * 0.35;
    this.controls.maxDistance = distance * 1.8;
    this.controls.autoRotate = !!built.rotate && !this.reduceMotion;
    this.controls.update();
    this.applyLabels();
    this.applySelection();
  }

  /** Highlight an organelle (null = none). */
  select(id: OrganelleId | null) {
    this.selected = id;
    this.applySelection();
  }

  setLabels(on: boolean) {
    this.labelsOn = on;
    this.applyLabels();
  }

  setPlaying(on: boolean) {
    this.playing = on;
  }

  /** Jump to a phase of the division animation (its process into that phase, or its end when paused). */
  jumpToPhase(i: number) {
    this.divTime = i * SEG + (this.playing || i === 0 ? 0 : TRANSITION);
  }

  // ---- Helpers --------------------------------------------------------------------------------------

  private material(params: THREE.MeshPhysicalMaterialParameters, id?: OrganelleId) {
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.45, clearcoat: 0.25, clearcoatRoughness: 0.4, ...params });
    this.disposables.push(m);
    if (id) {
      const list = this.organelleMats.get(id) ?? [];
      list.push(m);
      this.organelleMats.set(id, list);
    }
    return m;
  }

  /** Material for a cut-open shell (clipped at the cell's cut). */
  private shell(color: string, cut: V3, id?: OrganelleId, extra: THREE.MeshPhysicalMaterialParameters = {}) {
    return this.material({ color, side: THREE.DoubleSide, clippingPlanes: cutAt(cut), clipIntersection: true, ...extra }, id);
  }

  private mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, cut?: V3) {
    const mesh = new THREE.Mesh(g, m);
    if (cut) mesh.userData.cut = cut;
    parent.add(mesh);
    return mesh;
  }

  /** A group for one kind of organelle; picking finds it through userData. */
  private organelle(parent: THREE.Object3D, id: OrganelleId) {
    const g = new THREE.Group();
    g.userData.organelle = id;
    parent.add(g);
    return g;
  }

  private anchor(parent: THREE.Object3D, p: V3) {
    const o = new THREE.Object3D();
    o.position.copy(p);
    parent.add(o);
    return o;
  }

  private label(target: THREE.Object3D, text: string, kind: "label" | "tag" = "label", organelle?: OrganelleId, offset = v(0, 0, 0)) {
    const el = document.createElement("div");
    if (kind === "tag") {
      el.className = "dna-tag";
      el.textContent = text;
    } else {
      el.className = "blood-label";
      el.innerHTML = `<span class="blood-label-dot"></span><span class="blood-label-text"></span>`;
      (el.lastChild as HTMLElement).textContent = text;
    }
    this.overlay.appendChild(el);
    this.labels.push({ target, offset, el, organelle });
  }

  /** Register where an organelle's label goes (only in the picking views). */
  private organelleLabel(id: OrganelleId, parent: THREE.Object3D, p: V3, register: boolean) {
    if (!register) return;
    const a = this.anchor(parent, p);
    this.organelleAnchors.set(id, a);
    this.label(a, ORGANELLES[id].name, "label", id);
  }

  private instanced(geo: THREE.BufferGeometry, mat: THREE.Material, matrices: THREE.Matrix4[], parent: THREE.Object3D) {
    const im = new THREE.InstancedMesh(geo, mat, matrices.length);
    matrices.forEach((m, i) => im.setMatrixAt(i, m));
    parent.add(im);
    return im;
  }

  private clear() {
    for (const l of this.labels) l.el.remove();
    this.labels = [];
    this.tickers = [];
    this.content.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && !this.shared.has(mesh.geometry)) mesh.geometry.dispose();
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    });
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.content.clear();
    this.organelleMats.clear();
    this.organelleAnchors.clear();
    this.picking = false;
    this.phase = -1;
  }

  private applyLabels() {
    for (const l of this.labels) if (l.organelle) l.el.dataset.hidden = !this.labelsOn && l.organelle !== this.selected ? "1" : "";
  }

  private applySelection() {
    for (const [id, mats] of this.organelleMats) {
      const on = id === this.selected;
      for (const m of mats) {
        m.emissive.set(on ? ORGANELLES[id].color : "#000000");
        m.emissiveIntensity = on ? 0.35 : 0;
      }
    }
    for (const l of this.labels) if (l.organelle) l.el.classList.toggle("cell-label-active", l.organelle === this.selected);
    this.applyLabels();
  }

  // ---- Organelles -----------------------------------------------------------------------------------

  /** Mitochondrion: a capsule; `half` cuts it open lengthwise to show the cristae (open side towards +z). */
  private mitochondrion(parent: THREE.Object3D, len: number, rad: number, half: boolean, mats: { outer: THREE.Material; inner: THREE.Material; matrix: THREE.Material; cristae: THREE.Material }) {
    const g = new THREE.Group();
    const phi: [number, number] = half ? [Math.PI / 2, Math.PI] : [0, Math.PI * 2];
    const outer = new THREE.LatheGeometry(capsuleProfile(len, rad), 40, ...phi);
    this.mesh(outer, mats.outer, g);
    const rIn = rad * 0.88;
    if (half) {
      this.mesh(new THREE.LatheGeometry(capsuleProfile(len, rIn), 40, ...phi), mats.inner, g);
      this.mesh(new THREE.LatheGeometry(capsuleProfile(len, rIn * 0.97), 40, ...phi), mats.matrix, g);
    }
    // Cristae: shelves alternately from each side, reaching past the middle.
    const n = Math.max(3, Math.round(len / (rad * 0.42)));
    for (let i = 0; i < n; i++) {
      const y = -len / 2 + ((i + 0.5) * len) / n;
      const left = i % 2 === 0;
      const start = half ? (left ? Math.PI / 2 : Math.PI) : left ? 0 : Math.PI;
      const length = half ? Math.PI / 2 : Math.PI;
      const shelf = new THREE.CylinderGeometry(rIn * 0.96, rIn * 0.96, rad * (half ? 0.16 : 0.09), 20, 1, false, start, length);
      const m = this.mesh(shelf, mats.cristae, g);
      m.position.y = y;
    }
    parent.add(g);
    return g;
  }

  /** Chloroplast: a lens; grana (stacks of thylakoid discs) collected into `discs` for one instanced mesh. */
  private chloroplast(parent: THREE.Object3D, len: number, rad: number, half: boolean, mats: { outer: THREE.Material; inner: THREE.Material; stroma: THREE.Material; lamella: THREE.Material }, discs: THREE.Matrix4[], world: THREE.Matrix4) {
    const g = new THREE.Group();
    const phi: [number, number] = half ? [Math.PI / 2, Math.PI] : [0, Math.PI * 2];
    const lens = (r: number) =>
      Array.from({ length: 33 }, (_, i) => {
        const y = -len / 2 + (len * i) / 32;
        return new THREE.Vector2(Math.max(0.0001, r * Math.pow(Math.max(0, 1 - (2 * y / len) ** 2), 0.55)), y);
      });
    this.mesh(new THREE.LatheGeometry(lens(rad), 40, ...phi), mats.outer, g);
    if (half) {
      this.mesh(new THREE.LatheGeometry(lens(rad * 0.93), 40, ...phi), mats.inner, g);
      this.mesh(new THREE.LatheGeometry(lens(rad * 0.9), 40, ...phi), mats.stroma, g);
    }
    // Grana along the long axis; each a column of discs across the lens (stack axis = local x).
    const n = Math.max(2, Math.round(len / (rad * 0.62)));
    const discR = rad * 0.27;
    const stack = half ? 8 : 6;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), Math.PI / 2);
    for (let i = 0; i < n; i++) {
      const y = -len / 2 + ((i + 0.5) * len) / n;
      const room = rad * Math.pow(Math.max(0, 1 - (2 * y / len) ** 2), 0.55) * 0.8;
      for (let k = 0; k < stack; k++) {
        const x = -room + ((k + 0.5) * 2 * room) / stack;
        m.compose(v(x, y, half ? -discR * 1.1 : 0), q, v(discR, rad * 0.045, discR));
        discs.push(world.clone().multiply(g.matrix.clone()).multiply(m.clone()));
      }
    }
    // Stroma lamellae connecting the grana.
    for (const x of [-rad * 0.35, rad * 0.35]) {
      const lam = this.mesh(new THREE.BoxGeometry(rad * 0.04, len * 0.78, rad * 0.22), mats.lamella, g);
      lam.position.set(x, 0, half ? -discR * 1.1 : 0);
    }
    parent.add(g);
    return g;
  }

  private golgi(parent: THREE.Object3D, mat: THREE.Material, vesicleMat: THREE.Material, scale = 1) {
    const g = new THREE.Group();
    const radii = [0.8, 0.74, 0.66, 0.56, 0.46];
    radii.forEach((r, i) => {
      const geo = new THREE.CylinderGeometry(r, r, 0.07, 36, 1);
      const p = geo.attributes.position;
      // Bend into a shallow bowl and stretch into a flattened sac.
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k);
        const z = p.getZ(k) * 0.5;
        p.setXYZ(k, x, p.getY(k) + 0.35 * (x * x) - 0.05, z);
      }
      geo.computeVertexNormals();
      const m = this.mesh(geo, mat, g);
      m.position.y = i * 0.15;
    });
    const rand = rng(5);
    const ves: THREE.Matrix4[] = [];
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      ves.push(new THREE.Matrix4().compose(v(side * (0.85 + rand() * 0.4), 0.2 + rand() * 0.6, (rand() - 0.5) * 0.5), new THREE.Quaternion(), v(1, 1, 1).multiplyScalar(0.07 + rand() * 0.05)));
    }
    this.instanced(this.sphereLow, vesicleMat, ves, g);
    g.scale.setScalar(scale);
    parent.add(g);
    return g;
  }

  /** Curved sheets of rough ER around a nucleus, studded with ribosomes. */
  private roughER(parent: THREE.Object3D, centre: V3, r0: number, dir: V3, spread: number, mat: THREE.Material, riboMat: THREE.Material, layers = 3) {
    const d = dir.clone().normalize();
    const theta0 = Math.acos(d.y);
    const phi0 = Math.atan2(d.z, -d.x);
    const ribo: THREE.Matrix4[] = [];
    const rand = rng(Math.round(r0 * 100));
    for (let l = 0; l < layers; l++) {
      const r = r0 + l * 0.17 * (r0 / 1.2);
      const geo = new THREE.SphereGeometry(r, 40, 20, phi0 - spread, spread * 2, theta0 - spread * 0.6, spread * 1.2);
      const p = geo.attributes.position;
      const n = v(0, 0, 0);
      for (let k = 0; k < p.count; k++) {
        n.fromBufferAttribute(p, k);
        const s = 1 + 0.035 * Math.sin(n.x * 6 + l) * Math.cos(n.z * 5 - l);
        p.setXYZ(k, n.x * s, n.y * s, n.z * s);
        if (rand() < 0.5) ribo.push(new THREE.Matrix4().compose(n.clone().multiplyScalar(s * (1 + (rand() < 0.5 ? 0.025 : -0.025))).add(centre), new THREE.Quaternion(), v(0.028, 0.028, 0.028)));
      }
      geo.computeVertexNormals();
      const m = this.mesh(geo, mat, parent);
      m.position.copy(centre);
    }
    this.instanced(this.sphereLow, riboMat, ribo, parent);
  }

  private nucleusParts(parent: THREE.Object3D, centre: V3, r: number, cut: V3, register: boolean, pores: number) {
    const nuc = this.organelle(parent, "nucleus");
    const env = this.mesh(blob(r, 0.03, 2, 4), this.shell("#9b7cc4", cut, "nucleus"), nuc, cut);
    env.position.copy(centre);
    const inner = this.mesh(blob(r * 0.95, 0.03, 2, 4), this.shell("#c3b0e0", cut, "nucleus"), nuc, cut);
    inner.position.copy(centre);
    const plasm = this.mesh(blob(r * 0.92, 0.03, 2, 5, v(1, 1, 1), ["#d9cbee", "#7d5ba6"], 2.2), this.shell("#ffffff", cut, "nucleus", { vertexColors: true, side: THREE.BackSide }), nuc, cut);
    plasm.position.copy(centre);
    // Pores (not in the removed quarter).
    const torus = new THREE.TorusGeometry(r * 0.06, r * 0.022, 8, 16);
    const pm: THREE.Matrix4[] = [];
    for (const d of fibonacci(pores)) {
      if (d.x > 0.05 && d.z > 0.05) continue;
      pm.push(new THREE.Matrix4().compose(d.clone().multiplyScalar(r * 1.005).add(centre), new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), d), v(1, 1, 1)));
    }
    this.instanced(torus, this.material({ color: "#5e3f87" }, "nucleus"), pm, nuc);
    const nl = this.organelle(parent, "nucleolus");
    const nucleolus = this.mesh(blob(r * 0.32, 0.18, 7, 3, v(1, 1, 1), ["#4a3470", "#2a1d44"], 3), this.material({ color: "#ffffff", vertexColors: true, roughness: 0.7 }, "nucleolus"), nl);
    nucleolus.position.copy(centre).add(v(-r * 0.12, r * 0.12, -r * 0.1));
    this.organelleLabel("nucleus", nuc, centre.clone().add(v(-0.35, 0.85, 0.4).normalize().multiplyScalar(r)), register);
    this.organelleLabel("nucleolus", nl, nucleolus.position.clone(), register);
    return { nuc, nucleolus, porePositions: pm };
  }

  // ---- Animal cell ----------------------------------------------------------------------------------

  private animalCell(at: V3, s: number, register: boolean) {
    const cell = new THREE.Group();
    cell.position.copy(at);
    cell.scale.setScalar(s);
    this.content.add(cell);
    cell.updateMatrixWorld();
    const cut = at.clone();
    const rand = rng(3);

    const mem = this.organelle(cell, "membrane");
    this.mesh(blob(3, 0.025, 1, 5), this.shell("#e9a3b1", cut, "membrane", { sheen: 0.6, sheenColor: new THREE.Color("#ffd9e1") }), mem, cut);
    this.organelleLabel("membrane", mem, v(2.12, 2.1, 0.02), register);
    const cyto = this.organelle(cell, "cytoplasm");
    this.mesh(blob(2.92, 0.025, 1, 5), this.shell("#f6ead2", cut, "cytoplasm", { side: THREE.BackSide, clearcoat: 0 }), cyto, cut);
    this.organelleLabel("cytoplasm", cyto, v(-1.2, -1.9, -1.4), register);

    const N = v(-0.5, 0.25, -0.55);
    const nucleusCut = at.clone().add(N.clone().multiplyScalar(s));
    this.nucleusParts(cell, N, 1.15, nucleusCut, register, 90);

    const rer = this.organelle(cell, "rer");
    this.roughER(rer, N, 1.36, v(0.75, 0.15, -0.65), 0.75, this.material({ color: "#5aa0d6", side: THREE.DoubleSide }, "rer"), this.material({ color: "#22305a" }, "rer"));
    this.organelleLabel("rer", rer, N.clone().add(v(0.75, 0.15, -0.65).normalize().multiplyScalar(1.7)), register);

    const ser = this.organelle(cell, "ser");
    const serMat = this.material({ color: "#8cc7e8" }, "ser");
    for (let i = 0; i < 6; i++) {
      const pts = wander(rand, v(1.1 + rand() * 0.4, -0.9 + rand() * 0.4, -1.4 + rand() * 0.4), 14, 0.22, v(2.6, 2.6, 2.6), { c: N, r: 1.4 });
      if (pts.length > 3) this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.055, 8), serMat, ser);
    }
    this.organelleLabel("ser", ser, v(1.5, -1.1, -1.4), register);

    const gol = this.organelle(cell, "golgi");
    const golgi = this.golgi(gol, this.material({ color: "#e7a33e" }, "golgi"), this.material({ color: "#f2c46d" }, "golgi"), 0.9);
    golgi.position.set(1.0, 1.05, -0.2);
    golgi.rotation.set(0.5, -0.6, -0.35);
    this.organelleLabel("golgi", gol, v(1.0, 1.55, -0.2), register);

    const mito = this.organelle(cell, "mitochondrion");
    const mitoMats = {
      outer: this.material({ color: "#f08a5d", transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }, "mitochondrion"),
      inner: this.material({ color: "#e0663f" }, "mitochondrion"),
      matrix: this.material({ color: "#f9d9b5" }, "mitochondrion"),
      cristae: this.material({ color: "#c94e2b", side: THREE.DoubleSide }, "mitochondrion"),
    };
    const mitoAt = [v(1.6, -1.0, 0.9), v(-1.5, -1.3, 0.9), v(0.4, -1.75, -1.2), v(-0.9, 1.55, 1.0), v(1.9, 0.3, -1.3), v(0.3, 0.2, 1.7)];
    mitoAt.forEach((p, i) => {
      const m = this.mitochondrion(mito, 0.75, 0.28, false, mitoMats);
      m.position.copy(p);
      m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      if (i === 0) this.organelleLabel("mitochondrion", mito, p, register);
    });

    const lyso = this.organelle(cell, "lysosome");
    const lysoMat = this.material({ color: "#7bb661", roughness: 0.6 }, "lysosome");
    [v(-1.9, 0.4, 1.2), v(1.5, -0.2, 1.3), v(-0.4, -0.9, 2.0), v(2.1, 1.0, 0.6)].forEach((p, i) => {
      const m = this.mesh(blob(0.2, 0.12, i + 10, 2, v(1, 1, 1), ["#9bd07f", "#4f8a3a"], 4), this.material({ color: "#ffffff", vertexColors: true, roughness: 0.6 }, "lysosome"), lyso);
      m.position.copy(p);
      if (i === 0) this.organelleLabel("lysosome", lyso, p, register);
    });
    void lysoMat;

    const cen = this.organelle(cell, "centriole");
    const cenMat = this.material({ color: "#c45ab3" }, "centriole");
    const tubes: THREE.Matrix4[] = [];
    const C = v(0.35, 1.65, 0.6);
    for (const [k, rot] of [
      [0, new THREE.Quaternion()],
      [1, new THREE.Quaternion().setFromAxisAngle(v(1, 0, 0), Math.PI / 2)],
    ] as const) {
      for (let t = 0; t < 9; t++)
        for (let j = 0; j < 3; j++) {
          const a = (t / 9) * Math.PI * 2 + j * 0.13;
          const rr = 0.1 + j * 0.022;
          const local = v(Math.cos(a) * rr, 0, Math.sin(a) * rr).applyQuaternion(rot);
          tubes.push(new THREE.Matrix4().compose(local.add(C).add(v(k * 0.32, 0, 0)), rot, v(0.016, 0.36, 0.016)));
        }
    }
    this.instanced(this.cylinder, cenMat, tubes, cen);
    this.organelleLabel("centriole", cen, C.clone().add(v(0.16, 0.15, 0)), register);

    const sk = this.organelle(cell, "cytoskeleton");
    const lines: number[] = [];
    for (let i = 0; i < 34; i++) {
      const d = v(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize();
      const a = N.clone().addScaledVector(d, 1.25);
      const b = d.clone().multiplyScalar(2.8);
      const mid = a.clone().lerp(b, 0.5).add(v(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.5));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b).getPoints(10);
      for (let k = 0; k < curve.length - 1; k++) lines.push(...curve[k].toArray(), ...curve[k + 1].toArray());
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
    const skMat = new THREE.LineBasicMaterial({ color: "#8f9cb0", transparent: true, opacity: 0.55, clippingPlanes: cutAt(cut), clipIntersection: true });
    this.disposables.push(skMat);
    const ls = new THREE.LineSegments(lg, skMat);
    ls.userData.cut = cut;
    sk.add(ls);
    this.organelleLabel("cytoskeleton", sk, v(-2.1, 0.9, -1.2), register);

    const ribo = this.organelle(cell, "ribosome");
    const rm: THREE.Matrix4[] = [];
    while (rm.length < 380) {
      const p = v(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(5.4);
      if (p.length() > 2.7 || p.distanceTo(N) < 1.5) continue;
      rm.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), v(0.032, 0.032, 0.032)));
    }
    this.instanced(this.sphereLow, this.material({ color: "#2b3a67" }, "ribosome"), rm, ribo);
    this.organelleLabel("ribosome", ribo, rm[7] ? new THREE.Vector3().setFromMatrixPosition(rm[7]) : v(0, 0, 0), register);

    // Organelles drift a little: the cytoplasm is never still.
    const drifting = [...mito.children, ...lyso.children];
    const base = drifting.map((o) => o.position.clone());
    this.tickers.push((t) => {
      drifting.forEach((o, i) => {
        o.position.copy(base[i]).add(v(Math.sin(t * 0.5 + i), Math.cos(t * 0.4 + i * 1.7), Math.sin(t * 0.3 + i * 2.3)).multiplyScalar(0.04));
      });
    });
    return cell;
  }

  // ---- Plant cell -----------------------------------------------------------------------------------

  private plantCell(at: V3, s: number, register: boolean) {
    const cell = new THREE.Group();
    cell.position.copy(at);
    cell.scale.setScalar(s);
    this.content.add(cell);
    cell.updateMatrixWorld();
    const cut = at.clone();
    const rand = rng(8);

    const wall = this.organelle(cell, "wall");
    this.mesh(new RoundedBoxGeometry(6.6, 4.6, 4.6, 6, 0.7), this.shell("#8fb96a", cut, "wall", { roughness: 0.75, clearcoat: 0 }), wall, cut);
    this.mesh(new RoundedBoxGeometry(6.3, 4.3, 4.3, 6, 0.6), this.shell("#b9d58f", cut, "wall", { roughness: 0.8, clearcoat: 0, side: THREE.BackSide }), wall, cut);
    this.organelleLabel("wall", wall, v(3.0, 2.2, 0.02), register);
    const mem = this.organelle(cell, "membrane");
    this.mesh(new RoundedBoxGeometry(6.1, 4.1, 4.1, 6, 0.55), this.shell("#e9a3b1", cut, "membrane"), mem, cut);
    this.organelleLabel("membrane", mem, v(2.75, -1.95, 0.02), register);
    const cyto = this.organelle(cell, "cytoplasm");
    this.mesh(new RoundedBoxGeometry(6.0, 4.0, 4.0, 6, 0.55), this.shell("#f3ecd2", cut, "cytoplasm", { side: THREE.BackSide, clearcoat: 0 }), cyto, cut);
    this.organelleLabel("cytoplasm", cyto, v(-2.6, -1.85, -1.6), register);

    const vac = this.organelle(cell, "vacuole");
    this.mesh(blob(1, 0.05, 4, 4, v(2.25, 1.35, 1.35)), this.shell("#a9d4ef", cut, "vacuole", { transparent: true, opacity: 0.6, depthWrite: false, transmission: 0 }), vac, cut).position.set(0.35, -0.05, -0.05);
    this.organelleLabel("vacuole", vac, v(-0.6, 0.6, -0.4), register);

    const N = v(-2.05, 0.95, -1.05);
    this.nucleusParts(cell, N, 0.85, at.clone().add(N.clone().multiplyScalar(s)), register, 60);
    const rer = this.organelle(cell, "rer");
    this.roughER(rer, N, 1.02, v(0.7, -0.6, 0.2), 0.6, this.material({ color: "#5aa0d6", side: THREE.DoubleSide }, "rer"), this.material({ color: "#22305a" }, "rer"), 2);
    this.organelleLabel("rer", rer, N.clone().add(v(0.7, -0.6, 0.2).normalize().multiplyScalar(1.15)), register);

    // Chloroplasts along the walls.
    const chl = this.organelle(cell, "chloroplast");
    const chlMats = {
      outer: this.material({ color: "#6cbf63", transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }, "chloroplast"),
      inner: this.material({ color: "#4fa34a" }, "chloroplast"),
      stroma: this.material({ color: "#cfe8b8" }, "chloroplast"),
      lamella: this.material({ color: "#3f9b4a" }, "chloroplast"),
    };
    const discs: THREE.Matrix4[] = [];
    const spots = [
      [v(-0.6, 1.62, -1.2), v(0, 1, 0)],
      [v(0.9, 1.62, -0.6), v(0, 1, 0)],
      [v(2.1, 1.62, 0.6), v(0, 1, 0)],
      [v(0.2, -1.62, 1.1), v(0, -1, 0)],
      [v(-1.5, -1.62, -0.8), v(0, -1, 0)],
      [v(1.6, -1.62, -1.1), v(0, -1, 0)],
      [v(-0.9, 0.4, -1.62), v(0, 0, -1)],
      [v(1.4, 0.6, -1.62), v(0, 0, -1)],
      [v(0.3, -0.8, -1.62), v(0, 0, -1)],
      [v(-2.62, -0.6, 0.6), v(-1, 0, 0)],
      [v(-2.62, -0.4, -0.9), v(-1, 0, 0)],
      [v(-1.3, 1.62, 1.3), v(0, 1, 0)],
      [v(-1.0, -1.62, 1.5), v(0, -1, 0)],
    ] as const;
    const anchorChl = spots[1][0];
    for (const [p, n] of spots) {
      const holder = new THREE.Group();
      holder.position.copy(p);
      // Lie flat against the wall: lens axis (local y) along the wall, flat side facing the wall.
      holder.quaternion.setFromUnitVectors(v(0, 0, 1), n.clone()).multiply(new THREE.Quaternion().setFromAxisAngle(v(0, 0, 1), rand() * Math.PI));
      chl.add(holder);
      holder.updateMatrixWorld();
      const inner = new THREE.Group();
      inner.scale.set(1, 1, 0.55);
      holder.add(inner);
      inner.updateMatrixWorld();
      const local = cell.matrixWorld.clone().invert().multiply(inner.matrixWorld);
      this.chloroplast(inner, 1.05, 0.42, false, chlMats, discs, local);
    }
    this.instanced(new THREE.CylinderGeometry(1, 1, 1, 14), this.material({ color: "#2f7d3a" }, "chloroplast"), discs, chl);
    this.organelleLabel("chloroplast", chl, anchorChl.clone().add(v(0, 0.25, 0)), register);

    const mito = this.organelle(cell, "mitochondrion");
    const mitoMats = {
      outer: this.material({ color: "#f08a5d", transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }, "mitochondrion"),
      inner: this.material({ color: "#e0663f" }, "mitochondrion"),
      matrix: this.material({ color: "#f9d9b5" }, "mitochondrion"),
      cristae: this.material({ color: "#c94e2b", side: THREE.DoubleSide }, "mitochondrion"),
    };
    [v(2.4, -0.8, -1.3), v(-2.3, -1.2, -0.9), v(1.2, 1.5, 1.4)].forEach((p, i) => {
      const m = this.mitochondrion(mito, 0.55, 0.22, false, mitoMats);
      m.position.copy(p);
      m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      if (i === 0) this.organelleLabel("mitochondrion", mito, p, register);
    });

    const gol = this.organelle(cell, "golgi");
    const golgi = this.golgi(gol, this.material({ color: "#e7a33e" }, "golgi"), this.material({ color: "#f2c46d" }, "golgi"), 0.6);
    golgi.position.set(2.25, 0.9, -1.2);
    golgi.rotation.set(0.4, -0.5, 0.2);
    this.organelleLabel("golgi", gol, v(2.25, 1.25, -1.2), register);

    const ribo = this.organelle(cell, "ribosome");
    const rm: THREE.Matrix4[] = [];
    while (rm.length < 160) {
      const p = v((rand() - 0.5) * 5.6, (rand() - 0.5) * 3.6, (rand() - 0.5) * 3.6);
      const e = ((p.x - 0.35) / 2.35) ** 2 + (p.y / 1.45) ** 2 + (p.z / 1.45) ** 2;
      if (e < 1.1 || p.distanceTo(N) < 1.1) continue;
      rm.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), v(0.03, 0.03, 0.03)));
    }
    this.instanced(this.sphereLow, this.material({ color: "#2b3a67" }, "ribosome"), rm, ribo);
    this.organelleLabel("ribosome", ribo, new THREE.Vector3().setFromMatrixPosition(rm[3]), register);
    return cell;
  }

  // ---- Bacterium ------------------------------------------------------------------------------------

  private bacterium(at: V3, s: number, labels: boolean) {
    const cell = new THREE.Group();
    cell.position.copy(at);
    cell.scale.setScalar(s);
    this.content.add(cell);
    const cut = at.clone();
    const rand = rng(17);
    const L = 3.4;
    const caps = (r: number) => new THREE.CapsuleGeometry(r, L, 10, 40).rotateZ(Math.PI / 2);
    this.mesh(caps(1.25), this.shell("#dfe9b8", cut, undefined, { transparent: true, opacity: 0.35, depthWrite: false }), cell, cut);
    this.mesh(caps(1.1), this.shell("#b98f58", cut, undefined, { roughness: 0.7 }), cell, cut);
    this.mesh(caps(1.02), this.shell("#e9a3b1", cut), cell, cut);
    this.mesh(caps(0.99), this.shell("#f4ecd6", cut, undefined, { side: THREE.BackSide, clearcoat: 0 }), cell, cut);

    // Nucleoid: one long, tangled loop of DNA in the middle.
    const dna = wander(rand, v(0, 0, 0), 260, 0.09, v(1.25, 0.55, 0.55));
    const dnaMesh = this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(dna, true), 900, 0.022, 6, true), this.material({ color: "#7d5ba6" }), cell);
    const plasmidMat = this.material({ color: "#c45ab3" });
    const plasmids = [v(1.75, 0.35, -0.3), v(-1.8, -0.35, 0.2), v(1.3, -0.55, 0.4)].map((p, i) => {
      const m = this.mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 40), plasmidMat, cell);
      m.position.copy(p);
      m.rotation.set(i, i * 2, 0.5);
      return m;
    });
    const rm: THREE.Matrix4[] = [];
    while (rm.length < 260) {
      const p = v((rand() - 0.5) * 5.2, (rand() - 0.5) * 1.8, (rand() - 0.5) * 1.8);
      const ax = Math.max(0, Math.abs(p.x) - L / 2);
      if (Math.hypot(ax, p.y, p.z) > 0.9) continue;
      rm.push(new THREE.Matrix4().compose(p, new THREE.Quaternion(), v(0.035, 0.035, 0.035)));
    }
    const ribo = this.instanced(this.sphereLow, this.material({ color: "#2b3a67" }), rm, cell);

    // Flagellum: a long helix that spins.
    const helix = Array.from({ length: 120 }, (_, i) => {
      const t = i / 119;
      return v(-L / 2 - 1.0 - t * 4.5, 0.32 * Math.sin(t * 22) * Math.min(1, t * 4), 0.32 * Math.cos(t * 22) * Math.min(1, t * 4) - 0.32 * (1 - Math.min(1, t * 4)));
    });
    helix.unshift(v(-L / 2 - 0.95, 0, 0));
    const flag = new THREE.Group();
    this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 300, 0.045, 8), this.material({ color: "#a07850" }), flag);
    cell.add(flag);
    this.tickers.push((t) => {
      flag.rotation.x = t * 6;
    });
    // Pili: fine hairs on the surface (not on the removed quarter).
    const pili: THREE.Matrix4[] = [];
    for (let i = 0; i < 70; i++) {
      const x = (rand() - 0.5) * L;
      const a = rand() * Math.PI * 2;
      const n = v(0, Math.cos(a), Math.sin(a));
      const base = v(x, 0, 0).addScaledVector(n, 1.24);
      if (isCut(base.clone().multiplyScalar(s).add(at), cut)) continue;
      const len = 0.35 + rand() * 0.3;
      pili.push(new THREE.Matrix4().compose(base.addScaledVector(n, len / 2), new THREE.Quaternion().setFromUnitVectors(Y, n), v(0.012, len, 0.012)));
    }
    this.instanced(this.cylinder, this.material({ color: "#c7a777" }), pili, cell);

    if (labels) {
      this.label(this.anchor(cell, v(1.0, 1.15, -0.55)), "კაფსულა");
      this.label(this.anchor(cell, v(2.1, 0.75, 0.02)), "უჯრედის კედელი");
      this.label(this.anchor(cell, v(2.5, -0.55, 0.02)), "პლაზმური მემბრანა");
      this.label(this.anchor(cell, dna[Math.floor(dna.length / 3)]), "ნუკლეოიდი (დნმ)");
      this.label(this.anchor(cell, plasmids[0].position), "პლაზმიდა");
      this.label(this.anchor(cell, new THREE.Vector3().setFromMatrixPosition(rm[11])), "რიბოსომები");
      this.label(this.anchor(cell, helix[70]), "შოლტი (ფლაგელუმი)");
      this.label(this.anchor(cell, v(-0.6, 1.5, -0.3)), "პილები");
    }
    void dnaMesh;
    void ribo;
    return cell;
  }

  // ---- Views ----------------------------------------------------------------------------------------

  private buildCells() {
    const b = this.bacterium(v(-8.4, 0, 0), 0.55, false);
    this.animalCell(v(-0.6, 0, 0), 0.82, false);
    this.plantCell(v(7.0, 0, 0), 0.78, false);
    this.label(this.anchor(this.content, v(-8.4, 1.4, 0)), "ბაქტერია (პროკარიოტი)", "tag");
    this.label(this.anchor(this.content, v(-0.6, 3.1, 0)), "ცხოველური უჯრედი", "tag");
    this.label(this.anchor(this.content, v(7.0, 2.4, 0)), "მცენარეული უჯრედი", "tag");
    void b;
    return { distance: 17, dir: v(0.28, 0.32, 0.9), target: v(-0.6, 0, 0), width: 21 };
  }

  private buildBacterium() {
    this.bacterium(v(0, 0, 0), 1, true);
    return { distance: 12, dir: v(0.35, 0.45, 0.82), target: v(-1.3, 0, 0) };
  }

  private buildNucleus() {
    const cut = v(0, 0, 0);
    const rand = rng(29);
    const R = 3;
    const env = this.mesh(blob(R, 0.02, 2, 5), this.shell("#9b7cc4", cut), this.content, cut);
    this.mesh(blob(R * 0.95, 0.02, 2, 5), this.shell("#c3b0e0", cut), this.content, cut);
    this.mesh(blob(R * 0.92, 0.02, 2, 5), this.shell("#eee6f7", cut, undefined, { side: THREE.BackSide, clearcoat: 0 }), this.content, cut);
    // Pores: a ring with a central plug.
    const torus = new THREE.TorusGeometry(0.17, 0.065, 10, 20);
    const ring: THREE.Matrix4[] = [];
    const plug: THREE.Matrix4[] = [];
    for (const d of fibonacci(220)) {
      if (d.x > 0.04 && d.z > 0.04) continue;
      const q = new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), d);
      ring.push(new THREE.Matrix4().compose(d.clone().multiplyScalar(R * 1.005), q, v(1, 1, 1)));
      plug.push(new THREE.Matrix4().compose(d.clone().multiplyScalar(R * 0.99), q, v(0.08, 0.08, 0.12)));
    }
    this.instanced(torus, this.material({ color: "#5e3f87" }), ring, this.content);
    this.instanced(this.sphereLow, this.material({ color: "#3b2a5c" }), plug, this.content);
    const nucleolus = this.mesh(blob(0.85, 0.2, 7, 4, v(1, 1, 1), ["#4a3470", "#24183b"], 3), this.material({ color: "#ffffff", vertexColors: true, roughness: 0.75 }), this.content);
    nucleolus.position.set(-0.5, 0.3, -0.6);
    // Chromatin: long threads of DNA wound on proteins.
    const chromMat = this.material({ color: "#8a63b8", roughness: 0.6 });
    const threads: V3[][] = [];
    for (let i = 0; i < 16; i++) {
      const start = v(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(1.2 + rand() * 1.1);
      if (start.distanceTo(nucleolus.position) < 1.1) continue;
      const pts = wander(rand, start, 60, 0.13, v(2.55, 2.55, 2.55), { c: nucleolus.position, r: 1.0 });
      if (pts.length < 4) continue;
      threads.push(pts);
      this.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.045, 6), chromMat, this.content);
    }
    // Rough ER continuing from the outer membrane.
    this.roughER(this.content, v(0, 0, 0), 3.35, v(0.55, 0.3, -0.75), 0.7, this.material({ color: "#5aa0d6", side: THREE.DoubleSide }), this.material({ color: "#22305a" }), 2);

    this.label(this.anchor(this.content, v(2.1, 2.08, 0.02)), "ბირთვის გარსი (ორმაგი მემბრანა)");
    this.label(this.anchor(this.content, new THREE.Vector3().setFromMatrixPosition(ring[Math.floor(ring.length * 0.25)])), "ბირთვის ფორა");
    this.label(this.anchor(this.content, nucleolus.position), "ბირთვაკი");
    const longest = threads.reduce((x, y) => (y.length > x.length ? y : x));
    this.label(this.anchor(this.content, longest[Math.floor(longest.length / 2)]), "ქრომატინი (დნმ + ცილები)");
    this.label(this.anchor(this.content, v(0.55, 0.3, -0.75).normalize().multiplyScalar(3.5)), "მარცვლოვანი ენდოპლაზმური ბადე");
    void env;
    return { distance: 15 };
  }

  private buildEnergy() {
    const mitoMats = {
      outer: this.material({ color: "#f08a5d", side: THREE.DoubleSide }),
      inner: this.material({ color: "#e0663f", side: THREE.DoubleSide }),
      matrix: this.material({ color: "#f9d9b5", side: THREE.BackSide }),
      cristae: this.material({ color: "#d4552f", side: THREE.DoubleSide }),
    };
    const mito = this.mitochondrion(this.content, 3.4, 1.15, true, mitoMats);
    mito.rotation.z = Math.PI / 2;
    mito.position.set(0, 1.75, 0);
    const chlMats = {
      outer: this.material({ color: "#7cc47a", side: THREE.DoubleSide }),
      inner: this.material({ color: "#4fa34a", side: THREE.DoubleSide }),
      stroma: this.material({ color: "#d8edc4", side: THREE.BackSide }),
      lamella: this.material({ color: "#3f9b4a" }),
    };
    const holder = new THREE.Group();
    holder.rotation.z = Math.PI / 2;
    holder.position.set(0, -1.75, 0);
    this.content.add(holder);
    holder.updateMatrixWorld();
    const discs: THREE.Matrix4[] = [];
    this.chloroplast(holder, 4.2, 1.25, true, chlMats, discs, holder.matrixWorld.clone());
    this.instanced(new THREE.CylinderGeometry(1, 1, 1, 20), this.material({ color: "#2f7d3a" }), discs, this.content);

    // Labels (positions in world space).
    this.label(this.anchor(this.content, v(-1.1, 2.95, -0.1)), "მიტოქონდრია", "tag");
    this.label(this.anchor(this.content, v(1.2, 2.8, -0.3)), "გარეთა მემბრანა");
    this.label(this.anchor(this.content, v(-1.75, 0.75, -0.25)), "შიგნითა მემბრანა");
    this.label(this.anchor(this.content, v(0.37, 1.45, -0.55)), "კრისტები");
    this.label(this.anchor(this.content, v(-0.55, 1.75, -0.7)), "მატრიქსი");
    this.label(this.anchor(this.content, v(-1.6, -0.45, -0.1)), "ქლოროპლასტი", "tag");
    this.label(this.anchor(this.content, v(1.6, -0.75, -0.3)), "ორმაგი მემბრანა");
    this.label(this.anchor(this.content, v(-0.62, -1.75, -0.35)), "გრანა (თილაკოიდების დასტა)");
    this.label(this.anchor(this.content, v(0.9, -2.55, -0.8)), "სტრომა");

    // Slow "breathing" glow of the cristae and thylakoids: where the energy is made.
    this.tickers.push((t) => {
      mitoMats.cristae.emissive.set("#ff7a3c");
      mitoMats.cristae.emissiveIntensity = 0.12 + 0.1 * Math.sin(t * 2);
    });
    return { distance: 12.5, dir: v(0.1, 0.18, 1) };
  }

  private buildMembrane() {
    const rand = rng(41);
    const g = new THREE.Group();
    this.content.add(g);
    const proteins = [
      { c: v(-2.6, 0, -0.6), r: 0.95 },
      { c: v(1.5, 0, 0.6), r: 0.75 },
      { c: v(-0.3, 0, -2.0), r: 0.75 },
      { c: v(3.4, 0, -1.6), r: 0.7 },
    ];
    const heads: THREE.Matrix4[] = [];
    const tails: { base: V3; dir: number; phase: number }[] = [];
    const cholesterol: THREE.Matrix4[] = [];
    for (let i = -10; i <= 10; i++)
      for (let k = -7; k <= 7; k++) {
        const x = i * 0.48 + (k % 2) * 0.24;
        const z = k * 0.48;
        if (proteins.some((p) => Math.hypot(x - p.c.x, z - p.c.z) < p.r + 0.15)) continue;
        for (const side of [1, -1]) {
          heads.push(new THREE.Matrix4().compose(v(x, side * 1.05, z), new THREE.Quaternion(), v(0.22, 0.22, 0.22)));
          tails.push({ base: v(x, side * 0.95, z), dir: -side, phase: rand() * 10 });
          if (rand() < 0.07) cholesterol.push(new THREE.Matrix4().compose(v(x + 0.24, side * 0.55, z + 0.24), new THREE.Quaternion(), v(0.07, 0.55, 0.07)));
        }
      }
    const headMat = this.material({ color: "#e46a6a", roughness: 0.4 });
    this.instanced(this.sphere, headMat, heads, g);
    const tailMesh = new THREE.InstancedMesh(this.cylinder, this.material({ color: "#f2d16b", roughness: 0.6 }), tails.length * 2);
    g.add(tailMesh);
    this.instanced(this.cylinder, this.material({ color: "#c98a2b" }), cholesterol, g);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const placeTails = (t: number) => {
      tails.forEach((tl, i) => {
        for (const j of [0, 1]) {
          const wob = Math.sin(t * 1.7 + tl.phase + j) * 0.18;
          const dir = v(wob, tl.dir, Math.cos(t * 1.3 + tl.phase * 2 + j) * 0.12).normalize();
          q.setFromUnitVectors(Y, dir);
          const base = tl.base.clone().add(v(j ? 0.07 : -0.07, 0, 0));
          m4.compose(base.addScaledVector(dir, 0.42), q, v(0.045, 0.84, 0.045));
          tailMesh.setMatrixAt(i * 2 + j, m4);
        }
      });
      tailMesh.instanceMatrix.needsUpdate = true;
    };
    placeTails(0);

    // Proteins.
    const integral = this.mesh(blob(1, 0.12, 3, 4, v(0.9, 1.55, 0.85)), this.material({ color: "#7b8fd4", roughness: 0.55 }), g);
    integral.position.copy(proteins[0].c);
    const chanMat = this.material({ color: "#5aa0d6", roughness: 0.5 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const sub = this.mesh(blob(1, 0.08, i + 20, 3, v(0.24, 1.35, 0.24)), chanMat, g);
      sub.position.copy(proteins[1].c).add(v(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45));
    }
    const glyco = this.mesh(blob(1, 0.12, 9, 4, v(0.65, 1.45, 0.65)), this.material({ color: "#9c7fd0", roughness: 0.55 }), g);
    glyco.position.copy(proteins[2].c);
    const sugarMat = this.material({ color: "#6cc08b" });
    const sugar: THREE.Matrix4[] = [];
    const chain = (start: V3, dir: V3, n: number) => {
      const p = start.clone();
      for (let i = 0; i < n; i++) {
        p.addScaledVector(dir, 0.2).add(v((rand() - 0.5) * 0.12, 0, (rand() - 0.5) * 0.12));
        sugar.push(new THREE.Matrix4().compose(p.clone(), new THREE.Quaternion(), v(0.09, 0.09, 0.09)));
      }
      return p;
    };
    const top = chain(proteins[2].c.clone().add(v(0, 1.4, 0)), v(0, 1, 0), 4);
    chain(top, v(0.6, 0.8, 0).normalize(), 3);
    chain(top, v(-0.6, 0.8, 0.2).normalize(), 3);
    const top2 = chain(v(-4.0, 1.25, 1.8), v(0, 1, 0), 3);
    chain(top2, v(0.5, 0.8, 0.3).normalize(), 2);
    this.instanced(this.sphereLow, sugarMat, sugar, g);
    const periph = this.mesh(blob(1, 0.15, 13, 3, v(0.7, 0.45, 0.6)), this.material({ color: "#d18fd6" }), g);
    periph.position.set(3.4, -1.55, -1.6);

    // Molecules: oxygen crosses the lipid layer anywhere; ions only through the channel.
    const o2 = Array.from({ length: 16 }, (_, i) => ({ x: (rand() - 0.5) * 9, z: (rand() - 0.5) * 6, off: i * 0.73 }));
    const ions = Array.from({ length: 10 }, (_, i) => ({ x: (rand() - 0.5) * 8, z: (rand() - 0.5) * 5.5, off: i * 0.9, through: i % 3 === 0 }));
    const o2Mesh = new THREE.InstancedMesh(this.sphere, this.material({ color: "#6fc3ef", emissive: "#2a8fd0", emissiveIntensity: 0.2 }), o2.length);
    const ionMesh = new THREE.InstancedMesh(this.sphere, this.material({ color: "#f5c542", emissive: "#d09a10", emissiveIntensity: 0.25 }), ions.length);
    g.add(o2Mesh, ionMesh);
    const ch = proteins[1].c;
    const pos = new THREE.Vector3();
    const tick = (t: number) => {
      placeTails(t);
      o2.forEach((m, i) => {
        const u = ((t * 0.12 + m.off) % 1 + 1) % 1;
        pos.set(m.x + Math.sin(t + i) * 0.2, 3 - u * 6, m.z);
        o2Mesh.setMatrixAt(i, m4.compose(pos, q.identity(), v(0.12, 0.12, 0.12)));
      });
      ions.forEach((m, i) => {
        const u = ((t * 0.1 + m.off) % 1 + 1) % 1;
        if (m.through) {
          // Drift to the channel's mouth, pass down through it, leave below.
          if (u < 0.45) pos.set(m.x, 2.8, m.z).lerp(v(ch.x, 1.9, ch.z), u / 0.45);
          else if (u < 0.75) pos.set(ch.x, 1.9 - ((u - 0.45) / 0.3) * 4.1, ch.z);
          else pos.set(ch.x, -2.2, ch.z).lerp(v(m.x, -3, m.z), (u - 0.75) / 0.25);
        } else {
          // Bounce off the lipid layer.
          const b = Math.abs(Math.sin(u * Math.PI * 2));
          pos.set(m.x + Math.sin(t * 0.3 + i) * 0.6, 1.55 + b * 1.4, m.z);
        }
        ionMesh.setMatrixAt(i, m4.compose(pos, q.identity(), v(0.16, 0.16, 0.16)));
      });
      o2Mesh.instanceMatrix.needsUpdate = true;
      ionMesh.instanceMatrix.needsUpdate = true;
    };
    tick(0);
    this.tickers.push(tick);

    const head = new THREE.Vector3().setFromMatrixPosition(heads[30]);
    this.label(this.anchor(g, head), "ფოსფოლიპიდის თავი (ჰიდროფილური)");
    this.label(this.anchor(g, v(head.x + 0.9, 0.45, head.z)), "კუდები (ჰიდროფობური)");
    this.label(this.anchor(g, proteins[0].c.clone().add(v(0, 1.3, 0))), "ცილა");
    this.label(this.anchor(g, ch.clone().add(v(0.45, 1.25, 0))), "არხის ცილა");
    this.label(this.anchor(g, top), "გლიკოპროტეინი");
    this.label(this.anchor(g, periph.position), "პერიფერიული ცილა");
    if (cholesterol[4]) this.label(this.anchor(g, new THREE.Vector3().setFromMatrixPosition(cholesterol[4])), "ქოლესტეროლი");
    const o2Tag = this.anchor(g, v(0, 0, 0));
    const ionTag = this.anchor(g, v(0, 0, 0));
    this.label(o2Tag, "O₂", "tag");
    this.label(ionTag, "იონი", "tag");
    this.tickers.push((t) => {
      const u = ((t * 0.12 + o2[2].off) % 1 + 1) % 1;
      o2Tag.position.set(o2[2].x + Math.sin(t + 2) * 0.2 + 0.35, 3 - u * 6, o2[2].z);
      const w = ((t * 0.1 + ions[3].off) % 1 + 1) % 1;
      const m = ions[3];
      if (w < 0.45) ionTag.position.set(m.x, 2.8, m.z).lerp(v(ch.x, 1.9, ch.z), w / 0.45);
      else if (w < 0.75) ionTag.position.set(ch.x, 1.9 - ((w - 0.45) / 0.3) * 4.1, ch.z);
      else ionTag.position.set(ch.x, -2.2, ch.z).lerp(v(m.x, -3, m.z), (w - 0.75) / 0.25);
      ionTag.position.x += 0.4;
    });
    return { distance: 15, dir: v(0.2, 0.42, 0.88) };
  }

  // ---- Division -------------------------------------------------------------------------------------

  private buildDivision(keys: Keyframe[], phases: number) {
    const meiosis = phases > 6;
    const R = meiosis ? 2 : 2.4;
    this.phaseCount = phases;
    /** Chromosomes drawn larger in meiosis, where the camera has to see four cells. */
    const size = meiosis ? 1.25 : 1;
    this.divTime = 0;
    // Membranes: A (whole cell along x), B and C (daughters of meiosis I, along y).
    const memDefs = [
      { c: v(0, 0, 0), axis: v(1, 0, 0) },
      { c: v(-R, 0, 0), axis: v(0, 1, 0) },
      { c: v(R, 0, 0), axis: v(0, 1, 0) },
    ];
    const S = 56;
    const SEGS = 40;
    const membranes = memDefs.map((def) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(S * SEGS * 3), 3));
      const idx: number[] = [];
      for (let i = 0; i < S - 1; i++)
        for (let j = 0; j < SEGS; j++) {
          const a = i * SEGS + j;
          const b = i * SEGS + ((j + 1) % SEGS);
          idx.push(a, a + SEGS, b, b, a + SEGS, b + SEGS);
        }
      geo.setIndex(idx);
      const mat = this.material({ color: "#e9a3b1", transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, roughness: 0.3 });
      const mesh = this.mesh(geo, mat, this.content);
      mesh.renderOrder = 2;
      const u = Math.abs(def.axis.x) > 0.5 ? v(0, 1, 0) : v(1, 0, 0);
      const w = new THREE.Vector3().crossVectors(def.axis, u);
      return { def, geo, mat, mesh, u, w };
    });
    const setMembrane = (m: (typeof membranes)[number], sep: number, vis: number) => {
      m.mesh.visible = vis > 0.01;
      m.mat.opacity = 0.32 * vis;
      if (!m.mesh.visible) return;
      const pos = m.geo.attributes.position as THREE.BufferAttribute;
      const half = sep + R;
      for (let i = 0; i < S; i++) {
        const s = -half * Math.cos((Math.PI * i) / (S - 1));
        const lobe = (x: number) => Math.sqrt(Math.max(0, R * R - x * x));
        const r = Math.max(lobe(s - sep), lobe(s + sep), 0.0001);
        for (let j = 0; j < SEGS; j++) {
          const a = (j / SEGS) * Math.PI * 2;
          const p = m.def.c.clone().addScaledVector(m.def.axis, s).addScaledVector(m.u, Math.cos(a) * r).addScaledVector(m.w, Math.sin(a) * r);
          pos.setXYZ(i * SEGS + j, p.x, p.y, p.z);
        }
      }
      pos.needsUpdate = true;
      m.geo.computeVertexNormals();
    };

    const nuclei = [0, 1, 2, 3].map(() => {
      const mat = this.material({ color: "#a98bd1", transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.4 });
      const mesh = this.mesh(this.sphere, mat, this.content);
      mesh.renderOrder = 1;
      return { mesh, mat };
    });
    const chromMat = this.material({ color: "#ffffff", roughness: 0.4 });
    const capsule = new THREE.CapsuleGeometry(0.5, 2, 4, 12);
    this.disposables.push(capsule);
    const chromatids = new THREE.InstancedMesh(capsule, chromMat, 8);
    const tips = new THREE.InstancedMesh(capsule, chromMat, 8);
    const color = new THREE.Color();
    for (let i = 0; i < 8; i++) {
      chromatids.setColorAt(i, color.set(CHROMOSOMES[i >> 1].color));
      tips.setColorAt(i, color.set(CROSSOVER_TIPS[i] ?? CHROMOSOMES[i >> 1].color));
    }
    const centrosomes = new THREE.InstancedMesh(this.sphere, this.material({ color: "#c45ab3" }), 8);
    this.content.add(chromatids, tips, centrosomes);
    const spindleGeo = new THREE.BufferGeometry();
    spindleGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(8 * 2 * 3 * 3), 3));
    const spindleMat = new THREE.LineBasicMaterial({ color: "#7f8da3", transparent: true, opacity: 0.6 });
    this.disposables.push(spindleMat);
    const spindle = new THREE.LineSegments(spindleGeo, spindleMat);
    this.content.add(spindle);

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const ease = (x: number) => smoothstep(0, 1, x);
    const lerpKey = (a: Keyframe, b: Keyframe, t: number): Keyframe => ({
      c: a.c.map((ch, i) => ({ p: ch.p.clone().lerp(b.c[i].p, t), d: ch.d.clone().lerp(b.c[i].d, t).normalize() })),
      cond: a.cond + (b.cond - a.cond) * t,
      tip: a.tip + (b.tip - a.tip) * t,
      spindle: a.spindle + (b.spindle - a.spindle) * t,
      poles: a.poles.map((p, i) => p.clone().lerp(b.poles[i], t)),
      nuclei: a.nuclei.map((n, i) => ({ c: n.c.clone().lerp(b.nuclei[i].c, t), r: n.r + (b.nuclei[i].r - n.r) * t, o: n.o + (b.nuclei[i].o - n.o) * t })),
      mem: a.mem.map((m, i) => ({ sep: m.sep + (b.mem[i].sep - m.sep) * t, vis: m.vis + (b.mem[i].vis - m.vis) * t })),
    });
    const total = phases * SEG + 1.5;
    const render = (k: Keyframe) => {
      membranes.forEach((m, i) => setMembrane(m, k.mem[i].sep, k.mem[i].vis));
      nuclei.forEach((n, i) => {
        const nk = k.nuclei[i];
        n.mesh.visible = nk.o > 0.01;
        n.mesh.position.copy(nk.c);
        n.mesh.scale.setScalar(nk.r);
        n.mat.opacity = 0.32 * nk.o;
      });
      const thick = 0.14 * size * Math.pow(Math.max(0, k.cond), 0.7);
      const sp = spindleGeo.attributes.position as THREE.BufferAttribute;
      k.c.forEach((ch, i) => {
        const len = CHROMOSOMES[i >> 1].len * size * (1 + (1 - k.cond) * 0.6);
        q.setFromUnitVectors(Y, ch.d);
        m4.compose(ch.p, q, v(thick * 2, len / 3, thick * 2));
        chromatids.setMatrixAt(i, m4);
        const tipOn = CROSSOVER_TIPS[i] ? k.tip : 0;
        const tipLen = len * 0.34;
        m4.compose(ch.p.clone().addScaledVector(ch.d, len / 2 - tipLen / 2 + 0.02), q, v(thick * 2.12 * tipOn, (tipLen / 3) * tipOn, thick * 2.12 * tipOn));
        tips.setMatrixAt(i, m4);
        m4.compose(k.poles[i], q.identity(), v(0.1, 0.1, 0.1));
        centrosomes.setMatrixAt(i, m4);
        sp.setXYZ(i * 2, k.poles[i].x, k.poles[i].y, k.poles[i].z);
        sp.setXYZ(i * 2 + 1, ch.p.x, ch.p.y, ch.p.z);
      });
      sp.needsUpdate = true;
      spindleMat.opacity = 0.65 * k.spindle;
      spindle.visible = k.spindle > 0.02;
      chromatids.instanceMatrix.needsUpdate = true;
      tips.instanceMatrix.needsUpdate = true;
      centrosomes.instanceMatrix.needsUpdate = true;
    };
    this.tickers.push((_, dt) => {
      if (this.playing && !this.reduceMotion) this.divTime = (this.divTime + dt) % total;
      const t = Math.min(this.divTime, phases * SEG - 0.0001);
      const i = Math.floor(t / SEG);
      const local = t - i * SEG;
      const k = i === 0 ? keys[0] : lerpKey(keys[i - 1], keys[i], ease(Math.min(1, local / TRANSITION)));
      render(k);
      if (i !== this.phase) {
        this.phase = i;
        this.callbacks.onPhase(i);
      }
    });
    render(keys[0]);
    return meiosis ? { distance: 15, dir: v(0.15, 0.22, 1) } : { distance: 11.5, dir: v(0.3, 0.3, 0.92) };
  }

  // ---- Pointer --------------------------------------------------------------------------------------

  private onPointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!this.picking || !d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const rect = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1), this.camera);
    for (const hit of this.ray.intersectObjects(this.content.children, true)) {
      const cut = hit.object.userData.cut as V3 | undefined;
      if (cut && isCut(hit.point, cut)) continue; // that part is cut away
      let o: THREE.Object3D | null = hit.object;
      while (o && !o.userData.organelle) o = o.parent;
      if (o) return this.callbacks.onPick(o.userData.organelle as OrganelleId);
    }
    this.callbacks.onPick(null);
  };

  // ---- Loop -----------------------------------------------------------------------------------------

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private tmp = new THREE.Vector3();
  private tq = new THREE.Quaternion();
  private sizes = new WeakMap<HTMLElement, { w: number; h: number }>();
  private placeLabels() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    // The selected organelle's label goes first; later labels that would overlap an earlier one hide.
    const order = [...this.labels].sort((a, b) => Number(b.organelle === this.selected && !!b.organelle) - Number(a.organelle === this.selected && !!a.organelle));
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const l of order) {
      if (l.el.dataset.hidden === "1") {
        l.el.style.visibility = "hidden";
        continue;
      }
      l.target.getWorldPosition(this.tmp);
      if (l.offset.lengthSq()) this.tmp.add(l.offset.clone().applyQuaternion(l.target.getWorldQuaternion(this.tq)));
      this.tmp.project(this.camera);
      const x = ((this.tmp.x + 1) / 2) * w;
      const y = ((1 - this.tmp.y) / 2) * h;
      let visible = this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.05 && Math.abs(this.tmp.y) < 1.05;
      if (visible) {
        let size = this.sizes.get(l.el);
        if (!size?.w) {
          size = { w: l.el.offsetWidth, h: l.el.offsetHeight };
          this.sizes.set(l.el, size);
        }
        // Labels start at their point (dot on the left); tags are centred on it.
        const box = l.el.classList.contains("dna-tag") ? { x: x - size.w / 2, y: y - size.h / 2, w: size.w, h: size.h } : { x: x - 6, y: y - size.h / 2, w: size.w, h: size.h };
        if (placed.some((q) => box.x < q.x + q.w + 2 && q.x < box.x + box.w + 2 && box.y < q.y + q.h + 1 && q.y < box.y + box.h + 1)) visible = false;
        else placed.push(box);
      }
      l.el.style.visibility = visible ? "visible" : "hidden";
      l.el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    for (const tick of this.tickers) tick(this.reduceMotion ? 2 : t, dt);
    if (this.selected) {
      for (const m of this.organelleMats.get(this.selected) ?? []) m.emissiveIntensity = this.reduceMotion ? 0.35 : 0.25 + 0.2 * Math.sin(t * 4);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.clear();
    for (const g of this.shared) g.dispose();
    this.env.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

/** Division timeline: each phase is a transition into it, then a pause to look at it. */
const TRANSITION = 2.2;
const SEG = 3.6;
