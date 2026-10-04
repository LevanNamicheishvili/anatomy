import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { fbm, smoothstep } from "@/lib/noise";
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

// ---- Heart geometry (heart frame) ---------------------------------------------------------------------

/** Outline of the frontal section: wide base on top, narrowing to the apex. */
function outlinePoint(t: number): [number, number] {
  const c = Math.cos(t);
  const s = Math.sin(t);
  const x = 1.3 * c * (s < 0 ? 1 - 0.38 * Math.pow(-s, 1.5) : 1 - 0.08 * s);
  const y = s > 0 ? 1.15 * s : 1.75 * s;
  return [x, y];
}
const OUTLINE = Array.from({ length: 180 }, (_, i) => outlinePoint((i / 180) * Math.PI * 2));
const DEPTH = 1.05;

interface Chamber {
  id: "ra" | "rv" | "la" | "lv";
  c: [number, number];
  r: [number, number];
  depth: number;
  color: string;
}
const CH: Record<Chamber["id"], Chamber> = {
  ra: { id: "ra", c: [-0.58, 0.5], r: [0.4, 0.42], depth: 0.5, color: "#5d4e98" },
  rv: { id: "rv", c: [-0.47, -0.42], r: [0.43, 0.6], depth: 0.55, color: "#4f4389" },
  la: { id: "la", c: [0.5, 0.52], r: [0.38, 0.32], depth: 0.45, color: "#a8242c" },
  lv: { id: "lv", c: [0.48, -0.55], r: [0.34, 0.8], depth: 0.5, color: "#931f27" },
};
const inside = (ch: Chamber, x: number, y: number) => ((x - ch.c[0]) / ch.r[0]) ** 2 + ((y - ch.c[1]) / ch.r[1]) ** 2 < 1;

/**
 * The cavity of an atrium joined with its ventricle (they meet where the valve is): the outline of the
 * union of two overlapping ellipses, plus the two points where they cross (the valve ring).
 */
function union(a: Chamber, b: Chamber) {
  const pts = (ch: Chamber, other: Chamber) =>
    Array.from({ length: 120 }, (_, i) => {
      const t = (i / 120) * Math.PI * 2;
      return [ch.c[0] + ch.r[0] * Math.cos(t), ch.c[1] + ch.r[1] * Math.sin(t), ch === a ? 0 : 1] as const;
    }).filter(([x, y]) => !inside(other, x, y));
  // Centre of the lens where both overlap.
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let x = -1.5; x <= 1.5; x += 0.01)
    for (let y = -1.5; y <= 1.5; y += 0.01)
      if (inside(a, x, y) && inside(b, x, y)) {
        sx += x;
        sy += y;
        n++;
      }
  const lens = [sx / n, sy / n];
  const all = [...pts(a, b), ...pts(b, a)].sort((p, q) => Math.atan2(p[1] - lens[1], p[0] - lens[0]) - Math.atan2(q[1] - lens[1], q[0] - lens[0]));
  const corners: [number, number][] = [];
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    const q = all[(i + 1) % all.length];
    if (p[2] !== q[2]) corners.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]);
  }
  corners.sort((p, q) => p[0] - q[0]);
  return { poly: all.map(([x, y]) => new THREE.Vector2(x, y)), lens, corners };
}
const RIGHT = union(CH.ra, CH.rv);
const LEFT = union(CH.la, CH.lv);

/** Vertex-shader beat: ventricles squeeze towards the base and the septum, atria shrink a little. */
const DEFORM = /* glsl */ `
  vec3 hp = transformed;
  float fv = smoothstep(0.15, -1.5, hp.y);
  float fa = smoothstep(0.1, 1.1, hp.y);
  float kv = 0.12 * uVent * fv;
  float ka = 0.1 * uAtr * fa;
  transformed.x = 0.05 + (hp.x - 0.05) * (1.0 - kv - ka);
  transformed.z = hp.z * (1.0 - kv - ka);
  transformed.y = 0.12 + (hp.y - 0.12) * (1.0 - 0.6 * kv - 0.5 * ka);
`;

const VESSELS: { part: HeartPart; r: number; color: THREE.Color; pts: [number, number, number][] }[] = [
  { part: "aorta", r: 0.17, color: RED, pts: [[0.25, 0.85, -0.2], [0.18, 1.5, -0.3], [0.2, 1.9, -0.38], [0.5, 2.1, -0.48], [0.9, 1.85, -0.6], [1.02, 1.2, -0.7], [1.02, 0.3, -0.8]] },
  { part: "pulmonary", r: 0.16, color: BLUE, pts: [[-0.15, 0.8, 0.05], [-0.12, 1.25, 0.12], [-0.1, 1.5, 0.15]] },
  { part: "pulmonary", r: 0.11, color: BLUE, pts: [[-0.1, 1.5, 0.15], [-0.6, 1.6, 0.05], [-1.3, 1.5, -0.2]] },
  { part: "pulmonary", r: 0.11, color: BLUE, pts: [[-0.1, 1.5, 0.15], [0.5, 1.62, 0.05], [1.3, 1.5, -0.2]] },
  { part: "cava", r: 0.14, color: BLUE, pts: [[-0.72, 2.05, -0.3], [-0.7, 1.4, -0.25], [-0.62, 0.85, -0.2]] },
  { part: "cava", r: 0.15, color: BLUE, pts: [[-0.6, -1.75, -0.45], [-0.64, -0.7, -0.5], [-0.62, 0.25, -0.3]] },
  { part: "pulmVeins", r: 0.085, color: RED, pts: [[1.65, 0.95, -0.3], [1.0, 0.78, -0.3], [0.62, 0.62, -0.2]] },
  { part: "pulmVeins", r: 0.085, color: RED, pts: [[1.65, 0.42, -0.36], [1.0, 0.48, -0.35], [0.62, 0.48, -0.25]] },
  { part: "pulmVeins", r: 0.08, color: RED, pts: [[-1.45, 0.9, -0.62], [-0.3, 0.72, -0.78], [0.45, 0.62, -0.42]] },
];

/** Conduction system on the cut face: sinus node, AV node, bundle of His and its branches. */
const SA = v(-0.55, 0.97, 0.03);
const AV = v(-0.03, 0.2, 0.03);
const BUNDLE: [number, number][][] = [
  [[-0.03, 0.2], [0.05, -0.1], [0.05, -1.0], [0.3, -1.35], [0.82, -0.95]],
  [[0.05, -1.0], [-0.2, -1.12], [-0.88, -0.8]],
];

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
  private uniforms = { uVent: { value: 0 }, uAtr: { value: 0 } };
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
  private shared = new Set<THREE.BufferGeometry>([this.sphere]);

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    private callbacks: Callbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
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
  }

  // ---- Public ---------------------------------------------------------------------------------------

  setView(view: HeartView, opts: HeartOptions) {
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
    this.controls.minAzimuthAngle = view === "structure" || view === "cycle" ? -1.2 : -Infinity;
    this.controls.maxAzimuthAngle = view === "structure" || view === "cycle" ? 1.2 : Infinity;
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

  /** Heart materials beat with the shared uniforms; chambers also hide the part inside the joined cavity. */
  private beating<T extends THREE.Material>(m: T, hideInside?: Chamber): T {
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uVent;\nuniform float uAtr;\nvarying vec3 vHeart;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>\nvHeart = position;\n${DEFORM}`);
      if (hideInside) {
        const [cx, cy] = hideInside.c;
        const [rx, ry] = hideInside.r;
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vHeart;")
          .replace(
            "#include <clipping_planes_fragment>",
            `#include <clipping_planes_fragment>
            vec3 q = (vHeart - vec3(${cx.toFixed(3)}, ${cy.toFixed(3)}, 0.0)) / vec3(${rx.toFixed(3)}, ${ry.toFixed(3)}, ${hideInside.depth.toFixed(3)});
            if (dot(q, q) < 0.995) discard;
            // Deeper inside the cavity is darker, so it reads as a hollow, not a bulge.
            diffuseColor.rgb *= 1.0 - 0.6 * clamp(-vHeart.z / ${hideInside.depth.toFixed(3)}, 0.0, 1.0);`,
          );
      } else {
        shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vHeart;");
      }
    };
    m.customProgramCacheKey = () => `heart-${hideInside?.id ?? "none"}`;
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

  // ---- The heart ------------------------------------------------------------------------------------

  /** Builds the cut-open heart into a group (heart frame); returns handles for animation. */
  private heart(opts: { vessels: boolean; labels: boolean; conduction: boolean }) {
    const g = new THREE.Group();
    g.rotation.z = 0.42; // apex down and to the patient's left
    this.content.add(g);

    // Back half: surface from the section outline curving back to a point.
    const M = 26;
    const N = OUTLINE.length;
    const pos: number[] = [];
    for (let j = 0; j <= M; j++) {
      const phi = (j / M) * (Math.PI / 2);
      const s = Math.cos(phi);
      for (let i = 0; i < N; i++) {
        const [ox, oy] = OUTLINE[i];
        const bump = 1 + 0.02 * fbm(ox * 2, oy * 2, phi * 2, 3);
        pos.push(ox * s * bump, (oy * s - 0.2 * (1 - s)) * bump, -DEPTH * Math.sin(phi));
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < M; j++)
      for (let i = 0; i < N; i++) {
        const a = j * N + i;
        const b = j * N + ((i + 1) % N);
        idx.push(a, a + N, b, b, a + N, b + N);
      }
    const back = new THREE.BufferGeometry();
    back.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    back.setIndex(idx);
    back.computeVertexNormals();
    const muscle = this.beating(this.material({ color: "#b5524a", roughness: 0.55, side: THREE.DoubleSide }, "myocardium"));
    const backMesh = new THREE.Mesh(back, muscle);
    backMesh.userData.part = "myocardium";
    g.add(backMesh);

    // Cut face with the two cavities.
    const shape = new THREE.Shape(OUTLINE.map(([x, y]) => new THREE.Vector2(x, y)));
    shape.holes = [new THREE.Path(RIGHT.poly), new THREE.Path(LEFT.poly)];
    const face = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1), this.beating(this.material({ color: "#c76a5f", roughness: 0.7, clearcoat: 0.15 }, "myocardium")));
    face.userData.part = "cutface";
    g.add(face);

    // Inner walls of the chambers: half ellipsoids, each hiding what lies inside its partner.
    const pairs: [Chamber, Chamber][] = [
      [CH.ra, CH.rv],
      [CH.rv, CH.ra],
      [CH.la, CH.lv],
      [CH.lv, CH.la],
    ];
    for (const [ch, partner] of pairs) {
      const geo = new THREE.SphereGeometry(1, 48, 28, Math.PI, Math.PI);
      geo.scale(ch.r[0], ch.r[1], ch.depth).translate(ch.c[0], ch.c[1], 0);
      const m = new THREE.Mesh(geo, this.beating(this.material({ color: ch.color, roughness: 0.45, side: THREE.DoubleSide, sheen: 0.4 }, ch.id), partner));
      m.userData.part = ch.id;
      g.add(m);
    }

    // Valves: two flaps per atrioventricular valve, hinged at the valve ring.
    const leaflets: { pivot: THREE.Group; open: number; closed: number }[] = [];
    for (const [side, part] of [
      [RIGHT, "tricuspid"],
      [LEFT, "mitral"],
    ] as const) {
      const [p, q] = side.corners;
      const half = Math.hypot(q[0] - p[0], q[1] - p[1]) / 2;
      const across = Math.atan2(q[1] - p[1], q[0] - p[0]);
      const mat = this.material({ color: "#efe1c6", roughness: 0.6, side: THREE.DoubleSide }, part);
      for (const [hinge, closed, open] of [
        [p, across, -Math.PI / 2 - 0.25],
        [q, across + Math.PI, -Math.PI / 2 + 0.25],
      ] as const) {
        const pivot = new THREE.Group();
        pivot.position.set(hinge[0], hinge[1], 0.035);
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(half * 1.02, 0.035, 0.05), mat);
        leaf.position.x = (half * 1.02) / 2;
        leaf.userData.part = part;
        pivot.add(leaf);
        g.add(pivot);
        leaflets.push({ pivot, open, closed });
      }
    }

    // Great vessels.
    const semilunar: THREE.Mesh[] = [];
    if (opts.vessels) {
      for (const vs of VESSELS) {
        const m = this.tube(
          vs.pts.map(([x, y, z]) => v(x, y, z)),
          vs.r,
          this.beating(this.material({ color: vs.color, roughness: 0.45 }, vs.part)),
          g,
        );
        m.userData.part = vs.part;
      }
      // Semilunar valves: rings with three cusps at the roots of the aorta and the pulmonary trunk.
      const ringMat = this.material({ color: "#efe1c6", roughness: 0.6 }, "semilunar");
      for (const [base, dir, r] of [
        [v(0.21, 1.25, -0.25), v(-0.07, 1, -0.1), 0.16],
        [v(-0.13, 1.05, 0.09), v(0.06, 1, 0.14), 0.155],
      ] as const) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.025, 8, 32), ringMat);
        ring.position.copy(base);
        ring.quaternion.setFromUnitVectors(v(0, 0, 1), dir.clone().normalize());
        ring.userData.part = "semilunar";
        g.add(ring);
        semilunar.push(ring);
      }
    }

    // Conduction system.
    const condMat = this.material({ color: "#f5c542", roughness: 0.4, emissive: "#f2b632", emissiveIntensity: 0.4 }, "conduction");
    const nodes: THREE.Mesh[] = [];
    if (opts.conduction) {
      for (const p of [SA, AV]) {
        const n = new THREE.Mesh(this.sphere, condMat);
        n.position.copy(p);
        n.scale.setScalar(0.06);
        n.userData.part = "conduction";
        g.add(n);
        nodes.push(n);
      }
      for (const line of BUNDLE) {
        const m = this.tube(line.map(([x, y]) => v(x, y, 0.02)), 0.022, condMat, g, 40);
        m.userData.part = "conduction";
      }
    }

    if (opts.labels) {
      const at = (part: HeartPart, p: V3) => this.label(this.anchor(g, p), PARTS[part].name, "label", part);
      at("ra", v(-0.62, 0.55, -0.1));
      at("rv", v(-0.5, -0.55, -0.1));
      at("la", v(0.55, 0.6, -0.1));
      at("lv", v(0.5, -0.75, -0.1));
      at("septum", v(0.05, -0.55, 0.02));
      at("myocardium", v(0.9, -0.35, 0.02));
      at("tricuspid", v(RIGHT.lens[0], RIGHT.lens[1] - 0.05, 0.04));
      at("mitral", v(LEFT.lens[0], LEFT.lens[1] - 0.05, 0.04));
      if (opts.vessels) {
        at("aorta", v(0.55, 2.08, -0.48));
        at("pulmonary", v(-0.75, 1.58, 0.03));
        at("pulmVeins", v(1.5, 0.92, -0.3));
        at("cava", v(-0.71, 1.75, -0.27));
        at("semilunar", v(-0.13, 1.05, 0.25));
      }
      if (opts.conduction) at("conduction", SA);
    }
    return { g, leaflets, semilunar, nodes, condMat };
  }

  /** Beat the heart: shared uniforms, valves, conduction glow. */
  private animateHeart(h: ReturnType<HeartScene["heart"]>) {
    this.tickers.push((dt) => {
      if (this.opts.playing && !this.reduceMotion) this.beat += dt / (this.opts.slow ? 3.2 : 0.8);
      const c = this.cycle();
      this.uniforms.uVent.value = c.vent;
      this.uniforms.uAtr.value = c.atr;
      for (const l of h.leaflets) l.pivot.rotation.z = l.closed + (l.open - l.closed) * c.avOpen;
      for (const r of h.semilunar) r.scale.setScalar(1 + 0.25 * c.slOpen);
      // Impulse: sinus node at the P wave, AV node a moment later, the bundle with QRS.
      if (h.nodes.length && this.selected !== "conduction") {
        const sa = gauss(c.f, 0.03, 0.03);
        const avn = gauss(c.f, 0.1, 0.03);
        const his = gauss(c.f, 0.145, 0.025);
        h.nodes[0].scale.setScalar(0.06 * (1 + 0.8 * sa));
        h.nodes[1].scale.setScalar(0.06 * (1 + 0.8 * avn));
        h.condMat.emissiveIntensity = 0.35 + 1.4 * Math.max(sa, avn, his);
      }
      if (c.phase !== this.phase) {
        this.phase = c.phase;
        this.callbacks.onPhase(c.phase);
      }
    });
  }

  // ---- Views ----------------------------------------------------------------------------------------

  private buildStructure() {
    this.picking = true;
    const h = this.heart({ vessels: true, labels: true, conduction: true });
    // A gentle, slow beat so the heart looks alive but labels stay readable.
    this.tickers.push((dt) => {
      this.beat += dt / 2.4;
      const c = this.cycle();
      this.uniforms.uVent.value = c.vent * 0.35;
      this.uniforms.uAtr.value = c.atr * 0.35;
      for (const l of h.leaflets) l.pivot.rotation.z = l.closed + (l.open - l.closed) * c.avOpen;
    });
    return { distance: 7.2, target: v(0, 0.3, 0) };
  }

  private buildCycle() {
    const h = this.heart({ vessels: true, labels: false, conduction: true });
    this.animateHeart(h);
    const L = (name: string, p: V3) => this.label(this.anchor(h.g, p), name);
    L("სინუსური კვანძი", SA);
    L("წინაგულ-პარკუჭოვანი კვანძი", AV);
    L("ჰისის კონა", v(0.05, -0.6, 0.03));
    // Blood: particles flowing through each side, held back and pushed on by the valves.
    const paths: { pts: [number, number, number][]; vent: number; color: THREE.Color }[] = [
      {
        pts: [[-0.72, 2.05, -0.28], [-0.68, 1.2, -0.2], [-0.62, 0.6, -0.12], [-0.5, 0.15, -0.12], [-0.45, -0.35, -0.15], [-0.42, -0.7, -0.15], [-0.22, -0.2, -0.1], [-0.15, 0.8, 0.05], [-0.1, 1.5, 0.15], [-0.75, 1.6, 0.03], [-1.3, 1.5, -0.2]],
        vent: 5,
        color: BLUE,
      },
      {
        pts: [[1.65, 0.95, -0.3], [1.0, 0.78, -0.3], [0.55, 0.55, -0.12], [0.45, 0.15, -0.12], [0.5, -0.6, -0.15], [0.52, -1.0, -0.15], [0.32, -0.3, -0.12], [0.25, 0.85, -0.2], [0.18, 1.6, -0.32], [0.5, 2.1, -0.48], [0.95, 1.8, -0.6], [1.02, 0.4, -0.8]],
        vent: 5,
        color: RED,
      },
    ];
    const rand = rng(5);
    const COUNT = 70;
    const flows = paths.map((path) => {
      const curve = new THREE.CatmullRomCurve3(path.pts.map(([x, y, z]) => v(x, y, z)));
      // Arc-length position of the ventricle point.
      const samples = curve.getSpacedPoints(400);
      const target = v(...path.pts[path.vent]);
      let best = 0;
      samples.forEach((p, i) => {
        if (p.distanceTo(target) < samples[best].distanceTo(target)) best = i;
      });
      const sV = best / 400;
      const mesh = new THREE.InstancedMesh(this.sphere, this.material({ color: path.color, roughness: 0.4 }), COUNT);
      h.g.add(mesh);
      const s = Array.from({ length: COUNT }, () => rand());
      const jitter = Array.from({ length: COUNT }, () => v(rand() - 0.5, rand() - 0.5, rand() * 0.5 - 0.25).multiplyScalar(0.12));
      return { curve, sV, mesh, s, jitter };
    });
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const scl = v(0.035, 0.035, 0.035);
    const p = new THREE.Vector3();
    this.tickers.push((dt) => {
      const c = this.cycle();
      const step = this.opts.playing && !this.reduceMotion ? dt / (this.opts.slow ? 3.2 : 0.8) : 0;
      const systole = c.vent > 0.3;
      for (const fl of flows) {
        for (let i = 0; i < COUNT; i++) {
          let s = fl.s[i];
          let speed: number;
          if (s < fl.sV) speed = systole ? 0 : 0.3;
          else if (s < fl.sV + 0.1) speed = systole ? 1.6 : 0;
          else speed = systole ? 1.6 : 0.25;
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
    return { distance: 7.2, target: v(0, 0.3, 0) };
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
    const h = this.heart({ vessels: false, labels: false, conduction: false });
    h.g.scale.setScalar(0.85);
    h.g.updateMatrixWorld();
    this.tickers.push((dt) => {
      if (this.opts.playing && !this.reduceMotion) this.beat += dt / 1.6;
      const c = this.cycle();
      this.uniforms.uVent.value = c.vent * 0.6;
      this.uniforms.uAtr.value = c.atr * 0.6;
      for (const l of h.leaflets) l.pivot.rotation.z = l.closed + (l.open - l.closed) * c.avOpen;
    });
    const H = (x: number, y: number, z: number) => v(x, y, z).applyMatrix4(h.g.matrixWorld);
    // Lungs and body.
    const organ = (p: V3, scale: V3, color: string, seed: number) => {
      const geo = new THREE.IcosahedronGeometry(1, 4);
      const pa = geo.attributes.position;
      const n = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) {
        n.fromBufferAttribute(pa, i);
        n.multiplyScalar(1 + 0.08 * fbm(n.x * 2 + seed, n.y * 2, n.z * 2, 3));
        pa.setXYZ(i, n.x * scale.x, n.y * scale.y, n.z * scale.z);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, this.material({ color, roughness: 0.7, transparent: true, opacity: 0.45, depthWrite: false }));
      m.position.copy(p);
      this.content.add(m);
      return m;
    };
    organ(v(-2.6, 3.7, -0.3), v(1.0, 1.25, 0.6), "#f0a7b0", 1);
    organ(v(2.6, 3.7, -0.3), v(1.0, 1.25, 0.6), "#f0a7b0", 2);
    organ(v(0, -4.1, -0.3), v(2.3, 0.9, 0.7), "#e9c39a", 3);

    // The circuit as one closed loop per lung: oxygenation 0 = venous, 1 = arterial; c = which circuit.
    type P = [V3, number, "p" | "s"];
    const loop = (side: -1 | 1): P[] => [
      [H(-0.58, 0.5, -0.12), 0, "s"],
      [H(-0.5, 0.15, -0.12), 0, "p"],
      [H(-0.45, -0.45, -0.12), 0, "p"],
      [H(-0.22, -0.2, -0.1), 0, "p"],
      [H(-0.15, 0.8, 0.05), 0, "p"],
      [H(-0.1, 1.5, 0.15), 0, "p"],
      [v(side * 1.3, 2.8, 0.15), 0, "p"],
      [v(side * 2.2, 3.1, 0), 0.1, "p"],
      [v(side * 2.8, 3.6, 0), 0.4, "p"],
      [v(side * 2.5, 4.4, 0), 0.7, "p"],
      [v(side * 2.0, 3.9, 0), 0.95, "p"],
      [v(side * 1.7, 3.3, -0.1), 1, "p"],
      [side < 0 ? v(-0.9, 2.2, -0.4) : v(1.0, 2.2, -0.35), 1, "p"],
      [H(0.55, 0.55, -0.12), 1, "s"],
      [H(0.45, 0.15, -0.12), 1, "s"],
      [H(0.5, -0.6, -0.12), 1, "s"],
      [H(0.32, -0.3, -0.12), 1, "s"],
      [H(0.25, 0.85, -0.2), 1, "s"],
      [H(0.2, 1.8, -0.35), 1, "s"],
      [v(1.15, 2.2, -0.5), 1, "s"],
      [v(1.8, 1.4, -0.6), 1, "s"],
      [v(1.9, -1.6, -0.6), 1, "s"],
      [v(1.4, -3.6, -0.2), 0.95, "s"],
      [v(0.7, -4.5, 0.1), 0.6, "s"],
      [v(-0.2, -3.9, 0.2), 0.3, "s"],
      [v(-1.2, -3.5, -0.2), 0.05, "s"],
      [v(-1.9, -1.6, -0.5), 0, "s"],
      [H(-0.64, -1.4, -0.45), 0, "s"],
      [H(-0.62, 0.0, -0.3), 0, "s"],
    ];
    const loops = [loop(-1), loop(1)];
    // Vessel tubes along the loops (outside the heart), coloured by the blood they carry.
    const venous = { p: this.material({ color: BLUE, roughness: 0.45 }), s: this.material({ color: BLUE, roughness: 0.45 }) };
    const arterial = { p: this.material({ color: RED, roughness: 0.45 }), s: this.material({ color: RED, roughness: 0.45 }) };
    const capMat = { p: this.material({ color: "#9a4f9a", roughness: 0.5 }), s: this.material({ color: "#9a4f9a", roughness: 0.5 }) };
    this.circuitMats.pulmonary.push(venous.p, arterial.p, capMat.p);
    this.circuitMats.systemic.push(venous.s, arterial.s, capMat.s);
    const matFor = (key: string) => {
      const c = key.slice(-1) as "p" | "s";
      return (key.startsWith("cap") ? capMat : key.startsWith("a") ? arterial : venous)[c];
    };
    loops.forEach((lp, k) => {
      // Only the parts outside the heart; the systemic part is shared, so it is drawn once.
      const outside = (i: number) => (i >= 5 && i <= 12) || (k === 0 && i >= 17 && i <= 28);
      let pts: V3[] = [];
      let key = "";
      const flush = () => {
        if (pts.length > 1) this.tube(pts, key.startsWith("cap") ? 0.07 : 0.12, matFor(key), this.content, 48);
        pts = [];
        key = "";
      };
      lp.forEach(([p, oxy, c], i) => {
        if (!outside(i)) return flush();
        const kk = (oxy > 0.05 && oxy < 0.95 ? "cap" : oxy >= 0.95 ? "a" : "v") + c;
        if (key && kk !== key) {
          pts.push(p);
          flush();
        }
        if (!key) key = kk;
        pts.push(p);
      });
      flush();
    });

    // Blood particles around both loops.
    const rand = rng(9);
    const COUNT = 110;
    const flows = loops.map((lp) => {
      const curve = new THREE.CatmullRomCurve3(lp.map(([p]) => p), true);
      const n = lp.length;
      const oxyAt = (t: number) => {
        const x = t * n;
        const i = Math.floor(x) % n;
        return lp[i][1] + (lp[(i + 1) % n][1] - lp[i][1]) * (x - Math.floor(x));
      };
      const circuitAt = (t: number) => lp[Math.floor(t * n) % n][2];
      const mesh = new THREE.InstancedMesh(this.sphere, this.material({ color: "#ffffff", roughness: 0.4 }), COUNT);
      this.content.add(mesh);
      const s = Array.from({ length: COUNT }, () => rand());
      return { curve, oxyAt, circuitAt, mesh, s };
    });
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    const p = new THREE.Vector3();
    this.tickers.push((dt) => {
      const step = this.opts.playing && !this.reduceMotion ? dt * 0.035 : 0;
      for (const fl of flows) {
        for (let i = 0; i < COUNT; i++) {
          fl.s[i] = (fl.s[i] + step) % 1;
          const u = fl.s[i];
          const t = fl.curve.getUtoTmapping(u, 0);
          fl.curve.getPoint(t, p);
          const c = fl.circuitAt(t);
          const dim = this.opts.circuit !== "both" && (this.opts.circuit === "pulmonary" ? c !== "p" : c !== "s");
          m4.compose(p, q, v(1, 1, 1).multiplyScalar(dim ? 0.0001 : 0.07));
          fl.mesh.setMatrixAt(i, m4);
          fl.mesh.setColorAt(i, col.copy(BLUE).lerp(RED, fl.oxyAt(t)));
        }
        fl.mesh.instanceMatrix.needsUpdate = true;
        if (fl.mesh.instanceColor) fl.mesh.instanceColor.needsUpdate = true;
      }
    });

    const A = (p2: V3, text: string, kind: "label" | "tag" = "label") => this.label(this.anchor(this.content, p2), text, kind);
    A(v(0, 5.3, 0), "მცირე (ფილტვის) წრე", "tag");
    A(v(0, -5.3, 0), "დიდი წრე", "tag");
    A(v(-2.6, 3.7, 0.4), "ფილტვის კაპილარები: CO₂ ↔ O₂");
    A(v(0.2, -4.1, 0.6), "ორგანოების კაპილარები");
    A(v(-1.3, 2.8, 0.15), "ფილტვის არტერია");
    A(v(1.0, 2.2, -0.35), "ფილტვის ვენა");
    A(v(1.85, 0, -0.6), "აორტა");
    A(v(-1.9, -1.6, -0.5), "ქვედა ღრუ ვენა");
    A(H(-0.6, 0.5, 0), "მარჯვ. წინაგული");
    A(H(-0.45, -0.55, 0), "მარჯვ. პარკუჭი");
    A(H(0.55, 0.55, 0), "მარცხ. წინაგული");
    A(H(0.5, -0.7, 0), "მარცხ. პარკუჭი");
    return { distance: 15, target: v(0, 0, 0), dir: v(0.12, 0.12, 1) };
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
      let part = hit.object.userData.part as string | undefined;
      if (!part) continue;
      if (part === "cutface") {
        // The septum is the strip of the cut face between the two ventricles.
        const local = hit.object.worldToLocal(hit.point.clone());
        part = Math.abs(local.x - 0.05) < 0.1 && local.y < 0.1 && local.y > -1.2 ? "septum" : "myocardium";
      }
      return this.callbacks.onPick(part as HeartPart);
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
