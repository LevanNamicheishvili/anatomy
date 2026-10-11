import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/*
 * A small solar power plant: rows of south-facing panels, the sun on its noon arc, sunbeams, the panel's
 * normal and an inverter feeding a power line. +z is south. Panels glow brighter the more light they catch.
 */

export interface SolarLabels {
  sun: THREE.Vector3;
  normal: THREE.Vector3;
  inverter: THREE.Vector3;
  grid: THREE.Vector3;
}

const ROWS = 3;
const COLS = 5;

function cellTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#14305c";
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = "#9fb7d9";
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 256 / 6) ctx.strokeRect(x, 0, 0, 160);
  for (let y = 0; y <= 160; y += 160 / 4) ctx.strokeRect(0, y, 256, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class SolarScene {
  onFrame: ((project: (p: THREE.Vector3) => { x: number; y: number; visible: boolean }, labels: SolarLabels) => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
  private controls: OrbitControls;
  private sunLight = new THREE.DirectionalLight("#fff3d6", 2.6);
  private sun: THREE.Mesh;
  private panels: THREE.Group[] = [];
  private panelMat: THREE.MeshStandardMaterial;
  private beams: THREE.Line[] = [];
  private normalArrow: THREE.ArrowHelper;
  private beamArrow: THREE.ArrowHelper;
  private labels: SolarLabels = { sun: new THREE.Vector3(), normal: new THREE.Vector3(), inverter: new THREE.Vector3(-3.6, 1.5, -4.4), grid: new THREE.Vector3(-7.2, 4.4, -4.4) };
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private v = new THREE.Vector3();
  private flow: THREE.Mesh[] = [];
  private power = 0;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene.background = new THREE.Color("#cfe4f2");
    this.scene.fog = new THREE.Fog("#cfe4f2", 30, 70);

    this.scene.add(new THREE.HemisphereLight("#eaf4ff", "#6f7f52", 0.9));
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sunLight.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    this.scene.add(this.sunLight, this.sunLight.target);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: "#93ad6e", roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.sun = new THREE.Mesh(new THREE.SphereGeometry(0.7, 32, 16), new THREE.MeshBasicMaterial({ color: "#ffd84d" }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.2, 32, 16), new THREE.MeshBasicMaterial({ color: "#ffe9a3", transparent: true, opacity: 0.35, depthWrite: false }));
    this.sun.add(halo);
    this.scene.add(this.sun);

    // Panels: a module on a post, pivoting along its east–west axis.
    this.panelMat = new THREE.MeshStandardMaterial({ map: cellTexture(), roughness: 0.25, metalness: 0.3, emissive: new THREE.Color("#4f8cff"), emissiveIntensity: 0 });
    const frameMat = new THREE.MeshStandardMaterial({ color: "#c9ced4", metalness: 0.6, roughness: 0.4 });
    const panelGeo = new THREE.BoxGeometry(1.7, 0.05, 1.05);
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 1, 8);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const post = new THREE.Mesh(postGeo, frameMat);
        const x = (c - (COLS - 1) / 2) * 1.85;
        const z = (r - (ROWS - 1) / 2) * 2.6;
        post.position.set(x, 0.5, z);
        post.castShadow = true;
        const pivot = new THREE.Group();
        pivot.position.set(x, 1, z);
        const panel = new THREE.Mesh(panelGeo, [frameMat, frameMat, this.panelMat, frameMat, frameMat, frameMat]);
        panel.castShadow = true;
        pivot.add(panel);
        this.scene.add(post, pivot);
        this.panels.push(pivot);
      }

    // Inverter (DC → AC) and a power line.
    const inverter = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1, 0.5), new THREE.MeshStandardMaterial({ color: "#e8eaed", roughness: 0.5 }));
    inverter.position.set(-3.6, 0.5, -4.4);
    inverter.castShadow = true;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4, 8), new THREE.MeshStandardMaterial({ color: "#6b5844" }));
    pole.position.set(-7.2, 2, -4.4);
    const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-3.6, 1, -4.4), new THREE.Vector3(-5.4, 3.2, -4.4), new THREE.Vector3(-7.2, 3.9, -4.4)]), new THREE.LineBasicMaterial({ color: "#333" }));
    this.scene.add(inverter, pole, cable);
    // Little "current" beads along the cable: they run faster with more power.
    const bead = new THREE.SphereGeometry(0.07, 10, 8);
    const beadMat = new THREE.MeshBasicMaterial({ color: "#ffd84d" });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(bead, beadMat);
      this.flow.push(m);
      this.scene.add(m);
    }

    const beamMat = new THREE.LineDashedMaterial({ color: "#ffb703", dashSize: 0.3, gapSize: 0.2 });
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), beamMat);
      this.beams.push(l);
      this.scene.add(l);
    }
    this.normalArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1.8, "#ffffff", 0.25, 0.14);
    this.beamArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 1.8, "#ff8c00", 0.25, 0.14);
    this.scene.add(this.normalArrow, this.beamArrow);

    // Seen from the north-east: the panels' tilt and the sun's arc in the south both stay in view.
    this.camera.position.set(14, 5, -3);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 3, 3);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 30;
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(85);

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.set(48, 35, 0.7);
    this.loop();
  }

  /** Sun elevation and panel tilt in degrees; `share`: 0..1 of the best possible output (panel glow, current). */
  set(elevation: number, tilt: number, share: number) {
    const e = THREE.MathUtils.degToRad(elevation);
    const dir = new THREE.Vector3(0, Math.sin(e), Math.cos(e));
    this.sun.position.copy(dir).multiplyScalar(9);
    this.sun.visible = elevation > -2;
    this.sunLight.position.copy(dir).multiplyScalar(20);
    this.sunLight.intensity = elevation > 0 ? 0.6 + 2.2 * Math.sin(e) : 0;
    const day = THREE.MathUtils.clamp(elevation / 30, 0, 1);
    (this.scene.background as THREE.Color).set("#3a4a66").lerp(new THREE.Color("#cfe4f2"), day);
    this.scene.fog!.color.copy(this.scene.background as THREE.Color);

    const b = THREE.MathUtils.degToRad(tilt);
    for (const p of this.panels) p.rotation.x = b;
    this.panelMat.emissiveIntensity = 0.12 * share;
    this.power = share;

    // Arrows on the front-middle panel.
    const front = this.panels[(ROWS - 1) * COLS + Math.floor(COLS / 2)];
    const centre = front.position.clone().add(new THREE.Vector3(0, 0.05, 0));
    const normal = new THREE.Vector3(0, Math.cos(b), Math.sin(b));
    this.normalArrow.position.copy(centre);
    this.normalArrow.setDirection(normal);
    this.beamArrow.position.copy(centre).addScaledVector(dir, 1.8);
    this.beamArrow.setDirection(dir.clone().negate());
    this.beamArrow.visible = elevation > 0;
    this.labels.normal.copy(centre).addScaledVector(normal, 2);
    this.labels.sun.copy(this.sun.position).add(new THREE.Vector3(0, 1.4, 0));

    this.beams.forEach((l, i) => {
      const target = this.panels[i * 4 + 1].position;
      l.geometry.setFromPoints([this.sun.position, target]);
      l.computeLineDistances();
      l.visible = elevation > 0;
    });
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
    const t = this.reduceMotion ? 0 : performance.now() / 1000;
    const a = new THREE.Vector3(-3.6, 1, -4.4);
    const m = new THREE.Vector3(-5.4, 3.2, -4.4);
    const z = new THREE.Vector3(-7.2, 3.9, -4.4);
    this.flow.forEach((bead, i) => {
      const u = (t * (0.15 + 0.6 * this.power) + i / this.flow.length) % 1;
      bead.visible = this.power > 0.02;
      if (u < 0.5) bead.position.lerpVectors(a, m, u * 2);
      else bead.position.lerpVectors(m, z, (u - 0.5) * 2);
    });
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.project, this.labels);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const mat of mats) {
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}
