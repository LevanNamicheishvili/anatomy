"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { Play, RotateCcw, Trees } from "lucide-react";
import { LabeledSlider } from "@/components/portal/controls";
import { cn } from "@/lib/utils";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { ParticleCloud, fbm, hash01, noise2 } from "../fx/particles";
import { HAZARD_INFO, type HazardKind } from "./hazards-data";
import { evaluate, type SlopeInput } from "./slope-math";

/*
 * Topic 7 — a 3D slope you can tilt, soak and load with snow. "Check" runs the model: the soil, debris or
 * snow either holds (a small shudder) or goes down the slope and spreads over the valley floor.
 * The failure is staged like the real thing: cracks open at the head first, then the mass breaks away.
 *  - Landslide: the soil block breaks into rock and soil chunks that tumble under gravity and friction,
 *    leaving a raw scarp with visible soil strata; a brown dust cloud hangs over the debris.
 *  - Mudflow: a viscous, glossy brown slurry follows the gully with rippling surface, carrying boulders
 *    and logs, with a muddy splash at the front.
 *  - Avalanche: a dense snow slab breaks up and flows; a billowing powder cloud grows and outruns it.
 */

export const PRESETS: Record<HazardKind, SlopeInput> = {
  landslide: { angle: 28, water: 0.3, snow: 0, forest: false },
  mudflow: { angle: 22, water: 0.3, snow: 0, forest: false },
  avalanche: { angle: 38, water: 0, snow: 20, forest: false },
};

const D = Math.PI / 180;
const XMAX = 32;
const ZH = 6.5;
const FLOOR = -1.5;
const G = 11;
const T_REL = 0.55;
const GX = 100;
const GZ = 42;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const smax = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};
const smin = (a: number, b: number, k: number) => -smax(-a, -b, k);
const col = (hex: string) => new THREE.Color(hex);
const DUST_A = col("#a08462");
const DUST_B = col("#c9b290");
const MUD_BASE = col("#6e4c2d");
const MUD_LIGHT = col("#9a7650");
const MUD_DARK = col("#3b2a1a");
const SNOW_BASE = col("#f4f8fc");
const SNOW_LIGHT = col("#ffffff");
const SNOW_DARK = col("#c9d6e2");
const POWDER_A = col("#ffffff");
const POWDER_B = col("#e3ecf4");
const SPLASH_PUFF = col("#8a6d4c");
const SPLASH_DROP = col("#4a3524");
const RAIN_C = col("#5b95c4");

/* ------------------------------------------------------------------ slope description */

interface Prof {
  kind: HazardKind;
  run: number;
  topX: number;
  botX: number;
  hTop: number;
  /** The moving mass starts at A and is B long (along x). */
  A: number;
  B: number;
  xa: number;
  xb: number;
  zw: number;
  thick: number;
  ground: (x: number, z: number) => number;
  thickAt: (x: number, z: number) => number;
  gullyW: (x: number) => number;
}

function makeProf(kind: HazardKind, angle: number, snow: number): Prof {
  const t = Math.max(5, angle) * D;
  const tanT = Math.tan(t);
  const run = Math.min(16, 8.75 / tanT);
  const topX = 4;
  const hTop = run * tanT;
  const botX = topX + run;
  const u1 = kind === "mudflow" ? 0.05 : 0.12;
  const u2 = kind === "mudflow" ? 0.45 : 0.62;
  const A = topX + run * u1;
  const B = run * (u2 - u1);
  const xa = A;
  const xb = A + B;
  const zw = kind === "avalanche" ? 4.2 : 3.1;
  const thick = kind === "avalanche" ? 0.3 + snow * 0.009 : kind === "mudflow" ? 0.75 : 0.9;
  const k = Math.min(0.7, hTop * 0.5);
  const gullyW = (x: number) => 1.3 + 2.2 * smooth(botX - 1, botX + 7, x);
  const ground = (x: number, z: number) => {
    let h = smax(smin(hTop - tanT * (x - topX), hTop, k), 0, k);
    const onSlope = smooth(topX - 2, topX + 2, x) * (1 - smooth(botX - 1, botX + 4, x));
    h += (0.2 + 0.5 * onSlope) * fbm(x * 0.32 + 4.1, z * 0.32 + 1.7, 3) + 0.07 * noise2(x * 2.1, z * 2.1);
    if (kind === "mudflow") {
      const gd = 0.55 * smooth(topX - 1, topX + 1, x) * (1 - 0.85 * smooth(botX, botX + 8, x));
      h -= gd * Math.exp(-((z / gullyW(x)) ** 2));
    }
    return h;
  };
  const thickAt = (x: number, z: number) => {
    if (kind === "mudflow" || x < xa || x > xb || Math.abs(z) > zw) return 0;
    const n = 1 + 0.12 * noise2(x * 0.8 + 9, z * 0.8);
    if (kind === "landslide") return thick * n;
    const edge = Math.min(zw - Math.abs(z), xb - x) + 0.7 * noise2(x * 0.9, z * 0.9);
    return thick * n * smooth(0, 1.6, edge);
  };
  return { kind, run, topX, botX, hTop, A, B, xa, xb, zw, thick, ground, thickAt, gullyW };
}

/* ------------------------------------------------------------------ geometry helpers */

interface EdgePt {
  x: number;
  y: number;
  z: number;
  th: number;
}

/** Vertical wall hanging from a polyline, split into hard-edged colour bands (soil / snow strata). */
function skirt(pts: EdgePt[], colors: THREE.Color[], depthAt: (p: EdgePt, band: number) => number, floorY = -1e9) {
  const nb = colors.length;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  for (let b = 0; b < nb; b++) {
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const d0 = b === 0 ? 0 : depthAt(p, b - 1);
      const d1 = depthAt(p, b);
      const tint = 0.88 + 0.22 * (noise2(p.x * 1.7 + b * 3.1, p.z * 1.7 + p.y) * 0.5 + 0.5);
      c.copy(colors[b]).multiplyScalar(tint);
      pos.push(p.x, Math.max(floorY, p.y - d0), p.z, p.x, Math.max(floorY, p.y - d1), p.z);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const base = b * pts.length * 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function chunkGeo(kind: "rock" | "block") {
  const g = kind === "rock" ? new THREE.IcosahedronGeometry(1, 1) : new THREE.BoxGeometry(1, 0.55, 1, 2, 1, 2).toNonIndexed();
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (kind === "rock") {
      const n = 0.78 + 0.3 * (noise2(x * 2.3 + y * 1.7, z * 2.9 - y * 1.3) * 0.5 + 0.5) + 0.2 * noise2(z * 4.1, x * 3.7 + y);
      pos.setXYZ(i, x * n, y * n * 0.85, z * n);
    } else {
      pos.setXYZ(i, x + 0.14 * noise2(y * 3 + z * 2, x * 2.2), y + 0.1 * noise2(x * 3.1, z * 2.7), z + 0.14 * noise2(x * 2.6 + y, z * 3.3));
    }
  }
  g.computeVertexNormals();
  return g;
}

function treeGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (g: THREE.BufferGeometry, y: number, hex: string) => {
    g.translate(0, y, 0);
    const n = g.getAttribute("position").count;
    const c = col(hex);
    g.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [c.r, c.g, c.b]).flat(), 3));
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  add(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 5), 0.25, "#5b3a1e");
  add(new THREE.ConeGeometry(0.42, 1.0, 7), 0.85, "#2f6b34");
  add(new THREE.ConeGeometry(0.3, 0.8, 7), 1.45, "#3a7a3d");
  const merged = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return merged ?? new THREE.ConeGeometry(0.4, 1.5, 6);
}

/* ------------------------------------------------------------------ scene */

interface Chunks {
  n: number;
  px: Float32Array;
  py: Float32Array;
  pz: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  vz: Float32Array;
  wx: Float32Array;
  wy: Float32Array;
  wz: Float32Array;
  r: Float32Array;
  mu: Float32Array;
  rel: Float32Array;
  q: THREE.Quaternion[];
  sx: Float32Array;
  sy: Float32Array;
  sz: Float32Array;
}

interface TreeInfo {
  x: number;
  z: number;
  y: number;
  s: number;
  /** Landslide: index of the chunk it rides; avalanche: -2 means it rides the flow; −1 stays put. */
  carrier: number;
  off: THREE.Vector3;
}

class SlopeScene {
  onDone?: () => void;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1.7, 0.5, 200);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private io?: IntersectionObserver;
  private frame = 0;
  private disposed = false;
  private visible = true;
  private reduceMotion: boolean;
  private last = performance.now();
  private clock = 0;

  private world = new THREE.Group();
  private weather: ParticleCloud;
  private dust?: ParticleCloud;
  private powder?: ParticleCloud;
  private splash?: ParticleCloud;
  private dustLife: Float32Array;
  private dustAge: Float32Array;
  private dustV: Float32Array;
  private splashSt: Float32Array;

  private prof!: Prof;
  private input: SlopeInput = PRESETS.landslide;

  // terrain grid
  private gh = new Float32Array((GX + 1) * (GZ + 1));
  // sim state
  private t = -1;
  private running = false;
  private go = false;
  private dur = 5;
  private m = 0;
  private travel = 0;
  private crack = 0;
  private rnd = 12345;
  private acc = 0;
  private settle = 0;
  private flowDirty = true;

  // dynamic pieces (rebuilt with the terrain)
  private cover?: THREE.Group;
  private cracks: { mesh: THREE.Mesh; pts: { x: number; y: number; z: number }[]; w: number; onCover: boolean }[] = [];
  private flow?: THREE.Mesh;
  private flowNx = 96;
  private flowNz = 16;
  private flowX0 = 0;
  private flowX1 = 0;
  private chunks?: Chunks;
  private chunkMesh?: THREE.InstancedMesh;
  private logMesh?: THREE.InstancedMesh;
  private treeMesh?: THREE.InstancedMesh;
  private trees: TreeInfo[] = [];
  private items: { a: number; b: number; c: number; r: number }[] = [];
  private rockGeo = chunkGeo("rock");
  private blockGeo = chunkGeo("block");
  private treeG = treeGeo();
  private logGeo = new THREE.CylinderGeometry(0.07, 0.09, 1, 7).rotateZ(Math.PI / 2);
  private groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false });
  private wallMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  private chunkMat = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
  private mudMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.08 });
  private snowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  private treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  private crackMat = new THREE.MeshBasicMaterial({ color: "#1d130a", side: THREE.DoubleSide });
  private crackSnow = new THREE.MeshBasicMaterial({ color: "#7d8a96", side: THREE.DoubleSide });
  private logMat = new THREE.MeshStandardMaterial({ color: "#6b4a2b", roughness: 0.95, flatShading: true });

  private tmpM = new THREE.Matrix4();
  private tmpQ = new THREE.Quaternion();
  private tmpQ2 = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private tmpS = new THREE.Vector3();
  private tmpC = new THREE.Color();
  private tmpE = new THREE.Euler();

  constructor(
    private canvas: HTMLCanvasElement,
    private kind: HazardKind,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.scene.fog = new THREE.Fog("#e3f0f8", 38, 95);
    const sun = new THREE.DirectionalLight("#fff1d6", 2.4);
    sun.position.set(14, 20, 16);
    this.scene.add(new THREE.HemisphereLight("#dcecff", "#6b5a45", 1.2), sun, this.world);

    this.weather = new ParticleCloud(380, { soft: 0.6, order: 3 });
    this.scene.add(this.weather.points);
    if (kind === "landslide") this.dust = new ParticleCloud(150, { soft: 1, order: 4 });
    if (kind === "avalanche") this.powder = new ParticleCloud(240, { soft: 1, order: 4 });
    if (kind === "mudflow") this.splash = new ParticleCloud(80, { soft: 0.5, order: 4 });
    for (const c of [this.dust, this.powder, this.splash]) if (c) this.scene.add(c.points);
    this.dustLife = new Float32Array(150);
    this.dustAge = new Float32Array(150).fill(99);
    this.dustV = new Float32Array(150 * 3);
    this.splashSt = new Float32Array(80 * 7);

    this.camera.position.set(17, 9, 30);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(16, 2.6, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 46;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minAzimuthAngle = -Math.PI * 0.35;
    this.controls.maxAzimuthAngle = Math.PI * 0.35;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    if (typeof IntersectionObserver !== "undefined") {
      this.io = new IntersectionObserver((e) => (this.visible = e.some((x) => x.isIntersecting)));
      this.io.observe(canvas);
    }
    this.setInput(PRESETS[kind], false);
    this.resize();
    this.loop();
  }

  /* -------------------------------------------------- building */

  setInput(input: SlopeInput, triggered: boolean) {
    this.input = input;
    this.go = triggered;
    this.t = -1;
    this.running = false;
    this.m = 0;
    this.travel = 0;
    this.crack = 0;
    this.dur = triggered ? 5 : 2.2;
    this.dustAge.fill(99);
    this.splashSt.fill(0);
    this.flowDirty = true;
    this.settle = 0;
    this.build();
    this.updateEffects(0);
    this.updateWeather(0);
  }

  private clearWorld() {
    for (const o of [...this.world.children]) {
      this.world.remove(o);
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (m.geometry && m.geometry !== this.rockGeo && m.geometry !== this.blockGeo && m.geometry !== this.treeG && m.geometry !== this.logGeo) m.geometry.dispose();
        if ((c as THREE.InstancedMesh).isInstancedMesh) (c as THREE.InstancedMesh).dispose();
      });
    }
    this.cracks = [];
    this.cover = undefined;
    this.flow = undefined;
    this.chunks = undefined;
    this.chunkMesh = undefined;
    this.logMesh = undefined;
    this.treeMesh = undefined;
    this.trees = [];
    this.items = [];
  }

  private build() {
    this.clearWorld();
    const { kind, input } = { kind: this.kind, input: this.input };
    const p = makeProf(kind, input.angle, input.snow);
    this.prof = p;
    const wet = input.water;

    // --- terrain heightfield with vertex colours
    const nx = GX + 1;
    const nz = GZ + 1;
    const dx = XMAX / GX;
    const dz = (2 * ZH) / GZ;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) this.gh[j * nx + i] = p.ground(i * dx, -ZH + j * dz);
    const pos = new Float32Array(nx * nz * 3);
    const colA = new Float32Array(nx * nz * 3);
    const idx: number[] = [];
    const grass = col(input.forest ? "#4f8442" : "#7da653");
    const bare = col("#9b7a52");
    const valley = col(kind === "mudflow" ? "#a39a86" : "#98a866");
    const rock = col(kind === "avalanche" ? "#8a939a" : "#8a8277");
    const snow = col("#f1f6fa");
    const wetC = col("#3d2e1e");
    const c = new THREE.Color();
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = i * dx;
        const z = -ZH + j * dz;
        const h = this.gh[j * nx + i];
        const k = j * nx + i;
        pos[k * 3] = x;
        pos[k * 3 + 1] = h;
        pos[k * 3 + 2] = z;
        const hx = this.gh[j * nx + Math.min(nx - 1, i + 1)] - this.gh[j * nx + Math.max(0, i - 1)];
        const hz = this.gh[Math.min(nz - 1, j + 1) * nx + i] - this.gh[Math.max(0, j - 1) * nx + i];
        const slope = Math.hypot(hx / (2 * dx), hz / (2 * dz));
        const n = noise2(x * 0.9 + 2, z * 0.9);
        const onSlope = smooth(p.topX - 1, p.topX + 1, x) * (1 - smooth(p.botX, p.botX + 2.5, x));
        if (kind === "avalanche") {
          const rocky = smooth(0.85, 1.25, slope + 0.35 * n + 0.15 * noise2(x * 3, z * 3));
          c.copy(snow).multiplyScalar(0.94 + 0.06 * n).lerp(rock, rocky * 0.9);
        } else {
          c.copy(valley).lerp(grass, onSlope * 0.9 + (1 - smooth(p.botX, p.botX + 4, x)) * 0.5);
          if (!input.forest) c.lerp(bare, smooth(0.25, 0.7, n) * 0.55);
          c.lerp(rock, smooth(0.6, 1.0, slope + 0.2 * n) * 0.8);
          c.multiplyScalar(0.92 + 0.12 * noise2(x * 3.3, z * 3.3));
          c.lerp(wetC, wet * 0.28);
        }
        // exposed bed under the moving block / in the gully
        if (kind === "landslide" && x >= p.xa - 0.2 && x <= p.xb + 0.2 && Math.abs(z) <= p.zw + 0.2) c.set("#7b5733").lerp(wetC, wet * 0.5).multiplyScalar(0.9 + 0.2 * noise2(x * 2, z * 2));
        if (kind === "avalanche" && x >= p.xa - 0.2 && x <= p.xb + 0.2 && Math.abs(z) <= p.zw + 0.2) c.set("#d8e3ec").multiplyScalar(0.92 + 0.1 * noise2(x * 2, z * 2));
        if (kind === "mudflow") {
          const gm = Math.exp(-((z / p.gullyW(x)) ** 2)) * smooth(p.topX - 1, p.topX + 1, x);
          c.lerp(col("#7e6e58"), gm * 0.85);
        }
        colA[k * 3] = c.r;
        colA[k * 3 + 1] = c.g;
        colA[k * 3 + 2] = c.b;
      }
    }
    for (let j = 0; j < GZ; j++) {
      for (let i = 0; i < GX; i++) {
        const a = j * nx + i;
        idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
      }
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    tg.setAttribute("color", new THREE.BufferAttribute(colA, 3));
    tg.setIndex(idx);
    tg.computeVertexNormals();
    this.world.add(new THREE.Mesh(tg, this.groundMat));

    // --- cut-away slab edges showing the soil / snow layers of the whole mountain
    const slabCols = kind === "avalanche" ? [col("#f4f8fb"), col("#dfe8ef"), col("#9aa5ad"), col("#6f7880")] : [col("#4a3524"), col("#8a6338"), col("#b9966a"), col("#7d7a75")];
    const slabD = kind === "avalanche" ? [0.25, 0.5, 1.2, 99] : [0.35, 1.0, 1.9, 99];
    const edge = (f: (s: number) => EdgePt, n: number) => Array.from({ length: n + 1 }, (_, s) => f(s / n));
    const gAt = (x: number, z: number) => {
      const i = clamp(Math.round(x / dx), 0, GX);
      const j = clamp(Math.round((z + ZH) / dz), 0, GZ);
      return this.gh[j * nx + i];
    };
    const slabPts = [
      edge((s) => ({ x: s * XMAX, y: gAt(s * XMAX, ZH), z: ZH, th: 0 }), GX),
      edge((s) => ({ x: s * XMAX, y: gAt(s * XMAX, -ZH), z: -ZH, th: 0 }), GX),
      edge((s) => ({ x: 0, y: gAt(0, -ZH + s * 2 * ZH), z: -ZH + s * 2 * ZH, th: 0 }), GZ),
      edge((s) => ({ x: XMAX, y: gAt(XMAX, -ZH + s * 2 * ZH), z: -ZH + s * 2 * ZH, th: 0 }), GZ),
    ];
    for (const pts of slabPts) this.world.add(new THREE.Mesh(skirt(pts, slabCols, (_p, b) => slabD[b], FLOOR), this.wallMat));

    // --- the block / slab that fails (landslide, avalanche)
    if (kind !== "mudflow") this.buildCover(p, input);
    if (kind !== "landslide") this.buildFlow(p);
    if (kind === "landslide") this.buildChunks(p, input);
    if (kind === "mudflow") this.buildItems(p);
    this.buildTrees(p, input);
    this.buildCracks(p);
  }

  private buildCover(p: Prof, input: SlopeInput) {
    const NX = 36;
    const NZ = 16;
    const group = new THREE.Group();
    const avalanche = this.kind === "avalanche";
    const top = (x: number, z: number) => p.ground(x, z) + 0.04 + p.thickAt(x, z);
    const pos: number[] = [];
    const colA: number[] = [];
    const idx: number[] = [];
    const c = new THREE.Color();
    const grass = col(input.forest ? "#4f8442" : "#7da653");
    const bare = col("#9b7a52");
    const snowC = col("#fdfeff");
    const snowEdge = col("#eaf2f8");
    for (let j = 0; j <= NZ; j++) {
      for (let i = 0; i <= NX; i++) {
        const x = p.xa + ((p.xb - p.xa) * i) / NX;
        const z = -p.zw + ((2 * p.zw) * j) / NZ;
        pos.push(x, top(x, z), z);
        const n = noise2(x * 0.9 + 2, z * 0.9);
        if (avalanche) {
          const w = p.thickAt(x, z) / Math.max(0.01, p.thick);
          c.copy(snowEdge).lerp(snowC, smooth(0.1, 0.8, w)).multiplyScalar(0.96 + 0.05 * noise2(x * 3, z * 3));
        } else {
          c.copy(grass);
          if (!input.forest) c.lerp(bare, smooth(0.25, 0.7, n) * 0.55);
          c.multiplyScalar(0.92 + 0.12 * noise2(x * 3.3, z * 3.3)).lerp(col("#3d2e1e"), input.water * 0.28);
        }
        colA.push(c.r, c.g, c.b);
      }
    }
    const w = NX + 1;
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) idx.push(j * w + i, (j + 1) * w + i, j * w + i + 1, j * w + i + 1, (j + 1) * w + i, (j + 1) * w + i + 1);
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    tg.setAttribute("color", new THREE.Float32BufferAttribute(colA, 3));
    tg.setIndex(idx);
    tg.computeVertexNormals();
    group.add(new THREE.Mesh(tg, avalanche ? this.snowMat : this.groundMat));

    const bands = avalanche ? [col("#ffffff"), col("#e9f2fa"), col("#c9d8e6"), col("#f7fbff")] : [col("#3f2c1a"), col("#7a5230"), col("#b38a52"), col("#8a8378")];
    const fr = avalanche ? [0.3, 0.55, 0.7, 1] : [0.18, 0.5, 0.8, 1];
    const pt = (x: number, z: number): EdgePt => ({ x, y: top(x, z), z, th: p.thickAt(x, z) + 0.18 });
    const xs = (s: number) => p.xa + (p.xb - p.xa) * s;
    const zs = (s: number) => -p.zw + 2 * p.zw * s;
    const depth = (q: EdgePt, b: number) => q.th * fr[b];
    const mk = (pts: EdgePt[]) => new THREE.Mesh(skirt(pts, bands, depth), this.wallMat);
    // downstream face leaves with the block; the crown and flank walls stay behind as the scarp
    group.add(mk(Array.from({ length: NZ + 1 }, (_, s) => pt(p.xb, zs(s / NZ)))));
    this.world.add(group);
    this.cover = group;
    this.world.add(mk(Array.from({ length: NZ + 1 }, (_, s) => pt(p.xa, zs(s / NZ)))));
    this.world.add(mk(Array.from({ length: NX + 1 }, (_, s) => pt(xs(s / NX), p.zw))));
    this.world.add(mk(Array.from({ length: NX + 1 }, (_, s) => pt(xs(s / NX), -p.zw))));
  }

  private buildCracks(p: Prof) {
    if (this.kind === "mudflow") return;
    const specs = this.kind === "avalanche" ? [{ dx: 0.08, w: 0.16, onCover: true }] : [{ dx: 0.12, w: 0.18, onCover: true }, { dx: -0.55, w: 0.1, onCover: false }, { dx: -1.0, w: 0.08, onCover: false }];
    specs.forEach((s, j) => {
      const n = 18;
      const pts = Array.from({ length: n }, (_, i) => {
        const z = (-0.92 + (1.84 * i) / (n - 1)) * p.zw * (j === 0 ? 1 : 0.8);
        const x = p.xa + s.dx + 0.14 * noise2(i * 0.9 + j * 7, j) + (i % 2 ? 0.06 : -0.06);
        const y = (s.onCover ? p.ground(x, z) + 0.04 + p.thickAt(x, z) : p.ground(x, z)) + 0.045;
        return { x, y, z };
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const ix: number[] = [];
      for (let i = 0; i < n - 1; i++) ix.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      g.setIndex(ix);
      const mesh = new THREE.Mesh(g, this.kind === "avalanche" ? this.crackSnow : this.crackMat);
      mesh.frustumCulled = false;
      mesh.visible = false;
      this.world.add(mesh);
      this.cracks.push({ mesh, pts, w: s.w, onCover: s.onCover });
    });
  }

  private buildChunks(p: Prof, input: SlopeInput) {
    const n = 240;
    const ch: Chunks = {
      n,
      px: new Float32Array(n),
      py: new Float32Array(n),
      pz: new Float32Array(n),
      vx: new Float32Array(n),
      vy: new Float32Array(n),
      vz: new Float32Array(n),
      wx: new Float32Array(n),
      wy: new Float32Array(n),
      wz: new Float32Array(n),
      r: new Float32Array(n),
      mu: new Float32Array(n),
      rel: new Float32Array(n),
      q: Array.from({ length: n }, () => new THREE.Quaternion()),
      sx: new Float32Array(n),
      sy: new Float32Array(n),
      sz: new Float32Array(n),
    };
    const mesh = new THREE.InstancedMesh(this.rockGeo, this.chunkMat, n);
    mesh.frustumCulled = false;
    const sod = col(input.forest ? "#4f8442" : "#6f9a47");
    const layers = [sod, col("#5a3b21"), col("#a9824d"), col("#7f7a72")];
    for (let i = 0; i < n; i++) {
      const xf = hash01(i, 1);
      const x = p.xa + (p.xb - p.xa) * xf;
      const z = (hash01(i, 2) * 2 - 1) * (p.zw - 0.12);
      const d = hash01(i, 3);
      const th = p.thickAt(x, z);
      const r = (0.17 + 0.3 * hash01(i, 5) * (0.45 + 0.55 * d)) * (hash01(i, 8) > 0.82 ? 1.35 : 1);
      const bed = p.ground(x, z);
      ch.px[i] = x;
      ch.pz[i] = z;
      ch.py[i] = Math.max(bed + r * 0.8, bed + 0.04 + th * (1 - d * 0.88) - r * 0.4);
      ch.r[i] = r;
      ch.mu[i] = 0.14 + 0.16 * hash01(i, 6);
      ch.rel[i] = T_REL + 0.55 * (1 - xf) + 0.35 * hash01(i, 4);
      ch.sx[i] = 0.85 + 0.5 * hash01(i, 9);
      ch.sy[i] = 0.7 + 0.4 * hash01(i, 10);
      ch.sz[i] = 0.85 + 0.5 * hash01(i, 11);
      const layer = d < 0.22 ? 0 : d < 0.5 ? 1 : d < 0.8 ? 2 : 3;
      this.tmpC.copy(layers[hash01(i, 12) > 0.8 ? 3 : layer]).multiplyScalar(0.85 + 0.3 * hash01(i, 13));
      mesh.setColorAt(i, this.tmpC);
    }
    this.chunks = ch;
    this.chunkMesh = mesh;
    mesh.visible = false;
    this.world.add(mesh);
    this.writeChunks();
  }

  private buildItems(p: Prof) {
    // mudflow: boulders (instanced rocks) and logs, carried by the slurry
    const nb = 70;
    const mesh = new THREE.InstancedMesh(this.rockGeo, this.chunkMat, nb);
    mesh.frustumCulled = false;
    const tones = [col("#6f6a63"), col("#57524c"), col("#857d70")];
    for (let i = 0; i < nb; i++) {
      this.items.push({ a: hash01(i, 1), b: hash01(i, 2), c: hash01(i, 3), r: 0.14 + 0.34 * hash01(i, 4) ** 1.6 });
      this.tmpC.copy(tones[i % 3]).multiplyScalar(0.8 + 0.3 * hash01(i, 5));
      mesh.setColorAt(i, this.tmpC);
    }
    this.chunkMesh = mesh;
    this.world.add(mesh);
    const logs = new THREE.InstancedMesh(this.logGeo, this.logMat, 12);
    logs.frustumCulled = false;
    this.logMesh = logs;
    this.world.add(logs);
    void p;
  }

  private buildTrees(p: Prof, input: SlopeInput) {
    if (!input.forest) return;
    const n = 44;
    const mesh = new THREE.InstancedMesh(this.treeG, this.treeMat, n);
    mesh.frustumCulled = false;
    let k = 0;
    for (let i = 0; i < 400 && k < n; i++) {
      const x = p.topX - 1 + hash01(i, 21) * (p.run + 5);
      const z = (hash01(i, 22) * 2 - 1) * (ZH - 1);
      if (this.kind === "mudflow" && Math.abs(z) < p.gullyW(x) + 0.9 && x > p.topX - 1) continue;
      const y = p.ground(x, z) + (this.kind !== "mudflow" ? p.thickAt(x, z) + 0.04 : 0);
      const inZone = this.kind !== "mudflow" && x >= p.xa && x <= p.xb && Math.abs(z) <= p.zw;
      let carrier = -1;
      const off = new THREE.Vector3();
      if (inZone) {
        if (this.kind === "avalanche") carrier = -2;
        else if (this.chunks) {
          let best = 1e9;
          for (let c = 0; c < this.chunks.n; c++) {
            const dd = (this.chunks.px[c] - x) ** 2 + (this.chunks.pz[c] - z) ** 2;
            if (dd < best) {
              best = dd;
              carrier = c;
            }
          }
          off.set(x - this.chunks.px[carrier], y - this.chunks.py[carrier], z - this.chunks.pz[carrier]);
        }
      }
      this.trees.push({ x, y, z, s: 0.8 + 0.7 * hash01(i, 23), carrier, off });
      k++;
    }
    this.treeMesh = mesh;
    mesh.count = this.trees.length;
    this.world.add(mesh);
    this.writeTrees();
  }

  private buildFlow(p: Prof) {
    const nx = this.flowNx;
    const nz = this.flowNz;
    this.flowX0 = p.xa - 1;
    this.flowX1 = XMAX - 0.8;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((nx + 1) * (nz + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("color", new THREE.BufferAttribute(new Float32Array((nx + 1) * (nz + 1) * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    const w = nx + 1;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) idx.push(j * w + i, (j + 1) * w + i, j * w + i + 1, j * w + i + 1, (j + 1) * w + i, (j + 1) * w + i + 1);
    g.setIndex(idx);
    const mesh = new THREE.Mesh(g, this.kind === "mudflow" ? this.mudMat : this.snowMat);
    mesh.frustumCulled = false;
    this.flow = mesh;
    this.world.add(mesh);
    if (this.kind === "avalanche") {
      // blocks of the broken slab riding in the flow
      const nb = 170;
      const cm = new THREE.InstancedMesh(this.blockGeo, this.chunkMat, nb);
      cm.frustumCulled = false;
      const tones = [col("#ffffff"), col("#e4edf5"), col("#cfdce8")];
      for (let i = 0; i < nb; i++) {
        this.items.push({ a: hash01(i, 1), b: hash01(i, 2), c: hash01(i, 3), r: 0.12 + 0.3 * hash01(i, 4) ** 1.5 });
        this.tmpC.copy(tones[i % 3]).multiplyScalar(0.95 + 0.05 * hash01(i, 5));
        cm.setColorAt(i, this.tmpC);
      }
      this.chunkMesh = cm;
      this.world.add(cm);
    }
  }

  /* -------------------------------------------------- sampling */

  private hAt(x: number, z: number) {
    const dx = XMAX / GX;
    const dz = (2 * ZH) / GZ;
    const fx = clamp(x / dx, 0, GX - 0.001);
    const fz = clamp((z + ZH) / dz, 0, GZ - 0.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const u = fx - i;
    const v = fz - j;
    const w = GX + 1;
    const a = this.gh[j * w + i];
    const b = this.gh[j * w + i + 1];
    const c = this.gh[(j + 1) * w + i];
    const d = this.gh[(j + 1) * w + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }

  /** Half-width of the moving mass at x. */
  private flowW(x: number) {
    const p = this.prof;
    if (this.kind === "mudflow") return p.gullyW(x);
    return p.zw * (0.85 + 0.35 * smooth(p.botX - 2, p.botX + 8, x));
  }

  /** Depth of the flowing mass on its centre line at x. */
  private flowDepth(x: number) {
    const p = this.prof;
    const fx = (x - p.A - 0.55 * this.travel) / (p.B + 0.9 * this.travel);
    if (fx < -0.02 || fx > 1.02) return 0;
    const f = clamp(fx, 0, 1);
    const th = p.thick;
    const spread = this.flowW(x) / this.flowW(p.A);
    if (this.kind === "mudflow") {
      if (!this.go) return th * 0.8 * smooth(0, 0.12, f) * smooth(1, 0.88, f);
      const body = 0.35 + 0.65 * f ** 1.5 + 0.55 * Math.exp(-(((f - 0.9) / 0.07) ** 2));
      const nose = Math.sqrt(Math.max(0, 1 - Math.max(0, (f - 0.94) / 0.06) ** 2));
      return (th * 1.15 * body * nose * smooth(0, 0.08, f)) / Math.max(1, spread ** 0.7);
    }
    const body = this.go ? 0.6 + 0.4 * f : 1;
    const nose = Math.sqrt(Math.max(0, 1 - Math.max(0, (f - 0.9) / 0.1) ** 2));
    return (th * body * nose * smooth(0, 0.08, f)) / Math.max(1, spread ** 0.6);
  }

  /** Surface height of the flow at (x, z) — used by carried debris. */
  private flowTop(x: number, z: number) {
    const w = this.flowW(x);
    const u = clamp(z / w, -1, 1);
    const cross = this.kind === "mudflow" ? Math.sqrt(Math.max(0, 1 - u * u)) : smooth(1, 0.6, Math.abs(u));
    return this.hAt(x, z) + this.flowDepth(x) * cross;
  }

  /* -------------------------------------------------- per-frame updates */

  private updateFlow() {
    const mesh = this.flow;
    if (!mesh) return;
    const avalanche = this.kind === "avalanche";
    mesh.visible = !avalanche || (this.go && this.t >= T_REL);
    if (!mesh.visible) return;
    const pa = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    const ca = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
    const nx = this.flowNx;
    const nz = this.flowNz;
    const time = this.clock;
    const moving = this.go && this.m > 0 ? 1 : 0;
    const mud = this.kind === "mudflow";
    const c = this.tmpC;
    const base = mud ? MUD_BASE : SNOW_BASE;
    const light = mud ? MUD_LIGHT : SNOW_LIGHT;
    const dark = mud ? MUD_DARK : SNOW_DARK;
    for (let i = 0; i <= nx; i++) {
      const x = this.flowX0 + ((this.flowX1 - this.flowX0) * i) / nx;
      const d = Math.min(this.flowDepth(x), 99);
      const w = this.flowW(x);
      const fx = clamp((x - this.prof.A - 0.55 * this.travel) / (this.prof.B + 0.9 * this.travel), 0, 1);
      for (let j = 0; j <= nz; j++) {
        const u = (j / nz) * 2 - 1;
        const z = u * w;
        const bed = this.hAt(x, z);
        const k = j * (nx + 1) + i;
        if (d < 0.004) {
          pa.setXYZ(k, x, bed - 0.06, z);
          ca.setXYZ(k, base.r, base.g, base.b);
          continue;
        }
        const cross = mud ? Math.sqrt(Math.max(0, 1 - u * u)) : smooth(1, 0.6, Math.abs(u));
        const rn = noise2(x * 2.6 - time * 4.5 * moving, z * 2.2 + time * 0.5 * moving);
        const ripple = d * (mud ? 0.16 : 0.22) * rn + (mud ? 0.035 * Math.sin(x * 9 - time * 12 * moving + z * 2) * moving : 0.02 * Math.sin(x * 12 + z * 5)) * smooth(0, 0.15, d);
        pa.setXYZ(k, x, bed + 0.03 + d * cross + ripple * cross, z);
        const tone = rn * 0.5 + 0.5;
        c.copy(dark).lerp(base, 0.4 + 0.6 * smooth(0, 0.4, cross)).lerp(light, tone * 0.45);
        if (mud) c.multiplyScalar(0.85 + 0.25 * (1 - fx * moving));
        ca.setXYZ(k, c.r, c.g, c.b);
      }
    }
    pa.needsUpdate = true;
    ca.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }

  private writeChunks() {
    const ch = this.chunks;
    const mesh = this.chunkMesh;
    if (!ch || !mesh) return;
    for (let i = 0; i < ch.n; i++) {
      this.tmpV.set(ch.px[i], ch.py[i], ch.pz[i]);
      this.tmpS.set(ch.r[i] * ch.sx[i], ch.r[i] * ch.sy[i], ch.r[i] * ch.sz[i]);
      this.tmpM.compose(this.tmpV, ch.q[i], this.tmpS);
      mesh.setMatrixAt(i, this.tmpM);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  private rand() {
    this.rnd = (this.rnd * 16807) % 2147483647;
    return this.rnd / 2147483647;
  }

  private stepPhysics(h: number) {
    const ch = this.chunks;
    if (!ch) return;
    const e = 0.15;
    for (let i = 0; i < ch.n; i++) {
      if (this.t < ch.rel[i]) continue;
      ch.vy[i] -= G * h;
      ch.px[i] += ch.vx[i] * h;
      ch.py[i] += ch.vy[i] * h;
      ch.pz[i] += ch.vz[i] * h;
      const r = ch.r[i] * 0.85;
      const gh = this.hAt(ch.px[i], ch.pz[i]);
      let contact = false;
      let nxn = 0;
      let nyn = 1;
      let nzn = 0;
      if (ch.py[i] - r < gh) {
        contact = true;
        ch.py[i] = gh + r;
        const gx = (this.hAt(ch.px[i] + e, ch.pz[i]) - this.hAt(ch.px[i] - e, ch.pz[i])) / (2 * e);
        const gz = (this.hAt(ch.px[i], ch.pz[i] + e) - this.hAt(ch.px[i], ch.pz[i] - e)) / (2 * e);
        const il = 1 / Math.hypot(gx, 1, gz);
        nxn = -gx * il;
        nyn = il;
        nzn = -gz * il;
        const vn = ch.vx[i] * nxn + ch.vy[i] * nyn + ch.vz[i] * nzn;
        if (vn < 0) {
          const rest = vn < -1.8 ? 0.3 : 0;
          ch.vx[i] -= (1 + rest) * vn * nxn;
          ch.vy[i] -= (1 + rest) * vn * nyn;
          ch.vz[i] -= (1 + rest) * vn * nzn;
          if (rest > 0) {
            ch.vz[i] += (this.rand() - 0.5) * 0.8;
            ch.vx[i] += (this.rand() - 0.3) * 0.4;
          }
        }
        // Coulomb friction on the tangential part of the velocity
        const vn2 = ch.vx[i] * nxn + ch.vy[i] * nyn + ch.vz[i] * nzn;
        const tx = ch.vx[i] - nxn * vn2;
        const ty = ch.vy[i] - nyn * vn2;
        const tz = ch.vz[i] - nzn * vn2;
        const sp = Math.hypot(tx, ty, tz);
        if (sp > 1e-5) {
          const k = Math.max(0, 1 - (ch.mu[i] * G * nyn * h) / sp);
          ch.vx[i] = nxn * vn2 + tx * k;
          ch.vy[i] = nyn * vn2 + ty * k;
          ch.vz[i] = nzn * vn2 + tz * k;
        }
      }
      const drag = 1 - 0.12 * h;
      ch.vx[i] *= drag;
      ch.vy[i] *= drag;
      ch.vz[i] *= drag;
      if (Math.abs(ch.pz[i]) > ZH - 0.4) {
        ch.pz[i] = Math.sign(ch.pz[i]) * (ZH - 0.4);
        ch.vz[i] *= -0.3;
      }
      if (ch.px[i] > XMAX - 0.6) {
        ch.px[i] = XMAX - 0.6;
        ch.vx[i] *= -0.2;
      }
      // tumbling: roll along the surface, keep spinning in the air
      if (contact) {
        const k = 0.7 / r;
        ch.wx[i] += (nyn * ch.vz[i] - nzn * ch.vy[i]) * k * 0.3 - ch.wx[i] * 0.3;
        ch.wy[i] += (nzn * ch.vx[i] - nxn * ch.vz[i]) * k * 0.3 - ch.wy[i] * 0.3;
        ch.wz[i] += (nxn * ch.vy[i] - nyn * ch.vx[i]) * k * 0.3 - ch.wz[i] * 0.3;
      }
      const wl = Math.hypot(ch.wx[i], ch.wy[i], ch.wz[i]);
      if (wl > 1e-4) {
        this.tmpV.set(ch.wx[i] / wl, ch.wy[i] / wl, ch.wz[i] / wl);
        this.tmpQ.setFromAxisAngle(this.tmpV, wl * h);
        ch.q[i].premultiply(this.tmpQ).normalize();
      }
    }
  }

  private updateCarried() {
    const mesh = this.chunkMesh;
    if (!mesh || this.kind === "landslide") return;
    const p = this.prof;
    const mud = this.kind === "mudflow";
    const m = this.m;
    const time = this.clock;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const f = mud ? 0.55 + 0.45 * Math.sqrt(it.a) : it.a;
      let x = p.A + p.B * f + this.travel * (0.55 + 0.9 * f) + (mud ? 0 : it.b * 1.4 * m);
      x = Math.min(x, XMAX - 1.2);
      const w = this.flowW(x);
      const z = (hash01(i, 14) * 2 - 1) * w * (mud ? 0.8 : 0.85) * (1 + (mud ? 0 : 0.35 * m));
      const surf = this.flowTop(x, z);
      const bounce = Math.abs(Math.sin(this.t * Math.PI * (2 + it.c * 4) + it.a * 6)) * (mud ? 0.1 : 0.35) * it.b * Math.sin(m * Math.PI) * (this.go ? 1 : 0);
      const y = mud ? surf - it.r * 0.25 + bounce : this.hAt(x, z) + 0.05 + Math.max(0.06, (surf - this.hAt(x, z)) * (0.25 + 0.75 * it.c)) + bounce;
      this.tmpV.set(x, y, z);
      this.tmpE.set(m * (it.b - 0.4) * 14, it.a * 6 + m * (it.c - 0.5) * 9, m * (it.c - 0.3) * 8 + time * 0);
      this.tmpQ.setFromEuler(this.tmpE);
      const sc = it.r * (mud ? 1 : 1.3);
      this.tmpS.set(sc * (0.8 + it.c * 0.5), sc * (mud ? 0.9 : 0.7), sc * (0.8 + it.b * 0.5));
      this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);
      mesh.setMatrixAt(i, this.tmpM);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.visible = !(this.kind === "avalanche") || (this.go && this.t >= T_REL);

    const logs = this.logMesh;
    if (logs) {
      for (let i = 0; i < 12; i++) {
        const a = hash01(i, 31);
        const f = 0.5 + 0.5 * Math.sqrt(a);
        const x = Math.min(p.A + p.B * f + this.travel * (0.55 + 0.9 * f), XMAX - 1.2);
        const z = (hash01(i, 32) * 2 - 1) * this.flowW(x) * 0.6;
        const y = this.flowTop(x, z) + 0.02 + (this.go ? Math.abs(Math.sin(this.t * 3 + i)) * 0.12 * Math.sin(m * Math.PI) : 0);
        this.tmpV.set(x, y, z);
        this.tmpE.set(0, (hash01(i, 33) - 0.5) * 1.2 + m * (hash01(i, 34) - 0.5) * 2, (hash01(i, 35) - 0.5) * 0.4);
        this.tmpQ.setFromEuler(this.tmpE);
        const len = 0.9 + 1.0 * hash01(i, 36);
        this.tmpS.set(len, 0.8 + 0.5 * hash01(i, 37), 0.8 + 0.5 * hash01(i, 37));
        this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);
        logs.setMatrixAt(i, this.tmpM);
      }
      logs.instanceMatrix.needsUpdate = true;
    }
  }

  private writeTrees() {
    const mesh = this.treeMesh;
    if (!mesh) return;
    const p = this.prof;
    const ch = this.chunks;
    for (let i = 0; i < this.trees.length; i++) {
      const tr = this.trees[i];
      this.tmpQ.identity();
      this.tmpV.set(tr.x, tr.y, tr.z);
      if (tr.carrier >= 0 && ch) {
        this.tmpQ.copy(ch.q[tr.carrier]);
        this.tmpV2.copy(tr.off).applyQuaternion(this.tmpQ);
        this.tmpV.set(ch.px[tr.carrier] + this.tmpV2.x, ch.py[tr.carrier] + this.tmpV2.y, ch.pz[tr.carrier] + this.tmpV2.z);
      } else if (tr.carrier === -2 && this.go && this.t >= T_REL) {
        const f = clamp((tr.x - p.A) / p.B, 0, 1);
        const x = Math.min(tr.x + this.travel * (0.55 + 0.9 * f), XMAX - 1);
        this.tmpV.set(x, this.flowTop(x, tr.z) - 0.1, tr.z);
        this.tmpQ.setFromEuler(this.tmpE.set(0, 0, -this.m * 1.2));
      }
      this.tmpS.setScalar(tr.s);
      this.tmpM.compose(this.tmpV, this.tmpQ, this.tmpS);
      mesh.setMatrixAt(i, this.tmpM);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  private updateCracks() {
    const t0 = this.go ? this.crack : 0;
    for (const c of this.cracks) {
      c.mesh.visible = this.go && t0 > 0.001 && (!c.onCover || this.t < T_REL);
      if (!c.mesh.visible) continue;
      const pa = c.mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
      const w = c.w * t0;
      c.pts.forEach((q, i) => {
        const jag = 0.5 + 0.5 * Math.sin(i * 2.7);
        pa.setXYZ(i * 2, q.x - w * jag, q.y, q.z);
        pa.setXYZ(i * 2 + 1, q.x + w * (1.2 - jag), q.y, q.z);
      });
      pa.needsUpdate = true;
    }
  }

  private updateEffects(dt: number) {
    const p = this.prof;
    const m = this.m;
    // landslide dust: soft brown puffs shed by fast chunks
    if (this.dust && this.chunks) {
      const ch = this.chunks;
      for (let i = 0; i < 150; i++) {
        this.dustAge[i] += dt;
        if (this.dustAge[i] > this.dustLife[i]) {
          const c = Math.floor(this.rand() * ch.n);
          const sp = Math.hypot(ch.vx[c], ch.vy[c], ch.vz[c]);
          if (this.running && this.go && this.t > ch.rel[c] && sp > 1.6) {
            this.dustAge[i] = 0;
            this.dustLife[i] = 1.2 + 1.3 * this.rand();
            this.dustV[i * 3] = ch.px[c];
            this.dustV[i * 3 + 1] = ch.py[c] + 0.2;
            this.dustV[i * 3 + 2] = ch.pz[c];
            // stash origin in the sprite's position slot; velocity is derived from the chunk's
            this.dust.set(i, this.tmpV.set(ch.px[c], ch.py[c] + 0.2, ch.pz[c]), 0.5, 0, DUST_A);
          } else {
            this.dust.hide(i);
            continue;
          }
        }
        const life = this.dustLife[i];
        const k = this.dustAge[i] / life;
        this.dustV[i * 3] += (0.35 + 0.3 * noise2(i, this.clock * 0.5)) * dt;
        this.dustV[i * 3 + 1] += (0.5 + 0.3 * hash01(i, 3)) * dt;
        this.dustV[i * 3 + 2] += 0.25 * noise2(i * 1.3, this.clock * 0.4) * dt;
        this.dust.set(i, this.tmpV.set(this.dustV[i * 3], this.dustV[i * 3 + 1], this.dustV[i * 3 + 2]), 0.7 + 1.9 * k, 0.5 * (1 - k) * smooth(0, 0.1, k), this.tmpC.copy(DUST_A).lerp(DUST_B, k));
      }
      this.dust.commit();
    }
    // avalanche powder cloud
    if (this.powder) {
      const show = this.go && this.t >= T_REL * 0.8 && m > 0.02;
      const fade = 1 - 0.5 * smooth(0.85, 1, this.t / this.dur);
      const front = p.A + p.B + 1.45 * this.travel + 2.2 * m;
      const L = 2.5 + 8 * m;
      for (let i = 0; i < 240; i++) {
        if (!show) {
          this.powder.hide(i);
          continue;
        }
        const s = hash01(i, 1);
        const x = Math.min(XMAX - 0.6, front - s * L);
        const z = (hash01(i, 2) * 2 - 1) * p.zw * (0.55 + 0.75 * m) + 0.3 * Math.sin(this.clock * 1.2 + i);
        const size = (0.8 + 1.7 * hash01(i, 3)) * (0.2 + 1.1 * Math.min(1, m * 1.7)) * (1.35 - 0.6 * s);
        const lift = hash01(i, 4) * 2.4 * m * (1 - 0.5 * s) + 0.15 * Math.sin(this.clock * 0.9 + i * 1.7);
        const y = this.hAt(x, z) + p.thick + size * 0.35 + lift;
        const alpha = clamp((0.5 * (1 - 0.6 * s) * fade) * smooth(0, 0.12, m), 0, 0.6);
        this.powder.set(i, this.tmpV.set(x, y, z), size, alpha, i % 3 ? POWDER_A : POWDER_B);
      }
      this.powder.commit();
    }
    // mudflow splash: droplets and soft puffs thrown off the snout
    if (this.splash) {
      const on = this.go && m > 0.04 && m < 0.985;
      const fx = Math.min(p.A + p.B + 1.45 * this.travel, XMAX - 1.2);
      for (let i = 0; i < 80; i++) {
        const o = i * 7;
        const st = this.splashSt;
        st[o + 6] += dt;
        if (st[o + 6] > st[o + 5] || st[o + 5] === 0) {
          if (!on) {
            this.splash.hide(i);
            st[o + 5] = 0;
            continue;
          }
          const z = (this.rand() * 2 - 1) * this.flowW(fx) * 0.7;
          st[o] = fx - 0.2 * this.rand();
          st[o + 1] = this.flowTop(fx, z) + 0.1;
          st[o + 2] = z;
          st[o + 3] = 1 + 3 * this.rand();
          st[o + 4] = 1.5 + 2.5 * this.rand();
          st[o + 5] = 0.5 + 0.6 * this.rand();
          st[o + 6] = 0;
          this.rnd += i;
        }
        const k = st[o + 6] / st[o + 5];
        const vz = (hash01(i, 40) - 0.5) * 2;
        st[o] += st[o + 3] * dt;
        st[o + 4] -= 9 * dt;
        st[o + 1] += st[o + 4] * dt;
        st[o + 2] += vz * dt;
        const puff = i % 4 === 0;
        this.splash.set(i, this.tmpV.set(st[o], st[o + 1], st[o + 2]), puff ? 0.5 + 0.7 * k : 0.12 + 0.08 * hash01(i, 41), puff ? 0.45 * (1 - k) : 0.9 * (1 - k * 0.5), puff ? SPLASH_PUFF : SPLASH_DROP);
      }
      this.splash.commit();
    }
  }

  private updateWeather(dt: number) {
    const rain = this.kind !== "avalanche" ? Math.round(this.input.water * 180) : 0;
    const flakes = this.kind === "avalanche" ? Math.round(this.input.snow * 1.6) : 0;
    const n = Math.min(380, rain + flakes);
    const t = this.clock;
    for (let i = 0; i < 380; i++) {
      if (i >= n) {
        this.weather.hide(i);
        continue;
      }
      const x = hash01(i, 51) * XMAX;
      const z = (hash01(i, 52) * 2 - 1) * ZH;
      const speed = rain ? 14 : 1.6 + hash01(i, 53);
      const y = 13 - ((hash01(i, 54) * 13 + t * speed) % 13);
      const sway = rain ? 0 : Math.sin(t * 0.8 + i) * 0.35;
      this.weather.set(i, this.tmpV.set(x + sway - (rain ? y * 0.08 : 0), y, z), rain ? 0.09 : 0.17, rain ? 0.5 : 0.9, rain ? RAIN_C : POWDER_A);
    }
    this.weather.commit();
    void dt;
  }

  /* -------------------------------------------------- run */

  run() {
    this.t = 0;
    this.running = true;
    this.rnd = 12345;
    this.acc = 0;
    if (this.reduceMotion) {
      while (this.running) this.advance(1 / 30);
      this.syncFrame();
    }
  }

  private advance(dt: number) {
    this.t += dt;
    if (this.t >= this.dur) {
      this.t = this.dur;
      this.running = false;
    }
    const t = this.t;
    this.crack = this.go ? Math.min(1, t / T_REL) : 0;
    const xx = this.go ? Math.max(0, (t - T_REL) / (this.dur - T_REL)) : 0;
    this.m = 1 - Math.pow(1 - xx * xx * (3 - 2 * xx), 1.6);
    const p = this.prof;
    const reach = p.run * (1 - (this.kind === "mudflow" ? 0.45 : 0.62)) + (this.kind === "mudflow" ? 5.5 : 7);
    const surge = this.kind === "mudflow" && this.go ? 0.35 * Math.sin((t / this.dur) * 34) * Math.sin(this.m * Math.PI) : 0;
    this.travel = this.go ? Math.min(this.m * reach + surge, (XMAX - 1.5 - p.A - p.B) / 1.45) : 0;
    this.stepChunks(dt);
    this.updateEffects(dt);
    if (!this.running) {
      this.flowDirty = true;
      this.settle = 3;
      this.onDone?.();
    }
  }

  private stepChunks(dt: number) {
    if (!(this.go && this.kind === "landslide")) return;
    this.acc += dt;
    let n = 0;
    while (this.acc >= 1 / 60 && n++ < 8) {
      this.acc -= 1 / 60;
      this.stepPhysics(1 / 60);
    }
  }

  private syncFrame() {
    if (this.cover) this.cover.visible = !(this.go && this.t >= T_REL);
    if (this.kind === "landslide" && this.chunkMesh) {
      this.chunkMesh.visible = this.go && this.t >= T_REL;
      if (this.chunkMesh.visible) this.writeChunks();
    }
    if (this.running || this.flowDirty) {
      this.flowDirty = false;
      this.updateFlow();
    }
    this.updateCarried();
    this.writeTrees();
    this.updateCracks();
    const shake = !this.go && this.t >= 0 && this.t < this.dur ? Math.sin((this.t / this.dur) * 60) * 0.08 * (1 - this.t / this.dur) : this.go && this.t >= 0 && this.t < T_REL ? Math.sin(this.t * 70) * 0.05 * (this.t / T_REL) : 0;
    this.world.position.set(shake, Math.abs(shake) * 0.4, 0);
  }

  /* -------------------------------------------------- loop */

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 40 / Math.max(0.5, w / h) : 40;
    this.camera.updateProjectionMatrix();
    const px = h * this.renderer.getPixelRatio();
    for (const c of [this.weather, this.dust, this.powder, this.splash]) c?.setViewport(px, this.camera.fov);
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.visible) return;
    if (!this.reduceMotion) this.clock += dt;
    if (this.running && !this.reduceMotion) this.advance(dt);
    else if (this.go && this.t >= this.dur) {
      if (this.settle > 0 && !this.reduceMotion) {
        this.settle -= dt;
        this.stepChunks(dt);
      }
      this.updateEffects(this.reduceMotion ? 0 : dt);
    }
    this.syncFrame();
    this.updateWeather(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.io?.disconnect();
    this.controls.dispose();
    this.clearWorld();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    for (const g of [this.rockGeo, this.blockGeo, this.treeG, this.logGeo]) g.dispose();
    for (const m of [this.groundMat, this.wallMat, this.chunkMat, this.mudMat, this.snowMat, this.treeMat, this.crackMat, this.crackSnow, this.logMat]) m.dispose();
    for (const c of [this.weather, this.dust, this.powder, this.splash]) {
      const mat = c?.points.material as THREE.Material | undefined;
      mat?.dispose();
    }
    this.renderer.dispose();
  }
}

/* ------------------------------------------------------------------ component */

/**
 * The slope model alone, set from outside (the narration): the slope is rebuilt when the input changes and the
 * model runs whenever `run` changes (and is above 0).
 */
export function SlopeView({ kind, input, run }: { kind: HazardKind; input: SlopeInput; run: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SlopeScene | null>(null);
  const [failed, setFailed] = useState(false);
  const triggered = evaluate(kind, input).triggered;
  const key = `${kind} ${input.angle} ${input.water} ${input.snow} ${input.forest}`;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const scene = new SlopeScene(canvas, kind);
      sceneRef.current = scene;
      return () => {
        scene.dispose();
        sceneRef.current = null;
      };
    } catch {
      setFailed(true);
    }
  }, [kind]);
  useEffect(() => {
    sceneRef.current?.setInput(input, triggered);
    // The key stands for the input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (run > 0) sceneRef.current?.run();
  }, [run, kind]);

  return (
    <div className="relative size-full bg-[linear-gradient(#cfe6f7,#eef6fb)]">
      <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" role="img" aria-label={`ფერდობის მოდელი: ${HAZARD_INFO[kind].name}`} />
      <span className="pointer-events-none absolute bottom-2 left-3 rounded bg-card/85 px-1.5 py-0.5 text-xs font-bold text-ink">{input.angle}°</span>
      {failed && <p className="absolute inset-0 flex items-center justify-center text-sm text-copy">3D ვერ ჩაიტვირთა</p>}
    </div>
  );
}

export function SlopeSim({ kind }: { kind: HazardKind }) {
  const [input, setInput] = useState<SlopeInput>(PRESETS[kind]);
  const [ran, setRan] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const sceneRef = useRef<SlopeScene | null>(null);
  const info = HAZARD_INFO[kind];
  const res = evaluate(kind, input);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const scene = new SlopeScene(canvas, kind);
      scene.onDone = () => setDone(true);
      sceneRef.current = scene;
      return () => {
        scene.dispose();
        sceneRef.current = null;
      };
    } catch {
      setFailed(true);
    }
  }, [kind]);

  // Any change of the inputs rebuilds the slope and resets the run.
  useEffect(() => {
    sceneRef.current?.setInput(input, res.triggered);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, kind]);

  const set = (patch: Partial<SlopeInput>) => {
    setInput((s) => ({ ...s, ...patch }));
    setRan(false);
    setDone(false);
  };
  const run = () => {
    setRan(true);
    setDone(false);
    sceneRef.current?.run();
  };

  const finished = ran && done;

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_15rem]">
      <div>
        <div ref={fsRef} data-scene className="relative aspect-[440/260] w-full overflow-hidden rounded-lg bg-[linear-gradient(#cfe6f7,#eef6fb)]">
          <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" role="img" aria-label={`ფერდობის მოდელი: ${info.name}`} />
          <FullscreenButton full={fsOn} onClick={fsToggle} className="absolute top-2 right-2 size-9" iconClassName="size-4" />
          <span className="pointer-events-none absolute bottom-2 left-3 rounded bg-card/85 px-1.5 py-0.5 text-xs font-bold text-ink">{input.angle}°</span>
          {failed && <p className="absolute inset-0 flex items-center justify-center text-sm text-copy">3D ვერ ჩაიტვირთა</p>}
          {finished && (
            <p className={cn("pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded bg-card/85 px-3 py-1 text-[15px] font-bold", res.triggered ? "text-[#b91c1c]" : "text-[#15803d]")}>
              {res.triggered ? `${info.name}!` : "ფერდობი გაუძლო"}
            </p>
          )}
        </div>
        <p className={cn("mt-2 min-h-12 text-[15px] leading-6", finished ? (res.triggered ? "text-[#b91c1c]" : "text-[#15803d]") : "text-copy")}>
          {finished ? res.reason : "შეცვალე ფერდობის დახრილობა, წვიმა ან თოვლი, ტყე — და დააჭირე „შემოწმება“."}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <LabeledSlider label="ფერდობის დახრილობა" value={input.angle} display={`${input.angle}°`} min={5} max={60} onChange={(angle) => set({ angle })} color={info.color} />
        {kind === "avalanche" ? (
          <LabeledSlider label="ახალი თოვლი" value={input.snow} display={`${input.snow} სმ`} min={0} max={150} step={5} onChange={(snow) => set({ snow })} color={info.color} />
        ) : (
          <LabeledSlider
            label={kind === "mudflow" ? "თავსხმა / მყინვარის დნობა" : "წვიმა — გრუნტის გაჯერება"}
            value={input.water}
            display={`${Math.round(input.water * 100)}%`}
            min={0}
            max={1}
            step={0.05}
            onChange={(water) => set({ water })}
            color={info.color}
          />
        )}
        <button type="button" onClick={() => set({ forest: !input.forest })} aria-pressed={input.forest} className={cn("flex h-10 items-center justify-center gap-2 rounded-lg border text-sm font-semibold", input.forest ? "border-[#2f6b34] bg-[#e8f3e9] text-[#2f6b34]" : "border-line-strong text-copy")}>
          <Trees className="size-4" />
          {input.forest ? "ფერდობზე ტყეა" : "ტყე გაჩეხილია"}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={run} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: info.color }}>
            <Play className="size-4" />
            შემოწმება
          </button>
          <button type="button" onClick={() => set(PRESETS[kind])} title="თავიდან" aria-label="თავიდან" className="flex size-10 items-center justify-center rounded-lg border border-line-strong">
            <RotateCcw className="size-4" />
          </button>
        </div>
        <div className="rounded-lg bg-subtle px-3 py-2.5">
          <p className="text-[11px] leading-4 text-mute">{kind === "landslide" ? "მდგრადობის კოეფიციენტი (>1 — მდგრადია)" : "საშიშროება"}</p>
          <p className="mt-1 text-base font-semibold tabular-nums">{kind === "landslide" ? res.fs!.toFixed(2).replace(".", ",") : `${Math.round(res.risk * 100)}%`}</p>
          <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-line">
            <span className="block h-full rounded-full transition-all" style={{ width: `${Math.round(res.risk * 100)}%`, backgroundColor: res.risk >= 0.5 ? "#dc2626" : res.risk >= 0.3 ? "#f59e0b" : "#16a34a" }} />
          </span>
        </div>
      </div>
    </div>
  );
}
