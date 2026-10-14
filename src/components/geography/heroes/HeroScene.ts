import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

/*
 * A 3D model to turn and look at (the relief round a volcano, a mudflow, an avalanche): Draco GLBs built by
 * scripts/build-geo-heroes.py. LOD0 for the close-up, LOD1 once the camera is pulled back. It draws only while
 * the canvas is on screen.
 */

const DRACO_DIR = "/draco/";
/** Camera-to-target distance (in model radii) beyond which LOD1 replaces LOD0. */
const LOD1_FACTOR = 2.6;

export interface HeroSource {
  src: string;
  lod1?: string;
  /** Sky (background and haze). */
  sky: string;
}

export class HeroScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private seen: IntersectionObserver;
  private onScreen = true;
  private draco: DRACOLoader | null = null;
  private heroes: { lod0?: THREE.Object3D; lod1?: THREE.Object3D } = {};
  private radius = 10;
  private raf = 0;
  private disposed = false;
  /** Fires with "loaded" once LOD0 is on screen, "failed" if it could not load. */
  onStatus?: (s: "loaded" | "failed") => void;

  constructor(
    private canvas: HTMLCanvasElement,
    private source: HeroSource,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(source.sky);
    this.scene.fog = new THREE.Fog(source.sky, 60, 220);

    this.scene.add(new THREE.HemisphereLight("#e4f0ff", "#5a4a3a", 1.5));
    // Low sun from the south-west: it brings out the relief.
    const sun = new THREE.DirectionalLight("#fff4e0", 2.4);
    sun.position.set(-20, 18, 14);
    this.scene.add(sun);

    this.camera.position.set(14, 10, 18);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI * 0.49;

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.seen = new IntersectionObserver(([e]) => (this.onScreen = e.isIntersecting));
    this.seen.observe(canvas);
    this.resize();
    this.loop();
    this.load();
  }

  /** Frame the camera on a bounding box and set zoom limits relative to its size. */
  private fit(box: THREE.Box3) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.radius = Math.max(sphere.radius, 0.1);
    this.controls.target.copy(sphere.center);
    const dir = new THREE.Vector3(0.6, 0.5, 0.75).normalize();
    this.camera.position.copy(sphere.center).addScaledVector(dir, this.radius * 1.9);
    this.controls.minDistance = this.radius * 0.45;
    this.controls.maxDistance = this.radius * 4;
    this.camera.near = this.radius * 0.01;
    this.camera.far = this.radius * 20;
    this.camera.updateProjectionMatrix();
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.radius * 4;
    fog.far = this.radius * 12;
    this.controls.update();
  }

  private load() {
    this.draco = new DRACOLoader().setDecoderPath(DRACO_DIR);
    const loader = new GLTFLoader().setDRACOLoader(this.draco);
    const prep = (root: THREE.Object3D) => {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        // Ground and trees are smooth-shaded from shared vertices; houses bring their own flat normals.
        if (!m.geometry.getAttribute("normal")) m.geometry.computeVertexNormals();
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat.name === "water") {
          mat.roughness = 0.2;
          mat.metalness = 0.1;
        }
        if (mat.name === "powder") {
          // The powder cloud: see-through, drawn after the snow.
          mat.depthWrite = false;
          m.renderOrder = 1;
        }
      });
      root.visible = false;
      this.scene.add(root);
      return root;
    };
    const get = (url: string) => new Promise<THREE.Object3D | null>((res) => loader.load(url, (g) => res(this.disposed ? null : prep(g.scene)), undefined, () => res(null)));
    get(this.source.src).then((lod0) => {
      if (this.disposed) return;
      if (!lod0) {
        this.onStatus?.("failed");
        return;
      }
      this.heroes.lod0 = lod0;
      this.fit(new THREE.Box3().setFromObject(lod0));
      this.updateLod();
      this.onStatus?.("loaded");
      if (!this.source.lod1) return;
      get(this.source.lod1).then((lod1) => {
        if (!lod1 || this.disposed) return;
        this.heroes.lod1 = lod1;
        this.updateLod();
      });
    });
  }

  /** Exactly one model visible: LOD1 when far and loaded, otherwise LOD0. */
  private updateLod() {
    const { lod0, lod1 } = this.heroes;
    if (!lod0) return;
    const far = !!lod1 && this.camera.position.distanceTo(this.controls.target) > this.radius * LOD1_FACTOR;
    lod0.visible = !far;
    if (lod1) lod1.visible = far;
  }

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
    this.raf = requestAnimationFrame(this.loop);
    if (!this.onScreen) return;
    this.controls.update();
    this.updateLod();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.seen.disconnect();
    this.controls.dispose();
    this.draco?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.dispose();
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) mat.dispose();
    });
    this.renderer.dispose();
  }
}
