import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Sky } from "three/addons/objects/Sky.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/*
 * A solar power plant in the Georgian countryside. Rows of real-looking modules (dark monocrystalline cells
 * under glass, aluminium frames, two modules high) on steel tables that pivot round an east–west tube; a
 * physical sky (blue at noon, orange near the horizon) that the glass reflects; dry grass, a gravel road, a
 * fence, trees and the Caucasus on the horizon; the inverter station with its transformer and the power line
 * to the grid. For the lesson: parallel sunbeams falling on the panels, the panel's normal and the beam as
 * arrows. +z is south, +x east; units are metres.
 */

export interface SolarLabels {
  sun: THREE.Vector3;
  normal: THREE.Vector3;
  inverter: THREE.Vector3;
  transformer: THREE.Vector3;
  grid: THREE.Vector3;
  south: THREE.Vector3;
  tilt: THREE.Vector3;
}

const ROWS = 4;
/** Modules per row (landscape, two high). */
const PER_ROW = 8;
const MODULE_W = 1.7;
const MODULE_H = 1.0;
const ROW_GAP = 5.6;
/** Height of the east–west tube the tables turn on. */
const AXIS_H = 1.55;
const ROW_LEN = PER_ROW * (MODULE_W + 0.02);
/** Plant fence (half sizes). */
const FENCE_X = 20;
const FENCE_Z = 19;
const STATION = new THREE.Vector3(-9.5, 0, -12.5);
const POLES = [new THREE.Vector3(-22, 0, -14.5), new THREE.Vector3(-32.5, 0, -18), new THREE.Vector3(-43, 0, -21.5)];
const POLE_H = 8;

/** Where the narration sends the camera: position and the point looked at. */
export const SOLAR_VIEWS = {
  overview: [new THREE.Vector3(17, 6, 15), new THREE.Vector3(-1, 3, 0)],
  panel: [new THREE.Vector3(7.5, 3.6, 15.5), new THREE.Vector3(0.6, 2.2, 8.4)],
  station: [new THREE.Vector3(-1.5, 5.5, -2.5), new THREE.Vector3(-9.5, 2, -13)],
  grid: [new THREE.Vector3(-10, 6.5, -2), new THREE.Vector3(-29, 5.5, -17)],
  side: [new THREE.Vector3(25, 4.5, 3), new THREE.Vector3(0, 1.2, 1)],
} as const;
export type SolarView = keyof typeof SOLAR_VIEWS;

const rand = (() => {
  let s = 11;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
})();

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function texture(c: HTMLCanvasElement, repeat = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  return t;
}

/** The face of a module: 10 × 6 monocrystalline cells (dark, chamfered corners, silver busbars) in a frame. */
function moduleTexture() {
  const [c, g] = canvas(1020, 600);
  g.fillStyle = "#8d96a1"; // backsheet between the cells (seen through glass, in the shade of the cells)
  g.fillRect(0, 0, 1020, 600);
  const f = 16;
  const cw = (1020 - 2 * f - 11 * 3) / 10;
  const ch = (600 - 2 * f - 7 * 3) / 6;
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 6; j++) {
      const x = f + 3 + i * (cw + 3);
      const y = f + 3 + j * (ch + 3);
      const k = 12;
      const shade = 18 + Math.floor(rand() * 6);
      g.fillStyle = `rgb(${shade - 6},${shade},${shade + 18})`;
      g.beginPath();
      g.moveTo(x + k, y);
      g.lineTo(x + cw - k, y);
      g.lineTo(x + cw, y + k);
      g.lineTo(x + cw, y + ch - k);
      g.lineTo(x + cw - k, y + ch);
      g.lineTo(x + k, y + ch);
      g.lineTo(x, y + ch - k);
      g.lineTo(x, y + k);
      g.closePath();
      g.fill();
      // Fine fingers across, busbars along.
      g.fillStyle = "rgba(150,165,190,0.10)";
      for (let yy = y + 3; yy < y + ch; yy += 3) g.fillRect(x + 2, yy, cw - 4, 1);
      g.fillStyle = "rgba(170,180,195,0.55)";
      for (let b = 1; b <= 5; b++) g.fillRect(x + (b * cw) / 6 - 1, y + 1, 2, ch - 2);
    }
  // Aluminium frame.
  const grad = g.createLinearGradient(0, 0, 0, f);
  grad.addColorStop(0, "#eef0f2");
  grad.addColorStop(1, "#9aa1a8");
  g.strokeStyle = "#b8bec4";
  g.lineWidth = f;
  g.strokeRect(f / 2, f / 2, 1020 - f, 600 - f);
  g.strokeStyle = "rgba(255,255,255,0.6)";
  g.lineWidth = 2;
  g.strokeRect(1, 1, 1018, 598);
  const t = texture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** Dry summer grass with patches of bare soil. */
function grassTexture() {
  const [c, g] = canvas(512, 512);
  g.fillStyle = "#8e9659";
  g.fillRect(0, 0, 512, 512);
  const blot = (n: number, colors: string[], r0: number, r1: number, a: number) => {
    for (let i = 0; i < n; i++) {
      g.globalAlpha = a * (0.5 + rand() * 0.5);
      g.fillStyle = colors[Math.floor(rand() * colors.length)];
      const x = rand() * 512;
      const y = rand() * 512;
      const r = r0 + rand() * (r1 - r0);
      for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {
        g.beginPath();
        g.ellipse(x + dx, y + dy, r, r * (0.6 + rand() * 0.4), rand() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  };
  blot(60, ["#7d8a4c", "#a3a364", "#9b8e5e", "#6f7d45"], 20, 70, 0.35);
  blot(40, ["#a89a6c", "#b3a679"], 8, 26, 0.3);
  g.globalAlpha = 1;
  for (let i = 0; i < 9000; i++) {
    const x = rand() * 512;
    const y = rand() * 512;
    const l = 2 + rand() * 5;
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.2;
    g.strokeStyle = ["#6e7c40", "#a9a66a", "#c2b47c", "#5f6d38", "#8f9a55"][Math.floor(rand() * 5)];
    g.globalAlpha = 0.5;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    g.stroke();
  }
  g.globalAlpha = 1;
  return texture(c, 70);
}

function gravelTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#a79d8c";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 120 + Math.floor(rand() * 90);
    g.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
    g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 2.5, 1 + rand() * 2.5);
  }
  return texture(c);
}

/** Chain-link mesh (alpha). */
function fenceTexture() {
  const [c, g] = canvas(64, 64);
  g.strokeStyle = "#7b8288";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(64, 64);
  g.moveTo(64, 0);
  g.lineTo(0, 64);
  g.stroke();
  const t = texture(c);
  return t;
}

/** The side of the inverter station: louvres and a door. */
function stationTexture() {
  const [c, g] = canvas(512, 256);
  g.fillStyle = "#e9ecee";
  g.fillRect(0, 0, 512, 256);
  g.fillStyle = "#d3d8dc";
  for (let x = 0; x < 512; x += 16) g.fillRect(x, 0, 3, 256);
  // Louvres.
  for (const x0 of [40, 330]) {
    g.fillStyle = "#9aa3ab";
    g.fillRect(x0, 70, 120, 90);
    g.fillStyle = "#6f7880";
    for (let y = 74; y < 160; y += 8) g.fillRect(x0 + 4, y, 112, 4);
  }
  // Door with a warning sign.
  g.fillStyle = "#c9cfd4";
  g.fillRect(200, 40, 100, 216);
  g.strokeStyle = "#8b949c";
  g.lineWidth = 3;
  g.strokeRect(200, 40, 100, 216);
  g.fillStyle = "#f2c300";
  g.beginPath();
  g.moveTo(250, 70);
  g.lineTo(272, 108);
  g.lineTo(228, 108);
  g.closePath();
  g.fill();
  g.fillStyle = "#222";
  g.fillRect(248, 82, 4, 16);
  return texture(c);
}

/** Soft round glow for the sun and the current. */
function glowTexture() {
  const [c, g] = canvas(128, 128);
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.18, "rgba(255,246,220,0.9)");
  r.addColorStop(0.45, "rgba(255,220,150,0.25)");
  r.addColorStop(1, "rgba(255,200,120,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Hills all round and the snowy Greater Caucasus to the north. */
function mountains() {
  const N = 220;
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const near = new THREE.Color("#7c8a5a");
  const rock = new THREE.Color("#6e7468");
  const snow = new THREE.Color("#dde3e8");
  const ridge = (a: number) => {
    const north = Math.max(0, -Math.cos(a)); // −z is north
    const base = 6 + 10 * north + 3 * Math.sin(a * 3 + 1);
    let h = base;
    for (const [f, amp] of [[7, 5], [13, 3.2], [29, 1.6], [57, 0.8]] as const) h += amp * (0.6 + north) * Math.sin(a * f + f * 0.7) * Math.sin(a * f * 0.37 + 2);
    return Math.max(2, h + 22 * north ** 3 * (0.6 + 0.4 * Math.sin(a * 17)));
  };
  // Each slice from the foot (k = 0) to the crest (k = ROWS_UP) and down the far side; colours by height.
  const UP = 8;
  const c = new THREE.Color();
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const h = ridge(a);
    const r0 = 150;
    const r1 = 175 + 25 * Math.max(0, -Math.cos(a));
    const crest = r0 + (r1 - r0) * 0.55;
    for (let k = 0; k <= UP * 2; k++) {
      const t = k <= UP ? k / UP : 2 - k / UP;
      const r = k <= UP ? r0 + (crest - r0) * (k / UP) : crest + (r1 + 10 - crest) * (k / UP - 1);
      const y = -1 + (h + 1) * (1 - (1 - t) ** 2) + Math.sin(a * 41 + k) * 0.6 * t;
      pos.push(Math.sin(a) * r, y, Math.cos(a) * r);
      const snowLine = 24 + 4 * Math.sin(a * 23);
      if (y > snowLine) c.copy(rock).lerp(snow, THREE.MathUtils.smoothstep(y - snowLine, 0, 4) * (0.75 + 0.25 * Math.sin(a * 97 + k * 3)));
      else c.copy(near).lerp(rock, THREE.MathUtils.smoothstep(y, 4, 18));
      col.push(c.r, c.g, c.b);
    }
  }
  const S = UP * 2 + 1;
  for (let i = 0; i < N; i++)
    for (let k = 0; k < S - 1; k++) {
      const a = i * S + k;
      const b = (i + 1) * S + k;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
}

/** A tree crown: a lumpy ball, darker underneath (vertex colours carry the shade). */
function crownGeometry() {
  const geo = mergeVertices(new THREE.IcosahedronGeometry(1, 3).deleteAttribute("normal").deleteAttribute("uv"));
  const p = geo.getAttribute("position") as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const col: number[] = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = Math.sin(v.x * 5.1 + v.y * 3.3) * Math.sin(v.z * 4.7 - v.y * 2.1) + 0.5 * Math.sin(v.x * 11.3 - v.z * 9.7 + v.y * 7.9);
    v.multiplyScalar(1 + 0.16 * n);
    p.setXYZ(i, v.x, v.y, v.z);
    // Darker underneath, dappled all over (leaves catching the light or not).
    const shade = (0.6 + 0.4 * THREE.MathUtils.smoothstep(v.y, -0.9, 0.8)) * (0.82 + 0.3 * rand());
    col.push(shade, shade, shade);
  }
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** A thick arrow (WebGL lines are 1 px thin). */
function arrow(color: string, length: number) {
  const mat = new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true });
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, length - 0.3, 10), mat);
  shaft.position.y = (length - 0.3) / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 14), mat);
  head.position.y = length - 0.15;
  g.add(shaft, head);
  g.renderOrder = 10;
  shaft.renderOrder = head.renderOrder = 10;
  return g;
}

/** A sunbeam: a thin shaft of light with brighter pulses running down it. */
function beamMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      varying float vY;
      varying float vFacing;
      void main() {
        vY = uv.y;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(normalize(normalMatrix * normal), normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying float vY;
      varying float vFacing;
      void main() {
        float pulse = 0.6 + 0.4 * smoothstep(0.6, 1.0, fract(vY * 6.0 + uTime * 0.9));
        float fade = smoothstep(0.0, 0.08, vY) * smoothstep(1.0, 0.7, vY);
        // Soft edges: the shaft is brightest along its middle.
        gl_FragColor = vec4(vec3(1.0, 0.76, 0.32) * pulse, 0.5 * fade * vFacing * vFacing);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export class SolarScene {
  onFrame: ((project: (p: THREE.Vector3) => { x: number; y: number; visible: boolean }, labels: SolarLabels) => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 3000);
  private controls: OrbitControls;
  private sunLight = new THREE.DirectionalLight("#fff4e2", 3);
  private sky = new Sky();
  /** A copy of the sky rendered into the environment map (what the glass and steel reflect). */
  private envScene = new THREE.Scene();
  private envSky = new Sky();
  private pmrem: THREE.PMREMGenerator;
  private envTarget: THREE.WebGLRenderTarget | null = null;
  private envDirty = true;
  private envAt = 0;
  private sunGlow: THREE.Sprite;
  private tables: THREE.Group[] = [];
  private beams: THREE.Mesh[] = [];
  private beamMat = beamMaterial();
  private normalArrow = arrow("#ffffff", 2.2);
  private beamArrow = arrow("#ff9500", 2.2);
  private labels: SolarLabels = {
    sun: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    inverter: STATION.clone().add(new THREE.Vector3(0, 3.6, 0)),
    transformer: STATION.clone().add(new THREE.Vector3(2.6, 2.6, 0.6)),
    grid: POLES[1].clone().setY(POLE_H + 1.2),
    south: new THREE.Vector3(18, 3.2, 4.5),
    tilt: new THREE.Vector3(),
  };
  private flight: { from: [THREE.Vector3, THREE.Vector3]; to: readonly [THREE.Vector3, THREE.Vector3]; start: number } | null = null;
  /** The middle wire, from the transformer to the grid (the current runs along it). */
  private wire = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]);
  private pulses: THREE.Sprite[] = [];
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private v = new THREE.Vector3();
  private sunDir = new THREE.Vector3(0, 1, 0);
  /** Where the middle sunbeam meets the panels. */
  private sunHit = new THREE.Vector3();
  private elevation = 45;
  private power = 0;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.62;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    // Sky: Preetham daylight with a few drifting clouds; the environment copy has no clouds or sun disc.
    for (const [s, size] of [[this.sky, 2000], [this.envSky, 80]] as const) {
      const u = s.material.uniforms;
      u.turbidity.value = 3.5;
      u.rayleigh.value = 1.4;
      u.mieCoefficient.value = 0.004;
      u.mieDirectionalG.value = 0.82;
      s.scale.setScalar(size);
    }
    this.sky.material.uniforms.cloudCoverage.value = 0.28;
    this.sky.material.uniforms.cloudDensity.value = 0.35;
    this.envSky.material.uniforms.cloudCoverage.value = 0;
    this.envSky.material.uniforms.showSunDisc.value = 0;
    this.scene.add(this.sky);
    this.envScene.add(this.envSky);
    // Sky light fills the shade; the sun does the lighting (as outdoors, shadows stay clear).
    this.scene.environmentIntensity = 0.32;
    this.scene.fog = new THREE.Fog("#c8d6e2", 120, 700);

    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.03;
    this.sunLight.shadow.radius = 3;
    Object.assign(this.sunLight.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
    this.scene.add(this.sunLight, this.sunLight.target);

    const glow = glowTexture();
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: "#fff2d0", transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    this.sunGlow.scale.setScalar(70);
    this.scene.add(this.sunGlow);

    this.buildGround();
    this.buildTables();
    this.buildPower(glow);
    this.scene.add(mountains());

    for (let i = 0; i < 5; i++) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 10, 1, true), this.beamMat);
      beam.renderOrder = 4;
      this.beams.push(beam);
      this.scene.add(beam);
    }
    this.scene.add(this.normalArrow, this.beamArrow);

    // From the south-east, at eye height a little above the panels: their faces, their tilt and the sun in the
    // south all in view.
    this.camera.position.set(17, 6, 15);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(-1, 3, 0);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 55;
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(86);
    this.controls.addEventListener("start", () => (this.flight = null));

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.set(48, 35, 0.7);
    this.loop();
  }

  private buildGround() {
    const groundMat = new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1, envMapIntensity: 0.55 });
    // Large patches of greener and drier grass, so the texture's repeat does not show.
    groundMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vGround;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGround = (modelMatrix * vec4(position, 1.0)).xz;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vGround;").replace(
        "#include <map_fragment>",
        /* glsl */ `#include <map_fragment>
        vec2 q = vGround * 0.035;
        float patchy = sin(q.x * 1.3 + sin(q.y * 0.7)) * sin(q.y * 1.1 + sin(q.x * 0.9)) + 0.5 * sin(q.x * 3.1 - q.y * 2.3);
        diffuseColor.rgb *= mix(vec3(1.08, 1.02, 0.86), vec3(0.86, 0.95, 0.8), smoothstep(-0.8, 0.8, patchy));`,
      );
    };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Gravel: the access road from the gate to the station, and a strip along the fence inside.
    const gravel = new THREE.MeshStandardMaterial({ map: gravelTexture(), roughness: 1 });
    const strip = (w: number, d: number, x: number, z: number) => {
      const t = gravel.map!.clone();
      t.repeat.set(w / 3, d / 3);
      t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), gravel.clone());
      (m.material as THREE.MeshStandardMaterial).map = t;
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.01, z);
      m.receiveShadow = true;
      this.scene.add(m);
    };
    strip(4, 60, -FENCE_X + 3.5, -FENCE_Z - 30 + 3);
    strip(FENCE_X * 2 - 2, 3.2, 0, -FENCE_Z + 2.2);

    // Fence: posts and chain-link.
    const postMat = new THREE.MeshStandardMaterial({ color: "#6d7378", metalness: 0.4, roughness: 0.6 });
    const linkTex = fenceTexture();
    const posts: THREE.Vector3[] = [];
    const sides: [THREE.Vector3, THREE.Vector3][] = [
      [new THREE.Vector3(-FENCE_X, 0, -FENCE_Z), new THREE.Vector3(FENCE_X, 0, -FENCE_Z)],
      [new THREE.Vector3(FENCE_X, 0, -FENCE_Z), new THREE.Vector3(FENCE_X, 0, FENCE_Z)],
      [new THREE.Vector3(FENCE_X, 0, FENCE_Z), new THREE.Vector3(-FENCE_X, 0, FENCE_Z)],
      [new THREE.Vector3(-FENCE_X, 0, FENCE_Z), new THREE.Vector3(-FENCE_X, 0, -FENCE_Z)],
    ];
    for (const [a, b] of sides) {
      const len = a.distanceTo(b);
      const n = Math.round(len / 3);
      for (let i = 0; i < n; i++) posts.push(a.clone().lerp(b, i / n));
      const t = linkTex.clone();
      t.repeat.set(len / 0.12, 2 / 0.12);
      t.needsUpdate = true;
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, 2), new THREE.MeshStandardMaterial({ map: t, alphaMap: t, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.5, depthWrite: false }));
      panel.position.copy(a).lerp(b, 0.5).setY(1);
      panel.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2;
      this.scene.add(panel);
    }
    const postMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 2.1, 6), postMat, posts.length);
    posts.forEach((p, i) => postMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, 1.05, p.z)));
    postMesh.castShadow = true;
    this.scene.add(postMesh);

    // Trees outside the fence: walnuts and poplars, as round Georgian villages have them.
    const trunks: THREE.Matrix4[] = [];
    const crowns: THREE.Matrix4[] = [];
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2;
      const r = 24 + rand() * 60;
      const x = Math.sin(a) * r;
      const z = Math.cos(a) * r;
      if (Math.abs(x - (-FENCE_X + 3.5)) < 5 && z < -FENCE_Z) continue; // keep the road clear
      const h = 3 + rand() * 4;
      const tall = rand() < 0.3;
      trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h * 0.3, z), new THREE.Quaternion(), new THREE.Vector3(1, h * 0.6, 1)));
      crowns.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h * (tall ? 0.9 : 0.75), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 6, 0)), tall ? new THREE.Vector3(1.1, h * 0.75, 1.1) : new THREE.Vector3(h * 0.45, h * 0.38, h * 0.45)));
    }
    const trunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1, 6), new THREE.MeshStandardMaterial({ color: "#4e3d2c", roughness: 1 }), trunks.length);
    const crownMesh = new THREE.InstancedMesh(crownGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.5 }), crowns.length);
    trunks.forEach((m, i) => trunkMesh.setMatrixAt(i, m));
    crowns.forEach((m, i) => {
      crownMesh.setMatrixAt(i, m);
      crownMesh.setColorAt(i, new THREE.Color().setHSL(0.23 + rand() * 0.06, 0.5, 0.15 + rand() * 0.06));
    });
    trunkMesh.castShadow = crownMesh.castShadow = true;
    this.scene.add(trunkMesh, crownMesh);
  }

  private buildTables() {
    const glass = new THREE.MeshPhysicalMaterial({ map: moduleTexture(), roughness: 0.3, metalness: 0.1, clearcoat: 0.8, clearcoatRoughness: 0.06, envMapIntensity: 0.75 });
    const back = new THREE.MeshStandardMaterial({ color: "#e4e6e8", roughness: 0.8 });
    const alu = new THREE.MeshStandardMaterial({ color: "#c3c8cd", metalness: 0.8, roughness: 0.35 });
    const steel = new THREE.MeshStandardMaterial({ color: "#8d949b", metalness: 0.7, roughness: 0.45 });
    // A module: face up (+y), the long side east–west. Box faces: +x, −x, +y (glass), −y (backsheet), +z, −z.
    const moduleGeo = new THREE.BoxGeometry(MODULE_W, 0.035, MODULE_H);
    const n = PER_ROW * 2;
    for (let r = 0; r < ROWS; r++) {
      const z = (r - (ROWS - 1) / 2) * ROW_GAP;
      const pivot = new THREE.Group();
      pivot.position.set(0, AXIS_H, z);
      const modules = new THREE.InstancedMesh(moduleGeo, [alu, alu, glass, back, alu, alu], n);
      for (let i = 0; i < PER_ROW; i++)
        for (let j = 0; j < 2; j++) {
          const x = (i - (PER_ROW - 1) / 2) * (MODULE_W + 0.02);
          modules.setMatrixAt(i * 2 + j, new THREE.Matrix4().makeTranslation(x, 0.12, (j - 0.5) * (MODULE_H + 0.02)));
        }
      modules.castShadow = true;
      modules.receiveShadow = true;
      // Under the modules: the tube they turn on and two rails.
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, ROW_LEN + 0.4, 12), steel);
      tube.rotation.z = Math.PI / 2;
      const railGeo = new THREE.BoxGeometry(ROW_LEN, 0.06, 0.05);
      const rails = [-0.6, 0.6].map((dz) => {
        const rail = new THREE.Mesh(railGeo, alu);
        rail.position.set(0, 0.07, dz);
        rail.castShadow = true;
        return rail;
      });
      pivot.add(modules, tube, ...rails);
      this.scene.add(pivot);
      this.tables.push(pivot);
      // Posts into the ground every few metres, with a bearing at the top.
      for (let p = 0; p < 4; p++) {
        const x = (p / 3 - 0.5) * (ROW_LEN - 1.2);
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, AXIS_H, 0.1), steel);
        post.position.set(x, AXIS_H / 2, z);
        post.castShadow = true;
        const bearing = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), steel);
        bearing.position.set(x, AXIS_H, z);
        this.scene.add(post, bearing);
      }
    }
  }

  private buildPower(glow: THREE.Texture) {
    // Inverter station: a container on a concrete pad, a transformer beside it.
    const pad = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.2, 4), new THREE.MeshStandardMaterial({ color: "#b9b7b0", roughness: 0.9 }));
    pad.position.copy(STATION).setY(0.1);
    pad.receiveShadow = true;
    const side = stationTexture();
    const white = new THREE.MeshStandardMaterial({ color: "#eceeef", roughness: 0.6 });
    const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.6 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 2.4), [white, white, white, white, sideMat, sideMat]);
    box.position.copy(STATION).add(new THREE.Vector3(-1.2, 1.5, 0));
    box.castShadow = box.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.12, 2.6), new THREE.MeshStandardMaterial({ color: "#b7bcc1", metalness: 0.5, roughness: 0.5 }));
    roof.position.copy(box.position).setY(2.86);
    const tankMat = new THREE.MeshStandardMaterial({ color: "#7f8c8d", metalness: 0.4, roughness: 0.55 });
    const tank = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.6, 1.2), tankMat);
    tank.position.copy(STATION).add(new THREE.Vector3(2.6, 1, 0));
    tank.castShadow = true;
    const fins = new THREE.InstancedMesh(new THREE.BoxGeometry(0.04, 1.2, 0.5), tankMat, 10);
    for (let i = 0; i < 10; i++) fins.setMatrixAt(i, new THREE.Matrix4().makeTranslation(tank.position.x - 0.6 + i * 0.13, 0.95, tank.position.z + 0.85));
    const insulatorMat = new THREE.MeshStandardMaterial({ color: "#8a5a3c", roughness: 0.4 });
    const bushings = [-0.45, 0, 0.45].map((dx) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 8), insulatorMat);
      b.position.copy(tank.position).add(new THREE.Vector3(dx, 1.05, 0));
      return b;
    });
    this.scene.add(pad, box, roof, tank, fins, ...bushings);

    // The power line: concrete poles with a crossarm and three insulators, wires sagging between them.
    const concrete = new THREE.MeshStandardMaterial({ color: "#a8a59d", roughness: 0.9 });
    const armMat = new THREE.MeshStandardMaterial({ color: "#5d6166", metalness: 0.6, roughness: 0.5 });
    const glassIns = new THREE.MeshStandardMaterial({ color: "#7fb3a0", roughness: 0.15, metalness: 0.1 });
    const tips: THREE.Vector3[][] = [[], [], []];
    const start = tank.position.clone().setY(1.3);
    for (const p of POLES) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, POLE_H, 8), concrete);
      pole.position.copy(p).setY(POLE_H / 2);
      pole.castShadow = true;
      const dir = new THREE.Vector3(-1, 0, -0.32).normalize();
      const across = new THREE.Vector3(-dir.z, 0, dir.x);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), armMat);
      arm.position.copy(p).setY(POLE_H - 0.5);
      arm.rotation.y = Math.atan2(-across.z, across.x);
      this.scene.add(pole, arm);
      [-1, 0, 1].forEach((k, w) => {
        const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.35, 8), glassIns);
        const at = p.clone().addScaledVector(across, k * 1.05).setY(POLE_H - 0.25);
        ins.position.copy(at);
        this.scene.add(ins);
        tips[w].push(at.clone().setY(POLE_H - 0.05));
      });
    }
    // Two more spans run off towards the town.
    const far = POLES[2].clone().add(new THREE.Vector3(-30, 0, -9.6));
    const wireMat = new THREE.MeshStandardMaterial({ color: "#3b3f44", metalness: 0.6, roughness: 0.4 });
    const sag = (a: THREE.Vector3, b: THREE.Vector3, drop: number) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        pts.push(a.clone().lerp(b, t).add(new THREE.Vector3(0, -drop * 4 * t * (1 - t), 0)));
      }
      return pts;
    };
    tips.forEach((line, w) => {
      const pts = [...sag(start.clone().add(new THREE.Vector3((w - 1) * 0.45, 0, 0)), line[0], 0.6)];
      for (let i = 0; i + 1 < line.length; i++) pts.push(...sag(line[i], line[i + 1], 0.7).slice(1));
      const end = line[line.length - 1];
      pts.push(...sag(end, far.clone().add(end.clone().sub(POLES[2]).setY(0)).setY(POLE_H - 0.05), 0.8).slice(1));
      const curve = new THREE.CatmullRomCurve3(pts);
      const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 3, 0.018, 5), wireMat);
      this.scene.add(wire);
      if (w === 1) this.wire = curve;
    });
    // Glowing pulses run along the middle wire: faster with more power.
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: "#ffd166", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.scale.setScalar(0.7);
      this.pulses.push(s);
      this.scene.add(s);
    }
  }

  /** Sun elevation and panel tilt in degrees; `share`: 0..1 of the best possible output (how fast the current runs). */
  set(elevation: number, tilt: number, share: number) {
    const e = THREE.MathUtils.degToRad(elevation);
    const dir = this.sunDir.set(0, Math.sin(e), Math.cos(e));
    if (Math.abs(elevation - this.elevation) > 0.01) this.envDirty = true;
    this.elevation = elevation;
    for (const s of [this.sky, this.envSky]) s.material.uniforms.sunPosition.value.copy(dir);
    this.sunGlow.position.copy(dir).multiplyScalar(600);
    this.sunGlow.visible = elevation > -1;
    this.sunLight.position.copy(dir).multiplyScalar(45);
    const day = THREE.MathUtils.smoothstep(elevation, 0, 25);
    this.sunLight.intensity = elevation > 0 ? 0.8 + 3.4 * Math.sin(e) ** 0.6 : 0;
    this.sunLight.color.set("#ffb36b").lerp(new THREE.Color("#fff4e2"), day);
    this.scene.fog!.color.set("#d9b48f").lerp(new THREE.Color("#c8d6e2"), day);
    this.renderer.toneMappingExposure = 0.5 + 0.1 * day;

    const b = THREE.MathUtils.degToRad(tilt);
    for (const p of this.tables) p.rotation.x = b;
    this.power = share;

    // Arrows on the middle of the front (southern) row.
    const front = this.tables[ROWS - 1];
    const normal = new THREE.Vector3(0, Math.cos(b), Math.sin(b));
    const centre = front.position.clone().addScaledVector(normal, 0.16).add(new THREE.Vector3(MODULE_W / 2, 0, 0));
    this.normalArrow.position.copy(centre);
    this.normalArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    this.beamArrow.position.copy(centre).addScaledVector(dir, 2.2);
    this.beamArrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    this.beamArrow.visible = elevation > 0;
    this.labels.normal.copy(centre).addScaledVector(normal, 2.6);
    // The table's lower (southern) edge, at the end of the row facing the camera.
    this.labels.tilt.copy(front.position).add(new THREE.Vector3(ROW_LEN / 2 + 0.3, -Math.sin(b) * (MODULE_H + 0.1) - 0.2, Math.cos(b) * (MODULE_H + 0.1)));


    // Parallel sunbeams onto the front two rows (the sun is that far away).
    const up = new THREE.Vector3(0, 1, 0);
    this.beams.forEach((beam, i) => {
      const row = this.tables[ROWS - 1 - (i % 2)];
      const hit = row.position.clone().addScaledVector(normal, 0.14).add(new THREE.Vector3((i - 2) * 2.6 - 0.6, 0, 0));
      const len = 26;
      beam.scale.set(1, len, 1);
      beam.position.copy(hit).addScaledVector(dir, len / 2);
      beam.quaternion.setFromUnitVectors(up, dir);
      beam.visible = elevation > 0;
      if (i === 2) this.sunHit.copy(hit);
    });
  }

  /** Fly the camera to a view (`instant`: be there at once). */
  view(name: SolarView, instant = false) {
    const to = SOLAR_VIEWS[name];
    if (instant || this.reduceMotion) {
      this.flight = null;
      this.camera.position.copy(to[0]);
      this.controls.target.copy(to[1]);
      return;
    }
    this.flight = { from: [this.camera.position.clone(), this.controls.target.clone()], to, start: performance.now() };
  }

  private updateEnvironment() {
    this.envTarget?.dispose();
    this.envTarget = this.pmrem.fromScene(this.envScene, 0, 0.1, 200, { size: 128 });
    this.scene.environment = this.envTarget.texture;
    this.envDirty = false;
    this.envAt = performance.now();
  }

  private project = (p: THREE.Vector3) => {
    this.v.copy(p).project(this.camera);
    return { x: ((this.v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - this.v.y) / 2) * this.canvas.clientHeight, visible: this.v.z < 1 };
  };

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const now = performance.now();
    const t = this.reduceMotion ? 0 : now / 1000;
    // The reflections follow the sky, a few times a second at most while a slider moves.
    if (this.envDirty && now - this.envAt > 180) this.updateEnvironment();
    this.sky.material.uniforms.time.value = t;
    this.beamMat.uniforms.uTime.value = t;
    this.pulses.forEach((p, i) => {
      const u = (t * (0.03 + 0.12 * this.power) + i / this.pulses.length) % 1;
      p.visible = this.power > 0.02;
      this.wire.getPointAt(u, p.position);
    });
    if (this.flight) {
      const k = Math.min(1, (now - this.flight.start) / 1800);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      this.camera.position.lerpVectors(this.flight.from[0], this.flight.to[0], e);
      this.controls.target.lerpVectors(this.flight.from[1], this.flight.to[1], e);
      if (k >= 1) this.flight = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    // The sun itself is out of the picture: its label goes up the middle beam as far as the frame allows.
    for (let k = 10; k >= 2; k -= 0.5) {
      this.labels.sun.copy(this.sunHit).addScaledVector(this.sunDir, k);
      this.v.copy(this.labels.sun).project(this.camera);
      if (this.v.y < 0.66 && Math.abs(this.v.x) < 0.75) break;
    }
    this.onFrame?.(this.project, this.labels);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.envTarget?.dispose();
    this.pmrem.dispose();
    for (const root of [this.scene, this.envScene])
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        mesh.geometry?.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        for (const mat of mats) {
          const m = mat as THREE.MeshStandardMaterial;
          m.map?.dispose();
          m.alphaMap?.dispose();
          mat.dispose();
        }
      });
    this.renderer.dispose();
  }
}
