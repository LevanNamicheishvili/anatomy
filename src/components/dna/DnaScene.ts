import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { fbm, smoothstep } from "@/lib/noise";
import { BASE_COLORS, BASE_NAMES, CODONS, GLOBIN, MRNA, complement, type Base, type ChromosomeStep, type DnaView } from "./dna-data";

/*
 * DNA scenes. Molecules are real: every atom comes from crystal structures in the Protein Data Bank
 * (public/dna/dna.json, built by scripts/build-dna.mjs). A helix of any sequence is assembled from
 * four real base-pair templates with B-DNA's 36° twist and 0.338 nm rise. Processes (replication,
 * transcription, translation) use a simplified "ladder" model, as textbooks do. Units: 1 = 1 nm.
 */

export interface DnaOptions {
  mode: "atoms" | "scheme";
  base: Base;
  step: ChromosomeStep;
  mutant: boolean;
}

type Part = "P" | "S" | "B";
type AtomRow = [number, number, number, string, number, Part, string];
interface Template {
  pair: string;
  atoms: AtomRow[];
  hbonds: [number, number][];
}
interface DnaData {
  twistSign: number;
  riseSign: number;
  templates: Record<string, Template>;
  nucleosome: { dna: [number, number, number, string, number, Part, string][]; histones: [number, number, number, string][] };
}

interface Atom {
  p: THREE.Vector3;
  el: string;
  part: Part;
  base: string;
  strand: number;
  pair: number;
  name: string;
}

interface Label {
  target: THREE.Object3D;
  offset: THREE.Vector3;
  el: HTMLDivElement;
}

/** One nucleotide of the simplified model: backbone point, direction towards its partner, base letter. */
interface Nt {
  p: THREE.Vector3;
  d: THREE.Vector3;
  base: string;
  back: string;
  /** 0 = not there yet, 1 = fully built. */
  s: number;
  /** false = a gap before this nucleotide (unjoined Okazaki fragments). */
  link?: boolean;
}

/** Bump when public/dna is rebuilt. */
const DNA_VERSION = "2026-10-02";
const Å = 0.1;
const RISE = 0.338;
const TWIST = (36 * Math.PI) / 180;
const VDW: Record<string, number> = { C: 1.7, N: 1.55, O: 1.52, P: 1.8, S: 1.8 };
const SHADE: Record<string, number> = { C: 1, N: 0.86, O: 0.74, P: 1.05, S: 1 };
const PART_COLORS: Record<"P" | "S", string> = { P: "#f08c2e", S: "#c8d0da" };
const HISTONE_COLORS: Record<string, string> = { H3: "#ecc77a", H4: "#f2a96b", H2A: "#e8a0a0", H2B: "#d2b3e0" };
const OLD = "#2f5f9e";
const NEW = "#8cc63f";
const RNA = "#8e5bb5";
const PROTEIN = ["#d9434f", "#e07b39", "#2f9e62", "#3474d4", "#8e5bb5"];

let dataPromise: Promise<DnaData> | null = null;
const loadData = () => (dataPromise ??= fetch(`/dna/dna.json?v=${DNA_VERSION}`).then((r) => r.json() as Promise<DnaData>));

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t: number) => smoothstep(0, 1, t);

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

/** Soft, lumpy shape for proteins (enzymes, ribosome). */
function blob(radius: number, seed: number, amount = 0.14) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(radius, 4).deleteAttribute("normal").deleteAttribute("uv"));
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = fbm(v.x * 1.7 + seed, v.y * 1.7 - seed, v.z * 1.7 + seed * 0.5, 4);
    v.multiplyScalar(radius * (1 + amount * n));
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

const Y = new THREE.Vector3(0, 1, 0);

/** Draws nucleotides of the simplified model with three instanced meshes; positions change every frame. */
class Ladder {
  group = new THREE.Group();
  private sugar: THREE.InstancedMesh;
  private link: THREE.InstancedMesh;
  private stick: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private c = new THREE.Color();
  private a = new THREE.Vector3();
  private b = new THREE.Vector3();
  private v = new THREE.Vector3();

  constructor(cap: number, mat: THREE.Material, sphere: THREE.BufferGeometry, cyl: THREE.BufferGeometry) {
    this.sugar = new THREE.InstancedMesh(sphere, mat, cap);
    this.link = new THREE.InstancedMesh(cyl, mat, cap);
    this.stick = new THREE.InstancedMesh(cyl, mat, cap);
    for (const im of [this.sugar, this.link, this.stick]) {
      im.frustumCulled = false;
      im.count = 0;
      this.group.add(im);
    }
  }

  private cyl(im: THREE.InstancedMesh, i: number, from: THREE.Vector3, to: THREE.Vector3, r: number, color: string) {
    this.v.subVectors(to, from);
    const len = this.v.length();
    this.q.setFromUnitVectors(Y, this.v.divideScalar(len || 1));
    this.m.compose(this.a.addVectors(from, to).multiplyScalar(0.5), this.q, this.b.set(r, len, r));
    im.setMatrixAt(i, this.m);
    im.setColorAt(i, this.c.set(color));
  }

  update(strands: Nt[][], length = 0.86) {
    let ns = 0;
    let nl = 0;
    let nb = 0;
    for (const strand of strands)
      for (let i = 0; i < strand.length; i++) {
        const n = strand[i];
        if (n.s <= 0.02) continue;
        this.m.compose(n.p, this.q.identity(), this.v.setScalar(0.14 * n.s));
        this.sugar.setMatrixAt(ns, this.m);
        this.sugar.setColorAt(ns++, this.c.set(n.back));
        const from = this.a.copy(n.p).addScaledVector(n.d, 0.08).clone();
        const to = this.b.copy(n.p).addScaledVector(n.d, length * n.s).clone();
        this.cyl(this.stick, nb++, from, to, 0.08 * n.s, BASE_COLORS[n.base as Base] ?? "#999");
        const prev = strand[i - 1];
        if (prev && prev.s > 0.02 && n.link !== false) this.cyl(this.link, nl++, prev.p, n.p, 0.055 * Math.min(n.s, prev.s), n.back);
      }
    this.sugar.count = ns;
    this.link.count = nl;
    this.stick.count = nb;
    for (const im of [this.sugar, this.link, this.stick]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
  }

  dispose() {
    for (const im of [this.sugar, this.link, this.stick]) im.dispose();
  }
}

export class DnaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.05, 400);
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
  private data: DnaData | null = null;
  private pending: { view: DnaView; opts: DnaOptions } | null = null;
  private viewStart = 0;

  // Shared, never freed until the scene is.
  private sphere = new THREE.IcosahedronGeometry(1, 2);
  private sphereLow = new THREE.IcosahedronGeometry(1, 1);
  private cylinder = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  private atomMat = new THREE.MeshPhysicalMaterial({ roughness: 0.36, clearcoat: 0.45, clearcoatRoughness: 0.3 });
  private shared = new Set<THREE.BufferGeometry>([this.sphere, this.sphereLow, this.cylinder]);

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
    private onReady: () => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.env.texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight("#ffffff", 1.5);
    key.position.set(4, 6, 8);
    const rim = new THREE.DirectionalLight("#e4eefc", 0.7);
    rim.position.set(-6, -2, -5);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#d9e2df", 0.7), key, rim, this.content);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.autoRotateSpeed = 0.7;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
    loadData().then((d) => {
      if (this.disposed) return;
      this.data = d;
      this.onReady();
      if (this.pending) this.setView(this.pending.view, this.pending.opts);
    });
  }

  // ---- Views ----------------------------------------------------------------------------------------

  setView(view: DnaView, opts: DnaOptions) {
    if (!this.data) {
      this.pending = { view, opts };
      return;
    }
    this.clear();
    const builders: Record<DnaView, () => { distance: number; rotate: boolean; height?: number }> = {
      helix: () => this.buildHelixView("ATGGTGCACCTGACTCCTGA", opts.mode),
      nucleotide: () => this.buildNucleotide(opts.base),
      pairing: () => this.buildPairing(),
      replication: () => this.buildReplication(),
      transcription: () => this.buildTranscription(),
      translation: () => this.buildTranslation(),
      chromosome: () => this.buildChromosome(opts.step),
      mutation: () => this.buildMutation(opts.mutant, opts.mode),
    };
    const built = builders[view]();
    this.viewStart = this.clock.elapsedTime;
    const distance = built.distance * Math.max(1, 1.3 / this.camera.aspect);
    this.camera.position.set(distance * 0.12, distance * 0.16 + (built.height ?? 0), distance);
    this.controls.target.set(0, built.height ?? 0, 0);
    this.controls.minDistance = distance * 0.35;
    this.controls.maxDistance = distance * 2;
    this.controls.autoRotate = built.rotate && !this.reduceMotion;
    this.controls.update();
  }

  private label(target: THREE.Object3D, text: string, offset = new THREE.Vector3(), kind: "label" | "tag" = "label") {
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
    const l = { target, offset, el };
    this.labels.push(l);
    return l;
  }

  /** An invisible point to hang a label on. */
  private anchor(parent: THREE.Object3D, p: THREE.Vector3) {
    const o = new THREE.Object3D();
    o.position.copy(p);
    parent.add(o);
    return o;
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
    this.content.rotation.set(0, 0, 0);
  }

  private material(params: THREE.MeshPhysicalMaterialParameters) {
    const m = new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.3, ...params });
    this.disposables.push(m);
    return m;
  }

  // ---- Atoms ------------------------------------------------------------------------------------------

  /** Atoms of a double helix with the given sequence (strand 1 is complementary), axis along z. */
  private helixAtoms(seq: string) {
    const d = this.data!;
    const out: Atom[] = [];
    const n = seq.length;
    for (let i = 0; i < n; i++) {
      const b = seq[i] as Base;
      const t = d.templates[b + complement(b)];
      const th = d.twistSign * TWIST * i;
      const c = Math.cos(th);
      const s = Math.sin(th);
      const z0 = d.riseSign * RISE * (i - (n - 1) / 2);
      for (const [x, y, z, el, strand, part, name] of t.atoms)
        out.push({ p: new THREE.Vector3((x * c - y * s) * Å, (x * s + y * c) * Å, z * Å + z0), el, part, base: strand === 0 ? b : complement(b), strand, pair: i, name });
    }
    return out;
  }

  private atomColor(a: Atom, c: THREE.Color) {
    c.set(a.part === "B" ? BASE_COLORS[a.base as Base] : PART_COLORS[a.part]);
    return c.multiplyScalar(SHADE[a.el] ?? 1);
  }

  /** Space-filling (radius = van der Waals) or ball-and-stick atoms as one instanced mesh. */
  private atomsMesh(atoms: Atom[], style: "space" | "stick", geo = this.sphere, mat: THREE.Material = this.atomMat) {
    const im = new THREE.InstancedMesh(geo, mat, atoms.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    atoms.forEach((a, i) => {
      const r = (VDW[a.el] ?? 1.7) * Å * (style === "space" ? 0.95 : 0.26);
      m.compose(a.p, q, s.setScalar(r));
      im.setMatrixAt(i, m);
      im.setColorAt(i, this.atomColor(a, c));
    });
    return im;
  }

  /** Covalent bonds: heavy atoms closer than 1.9 Å. */
  private bondsMesh(atoms: Atom[]) {
    const cell = 0.2;
    const grid = new Map<string, number[]>();
    const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
    atoms.forEach((a, i) => {
      const k = key(Math.floor(a.p.x / cell), Math.floor(a.p.y / cell), Math.floor(a.p.z / cell));
      (grid.get(k) ?? grid.set(k, []).get(k)!).push(i);
    });
    const pairs: [number, number][] = [];
    atoms.forEach((a, i) => {
      const cx = Math.floor(a.p.x / cell);
      const cy = Math.floor(a.p.y / cell);
      const cz = Math.floor(a.p.z / cell);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++)
            for (const j of grid.get(key(cx + dx, cy + dy, cz + dz)) ?? [])
              if (j > i && a.p.distanceTo(atoms[j].p) < 0.19) pairs.push([i, j]);
    });
    // Each bond is two half-cylinders, coloured like the atom at its end.
    const im = new THREE.InstancedMesh(this.cylinder, this.atomMat, pairs.length * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const c = new THREE.Color();
    let n = 0;
    for (const [i, j] of pairs) {
      const a = atoms[i].p;
      const b = atoms[j].p;
      mid.addVectors(a, b).multiplyScalar(0.5);
      for (const [from, atom] of [[a, atoms[i]], [b, atoms[j]]] as const) {
        v.subVectors(mid, from);
        const len = v.length();
        q.setFromUnitVectors(Y, v.normalize());
        m.compose(v.copy(from).add(mid).multiplyScalar(0.5), q, new THREE.Vector3(0.016, len, 0.016));
        im.setMatrixAt(n, m);
        im.setColorAt(n++, this.atomColor(atom, c));
      }
    }
    return im;
  }

  /** Simplified helix for the "scheme" mode: backbone tubes through the phosphates, base pairs as rods. */
  private schemeHelix(atoms: Atom[], highlight?: number) {
    const g = new THREE.Group();
    for (const strand of [0, 1]) {
      const ps = atoms.filter((a) => a.strand === strand && a.name === "P").sort((a, b) => a.p.z - b.p.z);
      const curve = new THREE.CatmullRomCurve3(ps.map((a) => a.p));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, ps.length * 8, 0.09, 10), this.material({ color: PART_COLORS.S })));
      const balls = this.atomsMesh(ps, "space");
      balls.scale.setScalar(1);
      for (let i = 0; i < ps.length; i++) {
        const m = new THREE.Matrix4().compose(ps[i].p, new THREE.Quaternion(), new THREE.Vector3().setScalar(0.13));
        balls.setMatrixAt(i, m);
        balls.setColorAt(i, new THREE.Color(PART_COLORS.P));
      }
      g.add(balls);
    }
    const n = Math.max(...atoms.map((a) => a.pair)) + 1;
    const rods = new THREE.InstancedMesh(this.cylinder, this.atomMat, n * 2);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = atoms.find((x) => x.pair === i && x.strand === 0 && x.name === "C1'")!;
      const b = atoms.find((x) => x.pair === i && x.strand === 1 && x.name === "C1'")!;
      const mid = a.p.clone().add(b.p).multiplyScalar(0.5);
      [a, b].forEach((x, k) => {
        v.subVectors(mid, x.p);
        const len = v.length() - 0.03;
        q.setFromUnitVectors(Y, v.clone().normalize());
        const r = highlight === i ? 0.11 : 0.075;
        m.compose(x.p.clone().addScaledVector(v.normalize(), len / 2), q, new THREE.Vector3(r, len, r));
        rods.setMatrixAt(i * 2 + k, m);
        rods.setColorAt(i * 2 + k, new THREE.Color(BASE_COLORS[x.base as Base]));
      });
    }
    g.add(rods);
    return g;
  }

  // ---- View: the double helix ------------------------------------------------------------------------

  /**
   * Where the grooves and backbone are, as angle phases along the axis: a point on the backbone of
   * strand 0 has angle `p0 + k·z`. Measured from the actual phosphates.
   */
  private helixPhases(atoms: Atom[]) {
    const k = (this.data!.twistSign * TWIST) / (this.data!.riseSign * RISE);
    const phase = (strand: number) => {
      let sx = 0;
      let sy = 0;
      for (const a of atoms)
        if (a.name === "P" && a.strand === strand) {
          const ang = Math.atan2(a.p.y, a.p.x) - k * a.p.z;
          sx += Math.cos(ang);
          sy += Math.sin(ang);
        }
      return Math.atan2(sy, sx);
    };
    const p0 = phase(0);
    const p1 = phase(1);
    const minor = p0 + wrapAngle(p1 - p0) / 2;
    return { k, backbone: p0, minor, major: minor + Math.PI };
  }

  private buildHelixView(seq: string, mode: "atoms" | "scheme") {
    const atoms = this.helixAtoms(seq);
    const length = seq.length * RISE;
    const inner = new THREE.Group();
    inner.rotation.x = -Math.PI / 2; // helix axis (z) → up
    inner.add(mode === "atoms" ? this.atomsMesh(atoms, "space") : this.schemeHelix(atoms));
    this.content.add(inner);

    // Labels that always point at the side facing the viewer: they slide along the helix as it turns.
    const ph = this.helixPhases(atoms);
    const period = (2 * Math.PI) / Math.abs(ph.k);
    const half = length / 2 - 0.45;
    const tracked = [
      { phase: ph.backbone, r: 1.0, z: 1.9, text: "შაქარ-ფოსფატის ჯაჭვი" },
      { phase: ph.major, r: 0.72, z: -0.4, text: "დიდი ღარი" },
      { phase: ph.minor, r: 0.82, z: -2.3, text: "პატარა ღარი" },
      { phase: ph.major, r: 0.25, z: 3.0, text: "აზოტოვანი ფუძეები" },
    ].map((t) => ({ ...t, o: this.anchor(inner, new THREE.Vector3()) }));
    for (const t of tracked) this.label(t.o, t.text);
    const cam = new THREE.Vector3();
    const place = () => {
      inner.updateMatrixWorld();
      inner.worldToLocal(cam.copy(this.camera.position));
      const alpha = Math.atan2(cam.y, cam.x);
      for (const t of tracked) {
        const z0 = (alpha - t.phase) / ph.k;
        let z = z0 + Math.round((t.z - z0) / period) * period;
        if (z > half) z -= period;
        if (z < -half) z += period;
        t.z = z;
        t.o.position.set(t.r * Math.cos(alpha), t.r * Math.sin(alpha), z);
      }
    };
    place();

    // Measurements, always on the viewer's right and below: one turn = 3.4 nm, width = 2 nm.
    const board = new THREE.Group();
    const lineMat = this.material({ color: "#33413e", roughness: 0.8, clearcoat: 0 });
    const bar = (a: THREE.Vector3, b: THREE.Vector3) => {
      const v = b.clone().sub(a);
      const mesh = new THREE.Mesh(this.cylinder, lineMat);
      mesh.position.copy(a).addScaledVector(v, 0.5);
      mesh.quaternion.setFromUnitVectors(Y, v.clone().normalize());
      mesh.scale.set(0.012, v.length(), 0.012);
      board.add(mesh);
    };
    const top = length / 2 - 0.3;
    const bottom = top - 10 * RISE;
    bar(new THREE.Vector3(1.45, bottom, 0), new THREE.Vector3(1.45, top, 0));
    bar(new THREE.Vector3(1.33, top, 0), new THREE.Vector3(1.57, top, 0));
    bar(new THREE.Vector3(1.33, bottom, 0), new THREE.Vector3(1.57, bottom, 0));
    const y0 = -length / 2 - 0.35;
    bar(new THREE.Vector3(-1, y0, 0), new THREE.Vector3(1, y0, 0));
    bar(new THREE.Vector3(-1, y0 - 0.1, 0), new THREE.Vector3(-1, y0 + 0.1, 0));
    bar(new THREE.Vector3(1, y0 - 0.1, 0), new THREE.Vector3(1, y0 + 0.1, 0));
    this.label(this.anchor(board, new THREE.Vector3(2.35, (top + bottom) / 2, 0)), "ერთი ხვია · 3,4 ნმ", undefined, "tag");
    this.label(this.anchor(board, new THREE.Vector3(0, y0 - 0.32, 0)), "2 ნმ", undefined, "tag");
    this.content.add(board);

    this.tickers.push(() => {
      board.rotation.y = Math.atan2(this.camera.position.x, this.camera.position.z);
      place();
    });
    return { distance: length * 1.95, rotate: true };
  }

  // ---- View: one nucleotide ------------------------------------------------------------------------

  private buildNucleotide(base: Base) {
    const d = this.data!;
    // The template that has this base on strand 0.
    const t = d.templates[base + complement(base)];
    const atoms: Atom[] = t.atoms
      .filter((a) => a[4] === 0)
      .map(([x, y, z, el, strand, part, name]) => ({ p: new THREE.Vector3(x * Å, y * Å, z * Å), el, part, base, strand, pair: 0, name }));
    const centre = atoms.reduce((s, a) => s.add(a.p), new THREE.Vector3()).divideScalar(atoms.length);
    for (const a of atoms) a.p.sub(centre);
    const g = new THREE.Group();
    g.add(this.atomsMesh(atoms, "stick"), this.bondsMesh(atoms));
    this.content.add(g);
    const mean = (part: Part) => {
      const list = atoms.filter((a) => a.part === part);
      return list.reduce((s, a) => s.add(a.p), new THREE.Vector3()).divideScalar(list.length);
    };
    this.label(this.anchor(g, mean("P")), "ფოსფორმჟავას ნაშთი");
    this.label(this.anchor(g, mean("S")), "დეზოქსირიბოზა");
    this.label(this.anchor(g, mean("B")), `აზოტოვანი ფუძე · ${BASE_NAMES[base]}`);
    this.tickers.push((t) => {
      g.rotation.y = Math.sin(t * 0.5) * 0.5;
      g.rotation.x = Math.sin(t * 0.37) * 0.15;
    });
    return { distance: 2.6, rotate: false };
  }

  // ---- View: base pairing ------------------------------------------------------------------------

  private buildPairing() {
    const d = this.data!;
    const g = new THREE.Group();
    const dots = new THREE.InstancedMesh(this.sphere, this.material({ color: "#24302d", roughness: 0.6 }), 40);
    let nd = 0;
    const m = new THREE.Matrix4();
    (["AT", "GC"] as const).forEach((key, row) => {
      const t = d.templates[key];
      const atoms: Atom[] = t.atoms.map(([x, y, z, el, strand, part, name]) => ({
        p: new THREE.Vector3(x * Å, y * Å, z * Å),
        el,
        part,
        base: key[strand],
        strand,
        pair: row,
        name,
      }));
      const centre = atoms.reduce((s, a) => s.add(a.p), new THREE.Vector3()).divideScalar(atoms.length);
      const shift = new THREE.Vector3(0, row === 0 ? 0.85 : -0.85, 0);
      for (const a of atoms) a.p.sub(centre).add(shift);
      g.add(this.atomsMesh(atoms, "stick"), this.bondsMesh(atoms));
      // Hydrogen bonds as dotted lines.
      const mids: THREE.Vector3[] = [];
      for (const [i, j] of t.hbonds) {
        const a = atoms[i].p;
        const b = atoms[j].p;
        mids.push(a.clone().add(b).multiplyScalar(0.5));
        for (let k = 1; k <= 4; k++) {
          m.compose(a.clone().lerp(b, k / 5), new THREE.Quaternion(), new THREE.Vector3().setScalar(0.014));
          dots.setMatrixAt(nd++, m);
        }
      }
      for (const strand of [0, 1]) {
        const list = atoms.filter((a) => a.strand === strand && a.part === "B");
        const c = list.reduce((s, a) => s.add(a.p), new THREE.Vector3()).divideScalar(list.length);
        this.label(this.anchor(g, c), BASE_NAMES[key[strand] as Base]);
      }
      const hb = mids.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(mids.length);
      this.label(this.anchor(g, hb), `${t.hbonds.length} წყალბადური ბმა`, new THREE.Vector3(0, row === 0 ? 0.42 : -0.42, 0), "tag");
    });
    dots.count = nd;
    g.add(dots);
    this.content.add(g);
    this.tickers.push((t) => {
      g.rotation.y = Math.sin(t * 0.45) * 0.4;
    });
    return { distance: 6.2, rotate: false };
  }

  // ---- Simplified-model helpers ---------------------------------------------------------------------

  private ladder(cap: number) {
    const l = new Ladder(cap, this.atomMat, this.sphere, this.cylinder);
    this.disposables.push(l);
    this.content.add(l.group);
    return l;
  }

  private protein(radius: number, seed: number, color: string, opacity = 0.42) {
    const mesh = new THREE.Mesh(
      blob(radius, seed),
      this.material({ color, transparent: true, opacity, depthWrite: false, roughness: 0.55, clearcoat: 0.2 }),
    );
    mesh.renderOrder = 2;
    return mesh;
  }

  /** Helix pose of nucleotide i on strand k (axis along x): on the cylinder, base pointing to the axis. */
  private helixPose(x: number, i: number, k: number, out: Nt, R = 0.95) {
    const th = TWIST * i + k * Math.PI;
    out.p.set(x, R * Math.cos(th), R * Math.sin(th));
    out.d.set(0, -Math.cos(th), -Math.sin(th));
  }

  // ---- View: replication -------------------------------------------------------------------------

  private buildReplication() {
    const N = 26;
    const a = 0.42;
    const rand = rng(7);
    const seq = Array.from({ length: N }, () => "ATGC"[Math.floor(rand() * 4)] as Base);
    const xs = seq.map((_, i) => (i - (N - 1) / 2) * a);
    const make = (base: string, back: string): Nt => ({ p: new THREE.Vector3(), d: new THREE.Vector3(), base, back, s: 1 });
    const old0 = seq.map((b) => make(b, OLD));
    const old1 = seq.map((b) => make(complement(b), OLD));
    const new0 = seq.map((b) => make(complement(b), NEW)); // pairs with old0: the leading strand
    const new1 = seq.map((b) => make(b, NEW)); // pairs with old1: the lagging strand
    const ladder = this.ladder(N * 4);

    const helicase = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.3, 16, 40), this.material({ color: "#e9c46a", transparent: true, opacity: 0.55, depthWrite: false }));
    helicase.rotation.y = Math.PI / 2;
    helicase.renderOrder = 2;
    const polLead = this.protein(0.75, 3, "#7fc4b8");
    const polLag = this.protein(0.75, 5, "#7fc4b8");
    this.content.add(helicase, polLead, polLag);
    this.label(helicase, "ჰელიკაზა", new THREE.Vector3(0, 1.5, 0));
    this.label(polLead, "დნმ-პოლიმერაზა", new THREE.Vector3(0, 0.7, 0));
    const oldTag = this.anchor(this.content, new THREE.Vector3());
    const newTag = this.anchor(this.content, new THREE.Vector3());
    const lagTag = this.anchor(this.content, new THREE.Vector3());
    this.label(oldTag, "ძველი ჯაჭვი");
    this.label(newTag, "ახალი ჯაჭვი · წამყვანი");
    this.label(lagTag, "ოკაზაკის ფრაგმენტები");

    const FRAG = 6;
    const DURATION = 17;
    const start = xs[N - 1] + 1.2;
    const end = xs[0] - 1.6;
    const sep = (d: number) => 1.5 * smoothstep(0.2, 2.6, d);
    const tmpA = make("A", OLD);
    const tmpB = make("A", OLD);

    this.tickers.push((time) => {
      const u = ((time - this.viewStart) % (DURATION + 2)) / DURATION;
      // The fork runs from right to left.
      const f = start + (end - start) * Math.min(1, u);
      let lagFront: number | null = null;
      for (let i = 0; i < N; i++) {
        const x = xs[i];
        const d = x - f; // > 0: already passed by the fork
        const open = smoothstep(0, 1.1, d);
        for (const [k, nt, sigma] of [[0, old0[i], 1], [1, old1[i], -1]] as const) {
          this.helixPose(x, i, k, tmpA);
          tmpB.p.set(x, sigma * (0.95 + sep(d)), 0);
          tmpB.d.set(0, -sigma, 0);
          nt.p.lerpVectors(tmpA.p, tmpB.p, open);
          nt.d.lerpVectors(tmpA.d, tmpB.d, open).normalize();
        }
        // old0 runs 5'→3' to the right, so its new partner grows 5'→3' to the left — towards the fork,
        // continuously: the leading strand.
        const lead = smoothstep(0.9, 1.4, d);
        new0[i].s = lead;
        new0[i].p.set(x, sep(d) - 0.95 + (1 - lead) * 0.9, (1 - lead) * 1.2);
        new0[i].d.set(0, 1, 0);
        // old1's partner must grow away from the fork: short Okazaki fragments, each started once the
        // fork has opened it, filled from its left end to the right.
        const first = Math.floor(i / FRAG) * FRAG;
        const ready = xs[first] - f;
        const s = smoothstep(0.9 + (i - first) * 0.22, 1.25 + (i - first) * 0.22, ready);
        new1[i].s = s;
        new1[i].p.set(x, -(sep(d) - 0.95) - (1 - s) * 0.9, (1 - s) * 1.2);
        new1[i].d.set(0, -1, 0);
        // A gap before each fragment until ligase joins it to the previous (left) one.
        new1[i].link = i % FRAG !== 0 || xs[i - FRAG] - f > 1.9 + FRAG * 0.22;
        if (s > 0.05 && s < 0.98 && lagFront === null) lagFront = x;
      }
      ladder.update([old0, old1, new0, new1]);

      helicase.position.set(f - 0.1, 0, 0);
      helicase.visible = u < 1;
      polLead.position.set(f + 1.2, 0.95, 0.15);
      polLead.visible = u < 1;
      polLag.visible = lagFront !== null;
      if (lagFront !== null) polLag.position.set(lagFront, -0.95, 0.15);
      const tagX = Math.min(xs[N - 1], f + 3.2);
      oldTag.position.set(tagX, 0.95 + sep(tagX - f), 0);
      newTag.position.set(tagX, sep(tagX - f) - 0.95, 0);
      lagTag.position.set(tagX, -(sep(tagX - f) - 0.95), 0);
      oldTag.visible = newTag.visible = lagTag.visible = tagX - f > 2.4;
    });
    return { distance: 15, rotate: false };
  }

  // ---- View: transcription -----------------------------------------------------------------------

  private buildTranscription() {
    const coding = "ATGGTGCACCTGACTCCTGAGGAGAAGTCT";
    const N = coding.length;
    const a = 0.42;
    const xs = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * a);
    const make = (base: string, back: string): Nt => ({ p: new THREE.Vector3(), d: new THREE.Vector3(), base, back, s: 1 });
    const codingNt = [...coding].map((b) => make(b, OLD));
    const templateNt = [...coding].map((b) => make(complement(b as Base), OLD));
    const rna = [...coding].map((b) => make(b === "T" ? "U" : b, RNA));
    const ladder = this.ladder(N * 3);
    const pol = this.protein(1.45, 11, "#e8a598", 0.32);
    pol.scale.set(1.25, 1, 1);
    this.content.add(pol);
    this.label(pol, "რნმ-პოლიმერაზა", new THREE.Vector3(0.9, 1.35, 0));
    const tplTag = this.anchor(this.content, new THREE.Vector3());
    const codTag = this.anchor(this.content, new THREE.Vector3());
    const rnaTag = this.anchor(this.content, new THREE.Vector3());
    this.label(tplTag, "შაბლონი ჯაჭვი");
    this.label(codTag, "მაკოდირებელი ჯაჭვი");
    this.label(rnaTag, "ი-რნმ");
    const tmpA = make("A", OLD);
    const DURATION = 15;
    const start = xs[0] + 0.6;
    const end = xs[N - 1] + 0.2;
    const v = new THREE.Vector3();

    this.tickers.push((time) => {
      const cycle = (time - this.viewStart) % (DURATION + 3);
      const u = Math.min(1, cycle / DURATION);
      const release = smoothstep(DURATION, DURATION + 2.5, cycle);
      const b = start + (end - start) * u;
      for (let i = 0; i < N; i++) {
        const x = xs[i];
        const open = (1 - smoothstep(0.75, 1.5, Math.abs(x - b))) * (1 - release);
        this.helixPose(x, i, 0, tmpA);
        codingNt[i].p.lerpVectors(tmpA.p, v.set(x, 2.2, -0.7), open);
        codingNt[i].d.lerpVectors(tmpA.d, v.set(0, -1, 0), open).normalize();
        this.helixPose(x, i, 1, tmpA);
        templateNt[i].p.lerpVectors(tmpA.p, v.set(x, -0.95, 0), open);
        templateNt[i].d.lerpVectors(tmpA.d, v.set(0, 1, 0), open).normalize();
        // RNA: built at the polymerase, paired for a short stretch, then peels away.
        const made = smoothstep(0, 0.35, b - x);
        const r = rna[i];
        r.s = made * (1 - smoothstep(0.6, 1, release));
        const e = Math.max(0, b - 1.0 - x);
        r.p.set(x - e * 0.3, 0.95 + e * 0.5 + release * 2.5, e * 0.75 + (1 - made) * 0.8);
        r.d.set(0, -1, 0).lerp(v.set(0.15, 0, 1), smoothstep(0, 1.2, e)).normalize();
      }
      ladder.update([codingNt, templateNt, rna]);
      pol.position.set(b - 0.25, 0.45, 0);
      pol.visible = release < 0.5;
      tplTag.position.set(Math.min(b - 0.4, xs[N - 1]), -0.95, 0);
      codTag.position.set(Math.min(b, xs[N - 1]), 2.2, -0.7);
      const tail = Math.max(0, Math.floor((b - 2.6 - xs[0]) / a));
      rnaTag.position.copy(rna[Math.min(N - 1, tail)].p);
      rnaTag.visible = b - xs[0] > 2.8;
      tplTag.visible = codTag.visible = release < 0.5;
    });
    return { distance: 15, rotate: false, height: 0.6 };
  }

  // ---- View: translation -------------------------------------------------------------------------

  private buildTranslation() {
    const lead = "GCC";
    const trail = "GCA";
    const seq = lead + MRNA.join("") + trail;
    const N = seq.length;
    const a = 0.5;
    const xs = Array.from({ length: N }, (_, i) => (i - (N - 1) / 2) * a);
    const mrna: Nt[] = [...seq].map((b, i) => ({ p: new THREE.Vector3(xs[i], -0.6, 0), d: new THREE.Vector3(0, 1, 0), base: b, back: RNA, s: 1 }));
    const ladder = this.ladder(N + 32);
    const codonX = (k: number) => xs[lead.length + k * 3 + 1];
    MRNA.forEach((c, k) => this.label(this.anchor(this.content, new THREE.Vector3(codonX(k), -1.9, 0.6)), c, undefined, "tag"));
    this.label(this.anchor(this.content, mrna[1].p), "ი-რნმ");

    const small = this.protein(1.0, 21, "#d8c39a", 0.4);
    small.scale.set(1.9, 0.75, 1.25);
    const large = this.protein(1.0, 23, "#cdb27f", 0.36);
    large.scale.set(2.2, 1.35, 1.5);
    this.content.add(small, large);
    this.label(large, "რიბოსომა", new THREE.Vector3(0.75, 0.8, 0));

    // tRNA: an anticodon bar with three bases below, a stem, and its amino acid on top.
    const anticodon = (codon: string) => [...codon].map((b) => ({ A: "U", U: "A", G: "C", C: "G" })[b] ?? "A");
    const tMat = this.material({ color: "#9a8bd8" });
    const trnas = MRNA.slice(0, 5).map((codon, k) => {
      const g = new THREE.Group();
      const bar = new THREE.Mesh(this.cylinder, tMat);
      bar.rotation.z = Math.PI / 2;
      bar.scale.set(0.12, 1.25, 0.12);
      bar.position.y = 0.05;
      const stem = new THREE.Mesh(this.cylinder, tMat);
      stem.scale.set(0.16, 1.05, 0.16);
      stem.position.y = 0.6;
      const armL = new THREE.Mesh(this.cylinder, tMat);
      armL.scale.set(0.11, 0.55, 0.11);
      armL.position.set(-0.28, 0.75, 0);
      armL.rotation.z = Math.PI / 3;
      const armR = armL.clone();
      armR.position.x = 0.28;
      armR.rotation.z = -Math.PI / 3;
      g.add(bar, stem, armL, armR);
      anticodon(codon).forEach((b, j) => {
        const stick = new THREE.Mesh(this.cylinder, this.material({ color: BASE_COLORS[b as "U"] }));
        stick.scale.set(0.08, 0.36, 0.08);
        stick.position.set((j - 1) * a, -0.15, 0);
        g.add(stick);
      });
      const aa = new THREE.Mesh(this.sphere, this.material({ color: PROTEIN[k] }));
      aa.scale.setScalar(0.24);
      aa.position.y = 1.35;
      g.add(aa);
      g.visible = false;
      this.content.add(g);
      return { g, aa };
    });
    const trnaTag = this.anchor(this.content, new THREE.Vector3());
    this.label(trnaTag, "ტ-რნმ");
    // The growing protein: one bead per amino acid.
    const beads = MRNA.slice(0, 5).map((codon, k) => {
      const m = new THREE.Mesh(this.sphere, this.material({ color: PROTEIN[k] }));
      m.scale.setScalar(0.24);
      m.visible = false;
      this.content.add(m);
      this.label(m, CODONS[codon].short, new THREE.Vector3(0.55, 0, 0), "tag");
      return m;
    });
    const chainTag = this.anchor(this.content, new THREE.Vector3());
    this.label(chainTag, "ცილა (ამინომჟავების ჯაჭვი)");

    const STEP = 2.8;
    const target = new THREE.Vector3();
    const tagLabels = this.labels.filter((l) => (beads as THREE.Object3D[]).includes(l.target));
    this.tickers.push((time, dt) => {
      const t = (time - this.viewStart) % (STEP * 7);
      const k = Math.floor(t / STEP); // current codon (5 = stop, 6 = pause)
      const u = (t - k * STEP) / STEP;
      // Ribosome: over codon k, moving to the next one at the end of the step.
      const cx = k < 5 ? codonX(k) + (codonX(k + 1) - codonX(k)) * ease(smoothstep(0.7, 1, u)) : codonX(5);
      const apart = k === 5 ? smoothstep(0.35, 1, u) : k === 6 ? 1 : 0;
      small.position.set(cx - 0.25, -1.05 - apart * 1.2, 0);
      large.position.set(cx - 0.25, 1.15 + apart * 1.5, -0.1);
      (small.material as THREE.MeshPhysicalMaterial).opacity = 0.4 * (1 - apart);
      (large.material as THREE.MeshPhysicalMaterial).opacity = 0.36 * (1 - apart);
      let joined = 0;
      trnas.forEach((tr, j) => {
        const arrive = j === k ? ease(smoothstep(0, 0.35, u)) : j < k ? 1 : 0;
        const leave = j === k - 1 ? smoothstep(0.6, 0.95, u) : j < k - 1 ? 1 : 0;
        tr.g.visible = arrive > 0 && leave < 1 && k < 6;
        const bound = new THREE.Vector3(codonX(j), 0.0, 0);
        tr.g.position.copy(bound).add(new THREE.Vector3(0.6 * (1 - arrive) - 0.8 * leave, 3.5 * (1 - arrive) + 3 * leave, 1.6 * (1 - arrive) - 1.2 * leave));
        const hasAa = j === k ? u < 0.55 : false;
        tr.aa.visible = hasAa;
        if (j < k || (j === k && u >= 0.55)) joined = j + 1;
      });
      const incoming = trnas[Math.min(4, k)];
      trnaTag.position.copy(incoming.g.position).add(new THREE.Vector3(0, 0.6, 0));
      trnaTag.visible = k < 5;
      // Chain: newest amino acid at the top of the newest bound tRNA, older ones trail up and back.
      const release = k === 5 ? smoothstep(0.2, 1, u) : k === 6 ? 1 : 0;
      const head = k < 5 ? trnas[Math.max(0, joined - 1)].g.position.clone().add(new THREE.Vector3(0, 1.35, 0)) : new THREE.Vector3(codonX(4), 1.35, 0);
      beads.forEach((b, j) => {
        b.visible = j < joined && release < 1;
        if (!b.visible) return;
        const n = joined - 1 - j;
        target.copy(head).add(new THREE.Vector3(-0.32 * n + (n % 2) * 0.22, 0.5 * n + release * 4, -0.22 * n));
        if (b.position.lengthSq() === 0 || n === 0) b.position.copy(target);
        else b.position.lerp(target, 1 - Math.exp(-dt * 8));
      });
      for (const l of tagLabels) l.el.style.opacity = release > 0.6 ? "0" : "1";
      chainTag.position.copy(beads[0].position).add(new THREE.Vector3(-0.2, 0.55, 0));
      chainTag.visible = joined >= 3 && release < 0.8;
      ladder.update([mrna], 0.4);
    });
    return { distance: 15.5, rotate: false, height: 1.0 };
  }

  // ---- View: from DNA to chromosome ------------------------------------------------------------------

  private buildChromosome(step: ChromosomeStep) {
    if (step === "nucleosome") return this.buildNucleosome();
    if (step === "fiber") return this.buildFiber();
    return this.buildMetaphase();
  }

  private buildNucleosome() {
    const { dna, histones } = this.data!.nucleosome;
    const atoms: Atom[] = dna.map(([x, y, z, el, strand, part, base]) => ({ p: new THREE.Vector3(x * Å, y * Å, z * Å), el, part, base, strand, pair: 0, name: "" }));
    const g = new THREE.Group();
    g.rotation.x = Math.PI / 2; // look down the superhelix axis: the DNA wraps around the core like a ring
    const dnaMesh = this.atomsMesh(atoms, "space", this.sphereLow);
    const c0 = new THREE.Color();
    atoms.forEach((a, i) => dnaMesh.setColorAt(i, c0.set(a.part === "B" ? "#9cc0f0" : a.strand ? "#2f5f9e" : "#3f78c4").multiplyScalar(SHADE[a.el] ?? 1)));
    g.add(dnaMesh);
    const im = new THREE.InstancedMesh(this.sphereLow, this.atomMat, histones.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3().setScalar(0.165);
    const c = new THREE.Color();
    const centres: Record<string, THREE.Vector3[]> = {};
    histones.forEach(([x, y, z, type], i) => {
      const p = new THREE.Vector3(x * Å, y * Å, z * Å);
      m.compose(p, q, s);
      im.setMatrixAt(i, m);
      im.setColorAt(i, c.set(HISTONE_COLORS[type]).multiplyScalar(0.9 + 0.1 * Math.sin(i * 12.9898)));
      (centres[type] ??= []).push(p);
    });
    g.add(im);
    this.content.add(g);
    for (const [type, pts] of Object.entries(centres)) {
      // Label the part of each histone type that sits nearest the outside.
      const far = pts.reduce((best, p) => (p.length() > best.length() && Math.abs(p.y) < 2 ? p : best), pts[0]);
      this.label(this.anchor(g, far.clone().multiplyScalar(0.92)), type, undefined, "tag");
    }
    const outer = atoms.reduce((best, a) => (a.p.x > best.p.x ? a : best), atoms[0]);
    this.label(this.anchor(g, outer.p), "დნმ · 147 წყვილი");
    return { distance: 30, rotate: true };
  }

  /** A nucleosome of the simplified model: histone core with 1.65 turns of DNA (1 unit = 10 nm). */
  private nucleosomeParts() {
    const core = new THREE.LatheGeometry(
      Array.from({ length: 13 }, (_, i) => {
        const a = (i / 12) * Math.PI;
        return new THREE.Vector2(0.3 + 0.07 * Math.sin(a), -0.3 * Math.cos(a));
      }),
      28,
    );
    const turns = 1.65;
    const pts = Array.from({ length: 60 }, (_, i) => {
      const t = i / 59;
      const ang = t * turns * Math.PI * 2;
      return new THREE.Vector3(0.43 * Math.cos(ang), (t - 0.5) * 0.36, 0.43 * Math.sin(ang));
    });
    const wrap = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.06, 8);
    return { core, wrap, entry: pts[0], exit: pts[pts.length - 1] };
  }

  private buildFiber() {
    const parts = this.nucleosomeParts();
    const coreMat = this.material({ color: "#e6cf9c", roughness: 0.55 });
    const dnaMat = this.material({ color: "#3f6fb5", roughness: 0.4 });
    const g = new THREE.Group();
    const N = 22;
    const nodes: { pos: THREE.Vector3; q: THREE.Quaternion }[] = [];
    for (let i = 0; i < N; i++) {
      // First few: "beads on a string", the rest fold into a compact two-start zig-zag fibre.
      const loose = smoothstep(5, 0, i);
      const compactAngle = i * Math.PI * 0.82;
      const compact = new THREE.Vector3(0.75 * Math.cos(compactAngle), (i - 5) * 0.21, 0.75 * Math.sin(compactAngle));
      const looseP = new THREE.Vector3(Math.sin(i * 1.3) * 0.5, -1.2 - (5 - i) * 0.95, Math.cos(i * 1.1) * 0.3);
      const pos = compact.lerp(looseP, loose);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + Math.sin(i) * 0.4, compactAngle, 0.3));
      nodes.push({ pos, q });
      const core = new THREE.Mesh(parts.core, coreMat);
      const wrap = new THREE.Mesh(parts.wrap, dnaMat);
      for (const mesh of [core, wrap]) {
        mesh.position.copy(pos);
        mesh.quaternion.copy(q);
        g.add(mesh);
      }
    }
    // Linker DNA between neighbours.
    for (let i = 0; i < N - 1; i++) {
      const a = parts.exit.clone().applyQuaternion(nodes[i].q).add(nodes[i].pos);
      const b = parts.entry.clone().applyQuaternion(nodes[i + 1].q).add(nodes[i + 1].pos);
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0, 0.12));
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, mid, b]), 16, 0.06, 8), dnaMat));
    }
    this.disposables.push(parts.core, parts.wrap);
    this.shared.add(parts.core).add(parts.wrap);
    this.content.add(g);
    const box = new THREE.Box3().setFromObject(g);
    const centre = box.getCenter(new THREE.Vector3());
    g.position.sub(centre);
    this.label(this.anchor(g, nodes[2].pos), "ნუკლეოსომა", new THREE.Vector3(0.45, 0, 0));
    const linker = parts.exit.clone().applyQuaternion(nodes[0].q).add(nodes[0].pos).lerp(nodes[1].pos, 0.5);
    this.label(this.anchor(g, linker), "დამაკავშირებელი დნმ");
    this.label(this.anchor(g, nodes[15].pos.clone().add(new THREE.Vector3(0.5, 0, 0.6))), "შეკუმშული ქრომატინი");
    return { distance: 21, rotate: true };
  }

  /** Metaphase chromosome: two sister chromatids of tightly coiled fibre, joined at the centromere. */
  private buildMetaphase() {
    const g = new THREE.Group();
    const UC = 0.36;
    const path = (u: number, sigma: number) => new THREE.Vector3(sigma * (0.3 + 1.1 * (u - UC) ** 2), (UC - u) * 5.2 + 0.6, 0);
    const mats = [this.material({ color: "#5b7fd1", roughness: 0.5 }), this.material({ color: "#6f8fdc", roughness: 0.5 })];
    let telomere = new THREE.Vector3();
    let arm = new THREE.Vector3();
    [-1, 1].forEach((sigma, k) => {
      const pts: THREE.Vector3[] = [];
      const M = 900;
      const turns = 70;
      for (let i = 0; i <= M; i++) {
        const u = i / M;
        const p = path(u, sigma);
        const t = path(Math.min(1, u + 0.001), sigma).sub(path(Math.max(0, u - 0.001), sigma)).normalize();
        const n = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 0, 1)).normalize();
        const b = new THREE.Vector3().crossVectors(t, n);
        const pinch = 1 - 0.45 * Math.exp(-(((u - UC) / 0.05) ** 2));
        const tip = 0.6 + 0.4 * smoothstep(0, 0.05, u) * smoothstep(1, 0.95, u);
        const r = 0.36 * pinch * tip;
        const ang = u * turns * Math.PI * 2 + k;
        const jitter = 1 + 0.08 * fbm(u * 40, k, 0, 2);
        pts.push(p.addScaledVector(n, r * Math.cos(ang) * jitter).addScaledVector(b, r * Math.sin(ang) * jitter));
      }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), M * 2, 0.12, 7), mats[k]));
      if (sigma === 1) {
        telomere = path(0, sigma);
        arm = path(0.75, sigma).add(new THREE.Vector3(0.35, 0, 0));
      }
    });
    const band = new THREE.Mesh(this.sphere, this.material({ color: "#d9434f", transparent: true, opacity: 0.35, depthWrite: false }));
    band.scale.set(0.55, 0.3, 0.35);
    band.position.copy(path(UC, 1)).setX(0);
    g.add(band);
    this.content.add(g);
    this.label(this.anchor(g, path(UC, 1).setX(0)), "ცენტრომერა", new THREE.Vector3(-0.2, 0, 0));
    this.label(this.anchor(g, arm), "ქრომატიდა");
    this.label(this.anchor(g, telomere.add(new THREE.Vector3(0, 0.15, 0))), "ტელომერა");
    return { distance: 12, rotate: true };
  }

  // ---- View: mutation --------------------------------------------------------------------------------

  private buildMutation(mutant: boolean, mode: "atoms" | "scheme") {
    const seq = (mutant ? GLOBIN.mutant : GLOBIN.normal).join("");
    const atoms = this.helixAtoms(seq);
    const length = seq.length * RISE;
    const inner = new THREE.Group();
    inner.rotation.x = -Math.PI / 2;
    const hi = GLOBIN.changed;
    if (mode === "atoms") {
      const rest = atoms.filter((a) => a.pair !== hi);
      const pair = atoms.filter((a) => a.pair === hi);
      const glow = this.material({ emissive: "#ffffff", emissiveIntensity: 0.2, roughness: 0.3 });
      inner.add(this.atomsMesh(rest, "space"), this.atomsMesh(pair, "space", this.sphere, glow));
      this.tickers.push((t) => {
        glow.emissiveIntensity = 0.15 + 0.3 * (0.5 + 0.5 * Math.sin(t * 4));
      });
    } else inner.add(this.schemeHelix(atoms, hi));
    const ringMat = this.material({ color: mutant ? "#d9434f" : "#2f9e62", transparent: true, opacity: 0.7, depthWrite: false, emissive: mutant ? "#d9434f" : "#2f9e62", emissiveIntensity: 0.3 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.035, 10, 64), ringMat);
    ring.position.z = this.data!.riseSign * RISE * (hi - (seq.length - 1) / 2);
    inner.add(ring);
    this.tickers.push((t) => {
      ringMat.opacity = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(t * 3));
    });
    this.content.add(inner);
    const b = atoms.find((a) => a.pair === hi && a.strand === 0 && a.name === "C1'")!;
    const pairText = `${seq[hi]}·${complement(seq[hi] as Base)}`;
    this.label(this.anchor(inner, b.p), mutant ? `შეცვლილი წყვილი: ${pairText}` : `ნორმა: ${pairText}`);
    return { distance: length * 1.6, rotate: true };
  }

  // ---- Loop -------------------------------------------------------------------------------------------

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private v = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3();
  private placeLabels() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (const l of this.labels) {
      let shown = true;
      l.target.traverseAncestors((p) => {
        if (!p.visible) shown = false;
      });
      if (!l.target.visible || !shown) {
        l.el.style.visibility = "hidden";
        continue;
      }
      l.target.getWorldPosition(this.v);
      if (l.offset.lengthSq()) this.v.add(this.s.copy(l.offset).applyQuaternion(l.target.getWorldQuaternion(this.q)));
      this.v.project(this.camera);
      const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.05 && Math.abs(this.v.y) < 1.05;
      l.el.style.visibility = visible ? "visible" : "hidden";
      l.el.style.transform = `translate(${((this.v.x + 1) / 2) * w}px, ${((1 - this.v.y) / 2) * h}px)`;
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.reduceMotion ? this.viewStart + 6 : this.clock.elapsedTime;
    for (const tick of this.tickers) tick(t, dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.clear();
    for (const g of this.shared) g.dispose();
    this.atomMat.dispose();
    this.env.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
