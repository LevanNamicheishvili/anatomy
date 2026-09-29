"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

/*
 * Design tokens (docked, tool-style UI on an 8px grid)
 * ink #111a18 · text #33413e · muted #66736f · faint #97a29e
 * line #e2e7e5 · line-strong #d5dcd9 · subtle #f5f7f6 · hover #eef2f0
 * accent #0f8a74 · accent-hover #0c7563 · accent-subtle #e6f3ef
 */

/** Layout sizes shared by every docked region (keep in sync with HumanAtlasApp insets). */
export const LAYOUT = {
  bar: 56,
  sidebar: 320,
  sidebarCompact: 288,
  rail: 56,
  bottom: 64,
  sheet: 400,
  sheetCompact: 340,
  mobileToolbar: 52,
} as const;

/** Floating surfaces (popovers, menus, the loading card). Docked panels use plain borders instead. */
export const floating = "rounded-lg border border-[#d5dcd9] bg-white shadow-[0_12px_32px_rgba(17,26,24,0.12)]";

export const sectionLabel = "text-xs font-semibold text-[#66736f]";

const btnBase =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0f8a74]/40 disabled:pointer-events-none disabled:opacity-40 max-md:h-11";

export const btnPrimary = cn(btnBase, "bg-[#0f8a74] text-white hover:bg-[#0c7563]");
export const btnSecondary = cn(btnBase, "border border-[#d5dcd9] bg-white text-[#33413e] hover:bg-[#f5f7f6]");
export const btnGhost = cn(btnBase, "text-[#33413e] hover:bg-[#eef2f0]");
export const iconBtn =
  "inline-flex size-9 shrink-0 items-center justify-center rounded-md text-[#33413e] transition-colors outline-none hover:bg-[#eef2f0] focus-visible:ring-2 focus-visible:ring-[#0f8a74]/40 max-md:size-11";

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#0f8a74]/40",
        "after:absolute after:-inset-x-1 after:-inset-y-3 after:content-['']",
        checked ? "bg-[#0f8a74]" : "bg-[#cdd5d2]",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-white shadow-[0_1px_2px_rgba(17,26,24,0.25)] transition-transform duration-150",
          checked ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  );
}

export function Slider({
  value,
  onChange,
  label,
  id,
  min = 0,
  max = 100,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  id?: string;
  min?: number;
  max?: number;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      onChange(Math.round(min + Math.min(1, Math.max(0, ratio)) * (max - min)));
    },
    [onChange, min, max],
  );

  return (
    // px-2 keeps the 16px thumb inside the control at both ends, so its edges line up with neighbours.
    <div
      className="relative flex h-8 w-full touch-none items-center px-2 select-none"
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons) setFromClientX(e.clientX);
      }}
    >
      <div ref={trackRef} className="relative h-1 w-full rounded-full bg-[#dfe5e3]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-[#0f8a74]" style={{ width: `${pct}%` }} />
        <div
          id={id}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          onKeyDown={(e) => {
            const step = e.shiftKey ? 10 : 1;
            if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(max, value + step));
            else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(min, value - step));
            else if (e.key === "Home") onChange(min);
            else if (e.key === "End") onChange(max);
            else return;
            e.preventDefault();
          }}
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-[#0f8a74] bg-white outline-none after:absolute after:-inset-3 after:content-[''] focus-visible:ring-4 focus-visible:ring-[#0f8a74]/25 active:cursor-grabbing"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
