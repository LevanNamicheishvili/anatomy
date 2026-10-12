"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * One control style for everything around a 3D canvas: floating panels, segmented tabs, pill buttons,
 * labelled sliders and legends. All touch targets are at least 40px (smart boards and phones),
 * nothing relies on hover, and every control has a visible focus ring.
 * `color` is the subject's accent (biology #0f8a74, geography #2f6fb0, history #a0662b).
 */

const DEFAULT_COLOR = "#0f8a74";

/** Floating card over (or beside) a scene: light, slightly translucent, never wider than needed. */
export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-xl border border-line/80 bg-white/90 p-3 shadow-panel backdrop-blur-sm", className)} {...rest}>
      {children}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: LucideIcon;
  /** Smaller second line under the label, e.g. "VII–IX კლასი". */
  hint?: string;
}

/** A row of mutually exclusive choices that wraps on narrow screens. */
export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  color = DEFAULT_COLOR,
  label,
  className,
  iconOnlyOnSmall = false,
  equal = false,
}: {
  options: SegmentOption<T>[];
  /** `null` when none of the options matches the current state. */
  value: T | null;
  onChange: (id: T) => void;
  color?: string;
  /** Accessible name of the group. */
  label: string;
  className?: string;
  /** Hide the text below `sm`, keeping icons (only for options that have one). */
  iconOnlyOnSmall?: boolean;
  /** One row of equal columns whose labels may wrap, for narrow side panels. */
  equal?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className={cn("gap-1 rounded-xl bg-chip p-1", equal ? "grid auto-cols-[minmax(0,1fr)] grid-flow-col" : "flex flex-wrap", className)}>
      {options.map((o) => {
        const on = o.id === value;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.id)}
            className={cn(
              "inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors",
              // Equal columns: icon above the label and tighter type, so long Georgian words fit a 280px panel.
              equal ? "min-w-0 flex-col gap-0.5 px-1 py-1.5 text-center text-[13px] leading-5 [overflow-wrap:anywhere]" : "px-3 whitespace-nowrap",
              on ? "text-white shadow-sm" : "text-copy hover:bg-white/80",
            )}
            style={on ? { backgroundColor: color } : undefined}
          >
            {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
            {o.hint ? (
              <span className="flex flex-col items-center">
                {o.label}
                <span className={cn("text-[11px] leading-4 font-medium", on ? "text-white/85" : "text-mute")}>{o.hint}</span>
              </span>
            ) : (
              <span className={cn(iconOnlyOnSmall && Icon && "max-sm:sr-only")}>{o.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A single pill button: toggle (`pressed` given) or plain action. */
export function PillButton({
  children,
  icon: Icon,
  pressed,
  onClick,
  color = DEFAULT_COLOR,
  disabled,
  className,
  title,
  ...rest
}: {
  children?: React.ReactNode;
  icon?: LucideIcon;
  pressed?: boolean;
  onClick?: () => void;
  color?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
} & Pick<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label" | "aria-expanded">) {
  const toggle = pressed !== undefined;
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      aria-pressed={toggle ? pressed : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-45",
        pressed ? "border-transparent text-white shadow-sm" : "border-line-strong bg-white/95 text-ink hover:bg-subtle",
        !children && "w-10 px-0",
        className,
      )}
      style={pressed ? { backgroundColor: color } : undefined}
      {...rest}
    >
      {Icon && <Icon className="size-4 shrink-0" aria-hidden />}
      {children}
    </button>
  );
}

/** Range input with its label and a live value read-out above it. */
export function LabeledSlider({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
  color = DEFAULT_COLOR,
  disabled,
  className,
}: {
  label: string;
  value: number;
  /** What to show as the value (with units); defaults to the number. */
  display?: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  color?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("block", disabled && "opacity-50", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <label htmlFor={id} className="font-semibold text-ink">
          {label}
        </label>
        <output htmlFor={id} className="tabular-nums text-copy">
          {display ?? value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 block h-8 w-full cursor-pointer"
        style={{ accentColor: color }}
      />
    </div>
  );
}

/** Colour key: a dot or bar per item with its name. */
export function Legend({
  items,
  className,
  swatch = "dot",
}: {
  items: { color: string; label: string }[];
  className?: string;
  swatch?: "dot" | "bar";
}) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-copy", className)}>
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <span className={cn("shrink-0", swatch === "dot" ? "size-2.5 rounded-full" : "h-1.5 w-4 rounded-full")} style={{ backgroundColor: it.color }} aria-hidden />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
