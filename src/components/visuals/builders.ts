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
const genetics = () => import("./v-genetics");
const bodyV = () => import("./v-body");

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
  mendel: lazy(genetics, (m) => m.mendel),
  monohybrid: lazy(genetics, (m) => m.monohybrid),
  probability: lazy(genetics, (m) => m.probability),
  dihybrid: lazy(genetics, (m) => m.dihybrid),
  testcross: lazy(genetics, (m) => m.testcross),
  "sex-chromosomes": lazy(genetics, (m) => m.sexChromosomes),
  "sex-linked": lazy(genetics, (m) => m.sexLinked),
  "gene-interaction": lazy(genetics, (m) => m.geneInteraction),
  modification: lazy(genetics, (m) => m.modification),
  biotech: lazy(genetics, (m) => m.biotech),
  "genetic-engineering": lazy(genetics, (m) => m.geneticEngineering),
  cloning: lazy(genetics, (m) => m.cloning),
  "human-genetics": lazy(genetics, (m) => m.humanGenetics),
  "medical-biotech": lazy(genetics, (m) => m.medicalBiotech),
  "bacterial-transfer": lazy(genetics, (m) => m.bacterialTransfer),
  "bone-chemistry": lazy(bodyV, (m) => m.boneChemistry),
  joints: lazy(bodyV, (m) => m.joints),
  injuries: lazy(bodyV, (m) => m.injuries),
  posture: lazy(bodyV, (m) => m.posture),
  locomotion: lazy(bodyV, (m) => m.locomotion),
  "breathing-control": lazy(bodyV, (m) => m.breathingControl),
  "respiratory-disease": lazy(bodyV, (m) => m.respiratoryDisease),
  nutrients: lazy(bodyV, (m) => m.nutrients),
  "food-energy": lazy(bodyV, (m) => m.foodEnergy),
  "gut-disease": lazy(bodyV, (m) => m.gutDisease),
  "healthy-plate": lazy(bodyV, (m) => m.healthyPlate),
  "metabolism-exchange": lazy(bodyV, (m) => m.metabolismExchange),
  nephron: lazy(bodyV, (m) => m.nephron),
  skin: lazy(bodyV, (m) => m.skinSection),
  "animal-excretion": lazy(bodyV, (m) => m.animalExcretion),
};
