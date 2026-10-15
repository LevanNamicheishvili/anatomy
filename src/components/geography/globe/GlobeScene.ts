import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { latLonToVec3, vec3ToLatLon, type LatLon } from "./coords";
import { atmosphereMesh, earthMesh, starField } from "./earth";
import { WorldMap } from "./worldMap";

/*
 * Shared globe stage for geography lessons (degree grid, seasons and time zones, voyages, ocean currents). One
 * renderer, orbit camera, the Earth with its atmosphere, stars and a sun, and the political map over it (borders
 * and names, worldMap.ts). Everything that belongs to the Earth goes into `earth` (a group in latitude/longitude
 * space), so it turns with the planet. React places HTML labels through `onFrame(project)`.
 */

export interface GlobeOptions {
  /** Slow spin when idle (stops while the user drags and for reduced-motion users). */
  autoRotate?: boolean;
  /** Direction towards the sun, in world space. */
  sun?: THREE.Vector3;
  /** Lit from all sides (no night side): best for reading maps and grids. Without it, city lights show at night. */
  flatLight?: boolean;
}

export interface Projected {
  x: number;
  y: number;
  /** On the side of the globe that faces the camera and inside the view. */
  visible: boolean;
}

export class GlobeScene {
  readonly radius = 1;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
  readonly earth = new THREE.Group();
  readonly controls: OrbitControls;
  /** Borders and place names; `map.setHidden([...])` leaves out names the lesson labels itself. */
  readonly map: WorldMap;
  /** Called every frame: project(lat, lon, lift) → screen pixels in the canvas. */
  onFrame: ((project: (lat: number, lon: number, lift?: number) => Projected) => void) | null = null;
  /** Point under the cursor (null when off the globe). */
  onHover: ((p: (LatLon & { point: THREE.Vector3 }) | null) => void) | null = null;
  onPick: ((p: LatLon) => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private sunLight = new THREE.DirectionalLight("#fff4e0", 2.4);
  private globe: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private observer: ResizeObserver;
  private frame = 0;
  private last = performance.now();
  private tween: { from: THREE.Vector3; to: THREE.Vector3; start: number; dur: number } | null = null;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private down: { x: number; y: number } | null = null;
  private tmp = new THREE.Vector3();
  /** Direction to the sun in view space (for the city lights on the night side). */
  private sunView = new THREE.Vector3();
  private camDir = new THREE.Vector3();
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    opts: GlobeOptions = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // The 4096-pixel photo where it shows: a big canvas and a graphics card that takes it.
    const hd = canvas.clientWidth >= 640 && this.renderer.capabilities.maxTextureSize >= 4096;
    this.globe = earthMesh(this.radius, { hd, night: opts.flatLight ? undefined : { sunView: this.sunView } });
    this.map = new WorldMap(this.radius);
    this.earth.add(this.globe, this.map.group);
    this.scene.add(this.earth, atmosphereMesh(this.radius), starField());

    if (opts.flatLight) {
      this.scene.add(new THREE.AmbientLight("#ffffff", 2.2));
      this.sunLight.intensity = 0.8;
    } else {
      this.scene.add(new THREE.AmbientLight("#9fb4d6", 0.25));
    }
    this.sunLight.position.copy(opts.sun ?? new THREE.Vector3(5, 2, 4));
    this.scene.add(this.sunLight);

    this.camera.position.set(0, 0.9, 3.6);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 8;
    this.controls.rotateSpeed = 0.5;
    this.controls.autoRotate = !!opts.autoRotate && !this.reduceMotion;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.addEventListener("start", () => {
      this.tween = null;
      this.controls.autoRotate = false;
    });

    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  /** World position of a point on the globe (lift: height above the surface, in Earth radii). */
  position(lat: number, lon: number, lift = 0) {
    return this.earth.localToWorld(latLonToVec3(lat, lon, this.radius * (1 + lift)));
  }

  setSun(dir: THREE.Vector3) {
    this.sunLight.position.copy(dir).setLength(5);
  }

  /** Borders and names on or off. */
  setMapVisible(on: boolean) {
    this.map.group.visible = on;
  }

  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on && !this.reduceMotion;
  }

  /** Swing the camera to look straight at a point (distance from the centre, in Earth radii). */
  focus(lat: number, lon: number, distance = this.camera.position.length()) {
    const to = this.position(lat, lon).setLength(distance);
    if (this.reduceMotion) {
      this.camera.position.copy(to);
      return;
    }
    this.controls.autoRotate = false;
    this.tween = { from: this.camera.position.clone(), to, start: performance.now(), dur: 1300 };
  }

  /** Latitude/longitude at the centre of the view (where the camera looks onto the globe). */
  viewCenter(): LatLon {
    return vec3ToLatLon(this.earth.worldToLocal(this.camera.position.clone()));
  }

  private project = (lat: number, lon: number, lift = 0): Projected => {
    const p = this.position(lat, lon, lift);
    // Facing the camera: the surface normal points towards it.
    this.camDir.copy(this.camera.position).sub(p);
    const facing = this.tmp.copy(p).normalize().dot(this.camDir.normalize()) > 0.08;
    p.project(this.camera);
    return {
      x: ((p.x + 1) / 2) * this.canvas.clientWidth,
      y: ((1 - p.y) / 2) * this.canvas.clientHeight,
      visible: facing && p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05,
    };
  };

  private pick(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.globe, false)[0];
    if (!hit) return null;
    const local = this.earth.worldToLocal(hit.point.clone());
    return { ...vec3ToLatLon(local), point: local };
  }

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" && this.down) return;
    this.onHover?.(this.pick(e));
  };
  private onPointerLeave = () => this.onHover?.(null);
  private onPointerDown = (e: PointerEvent) => {
    this.down = { x: e.clientX, y: e.clientY };
  };
  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    // A tap, not a drag: pick the point (also shows the read-out on touch screens).
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
    const p = this.pick(e);
    if (p) {
      this.onHover?.(p);
      this.onPick?.({ lat: p.lat, lon: p.lon });
    }
  };

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.map.resize(w, h, this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    // Keep the whole globe in view on narrow (portrait) screens.
    this.camera.fov = w < h ? 35 / Math.max(0.55, w / h) : 35;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.tween) {
      const k = Math.min(1, (performance.now() - this.tween.start) / this.tween.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      // Glide along the sphere (not through the Earth): slerp the direction, lerp the distance.
      const len = THREE.MathUtils.lerp(this.tween.from.length(), this.tween.to.length(), e);
      const q = new THREE.Quaternion().setFromUnitVectors(this.tween.from.clone().normalize(), this.tween.to.clone().normalize());
      this.camera.position.copy(this.tween.from).normalize().applyQuaternion(new THREE.Quaternion().slerp(q, e)).setLength(len);
      this.camera.lookAt(0, 0, 0);
      if (k >= 1) this.tween = null;
    }
    this.controls.update();
    this.camera.updateMatrixWorld();
    this.earth.updateMatrixWorld();
    this.sunView.copy(this.sunLight.position).transformDirection(this.camera.matrixWorldInverse);
    this.map.update(this.camera, this.earth, this.canvas, dt);
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.project);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerleave", this.onPointerLeave);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.controls.dispose();
    this.map.dispose();
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
