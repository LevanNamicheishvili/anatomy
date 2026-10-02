import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/*
 * 3D relief map of Georgia. Elevation: AWS Terrain Tiles; regions and borders: geoBoundaries (built by
 * scripts/build-georgia-terrain.py). Units: 1 = one degree of latitude; longitudes are scaled by cos 42°
 * so shapes keep their proportions. Heights are exaggerated so the relief reads at country scale.
 */

const K = Math.cos((42 * Math.PI) / 180);
const EXAGGERATION = 6;
const M = EXAGGERATION / 111_000; // metres → units

export interface MapPoint {
  id: string;
  lon: number;
  lat: number;
}

export type MapSelection = { kind: "region"; id: string } | { kind: "city"; id: string } | { kind: "peak"; id: string } | null;

interface Callbacks {
  onSelect: (s: MapSelection) => void;
  onHoverRegion: (id: string | null) => void;
  onReady: () => void;
}

interface Meta {
  width: number;
  height: number;
  lon: [number, number];
  lat: [number, number];
  regions: string[];
}

interface Lines {
  borders: Record<string, number[][][]>;
  rivers: number[][][];
}

const BASE = "/geo";
/** Bump when the files in public/geo are rebuilt, so browsers drop their cached copies. */
const GEO_VERSION = "2026-10-02";
const BG = "#eef1ef";

/** Elevation tint: lowland green → foothills → brown mountains → grey rock → snow. */
const STOPS: [number, string][] = [
  [-50, "#cbbf95"],
  [0, "#86b46f"],
  [300, "#a3c27a"],
  [800, "#cfc785"],
  [1500, "#c9a56e"],
  [2300, "#a07c5c"],
  [3000, "#8d8078"],
  [3500, "#d9dde0"],
  [4200, "#ffffff"],
];
const STOP_COLORS = STOPS.map(([h, c]) => [h, new THREE.Color(c)] as const);

function tint(h: number, out: THREE.Color) {
  if (h <= STOP_COLORS[0][0]) return out.copy(STOP_COLORS[0][1]);
  for (let i = 1; i < STOP_COLORS.length; i++) {
    const [h1, c1] = STOP_COLORS[i];
    if (h <= h1) {
      const [h0, c0] = STOP_COLORS[i - 1];
      return out.copy(c0).lerp(c1, (h - h0) / (h1 - h0));
    }
  }
  return out.copy(STOP_COLORS[STOP_COLORS.length - 1][1]);
}

export const ELEVATION_LEGEND = STOPS.filter(([h]) => h >= 0).map(([h, c]) => ({ height: h, color: c }));

export class GeorgiaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  private controls: OrbitControls;
  private meta!: Meta;
  private heights!: Int16Array;
  private regionGrid!: Uint8Array;
  private centre = new THREE.Vector3();
  private uniforms = {
    uTime: { value: 0 },
    uHover: { value: -1 },
    uSelected: { value: -1 },
  };
  private pins = new Map<string, THREE.Group>();
  private selectedBorder: THREE.Mesh | null = null;
  private frame = 0;
  private clock = new THREE.Clock();
  private tween: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; start: number; dur: number } | null = null;
  private disposed = false;
  private observer: ResizeObserver;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private ready = false;
  private down: { x: number; y: number } | null = null;
  private selectedPin: string | null = null;
  /** Called every frame with screen positions, so React can place labels. */
  onFrame: ((project: (lon: number, lat: number, lift?: number) => { x: number; y: number; visible: boolean }, distance: number) => void) | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: Callbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new THREE.Color(BG);
    this.scene.fog = new THREE.Fog(BG, 14, 30);

    // Low sun from the north-west: the classic relief-map light.
    const sun = new THREE.DirectionalLight("#fff6e8", 2.4);
    sun.position.set(-4, 5, -3);
    this.scene.add(sun, new THREE.HemisphereLight("#eaf3ff", "#7b6a58", 1.1));

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 0.7;
    this.controls.maxDistance = 14;
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(12);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(70);
    this.controls.addEventListener("start", () => (this.tween = null));

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    void this.load();
    this.loop();
  }

  // ---- Coordinates --------------------------------------------------------------------------------

  private toXZ(lon: number, lat: number): [number, number] {
    return [(lon - this.centreLon) * K, this.centreLat - lat];
  }
  private centreLon = 43.35;
  private centreLat = 42.3;

  /** Height in metres at a longitude/latitude (bilinear over the grid). */
  heightAt(lon: number, lat: number) {
    const { width: W, height: H, lon: [l0, l1], lat: [a0, a1] } = this.meta;
    const gx = Math.min(W - 1.001, Math.max(0, ((lon - l0) / (l1 - l0)) * (W - 1)));
    const gy = Math.min(H - 1.001, Math.max(0, ((lat - a0) / (a1 - a0)) * (H - 1)));
    const x = Math.floor(gx);
    const y = Math.floor(gy);
    const fx = gx - x;
    const fy = gy - y;
    const h = (i: number, j: number) => {
      const k = j * W + i;
      const v = Math.max(0, this.heights[k]);
      return this.regionGrid[k] ? v : v * 0.32;
    };
    return (h(x, y) * (1 - fx) + h(x + 1, y) * fx) * (1 - fy) + (h(x, y + 1) * (1 - fx) + h(x + 1, y + 1) * fx) * fy;
  }

  /** World position of a point on the ground, optionally lifted above it (in units). */
  ground(lon: number, lat: number, lift = 0) {
    const [x, z] = this.toXZ(lon, lat);
    return new THREE.Vector3(x, this.heightAt(lon, lat) * M + lift, z);
  }

  private centres = new Map<string, { lon: number; lat: number; span: number }>();

  /** Centre of a region (mean of its grid cells) and its size in degrees, for labels and the camera. */
  regionCentre(id: string) {
    if (!this.ready) return null;
    let c = this.centres.get(id);
    if (!c) {
      const { width: W, height: H, lon: [l0, l1], lat: [a0, a1], regions } = this.meta;
      const r = regions.indexOf(id) + 1;
      let sx = 0, sy = 0, n = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          if (this.regionGrid[j * W + i] !== r) continue;
          const lon = l0 + ((l1 - l0) * i) / (W - 1);
          const lat = a0 + ((a1 - a0) * j) / (H - 1);
          sx += lon;
          sy += lat;
          n++;
          minX = Math.min(minX, lon);
          maxX = Math.max(maxX, lon);
          minY = Math.min(minY, lat);
          maxY = Math.max(maxY, lat);
        }
      c = { lon: sx / n, lat: sy / n, span: Math.max((maxX - minX) * K, maxY - minY) };
      this.centres.set(id, c);
    }
    return c;
  }

  private regionAt(lon: number, lat: number) {
    const { width: W, height: H, lon: [l0, l1], lat: [a0, a1] } = this.meta;
    const i = Math.round(((lon - l0) / (l1 - l0)) * (W - 1));
    const j = Math.round(((lat - a0) / (a1 - a0)) * (H - 1));
    if (i < 0 || j < 0 || i >= W || j >= H) return 0;
    return this.regionGrid[j * W + i];
  }

  // ---- Loading ------------------------------------------------------------------------------------

  private async load() {
    const [meta, buf, lines] = await Promise.all([
      fetch(`${BASE}/georgia-terrain.json?v=${GEO_VERSION}`).then((r) => r.json() as Promise<Meta>),
      fetch(`${BASE}/georgia-terrain.bin.gz?v=${GEO_VERSION}`).then(async (r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()),
      fetch(`${BASE}/georgia-lines.json?v=${GEO_VERSION}`).then((r) => r.json() as Promise<Lines>),
    ]);
    if (this.disposed) return;
    this.meta = meta;
    const n = meta.width * meta.height;
    this.heights = new Int16Array(buf, 0, n);
    this.regionGrid = new Uint8Array(buf, n * 2, n);
    this.buildTerrain();
    this.buildSea();
    this.buildBorders(lines.borders);
    this.buildRivers(lines.rivers);
    this.ready = true;
    this.intro();
    this.callbacks.onReady();
  }

  private buildTerrain() {
    const { width: W, height: H, lon: [l0, l1], lat: [a0, a1] } = this.meta;
    const pos = new Float32Array(W * H * 3);
    const col = new Float32Array(W * H * 4);
    const reg = new Float32Array(W * H);
    const c = new THREE.Color();
    const grey = new THREE.Color("#e3e6e4");
    const bg = new THREE.Color(BG);
    const rock = new THREE.Color("#8a8079");
    const snow = new THREE.Color("#f7f9fb");
    const N = W * H;

    // 1. Display heights: Georgia at full height; neighbouring countries flattened, so Georgia rises
    //    above them like a relief model.
    const hd = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const r = this.regionGrid[k];
      let h = this.heights[k];
      if (r && h < 2) h = 2; // keep Georgia's coastal lowland above the water line
      hd[k] = r ? h : h > 0 ? h * 0.32 : Math.max(-60, h);
    }

    // 2. Soft valley shadows (ambient occlusion): a point lower than its surroundings gets less sky light.
    const sum = new Float64Array((W + 1) * (H + 1));
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++)
        sum[(j + 1) * (W + 1) + i + 1] = Math.max(0, hd[j * W + i]) + sum[j * (W + 1) + i + 1] + sum[(j + 1) * (W + 1) + i] - sum[j * (W + 1) + i];
    const R = 9;
    const around = (i: number, j: number) => {
      const x0 = Math.max(0, i - R), x1 = Math.min(W, i + R + 1), y0 = Math.max(0, j - R), y1 = Math.min(H, j + R + 1);
      return (sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
    };

    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        const lon = l0 + ((l1 - l0) * i) / (W - 1);
        const lat = a0 + ((a1 - a0) * j) / (H - 1);
        const [x, z] = this.toXZ(lon, lat);
        const r = this.regionGrid[k];
        const h = this.heights[k];
        // Fade out towards the edges of the grid, so the map has no cut-off walls.
        const edge = Math.min(i, W - 1 - i, j, H - 1 - j) / (H * 0.18);
        const fade = edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
        pos.set([x, hd[k] * M * fade, z], k * 3);

        // Slope (metres per cell) decides between vegetation, bare rock and snow.
        const hx = hd[j * W + Math.min(W - 1, i + 1)] - hd[j * W + Math.max(0, i - 1)];
        const hz = hd[Math.min(H - 1, j + 1) * W + i] - hd[Math.max(0, j - 1) * W + i];
        const slope = Math.hypot(hx, hz) / 2;
        tint(h, c);
        if (r && h > 1400) c.lerp(rock, Math.min(0.85, Math.max(0, (slope - 90) / 260)));
        if (r && h > 3100) c.lerp(snow, Math.min(1, (h - 3100) / 700) * Math.max(0.35, 1 - slope / 500));
        const ao = Math.max(0, around(i, j) - Math.max(0, hd[k]));
        c.multiplyScalar(1 - Math.min(0.32, ao / 1400));
        // Neighbouring countries stay pale, so Georgia stands out.
        if (!r && h > 0) c.lerp(grey, 0.72);
        c.lerp(bg, 1 - fade);
        col.set([c.r, c.g, c.b, fade], k * 4);
        reg[k] = r - 1;
      }
    const idx = new Uint32Array((W - 1) * (H - 1) * 6);
    let t = 0;
    for (let j = 0; j < H - 1; j++)
      for (let i = 0; i < W - 1; i++) {
        const a = j * W + i;
        idx.set([a, a + W, a + 1, a + 1, a + W, a + W + 1], t);
        t += 6;
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 4));
    g.setAttribute("aRegion", new THREE.BufferAttribute(reg, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    // Vertex alpha dissolves the map edges into the background.
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.92, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aRegion;\nvarying float vRegion;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRegion = aRegion;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uHover;\nuniform float uSelected;\nuniform float uTime;\nvarying float vRegion;")
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          float isSel = 1.0 - step(0.5, abs(vRegion - uSelected));
          float isHov = 1.0 - step(0.5, abs(vRegion - uHover));
          // Selected region: warmer and slightly pulsing; others dim a little so it stands out.
          if (uSelected > -0.5 && vRegion > -0.5) {
            diffuseColor.rgb = mix(diffuseColor.rgb * 0.82, diffuseColor.rgb * vec3(1.08, 1.04, 0.92), isSel);
            diffuseColor.rgb += isSel * 0.05 * (0.5 + 0.5 * sin(uTime * 2.6));
          }
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.14 + vec3(0.03), isHov * (1.0 - isSel));`,
        );
    };
    const mesh = new THREE.Mesh(g, m);
    this.scene.add(mesh);
    this.centre.set(0, 0, 0);
  }

  /** Black Sea: a gently moving water surface. */
  private buildSea() {
    const { lon: [l0], lat: [a0, a1] } = this.meta;
    const [x0, zN] = this.toXZ(l0, a0);
    const [x1, zS] = this.toXZ(42.3, a1);
    const w = x1 - x0;
    const d = zS - zN;
    const g = new THREE.PlaneGeometry(w, d, 120, 80);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshPhysicalMaterial({
      color: "#3b7fb3",
      roughness: 0.18,
      metalness: 0,
      clearcoat: 1,
      transparent: true,
      opacity: 0.88,
    });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms, { uSize: { value: new THREE.Vector2(w / 2, d / 2) } });
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec2 uSize;\nvarying vec2 vSea;")
        .replace(
          "#include <opaque_fragment>",
          `#include <opaque_fragment>
          // Fade out at every edge, so the sea has no visible border.
          vec2 e = (uSize - abs(vSea)) / uSize;
          float fade = smoothstep(0.0, 0.3, e.y) * smoothstep(0.0, 0.25, (vSea.x + uSize.x) / uSize.x) * smoothstep(0.0, 0.2, (uSize.x - vSea.x) / uSize.x);
          gl_FragColor.a *= fade;`,
        );
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec2 vSea;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSea = position.xz;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float w1 = sin(position.x * 9.0 + uTime * 1.3) * cos(position.z * 7.0 - uTime * 0.9);
          float w2 = sin((position.x + position.z) * 17.0 - uTime * 1.9);
          transformed.y += (w1 * 0.6 + w2 * 0.4) * 0.0025;`,
        )
        .replace(
          "#include <beginnormal_vertex>",
          `#include <beginnormal_vertex>
          objectNormal = normalize(vec3(
            -cos(position.x * 9.0 + uTime * 1.3) * 0.02 - cos((position.x + position.z) * 17.0 - uTime * 1.9) * 0.03,
            1.0,
            sin(position.z * 7.0 - uTime * 0.9) * 0.02));`,
        );
    };
    const sea = new THREE.Mesh(g, m);
    sea.position.set((x0 + x1) / 2, -0.0004, (zN + zS) / 2);
    this.scene.add(sea);
  }

  /** A flat ribbon draped over the terrain along lon/lat points. */
  private ribbon(points: number[][], width: (i: number) => number, lift: number) {
    const pts: THREE.Vector3[] = [];
    // Densify so the ribbon follows the ground between far-apart points.
    for (let i = 0; i < points.length - 1; i++) {
      const [lo0, la0] = points[i];
      const [lo1, la1] = points[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(lo1 - lo0, la1 - la0) / 0.01));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        pts.push(this.ground(lo0 + (lo1 - lo0) * t, la0 + (la1 - la0) * t, lift));
      }
    }
    const last = points[points.length - 1];
    pts.push(this.ground(last[0], last[1], lift));
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let dist = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const w = width(Math.min(points.length - 1, Math.floor((i / pts.length) * points.length)));
      const nx = (-dz / len) * w;
      const nz = (dx / len) * w;
      if (i > 0) dist += pts[i].distanceTo(pts[i - 1]);
      const p = pts[i];
      pos.push(p.x + nx, p.y, p.z + nz, p.x - nx, p.y, p.z - nz);
      uv.push(dist, 0, dist, 1);
      if (i > 0) {
        const o = (i - 1) * 2;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }

  private borderMeshes = new Map<string, THREE.Mesh[]>();

  private buildBorders(borders: Record<string, number[][][]>) {
    const mat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide });
    for (const [id, rings] of Object.entries(borders)) {
      const meshes = rings.map((ring) => {
        const m = new THREE.Mesh(this.ribbon(ring, () => 0.0022, 0.0035), mat);
        m.renderOrder = 2;
        this.scene.add(m);
        return m;
      });
      this.borderMeshes.set(id, meshes);
    }
  }

  private riverMat: THREE.ShaderMaterial | null = null;

  /** Rivers with water visibly flowing downstream. */
  private buildRivers(rivers: number[][][]) {
    this.riverMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.uniforms.uTime },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){
          float edge = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
          float flow = 0.5 + 0.5 * sin(vUv.x * 160.0 - uTime * 3.0);
          vec3 c = mix(vec3(0.17, 0.47, 0.78), vec3(0.55, 0.8, 0.98), flow * 0.55);
          gl_FragColor = vec4(c, 0.92 * edge);
        }`,
    });
    const parts: number[][][] = [];
    for (const line of rivers) {
      let cur: number[][] = [];
      for (const p of line) {
        if (this.regionAt(p[0], p[1])) cur.push(p);
        else {
          // Keep the mouth where a river reaches the sea; drop everything abroad.
          if (cur.length && this.heightAt(p[0], p[1]) <= 0) cur.push(p);
          if (cur.length >= 4) parts.push(cur);
          cur = [];
        }
      }
      if (cur.length >= 4) parts.push(cur);
    }
    for (const line of parts) {
      const m = new THREE.Mesh(
        this.ribbon(line, (i) => 0.0018 + 0.0016 * Math.log2(Math.max(1, line[i][2] / 2300)), 0.0025),
        this.riverMat,
      );
      m.renderOrder = 1;
      this.scene.add(m);
    }
  }

  // ---- Pins ---------------------------------------------------------------------------------------

  /** City and peak markers: a thin needle with a ball, standing on the ground. */
  setPins(points: (MapPoint & { kind: "city" | "peak"; capital?: boolean })[]) {
    if (!this.ready) {
      this.pendingPins = points;
      return;
    }
    for (const g of this.pins.values()) this.scene.remove(g);
    this.pins.clear();
    for (const p of points) {
      const g = new THREE.Group();
      const color = p.kind === "peak" ? "#7b6a58" : p.capital ? "#b8232b" : "#1d2a27";
      const head = new THREE.Mesh(
        p.kind === "peak" ? new THREE.ConeGeometry(0.022, 0.05, 4) : new THREE.SphereGeometry(p.capital ? 0.022 : 0.016, 20, 14),
        new THREE.MeshStandardMaterial({ color, roughness: 0.35, emissive: color, emissiveIntensity: 0.15 }),
      );
      const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.07, 6), new THREE.MeshStandardMaterial({ color: "#ffffff" }));
      needle.position.y = 0.035;
      head.position.y = 0.075;
      // White ring around the head, so markers read on any background.
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(p.kind === "peak" ? 0.026 : p.capital ? 0.028 : 0.021, 0.004, 8, 32),
        new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.075;
      g.add(needle, head, ring);
      g.position.copy(this.ground(p.lon, p.lat));
      g.userData = { id: p.id, kind: p.kind, baseY: g.position.y };
      this.scene.add(g);
      this.pins.set(`${p.kind}:${p.id}`, g);
    }
  }
  private pendingPins: Parameters<GeorgiaScene["setPins"]>[0] | null = null;

  // ---- Selection & camera ------------------------------------------------------------------------

  select(sel: MapSelection, focus?: { lon: number; lat: number; span: number }) {
    this.uniforms.uSelected.value = sel?.kind === "region" ? this.meta?.regions.indexOf(sel.id) ?? -1 : -1;
    this.selectedPin = sel && sel.kind !== "region" ? `${sel.kind}:${sel.id}` : null;
    // Highlighted outline of the selected region.
    if (this.selectedBorder) {
      this.scene.remove(this.selectedBorder);
      this.selectedBorder = null;
    }
    if (sel?.kind === "region") {
      const meshes = this.borderMeshes.get(sel.id) ?? [];
      const group = new THREE.Group() as unknown as THREE.Mesh;
      for (const m of meshes) {
        const hi = new THREE.Mesh(m.geometry, new THREE.MeshBasicMaterial({ color: "#1d4f84", depthWrite: false, side: THREE.DoubleSide }));
        hi.scale.set(1, 1, 1);
        hi.position.y = 0.0008;
        hi.renderOrder = 3;
        (group as unknown as THREE.Group).add(hi);
      }
      this.selectedBorder = group;
      this.scene.add(group);
    }
    if (focus) this.flyTo(focus.lon, focus.lat, focus.span);
  }

  /** Smooth camera flight so a place of the given size (degrees) fills the view. */
  /** Camera distance at which something `span` units wide fills the view (any screen shape). */
  private fit(width: number, depth = width) {
    const v = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const h = Math.atan(Math.tan(v) * this.camera.aspect);
    // Seen from ~50° above, ground depth shrinks to about 0.78 of its size on screen.
    return Math.max(width / 2 / Math.tan(h), (depth * 0.78) / 2 / Math.tan(v)) * 1.06;
  }

  flyTo(lon: number, lat: number, span: number, depth = span) {
    if (!this.ready) return;
    const target = this.ground(lon, lat);
    const dist = Math.min(14, Math.max(0.9, this.fit(span, depth)));
    const dir = new THREE.Vector3(0, 0.78, 0.62).normalize();
    this.startTween(target, target.clone().addScaledVector(dir, dist), this.reduceMotion ? 1 : 1400);
  }

  /** Whole country: Georgia is ~5 units wide and ~2.8 deep. */
  home() {
    this.flyTo(this.centreLon, this.centreLat, 5.1, 2.9);
  }

  private intro() {
    const target = this.ground(this.centreLon, this.centreLat);
    const end = target.clone().addScaledVector(new THREE.Vector3(0, 0.78, 0.62).normalize(), Math.min(14, this.fit(5.1, 2.9)));
    if (this.reduceMotion) {
      this.camera.position.copy(end);
      this.controls.target.copy(target);
      return;
    }
    // From high above the Black Sea, swinging round to look at the Caucasus from the south.
    this.camera.position.copy(target.clone().add(new THREE.Vector3(-4.5, 9, 6)));
    this.controls.target.copy(target.clone().add(new THREE.Vector3(-1.5, 0, 0)));
    this.startTween(target, end, 2800);
  }

  private startTween(target: THREE.Vector3, position: THREE.Vector3, dur: number) {
    this.tween = {
      from: [this.controls.target.clone(), this.camera.position.clone()],
      to: [target, position],
      start: performance.now(),
      dur,
    };
  }

  // ---- Pointer ------------------------------------------------------------------------------------

  private ray = new THREE.Raycaster();
  private ndc = new THREE.Vector2();

  /** Where the pointer meets the ground: march along the ray until it dips below the terrain. */
  private pickGround(clientX: number, clientY: number) {
    if (!this.ready) return null;
    const rect = this.canvas.getBoundingClientRect();
    this.ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const { origin, direction } = this.ray.ray;
    const p = new THREE.Vector3();
    for (let t = 0.05; t < 30; t += 0.01) {
      p.copy(origin).addScaledVector(direction, t);
      const lon = p.x / K + this.centreLon;
      const lat = this.centreLat - p.z;
      if (p.y <= this.heightAt(lon, lat) * M) return { lon, lat };
    }
    return null;
  }

  private pickPin(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    let best: THREE.Group | null = null;
    let bestD = 18;
    const v = new THREE.Vector3();
    for (const g of this.pins.values()) {
      v.copy(g.position).add(new THREE.Vector3(0, 0.075, 0)).project(this.camera);
      const x = ((v.x + 1) / 2) * rect.width + rect.left;
      const y = ((1 - v.y) / 2) * rect.height + rect.top;
      const d = Math.hypot(x - clientX, y - clientY);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
    const pin = this.pickPin(e.clientX, e.clientY);
    if (pin) {
      this.callbacks.onSelect({ kind: pin.userData.kind, id: pin.userData.id });
      return;
    }
    const hit = this.pickGround(e.clientX, e.clientY);
    const r = hit ? this.regionAt(hit.lon, hit.lat) : 0;
    this.callbacks.onSelect(r ? { kind: "region", id: this.meta.regions[r - 1] } : null);
  };

  private lastHover = 0;
  private onPointerMove = (e: PointerEvent) => {
    if (e.buttons || performance.now() - this.lastHover < 60) return;
    this.lastHover = performance.now();
    const hit = this.pickGround(e.clientX, e.clientY);
    const r = hit ? this.regionAt(hit.lon, hit.lat) : 0;
    this.uniforms.uHover.value = r - 1;
    this.canvas.style.cursor = r || this.pickPin(e.clientX, e.clientY) ? "pointer" : "";
    this.callbacks.onHoverRegion(r ? this.meta.regions[r - 1] : null);
  };

  private onPointerLeave = () => {
    this.uniforms.uHover.value = -1;
    this.callbacks.onHoverRegion(null);
  };

  setHoverRegion(id: string | null) {
    if (this.meta) this.uniforms.uHover.value = id ? this.meta.regions.indexOf(id) : -1;
  }

  // ---- Loop ---------------------------------------------------------------------------------------

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private v = new THREE.Vector3();
  private projectPoint = (lon: number, lat: number, lift = 0) => {
    if (!this.ready) return { x: 0, y: 0, visible: false };
    this.v.copy(this.ground(lon, lat, lift)).project(this.camera);
    return {
      x: ((this.v.x + 1) / 2) * this.canvas.clientWidth,
      y: ((1 - this.v.y) / 2) * this.canvas.clientHeight,
      visible: this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1,
    };
  };

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const t = this.clock.getElapsedTime();
    if (!this.reduceMotion) this.uniforms.uTime.value = t;
    if (this.pendingPins && this.ready) {
      const p = this.pendingPins;
      this.pendingPins = null;
      this.setPins(p);
    }
    if (this.tween) {
      const k = Math.min(1, (performance.now() - this.tween.start) / this.tween.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      this.controls.target.lerpVectors(this.tween.from[0], this.tween.to[0], e);
      this.camera.position.lerpVectors(this.tween.from[1], this.tween.to[1], e);
      if (k >= 1) this.tween = null;
    }
    // The selected pin bobs gently.
    for (const [key, g] of this.pins) {
      const sel = key === this.selectedPin;
      g.position.y = g.userData.baseY + (sel && !this.reduceMotion ? 0.012 + 0.012 * Math.sin(t * 4) : 0);
      g.scale.setScalar(sel ? 1.5 : 1);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.projectPoint, this.camera.position.distanceTo(this.controls.target));
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.controls.dispose();
    this.renderer.dispose();
  }
}
