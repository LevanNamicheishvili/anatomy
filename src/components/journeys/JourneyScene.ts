import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { loadBody, type Body } from "./body-model";
import type { JourneyId } from "./journeys-data";

/*
 * The journeys engine: one journey is a list of stages; each stage runs for a while, moves the camera
 * along (a shot per frame, eased) and animates its scene. Stages that change the scene ("cut": e.g. from
 * the body into a cell) fade through the background. While paused the camera is free to orbit.
 */

export type V3 = THREE.Vector3;
export const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface Shot {
  pos: V3;
  target: V3;
}

export interface StagePlan {
  duration: number;
  /** The scene changes completely at this stage: fade through the background and jump the camera. */
  cut?: boolean;
  enter?(): void;
  /** u: 0..1 through the stage; s: seconds since the stage began; t: journey clock. Returns the camera shot. */
  update(u: number, s: number, t: number, dt: number): Shot;
}

export interface Plan {
  stages: StagePlan[];
}

interface Label {
  target: THREE.Object3D;
  el: HTMLDivElement;
  stages?: number[];
}

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const ease = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/** What a journey's builder gets from the engine. */
export class Kit {
  readonly root = new THREE.Group();
  readonly sphere = new THREE.IcosahedronGeometry(1, 3);
  readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
  private disposables: { dispose(): void }[] = [];
  labels: Label[] = [];

  /** Background and fog of the stage on screen: dark inside the body, none (page colour) outside. */
  atmosphere: { bg: string | null; near: number; far: number } = { bg: null, near: 0, far: 0 };
  private normals = new Map<string, THREE.Texture>();

  constructor(private overlay: HTMLElement) {}

  mood(bg: string | null, near = 0, far = 0) {
    this.atmosphere = { bg, near, far };
  }

  /**
   * A tiling normal map for surface detail: "organic" soft bumps (membranes, cells), "fibre" fine ridges
   * along v (muscle fibres, tendons), "bone" small pits and grain. Built once per kind.
   */
  normalMap(kind: "organic" | "fibre" | "bone", repeat: [number, number] = [1, 1]) {
    let base = this.normals.get(kind);
    if (!base) {
      const N = 256;
      const r = rng(kind.length * 977);
      const waves = Array.from({ length: kind === "fibre" ? 18 : 26 }, () => {
        const fx = kind === "fibre" ? 1 + Math.floor(r() * 3) : 1 + Math.floor(r() * 9);
        const fy = kind === "fibre" ? 4 + Math.floor(r() * 40) : 1 + Math.floor(r() * 9);
        return { fx: kind === "fibre" ? fy : fx, fy: kind === "fibre" ? fx : fy, ph: r() * 6.283, a: 1 / Math.sqrt(fx * fx + fy * fy) };
      });
      const pits = kind === "bone" ? Array.from({ length: 70 }, () => ({ x: r(), y: r(), rad: 0.01 + r() * 0.025 })) : [];
      const h = new Float32Array(N * N);
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const u = x / N;
          const w = y / N;
          let sum = 0;
          for (const k of waves) sum += k.a * Math.sin(6.283 * (k.fx * u + k.fy * w) + k.ph);
          if (kind === "organic") sum = Math.abs(sum) * 1.4;
          for (const p of pits) {
            const dx = Math.min(Math.abs(u - p.x), 1 - Math.abs(u - p.x));
            const dy = Math.min(Math.abs(w - p.y), 1 - Math.abs(w - p.y));
            const d = Math.hypot(dx, dy) / p.rad;
            if (d < 1) sum -= 0.6 * (1 - d * d);
          }
          h[y * N + x] = sum;
        }
      const strength = kind === "fibre" ? 5 : kind === "bone" ? 7 : 4;
      base = this.canvasTexture(N, N, (ctx) => {
        const img = ctx.createImageData(N, N);
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++) {
            const dx = (h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)]) * strength;
            const dy = (h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x]) * strength;
            const len = Math.hypot(dx, dy, 1);
            const i = (y * N + x) * 4;
            img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
            img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
            img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
            img.data[i + 3] = 255;
          }
        ctx.putImageData(img, 0, 0);
      });
      base.colorSpace = THREE.NoColorSpace;
      base.wrapS = base.wrapT = THREE.RepeatWrapping;
      this.normals.set(kind, base);
    }
    const tex = this.track(base.clone());
    tex.repeat.set(...repeat);
    tex.needsUpdate = true;
    return tex;
  }

  track<T extends { dispose(): void }>(x: T) {
    this.disposables.push(x);
    return x;
  }

  material(params: THREE.MeshPhysicalMaterialParameters) {
    return this.track(new THREE.MeshPhysicalMaterial({ roughness: 0.5, clearcoat: 0.2, ...params }));
  }

  /** A see-through material that doesn't hide what is behind or inside it. */
  ghost(color: THREE.ColorRepresentation, opacity: number, params: THREE.MeshPhysicalMaterialParameters = {}) {
    return this.material({ color, transparent: true, opacity, depthWrite: false, roughness: 0.6, clearcoat: 0, ...params });
  }

  anchor(parent: THREE.Object3D, p: V3) {
    const o = new THREE.Object3D();
    o.position.copy(p);
    parent.add(o);
    return o;
  }

  /** A label on a structure; `stages` limits it to some stages of the journey. */
  label(target: THREE.Object3D, text: string, o: { kind?: "label" | "tag"; stages?: number[] } = {}) {
    const el = document.createElement("div");
    if (o.kind === "tag") {
      el.className = "dna-tag";
      el.textContent = text;
    } else {
      el.className = "blood-label";
      el.innerHTML = `<span class="blood-label-dot"></span><span class="blood-label-text"></span>`;
      (el.lastChild as HTMLElement).textContent = text;
    }
    el.style.visibility = "hidden";
    this.overlay.appendChild(el);
    this.labels.push({ target, el, stages: o.stages });
    return el;
  }

  /** A tube along points; `r` may vary along it (0..1). */
  tube(points: V3[], r: number | ((t: number) => number), mat: THREE.Material, parent: THREE.Object3D, segments = 64, radial = 10) {
    const pts = points.length > 1 ? points : [points[0], points[0].clone().add(v(0, 1e-4, 0))];
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, segments, typeof r === "number" ? r : 1, radial);
    if (typeof r !== "number") {
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const ring = radial + 1;
      const c = new THREE.Vector3();
      const q = new THREE.Vector3();
      for (let i = 0; i <= segments; i++) {
        curve.getPointAt(i / segments, c);
        const s = r(i / segments);
        for (let j = 0; j < ring; j++) {
          q.fromBufferAttribute(pos, i * ring + j).sub(c).multiplyScalar(s).add(c);
          pos.setXYZ(i * ring + j, q.x, q.y, q.z);
        }
      }
      geo.computeVertexNormals();
    }
    const mesh = new THREE.Mesh(geo, mat);
    parent.add(mesh);
    return { mesh, curve };
  }

  /** Repeating bands, e.g. the cross-striation of muscle or the lamellae of bone. */
  stripes(colors: string[], widths: number[], repeat: [number, number]) {
    const c = document.createElement("canvas");
    const total = widths.reduce((s, w) => s + w, 0);
    c.width = 4;
    c.height = 64;
    const ctx = c.getContext("2d")!;
    let y = 0;
    colors.forEach((col, i) => {
      const h = (widths[i] / total) * 64;
      ctx.fillStyle = col;
      ctx.fillRect(0, y, 4, h + 0.5);
      y += h;
    });
    const tex = this.track(new THREE.CanvasTexture(c));
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...repeat);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!);
    const tex = this.track(new THREE.CanvasTexture(c));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }

  /** A red blood cell: a biconcave disc, diameter 1, facing +y. */
  redCell() {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      const x = 0.5 * Math.sin(a);
      // Evans–Fung shape: thin centre, thick rim.
      const r = (2 * x) ** 2;
      const h = 0.5 * Math.sqrt(Math.max(0, 1 - r)) * (0.21 + 2.0 * r - 1.12 * r * r) * 0.5;
      pts.push(new THREE.Vector2(Math.max(1e-4, x), Math.cos(a) >= 0 ? h : -h));
    }
    const g = new THREE.LatheGeometry(pts, 24);
    g.computeVertexNormals();
    return this.track(g);
  }

  async body(withBrain: boolean): Promise<Body> {
    return loadBody(withBrain);
  }

  clear() {
    for (const l of this.labels) l.el.remove();
    this.labels = [];
    this.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && mesh.geometry !== this.sphere && mesh.geometry !== this.cylinder) mesh.geometry.dispose();
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    });
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.normals.clear();
    this.atmosphere = { bg: null, near: 0, far: 0 };
    this.root.clear();
  }

  dispose() {
    this.clear();
    this.sphere.dispose();
    this.cylinder.dispose();
  }
}

export type Builder = (k: Kit) => Promise<Plan>;

export interface JourneyCallbacks {
  onStage(i: number): void;
  onPlaying(p: boolean): void;
  onLoading(l: boolean): void;
  onProgress(f: number): void;
}

export class JourneyScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.002, 80);
  private controls: OrbitControls;
  private kit: Kit;
  private env: THREE.WebGLRenderTarget;
  private observer: ResizeObserver;
  private fade: HTMLDivElement;
  private frame = 0;
  private clock = new THREE.Clock();
  private disposed = false;
  private plan: Plan | null = null;
  private token = 0;
  private stage = 0;
  private stageTime = 0;
  private time = 0;
  private snap = true;
  private fadeLevel = 0;
  private pending: number | null = null;
  private target = new THREE.Vector3();
  private dirty = true;
  private _playing = true;

  constructor(
    private canvas: HTMLCanvasElement,
    overlay: HTMLElement,
    private cb: JourneyCallbacks,
    private builders: Record<JourneyId, Builder>,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.env.texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight("#ffffff", 1.3);
    key.position.set(4, 7, 8);
    const fill = new THREE.DirectionalLight("#eef0ff", 0.55);
    fill.position.set(-6, -2, 5);
    this.kit = new Kit(overlay);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#d9e2df", 0.8), key, fill, this.kit.root);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enabled = false;
    this.controls.rotateSpeed = 0.6;
    this.fade = document.createElement("div");
    // Scene changes dip through near-black, like a cut in a film.
    this.fade.className = "absolute inset-0 bg-[#0c1110]";
    this.fade.style.opacity = "0";
    overlay.appendChild(this.fade);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  async start(id: JourneyId) {
    const token = ++this.token;
    this.plan = null;
    this.kit.clear();
    this.cb.onLoading(true);
    const plan = await this.builders[id](this.kit);
    if (token !== this.token || this.disposed) return;
    this.cb.onLoading(false);
    this.plan = plan;
    this.enterStage(0);
    this.fadeLevel = 1;
    this.setPlaying(true);
  }

  get playing() {
    return this._playing;
  }

  setPlaying(p: boolean) {
    if (!this.plan) return;
    // Pressing play at the very end starts the journey again.
    if (p && this.stage === this.plan.stages.length - 1 && this.stageTime >= this.plan.stages[this.stage].duration) this.goTo(0);
    this._playing = p;
    this.controls.enabled = !p;
    if (!p) this.controls.target.copy(this.target);
    this.cb.onPlaying(p);
  }

  goTo(i: number) {
    if (!this.plan) return;
    const n = Math.max(0, Math.min(this.plan.stages.length - 1, i));
    if (this.plan.stages[n].cut || this.plan.stages[this.stage].cut) {
      this.pending = n;
    } else this.enterStage(n);
  }

  private enterStage(i: number) {
    const plan = this.plan!;
    const cut = plan.stages[i].cut || i === 0;
    this.stage = i;
    this.stageTime = 0;
    plan.stages[i].enter?.();
    const a = this.kit.atmosphere;
    this.scene.background = a.bg ? new THREE.Color(a.bg) : null;
    this.scene.fog = a.bg && a.far ? new THREE.Fog(a.bg, a.near, a.far) : null;
    // Dark scenes get a little more exposure so the tissue stays readable on a projector.
    this.renderer.toneMappingExposure = a.bg ? 1.3 : 1;
    if (cut) this.snap = true;
    this.dirty = true;
    this.cb.onStage(i);
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  /** Narrow screens: step back so the shot still fits. */
  private fit(shot: Shot) {
    const k = Math.max(1, 1.25 / this.camera.aspect);
    if (k === 1) return shot;
    return { target: shot.target, pos: shot.target.clone().add(shot.pos.clone().sub(shot.target).multiplyScalar(k)) };
  }

  private tmp = new THREE.Vector3();
  private sizes = new WeakMap<HTMLElement, { w: number; h: number }>();
  private placeLabels() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const l of this.kit.labels) {
      let visible = this.fadeLevel < 0.5 && (!l.stages || l.stages.includes(this.stage));
      for (let o: THREE.Object3D | null = l.target; o && visible; o = o.parent) if (!o.visible) visible = false;
      let x = 0;
      let y = 0;
      if (visible) {
        l.target.getWorldPosition(this.tmp);
        this.tmp.project(this.camera);
        x = ((this.tmp.x + 1) / 2) * w;
        y = ((1 - this.tmp.y) / 2) * h;
        visible = this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.02 && Math.abs(this.tmp.y) < 1.02;
      }
      if (visible) {
        let size = this.sizes.get(l.el);
        if (!size?.w) {
          l.el.style.visibility = "visible";
          size = { w: l.el.offsetWidth, h: l.el.offsetHeight };
          this.sizes.set(l.el, size);
        }
        const box = l.el.classList.contains("dna-tag") ? { x: x - size.w / 2, y: y - size.h / 2, w: size.w, h: size.h } : { x: x - 6, y: y - size.h / 2, w: size.w, h: size.h };
        if (box.x < -4 || box.x + box.w > w + 4) visible = false;
        else if (placed.some((q) => box.x < q.x + q.w + 2 && q.x < box.x + box.w + 2 && box.y < q.y + q.h + 1 && q.y < box.y + box.h + 1)) visible = false;
        else placed.push(box);
      }
      l.el.style.visibility = visible ? "visible" : "hidden";
      if (visible) l.el.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const plan = this.plan;
    // Fade through the background when the scene changes.
    if (this.pending !== null) {
      this.fadeLevel = Math.min(1, this.fadeLevel + dt / 0.35);
      if (this.fadeLevel >= 1) {
        const n = this.pending;
        this.pending = null;
        this.enterStage(n);
      }
    } else if (this.fadeLevel > 0) this.fadeLevel = Math.max(0, this.fadeLevel - dt / 0.6);
    this.fade.style.opacity = String(this.fadeLevel);

    if (plan) {
      const stage = plan.stages[this.stage];
      const run = this._playing && this.pending === null;
      if (run) {
        this.stageTime += dt;
        this.time += dt;
      }
      if (run || this.dirty) {
        const shot = this.fit(stage.update(Math.min(1, this.stageTime / stage.duration), this.stageTime, this.time, run ? dt : 0));
        if (this._playing) {
          const k = this.snap ? 1 : 1 - Math.exp(-dt * 2.2);
          this.camera.position.lerp(shot.pos, k);
          this.target.lerp(shot.target, k);
          this.camera.lookAt(this.target);
          this.snap = false;
        } else if (this.snap) {
          this.camera.position.copy(shot.pos);
          this.target.copy(shot.target);
          this.controls.target.copy(shot.target);
          this.camera.lookAt(this.target);
          this.snap = false;
        }
        this.dirty = false;
      }
      this.cb.onProgress(Math.min(1, this.stageTime / stage.duration));
      if (run && this.stageTime >= stage.duration) {
        if (this.stage < plan.stages.length - 1) this.goTo(this.stage + 1);
        else this.setPlaying(false);
      }
    }
    if (!this._playing) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.kit.dispose();
    this.fade.remove();
    this.env.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
