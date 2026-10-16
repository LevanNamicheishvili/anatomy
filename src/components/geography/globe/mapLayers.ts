import { useSyncExternalStore } from "react";
import type { LabelKind } from "./mapLabels";

/*
 * What the political map on the globes shows, as the teacher sets it in the map menu: by default only the
 * countries (their borders and names). The continents can be shown in colour with their names, and the details
 * added: oceans and seas, capitals, cities, lakes. Every globe follows the same setting (it lasts until the page is
 * loaded again).
 */

export interface MapLayers {
  borders: boolean;
  countries: boolean;
  continents: boolean;
  oceans: boolean;
  capitals: boolean;
  cities: boolean;
  lakes: boolean;
}

export const MAP_PRESETS = {
  countries: { borders: true, countries: true, continents: false, oceans: false, capitals: false, cities: false, lakes: false },
  continents: { borders: false, countries: false, continents: true, oceans: true, capitals: false, cities: false, lakes: false },
  all: { borders: true, countries: true, continents: true, oceans: true, capitals: true, cities: true, lakes: true },
} satisfies Record<string, MapLayers>;

/** The names each layer shows. */
export function labelKinds(l: MapLayers): Set<LabelKind> {
  const kinds = new Set<LabelKind>();
  if (l.countries) kinds.add("country");
  if (l.continents) kinds.add("continent");
  if (l.oceans) kinds.add("ocean").add("sea");
  if (l.capitals) kinds.add("capital");
  if (l.cities) kinds.add("city");
  if (l.lakes) kinds.add("lake");
  return kinds;
}

let layers: MapLayers = MAP_PRESETS.countries;
const listeners = new Set<(l: MapLayers) => void>();

export const mapLayers = () => layers;

export function setMapLayers(next: MapLayers) {
  layers = next;
  for (const l of listeners) l(next);
}

export function onMapLayers(listener: (l: MapLayers) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const useMapLayers = () => useSyncExternalStore(onMapLayers, mapLayers, () => MAP_PRESETS.countries);
