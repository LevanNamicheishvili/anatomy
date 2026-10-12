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
const DAO_L: B = [[0.0184, 1.5065, 0.0336], [0.0408, 1.5285, 0.0602]];
const MENTALIS_L: B = [[0.0018, 1.5028, 0.0617], [0.015, 1.5108, 0.0743]];
const BUCCINATOR_L: B = [[0.024, 1.5292, 0.0291], [0.0395, 1.553, 0.0622]];
const CORRUGATOR_L: B = [[0.0026, 1.6137, 0.0709], [0.0226, 1.6212, 0.0768]];
const ZYGO_MINOR_L: B = [[0.0225, 1.5461, 0.0485], [0.039, 1.5913, 0.0694]];
const NASALIS_L: B = [[0.0023, 1.5499, 0.0678], [0.0189, 1.5804, 0.1035]];
const PROCERUS_L: B = [[0.0009, 1.583, 0.0727], [0.007, 1.6217, 0.0953]];
const SEPTI_L: B = [[0.0013, 1.5458, 0.077], [0.0055, 1.554, 0.0884]];
const LLS_L: B = [[0.0106, 1.5466, 0.0636], [0.025, 1.5747, 0.0874]];
const DLI_L: B = [[0.0045, 1.5048, 0.0624], [0.0181, 1.5259, 0.0949]];
const ZYGOMATICUS_L: B = [[0.0302, 1.5324, 0.0337], [0.0548, 1.5879, 0.0659]];

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
  { id: "FX9008", name: "Left zygomaticus major", url: `${FACE_MUSCLE_DIR}/zygomaticus.glb`, mesh: "zygomaticus_L", bounds: ZYGOMATICUS_L },
  { id: "FX9008M", name: "Right zygomaticus major", url: `${FACE_MUSCLE_DIR}/zygomaticus.glb`, mesh: "zygomaticus_R", bounds: mirror(ZYGOMATICUS_L) },
  { id: "FX9006", name: "Left depressor anguli oris", url: `${FACE_MUSCLE_DIR}/dao.glb`, mesh: "dao_L", bounds: DAO_L },
  { id: "FX9006M", name: "Right depressor anguli oris", url: `${FACE_MUSCLE_DIR}/dao.glb`, mesh: "dao_R", bounds: mirror(DAO_L) },
  { id: "FX9007", name: "Left mentalis", url: `${FACE_MUSCLE_DIR}/mentalis.glb`, mesh: "mentalis_L", bounds: MENTALIS_L },
  { id: "FX9007M", name: "Right mentalis", url: `${FACE_MUSCLE_DIR}/mentalis.glb`, mesh: "mentalis_R", bounds: mirror(MENTALIS_L) },
  { id: "FX9009", name: "Left buccinator", url: `${FACE_MUSCLE_DIR}/buccinator.glb`, mesh: "buccinator_L", bounds: BUCCINATOR_L },
  { id: "FX9009M", name: "Right buccinator", url: `${FACE_MUSCLE_DIR}/buccinator.glb`, mesh: "buccinator_R", bounds: mirror(BUCCINATOR_L) },
  { id: "FX9010", name: "Left corrugator supercilii", url: `${FACE_MUSCLE_DIR}/corrugator.glb`, mesh: "corrugator_L", bounds: CORRUGATOR_L },
  { id: "FX9010M", name: "Right corrugator supercilii", url: `${FACE_MUSCLE_DIR}/corrugator.glb`, mesh: "corrugator_R", bounds: mirror(CORRUGATOR_L) },
  { id: "FX9011", name: "Left zygomaticus minor", url: `${FACE_MUSCLE_DIR}/zygomaticus_minor.glb`, mesh: "zygomaticus_minor_L", bounds: ZYGO_MINOR_L },
  { id: "FX9011M", name: "Right zygomaticus minor", url: `${FACE_MUSCLE_DIR}/zygomaticus_minor.glb`, mesh: "zygomaticus_minor_R", bounds: mirror(ZYGO_MINOR_L) },
  { id: "FX9012", name: "Left nasalis", url: `${FACE_MUSCLE_DIR}/nasalis.glb`, mesh: "nasalis_L", bounds: NASALIS_L },
  { id: "FX9012M", name: "Right nasalis", url: `${FACE_MUSCLE_DIR}/nasalis.glb`, mesh: "nasalis_R", bounds: mirror(NASALIS_L) },
  { id: "FX9013", name: "Left procerus", url: `${FACE_MUSCLE_DIR}/procerus.glb`, mesh: "procerus_L", bounds: PROCERUS_L },
  { id: "FX9013M", name: "Right procerus", url: `${FACE_MUSCLE_DIR}/procerus.glb`, mesh: "procerus_R", bounds: mirror(PROCERUS_L) },
  { id: "FX9014", name: "Left depressor septi nasi", url: `${FACE_MUSCLE_DIR}/depressor_septi.glb`, mesh: "depressor_septi_L", bounds: SEPTI_L },
  { id: "FX9014M", name: "Right depressor septi nasi", url: `${FACE_MUSCLE_DIR}/depressor_septi.glb`, mesh: "depressor_septi_R", bounds: mirror(SEPTI_L) },
  { id: "FX9015", name: "Left levator labii superioris", url: `${FACE_MUSCLE_DIR}/levator_labii_superioris.glb`, mesh: "levator_labii_superioris_L", bounds: LLS_L },
  { id: "FX9015M", name: "Right levator labii superioris", url: `${FACE_MUSCLE_DIR}/levator_labii_superioris.glb`, mesh: "levator_labii_superioris_R", bounds: mirror(LLS_L) },
  { id: "FX9016", name: "Left depressor labii inferioris", url: `${FACE_MUSCLE_DIR}/depressor_labii_inferioris.glb`, mesh: "depressor_labii_inferioris_L", bounds: DLI_L },
  { id: "FX9016M", name: "Right depressor labii inferioris", url: `${FACE_MUSCLE_DIR}/depressor_labii_inferioris.glb`, mesh: "depressor_labii_inferioris_R", bounds: mirror(DLI_L) },
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
