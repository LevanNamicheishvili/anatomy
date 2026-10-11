import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Portal design tokens (same palette as the atlas) live in globals.css as Tailwind theme colors:
 * ink · copy (#33413e) · mute (#66736f) · faint (#97a29e) · line · line-strong · page · subtle · chip · brand · danger.
 * The class strings below are the shared building blocks: buttons, inputs, cards, chips, headings.
 */

const button =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#0f8a74]/50 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
export const btn = {
  primary: cn(button, "bg-[#0f8a74] text-white hover:bg-[#0c7563]"),
  dark: cn(button, "bg-[#111a18] text-white hover:bg-[#2a3532]"),
  secondary: cn(button, "border border-[#d5dcd9] bg-white text-[#111a18] hover:bg-[#f5f7f6]"),
  danger: cn(button, "border border-[#f1c7c3] bg-white text-[#b42318] hover:bg-[#fdf3f2]"),
  ghost: cn(button, "font-medium text-[#33413e] hover:bg-[#eef2f0]"),
};

export const input =
  "h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-base text-ink outline-none transition-colors placeholder:text-faint hover:border-faint focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:bg-subtle disabled:text-mute aria-[invalid=true]:border-danger";

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
  return <section className={cn("rounded-xl border border-line bg-white shadow-card", className)}>{children}</section>;
}

/**
 * Class string for a card that is a link: one radius, one border, one hover lift and a visible
 * keyboard ring. Put it on a `Link` and lay the content out inside.
 */
export const cardLink =
  "group relative flex flex-col overflow-hidden rounded-xl border border-line-strong bg-white shadow-card outline-none transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-faint hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

/** Small rounded label: grade, count, status. */
export function Chip({ tone = "neutral", className, children }: { tone?: "neutral" | "accent" | "dark"; className?: string; children: React.ReactNode }) {
  const tones = { neutral: "bg-chip text-copy", accent: "bg-brand-soft text-brand-strong", dark: "bg-ink text-white" };
  return <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>{children}</span>;
}

/** Small kicker above a title: "გეოგრაფია · თემა 3". */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-sm font-semibold text-mute", className)}>{children}</p>;
}

/** Section title used between blocks on hubs and dashboards. */
export function SectionTitle({ children, hint, className }: { children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="text-lg text-ink">{children}</h2>
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
          {i > 0 && <ChevronRight className="size-4 shrink-0 text-[#c3ccc9]" aria-hidden />}
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
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e2e7e5] px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-[#111a18]">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-[#66736f]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "warning" | "danger"; children: React.ReactNode }) {
  const tones = {
    neutral: "bg-[#eef2f0] text-[#33413e]",
    accent: "bg-[#e6f3ef] text-[#0c7563]",
    warning: "bg-[#fdf6e3] text-[#8a6100]",
    danger: "bg-[#fdf3f2] text-[#b42318]",
  };
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function Alert({ tone = "danger", children }: { tone?: "danger" | "success" | "info"; children: React.ReactNode }) {
  const tones = {
    danger: "border-[#f1c7c3] bg-[#fdf3f2] text-[#912018]",
    success: "border-[#b9e2d5] bg-[#e6f3ef] text-[#0c5c4d]",
    info: "border-[#d5dcd9] bg-[#f5f7f6] text-[#33413e]",
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
        <h1 className="text-2xl text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-base leading-7 text-copy">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** The portal's mark: an open book on ink. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-md bg-[#111a18] text-white", className)}>
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 7v14" />
        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
      </svg>
    </span>
  );
}

export const PORTAL_NAME = "სასწავლო პორტალი";
