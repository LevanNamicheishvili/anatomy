"use client";

import dynamic from "next/dynamic";
import type { GeoVisualKind } from "@/lib/geography-lessons";

/** The interactive 3D part of a geography lesson; each one's code (and three.js) loads only on its page. */

function Loading() {
  return (
    <div className="mt-6 flex h-[56dvh] min-h-80 w-full animate-pulse items-center justify-center rounded-2xl border border-line-strong bg-chip sm:h-auto sm:aspect-[16/10] sm:max-h-[72dvh]" role="status" aria-label="იტვირთება">
      <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-copy shadow-sm">იტვირთება…</span>
    </div>
  );
}

const GraticuleGlobe = dynamic(() => import("./GraticuleGlobe").then((m) => m.GraticuleGlobe), { ssr: false, loading: Loading });
const GeorgiaLandforms = dynamic(() => import("./GeorgiaLandforms").then((m) => m.GeorgiaLandforms), { ssr: false, loading: Loading });
const SolarPlant = dynamic(() => import("../solar/SolarPlant").then((m) => m.SolarPlant), { ssr: false, loading: Loading });
const SeasonsGlobe = dynamic(() => import("../seasons/SeasonsGlobe").then((m) => m.SeasonsGlobe), { ssr: false, loading: Loading });
const PolarisSky = dynamic(() => import("../polaris/PolarisSky").then((m) => m.PolarisSky), { ssr: false, loading: Loading });
const SeaBreeze = dynamic(() => import("../atmosphere/SeaBreeze").then((m) => m.SeaBreeze), { ssr: false, loading: Loading });
const EarthCutaway = dynamic(() => import("../earth/EarthCutaway").then((m) => m.EarthCutaway), { ssr: false, loading: Loading });
const VoyagesGlobe = dynamic(() => import("../discoveries/VoyagesGlobe").then((m) => m.VoyagesGlobe), { ssr: false, loading: Loading });
const Volcanoes = dynamic(() => import("../volcano/Volcanoes").then((m) => m.Volcanoes), { ssr: false, loading: Loading });
const GeorgiaHazards = dynamic(() => import("../hazards/GeorgiaHazards").then((m) => m.GeorgiaHazards), { ssr: false, loading: Loading });
const Oceans = dynamic(() => import("../oceans/Oceans").then((m) => m.Oceans), { ssr: false, loading: Loading });

export function GeoVisual({ kind }: { kind: GeoVisualKind }) {
  if (kind === "graticule") return <GraticuleGlobe />;
  if (kind === "georgia-landforms") return <GeorgiaLandforms />;
  if (kind === "seasons") return <SeasonsGlobe />;
  if (kind === "polaris") return <PolarisSky />;
  if (kind === "atmosphere") return <SeaBreeze />;
  if (kind === "earth-structure") return <EarthCutaway />;
  if (kind === "discoveries") return <VoyagesGlobe />;
  if (kind === "volcanoes") return <Volcanoes />;
  if (kind === "hazards") return <GeorgiaHazards />;
  if (kind === "oceans") return <Oceans />;
  return <SolarPlant />;
}
