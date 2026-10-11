"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CurrentsGlobe } from "./CurrentsGlobe";
import { EchoSounder } from "./EchoSounder";
import { Tides } from "./Tides";

/*
 * Topic 10 — rivers and oceans: three tools in one card — currents on the globe, the ocean floor with an
 * echo sounder, and the tides.
 */

const TABS = [
  { id: "currents", name: "დინებები" },
  { id: "floor", name: "ფსკერი და ექოლოტი" },
  { id: "tides", name: "მიქცევა-მოქცევა" },
] as const;
type Tab = (typeof TABS)[number]["id"];

export function Oceans() {
  const [tab, setTab] = useState<Tab>("currents");
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-line-strong bg-white shadow-card">
      <div className="flex flex-wrap gap-1.5 border-b border-[#e2e7e5] bg-[#f5f7f6] px-3 py-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={cn("h-9 rounded-lg px-3 text-sm font-semibold", tab === t.id ? "bg-[#1f5f99] text-white" : "text-[#33413e] hover:bg-[#e6ecea]")}>
            {t.name}
          </button>
        ))}
      </div>
      {tab === "currents" && <CurrentsGlobe />}
      {tab === "floor" && <EchoSounder />}
      {tab === "tides" && <Tides />}
      <p className="px-5 pb-3 text-[11px] leading-4 text-[#97a29e]">დინებები და ფსკერის პროფილი გამარტივებულია; მიქცევა-მოქცევის სიმაღლე — ღია ოკეანის სანაპიროს ტიპური მნიშვნელობა. დედამიწის სურათი: NASA Blue Marble.</p>
    </section>
  );
}
