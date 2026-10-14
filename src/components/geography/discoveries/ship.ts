import * as THREE from "three";
import type { GlobePath } from "../globe/paths";

/*
 * The ship that sails the routes — a three-masted nao (carrack) of the Age of Discovery, like the
 * "Santa María" or the "Victoria": a lofted hull with a fore- and sterncastle, square sails on the fore and
 * main masts, a lateen sail on the mizzen and a pennant in the voyage's colour. It is built from code and
 * its light is painted into the vertex colours, so the whole ship is a handful of small draw calls with no
 * lights or shadows — light enough for a smart board.
 *
 * One hull length = 1 unit; +z is the bow, +y is up (away from the Earth's centre), +x is the port side.
 * The ship is far bigger than life (it would be a speck otherwise), the way ships are drawn on old charts,
 * and keeps a readable size as the camera zooms.
 */

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const smooth = (x: number, a: number, b: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Light painted onto wood: brighter on top, a little sun from ahead and to port. */
const SUN = v(0.45, 0.6, 0.66).normalize();
const woodLight = (n: THREE.Vector3) => 0.5 + 0.32 * (0.5 + 0.5 * n.y) + 0.2 * Math.max(0, n.dot(SUN));
/** Light on canvas comes a little from the side, so the belly of a sail shades from bright to dim. */
const CLOTH_SUN = v(0.45, 0.5, 0.74).normalize();
const clothLight = (n: THREE.Vector3) => 0.6 + 0.42 * Math.max(0, n.dot(CLOTH_SUN));

const WOOD = {
  bottom: new THREE.Color("#2b2723"),
  plank: new THREE.Color("#9a683c"),
  wale: new THREE.Color("#3d2c20"),
  castle: new THREE.Color("#ad5630"),
  rail: new THREE.Color("#5e3e26"),
  deck: new THREE.Color("#d3b079"),
  mast: new THREE.Color("#7a5634"),
  spar: new THREE.Color("#4e3826"),
  glass: new THREE.Color("#27313c"),
};

/** Flat-faced coloured triangles. */
class Mesher {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  private n = new THREE.Vector3();
  private ab = new THREE.Vector3();
  private ac = new THREE.Vector3();

  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: THREE.Color) {
    this.n.crossVectors(this.ab.subVectors(b, a), this.ac.subVectors(c, a));
    if (this.n.lengthSq() < 1e-13) return; // collapsed (a step in the deck has many of these)
    const s = woodLight(this.n.normalize());
    for (const p of [a, b, c]) {
      this.pos.push(p.x, p.y, p.z);
      this.col.push(color.r * s, color.g * s, color.b * s);
    }
  }

  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: THREE.Color) {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** A tapered spar from a to b. */
  spar(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, color: THREE.Color, sides = 6) {
    const axis = b.clone().sub(a).normalize();
    const e1 = axis.clone().cross(Math.abs(axis.y) < 0.9 ? v(0, 1, 0) : v(1, 0, 0)).normalize();
    const e2 = axis.clone().cross(e1);
    const at = (p: THREE.Vector3, r: number, k: number) => {
      const t = (k / sides) * Math.PI * 2;
      return p.clone().addScaledVector(e1, Math.cos(t) * r).addScaledVector(e2, Math.sin(t) * r);
    };
    for (let k = 0; k < sides; k++) this.quad(at(a, r0, k), at(a, r0, k + 1), at(b, r1, k + 1), at(b, r1, k), color);
    for (let k = 1; k < sides - 1; k++) this.tri(at(b, r1, 0), at(b, r1, k), at(b, r1, k + 1), color);
  }

  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: THREE.Color) {
    const p = (i: number) => v(i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0);
    this.quad(p(1), p(3), p(7), p(5), color); // +x
    this.quad(p(0), p(4), p(6), p(2), color); // −x
    this.quad(p(2), p(6), p(7), p(3), color); // +y
    this.quad(p(0), p(1), p(5), p(4), color); // −y
    this.quad(p(4), p(5), p(7), p(6), color); // +z
    this.quad(p(0), p(2), p(3), p(1), color); // −z
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

// ---- Hull ---------------------------------------------------------------------------------------------------------

const HALF_BEAM = 0.17;
const RAIL = 0.024;

/** Half a cross-section (the port side) at u (0 stern … 1 stem): keel → bilge → side → rail → deck centre. */
function section(u: number, castle: number) {
  const z = u - 0.5;
  const bow = u > 0.5 ? (1 - ((u - 0.5) / 0.5) ** 2.4) ** 0.55 : 1;
  const stern = 0.62 + 0.38 * smooth(u, 0, 0.3);
  const b = Math.max(0.012, HALF_BEAM * bow * stern);
  const sheer = 0.1 + 0.045 * (2 * u - 1) ** 2;
  const top = sheer + castle;
  const side = 0.975 * b;
  const out = side * (1 - 0.5 * castle); // the castles lean in a little
  const inn = Math.max(out * 0.35, out - 0.02);
  return [
    v(0, -0.09, z),
    v(0.7 * b, -0.07, z),
    v(0.94 * b, 0, z),
    v(b, 0.5 * sheer, z),
    v(b, 0.5 * sheer + 0.022, z),
    v(side, sheer, z),
    v(out, top, z),
    v(out, top + RAIL, z),
    v(inn, top + RAIL, z),
    v(inn, top, z),
    v(0, top, z),
  ];
}
const SECTION_COLOURS = [WOOD.bottom, WOOD.bottom, WOOD.plank, WOOD.wale, WOOD.plank, WOOD.castle, WOOD.rail, WOOD.rail, WOOD.rail, WOOD.deck];

/** Stations along the hull; the same place twice with a different castle height makes a step in the deck. */
const STATIONS: [u: number, castle: number][] = [
  [0, 0.13], [0.06, 0.13], [0.13, 0.13], [0.13, 0.075], [0.21, 0.075], [0.29, 0.075], [0.29, 0],
  [0.38, 0], [0.47, 0], [0.56, 0], [0.65, 0], [0.73, 0], [0.79, 0],
  [0.79, 0.06], [0.85, 0.06], [0.9, 0.06], [0.94, 0.06], [0.97, 0.06], [0.99, 0.06], [1, 0.06],
];

const MAIN = -0.03;
const FORE = 0.31;
const MIZZEN = -0.34;
/** The yards are braced round (the wind is on the quarter), so the sails show from the side too. */
const BRACE = 0.56;

function buildHull() {
  const m = new Mesher();
  const mx = (p: THREE.Vector3) => v(-p.x, p.y, p.z);
  const rings = STATIONS.map(([u, c]) => section(u, c));
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    for (let j = 0; j < a.length - 1; j++) {
      m.quad(a[j], a[j + 1], b[j + 1], b[j], SECTION_COLOURS[j]);
      m.quad(mx(a[j]), mx(b[j]), mx(b[j + 1]), mx(a[j + 1]), SECTION_COLOURS[j]);
    }
  }
  // The flat stern (transom) and the stem.
  const stern = rings[0];
  const sternTop = v(0, stern[7].y, stern[7].z);
  const sc = v(0, 0.08, stern[0].z);
  const outline = [...stern.slice(0, 8), sternTop];
  for (let j = 0; j < outline.length - 1; j++) {
    const colour = j < 2 ? WOOD.bottom : j < 5 ? WOOD.plank : WOOD.castle;
    m.tri(sc, outline[j + 1], outline[j], colour);
    m.tri(sc, mx(outline[j]), mx(outline[j + 1]), colour);
  }
  const stem = rings[rings.length - 1];
  const bc = v(0, 0.08, stem[0].z);
  for (let j = 0; j < 7; j++) {
    m.tri(bc, stem[j], stem[j + 1], WOOD.plank);
    m.tri(bc, mx(stem[j + 1]), mx(stem[j]), WOOD.plank);
  }
  // Stern windows, rudder, hatch.
  for (const x of [-0.046, 0, 0.046]) m.quad(v(x - 0.014, 0.185, -0.502), v(x - 0.014, 0.225, -0.502), v(x + 0.014, 0.225, -0.502), v(x + 0.014, 0.185, -0.502), WOOD.glass);
  m.box(-0.007, 0.007, -0.09, 0.13, -0.535, -0.5, WOOD.wale);
  m.box(-0.045, 0.045, 0.1, 0.11, 0.06, 0.17, WOOD.wale);

  // Masts, the top (crow's nest), bowsprit.
  m.spar(v(0, 0.09, MAIN), v(0, 1, MAIN), 0.017, 0.008, WOOD.mast);
  m.spar(v(0, 0.17, FORE), v(0, 0.76, FORE), 0.014, 0.007, WOOD.mast);
  m.spar(v(0, 0.18, MIZZEN), v(0, 0.66, MIZZEN), 0.012, 0.007, WOOD.mast);
  m.spar(v(0, 0.2, 0.4), v(0, 0.37, 0.77), 0.012, 0.006, WOOD.mast);
  m.spar(v(0, 0.665, MAIN), v(0, 0.705, MAIN), 0.03, 0.043, WOOD.rail, 8);
  return m;
}

// ---- Sails ------------------------------------------------------------------------------------------------------------

interface Square {
  mast: number;
  foot: number;
  head: number;
  wFoot: number;
  wHead: number;
  belly: number;
}
const COURSE: Square = { mast: MAIN, foot: 0.2, head: 0.63, wFoot: 0.74, wHead: 0.78, belly: 0.12 };
const TOPSAIL: Square = { mast: MAIN, foot: 0.735, head: 0.94, wFoot: 0.5, wHead: 0.32, belly: 0.055 };
const FORESAIL: Square = { mast: FORE, foot: 0.27, head: 0.6, wFoot: 0.54, wHead: 0.57, belly: 0.09 };
/** How far ahead of the mast a yard hangs. */
const AHEAD = 0.03;

/** Point of a square sail, measured from its mast: s −0.5…0.5 across, t 0 (foot) … 1 (head, on the yard). */
function squarePoint(q: Square, s: number, t: number) {
  const round = 1 - 4 * s * s;
  const x = s * lerp(q.wFoot, q.wHead, t);
  const y = lerp(q.foot, q.head, t) + 0.03 * round * (1 - t) ** 2;
  const z = AHEAD + q.belly * round ** 0.8 * (1 - t ** 2.5) * (0.55 + 0.45 * Math.sin(Math.PI * t));
  return v(x, y, z);
}

/** The lateen: its yard runs from the tack (low, forward) to the peak (high, aft); the clew is sheeted to the stern. */
const TACK = v(0.02, 0.25, -0.19);
const PEAK = v(0.02, 0.76, -0.52);
const CLEW = v(0, 0.31, -0.5);
function lateenPoint(a: number, b: number) {
  const p = TACK.clone().lerp(PEAK, a).lerp(CLEW, b);
  p.x += 0.065 * Math.sin(Math.PI * a) * Math.sin(Math.PI * b);
  return p;
}

/** Texture regions (u0, v0, u1, v1): sailcloth, white (the pennant and the wood, which carry their own colour). */
const UV_CLOTH: [number, number, number, number] = [131 / 256, 0.03, 229 / 256, 0.97];
const UV_WHITE: [number, number, number, number] = [244 / 256, 0.5, 244 / 256, 0.5];

function sailTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const g = c.getContext("2d")!;
  const cloth = g.createLinearGradient(0, 0, 0, 128);
  cloth.addColorStop(0, "#f6efdc");
  cloth.addColorStop(1, "#e2d5b7");
  g.fillStyle = cloth;
  g.fillRect(0, 0, 232, 128);
  // Seams between the cloths, a reef band.
  g.strokeStyle = "rgba(112, 92, 62, 0.3)";
  g.lineWidth = 1;
  for (let x = 0; x <= 232; x += 16) {
    g.beginPath();
    g.moveTo(x + 0.5, 0);
    g.lineTo(x + 0.5, 128);
    g.stroke();
  }
  g.strokeStyle = "rgba(112, 92, 62, 0.22)";
  g.beginPath();
  g.moveTo(0, 96.5);
  g.lineTo(232, 96.5);
  g.stroke();
  g.fillStyle = "#ffffff";
  g.fillRect(232, 0, 24, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Canvas surfaces on a grid, shaded smoothly; `wave` makes them breathe (sails) or stream (the pennant). */
class Cloth {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly uv: number[] = [];
  readonly wave: number[] = [];
  readonly rate: number[] = [];

  /** Returns the range of vertices added: [first, count]. */
  add(
    point: (i: number, j: number) => THREE.Vector3,
    nu: number,
    nv: number,
    o: {
      uv: [number, number, number, number];
      /** Reverse the facing (the lit side is the other one). */
      flip?: boolean;
      /** How much a vertex moves (0…1 of `amp`) along its normal, or along `dir` if given. */
      weight?: (i: number, j: number) => number;
      amp?: number;
      dir?: THREE.Vector3;
      rate?: (i: number, j: number) => [number, number];
      colour?: THREE.Color;
    },
  ): [number, number] {
    const first = this.pos.length / 3;
    const P: THREE.Vector3[][] = [];
    for (let i = 0; i <= nu; i++) {
      P.push([]);
      for (let j = 0; j <= nv; j++) P[i].push(point(i, j));
    }
    const du = new THREE.Vector3();
    const dv = new THREE.Vector3();
    const N = P.map((row, i) =>
      row.map((_, j) => {
        du.subVectors(P[Math.min(nu, i + 1)][j], P[Math.max(0, i - 1)][j]);
        dv.subVectors(P[i][Math.min(nv, j + 1)], P[i][Math.max(0, j - 1)]);
        const n = new THREE.Vector3().crossVectors(du, dv);
        // A corner where the grid closes to a point (the clew of the lateen): face the way the rest does.
        if (n.lengthSq() < 1e-14) n.set(o.flip ? -1 : 1, 0, 0);
        return n.normalize().multiplyScalar(o.flip ? -1 : 1);
      }),
    );
    const put = (i: number, j: number) => {
      const p = P[i][j];
      const n = N[i][j];
      const s = o.colour ? 1 : clothLight(n);
      const c = o.colour;
      this.pos.push(p.x, p.y, p.z);
      this.col.push(c ? c.r : s, c ? c.g : s, c ? c.b : s);
      this.uv.push(lerp(o.uv[0], o.uv[2], i / nu), lerp(o.uv[1], o.uv[3], j / nv));
      const w = (o.weight?.(i, j) ?? 0) * (o.amp ?? 0);
      const d = o.dir ?? n;
      this.wave.push(d.x * w, d.y * w, d.z * w);
      const r = o.rate?.(i, j) ?? [1.6, p.y * 7];
      this.rate.push(r[0], r[1]);
    };
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const quad: [number, number][] = o.flip ? [[i, j], [i, j + 1], [i + 1, j + 1], [i + 1, j]] : [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
        for (const k of [0, 1, 2, 0, 2, 3]) put(quad[k][0], quad[k][1]);
      }
    }
    return [first, this.pos.length / 3 - first];
  }

  /** Wooden parts that move with the canvas (a yard with its sail) go in the same mesh. */
  solid(m: Mesher) {
    this.pos.push(...m.pos);
    this.col.push(...m.col);
    for (let i = 0; i < m.pos.length / 3; i++) {
      this.uv.push(UV_WHITE[0], UV_WHITE[1]);
      this.wave.push(0, 0, 0);
      this.rate.push(0, 0);
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("aWave", new THREE.Float32BufferAttribute(this.wave, 3));
    g.setAttribute("aRate", new THREE.Float32BufferAttribute(this.rate, 2));
    return g;
  }
}

/** The pennant streams from the main masthead, downwind. */
const PENNANT_FROM = v(0, 0.985, MAIN);
const PENNANT_DIR = v(0.44, 0, 0.9).normalize();
const PENNANT_SIDE = v(0.9, 0, -0.44).normalize();
const PENNANT_LENGTH = 0.34;

// ---- Wake ---------------------------------------------------------------------------------------------------------------

/** The wake is a ribbon laid on the sea along the route: rows from ahead of the bow to far astern (in hull lengths). */
const WAKE_ROWS = 24;
const WAKE_COLS = 5;
const WAKE_FROM = -0.85;
const WAKE_TO = 2.9;
const WAKE_HALF = 0.7;
/** Where each row lies, in hull lengths astern of amidships. */
const WAKE_AT = Array.from({ length: WAKE_ROWS + 1 }, (_, i) => lerp(WAKE_FROM, WAKE_TO, i / WAKE_ROWS));
/** Just above the sea (the route line runs a little higher). */
const SEA = 1.0012;

function wakeMaterial(time: { value: number }, way: { value: number }) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: time, uWay: way },
    vertexShader: /* glsl */ `
      attribute vec2 aSt;
      attribute float aLive;
      varying vec2 vSt;
      varying float vLive;
      void main() {
        vSt = aSt;
        vLive = aLive;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform float uWay;
      varying vec2 vSt; // x: across, y: along (0 amidships, + astern), in hull lengths
      varying float vLive;
      void main() {
        float x = abs(vSt.x);
        float y = vSt.y;
        // Foam along the waterline.
        float d = length(vec2(vSt.x / 0.25, (y + 0.02) / 0.63));
        float skirt = (1.0 - smoothstep(0.76, 1.0, d)) * (0.3 + 0.3 * uWay);
        // The bow wave: two arms opening from the stem.
        float s = y + 0.5;
        float arm = exp(-pow((x - (0.2 * (1.0 - exp(-s * 6.0)) + 0.12 * s)) / (0.02 + s * 0.028), 2.0)) * smoothstep(0.0, 0.25, s);
        // Churned water in the ship's track.
        float t = max(0.0, y - 0.45);
        float core = exp(-pow(x / (0.1 + 0.07 * t), 2.0)) * smoothstep(0.3, 0.55, y);
        float ripple = 0.84 + 0.1 * sin(s * 31.0 - uTime * 6.0 + x * 9.0) + 0.06 * sin(s * 13.0 - uTime * 3.1);
        float wake = (arm * 0.85 + core * 0.75) * ripple * exp(-max(0.0, s) * 0.75) * uWay * vLive;
        float a = max(skirt, wake) * (1.0 - smoothstep(2.3, 2.85, y));
        gl_FragColor = vec4(0.93, 0.97, 1.0, a);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---- The ship -----------------------------------------------------------------------------------------------------------

export class VoyageShip {
  /** The ship, posed on the globe. Add it and `wake` to the globe's `earth` group. */
  readonly group = new THREE.Group();
  readonly wake: THREE.Mesh;
  /** Hull length on the globe (in Earth radii), after the last `place`. */
  size = 0.17;

  private rig = new THREE.Group();
  /** The yards of the main and fore masts swing about their masts; the lateen and the pennant swap sides. */
  private yards: THREE.Group[] = [];
  private aft: THREE.Mesh;
  private pennant: [number, number];
  /** The side the sails are braced to (+1: their faces turn to port, −1: to starboard), and where the yards are now. */
  private tack = 1;
  private brace = BRACE;
  private time = { value: 0 };
  private way = { value: 0 };
  private wakePos: THREE.BufferAttribute;
  private wakeLive: THREE.BufferAttribute;
  private rowAt = WAKE_AT.map(() => new THREE.Vector3());
  private rowTo = WAKE_AT.map(() => new THREE.Vector3());
  private rowSide = WAKE_AT.map(() => new THREE.Vector3());
  private rowOn = new Float32Array(WAKE_AT.length);
  private port = new Float32Array(WAKE_AT.length);
  private starboard = new Float32Array(WAKE_AT.length);
  private P = new THREE.Vector3();
  private A = new THREE.Vector3();
  private B = new THREE.Vector3();
  private up = new THREE.Vector3();
  private fwd = new THREE.Vector3();
  private left = new THREE.Vector3();
  private basis = new THREE.Matrix4();

  constructor() {
    const hull = buildHull();
    const lines: number[] = [];
    const line = (to: number[], a: THREE.Vector3, b: THREE.Vector3) => to.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const canvas = new THREE.MeshBasicMaterial({ map: sailTexture(), vertexColors: true, side: THREE.DoubleSide });
    canvas.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.time;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec3 aWave;\nattribute vec2 aRate;\nuniform float uTime;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed += aWave * sin(uTime * aRate.x - aRate.y);");
      // The windward side of a sail is in its own shade.
      sh.fragmentShader = sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb *= 0.8;");
    };
    const rope = new THREE.LineBasicMaterial({ color: "#2c2118", transparent: true, opacity: 0.7 });
    const ropes = (points: number[]) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
      return new THREE.LineSegments(g, rope);
    };

    // Square sails: each mast's yards, sails and their lines turn together about the mast.
    for (const mast of [MAIN, FORE]) {
      const cloth = new Cloth();
      const spars = new Mesher();
      const running: number[] = [];
      for (const q of [COURSE, TOPSAIL, FORESAIL]) {
        if (q.mast !== mast) continue;
        const nu = q === TOPSAIL ? 5 : 8;
        const nv = q === TOPSAIL ? 3 : 6;
        cloth.add((i, j) => squarePoint(q, i / nu - 0.5, j / nv), nu, nv, {
          uv: UV_CLOTH,
          // The head is laced to the yard and the clews are sheeted home; the belly breathes.
          weight: (i, j) => (1 - 4 * (i / nu - 0.5) ** 2) * (1 - (j / nv) ** 2),
          amp: q.belly * 0.13,
        });
        // The yard and its lifts to the masthead; the topsail is sheeted to the yard below.
        const half = q.wHead / 2 + 0.035;
        const yard = (x: number) => v(x, q.head + 0.008, AHEAD - 0.008);
        spars.spar(yard(0), yard(half), 0.0095, 0.005, WOOD.spar, 5);
        spars.spar(yard(0), yard(-half), 0.0095, 0.005, WOOD.spar, 5);
        const mastHead = v(0, q.head + (q === TOPSAIL ? 0.05 : 0.11), 0);
        for (const side of [-1, 1]) {
          line(running, yard(side * half), mastHead);
          if (q === TOPSAIL) line(running, squarePoint(q, side * 0.5, 0), v(side * (COURSE.wHead / 2 + 0.035), COURSE.head + 0.008, AHEAD));
        }
      }
      cloth.solid(spars);
      const group = new THREE.Group();
      group.position.z = mast;
      group.add(new THREE.Mesh(cloth.geometry(), canvas), ropes(running));
      this.yards.push(group);
    }

    // The lateen on the mizzen and the pennant: mirrored when the wind comes over the other side.
    const aft = new Cloth();
    aft.add((i, j) => lateenPoint(i / 6, j / 6), 6, 6, {
      uv: UV_CLOTH,
      flip: true,
      weight: (i, j) => Math.sin((Math.PI * i) / 6) * Math.sin((Math.PI * j) / 6),
      amp: 0.012,
    });
    const np = 9;
    this.pennant = aft.add(
      (i, j) => {
        const a = i / np;
        const p = PENNANT_FROM.clone().addScaledVector(PENNANT_DIR, a * PENNANT_LENGTH);
        p.y += (j - 0.5) * 0.06 * (1 - 0.8 * a) - 0.05 * a * a;
        return p;
      },
      np,
      1,
      { uv: UV_WHITE, colour: new THREE.Color("#ffffff"), weight: (i) => i / np, amp: 0.035, dir: PENNANT_SIDE, rate: (i) => [7.5, (i / np) * 6.5] },
    );
    const lateenYard = new Mesher();
    lateenYard.spar(TACK.clone().lerp(PEAK, -0.06), TACK.clone().lerp(PEAK, 1.05), 0.008, 0.004, WOOD.spar, 5);
    aft.solid(lateenYard);
    this.aft = new THREE.Mesh(aft.geometry(), canvas);

    // Standing rigging: shrouds to the rails, stays between the masts.
    for (const side of [-1, 1]) {
      for (const dz of [-0.02, -0.08, -0.14]) line(lines, v(0, 0.665, MAIN), v(side * 0.166, 0.125, MAIN + dz));
      for (const dz of [-0.02, -0.08]) line(lines, v(0, 0.6, FORE), v(side * 0.132, 0.205, FORE + dz));
      for (const dz of [-0.02, -0.07]) line(lines, v(0, 0.52, MIZZEN), v(side * 0.132, 0.215, MIZZEN + dz));
      line(lines, v(0, 0.95, MAIN), v(side * 0.16, 0.13, MAIN - 0.2));
    }
    line(lines, v(0, 0.62, FORE), v(0, 0.37, 0.77));
    line(lines, v(0, 0.98, MAIN), v(0, 0.76, FORE));
    line(lines, v(0, 0.64, MIZZEN), v(0, 0.36, MAIN));

    const wood = new THREE.Mesh(hull.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.rig.add(wood, ropes(lines), this.aft, ...this.yards);
    this.group.add(this.rig);
    // The ship turns with the route and her sails are moved in the shader: skip the per-mesh culling tests.
    this.rig.traverse((o) => (o.frustumCulled = false));

    const rows = WAKE_ROWS + 1;
    const st = new Float32Array(rows * WAKE_COLS * 2);
    const index: number[] = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < WAKE_COLS; j++) {
        st[(i * WAKE_COLS + j) * 2] = (j / (WAKE_COLS - 1) - 0.5) * 2 * WAKE_HALF;
        st[(i * WAKE_COLS + j) * 2 + 1] = WAKE_AT[i];
        if (i < WAKE_ROWS && j < WAKE_COLS - 1) {
          const a = i * WAKE_COLS + j;
          index.push(a, a + 1, a + WAKE_COLS, a + 1, a + WAKE_COLS + 1, a + WAKE_COLS);
        }
      }
    }
    const wake = new THREE.BufferGeometry();
    this.wakePos = new THREE.BufferAttribute(new Float32Array(rows * WAKE_COLS * 3), 3);
    this.wakeLive = new THREE.BufferAttribute(new Float32Array(rows * WAKE_COLS), 1);
    wake.setAttribute("position", this.wakePos);
    wake.setAttribute("aSt", new THREE.BufferAttribute(st, 2));
    wake.setAttribute("aLive", this.wakeLive);
    wake.setIndex(index);
    this.wake = new THREE.Mesh(wake, wakeMaterial(this.time, this.way));
    this.wake.frustumCulled = false;
    this.wake.renderOrder = 1;
  }

  /** The pennant flies the voyage's colour. */
  setColor(color: string) {
    const c = new THREE.Color(color);
    const col = this.aft.geometry.getAttribute("color") as THREE.BufferAttribute;
    for (let i = this.pennant[0]; i < this.pennant[0] + this.pennant[1]; i++) col.setXYZ(i, c.r, c.g, c.b);
    col.needsUpdate = true;
  }

  /** The masthead (for a label above the ship), in the globe's coordinates. */
  top(out: THREE.Vector3) {
    return out.copy(this.group.position).addScaledVector(this.up, this.size * 1.1);
  }

  /**
   * Put the ship `progress` (0…1) along the path. `length` is the path's length on the unit globe, `camera`
   * sets the ship's size and the side her sails show, `moving` raises the wake.
   */
  place(path: GlobePath, length: number, progress: number, camera: THREE.Camera, dt: number, moving: boolean) {
    const curve = path.curve;
    const k = clamp(progress, 0, 1);
    curve.getPointAt(k, this.P);
    // Readable from afar, not a giant up close.
    const size = clamp(0.09 * camera.position.distanceTo(this.P) ** 0.8, 0.095, 0.22);
    this.size = size;
    this.time.value += dt;
    this.way.value += ((moving ? 1 : 0) - this.way.value) * Math.min(1, dt * 2.5);
    const t = this.time.value;
    const way = this.way.value;

    // Heading: the chord under the hull, so the ship swings round a turn instead of snapping.
    const d = (0.3 * size) / length;
    curve.getPointAt(Math.min(1, k + d), this.A);
    curve.getPointAt(Math.max(0, k - d), this.B);
    this.up.copy(this.P).normalize();
    this.fwd.subVectors(this.A, this.B);
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up)).normalize();
    this.left.crossVectors(this.up, this.fwd);
    this.group.quaternion.setFromRotationMatrix(this.basis.makeBasis(this.left, this.up, this.fwd));
    // The sea falls away under the bow and stern, so the hull sits a touch low amidships.
    this.group.position.copy(this.up).multiplyScalar(1 - 0.008 * size);
    this.group.scale.setScalar(size);

    // The wind is put on the quarter that turns the sails' faces, not their edges, to the viewer — their
    // full, leeward faces if it can be; when the view passes to another quarter, the yards are braced round.
    const view = this.A.copy(camera.position).sub(this.group.position).normalize();
    const abeam = view.dot(this.left) * Math.sin(BRACE);
    const ahead = view.dot(this.fwd) * Math.cos(BRACE);
    const face = (tack: number) => Math.abs(ahead + tack * abeam) + 0.1 * Math.sign(ahead + tack * abeam);
    if (face(-this.tack) > face(this.tack) + 0.12) this.tack = -this.tack;
    this.brace += (this.tack * BRACE - this.brace) * Math.min(1, dt * 1.8);
    const lee = this.brace / BRACE;
    for (const y of this.yards) y.rotation.y = this.brace;
    this.aft.scale.x = Math.abs(lee) < 0.03 ? 0.03 : lee;

    // On the swell: heave, pitch and roll; under way she heels to leeward.
    const sea = 0.45 + 0.55 * way;
    this.rig.position.y = Math.sin(t * 1.7) * 0.012 * sea;
    this.rig.rotation.x = Math.sin(t * 1.25 + 0.8) * 0.032 * sea;
    this.rig.rotation.z = -0.06 * way * lee + Math.sin(t * 0.95) * 0.045 * sea;

    this.layWake(path, length, k, size);
  }

  /**
   * The ribbon of foam: round the hull it lies along her keel, astern it follows the route she has sailed.
   * Where the route turns sharply the ribbon is narrowed on the inside of the turn, so it never folds over.
   */
  private layWake(path: GlobePath, length: number, k: number, size: number) {
    const curve = path.curve;
    const rows = WAKE_AT.length;
    const at = k * length;
    const c = this.rowAt;
    const to = this.rowTo;
    const side = this.rowSide;
    for (let i = 0; i < rows; i++) {
      const astern = WAKE_AT[i] * size;
      c[i].copy(this.up).multiplyScalar(Math.cos(astern)).addScaledVector(this.fwd, -Math.sin(astern));
      const follow = smooth(WAKE_AT[i], 0.45, 1.3);
      this.rowOn[i] = 1;
      if (follow > 0) {
        const s = at - astern;
        curve.getPointAt(clamp(s / length, 0, 1), this.P);
        if (s < 0) {
          // No wake behind the port the ship has just left.
          this.P.addScaledVector(curve.getTangentAt(0, this.A), s);
          this.rowOn[i] = 0;
        }
        c[i].lerp(this.P.normalize(), follow);
      }
      c[i].normalize();
    }
    // Round off the corners of the route.
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 1; i < rows - 1; i++) to[i].copy(c[i - 1]).addScaledVector(c[i], 2).add(c[i + 1]).normalize();
      for (let i = 1; i < rows - 1; i++) c[i].lerp(to[i], smooth(WAKE_AT[i], 0.45, 1.3)).normalize();
    }
    for (let i = 0; i < rows; i++) {
      const ahead = this.A.subVectors(c[Math.max(0, i - 1)], c[Math.min(rows - 1, i + 1)]);
      ahead.addScaledVector(c[i], -ahead.dot(c[i])).normalize();
      side[i].crossVectors(c[i], ahead);
    }
    const half = WAKE_HALF * size;
    this.port.fill(half);
    this.starboard.fill(half);
    for (let i = 0; i < rows - 1; i++) {
      const back = this.A.subVectors(c[i + 1], c[i]);
      const step = back.length();
      const turn = this.B.subVectors(side[i + 1], side[i]).dot(back) / (step || 1);
      if (Math.abs(turn) < 1e-6) continue;
      const room = (0.85 * step) / Math.abs(turn);
      const edge = turn < 0 ? this.port : this.starboard;
      edge[i] = Math.min(edge[i], room);
      edge[i + 1] = Math.min(edge[i + 1], room);
    }
    const pos = this.wakePos;
    const live = this.wakeLive;
    for (let i = 0; i < rows; i++) {
      // Round a sharp turn the foam breaks up.
      this.rowOn[i] *= smooth(Math.min(this.port[i], this.starboard[i]) / half, 0.2, 0.75);
      for (let j = 0; j < WAKE_COLS; j++) {
        const x = (j / (WAKE_COLS - 1) - 0.5) * 2;
        const n = i * WAKE_COLS + j;
        this.P.copy(c[i]).addScaledVector(side[i], x * (x > 0 ? this.port[i] : this.starboard[i])).setLength(SEA);
        pos.setXYZ(n, this.P.x, this.P.y, this.P.z);
        live.setX(n, this.rowOn[i]);
      }
    }
    pos.needsUpdate = true;
    live.needsUpdate = true;
  }
}
