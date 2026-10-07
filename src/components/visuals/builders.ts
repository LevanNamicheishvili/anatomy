import type { Builder } from "@/components/journeys/JourneyScene";

/** Lesson animations by id; each topic's file is downloaded only when one of its lessons is opened. */
const lazy =
  <M>(load: () => Promise<M>, pick: (m: M) => Builder): Builder =>
  async (k) =>
    pick(await load())(k);

const hormones = () => import("./v-hormones");
const health = () => import("./v-health");
const evolution = () => import("./v-evolution");
const ecology = () => import("./v-ecology");

export const VISUAL_BUILDERS: Record<string, Builder> = {
  "endocrine-system": lazy(hormones, (m) => m.endocrineSystem),
  pituitary: lazy(hormones, (m) => m.pituitary),
  thyroid: lazy(hormones, (m) => m.thyroidGland),
  glucose: lazy(hormones, (m) => m.glucose),
  smoking: lazy(health, (m) => m.smoking),
  alcohol: lazy(health, (m) => m.alcohol),
  drugs: lazy(health, (m) => m.drugs),
  exercise: lazy(health, (m) => m.exercise),
  "tree-of-life": lazy(evolution, (m) => m.treeOfLife),
  giraffes: lazy(evolution, (m) => m.giraffes),
  microevolution: lazy(evolution, (m) => m.microevolution),
  struggle: lazy(evolution, (m) => m.struggle),
  "peppered-moth": lazy(evolution, (m) => m.pepperedMoth),
  adaptations: lazy(evolution, (m) => m.adaptations),
  antibiotic: lazy(evolution, (m) => m.antibiotic),
  speciation: lazy(evolution, (m) => m.speciation),
  evidence: lazy(evolution, (m) => m.evidence),
  paleontology: lazy(evolution, (m) => m.paleontology),
  ecosystem: lazy(ecology, (m) => m.ecosystem),
  "eco-factors": lazy(ecology, (m) => m.ecoFactors),
  "predator-prey": lazy(ecology, (m) => m.predatorPrey),
  "food-chain": lazy(ecology, (m) => m.foodChain),
  pyramid: lazy(ecology, (m) => m.pyramid),
  cycles: lazy(ecology, (m) => m.cycles),
  biodiversity: lazy(ecology, (m) => m.biodiversity),
  "georgia-bio": lazy(ecology, (m) => m.georgiaBio),
  conservation: lazy(ecology, (m) => m.conservation),
  "water-pollution": lazy(ecology, (m) => m.waterPollution),
  "air-pollution": lazy(ecology, (m) => m.airPollution),
  greenhouse: lazy(ecology, (m) => m.greenhouse),
};
