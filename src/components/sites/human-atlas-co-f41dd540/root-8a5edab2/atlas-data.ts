export const MODEL_BASE = "/sites/human-atlas-co-f41dd540/shared/models";

export type SystemKey =
  | "skeletal"
  | "muscular"
  | "cardiac"
  | "sensory"
  | "arterial"
  | "venous"
  | "nervous"
  | "respiratory"
  | "digestive"
  | "urinary"
  | "lymphatic"
  | "endocrine"
  | "reproductive"
  | "integumentary"
  | "connective";

export interface AtlasPart {
  id: string;
  name: string;
  conceptId: string;
  system: SystemKey;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [[number, number, number], [number, number, number]];
}

export interface AtlasChunk {
  url: string;
  bytes: number;
  gzip: string;
  gzipBytes: number;
}

export interface AtlasConcept {
  id: string;
  name: string;
  elements: string[];
}

export interface AtlasManifest {
  version: string;
  parts: AtlasPart[];
  chunks: AtlasChunk[];
  concepts: AtlasConcept[];
  triangles: number;
  sex: string;
  scope: string;
}

export interface TissueMaterial {
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  sheen?: number;
  sheenColor?: string;
  specular?: number;
  env?: number;
}

export interface SystemMeta {
  key: SystemKey;
  /** UI dot color */
  dot: string;
  /** Mesh base color */
  tissue: string;
  /** Physically based "wet tissue" surface settings */
  material: TissueMaterial;
  defaultOn: boolean;
}

// Order matches the Systems list. Colors and gloss are tuned for a fresh, moist-tissue look.
export const SYSTEMS: SystemMeta[] = [
  { key: "skeletal", dot: "#e6dcc2", tissue: "#e8dcc2", defaultOn: true,
    material: { roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.5, specular: 0.45 } },
  { key: "muscular", dot: "#c4544a", tissue: "#9c3730", defaultOn: true,
    material: { roughness: 0.5, clearcoat: 0.7, clearcoatRoughness: 0.22, sheen: 0.55, sheenColor: "#ff8a78" } },
  { key: "cardiac", dot: "#b43a33", tissue: "#8e2c27", defaultOn: true,
    material: { roughness: 0.36, clearcoat: 0.9, clearcoatRoughness: 0.2, sheen: 0.5, sheenColor: "#ff8f86" } },
  { key: "sensory", dot: "#9fc9d2", tissue: "#e9eff0", defaultOn: true,
    material: { roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, specular: 0.9, env: 1.1 } },
  { key: "arterial", dot: "#d23a36", tissue: "#b3262a", defaultOn: true,
    material: { roughness: 0.34, clearcoat: 0.9, clearcoatRoughness: 0.18 } },
  { key: "venous", dot: "#4a74c0", tissue: "#34569a", defaultOn: true,
    material: { roughness: 0.34, clearcoat: 0.9, clearcoatRoughness: 0.18 } },
  { key: "nervous", dot: "#e8c25c", tissue: "#f1d17c", defaultOn: true,
    material: { roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.35, sheen: 0.4, sheenColor: "#fff1c2" } },
  { key: "respiratory", dot: "#e39a98", tissue: "#e7a2a0", defaultOn: true,
    material: { roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.35, sheen: 0.7, sheenColor: "#ffd0cc" } },
  { key: "digestive", dot: "#d9866a", tissue: "#c7775c", defaultOn: true,
    material: { roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.5, sheenColor: "#ffc2a8" } },
  { key: "urinary", dot: "#a5503f", tissue: "#873a2e", defaultOn: true,
    material: { roughness: 0.38, clearcoat: 0.85, clearcoatRoughness: 0.22 } },
  { key: "lymphatic", dot: "#b0657a", tissue: "#8f4a5c", defaultOn: true,
    material: { roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.25 } },
  { key: "endocrine", dot: "#dc9a70", tissue: "#d99a74", defaultOn: true,
    material: { roughness: 0.42, clearcoat: 0.75, clearcoatRoughness: 0.25 } },
  { key: "reproductive", dot: "#d68c82", tissue: "#d08f86", defaultOn: true,
    material: { roughness: 0.42, clearcoat: 0.75, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: "#ffc9c0" } },
  { key: "integumentary", dot: "#e2b594", tissue: "#e8c0a2", defaultOn: false,
    material: { roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.45, sheen: 0.8, sheenColor: "#ffe0cc" } },
  { key: "connective", dot: "#a9d4c6", tissue: "#dfe9e4", defaultOn: true,
    material: { roughness: 0.32, clearcoat: 0.85, clearcoatRoughness: 0.18, specular: 0.8 } },
];

export const SYSTEM_BY_KEY = Object.fromEntries(SYSTEMS.map((s) => [s.key, s])) as Record<
  SystemKey,
  SystemMeta
>;

export type PresetKey = "all" | "skeleton" | "organs";

export const PRESETS: Record<PresetKey, SystemKey[]> = {
  all: SYSTEMS.map((s) => s.key),
  skeleton: ["skeletal", "connective"],
  organs: ["cardiac", "respiratory", "digestive", "urinary", "lymphatic", "endocrine", "reproductive"],
};

/**
 * Reproductive organs and the structures that show their shape (the male model's penis and scrotum
 * vessels, the urethra running through the penis, the perineal muscle). Hidden unless a teacher turns
 * them on, so the model can be shown to a class without awkward moments.
 */
const SENSITIVE = /penis|penile|scrot|testicular|spermatic|bulbospong|ischiocavern|cremaster|glans|prepuce|perineal muscle|^urethra$/i;
export const isSensitive = (p: AtlasPart) => p.system === "reproductive" || SENSITIVE.test(p.name);

export const DEFAULT_SYSTEMS: SystemKey[] = SYSTEMS.filter((s) => s.defaultOn).map((s) => s.key);

/** Emissive glow applied to selected structures. */
export const SELECTED_GLOW = "#19c2a0";

export function titleCase(name: string): string {
  return name.replace(/(^|[\s(\-/])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
}
