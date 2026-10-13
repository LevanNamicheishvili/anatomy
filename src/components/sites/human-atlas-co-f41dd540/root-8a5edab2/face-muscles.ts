import type { AtlasManifest, AtlasPart } from "./atlas-data";

/**
 * Custom face muscles (David's school-atlas Draco GLBs). BodyParts3D has no masticatory muscles, so these
 * are separate files instead of entries in body-*.bin.gz. Vertices are already in raw atlas space
 * (identity transform). Only parts with chunk === CUSTOM_CHUNK are loaded from GLB.
 */
export const CUSTOM_CHUNK = -1;
export const FACE_MUSCLE_DIR = "/models/anatomy/muscles/face_v2";

export interface CustomPartDef {
  id: string;
  name: string;
  url: string;
  mesh: string;
  bounds: AtlasPart["bounds"];
}

type B = AtlasPart["bounds"];
const mirror = ([[x0, y0, z0], [x1, y1, z1]]: B): B => [[-x1, y0, z0], [-x0, y1, z1]];
const MASSETER_L: B = [[0.0385, 1.517, -0.0022], [0.0658, 1.584, 0.0465]];
const TEMPORALIS_L: B = [[0.0354, 1.5517, -0.0644], [0.0793, 1.6711, 0.0538]];
const OCULI_L: B = [[0.0102, 1.5741, 0.0457], [0.0559, 1.6243, 0.0768]];
const ORIS_L: B = [[0, 1.5137, 0.0573], [0.032, 1.5733, 0.0946]];
const FRONTALIS_L: B = [[0, 1.6109, 0.0318], [0.06, 1.6833, 0.0803]];
const DAO_L: B = [[0.0132, 1.5018, 0.0408], [0.0372, 1.5448, 0.0654]];
const MENTALIS_L: B = [[0.0012, 1.5027, 0.0668], [0.015, 1.5171, 0.0738]];
const BUCCINATOR_L: B = [[0.0271, 1.5252, 0.0278], [0.0429, 1.5513, 0.054]];
const CORRUGATOR_L: B = [[0.01, 1.6084, 0.0671], [0.0319, 1.628, 0.0754]];
const ZYGO_MINOR_L: B = [[0.0128, 1.5528, 0.0512], [0.0522, 1.5837, 0.0751]];
const NASALIS_L: B = [[0, 1.5681, 0.0689], [0.0168, 1.6104, 0.091]];
const PROCERUS_L: B = [[0, 1.6014, 0.0743], [0.0234, 1.6379, 0.0807]];
const SEPTI_L: B = [[0.0006, 1.5485, 0.0738], [0.0163, 1.5642, 0.0806]];
const LLS_L: B = [[0.0129, 1.5528, 0.0593], [0.0387, 1.5831, 0.076]];
const DLI_L: B = [[0, 1.5052, 0.0497], [0.0323, 1.5351, 0.0765]];
const MEDPTER_L: B = [[0.0156, 1.5325, -0.0002], [0.0362, 1.5802, 0.0292]];
const LATPTER_L: B = [[0.0234, 1.5549, -0.0046], [0.0545, 1.5881, 0.0388]];
const ZYGOMATICUS_L: B = [[0.0261, 1.5296, 0.0406], [0.0582, 1.5855, 0.0658]];

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
  { id: "FX9017", name: "Left medial pterygoid", url: `${FACE_MUSCLE_DIR}/medial_pterygoid.glb`, mesh: "medial_pterygoid_L", bounds: MEDPTER_L },
  { id: "FX9017M", name: "Right medial pterygoid", url: `${FACE_MUSCLE_DIR}/medial_pterygoid.glb`, mesh: "medial_pterygoid_R", bounds: mirror(MEDPTER_L) },
  { id: "FX9018", name: "Left lateral pterygoid", url: `${FACE_MUSCLE_DIR}/lateral_pterygoid.glb`, mesh: "lateral_pterygoid_L", bounds: LATPTER_L },
  { id: "FX9018M", name: "Right lateral pterygoid", url: `${FACE_MUSCLE_DIR}/lateral_pterygoid.glb`, mesh: "lateral_pterygoid_R", bounds: mirror(LATPTER_L) },
];

// Held back from the atlas until their models pass QA, so students never see a broken mesh.
const HELD_FILES = new Set(["masseter.glb", "buccinator.glb", "medial_pterygoid.glb", "lateral_pterygoid.glb", "procerus.glb"]);
const isHeld = (d: CustomPartDef) => HELD_FILES.has(d.url.split("/").pop() ?? "");

export const FACE_MUSCLE_BY_ID = new Map(FACE_MUSCLES.map((d) => [d.id, d]));

/** Adds the custom face muscles to the manifest as muscular parts (idempotent). */
export function withFaceMuscles(m: AtlasManifest): AtlasManifest {
  const have = new Set(m.parts.map((p) => p.id));
  const extra: AtlasPart[] = FACE_MUSCLES.filter((d) => !have.has(d.id) && !isHeld(d)).map((d) => ({
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
