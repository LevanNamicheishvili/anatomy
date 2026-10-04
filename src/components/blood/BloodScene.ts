import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { fbm, smoothstep } from "@/lib/noise";
import type { BloodGroup, BloodView, WbcKind } from "./blood-data";

/*
 * Blood cells built from code. Scale: 1 unit ≈ 3.75 µm, so a red blood cell (7.5 µm across) has radius 1.
 * Shapes follow textbook descriptions: the red cell's biconcave profile uses the Evans–Fung curve,
 * leukocytes get their characteristic nucleus and granules, platelets are discs that turn spiky when active.
 */

export interface SceneOptions {
  wbc: WbcKind;
  group: BloodGroup;
  rh: boolean;
}

interface Label {
  target: THREE.Object3D;
  offset: THREE.Vector3;
  text: string;
  el: HTMLDivElement;
}

const COLORS = {
  rbc: "#b8232b",
  wbcMembrane: "#efeaf6",
  nucleus: "#5b3a9a",
  platelet: "#c9a3d6",
  plasma: "#f2cf6b",
  vessel: "#c95a52",
  fibrin: "#f3e3b3",
  antigenA: "#2f6fd6",
  antigenB: "#e08a1e",
  antigenRh: "#1f9e6b",
  eosGranule: "#e2662f",
  basoGranule: "#2c2266",
};

/**
 * Biconcave disc (Evans–Fung): thin centre, thick rounded rim. Coloured like a cell under the
 * microscope — paler in the thin centre, deep red at the rim — with a faintly uneven membrane.
 */
function rbcGeometry() {
  const half = (x: number) => 0.5 * Math.sqrt(Math.max(0, 1 - x * x)) * (0.2 + 2.0 * x * x - 1.12 * x ** 4);
  const pts: THREE.Vector2[] = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const x = Math.sin((i / N) * (Math.PI / 2));
    pts.push(new THREE.Vector2(x, -half(x)));
  }
  for (let i = N - 1; i >= 0; i--) {
    const x = Math.sin((i / N) * (Math.PI / 2));
    pts.push(new THREE.Vector2(x, half(x)));
  }
  const g = mergeVertices(new THREE.LatheGeometry(pts, 72).deleteAttribute("normal").deleteAttribute("uv"), 1e-5);
  const p = g.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const centre = new THREE.Color("#e2645a");
  const rim = new THREE.Color("#8f0f17");
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const r = Math.hypot(x, z);
    const d = 1 + 0.012 * fbm(x * 3.1, y * 3.1, z * 3.1, 3);
    p.setXYZ(i, x * d, y * (1 + 0.04 * fbm(x * 4, 7, z * 4, 2)), z * d);
    c.copy(centre).lerp(rim, smoothstep(0.12, 0.88, r));
    c.multiplyScalar(1 + 0.07 * fbm(x * 6, y * 6, z * 6, 3));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return { geometry: g, half };
}

/**
 * Organic blob: a sphere pushed in and out by layered noise, optionally coloured between two tones by
 * finer noise (chromatin in a nucleus, ruffles on a membrane).
 */
function organic(radius: number, amount: number, seed: number, from?: string, to?: string, detail = 5, freq = 1.6) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(radius, detail).deleteAttribute("normal").deleteAttribute("uv"));
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const colors = from && to ? new Float32Array(p.count * 3) : null;
  const a = new THREE.Color(from);
  const b = new THREE.Color(to);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = fbm(v.x * freq + seed, v.y * freq + seed * 0.7, v.z * freq - seed, 4);
    const fine = fbm(v.x * 9 + seed, v.y * 9, v.z * 9 - seed, 3);
    v.multiplyScalar(radius * (1 + amount * n + amount * 0.25 * fine));
    p.setXYZ(i, v.x, v.y, v.z);
    if (colors) {
      c.copy(a).lerp(b, smoothstep(-0.35, 0.45, fine + 0.3 * n));
      colors.set([c.r, c.g, c.b], i * 3);
    }
  }
  if (colors) g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** Deterministic pseudo-random numbers, so every visit shows the same arrangement. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** A random point inside a sphere of the given radius. */
function inBall(rand: () => number, r: number, out = new THREE.Vector3()) {
  do out.set(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
  while (out.lengthSq() > 1);
  return out.multiplyScalar(r);
}

export class BloodScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
  private controls: OrbitControls;
  private content = new THREE.Group();
  private labels: Label[] = [];
  private frame = 0;
  private clock = new THREE.Clock();
  private tickers: ((t: number, dt: number) => void)[] = [];
  private disposed = false;
  private observer: ResizeObserver;
  private reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private materials = new Map<string, THREE.Material>();
  private rbc = rbcGeometry();
  private env: THREE.WebGLRenderTarget;

  constructor(
    private canvas: HTMLCanvasElement,
    private overlay: HTMLElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.env.texture;
    pmrem.dispose();
    const key = new THREE.DirectionalLight("#ffffff", 1.6);
    key.position.set(4, 6, 8);
    const rim = new THREE.DirectionalLight("#ffe9e4", 0.8);
    rim.position.set(-6, -2, -5);
    this.scene.add(new THREE.HemisphereLight("#ffffff", "#d9e2df", 0.6), key, rim, this.content);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.6;
    this.controls.autoRotateSpeed = 0.8;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  // ---- Materials ------------------------------------------------------------------------------------

  private mat(key: string, make: () => THREE.Material) {
    let m = this.materials.get(key);
    if (!m) {
      m = make();
      this.materials.set(key, m);
    }
    return m;
  }

  private tissue(color: string, extra: THREE.MeshPhysicalMaterialParameters = {}) {
    return this.mat(`t:${color}:${JSON.stringify(extra)}`, () =>
      new THREE.MeshPhysicalMaterial({ color, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, ...extra }),
    );
  }

  // ---- Views ----------------------------------------------------------------------------------------

  setView(view: BloodView, opts: SceneOptions) {
    this.clear();
    const builders: Record<BloodView, () => { distance: number; rotate: boolean }> = {
      overview: () => this.buildVessel(),
      plasma: () => this.buildTube(),
      rbc: () => this.buildRbc(),
      wbc: () => this.buildWbc(opts.wbc),
      platelets: () => this.buildPlatelets(),
      clot: () => this.buildClot(),
      groups: () => this.buildGroup(opts.group, opts.rh),
      immunity: () => this.buildImmunity(),
      bleeding: () => this.buildBleeding(),
      diseases: () => this.buildDiseases(),
    };
    const built = builders[view]();
    const { rotate } = built;
    // Narrow (portrait) screens see less sideways: step back so the scene still fits.
    const distance = built.distance * Math.max(1, 1.6 / this.camera.aspect);
    this.camera.position.set(distance * 0.18, distance * 0.22, distance);
    this.controls.target.set(0, 0, 0);
    this.controls.minDistance = distance * 0.4;
    this.controls.maxDistance = distance * 2.2;
    this.controls.autoRotate = rotate && !this.reduceMotion;
    this.controls.update();
  }

  private label(target: THREE.Object3D, text: string, offset = new THREE.Vector3()) {
    const el = document.createElement("div");
    el.className = "blood-label";
    el.innerHTML = `<span class="blood-label-dot"></span><span class="blood-label-text"></span>`;
    (el.lastChild as HTMLElement).textContent = text;
    this.overlay.appendChild(el);
    this.labels.push({ target, offset, text, el });
  }

  private clear() {
    for (const l of this.labels) l.el.remove();
    this.labels = [];
    this.tickers = [];
    this.content.traverse((o) => {
      const mesh = o as THREE.Mesh;
      // Shared geometries (the red cell) are kept; everything built per view is freed.
      if (mesh.geometry && mesh.geometry !== this.rbc.geometry && !mesh.userData.shared) mesh.geometry.dispose();
    });
    this.content.clear();
    // Only the vessel view has its own surroundings; other views sit on the page background.
    this.scene.background = null;
    this.scene.fog = null;
    this.renderer.toneMappingExposure = 1;
  }

  /**
   * Living tissue lets some light through: edges facing away from the viewer glow softly in the
   * tissue's own colour, and the whole surface gets a faint inner light. A cheap stand-in for
   * subsurface scattering that runs fine on school computers.
   */
  private translucent<T extends THREE.MeshPhysicalMaterial>(m: T, strength = 1): T {
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `{
          float facing = abs(dot(normalize(normal), normalize(vViewPosition)));
          float rim = pow(1.0 - facing, 2.2);
          outgoingLight += diffuseColor.rgb * (0.16 + 0.55 * rim) * ${strength.toFixed(2)};
        }
        #include <opaque_fragment>`,
      );
    };
    m.customProgramCacheKey = () => `translucent-${strength}`;
    return m;
  }

  /** Red cell: colours come from the geometry; a soft sheen and wet coat give it a living look. */
  private rbcMaterial() {
    return this.mat("rbc", () =>
      this.translucent(
        new THREE.MeshPhysicalMaterial({
          color: "#ffffff",
          vertexColors: true,
          roughness: 0.36,
          clearcoat: 0.55,
          clearcoatRoughness: 0.28,
          sheen: 0.9,
          sheenColor: new THREE.Color("#ff9a8a"),
          sheenRoughness: 0.45,
        }),
      ),
    );
  }

  private rbcMesh() {
    return new THREE.Mesh(this.rbc.geometry, this.rbcMaterial());
  }

  /** Overview: a vessel cut open lengthwise, with cells streaming through plasma. */
  private buildVessel() {
    const R = 4;
    const L = 26;
    // Inside a vessel: deep red surroundings, cells further away fade into them.
    // Warm, bright red surroundings: it reads as the inside of a vessel without going dark.
    const deep = new THREE.Color("#8a3a3c");
    this.scene.background = deep;
    this.scene.fog = new THREE.FogExp2(deep, 0.016);
    this.renderer.toneMappingExposure = 1.25;
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, L, 64, 1, true, Math.PI, Math.PI),
      this.tissue(COLORS.vessel, { side: THREE.DoubleSide, roughness: 0.55, clearcoat: 0.7, sheen: 0.5, sheenColor: new THREE.Color("#ffb3a8") }),
    );
    wall.rotation.z = Math.PI / 2;
    const lining = new THREE.Mesh(
      new THREE.CylinderGeometry(R - 0.12, R - 0.12, L, 64, 1, true, Math.PI, Math.PI),
      this.tissue("#d9827a", { side: THREE.BackSide, roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.3 }),
    );
    lining.rotation.z = Math.PI / 2;
    const plasma = new THREE.Mesh(
      new THREE.CylinderGeometry(R - 0.2, R - 0.2, L, 48, 1, true),
      new THREE.MeshBasicMaterial({ color: COLORS.plasma, transparent: true, opacity: 0.08, depthWrite: false }),
    );
    plasma.rotation.z = Math.PI / 2;
    this.content.add(wall, lining, plasma);

    const rand = rng(7);
    const dummy = new THREE.Object3D();
    type Flow = { mesh: THREE.InstancedMesh; items: { p: THREE.Vector3; r: THREE.Euler; spin: THREE.Vector3; speed: number }[] };
    const flows: Flow[] = [];
    const fill = (mesh: THREE.InstancedMesh, radius: number) => {
      const items = [];
      for (let i = 0; i < mesh.count; i++) {
        const a = rand() * Math.PI * 2;
        const rr = Math.sqrt(rand()) * (R - 0.6 - radius);
        items.push({
          p: new THREE.Vector3(rand() * L - L / 2, Math.cos(a) * rr, Math.sin(a) * rr),
          r: new THREE.Euler(rand() * 6, rand() * 6, rand() * 6),
          spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(1.2),
          // Faster in the middle of the vessel, slower near the wall.
          speed: 2.6 * (1 - (rr / R) ** 2) + 0.4,
        });
      }
      flows.push({ mesh, items });
    };
    const rbcs = new THREE.InstancedMesh(this.rbc.geometry, this.rbcMaterial(), 150);
    fill(rbcs, 1);
    const plateletGeo = new THREE.SphereGeometry(0.3, 16, 12).scale(1, 0.35, 1);
    const platelets = new THREE.InstancedMesh(plateletGeo, this.tissue(COLORS.platelet), 70);
    fill(platelets, 0.3);
    this.content.add(rbcs, platelets);

    const wbcs: THREE.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const cell = this.leukocyte(i === 2 ? "lymphocyte" : "neutrophil", 0.75);
      cell.position.set(-8 + i * 8, (rand() - 0.5) * 2, (rand() - 0.2) * 1.5);
      wbcs.push(cell);
      this.content.add(cell);
    }

    const update = (dt: number) => {
      for (const f of flows) {
        f.items.forEach((it, i) => {
          it.p.x += it.speed * dt;
          if (it.p.x > L / 2) it.p.x -= L;
          it.r.x += it.spin.x * dt;
          it.r.y += it.spin.y * dt;
          it.r.z += it.spin.z * dt;
          dummy.position.copy(it.p);
          dummy.rotation.copy(it.r);
          dummy.updateMatrix();
          f.mesh.setMatrixAt(i, dummy.matrix);
        });
        f.mesh.instanceMatrix.needsUpdate = true;
      }
      // White cells roll slowly along the wall.
      for (const w of wbcs) {
        w.position.x += 0.6 * dt;
        if (w.position.x > L / 2) w.position.x -= L;
        w.rotation.z -= 0.5 * dt;
      }
    };
    update(0);
    if (!this.reduceMotion) this.tickers.push((_, dt) => update(dt));

    this.label(wall, "სისხლძარღვის კედელი", new THREE.Vector3(-3.6, -2.2, -2.8));
    this.label(rbcs, "ერითროციტები", new THREE.Vector3(-4, 1.6, 1.2));
    this.label(wbcs[1], "ლეიკოციტი");
    this.label(platelets, "თრომბოციტები", new THREE.Vector3(7, -1.6, 1.5));
    this.label(plasma, "პლაზმა", new THREE.Vector3(-9, -2.6, 2.2));
    return { distance: 19, rotate: false };
  }

  /** Plasma: a tube of blood left to settle — red cells below, the buffy coat, plasma on top. */
  private buildTube() {
    const r = 1;
    const H = 6;
    const layer = (from: number, to: number, color: string, opacity = 1) => {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(r * 0.96, r * 0.96, to - from, 48),
        this.tissue(color, opacity < 1 ? { transparent: true, opacity, roughness: 0.15 } : { roughness: 0.3 }),
      );
      m.position.y = (from + to) / 2;
      this.content.add(m);
      return m;
    };
    const bottom = -H / 2;
    const red = layer(bottom, bottom + H * 0.44, COLORS.rbc);
    const buffy = layer(bottom + H * 0.44, bottom + H * 0.455, "#f4f1ea");
    const plasma = layer(bottom + H * 0.455, bottom + H * 0.92, COLORS.plasma, 0.85);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(r * 0.96, 48, 24, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), this.tissue(COLORS.rbc));
    cap.position.y = bottom;
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 1.06, r * 1.06, H * 1.08, 48, 1, true),
      new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: 0.18, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }),
    );
    glass.position.y = 0.2;
    this.content.add(cap, glass);
    this.label(plasma, "პლაზმა ≈ 55%", new THREE.Vector3(1, 0, 0));
    this.label(buffy, "ლეიკოციტები და თრომბოციტები < 1%", new THREE.Vector3(1, 0, 0));
    this.label(red, "ერითროციტები ≈ 45%", new THREE.Vector3(1, 0, 0));
    return { distance: 12, rotate: true };
  }

  /** Red blood cell: one large, cut in half to show the thin centre, plus a few in a stack. */
  private buildRbc() {
    const whole = this.rbcMesh();
    whole.scale.setScalar(1.5);
    whole.rotation.x = 0.9;
    whole.position.set(-1.9, 0.9, 0);
    const half = new THREE.Mesh(
      new THREE.LatheGeometry(this.lathePoints(), 40, 0, Math.PI),
      this.mat("rbc-half", () => new THREE.MeshPhysicalMaterial({ color: "#c11d27", side: THREE.DoubleSide, roughness: 0.36, clearcoat: 0.55, sheen: 0.9, sheenColor: new THREE.Color("#ff9a8a") })),
    );
    half.scale.setScalar(1.35);
    half.rotation.set(0, Math.PI / 2, 0);
    half.position.set(1.9, 0.9, 0);
    this.content.add(whole, half);
    // Red cells often stack like coins in slow-flowing blood.
    const stack = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const c = this.rbcMesh();
      c.position.y = i * 0.5;
      c.rotation.y = i * 0.7;
      stack.add(c);
    }
    stack.rotation.set(0.4, 0, Math.PI / 2.4);
    stack.position.set(-0.6, -2.6, -1);
    this.content.add(stack);
    this.label(whole, "ორმხრივ ჩაზნექილი დისკო", new THREE.Vector3(0, 1.2, 0));
    this.label(half, "ჭრილი: შუა თხელია", new THREE.Vector3(-0.4, -0.7, 0));
    this.label(stack, "„მონეტის სვეტი“", new THREE.Vector3(0.6, 0.6, 0));
    return { distance: 13.5, rotate: false };
  }

  private lathePoints() {
    const pts: THREE.Vector2[] = [];
    const N = 30;
    for (let i = 0; i <= N; i++) {
      const x = Math.sin((i / N) * (Math.PI / 2));
      pts.push(new THREE.Vector2(x, -this.rbc.half(x)));
    }
    for (let i = N - 1; i >= 0; i--) {
      const x = Math.sin((i / N) * (Math.PI / 2));
      pts.push(new THREE.Vector2(x, this.rbc.half(x)));
    }
    return pts;
  }

  /** One leukocyte of the given kind. Membrane is see-through so the nucleus and granules show. */
  private leukocyte(kind: WbcKind, scale = 1) {
    const sizes: Record<WbcKind, number> = { neutrophil: 1.6, eosinophil: 1.6, basophil: 1.45, lymphocyte: 1.05, monocyte: 2.1 };
    const R = sizes[kind];
    const cell = new THREE.Group();
    // Ruffled membrane (white cells crawl and wrinkle), over a faintly tinted cytoplasm.
    const membrane = new THREE.Mesh(
      organic(R, kind === "monocyte" ? 0.07 : 0.05, R * 3, "#f4f1fa", "#d8d0ea", 6, 2.2),
      this.mat("membrane", () =>
        new THREE.MeshPhysicalMaterial({
          color: "#ffffff",
          vertexColors: true,
          transparent: true,
          opacity: 0.42,
          roughness: 0.3,
          clearcoat: 0.7,
          clearcoatRoughness: 0.25,
          sheen: 0.6,
          sheenColor: new THREE.Color("#ffffff"),
          depthWrite: false,
        }),
      ),
    );
    membrane.renderOrder = 2;
    const cytoplasm = new THREE.Mesh(
      new THREE.SphereGeometry(R * 0.93, 48, 32),
      this.mat("cytoplasm", () =>
        new THREE.MeshPhysicalMaterial({ color: "#d9dcef", transparent: true, opacity: 0.16, roughness: 0.6, depthWrite: false }),
      ),
    );
    cytoplasm.renderOrder = 1;
    const nucleusMat = this.mat("nucleus", () =>
      new THREE.MeshPhysicalMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.62, clearcoat: 0.25, clearcoatRoughness: 0.5 }),
    );
    const lobe = (x: number, y: number, z: number, r: number) => {
      const m = new THREE.Mesh(organic(r, 0.12, x * 5 + y * 3, "#3b1f6e", "#8e6fc9", 5, 1.8), nucleusMat);
      m.position.set(x, y, z);
      return m;
    };
    const join = (a: THREE.Mesh, b: THREE.Mesh) => {
      const curve = new THREE.LineCurve3(a.position.clone(), b.position.clone());
      return new THREE.Mesh(new THREE.TubeGeometry(curve, 4, 0.09, 8), nucleusMat);
    };
    const nucleus = new THREE.Group();
    if (kind === "neutrophil") {
      const ls = [lobe(-0.6, 0.2, 0, 0.36), lobe(-0.15, 0.5, 0.1, 0.38), lobe(0.4, 0.25, -0.05, 0.37), lobe(0.55, -0.35, 0.1, 0.34)];
      nucleus.add(...ls, join(ls[0], ls[1]), join(ls[1], ls[2]), join(ls[2], ls[3]));
    } else if (kind === "eosinophil") {
      const ls = [lobe(-0.45, 0.1, 0, 0.45), lobe(0.45, 0.05, 0, 0.45)];
      nucleus.add(...ls, join(ls[0], ls[1]));
    } else if (kind === "basophil") {
      const ls = [lobe(-0.3, 0.15, 0, 0.4), lobe(0.35, -0.1, 0, 0.38)];
      nucleus.add(...ls, join(ls[0], ls[1]));
    } else if (kind === "lymphocyte") {
      const n = lobe(0.08, 0, 0, R * 0.78);
      nucleus.add(n);
    } else {
      // Monocyte: kidney-shaped nucleus.
      const kidneyGeo = new THREE.TorusGeometry(0.75, 0.42, 32, 64, Math.PI * 1.25);
      // Chromatin mottling on the kidney-shaped nucleus too.
      const kp = kidneyGeo.attributes.position;
      const kc = new Float32Array(kp.count * 3);
      const ca = new THREE.Color("#3b1f6e");
      const cb = new THREE.Color("#8e6fc9");
      const tmp = new THREE.Color();
      for (let i = 0; i < kp.count; i++) {
        tmp.copy(ca).lerp(cb, smoothstep(-0.35, 0.45, fbm(kp.getX(i) * 6, kp.getY(i) * 6, kp.getZ(i) * 6, 3)));
        kc.set([tmp.r, tmp.g, tmp.b], i * 3);
      }
      kidneyGeo.setAttribute("color", new THREE.BufferAttribute(kc, 3));
      const kidney = new THREE.Mesh(kidneyGeo, nucleusMat);
      kidney.rotation.z = -Math.PI * 0.15;
      kidney.scale.set(1, 1, 0.8);
      nucleus.add(kidney);
    }
    cell.add(nucleus, membrane, cytoplasm);

    const granules: Partial<Record<WbcKind, { color: string; size: number; count: number }>> = {
      neutrophil: { color: "#e7c9d6", size: 0.035, count: 220 },
      eosinophil: { color: COLORS.eosGranule, size: 0.085, count: 170 },
      basophil: { color: COLORS.basoGranule, size: 0.1, count: 130 },
    };
    const gr = granules[kind];
    if (gr) {
      const rand = rng(R * 100);
      const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(gr.size, 8, 6), this.tissue(gr.color, { roughness: 0.4 }), gr.count);
      const d = new THREE.Object3D();
      for (let i = 0; i < gr.count; i++) {
        inBall(rand, R * 0.88, d.position);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      cell.add(mesh);
    }
    cell.scale.setScalar(scale);
    cell.userData.radius = R;
    return cell;
  }

  private buildWbc(kind: WbcKind) {
    const cell = this.leukocyte(kind);
    this.content.add(cell);
    // A red cell beside it, for scale.
    const rbc = this.rbcMesh();
    rbc.position.set(-cell.userData.radius - 1.5, -cell.userData.radius * 0.55, 0.6);
    rbc.rotation.x = 1.1;
    this.content.add(rbc);
    const nucleus = cell.children[0];
    this.label(nucleus, kind === "monocyte" ? "ლობიოსებრი ბირთვი" : kind === "lymphocyte" ? "დიდი მრგვალი ბირთვი" : "დაყოფილი ბირთვი");
    this.label(cell.children[1], "მემბრანა", new THREE.Vector3(cell.userData.radius * 0.7, cell.userData.radius * 0.75, 0));
    if (cell.children[2]) this.label(cell.children[2], "მარცვლები", new THREE.Vector3(-0.4, -cell.userData.radius * 0.6, cell.userData.radius * 0.5));
    this.label(rbc, "ერითროციტი (ზომის შესადარებლად)", new THREE.Vector3(0, 0.6, 0));
    return { distance: 12.5, rotate: true };
  }

  private platelet(active: boolean) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      organic(0.42, 0.14, active ? 4 : 9, "#d7b6e2", "#a77cbd", 4, 1.4),
      this.mat("platelet", () =>
        new THREE.MeshPhysicalMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.48, clearcoat: 0.4, sheen: 0.5, sheenColor: new THREE.Color("#f3dcff") }),
      ),
    );
    if (active) {
      body.scale.set(1.05, 0.8, 1.05);
      const rand = rng(11);
      const spikeGeo = new THREE.ConeGeometry(0.06, 0.55, 8);
      for (let i = 0; i < 16; i++) {
        const dir = inBall(rand, 1).normalize();
        const s = new THREE.Mesh(spikeGeo, this.tissue(COLORS.platelet, { roughness: 0.5 }));
        s.position.copy(dir.clone().multiplyScalar(0.42));
        s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        g.add(s);
      }
    } else body.scale.set(1, 0.32, 1);
    g.add(body);
    return g;
  }

  private buildPlatelets() {
    const rand = rng(3);
    const resting = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const p = this.platelet(false);
      p.position.set(-2.2 + (rand() - 0.5) * 1.6, (rand() - 0.5) * 2.2, (rand() - 0.5) * 1.2);
      p.rotation.set(rand() * 2, rand() * 2, 0);
      resting.add(p);
    }
    const active = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const p = this.platelet(true);
      p.position.set(2.2 + (rand() - 0.5) * 1.4, (rand() - 0.5) * 2, (rand() - 0.5) * 1.2);
      active.add(p);
    }
    const rbc = this.rbcMesh();
    rbc.position.set(0, -2.6, -0.5);
    rbc.rotation.x = 1;
    this.content.add(resting, active, rbc);
    this.label(resting.children[0], "მშვიდი თრომბოციტი — ბრტყელი ფირფიტა");
    this.label(active.children[0], "გააქტიურებული — წანაზარდებით");
    this.label(rbc, "ერითროციტი (ზომის შესადარებლად)", new THREE.Vector3(0, 0.6, 0));
    return { distance: 10, rotate: false };
  }

  /** Clot: fibrin threads with trapped red cells and clumped platelets. */
  private buildClot() {
    const rand = rng(21);
    const fibrinMat = this.tissue(COLORS.fibrin, { roughness: 0.5 });
    const threads = new THREE.Group();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let i = 0; i < 110; i++) {
      inBall(rand, 3.6, a);
      inBall(rand, 3.6, b);
      if (a.distanceTo(b) < 1.5) continue;
      const c1 = a.clone().lerp(b, 0.33).add(inBall(rand, 0.9));
      const c2 = a.clone().lerp(b, 0.66).add(inBall(rand, 0.9));
      const curve = new THREE.CubicBezierCurve3(a.clone(), c1, c2, b.clone());
      threads.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.018, 5), fibrinMat));
    }
    const trapped = new THREE.InstancedMesh(this.rbc.geometry, this.rbcMaterial(), 26);
    const d = new THREE.Object3D();
    for (let i = 0; i < trapped.count; i++) {
      inBall(rand, 3, d.position);
      d.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      d.scale.setScalar(0.8);
      d.updateMatrix();
      trapped.setMatrixAt(i, d.matrix);
    }
    const plug = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const p = this.platelet(true);
      p.scale.setScalar(0.8);
      inBall(rand, 0.9, p.position);
      p.position.add(new THREE.Vector3(0.6, -2.4, 0.8));
      plug.add(p);
    }
    this.content.add(threads, trapped, plug);
    this.label(threads.children[0], "ფიბრინის ძაფები");
    this.label(trapped, "დაჭერილი ერითროციტები", new THREE.Vector3(-1.6, 1.4, 1.2));
    this.label(plug.children[0], "თრომბოციტული საცობი");
    return { distance: 13, rotate: true };
  }

  /** Blood groups: one red cell carrying the antigens of the chosen group. */
  private buildGroup(group: BloodGroup, rh: boolean) {
    const cell = this.rbcMesh();
    cell.scale.setScalar(2.4);
    cell.rotation.x = 0.85;
    this.content.add(cell);
    const kinds: { key: string; color: string; geo: THREE.BufferGeometry; label: string }[] = [];
    if (group === "A" || group === "AB") kinds.push({ key: "A", color: COLORS.antigenA, geo: new THREE.SphereGeometry(0.026, 10, 8), label: "A ანტიგენი" });
    if (group === "B" || group === "AB") kinds.push({ key: "B", color: COLORS.antigenB, geo: new THREE.OctahedronGeometry(0.032), label: "B ანტიგენი" });
    if (rh) kinds.push({ key: "Rh", color: COLORS.antigenRh, geo: new THREE.ConeGeometry(0.02, 0.055, 6), label: "Rh ანტიგენი" });
    const rand = rng(group.length * 31 + (rh ? 5 : 0));
    for (const k of kinds) {
      const n = k.key === "Rh" ? 160 : 320;
      const mesh = new THREE.InstancedMesh(k.geo, this.tissue(k.color, { roughness: 0.35 }), n);
      const d = new THREE.Object3D();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < n; i++) {
        // A point on the cell surface (top or bottom face), pointing outwards.
        const x = Math.sqrt(rand()) * 0.97;
        const ang = rand() * Math.PI * 2;
        const top = rand() < 0.5 ? 1 : -1;
        const y = top * this.rbc.half(x);
        d.position.set(Math.cos(ang) * x, y, Math.sin(ang) * x);
        const normal = new THREE.Vector3(Math.cos(ang) * x * 0.6, top, Math.sin(ang) * x * 0.6).normalize();
        d.quaternion.setFromUnitVectors(up, normal);
        d.position.addScaledVector(normal, 0.02);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
      }
      cell.add(mesh);
      this.label(mesh, k.label, new THREE.Vector3(k.key === "A" ? -0.5 : k.key === "B" ? 0.5 : 0, 0.3, 0.4));
    }
    if (!kinds.length) this.label(cell, "ანტიგენები არ არის (I ჯგუფი)", new THREE.Vector3(0, 0.5, 0));
    return { distance: 10, rotate: true };
  }

  /** A Y-shaped antibody: two arms and a stem. */
  private antibody() {
    const g = new THREE.Group();
    const mat = this.tissue("#f0b431", { roughness: 0.4 });
    const piece = (len: number) => new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 8), mat);
    const stem = piece(0.32);
    stem.position.y = -0.16;
    const left = piece(0.28);
    left.position.set(-0.09, 0.11, 0);
    left.rotation.z = 0.6;
    const right = piece(0.28);
    right.position.set(0.09, 0.11, 0);
    right.rotation.z = -0.6;
    g.add(stem, left, right);
    return g;
  }

  /** Immunity: a phagocyte swallowing bacteria; some bacteria are tagged by antibodies. */
  private buildImmunity() {
    const cell = this.leukocyte("neutrophil", 1.15);
    this.content.add(cell);
    const R = cell.userData.radius * 1.15;
    const rand = rng(41);
    const bacMat = this.mat("bacterium", () =>
      this.translucent(
        new THREE.MeshPhysicalMaterial({ color: "#8fb83a", roughness: 0.45, clearcoat: 0.5, sheen: 0.5, sheenColor: new THREE.Color("#e6ffb0") }),
        0.6,
      ),
    );
    const bacGeo = new THREE.CapsuleGeometry(0.16, 0.5, 8, 16);
    type Bug = { mesh: THREE.Group; dir: THREE.Vector3; dist: number; speed: number; spin: number };
    const bugs: Bug[] = [];
    const place = (b: Bug) => {
      b.mesh.position.copy(b.dir).multiplyScalar(b.dist);
      const s = b.dist < R * 0.75 ? Math.max(0.05, (b.dist - R * 0.15) / (R * 0.6)) : 1;
      b.mesh.scale.setScalar(s);
    };
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(bacGeo, bacMat));
      // Antibodies stuck to some bacteria, arms first.
      if (i % 2 === 0)
        for (let k = 0; k < 3; k++) {
          const ab = this.antibody();
          const a = (k / 3) * Math.PI * 2 + i;
          const n = new THREE.Vector3(Math.cos(a), (rand() - 0.5) * 0.6, Math.sin(a)).normalize();
          ab.position.copy(n).multiplyScalar(0.36);
          ab.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), n);
          mesh.add(ab);
        }
      mesh.rotation.set(rand() * 6, rand() * 6, rand() * 6);
      const bug = { mesh, dir: inBall(rand, 1).normalize(), dist: R + 0.8 + rand() * 3, speed: 0.25 + rand() * 0.25, spin: (rand() - 0.5) * 1.5 };
      place(bug);
      bugs.push(bug);
      this.content.add(mesh);
    }
    if (!this.reduceMotion)
      this.tickers.push((_, dt) => {
        for (const b of bugs) {
          b.dist -= b.speed * dt;
          b.mesh.rotation.y += b.spin * dt;
          // Swallowed and digested: start again further out.
          if (b.dist < R * 0.2) {
            b.dist = R + 2.5 + rand() * 1.5;
            b.dir = inBall(rand, 1).normalize();
          }
          place(b);
        }
      });
    this.label(cell.children[1], "ფაგოციტი (ნეიტროფილი)", new THREE.Vector3(0.9, 1.2, 0));
    this.label(bugs[1].mesh, "ბაქტერია");
    this.label(bugs[0].mesh.children[1], "ანტისხეული");
    return { distance: 13, rotate: true };
  }

  /** A short piece of vessel, cut across so the wall thickness shows. */
  private vesselPiece(outer: number, inner: number, length: number, wall: string, blood: string) {
    const g = new THREE.Group();
    const wallMat = this.tissue(wall, { roughness: 0.5, clearcoat: 0.6, sheen: 0.5, sheenColor: new THREE.Color("#ffd2c9") });
    const out = new THREE.Mesh(new THREE.CylinderGeometry(outer, outer, length, 48, 1, true), wallMat);
    const inn = new THREE.Mesh(new THREE.CylinderGeometry(inner, inner, length, 48, 1, true), this.tissue(wall, { side: THREE.BackSide, roughness: 0.5 }));
    const cap = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 48), this.tissue(wall, { side: THREE.DoubleSide, roughness: 0.7 }));
    cap.rotation.x = -Math.PI / 2;
    cap.position.y = length / 2;
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(inner * 0.98, inner * 0.98, length * 0.99, 40),
      this.mat(`blood:${blood}`, () => this.translucent(new THREE.MeshPhysicalMaterial({ color: blood, roughness: 0.2, clearcoat: 0.9 }), 0.5)),
    );
    g.add(out, inn, cap, core);
    return { group: g, core };
  }

  /** Bleeding: artery, vein and capillary side by side, cut across. */
  private buildBleeding() {
    const artery = this.vesselPiece(1.0, 0.55, 3.4, "#d7675e", "#e0242c");
    artery.group.position.x = -2.8;
    const vein = this.vesselPiece(1.0, 0.82, 3.4, "#a98bb5", "#6d1019");
    const cap = this.vesselPiece(0.32, 0.26, 3.4, "#e8b2a9", "#c71f2a");
    cap.group.position.x = 2.3;
    // One red cell squeezing through the capillary.
    const rbc = this.rbcMesh();
    rbc.scale.setScalar(0.22);
    rbc.position.set(2.3, 1.62, 0.55);
    this.content.add(artery.group, vein.group, cap.group, rbc);
    for (const g of [artery.group, vein.group, cap.group]) g.rotation.x = 0.35;
    rbc.rotation.set(0.35 + Math.PI / 2, 0, 0);
    // The artery pulses with the heartbeat.
    if (!this.reduceMotion)
      this.tickers.push((t) => {
        const beat = Math.max(0, Math.sin(t * 7.5)) ** 3;
        artery.group.scale.set(1 + 0.05 * beat, 1, 1 + 0.05 * beat);
      });
    this.label(artery.group.children[2], "არტერია — სქელი კედელი", new THREE.Vector3(0, 0, 0));
    this.label(vein.group.children[2], "ვენა — თხელი კედელი", new THREE.Vector3(0, 0, 0));
    this.label(cap.group.children[2], "კაპილარი — ერთი შრე", new THREE.Vector3(0, 0, 0));
    return { distance: 13, rotate: false };
  }

  /** Crescent ("sickle") red cell. */
  private sickleCell() {
    const g = new THREE.TorusGeometry(0.75, 0.2, 20, 48, Math.PI * 0.85);
    g.scale(1, 1, 0.45);
    return new THREE.Mesh(g, this.tissue("#a8141d", { roughness: 0.4, clearcoat: 0.5 }));
  }

  /** Diseases: healthy blood, anaemia (few, pale cells) and sickle cells side by side. */
  private buildDiseases() {
    const rand = rng(57);
    const cluster = (x: number, count: number, make: () => THREE.Object3D) => {
      const g = new THREE.Group();
      for (let i = 0; i < count; i++) {
        const c = make();
        inBall(rand, 1.4, c.position);
        c.rotation.set(rand() * 6, rand() * 6, rand() * 6);
        c.scale.multiplyScalar(0.55);
        g.add(c);
      }
      g.position.x = x;
      this.content.add(g);
      return g;
    };
    const normal = cluster(-3.3, 14, () => this.rbcMesh());
    const paleMat = this.mat("rbc-pale", () =>
      this.translucent(
        new THREE.MeshPhysicalMaterial({ color: "#f3a49c", roughness: 0.45, clearcoat: 0.35, emissive: new THREE.Color("#f0b8b0"), emissiveIntensity: 0.35 }),
        0.7,
      ),
    );
    const anaemia = cluster(0, 6, () => new THREE.Mesh(this.rbc.geometry, paleMat));
    let n = 0;
    const sickle = cluster(3.3, 9, () => (n++ % 4 === 3 ? this.rbcMesh() : this.sickleCell()));
    this.label(normal, "ნორმა", new THREE.Vector3(0, 1.9, 0));
    this.label(anaemia, "ანემია", new THREE.Vector3(-0.4, 1.9, 0));
    this.label(sickle, "ნამგლისებრი", new THREE.Vector3(0, 1.9, 0));
    return { distance: 15, rotate: false };
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

  private v = new THREE.Vector3();
  private placeLabels() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (const l of this.labels) {
      l.target.getWorldPosition(this.v);
      this.v.add(l.offset.clone().applyQuaternion(l.target.getWorldQuaternion(new THREE.Quaternion())).multiply(l.target.getWorldScale(new THREE.Vector3())));
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
    const t = this.clock.elapsedTime;
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
    this.rbc.geometry.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.env.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
