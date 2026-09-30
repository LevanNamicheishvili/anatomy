import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { animGroup, animationAnchors, type AnimGroup } from "./anatomy-groups";
import {
  IDENTITY_SLOT,
  SEGMENTS,
  anglesToQuaternion,
  buildRig,
  evaluatePose,
  groundOffset,
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
const IDENTITY = new THREE.Matrix4();
const TRANSLUCENT = /^(upper|middle|lower) lobe of (right|left) lung$/i;

interface SkinEntry {
  /** Byte offset of 4×Uint8 segment indices, followed by 4×Uint8 weights, per vertex. */
  o: number;
  /** Optional Uint8 per-vertex skin push-out (0.1 mm units). */
  f?: number;
  /** Optional replacement triangle list (Uint32) for the body surface. */
  i?: number;
  n?: number;
}

interface SkinManifest {
  version: number;
  files: string[];
  parts: Record<string, SkinEntry>;
}

interface PartMesh {
  part: AtlasPart;
  group: AnimGroup;
  segment: Segment;
  mesh: THREE.Mesh;
  centroid: THREE.Vector3;
  jitter: THREE.Vector3;
  explodeOffset: THREE.Vector3;
  /** Everything moves as one rigid piece with its body segment except the body surface (skinned). */
  rigid: boolean;
  /** Drawn see-through (the lung lobes, so the bronchial tree inside stays visible). */
  translucent: boolean;
  /** Colour id in the picking pass. */
  pickId: number;
  /** Skinned parts: the rest-pose bounds and the segment slots their vertices follow, for culling. */
  restSphere?: THREE.Sphere;
  segSlots?: number[];
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
  /** Visible parts for the permanent labels (canvas pixels); null hides them while the view moves. */
  onLabels: (labels: LabelAnchor[] | null, free?: Insets) => void;
}

export interface LabelAnchor {
  part: AtlasPart;
  name: string;
  /** Arrow tip on the structure, in canvas pixels. */
  x: number;
  y: number;
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
    sheen: 0,
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
attribute float aInflate;
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
  // Baked per-vertex push-out (0.1 mm units) covers inner structures lying close under the skin;
  // parts without it (hair, eyebrows) use the 5.5 mm default.
  transformed += normalize(normal) * max(aInflate * 0.0001, 0.0055);
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

/** The same blend for the picking pass, which has no normals of its own to skin. */
const VERTEX_PICK_SEG = /* glsl */ `
float segSum = max(aSegW.x + aSegW.y + aSegW.z + aSegW.w, 1e-4);
mat4 segM = (uSeg[int(aSegI.x)] * aSegW.x + uSeg[int(aSegI.y)] * aSegW.y
          + uSeg[int(aSegI.z)] * aSegW.z + uSeg[int(aSegI.w)] * aSegW.w) / segSum;
`;

/** Pixel ratios tried in turn when the device can't keep up. */
const QUALITY_PIXEL_RATIO = [1.5, 1, 0.75];

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
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private root = new THREE.Group();
  private parts = new Map<string, PartMesh>();
  private materials = new Map<string, THREE.MeshPhysicalMaterial>();
  private disposables: { dispose: () => void }[] = [];
  // GPU picking: parts are drawn with id colours into one pixel under the cursor, using the same
  // skinning and animation shaders as the visible image, so what you point at is what gets picked.
  private pickTarget = new THREE.WebGLRenderTarget(1, 1);
  private pickCamera = new THREE.PerspectiveCamera();
  private pickMaterials = new Map<string, THREE.MeshBasicMaterial>();
  private pickById: PartMesh[] = [];
  private pickPixel = new Uint8Array(4);
  private pickBusy = false;
  private lastPickAt = 0;
  private clearColor = new THREE.Color();
  private selected = new Set<string>();
  private hovered: string | null = null;
  private explode = 0;
  private dirty = true;
  private frame = 0;
  private tween: CameraTween | null = null;
  private resizeObserver: ResizeObserver;
  private downAt: { x: number; y: number; t: number } | null = null;
  /** Cursor over the canvas (canvas pixels) while hovering with a mouse. */
  private hoverPos: { x: number; y: number } | null = null;
  private hoverStale = false;
  private hoverMoved = false;
  private lastMoveAt = 0;
  // Adaptive quality: drop the pixel ratio when frames are slow.
  private quality = 0;
  private frameGaps: number[] = [];
  private lastRenderAt = 0;
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
  private matricesDirty = true;
  private tmpBox = new THREE.Box3();
  private tmpVec = new THREE.Vector3();

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
    // Retina and 4K boards already have tiny pixels: skip multisampling there, it mostly costs GPU time.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: window.devicePixelRatio < 1.5, powerPreference: "high-performance" });
    this.applyPixelRatio();
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
    // 2 000+ parts: walking them all every frame is wasted work, so world matrices update only on change.
    this.scene.matrixWorldAutoUpdate = false;
    this.root.matrixWorldAutoUpdate = false;

    // Rendered in a single pass (no ambient-occlusion post effect): shading never pops in or out
    // while the camera moves, and each frame draws the scene only once.

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

  private material(system: SystemKey, group: AnimGroup, state: MaterialState, translucent = false): THREE.MeshPhysicalMaterial {
    const key = `${system}|${group}|${state}${translucent ? "|t" : ""}`;
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
      // Two-sided, so any tiny remaining gap shows skin rather than the muscle behind it.
      m.side = THREE.DoubleSide;
      // Win depth ties against structures lying exactly on the body surface.
      m.polygonOffset = true;
      m.polygonOffsetFactor = -1;
      m.polygonOffsetUnits = -2;
    }
    if (translucent && state !== "cut") {
      // Lung tissue as a light veil: the airways and vessels inside stay in view.
      m.transparent = true;
      m.opacity = state === "base" ? 0.5 : 0.65;
      m.depthWrite = false;
      m.clearcoat = 0;
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

    // Baked skinning weights (scripts/bake-skin-weights.ts); without them everything moves rigidly.
    let skin: SkinManifest | null = null;
    try {
      const res = await fetch(`${MODEL_BASE}/skin.json`);
      if (res.ok) skin = (await res.json()) as SkinManifest;
    } catch {
      skin = null;
    }

    const queue = manifest.chunks.map((c, i) => ({ path: c.gzip.split("/").pop() as string, index: i }));
    const worker = async () => {
      while (queue.length && !this.disposed) {
        const job = queue.shift();
        if (!job) return;
        const [buffer, weights] = await Promise.all([
          fetchChunk(job.path),
          skin?.files[job.index] ? fetchChunk(skin.files[job.index]).catch(() => null) : Promise.resolve(null),
        ]);
        if (this.disposed) return;
        for (const part of byChunk.get(job.index) ?? []) {
          const baked = weights && skin?.parts[part.id];
          this.addPart(part, buffer, baked ? { buffer: weights, entry: baked } : null);
        }
        done += 1;
        onProgress(done, total);
        this.dirty = true;
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
  }

  private addPart(part: AtlasPart, buffer: ArrayBuffer, baked: { buffer: ArrayBuffer; entry: SkinEntry } | null) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(buffer, part.positions, part.vertexCount * 3);
    const normals = new Int16Array(buffer.slice(part.normals, part.normals + part.vertexCount * 6));
    const indices = new Uint32Array(buffer, part.indices, part.indexCount);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3, true));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    // Bones move rigidly with their segment. Everything else uses baked weights: the skin's own smoothed
    // weights, and for tissue under it the weights of the nearest skin, so it all moves together.
    const rigid = !baked;
    if (rigid) {
      const idx = new Uint8Array(part.vertexCount * 4).fill(IDENTITY_SLOT);
      const wts = new Uint8Array(part.vertexCount * 4);
      for (let i = 0; i < part.vertexCount; i++) wts[i * 4] = 255;
      geometry.setAttribute("aSegI", new THREE.BufferAttribute(idx, 4));
      geometry.setAttribute("aSegW", new THREE.BufferAttribute(wts, 4, true));
    } else {
      const { buffer: wb, entry } = baked;
      const n = part.vertexCount * 4;
      geometry.setAttribute("aSegI", new THREE.BufferAttribute(new Uint8Array(wb, entry.o, n), 4));
      geometry.setAttribute("aSegW", new THREE.BufferAttribute(new Uint8Array(wb, entry.o + n, n), 4, true));
      if (entry.f !== undefined) geometry.setAttribute("aInflate", new THREE.BufferAttribute(new Uint8Array(wb, entry.f, part.vertexCount), 1));
      // The body surface ships with its scan holes patched and bridge triangles removed.
      if (entry.i !== undefined && entry.n) geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(wb, entry.i, entry.n), 1));
    }
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    // Animated parts grow slightly; keep them from being culled at the edge of the view.
    const restSphere = (geometry.boundingSphere as THREE.Sphere).clone();
    if (geometry.boundingSphere) geometry.boundingSphere.radius *= 1.15;
    let segSlots: number[] | undefined;
    if (!rigid) {
      const si = geometry.getAttribute("aSegI").array as Uint8Array;
      const sw = geometry.getAttribute("aSegW").array as Uint8Array;
      const used = new Set<number>();
      for (let k = 0; k < si.length; k++) if (sw[k] > 0) used.add(si[k]);
      segSlots = [...used];
    }

    const [min, max] = part.bounds;
    const centroid = new THREE.Vector3((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
    const group = animGroup(part);
    const mesh = new THREE.Mesh(geometry, this.material(part.system, group, "base"));
    mesh.userData.partId = part.id;
    mesh.matrixAutoUpdate = false;
    // Outer layers draw first, so the depth test skips shading everything hidden underneath them.
    mesh.renderOrder = part.system === "integumentary" ? -2 : part.system === "muscular" ? -1 : 0;
    const entry: PartMesh = {
      part,
      group,
      segment: this.rig ? this.rig.segmentOf(part) : "root",
      mesh,
      centroid,
      jitter: new THREE.Vector3(hashUnit(part.id, 1), hashUnit(part.id, 2), hashUnit(part.id, 3)),
      explodeOffset: new THREE.Vector3(),
      rigid,
      translucent: TRANSLUCENT.test(part.name),
      pickId: this.pickById.length + 1,
      restSphere: rigid ? undefined : restSphere,
      segSlots,
    };
    this.pickById.push(entry);
    this.parts.set(part.id, entry);
    this.updateSkinnedBounds(entry);
    this.applyExplode(entry);
    this.applyMaterial(entry);
    mesh.visible = this.visibility ? this.visibility.has(part.id) : true;
    this.root.add(mesh);
    this.matricesDirty = true;
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
    entry.mesh.material = this.material(entry.part.system, entry.group, state, entry.translucent);
  }

  private updatePartMatrix(entry: PartMesh) {
    const o = entry.explodeOffset;
    entry.mesh.matrix.makeTranslation(o.x, o.y, o.z);
    if (entry.rigid) entry.mesh.matrix.multiply(this.segMatrix[entry.segment]);
    entry.mesh.matrixWorldNeedsUpdate = true;
    this.matricesDirty = true;
  }

  /**
   * Skinned vertices are blends of their segments' transforms, so they stay inside the union of the
   * rest bounds moved by each of those segments. Keeping that as the culling sphere lets the GPU skip
   * soft tissue that is off screen without ever clipping something that is visible.
   */
  private updateSkinnedBounds(entry: PartMesh) {
    const { restSphere, segSlots } = entry;
    const sphere = entry.mesh.geometry.boundingSphere;
    if (!restSphere || !segSlots || !sphere) return;
    const mats = this.uniforms.uSeg.value;
    const box = this.tmpBox.makeEmpty();
    const centres = segSlots.map((slot) => this.tmpVec.copy(restSphere.center).applyMatrix4(mats[slot] ?? IDENTITY).clone());
    for (const c of centres) box.expandByPoint(c);
    box.getCenter(sphere.center);
    let spread = 0;
    for (const c of centres) spread = Math.max(spread, c.distanceTo(sphere.center));
    // Margin for the skin push-out and the heart/breathing deformation.
    sphere.radius = spread + restSphere.radius * 1.15 + 0.03;
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
    // Smooth transitions between poses; looping movements follow their target closely so they don't lag.
    const looping = this.pose === "walk" || this.pose === "wave" || this.pose === "jumpingJack" || this.pose === "squatExercise";
    const k = 1 - Math.exp(-dt * (looping && this.poseTime > 0.6 ? 22 : 8));
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
    for (const entry of this.parts.values()) {
      this.updatePartMatrix(entry);
      this.updateSkinnedBounds(entry);
    }
    const animated = this.pose === "walk" || this.pose === "wave" || this.pose === "jumpingJack" || this.pose === "squatExercise";
    if (settled && !animated) this.rigActive = false;
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

  /** Pixel ratio from the quality level, capped so huge screens (4K boards) never shade more than ~3.5 MP. */
  private applyPixelRatio() {
    const area = Math.max(1, this.canvas.clientWidth * this.canvas.clientHeight);
    const budget = Math.sqrt(3_500_000 / area);
    this.renderer.setPixelRatio(Math.max(0.6, Math.min(window.devicePixelRatio, QUALITY_PIXEL_RATIO[this.quality], budget)));
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.applyPixelRatio();
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.applyViewOffset();
    this.dirty = true;
  }

  // ---- Picking ---------------------------------------------------------------------------------

  /** Id-colour material for one part, sharing the animation/skinning vertex code of its group. */
  private pickMaterial(entry: PartMesh): THREE.MeshBasicMaterial {
    const cached = this.pickMaterials.get(entry.part.id);
    if (cached) return cached;
    const id = entry.pickId;
    const m = new THREE.MeshBasicMaterial({ toneMapped: false });
    m.color.setRGB(((id >> 16) & 255) / 255, ((id >> 8) & 255) / 255, (id & 255) / 255, THREE.LinearSRGBColorSpace);
    m.defines = { ANIM_GROUP: entry.group };
    m.customProgramCacheKey = () => `pick-${entry.group}`;
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${VERTEX_HEADER}`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERTEX_PICK_SEG}\n${VERTEX_DEFORM}`);
    };
    this.pickMaterials.set(entry.part.id, m);
    return m;
  }

  /** The part drawn at canvas pixel (x, y), exactly as it appears on screen (pose, animation, cutaway). */
  private async pick(x: number, y: number): Promise<PartMesh | null> {
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (!cw || !ch || x < 0 || y < 0 || x >= cw || y >= ch) return null;
    const { w, h } = this.freeArea();
    // Same framing as the main view, narrowed to the single pixel under the cursor.
    const cam = this.pickCamera;
    cam.copy(this.camera);
    cam.setViewOffset(cw, ch, (-this.offset.x * cw) / w + x, (-this.offset.y * ch) / h + y, 1, 1);
    this.renderIds(cam, this.pickTarget);

    const px = this.pickPixel;
    await this.renderer.readRenderTargetPixelsAsync(this.pickTarget, 0, 0, 1, 1, px);
    if (this.disposed || px[3] === 0) return null;
    const id = (px[0] << 16) | (px[1] << 8) | px[2];
    return this.pickById[id - 1] ?? null;
  }

  /** Draw every visible part in its id colour into the given target. */
  private renderIds(cam: THREE.Camera, target: THREE.WebGLRenderTarget) {
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    for (const entry of this.parts.values()) {
      const mesh = entry.mesh;
      if (!mesh.visible) continue;
      const base = mesh.material as THREE.MeshPhysicalMaterial;
      const pm = this.pickMaterial(entry);
      pm.side = base.side;
      pm.clippingPlanes = base.clippingPlanes;
      pm.polygonOffset = base.polygonOffset;
      pm.polygonOffsetFactor = base.polygonOffsetFactor;
      pm.polygonOffsetUnits = base.polygonOffsetUnits;
      swapped.push([mesh, base]);
      mesh.material = pm;
    }
    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    r.getClearColor(this.clearColor);
    const prevAlpha = r.getClearAlpha();
    r.setRenderTarget(target);
    r.setClearColor(0x000000, 0);
    r.render(this.root, cam);
    r.setRenderTarget(prevTarget);
    r.setClearColor(this.clearColor, prevAlpha);
    for (const [mesh, material] of swapped) mesh.material = material;
  }

  // ---- Permanent labels (smart boards have no hover) --------------------------------------------
  //
  // Which structures get a label is decided after the view settles, from one id pass over the whole
  // view. Each label is then pinned to a vertex of its structure and re-projected every frame, so the
  // labels follow zooming, turning and poses smoothly instead of disappearing and popping back.

  private labelsOn = false;
  private labelName: (part: AtlasPart) => string | null = () => null;
  private labelNames = new Map<string, string | null>();
  private labelsStale = true;
  private labelsChangedAt = 0;
  private lastLabelsAt = 0;
  private labelsBusy = false;
  private labelTarget = new THREE.WebGLRenderTarget(1, 1);
  private tracked: { entry: PartMesh; vertex: number; name: string }[] = [];
  private labelPoint = new THREE.Vector3();
  private labelTmp = new THREE.Vector3();

  /** `name` returns the label text for a part, or null when it has no textbook name worth showing. */
  setLabels(on: boolean, name?: (part: AtlasPart) => string | null) {
    this.labelsOn = on;
    if (name) {
      this.labelName = name;
      this.labelNames.clear();
    }
    this.labelsStale = true;
    this.labelsChangedAt = 0;
    if (!on) {
      this.tracked = [];
      this.callbacks.onLabels(null);
    }
  }

  private nameOf(part: AtlasPart) {
    let n = this.labelNames.get(part.id);
    if (n === undefined) {
      n = this.labelName(part);
      this.labelNames.set(part.id, n);
    }
    return n;
  }

  private updateLabels(now: number) {
    // A read-back that never finishes (lost GPU context, throttled tab) must not stop labels for good.
    if (this.labelsBusy && now - this.lastLabelsAt > 2000) this.labelsBusy = false;
    if (!this.labelsOn || !this.labelsStale || this.labelsBusy) return;
    const settled = now - this.labelsChangedAt > 350;
    const periodic = this.rigActive && now - this.lastLabelsAt > 1500;
    if (!settled && !periodic) return;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (!cw || !ch) return;
    const scale = 4;
    const W = Math.max(1, Math.floor(cw / scale));
    const H = Math.max(1, Math.floor(ch / scale));
    if (this.labelTarget.width !== W || this.labelTarget.height !== H) this.labelTarget.setSize(W, H);
    this.pickCamera.copy(this.camera);
    this.renderIds(this.pickCamera, this.labelTarget);
    this.labelsStale = false;
    this.labelsBusy = true;
    this.lastLabelsAt = now;
    const buf = new Uint8Array(W * H * 4);
    void this.renderer
      .readRenderTargetPixelsAsync(this.labelTarget, 0, 0, W, H, buf)
      .then(() => {
        if (this.disposed || !this.labelsOn) return;
        this.chooseLabels(buf, W, H, cw / W, ch / H);
        this.emitLabels();
      })
      .catch(() => {
        this.labelsStale = true;
      })
      .finally(() => {
        this.labelsBusy = false;
      });
  }

  /** Largest clearly visible named structures, one per name, with their arrow tips kept apart. */
  private chooseLabels(buf: Uint8Array, W: number, H: number, sx: number, sy: number) {
    const stats = new Map<number, { n: number; x: number; y: number; bx: number; by: number; bd: number }>();
    const idAt = (i: number) => (buf[i + 3] === 0 ? 0 : (buf[i] << 16) | (buf[i + 1] << 8) | buf[i + 2]);
    for (let row = 0; row < H; row++)
      for (let col = 0; col < W; col++) {
        const id = idAt((row * W + col) * 4);
        if (!id) continue;
        const s = stats.get(id);
        if (s) {
          s.n += 1;
          s.x += col;
          s.y += row;
        } else stats.set(id, { n: 1, x: col, y: row, bx: col, by: row, bd: Infinity });
      }
    // Aim at a pixel well inside the part (all four neighbours are the same part), nearest its centre.
    for (let row = 1; row < H - 1; row++)
      for (let col = 1; col < W - 1; col++) {
        const i = (row * W + col) * 4;
        const id = idAt(i);
        const s = id ? stats.get(id) : undefined;
        if (!s || s.n < 12) continue;
        if (idAt(i - 4) !== id || idAt(i + 4) !== id || idAt(i - W * 4) !== id || idAt(i + W * 4) !== id) continue;
        const d = (col - s.x / s.n) ** 2 + (row - s.y / s.n) ** 2;
        if (d < s.bd) {
          s.bd = d;
          s.bx = col;
          s.by = row;
        }
      }

    const { top, bottom, left, right } = this.insets;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    const limit = Math.min(12, Math.max(0, Math.floor((ch - top - bottom - 48) / 38) * 2));
    const candidates: { entry: PartMesh; name: string; x: number; y: number; area: number }[] = [];
    for (const [id, s] of stats) {
      const entry = this.pickById[id - 1];
      if (!entry || s.n < 12 || s.bd === Infinity) continue;
      const name = this.nameOf(entry.part);
      if (!name) continue;
      // Read-back rows start at the bottom of the image.
      const x = (s.bx + 0.5) * sx;
      const y = (H - 1 - s.by + 0.5) * sy;
      if (x < left + 12 || x > cw - right - 12 || y < top + 24 || y > ch - bottom - 24) continue;
      candidates.push({ entry, name, x, y, area: s.n });
    }
    candidates.sort((a, b) => b.area - a.area);
    const chosen: typeof candidates = [];
    const names = new Set<string>();
    for (const c of candidates) {
      if (chosen.length >= limit) break;
      if (names.has(c.name) || chosen.some((o) => Math.hypot(o.x - c.x, o.y - c.y) < 56)) continue;
      names.add(c.name);
      chosen.push(c);
    }
    this.tracked = chosen.map((c) => ({ entry: c.entry, name: c.name, vertex: this.vertexAt(c.entry, c.x, c.y) }));
  }

  /** Current world position of one vertex, skinned the same way as in the shader. */
  private vertexWorld(entry: PartMesh, v: number, out: THREE.Vector3) {
    const g = entry.mesh.geometry;
    const pos = g.getAttribute("position");
    const si = g.getAttribute("aSegI").array as Uint8Array;
    const sw = g.getAttribute("aSegW").array as Uint8Array;
    const mats = this.uniforms.uSeg.value;
    out.set(0, 0, 0);
    let sum = 0;
    for (let j = 0; j < 4; j++) {
      const w = sw[v * 4 + j];
      if (!w) continue;
      sum += w;
      out.addScaledVector(this.labelTmp.fromBufferAttribute(pos, v).applyMatrix4(mats[si[v * 4 + j]] ?? IDENTITY), w);
    }
    if (sum) out.divideScalar(sum);
    else out.fromBufferAttribute(pos, v);
    return out.applyMatrix4(entry.mesh.matrixWorld);
  }

  /** Canvas position of a world point, including the panel-aware view offset. */
  private toCanvas(p: THREE.Vector3) {
    const v = p.project(this.camera);
    return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight, front: v.z < 1 };
  }

  /** The vertex of the part that shows at canvas pixel (x, y): near it on screen and closest to the camera. */
  private vertexAt(entry: PartMesh, x: number, y: number) {
    const count = entry.mesh.geometry.getAttribute("position").count;
    const step = Math.max(1, Math.floor(count / 2000));
    let best = 0;
    let bestScore = Infinity;
    const eye = this.camera.position;
    for (let v = 0; v < count; v += step) {
      const p = this.vertexWorld(entry, v, this.labelPoint);
      const dist = p.distanceTo(eye);
      const s = this.toCanvas(p);
      const d = Math.hypot(s.x - x, s.y - y);
      // Within a few pixels, prefer the front surface; otherwise simply the nearest on screen.
      const score = d < 10 ? dist : 1000 + d;
      if (score < bestScore) {
        bestScore = score;
        best = v;
      }
    }
    return best;
  }

  private emitLabels() {
    if (!this.labelsOn) return;
    const out: LabelAnchor[] = [];
    for (const t of this.tracked) {
      if (!t.entry.mesh.visible) continue;
      const s = this.toCanvas(this.vertexWorld(t.entry, t.vertex, this.labelPoint));
      if (s.front) out.push({ part: t.entry.part, name: t.name, x: s.x, y: s.y });
    }
    this.callbacks.onLabels(out, { ...this.insets });
  }

  private emitHover() {
    const entry = this.hovered ? this.parts.get(this.hovered) : undefined;
    const at = this.hoverPos;
    if (!entry || !at) this.callbacks.onHover(null, 0, 0);
    else this.callbacks.onHover(entry.part, at.x, at.y);
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

  private canvasPoint(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
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
    const { x, y } = this.canvasPoint(e);
    void this.pick(x, y).then((hit) => {
      if (hit) this.callbacks.onPick(hit.part);
    });
  };

  private onDoubleClick = (e: MouseEvent) => {
    const { x, y } = this.canvasPoint(e);
    void this.pick(x, y).then((hit) => {
      if (hit) this.callbacks.onFocus(hit.part);
    });
  };

  private onContextMenu = (e: MouseEvent) => e.preventDefault();

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse" || e.buttons !== 0) {
      this.hoverPos = null;
      if (this.hovered) {
        this.setHovered(null);
        this.callbacks.onHover(null, 0, 0);
      }
      return;
    }
    this.hoverPos = this.canvasPoint(e);
    this.hoverStale = true;
    this.hoverMoved = true;
    this.lastMoveAt = performance.now();
  };

  private onPointerLeave = () => {
    this.hoverPos = null;
    this.hoverStale = false;
    this.setHovered(null);
    this.callbacks.onHover(null, 0, 0);
  };

  /** Once per frame: move the label with the cursor, and re-pick at most every 50 ms. */
  private processHover(now: number) {
    if (this.hoverMoved) {
      this.hoverMoved = false;
      if (this.hovered) this.emitHover();
    }
    // Pick when the cursor pauses (or every 150 ms while it keeps moving), not on every movement.
    if (!this.hoverStale || this.pickBusy) return;
    if (now - this.lastMoveAt < 60 && now - this.lastPickAt < 150) return;
    const at = this.hoverPos;
    if (!at) return;
    this.hoverStale = false;
    this.pickBusy = true;
    this.lastPickAt = now;
    void this.pick(at.x, at.y)
      .then((hit) => {
        if (!this.hoverPos) return;
        const id = hit?.part.id ?? null;
        if (id === this.hovered) return;
        this.setHovered(id);
        this.emitHover();
      })
      .finally(() => {
        this.pickBusy = false;
      });
  }

  /** Step the pixel ratio down when the device keeps rendering below ~45 fps. */
  private trackFrameRate(now: number) {
    const gap = now - this.lastRenderAt;
    this.lastRenderAt = now;
    if (gap > 250 || this.quality >= QUALITY_PIXEL_RATIO.length - 1) return;
    this.frameGaps.push(gap);
    if (this.frameGaps.length < 40) return;
    const sorted = [...this.frameGaps].sort((a, b) => a - b);
    this.frameGaps = [];
    // Below ~45 fps: render fewer pixels.
    if (sorted[sorted.length >> 1] < 22) return;
    this.quality += 1;
    this.applyPixelRatio();
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
    const rigMoved = this.tickRig(now);
    // Anything but the heart/breathing animation moves parts on screen, so labels must be re-placed.
    if (this.dirty || rigMoved || this.tween) {
      this.labelsStale = true;
      this.labelsChangedAt = now;
    }
    const animated = this.tickAnimation(now);
    if (!animated) this.lastTick = now;
    if (rigMoved || animated || this.tween) this.dirty = true;
    // The view changed under a still cursor: check what is under it now (throttled while moving).
    if (this.dirty && this.hoverPos && now - this.lastPickAt > 150) this.hoverStale = true;
    if (this.matricesDirty) {
      this.matricesDirty = false;
      this.scene.updateMatrixWorld();
    }
    this.processHover(now);
    if (this.dirty) {
      this.dirty = false;
      this.renderer.render(this.scene, this.camera);
      this.trackFrameRate(now);
      if (this.tracked.length) this.emitLabels();
    }
    this.updateLabels(now);
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
    for (const m of this.pickMaterials.values()) m.dispose();
    this.pickTarget.dispose();
    this.labelTarget.dispose();
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
  }
}
