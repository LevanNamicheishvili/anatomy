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
// Patch holes left in the scanned skin (armpits, hands, groin). Face openings — eyes, mouth, nostrils,
// ears — are real openings and stay open. Loops are filled with a fan in the reverse direction of the
// boundary so the new triangles face the same way as their neighbours.
function fillHoles(tris: Uint32Array, pos: Float32Array): Uint32Array {
  const directed = new Set<string>();
  for (let t = 0; t < tris.length; t += 3)
    for (let e = 0; e < 3; e++) directed.add(`${tris[t + e]},${tris[t + ((e + 1) % 3)]}`);
  // Boundary edges by start vertex. A vertex can start several boundary edges (holes touching at a
  // point), so loops are traced edge by edge rather than vertex by vertex.
  const next = new Map<number, number[]>();
  for (const k of directed) {
    const [a, b] = k.split(",").map(Number);
    if (directed.has(`${b},${a}`)) continue;
    const l = next.get(a);
    if (l) l.push(b);
    else next.set(a, [b]);
  }
  const added: number[] = [];
  const usedEdge = new Set<string>();
  let loops = 0;
  const takeEdge = (from: number): number | undefined => {
    for (const to of next.get(from) ?? []) {
      const k = `${from},${to}`;
      if (!usedEdge.has(k)) {
        usedEdge.add(k);
        return to;
      }
    }
    return undefined;
  };
  for (const [start, outs] of next) {
    for (let o = 0; o < outs.length; o++) {
      if (usedEdge.has(`${start},${outs[o]}`)) continue;
      usedEdge.add(`${start},${outs[o]}`);
      const loop = [start];
      let cur: number | undefined = outs[o];
      while (cur !== undefined && cur !== start && loop.length < 2000) {
        loop.push(cur);
        cur = takeEdge(cur);
      }
      if (cur !== start || loop.length < 3) continue;
      fill(loop);
    }
  }
  function fill(loop: number[]) {
    const cy = loop.reduce((s, v) => s + pos[v * 3 + 1], 0) / loop.length;
    if (cy > 1.45) return; // face and ear openings stay open
    for (let i = 1; i < loop.length - 1; i++) added.push(loop[0], loop[i + 1], loop[i]);
    loops++;
  }
  console.log(`skin holes patched: ${loops} (${added.length / 3} triangles)`);
  const out = new Uint32Array(tris.length + added.length);
  out.set(tris);
  out.set(added, tris.length);
  return out;
}

const skinIndices = indicesOf(skinPart);
const filledSkin = fillHoles(skinIndices, skinPos);
// Removing the fingertip-to-thigh bridges opens small gaps on the thigh and fingertips: patch those
// separately, then drop any patch that would bridge the hand and thigh again.
const cleanedSkin = dropBridges(fillHoles(dropBridges(filledSkin, skinRaw), skinPos), skinRaw);
smoothOverMesh(skinRaw, cleanedSkin, skinCount, 10);
const skin = { raw: skinRaw, indices: cleanedSkin };

// Adaptive push-out: the visible outer skin layer is moved out just far enough to cover any inner
// structure lying close under (or through) it — at least the default 5.5 mm, at most 25 mm.
const skinNrm = new Int16Array(chunks[skinPart.chunk].slice(skinPart.normals, skinPart.normals + skinCount * 6));
const skinInflate = new Uint8Array(skinCount).fill(55); // units of 0.1 mm
{
  // The skin is a two-layer shell; find the outer layer (the component whose torso normals face out).
  const parent = new Int32Array(skinCount).map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (let t = 0; t < skinIndices.length; t += 3) {
    const r0 = find(skinIndices[t]);
    for (const q of [skinIndices[t + 1], skinIndices[t + 2]]) {
      const r = find(q);
      if (r !== r0) parent[r] = r0;
    }
  }
  const facing = new Map<number, number>();
  for (let v = 0; v < skinCount; v++) {
    const x = skinPos[v * 3];
    const y = skinPos[v * 3 + 1];
    const z = skinPos[v * 3 + 2];
    if (y < 1.0 || y > 1.35 || Math.abs(x) > 0.14) continue;
    const r = find(v);
    facing.set(r, (facing.get(r) ?? 0) + Math.sign(x * skinNrm[v * 3] + z * skinNrm[v * 3 + 2]));
  }
  const outerRoot = [...facing].sort((a, b) => b[1] - a[1])[0][0];
  const outer = new Uint8Array(skinCount);
  for (let v = 0; v < skinCount; v++) outer[v] = find(v) === outerRoot ? 1 : 0;

  const OCELL = 0.02;
  const ogrid = new Map<string, number[]>();
  for (let v = 0; v < skinCount; v++) {
    if (!outer[v]) continue;
    const k = `${Math.floor(skinPos[v * 3] / OCELL)},${Math.floor(skinPos[v * 3 + 1] / OCELL)},${Math.floor(skinPos[v * 3 + 2] / OCELL)}`;
    const l = ogrid.get(k);
    if (l) l.push(v);
    else ogrid.set(k, [v]);
  }
  const need = new Float32Array(skinCount);
  let covered = 0;
  for (const p of manifest.parts) {
    if (p.system === "integumentary") continue;
    const pos = positionsOf(p);
    for (let v = 0; v < p.vertexCount; v++) {
      const x = pos[v * 3];
      const y = pos[v * 3 + 1];
      const z = pos[v * 3 + 2];
      if (y > 1.5) continue; // head: eyes, ears and teeth sit in real openings
      const cx = Math.floor(x / OCELL);
      const cy = Math.floor(y / OCELL);
      const cz = Math.floor(z / OCELL);
      let s = -1;
      let bd = 0.04 * 0.04;
      for (let i = -2; i <= 2; i++)
        for (let j = -2; j <= 2; j++)
          for (let k = -2; k <= 2; k++)
            for (const q of ogrid.get(`${cx + i},${cy + j},${cz + k}`) ?? []) {
              const d = (skinPos[q * 3] - x) ** 2 + (skinPos[q * 3 + 1] - y) ** 2 + (skinPos[q * 3 + 2] - z) ** 2;
              if (d < bd) {
                bd = d;
                s = q;
              }
            }
      if (s < 0) continue;
      const d =
        ((x - skinPos[s * 3]) * skinNrm[s * 3] + (y - skinPos[s * 3 + 1]) * skinNrm[s * 3 + 1] + (z - skinPos[s * 3 + 2]) * skinNrm[s * 3 + 2]) /
        32767;
      if (d + 0.003 > need[s]) need[s] = d + 0.003;
      if (d > 0.005) covered++;
    }
  }
  // Spread each bump over two rings of neighbours, then soften it, so the skin swells smoothly.
  const nbrs: number[][] = Array.from({ length: skinCount }, () => []);
  for (let t = 0; t < cleanedSkin.length; t += 3)
    for (let e = 0; e < 3; e++) nbrs[cleanedSkin[t + e]].push(cleanedSkin[t + ((e + 1) % 3)], cleanedSkin[t + ((e + 2) % 3)]);
  let cur = need;
  for (let it = 0; it < 2; it++) {
    const nx = new Float32Array(cur);
    for (let v = 0; v < skinCount; v++) for (const n of nbrs[v]) if (cur[n] > nx[v]) nx[v] = cur[n];
    cur = nx;
  }
  for (let it = 0; it < 3; it++) {
    const nx = new Float32Array(cur);
    for (let v = 0; v < skinCount; v++) {
      if (!nbrs[v].length) continue;
      let s = 0;
      for (const n of nbrs[v]) s += cur[n];
      nx[v] = Math.max(cur[v] * 0.9, 0.5 * cur[v] + (0.5 * s) / nbrs[v].length);
    }
    cur = nx;
  }
  let raised = 0;
  for (let v = 0; v < skinCount; v++) {
    if (!outer[v]) continue;
    const mm = Math.min(0.025, Math.max(0.0055, cur[v]));
    skinInflate[v] = Math.round(mm * 10000);
    if (mm > 0.0056) raised++;
  }
  console.log(`inner points closer than 5 mm to the skin: ${covered}; outer skin points pushed out further: ${raised}`);
}

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
const partsOut: Record<string, { o: number; f?: number; i?: number; n?: number }> = {};
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
  const entry: { o: number; f?: number; i?: number; n?: number } = { o: offset };
  if (p.id === skinPart.id) {
    // Per-vertex push-out distance (0.1 mm units) for the outer skin layer.
    entry.f = offset + size;
    blocks.push(Buffer.from(skinInflate.buffer, skinInflate.byteOffset, skinInflate.byteLength));
    size += skinInflate.byteLength;
  }
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
