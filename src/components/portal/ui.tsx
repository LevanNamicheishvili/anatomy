import { cn } from "@/lib/utils";

/*
 * Portal design tokens (same palette as the atlas):
 * ink #111a18 · text #33413e · muted #66736f · faint #97a29e · line #e2e7e5 · line-strong #d5dcd9
 * surface #ffffff · page #f4f6f5 · subtle #f5f7f6 · accent #0f8a74 · accent-hover #0c7563 · danger #b42318
 */

const button =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#0f8a74]/40 disabled:pointer-events-none disabled:opacity-50";
export const btn = {
  primary: cn(button, "bg-[#0f8a74] text-white hover:bg-[#0c7563]"),
  dark: cn(button, "bg-[#111a18] text-white hover:bg-[#2a3532]"),
  secondary: cn(button, "border border-[#d5dcd9] bg-white text-[#111a18] hover:bg-[#f5f7f6]"),
  danger: cn(button, "border border-[#f1c7c3] bg-white text-[#b42318] hover:bg-[#fdf3f2]"),
  ghost: cn(button, "font-medium text-[#33413e] hover:bg-[#eef2f0]"),
};

export const input =
  "h-11 w-full rounded-md border border-[#d5dcd9] bg-white px-3 text-[15px] text-[#111a18] outline-none transition-colors placeholder:text-[#97a29e] focus:border-[#0f8a74] focus:ring-2 focus:ring-[#0f8a74]/20";

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
      <span className="text-[13px] font-semibold text-[#33413e]">{label}</span>
      {children}
      {hint && <span className="text-xs text-[#66736f]">{hint}</span>}
    </label>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("rounded-xl border border-[#e2e7e5] bg-white", className)}>{children}</section>;
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
  return <div className={cn("rounded-md border px-3.5 py-3 text-sm leading-6", tones[tone])}>{children}</div>;
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-[#111a18] sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] leading-7 text-[#33413e]">{description}</p>}
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
