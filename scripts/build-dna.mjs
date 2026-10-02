/**
 * Builds public/dna/dna.json from real crystal structures in the Protein Data Bank (data is CC0):
 *
 *  - 1BNA — the Drew–Dickerson B-DNA dodecamer, the classic X-ray structure of the double helix.
 *    Four of its central base pairs (A·T, T·A, G·C, C·G) become templates, so the app can build a helix
 *    of any sequence from real atom positions.
 *  - 1KX5 — the nucleosome core particle: 147 base pairs of DNA wrapped around eight histones.
 *
 * Usage: node scripts/build-dna.mjs [cache-dir]   (downloads the files from RCSB when missing)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";

const CACHE = process.argv[2] ?? "/tmp/pdb-cache";
mkdirSync(CACHE, { recursive: true });

async function cif(id) {
  const file = join(CACHE, `${id}.cif.gz`);
  if (!existsSync(file)) {
    const res = await fetch(`https://files.rcsb.org/download/${id}.cif.gz`);
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return gunzipSync(readFileSync(file)).toString("utf8");
}

/** Atom records of the first model (heavy atoms only). */
function atoms(text) {
  const out = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) continue;
    const f = line.trim().split(/\s+/);
    if (f[20] !== "1" || f[2] === "H") continue;
    if (f[4] !== "." && f[4] !== "A") continue; // first alternative position
    out.push({
      el: f[2],
      name: f[19].replace(/"/g, ""),
      res: f[5],
      seq: Number(f[16]),
      chain: f[18],
      x: Number(f[10]),
      y: Number(f[11]),
      z: Number(f[12]),
    });
  }
  return out;
}

/** Which part of a nucleotide an atom belongs to: phosphate, sugar or base. */
function part(name) {
  if (["P", "OP1", "OP2", "OP3", "O5'"].includes(name)) return "P";
  if (name.endsWith("'")) return "S";
  return "B";
}

// ---- Small linear algebra ------------------------------------------------------------------------------

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(...a);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;

/** Main axis of a point cloud (power iteration on the covariance matrix). */
function principalAxis(points) {
  const c = [0, 1, 2].map((k) => points.reduce((s, p) => s + p[k], 0) / points.length);
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of points) {
    const d = sub(p, c);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += d[i] * d[j];
  }
  let v = [1, 1, 1];
  for (let it = 0; it < 200; it++) v = norm([dot(m[0], v), dot(m[1], v), dot(m[2], v)]);
  return { centre: c, axis: v };
}

// ---- 1BNA: base-pair templates ------------------------------------------------------------------------

const BASE = { DA: "A", DT: "T", DG: "G", DC: "C" };
const bna = atoms(await cif("1BNA")).filter((a) => BASE[a.res]);
const residue = (chain, seq) => bna.filter((a) => a.chain === chain && a.seq === seq);
const partner = (i) => 25 - i; // chain A 1..12 pairs with chain B 24..13

// The helix axis, from the central eight base pairs (the ends of a short duplex fray).
const central = bna.filter((a) => (a.chain === "A" ? a.seq >= 3 && a.seq <= 10 : a.seq >= 15 && a.seq <= 22));
const { centre, axis } = principalAxis(central.map((a) => [a.x, a.y, a.z]));
// Point the axis along strand A's 5'→3' direction.
const pA = (i) => residue("A", i).find((a) => a.name === "P");
const zAxis = dot(sub([pA(10).x, pA(10).y, pA(10).z], [pA(3).x, pA(3).y, pA(3).z]), axis) > 0 ? axis : axis.map((v) => -v);
const xAxis = norm(cross(zAxis, Math.abs(zAxis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
const yAxis = cross(zAxis, xAxis);
const local = (a) => {
  const d = sub([a.x, a.y, a.z], centre);
  return [dot(d, xAxis), dot(d, yAxis), dot(d, zAxis)];
};

/** A base pair in its own frame: the C1'→C1' line along +x at angle 0, bases centred on z = 0. */
function pairFrame(i) {
  const atomsA = residue("A", i);
  const atomsB = residue("B", partner(i));
  const c1a = local(atomsA.find((a) => a.name === "C1'"));
  const c1b = local(atomsB.find((a) => a.name === "C1'"));
  const phi = Math.atan2(c1b[1] - c1a[1], c1b[0] - c1a[0]);
  const bases = [...atomsA, ...atomsB].filter((a) => part(a.name) === "B").map(local);
  const z = bases.reduce((s, p) => s + p[2], 0) / bases.length;
  return { atomsA, atomsB, phi, z };
}

// Real twist and rise of this crystal (only their sign is used; magnitudes are the textbook values).
const frames = [3, 4, 5, 6, 7, 8, 9, 10].map(pairFrame);
let twist = 0;
let rise = 0;
for (let k = 1; k < frames.length; k++) {
  let d = frames[k].phi - frames[k - 1].phi;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  twist += d / (frames.length - 1);
  rise += (frames[k].z - frames[k - 1].z) / (frames.length - 1);
}
console.log(`1BNA: twist ${((twist * 180) / Math.PI).toFixed(1)}°, rise ${rise.toFixed(2)} Å`);

const HBONDS = {
  AT: [["N6", "O4"], ["N1", "N3"]],
  GC: [["O6", "N4"], ["N1", "N3"], ["N2", "O2"]],
};

function template(i) {
  const f = pairFrame(i);
  const c = Math.cos(-f.phi);
  const s = Math.sin(-f.phi);
  const list = [];
  for (const [strand, group] of [[0, f.atomsA], [1, f.atomsB]])
    for (const a of group) {
      const [x, y, z] = local(a);
      list.push({ x: r2(x * c - y * s), y: r2(x * s + y * c), z: r2(z - f.z), el: a.el, name: a.name, strand, part: part(a.name) });
    }
  const a = BASE[f.atomsA[0].res];
  const b = BASE[f.atomsB[0].res];
  const purineFirst = a === "A" || a === "G";
  const key = purineFirst ? a + b : b + a;
  const hbonds = HBONDS[key].map(([pu, py]) => {
    const [first, second] = purineFirst ? [pu, py] : [py, pu];
    return [list.findIndex((x) => x.strand === 0 && x.name === first), list.findIndex((x) => x.strand === 1 && x.name === second)];
  });
  return { pair: a + b, atoms: list.map((x) => [x.x, x.y, x.z, x.el, x.strand, x.part, x.name]), hbonds };
}

// Central pairs of CGCGAATTCGCG: G4·C21, A6·T19, T7·A18, C9·G16.
const templates = Object.fromEntries([4, 6, 7, 9].map((i) => template(i)).map((t) => [t.pair, t]));

// ---- 1KX5: the nucleosome -----------------------------------------------------------------------------

const kx = atoms(await cif("1KX5"));
const HISTONE = { A: "H3", E: "H3", B: "H4", F: "H4", C: "H2A", G: "H2A", D: "H2B", H: "H2B" };
const dnaAtoms = kx.filter((a) => BASE[a.res]);
const protein = kx.filter((a) => HISTONE[a.chain] && !BASE[a.res] && a.el !== "MN" && a.el !== "CL");
const all = [...dnaAtoms, ...protein];
const mid = [0, 1, 2].map((k) => all.reduce((s, a) => s + [a.x, a.y, a.z][k], 0) / all.length);
// Lay the disc flat: its thin direction (the superhelix axis) becomes +y.
const pts = all.map((a) => sub([a.x, a.y, a.z], mid));
const big = principalAxis(pts).axis;
let thin = [0, 0, 1];
{
  // Thinnest direction = smallest variance; Gram–Schmidt against the two largest.
  const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i][j] += p[i] * p[j];
  const trace = m[0][0] + m[1][1] + m[2][2];
  // Power iteration on (trace·I − M) finds the smallest-variance direction.
  let v = [0.3, 0.5, 0.8];
  for (let it = 0; it < 300; it++) {
    const w = [0, 1, 2].map((i) => trace * v[i] - dot(m[i], v));
    v = norm(w);
  }
  thin = v;
}
const ex = norm(sub(big, thin.map((t) => t * dot(big, thin))));
const ez = cross(ex, thin);
const flat = (a) => {
  const d = sub([a.x, a.y, a.z], mid);
  return [r1(dot(d, ex)), r1(dot(d, thin)), r1(dot(d, ez))];
};
const nucleosome = {
  dna: dnaAtoms.map((a) => [...flat(a), a.el, a.chain === "I" ? 0 : 1, part(a.name), BASE[a.res]]),
  histones: protein.map((a) => [...flat(a), HISTONE[a.chain]]),
};
console.log(`1KX5: ${nucleosome.dna.length} DNA atoms, ${nucleosome.histones.length} histone atoms`);

mkdirSync("public/dna", { recursive: true });
writeFileSync(
  "public/dna/dna.json",
  JSON.stringify({
    source: "RCSB PDB 1BNA (Drew et al., 1981) and 1KX5 (Davey et al., 2002); CC0",
    twistSign: Math.sign(twist),
    riseSign: Math.sign(rise),
    templates,
    nucleosome,
  }),
);
console.log("wrote public/dna/dna.json");
