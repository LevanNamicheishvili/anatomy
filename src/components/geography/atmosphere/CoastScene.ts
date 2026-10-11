import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { daylight, type BreezeState } from "./breeze-math";

/*
 * A slice through Georgia's Black Sea coast: the sea on the left (west), the Colchis lowland and the
 * mountains on the right (east). Air circulates in a loop — by day from the sea onto the land along the
 * ground, up over the warm land, back out to sea aloft and down over the cool water; at night the loop
 * turns the other way. Arrows and moving "air parcels" follow the loop; clouds grow where the air rises.
 */

export interface CoastAnchors {
  sea: THREE.Vector3;
  land: THREE.Vector3;
  mountain: THREE.Vector3;
  seaHigh: THREE.Vector3;
  landHigh: THREE.Vector3;
  seaLow: THREE.Vector3;
  landLow: THREE.Vector3;
  wind: THREE.Vector3;
  km1: THREE.Vector3;
  km2: THREE.Vector3;
  km3: THREE.Vector3;
}
export type CoastAnchor = keyof CoastAnchors;
export type Projector = (p: THREE.Vector3) => { x: number; y: number; visible: boolean };

const DEPTH = 6;
/** Terrain height (km ≈ scene units) along x ≥ 0. */
function terrain(x: number) {
  if (x < 5) return 0.15 + x * 0.03;
  const t = (x - 5) / 5;
  if (x <= 10) return 0.3 + 4.2 * (t * t * (3 - 2 * t)) + 0.15 * Math.sin(x * 3.1);
  return 4.5 - (x - 10) * 0.6;
}

function landMesh() {
  const shape = new THREE.Shape();
  shape.moveTo(0, -1.2);
  shape.lineTo(0, terrain(0));
  for (let x = 0.25; x <= 13; x += 0.25) shape.lineTo(x, terrain(x));
  shape.lineTo(13, -1.2);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -DEPTH / 2);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const sideFace = Math.abs(Math.abs(pos.getZ(i)) - DEPTH / 2) < 1e-3;
    if (y < -0.05) c.set("#7a5a3c");
    else if (y < 1.2) c.set("#6f9a4a");
    else if (y < 2.6) c.set("#4f7a3a");
    else if (y < 3.7) c.set("#8a7a66");
    else c.set("#f4f6f8");
    if (sideFace && y < 0.1) c.set("#7a5a3c");
    c.toArray(colors, i * 3);
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
}

function seaMesh() {
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.BoxGeometry(13, 1.2, DEPTH), new THREE.MeshStandardMaterial({ color: "#1f6fa8", roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.92 }));
  water.position.set(-6.5, -0.6, 0);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(13, 0.1, DEPTH), new THREE.MeshStandardMaterial({ color: "#7a5a3c" }));
  floor.position.set(-6.5, -1.25, 0);
  g.add(water, floor);
  return g;
}

function cloud() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, transparent: true, opacity: 0.95 });
  for (const [x, y, z, r] of [
    [0, 0, 0, 0.8],
    [0.8, -0.1, 0.2, 0.6],
    [-0.8, -0.15, -0.1, 0.6],
    [0.3, 0.45, 0, 0.55],
    [-0.35, 0.35, 0.3, 0.5],
  ]) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    m.position.set(x, y, z);
    g.add(m);
  }
  return g;
}

export class CoastScene {
  onFrame: ((project: Projector, anchors: CoastAnchors) => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private timer = new THREE.Timer();
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private hemi = new THREE.HemisphereLight("#dfefff", "#4a5a3a", 1);
  private sunLight = new THREE.DirectionalLight("#fff3d6", 2);
  private sun: THREE.Mesh;
  private moon: THREE.Mesh;
  private curve: THREE.CatmullRomCurve3;
  private parcels: THREE.Mesh[] = [];
  private arrows: THREE.Mesh[] = [];
  private parcelMat = new THREE.MeshBasicMaterial({ color: "#e0f4ff", transparent: true });
  private arrowMat = new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true });
  private loopLine: THREE.Line;
  private landCloud: THREE.Group;
  private seaCloud: THREE.Group;
  private k = 0;
  private u = 0;
  private dayColor = new THREE.Color("#9fd0f0");
  private nightColor = new THREE.Color("#0b1630");
  private bg = new THREE.Color();
  readonly anchors: CoastAnchors = {
    sea: new THREE.Vector3(-6, 0.15, 2.6),
    land: new THREE.Vector3(2.5, 0.4, 2.6),
    mountain: new THREE.Vector3(9.5, 4.9, 0),
    seaLow: new THREE.Vector3(-6, 1.1, 0),
    landLow: new THREE.Vector3(3, 1.5, 0),
    seaHigh: new THREE.Vector3(-6, 6.3, 0),
    landHigh: new THREE.Vector3(3, 6.3, 0),
    wind: new THREE.Vector3(-1.5, 0.9, 0),
    km1: new THREE.Vector3(13.4, 1, 0),
    km2: new THREE.Vector3(13.4, 2, 0),
    km3: new THREE.Vector3(13.4, 3, 0),
  };

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.bg.copy(this.dayColor);

    this.sunLight.position.set(-4, 10, 6);
    this.scene.add(this.hemi, this.sunLight);
    this.scene.add(seaMesh(), landMesh());

    this.sun = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16), new THREE.MeshBasicMaterial({ color: "#ffd84d" }));
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), new THREE.MeshBasicMaterial({ color: "#e5e9f5" }));
    this.scene.add(this.sun, this.moon);

    // Altitude ticks on the right edge (1 unit = 1 km).
    const tickMat = new THREE.LineBasicMaterial({ color: "#33413e" });
    for (const y of [0, 1, 2, 3]) this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(12.8, y, 0), new THREE.Vector3(13.1, y, 0)]), tickMat));
    this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(13.1, 0, 0), new THREE.Vector3(13.1, 3.4, 0)]), tickMat));

    // The circulation loop (day direction = increasing u): low over the sea → land, up, back aloft, down.
    this.curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-7, 0.7, 0),
        new THREE.Vector3(-1, 0.65, 0),
        new THREE.Vector3(4, 0.9, 0),
        new THREE.Vector3(5.6, 2.8, 0),
        new THREE.Vector3(4, 5.2, 0),
        new THREE.Vector3(-1, 5.5, 0),
        new THREE.Vector3(-7, 5.2, 0),
        new THREE.Vector3(-8.6, 2.9, 0),
      ],
      true,
      "centripetal",
    );
    this.loopLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(this.curve.getSpacedPoints(160)), new THREE.LineDashedMaterial({ color: "#ffffff", dashSize: 0.25, gapSize: 0.2, transparent: true, opacity: 0.6 }));
    this.loopLine.computeLineDistances();
    this.scene.add(this.loopLine);
    const parcelGeo = new THREE.SphereGeometry(0.11, 10, 8);
    for (let i = 0; i < 36; i++) {
      const m = new THREE.Mesh(parcelGeo, this.parcelMat);
      m.position.z = ((i % 3) - 1) * 1.4;
      this.parcels.push(m);
      this.scene.add(m);
    }
    const arrowGeo = new THREE.ConeGeometry(0.28, 0.75, 16);
    arrowGeo.rotateX(Math.PI / 2); // point along +z, then lookAt aims it
    for (let i = 0; i < 8; i++) {
      const a = new THREE.Mesh(arrowGeo, this.arrowMat);
      this.arrows.push(a);
      this.scene.add(a);
    }

    this.landCloud = cloud();
    this.landCloud.position.set(5, 6, 0);
    this.seaCloud = cloud();
    this.seaCloud.position.set(-7.5, 5.6, 0);
    this.scene.add(this.landCloud, this.seaCloud);

    this.camera.position.set(0, 7, 22);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(1, 2.4, 0);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 34;
    this.controls.maxPolarAngle = Math.PI * 0.52;
    this.controls.minAzimuthAngle = -Math.PI / 3;
    this.controls.maxAzimuthAngle = Math.PI / 3;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  /** Hour of the day and the breeze it produces. */
  set(hour: number, b: BreezeState) {
    this.k = b.k;
    const light = daylight(hour);
    this.bg.copy(this.nightColor).lerp(this.dayColor, Math.min(1, light * 1.6));
    this.hemi.intensity = 0.35 + light * 0.9;
    this.sunLight.intensity = light * 2.2;
    // Sun crosses the sky from the east (right) to the west (left); the moon opposite.
    const a = ((hour - 6) / 12) * Math.PI;
    this.sun.position.set(Math.cos(a) * 14, Math.sin(a) * 9 + 1, -6);
    this.sun.visible = Math.sin(a) > -0.05;
    this.moon.position.set(-Math.cos(a) * 14, -Math.sin(a) * 9 + 1, -6);
    this.moon.visible = Math.sin(a) < 0.05;
    this.sunLight.position.copy(this.sun.position);

    const s = Math.abs(b.k);
    this.parcelMat.opacity = 0.25 + s * 0.75;
    this.arrowMat.opacity = Math.min(1, 0.15 + s);
    (this.loopLine.material as THREE.LineDashedMaterial).opacity = 0.2 + s * 0.5;
    this.landCloud.scale.setScalar(Math.max(0.001, b.k) * 1.2);
    this.landCloud.visible = b.k > 0.15;
    this.seaCloud.scale.setScalar(Math.max(0.001, -b.k) * 0.9);
    this.seaCloud.visible = b.k < -0.15;
    this.placeArrows();
  }

  private placeArrows() {
    const dir = this.k >= 0 ? 1 : -1;
    const t = new THREE.Vector3();
    this.arrows.forEach((a, i) => {
      const u = (i + 0.5) / this.arrows.length;
      this.curve.getPointAt(u, a.position);
      this.curve.getTangentAt(u, t).multiplyScalar(dir);
      a.lookAt(a.position.clone().add(t));
      a.visible = Math.abs(this.k) > 0.08;
    });
  }

  private project: Projector = (p) => {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 40 / Math.max(0.5, w / h) : 40;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    if (!this.reduceMotion) this.u = (((this.u + dt * this.k * 0.06) % 1) + 1) % 1;
    this.parcels.forEach((m, i) => {
      const z = m.position.z;
      this.curve.getPointAt((this.u + i / this.parcels.length) % 1, m.position);
      m.position.z = z;
    });
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.project, this.anchors);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) mat.dispose();
    });
    this.renderer.dispose();
  }
}
