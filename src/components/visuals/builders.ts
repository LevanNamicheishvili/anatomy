import type { Builder } from "@/components/journeys/JourneyScene";

/** Lesson animations by id; each topic's file is downloaded only when one of its lessons is opened. */
const lazy =
  <M>(load: () => Promise<M>, pick: (m: M) => Builder): Builder =>
  async (k) =>
    pick(await load())(k);

const hormones = () => import("./v-hormones");
const health = () => import("./v-health");

export const VISUAL_BUILDERS: Record<string, Builder> = {
  "endocrine-system": lazy(hormones, (m) => m.endocrineSystem),
  pituitary: lazy(hormones, (m) => m.pituitary),
  thyroid: lazy(hormones, (m) => m.thyroidGland),
  glucose: lazy(hormones, (m) => m.glucose),
  smoking: lazy(health, (m) => m.smoking),
  alcohol: lazy(health, (m) => m.alcohol),
  drugs: lazy(health, (m) => m.drugs),
  exercise: lazy(health, (m) => m.exercise),
};
