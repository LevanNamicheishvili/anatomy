/**
 * Builds the five lung lobes as surfaces (run: `npx tsx scripts/build-lungs.ts`).
 *
 * BodyParts3D has no lung surface: each lobe is only the bronchial trees and pulmonary vessels inside it
 * (its official part list, partof_element_parts.txt, says which). The lungs are therefore built the way
 * they sit in a body — filling the chest cavity:
 *
 *  1. the inside of the rib cage is found slice by slice (hull of ribs, costal cartilages and sternum),
 *     keeping 6 mm from the bones for the chest wall and pleura;
 *  2. only what lies above the diaphragm's upper surface is kept, which gives the domed lung base;
 *  3. the mediastinum is carved out: heart, great vessels, trachea, oesophagus and spine;
 *  4. every voxel goes to the lobe whose branches are nearest inside the lung, which draws the fissures;
 *  5. each lobe is blurred slightly, meshed with surface nets and smoothed.
 *
 * The result is added to the atlas as one extra chunk and five respiratory parts. Re-running the script
 * replaces the previous lobes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { join } from "node:path";
import type { AtlasManifest, AtlasPart } from "../src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/atlas-data";

const DIR = "public/sites/human-atlas-co-f41dd540/shared/models";
const ELEMENTS = process.argv[2] ?? "scripts/data/partof_element_parts.txt";
const manifest = JSON.parse(readFileSync(join(DIR, "atlas.json"), "utf8")) as AtlasManifest & {
  chunks: { url: string; bytes: number; gzip: string; gzipBytes: number }[];
};

const PREFIX = "LUNG-";
const LOBES = [
  { id: "LUNG-RUL", fma: "FMA7333", name: "Upper lobe of right lung", side: "R" },
  { id: "LUNG-RML", fma: "FMA7383", name: "Middle lobe of right lung", side: "R" },
  { id: "LUNG-RLL", fma: "FMA7337", name: "Lower lobe of right lung", side: "R" },
  { id: "LUNG-LUL", fma: "FMA7370", name: "Upper lobe of left lung", side: "L" },
  { id: "LUNG-LLL", fma: "FMA7371", name: "Lower lobe of left lung", side: "L" },
] as const;

// Drop lobes from an earlier run.
const oldChunk = manifest.parts.find((p) => p.id.startsWith(PREFIX))?.chunk;
manifest.parts = manifest.parts.filter((p) => !p.id.startsWith(PREFIX));
if (oldChunk !== undefined && !manifest.parts.some((p) => p.chunk === oldChunk)) manifest.chunks.splice(oldChunk, 1);
for (const c of manifest.concepts) c.elements = c.elements.filter((id) => !id.startsWith(PREFIX));
manifest.concepts = manifest.concepts.filter((c) => !LOBES.some((l) => l.fma === c.id));

const chunks = manifest.chunks.map((c) => {
  const b = gunzipSync(readFileSync(join(DIR, c.gzip.split("/").pop() as string)));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
});
const positionsOf = (p: AtlasPart) => new Float32Array(chunks[p.chunk], p.positions, p.vertexCount * 3);
const indicesOf = (p: AtlasPart) => new Uint32Array(chunks[p.chunk], p.indices, p.indexCount);
const byId = new Map(manifest.parts.map((p) => [p.id, p]));

// Which atlas pieces belong to which lobe, from the official BodyParts3D part-of list.
const lobeOf = new Map<string, number>();
for (const line of readFileSync(ELEMENTS, "utf8").split("\n")) {
  const [fma, , element] = line.trim().split("\t");
  const lobe = LOBES.findIndex((l) => l.fma === fma);
  if (lobe >= 0 && element && byId.has(element)) lobeOf.set(element, lobe);
}
console.log(`lobe pieces found: ${lobeOf.size}`);

// ---- Voxel grid ---------------------------------------------------------------------------------
const V = 0.003;
const boxOf = (parts: AtlasPart[]) => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of parts)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], p.bounds[0][k]);
      hi[k] = Math.max(hi[k], p.bounds[1][k]);
    }
  return { lo, hi };
};
// The chest wall: ribs, costal cartilages and the sternum.
const WALL = /\brib\b|costal cartilage|sternum|manubrium|xiphoid/i;
const wallParts = manifest.parts.filter((p) => (p.system === "skeletal" || p.system === "connective") && WALL.test(p.name));
const diaphragm = manifest.parts.filter((p) => /^diaphragm$/i.test(p.name));
const chest = boxOf([...wallParts, ...diaphragm]);
// The grid spans the chest only, so no branch can pull a lobe outside it.
const lo = [chest.lo[0] - 0.02, chest.lo[1] - 0.01, chest.lo[2] - 0.02];
const hi = [chest.hi[0] + 0.02, chest.hi[1] + 0.035, chest.hi[2] + 0.02];
const NX = Math.ceil((hi[0] - lo[0]) / V) + 1;
const NY = Math.ceil((hi[1] - lo[1]) / V) + 1;
const NZ = Math.ceil((hi[2] - lo[2]) / V) + 1;
const N = NX * NY * NZ;
const at = (x: number, y: number, z: number) => x + NX * (y + NY * z);
console.log(`grid ${NX}×${NY}×${NZ} (${(N / 1e6).toFixed(2)} M voxels)`);

/** Mark every voxel a part's surface passes through (triangles sampled finer than a voxel). */
function rasterize(p: AtlasPart, mark: (i: number) => void) {
  const pos = positionsOf(p);
  const idx = indicesOf(p);
  const put = (x: number, y: number, z: number) => {
    const gx = Math.round((x - lo[0]) / V);
    const gy = Math.round((y - lo[1]) / V);
    const gz = Math.round((z - lo[2]) / V);
    if (gx < 0 || gy < 0 || gz < 0 || gx >= NX || gy >= NY || gz >= NZ) return;
    mark(at(gx, gy, gz));
  };
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    const len = Math.max(
      Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]),
      Math.hypot(pos[a] - pos[c], pos[a + 1] - pos[c + 1], pos[a + 2] - pos[c + 2]),
    );
    const steps = Math.max(1, Math.ceil(len / (V * 0.5)));
    for (let i = 0; i <= steps; i++)
      for (let j = 0; j <= steps - i; j++) {
        const u = i / steps;
        const v = j / steps;
        const w = 1 - u - v;
        put(
          pos[a] * w + pos[b] * u + pos[c] * v,
          pos[a + 1] * w + pos[b + 1] * u + pos[c + 1] * v,
          pos[a + 2] * w + pos[b + 2] * u + pos[c + 2] * v,
        );
      }
  }
}

// Seeds: voxels on lobe pieces, labelled 1..5.
const seed = new Uint8Array(N);
for (const [id, lobe] of lobeOf) rasterize(byId.get(id) as AtlasPart, (i) => (seed[i] = lobe + 1));


/**
 * Exact squared Euclidean distance (in voxels²) from every voxel to the nearest source voxel,
 * computed axis by axis (Felzenszwalb & Huttenlocher), so it takes seconds on a million voxels.
 */
function edt(isSource: (i: number) => boolean): Float32Array {
  const INF = 1e12;
  const out = new Float32Array(N);
  for (let i = 0; i < N; i++) out[i] = isSource(i) ? 0 : INF;
  const maxN = Math.max(NX, NY, NZ);
  const f = new Float64Array(maxN);
  const d = new Float64Array(maxN);
  const v = new Int32Array(maxN);
  const z = new Float64Array(maxN + 1);
  const pass = (n: number) => {
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    for (let q = 1; q < n; q++) {
      let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) {
        k--;
        s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < n; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
    }
  };
  const axes: [number, number, number, number][] = [
    // stride along the axis, its length, and the two other axes' (stride, length)
    [1, NX, NX, NY * NZ],
    [NX, NY, 1, NX],
    [NX * NY, NZ, 1, NX * NY],
  ];
  for (const [stride, n] of axes) {
    for (let base = 0; base < N; base++) {
      // Visit each line once: its first voxel is the one with coordinate 0 along this axis.
      if (Math.floor(base / stride) % n !== 0) continue;
      for (let q = 0; q < n; q++) f[q] = out[base + q * stride];
      pass(n);
      for (let q = 0; q < n; q++) out[base + q * stride] = d[q];
    }
  }
  return out;
}

/** Voxels not reachable from the grid border through empty space are enclosed: fill them. */
function fillEnclosed(mask: Uint8Array) {
  const outside = new Uint8Array(N);
  const stack: number[] = [];
  for (let z = 0; z < NZ; z++)
    for (let y = 0; y < NY; y++)
      for (let x = 0; x < NX; x++) {
        if (x && y && z && x < NX - 1 && y < NY - 1 && z < NZ - 1) continue;
        const i = at(x, y, z);
        if (!mask[i] && !outside[i]) {
          outside[i] = 1;
          stack.push(i);
        }
      }
  while (stack.length) {
    const i = stack.pop() as number;
    const x = i % NX;
    const y = Math.floor(i / NX) % NY;
    const z = Math.floor(i / (NX * NY));
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= NX || ny >= NY || nz >= NZ) continue;
      const j = at(nx, ny, nz);
      if (!mask[j] && !outside[j]) {
        outside[j] = 1;
        stack.push(j);
      }
    }
  }
  for (let i = 0; i < N; i++) if (!outside[i]) mask[i] = 1;
}

const nearGrid = (p: AtlasPart) =>
  p.bounds[1][0] >= lo[0] && p.bounds[0][0] <= hi[0] && p.bounds[1][1] >= lo[1] && p.bounds[0][1] <= hi[1] && p.bounds[1][2] >= lo[2] && p.bounds[0][2] <= hi[2];
const mark = (parts: AtlasPart[]) => {
  const m = new Uint8Array(N);
  for (const p of parts) if (nearGrid(p)) rasterize(p, (i) => (m[i] = 1));
  return m;
};

// 1. Inside of the rib cage, slice by slice: the 2D hull of the wall within a 3 cm slab around the slice.
const wall = mark(wallParts);
function hull(points: [number, number][]) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: [number, number][] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const inside = (poly: [number, number][], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
};
const cavity = new Uint8Array(N);
const SLAB = Math.round(0.015 / V);
const wallAt: [number, number][][] = Array.from({ length: NY }, () => []);
for (let i = 0; i < N; i++)
  if (wall[i]) wallAt[Math.floor(i / NX) % NY].push([i % NX, Math.floor(i / (NX * NY))]);
for (let y = 0; y < NY; y++) {
  const pts: [number, number][] = [];
  for (let k = Math.max(0, y - SLAB); k <= Math.min(NY - 1, y + SLAB); k++) pts.push(...wallAt[k]);
  if (pts.length < 20) continue;
  const poly = hull(pts);
  for (let z = 0; z < NZ; z++) for (let x = 0; x < NX; x++) if (inside(poly, x, z)) cavity[at(x, y, z)] = 1;
}
// Keep clear of the chest wall (ribs, intercostal muscles, pleura).
const wallDist = edt((i) => wall[i] === 1);
const WALL_GAP = (0.006 / V) ** 2;

// 2. Only above the diaphragm's upper surface, column by column.
const dia = mark(diaphragm);
const floorY = new Int32Array(NX * NZ).fill(-1);
for (let i = 0; i < N; i++)
  if (dia[i]) {
    const col = (i % NX) + NX * Math.floor(i / (NX * NY));
    floorY[col] = Math.max(floorY[col], Math.floor(i / NX) % NY);
  }

// Columns the diaphragm mesh doesn't reach (outside its rim, or small holes in it) take the height of
// the nearest column it does reach; otherwise thin slivers of lung run down the ribs into the abdomen.
{
  const queue: number[] = [];
  for (let c = 0; c < NX * NZ; c++) if (floorY[c] >= 0) queue.push(c);
  for (let h = 0; h < queue.length; h++) {
    const c = queue[h];
    const x = c % NX;
    const z = Math.floor(c / NX);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= NX || nz >= NZ) continue;
      const n = nx + NX * nz;
      if (floorY[n] >= 0) continue;
      floorY[n] = floorY[c];
      queue.push(n);
    }
  }
}

// 3. The mediastinum and spine.
const MEDIASTINUM = /aorta|vena cava|pulmonary trunk|brachiocephalic|subclavian|azygos|common carotid|^trachea$|esophag|oesophag|thymus/i;
const heart = mark(manifest.parts.filter((p) => p.system === "cardiac"));
fillEnclosed(heart);
const heartDist = edt((i) => heart[i] === 1);
const middle = mark(manifest.parts.filter((p) => !lobeOf.has(p.id) && MEDIASTINUM.test(p.name)));
const middleDist = edt((i) => middle[i] === 1);
const spine = mark(manifest.parts.filter((p) => p.system === "skeletal" && /thoracic vertebra/i.test(p.name)));
const spineDist = edt((i) => spine[i] === 1);

const blocked = new Uint8Array(N);
const lungMask = new Uint8Array(N);
for (let i = 0; i < N; i++) {
  const x = i % NX;
  const y = Math.floor(i / NX) % NY;
  const z = Math.floor(i / (NX * NY));
  const floor = floorY[x + NX * z];
  const free =
    cavity[i] &&
    wallDist[i] > WALL_GAP &&
    y > floor + 1 &&
    heartDist[i] > (0.006 / V) ** 2 &&
    middleDist[i] > (0.006 / V) ** 2 &&
    spineDist[i] > (0.012 / V) ** 2 &&
    // The two lungs never meet: a narrow midline band belongs to the mediastinum.
    Math.abs(lo[0] + x * V) > 0.012;
  if (free) lungMask[i] = 1;
  else blocked[i] = 1;
}
// Both lungs share one cavity mask; the lobe labelling below decides which side each voxel belongs to.
const right = lungMask;
const left = lungMask;
console.log("chest cavity found");

// Every lung voxel goes to the lobe whose branches are nearest *inside the lung* (a wave spreading
// from all branches at once); the waves of neighbouring lobes meet at the fissures. A voxel both lungs
// could claim (near the midline) goes to whichever lung reaches it first.
const labels = new Uint8Array(N);
{
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < N; i++)
    if (seed[i] && !blocked[i]) {
      labels[i] = seed[i];
      queue[tail++] = i;
    }
  while (head < tail) {
    const i = queue[head++];
    const side = LOBES[labels[i] - 1].side;
    const lung = side === "R" ? right : left;
    const x = i % NX;
    const y = Math.floor(i / NX) % NY;
    const z = Math.floor(i / (NX * NY));
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      if (nx < 0 || ny < 0 || nz < 0 || nx >= NX || ny >= NY || nz >= NZ) continue;
      const j = at(nx, ny, nz);
      if (labels[j] || blocked[j] || !lung[j]) continue;
      labels[j] = labels[i];
      queue[tail++] = j;
    }
  }
  // Seeds lying outside the closed lung (rare stray branch tips) don't get a lobe of their own.
  for (let i = 0; i < N; i++) if (labels[i] && !(right[i] || left[i])) labels[i] = 0;
}
console.log("lobes labelled");

// Debug: DEBUG_SLICES=dir writes cross-sections (lobes coloured; wall, diaphragm, heart, spine in grey/red).
if (process.env.DEBUG_SLICES) {
  const colours = [[230, 230, 230], [214, 78, 78], [240, 170, 60], [90, 150, 220], [120, 190, 110], [170, 110, 200]];
  const pixel = (i: number) =>
    labels[i] ? colours[labels[i]] : wall[i] || spine[i] ? [60, 60, 60] : dia[i] ? [150, 40, 40] : heart[i] ? [200, 120, 120] : cavity[i] ? [205, 215, 210] : colours[0];
  const write = (name: string, w: number, h: number, at2: (u: number, v: number) => number) => {
    const body = Buffer.alloc(w * h * 3);
    for (let v = 0; v < h; v++)
      for (let u = 0; u < w; u++) body.set(pixel(at2(u, h - 1 - v)), (v * w + u) * 3);
    writeFileSync(join(process.env.DEBUG_SLICES as string, `${name}.ppm`), Buffer.concat([Buffer.from(`P6 ${w} ${h} 255\n`), body]));
  };
  const zMid = Math.round((0.0 - lo[2]) / V);
  write("coronal", NX, NY, (x, y) => at(x, y, zMid));
  for (const [name, xw] of [["sagittal-right", -0.07], ["sagittal-left", 0.07]] as const) {
    const x = Math.round((xw - lo[0]) / V);
    write(name, NZ, NY, (z, y) => at(x, y, z));
  }
  console.log("debug slices written");
}

// Keep only each lobe's main body: small pieces cut off by the carving are dropped.
for (let l = 1; l <= LOBES.length; l++) {
  const comp = new Int32Array(N).fill(-1);
  const sizes: number[] = [];
  for (let i = 0; i < N; i++) {
    if (labels[i] !== l || comp[i] >= 0) continue;
    const id = sizes.length;
    let size = 0;
    const stack = [i];
    comp[i] = id;
    while (stack.length) {
      const j = stack.pop() as number;
      size++;
      const x = j % NX;
      const y = Math.floor(j / NX) % NY;
      const z = Math.floor(j / (NX * NY));
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        const nz = z + dz;
        if (nx < 0 || ny < 0 || nz < 0 || nx >= NX || ny >= NY || nz >= NZ) continue;
        const k = at(nx, ny, nz);
        if (labels[k] === l && comp[k] < 0) {
          comp[k] = id;
          stack.push(k);
        }
      }
    }
    sizes.push(size);
  }
  const main = sizes.indexOf(Math.max(...sizes));
  let dropped = 0;
  for (let i = 0; i < N; i++)
    if (labels[i] === l && comp[i] !== main) {
      labels[i] = 0;
      dropped++;
    }
  if (dropped) console.log(`${LOBES[l - 1].name}: dropped ${dropped} stray voxels`);
}

// ---- Meshing: blur each lobe's voxels and extract the 0.5 level with surface nets ----------------
function blur(field: Float32Array) {
  const k = [1, 4, 6, 4, 1].map((v) => v / 16);
  const tmp = new Float32Array(N);
  const axes: [number, number][] = [
    [1, NX],
    [NX, NY],
    [NX * NY, NZ],
  ];
  let src = field;
  for (const [stride, n] of axes) {
    const dst = src === field ? tmp : field;
    for (let i = 0; i < N; i++) {
      const c = Math.floor(i / stride) % n;
      let s = 0;
      for (let o = -2; o <= 2; o++) {
        const cc = Math.min(n - 1, Math.max(0, c + o));
        s += k[o + 2] * src[i + (cc - c) * stride];
      }
      dst[i] = s;
    }
    src = dst;
  }
  if (src !== field) field.set(src);
}

interface Mesh {
  pos: number[];
  tri: number[];
}

function surfaceNets(f: Float32Array, iso: number): Mesh {
  const vert = new Int32Array(N).fill(-1);
  const pos: number[] = [];
  const corner = (x: number, y: number, z: number) => f[at(x, y, z)] - iso;
  for (let z = 0; z < NZ - 1; z++)
    for (let y = 0; y < NY - 1; y++)
      for (let x = 0; x < NX - 1; x++) {
        let inside = 0;
        const c: number[] = [];
        for (let k = 0; k < 8; k++) {
          const v = corner(x + (k & 1), y + ((k >> 1) & 1), z + ((k >> 2) & 1));
          c.push(v);
          if (v > 0) inside++;
        }
        if (inside === 0 || inside === 8) continue;
        // Vertex at the mean of the edge crossings.
        let sx = 0;
        let sy = 0;
        let sz = 0;
        let n = 0;
        for (let a = 0; a < 8; a++)
          for (const bit of [1, 2, 4]) {
            const b = a | bit;
            if (b === a || (c[a] > 0) === (c[b] > 0)) continue;
            const t = c[a] / (c[a] - c[b]);
            sx += (a & 1) + t * ((b & 1) - (a & 1));
            sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1));
            sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1));
            n++;
          }
        vert[at(x, y, z)] = pos.length / 3;
        pos.push(lo[0] + (x + sx / n) * V, lo[1] + (y + sy / n) * V, lo[2] + (z + sz / n) * V);
      }
  const tri: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) tri.push(a, c, b, a, d, c);
    else tri.push(a, b, c, a, c, d);
  };
  // One quad per grid edge that crosses the surface, joining the four cells around it.
  for (let z = 1; z < NZ - 1; z++)
    for (let y = 1; y < NY - 1; y++)
      for (let x = 1; x < NX - 1; x++) {
        const v0 = f[at(x, y, z)] > iso;
        if (v0 !== f[at(x + 1, y, z)] > iso)
          quad(vert[at(x, y, z)], vert[at(x, y - 1, z)], vert[at(x, y - 1, z - 1)], vert[at(x, y, z - 1)], !v0);
        if (v0 !== f[at(x, y + 1, z)] > iso)
          quad(vert[at(x, y, z)], vert[at(x, y, z - 1)], vert[at(x - 1, y, z - 1)], vert[at(x - 1, y, z)], !v0);
        if (v0 !== f[at(x, y, z + 1)] > iso)
          quad(vert[at(x, y, z)], vert[at(x - 1, y, z)], vert[at(x - 1, y - 1, z)], vert[at(x, y - 1, z)], !v0);
      }
  return { pos, tri };
}

/** Taubin smoothing: removes the voxel steps without shrinking the lobe. */
function smooth(m: Mesh, iterations: number) {
  const n = m.pos.length / 3;
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < m.tri.length; t += 3)
    for (let k = 0; k < 3; k++) {
      nb[m.tri[t + k]].add(m.tri[t + ((k + 1) % 3)]);
      nb[m.tri[t + k]].add(m.tri[t + ((k + 2) % 3)]);
    }
  const next = new Float64Array(m.pos.length);
  for (let it = 0; it < iterations * 2; it++) {
    const factor = it % 2 === 0 ? 0.5 : -0.53;
    for (let v = 0; v < n; v++) {
      let ax = 0;
      let ay = 0;
      let az = 0;
      for (const u of nb[v]) {
        ax += m.pos[u * 3];
        ay += m.pos[u * 3 + 1];
        az += m.pos[u * 3 + 2];
      }
      const k = nb[v].size || 1;
      for (const [d, a] of [
        [0, ax],
        [1, ay],
        [2, az],
      ] as const)
        next[v * 3 + d] = m.pos[v * 3 + d] + factor * (a / k - m.pos[v * 3 + d]);
    }
    for (let i = 0; i < m.pos.length; i++) m.pos[i] = next[i];
  }
}

function normals(m: Mesh) {
  const n = new Float64Array(m.pos.length);
  for (let t = 0; t < m.tri.length; t += 3) {
    const [a, b, c] = [m.tri[t] * 3, m.tri[t + 1] * 3, m.tri[t + 2] * 3];
    const ux = m.pos[b] - m.pos[a];
    const uy = m.pos[b + 1] - m.pos[a + 1];
    const uz = m.pos[b + 2] - m.pos[a + 2];
    const vx = m.pos[c] - m.pos[a];
    const vy = m.pos[c + 1] - m.pos[a + 1];
    const vz = m.pos[c + 2] - m.pos[a + 2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const i of [a, b, c]) {
      n[i] += nx;
      n[i + 1] += ny;
      n[i + 2] += nz;
    }
  }
  return n;
}

// ---- Build, orient and write ---------------------------------------------------------------------
const blocks: Buffer[] = [];
let offset = 0;
const push = (buf: Buffer) => {
  blocks.push(buf);
  offset += buf.byteLength;
};
const chunkIndex = manifest.chunks.length;
const newParts: AtlasPart[] = [];
let triangles = 0;

for (let l = 0; l < LOBES.length; l++) {
  const field = new Float32Array(N);
  let voxels = 0;
  for (let i = 0; i < N; i++)
    if (labels[i] === l + 1) {
      field[i] = 1;
      voxels++;
    }
  // A wide blur (σ ≈ 9 mm) rounds off the bulges over branch clusters, like a real pleural surface;
  // the slightly lower level makes up for the volume the blur takes off, and still leaves a thin gap
  // between neighbouring lobes: the fissures.
  for (let pass = 0; pass < 8; pass++) blur(field);
  const mesh = surfaceNets(field, 0.45);
  smooth(mesh, 20);
  let nrm = normals(mesh);
  // Make the normals point outwards.
  const count = mesh.pos.length / 3;
  const centre = [0, 0, 0];
  for (let v = 0; v < count; v++) for (let k = 0; k < 3; k++) centre[k] += mesh.pos[v * 3 + k] / count;
  let facing = 0;
  for (let v = 0; v < count; v++)
    for (let k = 0; k < 3; k++) facing += nrm[v * 3 + k] * (mesh.pos[v * 3 + k] - centre[k]);
  if (facing < 0) {
    for (let t = 0; t < mesh.tri.length; t += 3) [mesh.tri[t + 1], mesh.tri[t + 2]] = [mesh.tri[t + 2], mesh.tri[t + 1]];
    nrm = normals(mesh);
  }

  const positions = Float32Array.from(mesh.pos);
  const nOut = new Int16Array(count * 3);
  for (let v = 0; v < count; v++) {
    const len = Math.hypot(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) nOut[v * 3 + k] = Math.round((nrm[v * 3 + k] / len) * 32767);
  }
  const indices = Uint32Array.from(mesh.tri);
  const bmin: [number, number, number] = [Infinity, Infinity, Infinity];
  const bmax: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < count; v++)
    for (let k = 0; k < 3; k++) {
      bmin[k] = Math.min(bmin[k], positions[v * 3 + k]);
      bmax[k] = Math.max(bmax[k], positions[v * 3 + k]);
    }

  const posAt = offset;
  push(Buffer.from(positions.buffer));
  const nrmAt = offset;
  push(Buffer.from(nOut.buffer));
  if (offset % 4) push(Buffer.alloc(4 - (offset % 4)));
  const idxAt = offset;
  push(Buffer.from(indices.buffer));

  const lobe = LOBES[l];
  newParts.push({
    id: lobe.id,
    name: lobe.name,
    conceptId: lobe.fma,
    system: "respiratory",
    chunk: chunkIndex,
    positions: posAt,
    normals: nrmAt,
    indices: idxAt,
    vertexCount: count,
    indexCount: indices.length,
    bounds: [bmin, bmax],
  });
  triangles += indices.length / 3;
  console.log(`${lobe.name}: ${(voxels * V * V * V * 1e6).toFixed(0)} cm³, ${count} vertices, ${indices.length / 3} triangles`);
}

const raw = Buffer.concat(blocks);
const gz = gzipSync(raw, { level: 9 });
const file = `body-${chunkIndex}.bin`;
writeFileSync(join(DIR, `${file}.gz`), gz);
manifest.chunks.push({ url: `/models/${file}`, bytes: raw.byteLength, gzip: `/models/${file}.gz`, gzipBytes: gz.byteLength });
manifest.parts.push(...newParts);
// Lobes join the lung groups, so "ფილტვები" in search and lessons includes them.
for (const c of manifest.concepts) {
  if (c.name === "right lung") c.elements.push(...newParts.filter((p) => p.id.startsWith("LUNG-R")).map((p) => p.id));
  if (c.name === "left lung") c.elements.push(...newParts.filter((p) => p.id.startsWith("LUNG-L")).map((p) => p.id));
}
for (const [l, p] of newParts.entries()) manifest.concepts.push({ id: LOBES[l].fma, name: LOBES[l].name.toLowerCase(), elements: [p.id] });
manifest.triangles += triangles;
writeFileSync(join(DIR, "atlas.json"), JSON.stringify(manifest));
console.log(`wrote ${file}.gz (${(gz.byteLength / 1024).toFixed(0)} KB), ${triangles} triangles`);
