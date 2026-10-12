"use client";

import { useId, useRef } from "react";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * One control style for everything around a 3D canvas: floating panels, segmented tabs, pill buttons,
 * labelled sliders and legends. All touch targets are at least 40px (smart boards and phones),
 * nothing relies on hover, and every control has a visible focus ring.
 * `color` is the subject's accent (biology #0f8a74, geography #2f6fb0, history #a0662b).
 */

const DEFAULT_COLOR = "var(--color-brand)";

/** Floating card over (or beside) a scene: light, slightly translucent, never wider than needed. */
export function Panel({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-line bg-card/95 p-4 shadow-panel backdrop-blur-sm", className)} {...rest}>
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
              equal ? "min-w-0 flex-col gap-0.5 px-1 py-1.5 text-center text-[13px] leading-5 [overflow-wrap:anywhere]" : "min-w-0 px-3 py-2 whitespace-normal [overflow-wrap:anywhere]",
              on ? "text-white shadow-sm" : "text-copy hover:bg-card/80",
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
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm leading-6 font-semibold whitespace-normal transition-colors disabled:pointer-events-none disabled:opacity-45",
        pressed ? "border-transparent text-white shadow-sm" : "border-line-strong bg-card/95 text-ink hover:bg-subtle",
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
      {/* Long labels wrap; the value keeps one line up to 60% of the row, past that it wraps at its spaces. */}
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <label htmlFor={id} className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">
          {label}
        </label>
        <output htmlFor={id} className="max-w-[60%] shrink-0 text-end tabular-nums text-copy">
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
        <li key={it.label} className="flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]">
          <span className={cn("shrink-0", swatch === "dot" ? "size-2.5 rounded-full" : "h-1.5 w-4 rounded-full")} style={{ backgroundColor: it.color }} aria-hidden />
          {it.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Below `lg` the explorer pages scroll as one column with the 3D view on top. After a choice made
 * further down (next section, a stage in the list), scroll back up so the change is actually seen.
 */
export function revealScene() {
  if (window.matchMedia("(max-width: 63.99rem)").matches) window.scrollTo({ top: 0 });
}

/** Previous / next section at the end of an explorer's text column. */
export function SectionPager({ index, count, onGo }: { index: number; count: number; onGo: (i: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const go = (i: number) => {
    onGo(i);
    revealScene();
    // On desktop the text column scrolls on its own: start the new section at its top, not where the pager was.
    requestAnimationFrame(() => {
      for (let el = ref.current?.parentElement; el; el = el.parentElement) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight) {
          el.scrollTo({ top: 0 });
          return;
        }
      }
    });
  };
  return (
    <div ref={ref} className="mt-8 grid grid-cols-2 gap-2">
      <button
        type="button"
        disabled={index === 0}
        onClick={() => go(index - 1)}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-card text-sm font-semibold transition-colors hover:bg-subtle disabled:opacity-40"
      >
        <ChevronLeft className="size-4" aria-hidden />
        წინა
      </button>
      <button
        type="button"
        disabled={index === count - 1}
        onClick={() => go(index + 1)}
        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-deep text-sm font-semibold text-white transition-colors hover:bg-deep-hover disabled:opacity-40"
      >
        შემდეგი
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}
