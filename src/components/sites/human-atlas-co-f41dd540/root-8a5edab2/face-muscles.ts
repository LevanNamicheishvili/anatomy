import type { AtlasManifest, AtlasPart } from "./atlas-data";

/**
 * Custom face muscles (David's school-atlas Draco GLBs). BodyParts3D has no masticatory muscles, so these
 * are separate files instead of entries in body-*.bin.gz. Vertices are already in raw atlas space
 * (identity transform). Only parts with chunk === CUSTOM_CHUNK are loaded from GLB.
 */
export const CUSTOM_CHUNK = -1;
export const FACE_MUSCLE_DIR = "/models/anatomy/muscles/face";

export interface CustomPartDef {
  id: string;
  name: string;
  url: string;
  mesh: string;
  bounds: AtlasPart["bounds"];
}

type B = AtlasPart["bounds"];
const mirror = ([[x0, y0, z0], [x1, y1, z1]]: B): B => [[-x1, y0, z0], [-x0, y1, z1]];
const MASSETER_L: B = [[0.039, 1.525, -0.005], [0.061, 1.574, 0.049]];
const TEMPORALIS_L: B = [[0.032, 1.556, -0.059], [0.079, 1.66, 0.043]];
const OCULI_L: B = [[0.0067, 1.5725, 0.0443], [0.0622, 1.6231, 0.0814]];
const ORIS_L: B = [[0, 1.5125, 0.0591], [0.0345, 1.553, 0.097]];
const FRONTALIS_L: B = [[0.0038, 1.6164, 0.051], [0.0497, 1.6904, 0.0795]];

export const FACE_MUSCLES: CustomPartDef[] = [
  { id: "FX9001", name: "Left masseter", url: `${FACE_MUSCLE_DIR}/masseter.glb`, mesh: "masseter_L", bounds: MASSETER_L },
  { id: "FX9001M", name: "Right masseter", url: `${FACE_MUSCLE_DIR}/masseter.glb`, mesh: "masseter_R", bounds: mirror(MASSETER_L) },
  { id: "FX9002", name: "Left temporalis", url: `${FACE_MUSCLE_DIR}/temporalis.glb`, mesh: "temporalis_L", bounds: TEMPORALIS_L },
  { id: "FX9002M", name: "Right temporalis", url: `${FACE_MUSCLE_DIR}/temporalis.glb`, mesh: "temporalis_R", bounds: mirror(TEMPORALIS_L) },
  { id: "FX9003", name: "Left orbicularis oculi", url: `${FACE_MUSCLE_DIR}/orbicularis_oculi.glb`, mesh: "orbicularis_oculi_L", bounds: OCULI_L },
  { id: "FX9003M", name: "Right orbicularis oculi", url: `${FACE_MUSCLE_DIR}/orbicularis_oculi.glb`, mesh: "orbicularis_oculi_R", bounds: mirror(OCULI_L) },
  { id: "FX9004", name: "Left orbicularis oris", url: `${FACE_MUSCLE_DIR}/orbicularis_oris.glb`, mesh: "orbicularis_oris_L", bounds: ORIS_L },
  { id: "FX9004M", name: "Right orbicularis oris", url: `${FACE_MUSCLE_DIR}/orbicularis_oris.glb`, mesh: "orbicularis_oris_R", bounds: mirror(ORIS_L) },
  { id: "FX9005", name: "Left frontalis", url: `${FACE_MUSCLE_DIR}/frontalis.glb`, mesh: "frontalis_L", bounds: FRONTALIS_L },
  { id: "FX9005M", name: "Right frontalis", url: `${FACE_MUSCLE_DIR}/frontalis.glb`, mesh: "frontalis_R", bounds: mirror(FRONTALIS_L) },
];

export const FACE_MUSCLE_BY_ID = new Map(FACE_MUSCLES.map((d) => [d.id, d]));

/** Adds the custom face muscles to the manifest as muscular parts (idempotent). */
export function withFaceMuscles(m: AtlasManifest): AtlasManifest {
  const have = new Set(m.parts.map((p) => p.id));
  const extra: AtlasPart[] = FACE_MUSCLES.filter((d) => !have.has(d.id)).map((d) => ({
    id: d.id,
    name: d.name,
    conceptId: d.id,
    system: "muscular",
    chunk: CUSTOM_CHUNK,
    positions: 0,
    normals: 0,
    indices: 0,
    vertexCount: 0,
    indexCount: 0,
    bounds: d.bounds,
  }));
  return extra.length ? { ...m, parts: [...m.parts, ...extra] } : m;
}
