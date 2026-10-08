import * as THREE from "three";
import { rng, v, type Kit, type V3 } from "@/components/journeys/JourneyScene";
import type { BattleSim, Ground } from "./sim";

/*
 * What moves round the soldiers: arrows in flight, dust thrown up by galloping horses, smoke from the camp
 * fires, the regiments' banners and the Turkic horse-tail standards (tugh), the coalition's camp of yurts and
 * tents with the commanders' pavilion, and the arrows of the manoeuvres painted on the ground.
 */

// ---- Arrows -----------------------------------------------------------------------------------------------

interface Arrow {
  from: V3;
  to: V3;
  t: number;
  T: number;
  arc: number;
  target: number;
  hit: boolean;
  stuck: number;
}

export class Arrows {
  readonly mesh: THREE.InstancedMesh;
  private list: Arrow[] = [];
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private d = new THREE.Vector3();
  private s = new THREE.Vector3(1.5, 1.5, 1.5);
  private r = rng(55);

  constructor(
    k: Kit,
    private cap: number,
  ) {
    const parts = [new THREE.BoxGeometry(0.014, 0.014, 0.82), new THREE.ConeGeometry(0.018, 0.07, 4).rotateX(Math.PI / 2).translate(0, 0, 0.44), new THREE.PlaneGeometry(0.05, 0.14).rotateX(-Math.PI / 2).rotateZ(Math.PI / 2).translate(0, 0, -0.34)];
    const g = new THREE.BufferGeometry();
    const merged = parts.map((x) => x.toNonIndexed());
    const pos = merged.flatMap((x) => Array.from(x.attributes.position.array as Float32Array));
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    for (const x of [...parts, ...merged]) x.dispose();
    this.mesh = new THREE.InstancedMesh(k.track(g), k.track(new THREE.MeshStandardMaterial({ color: "#3a2a1c", roughness: 0.8, side: THREE.DoubleSide })), cap);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.userData.noShadowFit = true;
  }

  clear() {
    this.list = [];
    this.mesh.count = 0;
  }

  /** Takes the shots the simulation asked for and flies everything one step. */
  /** `hit`: chance an arrow kills, against [Georgians, coalition]. */
  update(dt: number, sim: BattleSim, ground: Ground, hit: [number, number]) {
    for (const s of sim.shots) {
      if (this.list.length >= this.cap) break;
      const from = v(sim.x[s.from], ground.y(sim.x[s.from], sim.z[s.from]) + (sim.mounted[s.from] ? 2.3 : 1.5), sim.z[s.from]);
      const spread = 3.5;
      const tx = sim.x[s.to] + (this.r() - 0.5) * spread;
      const tz = sim.z[s.to] + (this.r() - 0.5) * spread;
      const to = v(tx, ground.y(tx, tz) + 0.2, tz);
      const dist = from.distanceTo(to);
      const side = sim.regs[sim.reg[s.to]].def.side;
      this.list.push({ from, to, t: 0, T: dist / 52 + 0.25, arc: dist * 0.16, target: s.to, hit: this.r() < hit[side], stuck: 0 });
    }
    sim.shots.length = 0;
    let n = 0;
    const keep: Arrow[] = [];
    for (const a of this.list) {
      if (a.t < a.T) {
        a.t += dt;
        if (a.t >= a.T && a.hit && sim.isAlive(a.target)) sim.kill(a.target);
      } else a.stuck += dt;
      if (a.stuck > 6) continue;
      keep.push(a);
      const u = Math.min(1, a.t / a.T);
      this.p.lerpVectors(a.from, a.to, u);
      this.p.y += 4 * a.arc * u * (1 - u);
      // Direction of flight.
      this.d.subVectors(a.to, a.from);
      this.d.y += 4 * a.arc * (1 - 2 * u);
      this.d.normalize();
      this.q.setFromUnitVectors(Z, this.d);
      this.m4.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(n++, this.m4);
    }
    this.list = keep;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const Z = new THREE.Vector3(0, 0, 1);

// ---- Particles (dust, smoke) -----------------------------------------------------------------------------------

export class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private n = 0;
  private head = 0;

  constructor(
    k: Kit,
    private cap: number,
    color: string,
    private grow: number,
    opacity: number,
  ) {
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.age = new Float32Array(cap);
    this.life = new Float32Array(cap).fill(1);
    this.size = new Float32Array(cap);
    this.alpha = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uScale: { value: 600 }, ...THREE.UniformsLib.fog },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        uniform float uScale;
        #include <fog_pars_vertex>
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aSize * uScale / max(1.0, -mvPosition.z);
          vAlpha = aAlpha;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying float vAlpha;
        #include <fog_pars_fragment>
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c) * 2.0;
          if (r > 1.0) discard;
          float a = (1.0 - r * r) * (1.0 - r * r) * vAlpha * uOpacity;
          gl_FragColor = vec4(uColor, a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.points = new THREE.Points(k.track(g), k.track(mat));
    this.points.frustumCulled = false;
    this.points.userData.noShadowFit = true;
    // Sizes are in metres: scale by the drawing height and the lens.
    const px = new THREE.Vector2();
    this.points.onBeforeRender = (renderer, _scene, camera) => {
      renderer.getDrawingBufferSize(px);
      mat.uniforms.uScale.value = px.y / (2 * Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360));
    };
  }


  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, life: number) {
    const i = this.head;
    this.head = (this.head + 1) % this.cap;
    this.n = Math.min(this.cap, this.n + 1);
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
  }

  clear() {
    this.n = 0;
    this.head = 0;
    this.alpha.fill(0);
    this.age.fill(1e9);
  }

  update(dt: number) {
    for (let i = 0; i < this.n; i++) {
      const a = (this.age[i] += dt);
      const f = a / this.life[i];
      if (f >= 1) {
        this.alpha[i] = 0;
        continue;
      }
      const drag = Math.exp(-dt * 1.2);
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] += this.grow * dt;
      // Fade in quickly, out slowly.
      this.alpha[i] = Math.min(1, f * 8) * (1 - f) * (1 - f);
    }
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    for (const name of ["position", "aSize", "aAlpha"]) g.attributes[name].needsUpdate = true;
  }
}

// ---- Banners and standards -------------------------------------------------------------------------------------

export type BannerKind = "georgia" | "royal" | "frank" | "kipchak" | "tugh" | "black" | "arab";

const WAVE = { value: 0 };

function waveMaterial(k: Kit, map: THREE.Texture) {
  const m = new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWave = WAVE;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uWave;").replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      float along = max(0.0, position.x);
      transformed.z += sin(uWave * 5.0 - along * 3.2 + position.y * 1.3) * 0.16 * along;
      transformed.y -= along * along * 0.05;`,
    );
  };
  m.customProgramCacheKey = () => "banner";
  return k.track(m);
}

function bannerTexture(k: Kit, kind: BannerKind) {
  return k.canvasTexture(128, 96, (c) => {
    const W = 128;
    const H = 96;
    const fill = (col: string) => ((c.fillStyle = col), c.fillRect(0, 0, W, H));
    const cross = (col: string, w: number) => {
      c.fillStyle = col;
      c.fillRect(W * 0.38 - w / 2, 8, w, H - 16);
      c.fillRect(14, H * 0.42 - w / 2, W * 0.56, w);
    };
    if (kind === "georgia") {
      fill("#8f1b1f");
      cross("#d9b54a", 12);
    } else if (kind === "royal") {
      fill("#6d1424");
      c.fillStyle = "#d9b54a";
      c.fillRect(0, 0, W, 8);
      c.fillRect(0, H - 8, W, 8);
      cross("#e6c55a", 14);
    } else if (kind === "frank") {
      fill("#ece6d8");
      cross("#a3171b", 13);
    } else if (kind === "kipchak") {
      fill("#a5482a");
      c.fillStyle = "#e3c26a";
      c.beginPath();
      c.arc(W * 0.4, H * 0.45, 16, 0, Math.PI * 2);
      c.fill();
    } else if (kind === "black") {
      fill("#16161a");
      c.fillStyle = "#c9a54a";
      c.fillRect(0, H * 0.4, W, 10);
    } else if (kind === "arab") {
      fill("#e8e2d2");
      c.fillStyle = "#1f3e6e";
      c.fillRect(0, H * 0.35, W, 18);
    } else fill("#2b2b2b");
  });
}

export interface Banner {
  group: THREE.Group;
  /** Rider (true) or man on foot carries it. */
  mounted: boolean;
}

/** A banner on a pole, or a tugh: a pole with a gilded ball and a black horse-tail. */
export function banner(k: Kit, kind: BannerKind, mounted: boolean): Banner {
  const g = new THREE.Group();
  const wood = k.material({ color: "#5a4128", roughness: 0.8, clearcoat: 0 });
  const H = mounted ? 5.6 : 4.6;
  const pole = new THREE.Mesh(k.cylinder, wood);
  pole.scale.set(0.035, H, 0.035);
  pole.position.y = H / 2;
  g.add(pole);
  const gold = k.material({ color: "#c9a54a", metalness: 1, roughness: 0.3, clearcoat: 0 });
  const ball = new THREE.Mesh(k.sphere, gold);
  ball.scale.setScalar(0.09);
  ball.position.y = H + 0.06;
  g.add(ball);
  if (kind === "tugh") {
    const tail = new THREE.Mesh(k.track(new THREE.ConeGeometry(0.22, 1.4, 10, 4, true).translate(0, -0.7, 0)), k.material({ color: "#1b1714", roughness: 1, clearcoat: 0 }));
    tail.position.y = H - 0.05;
    tail.userData.tail = true;
    g.add(tail);
    const tail2 = tail.clone();
    tail2.scale.set(0.8, 0.8, 0.8);
    tail2.position.y = H - 1.0;
    tail2.material = k.material({ color: "#8a2a1a", roughness: 1, clearcoat: 0 });
    g.add(tail2);
  } else {
    const W = kind === "kipchak" ? 1.6 : 1.5;
    const cloth = new THREE.PlaneGeometry(W, 1.05, 12, 6).translate(W / 2, 0, 0);
    if (kind === "kipchak") {
      // A swallow-tailed pennant.
      const p = cloth.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) / W;
        p.setY(i, p.getY(i) * (1 - 0.55 * x));
      }
    }
    const mesh = new THREE.Mesh(k.track(cloth), waveMaterial(k, bannerTexture(k, kind)));
    mesh.position.set(0.03, H - 0.6, 0);
    g.add(mesh);
  }
  g.traverse((o) => {
    o.userData.noShadowFit = true;
    (o as THREE.Mesh).castShadow = true;
  });
  return { group: g, mounted };
}

export function waveBanners(t: number) {
  WAVE.value = t;
}

// ---- Camp ------------------------------------------------------------------------------------------------------

/** Felt yurts and tents of the coalition's camp; the commanders' great pavilion with its standards. */
export function camp(k: Kit, ground: Ground, spots: { x: number; z: number; kind: "yurt" | "tent" | "pavilion"; rot?: number }[]) {
  const g = new THREE.Group();
  const felt = k.material({ color: "#d9cfba", roughness: 0.95, clearcoat: 0 });
  const feltDark = k.material({ color: "#8f7d63", roughness: 0.95, clearcoat: 0 });
  const canvas = k.canvasTexture(256, 64, (c) => {
    for (let i = 0; i < 16; i++) {
      c.fillStyle = i % 2 ? "#e9e1cf" : "#9c2a24";
      c.fillRect(i * 16, 0, 16, 64);
    }
  });
  canvas.wrapS = THREE.RepeatWrapping;
  const stripes = k.material({ map: canvas, roughness: 0.9, clearcoat: 0, side: THREE.DoubleSide });
  const yurtWall = k.track(new THREE.CylinderGeometry(3, 3, 1.7, 18, 1, true).translate(0, 0.85, 0));
  const yurtRoof = k.track(new THREE.ConeGeometry(3.15, 1.6, 18, 1, true).translate(0, 2.5, 0));
  // Ridge tent: a three-sided prism lying on one face.
  const tentGeo = k.track(new THREE.CylinderGeometry(1.5, 1.5, 4.2, 3, 1, false).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(0, 0.75, 0));
  const pavWall = k.track(new THREE.CylinderGeometry(7, 7, 2.8, 28, 1, true).translate(0, 1.4, 0));
  const pavRoof = k.track(new THREE.ConeGeometry(7.6, 4.2, 28, 1, true).translate(0, 4.9, 0));
  const pavilions: THREE.Group[] = [];
  for (const s of spots) {
    const y = ground.y(s.x, s.z) - 0.1;
    const o = new THREE.Group();
    o.position.set(s.x, y, s.z);
    o.rotation.y = s.rot ?? 0;
    if (s.kind === "yurt") o.add(new THREE.Mesh(yurtWall, felt), new THREE.Mesh(yurtRoof, feltDark));
    else if (s.kind === "tent") o.add(new THREE.Mesh(tentGeo, felt));
    else {
      o.add(new THREE.Mesh(pavWall, stripes), new THREE.Mesh(pavRoof, stripes));
      pavilions.push(o);
    }
    g.add(o);
  }
  g.traverse((o) => {
    o.userData.noShadowFit = true;
    if ((o as THREE.Mesh).isMesh) {
      (o as THREE.Mesh).castShadow = true;
      (o as THREE.Mesh).receiveShadow = true;
    }
  });
  return { group: g, pavilions };
}

// ---- Manoeuvre arrows on the ground ---------------------------------------------------------------------------------

/** A broad arrow along a path, lying on the ground; `reveal` (0..1) draws it from tail to head. */
export function groundArrow(k: Kit, ground: Ground, path: [number, number][], width: number, color: string) {
  const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => v(x, 0, z)), false, "centripetal");
  const len = curve.getLength();
  const N = Math.max(8, Math.ceil(len / 12));
  const pos: number[] = [];
  const idx: number[] = [];
  const headLen = Math.min(len * 0.25, width * 2.2);
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    const nx = -t.z;
    const nz = t.x;
    const fromEnd = (1 - u) * len;
    // Shaft, then the arrowhead widening and closing to the point.
    const w = fromEnd < headLen ? width * 1.25 * (fromEnd / headLen) : width * (0.55 + 0.45 * Math.min(1, u * 4)) * 0.5;
    for (const s of [-1, 1]) {
      const x = p.x + nx * w * s;
      const z = p.z + nz * w * s;
      pos.push(x, ground.y(x, z) + 4, z);
    }
    if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const mat = k.track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const mesh = new THREE.Mesh(k.track(g), mat);
  mesh.userData.noShadowFit = true;
  mesh.renderOrder = 2;
  const total = idx.length;
  let base = 0;
  return {
    mesh,
    set(reveal: number, opacity: number) {
      base = opacity;
      mesh.visible = reveal > 0.001 && opacity > 0.001;
      g.setDrawRange(0, Math.floor((total / 6) * Math.min(1, reveal)) * 6);
      mat.opacity = opacity;
    },
    /** Only in the map-like shots: `f` fades it with them. */
    fade(f: number) {
      mat.opacity = base * f;
      if (f < 0.01) mesh.visible = false;
    },
  };
}
