import type { AtlasManifest, AtlasPart } from "./atlas-data";

/**
 * Animation groups drive the vertex/fragment shader tweaks in the viewer.
 * 0 static · 1 atria · 2 ventricles/valves/heart surface · 3 airways · 4 diaphragm · 5 ribcage · 6 arteries · 7 veins · 8 body surface
 */
export type AnimGroup = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type LessonKey = "heart" | "breathing" | "circulation";

// Region around the heart (metres, model space). Vessels fully inside it beat with the heart.
const HEART_BOX = { min: [-0.05, 1.235, -0.05], max: [0.095, 1.375, 0.095] };

// The source data files a few brain ventricles under "cardiac"; exclude them from the heart.
const BRAIN_VENTRICLE = /third ventricle|fourth ventricle|lateral ventricle|interventricular foramen/i;

export function isHeartPart(p: AtlasPart) {
  return p.system === "cardiac" && /atri|ventric|valve|leaflet|cusp/i.test(p.name) && !BRAIN_VENTRICLE.test(p.name);
}

function insideHeartBox(p: AtlasPart) {
  const [min, max] = p.bounds;
  return min.every((v, i) => v >= HEART_BOX.min[i]) && max.every((v, i) => v <= HEART_BOX.max[i]);
}

const GREAT_VESSEL = /ascending aorta|arch of aorta|pulmonary trunk|vena cava|pulmonary artery|pulmonary vein/i;
const RIBCAGE = /\brib\b|costal cartilage|sternum|manubrium|xiphoid/i;

export function animGroup(p: AtlasPart): AnimGroup {
  if (p.system === "integumentary") return 8;
  if (isHeartPart(p)) return /atri/i.test(p.name) ? 1 : 2;
  if ((p.system === "arterial" || p.system === "venous") && insideHeartBox(p)) return 2;
  if (p.system === "respiratory" && /bronch|trachea/i.test(p.name)) return 3;
  if (/^diaphragm$/i.test(p.name)) return 4;
  if ((p.system === "skeletal" || p.system === "connective") && RIBCAGE.test(p.name)) return 5;
  if (p.system === "arterial") return 6;
  if (p.system === "venous") return 7;
  return 0;
}

export function lessonParts(manifest: AtlasManifest, lesson: LessonKey): string[] {
  return manifest.parts
    .filter((p) => {
      const g = animGroup(p);
      if (lesson === "heart") return g === 1 || g === 2 || GREAT_VESSEL.test(p.name);
      if (lesson === "breathing")
        return g === 3 || g === 4 || g === 5 || (p.system === "skeletal" && /thoracic vertebra/i.test(p.name));
      return g === 1 || g === 2 || g === 6 || g === 7;
    })
    .map((p) => p.id);
}

/** Parts the camera should frame for a lesson (the heart lesson zooms onto the heart itself). */
export function lessonFocusParts(manifest: AtlasManifest, lesson: LessonKey): string[] {
  if (lesson !== "heart") return lessonParts(manifest, lesson);
  return manifest.parts.filter((p) => {
    const g = animGroup(p);
    return g === 1 || g === 2;
  }).map((p) => p.id);
}

/** Anatomical anchor points used by the animation shaders. */
export function animationAnchors(manifest: AtlasManifest) {
  const acc = { heart: [0, 0, 0, 0], lungL: [0, 0, 0, 0], lungR: [0, 0, 0, 0], chest: [0, 0, 0, 0] };
  const add = (a: number[], p: AtlasPart) => {
    for (let i = 0; i < 3; i++) a[i] += (p.bounds[0][i] + p.bounds[1][i]) / 2;
    a[3] += 1;
  };
  for (const p of manifest.parts) {
    const g = animGroup(p);
    if (g === 1 || (g === 2 && isHeartPart(p))) add(acc.heart, p);
    if (g === 3 && /bronch/i.test(p.name)) add((p.bounds[0][0] + p.bounds[1][0]) / 2 > 0 ? acc.lungL : acc.lungR, p);
    if (g === 5) add(acc.chest, p);
  }
  const avg = (a: number[], fallback: [number, number, number]): [number, number, number] =>
    a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : fallback;
  return {
    heart: avg(acc.heart, [0.02, 1.305, 0.025]),
    lungL: avg(acc.lungL, [0.08, 1.3, 0]),
    lungR: avg(acc.lungR, [-0.08, 1.3, 0]),
    chest: avg(acc.chest, [0, 1.25, 0.02]),
  };
}
