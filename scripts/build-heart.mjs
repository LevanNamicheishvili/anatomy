/**
 * Builds public/heart/heart.bin.gz + heart.json for the "Heart and circulation" topic from the atlas's
 * BodyParts3D meshes (CC BY 4.0, DBCLS): chamber walls and cavities, valve leaflets and cusps, papillary
 * muscles, coronary vessels and the great vessels — one small file instead of five atlas chunks.
 *
 * It also works out, in the output coordinates (heart centred, 1 unit = 4 cm):
 *  - the four-chamber section plane (through the centres of the four cavities);
 *  - centres of cavities and valves, the long axis (base → apex) and blood-flow paths;
 *  - where the conduction system lies on the cut face (sinus node, AV node, septum).
 *
 * Usage: node scripts/build-heart.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

const DIR = "public/sites/human-atlas-co-f41dd540/shared/models";
const atlas = JSON.parse(readFileSync(`${DIR}/atlas.json`, "utf8"));
const byId = new Map(atlas.parts.map((p) => [p.id, p]));
const SCALE = 25;

// role: how the part is drawn; key: what the app calls it.
const PARTS = [
  ["FJ2428", "wall", "ventricles"],
  ["FJ2438", "wall", "laWall"],
  ["FJ2439", "wall", "raWall"],
  ["FJ2422", "cavity", "lv"],
  ["FJ2423", "cavity", "rv"],
  ["FJ2424", "cavity", "ra"],
  ["FJ2425", "cavity", "la"],
  ["FJ2420", "leaflet", "mitral"],
  ["FJ2432", "leaflet", "mitral"],
  ["FJ2421", "leaflet", "tricuspid"],
  ["FJ2433", "leaflet", "tricuspid"],
  ["FJ2436", "leaflet", "tricuspid"],
  ["FJ2426", "cusp", "aorticValve"],
  ["FJ2431", "cusp", "aorticValve"],
  ["FJ2435", "cusp", "aorticValve"],
  ["FJ2417", "cusp", "pulmonaryValve"],
  ["FJ2427", "cusp", "pulmonaryValve"],
  ["FJ2434", "cusp", "pulmonaryValve"],
  ["FJ2418", "papillary", "papillary"],
  ["FJ2419", "papillary", "papillary"],
  ["FJ2429", "papillary", "papillary"],
  ["FJ2430", "papillary", "papillary"],
  ["FJ2437", "papillary", "papillary"],
  ["FJ3413", "artery", "aorta"],
  ["FJ3411", "artery", "aorta"],
  ["FJ3427", "artery", "aortaDesc"],
  ["FJ3479", "artery", "aortaBranch"],
  ["FJ3483", "artery", "aortaBranch"],
  ["FJ2966", "venousArtery", "pulmonary"],
  ["FJ3019", "venousArtery", "pulmonary"],
  ["FJ2924", "venousArtery", "pulmonary"],
  ["FJ2925", "arterialVein", "pulmVeins"],
  ["FJ2933", "arterialVein", "pulmVeins"],
  ["FJ2944", "arterialVein", "pulmVeins"],
  ["FJ2950", "arterialVein", "pulmVeins"],
  ["FJ2955", "arterialVein", "pulmVeins"],
  ["FJ3020", "arterialVein", "pulmVeins"],
  ["FJ3040", "arterialVein", "pulmVeins"],
  ["FJ3645", "vein", "svc"],
  ["FJ3441", "vein", "ivc"],
  ["FJ3482", "vein", "cavaBranch"],
  ["FJ3583", "vein", "cavaBranch"],
];
// Coronary arteries and cardiac veins on the heart's surface.
for (const p of atlas.parts) {
  const n = p.name.toLowerCase();
  const [lo, hi] = p.bounds;
  const onHeart = lo[1] > 1.24 && hi[1] < 1.36 && lo[0] > -0.05 && hi[0] < 0.09;
  if (!onHeart) continue;
  if (p.system === "arterial" && /coronary|conus/.test(n)) PARTS.push([p.id, "coronaryArtery", "coronary"]);
  if (p.system === "venous" && /cardiac vein|interventricular vein|coronary sinus|vein of left ventricle/.test(n)) PARTS.push([p.id, "coronaryVein", "coronary"]);
}
// Lungs (Z-Anatomy lobes in the atlas), for the circulation view.
for (const id of ["LUNG-RUL", "LUNG-RML", "LUNG-RLL", "LUNG-LUL", "LUNG-LLL"]) PARTS.push([id, "lung", id.startsWith("LUNG-R") ? "lungR" : "lungL"]);
// Long vessels are cut off below the heart.
const TRIM_BELOW = { FJ3427: 1.22, FJ3441: 1.215 };

const chunks = new Map();
const chunk = (i) => {
  if (!chunks.has(i)) {
    const b = gunzipSync(readFileSync(`${DIR}/body-${i}.bin.gz`));
    chunks.set(i, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
  return chunks.get(i);
};

const meshes = PARTS.map(([id, role, key]) => {
  const p = byId.get(id);
  if (!p) throw new Error(`missing ${id}`);
  const buf = chunk(p.chunk);
  const pos = new Float32Array(buf.slice(p.positions, p.positions + p.vertexCount * 12));
  const nrm = new Int16Array(buf.slice(p.normals, p.normals + p.vertexCount * 6));
  let idx = Array.from(new Uint32Array(buf.slice(p.indices, p.indices + p.indexCount * 4)));
  if (TRIM_BELOW[id]) {
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) if ([0, 1, 2].every((k) => pos[idx[t + k] * 3 + 1] >= TRIM_BELOW[id])) keep.push(idx[t], idx[t + 1], idx[t + 2]);
    idx = keep;
  }
  return { id, name: p.name, role, key, pos, nrm, idx };
});

// ---- Centre and scale ------------------------------------------------------------------------------
const heartParts = meshes.filter((m) => m.role === "wall");
let lo = [Infinity, Infinity, Infinity];
let hi = [-Infinity, -Infinity, -Infinity];
for (const m of heartParts)
  for (let i = 0; i < m.pos.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], m.pos[i + k]);
      hi[k] = Math.max(hi[k], m.pos[i + k]);
    }
const centre = lo.map((l, k) => (l + hi[k]) / 2);
for (const m of meshes) for (let i = 0; i < m.pos.length; i++) m.pos[i] = (m.pos[i] - centre[i % 3]) * SCALE;

// ---- Small vector helpers -------------------------------------------------------------------------
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const r3 = (a) => a.map((x) => Math.round(x * 1000) / 1000);
const centroid = (list) => {
  let s = [0, 0, 0];
  let n = 0;
  for (const m of list)
    for (let i = 0; i < m.pos.length; i += 3) {
      s = add(s, [m.pos[i], m.pos[i + 1], m.pos[i + 2]]);
      n++;
    }
  return mul(s, 1 / n);
};
const of = (key) => meshes.filter((m) => m.key === key);
const C = Object.fromEntries(["lv", "rv", "ra", "la", "mitral", "tricuspid", "aorticValve", "pulmonaryValve", "aorta", "aortaDesc", "pulmonary", "pulmVeins", "svc", "ivc", "papillary", "lungR", "lungL"].map((k) => [k, centroid(of(k))]));

// ---- Four-chamber plane ---------------------------------------------------------------------------
const cav = ["lv", "rv", "ra", "la"].map((k) => C[k]);
const cavMean = mul(cav.reduce(add, [0, 0, 0]), 1 / 4);
// The classic four-chamber plane: it contains the long axis (base → apex) and crosses both ventricles.
const base0 = mul(add(C.mitral, C.tricuspid), 0.5);
let apex0 = base0;
for (const m of of("ventricles"))
  for (let i = 0; i < m.pos.length; i += 3) {
    const p = [m.pos[i], m.pos[i + 1], m.pos[i + 2]];
    if (Math.hypot(...sub(p, base0)) > Math.hypot(...sub(apex0, base0))) apex0 = p;
  }
const long0 = norm(sub(base0, apex0));
const across = sub(C.lv, C.rv);
let n = norm(cross(norm(sub(across, mul(long0, dot(across, long0)))), long0));
if (n[2] < 0) n = mul(n, -1); // towards the front of the body
// Through the middle of the four chambers, measured along the normal.
const pc = add(base0, mul(n, dot(sub(cavMean, base0), n)));
console.log("plane normal", r3(n), "through", r3(pc));

// ---- Long axis ------------------------------------------------------------------------------------
const base = mul(add(C.mitral, C.tricuspid), 0.5);
let apex = base;
for (const m of of("ventricles"))
  for (let i = 0; i < m.pos.length; i += 3) {
    const p = [m.pos[i], m.pos[i + 1], m.pos[i + 2]];
    if (Math.hypot(...sub(p, base)) > Math.hypot(...sub(apex, base))) apex = p;
  }

// ---- Inside tests on the section plane (ray parity) ---------------------------------------------
function inside(meshList, p) {
  const dir = norm([0.577, 0.5771, 0.5773]);
  let count = 0;
  for (const m of meshList) {
    const P = m.pos;
    for (let t = 0; t < m.idx.length; t += 3) {
      const a = [P[m.idx[t] * 3], P[m.idx[t] * 3 + 1], P[m.idx[t] * 3 + 2]];
      const b = [P[m.idx[t + 1] * 3], P[m.idx[t + 1] * 3 + 1], P[m.idx[t + 1] * 3 + 2]];
      const c = [P[m.idx[t + 2] * 3], P[m.idx[t + 2] * 3 + 1], P[m.idx[t + 2] * 3 + 2]];
      const e1 = sub(b, a);
      const e2 = sub(c, a);
      const h = cross(dir, e2);
      const det = dot(e1, h);
      if (Math.abs(det) < 1e-9) continue;
      const s = sub(p, a);
      const u = dot(s, h) / det;
      if (u < 0 || u > 1) continue;
      const q = cross(s, e1);
      const w = dot(dir, q) / det;
      if (w < 0 || u + w > 1) continue;
      if (dot(e2, q) / det > 0) count++;
    }
  }
  return count % 2 === 1;
}
// Plane axes: "up" = long axis projected onto the plane, "right" = n × up.
const axisDir = norm(sub(base, apex));
let up = norm(sub(axisDir, mul(n, dot(axisDir, n))));
const right = norm(cross(up, n));
const onPlane = (u, v) => add(add(pc, mul(right, u)), mul(up, v));
const toUV = (p) => [dot(sub(p, pc), right), dot(sub(p, pc), up)];

const walls = { ventricles: of("ventricles"), ra: of("raWall"), la: of("laWall") };
const cavs = { lv: of("lv"), rv: of("rv"), ra: of("ra"), la: of("la") };
const STEP = 0.05;
const grid = [];
for (let v = -2.2; v <= 2.0; v += STEP)
  for (let u = -2.0; u <= 2.0; u += STEP) {
    const p = onPlane(u, v);
    const cell = { u, v, p };
    for (const [k, list] of Object.entries(cavs)) if (inside(list, p)) cell.cavity = k;
    if (!cell.cavity) for (const [k, list] of Object.entries(walls)) if (inside(list, p)) cell.wall = k;
    grid.push(cell);
  }
// Septum: on each row, the wall cells between right ventricle and left ventricle cavities.
const septum = [];
const rows = new Map();
for (const c of grid) {
  const key = Math.round(c.v / STEP);
  if (!rows.has(key)) rows.set(key, []);
  rows.get(key).push(c);
}
for (const [, row] of [...rows].sort((a, b) => b[0] - a[0])) {
  row.sort((a, b) => a.u - b.u);
  const rvU = row.filter((c) => c.cavity === "rv").map((c) => c.u);
  const lvU = row.filter((c) => c.cavity === "lv").map((c) => c.u);
  if (!rvU.length || !lvU.length) continue;
  // Right ventricle is on the viewer's left or right — find the gap between the two cavities.
  const rvSide = Math.sign(rvU.reduce((s, x) => s + x, 0) / rvU.length - lvU.reduce((s, x) => s + x, 0) / lvU.length);
  const edgeR = rvSide < 0 ? Math.max(...rvU) : Math.min(...rvU);
  const edgeL = rvSide < 0 ? Math.min(...lvU) : Math.max(...lvU);
  const gap = row.filter((c) => c.wall === "ventricles" && (c.u - edgeR) * (c.u - edgeL) < 0);
  if (gap.length) septum.push(r3(onPlane((edgeR + edgeL) / 2, gap[0].v)));
}
// Sinus node: RA wall cell nearest the superior vena cava; AV node: wall cell nearest the tricuspid valve,
// on the septal side.
const nearest = (filter, target) => {
  const [tu, tv] = toUV(target);
  let best = null;
  for (const c of grid) if (filter(c) && (!best || Math.hypot(c.u - tu, c.v - tv) < Math.hypot(best.u - tu, best.v - tv))) best = c;
  return best ? r3(best.p) : null;
};
const saNode = nearest((c) => c.wall === "ra", C.svc);
const avNode = nearest((c) => !!c.wall, septum[0] ? mul(add(septum[0], C.tricuspid), 0.5) : C.tricuspid);
console.log("septum points", septum.length, "SA", saNode, "AV", avNode);
// Label points: the middle of each cavity as it appears on the section (where the label is readable).
const onSection = Object.fromEntries(
  Object.keys(cavs).map((k) => {
    const cells = grid.filter((c) => c.cavity === k);
    const u = cells.reduce((t, c) => t + c.u, 0) / cells.length;
    const v = cells.reduce((t, c) => t + c.v, 0) / cells.length;
    // The cell nearest that mean (a crescent's mean can fall outside it).
    const best = cells.reduce((b, c) => (Math.hypot(c.u - u, c.v - v) < Math.hypot(b.u - u, b.v - v) ? c : b));
    return [k, r3(best.p)];
  }),
);
// Thickest wall points of each ventricle on the section, for the "myocardium" label.
const wallCells = grid.filter((c) => c.wall === "ventricles");
onSection.wallLV = r3(wallCells.reduce((b, c) => (c.v < b.v ? c : b)).p);
const cavityCells = Object.fromEntries(Object.keys(cavs).map((k) => [k, grid.filter((c) => c.cavity === k).length]));
console.log("cavity cells on plane", cavityCells);

// ---- Smooth tubes for vessels whose atlas mesh is too coarse after trimming ----------------------------
// Slice the vertices along the vertical axis; each slice's centre and mean radius give the tube.
const tubes = {};
for (const [id, key] of [["FJ3427", "aortaDesc"], ["FJ3441", "ivc"]]) {
  const m = meshes.find((x) => x.id === id);
  const pts = [];
  // Only down to a little below the heart (the same cut as before, in output units).
  const floor = (TRIM_BELOW[id] - centre[1]) * SCALE;
  for (let i = 0; i < m.pos.length; i += 3) if (m.pos[i + 1] >= floor) pts.push([m.pos[i], m.pos[i + 1], m.pos[i + 2]]);
  const ys = pts.map((q) => q[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const N = 5;
  const line = [];
  for (let k = 0; k < N; k++) {
    const a = lo + ((hi - lo) * k) / N;
    const b = lo + ((hi - lo) * (k + 1)) / N;
    const sl = pts.filter((q) => q[1] >= a && q[1] <= b);
    if (sl.length < 3) continue;
    const c = mul(sl.reduce(add, [0, 0, 0]), 1 / sl.length);
    const r = sl.reduce((t, q) => t + Math.hypot(q[0] - c[0], q[2] - c[2]), 0) / sl.length;
    line.push([...r3(c), Math.round(r * 1000) / 1000]);
  }
  tubes[key] = line;
  m.idx = []; // drawn as a tube instead
}
console.log("tubes", Object.fromEntries(Object.entries(tubes).map(([k, v]) => [k, v.length])));

// ---- Output ---------------------------------------------------------------------------------------
const parts = [];
const blobs = [];
let offset = 0;
const push = (typed) => {
  const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const pad = (4 - (bytes.length % 4)) % 4;
  blobs.push(bytes, Buffer.alloc(pad));
  const at = offset;
  offset += bytes.length + pad;
  return at;
};
for (const m of meshes) {
  const positions = push(m.pos);
  const normals = push(m.nrm);
  const indices = push(Uint16Array.from(m.idx));
  parts.push({ id: m.id, name: m.name, role: m.role, key: m.key, vertexCount: m.pos.length / 3, indexCount: m.idx.length, positions, normals, indices, centre: r3(centroid([m])) });
}
mkdirSync("public/heart", { recursive: true });
writeFileSync("public/heart/heart.bin.gz", gzipSync(Buffer.concat(blobs), { level: 9 }));
writeFileSync(
  "public/heart/heart.json",
  JSON.stringify({
    source: "BodyParts3D (c) DBCLS, CC BY 4.0 — via the atlas models",
    scale: SCALE,
    parts,
    plane: { normal: r3(n), point: r3(pc), right: r3(right), up: r3(up) },
    axis: { base: r3(base), apex: r3(apex) },
    centres: Object.fromEntries(Object.entries(C).map(([k, v]) => [k, r3(v)])),
    conduction: { sa: saNode, av: avNode, septum },
    onSection,
    tubes,
  }),
);
console.log(`parts ${parts.length}, ${(offset / 1024).toFixed(0)} KB raw`);
