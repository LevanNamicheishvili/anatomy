"use client";

import { Minus, Plus, RotateCcw, RotateCw, Tags } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewName } from "./anatomy-viewer";
import type { Strings } from "./i18n";
import { iconBtn } from "./primitives";

const VIEWS: { key: ViewName; glyph: string }[] = [
  { key: "threeQuarter", glyph: "¾" },
  { key: "front", glyph: "წ" },
  { key: "side", glyph: "გ" },
  { key: "back", glyph: "უ" },
];

const divider = "my-1 h-px w-6 bg-[#e2e7e5] max-md:mx-1 max-md:my-0 max-md:h-6 max-md:w-px";

/** Right-hand rail docked to the viewport edge (a toolbar under the header on phones). */
export function ViewControls({
  t,
  active,
  onView,
  onRotate,
  onZoom,
  labelsOn,
  onLabels,
}: {
  t: Strings;
  active: ViewName | null;
  onView: (v: ViewName) => void;
  onRotate: (dir: 1 | -1) => void;
  onZoom: (dir: 1 | -1) => void;
  labelsOn: boolean;
  onLabels: () => void;
}) {
  return (
    <nav
      aria-label="კამერა"
      className={cn(
        "absolute end-0 top-14 bottom-0 z-20 flex w-14 flex-col items-center gap-1 border-s border-[#e2e7e5] bg-white py-2",
        "max-md:inset-x-0 max-md:bottom-auto max-md:h-[52px] max-md:w-auto max-md:flex-row max-md:justify-center max-md:border-s-0 max-md:border-b max-md:py-0",
      )}
    >
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          title={t.views[v.key]}
          aria-label={t.views[v.key]}
          aria-pressed={active === v.key}
          onClick={() => onView(v.key)}
          className={cn(
            iconBtn,
            "text-[13px] font-semibold",
            active === v.key && "bg-[#0f8a74] text-white hover:bg-[#0f8a74]",
          )}
        >
          {v.glyph}
        </button>
      ))}
      <span className={divider} />
      <button type="button" title={t.views.rotateLeft} aria-label={t.views.rotateLeft} onClick={() => onRotate(-1)} className={iconBtn}>
        <RotateCcw className="size-[18px]" strokeWidth={2} />
      </button>
      <button type="button" title={t.views.rotateRight} aria-label={t.views.rotateRight} onClick={() => onRotate(1)} className={iconBtn}>
        <RotateCw className="size-[18px]" strokeWidth={2} />
      </button>
      <span className={divider} />
      <button
        type="button"
        title="წარწერები"
        aria-label="წარწერები"
        aria-pressed={labelsOn}
        onClick={onLabels}
        className={cn(iconBtn, labelsOn && "bg-[#0f8a74] text-white hover:bg-[#0f8a74]")}
      >
        <Tags className="size-[18px]" strokeWidth={2} />
      </button>
      <span className={cn(divider, "max-md:hidden")} />
      <button type="button" aria-label="გადიდება" onClick={() => onZoom(1)} className={cn(iconBtn, "max-md:hidden")}>
        <Plus className="size-[18px]" strokeWidth={2} />
      </button>
      <button type="button" aria-label="დაპატარავება" onClick={() => onZoom(-1)} className={cn(iconBtn, "max-md:hidden")}>
        <Minus className="size-[18px]" strokeWidth={2} />
      </button>
    </nav>
  );
}
