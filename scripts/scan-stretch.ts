/**
 * Poses every baked soft-tissue part and reports the ones whose triangles stretch the most
 * (run: `npx tsx scripts/scan-stretch.ts`). A stretched edge means some vertices follow a different
 * body segment than their neighbours.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import * as THREE from "three";
import type { AtlasManifest, AtlasPart } from "../src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/atlas-data";
import {
  ANIMATED_POSES,
  SEGMENTS,
  STATIC_POSES,
  anglesToQuaternion,
  buildRig,
  evaluatePose,
  groundOffset,
  solveSegments,
  type Segment,
} from "../src/components/sites/human-atlas-co-f41dd540/root-8a5edab2/rig";

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
const weights = bake.files.map(unz);
const rig = buildRig(manifest);

function poseMatrices(key: (typeof STATIC_POSES)[number], t: number) {
  const angles = evaluatePose(key, t);
  const rot = Object.fromEntries(SEGMENTS.map((s) => [s, anglesToQuaternion(angles[s], new THREE.Quaternion())])) as Record<Segment, THREE.Quaternion>;
  const mats = Object.fromEntries(SEGMENTS.map((s) => [s, new THREE.Matrix4()])) as Record<Segment, THREE.Matrix4>;
  const off = new THREE.Vector3();
  solveSegments(rig, rot, off, mats);
  off.y = groundOffset(rig, mats);
  solveSegments(rig, rot, off, mats);
  return [...SEGMENTS.map((s) => mats[s]), new THREE.Matrix4()];
}

const poses = [
  ...STATIC_POSES.map((k) => ({ k, t: 0 })),
  ...ANIMATED_POSES.flatMap((k) => [0.3, 0.8, 1.3, 1.8].map((t) => ({ k, t }))),
];
const worst = new Map<string, { ratio: number; pose: string }>();
for (const { k, t } of poses) {
  const mats = poseMatrices(k, t);
  for (const p of manifest.parts) {
    const e = bake.parts[p.id];
    if (!e) continue;
    const pos = new Float32Array(chunks[p.chunk], p.positions, p.vertexCount * 3);
    const tris = e.i !== undefined && e.n ? new Uint32Array(weights[p.chunk], e.i, e.n) : new Uint32Array(chunks[p.chunk], p.indices, p.indexCount);
    const n = p.vertexCount * 4;
    const si = new Uint8Array(weights[p.chunk], e.o, n);
    const sw = new Uint8Array(weights[p.chunk], e.o + n, n);
    const out = new Float32Array(p.vertexCount * 3);
    const v = new THREE.Vector3();
    const acc = new THREE.Vector3();
    for (let i = 0; i < p.vertexCount; i++) {
      acc.set(0, 0, 0);
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        const w = sw[i * 4 + j] / 255;
        if (!w) continue;
        sum += w;
        acc.addScaledVector(v.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(mats[si[i * 4 + j]]), w);
      }
      acc.divideScalar(Math.max(sum, 1e-4));
      out[i * 3] = acc.x;
      out[i * 3 + 1] = acc.y;
      out[i * 3 + 2] = acc.z;
    }
    let ratio = 0;
    for (let q = 0; q < tris.length; q += 3)
      for (const [a, b] of [[tris[q], tris[q + 1]], [tris[q + 1], tris[q + 2]], [tris[q + 2], tris[q]]]) {
        const r0 = Math.hypot(pos[a * 3] - pos[b * 3], pos[a * 3 + 1] - pos[b * 3 + 1], pos[a * 3 + 2] - pos[b * 3 + 2]);
        const r1 = Math.hypot(out[a * 3] - out[b * 3], out[a * 3 + 1] - out[b * 3 + 1], out[a * 3 + 2] - out[b * 3 + 2]);
        // Ignore tiny edges; flag growth beyond both 3x and 3 cm.
        if (r1 - r0 > 0.03) ratio = Math.max(ratio, r1 / Math.max(r0, 0.002));
      }
    const prev = worst.get(p.id);
    if (ratio > 3 && (!prev || prev.ratio < ratio)) worst.set(p.id, { ratio, pose: `${k}@${t}` });
  }
}
const byId = new Map(manifest.parts.map((p) => [p.id, p] as [string, AtlasPart]));
const list = [...worst.entries()].sort((a, b) => b[1].ratio - a[1].ratio);
console.log(`parts stretching >3x (and >3 cm): ${list.length}`);
for (const [id, w] of list.slice(0, 40)) console.log(w.ratio.toFixed(1).padStart(7), w.pose.padEnd(18), byId.get(id)?.system, byId.get(id)?.name);
