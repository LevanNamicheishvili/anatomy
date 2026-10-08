import * as THREE from "three";
import { rng } from "@/components/journeys/JourneyScene";
import type { BoneSet, ClipInfo, CrowdLayer } from "./crowd";
import type { FigureType } from "./units";
import { COATS } from "./units";

/*
 * The battle as many small decisions: every figure steers to its place in its regiment's formation, keeps
 * clear of its neighbours, turns and accelerates like a horse or a man would, and — once an enemy is close —
 * fights him, until one of them falls. Regiments follow timed orders per stage (move, charge, shoot, rout,
 * pursue). Jumping to a stage places everyone where that stage begins; playing on simply continues.
 */

export type Gait = "walk" | "trot" | "gallop";
export type XZ = [number, number];

export interface RegimentDef {
  id: string;
  name: string;
  side: 0 | 1;
  type: string;
  n: number;
  /** Figures abreast; spacing across and front-to-back (m); random scatter (m). */
  files: number;
  gap: [number, number];
  loose?: number;
  /** Colour choices (sRGB) for the coat/kaftan (A) and the shield/saddle cloth (B). */
  colA: string[];
  colB: string[];
  coats?: number[];
}

export type Cmd =
  | { at: number; do: "hold"; face?: number }
  | { at: number; do: "move"; path: XZ[]; gait: Gait; face?: number }
  | { at: number; do: "charge"; target: string; gait?: Gait }
  | { at: number; do: "shoot"; target: string; advance?: boolean }
  | { at: number; do: "rout"; path: XZ[] }
  | { at: number; do: "pursue"; path: XZ[] }
  | { at: number; do: "panic" }
  | { at: number; do: "place"; pos: XZ; face: number }
  | { at: number; do: "pose"; clip: string | null }
  | { at: number; do: "kill"; fraction: number; spread?: number };

/** Where a regiment is when a stage starts (for jumping straight to that stage). */
export interface Setup {
  pos: XZ;
  face: number;
  rout?: XZ[];
  /** Fraction already fallen, lying round `deadAt` (or the regiment's position). */
  dead?: number;
  deadAt?: XZ;
  hidden?: boolean;
}

export interface StageScript {
  setup: Record<string, Setup>;
  cmds: Record<string, Cmd[]>;
  /** Melee: chance per blow that it kills, by side (0 Georgian, 1 coalition). */
  odds: [number, number];
  /** Seconds of battle per second on screen. */
  timeScale: number;
}

const ST = { form: 0, melee: 1, rout: 2, dead: 3, gone: 4, panic: 5 } as const;

const SPEED = {
  cav: { walk: 1.8, trot: 4.2, gallop: 11 },
  foot: { walk: 1.4, trot: 3.4, gallop: 4.2 },
};

interface Regiment {
  def: RegimentDef;
  type: FigureType;
  first: number;
  count: number;
  cx: number;
  cz: number;
  face: number;
  cmd: Cmd | null;
  pathI: number;
  alive: number;
  /** Centroid of the living (smoothed), for cameras and labels. */
  mx: number;
  mz: number;
  hidden: boolean;
  routed: boolean;
  shooting: boolean;
  pose: string | null;
  /** Extent of the living along / across the facing (for the footprint on the ground). */
  ext: [number, number];
}

export interface Ground {
  y(x: number, z: number): number;
  W: number;
  D: number;
}

export interface Shot {
  from: number;
  to: number;
}

export class BattleSim {
  readonly regs: Regiment[] = [];
  readonly byId = new Map<string, Regiment>();
  n = 0;
  // Figures, structure of arrays.
  x: Float32Array;
  z: Float32Array;
  head: Float32Array;
  speed: Float32Array;
  state: Uint8Array;
  reg: Uint16Array;
  slotX: Float32Array;
  slotZ: Float32Array;
  target: Int32Array;
  /** Seconds until the figure looks round again / may strike or shoot again. */
  think: Float32Array;
  cool: Float32Array;
  frame: Float32Array;
  clipOf: (ClipInfo | null)[];
  seed: Float32Array;
  routX: Float32Array;
  wp: Uint8Array;
  colors: Float32Array;
  mounted: Uint8Array;
  archer: Uint8Array;
  time = 0;
  stage = 0;
  script: StageScript | null = null;
  private cmdIndex = new Map<string, number>();
  private r = rng(1121);
  /** Arrows to fly (filled by the simulation, emptied by the effects). */
  shots: Shot[] = [];
  /** Galloping horses kick up dust here (x, z, strength). */
  dust: number[] = [];

  // Spatial hash.
  private cell = 6;
  private hsize = 1 << 15;
  private headH = new Int32Array(this.hsize);
  private next: Int32Array;

  constructor(
    readonly ground: Ground,
    defs: RegimentDef[],
    readonly types: Map<string, FigureType>,
    readonly cav: BoneSet,
    readonly foot: BoneSet,
  ) {
    let n = 0;
    for (const d of defs) n += d.n;
    this.n = n;
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.head = new Float32Array(n);
    this.speed = new Float32Array(n);
    this.state = new Uint8Array(n);
    this.reg = new Uint16Array(n);
    this.slotX = new Float32Array(n);
    this.slotZ = new Float32Array(n);
    this.target = new Int32Array(n).fill(-1);
    this.think = new Float32Array(n);
    this.cool = new Float32Array(n);
    this.frame = new Float32Array(n);
    this.clipOf = new Array(n).fill(null);
    this.seed = new Float32Array(n);
    this.routX = new Float32Array(n);
    this.wp = new Uint8Array(n);
    this.colors = new Float32Array(n * 12);
    this.mounted = new Uint8Array(n);
    this.archer = new Uint8Array(n);
    this.next = new Int32Array(n);
    let i = 0;
    const c = new THREE.Color();
    defs.forEach((d, ri) => {
      const type = types.get(d.type)!;
      const reg: Regiment = { def: d, type, first: i, count: d.n, cx: 0, cz: 0, face: 0, cmd: null, pathI: 0, alive: d.n, mx: 0, mz: 0, hidden: false, routed: false, shooting: false, pose: null, ext: [10, 10] };
      this.regs.push(reg);
      this.byId.set(d.id, reg);
      const ranks = Math.ceil(d.n / d.files);
      for (let k = 0; k < d.n; k++, i++) {
        // Slot 0 is the front centre (the standard-bearer); then outwards along the front, rank by rank.
        const rank = Math.floor(k / d.files);
        const inRank = k % d.files;
        const off = inRank === 0 ? 0 : Math.ceil(inRank / 2) * (inRank % 2 ? 1 : -1);
        const loose = d.loose ?? 0;
        this.slotX[i] = off * d.gap[0] + (this.r() - 0.5) * loose;
        this.slotZ[i] = -rank * d.gap[1] + (ranks - 1) * d.gap[1] * 0.5 + (this.r() - 0.5) * loose;
        this.reg[i] = ri;
        this.seed[i] = this.r();
        this.mounted[i] = type.mounted ? 1 : 0;
        this.archer[i] = type.role === "archer" || type.role === "bowman" ? 1 : 0;
        const o = i * 12;
        c.set(d.colA[Math.floor(this.r() * d.colA.length)]);
        // A little variety in dye from man to man.
        c.offsetHSL((this.r() - 0.5) * 0.02, (this.r() - 0.5) * 0.1, (this.r() - 0.5) * 0.06);
        this.colors.set([c.r, c.g, c.b], o);
        c.set(d.colB[Math.floor(this.r() * d.colB.length)]);
        this.colors.set([c.r, c.g, c.b], o + 3);
        const coat = COATS[(d.coats ?? [0, 1, 2, 3, 5])[Math.floor(this.r() * (d.coats ?? [0, 1, 2, 3, 5]).length)]];
        c.set(coat[0]).offsetHSL(0, 0, (this.r() - 0.5) * 0.05);
        this.colors.set([c.r, c.g, c.b], o + 6);
        c.set(coat[1]);
        this.colors.set([c.r, c.g, c.b], o + 9);
      }
    });
  }

  // ---- Stage control ----

  /** Put everyone where `stage` begins (a jump), then run its orders from the start. */
  reset(script: StageScript, stage: number) {
    this.r = rng(1121 + stage * 17);
    this.shots = [];
    for (const reg of this.regs) {
      const s = script.setup[reg.def.id];
      if (!s) continue;
      reg.cx = s.pos[0];
      reg.cz = s.pos[1];
      reg.face = s.face;
      reg.cmd = null;
      reg.hidden = !!s.hidden;
      reg.routed = !!s.rout;
      reg.shooting = false;
      reg.pose = null;
      reg.pathI = 0;
      const sf = Math.sin(s.face);
      const cf = Math.cos(s.face);
      for (let i = reg.first; i < reg.first + reg.count; i++) {
        const ox = this.slotX[i] * (s.rout ? 2.2 : 1);
        const oz = this.slotZ[i] * (s.rout ? 2.2 : 1);
        // Facing +z is heading 0: slot x is to the left (+x when facing +z) — keep it a right-handed turn.
        this.x[i] = reg.cx + ox * cf + oz * sf;
        this.z[i] = reg.cz - ox * sf + oz * cf;
        this.head[i] = s.face + (this.r() - 0.5) * 0.15;
        this.speed[i] = 0;
        this.state[i] = s.rout ? ST.rout : ST.form;
        this.target[i] = -1;
        this.think[i] = this.r() * 0.4;
        this.cool[i] = this.r() * 2;
        this.frame[i] = this.r() * 60;
        this.clipOf[i] = null;
        this.wp[i] = 0;
        this.routX[i] = (this.r() - 0.5) * 2;
      }
      if (s.rout) this.setRout(reg, s.rout, false);
      if (s.dead) {
        const [dx, dz] = s.deadAt ?? s.pos;
        for (let i = reg.first; i < reg.first + reg.count; i++) {
          if (this.r() < s.dead) {
            this.state[i] = ST.dead;
            this.x[i] = dx + (this.r() - 0.5) * 140;
            this.z[i] = dz + (this.r() - 0.5) * 110;
            this.head[i] = this.r() * Math.PI * 2;
            this.frame[i] = 1000;
          }
        }
      }
      this.countAlive(reg);
      reg.mx = reg.cx;
      reg.mz = reg.cz;
    }
    this.begin(script, stage);
  }

  /** Start a stage's orders (continuing from wherever everyone is). */
  begin(script: StageScript, stage: number) {
    this.script = script;
    this.stage = stage;
    this.cmdIndex.clear();
    for (const reg of this.regs) this.cmdIndex.set(reg.def.id, 0);
  }

  private countAlive(reg: Regiment) {
    let a = 0;
    for (let i = reg.first; i < reg.first + reg.count; i++) if (this.state[i] !== ST.dead && this.state[i] !== ST.gone) a++;
    reg.alive = a;
  }

  private setRout(reg: Regiment, path: XZ[], fresh = true) {
    reg.routed = true;
    reg.cmd = { at: 0, do: "rout", path };
    for (let i = reg.first; i < reg.first + reg.count; i++) {
      if (this.state[i] === ST.dead || this.state[i] === ST.gone) continue;
      this.state[i] = ST.rout;
      this.target[i] = -1;
      // Join the road of flight at the first point west of where he stands.
      let w = path.findIndex((p) => p[0] < this.x[i] - 60);
      if (w < 0) w = path.length - 1;
      this.wp[i] = w;
      // Some break a moment later than others.
      this.cool[i] = fresh ? this.r() * 2.5 : 0;
    }
  }

  // ---- Simulation ----

  step(dtScreen: number, u: number) {
    const script = this.script;
    if (!script || dtScreen <= 0) return;
    // Orders whose time has come.
    for (const reg of this.regs) {
      const list = script.cmds[reg.def.id];
      if (!list) continue;
      let k = this.cmdIndex.get(reg.def.id) ?? 0;
      while (k < list.length && list[k].at <= u) this.apply(reg, list[k++]);
      this.cmdIndex.set(reg.def.id, k);
    }
    let dt = dtScreen * script.timeScale;
    // Small steps keep the steering stable.
    while (dt > 1e-4) {
      const h = Math.min(dt, 1 / 30);
      this.tick(h, script);
      dt -= h;
    }
  }

  private apply(reg: Regiment, c: Cmd) {
    switch (c.do) {
      case "place": {
        const sf = Math.sin(c.face);
        const cf = Math.cos(c.face);
        reg.cx = c.pos[0];
        reg.cz = c.pos[1];
        reg.face = c.face;
        for (let i = reg.first; i < reg.first + reg.count; i++) {
          if (this.state[i] === ST.dead) continue;
          this.x[i] = reg.cx + this.slotX[i] * cf + this.slotZ[i] * sf;
          this.z[i] = reg.cz - this.slotX[i] * sf + this.slotZ[i] * cf;
          this.head[i] = c.face;
          this.speed[i] = 0;
          this.state[i] = ST.form;
        }
        reg.mx = reg.cx;
        reg.mz = reg.cz;
        return;
      }
      case "pose":
        reg.pose = c.clip;
        return;
      case "kill": {
        for (let i = reg.first; i < reg.first + reg.count; i++) if (this.state[i] !== ST.dead && this.state[i] !== ST.gone && this.r() < c.fraction) this.kill(i);
        return;
      }
      case "rout":
        this.setRout(reg, c.path);
        return;
      case "panic":
        reg.cmd = c;
        for (let i = reg.first; i < reg.first + reg.count; i++)
          if (this.state[i] === ST.form) {
            this.state[i] = ST.panic;
            this.cool[i] = this.r() * 1.5;
          }
        return;
      default:
        reg.hidden = false;
        reg.cmd = c;
        for (let i = reg.first; i < reg.first + reg.count; i++) if (this.state[i] === ST.panic) this.state[i] = ST.form;
        reg.pathI = 0;
        reg.shooting = c.do === "shoot";
        if (c.do === "hold" && c.face !== undefined) reg.face = c.face;
        if (c.do === "pursue") for (let i = reg.first; i < reg.first + reg.count; i++) if (this.state[i] === ST.form) this.target[i] = -1;
    }
  }

  kill(i: number) {
    if (this.state[i] === ST.dead || this.state[i] === ST.gone) return;
    this.state[i] = ST.dead;
    this.frame[i] = 0;
    this.speed[i] = 0;
    this.regs[this.reg[i]].alive--;
  }

  isAlive(i: number) {
    return this.state[i] !== ST.dead && this.state[i] !== ST.gone;
  }

  private hashKey(x: number, z: number) {
    return ((Math.floor(x / this.cell) * 73856093) ^ (Math.floor(z / this.cell) * 19349663)) & (this.hsize - 1);
  }

  private buildHash() {
    this.headH.fill(-1);
    for (let i = 0; i < this.n; i++) {
      if (!this.isAlive(i)) continue;
      const k = this.hashKey(this.x[i], this.z[i]);
      this.next[i] = this.headH[k];
      this.headH[k] = i;
    }
  }

  /** Nearest living enemy of figure i within r metres (or -1). */
  private nearestEnemy(i: number, r: number, routedOnly = false) {
    const side = this.regs[this.reg[i]].def.side;
    const x = this.x[i];
    const z = this.z[i];
    let best = -1;
    let bd = r * r;
    const c = this.cell;
    const n = Math.ceil(r / c);
    const visited = new Set<number>();
    for (let gx = -n; gx <= n; gx++)
      for (let gz = -n; gz <= n; gz++) {
        const k = this.hashKey(x + gx * c, z + gz * c);
        if (visited.has(k)) continue;
        visited.add(k);
        for (let j = this.headH[k]; j >= 0; j = this.next[j]) {
          const rj = this.regs[this.reg[j]];
          if (rj.def.side === side || rj.hidden) continue;
          if (routedOnly && this.state[j] !== ST.rout) continue;
          const d = (this.x[j] - x) ** 2 + (this.z[j] - z) ** 2;
          if (d < bd) {
            bd = d;
            best = j;
          }
        }
      }
    return best;
  }

  private tick(dt: number, script: StageScript) {
    this.time += dt;
    this.buildHash();
    // Regiment anchors.
    for (const reg of this.regs) this.moveAnchor(reg, dt);
    const n = this.n;
    const W = this.ground.W;
    const D = this.ground.D;
    for (let i = 0; i < n; i++) {
      const st = this.state[i];
      if (st === ST.gone) continue;
      if (st === ST.dead) continue;
      const reg = this.regs[this.reg[i]];
      const cav = this.mounted[i] === 1;
      const sp = cav ? SPEED.cav : SPEED.foot;
      let tx = this.x[i];
      let tz = this.z[i];
      let want = 0;
      let faceTo = NaN;
      this.think[i] -= dt;
      this.cool[i] -= dt;
      const cmd = reg.cmd;
      const looks = this.think[i] <= 0;
      if (looks) this.think[i] = 0.3 + this.r() * 0.25;

      if ((st === ST.form || st === ST.panic) && looks && !reg.hidden) {
        if (cmd?.do === "pursue") {
          // Hunt the nearest fleeing enemy.
          const t = this.target[i];
          if (t < 0 || !this.isAlive(t) || this.state[t] !== ST.rout) this.target[i] = this.nearestEnemy(i, 45, true);
        } else {
          // Engage enemies that come close.
          const e = this.nearestEnemy(i, cav ? 9 : 5);
          if (e >= 0) {
            this.state[i] = ST.melee;
            this.target[i] = e;
            this.cool[i] = 0.4 + this.r() * 1.2;
          }
        }
      }

      const state = this.state[i];
      if (state === ST.form) {
        if (cmd?.do === "pursue") {
          // Chase the quarry; follow the road of flight otherwise.
          const t = this.target[i];
          if (t >= 0 && this.isAlive(t) && this.state[t] === ST.rout) {
            tx = this.x[t];
            tz = this.z[t];
            want = sp.gallop * 1.05;
            const d2 = (tx - this.x[i]) ** 2 + (tz - this.z[i]) ** 2;
            if (d2 < 9 && this.cool[i] <= 0) {
              this.cool[i] = 0.8 + this.r() * 0.8;
              if (this.r() < script.odds[reg.def.side] * 2.2) this.kill(t);
            } else if (this.archer[i] && d2 < 3600 && d2 > 100 && this.cool[i] <= 0) {
              this.cool[i] = 2 + this.r() * 2;
              this.shots.push({ from: i, to: t });
            }
          } else {
            const f = this.slotPos(reg, i);
            tx = f[0];
            tz = f[1];
            want = this.dist(i, tx, tz) > 3 ? sp.gallop * 0.8 : 0;
          }
        } else {
          const f = this.slotPos(reg, i);
          tx = f[0];
          tz = f[1];
          const d = this.dist(i, tx, tz);
          const g = this.regGait(reg);
          // Catch up a little faster than the regiment moves; slow down on arrival.
          want = Math.min(d < 0.6 ? 0 : sp[g] * 1.25 + 0.6, d * 1.4);
          if (d < 1.5) faceTo = reg.face;
          // Archers loose at the regiment's target.
          if (reg.shooting && this.archer[i] && cmd?.do === "shoot" && this.cool[i] <= 0) {
            this.cool[i] = 2.4 + this.r() * 2.6;
            const tr = this.byId.get(cmd.target);
            if (tr && tr.alive > 0) {
              const j = this.randomAlive(tr);
              if (j >= 0) {
                const dd = this.dist(i, this.x[j], this.z[j]);
                if (dd < 190 && dd > 15) this.shots.push({ from: i, to: j });
              }
            }
          }
        }
      } else if (state === ST.melee) {
        let t = this.target[i];
        if (t < 0 || !this.isAlive(t) || this.dist(i, this.x[t], this.z[t]) > 16) {
          t = looks ? this.nearestEnemy(i, 12) : -1;
          this.target[i] = t;
          if (t < 0 && looks) this.state[i] = reg.routed ? ST.rout : ST.form;
        }
        if (t >= 0) {
          const dx = this.x[i] - this.x[t];
          const dz = this.z[i] - this.z[t];
          const d = Math.hypot(dx, dz) || 1;
          const contact = (cav ? 1.4 : 0.7) + (this.mounted[t] ? 1.3 : 0.6);
          tx = this.x[t] + (dx / d) * contact;
          tz = this.z[t] + (dz / d) * contact;
          want = Math.min(sp.trot, Math.max(0, d - contact) * 1.5);
          faceTo = Math.atan2(-dx, -dz);
          if (this.cool[i] <= 0) {
            this.cool[i] = 1.1 + this.r() * 1.3;
            if (d < contact + 1.2) {
              let p = script.odds[reg.def.side];
              if (this.state[t] === ST.rout) p *= 3;
              if (cav && !this.mounted[t]) p *= 1.4;
              if (this.r() < p) this.kill(t);
            }
          }
        }
      } else if (state === ST.rout) {
        if (this.cool[i] > 0 && this.speed[i] < 0.5) {
          want = 0;
        } else if (cmd?.do === "rout") {
          const path = cmd.path;
          const w = Math.min(this.wp[i], path.length - 1);
          // Each man takes his own line along the road of flight.
          const p = path[w];
          const prev = w > 0 ? path[w - 1] : [reg.cx, reg.cz];
          const ax = p[0] - prev[0];
          const az = p[1] - prev[1];
          const al = Math.hypot(ax, az) || 1;
          const spread = 70;
          tx = p[0] + (-az / al) * this.routX[i] * spread;
          tz = p[1] + (ax / al) * this.routX[i] * spread;
          if (this.dist(i, tx, tz) < 25 && w < path.length - 1) this.wp[i] = w + 1;
          want = sp.gallop * (0.82 + this.seed[i] * 0.25);
          if (w === path.length - 1 && this.dist(i, tx, tz) < 40) this.state[i] = ST.gone;
        }
      } else if (state === ST.panic) {
        // Milling about: short dashes this way and that.
        if (this.cool[i] <= 0) {
          this.cool[i] = 0.8 + this.r() * 2;
          const a = this.r() * Math.PI * 2;
          this.target[i] = -1;
          this.routX[i] = a;
          this.wp[i] = this.r() < 0.5 ? 1 : 0;
        }
        const a = this.routX[i];
        tx = this.x[i] + Math.sin(a) * 10;
        tz = this.z[i] + Math.cos(a) * 10;
        want = this.wp[i] ? sp.trot : sp.walk * 0.6;
      }

      // Turn and accelerate like an animal: horses turn before they can speed up.
      const dx = tx - this.x[i];
      const dz = tz - this.z[i];
      const dl = Math.hypot(dx, dz);
      let h = this.head[i];
      let wantHead = h;
      if (want > 0.15 && dl > 0.3) wantHead = Math.atan2(dx, dz);
      else if (!Number.isNaN(faceTo)) wantHead = faceTo;
      let diff = wantHead - h;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      const turn = (cav ? 1.9 : 5) * dt;
      h += Math.max(-turn, Math.min(turn, diff));
      this.head[i] = h;
      const target = want * Math.max(0, Math.cos(Math.min(Math.PI / 2, Math.abs(diff))));
      const s = this.speed[i];
      const acc = (target > s ? (cav ? 3.2 : 3.5) : cav ? 6 : 7) * dt;
      const ns = s + Math.max(-acc, Math.min(acc, target - s));
      this.speed[i] = ns;
      this.x[i] = Math.min(W - 5, Math.max(5, this.x[i] + Math.sin(h) * ns * dt));
      this.z[i] = Math.min(D - 5, Math.max(5, this.z[i] + Math.cos(h) * ns * dt));
      if (cav && ns > 6 && this.seed[i] < 0.5 && Math.random() < dt * 4) this.dust.push(this.x[i] - Math.sin(h) * 1.5, this.z[i] - Math.cos(h) * 1.5, ns);
    }
    this.separate();
    for (const reg of this.regs) this.measure(reg);
  }

  /** Keep figures from walking through each other. */
  private separate() {
    const c = this.cell;
    for (let i = 0; i < this.n; i++) {
      if (!this.isAlive(i)) continue;
      const ri = this.mounted[i] ? 1.15 : 0.42;
      const x = this.x[i];
      const z = this.z[i];
      for (let gx = -1; gx <= 1; gx++)
        for (let gz = -1; gz <= 1; gz++) {
          const k = this.hashKey(x + gx * c, z + gz * c);
          for (let j = this.headH[k]; j >= 0; j = this.next[j]) {
            if (j <= i) continue;
            const rr = ri + (this.mounted[j] ? 1.15 : 0.42);
            const dx = this.x[j] - this.x[i];
            const dz = this.z[j] - this.z[i];
            const d2 = dx * dx + dz * dz;
            if (d2 >= rr * rr || d2 < 1e-6) continue;
            const d = Math.sqrt(d2);
            const push = ((rr - d) / d) * 0.5;
            this.x[i] -= dx * push;
            this.z[i] -= dz * push;
            this.x[j] += dx * push;
            this.z[j] += dz * push;
          }
        }
    }
  }

  private dist(i: number, x: number, z: number) {
    return Math.hypot(x - this.x[i], z - this.z[i]);
  }

  private randomAlive(reg: Regiment) {
    for (let t = 0; t < 8; t++) {
      const j = reg.first + Math.floor(this.r() * reg.count);
      if (this.isAlive(j)) return j;
    }
    return -1;
  }

  private slotPos(reg: Regiment, i: number): XZ {
    const sf = Math.sin(reg.face);
    const cf = Math.cos(reg.face);
    const ox = this.slotX[i];
    const oz = this.slotZ[i];
    return [reg.cx + ox * cf + oz * sf, reg.cz - ox * sf + oz * cf];
  }

  private regGait(reg: Regiment): Gait {
    const c = reg.cmd;
    if (!c) return "walk";
    if (c.do === "move") return c.gait;
    if (c.do === "charge") return c.gait ?? "gallop";
    if (c.do === "pursue") return "gallop";
    return "walk";
  }

  private moveAnchor(reg: Regiment, dt: number) {
    const c = reg.cmd;
    if (!c) return;
    const mounted = reg.type.mounted;
    const sp = mounted ? SPEED.cav : SPEED.foot;
    // The anchor never runs far ahead of the men.
    const lag = Math.hypot(reg.mx - reg.cx, reg.mz - reg.cz);
    const hold = Math.max(0.15, Math.min(1, 1.4 - lag / 40));
    let goal: XZ | null = null;
    let speed = 0;
    if (c.do === "move" || c.do === "pursue") {
      const path = c.path;
      if (reg.pathI < path.length) {
        goal = path[reg.pathI];
        speed = sp[c.do === "move" ? c.gait : "gallop"] * (c.do === "pursue" ? 0.7 : 1);
        if (Math.hypot(goal[0] - reg.cx, goal[1] - reg.cz) < speed * dt + 0.5) {
          reg.cx = goal[0];
          reg.cz = goal[1];
          reg.pathI++;
          goal = null;
          if (reg.pathI >= path.length && c.do === "move" && c.face !== undefined) reg.face = c.face;
        }
      }
    } else if (c.do === "charge" || (c.do === "shoot" && c.advance)) {
      const t = this.byId.get(c.target);
      if (t && t.alive > 0) {
        const d = Math.hypot(t.mx - reg.cx, t.mz - reg.cz);
        const stop = c.do === "shoot" ? 110 : 8;
        if (d > stop) {
          goal = [t.mx, t.mz];
          speed = c.do === "shoot" ? sp.trot : sp[c.gait ?? "gallop"];
        }
        // Face the enemy.
        const f = Math.atan2(t.mx - reg.cx, t.mz - reg.cz);
        reg.face += Math.atan2(Math.sin(f - reg.face), Math.cos(f - reg.face)) * Math.min(1, dt * 1.5);
      }
    }
    if (goal) {
      const dx = goal[0] - reg.cx;
      const dz = goal[1] - reg.cz;
      const d = Math.hypot(dx, dz) || 1;
      const step = Math.min(d, speed * hold * dt);
      reg.cx += (dx / d) * step;
      reg.cz += (dz / d) * step;
      if (c.do !== "charge" && c.do !== "shoot") {
        const f = Math.atan2(dx, dz);
        reg.face += Math.atan2(Math.sin(f - reg.face), Math.cos(f - reg.face)) * Math.min(1, dt * 2);
      }
    }
  }

  /** Centroid and extent of the living, for cameras, labels and the footprint on the ground. */
  private measure(reg: Regiment) {
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (let i = reg.first; i < reg.first + reg.count; i++) {
      const st = this.state[i];
      if (st === ST.dead || st === ST.gone) continue;
      sx += this.x[i];
      sz += this.z[i];
      n++;
    }
    reg.alive = n;
    if (!n) return;
    const mx = sx / n;
    const mz = sz / n;
    // Smooth, so a camera following it doesn't jump when men fall.
    const k = Math.hypot(mx - reg.mx, mz - reg.mz) > 400 ? 1 : 0.15;
    reg.mx += (mx - reg.mx) * k;
    reg.mz += (mz - reg.mz) * k;
    const sf = Math.sin(reg.face);
    const cf = Math.cos(reg.face);
    let a = 0;
    let b = 0;
    let m = 0;
    for (let i = reg.first; i < reg.first + reg.count; i += 3) {
      const st = this.state[i];
      if (st === ST.dead || st === ST.gone) continue;
      const dx = this.x[i] - reg.mx;
      const dz = this.z[i] - reg.mz;
      a += (dx * cf - dz * sf) ** 2;
      b += (dx * sf + dz * cf) ** 2;
      m++;
    }
    if (m) reg.ext = [Math.sqrt(a / m) * 1.9 + 6, Math.sqrt(b / m) * 1.9 + 6];
  }

  // ---- Drawing ----

  /** The clip each figure shows now, and how fast it plays. */
  private animFor(i: number): [ClipInfo, number] {
    const reg = this.regs[this.reg[i]];
    const st = this.state[i];
    const s = this.speed[i];
    if (this.mounted[i]) {
      const b = this.cav;
      const lancer = reg.type.role === "lancer";
      if (st === ST.dead) return [b.clip("death"), 0];
      if (st === ST.melee) return s < 1.2 ? [b.clip("melee"), 1] : [b.clip("melee_walk"), s / 1.8];
      if (s < 0.25) return [b.clip(reg.shooting && !lancer ? "idle_shoot" : lancer ? "idle_l" : "idle_b"), 1];
      if (s < 3.2) return [b.clip(reg.pose === "humble" ? "humble" : lancer ? "walk_l" : "walk_b"), Math.max(0.5, s / 1.8)];
      const rate = Math.min(1.25, Math.max(0.55, s / 11));
      const cmd = reg.cmd?.do;
      if (lancer) return [b.clip(cmd === "pursue" || st === ST.rout || cmd === "move" ? "gallop_s" : "gallop_l"), rate];
      return [b.clip((reg.shooting || cmd === "pursue") && st !== ST.rout ? "gallop_shoot" : "gallop_b"), rate];
    }
    const b = this.foot;
    const bow = reg.type.role === "bowman";
    if (st === ST.dead) return [b.clip("death"), 0];
    if (st === ST.melee) return [b.clip(bow ? "melee_sw" : "melee_sp"), 1];
    if (s < 0.2) return [b.clip(bow ? (reg.shooting ? "shoot_bw" : "idle_bw") : "idle_sp"), 1];
    if (s < 2.2) return [b.clip(bow ? "walk_bw" : "walk_sp"), Math.max(0.5, s / 1.4)];
    return [b.clip(bow ? "run_bw" : "run_sp"), Math.max(0.6, s / 3.6)];
  }

  /** Advance the animation clocks (screen time). */
  animate(dtScreen: number) {
    const ts = this.script?.timeScale ?? 1;
    for (let i = 0; i < this.n; i++) {
      const st = this.state[i];
      if (st === ST.gone) continue;
      const [clip, rate] = this.animFor(i);
      if (this.clipOf[i] !== clip) {
        if (clip.loop === false) this.frame[i] = st === ST.dead && this.frame[i] >= 999 ? 1000 : 0;
        this.clipOf[i] = clip;
      }
      if (st === ST.dead) {
        if (this.frame[i] < 999) this.frame[i] = Math.min(clip.frames - 1, this.frame[i] + dtScreen * ts * clip.fps);
      } else this.frame[i] += dtScreen * Math.min(ts, 1.6) * clip.fps * rate;
      if (this.frame[i] > 1e6) this.frame[i] = 0;
    }
  }

  private m = new Float32Array(16);
  private frustum = new THREE.Frustum();
  private pv = new THREE.Matrix4();

  /** Writes every visible figure into the instanced layers (by type and level of detail). */
  draw(camera: THREE.PerspectiveCamera, layers: Map<string, CrowdLayer[]>, lod: [number, number]) {
    for (const ls of layers.values()) for (const l of ls) l.begin();
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pv);
    const planes = this.frustum.planes;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const g = this.ground;
    const m = this.m;
    const l0 = lod[0] * lod[0];
    const l1 = lod[1] * lod[1];
    for (let i = 0; i < this.n; i++) {
      const st = this.state[i];
      if (st === ST.gone) continue;
      const reg = this.regs[this.reg[i]];
      const x = this.x[i];
      const z = this.z[i];
      const y = g.y(x, z);
      let visible = true;
      for (let p = 0; p < 6 && visible; p++) {
        const pl = planes[p];
        if (pl.normal.x * x + pl.normal.y * (y + 1.2) + pl.normal.z * z + pl.constant < -3) visible = false;
      }
      if (!visible) continue;
      const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2;
      const level = d2 < l0 ? 0 : d2 < l1 ? 1 : 2;
      const h = this.head[i];
      const s = Math.sin(h);
      const c = Math.cos(h);
      // Horses follow the slope; men stand upright.
      let sp = 0;
      let cp = 1;
      if (this.mounted[i] && st !== ST.dead) {
        const pitch = Math.atan2(g.y(x + s * 1.1, z + c * 1.1) - g.y(x - s * 1.1, z - c * 1.1), 2.2);
        sp = Math.sin(-pitch);
        cp = Math.cos(-pitch);
      }
      // Ry(h) · Rx(-pitch), column-major.
      m[0] = c;
      m[1] = 0;
      m[2] = -s;
      m[3] = 0;
      m[4] = s * sp;
      m[5] = cp;
      m[6] = c * sp;
      m[7] = 0;
      m[8] = s * cp;
      m[9] = -sp;
      m[10] = c * cp;
      m[11] = 0;
      m[12] = x;
      m[13] = y;
      m[14] = z;
      m[15] = 1;
      const [clip] = this.clipOf[i] ? [this.clipOf[i]!] : this.animFor(i);
      layers.get(reg.type.id)?.[level].push(m, clip, this.frame[i], this.colors, i * 12);
    }
    for (const ls of layers.values()) for (const l of ls) l.end();
  }
}
