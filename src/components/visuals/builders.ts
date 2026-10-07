import type { Builder } from "@/components/journeys/JourneyScene";
import { loadNatureAssets } from "./nature-assets";

/** Lesson animations by id; each topic's file is downloaded only when one of its lessons is opened. */
const lazy =
  <M>(load: () => Promise<M>, pick: (m: M) => Builder): Builder =>
  async (k) =>
    pick(await load())(k);

/** For outdoor/nature lessons: also fetch the scanned trees, rocks, plants and animals first. */
const lazyN =
  <M>(load: () => Promise<M>, pick: (m: M) => Builder): Builder =>
  async (k) => {
    const [m] = await Promise.all([load(), loadNatureAssets().catch(() => null)]);
    return pick(m)(k);
  };

const hormones = () => import("./v-hormones");
const health = () => import("./v-health");
const evolution = () => import("./v-evolution");
const ecology = () => import("./v-ecology");
const genetics = () => import("./v-genetics");
const bodyV = () => import("./v-body");
const nerves = () => import("./v-nerves");
const chem = () => import("./v-chem");
const growth = () => import("./v-growth");

export const VISUAL_BUILDERS: Record<string, Builder> = {
  "endocrine-system": lazy(hormones, (m) => m.endocrineSystem),
  pituitary: lazy(hormones, (m) => m.pituitary),
  thyroid: lazy(hormones, (m) => m.thyroidGland),
  glucose: lazy(hormones, (m) => m.glucose),
  smoking: lazy(health, (m) => m.smoking),
  alcohol: lazy(health, (m) => m.alcohol),
  drugs: lazy(health, (m) => m.drugs),
  exercise: lazy(health, (m) => m.exercise),
  "tree-of-life": lazyN(evolution, (m) => m.treeOfLife),
  giraffes: lazyN(evolution, (m) => m.giraffes),
  microevolution: lazyN(evolution, (m) => m.microevolution),
  struggle: lazyN(evolution, (m) => m.struggle),
  "peppered-moth": lazyN(evolution, (m) => m.pepperedMoth),
  adaptations: lazyN(evolution, (m) => m.adaptations),
  antibiotic: lazyN(evolution, (m) => m.antibiotic),
  speciation: lazyN(evolution, (m) => m.speciation),
  evidence: lazyN(evolution, (m) => m.evidence),
  paleontology: lazyN(evolution, (m) => m.paleontology),
  ecosystem: lazyN(ecology, (m) => m.ecosystem),
  "eco-factors": lazyN(ecology, (m) => m.ecoFactors),
  "predator-prey": lazyN(ecology, (m) => m.predatorPrey),
  "food-chain": lazyN(ecology, (m) => m.foodChain),
  pyramid: lazyN(ecology, (m) => m.pyramid),
  cycles: lazyN(ecology, (m) => m.cycles),
  biodiversity: lazyN(ecology, (m) => m.biodiversity),
  "georgia-bio": lazyN(ecology, (m) => m.georgiaBio),
  conservation: lazyN(ecology, (m) => m.conservation),
  "water-pollution": lazyN(ecology, (m) => m.waterPollution),
  "air-pollution": lazyN(ecology, (m) => m.airPollution),
  greenhouse: lazyN(ecology, (m) => m.greenhouse),
  mendel: lazyN(genetics, (m) => m.mendel),
  monohybrid: lazyN(genetics, (m) => m.monohybrid),
  probability: lazyN(genetics, (m) => m.probability),
  dihybrid: lazyN(genetics, (m) => m.dihybrid),
  testcross: lazyN(genetics, (m) => m.testcross),
  "sex-chromosomes": lazyN(genetics, (m) => m.sexChromosomes),
  "sex-linked": lazyN(genetics, (m) => m.sexLinked),
  "gene-interaction": lazyN(genetics, (m) => m.geneInteraction),
  modification: lazyN(genetics, (m) => m.modification),
  biotech: lazyN(genetics, (m) => m.biotech),
  "genetic-engineering": lazyN(genetics, (m) => m.geneticEngineering),
  cloning: lazyN(genetics, (m) => m.cloning),
  "human-genetics": lazyN(genetics, (m) => m.humanGenetics),
  "medical-biotech": lazyN(genetics, (m) => m.medicalBiotech),
  "bacterial-transfer": lazyN(genetics, (m) => m.bacterialTransfer),
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
  "neuron-types": lazyN(nerves, (m) => m.neuronTypes),
  "impulse-myelin": lazyN(nerves, (m) => m.impulseMyelin),
  "reflex-hand": lazyN(nerves, (m) => m.reflexHand),
  peripheral: lazyN(nerves, (m) => m.peripheral),
  pavlov: lazyN(nerves, (m) => m.pavlov),
  "nerve-evolution": lazyN(nerves, (m) => m.nerveEvolution),
  analyzers: lazyN(nerves, (m) => m.analyzers),
  "vision-defects": lazyN(nerves, (m) => m.visionDefects),
  "eye-care": lazyN(nerves, (m) => m.eyeCare),
  ear: lazyN(nerves, (m) => m.ear),
  "hearing-loss": lazyN(nerves, (m) => m.hearingLoss),
  water: lazyN(chem, (m) => m.waterVisual),
  minerals: lazyN(chem, (m) => m.minerals),
  buffer: lazyN(chem, (m) => m.buffer),
  "protein-structure": lazyN(chem, (m) => m.proteinStructure),
  "protein-functions": lazyN(chem, (m) => m.proteinFunctions),
  carbohydrates: lazyN(chem, (m) => m.carbohydrates),
  atp: lazyN(chem, (m) => m.atpVisual),
  "animal-tissues": lazyN(chem, (m) => m.animalTissues),
  "plant-tissues": lazyN(chem, (m) => m.plantTissues),
  "stem-and-blood": lazyN(chem, (m) => m.stemAndBlood),
  levels: lazyN(chem, (m) => m.levels),
  symmetry: lazyN(chem, (m) => m.symmetry),
  "toxins-cell": lazyN(chem, (m) => m.toxinsCell),
  "plant-minerals": lazyN(growth, (m) => m.plantMinerals),
  "plant-transport": lazyN(growth, (m) => m.plantTransport),
  flower: lazyN(growth, (m) => m.flowerVisual),
  phototropism: lazyN(growth, (m) => m.phototropism),
  "plant-hormones": lazyN(growth, (m) => m.plantHormones),
  gametogenesis: lazyN(growth, (m) => m.gametogenesis),
  embryo: lazyN(growth, (m) => m.embryo),
  puberty: lazyN(growth, (m) => m.puberty),
  "repro-system": lazyN(growth, (m) => m.reproSystem),
  cycle: lazyN(growth, (m) => m.cycle),
  fetus: lazyN(growth, (m) => m.fetus),
  "fetal-factors": lazyN(growth, (m) => m.fetalFactors),
  sti: lazyN(growth, (m) => m.sti),
  "brain-maturity": lazyN(growth, (m) => m.brainMaturity),
};
