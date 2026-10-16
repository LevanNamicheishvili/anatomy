import { useSyncExternalStore } from "react";
import type { LabelKind } from "./mapLabels";

/*
 * How much the political map on the globes shows. By default only the countries: their borders and names. The
 * teacher can turn on the details — capitals and cities, oceans, seas, continents, lakes — with one button; every
 * globe follows (the choice lasts until the page is loaded again).
 */

/** The names shown when the details are off. */
export const COUNTRY_LABELS: ReadonlySet<LabelKind> = new Set(["country"]);

let detail = false;
const listeners = new Set<(on: boolean) => void>();

export const mapDetail = () => detail;

export function setMapDetail(on: boolean) {
  detail = on;
  for (const l of listeners) l(on);
}

export function onMapDetail(listener: (on: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useMapDetail = () => useSyncExternalStore(onMapDetail, mapDetail, () => false);
