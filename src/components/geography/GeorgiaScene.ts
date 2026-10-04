import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { CLIMATES, REGION_COLORS, ZONES, type MapLayer } from "./georgia-data";

/*
 * 3D relief map of Georgia. Elevation: AWS Terrain Tiles; regions and borders: geoBoundaries; rivers traced
 * along the terrain's flow paths (all built by scripts/build-georgia-terrain.py). Units: 1 = one degree of
 * latitude; longitudes are scaled by cos 42° so shapes keep their proportions. Heights are exaggerated so
 * the relief reads at country scale.
 *
 * The mesh is a 1024×550 grid, but lighting and colour are worked out per pixel from a twice as detailed
 * height texture: ridges and gorges stay sharp without the cost of more vertices on school computers.
 */

const K = Math.cos((42 * Math.PI) / 180);
const EXAGGERATION = 6;
const M = EXAGGERATION / 111_000; // metres → units
const SHADE_EXAGGERATION = 3.2;
/** Neighbouring countries are drawn lower, so Georgia rises above them like a relief model. */
const ABROAD = 0.32;

export interface MapPoint {
  id: string;
  lon: number;
  lat: number;
}

export type SelectionKind = "region" | "city" | "peak" | "river" | "lake";
export type MapSelection = { kind: SelectionKind; id: string } | null;
export interface Overlays {
  rivers: boolean;
  lakes: boolean;
  cities: boolean;
  peaks: boolean;
}
export interface HoverInfo {
  lon: number;
  lat: number;
  /** Real (not exaggerated) height in metres. */
  height: number;
  region: string | null;
}

interface Callbacks {
  onSelect: (s: MapSelection) => void;
  onHover: (h: HoverInfo | null) => void;
  onReady: () => void;
}

interface Meta {
  width: number;
  height: number;
  detail: [number, number];
  lon: [number, number];
  lat: [number, number];
  regions: string[];
}

/** Real lake outlines and river courses from OpenStreetMap (scripts/build-georgia-water.py). */
interface Water {
  lakes: Record<string, number[][][]>;
  rivers: Record<string, number[][][]>;
}

/** Drawn width of each named river (world units): the big rivers a little wider. */
const RIVER_WIDTH: Record<string, number> = { mtkvari: 0.0046, rioni: 0.0044, alazani: 0.004, enguri: 0.004, iori: 0.0036, chorokhi: 0.0042, khrami: 0.0034, tergi: 0.0034 };

const inRing = (ring: number[][], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
};

interface Lines {
  borders: Record<string, number[][][]>;
  named: Record<string, number[][]>;
  rivers: number[][][];
}

const BASE = "/geo";
/** Bump when the files in public/geo are rebuilt, so browsers drop their cached copies. */
const GEO_VERSION = "2026-10-04";
const BG = "#eef1ef";
const LAYER_INDEX: Record<MapLayer, number> = { physical: 0, political: 1, zones: 2, climate: 3, satellite: 4 };

/** Elevation tint: lowland green → foothills → brown mountains → grey rock → snow. */
const STOPS: [number, string][] = [
  [-200, "#d9cfa6"],
  [0, "#7fb06a"],
  [300, "#a3c27a"],
  [800, "#cfc785"],
  [1500, "#c9a56e"],
  [2300, "#a07c5c"],
  [3000, "#8d8078"],
  [3500, "#d9dde0"],
  [4200, "#ffffff"],
];
const RAMP_MIN = -200;
const RAMP_MAX = 5200;

export const ELEVATION_LEGEND = STOPS.filter(([h]) => h >= 0).map(([h, c]) => ({ height: h, color: c }));

function rampTexture() {
  const n = 256;
  const data = new Uint8Array(n * 4);
  const c = new THREE.Color();
  const cols = STOPS.map(([h, s]) => [h, new THREE.Color(s)] as const);
  for (let i = 0; i < n; i++) {
    const h = RAMP_MIN + ((RAMP_MAX - RAMP_MIN) * i) / (n - 1);
    const k = cols.findIndex(([hh]) => hh >= h);
    if (k < 0) c.copy(cols[cols.length - 1][1]);
    else if (k === 0) c.copy(cols[0][1]);
    else c.copy(cols[k - 1][1]).lerp(cols[k][1], (h - cols[k - 1][0]) / (cols[k][0] - cols[k - 1][0]));
    data.set([c.r * 255, c.g * 255, c.b * 255, 255], i * 4);
  }
  const t = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

const linear = (hex: string) => new THREE.Color(hex);
const zone = (id: string) => linear(ZONES.find((z) => z.id === id)!.color);
const climate = (id: string) => linear(CLIMATES.find((z) => z.id === id)!.color);

/**
 * Per-pixel terrain colour for each layer. Zone and climate borders follow height and position: west of
 * the Likhi range (≈43.6°E, but not the Samtskhe basin) is the humid west; the south-east lowlands are dry;
 * the Javakheti plateau is its own highland.
 */
const TERRAIN_GLSL = /* glsl */ `
uniform sampler2D uHeight;
uniform sampler2D uRegion;
uniform sampler2D uFactor;
uniform sampler2D uRamp;
uniform sampler2D uSat;
uniform sampler2D uPatch;
uniform vec4 uPatchRect;
uniform float uPatchMix;
uniform vec2 uTexel;
uniform vec2 uCellM;
uniform vec2 uLon;
uniform vec2 uLat;
uniform float uLayer;
uniform float uHover;
uniform float uSelected;
uniform float uTime;
uniform vec3 uRegionColors[12];
uniform vec3 uZone[9];
uniform vec3 uClimate[7];
varying vec2 vTUv;
varying float vAO;
varying float vFade;

float band(float h, float t) { return smoothstep(t - 70.0, t + 70.0, h); }

/** Satellite colour: the sharp patch loaded around the camera where there is one, the whole-country picture elsewhere. */
vec3 satColor(vec2 uv, float lon, float lat) {
  vec3 base = texture2D(uSat, uv).rgb;
  vec2 p = vec2((lon - uPatchRect.x) / (uPatchRect.z - uPatchRect.x), (uPatchRect.y - lat) / (uPatchRect.y - uPatchRect.w));
  if (uPatchMix <= 0.0 || p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) return base;
  float edge = smoothstep(0.0, 0.06, min(min(p.x, 1.0 - p.x), min(p.y, 1.0 - p.y)));
  return mix(base, texture2D(uPatch, p).rgb, edge * uPatchMix);
}
`;

const TERRAIN_COLOR = /* glsl */ `
  float h = texture2D(uHeight, vTUv).r;
  float reg = floor(texture2D(uRegion, vTUv).r * 255.0 + 0.5);
  bool inside = reg > 0.5;
  // Per-pixel normal from the detailed heights (neighbouring countries flattened like the mesh).
  float f = texture2D(uFactor, vTUv).r;
  float hL = max(texture2D(uHeight, vTUv - vec2(uTexel.x, 0.0)).r, -60.0) * f;
  float hR = max(texture2D(uHeight, vTUv + vec2(uTexel.x, 0.0)).r, -60.0) * f;
  float hU = max(texture2D(uHeight, vTUv - vec2(0.0, uTexel.y)).r, -60.0) * f;
  float hD = max(texture2D(uHeight, vTUv + vec2(0.0, uTexel.y)).r, -60.0) * f;
  vec2 grad = vec2(hR - hL, hD - hU) / (2.0 * uCellM);
  // Shading uses a gentler slope than the geometry, so steep mountains stay readable rather than black.
  vec3 terrainN = normalize(vec3(-grad.x * ${SHADE_EXAGGERATION.toFixed(1)}, 1.0, -grad.y * ${SHADE_EXAGGERATION.toFixed(1)}));
  float tanSlope = length(grad);

  float lon = mix(uLon.x, uLon.y, vTUv.x);
  float lat = mix(uLat.x, uLat.y, vTUv.y);
  float west = (1.0 - smoothstep(43.45, 43.75, lon)) * (1.0 - smoothstep(41.85, 41.7, lat) * smoothstep(42.6, 42.8, lon));
  float dry = (1.0 - west) * smoothstep(41.76, 41.62, lat) * smoothstep(44.45, 44.65, lon);
  float jav = smoothstep(41.72, 41.6, lat) * smoothstep(43.0, 43.2, lon) * (1.0 - smoothstep(44.2, 44.4, lon));
  float plateau = jav * band(h, 1450.0) * (1.0 - band(h, 2450.0));

  vec3 col;
  if (uLayer > 3.5) {
    // Satellite picture: it already holds the real light and shade, so our own shading is softened.
    col = pow(satColor(vTUv, lon, lat), vec3(0.88)) * 1.6;
    terrainN = normalize(mix(terrainN, vec3(0.0, 1.0, 0.0), 0.5));
  } else if (uLayer < 0.5) {
    col = texture2D(uRamp, vec2((h - ${RAMP_MIN.toFixed(1)}) / ${(RAMP_MAX - RAMP_MIN).toFixed(1)}, 0.5)).rgb;
    if (inside) {
      col = mix(col, vec3(0.50, 0.46, 0.43), smoothstep(0.45, 1.0, tanSlope) * band(h, 1300.0) * 0.8);
      float snow = band(h, mix(3500.0, 3150.0, west)) * (1.0 - smoothstep(0.8, 1.3, tanSlope) * 0.6);
      col = mix(col, vec3(0.97, 0.98, 0.99), snow);
    }
  } else if (uLayer < 1.5) {
    col = inside ? uRegionColors[int(reg) - 1] : vec3(0.85);
  } else if (uLayer < 2.5) {
    vec3 low = mix(mix(uZone[2], uZone[1], dry), uZone[0], west);
    col = low;
    col = mix(col, uZone[2], band(h, mix(mix(650.0, 850.0, dry), 500.0, west)));
    col = mix(col, uZone[3], band(h, 1300.0));
    col = mix(col, uZone[4], band(h, 1900.0));
    col = mix(col, uZone[5], band(h, 2500.0));
    col = mix(col, uZone[6], plateau);
    col = mix(col, uZone[7], band(h, 3000.0));
    col = mix(col, uZone[8], band(h, mix(3500.0, 3150.0, west)));
  } else {
    vec3 low = mix(mix(uClimate[3], uClimate[2], dry), uClimate[0], west);
    col = low;
    col = mix(col, uClimate[1], band(h, mix(1000.0, 600.0, west)));
    col = mix(col, uClimate[4], plateau);
    col = mix(col, uClimate[5], band(h, 2200.0));
    col = mix(col, uClimate[6], band(h, 3500.0));
  }
  if (!inside) {
    // Neighbouring countries stay pale, so Georgia stands out; the sea floor is hidden by the water.
    if (uLayer > 3.5) {
      float g = dot(col, vec3(0.3, 0.59, 0.11));
      col = mix(col, vec3(g) * 1.1 + 0.07, 0.6);
    } else {
      col = h > 0.0 ? mix(col, vec3(0.89, 0.9, 0.89), uLayer < 0.5 ? 0.72 : 0.9) : vec3(0.85, 0.82, 0.7);
    }
  }
  col *= vAO;
  float idx = reg - 1.0;
  float isSel = inside ? 1.0 - step(0.5, abs(idx - uSelected)) : 0.0;
  float isHov = inside ? 1.0 - step(0.5, abs(idx - uHover)) : 0.0;
  if (uSelected > -0.5 && inside) {
    col = mix(col * 0.84, col * vec3(1.08, 1.04, 0.94), isSel);
    col += isSel * 0.04 * (0.5 + 0.5 * sin(uTime * 2.6));
  }
  col = mix(col, col * 1.12 + vec3(0.03), isHov * (1.0 - isSel));
  col = mix(vec3(${linear(BG).toArray().map((x) => x.toFixed(4)).join(", ")}), col, vFade);
  diffuseColor = vec4(col, vFade);
`;

export class GeorgiaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  private controls: MapControls;
  private meta!: Meta;
  /** Mesh-grid heights (metres) and region per cell. */
  private heights!: Int16Array;
  private regionGrid!: Uint8Array;
  /** Height factor per cell: 1 in Georgia, easing down to ABROAD a few kilometres beyond the border. */
  private factor!: Float32Array;
  private uniforms = {
    uTime: { value: 0 },
    uHover: { value: -1 },
    uSelected: { value: -1 },
    uLayer: { value: 0 },
    uSelRiver: { value: -1 },
    /** Lines get thinner as the camera comes closer, so they stay about the same width on screen. */
    uZoom: { value: 1 },
  };
  private pins = new Map<string, THREE.Group>();
  private lakes = new Map<string, { mesh: THREE.Mesh; lon: number; lat: number; r: number; rings: number[][][] }>();
  private riverIds: string[] = [];
  private riverParts = new Map<string, number[][][]>();
  private riverGroup = new THREE.Group();
  private selectedBorder: THREE.Group | null = null;
  private frame = 0;
  private clock = new THREE.Clock();
  private tween: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; start: number; dur: number } | null = null;
  private disposed = false;
  private observer: ResizeObserver;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private ready = false;
  private down: { x: number; y: number } | null = null;
  private selectedPin: string | null = null;
  private overlays: Overlays = { rivers: true, lakes: true, cities: true, peaks: true };
  private textures: THREE.Texture[] = [];
  private satellite: THREE.Texture | null = null;
  private heightTex: THREE.DataTexture | null = null;
  private regionTex: THREE.DataTexture | null = null;
  private factorTex: THREE.DataTexture | null = null;
  private water: Water = { lakes: {}, rivers: {} };
  private patchUniforms = {
    uPatch: { value: null as THREE.Texture | null },
    uPatchRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uPatchMix: { value: 0 },
  };
  /** Peaks moved onto the highest point near their listed coordinates. */
  private snappedPeaks = new Map<string, { lon: number; lat: number }>();
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
    const sun = new THREE.DirectionalLight("#fff6e8", 2.1);
    sun.position.set(-4, 5, -3);
    this.scene.add(sun, new THREE.HemisphereLight("#eef5ff", "#8c7b68", 1.45), this.riverGroup, this.buildingGroup);

    // Map-style controls, as in Google Maps: drag moves the map (one finger on a board), right drag or two
    // fingers turn and tilt it, the wheel or a pinch zooms towards the point under the cursor.
    this.controls = new MapControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.zoomToCursor = true;
    this.controls.zoomSpeed = 1.2;
    this.controls.panSpeed = 1;
    this.controls.rotateSpeed = 0.6;
    this.controls.minDistance = 0.025;
    this.controls.maxDistance = 14;
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(5);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(76);
    this.controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
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

  private centreLon = 43.35;
  private centreLat = 42.3;
  private toXZ(lon: number, lat: number): [number, number] {
    return [(lon - this.centreLon) * K, this.centreLat - lat];
  }

  private gridHeight(lon: number, lat: number, display: boolean) {
    const { width: W, height: H, lon: [l0, l1], lat: [a0, a1] } = this.meta;
    const gx = Math.min(W - 1.001, Math.max(0, ((lon - l0) / (l1 - l0)) * (W - 1)));
    const gy = Math.min(H - 1.001, Math.max(0, ((lat - a0) / (a1 - a0)) * (H - 1)));
    const x = Math.floor(gx);
    const y = Math.floor(gy);
    const fx = gx - x;
    const fy = gy - y;
    const h = (i: number, j: number) => {
      const k = j * W + i;
      if (!display) return this.heights[k];
      return Math.max(0, this.heights[k]) * this.factor[k];
    };
    return (h(x, y) * (1 - fx) + h(x + 1, y) * fx) * (1 - fy) + (h(x, y + 1) * (1 - fx) + h(x + 1, y + 1) * fx) * fy;
  }

  /** Displayed height in metres (as the mesh shows it). */
  heightAt(lon: number, lat: number) {
    return this.gridHeight(lon, lat, true);
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
    const satellite = new THREE.TextureLoader().loadAsync(`${BASE}/georgia-satellite.jpg?v=${GEO_VERSION}`);
    const [meta, buf, lines, water, sat] = await Promise.all([
      fetch(`${BASE}/georgia-terrain.json?v=${GEO_VERSION}`).then((r) => r.json() as Promise<Meta>),
      fetch(`${BASE}/georgia-terrain.bin.gz?v=${GEO_VERSION}`).then(async (r) => new Response(r.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()),
      fetch(`${BASE}/georgia-lines.json?v=${GEO_VERSION}`).then((r) => r.json() as Promise<Lines>),
      fetch(`${BASE}/georgia-water.json?v=${GEO_VERSION}`).then((r) => r.json() as Promise<Water>),
      satellite,
    ]);
    sat.colorSpace = THREE.SRGBColorSpace;
    sat.flipY = false;
    sat.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    sat.needsUpdate = true;
    this.satellite = sat;
    this.textures.push(sat);
    this.water = water;
    if (this.disposed) return;
    this.meta = meta;
    const [DW, DH] = meta.detail;
    const W = meta.width;
    const H = meta.height;
    // Detail heights: each row is stored as its first value followed by differences.
    const coded = new Int16Array(buf, 0, DW * DH);
    const detail = new Int16Array(DW * DH);
    for (let j = 0; j < DH; j++) {
      let v = 0;
      for (let i = 0; i < DW; i++) {
        const k = j * DW + i;
        v = i === 0 ? coded[k] : v + coded[k];
        detail[k] = v;
      }
    }
    this.regionGrid = new Uint8Array(buf, DW * DH * 2, W * H);
    this.heights = new Int16Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) this.heights[j * W + i] = detail[2 * j * DW + 2 * i];
    // Ease the flattening of neighbouring countries over ~6 cells, so the border is a slope, not a wall.
    const R = 6;
    const sum = new Float64Array((W + 1) * (H + 1));
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++)
        sum[(j + 1) * (W + 1) + i + 1] = (this.regionGrid[j * W + i] ? 1 : 0) + sum[j * (W + 1) + i + 1] + sum[(j + 1) * (W + 1) + i] - sum[j * (W + 1) + i];
    this.factor = new Float32Array(W * H);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        if (this.regionGrid[k]) {
          this.factor[k] = 1;
          continue;
        }
        const x0 = Math.max(0, i - R), x1 = Math.min(W, i + R + 1), y0 = Math.max(0, j - R), y1 = Math.min(H, j + R + 1);
        const near = (sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
        const t = Math.min(1, near * 2);
        this.factor[k] = ABROAD + (1 - ABROAD) * t * t * (3 - 2 * t);
      }

    this.buildTerrain(detail);
    this.buildSea();
    this.buildBorders(lines.borders);
    this.buildRivers(lines.named, lines.rivers, water.rivers);
    this.ready = true;
    this.applyOverlays();
    this.intro();
    this.callbacks.onReady();
  }

  private buildTerrain(detail: Int16Array) {
    const { width: W, height: H, detail: [DW, DH], lon: [l0, l1], lat: [a0, a1] } = this.meta;
    const N = W * H;

    // Display heights: Georgia at full height, neighbours flattened.
    const hd = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const r = this.regionGrid[k];
      let h = this.heights[k];
      if (r && h < 2) h = 2; // keep Georgia's coastal lowland above the water line
      // Outside Georgia, anything at sea level is sea: it sinks below the water surface.
      hd[k] = r ? h : h > 1 ? h * this.factor[k] : -60;
    }
    // Soft valley shadows (ambient occlusion): a point lower than its surroundings gets less sky light.
    const sum = new Float64Array((W + 1) * (H + 1));
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++)
        sum[(j + 1) * (W + 1) + i + 1] = Math.max(0, hd[j * W + i]) + sum[j * (W + 1) + i + 1] + sum[(j + 1) * (W + 1) + i] - sum[j * (W + 1) + i];
    const R = 8;
    const around = (i: number, j: number) => {
      const x0 = Math.max(0, i - R), x1 = Math.min(W, i + R + 1), y0 = Math.max(0, j - R), y1 = Math.min(H, j + R + 1);
      return (sum[y1 * (W + 1) + x1] - sum[y0 * (W + 1) + x1] - sum[y1 * (W + 1) + x0] + sum[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
    };

    const pos = new Float32Array(N * 3);
    const uv = new Float32Array(N * 2);
    const ao = new Float32Array(N);
    const fadeA = new Float32Array(N);
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++) {
        const k = j * W + i;
        const [x, z] = this.toXZ(l0 + ((l1 - l0) * i) / (W - 1), a0 + ((a1 - a0) * j) / (H - 1));
        // Fade out towards the edges of the grid, so the map has no cut-off walls.
        const edge = Math.min(i, W - 1 - i, j, H - 1 - j) / (H * 0.18);
        const fade = edge >= 1 ? 1 : edge * edge * (3 - 2 * edge);
        pos.set([x, hd[k] * M * fade, z], k * 3);
        uv.set([i / (W - 1), j / (H - 1)], k * 2);
        ao[k] = 1 - Math.min(0.3, Math.max(0, around(i, j) - Math.max(0, hd[k])) / 1400);
        fadeA[k] = fade;
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
    g.setAttribute("aUv", new THREE.BufferAttribute(uv, 2));
    g.setAttribute("aAO", new THREE.BufferAttribute(ao, 1));
    g.setAttribute("aFade", new THREE.BufferAttribute(fadeA, 1));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();

    // Textures: detailed heights (half floats, filtered), regions (exact values), colour ramp.
    const half = new Uint16Array(DW * DH);
    for (let k = 0; k < half.length; k++) half[k] = THREE.DataUtils.toHalfFloat(detail[k]);
    const heightTex = (this.heightTex = new THREE.DataTexture(half, DW, DH, THREE.RedFormat, THREE.HalfFloatType));
    heightTex.magFilter = heightTex.minFilter = THREE.LinearFilter;
    heightTex.needsUpdate = true;
    const regionTex = (this.regionTex = new THREE.DataTexture(new Uint8Array(this.regionGrid), W, H, THREE.RedFormat, THREE.UnsignedByteType));
    regionTex.magFilter = regionTex.minFilter = THREE.NearestFilter;
    regionTex.needsUpdate = true;
    const factorTex = (this.factorTex = new THREE.DataTexture(Uint8Array.from(this.factor, (v) => Math.round(v * 255)), W, H, THREE.RedFormat, THREE.UnsignedByteType));
    factorTex.magFilter = factorTex.minFilter = THREE.LinearFilter;
    factorTex.needsUpdate = true;
    this.textures.push(factorTex);
    const ramp = rampTexture();
    this.textures.push(heightTex, regionTex, ramp);

    const cellM = new THREE.Vector2((((l1 - l0) / (DW - 1)) * 111_000 * K), (((a0 - a1) / (DH - 1)) * 111_000));
    const order = this.meta.regions;
    const m = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.93, metalness: 0 });
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms, {
        uHeight: { value: heightTex },
        uRegion: { value: regionTex },
        uFactor: { value: factorTex },
        uRamp: { value: ramp },
        uSat: { value: this.satellite },
        uPatch: this.patchUniforms.uPatch,
        uPatchRect: this.patchUniforms.uPatchRect,
        uPatchMix: this.patchUniforms.uPatchMix,
        uTexel: { value: new THREE.Vector2(1 / DW, 1 / DH) },
        uCellM: { value: cellM },
        uLon: { value: new THREE.Vector2(l0, l1) },
        uLat: { value: new THREE.Vector2(a0, a1) },
        uRegionColors: { value: order.map((id) => linear(REGION_COLORS[id])) },
        uZone: { value: ZONES.map((z) => zone(z.id)) },
        uClimate: { value: CLIMATES.map((c) => climate(c.id)) },
      });
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec2 aUv;\nattribute float aAO;\nattribute float aFade;\nvarying vec2 vTUv;\nvarying float vAO;\nvarying float vFade;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTUv = aUv;\nvAO = aAO;\nvFade = aFade;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${TERRAIN_GLSL}`)
        .replace("#include <color_fragment>", `#include <color_fragment>\n${TERRAIN_COLOR}`)
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = normalize(mat3(viewMatrix) * terrainN);");
    };
    this.scene.add(new THREE.Mesh(g, m));
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
    const m = new THREE.MeshPhysicalMaterial({ color: "#3b7fb3", roughness: 0.18, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.88 });
    m.onBeforeCompile = (shader) => {
      const { lon: [ml0, ml1], lat: [ma0, ma1] } = this.meta;
      Object.assign(shader.uniforms, this.uniforms, {
        uSize: { value: new THREE.Vector2(w / 2, d / 2) },
        uHeight: { value: this.heightTex },
        uFactor: { value: this.factorTex },
        // World x/z → texture uv of the map grid.
        uToUv: { value: new THREE.Vector4(1 / (K * (ml1 - ml0)), (this.centreLon - ml0) / (ml1 - ml0), -1 / (ma1 - ma0), (this.centreLat - ma0) / (ma1 - ma0)) },
      });
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec2 uSize;\nuniform sampler2D uHeight;\nuniform sampler2D uFactor;\nuniform vec4 uToUv;\nvarying vec2 vSea;\nvarying vec2 vWorldXZ;")
        .replace(
          "#include <clipping_planes_fragment>",
          `#include <clipping_planes_fragment>
          // Water only where there really is sea: never over Georgia or land above sea level.
          vec2 suv = vec2(vWorldXZ.x * uToUv.x + uToUv.y, vWorldXZ.y * uToUv.z + uToUv.w);
          // (the smoothly filtered "Georgia" factor gives a clean, curved coastline)
          if (texture2D(uFactor, suv).r > 0.97 || texture2D(uHeight, suv).r > 1.0) discard;`,
        )
        .replace(
          "#include <opaque_fragment>",
          `#include <opaque_fragment>
          // Fade out at every edge, so the sea has no visible border.
          vec2 e = (uSize - abs(vSea)) / uSize;
          float fade = smoothstep(0.0, 0.3, e.y) * smoothstep(0.0, 0.25, (vSea.x + uSize.x) / uSize.x) * smoothstep(0.0, 0.2, (uSize.x - vSea.x) / uSize.x);
          gl_FragColor.a *= fade;`,
        );
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;\nvarying vec2 vSea;\nvarying vec2 vWorldXZ;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvSea = position.xz;\nvWorldXZ = (modelMatrix * vec4(position, 1.0)).xz;")
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float w1 = sin(position.x * 9.0 + uTime * 1.3) * cos(position.z * 7.0 - uTime * 0.9);
          float w2 = sin((position.x + position.z) * 17.0 - uTime * 1.9);
          transformed.y += (w1 * 0.6 + w2 * 0.4) * 0.0004;`,
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

  /**
   * A flat ribbon draped over the terrain along lon/lat points. Vertices sit on the centre line; `aSide`
   * holds the sideways offset, so a shader can widen the ribbon (a selected river).
   */
  private ribbon(points: number[][], width: (i: number) => number, lift: number, id = -1) {
    const pts: THREE.Vector3[] = [];
    const src: number[] = [];
    // Densify so the ribbon follows the ground between far-apart points.
    for (let i = 0; i < points.length - 1; i++) {
      const [lo0, la0] = points[i];
      const [lo1, la1] = points[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(lo1 - lo0, la1 - la0) / 0.006));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        pts.push(this.ground(lo0 + (lo1 - lo0) * t, la0 + (la1 - la0) * t, lift));
        src.push(i);
      }
    }
    const last = points[points.length - 1];
    pts.push(this.ground(last[0], last[1], lift));
    src.push(points.length - 1);
    const pos: number[] = [];
    const side: number[] = [];
    const uv: number[] = [];
    const rid: number[] = [];
    const idx: number[] = [];
    let dist = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const w = width(src[i]);
      const nx = (-dz / len) * w;
      const nz = (dx / len) * w;
      if (i > 0) dist += pts[i].distanceTo(pts[i - 1]);
      const p = pts[i];
      pos.push(p.x, p.y, p.z, p.x, p.y, p.z);
      side.push(nx, 0, nz, -nx, 0, -nz);
      uv.push(dist, 0, dist, 1);
      rid.push(id, id);
      if (i > 0) {
        const o = (i - 1) * 2;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aSide", new THREE.Float32BufferAttribute(side, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("aRiver", new THREE.Float32BufferAttribute(rid, 1));
    g.setIndex(idx);
    return g;
  }

  private borderGeometries = new Map<string, THREE.BufferGeometry>();
  /**
   * Lines draped on the ground keep about the same width on screen at any zoom, and their small lift above
   * the ground (needed from far away) shrinks as the camera comes close.
   */
  private lineMat(color: string, opacity: number, lift: number) {
    return new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uZoom: this.uniforms.uZoom, uLift: { value: lift } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
      vertexShader: `attribute vec3 aSide; uniform float uZoom; uniform float uLift;
        void main(){
          vec3 p = position + aSide * max(uZoom, 0.02);
          p.y -= uLift * (1.0 - uZoom);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: "uniform vec3 uColor; uniform float uOpacity; void main(){ gl_FragColor = vec4(uColor, uOpacity); }",
    });
  }
  private borderMat = this.lineMat("#ffffff", 0.75, 0.0035);

  private buildBorders(borders: Record<string, number[][][]>) {
    for (const [id, rings] of Object.entries(borders)) {
      const g = mergeGeometries(rings.map((ring) => this.ribbon(ring, () => 0.0022, 0.0035)));
      this.borderGeometries.set(id, g);
      const m = new THREE.Mesh(g, this.borderMat);
      m.renderOrder = 2;
      this.scene.add(m);
    }
  }

  /** Keeps the parts of a line inside Georgia (and its mouth when it reaches the sea). */
  private clip(line: number[][]) {
    const parts: number[][][] = [];
    let cur: number[][] = [];
    for (const p of line) {
      if (this.regionAt(p[0], p[1])) cur.push(p);
      else {
        if (cur.length && this.gridHeight(p[0], p[1], false) <= 0) cur.push(p);
        if (cur.length >= 4) parts.push(cur);
        cur = [];
      }
    }
    if (cur.length >= 4) parts.push(cur);
    return parts;
  }

  /** Rivers with water visibly flowing downstream; the selected named river widens and brightens. */
  private buildRivers(named: Record<string, number[][]>, minor: number[][][], real: Record<string, number[][][]>) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.uniforms.uTime, uSel: this.uniforms.uSelRiver, uZoom: this.uniforms.uZoom },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
      vertexShader: `attribute vec3 aSide; attribute float aRiver; uniform float uSel; uniform float uZoom; varying vec2 vUv; varying float vSel; varying float vMinor;
        void main(){
          vUv = uv;
          vSel = (aRiver > -0.5 && abs(aRiver - uSel) < 0.5) ? 1.0 : 0.0;
          vMinor = aRiver < -0.5 ? 1.0 : 0.0;
          vec3 p = position + aSide * (1.0 + vSel * 1.6) * max(uZoom, 0.03);
          p.y -= 0.0024 * (1.0 - uZoom);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `uniform float uTime; uniform float uSel; varying vec2 vUv; varying float vSel; varying float vMinor;
        void main(){
          float edge = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.65, vUv.y);
          float flow = 0.5 + 0.5 * sin(vUv.x * 160.0 - uTime * 3.0);
          vec3 c = mix(vec3(0.15, 0.45, 0.78), vec3(0.55, 0.8, 0.98), flow * 0.55);
          c = mix(c, vec3(0.05, 0.36, 0.86), vSel);
          float dim = (uSel > -0.5 && vSel < 0.5) ? 0.55 : 1.0;
          gl_FragColor = vec4(c, (vMinor > 0.5 ? 0.7 : 0.95) * edge * dim);
        }`,
    });
    const geos: THREE.BufferGeometry[] = [];
    this.riverIds = Object.keys(named);
    this.riverIds.forEach((id, n) => {
      // The real course from OpenStreetMap; the one traced from the terrain where OSM has none.
      const osm = real[id]?.length ? real[id] : null;
      const parts = osm ? osm.flatMap((l) => this.clip(l)) : this.clip(named[id]);
      this.riverParts.set(id, parts);
      const w = RIVER_WIDTH[id] ?? 0.003;
      for (const line of parts) geos.push(this.ribbon(line, () => w, 0.0026, n));
    });
    for (const line of minor) for (const part of this.clip(line)) geos.push(this.ribbon(part, () => 0.0015, 0.0024));
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
    mesh.renderOrder = 1;
    this.riverGroup.add(mesh);
  }

  /** A river's middle point (for its label) and the area it covers (for the camera). */
  riverInfo(id: string) {
    const parts = this.riverParts.get(id);
    if (!parts?.length) return null;
    const pts = parts.flat();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of pts) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const longest = parts.reduce((a, b) => (b.length > a.length ? b : a));
    const mid = longest[Math.floor(longest.length * 0.5)];
    return {
      label: { lon: mid[0], lat: mid[1] },
      focus: { lon: (minX + maxX) / 2, lat: (minY + maxY) / 2, span: Math.max(0.6, (maxX - minX) * K * 1.15), depth: Math.max(0.5, (maxY - minY) * 1.2) },
    };
  }

  // ---- Lakes --------------------------------------------------------------------------------------

  setLakes(lakes: (MapPoint & { area: number })[]) {
    if (!this.ready) {
      this.pendingLakes = lakes;
      return;
    }
    const mat = new THREE.MeshStandardMaterial({
      color: "#2a6ea6",
      roughness: 0.35,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    for (const l of lakes) {
      const rings = this.water.lakes[l.id] ?? [];
      let geometry: THREE.BufferGeometry;
      let lift: number;
      if (rings.length) {
        // The real shoreline, laid flat at the water level (the lower part of the shore's heights).
        const shapes = rings.map((ring) => new THREE.Shape(ring.map(([lon, lat]) => new THREE.Vector2(...this.toXZ(lon, lat)))));
        geometry = new THREE.ShapeGeometry(shapes, 4).rotateX(Math.PI / 2);
        const hs = rings.flat().map(([lon, lat]) => this.heightAt(lon, lat)).sort((x, y) => x - y);
        lift = hs[Math.floor(hs.length * 0.3)] * M + 0.0016;
      } else {
        const r = Math.sqrt(l.area / Math.PI) / 111;
        const [x, z] = this.toXZ(l.lon, l.lat);
        geometry = new THREE.CircleGeometry(Math.max(r, 0.006), 40).rotateX(-Math.PI / 2).translate(x, 0, z);
        lift = this.heightAt(l.lon, l.lat) * M + 0.0018;
      }
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.position.y = lift;
      mesh.userData.water = lift - 0.0017;
      mesh.renderOrder = 1;
      this.scene.add(mesh);
      // Centre and size for picking and labels.
      geometry.computeBoundingSphere();
      const c = geometry.boundingSphere!.center;
      mesh.userData.centre = new THREE.Vector3(c.x, lift, c.z);
      this.lakes.set(l.id, { mesh, lon: l.lon, lat: l.lat, r: geometry.boundingSphere!.radius, rings });
    }
    this.applyOverlays();
  }
  private pendingLakes: Parameters<GeorgiaScene["setLakes"]>[0] | null = null;

  // ---- Pins ---------------------------------------------------------------------------------------

  /** Where a peak's marker stands: the highest point within ~3 km of its listed coordinates. */
  peakPosition(id: string) {
    return this.snappedPeaks.get(id) ?? null;
  }

  /** City and peak markers: a thin needle with a ball, standing on the ground. */
  setPins(points: (MapPoint & { kind: "city" | "peak"; capital?: boolean })[]) {
    if (!this.ready) {
      this.pendingPins = points;
      return;
    }
    for (const g of this.pins.values()) this.scene.remove(g);
    this.pins.clear();
    for (const p of points) {
      let { lon, lat } = p;
      if (p.kind === "peak") {
        let best = -Infinity;
        for (let dy = -0.03; dy <= 0.03; dy += 0.003)
          for (let dx = -0.03; dx <= 0.03; dx += 0.003) {
            const h = this.gridHeight(p.lon + dx, p.lat + dy, false);
            if (h > best) {
              best = h;
              lon = p.lon + dx;
              lat = p.lat + dy;
            }
          }
        this.snappedPeaks.set(p.id, { lon, lat });
      }
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
      g.position.copy(this.ground(lon, lat));
      g.userData = { id: p.id, kind: p.kind, baseY: g.position.y };
      this.scene.add(g);
      this.pins.set(`${p.kind}:${p.id}`, g);
    }
    this.applyOverlays();
  }
  private pendingPins: Parameters<GeorgiaScene["setPins"]>[0] | null = null;

  // ---- Layers -------------------------------------------------------------------------------------

  setLayer(layer: MapLayer) {
    this.uniforms.uLayer.value = LAYER_INDEX[layer];
    // On coloured layers the white borders would vanish: draw them darker.
    const light = layer === "physical" || layer === "satellite";
    this.borderMat.uniforms.uColor.value.set(light ? "#ffffff" : "#33413e");
    this.borderMat.uniforms.uOpacity.value = light ? 0.7 : 0.55;
  }

  setOverlays(o: Overlays) {
    this.overlays = o;
    this.applyOverlays();
  }

  private applyOverlays() {
    this.riverGroup.visible = this.overlays.rivers;
    for (const l of this.lakes.values()) l.mesh.visible = this.overlays.lakes;
    for (const [key, g] of this.pins) g.visible = key.startsWith("city:") ? this.overlays.cities : this.overlays.peaks;
  }

  // ---- Selection & camera ------------------------------------------------------------------------

  select(sel: MapSelection, focus?: { lon: number; lat: number; span: number; depth?: number }) {
    this.uniforms.uSelected.value = sel?.kind === "region" ? this.meta?.regions.indexOf(sel.id) ?? -1 : -1;
    this.uniforms.uSelRiver.value = sel?.kind === "river" ? this.riverIds.indexOf(sel.id) : -1;
    this.selectedPin = sel && (sel.kind === "city" || sel.kind === "peak") ? `${sel.kind}:${sel.id}` : null;
    if (this.selectedBorder) {
      this.scene.remove(this.selectedBorder);
      this.selectedBorder = null;
    }
    if (sel?.kind === "region") {
      const g = this.borderGeometries.get(sel.id);
      if (g) {
        const hi = new THREE.Mesh(g, this.lineMat("#1d4f84", 1, 0.0035));
        hi.renderOrder = 3;
        this.selectedBorder = new THREE.Group().add(hi);
        this.scene.add(this.selectedBorder);
      }
    }
    if (focus) this.flyTo(focus.lon, focus.lat, focus.span, focus.depth);
  }

  /** Camera distance at which something `width`×`depth` units fills the view (any screen shape). */
  private fit(width: number, depth = width) {
    const v = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const h = Math.atan(Math.tan(v) * this.camera.aspect);
    // Seen from ~50° above, ground depth shrinks to about 0.78 of its size on screen.
    return Math.max(width / 2 / Math.tan(h), (depth * 0.78) / 2 / Math.tan(v)) * 1.06;
  }

  flyTo(lon: number, lat: number, span: number, depth = span) {
    if (!this.ready) return;
    const target = this.ground(lon, lat);
    const dist = Math.min(14, Math.max(0.35, this.fit(span, depth)));
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
    this.tween = { from: [this.controls.target.clone(), this.camera.position.clone()], to: [target, position], start: performance.now(), dur };
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
    const step = Math.max(0.002, this.camera.position.distanceTo(this.controls.target) / 600);
    for (let t = 0.05; t < 30; t += step) {
      p.copy(origin).addScaledVector(direction, t);
      const lon = p.x / K + this.centreLon;
      const lat = this.centreLat - p.z;
      if (p.y <= this.heightAt(lon, lat) * M) return { lon, lat };
    }
    return null;
  }

  private screen(v: THREE.Vector3, rect: DOMRect) {
    v.project(this.camera);
    return { x: ((v.x + 1) / 2) * rect.width + rect.left, y: ((1 - v.y) / 2) * rect.height + rect.top, z: v.z };
  }

  /** The nearest visible marker, lake or named river under the pointer (screen distance). */
  private pickThing(clientX: number, clientY: number): MapSelection {
    const rect = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector3();
    let best: MapSelection = null;
    let bestD = 18;
    for (const g of this.pins.values()) {
      if (!g.visible) continue;
      const s = this.screen(v.copy(g.position).add(new THREE.Vector3(0, 0.075 * this.zoomScale, 0)), rect);
      const d = Math.hypot(s.x - clientX, s.y - clientY);
      if (s.z < 1 && d < bestD) {
        bestD = d;
        best = { kind: g.userData.kind, id: g.userData.id };
      }
    }
    if (best) return best;
    if (this.overlays.lakes) {
      // A tap inside a lake's real outline selects it; small lakes also answer to a tap near them.
      const hit = this.pickGround(clientX, clientY);
      for (const [id, l] of this.lakes) if (hit && l.rings.some((r) => inRing(r, hit.lon, hit.lat))) return { kind: "lake", id };
      for (const [id, l] of this.lakes) {
        const c = this.screen(v.copy(l.mesh.userData.centre), rect);
        const e = this.screen(v.copy(l.mesh.userData.centre).add(new THREE.Vector3(l.r, 0, 0)), rect);
        const d = Math.hypot(c.x - clientX, c.y - clientY);
        if (c.z < 1 && d < 14 + Math.hypot(e.x - c.x, e.y - c.y) * 0.3) return { kind: "lake", id };
      }
    }
    if (this.overlays.rivers) {
      let rd = 6;
      for (const [id, parts] of this.riverParts)
        for (const pts of parts)
          for (let i = 0; i < pts.length; i += 2) {
          const s = this.screen(this.ground(pts[i][0], pts[i][1]), rect);
          const d = Math.hypot(s.x - clientX, s.y - clientY);
          if (s.z < 1 && d < rd) {
              rd = d;
              best = { kind: "river", id };
            }
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
    const thing = this.pickThing(e.clientX, e.clientY);
    if (thing) return this.callbacks.onSelect(thing);
    const hit = this.pickGround(e.clientX, e.clientY);
    const r = hit ? this.regionAt(hit.lon, hit.lat) : 0;
    this.callbacks.onSelect(r ? { kind: "region", id: this.meta.regions[r - 1] } : null);
  };

  private lastHover = 0;
  private onPointerMove = (e: PointerEvent) => {
    if (e.buttons || performance.now() - this.lastHover < 50) return;
    this.lastHover = performance.now();
    const hit = this.pickGround(e.clientX, e.clientY);
    const r = hit ? this.regionAt(hit.lon, hit.lat) : 0;
    this.uniforms.uHover.value = r - 1;
    this.canvas.style.cursor = r ? "pointer" : "";
    this.callbacks.onHover(hit ? { lon: hit.lon, lat: hit.lat, height: Math.round(this.gridHeight(hit.lon, hit.lat, false)), region: r ? this.meta.regions[r - 1] : null } : null);
  };

  private onPointerLeave = () => {
    this.uniforms.uHover.value = -1;
    this.callbacks.onHover(null);
  };

  setHoverRegion(id: string | null) {
    if (this.meta) this.uniforms.uHover.value = id ? this.meta.regions.indexOf(id) : -1;
  }

  // ---- Navigation buttons -------------------------------------------------------------------------

  private orbit(dTheta: number, dPhi: number, zoom: number) {
    if (!this.ready) return;
    const t = this.controls.target.clone();
    const off = this.camera.position.clone().sub(t);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta += dTheta;
    sph.phi = THREE.MathUtils.clamp(sph.phi + dPhi, this.controls.minPolarAngle, this.controls.maxPolarAngle);
    sph.radius = THREE.MathUtils.clamp(sph.radius * zoom, this.controls.minDistance, this.controls.maxDistance);
    this.startTween(t, t.clone().add(new THREE.Vector3().setFromSpherical(sph)), this.reduceMotion ? 1 : 450);
  }
  zoomIn() {
    this.orbit(0, 0, 0.55);
  }
  zoomOut() {
    this.orbit(0, 0, 1.8);
  }
  turn(dir: 1 | -1) {
    this.orbit((dir * Math.PI) / 8, 0, 1);
  }
  tilt(dir: 1 | -1) {
    this.orbit(0, (dir * Math.PI) / 14, 1);
  }
  /** Turn so north is up again (keeps distance and tilt). */
  north() {
    const off = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    this.orbit(-sph.theta, 0, 1);
  }
  /** Compass heading of the view in degrees (0 = looking north). */
  heading() {
    const off = this.camera.position.clone().sub(this.controls.target);
    return THREE.MathUtils.radToDeg(Math.atan2(off.x, off.z));
  }

  // ---- Sharp imagery around the camera -----------------------------------------------------------

  private tiles = new Map<string, Promise<HTMLImageElement | null>>();
  private patchKey = "";
  private patchTimer = 0;
  private patchFade = 0;

  private tile(z: number, row: number, col: number) {
    const key = `${z}/${row}/${col}`;
    let t = this.tiles.get(key);
    if (!t) {
      t = new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024/default/WGS84/${z}/${row}/${col}.jpg`;
      });
      this.tiles.set(key, t);
      if (this.tiles.size > 400) this.tiles.delete(this.tiles.keys().next().value!);
    }
    return t;
  }

  /** When the camera comes close and stops, load Sentinel-2 tiles (down to ~10 m per pixel) for the area in view. */
  private updatePatch() {
    const dist = this.camera.position.distanceTo(this.controls.target);
    if (dist > 1.6 || this.uniforms.uLayer.value !== 4) {
      this.patchFade = 0;
      return;
    }
    const t = this.controls.target;
    const lon = t.x / K + this.centreLon;
    const lat = this.centreLat - t.z;
    // Area in view (degrees of latitude), widened for tilted views.
    const span = THREE.MathUtils.clamp(dist * 1.5, 0.05, 2);
    const z = THREE.MathUtils.clamp(Math.floor(Math.log2((180 * 5) / (span / K))), 9, 13);
    const ts = 180 / 2 ** z;
    const c0 = Math.floor((lon - span / K + 180) / ts);
    const c1 = Math.floor((lon + span / K + 180) / ts);
    const r0 = Math.floor((90 - (lat + span)) / ts);
    const r1 = Math.floor((90 - (lat - span)) / ts);
    const key = `${z}:${c0}:${c1}:${r0}:${r1}`;
    if (key === this.patchKey) return;
    this.patchKey = key;
    const jobs: Promise<void>[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = (c1 - c0 + 1) * 256;
    canvas.height = (r1 - r0 + 1) * 256;
    const ctx = canvas.getContext("2d")!;
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        jobs.push(
          this.tile(z, r, c).then((img) => {
            if (img) ctx.drawImage(img, (c - c0) * 256, (r - r0) * 256);
          }),
        );
    void Promise.all(jobs).then(() => {
      if (this.disposed || this.patchKey !== key) return;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      this.patchUniforms.uPatch.value?.dispose();
      this.patchUniforms.uPatch.value = tex;
      this.patchUniforms.uPatchRect.value.set(c0 * ts - 180, 90 - r0 * ts, (c1 + 1) * ts - 180, 90 - (r1 + 1) * ts);
      this.patchUniforms.uPatchMix.value = 0;
      this.patchFade = 1;
    });
  }

  // ---- 3D buildings ------------------------------------------------------------------------------

  private cityList: MapPoint[] = [];
  private buildings = new Map<string, THREE.Mesh | null>();
  private buildingGroup = new THREE.Group();

  setCities(cities: MapPoint[]) {
    this.cityList = cities;
  }

  /** Buildings of the nearest city appear when the camera comes close to it (loaded once, on demand). */
  private updateBuildings() {
    const dist = this.camera.position.distanceTo(this.controls.target);
    if (dist > 0.8) return;
    const t = this.controls.target;
    const lon = t.x / K + this.centreLon;
    const lat = this.centreLat - t.z;
    for (const c of this.cityList) {
      if (this.buildings.has(c.id) || Math.hypot((c.lon - lon) * K, c.lat - lat) > 0.25) continue;
      this.buildings.set(c.id, null);
      void fetch(`${BASE}/buildings/${c.id}.json?v=${GEO_VERSION}`)
        .then((r) => (r.ok ? (r.json() as Promise<{ c: [number, number]; b: number[][] }>) : null))
        .then((d) => {
          if (!d || this.disposed) return;
          const mesh = this.buildingMesh(d.c[0], d.c[1], d.b);
          this.buildings.set(c.id, mesh);
          this.buildingGroup.add(mesh);
        })
        .catch(() => {});
    }
  }

  /** Extruded footprints: walls in light plaster tones, roofs a little darker; heights ×2 so they read. */
  private buildingMesh(lon0: number, lat0: number, list: number[][]) {
    const kx = K / (111_320 * Math.cos((lat0 * Math.PI) / 180));
    const kz = 1 / 110_540;
    const [cx, cz] = this.toXZ(lon0, lat0);
    const BH = 2 / 111_000;
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    const roof = new THREE.Color();
    const WALLS = ["#e9e3d6", "#ddd6c8", "#f1ece2", "#d8d2c8", "#e6dccb", "#cfc9c1"];
    const ROOFS = ["#9b5b45", "#8a8580", "#a86a4e", "#77736e", "#b0a89c"];
    for (const b of list) {
      const h = b[0];
      const n = (b.length - 1) / 2;
      if (n < 3) continue;
      const pts: THREE.Vector2[] = [];
      let minY = Infinity;
      for (let i = 0; i < n; i++) {
        const x = cx + b[1 + i * 2] * kx;
        const z = cz - b[2 + i * 2] * kz;
        pts.push(new THREE.Vector2(x, z));
        const gy = this.heightAt(x / K + this.centreLon, this.centreLat - z) * M;
        if (gy < minY) minY = gy;
      }
      const base = minY - 0.00015;
      const top = minY + h * BH;
      const seed = Math.abs(Math.sin(b[1] * 12.9898 + b[2] * 78.233) * 43758.5453) % 1;
      c.set(WALLS[Math.floor(seed * WALLS.length)]);
      roof.set(h < 12 ? ROOFS[Math.floor(seed * 7) % ROOFS.length] : "#a7a29a");
      for (let i = 0; i < n; i++) {
        const a = pts[i];
        const d = pts[(i + 1) % n];
        pos.push(a.x, base, a.y, d.x, base, d.y, d.x, top, d.y, a.x, base, a.y, d.x, top, d.y, a.x, top, a.y);
        for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b);
      }
      for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(pts, [])) {
        for (const q of [pts[i], pts[k], pts[j]]) {
          pos.push(q.x, top, q.y);
          col.push(roof.r, roof.g, roof.b);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }));
    mesh.frustumCulled = true;
    return mesh;
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
    this.v.copy(this.ground(lon, lat, lift * this.zoomScale)).project(this.camera);
    return {
      x: ((this.v.x + 1) / 2) * this.canvas.clientWidth,
      y: ((1 - this.v.y) / 2) * this.canvas.clientHeight,
      visible: this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1,
    };
  };

  private lastCam = new THREE.Vector3();
  /** 1 from far away, smaller when close: markers, lines and label offsets keep their size on screen. */
  private zoomScale = 1;

  /**
   * The point the camera turns around stays on the ground (so turning and zooming feel natural after
   * moving the map) and inside the map; the near and far planes follow the zoom so close views stay sharp.
   */
  private keepOnGround() {
    const t = this.controls.target;
    const minX = (this.meta.lon[0] + 0.3 - this.centreLon) * K;
    const maxX = (this.meta.lon[1] - 0.3 - this.centreLon) * K;
    const minZ = this.centreLat - (this.meta.lat[0] - 0.2);
    const maxZ = this.centreLat - (this.meta.lat[1] + 0.2);
    const shift = new THREE.Vector3(THREE.MathUtils.clamp(t.x, minX, maxX) - t.x, 0, THREE.MathUtils.clamp(t.z, minZ, maxZ) - t.z);
    const groundY = this.heightAt(t.x / K + this.centreLon, this.centreLat - t.z) * M;
    shift.y = (groundY - t.y) * (this.tween ? 0 : 0.25);
    if (shift.lengthSq() > 0) {
      t.add(shift);
      this.camera.position.add(shift);
    }
    // Never below the ground.
    const cp = this.camera.position;
    const under = this.heightAt(cp.x / K + this.centreLon, this.centreLat - cp.z) * M + 0.004;
    if (cp.y < under) cp.y = under;
    const dist = cp.distanceTo(t);
    const near = THREE.MathUtils.clamp(dist * 0.02, 0.0005, 0.05);
    if (Math.abs(near - this.camera.near) > near * 0.1) {
      this.camera.near = near;
      this.camera.far = Math.max(40, dist * 10);
      this.camera.updateProjectionMatrix();
    }
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const t = this.clock.getElapsedTime();
    if (!this.reduceMotion) this.uniforms.uTime.value = t;
    if (this.ready && this.pendingPins) {
      const p = this.pendingPins;
      this.pendingPins = null;
      this.setPins(p);
    }
    if (this.ready && this.pendingLakes) {
      const l = this.pendingLakes;
      this.pendingLakes = null;
      this.setLakes(l);
    }
    if (this.tween) {
      const k = Math.min(1, (performance.now() - this.tween.start) / this.tween.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      this.controls.target.lerpVectors(this.tween.from[0], this.tween.to[0], e);
      this.camera.position.lerpVectors(this.tween.from[1], this.tween.to[1], e);
      if (k >= 1) this.tween = null;
    }
    // Markers shrink as the camera comes closer, so they never cover the valleys; the selected one bobs.
    const zoom = (this.zoomScale = THREE.MathUtils.clamp(this.camera.position.distanceTo(this.controls.target) / 4.5, 0.004, 1));
    this.uniforms.uZoom.value = zoom;
    this.buildingGroup.visible = this.overlays.cities && this.camera.position.distanceTo(this.controls.target) < 0.9;
    for (const l of this.lakes.values()) l.mesh.position.y = l.mesh.userData.water + 0.0017 * zoom;
    for (const [key, g] of this.pins) {
      const sel = key === this.selectedPin;
      g.position.y = g.userData.baseY + (sel && !this.reduceMotion ? (0.012 + 0.012 * Math.sin(t * 4)) * zoom : 0);
      g.scale.setScalar((sel ? 1.5 : 1) * zoom);
    }
    this.controls.update();
    if (this.ready) this.keepOnGround();
    // Sharp imagery: fade it in when loaded; look for a new patch once the camera has been still for a moment.
    const pm = this.patchUniforms.uPatchMix;
    pm.value += ((this.patchFade ? 1 : 0) - pm.value) * 0.12;
    const moving = this.camera.position.distanceToSquared(this.lastCam) > 1e-10;
    this.lastCam.copy(this.camera.position);
    if (moving) {
      clearTimeout(this.patchTimer);
      this.patchTimer = window.setTimeout(() => {
        this.updatePatch();
        this.updateBuildings();
      }, 300);
    }
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
    for (const t of this.textures) t.dispose();
    clearTimeout(this.patchTimer);
    this.patchUniforms.uPatch.value?.dispose();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
