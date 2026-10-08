// Bake the Quaternius horse (CC0) for the battle: welded smooth mesh in metres facing +z, two simplified
// LODs, and the animation clips sampled into per-frame bone matrices (half floats).
// usage: node bake-horse.mjs <in.glb> <outdir>
import { NodeIO } from "@gltf-transform/core";
import { MeshoptSimplifier } from "meshoptimizer";
import fs from "node:fs";
import * as THREE from "three";

const [inp, outdir] = process.argv.slice(2);
const doc = await new NodeIO().read(inp);
const root = doc.getRoot();
const nodes = root.listNodes();
const parent = new Map();
for (const n of nodes) for (const c of n.listChildren()) parent.set(c, n);
const rest = new Map(nodes.map((n) => [n, { t: n.getTranslation(), r: n.getRotation(), s: n.getScale() }]));

function worlds(over) {
  const W = new Map();
  const local = (n) => {
    const o = over?.get(n) ?? {};
    const r = rest.get(n);
    const t = o.t ?? r.t, q = o.r ?? r.r, s = o.s ?? r.s;
    return new THREE.Matrix4().compose(new THREE.Vector3(...t), new THREE.Quaternion(...q), new THREE.Vector3(...s));
  };
  const get = (n) => {
    if (W.has(n)) return W.get(n);
    const p = parent.get(n);
    const m = p ? get(p).clone().multiply(local(n)) : local(n);
    W.set(n, m);
    return m;
  };
  for (const n of nodes) get(n);
  return W;
}

const skin = root.listSkins()[0];
const joints = skin.listJoints();
const ibmAcc = skin.getInverseBindMatrices();
const IBM = joints.map((_, j) => new THREE.Matrix4().fromArray(ibmAcc.getElement(j, new Array(16))));
const meshNode = nodes.find((n) => n.getMesh());
const W0 = worlds();
const K0 = joints.map((jn, j) => W0.get(jn).clone().multiply(IBM[j]));
console.log("K0[1]", K0[1].elements.map((x) => x.toFixed(3)).join(" "));
console.log("K0[20]", K0[20].elements.map((x) => x.toFixed(3)).join(" "));
console.log("meshWorld", W0.get(meshNode).elements.map((x) => x.toFixed(3)).join(" "));
// Rest pose is K0 (same for every joint if the bind pose is the rest pose).
const G = K0[1].clone();
const Ginv = G.clone().invert();

// ---- Collect primitives ----
const prims = meshNode.getMesh().listPrimitives().map((p) => {
  const name = p.getMaterial().getName();
  const col = p.getMaterial().getBaseColorFactor();
  const pos = p.getAttribute("POSITION"), jo = p.getAttribute("JOINTS_0"), we = p.getAttribute("WEIGHTS_0");
  const n = pos.getCount();
  const P = [], J = [], Wt = [];
  const a = [], b = [], c = [];
  for (let i = 0; i < n; i++) {
    pos.getElement(i, a);
    P.push(new THREE.Vector3(...a).applyMatrix4(G));
    jo.getElement(i, b);
    we.getElement(i, c);
    J.push([...b]);
    Wt.push([...c]);
  }
  const idx = p.getIndices().getArray();
  return { name, col, P, J, Wt, idx: Array.from(idx) };
});

// Canonical frame: y up, facing +z, metres. Find the rest-pose box first.
const box = new THREE.Box3();
for (const p of prims) for (const v of p.P) box.expandByPoint(v);
console.log("rest box", box.min.toArray().map((x) => x.toFixed(3)), box.max.toArray().map((x) => x.toFixed(3)));
// Head direction: centroid of Eye vertices.
const eye = new THREE.Vector3();
let ne = 0;
for (const p of prims) if (p.name.startsWith("Eye")) for (const v of p.P) (eye.add(v), ne++);
eye.divideScalar(ne);
const ctr = box.getCenter(new THREE.Vector3());
console.log("eye", eye.toArray().map((x) => x.toFixed(3)), "centre", ctr.toArray().map((x) => x.toFixed(3)));
const fwd = eye.clone().sub(ctr);
// Up is the axis along which the box is tallest among the two non-forward axes; detect by extents.
const size = box.getSize(new THREE.Vector3());
console.log("size", size.toArray().map((x) => x.toFixed(3)));
const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const fAxis = axes.reduce((a, b) => (Math.abs(fwd.dot(b)) > Math.abs(fwd.dot(a)) ? b : a)).clone().multiplyScalar(Math.sign(fwd.dot(axes.reduce((a, b) => (Math.abs(fwd.dot(b)) > Math.abs(fwd.dot(a)) ? b : a)))));
// Up: hooves are the lowest part. Use Hooves centroid relative to centre.
const hoof = new THREE.Vector3();
let nh = 0;
for (const p of prims) if (p.name === "Hooves") for (const v of p.P) (hoof.add(v), nh++);
hoof.divideScalar(nh);
const down = hoof.clone().sub(ctr);
const uAxis = axes.reduce((a, b) => (Math.abs(down.dot(b)) > Math.abs(down.dot(a)) ? b : a)).clone();
uAxis.multiplyScalar(-Math.sign(down.dot(uAxis)));
console.log("forward", fAxis.toArray(), "up", uAxis.toArray());
const xAxis = new THREE.Vector3().crossVectors(uAxis, fAxis);
const R = new THREE.Matrix4().makeBasis(xAxis, uAxis, fAxis).transpose(); // world -> canonical rotation
// Scale: back height (top of the middle third along forward) = 1.5 m.
const tmp = new THREE.Vector3();
let minF = Infinity, maxF = -Infinity, minU = Infinity;
for (const p of prims) for (const v of p.P) {
  tmp.copy(v).applyMatrix4(R);
  minF = Math.min(minF, tmp.z); maxF = Math.max(maxF, tmp.z); minU = Math.min(minU, tmp.y);
}
let backTop = -Infinity;
const L = maxF - minF;
for (const p of prims) if (p.name.startsWith("Main")) for (const v of p.P) {
  tmp.copy(v).applyMatrix4(R);
  const f = (tmp.z - minF) / L;
  if (f > 0.3 && f < 0.55 && Math.abs(tmp.x) < 0.2 * L) backTop = Math.max(backTop, tmp.y);
}
const scale = 1.5 / (backTop - minU);
const C = new THREE.Matrix4().makeScale(scale, scale, scale).multiply(new THREE.Matrix4().makeTranslation(0, -minU, -(minF + maxF) / 2)).multiply(R);
// Centre in x too.
const Cinv = C.clone().invert();
console.log("scale", scale.toFixed(3), "length m", (L * scale).toFixed(2));

// ---- Joints actually used, compacted ----
const used = new Set();
for (const p of prims) p.J.forEach((j, i) => j.forEach((jj, k) => p.Wt[i][k] > 0.001 && used.add(jj)));
const usedList = [...used].sort((a, b) => a - b);
const remap = new Map(usedList.map((j, i) => [j, i]));
console.log("joints used", usedList.length, usedList.map((j) => joints[j].getName()).join(" "));

// ---- LOD0: per material, welded by position, smooth normals by position over all parts ----
const key = (v) => `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`;
const normalByPos = new Map();
for (const p of prims) {
  const Pc = p.P.map((v) => v.clone().applyMatrix4(C));
  p.Pc = Pc;
  for (let f = 0; f < p.idx.length; f += 3) {
    const [a, b, c] = [Pc[p.idx[f]], Pc[p.idx[f + 1]], Pc[p.idx[f + 2]]];
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)); // area-weighted
    for (const v of [a, b, c]) {
      const k = key(v);
      if (!normalByPos.has(k)) normalByPos.set(k, new THREE.Vector3());
      normalByPos.get(k).add(n);
    }
  }
}
const MAIN = prims.find((p) => p.name === "Main").col;
const HAIR = prims.find((p) => p.name === "Hair").col;
function partOf(name) {
  if (name.startsWith("Main")) return 1;
  if (name === "Hair") return 2;
  return 0;
}
function build(weld) {
  const pos = [], nor = [], col = [], part = [], ji = [], jw = [], idx = [];
  const index = new Map();
  for (const p of prims) {
    const pt = partOf(p.name);
    const base = pt === 1 ? MAIN : pt === 2 ? HAIR : null;
    const rel = base ? [p.col[0] / base[0], p.col[1] / base[1], p.col[2] / base[2]] : p.col.slice(0, 3);
    for (const i of p.idx) {
      const v = p.Pc[i];
      const k = weld === "all" ? key(v) : `${p.name}|${key(v)}`;
      let id = index.get(k);
      if (id === undefined) {
        id = pos.length / 3;
        index.set(k, id);
        pos.push(v.x, v.y, v.z);
        const n = normalByPos.get(key(v)).clone().normalize();
        nor.push(n.x, n.y, n.z);
        col.push(...rel);
        part.push(pt);
        const js = p.J[i], ws = p.Wt[i];
        const s = ws.reduce((a, b) => a + b, 0) || 1;
        // Sort by weight so x is the dominant joint (used alone by the far LOD).
        const order = [0, 1, 2, 3].sort((a, b) => ws[b] - ws[a]);
        for (const o of order) {
          ji.push(ws[o] > 0.001 ? remap.get(js[o]) : 0);
          jw.push(Math.round((ws[o] / s) * 255));
        }
      }
      idx.push(id);
    }
  }
  return { pos, nor, col, part, ji, jw, idx };
}
await MeshoptSimplifier.ready;
const lod0 = build("material");
const lodBase = build("all");
function simplify(src, ratio, err) {
  const [ind] = MeshoptSimplifier.simplify(new Uint32Array(src.idx), new Float32Array(src.pos), 3, Math.floor((src.idx.length * ratio) / 3) * 3, err, []);
  // compact
  const map = new Map();
  const out = { pos: [], nor: [], col: [], part: [], ji: [], jw: [], idx: [] };
  for (const i of ind) {
    let id = map.get(i);
    if (id === undefined) {
      id = map.size;
      map.set(i, id);
      out.pos.push(...src.pos.slice(i * 3, i * 3 + 3));
      out.nor.push(...src.nor.slice(i * 3, i * 3 + 3));
      out.col.push(...src.col.slice(i * 3, i * 3 + 3));
      out.part.push(src.part[i]);
      out.ji.push(...src.ji.slice(i * 4, i * 4 + 4));
      out.jw.push(...src.jw.slice(i * 4, i * 4 + 4));
    }
    out.idx.push(id);
  }
  return out;
}
const lod1 = simplify(lodBase, 0.36, 0.02);
const lod2 = simplify(lodBase, 0.1, 0.08);
for (const [n, l] of [["lod0", lod0], ["lod1", lod1], ["lod2", lod2]]) console.log(n, "verts", l.pos.length / 3, "tris", l.idx.length / 3);

// ---- Saddle joint: most weight on the top of the back, middle third ----
const wsum = new Map();
const lb = lodBase;
let saddle = new THREE.Vector3(0, -Infinity, 0);
for (let i = 0; i < lb.pos.length / 3; i++) {
  const x = lb.pos[i * 3], y = lb.pos[i * 3 + 1], z = lb.pos[i * 3 + 2];
  if (Math.abs(x) < 0.12 && z > -0.25 && z < 0.15 && y > 1.2) {
    for (let k = 0; k < 4; k++) wsum.set(lb.ji[i * 4 + k], (wsum.get(lb.ji[i * 4 + k]) ?? 0) + lb.jw[i * 4 + k]);
    if (y > saddle.y && Math.abs(z) < 0.1) saddle.set(0, y, z);
  }
}
const attach = [...wsum.entries()].sort((a, b) => b[1] - a[1])[0][0];
console.log("saddle joint", joints[usedList[attach]].getName(), "saddle", saddle.toArray().map((x) => x.toFixed(3)), [...wsum.entries()].map(([j, w]) => joints[usedList[j]].getName() + ":" + w).join(" "));

// ---- Animations ----
const anims = new Map(root.listAnimations().filter((a) => a.getName().startsWith("AnimalArmature|")).map((a) => [a.getName().split("|")[1], a]));
const CLIPS = [
  { name: "Idle", fps: 15, loop: true },
  { name: "Idle_2", fps: 15, loop: true },
  { name: "Walk", fps: 30, loop: true },
  { name: "Gallop", fps: 30, loop: true },
  { name: "Death", fps: 30, loop: false },
  { name: "Idle_HitReact_Left", fps: 30, loop: false },
  { name: "Attack_Headbutt", fps: 30, loop: false },
];
function sample(anim, t) {
  const over = new Map();
  for (const ch of anim.listChannels()) {
    const node = ch.getTargetNode();
    const path = ch.getTargetPath();
    const s = ch.getSampler();
    const tin = s.getInput().getArray();
    const out = s.getOutput();
    const w = path === "rotation" ? 4 : 3;
    let i = 0;
    while (i < tin.length - 2 && tin[i + 1] < t) i++;
    const t0 = tin[i], t1 = tin[Math.min(i + 1, tin.length - 1)];
    const f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    const a = out.getElement(i, new Array(w)), b = out.getElement(Math.min(i + 1, tin.length - 1), new Array(w));
    let v;
    if (path === "rotation") v = new THREE.Quaternion(...a).slerp(new THREE.Quaternion(...b), f).toArray();
    else v = a.map((x, k) => x + (b[k] - x) * f);
    const o = over.get(node) ?? {};
    o[path === "translation" ? "t" : path === "rotation" ? "r" : "s"] = v;
    over.set(node, o);
  }
  return over;
}
const clips = [];
const mats = [];
let row = 0;
for (const c of CLIPS) {
  const a = anims.get(c.name);
  let dur = 0;
  for (const s of a.listSamplers()) dur = Math.max(dur, s.getInput().getMax([])[0]);
  const frames = c.loop ? Math.round(dur * c.fps) : Math.round(dur * c.fps) + 1;
  for (let f = 0; f < frames; f++) {
    const t = c.loop ? (f / frames) * dur : (f / (frames - 1)) * dur;
    const W = worlds(sample(a, t));
    for (const j of usedList) {
      const D = C.clone().multiply(W.get(joints[j])).multiply(IBM[j]).multiply(Ginv).multiply(Cinv);
      const e = D.elements; // column-major
      mats.push(e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]);
    }
  }
  clips.push({ name: c.name, row, frames, duration: dur, loop: c.loop });
  row += frames;
}
console.log("clips", clips.map((c) => `${c.name}:${c.frames}`).join(" "), "rows", row);

// ---- Write ----
const parts = [];
const jointPos = usedList.map((j) => new THREE.Vector3().setFromMatrixPosition(W0.get(joints[j])).applyMatrix4(C).toArray().map((x) => +x.toFixed(4)));
const meta = { joints: usedList.length, jointNames: usedList.map((j) => joints[j].getName()), jointPos, attach, saddle: saddle.toArray(), rows: row, clips, lods: [], arrays: {} };
// Where the saddle goes at the end of the death clip, and the head joint over the gallop.
{
  const d = clips.find((c) => c.name === "Death");
  for (const f of [0, Math.floor(d.frames / 2), d.frames - 1]) {
    const o = ((d.row + f) * usedList.length + attach) * 12;
    const m = mats.slice(o, o + 12);
    const sp = [-0.12, 1.55, -0.12].map((_, i) => 0);
    const p = [0, 1.55, -0.12];
    const q = [0, 1, 2].map((r) => m[r * 4] * p[0] + m[r * 4 + 1] * p[1] + m[r * 4 + 2] * p[2] + m[r * 4 + 3]);
    const up = [0, 1, 2].map((r) => m[r * 4 + 1]);
    console.log("death frame", f, "saddle ->", q.map((x) => x.toFixed(2)).join(","), "up ->", up.map((x) => x.toFixed(2)).join(","));
  }
  const g = clips.find((c) => c.name === "Gallop");
  for (let f = 0; f < g.frames; f += 4) {
    const o = ((g.row + f) * usedList.length + attach) * 12;
    const m = mats.slice(o, o + 12);
    const p = [0, 1.55, -0.12];
    const q = [0, 1, 2].map((r) => m[r * 4] * p[0] + m[r * 4 + 1] * p[1] + m[r * 4 + 2] * p[2] + m[r * 4 + 3]);
    console.log("gallop frame", f, "saddle ->", q.map((x) => x.toFixed(2)).join(","));
  }
}
let offset = 0;
function add(name, arr) {
  const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  const pad = (4 - (offset % 4)) % 4;
  if (pad) (parts.push(Buffer.alloc(pad)), (offset += pad));
  meta.arrays[name] = { offset, length: arr.length };
  parts.push(buf);
  offset += buf.byteLength;
}
for (const [n, l] of [["lod0", lod0], ["lod1", lod1], ["lod2", lod2]]) {
  add(`${n}.position`, new Float32Array(l.pos));
  add(`${n}.normal`, new Float32Array(l.nor));
  add(`${n}.color`, new Float32Array(l.col));
  add(`${n}.part`, new Uint8Array(l.part));
  add(`${n}.skinIndex`, new Uint8Array(l.ji));
  add(`${n}.skinWeight`, new Uint8Array(l.jw));
  add(`${n}.index`, new Uint16Array(l.idx));
}
add("bones", new Uint16Array(mats.map((x) => THREE.DataUtils.toHalfFloat(x))));
fs.mkdirSync(outdir, { recursive: true });
fs.writeFileSync(`${outdir}/horse.bin`, Buffer.concat(parts));
fs.writeFileSync(`${outdir}/horse.json`, JSON.stringify(meta));
console.log("bytes", offset);
