/**
 * Bakes per-vertex skinning weights for the anatomy atlas (run: `npx tsx scripts/bake-skin-weights.ts`).
 *
 * - Body surface ("Skin"): nearest-bone segment per vertex, smoothed over the surface.
 * - Every other soft structure (muscles, vessels, organs, connective tissue, hair…): weights copied from
 *   the nearest skin vertices, so everything under the skin moves exactly with it.
 * - Bones are not baked; they move rigidly with their segment at runtime.
 *
 * Output (next to the model chunks): skin-<chunk>.bin.gz and skin.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { join } from "node:path";
import type { AtlasManifest, AtlasPart } from "../src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/atlas-data";
import {
  SEGMENT_INDEX,
  SEG_COUNT,
  buildRig,
  dropBridges,
  quantizeWeights,
  smoothOverMesh,
} from "../src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/rig";

const DIR = "public/sites/human-atlas-co-f41dd540/shared/models";
const manifest = JSON.parse(readFileSync(join(DIR, "atlas.json"), "utf8")) as AtlasManifest;
const rig = buildRig(manifest);

const chunks = manifest.chunks.map((c) => {
  const b = gunzipSync(readFileSync(join(DIR, c.gzip.split("/").pop() as string)));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
});
const positionsOf = (p: AtlasPart) => new Float32Array(chunks[p.chunk], p.positions, p.vertexCount * 3);
const indicesOf = (p: AtlasPart) => new Uint32Array(chunks[p.chunk], p.indices, p.indexCount);

// 1. Body surface weights: every skin vertex follows its nearest bone (bones are assigned to body
//    segments by name, which is exact), then weights are smoothed over the surface so joints bend
//    gradually. Triangles still bridging unjoined parts (hand resting on the hip) are dropped.
const skinPart = manifest.parts.find((p) => p.name === "Skin");
if (!skinPart) throw new Error("Skin part not found");
const skinPos = positionsOf(skinPart);
const skinCount = skinPart.vertexCount;

const BONE_CELL = 0.02;
const boneBuckets = new Map<string, number[]>();
const bonePts: number[] = [];
const boneSeg: number[] = [];
for (const p of manifest.parts) {
  if (p.system !== "skeletal") continue;
  const seg = SEGMENT_INDEX[rig.segmentOf(p)];
  const pos = positionsOf(p);
  for (let v = 0; v < p.vertexCount; v++) {
    const i = boneSeg.length;
    bonePts.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
    boneSeg.push(seg);
    const k = `${Math.floor(pos[v * 3] / BONE_CELL)},${Math.floor(pos[v * 3 + 1] / BONE_CELL)},${Math.floor(pos[v * 3 + 2] / BONE_CELL)}`;
    const list = boneBuckets.get(k);
    if (list) list.push(i);
    else boneBuckets.set(k, [i]);
  }
}

function nearestBoneSegment(x: number, y: number, z: number): number {
  const cx = Math.floor(x / BONE_CELL);
  const cy = Math.floor(y / BONE_CELL);
  const cz = Math.floor(z / BONE_CELL);
  let best = -1;
  let bestD = Infinity;
  for (let r = 0; r < 30; r++) {
    for (let i = -r; i <= r; i++)
      for (let j = -r; j <= r; j++)
        for (let k = -r; k <= r; k++) {
          if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
          const list = boneBuckets.get(`${cx + i},${cy + j},${cz + k}`);
          if (!list) continue;
          for (const b of list) {
            const dx = bonePts[b * 3] - x;
            const dy = bonePts[b * 3 + 1] - y;
            const dz = bonePts[b * 3 + 2] - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bestD) {
              bestD = d;
              best = b;
            }
          }
        }
    if (best >= 0 && Math.sqrt(bestD) <= r * BONE_CELL) break;
  }
  return best >= 0 ? boneSeg[best] : SEGMENT_INDEX.root;
}

const skinRaw = new Float32Array(skinCount * SEG_COUNT);
for (let v = 0; v < skinCount; v++) {
  skinRaw[v * SEG_COUNT + nearestBoneSegment(skinPos[v * 3], skinPos[v * 3 + 1], skinPos[v * 3 + 2])] = 1;
}
const skinIndices = indicesOf(skinPart);
const cleanedSkin = dropBridges(skinIndices, skinRaw);
smoothOverMesh(skinRaw, cleanedSkin, skinCount, 10);
const skin = { raw: skinRaw, indices: cleanedSkin };

// Report where triangles were dropped, so real skin is never removed by accident.
{
  const kept = new Set<string>();
  for (let t = 0; t < cleanedSkin.length; t += 3) kept.add(`${cleanedSkin[t]},${cleanedSkin[t + 1]},${cleanedSkin[t + 2]}`);
  const heights: number[] = [];
  for (let t = 0; t < skinIndices.length; t += 3) {
    if (kept.has(`${skinIndices[t]},${skinIndices[t + 1]},${skinIndices[t + 2]}`)) continue;
    heights.push(skinPos[skinIndices[t] * 3 + 1]);
  }
  const bands = new Map<string, number>();
  for (const h of heights) {
    const b = `${(Math.floor(h * 10) / 10).toFixed(1)}m`;
    bands.set(b, (bands.get(b) ?? 0) + 1);
  }
  console.log(`skin triangles dropped: ${heights.length}`, Object.fromEntries([...bands].sort()));
}


// 2. Spatial grid over skin vertices for nearest-neighbour weight transfer.
const CELL = 0.025;
const grid = new Map<string, number[]>();
const key = (x: number, y: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;
for (let v = 0; v < skinCount; v++) {
  const k = key(skinPos[v * 3], skinPos[v * 3 + 1], skinPos[v * 3 + 2]);
  const list = grid.get(k);
  if (list) list.push(v);
  else grid.set(k, [v]);
}

const K = 4;
const bestIdx = new Int32Array(K);
const bestD = new Float64Array(K);
const acc = new Float32Array(SEG_COUNT);
function transfer(x: number, y: number, z: number, out: Float32Array, o: number) {
  bestD.fill(Infinity);
  bestIdx.fill(-1);
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  const cz = Math.floor(z / CELL);
  // Grow the search shell until K neighbours are found and no closer cell can exist.
  for (let r = 0; r < 40; r++) {
    for (let i = -r; i <= r; i++)
      for (let j = -r; j <= r; j++)
        for (let k = -r; k <= r; k++) {
          if (Math.max(Math.abs(i), Math.abs(j), Math.abs(k)) !== r) continue;
          const list = grid.get(`${cx + i},${cy + j},${cz + k}`);
          if (!list) continue;
          for (const v of list) {
            const dx = skinPos[v * 3] - x;
            const dy = skinPos[v * 3 + 1] - y;
            const dz = skinPos[v * 3 + 2] - z;
            const d = dx * dx + dy * dy + dz * dz;
            if (d >= bestD[K - 1]) continue;
            let s = K - 1;
            while (s > 0 && bestD[s - 1] > d) {
              bestD[s] = bestD[s - 1];
              bestIdx[s] = bestIdx[s - 1];
              s--;
            }
            bestD[s] = d;
            bestIdx[s] = v;
          }
        }
    if (bestIdx[K - 1] >= 0 && Math.sqrt(bestD[K - 1]) <= r * CELL) break;
  }
  acc.fill(0);
  let total = 0;
  for (let n = 0; n < K; n++) {
    if (bestIdx[n] < 0) continue;
    const w = 1 / (Math.sqrt(bestD[n]) + 0.004) ** 2;
    total += w;
    for (let s = 0; s < SEG_COUNT; s++) acc[s] += skin.raw[bestIdx[n] * SEG_COUNT + s] * w;
  }
  for (let s = 0; s < SEG_COUNT; s++) out[o + s] = total > 0 ? acc[s] / total : 0;
}

// 3. Write one weight file per model chunk.
const partsOut: Record<string, { o: number; i?: number; n?: number }> = {};
const chunkBlocks: Buffer[][] = manifest.chunks.map(() => []);
const chunkSize = manifest.chunks.map(() => 0);
let baked = 0;

for (const p of manifest.parts) {
  if (p.system === "skeletal") continue;
  let raw: Float32Array;
  let cleaned: Uint32Array | null = null;
  if (p.id === skinPart.id) {
    raw = skin.raw;
    cleaned = skin.indices;
  } else {
    const pos = positionsOf(p);
    raw = new Float32Array(p.vertexCount * SEG_COUNT);
    for (let v = 0; v < p.vertexCount; v++) transfer(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2], raw, v * SEG_COUNT);
  }
  const { index, weight } = quantizeWeights(raw, p.vertexCount);
  const offset = chunkSize[p.chunk];
  const blocks = [Buffer.from(index.buffer), Buffer.from(weight.buffer)];
  let size = index.byteLength + weight.byteLength;
  const entry: { o: number; i?: number; n?: number } = { o: offset };
  if (cleaned) {
    const pad = (4 - ((offset + size) % 4)) % 4;
    if (pad) blocks.push(Buffer.alloc(pad));
    size += pad;
    entry.i = offset + size;
    entry.n = cleaned.length;
    blocks.push(Buffer.from(cleaned.buffer, cleaned.byteOffset, cleaned.byteLength));
    size += cleaned.byteLength;
  }
  // Keep every block 4-byte aligned so index arrays can be viewed directly.
  const tail = (4 - (size % 4)) % 4;
  if (tail) blocks.push(Buffer.alloc(tail));
  size += tail;
  chunkBlocks[p.chunk].push(...blocks);
  chunkSize[p.chunk] += size;
  partsOut[p.id] = entry;
  baked += p.vertexCount;
}

const files: string[] = [];
manifest.chunks.forEach((_, c) => {
  const name = `skin-${c}.bin.gz`;
  writeFileSync(join(DIR, name), gzipSync(Buffer.concat(chunkBlocks[c]), { level: 9 }));
  files.push(name);
});
writeFileSync(join(DIR, "skin.json"), JSON.stringify({ version: 1, files, parts: partsOut }));
console.log(`baked ${baked} vertices across ${Object.keys(partsOut).length} parts into ${files.length} files`);
