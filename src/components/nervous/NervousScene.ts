import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { fbm, smoothstep } from "@/lib/noise";
import type { NervousView } from "./nervous-data";

/*
 * Nervous system scenes built from code: a neuron with myelinated axon and a travelling impulse, a patch
 * of membrane with ion channels during an action potential, a synapse releasing transmitter, and a reflex
 * arc through a spinal cord section. Shapes follow textbook drawings; sizes are not to scale.
 */

interface Label {
  target: THREE.Object3D;
  el: HTMLDivElement;
}

type V3 = THREE.Vector3;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const GLOW = new THREE.Color("#ffd23f");
const gauss = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2));

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

function blob(radius: number, amount: number, seed: number, scale = v(1, 1, 1)) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, 4).deleteAttribute("normal").deleteAttribute("uv"));
  const p = g.attributes.position;
  const n = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    const r = radius * (1 + amount * fbm(n.x * 1.7 + seed, n.y * 1.7 - seed, n.z * 1.7, 4));
    p.setXYZ(i, n.x * r * scale.x, n.y * r * scale.y, n.z * r * scale.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Membrane potential of an action potential (t in ms from the start), mV. */
const potential = (t: number) => {
  if (t < 0) return -70;
  if (t < 0.5) return -70 + 15 * (t / 0.5);
  if (t < 1) return -55 + 85 * smoothstep(0.5, 1, t);
  if (t < 2) return 30 - 110 * smoothstep(1, 2, t);
  if (t < 4) return -80 + 10 * smoothstep(2, 4, t);
  return -70;
};

export class NervousScene {
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
  private view: NervousView | null = null;
  private graph: HTMLCanvasElement | null = null;
  playing = true;
  private time = 0;
  private sphere = new THREE.IcosahedronGeometry(1, 2);
  private cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    private onStep: (text: string) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.env.texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight("#ffffff", 1.4);
    key.position.set(4, 7, 8);
    const fill = new THREE.DirectionalLight("#eef0ff", 0.6);
    fill.position.set(-6, -2, 5);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#d9e2df", 0.75), key, fill, this.content);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  setView(view: NervousView) {
    if (view === this.view) return;
    this.view = view;
    this.clear();
    const builders: Record<NervousView, () => { distance: number; dir?: V3; target?: V3; width?: number }> = {
      neuron: () => this.buildNeuron(),
      impulse: () => this.buildImpulse(),
      synapse: () => this.buildSynapse(),
      reflex: () => this.buildReflex(),
    };
    const built = builders[view]();
    const dir = (built.dir ?? v(0.2, 0.25, 1)).normalize();
    let distance = built.distance * Math.max(1, 1.3 / this.camera.aspect);
    if (built.width) {
      const h = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect);
      distance = Math.max(distance, (built.width / 2 / Math.tan(h)) * 1.05);
    }
    const target = built.target ?? v(0, 0, 0);
    this.camera.position.copy(target).addScaledVector(dir, distance);
    this.controls.target.copy(target);
    this.controls.minDistance = distance * 0.35;
    this.controls.maxDistance = distance * 1.8;
    this.controls.update();
  }

  // ---- Helpers --------------------------------------------------------------------------------------

  private material(params: THREE.MeshPhysicalMaterialParameters) {
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.45, clearcoat: 0.3, ...params });
    this.disposables.push(m);
    return m;
  }

  private anchor(parent: THREE.Object3D, p: V3) {
    const o = new THREE.Object3D();
    o.position.copy(p);
    parent.add(o);
    return o;
  }

  private label(target: THREE.Object3D, text: string, kind: "label" | "tag" = "label") {
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
    this.labels.push({ target, el });
    return el;
  }

  private tube(points: V3[], r: number | ((t: number) => number), mat: THREE.Material, parent: THREE.Object3D, segments = 80) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, segments, typeof r === "number" ? r : 1, 12);
    if (typeof r !== "number") {
      // Taper: scale each ring around the curve.
      const pos = geo.attributes.position as THREE.BufferAttribute;
      const ring = 13;
      const c = new THREE.Vector3();
      const q = new THREE.Vector3();
      for (let i = 0; i <= segments; i++) {
        curve.getPointAt(i / segments, c);
        const s = r(i / segments);
        for (let j = 0; j < ring; j++) {
          const k = i * ring + j;
          q.fromBufferAttribute(pos, k).sub(c).multiplyScalar(s).add(c);
          pos.setXYZ(k, q.x, q.y, q.z);
        }
      }
      geo.computeVertexNormals();
    }
    const m = new THREE.Mesh(geo, mat);
    parent.add(m);
    return { mesh: m, curve };
  }

  private clear() {
    for (const l of this.labels) l.el.remove();
    this.labels = [];
    this.tickers = [];
    this.graph?.remove();
    this.graph = null;
    this.content.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry && mesh.geometry !== this.sphere && mesh.geometry !== this.cylinder) mesh.geometry.dispose();
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose();
    });
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
    this.content.clear();
    this.time = 0;
  }

  // ---- Neuron ---------------------------------------------------------------------------------------

  private buildNeuron() {
    const rand = rng(3);
    const bodyMat = this.material({ color: "#c9a3d6", roughness: 0.5, sheen: 0.5 });
    const g = this.content;
    const soma = new THREE.Mesh(blob(1, 0.12, 4, v(1.1, 1, 0.85)), bodyMat);
    soma.position.set(-6, 0, 0);
    g.add(soma);
    const nucleus = new THREE.Mesh(blob(0.42, 0.06, 2), this.material({ color: "#6b4a9a" }));
    nucleus.position.set(-6.05, 0.1, 0.45);
    g.add(nucleus);
    // Dendrites: branching tapered tubes from the soma.
    const dendrites: { curve: THREE.CatmullRomCurve3; mat: THREE.MeshPhysicalMaterial }[] = [];
    const branch = (start: V3, dir: V3, len: number, r: number, depth: number) => {
      const pts = [start.clone()];
      const d = dir.clone();
      const p = start.clone();
      for (let i = 0; i < 4; i++) {
        d.add(v(rand() - 0.5, rand() - 0.5, (rand() - 0.5) * 0.6).multiplyScalar(0.5)).normalize();
        p.addScaledVector(d, len / 4);
        pts.push(p.clone());
      }
      const mat = this.material({ color: "#c9a3d6", roughness: 0.5, emissive: GLOW, emissiveIntensity: 0 });
      const { curve } = this.tube(pts, (t) => r * (1 - 0.65 * t), mat, g, 24);
      dendrites.push({ curve, mat });
      if (depth > 0) for (let k = 0; k < 2; k++) branch(p, d.clone().add(v(rand() - 0.5, rand() - 0.5, 0).multiplyScalar(1.2)).normalize(), len * 0.65, r * 0.55, depth - 1);
    };
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.55 + (i / 5) * Math.PI * 0.9;
      const d = v(Math.cos(a), Math.sin(a), (rand() - 0.5) * 0.5).normalize();
      branch(soma.position.clone().addScaledVector(d, 0.85), d, 2.2, 0.22, 2);
    }
    // Axon with myelin segments and nodes.
    const axonStart = soma.position.clone().add(v(1.05, 0, 0));
    const axonPts = Array.from({ length: 9 }, (_, i) => v(axonStart.x + i * 1.35, Math.sin(i * 0.8) * 0.35, Math.cos(i * 0.6) * 0.2));
    const axonMat = this.material({ color: "#b98fc9", roughness: 0.5, emissive: GLOW, emissiveIntensity: 0 });
    const hillock = this.tube([axonStart.clone().add(v(-0.3, 0, 0)), axonStart, axonPts[1]], (t) => 0.35 - 0.22 * t, axonMat, g, 16);
    void hillock;
    const { curve: axon } = this.tube(axonPts, 0.13, axonMat, g, 120);
    const myelinMat = this.material({ color: "#f3ead6", roughness: 0.6, sheen: 0.4 });
    const nodes: number[] = [];
    const SEG = 11;
    for (let i = 0; i < SEG; i++) {
      const a = 0.06 + (i / SEG) * 0.84;
      const b = a + 0.84 / SEG - 0.012;
      nodes.push(b + 0.006);
      const pts = Array.from({ length: 8 }, (_, k) => axon.getPointAt(a + ((b - a) * k) / 7));
      this.tube(pts, (t) => 0.3 * Math.sqrt(Math.max(0.05, Math.sin(Math.PI * t))), myelinMat, g, 16);
    }
    // Axon terminals.
    const end = axon.getPointAt(1);
    const terminals: THREE.Mesh[] = [];
    const termMat = this.material({ color: "#b98fc9", emissive: GLOW, emissiveIntensity: 0 });
    for (let i = 0; i < 5; i++) {
      const a = -0.9 + (i / 4) * 1.8;
      const tip = end.clone().add(v(1.2, Math.sin(a) * 1.3, Math.cos(a * 2) * 0.4));
      this.tube([end, end.clone().lerp(tip, 0.5).add(v(0, Math.sin(a) * 0.2, 0)), tip], 0.07, termMat, g, 16);
      const knob = new THREE.Mesh(this.sphere, termMat);
      knob.scale.setScalar(0.18);
      knob.position.copy(tip);
      g.add(knob);
      terminals.push(knob);
    }
    // The impulse: a glowing pulse travelling dendrites → soma → axon (jumping node to node) → terminals.
    const pulse = new THREE.Mesh(this.sphere, this.material({ color: "#ffd23f", emissive: "#ffb800", emissiveIntensity: 1.2, transparent: true, opacity: 0.9 }));
    pulse.scale.setScalar(0.22);
    g.add(pulse);
    const PERIOD = 6;
    this.tickers.push((_, dt) => {
      if (this.playing && !this.reduceMotion) this.time += dt;
      const u = (this.time % PERIOD) / PERIOD;
      for (const d of dendrites) d.mat.emissiveIntensity = 0.5 * gauss(u, 0.08, 0.06);
      bodyMat.emissive.copy(GLOW);
      bodyMat.emissiveIntensity = 0.4 * gauss(u, 0.2, 0.06);
      if (u < 0.25) {
        pulse.visible = u > 0.12;
        pulse.position.copy(soma.position);
      } else if (u < 0.85) {
        // Saltatory: dwell at each node, then jump.
        const k = (u - 0.25) / 0.6;
        const idx = Math.min(nodes.length - 1, Math.floor(k * nodes.length));
        const frac = k * nodes.length - idx;
        const from = idx === 0 ? 0.02 : nodes[idx - 1];
        const to = nodes[idx];
        pulse.visible = true;
        pulse.position.copy(axon.getPointAt(from + (to - from) * smoothstep(0.55, 1, frac)));
      } else {
        pulse.visible = false;
      }
      axonMat.emissiveIntensity = 0;
      termMat.emissiveIntensity = 0.8 * gauss(u, 0.9, 0.04);
      pulse.scale.setScalar(0.22 * (1 + 0.25 * Math.sin(this.time * 18)));
    });
    const A = (p: V3, text: string) => this.label(this.anchor(g, p), text);
    A(v(-6, 1.1, 0.4), "ნეირონის სხეული");
    A(nucleus.position.clone().add(v(0, 0, 0.4)), "ბირთვი");
    A(dendrites[0].curve.getPointAt(0.9), "დენდრიტები");
    A(axon.getPointAt(nodes[3] - 0.03).add(v(0, 0.32, 0)), "მიელინის გარსი");
    A(axon.getPointAt(nodes[6]).add(v(0, -0.25, 0)), "რანვიეს კვანძი");
    A(axon.getPointAt(0.03).add(v(0, -0.3, 0)), "აქსონი");
    A(terminals[1].position, "სინაფსური დაბოლოებები");
    this.label(pulse, "იმპულსი", "tag");
    this.onStep("აგზნება: დენდრიტები → სხეული → აქსონი → დაბოლოებები");
    return { distance: 18, width: 23, target: v(0.2, 0, 0) };
  }

  // ---- Impulse on the membrane ------------------------------------------------------------------------

  private buildImpulse() {
    const rand = rng(11);
    const g = this.content;
    const W = 12;
    const D = 5;
    // Lipid bilayer: two sheets of heads.
    const heads: THREE.Matrix4[] = [];
    for (let i = 0; i <= 40; i++)
      for (let k = 0; k <= 16; k++)
        for (const s of [1, -1]) heads.push(new THREE.Matrix4().compose(v(-W / 2 + (i * W) / 40 + (k % 2) * 0.15, s * 0.55, -D / 2 + (k * D) / 16), new THREE.Quaternion(), v(0.17, 0.17, 0.17)));
    const headMesh = new THREE.InstancedMesh(this.sphere, this.material({ color: "#e88a8a" }), heads.length);
    heads.forEach((m, i) => headMesh.setMatrixAt(i, m));
    g.add(headMesh);
    const core = new THREE.Mesh(new THREE.BoxGeometry(W, 0.9, D), this.material({ color: "#f5d78a", roughness: 0.7 }));
    g.add(core);
    // Channels along x: Na⁺ (yellow) and K⁺ (purple); each opens when the wave passes it.
    const channels: { x: number; type: "na" | "k"; gate: THREE.Mesh }[] = [];
    const naMat = this.material({ color: "#e0a72e" });
    const kMat = this.material({ color: "#7d5ba6" });
    for (let i = 0; i < 6; i++) {
      for (const type of ["na", "k"] as const) {
        const x = -W / 2 + 1 + i * 2 + (type === "k" ? 0.8 : 0);
        const z = type === "na" ? -0.8 : 0.9;
        for (let s = 0; s < 4; s++) {
          const a = (s / 4) * Math.PI * 2;
          const sub = new THREE.Mesh(this.cylinder, type === "na" ? naMat : kMat);
          sub.scale.set(0.16, 1.5, 0.16);
          sub.position.set(x + Math.cos(a) * 0.25, 0, z + Math.sin(a) * 0.25);
          g.add(sub);
        }
        const gate = new THREE.Mesh(this.sphere, type === "na" ? naMat : kMat);
        gate.scale.set(0.3, 0.12, 0.3);
        gate.position.set(x, 0.78, z);
        g.add(gate);
        channels.push({ x, type, gate });
      }
    }
    // Ions: Na⁺ mostly outside (above), K⁺ mostly inside (below).
    const ions = (count: number, color: string, outside: boolean, seed: number) => {
      const r = rng(seed);
      const mesh = new THREE.InstancedMesh(this.sphere, this.material({ color, emissive: color, emissiveIntensity: 0.2 }), count);
      g.add(mesh);
      return { mesh, ps: Array.from({ length: count }, () => ({ x: (r() - 0.5) * W, z: (r() - 0.5) * D, y: (outside ? 1 : -1) * (1.1 + r() * 1.6), phase: r() * 6 })) };
    };
    const na = ions(70, "#f2c230", true, 1);
    const k = ions(55, "#9a6fd0", false, 2);
    void rand;
    const front = this.anchor(g, v(0, 0, 0));
    this.label(front, "იმპულსი →", "tag");
    this.label(this.anchor(g, v(-W / 2 + 0.4, 2.6, D / 2)), "უჯრედის გარეთ: Na⁺ ბევრია", "tag");
    this.label(this.anchor(g, v(-W / 2 + 0.4, -2.6, D / 2)), "უჯრედის შიგნით: K⁺ ბევრია", "tag");
    this.label(this.anchor(g, v(channels[0].x, 1.0, -0.8)), "Na⁺ არხი");
    this.label(this.anchor(g, v(channels[1].x, -1.0, 0.9)), "K⁺ არხი");
    const draw = this.chart();
    const PERIOD = 7;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = v(0.12, 0.12, 0.12);
    this.tickers.push((t, dt) => {
      if (this.playing && !this.reduceMotion) this.time += dt;
      const u = (this.time % PERIOD) / PERIOD;
      const waveX = -W / 2 - 1 + u * (W + 3);
      front.position.set(Math.min(W / 2, waveX), 2.2, 0);
      // Local state of a point: ms since the wave reached it (1 unit of x ≈ 0.35 ms).
      const local = (x: number) => (waveX - x) / 0.35 / 2;
      for (const c of channels) {
        const ms = local(c.x);
        const open = c.type === "na" ? (ms > 0.5 && ms < 1.2 ? 1 : 0) : ms > 1 && ms < 2.6 ? 1 : 0;
        c.gate.position.y = (c.type === "na" ? 0.78 : -0.78) + (c.type === "na" ? 1 : -1) * open * 0.4;
      }
      const place = (set: typeof na, outside: boolean) => {
        set.ps.forEach((p, i) => {
          const ms = local(p.x);
          // Ions near an open channel move across while it is open.
          const crossing = outside ? (ms > 0.5 && ms < 1.2 ? smoothstep(0.5, 1.2, ms) : ms >= 1.2 && ms < 4 ? 1 - smoothstep(2.5, 4, ms) : 0) : ms > 1 && ms < 2.6 ? smoothstep(1, 2.6, ms) : ms >= 2.6 && ms < 4.5 ? 1 - smoothstep(3, 4.5, ms) : 0;
          const share = i % 4 === 0 ? crossing : 0;
          const y = p.y * (1 - 2 * share * (1 - 0.5 * share));
          m4.compose(v(p.x + Math.sin(t + p.phase) * 0.08, y + Math.cos(t * 1.3 + p.phase) * 0.08, p.z), q, s);
          set.mesh.setMatrixAt(i, m4);
        });
        set.mesh.instanceMatrix.needsUpdate = true;
      };
      place(na, true);
      place(k, false);
      const ms0 = local(0);
      draw(ms0);
      this.onStep(ms0 < 0.5 ? "მოსვენება: −70 მვ" : ms0 < 1.2 ? "დეპოლარიზაცია: Na⁺ შემოდის" : ms0 < 2.6 ? "რეპოლარიზაცია: K⁺ გადის" : "ტუმბო აღადგენს იონებს");
    });
    return { distance: 15, dir: v(0.15, 0.32, 1), width: 14 };
  }

  /** Membrane potential chart in the corner; the dot is the middle of the membrane. */
  private chart() {
    const c = document.createElement("canvas");
    c.className = "heart-chart";
    c.width = 600;
    c.height = 200;
    this.overlay.appendChild(c);
    this.graph = c;
    const ctx = c.getContext("2d")!;
    return (ms: number) => {
      const W = c.width;
      const H = c.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fillRect(0, 0, W, H);
      const x = (t: number) => 20 + ((t + 1) / 6) * (W - 40);
      const y = (mv: number) => H - 30 - ((mv + 90) / 130) * (H - 60);
      ctx.font = "bold 22px FiraGO, sans-serif";
      ctx.fillStyle = "#33413e";
      ctx.fillText("მემბრანის პოტენციალი, მვ", 14, 30);
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = "#97a29e";
      ctx.font = "18px FiraGO, sans-serif";
      for (const [mv, t] of [
        [0, "0"],
        [-70, "−70"],
        [30, "+30"],
      ] as const) {
        ctx.beginPath();
        ctx.moveTo(0, y(mv));
        ctx.lineTo(W, y(mv));
        ctx.stroke();
        ctx.fillText(t, W - 50, y(mv) - 5);
      }
      ctx.setLineDash([]);
      ctx.strokeStyle = "#7d5ba6";
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let t = -1; t <= 5; t += 0.02) {
        if (t === -1) ctx.moveTo(x(t), y(potential(t)));
        else ctx.lineTo(x(t), y(potential(t)));
      }
      ctx.stroke();
      const now = Math.max(-1, Math.min(5, ms));
      ctx.fillStyle = "#e0a72e";
      ctx.beginPath();
      ctx.arc(x(now), y(potential(now)), 9, 0, Math.PI * 2);
      ctx.fill();
    };
  }

  // ---- Synapse --------------------------------------------------------------------------------------

  private buildSynapse() {
    const g = this.content;
    const rand = rng(21);
    // Presynaptic bouton (top) and postsynaptic membrane (bottom).
    const bouton = new THREE.Mesh(blob(1, 0.04, 3, v(2.6, 1.9, 2.1)), this.material({ color: "#c9a3d6", transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
    bouton.position.set(0, 2.3, 0);
    bouton.renderOrder = 2;
    g.add(bouton);
    const axon = new THREE.Mesh(this.cylinder, this.material({ color: "#b98fc9" }));
    axon.scale.set(0.7, 3, 0.7);
    axon.position.set(0, 5.2, 0);
    g.add(axon);
    const post = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 5), this.material({ color: "#8fb3d9", roughness: 0.6 }));
    post.position.set(0, -0.6, 0);
    g.add(post);
    // Receptors on the postsynaptic membrane.
    const receptors: THREE.Mesh[] = [];
    const recMat = this.material({ color: "#3f6fb5" });
    for (let i = 0; i < 9; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.07, 8, 16), recMat);
      r.rotation.x = Math.PI / 2;
      r.position.set(-2.4 + (i % 5) * 1.2, -0.3, i < 5 ? -0.6 : 0.6);
      g.add(r);
      receptors.push(r);
    }
    // Vesicles inside the bouton.
    const vesMat = this.material({ color: "#f2c230", transparent: true, opacity: 0.85 });
    const vesicles = Array.from({ length: 16 }, (_, i) => {
      const m = new THREE.Mesh(this.sphere, vesMat);
      m.scale.setScalar(0.32);
      const home = v((rand() - 0.5) * 3.4, 1.9 + rand() * 1.4, (rand() - 0.5) * 2.6);
      m.position.copy(home);
      g.add(m);
      return { m, home, docked: i < 5, release: (i % 5) * 0.06 };
    });
    // Transmitter molecules.
    const NT = 90;
    const nt = new THREE.InstancedMesh(this.sphere, this.material({ color: "#f08a3c", emissive: "#f08a3c", emissiveIntensity: 0.3 }), NT);
    g.add(nt);
    const molecules = Array.from({ length: NT }, () => ({ x: (rand() - 0.5) * 3, z: (rand() - 0.5) * 2.4, delay: rand() * 0.15 }));
    const pulse = new THREE.Mesh(this.sphere, this.material({ color: "#ffd23f", emissive: "#ffb800", emissiveIntensity: 1.2 }));
    pulse.scale.setScalar(0.35);
    g.add(pulse);
    const postGlow = post.material as THREE.MeshPhysicalMaterial;
    const PERIOD = 6;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    this.tickers.push((_, dt) => {
      if (this.playing && !this.reduceMotion) this.time += dt;
      const u = (this.time % PERIOD) / PERIOD;
      // 1. impulse arrives down the axon
      pulse.visible = u < 0.2;
      pulse.position.set(0, 7 - u * 25, 0);
      // 2. docked vesicles fuse with the membrane
      for (const ve of vesicles) {
        if (!ve.docked) continue;
        const f = smoothstep(0.18 + ve.release, 0.3 + ve.release, u);
        ve.m.position.copy(ve.home).lerp(v(ve.home.x, 0.55, ve.home.z * 0.6), f);
        ve.m.scale.setScalar(0.32 * (1 - smoothstep(0.85, 1, f)) * (u > 0.95 ? 0 : 1) + 0.0001);
        if (u < 0.05) ve.m.scale.setScalar(0.32);
      }
      // 3. transmitter crosses the cleft and binds; 4. enzyme removes it
      molecules.forEach((mo, i) => {
        const a = smoothstep(0.3 + mo.delay, 0.55 + mo.delay, u);
        const gone = smoothstep(0.78, 0.9, u);
        const y = 0.5 - a * 0.75;
        m4.compose(v(mo.x * (0.5 + a * 0.6), y, mo.z * (0.5 + a * 0.6)), q, v(1, 1, 1).multiplyScalar(u > 0.3 && gone < 1 ? 0.07 * (1 - gone) : 0.0001));
        nt.setMatrixAt(i, m4);
      });
      nt.instanceMatrix.needsUpdate = true;
      postGlow.emissive.copy(GLOW);
      postGlow.emissiveIntensity = 0.5 * smoothstep(0.55, 0.65, u) * (1 - smoothstep(0.8, 0.9, u));
      for (const r of receptors) r.scale.setScalar(1 + 0.3 * smoothstep(0.55, 0.65, u) * (1 - smoothstep(0.8, 0.9, u)));
      this.onStep(u < 0.2 ? "1. იმპულსი აქსონის დაბოლოებას აღწევს" : u < 0.35 ? "2. ბუშტუკები მემბრანას ერწყმის" : u < 0.6 ? "3. მედიატორი ნაპრალს კვეთს და რეცეპტორებს უკავშირდება" : u < 0.8 ? "4. მომდევნო უჯრედში ახალი იმპულსი იწყება" : "5. ფერმენტი მედიატორს შლის");
    });
    const A = (p: V3, text: string) => this.label(this.anchor(g, p), text);
    A(v(2.4, 3.2, 0), "პრესინაფსური დაბოლოება");
    A(vesicles[8].home, "ბუშტუკები მედიატორით");
    A(v(-3.4, 0.2, 0), "სინაფსური ნაპრალი");
    A(v(2.6, -0.3, 0.6), "რეცეპტორები");
    A(v(-3.5, -0.9, 2.5), "პოსტსინაფსური მემბრანა");
    return { distance: 14, dir: v(0.35, 0.2, 1), target: v(0, 1.6, 0) };
  }

  // ---- Reflex arc -----------------------------------------------------------------------------------

  private buildReflex() {
    const g = this.content;
    // Spinal cord section: white matter disc with a grey "butterfly".
    const cord = new THREE.Group();
    cord.position.set(3.2, 1.2, 0);
    g.add(cord);
    const white = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.9, 48), this.material({ color: "#e4dccb", roughness: 0.7 }));
    white.rotation.x = Math.PI / 2;
    cord.add(white);
    const shape = new THREE.Shape();
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const r = 0.55 + 0.45 * Math.abs(Math.sin(2 * a)) ** 0.8;
      pts.push(new THREE.Vector2(Math.cos(a) * r * 1.15, Math.sin(a) * r * 0.9));
    }
    shape.setFromPoints(pts);
    const grey = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.94, bevelEnabled: false }), this.material({ color: "#a89c9f", roughness: 0.7 }));
    grey.position.z = -0.47;
    cord.add(grey);
    const canal = new THREE.Mesh(this.sphere, this.material({ color: "#6b8fb5" }));
    canal.scale.set(0.08, 0.08, 0.5);
    cord.add(canal);
    // Ganglion of the dorsal root.
    const ganglion = new THREE.Mesh(blob(1, 0.1, 5, v(0.45, 0.35, 0.35)), this.material({ color: "#d9b9a0" }));
    ganglion.position.set(0.6, 3.4, 0);
    g.add(ganglion);
    // Arm/hand outline and the hot object.
    const skin = this.material({ color: "#f1c7a8", roughness: 0.6 });
    const arm = this.tube([v(-7.5, -2.6, 0), v(-4.5, -2.4, 0), v(-1.5, -1.9, 0), v(0.6, -1.2, 0)], (t) => 0.75 - 0.15 * t, skin, g, 40);
    void arm;
    const hand = new THREE.Mesh(blob(1, 0.08, 7, v(0.9, 0.45, 0.6)), skin);
    hand.position.set(-8.2, -2.7, 0);
    g.add(hand);
    const stove = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.35, 32), this.material({ color: "#d9434f", emissive: "#ff5a2a", emissiveIntensity: 0.6 }));
    stove.position.set(-8.6, -3.45, 0);
    g.add(stove);
    // Biceps — the working organ.
    const muscle = new THREE.Mesh(blob(1, 0.08, 9, v(1.5, 0.45, 0.5)), this.material({ color: "#b5524a", emissive: GLOW, emissiveIntensity: 0 }));
    muscle.position.set(-3.6, -1.75, 0.3);
    g.add(muscle);
    // The five links as nerve paths.
    const sensoryPts = [v(-8.2, -2.5, 0.3), v(-5, -2.1, 0.5), v(-2, -1.0, 0.6), v(0.2, 1.8, 0.4), ganglion.position.clone(), v(2.2, 3.1, 0.3), v(2.9, 1.9, 0.5)];
    const interPts = [v(2.9, 1.9, 0.5), v(3.2, 1.3, 0.5), v(2.6, 0.7, 0.5)];
    const motorPts = [v(2.6, 0.7, 0.5), v(1.6, 0.0, 0.6), v(0.2, -0.6, 0.6), v(-1.8, -1.1, 0.7), muscle.position.clone().add(v(0.6, 0.1, 0.2))];
    const sensMat = this.material({ color: "#3474d4", emissive: GLOW, emissiveIntensity: 0 });
    const interMat = this.material({ color: "#2f9e62", emissive: GLOW, emissiveIntensity: 0 });
    const motorMat = this.material({ color: "#d9434f", emissive: GLOW, emissiveIntensity: 0 });
    const sensory = this.tube(sensoryPts, 0.07, sensMat, g, 120).curve;
    const inter = this.tube(interPts, 0.07, interMat, g, 30).curve;
    const motor = this.tube(motorPts, 0.07, motorMat, g, 100).curve;
    const receptor = new THREE.Mesh(this.sphere, sensMat);
    receptor.scale.setScalar(0.18);
    receptor.position.copy(sensoryPts[0]);
    g.add(receptor);
    const pulse = new THREE.Mesh(this.sphere, this.material({ color: "#ffd23f", emissive: "#ffb800", emissiveIntensity: 1.3 }));
    pulse.scale.setScalar(0.22);
    g.add(pulse);
    const handHome = hand.position.clone();
    const PERIOD = 6;
    const steps = ["1. რეცეპტორი კანში ცხელს აღიქვამს", "2. მგრძნობიარე ნეირონი იმპულსს ზურგის ტვინში ატარებს", "3. ჩართული ნეირონი რუხ ნივთიერებაში", "4. მამოძრავებელი ნეირონი იმპულსს კუნთისკენ ატარებს", "5. კუნთი იკუმშება — ხელი უკან იწევს"];
    this.tickers.push((_, dt) => {
      if (this.playing && !this.reduceMotion) this.time += dt;
      const u = (this.time % PERIOD) / PERIOD;
      let step = 0;
      if (u < 0.1) {
        pulse.position.copy(sensoryPts[0]);
        step = 0;
      } else if (u < 0.45) {
        sensory.getPointAt((u - 0.1) / 0.35, pulse.position);
        step = 1;
      } else if (u < 0.55) {
        inter.getPointAt((u - 0.45) / 0.1, pulse.position);
        step = 2;
      } else if (u < 0.85) {
        motor.getPointAt((u - 0.55) / 0.3, pulse.position);
        step = 3;
      } else step = 4;
      pulse.visible = u < 0.85;
      receptor.scale.setScalar(0.18 * (1 + 0.6 * gauss(u, 0.05, 0.04)));
      sensMat.emissiveIntensity = step === 1 ? 0.5 : 0;
      interMat.emissiveIntensity = step === 2 ? 0.6 : 0;
      motorMat.emissiveIntensity = step === 3 ? 0.5 : 0;
      const contract = smoothstep(0.85, 0.92, u) * (1 - smoothstep(0.97, 1, u));
      (muscle.material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.5 * contract;
      muscle.scale.set(1 - 0.12 * contract, 1 + 0.35 * contract, 1 + 0.2 * contract);
      hand.position.copy(handHome).add(v(0.6 * contract, 1.2 * contract, 0));
      this.onStep(steps[step]);
    });
    const A = (p: V3, text: string, kind: "label" | "tag" = "label") => this.label(this.anchor(g, p), text, kind);
    A(sensoryPts[0].clone().add(v(0, 0.3, 0)), "1 · რეცეპტორი");
    A(sensoryPts[2].clone().add(v(0, 0.2, 0)), "2 · მგრძნობიარე ნეირონი");
    A(ganglion.position.clone().add(v(0, 0.4, 0)), "ზურგის კვანძი");
    A(v(3.2, 2.9, 0.5), "ზურგის ტვინი");
    A(interPts[1].clone().add(v(0.3, 0, 0)), "3 · ჩართული ნეირონი");
    A(motorPts[2].clone().add(v(0, -0.25, 0)), "4 · მამოძრავებელი ნეირონი");
    A(muscle.position.clone().add(v(0, 0.5, 0)), "5 · კუნთი");
    A(v(3.2, -0.6, 0.5), "რუხი ნივთიერება — „პეპელა“", "tag");
    return { distance: 16, dir: v(0.1, 0.15, 1), width: 17.5, target: v(-2.2, 0.3, 0) };
  }

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
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    for (const l of this.labels) {
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
    for (const tick of this.tickers) tick(this.clock.elapsedTime, dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.clear();
    this.sphere.dispose();
    this.cylinder.dispose();
    this.env.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

