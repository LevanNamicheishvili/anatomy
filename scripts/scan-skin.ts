/**
 * Scans the whole body surface for defects (run: `npx tsx scripts/scan-skin.ts`):
 *  1. holes — skin edges used by only one triangle (after baked bridge removal)
 *  2. poke-through — vertices of inner structures lying outside the skin surface
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import type { AtlasManifest, AtlasPart } from "../src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/atlas-data";

const DIR = "public/sites/human-atlas-co-f41dd540/shared/models";
const manifest = JSON.parse(readFileSync(join(DIR, "atlas.json"), "utf8")) as AtlasManifest;
const bake = JSON.parse(readFileSync(join(DIR, "skin.json"), "utf8")) as {
  files: string[];
  parts: Record<string, { o: number; f?: number; i?: number; n?: number }>;
};
const unz = (f: string) => {
  const b = gunzipSync(readFileSync(join(DIR, f)));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};
const chunks = manifest.chunks.map((c) => unz(c.gzip.split("/").pop() as string));
const positionsOf = (p: AtlasPart) => new Float32Array(chunks[p.chunk], p.positions, p.vertexCount * 3);

const skinPart = manifest.parts.find((p) => p.name === "Skin") as AtlasPart;
const sp = positionsOf(skinPart);
const sn = new Int16Array(chunks[skinPart.chunk].slice(skinPart.normals, skinPart.normals + skinPart.vertexCount * 6));
const entry = bake.parts[skinPart.id];
const inflate = entry.f !== undefined ? new Uint8Array(unz(bake.files[skinPart.chunk]), entry.f, skinPart.vertexCount) : null;
const tris = entry.i !== undefined && entry.n ? new Uint32Array(unz(bake.files[skinPart.chunk]), entry.i, entry.n) : new Uint32Array(chunks[skinPart.chunk], skinPart.indices, skinPart.indexCount);

const region = (x: number, y: number) => {
  const ax = Math.abs(x);
  if (y > 1.5) return "head/neck";
  if (ax > 0.19 && y > 0.65) return y > 1.12 ? "upper arm" : y > 0.86 ? "forearm" : "hand";
  if (y > 1.05) return "chest/back";
  if (y > 0.8) return "pelvis/hips";
  if (y > 0.47) return "thigh";
  if (y > 0.09) return "lower leg";
  return "foot";
};

// The skin is a two-layer shell: an outer surface (normals out) and an inner one ~2 mm deeper (normals in).
// Only the outer layer is visible, so defects are measured against it.
const parent = new Int32Array(skinPart.vertexCount).map((_, i) => i);
const find = (x: number): number => {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
};
const origTris = new Uint32Array(chunks[skinPart.chunk], skinPart.indices, skinPart.indexCount);
for (let t = 0; t < origTris.length; t += 3) {
  const r0 = find(origTris[t]);
  for (const q of [origTris[t + 1], origTris[t + 2]]) {
    const r = find(q);
    if (r !== r0) parent[r] = r0;
  }
}
const facing = new Map<number, number>();
for (let v = 0; v < skinPart.vertexCount; v++) {
  const x = sp[v * 3];
  const y = sp[v * 3 + 1];
  const z = sp[v * 3 + 2];
  if (y < 1.0 || y > 1.35 || Math.abs(x) > 0.14) continue;
  const r = find(v);
  facing.set(r, (facing.get(r) ?? 0) + Math.sign(x * sn[v * 3] + z * sn[v * 3 + 2]));
}
const outerRoot = [...facing].sort((a, b) => b[1] - a[1])[0][0];
const isOuter = (v: number) => find(v) === outerRoot;
console.log(`outer layer: ${Array.from({ length: skinPart.vertexCount }, (_, v) => v).filter(isOuter).length} vertices`);

// 1. Holes: boundary edges (outer layer only).
const edges = new Map<string, number>();
for (let t = 0; t < tris.length; t += 3) {
  if (!isOuter(tris[t])) continue;
  for (let e = 0; e < 3; e++) {
    const a = tris[t + e];
    const b = tris[t + ((e + 1) % 3)];
    const k = a < b ? `${a},${b}` : `${b},${a}`;
    edges.set(k, (edges.get(k) ?? 0) + 1);
  }
}
const holes: Record<string, number> = {};
let boundary = 0;
for (const [k, n] of edges) {
  if (n !== 1) continue;
  boundary++;
  const a = Number(k.split(",")[0]);
  const r = region(sp[a * 3], sp[a * 3 + 1]);
  holes[r] = (holes[r] ?? 0) + 1;
}
console.log(`\nHOLES: ${boundary} open skin edges`, holes);

// 2. Poke-through: nearest skin vertex, signed distance along its outward normal.
const CELL = 0.02;
const grid = new Map<string, number[]>();
const cell = (x: number, y: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
for (let v = 0; v < skinPart.vertexCount; v++) {
  if (!isOuter(v)) continue;
  const k = cell(sp[v * 3], sp[v * 3 + 1], sp[v * 3 + 2]);
  const l = grid.get(k);
  if (l) l.push(v);
  else grid.set(k, [v]);
}
function nearestSkin(x: number, y: number, z: number): [number, number] {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  const cz = Math.floor(z / CELL);
  let best = -1;
  let bd = Infinity;
  for (let r = 0; r < 6; r++) {
    for (let i = -r; i <= r; i++)
      for (let j = -r; j <= r; j++)
        for (let k = -r; k <= r; k++) {
          if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
          for (const v of grid.get(`${cx + i},${cy + j},${cz + k}`) ?? []) {
            const d = (sp[v * 3] - x) ** 2 + (sp[v * 3 + 1] - y) ** 2 + (sp[v * 3 + 2] - z) ** 2;
            if (d < bd) {
              bd = d;
              best = v;
            }
          }
        }
    if (best >= 0 && Math.sqrt(bd) <= r * CELL) break;
  }
  return [best, Math.sqrt(bd)];
}

const OFFSET = 0.0055; // default skin push-out in the shader (baked per-vertex values override it)
const out: Record<string, { n: number; max: number }> = {};
const bySystem: Record<string, number> = {};
let total = 0;
let worst = 0;
for (const p of manifest.parts) {
  if (p.system === "integumentary") continue;
  const pos = positionsOf(p);
  for (let v = 0; v < p.vertexCount; v++) {
    const x = pos[v * 3];
    const y = pos[v * 3 + 1];
    const z = pos[v * 3 + 2];
    const [s, dist] = nearestSkin(x, y, z);
    if (s < 0 || dist > 0.04) continue;
    const nx = sn[s * 3] / 32767;
    const ny = sn[s * 3 + 1] / 32767;
    const nz = sn[s * 3 + 2] / 32767;
    const d = (x - sp[s * 3]) * nx + (y - sp[s * 3 + 1]) * ny + (z - sp[s * 3 + 2]) * nz;
    const push = inflate ? Math.max(inflate[s] / 10000, OFFSET) : OFFSET;
    if (y > 1.5) continue; // head: eyes, ears and teeth sit in real openings
    if (d <= push - 0.0005) continue; // hidden under the pushed-out skin
    total++;
    worst = Math.max(worst, d);
    const r = region(x, y);
    const o = (out[r] ??= { n: 0, max: 0 });
    o.n++;
    o.max = Math.max(o.max, d);
    bySystem[p.system] = (bySystem[p.system] ?? 0) + 1;
  }
}
console.log(`\nPOKE-THROUGH: ${total} inner vertices outside the skin (worst ${(worst * 1000).toFixed(1)} mm)`);
for (const [r, o] of Object.entries(out).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${r.padEnd(12)} ${String(o.n).padStart(6)} vertices, up to ${(o.max * 1000).toFixed(1)} mm`);
console.log("  by system:", bySystem);
