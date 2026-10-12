import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";

/*
 * Topic 6 — a Georgian volcano cone up close (David's Draco GLBs). LOD0 for the close-up, LOD1 once the
 * camera is pulled back. Until LOD0 arrives (or if it fails, e.g. 401 signed out) a simple placeholder
 * cone is shown so the canvas is never empty.
 */

export type ConeId = "kazbegi" | "javakheti";

const HERO_DIR = "/models/geography/volcanoes/";
const DRACO_DIR = "/draco/";
/** Camera-to-target distance (in model radii) beyond which LOD1 replaces LOD0. */
const LOD1_FACTOR = 2.6;

export class ConeScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.05, 2000);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private draco: DRACOLoader | null = null;
  private placeholder: THREE.Mesh;
  private heroes: { lod0?: THREE.Object3D; lod1?: THREE.Object3D } = {};
  private radius = 10;
  private raf = 0;
  private disposed = false;
  /** Fires with "loaded" once LOD0 is on screen, "failed" if it could not load. */
  onStatus?: (s: "loaded" | "failed") => void;

  constructor(private canvas: HTMLCanvasElement, private id: ConeId) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color("#bcdcf0");
    this.scene.fog = new THREE.Fog("#bcdcf0", 60, 220);

    this.scene.add(new THREE.HemisphereLight("#dbeeff", "#5a4a3a", 1.4));
    const sun = new THREE.DirectionalLight("#fff4e0", 2.2);
    sun.position.set(20, 30, 15);
    this.scene.add(sun);

    this.placeholder = new THREE.Mesh(
      new THREE.ConeGeometry(8, id === "kazbegi" ? 7 : 3, 48, 1, true),
      new THREE.MeshStandardMaterial({ color: id === "kazbegi" ? "#8a8580" : "#6f6a52", roughness: 0.95, flatShading: true }),
    );
    this.placeholder.position.y = id === "kazbegi" ? 3.5 : 1.5;
    this.scene.add(this.placeholder);

    this.camera.position.set(14, 10, 18);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.fit(new THREE.Box3().setFromObject(this.placeholder));

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
    this.loadHeroes();
  }

  /** Frame the camera on a bounding box and set zoom limits relative to its size. */
  private fit(box: THREE.Box3) {
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    this.radius = Math.max(sphere.radius, 0.1);
    this.controls.target.copy(sphere.center);
    const dir = new THREE.Vector3(0.6, 0.45, 0.75).normalize();
    this.camera.position.copy(sphere.center).addScaledVector(dir, this.radius * 2.0);
    this.controls.minDistance = this.radius * 0.6;
    this.controls.maxDistance = this.radius * 4;
    this.camera.near = this.radius * 0.01;
    this.camera.far = this.radius * 20;
    this.camera.updateProjectionMatrix();
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.radius * 4;
    fog.far = this.radius * 12;
    this.controls.update();
  }

  private loadHeroes() {
    this.draco = new DRACOLoader().setDecoderPath(DRACO_DIR);
    const loader = new GLTFLoader().setDRACOLoader(this.draco);
    const prep = (root: THREE.Object3D) => {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.computeVertexNormals();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          // Lava glows; keep depthWrite on so it sorts correctly inside the crater.
          if (/lava|pool/i.test(mat.name) && "emissive" in mat) {
            const sm = mat as THREE.MeshStandardMaterial;
            sm.emissive.copy(sm.color);
            sm.emissiveIntensity = 0.8;
          }
        }
      });
      root.visible = false;
      this.scene.add(root);
      return root;
    };
    const load = (file: string) =>
      new Promise<THREE.Object3D | null>((res) => loader.load(HERO_DIR + file, (g) => res(this.disposed ? null : prep(g.scene)), undefined, () => res(null)));
    load(`${this.id}.glb`).then((lod0) => {
      if (this.disposed) return;
      if (!lod0) {
        this.onStatus?.("failed");
        return;
      }
      this.heroes.lod0 = lod0;
      this.placeholder.visible = false;
      this.fit(new THREE.Box3().setFromObject(lod0));
      this.updateLod();
      this.onStatus?.("loaded");
      load(`${this.id}-lod1.glb`).then((lod1) => {
        if (!lod1 || this.disposed) return;
        this.heroes.lod1 = lod1;
        this.updateLod();
      });
    });
  }

  /** Exactly one hero visible: LOD1 when far and loaded, otherwise LOD0. */
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
    this.controls.update();
    this.updateLod();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
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
