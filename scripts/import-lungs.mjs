/**
 * Imports the five lung lobes from Z-Anatomy (run: `node scripts/import-lungs.mjs <VisceralSystem100.fbx>`).
 *
 * BodyParts3D has no lung surfaces. Z-Anatomy (https://github.com/LluisV/Z-Anatomy, CC BY-SA 4.0) extends
 * the same BodyParts3D body with real lung lobes, so they belong to our model. Its file uses centimetres
 * and a slightly different origin: the lobes are placed into our coordinates by matching the trachea and
 * bronchial tree, which both models share, axis by axis.
 *
 * The lobes replace any previous LUNG-* parts in atlas.json and are written as one extra chunk.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { join } from "node:path";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const DIR = "public/sites/human-atlas-co-f41dd540/shared/models";
const SOURCE = process.argv[2];
if (!SOURCE) throw new Error("Usage: node scripts/import-lungs.mjs <path to Z-Anatomy VisceralSystem100.fbx>");

const PREFIX = "LUNG-";
const LOBES = [
  { id: "LUNG-RUL", fma: "FMA7333", name: "Upper lobe of right lung", source: "Superior_lobe_of_right_lung" },
  { id: "LUNG-RML", fma: "FMA7383", name: "Middle lobe of right lung", source: "Middle_lobe_of_right_lung" },
  { id: "LUNG-RLL", fma: "FMA7337", name: "Lower lobe of right lung", source: "Inferior_lobe_of_right_lung" },
  { id: "LUNG-LUL", fma: "FMA7370", name: "Upper lobe of left lung", source: "Superior_lobe_of_left_lung" },
  { id: "LUNG-LLL", fma: "FMA7371", name: "Lower lobe of left lung", source: "Inferior_lobe_of_left_lung" },
];

// ---- Our atlas -------------------------------------------------------------------------------------
const manifest = JSON.parse(readFileSync(join(DIR, "atlas.json"), "utf8"));
const oldChunk = manifest.parts.find((p) => p.id.startsWith(PREFIX))?.chunk;
manifest.parts = manifest.parts.filter((p) => !p.id.startsWith(PREFIX));
if (oldChunk !== undefined && !manifest.parts.some((p) => p.chunk === oldChunk)) {
  if (oldChunk !== manifest.chunks.length - 1) throw new Error("lung chunk is not the last chunk");
  manifest.chunks.splice(oldChunk, 1);
}
for (const c of manifest.concepts) c.elements = c.elements.filter((id) => !id.startsWith(PREFIX));
manifest.concepts = manifest.concepts.filter((c) => !LOBES.some((l) => l.fma === c.id));

const chunkData = new Map();
const chunkOf = (i) => {
  if (!chunkData.has(i)) {
    const b = gunzipSync(readFileSync(join(DIR, manifest.chunks[i].gzip.split("/").pop())));
    chunkData.set(i, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
  return chunkData.get(i);
};

/** Bounding box of a set of vertices. */
const box = () => ({ lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] });
const grow = (b, x, y, z) => {
  const v = [x, y, z];
  for (let k = 0; k < 3; k++) {
    b.lo[k] = Math.min(b.lo[k], v[k]);
    b.hi[k] = Math.max(b.hi[k], v[k]);
  }
};

// The airways shared by both models: trachea, main and lobar bronchi, segmental bronchial trees.
const AIRWAY = /trachea|bronch/i;
const ours = box();
for (const p of manifest.parts) {
  if (p.system !== "respiratory" || !AIRWAY.test(p.name)) continue;
  const pos = new Float32Array(chunkOf(p.chunk), p.positions, p.vertexCount * 3);
  for (let i = 0; i < pos.length; i += 3) grow(ours, pos[i], pos[i + 1], pos[i + 2]);
}

// ---- Z-Anatomy -------------------------------------------------------------------------------------
globalThis.window ??= globalThis;
globalThis.self ??= globalThis;
const warn = console.warn;
console.warn = () => {}; // the loader warns about materials and textures we don't use
const file = readFileSync(SOURCE);
const scene = new FBXLoader().parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), "");
console.warn = warn;
scene.updateMatrixWorld(true);

const meshes = new Map();
scene.traverse((o) => {
  if (o.isMesh && o.geometry.attributes.position.count > 36) meshes.set(o.name, o);
});
/** World-space positions of a mesh. */
const worldPositions = (mesh) => {
  const g = mesh.geometry.clone();
  g.applyMatrix4(mesh.matrixWorld);
  return g;
};
const theirs = box();
for (const [name, mesh] of meshes) {
  if (!AIRWAY.test(name)) continue;
  const pos = worldPositions(mesh).attributes.position;
  for (let i = 0; i < pos.count; i++) grow(theirs, pos.getX(i), pos.getY(i), pos.getZ(i));
}

// Per-axis linear fit of their airway box onto ours.
const scale = [0, 1, 2].map((k) => (ours.hi[k] - ours.lo[k]) / (theirs.hi[k] - theirs.lo[k]));
const shift = [0, 1, 2].map((k) => ours.lo[k] - theirs.lo[k] * scale[k]);
console.log("fit scale", scale.map((s) => s.toFixed(5)).join(", "), "| shift", shift.map((s) => s.toFixed(4)).join(", "));

// ---- Convert the lobes -----------------------------------------------------------------------------
const blocks = [];
let offset = 0;
const push = (buf) => {
  blocks.push(buf);
  offset += buf.byteLength;
};
const chunkIndex = manifest.chunks.length;
const newParts = [];
let triangles = 0;

for (const lobe of LOBES) {
  const mesh = meshes.get(lobe.source);
  if (!mesh) throw new Error(`missing ${lobe.source}`);
  let g = worldPositions(mesh);
  for (const name of Object.keys(g.attributes)) if (name !== "position") g.deleteAttribute(name);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++)
    pos.setXYZ(i, pos.getX(i) * scale[0] + shift[0], pos.getY(i) * scale[1] + shift[1], pos.getZ(i) * scale[2] + shift[2]);
  // Mirrored axes (negative scale) would turn the triangles inside out.
  if (scale[0] * scale[1] * scale[2] < 0) {
    const idx = g.index ? g.index.array : null;
    if (!idx) g = g.toNonIndexed();
  }
  g = mergeVertices(g, 1e-6);
  g.computeVertexNormals();

  const positions = new Float32Array(g.attributes.position.array);
  const count = positions.length / 3;
  const nrm = g.attributes.normal.array;
  const nOut = new Int16Array(count * 3);
  for (let i = 0; i < count * 3; i++) nOut[i] = Math.round(Math.max(-1, Math.min(1, nrm[i])) * 32767);
  const indices = new Uint32Array(g.index.array);
  const b = box();
  for (let i = 0; i < positions.length; i += 3) grow(b, positions[i], positions[i + 1], positions[i + 2]);

  const posAt = offset;
  push(Buffer.from(positions.buffer));
  const nrmAt = offset;
  push(Buffer.from(nOut.buffer));
  if (offset % 4) push(Buffer.alloc(4 - (offset % 4)));
  const idxAt = offset;
  push(Buffer.from(indices.buffer));

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
    bounds: [b.lo, b.hi],
  });
  triangles += indices.length / 3;
  console.log(`${lobe.name}: ${count} vertices, ${indices.length / 3} triangles, y ${b.lo[1].toFixed(3)}–${b.hi[1].toFixed(3)} m`);
}

const raw = Buffer.concat(blocks);
const gz = gzipSync(raw, { level: 9 });
const out = `body-${chunkIndex}.bin`;
writeFileSync(join(DIR, `${out}.gz`), gz);
manifest.chunks.push({ url: `/models/${out}`, bytes: raw.byteLength, gzip: `/models/${out}.gz`, gzipBytes: gz.byteLength });
manifest.parts.push(...newParts);
for (const c of manifest.concepts) {
  if (c.name === "right lung") c.elements.push(...newParts.filter((p) => p.id.startsWith("LUNG-R")).map((p) => p.id));
  if (c.name === "left lung") c.elements.push(...newParts.filter((p) => p.id.startsWith("LUNG-L")).map((p) => p.id));
}
for (const [l, p] of newParts.entries()) manifest.concepts.push({ id: LOBES[l].fma, name: LOBES[l].name.toLowerCase(), elements: [p.id] });
manifest.triangles = manifest.parts.reduce((n, p) => n + p.indexCount / 3, 0);
writeFileSync(join(DIR, "atlas.json"), JSON.stringify(manifest));
console.log(`wrote ${out}.gz (${(gz.byteLength / 1024).toFixed(0)} KB), ${triangles} triangles`);
