"use client";

import { Layers, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Strings } from "./i18n";
import { Slider, btnSecondary, iconBtn } from "./primitives";

/** Bottom bar docked under the 3D view, spanning exactly from the sidebar to the rail (or open sheet). */
export function BottomDock({
  t,
  explode,
  onExplode,
  onReset,
  onLayers,
  layersOpen,
  sheetOpen,
}: {
  t: Strings;
  explode: number;
  onExplode: (v: number) => void;
  onReset: () => void;
  onLayers: () => void;
  layersOpen: boolean;
  sheetOpen: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute start-[320px] bottom-0 z-20 flex h-16 items-center gap-4 border-t border-[#e2e7e5] bg-white px-4 max-[1100px]:start-[288px]",
        sheetOpen ? "end-[456px] max-[1100px]:end-[396px]" : "end-14",
        "max-md:inset-x-0 max-md:gap-2 max-md:px-2",
      )}
    >
      <button
        type="button"
        onClick={onLayers}
        aria-expanded={layersOpen}
        aria-label={t.systems}
        className={cn(iconBtn, "hidden max-md:inline-flex", layersOpen && "bg-[#e6f3ef] text-[#0f8a74]")}
      >
        <Layers className="size-5" strokeWidth={2} />
      </button>

      <label htmlFor="explode-slider" className="shrink-0 text-[13px] font-medium text-[#111a18] max-md:hidden">
        {t.explode}
      </label>
      <span className="shrink-0 text-xs text-[#97a29e] max-lg:hidden">{t.assembled}</span>
      <div className="min-w-0 flex-1">
        <Slider id="explode-slider" value={explode} onChange={onExplode} label={t.explode} />
      </div>
      <span className="shrink-0 text-xs text-[#97a29e] max-lg:hidden">{t.everyPiece}</span>
      <output htmlFor="explode-slider" className="w-10 shrink-0 text-end text-[13px] font-medium text-[#111a18] tabular-nums">
        {explode}%
      </output>

      <span className="h-6 w-px shrink-0 bg-[#e2e7e5]" />
      <button type="button" onClick={onReset} className={cn(btnSecondary, "max-md:w-11 max-md:px-0")} aria-label={t.reset}>
        <RotateCcw className="size-4" strokeWidth={2} />
        <span className="max-md:hidden">{t.reset}</span>
      </button>
    </div>
  );
}
