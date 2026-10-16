"use client";

import { useState } from "react";
import { useNarrationDirector } from "@/components/portal/NarrationScene";
import { sceneFrame } from "@/components/portal/ui";
import { cn } from "@/lib/utils";
import { CurrentsGlobe } from "./CurrentsGlobe";
import { EchoSounder } from "./EchoSounder";
import { OCEANS_CUES, type OceansShot } from "./oceans-cues";
import { RiverPanel } from "./RiverPanel";
import { Tides } from "./Tides";

/*
 * Topic 10 — rivers and oceans: three tools in one card — currents on the globe, the ocean floor with an
 * echo sounder, and the tides. While the lesson is read aloud the voice picks the tool and sets it (and shows
 * Georgia's rivers for the part on rivers); the tool shown is then the lesson's scene, with the subtitles on it.
 */

/** Room under a flat picture for the subtitles while the voice speaks. */
const SPOKEN = "relative pb-28";

const TABS = [
  { id: "currents", name: "დინებები" },
  { id: "floor", name: "ფსკერი და ექოლოტი" },
  { id: "tides", name: "მიქცევა-მოქცევა" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function Oceans() {
  const [chosen, setTab] = useState<Tab>("currents");
  const [shot, setShot] = useState<Partial<OceansShot> | null>(null);
  const driving = useNarrationDirector(OCEANS_CUES, (s: Partial<OceansShot>) => setShot(s));
  const narr = driving ? shot : null;
  const tab = narr?.tab ?? chosen;
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-card">
      <div className="flex flex-wrap gap-1.5 border-b border-line bg-subtle px-3 py-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("h-9 rounded-lg px-3 text-sm font-semibold", tab === t.id ? "bg-[#1f5f99] text-white" : "text-copy hover:bg-[#e6ecea]")}>
            {t.name}
          </button>
        ))}
      </div>
      {tab === "currents" && <CurrentsGlobe narr={narr ? { show: narr.show ?? "all", lit: narr.lit ?? [], focus: narr.focus ?? [20, -30, 3.4] } : null} />}
      {tab === "river" && narr && (
        <div className={cn("relative bg-[#0d1726]", sceneFrame)} data-scene>
          <div className="absolute inset-x-0 top-0 bottom-24">
            <RiverPanel mode={narr.river ?? "map"} />
          </div>
        </div>
      )}
      {tab === "floor" && <EchoSounder narr={narr ? { km: narr.km ?? 700, ping: narr.ping ?? 0 } : null} scene={narr ? SPOKEN : undefined} />}
      {tab === "tides" && <Tides narr={narr ? { day: narr.day ?? 0, playing: !!narr.turning } : null} scene={narr ? SPOKEN : undefined} />}
      <p className="px-5 pb-3 text-[11px] leading-4 text-faint">დინებები და ფსკერის პროფილი გამარტივებულია; მიქცევა-მოქცევის სიმაღლე — ღია ოკეანის სანაპიროს ტიპური მნიშვნელობა. დედამიწის სურათი: NASA Blue Marble; საზღვრები და სახელები: Natural Earth, Wikidata.</p>
    </section>
  );
}
