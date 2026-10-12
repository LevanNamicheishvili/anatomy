import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/* Shared semantic controls use the light/dark science palette in globals.css. */

const button =
  "inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm leading-6 font-semibold whitespace-normal text-center transition-[background-color,border-color,color,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
export const btn = {
  primary: cn(button, "bg-brand text-white hover:bg-brand/90"),
  dark: cn(button, "bg-deep text-white hover:bg-deep-hover"),
  secondary: cn(button, "border border-line-strong bg-card text-ink hover:bg-subtle"),
  danger: cn(button, "border border-danger/30 bg-card text-danger hover:bg-danger-soft"),
  ghost: cn(button, "font-medium text-copy hover:bg-chip"),
};

export const input =
  "min-h-12 w-full rounded-xl border border-line-strong bg-card px-3 text-base text-ink outline-none transition-colors placeholder:text-faint hover:border-brand/40 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-subtle disabled:text-mute aria-[invalid=true]:border-danger";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-copy">{label}</span>
      {children}
      {hint && <span className="text-[13px] leading-5 text-mute">{hint}</span>}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-2xl border border-line bg-card shadow-card", className)}>{children}</section>;
}

/**
 * Class string for a card that is a link: one radius, one border, one hover lift and a visible
 * keyboard ring. Put it on a `Link` and lay the content out inside.
 */
export const cardLink =
  "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card outline-none transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

/**
 * Class string for the box around a lesson's 3D canvas. Phones: a fixed share of the small viewport
 * (svh, so the canvas doesn't resize as the browser bars slide) that fits under the sticky top bar
 * with the caption peeking below; wider screens: 16:10, never taller than the window, so a landscape
 * phone doesn't get a scene taller than what's left under the bar.
 */
export const sceneFrame = "h-[60svh] min-h-72 w-full sm:h-auto sm:min-h-0 sm:aspect-[16/10] sm:max-h-[72svh]";

/*
 * Explorer pages (sections on the left, the 3D view in the middle, the text on the right).
 * From `lg` the columns fill the window and each scrolls on its own. Below it the page scrolls as one
 * column: the sections strip, the 3D view at ~58% of the small viewport (never under 18rem), then the
 * text — instead of squeezing both the scene and the text into one screen.
 * Add the `lg:grid-cols-[…]` of the page to `explorerGrid`.
 */
export const explorerPage = "flex min-h-dvh flex-col bg-page font-sans text-ink lg:h-dvh";
export const explorerGrid = "grid flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(18rem,58svh)_auto] lg:min-h-0 lg:grid-rows-1";
export const explorerText = "atlas-scroll border-s border-line bg-card px-6 py-6 max-lg:border-s-0 max-lg:border-t lg:min-h-0 lg:overflow-y-auto";

/** Small rounded label: grade, count, status. */
export function Chip({ tone = "neutral", className, children }: { tone?: "neutral" | "accent" | "dark"; className?: string; children: React.ReactNode }) {
  const tones = { neutral: "bg-chip text-copy", accent: "bg-brand-soft text-brand-strong", dark: "bg-deep text-white" };
  return <span className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs leading-5 font-semibold whitespace-normal", tones[tone], className)}>{children}</span>;
}

/** Small kicker above a title: "გეოგრაფია · თემა 3". */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm font-semibold text-mute", className)}>{children}</p>;
}

/** Section title used between blocks on hubs and dashboards. */
export function SectionTitle({ children, hint, className }: { children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-baseline justify-between gap-3", className)}>
      <h2 className="min-w-0 text-xl text-ink">{children}</h2>
      {hint && <span className="text-sm text-mute">{hint}</span>}
    </div>
  );
}

/** Path above a page title: "საგნები › ბიოლოგია". The last item is the current page. */
export function Breadcrumbs({ items, className }: { items: { label: string; href?: string }[]; className?: string }) {
  return (
    <nav aria-label="გზა" className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-mute", className)}>
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="size-4 shrink-0 text-line-strong" aria-hidden />}
          {item.href ? (
            <Link href={item.href} className="rounded py-1 hover:text-ink">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-semibold text-ink">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function CardHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-mute">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "warning" | "danger"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-chip text-copy",
    accent: "bg-brand-soft text-brand-strong",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "success" | "info"; children: React.ReactNode }) {
  const tones = {
    danger: "border-danger/30 bg-danger-soft text-danger",
    success: "border-brand/30 bg-brand-soft text-brand-strong",
    info: "border-line-strong bg-subtle text-copy",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg border px-3.5 py-3 text-sm leading-6", tones[tone])}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl text-ink [overflow-wrap:anywhere] sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-base leading-7 text-copy">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** The portal's mark: an open book on ink. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl bg-deep text-white shadow-card", className)}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 7v14" />
        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      </svg>
    </span>
  );
}

export const PORTAL_NAME = "სასწავლო პორტალი";
