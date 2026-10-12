"use client";

import { Layers, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { PillButton } from "@/components/portal/controls";
import type { Strings } from "./i18n";
import { Slider, btnSecondary } from "./primitives";

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
      {/* Phones: the only way into systems, animations, topics and learning, so it carries a label. */}
      <PillButton
        icon={Layers}
        onClick={onLayers}
        aria-expanded={layersOpen}
        className={cn("min-h-11 px-3.5 md:hidden", layersOpen && "border-[#0f8a74]/40 bg-[#e6f3ef] text-[#0c7563] hover:bg-[#e6f3ef]")}
      >
        {t.systems}
      </PillButton>

      {/* With a sheet open the dock is narrow (down to ~340px on laptops): the end labels go first, then the title, so the slider keeps its room. */}
      <label htmlFor="explode-slider" className={cn("shrink-0 text-[13px] font-medium text-[#111a18] max-md:hidden", sheetOpen && "max-[1100px]:hidden")}>
        {t.explode}
      </label>
      <span className={cn("shrink-0 text-xs text-[#97a29e] max-lg:hidden", sheetOpen && "hidden")}>{t.assembled}</span>
      <div className="min-w-0 flex-1">
        <Slider id="explode-slider" value={explode} onChange={onExplode} label={t.explode} />
      </div>
      <span className={cn("shrink-0 text-xs text-[#97a29e] max-lg:hidden", sheetOpen && "hidden")}>{t.everyPiece}</span>
      <output htmlFor="explode-slider" className="w-10 shrink-0 text-end text-[13px] font-medium text-[#111a18] tabular-nums">
        {explode}%
      </output>

      <span className="h-6 w-px shrink-0 bg-[#e2e7e5]" />
      <button type="button" onClick={onReset} className={cn(btnSecondary, "max-md:w-11 max-md:px-0", sheetOpen && "max-[1100px]:w-10 max-[1100px]:px-0")} aria-label={t.reset} title={t.reset}>
        <RotateCcw className="size-4" strokeWidth={2} />
        <span className={cn("max-md:hidden", sheetOpen && "max-[1100px]:hidden")}>{t.reset}</span>
      </button>
    </div>
  );
}
