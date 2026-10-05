import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { smoothstep } from "@/lib/noise";
import { PARTS, type Circuit, type HeartPart, type HeartView } from "./heart-data";

/*
 * The heart as in a textbook: cut open from the front (frontal section). The back half is a closed surface;
 * the cut face is a flat section with the four chambers as cavities. Everything is built in the heart's own
 * frame (y = long axis, apex down, x = towards the patient's left) and beats in a vertex shader, so cut face,
 * walls and vessels always stay together. Venous side blue, arterial side red, as textbooks show it.
 */

export interface HeartOptions {
  circuit: Circuit;
  disease: boolean;
  slow: boolean;
  playing: boolean;
}

interface Callbacks {
  onPick: (part: HeartPart | null) => void;
  onPhase: (index: number) => void;
  onLoading: (loading: boolean) => void;
}

interface Label {
  target: THREE.Object3D;
  el: HTMLDivElement;
  part?: HeartPart;
}

type V3 = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const gauss = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));
const BLUE = new THREE.Color("#4a5fc1");
const RED = new THREE.Color("#c62f36");

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

// ---- Heart data: BodyParts3D meshes extracted by scripts/build-heart.mjs ------------------------------

type N3 = [number, number, number];
interface PartData {
  id: string;
  name: string;
  role: string;
  key: string;
  vertexCount: number;
  indexCount: number;
  positions: number;
  normals: number;
  indices: number;
  centre: N3;
}
interface HeartData {
  parts: PartData[];
  plane: { normal: N3; point: N3; right: N3; up: N3 };
  axis: { base: N3; apex: N3 };
  centres: Record<string, N3>;
  conduction: { sa: N3 | null; av: N3 | null; septum: N3[] };
  onSection: Record<string, N3>;
  /** Vessels drawn as smooth tubes: points [x, y, z, radius] along the centreline. */
  tubes: Record<string, [number, number, number, number][]>;
}
/** Bump when public/heart is rebuilt. */
const HEART_VERSION = "2026-10-05b";
let heartPromise: Promise<{ meta: HeartData; buf: ArrayBuffer }> | null = null;
const loadHeart = () =>
  (heartPromise ??= Promise.all([
    fetch(`/heart/heart.json?v=${HEART_VERSION}`).then((r) => r.json() as Promise<HeartData>),
    fetch(`/heart/heart.bin.gz?v=${HEART_VERSION}`).then((r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()),
  ]).then(([meta, buf]) => ({ meta, buf })));
const vec = (a: N3) => new THREE.Vector3(a[0], a[1], a[2]);

/** How each kind of mesh is drawn: colour, colour of its cut surface, whether it beats. */
interface Look {
  color: string;
  cap?: string;
  clip: boolean;
  opacity?: number;
  beat: number;
  /** Great vessels: cut a little in front of the heart's section, so they stay joined to the chambers. */
  vessel?: boolean;
  /** Open-ended vessels: their inside wall colour (they get no solid cut surface). */
  inside?: string;
}
const LOOK: Record<string, Look> = {
  wall: { color: "#9e3b36", cap: "#c4675c", clip: true, beat: 1 },
  cavity: { color: "#ffffff", clip: true, opacity: 0.3, beat: 1 },
  leaflet: { color: "#e8d6b6", cap: "#f4e8d0", clip: true, beat: 0 },
  cusp: { color: "#e8d6b6", cap: "#f4e8d0", clip: true, beat: 0 },
  papillary: { color: "#a5423b", cap: "#c96257", clip: true, beat: 1 },
  artery: { color: "#c62f36", clip: true, vessel: true, beat: 0.3, inside: "#8f1f25" },
  venousArtery: { color: "#4a5fc1", clip: true, vessel: true, beat: 0.3, inside: "#2f3f8f" },
  arterialVein: { color: "#c62f36", clip: true, vessel: true, beat: 0.3, inside: "#8f1f25" },
  vein: { color: "#4a5fc1", clip: true, vessel: true, beat: 0.3, inside: "#2f3f8f" },
  coronaryArtery: { color: "#d8343a", clip: true, beat: 1 },
  coronaryVein: { color: "#3f55b8", clip: true, beat: 1 },
  lung: { color: "#f0a7b0", clip: false, opacity: 0.2, beat: 0 },
};
const CAVITY_TINT: Record<string, string> = { ra: "#4a5fc1", rv: "#4a5fc1", la: "#c62f36", lv: "#c62f36" };
/** Mesh key → the part a click selects. */
const PICK: Record<string, HeartPart> = {
  ventricles: "myocardium",
  raWall: "ra",
  laWall: "la",
  lv: "lv",
  rv: "rv",
  ra: "ra",
  la: "la",
  mitral: "mitral",
  tricuspid: "tricuspid",
  aorticValve: "semilunar",
  pulmonaryValve: "semilunar",
  papillary: "papillary",
  coronary: "coronary",
  aorta: "aorta",
  aortaDesc: "aorta",
  aortaBranch: "aorta",
  pulmonary: "pulmonary",
  pulmVeins: "pulmVeins",
  svc: "cava",
  ivc: "cava",
  cavaBranch: "cava",
};

/** Beat along the heart's own long axis: ventricles shorten and narrow, atria a little; WEIGHT per mesh. */
const BEAT = /* glsl */ `
  vec3 hd = transformed - uBase;
  float ha = dot(hd, uAxis);
  vec3 hr = hd - uAxis * ha;
  float ht = ha / uLen;
  float kv = 0.13 * uVent * smoothstep(0.0, 0.5, ht) * WEIGHT;
  float ka = 0.09 * uAtr * smoothstep(0.0, -0.6, ht) * WEIGHT;
  transformed = uBase + uAxis * ha * (1.0 - 0.55 * kv - 0.4 * ka) + hr * (1.0 - kv - ka);
`;

/** Electrocardiogram (one beat, f ∈ [0, 1)). */
const ecg = (f: number) =>
  0.15 * gauss(f, 0.05, 0.018) - 0.12 * gauss(f, 0.135, 0.006) + gauss(f, 0.15, 0.008) - 0.28 * gauss(f, 0.165, 0.007) + 0.3 * gauss(f, 0.42, 0.035);
/** Aortic pressure, mm Hg. */
const pressure = (f: number) => {
  if (f < 0.12) return 80 + 18 * Math.exp(-(f + 0.5) * 6);
  if (f < 0.5) return 80 + 40 * smoothstep(0.12, 0.3, f) * (1 - 0.55 * smoothstep(0.3, 0.5, f));
  return 80 + 18 * Math.exp(-(f - 0.5) * 6) + 3 * gauss(f, 0.53, 0.02);
};

export class HeartScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.05, 300);
  private controls: OrbitControls;
  private content = new THREE.Group();
  private labels: Label[] = [];
  private frame = 0;
  private clock = new THREE.Clock();
  private tickers: ((dt: number) => void)[] = [];
  private disposables: { dispose(): void }[] = [];
  private disposed = false;
  private observer: ResizeObserver;
  private reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private env: THREE.WebGLRenderTarget;
  private view: HeartView | null = null;
  private opts: HeartOptions = { circuit: "both", disease: false, slow: true, playing: true };
  private uniforms = {
    uVent: { value: 0 },
    uAtr: { value: 0 },
    uBase: { value: new THREE.Vector3() },
    uAxis: { value: new THREE.Vector3(0, -1, 0) },
    uLen: { value: 1 },
  };
  private heartData: { meta: HeartData; buf: ArrayBuffer } | null = null;
  private pending: { view: HeartView; opts: HeartOptions } | null = null;
  private clipPlane: THREE.Plane | null = null;
  private heartInner: THREE.Group | null = null;
  private vesselPlane: THREE.Plane | null = null;
  private capOrder = 10;
  private capGeo = new THREE.PlaneGeometry(60, 60);
  /** Heart beats elapsed (fraction = position in the cycle). */
  private beat = 0;
  private phase = -1;
  private picking = false;
  private selected: HeartPart | null = null;
  private partMats = new Map<HeartPart, THREE.MeshStandardMaterial[]>();
  private down: { x: number; y: number } | null = null;
  private ray = new THREE.Raycaster();
  private graph: HTMLCanvasElement | null = null;
  private circuitMats: { pulmonary: THREE.MeshStandardMaterial[]; systemic: THREE.MeshStandardMaterial[] } = { pulmonary: [], systemic: [] };

  private sphere = new THREE.IcosahedronGeometry(1, 2);
  private shared = new Set<THREE.BufferGeometry>([this.sphere, this.capGeo]);

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    private callbacks: Callbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, stencil: true });
    this.renderer.localClippingEnabled = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.env.texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight("#ffffff", 1.5);
    key.position.set(4, 7, 8);
    const fill = new THREE.DirectionalLight("#ffeaea", 0.6);
    fill.position.set(-6, -2, 5);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#d9e2df", 0.75), key, fill, this.content);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
    loadHeart().then((d) => {
      if (this.disposed) return;
      this.heartData = d;
      if (this.pending) {
        const { view, opts } = this.pending;
        this.pending = null;
        this.callbacks.onLoading(false);
        this.setView(view, opts);
      }
    });
  }

  // ---- Public ---------------------------------------------------------------------------------------

  setView(view: HeartView, opts: HeartOptions) {
    // The three heart views need the anatomical model; the others are built from code.
    if (!this.heartData && (view === "structure" || view === "cycle" || view === "circulation")) {
      this.pending = { view, opts };
      this.callbacks.onLoading(true);
      return;
    }
    this.callbacks.onLoading(false);
    const rebuild = view !== this.view || (view === "diseases" && opts.disease !== this.opts.disease);
    this.opts = opts;
    this.applyCircuit();
    if (!rebuild) return;
    this.view = view;
    this.clear();
    const builders: Record<HeartView, () => { distance: number; dir?: V3; target?: V3; width?: number }> = {
      structure: () => this.buildStructure(),
      cycle: () => this.buildCycle(),
      vessels: () => this.buildVessels(),
      circulation: () => this.buildCirculation(),
      pulse: () => this.buildPulse(),
      diseases: () => this.buildDisease(opts.disease),
    };
    const built = builders[view]();
    const dir = (built.dir ?? v(0.25, 0.2, 1)).normalize();
    let distance = built.distance * Math.max(1, 1.3 / this.camera.aspect);
    if (built.width) {
      const h = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect);
      distance = Math.max(distance, (built.width / 2 / Math.tan(h)) * 1.05);
    }
    const target = built.target ?? v(0, 0, 0);
    this.camera.position.copy(target).addScaledVector(dir, distance);
    this.controls.target.copy(target);
    this.controls.minDistance = distance * 0.4;
    this.controls.maxDistance = distance * 1.8;
    // The heart is cut open at the front: keep the camera in front of it.
    this.controls.minAzimuthAngle = view === "structure" || view === "cycle" ? -1.0 : -Infinity;
    this.controls.maxAzimuthAngle = view === "structure" || view === "cycle" ? 1.0 : Infinity;
    this.controls.update();
    this.applySelection();
    this.applyCircuit();
  }

  select(part: HeartPart | null) {
    this.selected = part;
    this.applySelection();
  }

  // ---- Helpers --------------------------------------------------------------------------------------

  private material(params: THREE.MeshPhysicalMaterialParameters, part?: HeartPart) {
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4, ...params });
    this.disposables.push(m);
    if (part) {
      const list = this.partMats.get(part) ?? [];
      list.push(m);
      this.partMats.set(part, list);
    }
    return m;
  }

  private anchor(parent: THREE.Object3D, p: V3) {
    const o = new THREE.Object3D();
    o.position.copy(p);
    parent.add(o);
    return o;
  }

  private label(target: THREE.Object3D, text: string, kind: "label" | "tag" = "label", part?: HeartPart) {
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
    this.labels.push({ target, el, part });
  }

  private tube(points: V3[], r: number, mat: THREE.Material, parent: THREE.Object3D, segments = 64) {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, r, 14), mat);
    parent.add(m);
    return m;
  }

  private clear() {
    for (const l of this.labels) l.el.remove();
    this.labels = [];
    this.tickers = [];
    this.graph?.remove();
    this.graph = null;
    this.content.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && !this.shared.has(mesh.geometry)) mesh.geometry.dispose();
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    });
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.content.clear();
    this.partMats.clear();
    this.circuitMats = { pulmonary: [], systemic: [] };
    this.picking = false;
    this.phase = -1;
    this.clipPlane = null;
    this.uniforms.uVent.value = 0;
    this.uniforms.uAtr.value = 0;
  }

  private applySelection() {
    for (const [part, mats] of this.partMats) {
      const on = part === this.selected;
      for (const m of mats) {
        m.emissive.set(on ? "#ffffff" : part === "conduction" ? "#f2b632" : "#000000");
        m.emissiveIntensity = on ? 0.25 : part === "conduction" ? 0.4 : 0;
      }
    }
    for (const l of this.labels) if (l.part) l.el.classList.toggle("cell-label-active", l.part === this.selected);
  }

  private applyCircuit() {
    for (const key of ["pulmonary", "systemic"] as const) {
      const dim = this.opts.circuit !== "both" && this.opts.circuit !== key;
      for (const m of this.circuitMats[key]) {
        m.transparent = dim;
        m.opacity = dim ? 0.15 : 1;
        m.depthWrite = !dim;
      }
    }
  }

  /** A small chart drawn in the corner (ECG or blood pressure). */
  private chart(title: string) {
    const c = document.createElement("canvas");
    c.className = "heart-chart";
    c.width = 600;
    c.height = 200;
    this.overlay.appendChild(c);
    this.graph = c;
    const ctx = c.getContext("2d")!;
    const draw = (fn: (f: number) => number, lo: number, hi: number, marks: { y: number; text: string }[] = []) => {
      const W = c.width;
      const H = c.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.94)";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#f2d6d6";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      const yOf = (val: number) => H - 24 - ((val - lo) / (hi - lo)) * (H - 56);
      ctx.font = "bold 22px FiraGO, sans-serif";
      ctx.fillStyle = "#33413e";
      ctx.fillText(title, 14, 30);
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "#97a29e";
      ctx.font = "18px FiraGO, sans-serif";
      for (const m of marks) {
        ctx.beginPath();
        ctx.moveTo(0, yOf(m.y));
        ctx.lineTo(W, yOf(m.y));
        ctx.stroke();
        ctx.fillText(m.text, W - ctx.measureText(m.text).width - 10, yOf(m.y) - 6);
      }
      ctx.setLineDash([]);
      // The last two beats, scrolling; the newest point is at the right edge.
      ctx.strokeStyle = "#c62f36";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const b = this.beat - 2 + (2 * x) / W;
        const val = fn(((b % 1) + 1) % 1);
        if (x === 0) ctx.moveTo(x, yOf(val));
        else ctx.lineTo(x, yOf(val));
      }
      ctx.stroke();
      ctx.fillStyle = "#c62f36";
      ctx.beginPath();
      ctx.arc(W - 4, yOf(fn(((this.beat % 1) + 1) % 1)), 7, 0, Math.PI * 2);
      ctx.fill();
    };
    return draw;
  }

  /** Cycle state for the current beat. */
  private cycle() {
    const f = ((this.beat % 1) + 1) % 1;
    const vent = smoothstep(0.125, 0.2, f) * (1 - smoothstep(0.42, 0.52, f));
    const atr = f < 0.125 ? Math.sin((Math.PI * f) / 0.125) : 0;
    const avOpen = 1 - smoothstep(0.12, 0.15, f) * (1 - smoothstep(0.48, 0.53, f));
    const slOpen = smoothstep(0.17, 0.22, f) * (1 - smoothstep(0.45, 0.5, f));
    const phase = f < 0.125 ? 0 : f < 0.5 ? 1 : 2;
    return { f, vent, atr, avOpen, slOpen, phase };
  }

  // ---- The real heart -------------------------------------------------------------------------------

  private beatMaterial<T extends THREE.Material>(m: T, weight: number): T {
    if (!weight) return m;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uVent;\nuniform float uAtr;\nuniform vec3 uBase;\nuniform vec3 uAxis;\nuniform float uLen;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${BEAT.replace(/WEIGHT/g, weight.toFixed(2))}`);
    };
    m.customProgramCacheKey = () => `beat-${weight}`;
    return m;
  }

  /**
   * Solid cut surface: the inside (back faces) of a clipped mesh, seen through the cut, is drawn flat in the
   * tissue's cut colour and lit as if it faced the viewer. Unlike stencil capping, this also works for the
   * open-ended vessels, so nothing leaks out from side views.
   */
  private capped(geo: THREE.BufferGeometry, parent: THREE.Object3D, color: string, weight: number, part?: HeartPart) {
    if (!this.clipPlane) return;
    const m = this.material({ color, roughness: 0.8, clearcoat: 0, side: THREE.BackSide, clippingPlanes: [this.clipPlane] }, part);
    const n = this.clipPlane.normal.clone().negate(); // the cut faces the viewer (+z)
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms, { uCutN: { value: n } });
      if (weight)
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uVent;\nuniform float uAtr;\nuniform vec3 uBase;\nuniform vec3 uAxis;\nuniform float uLen;")
          .replace("#include <begin_vertex>", `#include <begin_vertex>\n${BEAT.replace(/WEIGHT/g, weight.toFixed(2))}`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uCutN;")
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = normalize((viewMatrix * vec4(uCutN, 0.0)).xyz);");
    };
    m.customProgramCacheKey = () => `cap-${weight}`;
    const mesh = new THREE.Mesh(geo, m);
    mesh.userData.noPick = true;
    parent.add(mesh);
  }

  /**
   * Vessels are not cut (cut tubes look like blades from the side): the part in front of the section is
   * drawn faint instead, so the vessels stay joined to the chambers and the chambers stay visible.
   */
  private ghostInFront(m: THREE.MeshPhysicalMaterial) {
    m.transparent = true;
    const before = m.onBeforeCompile.bind(m);
    m.onBeforeCompile = (shader, r) => {
      before(shader, r);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorldG;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvWorldG = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWorldG;")
        .replace("#include <opaque_fragment>", "#include <opaque_fragment>\ngl_FragColor.a *= mix(1.0, 0.16, smoothstep(0.02, 0.12, vWorldG.z));");
    };
    const key = m.customProgramCacheKey.bind(m);
    m.customProgramCacheKey = () => `${key()}-ghost`;
  }

  /** Where a valve leaflet or cusp is attached, and which way it swings open. */
  private hinge(geo: THREE.BufferGeometry, attachNearBase: boolean, valveCentre: V3) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const base = this.uniforms.uBase.value;
    const axis = this.uniforms.uAxis.value;
    const p = new THREE.Vector3();
    const list = Array.from({ length: pos.count }, (_, i) => {
      p.fromBufferAttribute(pos, i);
      return { i, t: p.clone().sub(base).dot(axis) };
    }).sort((a, b) => (attachNearBase ? a.t - b.t : b.t - a.t));
    const edge = list.slice(0, Math.max(4, Math.floor(list.length * 0.22))).map(({ i }) => new THREE.Vector3().fromBufferAttribute(pos, i));
    const pivot = edge.reduce((s, q) => s.add(q), new THREE.Vector3()).divideScalar(edge.length);
    let a = edge[0];
    let b = edge[1];
    for (const q of edge) if (q.distanceTo(pivot) > a.distanceTo(pivot)) a = q;
    for (const q of edge) if (q.distanceTo(a) > b.distanceTo(a)) b = q;
    const hingeAxis = b.clone().sub(a).normalize();
    const centre = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) centre.add(p.fromBufferAttribute(pos, i));
    centre.divideScalar(pos.count);
    const radial = (q: V3) => {
      const d = q.clone().sub(valveCentre);
      return d.sub(axis.clone().multiplyScalar(d.dot(axis))).length();
    };
    const turned = centre.clone().sub(pivot).applyAxisAngle(hingeAxis, 0.3).add(pivot);
    return { pivot, hingeAxis, sign: radial(turned) > radial(centre) ? 1 : -1 };
  }

  /**
   * The atlas heart, turned into the textbook view: the four-chamber section faces the viewer, base up,
   * apex down and to the right, right heart on the viewer's left.
   */
  private realHeart(o: { cut: boolean; lungs: boolean; blood: boolean; labels: boolean; conduction: boolean }) {
    const { meta, buf } = this.heartData!;
    const outer = new THREE.Group();
    outer.rotation.z = 0.35;
    const inner = new THREE.Group();
    outer.add(inner);
    this.content.add(outer);
    const pc = vec(meta.plane.point);
    const up = vec(meta.plane.up);
    const n = vec(meta.plane.normal);
    const right = new THREE.Vector3().crossVectors(up, n).normalize();
    if (vec(meta.centres.rv).sub(pc).dot(right) > 0) {
      n.negate();
      right.negate();
    }
    inner.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, n)).invert();
    inner.position.copy(pc).applyQuaternion(inner.quaternion).negate();
    outer.updateMatrixWorld(true);
    const base = vec(meta.axis.base);
    const axis = vec(meta.axis.apex).sub(base);
    this.uniforms.uBase.value.copy(base);
    this.uniforms.uLen.value = axis.length();
    this.uniforms.uAxis.value.copy(axis.normalize());
    this.clipPlane = o.cut ? new THREE.Plane(new THREE.Vector3(0, 0, -1), 0) : null;
    this.vesselPlane = o.cut ? new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.32) : null;
    this.capOrder = 10;

    const leaves: { group: THREE.Group; axis: V3; sign: number; av: boolean }[] = [];
    const box = new THREE.Box3();
    for (const p of meta.parts) {
      if (p.role === "lung" && !o.lungs) continue;
      // Branches leading off to the neck and arms end abruptly and look like floating stubs.
      if (p.key === "aortaBranch" || p.key === "cavaBranch") continue;
      if (p.role === "cavity" && !o.blood) continue;
      const look = LOOK[p.role];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(buf.slice(p.positions, p.positions + p.vertexCount * 12)), 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(new Int16Array(buf.slice(p.normals, p.normals + p.vertexCount * 6)), 3, true));
      geo.setIndex(new THREE.BufferAttribute(new Uint16Array(buf.slice(p.indices, p.indices + p.indexCount * 2)), 1));
      const part = PICK[p.key];
      const clip = look.clip && this.clipPlane && !look.vessel ? [this.clipPlane] : [];
      if (p.role === "venousArtery" || p.role === "arterialVein") {
        // Branches running off towards the lungs end in jagged stubs: keep only the part near the heart.
        const P = geo.attributes.position as THREE.BufferAttribute;
        const idx = geo.index!;
        const keep: number[] = [];
        const q = new THREE.Vector3();
        for (let t = 0; t < idx.count; t += 3) {
          let ok = true;
          for (let k = 0; k < 3; k++) {
            q.fromBufferAttribute(P, idx.getX(t + k));
            const d = q.sub(pc);
            if (Math.hypot(d.dot(right), d.dot(n)) > (p.role === "arterialVein" ? 1.25 : 1.75)) ok = false;
          }
          if (ok) keep.push(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
        }
        geo.setIndex(keep);
      }
      const mat = this.beatMaterial(
        this.material(
          {
            color: p.role === "cavity" ? CAVITY_TINT[p.key] : look.color,
            roughness: p.role === "wall" ? 0.55 : 0.42,
            clearcoat: p.role === "lung" ? 0 : 0.35,
            sheen: p.role === "wall" ? 0.4 : 0,
            transparent: !!look.opacity,
            opacity: look.opacity ?? 1,
            depthWrite: !look.opacity,
            clippingPlanes: clip,
          },
          p.role === "lung" ? undefined : part,
        ),
        look.beat,
      );
      if (look.vessel && this.clipPlane) this.ghostInFront(mat);
      let parent: THREE.Object3D = inner;
      if (p.role === "leaflet" || p.role === "cusp") {
        const h = this.hinge(geo, p.role === "leaflet", vec(meta.centres[p.key]));
        geo.translate(-h.pivot.x, -h.pivot.y, -h.pivot.z);
        const group = new THREE.Group();
        group.position.copy(h.pivot);
        inner.add(group);
        parent = group;
        leaves.push({ group, axis: h.hingeAxis, sign: h.sign, av: p.role === "leaflet" });
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.partKey = p.key;
      if (look.opacity) mesh.renderOrder = 500;
      parent.add(mesh);
      if (p.role === "wall" || p.key === "aorta" || p.key === "pulmonary") {
        mesh.updateMatrixWorld(true);
        box.expandByObject(mesh);
      }
      if (look.cap) this.capped(geo, parent, look.cap, look.beat, part);
      if (look.inside) {
        const inner = this.beatMaterial(this.material({ color: look.inside, roughness: 0.6, side: THREE.BackSide, clippingPlanes: clip }, part), look.beat);
        if (look.vessel && this.clipPlane) this.ghostInFront(inner);
        const im = new THREE.Mesh(geo, inner);
        im.userData.partKey = p.key;
        parent.add(im);
      }
    }

    // Descending aorta and inferior vena cava as smooth tubes along their real centrelines.
    for (const [key, line] of Object.entries(meta.tubes ?? {})) {
      if (line.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(line.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
      const r = line.reduce((t, q) => t + q[3], 0) / line.length;
      const geo = new THREE.TubeGeometry(curve, 32, r, 20);
      const blue = key === "ivc";
      const mat = this.beatMaterial(this.material({ color: blue ? "#4a5fc1" : "#c62f36", roughness: 0.42, clearcoat: 0.35 }, blue ? "cava" : "aorta"), 0.3);
      if (this.clipPlane) this.ghostInFront(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.partKey = key;
      inner.add(mesh);
    }

    // Conduction system, drawn just in front of the cut surface.
    const lift = n.clone().multiplyScalar(0.05);
    const nodes: THREE.Mesh[] = [];
    const condMat = this.beatMaterial(this.material({ color: "#f5c542", roughness: 0.4, emissive: "#f2b632", emissiveIntensity: 0.4 }, "conduction"), 1);
    const { sa, av, septum } = meta.conduction;
    if (o.conduction && sa && av) {
      for (const q of [sa, av]) {
        const m = new THREE.Mesh(this.sphere, condMat);
        m.position.copy(vec(q)).add(lift);
        m.scale.setScalar(0.09);
        m.userData.partKey = "conduction";
        inner.add(m);
        nodes.push(m);
      }
      const path = [vec(av), ...septum.map(vec)].map((q) => q.add(lift));
      if (path.length > 2) {
        const m = this.tube(path, 0.03, condMat, inner, 80);
        m.userData.partKey = "conduction";
      }
    }

    // A point to hang a label on: on (just behind) the cut surface, never in the removed half.
    const onCut = (q: V3) => {
      const d = q.clone().sub(pc).dot(n);
      return d > -0.1 && o.cut ? q.clone().sub(n.clone().multiplyScalar(d + 0.1)) : q.clone();
    };
    const partCentre = (id: string) => vec(meta.parts.find((x: PartData) => x.id === id)!.centre);
    if (o.labels) {
      const at = (part: HeartPart, q: V3) => this.label(this.anchor(inner, q), PARTS[part].name, "label", part);
      for (const k of ["ra", "rv", "la", "lv"] as const) at(k, vec(meta.onSection[k]).sub(n.clone().multiplyScalar(0.12)));
      if (septum.length) at("septum", vec(septum[Math.floor(septum.length / 2)]).add(lift));
      at("myocardium", vec(meta.onSection.wallLV).add(lift));
      at("tricuspid", onCut(vec(meta.centres.tricuspid)));
      at("mitral", onCut(vec(meta.centres.mitral)));
      at("semilunar", onCut(vec(meta.centres.aorticValve)));
      at("papillary", onCut(vec(meta.centres.papillary)));
      const coronaries = meta.parts.filter((x: PartData) => x.key === "coronary").sort((x: PartData, y: PartData) => vec(x.centre).sub(pc).dot(n) - vec(y.centre).sub(pc).dot(n));
      if (coronaries.length) at("coronary", vec(coronaries[0].centre));
      at("aorta", onCut(partCentre("FJ3411")));
      at("pulmonary", onCut(partCentre("FJ2966")));
      at("pulmVeins", onCut(vec(meta.centres.pulmVeins)));
      at("cava", onCut(vec(meta.centres.svc)));
      if (sa) at("conduction", vec(sa).add(lift));
    }
    this.heartInner = inner;
    return { outer, inner, leaves, nodes, condMat, n, pc, box, partCentre };
  }

  /** Beat: shared uniforms, leaflets on their hinges, conduction glow. */
  private beatHeart(h: ReturnType<HeartScene["realHeart"]>, amplitude = 1, period?: number) {
    this.tickers.push((dt) => {
      if (this.opts.playing && !this.reduceMotion) this.beat += dt / (period ?? (this.opts.slow ? 3.2 : 0.8));
      const c = this.cycle();
      this.uniforms.uVent.value = c.vent * amplitude;
      this.uniforms.uAtr.value = c.atr * amplitude;
      for (const l of h.leaves) l.group.quaternion.setFromAxisAngle(l.axis, l.sign * (l.av ? -0.12 + 0.5 * c.avOpen : -0.08 + 0.55 * c.slOpen));
      if (h.nodes.length && this.selected !== "conduction") {
        const sa = gauss(c.f, 0.03, 0.03);
        const avn = gauss(c.f, 0.1, 0.03);
        const his = gauss(c.f, 0.145, 0.025);
        h.nodes[0].scale.setScalar(0.09 * (1 + 0.8 * sa));
        h.nodes[1].scale.setScalar(0.09 * (1 + 0.8 * avn));
        h.condMat.emissiveIntensity = 0.35 + 1.4 * Math.max(sa, avn, his);
      }
      if (c.phase !== this.phase) {
        this.phase = c.phase;
        this.callbacks.onPhase(c.phase);
      }
    });
  }

  private frame3(box: THREE.Box3, k = 1.25) {
    const size = box.getSize(new THREE.Vector3());
    return { distance: Math.max(size.y * 1.75, size.x * 1.35) * k, target: box.getCenter(new THREE.Vector3()), width: size.x * 1.1 * k };
  }

  // ---- Views ----------------------------------------------------------------------------------------

  private buildStructure() {
    this.picking = true;
    const h = this.realHeart({ cut: true, lungs: false, blood: true, labels: true, conduction: true });
    this.beatHeart(h, 0.35, 2.4);
    return { ...this.frame3(h.box, 1), dir: v(0, 0.08, 1) };
  }

  private buildCycle() {
    const h = this.realHeart({ cut: true, lungs: false, blood: true, labels: false, conduction: true });
    this.beatHeart(h);
    const { meta } = this.heartData!;
    const lift = h.n.clone().multiplyScalar(0.05);
    const L = (name: string, q: V3) => this.label(this.anchor(h.inner, q), name);
    const { sa, av, septum } = meta.conduction;
    if (sa) L("სინუსური კვანძი", vec(sa).add(lift));
    if (av) L("წინაგულ-პარკუჭოვანი კვანძი", vec(av).add(lift));
    if (septum.length) L("ჰისის კონა", vec(septum[Math.floor(septum.length * 0.6)]).add(lift));
    // Blood through the real chambers: held back and pushed on by the valves.
    const C = (k: string) => vec(meta.centres[k]);
    const apex = vec(meta.axis.apex);
    const axis = this.uniforms.uAxis.value.clone();
    const paths = [
      { pts: [h.partCentre("FJ3645").addScaledVector(axis, -0.6), C("svc"), C("ra"), C("tricuspid"), C("rv"), C("rv").lerp(apex, 0.35), C("rv"), C("pulmonaryValve"), h.partCentre("FJ2966"), h.partCentre("FJ3019")], vent: 5, color: BLUE },
      { pts: [C("pulmVeins"), C("la"), C("mitral"), C("lv"), C("lv").lerp(apex, 0.4), C("lv"), C("aorticValve"), h.partCentre("FJ3413"), h.partCentre("FJ3411"), h.partCentre("FJ3427")], vent: 4, color: RED },
    ];
    const rand = rng(5);
    const COUNT = 80;
    const flows = paths.map((path) => {
      const curve = new THREE.CatmullRomCurve3(path.pts);
      const samples = curve.getSpacedPoints(400);
      const target = path.pts[path.vent];
      let best = 0;
      samples.forEach((q, i) => {
        if (q.distanceTo(target) < samples[best].distanceTo(target)) best = i;
      });
      const mesh = new THREE.InstancedMesh(this.sphere, this.material({ color: path.color, roughness: 0.4, clippingPlanes: this.clipPlane ? [this.clipPlane] : [] }), COUNT);
      mesh.userData.noPick = true;
      h.inner.add(mesh);
      return { curve, sV: best / 400, mesh, s: Array.from({ length: COUNT }, () => rand()), jitter: Array.from({ length: COUNT }, () => v(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.22)) };
    });
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scl = v(0.05, 0.05, 0.05);
    const p = new THREE.Vector3();
    this.tickers.push((dt) => {
      const c = this.cycle();
      const step = this.opts.playing && !this.reduceMotion ? dt / (this.opts.slow ? 3.2 : 0.8) : 0;
      const systole = c.vent > 0.3;
      for (const fl of flows) {
        for (let i = 0; i < COUNT; i++) {
          let s = fl.s[i];
          const speed = s < fl.sV ? (systole ? 0 : 0.3) : s < fl.sV + 0.1 ? (systole ? 1.6 : 0) : systole ? 1.6 : 0.25;
          s += speed * step;
          if (s >= 1) s -= 1;
          fl.s[i] = s;
          fl.curve.getPointAt(s, p).add(fl.jitter[i]);
          m4.compose(p, q, scl);
          fl.mesh.setMatrixAt(i, m4);
        }
        fl.mesh.instanceMatrix.needsUpdate = true;
      }
    });
    const draw = this.chart("ეკგ");
    this.tickers.push(() => draw(ecg, -0.35, 1.05));
    return { ...this.frame3(h.box, 1), dir: v(0, 0.08, 1) };
  }

  /**
   * A vessel wall: a lathe of a closed (radius, length) profile with a quarter cut away (facing +y +z after
   * the group is turned to run along x), and flat faces where it is cut.
   */
  private wall(parent: THREE.Object3D, rIn: (y: number) => number, rOut: (y: number) => number, len: number, color: string) {
    const n = 80;
    const ys = Array.from({ length: n + 1 }, (_, i) => -len / 2 + (len * i) / n);
    const profile = [...ys.map((y) => new THREE.Vector2(rIn(y), y)), ...ys.reverse().map((y) => new THREE.Vector2(rOut(y), y))];
    profile.push(profile[0].clone());
    const mat = this.material({ color, roughness: 0.55, side: THREE.DoubleSide });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 48, 0, Math.PI * 1.5), mat));
    const shape = new THREE.Shape(profile.slice(0, -1));
    for (const phi of [0, Math.PI * 1.5]) {
      const geo = new THREE.ShapeGeometry(shape, 1);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const r = p.getX(i);
        p.setXYZ(i, r * Math.sin(phi), p.getY(i), r * Math.cos(phi));
      }
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, mat));
    }
    parent.add(g);
    return g;
  }

  /** Red cells flowing along x inside a vessel; `lumen(x)` limits how far from the axis they go. */
  private redCells(parent: THREE.Object3D, count: number, len: number, lumen: (x: number) => number, speed: (x: number) => number, size: number, seed: number) {
    const rand = rng(seed);
    const geo = new THREE.SphereGeometry(1, 20, 12);
    geo.scale(1, 1, 0.38);
    const mesh = new THREE.InstancedMesh(geo, this.material({ color: "#c0282f", roughness: 0.4, sheen: 0.5 }), count);
    parent.add(mesh);
    const cells = Array.from({ length: count }, () => ({ x: (rand() - 0.5) * len, a: rand() * Math.PI * 2, r: Math.sqrt(rand()), spin: v(rand(), rand(), rand()).normalize(), rot: rand() * 6 }));
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tick = (dt: number) => {
      for (let i = 0; i < count; i++) {
        const c = cells[i];
        c.x += speed(c.x) * dt;
        if (c.x > len / 2) c.x -= len;
        c.rot += dt * 0.8;
        const rad = Math.max(0, lumen(c.x) - size) * c.r;
        q.setFromAxisAngle(c.spin, c.rot);
        m4.compose(v(c.x, Math.cos(c.a) * rad, Math.sin(c.a) * rad), q, v(size, size, size));
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    tick(0);
    this.tickers.push((dt) => tick(this.reduceMotion ? 0 : dt));
    return mesh;
  }

  private buildVessels() {
    const L = 5;
    const row = (y: number) => {
      const g = new THREE.Group();
      g.position.y = y;
      this.content.add(g);
      const tube = new THREE.Group();
      tube.rotation.z = -Math.PI / 2; // lathe axis (y) → x
      g.add(tube);
      return { g, tube };
    };
    // Artery: three thick layers.
    const art = row(2.7);
    this.wall(art.tube, () => 0.62, () => 0.67, L, "#f3c6c6");
    this.wall(art.tube, () => 0.67, () => 1.0, L, "#d9707a");
    this.wall(art.tube, () => 1.0, () => 1.18, L, "#efe0cf");
    this.redCells(art.g, 40, L, () => 0.6, () => 1.6, 0.17, 1);
    // Vein: wide, thin, a little flattened, with a valve.
    const vein = row(0);
    vein.g.scale.set(1, 0.8, 1);
    this.wall(vein.tube, () => 0.8, () => 0.83, L, "#e5c6d6");
    this.wall(vein.tube, () => 0.83, () => 0.92, L, "#c98aa6");
    this.wall(vein.tube, () => 0.92, () => 1.04, L, "#efe0cf");
    const flapMat = this.material({ color: "#e9cfe0", side: THREE.DoubleSide, roughness: 0.6 });
    const flaps: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(-0.3, side * 0.78, 0);
      const flap = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.03, 1.1), flapMat);
      flap.position.x = 0.375;
      pivot.add(flap);
      vein.g.add(pivot);
      flaps.push(pivot);
    }
    this.tickers.push(() => {
      const t = this.clock.elapsedTime;
      const open = 0.5 + 0.5 * Math.sin(t * 1.6);
      flaps.forEach((f, i) => (f.rotation.z = (i ? -1 : 1) * (0.5 + 0.35 * (1 - open))));
    });
    this.redCells(vein.g, 34, L, () => 0.72, () => 0.6 + 0.4 * Math.max(0, Math.sin(this.clock.elapsedTime * 1.6)), 0.17, 2);
    // Capillary: one layer of flat cells; red cells in single file; oxygen out, carbon dioxide in.
    const cap = row(-2.5);
    this.wall(cap.tube, () => 0.24, () => 0.3, L, "#f2c9b8");
    const nuclei: THREE.Matrix4[] = [];
    for (let i = 0; i < 9; i++)
      for (const a of [0.4, 2.1, 3.6]) {
        const x = -L / 2 + 0.3 + i * 0.55 + (a > 2 ? 0.27 : 0);
        nuclei.push(new THREE.Matrix4().compose(v(x, Math.cos(a) * 0.3, -Math.sin(a) * 0.3), new THREE.Quaternion().setFromUnitVectors(v(0, 0, 1), v(0, Math.cos(a), -Math.sin(a))), v(0.12, 0.08, 0.04)));
      }
    const nm = new THREE.InstancedMesh(this.sphere, this.material({ color: "#7d5ba6" }), nuclei.length);
    nuclei.forEach((m, i) => nm.setMatrixAt(i, m));
    cap.g.add(nm);
    this.redCells(cap.g, 9, L, () => 0.22, () => 0.45, 0.2, 3);
    const gas = (color: string, out: boolean, seed: number) => {
      const rand = rng(seed);
      const n = 14;
      const mesh = new THREE.InstancedMesh(this.sphere, this.material({ color, emissive: color, emissiveIntensity: 0.25 }), n);
      cap.g.add(mesh);
      const ps = Array.from({ length: n }, () => ({ x: (rand() - 0.5) * (L - 0.6), a: Math.PI * (0.6 + rand() * 1.6), u: rand() }));
      const m4 = new THREE.Matrix4();
      this.tickers.push((dt) => {
        for (let i = 0; i < n; i++) {
          const g2 = ps[i];
          g2.u = (g2.u + (this.reduceMotion ? 0 : dt) * 0.35) % 1;
          const r = out ? 0.1 + g2.u * 0.9 : 1.0 - g2.u * 0.9;
          m4.compose(v(g2.x, Math.cos(g2.a) * r, -Math.sin(g2.a) * r), new THREE.Quaternion(), v(0.05, 0.05, 0.05));
          mesh.setMatrixAt(i, m4);
        }
        mesh.instanceMatrix.needsUpdate = true;
      });
    };
    gas("#6fc3ef", true, 7);
    gas("#9aa3ab", false, 8);

    const A = (parent: THREE.Object3D, p: V3, text: string, kind: "label" | "tag" = "label") => this.label(this.anchor(parent, p), text, kind);
    A(art.g, v(-3.3, 0, 0), "არტერია · გულიდან →", "tag");
    A(vein.g, v(-3.3, 0, 0), "ვენა · გულისკენ →", "tag");
    A(cap.g, v(-3.3, 0, 0), "კაპილარი", "tag");
    A(art.g, v(2.5, -0.45, 0.45), "შიგნითა შრე (ენდოთელიუმი)");
    A(art.g, v(2.5, -0.6, 0.6), "შუა შრე: გლუვი კუნთი, ელასტიკური ბოჭკოები");
    A(art.g, v(2.5, -0.77, 0.77), "გარეთა შრე: შემაერთებელი ქსოვილი");
    A(vein.g, v(0.1, -0.55, 0.3), "სარქველი");
    A(vein.g, v(2.5, -0.62, 0.62), "თხელი კედელი");
    A(cap.g, v(1.2, -0.21, 0.21), "კედელი — ერთი შრე უჯრედი");
    A(cap.g, v(-0.6, 0, 0), "ერითროციტები ერთ რიგად");
    A(cap.g, v(-1.6, -0.6, 0.5), "O₂ → ქსოვილებში");
    A(cap.g, v(1.9, 0.75, -0.3), "CO₂ → სისხლში");
    return { distance: 12, dir: v(0.15, 0.3, 1), width: 12.5, target: v(0.7, 0, 0) };
  }

  private buildCirculation() {
    const h = this.realHeart({ cut: true, lungs: true, blood: false, labels: false, conduction: false });
    this.beatHeart(h, 0.6, 1.6);
    const { meta } = this.heartData!;
    const W = (q: V3) => h.inner.localToWorld(q.clone());
    const C = (k: string) => W(vec(meta.centres[k]));
    const P = (id: string) => W(h.partCentre(id));
    const apex = W(vec(meta.axis.apex));
    const lv = vec(meta.centres.lv);
    const rv = vec(meta.centres.rv);
    const lvApex = W(lv.clone().lerp(vec(meta.axis.apex), 0.35));
    const rvApex = W(rv.clone().lerp(vec(meta.axis.apex), 0.3));
    const bodyY = Math.min(apex.y, P("FJ3441").y) - 3.6;
    // Lungs: capillary zones inside each lung.
    const lungZone = (key: string) => {
      const c = C(key);
      return [c.clone().add(v(0, 1.2, 0.3)), c.clone().add(v(Math.sign(c.x) * 0.9, 0.3, 0.3)), c.clone().add(v(0, -0.9, 0.3)), c.clone().add(v(-Math.sign(c.x) * 0.4, -0.3, 0.3))];
    };
    type Pt = [V3, number, "p" | "s", boolean];
    const loop = (lungKey: "lungR" | "lungL"): Pt[] => {
      const zone = lungZone(lungKey);
      const artery = lungKey === "lungR" ? P("FJ3019") : P("FJ2924");
      const vein = lungKey === "lungR" ? P("FJ3020") : P("FJ2933");
      return [
        [C("ra"), 0, "s", false],
        [C("tricuspid"), 0, "p", false],
        [rvApex, 0, "p", false],
        [C("pulmonaryValve"), 0, "p", false],
        [P("FJ2966"), 0, "p", false],
        [artery, 0, "p", true],
        [zone[0], 0.05, "p", true],
        [zone[1], 0.4, "p", true],
        [zone[2], 0.75, "p", true],
        [zone[3], 0.96, "p", true],
        [vein, 1, "p", true],
        [C("la"), 1, "s", false],
        [C("mitral"), 1, "s", false],
        [lvApex, 1, "s", false],
        [C("aorticValve"), 1, "s", false],
        [P("FJ3413"), 1, "s", false],
        [P("FJ3411"), 1, "s", false],
        [P("FJ3427"), 1, "s", true],
        [v(1.4, bodyY + 1.2, -0.4), 1, "s", true],
        [v(1.4, bodyY, 0.1), 0.95, "s", true],
        [v(0.4, bodyY - 0.9, 0.3), 0.6, "s", true],
        [v(-0.6, bodyY - 0.2, 0.3), 0.3, "s", true],
        [v(-1.3, bodyY + 0.5, 0), 0.04, "s", true],
        [P("FJ3441"), 0, "s", true],
        [C("ra"), 0, "s", false],
      ];
    };
    const loops = [loop("lungR"), loop("lungL")];
    const venous = { p: this.material({ color: BLUE, roughness: 0.45 }), s: this.material({ color: BLUE, roughness: 0.45 }) };
    const arterial = { p: this.material({ color: RED, roughness: 0.45 }), s: this.material({ color: RED, roughness: 0.45 }) };
    const capMat = { p: this.material({ color: "#9a4f9a", roughness: 0.5 }), s: this.material({ color: "#9a4f9a", roughness: 0.5 }) };
    this.circuitMats.pulmonary.push(venous.p, arterial.p, capMat.p);
    this.circuitMats.systemic.push(venous.s, arterial.s, capMat.s);
    loops.forEach((lp, k) => {
      for (let i = 0; i < lp.length - 1; i++) {
        const [a, oa, ca, ta] = lp[i];
        const [b, ob] = lp[i + 1];
        if (!ta || !lp[i + 1][3]) continue;
        if (k === 1 && ca === "s") continue; // the systemic part is shared
        const mid = (x: number) => x > 0.02 && x < 0.98;
        const kind = mid(oa) && mid(ob) ? capMat : (oa + ob) / 2 >= 0.5 ? arterial : venous;
        this.tube([a, a.clone().lerp(b, 0.5), b], kind === capMat ? 0.06 : 0.11, kind[ca], this.content, 16);
      }
    });
    const body = new THREE.Mesh(this.sphere, this.material({ color: "#e9c39a", roughness: 0.7, transparent: true, opacity: 0.4, depthWrite: false }));
    body.scale.set(2.4, 1.1, 0.8);
    body.position.set(0.1, bodyY - 0.1, 0);
    this.content.add(body);

    const rand = rng(9);
    const COUNT = 90;
    const flows = loops.map((lp) => {
      const curve = new THREE.CatmullRomCurve3(lp.slice(0, -1).map(([q]) => q), true);
      const nPts = lp.length - 1;
      const oxyAt = (t: number) => {
        const x = t * nPts;
        const i = Math.floor(x) % nPts;
        return lp[i][1] + (lp[(i + 1) % nPts][1] - lp[i][1]) * (x - Math.floor(x));
      };
      const circuitAt = (t: number) => lp[Math.floor(t * nPts) % nPts][2];
      const mesh = new THREE.InstancedMesh(this.sphere, this.material({ color: "#ffffff", roughness: 0.4 }), COUNT);
      mesh.userData.noPick = true;
      this.content.add(mesh);
      return { curve, oxyAt, circuitAt, mesh, s: Array.from({ length: COUNT }, () => rand()) };
    });
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    const p = new THREE.Vector3();
    this.tickers.push((dt) => {
      const step = this.opts.playing && !this.reduceMotion ? dt * 0.03 : 0;
      for (const fl of flows) {
        for (let i = 0; i < COUNT; i++) {
          fl.s[i] = (fl.s[i] + step) % 1;
          const t = fl.curve.getUtoTmapping(fl.s[i], 0);
          fl.curve.getPoint(t, p);
          const c = fl.circuitAt(t);
          const dim = this.opts.circuit !== "both" && (this.opts.circuit === "pulmonary" ? c !== "p" : c !== "s");
          m4.compose(p, q, v(1, 1, 1).multiplyScalar(dim ? 0.0001 : 0.08));
          fl.mesh.setMatrixAt(i, m4);
          fl.mesh.setColorAt(i, col.copy(BLUE).lerp(RED, fl.oxyAt(t)));
        }
        fl.mesh.instanceMatrix.needsUpdate = true;
        if (fl.mesh.instanceColor) fl.mesh.instanceColor.needsUpdate = true;
      }
    });
    const A = (q2: V3, text: string, kind: "label" | "tag" = "label") => this.label(this.anchor(this.content, q2), text, kind);
    const lr = C("lungR");
    const ll = C("lungL");
    A(v(0, Math.max(lr.y, ll.y) + 3.2, 0), "მცირე (ფილტვის) წრე", "tag");
    A(v(0, bodyY - 1.6, 0), "დიდი წრე", "tag");
    A(lr.clone().add(v(0, 1.2, 0.5)), "მარჯვენა ფილტვი: CO₂ ↔ O₂");
    A(ll.clone().add(v(0, 1.2, 0.5)), "მარცხენა ფილტვი");
    A(v(0.1, bodyY, 1), "ორგანოების კაპილარები");
    A(P("FJ2966"), "ფილტვის ღერო");
    A(P("FJ3411"), "აორტა");
    A(P("FJ3441"), "ქვედა ღრუ ვენა");
    A(C("ra"), "მარჯვ. წინაგული");
    A(rvApex, "მარჯვ. პარკუჭი");
    A(C("la"), "მარცხ. წინაგული");
    A(lvApex, "მარცხ. პარკუჭი");
    const all = h.box.clone();
    this.content.updateMatrixWorld(true);
    this.content.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && !m.userData.noPick && m.geometry !== this.capGeo) all.expandByObject(m);
    });
    const f = this.frame3(all, 0.95);
    return { ...f, dir: v(0, 0.05, 1) };
  }

  private buildPulse() {
    const L = 9;
    const geo = new THREE.CylinderGeometry(1, 1, L, 48, 220, true);
    geo.rotateZ(Math.PI / 2);
    const base = Float32Array.from(geo.attributes.position.array);
    const mesh = new THREE.Mesh(geo, this.material({ color: "#d9707a", roughness: 0.4, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }));
    mesh.renderOrder = 2;
    this.content.add(mesh);
    const waveTag = this.anchor(this.content, v(0, 0, 0));
    this.label(waveTag, "პულსური ტალღა");
    this.label(this.anchor(this.content, v(-L / 2 - 0.3, 0, 0)), "გულიდან →", "tag");
    this.label(this.anchor(this.content, v(-1.5, -0.8, 0.6)), "არტერიის ელასტიკური კედელი");
    const centre = () => {
      const f = ((this.beat % 1) + 1) % 1;
      return -L / 2 + ((f - 0.14 + 1) % 1) * L * 1.6;
    };
    const lumen = (x: number) => 0.9 * (1 + 0.16 * gauss(x, centre(), 0.7));
    this.redCells(this.content, 70, L, lumen, (x) => 0.8 + 3 * gauss(x, centre(), 1.0), 0.17, 4);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    this.tickers.push((dt) => {
      if (this.opts.playing && !this.reduceMotion) this.beat += dt / (this.opts.slow ? 3.2 : 0.8);
      const c = centre();
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const k = 1 + 0.16 * gauss(x, c, 0.7);
        pos.setXYZ(i, x, base[i * 3 + 1] * k, base[i * 3 + 2] * k);
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
      waveTag.position.set(Math.min(L / 2, Math.max(-L / 2, c)), 1.25, 0);
      waveTag.visible = c > -L / 2 && c < L / 2;
    });
    const draw = this.chart("არტერიული წნევა, მმ ვწყ. სვ.");
    this.tickers.push(() => draw(pressure, 70, 130, [{ y: 120, text: "120 — სისტოლური" }, { y: 80, text: "80 — დიასტოლური" }]));
    return { distance: 11, dir: v(0.15, 0.35, 1), width: 10.5 };
  }

  private buildDisease(disease: boolean) {
    const L = 7;
    const tube = new THREE.Group();
    tube.rotation.z = -Math.PI / 2;
    this.content.add(tube);
    // In the tube's frame, length runs along y; after the turn, world x = tube y.
    const plaque = (y: number) => (disease ? 0.6 * gauss(y, 0.3, 1.1) : 0);
    const R = 1.2;
    this.wall(tube, () => R + 0.05, () => R + 0.45, L, "#d9707a");
    this.wall(tube, () => R + 0.45, () => R + 0.65, L, "#efe0cf");
    if (disease) {
      this.wall(tube, (y) => R + 0.05 - plaque(y), () => R + 0.05, L, "#f2cf5b");
      this.wall(tube, (y) => R - plaque(y), (y) => R + 0.05 - plaque(y), L, "#f3c6c6");
    } else this.wall(tube, () => R, () => R + 0.05, L, "#f3c6c6");
    // World x = −(tube y): the turn maps tube y to world x with a sign; flow runs to +x.
    const lumen = (x: number) => R - plaque(-x);
    this.redCells(this.content, disease ? 80 : 60, L, lumen, (x) => (disease ? 1.3 * (R / lumen(x)) ** 2 * 0.5 : 1.3), 0.2, 6);
    if (disease) {
      const clot = new THREE.Mesh(this.sphere, this.material({ color: "#6e1418", roughness: 0.8 }));
      clot.scale.set(0.35, 0.22, 0.3);
      clot.position.set(-0.3 + 0.2, -(R - 0.6) + 0.05, 0);
      this.content.add(clot);
      this.label(this.anchor(this.content, v(-0.3, -0.62, 0.45)), "ფოლაქი: ქოლესტერინი და ცხიმები");
      this.label(this.anchor(this.content, clot.position), "თრომბი");
      this.label(this.anchor(this.content, v(-0.3, 0.2, 0)), "შევიწროებული სანათური");
    } else {
      this.label(this.anchor(this.content, v(0, 0, 0)), "ჯანმრთელი არტერია — ფართო სანათური");
      this.label(this.anchor(this.content, v(1.6, -1.1, 1.1)), "ელასტიკური კედელი");
    }
    return { distance: 10, dir: v(0.2, 0.35, 1), width: 9.5 };
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
      if (hit.object.userData.noPick) continue;
      // The front half is cut away: what lies there is not visible.
      if (this.clipPlane && this.clipPlane.distanceToPoint(hit.point) < -0.001 && hit.object.userData.partKey !== "conduction") continue;
      const key = hit.object.userData.partKey as string | undefined;
      if (!key) continue;
      let part: HeartPart = key === "conduction" ? "conduction" : PICK[key];
      if (!part) continue;
      if (key === "ventricles" && this.heartInner && this.heartData) {
        // The septum: ventricle wall close to the line between the two ventricles.
        const local = this.heartInner.worldToLocal(hit.point.clone());
        const near = this.heartData.meta.conduction.septum.some((q) => vec(q).distanceTo(local) < 0.22);
        if (near) part = "septum";
      }
      return this.callbacks.onPick(part);
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
  private sizes = new WeakMap<HTMLElement, { w: number; h: number }>();
  private placeLabels() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const order = [...this.labels].sort((a, b) => Number(!!b.part && b.part === this.selected) - Number(!!a.part && a.part === this.selected));
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const l of order) {
      l.target.updateWorldMatrix(true, false);
      l.target.getWorldPosition(this.tmp);
      this.tmp.project(this.camera);
      const x = ((this.tmp.x + 1) / 2) * w;
      const y = ((1 - this.tmp.y) / 2) * h;
      let visible = l.target.visible && this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.05 && Math.abs(this.tmp.y) < 1.05;
      if (visible) {
        let size = this.sizes.get(l.el);
        if (!size?.w) {
          size = { w: l.el.offsetWidth, h: l.el.offsetHeight };
          this.sizes.set(l.el, size);
        }
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
    for (const tick of this.tickers) tick(dt);
    if (this.selected) for (const m of this.partMats.get(this.selected) ?? []) m.emissiveIntensity = this.reduceMotion ? 0.25 : 0.18 + 0.14 * Math.sin(this.clock.elapsedTime * 4);
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
