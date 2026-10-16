"use client";

import { Building2, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { setMapDetail, useMapDetail } from "./mapDetail";

/**
 * The map on the globe: borders and country names on or off (GlobeScene.setMapVisible), and under it the details —
 * capitals, cities, oceans, seas, continents, lakes — for the teacher to turn on (the same on every globe).
 */
export function MapButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  const detail = useMapDetail();
  return (
    <>
      <button type="button" onClick={onClick} aria-pressed={on} title="საზღვრები და ქვეყნები" aria-label="საზღვრები და ქვეყნები" className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", on ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
        <MapIcon className="size-5" />
      </button>
      {on && (
        <button
          type="button"
          onClick={() => setMapDetail(!detail)}
          aria-pressed={detail}
          title={detail ? "დეტალები ჩართულია: ქალაქები, ზღვები, ოკეანეები" : "მხოლოდ ქვეყნები — დააჭირე დეტალებისთვის (ქალაქები, ზღვები, ოკეანეები)"}
          aria-label="დეტალები: ქალაქები, ზღვები, ოკეანეები"
          className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", detail ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}
        >
          <Building2 className="size-5" />
        </button>
      )}
    </>
  );
}
