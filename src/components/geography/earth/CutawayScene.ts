import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { atmosphereMesh, earthMesh, starField } from "../globe/earth";
import { drawnRadius, LAYERS, type LayerId } from "./layers";

/*
 * The Earth cut open. Every layer is a full sphere; two clipping planes through the axis remove a wedge
 * `opening` degrees wide (0 = whole planet, 90 = the classic quarter cut, 180 = half). On each cut face
 * flat half-rings show the layers in their colours. React places labels through `onFrame(project)`.
 */

const D = Math.PI / 180;
export type Projector = (p: THREE.Vector3) => { x: number; y: number; visible: boolean };

function halfRings() {
  const g = new THREE.Group();
  const mats = new Map<LayerId, THREE.MeshStandardMaterial>();
  for (const l of LAYERS) {
    const mat = new THREE.MeshStandardMaterial({ color: l.color, emissive: l.color, emissiveIntensity: l.glow, roughness: 0.9, side: THREE.DoubleSide });
    // Half-ring in the XY plane on the +x side (from straight down to straight up).
    const geo = new THREE.RingGeometry(Math.max(0.0001, l.rBottom), l.rTop, 96, 1, -Math.PI / 2, Math.PI);
    g.add(new THREE.Mesh(geo, mat));
    mats.set(l.id, mat);
  }
  return { group: g, mats };
}

export class CutawayScene {
  onFrame: ((project: Projector) => void) | null = null;
  /** Opening of the cut, degrees (0…180). */
  opening = 90;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private planeA = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  private planeB = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  private clipped: THREE.Material[] = [];
  private faceA: ReturnType<typeof halfRings>;
  private faceB: ReturnType<typeof halfRings>;
  private probe: THREE.Mesh;
  private tween: { from: number; to: number; start: number } | null = null;
  /** A plane that clips nothing (keeps the shader the same when the planet is whole). */
  private noClip = new THREE.Plane(new THREE.Vector3(0, 0, -1), 5);

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.localClippingEnabled = true;

    this.scene.add(new THREE.AmbientLight("#ffffff", 0.9));
    const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
    sun.position.set(4, 3, 5);
    this.scene.add(sun, starField(), atmosphereMesh(1));

    const surface = earthMesh(1);
    this.clip(surface.material as THREE.Material);
    this.scene.add(surface);
    // Inner layers: plain spheres, seen only through the cut.
    for (const l of LAYERS.slice(1)) {
      const mat = new THREE.MeshStandardMaterial({ color: l.color, emissive: l.color, emissiveIntensity: l.glow, roughness: 0.9, side: THREE.DoubleSide });
      this.clip(mat);
      this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(l.rTop, 64, 48), mat));
    }
    this.faceA = halfRings();
    this.faceB = halfRings();
    this.scene.add(this.faceA.group, this.faceB.group);

    this.probe = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: "#ffffff", depthTest: false }));
    this.probe.renderOrder = 5;
    this.scene.add(this.probe);

    this.camera.position.set(2.6, 1.2, 2.6);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 7;
    this.controls.rotateSpeed = 0.5;

    this.setOpening(90);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  private clip(mat: THREE.Material) {
    mat.clippingPlanes = [this.planeA, this.planeB];
    mat.clipIntersection = true;
    this.clipped.push(mat);
  }

  /** Point on cut face A (the plane z = 0, x > 0) at a radius and an angle above the equator. */
  facePoint(r: number, elev: number, out = new THREE.Vector3()) {
    return out.set(r * Math.cos(elev * D), r * Math.sin(elev * D), 0.002);
  }

  setOpening(deg: number) {
    this.opening = THREE.MathUtils.clamp(deg, 0, 180);
    const a = this.opening * D;
    this.planeB.normal.set(-Math.sin(a), 0, Math.cos(a));
    const open = this.opening > 0.5;
    for (const m of this.clipped) m.clippingPlanes = open ? [this.planeA, this.planeB] : [this.noClip, this.noClip];
    this.faceA.group.visible = open;
    this.faceB.group.visible = open;
    this.faceB.group.rotation.y = -a;
    this.probe.visible = open;
  }

  /** Glide the cut open or closed. */
  animateTo(deg: number) {
    if (this.reduceMotion) return this.setOpening(deg);
    this.tween = { from: this.opening, to: deg, start: performance.now() };
  }

  /** Probe marker at a depth (km). */
  setProbe(depth: number) {
    this.facePoint(drawnRadius(depth), -28, this.probe.position);
  }

  select(id: LayerId | null) {
    for (const face of [this.faceA, this.faceB]) {
      for (const l of LAYERS) {
        const m = face.mats.get(l.id)!;
        m.emissiveIntensity = id === l.id ? Math.max(0.55, l.glow + 0.4) : l.glow;
        m.opacity = id && id !== l.id ? 0.55 : 1;
        m.transparent = !!id && id !== l.id;
      }
    }
  }

  private project: Projector = (p) => {
    const v = p.clone().project(this.camera);
    return { x: ((v.x + 1) / 2) * this.canvas.clientWidth, y: ((1 - v.y) / 2) * this.canvas.clientHeight, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
  };

  /** Face A is turned towards the camera (its labels are readable). */
  faceVisible() {
    return this.opening > 5 && this.camera.position.z > 0.05;
  }

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 35 / Math.max(0.55, w / h) : 35;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    if (this.tween) {
      const k = Math.min(1, (performance.now() - this.tween.start) / 1100);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      this.setOpening(this.tween.from + (this.tween.to - this.tween.from) * e);
      if (k >= 1) this.tween = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.project);
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
      for (const mat of mats) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}
