"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

/* Atlas controls share the portal palette, with compact panel spacing. */

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
export const floating = "rounded-2xl border border-line bg-card shadow-panel";

export const sectionLabel = "text-xs font-semibold text-mute";

const btnBase =
  "inline-flex min-h-10 max-w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm leading-6 font-medium whitespace-normal transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:pointer-events-none disabled:opacity-40 max-md:min-h-11";

export const btnPrimary = cn(btnBase, "bg-brand text-white hover:bg-brand/90");
export const btnSecondary = cn(btnBase, "border border-line-strong bg-card text-copy hover:bg-subtle");
export const btnGhost = cn(btnBase, "text-copy hover:bg-chip");
export const iconBtn =
  "inline-flex size-10 shrink-0 items-center justify-center rounded-lg text-copy transition-colors outline-none hover:bg-chip focus-visible:ring-2 focus-visible:ring-brand/50 max-md:size-11";

/** The look of a switch on its own; the control is the row around it (see `SwitchRow`). */
export function SwitchTrack({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-150",
        checked ? "bg-brand" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "block size-5 rounded-full bg-card shadow-[0_1px_2px_rgba(17,26,24,0.25)] transition-transform duration-150",
          checked ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0",
        )}
      />
    </span>
  );
}

/**
 * A whole row that is one switch: a leading icon or colour dot, the name, an optional count and the
 * switch. The full row is the touch target, so it works with a finger on a smart board.
 */
export function SwitchRow({
  checked,
  onChange,
  label,
  lead,
  meta,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  lead?: React.ReactNode;
  meta?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 px-3 text-start transition-colors outline-none hover:bg-subtle focus-visible:bg-subtle focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-inset",
        className,
      )}
    >
      {lead}
      <span className={cn("min-w-0 flex-1 py-2 text-sm leading-6 [overflow-wrap:anywhere]", checked ? "font-medium text-ink" : "text-copy")}>{label}</span>
      {meta && <span className="shrink-0 text-xs text-faint tabular-nums">{meta}</span>}
      <SwitchTrack checked={checked} />
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
      <div ref={trackRef} className="relative h-1 w-full rounded-full bg-line">
        <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
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
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-brand bg-card outline-none after:absolute after:-inset-3 after:content-[''] focus-visible:ring-4 focus-visible:ring-brand/25 active:cursor-grabbing"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
