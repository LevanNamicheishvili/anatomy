"use client";

import dynamic from "next/dynamic";
import type { GeoVisualKind } from "@/lib/geography-lessons";

/** The interactive 3D part of a geography lesson; each one's code (and three.js) loads only on its page. */

function Loading() {
  return (
    <div className="mt-6 flex aspect-[16/10] max-h-[70vh] min-h-80 w-full items-center justify-center rounded-xl border border-[#d5dcd9] bg-[#eef2f0]">
      <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#33413e] shadow-sm">იტვირთება…</span>
    </div>
  );
}

const GraticuleGlobe = dynamic(() => import("./GraticuleGlobe").then((m) => m.GraticuleGlobe), { ssr: false, loading: Loading });
const GeorgiaLandforms = dynamic(() => import("./GeorgiaLandforms").then((m) => m.GeorgiaLandforms), { ssr: false, loading: Loading });
const SolarPlant = dynamic(() => import("../solar/SolarPlant").then((m) => m.SolarPlant), { ssr: false, loading: Loading });
const SeasonsGlobe = dynamic(() => import("../seasons/SeasonsGlobe").then((m) => m.SeasonsGlobe), { ssr: false, loading: Loading });
const PolarisSky = dynamic(() => import("../polaris/PolarisSky").then((m) => m.PolarisSky), { ssr: false, loading: Loading });
const SeaBreeze = dynamic(() => import("../atmosphere/SeaBreeze").then((m) => m.SeaBreeze), { ssr: false, loading: Loading });

export function GeoVisual({ kind }: { kind: GeoVisualKind }) {
  if (kind === "graticule") return <GraticuleGlobe />;
  if (kind === "georgia-landforms") return <GeorgiaLandforms />;
  if (kind === "seasons") return <SeasonsGlobe />;
  if (kind === "polaris") return <PolarisSky />;
  if (kind === "atmosphere") return <SeaBreeze />;
  return <SolarPlant />;
}
