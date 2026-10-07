/**
 * Builds public/journeys/body.bin.gz + body.json for the "Journeys" (guided camera tours through the body)
 * from the atlas's BodyParts3D meshes (CC BY 4.0, DBCLS) and Z-Anatomy lungs (CC BY-SA 4.0): skin, skeleton,
 * brain, heart, lungs, great vessels and the right arm's muscles and bones.
 *
 * It also measures what the tours need: the spine's centreline (for the spinal cord, which the atlas
 * doesn't have), the elbow's position and axis, and centres of organs. Coordinates: atlas metres.
 * Usage: node scripts/build-journeys.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

const DIR = "public/sites/human-atlas-co-f41dd540/shared/models";
const atlas = JSON.parse(readFileSync(`${DIR}/atlas.json`, "utf8"));

/** Which parts go in, and the group each belongs to. */
function groupOf(p) {
  const n = p.name.toLowerCase();
  if (p.id === "FJ2810") return "skin";
  if (["FJ3368", "FJ3349", "FJ3391"].includes(p.id)) return { FJ3368: "humerus", FJ3349: "radius", FJ3391: "ulna" }[p.id];
  if (p.id === "FJ3365") return "femur";
  if (p.system === "skeletal")
    return /vertebra|^atlas$|^axis$|rib|sternum|manubrium|xiphoid|sacrum|coccyx|hip bone|ilium|ischium|pubis|scapula|clavicle|frontal bone|parietal bone|occipital bone|temporal bone|sphenoid|mandible|maxilla|zygomatic|nasal bone|femur|tibia|fibula|patella/i.test(p.name) && !/disk|cartilage/i.test(p.name) ? "skeleton" : null;
  // Brain only: cranial nerves, ganglia and the tentorium would clutter the view.
  if (p.system === "nervous") return /nerve|ganglion|branch|tentorium/i.test(p.name) ? null : "brain";
  if (p.system === "cardiac" && p.bounds[0][1] > 1.2 && p.bounds[1][1] < 1.4) return "heart";
  if (p.id.startsWith("LUNG-")) return "lungs";
  if (["FJ3413", "FJ3411", "FJ3427", "FJ2966", "FJ3019", "FJ2924", "FJ3645", "FJ3441", "FJ3659", "FJ1932", "FJ3482", "FJ3583", "FJ3479", "FJ3483", "FJ3564", "FJ3579"].includes(p.id)) return p.system === "venous" ? "veins" : p.id === "FJ2966" || p.id === "FJ3019" || p.id === "FJ2924" ? "veins" : "arteries";
  if (/right biceps brachii|right brachialis/.test(n)) return "biceps";
  if (/right triceps brachii/.test(n)) return "triceps";
  return null;
}

const chunks = new Map();
const chunk = (i) => {
  if (!chunks.has(i)) {
    const b = gunzipSync(readFileSync(`${DIR}/body-${i}.bin.gz`));
    chunks.set(i, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
  return chunks.get(i);
};

const parts = [];
// Two files: the brain is only needed by one journey, so it loads separately.
const files = { core: { blobs: [], offset: 0 }, brain: { blobs: [], offset: 0 } };
let file = files.core;
const push = (typed) => {
  const bytes = Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength);
  const pad = (4 - (bytes.length % 4)) % 4;
  file.blobs.push(bytes, Buffer.alloc(pad));
  const at = file.offset;
  file.offset += bytes.length + pad;
  return at;
};
// Positions are stored as 16-bit integers over the body's bounding box (≈ 0.03 mm steps).
const BOX = { min: [-0.4, -0.01, -0.2], size: [0.8, 1.76, 0.4] };
const quant = (pos) => {
  const q = new Uint16Array(pos.length);
  for (let i = 0; i < pos.length; i++) q[i] = Math.round(((pos[i] - BOX.min[i % 3]) / BOX.size[i % 3]) * 65535);
  return q;
};
const normals8 = (n16) => Int8Array.from(n16, (v) => Math.round(v / 258));
const centroidOf = (pos) => {
  const c = [0, 0, 0];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) c[k] += pos[i + k];
  return c.map((v) => Math.round((v / (pos.length / 3)) * 10000) / 10000);
};
const kept = {};
for (const p of atlas.parts) {
  const group = groupOf(p);
  if (!group) continue;
  // Skip tiny skeletal parts (cartilages, sesamoids) to keep the file small.
  if (group === "skeleton" && p.vertexCount < 120) continue;
  const buf = chunk(p.chunk);
  const pos = new Float32Array(buf.slice(p.positions, p.positions + p.vertexCount * 12));
  const nrm = new Int16Array(buf.slice(p.normals, p.normals + p.vertexCount * 6));
  const idx = Uint16Array.from(new Uint32Array(buf.slice(p.indices, p.indices + p.indexCount * 4)));
  file = group === "brain" ? files.brain : files.core;
  parts.push({ id: p.id, name: p.name, group, file: group === "brain" ? "brain" : "core", vertexCount: p.vertexCount, indexCount: p.indexCount, positions: push(quant(pos)), normals: push(normals8(nrm)), indices: push(idx), centre: centroidOf(pos) });
  kept[group] = (kept[group] ?? 0) + p.vertexCount;
  if (/vertebra|sacrum|^axis$|^atlas$/i.test(p.name)) parts[parts.length - 1].vertebra = true;
}
console.log("vertices by group", kept);

// ---- Spine centreline: vertebrae from the skull down, their centres shifted back to the spinal canal. --
const vertebrae = parts.filter((p) => p.vertebra && !/sacr|disk/i.test(p.name)).sort((a, b) => b.centre[1] - a.centre[1]);
const spine = vertebrae.map((p) => {
  const b = atlas.parts.find((x) => x.id === p.id).bounds;
  // The canal lies behind the vertebral body: about 60% of the way to the back of the bone.
  return [p.centre[0], p.centre[1], Math.round((b[1][2] - 0.62 * (b[1][2] - b[0][2])) * 10000) / 10000];
});
console.log("vertebrae", vertebrae.length, vertebrae.slice(0, 3).map((p) => p.name));

// ---- Elbow: distal end of the humerus. ---------------------------------------------------------------
const hum = atlas.parts.find((x) => x.id === "FJ3368");
const hb = chunk(hum.chunk);
const hp = new Float32Array(hb.slice(hum.positions, hum.positions + hum.vertexCount * 12));
let minY = Infinity;
for (let i = 1; i < hp.length; i += 3) minY = Math.min(minY, hp[i]);
const low = [];
for (let i = 0; i < hp.length; i += 3) if (hp[i + 1] < minY + 0.015) low.push([hp[i], hp[i + 1], hp[i + 2]]);
const elbow = [0, 1, 2].map((k) => Math.round((low.reduce((s, q) => s + q[k], 0) / low.length) * 10000) / 10000);
let ex = [0, 0, 0];
for (const q of low) for (const r of low) if (Math.abs(q[0] - r[0]) > Math.abs(ex[0])) ex = [q[0] - r[0], q[1] - r[1], q[2] - r[2]];
const exLen = Math.hypot(...ex);
const elbowAxis = ex.map((v) => Math.round((v / exLen) * 1000) / 1000);
console.log("elbow", elbow, elbowAxis);

mkdirSync("public/journeys", { recursive: true });
for (const [name, f] of Object.entries(files)) writeFileSync(`public/journeys/${name}.bin.gz`, gzipSync(Buffer.concat(f.blobs), { level: 9 }));
writeFileSync(
  "public/journeys/body.json",
  JSON.stringify({
    source: "BodyParts3D (c) DBCLS, CC BY 4.0; lungs: Z-Anatomy, CC BY-SA 4.0",
    box: BOX,
    parts: parts.map(({ vertebra, ...rest }) => (void vertebra, rest)),
    spine,
    elbow,
    elbowAxis,
  }),
);
console.log(`parts ${parts.length}, raw core ${(files.core.offset / 1e6).toFixed(1)} MB, brain ${(files.brain.offset / 1e6).toFixed(1)} MB`);
