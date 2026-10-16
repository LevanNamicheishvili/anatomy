import * as THREE from "three";
import { latLonToVec3 } from "./coords";

/*
 * Place names on the globe, the way an atlas prints them: oceans and continents when the whole Earth is in view,
 * countries once they are big enough on screen to hold their name, cities as you zoom in. Every frame the names
 * are tried in order of importance and a name that would overlap one already placed waits (cities try the other
 * side of their dot first); names fade in and out. All of it is one draw call: the names are drawn once into a
 * texture and each is a small quad that stays upright and the same size on screen.
 */

export type LabelKind = "ocean" | "sea" | "lake" | "continent" | "country" | "capital" | "city";

export interface MapLabel {
  t: LabelKind;
  n: string;
  la: number;
  lo: number;
  /** Smallest zoom (screen pixels per degree at the centre of the view) at which the name may show. */
  z?: number;
  /** Largest zoom (continents give way to the countries). */
  x?: number;
  /** Countries: size in degrees; the name shows once it fits on the country. */
  s?: number;
  id?: string;
}

interface Style {
  size: number;
  weight: number;
  italic?: boolean;
  color: string;
  halo: string;
  spacing?: number;
}

const WATER_HALO = "rgba(4,20,46,0.8)";
const LAND_HALO = "rgba(0,0,0,0.78)";
const STYLE: Record<LabelKind, Style> = {
  ocean: { size: 14, weight: 500, italic: true, color: "#cfe6ff", halo: WATER_HALO, spacing: 2 },
  sea: { size: 12, weight: 500, italic: true, color: "#cfe6ff", halo: WATER_HALO, spacing: 0.5 },
  lake: { size: 11, weight: 500, italic: true, color: "#cfe6ff", halo: WATER_HALO },
  continent: { size: 16, weight: 700, color: "#fff4d6", halo: LAND_HALO, spacing: 2.5 },
  country: { size: 12.5, weight: 600, color: "#ffffff", halo: LAND_HALO, spacing: 0.3 },
  capital: { size: 12, weight: 600, color: "#ffffff", halo: LAND_HALO },
  city: { size: 11.5, weight: 500, color: "#eeeeee", halo: LAND_HALO },
};
/** Georgia and Tbilisi stand out. */
const HOME: Partial<Record<string, Style>> = {
  GEO: { size: 14, weight: 700, color: "#ffd76a", halo: LAND_HALO, spacing: 0.5 },
  Tbilisi: { size: 13, weight: 700, color: "#ffd76a", halo: LAND_HALO },
};

/** Labels sit this high above the ground (Earth radii): over the borders and the lesson's own lines. */
const LIFT = 0.01;
/** Names longer than this break onto two lines. */
const WRAP = 17;
/** A country's name shows once the country is this many times wider than the name… roughly: it may overhang. */
const FIT = 1.25;
/** Atlas texels per CSS pixel, at most (a bigger atlas costs memory on weak computers). */
const MAX_SCALE = 2;
/** Collision grid cell (CSS px). */
const CELL = 64;

type Dot = "city" | "capital" | "home";
/** Dot radius (style px) by kind. */
const DOT_R: Record<Dot, number> = { city: 2.6, capital: 3.8, home: 4.4 };

function wrap(name: string) {
  if (name.length <= WRAP || !name.includes(" ")) return [name];
  let best = -1;
  for (let i = name.indexOf(" "); i >= 0; i = name.indexOf(" ", i + 1)) if (best < 0 || Math.abs(i - name.length / 2) < Math.abs(best - name.length / 2)) best = i;
  return [name.slice(0, best), name.slice(best + 1)];
}

function fontOf(s: Style, family: string, px: number) {
  return `${s.italic ? "italic " : ""}${s.weight} ${px}px ${family}`;
}

/** Waits (briefly) for the page's fonts, so the names are drawn in the page's Georgian font. */
async function fontsReady(family: string) {
  if (!document.fonts) return;
  const load = Promise.all([document.fonts.load(`600 12px ${family}`, "ქართ"), document.fonts.load(`italic 500 12px ${family}`, "ქართ")]).catch(() => undefined);
  await Promise.race([load, new Promise((r) => setTimeout(r, 1500))]);
}

const VERTEX = /* glsl */ `
  attribute vec3 aAnchor;
  attribute vec4 aUv;
  attribute vec4 aRect;
  attribute float aAlpha;
  uniform vec2 uViewport;
  uniform float uZoom;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vAlpha = aAlpha;
    vUv = vec2(mix(aUv.x, aUv.z, position.x), mix(aUv.y, aUv.w, position.y));
    if (aAlpha < 0.004) {
      gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
      return;
    }
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(aAnchor, 1.0);
    // Whole device pixels, so the text stays sharp.
    vec2 px = floor((clip.xy / clip.w * 0.5 + 0.5) * uViewport + 0.5) + (aRect.xy + position.xy * aRect.zw) * uZoom;
    gl_Position = vec4((px / uViewport * 2.0 - 1.0) * clip.w, clip.z, clip.w);
  }`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vec4 c = texture2D(uAtlas, vUv);
    if (c.a * vAlpha < 0.01) discard;
    gl_FragColor = vec4(c.rgb, c.a * vAlpha);
  }`;

export class MapLabels {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private labels: MapLabel[];
  /** Per label: unit vector to the place (the globe's own coordinates). */
  private dir: Float32Array;
  /** Per label: index of its dot instance, or −1. */
  private dotOf: Int32Array;
  /** Per label: text size in CSS px (at the current size factor). */
  private boxW: Float32Array;
  private boxH: Float32Array;
  private dotR: Float32Array;
  /** Per label: placed this frame / which side of the dot (1 right, −1 left). */
  private placed: Uint8Array;
  private side: Int8Array;
  private hidden = new Set<number>();
  /** Kinds of name shown (null: all). */
  private kinds: ReadonlySet<LabelKind> | null = null;
  /** The continents' names stay at every zoom (when no country names take their place). */
  private continentsAlways = false;
  private hideNames = new Set<string>();
  // Per instance (text instances first, then dots).
  private alpha: Float32Array;
  private rect: Float32Array;
  private alphaAttr: THREE.InstancedBufferAttribute;
  private rectAttr: THREE.InstancedBufferAttribute;
  private uvAttr: THREE.InstancedBufferAttribute;
  private texture: THREE.CanvasTexture | null = null;
  /** Atlas texels per style px, and the size factor (bigger names on big screens). */
  private scale = 0;
  private ui = 1;
  private family = "sans-serif";
  private ready = false;
  private disposed = false;
  // Scratch.
  private mvp = new THREE.Matrix4();
  private centre = new THREE.Vector3();
  private grid = new Map<number, number[]>();
  private boxes: number[] = [];

  constructor(labels: MapLabel[], radius: number) {
    this.labels = labels;
    const n = labels.length;
    this.dir = new Float32Array(n * 3);
    this.dotOf = new Int32Array(n).fill(-1);
    this.boxW = new Float32Array(n);
    this.boxH = new Float32Array(n);
    this.dotR = new Float32Array(n);
    this.placed = new Uint8Array(n);
    this.side = new Int8Array(n).fill(1);
    let dots = 0;
    const v = new THREE.Vector3();
    labels.forEach((l, i) => {
      latLonToVec3(l.la, l.lo, 1, v).toArray(this.dir, i * 3);
      if (l.t === "city" || l.t === "capital") this.dotOf[i] = n + dots++;
    });
    const count = n + dots;
    this.alpha = new Float32Array(count);
    this.rect = new Float32Array(count * 4);
    const anchor = new Float32Array(count * 3);
    for (let i = 0; i < n; i++) {
      for (const k of [i, this.dotOf[i]]) {
        if (k < 0) continue;
        for (let c = 0; c < 3; c++) anchor[k * 3 + c] = this.dir[i * 3 + c] * radius * (1 + LIFT);
      }
    }

    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.setAttribute("aAnchor", new THREE.InstancedBufferAttribute(anchor, 3));
    this.uvAttr = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    this.rectAttr = new THREE.InstancedBufferAttribute(this.rect, 4).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.InstancedBufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aUv", this.uvAttr);
    geometry.setAttribute("aRect", this.rectAttr);
    geometry.setAttribute("aAlpha", this.alphaAttr);
    geometry.instanceCount = count;

    const material = new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: null }, uViewport: { value: new THREE.Vector2(1, 1) }, uZoom: { value: 1 } },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      // Over everything on the globe, as names are on a printed map (the far side is left out on the CPU).
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.name = "map-labels";
  }

  /** Names the lesson shows itself (its own labels): left out here. */
  setHidden(names: string[]) {
    this.hideNames = new Set(names);
    this.hidden.clear();
    this.labels.forEach((l, i) => this.hideNames.has(l.n) && this.hidden.add(i));
  }

  /** Only these kinds of name (null: all of them). */
  setKinds(kinds: ReadonlySet<LabelKind> | null) {
    this.kinds = kinds;
    this.continentsAlways = !!kinds && kinds.has("continent") && !kinds.has("country");
  }

  /** Canvas size changed: bigger names on a big screen (a smart board in full screen), redrawn sharp. */
  resize(cssW: number, cssH: number, dpr: number) {
    const u = this.mesh.material.uniforms;
    u.uViewport.value.set(Math.round(cssW * dpr), Math.round(cssH * dpr));
    const ui = THREE.MathUtils.clamp(Math.min(cssH / 620, cssW / 760), 1, 1.45);
    const scale = Math.min(MAX_SCALE, ui * dpr);
    u.uZoom.value = (ui * dpr) / scale;
    if (this.scale && Math.abs(scale - this.scale) / this.scale < 0.08) {
      this.ui = ui;
      this.measure();
      return;
    }
    this.ui = ui;
    this.scale = scale;
    void this.draw();
  }

  /** Draws every name into the atlas (again, when the scale changed). */
  private async draw() {
    const scale = this.scale;
    if (!this.ready) {
      this.family = getComputedStyle(document.body).fontFamily || "sans-serif";
      await fontsReady(this.family);
      if (this.disposed || scale !== this.scale) return;
    }
    const s = scale;
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return;
    // Measure and pack into shelves.
    type Cell = { x: number; y: number; w: number; h: number; lines: string[]; style: Style; dot?: Dot };
    const cells: Cell[] = [];
    const lineH = (st: Style) => Math.ceil(st.size * 1.25 * s);
    for (const l of this.labels) {
      const style = (l.id && HOME[l.id]) || STYLE[l.t];
      const lines = wrap(l.n);
      ctx.font = fontOf(style, this.family, style.size * s);
      ctx.letterSpacing = `${(style.spacing ?? 0) * s}px`;
      const pad = Math.ceil(3 * s);
      const w = Math.ceil(Math.max(...lines.map((t) => ctx.measureText(t).width)) + pad * 2);
      cells.push({ x: 0, y: 0, w, h: lineH(style) * lines.length + pad * 2, lines, style });
    }
    const dotCells: Record<Dot, Cell> = {
      city: { x: 0, y: 0, w: 0, h: 0, lines: [], style: STYLE.city, dot: "city" },
      capital: { x: 0, y: 0, w: 0, h: 0, lines: [], style: STYLE.capital, dot: "capital" },
      home: { x: 0, y: 0, w: 0, h: 0, lines: [], style: STYLE.capital, dot: "home" },
    };
    for (const d of Object.values(dotCells)) d.w = d.h = Math.ceil((DOT_R[d.dot!] + 1.5) * 2 * s);
    const all = [...cells, ...Object.values(dotCells)];
    const W = 2048;
    let x = 0;
    let y = 0;
    let row = 0;
    for (const c of [...all].sort((a, b) => b.h - a.h)) {
      if (x + c.w > W) {
        x = 0;
        y += row + 1;
        row = 0;
      }
      c.x = x;
      c.y = y;
      x += c.w + 1;
      row = Math.max(row, c.h);
    }
    const H = y + row + 1;
    ctx.canvas.width = W;
    ctx.canvas.height = H;

    // Draw: a dark halo under light text, readable over sea, desert and snow.
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    for (const c of cells) {
      const st = c.style;
      ctx.font = fontOf(st, this.family, st.size * s);
      ctx.letterSpacing = `${(st.spacing ?? 0) * s}px`;
      ctx.lineWidth = 3 * s;
      ctx.strokeStyle = st.halo;
      ctx.fillStyle = st.color;
      ctx.textAlign = "center";
      const pad = Math.ceil(3 * s);
      c.lines.forEach((t, k) => {
        // letterSpacing adds space after the last letter too: shift back by half of it.
        const cx = c.x + c.w / 2 + ((st.spacing ?? 0) * s) / 2;
        const cy = c.y + pad + lineH(st) * (k + 0.5);
        ctx.strokeText(t, cx, cy);
        ctx.fillText(t, cx, cy);
      });
    }
    for (const d of Object.values(dotCells)) {
      const r = DOT_R[d.dot!] * s;
      const cx = d.x + d.w / 2;
      const cy = d.y + d.h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 1.2 * s, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = d.dot === "home" ? "#ff4a3d" : "#ffffff";
      ctx.fill();
      if (d.dot !== "city") {
        // Capitals: a ring with a dark centre, as on a school map.
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.42, 0, Math.PI * 2);
        ctx.fillStyle = d.dot === "home" ? "#ffffff" : "#1c2430";
        ctx.fill();
      }
    }

    // Instance data.
    const uv = this.uvAttr.array as Float32Array;
    const setUv = (k: number, c: Cell) => {
      uv.set([c.x / W, 1 - (c.y + c.h) / H, (c.x + c.w) / W, 1 - c.y / H], k * 4);
    };
    this.labels.forEach((l, i) => {
      const c = cells[i];
      setUv(i, c);
      this.rect[i * 4 + 2] = c.w;
      this.rect[i * 4 + 3] = c.h;
      const d = this.dotOf[i];
      if (d >= 0) {
        const dc = l.id === "Tbilisi" ? dotCells.home : l.t === "capital" ? dotCells.capital : dotCells.city;
        setUv(d, dc);
        this.rect.set([-Math.floor(dc.w / 2), -Math.floor(dc.h / 2), dc.w, dc.h], d * 4);
        this.dotR[i] = DOT_R[dc.dot!];
      }
    });
    this.uvAttr.needsUpdate = true;
    this.rectAttr.needsUpdate = true;

    const texture = new THREE.CanvasTexture(ctx.canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    this.texture?.dispose();
    this.texture = texture;
    this.mesh.material.uniforms.uAtlas.value = texture;
    this.ready = true;
    this.measure();
  }

  /** Text boxes in CSS px for the current size factor. */
  private measure() {
    if (!this.ready) return;
    const k = this.ui / this.scale;
    for (let i = 0; i < this.labels.length; i++) {
      this.boxW[i] = this.rect[i * 4 + 2] * k;
      this.boxH[i] = this.rect[i * 4 + 3] * k;
    }
  }

  private hit(x: number, y: number, w: number, h: number) {
    const b = this.boxes;
    for (let gx = Math.floor(x / CELL); gx <= Math.floor((x + w) / CELL); gx++) {
      for (let gy = Math.floor(y / CELL); gy <= Math.floor((y + h) / CELL); gy++) {
        const list = this.grid.get(gx * 4096 + gy);
        if (!list) continue;
        for (const j of list) if (x < b[j + 2] && x + w > b[j] && y < b[j + 3] && y + h > b[j + 1]) return true;
      }
    }
    return false;
  }

  private take(x: number, y: number, w: number, h: number) {
    const j = this.boxes.length;
    this.boxes.push(x, y, x + w, y + h);
    for (let gx = Math.floor(x / CELL); gx <= Math.floor((x + w) / CELL); gx++) {
      for (let gy = Math.floor(y / CELL); gy <= Math.floor((y + h) / CELL); gy++) {
        const key = gx * 4096 + gy;
        const list = this.grid.get(key);
        if (list) list.push(j);
        else this.grid.set(key, [j]);
      }
    }
  }

  /**
   * Places the names for this frame. `earth` is the group the globe turns in (its world matrix is current),
   * `cssW`/`cssH` the canvas size, `dt` seconds since the last frame, `avoid` boxes (x, y, w, h in CSS px) where
   * the lesson has its own labels.
   */
  update(camera: THREE.PerspectiveCamera, earth: THREE.Object3D, cssW: number, cssH: number, dt: number, avoid: number[] = []) {
    if (!this.ready || !this.mesh.visible) return;
    this.mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).multiply(earth.matrixWorld);
    // Zoom: screen pixels per degree of the globe at the centre of the view.
    const focal = cssH / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const ppd = (focal / Math.max(0.05, camera.position.length() - 1)) * (Math.PI / 180);
    // The globe's disc on screen: names stay on it, not out in space.
    const c = this.centre.setFromMatrixPosition(earth.matrixWorld);
    const disc = focal * Math.tan(Math.asin(Math.min(1, 1 / Math.max(1.0001, camera.position.distanceTo(c)))));
    c.project(camera);
    const view = { cam: camera.position, m: earth.matrixWorld.elements, e: this.mvp.elements, ppd, cssW, cssH, cx: (c.x / 2 + 0.5) * cssW, cy: (0.5 - c.y / 2) * cssH, disc };
    this.grid.clear();
    this.boxes.length = 0;
    for (let k = 0; k < avoid.length; k += 4) this.take(avoid[k], avoid[k + 1], avoid[k + 2], avoid[k + 3]);
    const fade = Math.min(1, dt * 6);
    for (let i = 0; i < this.labels.length; i++) {
      const was = this.placed[i] === 1;
      const want = this.hidden.has(i) || (this.kinds && !this.kinds.has(this.labels[i].t)) ? 0 : this.place(i, was, view);
      this.placed[i] = want > 0 ? 1 : 0;
      const a = this.alpha[i] + (want - this.alpha[i]) * fade;
      this.alpha[i] = a < 0.01 && want === 0 ? 0 : a;
      const d = this.dotOf[i];
      if (d >= 0) this.alpha[d] = this.alpha[i];
    }
    this.alphaAttr.needsUpdate = true;
    this.rectAttr.needsUpdate = true;
  }

  /** Tries to place label `i`; returns how opaque it should be (0: not shown this frame). */
  private place(i: number, was: boolean, v: { cam: THREE.Vector3; m: number[]; e: number[]; ppd: number; cssW: number; cssH: number; cx: number; cy: number; disc: number }) {
    const l = this.labels[i];
    const ui = this.ui;
    const bw = this.boxW[i];
    const bh = this.boxH[i];
    // Zoom range, with a little slack once shown so that names do not flicker at the edge.
    const slack = was ? 0.9 : 1;
    const min = l.s !== undefined ? bw / (l.s * FIT) : (l.z ?? 0);
    if (v.ppd < min * slack || (l.x !== undefined && v.ppd > l.x / slack && !(this.continentsAlways && l.t === "continent"))) return 0;
    // Facing the camera: the world-space normal against the direction to the camera.
    const { m, e } = v;
    const dx = this.dir[i * 3];
    const dy = this.dir[i * 3 + 1];
    const dz = this.dir[i * 3 + 2];
    const wx = m[0] * dx + m[4] * dy + m[8] * dz;
    const wy = m[1] * dx + m[5] * dy + m[9] * dz;
    const wz = m[2] * dx + m[6] * dy + m[10] * dz;
    const tx = v.cam.x - wx;
    const ty = v.cam.y - wy;
    const tz = v.cam.z - wz;
    const facing = (wx * tx + wy * ty + wz * tz) / (Math.hypot(wx, wy, wz) * Math.hypot(tx, ty, tz));
    if (facing < (was ? 0.14 : 0.2)) return 0;
    // Where it lands on screen (CSS px).
    const r = 1 + LIFT;
    const w = (e[3] * dx + e[7] * dy + e[11] * dz) * r + e[15];
    const sx = (((e[0] * dx + e[4] * dy + e[8] * dz) * r + e[12]) / w / 2 + 0.5) * v.cssW;
    const sy = (0.5 - ((e[1] * dx + e[5] * dy + e[9] * dz) * r + e[13]) / w / 2) * v.cssH;
    if (sx < -bw || sx > v.cssW + bw || sy < -bh || sy > v.cssH + bh) return 0;

    const rect = this.rect;
    // Every corner of the box on the globe's disc, give or take the rim of the atmosphere.
    const edge = v.disc * 1.03 + 3 * ui;
    const reach = (x: number, y: number, w: number, h: number) => Math.hypot(Math.max(Math.abs(x - v.cx), Math.abs(x + w - v.cx)), Math.max(Math.abs(y - v.cy), Math.abs(y + h - v.cy)));
    const onDisc = (x: number, y: number, w: number, h: number) => reach(x, y, w, h) <= edge;
    const k = this.scale / ui;
    // Text boxes carry 3 px of padding round the letters; names may come within 1 px of each other's halo.
    const ins = 2 * ui;
    if (this.dotOf[i] < 0) {
      // Centred on the place. Ocean and continent names near the rim slide in towards the middle; Georgia's name
      // moves a line or two when its cities are in the way (others would land on a neighbour, so they wait).
      let ox = 0;
      let oy = 0;
      if (l.t === "ocean" || l.t === "continent") {
        const over = reach(sx - bw / 2, sy - bh / 2, bw, bh) - edge;
        const dx = sx - v.cx;
        const dy = sy - v.cy;
        const len = Math.hypot(dx, dy);
        if (over > 0 && over < 70 * ui && len > 1) {
          ox = (-dx / len) * over * 1.15;
          oy = (-dy / len) * over * 1.15;
        }
      }
      const gap = 3 * ui;
      const x = sx + ox - bw / 2 - gap;
      const step = l.id === "GEO" ? bh + 2 * ui : 0;
      let shift = NaN;
      for (const s of step ? [0, -step, step, -2 * step] : [0]) {
        const y = sy + oy - bh / 2 + s;
        if (!onDisc(x + gap, y, bw, bh) || this.hit(x, y + ins, bw + gap * 2, bh - ins * 2)) continue;
        this.take(x, y + ins, bw + gap * 2, bh - ins * 2);
        shift = s;
        break;
      }
      if (Number.isNaN(shift)) return 0;
      rect[i * 4] = -Math.floor(rect[i * 4 + 2] / 2) + Math.round(ox * k);
      rect[i * 4 + 1] = -Math.floor(rect[i * 4 + 3] / 2) - Math.round((oy + shift) * k);
    } else {
      // A city: its dot, and its name to the right of the dot, or else to the left.
      const dr = (this.dotR[i] + 1.5) * ui;
      if (this.hit(sx - dr, sy - dr, dr * 2, dr * 2)) return 0;
      // The text box has 3 px of padding; the letters start 1 px clear of the dot.
      const lead = dr - 3 * ui + 1;
      let side = 0;
      for (const s of [this.side[i], -this.side[i]]) {
        const x = s > 0 ? sx + lead : sx - lead - bw;
        if (!onDisc(x, sy - bh / 2, bw, bh) || this.hit(x + ins, sy - bh / 2 + ins, bw - ins * 2, bh - ins * 2)) continue;
        side = s;
        this.take(x + ins, sy - bh / 2 + ins, bw - ins * 2, bh - ins * 2);
        break;
      }
      if (!side) return 0;
      this.take(sx - dr, sy - dr, dr * 2, dr * 2);
      this.side[i] = side;
      rect[i * 4] = side > 0 ? Math.round(lead * k) : -Math.round(lead * k) - rect[i * 4 + 2];
      rect[i * 4 + 1] = -Math.floor(rect[i * 4 + 3] / 2);
    }
    return THREE.MathUtils.smoothstep(facing, 0.14, 0.4);
  }

  dispose() {
    this.disposed = true;
    this.texture?.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
