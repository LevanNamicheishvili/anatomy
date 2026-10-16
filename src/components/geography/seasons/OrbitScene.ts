import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { vec3ToLatLon } from "../globe/coords";
import { earthMesh, starField } from "../globe/earth";
import { AXIAL_TILT } from "../globe/graticule";
import { snowShells } from "./snow";
import { orbitAngle, TURNING_POINTS } from "./sun-math";

/*
 * The Earth going round the Sun (seasons lesson): the Sun in the middle lights the Earth, so its day half and night
 * half show as they are; the axis leans 23,44° the same way all year (towards Polaris), so in June the northern half
 * is turned to the Sun and in December the southern one. Four small Earths stand at the solstices and equinoxes, the
 * big one is at the chosen date, with the season's snow. Sizes are not to scale (the Earth is drawn huge).
 * Axes: +y north (up from the orbit), June solstice on +x, the Earth runs anticlockwise seen from the north.
 */

const D = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
const ORBIT_R = 7.5;
const EARTH_R = 0.9;
/** The four turning-point Earths, relative to the big one. */
const MINI = 0.6;
const SUN_R = 1.3;
/** The axis leans towards −x: to the Sun when the Earth is on +x (June). It stays so all year. */
export const ORBIT_AXIS = new THREE.Vector3(-Math.sin(AXIAL_TILT * D), Math.cos(AXIAL_TILT * D), 0);

/** Where the Earth is on the orbit on a day of the year. */
export function orbitPosition(day: number, out = new THREE.Vector3()) {
  const a = orbitAngle(day) * D;
  return out.set(Math.cos(a) * ORBIT_R, 0, -Math.sin(a) * ORBIT_R);
}

/** Turn the Earth: its axis along `axis`, with the sun (direction `sun`) over the longitude where it is noon at `utc`. */
export function orientEarth(axis: THREE.Vector3, sun: THREE.Vector3, utc: number, out = new THREE.Quaternion()) {
  const tilt = new THREE.Quaternion().setFromUnitVectors(Y, axis);
  const sunInTilted = sun.clone().applyQuaternion(tilt.clone().invert());
  const target = -(utc - 12) * 15; // longitude where it is solar noon
  const spin = (vec3ToLatLon(sunInTilted).lon - target) * D;
  return out.copy(tilt).multiply(new THREE.Quaternion().setFromAxisAngle(Y, spin));
}

export type OrbitView = "overview" | "top" | "near";

/** What the narration lights up in the orbit picture. */
export interface OrbitLit {
  /** "Day" and "night" on the two halves of the big Earth. */
  daynight: boolean;
  /** The day/night border on the big Earth, named. */
  terminator: boolean;
  /** Arrows along every axis, all parallel: they all point to Polaris. */
  polaris: boolean;
  /** Nearest and farthest points of the orbit. */
  distance: boolean;
  /** The four turning points named. */
  four: boolean;
}

export interface OrbitAnchors {
  sun: THREE.Vector3;
  earth: THREE.Vector3;
  day: THREE.Vector3;
  night: THREE.Vector3;
  terminator: THREE.Vector3;
  north: THREE.Vector3;
  south: THREE.Vector3;
  polaris: THREE.Vector3;
  near: THREE.Vector3;
  far: THREE.Vector3;
  march: THREE.Vector3;
  june: THREE.Vector3;
  september: THREE.Vector3;
  december: THREE.Vector3;
}
export type OrbitAnchor = keyof OrbitAnchors;
export type OrbitProjector = (p: THREE.Vector3) => { x: number; y: number; visible: boolean };

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,240,190,1)");
  g.addColorStop(0.25, "rgba(255,210,110,0.55)");
  g.addColorStop(1, "rgba(255,180,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** An arrow along +y from the origin: a thin shaft and a cone. */
function arrow(length: number, radius: number, color: string) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length * 0.82, 8), mat);
  shaft.position.y = length * 0.41;
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3.2, length * 0.18, 12), mat);
  head.position.y = length * 0.91;
  g.add(shaft, head);
  return g;
}

interface EarthModel {
  /** On the orbit; the axis and arrows in it keep their direction in space. */
  group: THREE.Group;
  /** The planet itself (turns with the clock). */
  ball: THREE.Group;
  pointer: THREE.Group;
  /** Its snow for a day of the year. */
  snowDay: (day: number) => void;
}

export class OrbitScene {
  onFrame: ((project: OrbitProjector, anchors: OrbitAnchors) => void) | null = null;

  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 300);
  private controls: OrbitControls;
  private observer: ResizeObserver;
  private frame = 0;
  private paused = false;
  private disposed = false;
  private reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  private big: EarthModel;
  private minis: (EarthModel & { day: number })[];
  private terminator: THREE.Mesh;
  private termGlow: THREE.Mesh;
  private distance = new THREE.Group();
  private mode: OrbitView = "overview";
  /** The camera rides with the big Earth (the "near" view) until the user turns the view by hand. */
  private follow = false;
  private flight: { from: [THREE.Vector3, THREE.Vector3]; start: number; dur: number } | null = null;
  private earthPos = new THREE.Vector3();
  private sunward = new THREE.Vector3();
  private anchors: OrbitAnchors = {
    sun: new THREE.Vector3(0, SUN_R * 1.4, -SUN_R * 1.5),
    earth: new THREE.Vector3(),
    day: new THREE.Vector3(),
    night: new THREE.Vector3(),
    terminator: new THREE.Vector3(),
    north: new THREE.Vector3(),
    south: new THREE.Vector3(),
    polaris: new THREE.Vector3(),
    near: new THREE.Vector3(),
    far: new THREE.Vector3(),
    march: new THREE.Vector3(),
    june: new THREE.Vector3(),
    september: new THREE.Vector3(),
    december: new THREE.Vector3(),
  };

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // The Sun, its glow and its light.
    const sun = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 48, 32), new THREE.MeshBasicMaterial({ color: "#ffd84d" }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(SUN_R * 5.5);
    this.scene.add(sun, glow, new THREE.PointLight("#fff4e0", 3.4, 0, 0), new THREE.AmbientLight("#9fb4d6", 0.2), starField());

    // The orbit, dashed, with arrows the way the Earth goes.
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(Array.from({ length: 256 }, (_, i) => new THREE.Vector3(Math.cos((i / 256) * Math.PI * 2) * ORBIT_R, 0, -Math.sin((i / 256) * Math.PI * 2) * ORBIT_R))),
      new THREE.LineDashedMaterial({ color: "#8aa0c8", dashSize: 0.28, gapSize: 0.2, transparent: true, opacity: 0.85 }),
    );
    ring.computeLineDistances();
    this.scene.add(ring);
    for (const a of [45, 135, 225, 315]) {
      const t = a * D;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 12), new THREE.MeshBasicMaterial({ color: "#8aa0c8" }));
      head.position.set(Math.cos(t) * ORBIT_R, 0, -Math.sin(t) * ORBIT_R);
      head.quaternion.setFromUnitVectors(Y, new THREE.Vector3(-Math.sin(t), 0, -Math.cos(t)));
      this.scene.add(head);
    }

    // The Earths: one photo, one geometry; each its own snow (its own date).
    const globe = earthMesh(1);
    const snow = snowShells();
    const model = (r: number, day: number): EarthModel => {
      const group = new THREE.Group();
      const ball = new THREE.Group();
      const sn = snow(1, day);
      ball.add(globe.clone(), sn.mesh);
      ball.scale.setScalar(r);
      const axis = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.025, r * 0.025, r * 2.8, 8), new THREE.MeshBasicMaterial({ color: "#ffffff" }));
      axis.quaternion.setFromUnitVectors(Y, ORBIT_AXIS);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.07, 12, 8), new THREE.MeshBasicMaterial({ color: "#ff5a4f" }));
      tip.position.copy(ORBIT_AXIS).multiplyScalar(r * 1.4);
      const pointer = arrow(r * 2.4, r * 0.03, "#ffd166");
      pointer.position.copy(tip.position);
      pointer.quaternion.setFromUnitVectors(Y, ORBIT_AXIS);
      pointer.visible = false;
      group.add(ball, axis, tip, pointer);
      this.scene.add(group);
      return { group, ball, pointer, snowDay: sn.setDay };
    };
    this.big = model(EARTH_R, 172);
    this.minis = TURNING_POINTS.map((t) => {
      const m = model(EARTH_R * MINI, t.day);
      orbitPosition(t.day, m.group.position);
      // Noon in Georgia: the country is on the lit side, in its season.
      orientEarth(ORBIT_AXIS, m.group.position.clone().negate().normalize(), 9, m.ball.quaternion);
      this.anchors[t.id as "march" | "june" | "september" | "december"].copy(m.group.position).addScaledVector(Y, EARTH_R * MINI * 1.9);
      return { ...m, day: t.day };
    });

    // The day/night border of the big Earth: a ring square to the sunlight, and a glow round it when it is named.
    this.terminator = new THREE.Mesh(new THREE.TorusGeometry(EARTH_R * 1.012, EARTH_R * 0.014, 6, 120), new THREE.MeshBasicMaterial({ color: "#ffcf66" }));
    this.termGlow = new THREE.Mesh(
      new THREE.TorusGeometry(EARTH_R * 1.016, EARTH_R * 0.045, 8, 120),
      new THREE.MeshBasicMaterial({ color: "#ffd166", transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.terminator.add(this.termGlow);
    this.big.group.add(this.terminator);

    // Nearest (early January) and farthest (early July) points: dots on the orbit and lines to the Sun.
    for (const [day, key] of [
      [3, "near"],
      [185, "far"],
    ] as const) {
      const p = orbitPosition(day);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), p]), new THREE.LineDashedMaterial({ color: "#ffd166", dashSize: 0.3, gapSize: 0.2 }));
      line.computeLineDistances();
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: "#ffd166" }));
      dot.position.copy(p);
      this.distance.add(line, dot);
      this.anchors[key].copy(p).multiplyScalar(0.55).addScaledVector(Y, 0.5);
    }
    this.distance.visible = false;
    this.scene.add(this.distance);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 40;
    this.controls.rotateSpeed = 0.5;
    this.controls.addEventListener("start", () => {
      this.flight = null;
      this.follow = false;
    });

    this.setDate(172, 12);
    this.place(this.goal(), true);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.loop();
  }

  /** The big Earth at a day of the year, turned for a UTC time. */
  setDate(day: number, utc: number) {
    orbitPosition(day, this.earthPos);
    this.big.group.position.copy(this.earthPos);
    this.sunward.copy(this.earthPos).negate().normalize();
    orientEarth(ORBIT_AXIS, this.sunward, utc, this.big.ball.quaternion);
    this.terminator.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.sunward);
    this.big.snowDay(day);
    // The small Earth where the big one stands steps aside.
    const a = orbitAngle(day);
    for (const m of this.minis) {
      let d = Math.abs(orbitAngle(m.day) - a) % 360;
      if (d > 180) d = 360 - d;
      m.group.visible = d > 16;
    }
    const p = this.earthPos;
    const s = this.sunward;
    const a2 = this.anchors;
    a2.earth.copy(p).addScaledVector(Y, EARTH_R * 1.75);
    a2.day.copy(p).addScaledVector(s, EARTH_R * 1.55);
    a2.night.copy(p).addScaledVector(s, -EARTH_R * 1.55);
    // The top of the terminator ring, seen from the side.
    a2.terminator.copy(Y).addScaledVector(s, -Y.dot(s)).normalize().multiplyScalar(EARTH_R * 1.12).add(p);
    a2.north.copy(p).addScaledVector(ORBIT_AXIS, EARTH_R * 0.55).addScaledVector(s, -EARTH_R * 0.15);
    a2.south.copy(p).addScaledVector(ORBIT_AXIS, -EARTH_R * 0.55).addScaledVector(s, -EARTH_R * 0.15);
    a2.polaris.copy(p).addScaledVector(ORBIT_AXIS, EARTH_R * 4);
  }

  setLit(lit: OrbitLit) {
    this.terminator.visible = lit.terminator || lit.daynight;
    this.termGlow.visible = lit.terminator;
    for (const m of [this.big, ...this.minis]) m.pointer.visible = lit.polaris;
    this.distance.visible = lit.distance;
  }

  /** Fly the camera: the whole orbit from the side, from above, or beside the big Earth (the Sun in view). */
  view(name: OrbitView, instant = false) {
    this.mode = name;
    this.follow = name === "near";
    if (instant || this.reduceMotion) {
      this.flight = null;
      this.place(this.goal(), true);
    } else {
      this.flight = { from: [this.camera.position.clone(), this.controls.target.clone()], start: performance.now(), dur: 1600 };
    }
  }

  setPaused(paused: boolean) {
    if (paused === this.paused) return;
    this.paused = paused;
    if (!paused) {
      cancelAnimationFrame(this.frame);
      this.loop();
    }
  }

  /** Camera position and look-at point for the current view. */
  private goal(): [THREE.Vector3, THREE.Vector3] {
    const aspect = this.camera.aspect || 1.6;
    const far = aspect < 1 ? 1 / Math.max(0.55, aspect) : 1;
    if (this.mode === "near") {
      // Sideways to the Sun–Earth line: the Earth on the left, the Sun on the right edge.
      const side = new THREE.Vector3().crossVectors(this.sunward, Y).normalize();
      const target = this.earthPos.clone().addScaledVector(this.sunward, 2.4);
      return [target.clone().addScaledVector(side, 7.6 * far).addScaledVector(Y, 1.5), target];
    }
    // The whole orbit, a little above the middle (the subtitles take the bottom of the view).
    const top = this.mode === "top";
    const el = (top ? 74 : 24) * D;
    const az = 35 * D;
    const dist = ORBIT_R * (top ? 3.6 : 2.75) * far;
    const target = new THREE.Vector3(0, top ? 0 : -0.9, top ? 1.6 : 0);
    return [new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist).add(target), target];
  }

  private place([pos, target]: [THREE.Vector3, THREE.Vector3], now = false) {
    if (now) {
      this.camera.position.copy(pos);
      this.controls.target.copy(target);
    }
    this.camera.lookAt(this.controls.target);
  }

  private project: OrbitProjector = (p) => {
    const v = p.clone().project(this.camera);
    return {
      x: ((v.x + 1) / 2) * this.canvas.clientWidth,
      y: ((1 - v.y) / 2) * this.canvas.clientHeight,
      visible: v.z < 1 && Math.abs(v.x) < 1.02 && Math.abs(v.y) < 1.02,
    };
  };

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
    if (this.disposed || this.paused) return;
    this.frame = requestAnimationFrame(this.loop);
    if (this.flight) {
      const k = Math.min(1, (performance.now() - this.flight.start) / this.flight.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
      const [pos, target] = this.goal();
      this.camera.position.lerpVectors(this.flight.from[0], pos, e);
      this.controls.target.lerpVectors(this.flight.from[1], target, e);
      if (k >= 1) this.flight = null;
    } else if (this.follow) {
      // Riding along with the Earth round the year.
      const [pos, target] = this.goal();
      this.camera.position.lerp(pos, 0.12);
      this.controls.target.lerp(target, 0.12);
    }
    if (this.termGlow.visible) (this.termGlow.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.25 * Math.sin(performance.now() / 260);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.onFrame?.(this.project, this.anchors);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    this.controls.dispose();
    const seen = new Set<THREE.Material | THREE.BufferGeometry>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry && !seen.has(m.geometry)) {
        seen.add(m.geometry);
        m.geometry.dispose();
      }
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        if (seen.has(mat)) continue;
        seen.add(mat);
        (mat as THREE.MeshStandardMaterial).map?.dispose();
        mat.dispose();
      }
    });
    this.renderer.dispose();
  }
}
