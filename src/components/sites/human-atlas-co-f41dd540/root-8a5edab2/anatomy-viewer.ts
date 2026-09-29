import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { animGroup, animationAnchors, type AnimGroup } from "./anatomy-groups";
import {
  IDENTITY_SLOT,
  SEGMENTS,
  anglesToQuaternion,
  buildRig,
  evaluatePose,
  groundOffset,
  removeBridgeTriangles,
  skinWeights,
  solveSegments,
  type PoseKey,
  type Rig,
  type Segment,
} from "./rig";
import {
  MODEL_BASE,
  SELECTED_GLOW,
  SYSTEMS,
  type AtlasManifest,
  type AtlasPart,
  type SystemKey,
} from "./atlas-data";

export type ViewName = "threeQuarter" | "front" | "side" | "back";
export type HeartPhase = "atria" | "ventricles" | "relax";
export type BreathPhase = "inhale" | "exhale";

export interface AnimationSettings {
  heartbeat: boolean;
  breathing: boolean;
  bloodFlow: boolean;
  bpm: number;
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const BODY_CENTER = new THREE.Vector3(0, 0.87, 0);
const BODY_HALF_HEIGHT = 0.97;
const FOV = 30;
const VIEW_AZIMUTH: Record<ViewName, number> = {
  threeQuarter: THREE.MathUtils.degToRad(14),
  front: 0,
  side: Math.PI / 2,
  back: Math.PI,
};
const HOME_POLAR = THREE.MathUtils.degToRad(85);

/** Camera framing per pose: raised arms need more headroom, sitting/squatting sit lower. */
const POSE_FRAME: Partial<Record<PoseKey, { centerY: number; halfHeight: number }>> = {
  armsUp: { centerY: 1.02, halfHeight: 1.13 },
  wave: { centerY: 0.98, halfHeight: 1.08 },
  jumpingJack: { centerY: 1.02, halfHeight: 1.13 },
  sitting: { centerY: 0.62, halfHeight: 0.72 },
  squat: { centerY: 0.5, halfHeight: 0.68 },
  squatExercise: { centerY: 0.72, halfHeight: 0.92 },
  bendForward: { centerY: 0.7, halfHeight: 0.8 },
};
const BREATH_PERIOD = 4.8;

interface PartMesh {
  part: AtlasPart;
  group: AnimGroup;
  segment: Segment;
  mesh: THREE.Mesh;
  centroid: THREE.Vector3;
  jitter: THREE.Vector3;
  explodeOffset: THREE.Vector3;
  /** Bones move as one rigid piece; everything else is skinned per vertex in the shader. */
  rigid: boolean;
}

interface CameraTween {
  from: { target: THREE.Vector3; position: THREE.Vector3 };
  to: { target: THREE.Vector3; position: THREE.Vector3 };
  start: number;
  duration: number;
}

type MaterialState = "base" | "hover" | "selected" | "cut";

export interface ViewerCallbacks {
  onHover: (part: AtlasPart | null, x: number, y: number) => void;
  /** Single click: select without moving the camera. */
  onPick: (part: AtlasPart | null) => void;
  /** Double click: select and fly to the part. */
  onFocus: (part: AtlasPart) => void;
  onPhase: (heart: HeartPhase | null, breath: BreathPhase | null) => void;
}

function hashUnit(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

async function fetchChunk(path: string): Promise<ArrayBuffer> {
  const res = await fetch(`${MODEL_BASE}/${path}`);
  if (!res.ok || !res.body) throw new Error(`Failed to load ${path}`);
  // Chunks are stored as raw .gz files and served without Content-Encoding, so inflate client-side.
  const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

/** Soft mint studio backdrop, drawn once into a texture used as the scene background. */
function makeBackdrop(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 512;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#f7f8f8");
  grad.addColorStop(0.5, "#eef1f0");
  grad.addColorStop(0.54, "#e7ebea");
  grad.addColorStop(1, "#dfe4e2");
  g.fillStyle = grad;
  g.fillRect(0, 0, 16, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Radial blob used as a soft contact shadow under the feet. */
function makeContactShadow(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d") as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(22, 64, 56, 0.4)");
  grad.addColorStop(0.35, "rgba(22, 64, 56, 0.16)");
  grad.addColorStop(1, "rgba(22, 64, 56, 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeTissue(system: SystemKey): THREE.MeshPhysicalMaterial {
  const s = SYSTEMS.find((x) => x.key === system);
  if (!s) throw new Error(system);
  const m = s.material;
  return new THREE.MeshPhysicalMaterial({
    color: s.tissue,
    roughness: m.roughness,
    metalness: 0,
    clearcoat: m.clearcoat,
    clearcoatRoughness: m.clearcoatRoughness,
    sheen: m.sheen ?? 0,
    sheenColor: new THREE.Color(m.sheenColor ?? "#ffffff"),
    sheenRoughness: 0.45,
    specularIntensity: m.specular ?? 0.6,
    envMapIntensity: m.env ?? 0.9,
  });
}

// ---- Animation shader chunks --------------------------------------------------------------------

const VERTEX_HEADER = /* glsl */ `
uniform vec4 uAnim;      // x atrial squeeze, y ventricular squeeze, z breath, w unused
uniform vec3 uHeartC;
uniform vec3 uLungL;
uniform vec3 uLungR;
uniform vec3 uChest;
uniform mat4 uSeg[16];
attribute vec4 aSegI;
attribute vec4 aSegW;
varying vec3 vAnimPos;
`;

const VERTEX_DEFORM = /* glsl */ `
vAnimPos = position;
#if ANIM_GROUP == 1
  transformed = uHeartC + (transformed - uHeartC) * (1.0 - 0.11 * uAnim.x);
#elif ANIM_GROUP == 2
  vec3 hd = transformed - uHeartC;
  transformed = uHeartC + hd * vec3(1.0 - 0.1 * uAnim.y, 1.0 - 0.07 * uAnim.y, 1.0 - 0.1 * uAnim.y);
#elif ANIM_GROUP == 3
  vec3 lc = transformed.x > 0.0 ? uLungL : uLungR;
  transformed = lc + (transformed - lc) * vec3(1.0 + 0.08 * uAnim.z, 1.0 + 0.06 * uAnim.z, 1.0 + 0.09 * uAnim.z);
#elif ANIM_GROUP == 4
  float dome = 1.0 - smoothstep(0.0, 0.16, length(transformed.xz - uChest.xz));
  transformed.y -= (0.012 + 0.018 * dome) * uAnim.z;
#elif ANIM_GROUP == 5
  transformed.xz = uChest.xz + (transformed.xz - uChest.xz) * (1.0 + 0.035 * uAnim.z);
  transformed.y += 0.007 * uAnim.z;
#elif ANIM_GROUP == 8
  // The simplified skin sits slightly inside some superficial vessels; push it out so it covers them.
  transformed += normalize(normal) * 0.0055;
#endif
// Soft-tissue skinning: blend the posed body-segment matrices.
transformed = (segM * vec4(transformed, 1.0)).xyz;
`;

const VERTEX_SKIN_NORMAL = /* glsl */ `
float segSum = max(aSegW.x + aSegW.y + aSegW.z + aSegW.w, 1e-4);
mat4 segM = (uSeg[int(aSegI.x)] * aSegW.x + uSeg[int(aSegI.y)] * aSegW.y
          + uSeg[int(aSegI.z)] * aSegW.z + uSeg[int(aSegI.w)] * aSegW.w) / segSum;
objectNormal = normalize(mat3(segM) * objectNormal);
`;

const FRAGMENT_HEADER = /* glsl */ `
uniform vec3 uHeartC;
uniform vec2 uFlow;      // x enabled (0..1), y beats elapsed
varying vec3 vAnimPos;
`;

const FRAGMENT_FLOW = /* glsl */ `
#if ANIM_GROUP == 6 || ANIM_GROUP == 7
  float fd = length(vAnimPos - uHeartC);
  #if ANIM_GROUP == 6
    float fw = fract(fd * 3.2 - uFlow.y);
    vec3 flowColor = vec3(1.0, 0.36, 0.26);
  #else
    float fw = fract(fd * 3.2 + uFlow.y * 0.85);
    vec3 flowColor = vec3(0.36, 0.66, 1.0);
  #endif
  float pulse = smoothstep(0.0, 0.07, fw) * (1.0 - smoothstep(0.07, 0.32, fw));
  totalEmissiveRadiance += flowColor * pulse * uFlow.x * 0.75;
#endif
`;

export class AnatomyViewer {
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private gtao: GTAOPass;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private parts = new Map<string, PartMesh>();
  private materials = new Map<string, THREE.MeshPhysicalMaterial>();
  private disposables: { dispose: () => void }[] = [];
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private selected = new Set<string>();
  private hovered: string | null = null;
  private explode = 0;
  private dirty = true;
  private frame = 0;
  private tween: CameraTween | null = null;
  private resizeObserver: ResizeObserver;
  private downAt: { x: number; y: number; t: number } | null = null;
  private hoverQueued: { x: number; y: number } | null = null;
  private disposed = false;

  // Screen-space framing: the model is centred in the area not covered by panels.
  private insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private offset = new THREE.Vector2();
  private offsetTarget = new THREE.Vector2();

  // Animation state.
  private anim: AnimationSettings = { heartbeat: false, breathing: false, bloodFlow: false, bpm: 72 };
  private beats = 0;
  private breathT = 0;
  private lastTick = performance.now();
  private lastPhase: { heart: HeartPhase | null; breath: BreathPhase | null } = { heart: null, breath: null };
  // Skeleton rig / poses.
  private rig: Rig | null = null;
  private pose: PoseKey = "standing";
  private poseTime = 0;
  private rigActive = false;
  private lastRigTick = performance.now();
  private rootOffset = new THREE.Vector3();
  private segRot = Object.fromEntries(SEGMENTS.map((s) => [s, new THREE.Quaternion()])) as Record<Segment, THREE.Quaternion>;
  private segMatrix = Object.fromEntries(SEGMENTS.map((s) => [s, new THREE.Matrix4()])) as Record<Segment, THREE.Matrix4>;
  private tmpQuat = new THREE.Quaternion();

  // Deep-dive cutaway: a camera-facing clipping plane through the chosen structure.
  private cutIds = new Set<string>();
  private cutDepth = 0.5;
  private cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  private cutBox = new THREE.Box3();
  private cutColor = new THREE.Color("#b8453d");

  private uniforms = {
    uAnim: { value: new THREE.Vector4() },
    uHeartC: { value: new THREE.Vector3(0.02, 1.305, 0.025) },
    uLungL: { value: new THREE.Vector3(0.08, 1.3, 0) },
    uLungR: { value: new THREE.Vector3(-0.08, 1.3, 0) },
    uChest: { value: new THREE.Vector3(0, 1.25, 0.02) },
    uFlow: { value: new THREE.Vector2() },
    uSeg: { value: [] as THREE.Matrix4[] },
  };

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: ViewerCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.localClippingEnabled = true;

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 60);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.8;
    this.controls.panSpeed = 0.6;
    this.controls.zoomToCursor = true;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 0.12;
    this.controls.maxDistance = 10;
    // Never flip over the top or dive under the floor.
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(12);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(100);
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.controls.addEventListener("change", () => (this.dirty = true));
    this.controls.addEventListener("start", () => (this.tween = null));

    // Studio reflections give the tissue its moist, glossy highlights.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.03);
    this.scene.environment = envTarget.texture;
    this.scene.environmentIntensity = 0.62;
    pmrem.dispose();
    const backdrop = makeBackdrop();
    this.scene.background = backdrop;
    this.disposables.push(envTarget, backdrop);

    this.uniforms.uSeg.value = [...SEGMENTS.map((seg) => this.segMatrix[seg]), new THREE.Matrix4()];
    this.buildStage();
    this.scene.add(this.root);

    // Post-processing: multisampled render → ambient occlusion → tone mapping/output.
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.gtao = new GTAOPass(this.scene, this.camera, 1, 1);
    this.gtao.updateGtaoMaterial({ radius: 0.12, distanceExponent: 1.6, thickness: 1.6, scale: 1.4, samples: 16 });
    this.gtao.updatePdMaterial({ radius: 6, rings: 2, samples: 12 });
    this.gtao.blendIntensity = 1;
    this.composer.addPass(this.gtao);
    this.composer.addPass(new OutputPass());

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.placeCamera(BODY_CENTER, VIEW_AZIMUTH.threeQuarter, HOME_POLAR, this.homeDistance());

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("dblclick", this.onDoubleClick);
    canvas.addEventListener("contextmenu", this.onContextMenu);

    this.loop();
  }

  private buildStage() {
    const hemi = new THREE.HemisphereLight("#ffffff", "#c8d0cd", 0.35);
    const key = new THREE.DirectionalLight("#fff4ea", 2.1);
    key.position.set(1.8, 3.4, 2.8);
    const fill = new THREE.DirectionalLight("#e4fbf4", 0.35);
    fill.position.set(-2.6, 1.2, 1.2);
    const rim = new THREE.DirectionalLight("#ffffff", 1.1);
    rim.position.set(-0.6, 2.4, -3.2);
    this.scene.add(hemi, key, fill, rim);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 96),
      new THREE.MeshBasicMaterial({ color: "#f3f5f4", transparent: true, opacity: 0.9, depthWrite: false }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.006;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.493, 0.5, 128),
      new THREE.MeshBasicMaterial({ color: "#c9d1ce", transparent: true, opacity: 0.9, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.005;
    const shadowTex = makeContactShadow();
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.42),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.004;
    this.disposables.push(shadowTex);
    this.scene.add(disc, ring, shadow);
  }

  // ---- Materials -------------------------------------------------------------------------------

  private material(system: SystemKey, group: AnimGroup, state: MaterialState): THREE.MeshPhysicalMaterial {
    const key = `${system}|${group}|${state}`;
    const cached = this.materials.get(key);
    if (cached) return cached;
    const m = makeTissue(system);
    const tissue = SYSTEMS.find((s) => s.key === system)?.tissue ?? "#ffffff";
    if (state === "hover") {
      m.emissive = new THREE.Color(tissue);
      m.emissiveIntensity = 0.22;
    } else if (state === "selected") {
      // Keep the real tissue color; add a faint mint glow and a mint edge sheen.
      m.emissive = new THREE.Color(SELECTED_GLOW);
      m.emissiveIntensity = 0.1;
      m.sheen = 1;
      m.sheenRoughness = 0.3;
      m.sheenColor = new THREE.Color("#5ff2cf");
    }
    if (group === 8) {
      // Win depth ties against structures lying exactly on the body surface.
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -2;
    }
    this.injectAnimation(m, group);
    if (state === "cut") this.wrapCut(m);
    this.materials.set(key, m);
    return m;
  }

  /** Clip with the cut plane and tint the exposed inside faces with the tissue's section colour. */
  private wrapCut(m: THREE.MeshPhysicalMaterial) {
    m.clippingPlanes = [this.cutPlane];
    m.side = THREE.DoubleSide;
    const cutColor = this.cutColor;
    const animate = m.onBeforeCompile;
    const baseKey = m.customProgramCacheKey();
    m.customProgramCacheKey = () => `${baseKey}-cut`;
    m.onBeforeCompile = (shader, renderer) => {
      animate.call(m, shader, renderer);
      shader.uniforms.uCutColor = { value: cutColor };
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uCutColor;")
        .replace("#include <color_fragment>", "#include <color_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = uCutColor * 0.85;");
    };
  }

  /** Deep-dive cutaway through the given parts; depth 0 = untouched, 1 = cut past the centre. */
  setCut(ids: string[] | null, depth = 0.5, color?: string) {
    const prev = this.cutIds;
    this.cutIds = new Set(ids ?? []);
    this.cutDepth = depth;
    if (color) this.cutColor.set(color);
    const box = new THREE.Box3();
    for (const id of this.cutIds) {
      const entry = this.parts.get(id);
      if (entry?.mesh.geometry.boundingBox) box.union(entry.mesh.geometry.boundingBox.clone().applyMatrix4(entry.mesh.matrix));
    }
    if (!box.isEmpty()) this.cutBox.copy(box);
    for (const id of new Set([...prev, ...this.cutIds])) {
      const entry = this.parts.get(id);
      if (entry) this.applyMaterial(entry);
    }
    this.gtao.enabled = this.cutIds.size === 0 && this.pose === "standing" && !this.rigActive;
    this.updateCutPlane();
    this.dirty = true;
  }

  private updateCutPlane() {
    if (!this.cutIds.size || this.cutBox.isEmpty()) return;
    // Plane faces away from the camera; everything nearer the viewer than it is clipped away.
    // Depth is measured along the view direction: 0 = front surface, 1 = back surface.
    const n = this.controls.target.clone().sub(this.camera.position).normalize();
    const { min, max } = this.cutBox;
    let near = Infinity;
    let far = -Infinity;
    for (let i = 0; i < 8; i++) {
      const d = n.x * (i & 1 ? max.x : min.x) + n.y * (i & 2 ? max.y : min.y) + n.z * (i & 4 ? max.z : min.z);
      near = Math.min(near, d);
      far = Math.max(far, d);
    }
    const depth = near + (far - near) * this.cutDepth;
    this.cutPlane.set(n, -depth);
  }

  private injectAnimation(m: THREE.MeshPhysicalMaterial, group: AnimGroup) {
    m.defines = { ...(m.defines ?? {}), ANIM_GROUP: group };
    m.customProgramCacheKey = () => `anim-${group}`;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VERTEX_HEADER}`)
        .replace("#include <skinnormal_vertex>", `#include <skinnormal_vertex>\n${VERTEX_SKIN_NORMAL}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERTEX_DEFORM}`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${FRAGMENT_HEADER}`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${FRAGMENT_FLOW}`);
    };
  }

  // ---- Loading ---------------------------------------------------------------------------------

  async load(manifest: AtlasManifest, onProgress: (done: number, total: number) => void) {
    this.rig = buildRig(manifest);
    const anchors = animationAnchors(manifest);
    this.uniforms.uHeartC.value.set(...anchors.heart);
    this.uniforms.uLungL.value.set(...anchors.lungL);
    this.uniforms.uLungR.value.set(...anchors.lungR);
    this.uniforms.uChest.value.set(...anchors.chest);

    const byChunk = new Map<number, AtlasPart[]>();
    for (const p of manifest.parts) {
      const list = byChunk.get(p.chunk) ?? [];
      list.push(p);
      byChunk.set(p.chunk, list);
    }
    const total = manifest.chunks.length;
    let done = 0;
    onProgress(0, total);

    const queue = manifest.chunks.map((c, i) => ({ path: c.gzip.split("/").pop() as string, index: i }));
    const worker = async () => {
      while (queue.length && !this.disposed) {
        const job = queue.shift();
        if (!job) return;
        const buffer = await fetchChunk(job.path);
        if (this.disposed) return;
        for (const part of byChunk.get(job.index) ?? []) this.addPart(part, buffer);
        done += 1;
        onProgress(done, total);
        this.dirty = true;
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  private addPart(part: AtlasPart, buffer: ArrayBuffer) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(buffer, part.positions, part.vertexCount * 3);
    const normals = new Int16Array(buffer.slice(part.normals, part.normals + part.vertexCount * 6));
    const indices = new Uint32Array(buffer, part.indices, part.indexCount);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3, true));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const rigid = part.system === "skeletal" || !this.rig;
    if (rigid) {
      const idx = new Uint8Array(part.vertexCount * 4).fill(IDENTITY_SLOT);
      const wts = new Uint8Array(part.vertexCount * 4);
      for (let i = 0; i < part.vertexCount; i++) wts[i * 4] = 255;
      geometry.setAttribute("aSegI", new THREE.BufferAttribute(idx, 4));
      geometry.setAttribute("aSegW", new THREE.BufferAttribute(wts, 4, true));
    } else if (this.rig) {
      const { index, weight } = skinWeights(this.rig, positions);
      geometry.setAttribute("aSegI", new THREE.BufferAttribute(index, 4));
      geometry.setAttribute("aSegW", new THREE.BufferAttribute(weight, 4, true));
      const cleaned = removeBridgeTriangles(indices, index, weight);
      if (cleaned !== indices) geometry.setIndex(new THREE.BufferAttribute(cleaned, 1));
    }
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    // Animated parts grow slightly; keep them from being culled at the edge of the view.
    if (geometry.boundingSphere) geometry.boundingSphere.radius *= 1.15;

    const [min, max] = part.bounds;
    const centroid = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    const group = animGroup(part);
    const mesh = new THREE.Mesh(geometry, this.material(part.system, group, "base"));
    mesh.userData.partId = part.id;
    mesh.matrixAutoUpdate = false;
    // Skinned vertices can leave the rest-pose bounds, so never cull soft tissue.
    if (!rigid) mesh.frustumCulled = false;
    const entry: PartMesh = {
      part,
      group,
      segment: this.rig ? this.rig.segmentOf(part) : "root",
      mesh,
      centroid,
      jitter: new THREE.Vector3(hashUnit(part.id, 1), hashUnit(part.id, 2), hashUnit(part.id, 3)),
      explodeOffset: new THREE.Vector3(),
      rigid,
    };
    this.parts.set(part.id, entry);
    this.applyExplode(entry);
    this.applyMaterial(entry);
    mesh.visible = this.visibility ? this.visibility.has(part.id) : true;
    this.root.add(mesh);
  }

  // ---- State from React ------------------------------------------------------------------------

  private visibility: Set<string> | null = null;

  setVisible(ids: Set<string>) {
    this.visibility = ids;
    for (const [id, entry] of this.parts) entry.mesh.visible = ids.has(id);
    if (this.hovered && !ids.has(this.hovered)) this.setHovered(null);
    this.dirty = true;
  }

  setSelected(ids: string[]) {
    const prev = this.selected;
    this.selected = new Set(ids);
    for (const id of new Set([...prev, ...ids])) {
      const entry = this.parts.get(id);
      if (entry) this.applyMaterial(entry);
    }
    this.dirty = true;
  }

  setAnimation(settings: AnimationSettings) {
    this.anim = settings;
    this.lastTick = performance.now();
    const animating = settings.heartbeat || settings.breathing || settings.bloodFlow;
    // Keep motion smooth on school laptops: render a little softer while animating.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, animating ? 1.5 : 2));
    this.resize();
    if (!animating) {
      this.uniforms.uAnim.value.set(0, 0, 0, 0);
      this.uniforms.uFlow.value.set(0, this.beats);
      this.emitPhase(null, null);
    }
    this.dirty = true;
  }

  /** Pixels covered by UI on each side; the model is centred in what is left. */
  setInsets(insets: Insets) {
    this.insets = insets;
    this.offsetTarget.set((insets.left - insets.right) / 2, (insets.top - insets.bottom) / 2);
    this.dirty = true;
  }

  private applyMaterial(entry: PartMesh) {
    const id = entry.part.id;
    const state: MaterialState = this.cutIds.has(id)
      ? "cut"
      : this.selected.has(id)
        ? "selected"
        : this.hovered === id
          ? "hover"
          : "base";
    entry.mesh.material = this.material(entry.part.system, entry.group, state);
  }

  private updatePartMatrix(entry: PartMesh) {
    const o = entry.explodeOffset;
    entry.mesh.matrix.makeTranslation(o.x, o.y, o.z);
    if (entry.rigid) entry.mesh.matrix.multiply(this.segMatrix[entry.segment]);
    entry.mesh.matrixWorldNeedsUpdate = true;
  }

  private applyExplode(entry: PartMesh) {
    const t = this.explode;
    const c = entry.centroid;
    entry.explodeOffset.set(
      ((c.x - BODY_CENTER.x) * 7 + entry.jitter.x * 0.22) * t,
      ((c.y - BODY_CENTER.y) * 0.45 + entry.jitter.y * 0.12) * t,
      ((c.z - BODY_CENTER.z) * 7 + entry.jitter.z * 0.22) * t,
    );
    this.updatePartMatrix(entry);
  }

  /** Move the skeleton into a pose (animated poses loop until another pose is chosen). */
  setPose(key: PoseKey) {
    this.pose = key;
    this.poseTime = 0;
    this.rigActive = true;
    this.lastRigTick = performance.now();
    this.dirty = true;
  }

  private tickRig(now: number) {
    if (!this.rig || !this.rigActive) {
      this.lastRigTick = now;
      return false;
    }
    const dt = Math.min(0.1, (now - this.lastRigTick) / 1000);
    this.lastRigTick = now;
    this.poseTime += dt;
    const target = evaluatePose(this.pose, this.poseTime);
    // Critically-damped approach: smooth transitions between poses and smooth looping motion.
    const k = 1 - Math.exp(-dt * 9);
    let settled = true;
    for (const seg of SEGMENTS) {
      anglesToQuaternion(target[seg], this.tmpQuat);
      const q = this.segRot[seg];
      if (q.angleTo(this.tmpQuat) > 0.0015) settled = false;
      q.slerp(this.tmpQuat, k);
    }
    this.rootOffset.set(0, 0, 0);
    solveSegments(this.rig, this.segRot, this.rootOffset, this.segMatrix);
    this.rootOffset.y = groundOffset(this.rig, this.segMatrix);
    solveSegments(this.rig, this.segRot, this.rootOffset, this.segMatrix);
    for (const entry of this.parts.values()) this.updatePartMatrix(entry);
    const animated = this.pose === "walk" || this.pose === "wave" || this.pose === "jumpingJack" || this.pose === "squatExercise";
    if (settled && !animated) this.rigActive = false;
    // The AO pass renders the rest-pose geometry, so it is only correct when standing still.
    this.gtao.enabled = this.pose === "standing" && settled && this.cutIds.size === 0;
    return true;
  }

  setExplode(value: number) {
    this.explode = value;
    for (const entry of this.parts.values()) this.applyExplode(entry);
    this.dirty = true;
  }

  // ---- Camera ----------------------------------------------------------------------------------

  private placeCamera(target: THREE.Vector3, azimuth: number, polar: number, distance: number) {
    this.camera.position.copy(this.spherical(target, azimuth, polar, distance));
    this.controls.target.copy(target);
    this.controls.update();
    this.dirty = true;
  }

  private animateTo(target: THREE.Vector3, position: THREE.Vector3, duration = 800) {
    this.tween = {
      from: { target: this.controls.target.clone(), position: this.camera.position.clone() },
      to: { target: target.clone(), position: position.clone() },
      start: performance.now(),
      duration,
    };
    this.dirty = true;
  }

  private spherical(target: THREE.Vector3, azimuth: number, polar: number, distance: number) {
    return new THREE.Vector3().setFromSphericalCoords(distance, polar, azimuth).add(target);
  }

  /** Visible area (px) once the UI insets are removed. */
  private freeArea() {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const fw = Math.max(160, w - this.insets.left - this.insets.right);
    const fh = Math.max(160, h - this.insets.top - this.insets.bottom);
    return { w, h, fw, fh };
  }

  /** Distance at which a sphere/half-height fits inside the free area. */
  private fitDistance(halfHeight: number, halfWidth: number) {
    const { w, h, fw, fh } = this.freeArea();
    const tanV = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const byHeight = (halfHeight / tanV) * (h / fh);
    const byWidth = (halfWidth / (tanV * (w / h))) * (w / fw);
    return Math.max(byHeight, byWidth);
  }

  private homeFrame() {
    const f = POSE_FRAME[this.pose];
    return {
      center: new THREE.Vector3(0, f?.centerY ?? BODY_CENTER.y, 0),
      halfHeight: f?.halfHeight ?? BODY_HALF_HEIGHT,
    };
  }

  private homeDistance() {
    // Zoom out as pieces separate so the exploded cloud still fits.
    const { halfHeight } = this.homeFrame();
    return this.fitDistance(halfHeight, 0.45 + this.explode * 2.4) * 1.04;
  }

  setView(view: ViewName) {
    const { center } = this.homeFrame();
    this.animateTo(center, this.spherical(center, VIEW_AZIMUTH[view], HOME_POLAR, this.homeDistance()));
  }

  rotate(direction: 1 | -1, degrees = 45) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const s = new THREE.Spherical().setFromVector3(offset);
    const next = this.spherical(
      this.controls.target,
      s.theta + direction * THREE.MathUtils.degToRad(degrees),
      s.phi,
      s.radius,
    );
    this.animateTo(this.controls.target, next, 500);
  }

  zoom(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(factor);
    const len = THREE.MathUtils.clamp(offset.length(), this.controls.minDistance, this.controls.maxDistance);
    this.animateTo(this.controls.target, this.controls.target.clone().add(offset.setLength(len)), 350);
  }

  reset() {
    this.setView("threeQuarter");
  }

  frameParts(ids: string[]) {
    const box = new THREE.Box3();
    for (const id of ids) {
      const entry = this.parts.get(id);
      if (!entry?.mesh.geometry.boundingBox) continue;
      box.union(entry.mesh.geometry.boundingBox.clone().applyMatrix4(entry.mesh.matrix));
    }
    if (box.isEmpty()) return;
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(sphere.radius, 0.03);
    const distance = Math.max(0.2, this.fitDistance(r, r) * 1.2);
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.animateTo(sphere.center, sphere.center.clone().add(dir.multiplyScalar(distance)));
  }

  private clampTarget() {
    // Keep the orbit centre on the body so panning can never lose the model.
    const spread = 1 + this.explode * 3;
    const t = this.controls.target;
    t.x = THREE.MathUtils.clamp(t.x, -0.6 * spread, 0.6 * spread);
    t.y = THREE.MathUtils.clamp(t.y, 0, 1.85);
    t.z = THREE.MathUtils.clamp(t.z, -0.5 * spread, 0.5 * spread);
  }

  private applyViewOffset() {
    const { w, h } = this.freeArea();
    this.camera.setViewOffset(w, h, -this.offset.x, -this.offset.y, w, h);
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.applyViewOffset();
    this.dirty = true;
  }

  // ---- Picking ---------------------------------------------------------------------------------

  private pick(clientX: number, clientY: number): PartMesh | null {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const visible = this.root.children.filter((o) => o.visible);
    const hit = this.raycaster.intersectObjects(visible, false)[0];
    if (!hit) return null;
    return this.parts.get(hit.object.userData.partId as string) ?? null;
  }

  private setHovered(id: string | null) {
    if (this.hovered === id) return;
    const prev = this.hovered;
    this.hovered = id;
    for (const pid of [prev, id]) {
      const entry = pid ? this.parts.get(pid) : undefined;
      if (entry) this.applyMaterial(entry);
    }
    this.canvas.style.cursor = id ? "pointer" : "";
    this.dirty = true;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  };

  private onPointerUp = (e: PointerEvent) => {
    const down = this.downAt;
    this.downAt = null;
    if (!down || e.button !== 0) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > 5 || performance.now() - down.t > 500) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (hit) this.callbacks.onPick(hit.part);
  };

  private onDoubleClick = (e: MouseEvent) => {
    const hit = this.pick(e.clientX, e.clientY);
    if (hit) this.callbacks.onFocus(hit.part);
  };

  private onContextMenu = (e: MouseEvent) => e.preventDefault();

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.buttons !== 0) {
      if (this.hovered) {
        this.setHovered(null);
        this.callbacks.onHover(null, 0, 0);
      }
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    this.hoverQueued = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  private onPointerLeave = () => {
    this.hoverQueued = null;
    this.setHovered(null);
    this.callbacks.onHover(null, 0, 0);
  };

  private processHover() {
    const q = this.hoverQueued;
    if (!q) return;
    this.hoverQueued = null;
    const rect = this.canvas.getBoundingClientRect();
    const hit = this.pick(q.x + rect.left, q.y + rect.top);
    this.setHovered(hit?.part.id ?? null);
    this.callbacks.onHover(hit?.part ?? null, q.x, q.y);
  }

  // ---- Animation -------------------------------------------------------------------------------

  private emitPhase(heart: HeartPhase | null, breath: BreathPhase | null) {
    if (heart === this.lastPhase.heart && breath === this.lastPhase.breath) return;
    this.lastPhase = { heart, breath };
    this.callbacks.onPhase(heart, breath);
  }

  private tickAnimation(now: number) {
    const { heartbeat, breathing, bloodFlow, bpm } = this.anim;
    if (!heartbeat && !breathing && !bloodFlow) return false;
    const dt = Math.min(0.1, (now - this.lastTick) / 1000);
    this.lastTick = now;

    let atrial = 0;
    let ventricular = 0;
    let heartPhase: HeartPhase | null = null;
    if (heartbeat || bloodFlow) {
      this.beats += (dt * bpm) / 60;
      const phi = this.beats % 1;
      if (heartbeat) {
        // Cardiac cycle: atrial kick, then ventricular systole, then diastolic filling.
        atrial = phi < 0.14 ? Math.sin((Math.PI * phi) / 0.14) : 0;
        ventricular = phi >= 0.12 && phi < 0.48 ? Math.pow(Math.sin((Math.PI * (phi - 0.12)) / 0.36), 0.8) : 0;
        heartPhase = phi < 0.12 ? "atria" : phi < 0.48 ? "ventricles" : "relax";
      }
    }

    let breath = 0;
    let breathPhase: BreathPhase | null = null;
    if (breathing) {
      this.breathT += dt / BREATH_PERIOD;
      const a = 2 * Math.PI * this.breathT;
      breath = 0.5 - 0.5 * Math.cos(a);
      breathPhase = Math.sin(a) >= 0 ? "inhale" : "exhale";
    }

    this.uniforms.uAnim.value.set(atrial, ventricular, breath, 0);
    this.uniforms.uFlow.value.set(bloodFlow ? 1 : 0, this.beats);
    this.emitPhase(heartPhase, breathPhase);
    return true;
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const now = performance.now();
    if (this.tween) {
      const k = Math.min(1, (now - this.tween.start) / this.tween.duration);
      const e = easeInOutCubic(k);
      this.controls.target.lerpVectors(this.tween.from.target, this.tween.to.target, e);
      this.camera.position.lerpVectors(this.tween.from.position, this.tween.to.position, e);
      if (k >= 1) this.tween = null;
      this.dirty = true;
    }
    if (this.offset.distanceTo(this.offsetTarget) > 0.5) {
      this.offset.lerp(this.offsetTarget, 0.14);
      this.applyViewOffset();
      this.dirty = true;
    }
    this.controls.update();
    this.clampTarget();
    this.updateCutPlane();
    this.processHover();
    if (this.tickRig(now)) this.dirty = true;
    if (this.tickAnimation(now)) this.dirty = true;
    else this.lastTick = now;
    if (this.dirty) {
      this.dirty = false;
      this.composer.render();
    }
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("dblclick", this.onDoubleClick);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.controls.dispose();
    for (const { mesh } of this.parts.values()) mesh.geometry.dispose();
    for (const m of this.materials.values()) m.dispose();
    for (const d of this.disposables) d.dispose();
    this.gtao.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }
}
