import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { ALL_STARS, CONSTELLATIONS, horizonDir, POLARIS } from "./sky-data";

/*
 * The night sky over an observer: the ground with a compass rose, the star dome turning round the celestial
 * pole, the Big Dipper's pointer stars leading to Polaris, the angle of Polaris above the horizon (= the
 * latitude) and an azimuth arrow on the ground. Axes: +y up, −z north, +x east.
 */

const D = Math.PI / 180;
const SKY_R = 40;

/** Where the narration sends the camera. */
export type SkyView = "sky" | "north" | "dipper" | "cas" | "south" | "side" | "ground";
/** What the narration lights up: constellations, the pointer stars, Polaris, the directions. */
export type SkyLit = "uma" | "umi" | "cas" | "crux" | "pointers" | "polaris" | "n" | "e" | "s" | "w";
const CONSTELLATION_IDS = ["uma", "umi", "cas", "crux"] as const;
const LINE_COLORS: Record<string, string> = { uma: "#7cc4ff", umi: "#ffd166", cas: "#c4b5fd", crux: "#9ae6b4" };

export interface SkyAnchors {
  polaris: THREE.Vector3;
  dubhe: THREE.Vector3;
  merak: THREE.Vector3;
  uma: THREE.Vector3;
  umi: THREE.Vector3;
  cas: THREE.Vector3;
  crux: THREE.Vector3;
  pole: THREE.Vector3;
  arc: THREE.Vector3;
  azimuth: THREE.Vector3;
  n: THREE.Vector3;
  e: THREE.Vector3;
  s: THREE.Vector3;
  w: THREE.Vector3;
}
export type SkyAnchor = keyof SkyAnchors;
export type Projector = (p: THREE.Vector3) => { x: number; y: number; visible: boolean };

function roseTexture() {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const m = size / 2;
  ctx.translate(m, m);
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, m - 8, 0, Math.PI * 2);
  ctx.stroke();
  for (let a = 0; a < 360; a += 10) {
    const r0 = a % 90 === 0 ? m - 60 : a % 30 === 0 ? m - 40 : m - 26;
    const t = (a - 90) * D; // 0° = north = up on the texture
    ctx.lineWidth = a % 90 === 0 ? 5 : 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(t) * r0, Math.sin(t) * r0);
    ctx.lineTo(Math.cos(t) * (m - 8), Math.sin(t) * (m - 8));
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "bold 30px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const a of [30, 60, 120, 150, 210, 240, 300, 330]) {
    const t = (a - 90) * D;
    ctx.fillText(`${a}°`, Math.cos(t) * (m - 76), Math.sin(t) * (m - 76));
  }
  // North needle.
  ctx.fillStyle = "#ff5a4f";
  ctx.beginPath();
  ctx.moveTo(0, -(m - 70));
  ctx.lineTo(16, 0);
  ctx.lineTo(-16, 0);
  ctx.fill();
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.moveTo(0, m - 70);
  ctx.lineTo(16, 0);
  ctx.lineTo(-16, 0);
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Background stars spread over the sphere, with fixed RA/Dec so they turn with the sky. */
function backgroundStars(count = 900) {
  let s = 11;
  const rnd = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: count }, () => ({ ra: rnd() * 360, dec: Math.asin(rnd() * 2 - 1) / D }));
}

export class SkyScene {
  onFrame: ((project: Projector, anchors: SkyAnchors) => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(66, 1, 0.1, 200);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private lat = 41.7;
  private lst = 18 * 15;
  private dirty = true;
  private bg = backgroundStars();
  private bgPoints: THREE.Points;
  private brightPoints: THREE.Points;
  private polarisMesh: THREE.Group;
  private lines = new Map<string, THREE.LineSegments>();
  private pointer: THREE.Line;
  private altArc: THREE.Group;
  private azGroup: THREE.Group;
  private azArc: THREE.Mesh;
  private azArrow: THREE.ArrowHelper;
  /** Narration extras: the stars' daily circles, the axis to the celestial pole, the pointer line drawn out. */
  private trails: THREE.LineSegments;
  private axis = new THREE.Group();
  private poleRing: THREE.Mesh;
  private pointerK = 1;
  private pointerGrow = 0;
  private flight: { from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; start: number } | null = null;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private tmp = { x: 0, y: 0, z: 0 };
  private anchors: SkyAnchors = {
    polaris: new THREE.Vector3(),
    dubhe: new THREE.Vector3(),
    merak: new THREE.Vector3(),
    uma: new THREE.Vector3(),
    umi: new THREE.Vector3(),
    cas: new THREE.Vector3(),
    crux: new THREE.Vector3(),
    pole: new THREE.Vector3(),
    arc: new THREE.Vector3(),
    azimuth: new THREE.Vector3(),
    n: new THREE.Vector3(0, 0.6, -22),
    e: new THREE.Vector3(22, 0.6, 0),
    s: new THREE.Vector3(0, 0.6, 22),
    w: new THREE.Vector3(-22, 0.6, 0),
  };

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color("#070d1f");

    // Sky dome with a faint glow towards the horizon.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(SKY_R + 4, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader: /* glsl */ `varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: /* glsl */ `varying float vY; void main(){ vec3 top = vec3(0.02,0.04,0.10); vec3 low = vec3(0.10,0.15,0.28); gl_FragColor = vec4(mix(low, top, smoothstep(0.0, 0.5, vY)), 1.0); }`,
      }),
    );
    this.scene.add(dome);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(SKY_R + 6, 96), new THREE.MeshBasicMaterial({ color: "#15201a" }));
    ground.rotation.x = -Math.PI / 2;
    const rose = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.MeshBasicMaterial({ map: roseTexture(), transparent: true, depthWrite: false }));
    rose.rotation.x = -Math.PI / 2;
    rose.position.y = 0.02;
    this.scene.add(ground, rose);

    // Far hills on the horizon (a dark ring with a jagged top).
    const hills = new THREE.Group();
    const hillMat = new THREE.MeshBasicMaterial({ color: "#0c140f", side: THREE.DoubleSide });
    for (let i = 0; i < 64; i++) {
      const a0 = (i / 64) * Math.PI * 2;
      const a1 = ((i + 1) / 64) * Math.PI * 2;
      const h0 = 0.6 + 1.4 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6));
      const h1 = 0.6 + 1.4 * Math.abs(Math.sin((i + 1) * 1.7) * Math.cos((i + 1) * 0.6));
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.sin(a0) * SKY_R, 0, -Math.cos(a0) * SKY_R),
        new THREE.Vector3(Math.sin(a1) * SKY_R, 0, -Math.cos(a1) * SKY_R),
        new THREE.Vector3(Math.sin(a1) * SKY_R, h1, -Math.cos(a1) * SKY_R),
        new THREE.Vector3(Math.sin(a0) * SKY_R, 0, -Math.cos(a0) * SKY_R),
        new THREE.Vector3(Math.sin(a1) * SKY_R, h1, -Math.cos(a1) * SKY_R),
        new THREE.Vector3(Math.sin(a0) * SKY_R, h0, -Math.cos(a0) * SKY_R),
      ]);
      hills.add(new THREE.Mesh(g, hillMat));
    }
    this.scene.add(hills);

    // The observer.
    const person = new THREE.Group();
    const skin = new THREE.MeshBasicMaterial({ color: "#f2c9a0" });
    const coat = new THREE.MeshBasicMaterial({ color: "#3b6fb0" });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.95, 16), coat);
    body.position.y = 0.48;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), skin);
    head.position.y = 1.1;
    person.add(body, head);
    this.scene.add(person);

    // Stars.
    this.bgPoints = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.bg.length * 3), 3)),
      new THREE.PointsMaterial({ color: "#c9d6ff", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.7 }),
    );
    this.brightPoints = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(ALL_STARS.length * 3), 3)),
      new THREE.PointsMaterial({ color: "#ffffff", size: 4.2, sizeAttenuation: false }),
    );
    this.polarisMesh = new THREE.Group();
    this.polarisMesh.add(
      new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshBasicMaterial({ color: "#fff8d6" })),
      new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), new THREE.MeshBasicMaterial({ color: "#ffe9a3", transparent: true, opacity: 0.25, depthWrite: false })),
    );
    this.scene.add(this.bgPoints, this.brightPoints, this.polarisMesh);

    for (const c of CONSTELLATIONS) {
      const seg = new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(c.lines.length * 6), 3)),
        new THREE.LineBasicMaterial({ color: LINE_COLORS[c.id], transparent: true, opacity: 0.8 }),
      );
      this.lines.set(c.id, seg);
      this.scene.add(seg);
    }
    this.pointer = new THREE.Line(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3)),
      new THREE.LineDashedMaterial({ color: "#ff8fa3", dashSize: 0.8, gapSize: 0.6 }),
    );
    this.scene.add(this.pointer);

    const trailStars = ALL_STARS.filter((s) => s.id !== "polaris");
    this.trails = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(trailStars.length * 96 * 6), 3)),
      new THREE.LineBasicMaterial({ color: "#9fc3ff", transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.trails.visible = false;
    this.poleRing = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.45, 48), new THREE.MeshBasicMaterial({ color: "#ff8fa3", transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    const axisLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), new THREE.LineDashedMaterial({ color: "#ff8fa3", dashSize: 0.02, gapSize: 0.015 }));
    axisLine.computeLineDistances();
    axisLine.name = "axis";
    this.axis.add(axisLine, this.poleRing);
    this.axis.visible = false;
    this.scene.add(this.trails, this.axis);
    // These are moved every time the sky turns: their first bounds would cull them once they leave that place.
    for (const o of [this.bgPoints, this.brightPoints, this.pointer, this.trails, ...this.lines.values()]) o.frustumCulled = false;

    // Altitude of Polaris: an arc from the north horizon up to the star, plus the sight line.
    this.altArc = new THREE.Group();
    this.scene.add(this.altArc);

    // Azimuth on the ground: arc from north clockwise, and an arrow.
    this.azGroup = new THREE.Group();
    this.azArc = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.7, 64, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    this.azArc.rotation.x = -Math.PI / 2;
    this.azArc.position.y = 0.04;
    this.azArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0.08, 0), 6, "#ffd166", 0.7, 0.45);
    this.azGroup.add(this.azArc, this.azArrow);
    this.scene.add(this.azGroup);

    this.camera.position.set(0, 2.6, 7.5);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 6.2, -2);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.rotateSpeed = 0.5;
    this.controls.addEventListener("start", () => (this.flight = null));

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.setAzimuth(0);
    this.loop();
  }

  setLatitude(lat: number) {
    this.lat = lat;
    this.dirty = true;
  }

  /** Local sidereal time in hours: turns the sky round the pole. */
  setTime(hours: number) {
    this.lst = hours * 15;
    this.dirty = true;
  }

  setAzimuth(az: number) {
    const a = THREE.MathUtils.euclideanModulo(az, 360);
    // RingGeometry's angle runs counter-clockwise from +x; on the ground (after the −90° tilt) that is from
    // east towards north. Azimuth runs clockwise from north: start at north and sweep towards east.
    this.azArc.geometry.dispose();
    this.azArc.geometry = new THREE.RingGeometry(2.4, 2.7, 64, 1, Math.PI / 2 - a * D, Math.max(a, 0.01) * D);
    const dir = new THREE.Vector3(Math.sin(a * D), 0, -Math.cos(a * D));
    this.azArrow.setDirection(dir);
    this.anchors.azimuth.copy(dir).multiplyScalar(6.6).setY(0.4);
  }

  /** Emphasis for the how-to steps: 0 = everything, 1 Big Dipper, 2 pointer line, 3 Polaris, 4 compass. */
  setStep(step: number) {
    const on = (s: number) => step === 0 || step === s;
    (this.lines.get("uma")!.material as THREE.LineBasicMaterial).opacity = on(1) || step === 2 ? 1 : 0.35;
    (this.lines.get("umi")!.material as THREE.LineBasicMaterial).opacity = on(3) ? 1 : 0.35;
    (this.lines.get("cas")!.material as THREE.LineBasicMaterial).opacity = step === 0 ? 0.8 : 0.25;
    (this.lines.get("crux")!.material as THREE.LineBasicMaterial).opacity = step === 0 ? 0.8 : 0.25;
    this.pointer.visible = step === 0 || step >= 2;
    this.pointerK = 1;
    this.pointerGrow = 0;
    this.polarisMesh.scale.setScalar(step === 3 ? 1.6 : 1);
    this.altArc.visible = step === 0 || step === 3;
    this.azGroup.visible = step === 0 || step === 4;
    this.azArc.visible = true;
    this.trails.visible = false;
    this.axis.visible = false;
    this.dirty = true;
  }

  /** What the narration shows: lit constellations (the rest dim), Polaris enlarged, the extras. */
  narrate(s: { lit: SkyLit[]; pointer: "off" | "on" | "grow"; arc: boolean; azimuth: boolean; azArc: boolean; trails: boolean; axis: boolean }) {
    const anyLit = CONSTELLATION_IDS.some((c) => s.lit.includes(c));
    for (const c of CONSTELLATION_IDS) (this.lines.get(c)!.material as THREE.LineBasicMaterial).opacity = !anyLit ? 0.8 : s.lit.includes(c) ? 1 : 0.22;
    this.polarisMesh.scale.setScalar(s.lit.includes("polaris") ? 1.7 : 1);
    if (s.pointer === "grow" && !(this.pointer.visible && this.pointerGrow)) {
      this.pointerGrow = performance.now();
      this.pointerK = this.reduceMotion ? 1 : 0;
    } else if (s.pointer !== "grow") {
      this.pointerGrow = 0;
      this.pointerK = 1;
    }
    this.pointer.visible = s.pointer !== "off";
    this.altArc.visible = s.arc;
    this.azGroup.visible = s.azimuth;
    this.azArc.visible = s.azArc;
    this.trails.visible = s.trails;
    this.axis.visible = s.axis;
    this.dirty = true;
  }

  /** Fly the camera to a view, worked out for the sky at latitude `lat` and sidereal time `hours`. */
  view(name: SkyView, lat: number, hours: number, instant = false) {
    const dirOf = (ra: number, dec: number) => {
      horizonDir(ra, dec, lat, hours * 15, this.tmp);
      return new THREE.Vector3(this.tmp.x, this.tmp.y, this.tmp.z);
    };
    const centre = (id: string) => {
      const c = CONSTELLATIONS.find((x) => x.id === id)!;
      return c.stars.reduce((v, s) => v.add(dirOf(s.ra, s.dec)), new THREE.Vector3()).normalize();
    };
    /**
     * Just behind the observer's head, looking along a direction in the sky (the sky is far, so the view is true to
     * it), aimed a little lower: subtitles run along the bottom.
     */
    const look = (dir: THREE.Vector3, back = 2.6): [THREE.Vector3, THREE.Vector3] => {
      const flat = new THREE.Vector3(dir.x, 0, dir.z);
      if (flat.lengthSq() < 1e-4) flat.set(0, 0, -1);
      flat.normalize();
      const eye = flat.clone().multiplyScalar(-back).add(new THREE.Vector3(0, 1.9, 0));
      return [eye, dir.clone().multiplyScalar(9).add(eye).add(new THREE.Vector3(0, -1.3, 0))];
    };
    const pole = new THREE.Vector3(0, Math.sin(lat * D), -Math.cos(lat * D));
    const views: Record<SkyView, () => [THREE.Vector3, THREE.Vector3]> = {
      sky: () => [new THREE.Vector3(0, 2.6, 7.5), new THREE.Vector3(0, 6.2, -2)],
      north: () => look(pole.clone()),
      dipper: () => look(centre("uma").add(dirOf(POLARIS.ra, POLARIS.dec)).normalize()),
      cas: () => look(centre("cas").add(pole).normalize()),
      south: () => look(centre("crux")),
      // From the east: the altitude of Polaris as an angle over the northern horizon.
      side: () => [new THREE.Vector3(14.5, 4.2, -2.5), new THREE.Vector3(0, 4.2, -3.6)],
      // From above and behind: the compass rose on the ground.
      ground: () => [new THREE.Vector3(0, 11.5, 10.2), new THREE.Vector3(0, -0.6, 1.2)],
    };
    const to = views[name]();
    // Looking up steeply needs the camera to go further under its target than a pupil may drag it.
    const off = to[0].clone().sub(to[1]);
    this.controls.maxPolarAngle = Math.max(Math.PI * 0.62, Math.acos(THREE.MathUtils.clamp(off.y / off.length(), -1, 1)) + 0.02);
    if (instant || this.reduceMotion) {
      this.flight = null;
      this.camera.position.copy(to[0]);
      this.controls.target.copy(to[1]);
      return;
    }
    this.flight = { from: [this.camera.position.clone(), this.controls.target.clone()], to, start: performance.now() };
  }

  private place(ra: number, dec: number, r: number, out: THREE.Vector3) {
    horizonDir(ra, dec, this.lat, this.lst, this.tmp);
    return out.set(this.tmp.x, this.tmp.y, this.tmp.z).multiplyScalar(r);
  }

  private update() {
    const v = new THREE.Vector3();
    const bgPos = this.bgPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
    this.bg.forEach((s, i) => {
      this.place(s.ra, s.dec, SKY_R, v);
      bgPos.setXYZ(i, v.x, v.y, v.z);
    });
    bgPos.needsUpdate = true;

    const pos: Record<string, THREE.Vector3> = {};
    const brPos = this.brightPoints.geometry.getAttribute("position") as THREE.BufferAttribute;
    ALL_STARS.forEach((s, i) => {
      const p = this.place(s.ra, s.dec, SKY_R * 0.98, new THREE.Vector3());
      pos[s.id] = p;
      brPos.setXYZ(i, p.x, p.y, p.z);
    });
    brPos.needsUpdate = true;
    this.polarisMesh.position.copy(pos.polaris);

    for (const c of CONSTELLATIONS) {
      const attr = this.lines.get(c.id)!.geometry.getAttribute("position") as THREE.BufferAttribute;
      c.lines.forEach(([a, b], i) => {
        attr.setXYZ(i * 2, pos[a].x, pos[a].y, pos[a].z);
        attr.setXYZ(i * 2 + 1, pos[b].x, pos[b].y, pos[b].z);
      });
      attr.needsUpdate = true;
      const centre = this.anchors[c.id as "uma" | "umi" | "cas" | "crux"];
      centre.set(0, 0, 0);
      for (const s of c.stars) centre.add(pos[s.id]);
      centre.divideScalar(c.stars.length);
      if (c.id === "umi") centre.lerp(pos.kochab, 0.5);
    }
    // Pointer: Merak → Dubhe, continued on to Polaris (drawn out while the voice tells it).
    const pAttr = this.pointer.geometry.getAttribute("position") as THREE.BufferAttribute;
    const start = pos.merak.clone().lerp(pos.dubhe, -0.15);
    const end = start.clone().lerp(pos.polaris, Math.max(0.02, this.pointerK));
    pAttr.setXYZ(0, start.x, start.y, start.z);
    pAttr.setXYZ(1, end.x, end.y, end.z);
    pAttr.needsUpdate = true;
    this.pointer.computeLineDistances();

    // The stars' daily circles round the celestial pole, and the axis to the pole.
    if (this.trails.visible) {
      const tAttr = this.trails.geometry.getAttribute("position") as THREE.BufferAttribute;
      const a = new THREE.Vector3();
      const b = new THREE.Vector3();
      let n = 0;
      for (const s of ALL_STARS) {
        if (s.id === "polaris") continue;
        for (let k = 0; k < 96; k++) {
          horizonDir(s.ra, s.dec, this.lat, (k / 96) * 360, this.tmp);
          a.set(this.tmp.x, this.tmp.y, this.tmp.z).multiplyScalar(SKY_R * 0.97);
          horizonDir(s.ra, s.dec, this.lat, ((k + 1) / 96) * 360, this.tmp);
          b.set(this.tmp.x, this.tmp.y, this.tmp.z).multiplyScalar(SKY_R * 0.97);
          tAttr.setXYZ(n++, a.x, a.y, a.z);
          tAttr.setXYZ(n++, b.x, b.y, b.z);
        }
      }
      tAttr.needsUpdate = true;
    }
    const poleDir = new THREE.Vector3(0, Math.sin(this.lat * D), -Math.cos(this.lat * D));
    this.anchors.pole.copy(poleDir).multiplyScalar(SKY_R * 0.97);
    this.poleRing.position.copy(this.anchors.pole);
    this.poleRing.lookAt(0, 0, 0);
    const axisLine = this.axis.getObjectByName("axis") as THREE.Line;
    axisLine.scale.setScalar(SKY_R * 0.97);
    axisLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleDir);
    axisLine.position.set(0, 0.05, 0);

    this.anchors.polaris.copy(pos.polaris);
    this.anchors.dubhe.copy(pos.dubhe);
    this.anchors.merak.copy(pos.merak);

    // Altitude arc: Polaris' altitude stands for the observer's latitude.
    for (const c of [...this.altArc.children]) {
      this.altArc.remove(c);
      (c as THREE.Mesh).geometry.dispose();
    }
    const alt = Math.asin(THREE.MathUtils.clamp(pos.polaris.y / (SKY_R * 0.98), -1, 1));
    const az = Math.atan2(pos.polaris.x, -pos.polaris.z);
    if (alt > 0) {
      const R = 7;
      const pts = Array.from({ length: 33 }, (_, i) => {
        const t = (alt * i) / 32;
        return new THREE.Vector3(Math.sin(az) * Math.cos(t) * R, Math.sin(t) * R + 0.05, -Math.cos(az) * Math.cos(t) * R);
      });
      const mat = new THREE.LineBasicMaterial({ color: "#ffd166" });
      this.altArc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
      this.altArc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(Math.sin(az) * R * 1.3, 0.05, -Math.cos(az) * R * 1.3)]), mat));
      const sight = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.05, 0), pos.polaris.clone().multiplyScalar(0.95)]), new THREE.LineDashedMaterial({ color: "#fff3c4", dashSize: 0.6, gapSize: 0.5 }));
      sight.computeLineDistances();
      this.altArc.add(sight);
      const mid = alt / 2;
      this.anchors.arc.set(Math.sin(az) * Math.cos(mid) * R * 1.12, Math.sin(mid) * R * 1.12, -Math.cos(az) * Math.cos(mid) * R * 1.12);
    } else {
      this.anchors.arc.set(0, -100, 0);
    }
    this.dirty = false;
  }

  private project: Projector = (p) => {
    const v = p.clone().project(this.camera);
    return {
      x: ((v.x + 1) / 2) * this.canvas.clientWidth,
      y: ((1 - v.y) / 2) * this.canvas.clientHeight,
      visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && p.y > -0.5,
    };
  };

  private resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 66 / Math.max(0.6, w / h) : 66;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    const now = performance.now();
    if (this.pointerGrow && this.pointerK < 1) {
      this.pointerK = Math.min(1, (now - this.pointerGrow) / 2600);
      this.dirty = true;
    }
    if (this.dirty) this.update();
    if (this.axis.visible) (this.poleRing.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.4 * Math.sin(now / 260);
    if (this.flight) {
      const k = Math.min(1, (now - this.flight.start) / 1800);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      this.camera.position.lerpVectors(this.flight.from[0], this.flight.to[0], e);
      this.controls.target.lerpVectors(this.flight.from[1], this.flight.to[1], e);
      if (k >= 1) this.flight = null;
    }
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
      for (const mat of mats) {
        (mat as THREE.MeshBasicMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}

