"use client";

import { Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Borders and place names on the globe: on or off (GlobeScene.setMapVisible). */
export function MapButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} title="საზღვრები და სახელები" aria-label="საზღვრები და სახელები" className={cn("flex size-10 items-center justify-center rounded-lg shadow-sm", on ? "bg-[#2f6fb0] text-white" : "bg-card/90 text-ink")}>
      <MapIcon className="size-5" />
    </button>
  );
}
