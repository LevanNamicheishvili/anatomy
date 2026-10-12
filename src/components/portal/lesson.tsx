import Link from "next/link";
import { ArrowLeft, ArrowRight, Lightbulb, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Breadcrumbs, Chip } from "./ui";

/*
 * Building blocks shared by every lesson page (biology, geography): a compact header, the 3D visual
 * wider than the reading column, reading sections, key terms, the "remember" callout and prev/next cards.
 * Text stays in a `max-w-3xl` column; only the visual may go up to `max-w-6xl`.
 */

/** Reading column. */
export function Reading({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-3xl", className)}>{children}</div>;
}

/** Wide frame for the lesson's 3D visual (rounded corners come from the visual itself). */
export function VisualWide({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto mt-6 w-full max-w-6xl [&>section]:mt-0">{children}</div>;
}

export function LessonHeader({
  path,
  eyebrow,
  grades,
  title,
  intro,
}: {
  /** Breadcrumb above the title (subject › topic). */
  path: { label: string; href?: string }[];
  eyebrow?: string;
  grades?: string;
  title: string;
  intro?: string;
}) {
  return (
    <header className="science-hero rounded-3xl border border-line p-5 shadow-card sm:p-8">
      {/* On phones the sticky top bar already shows the path and a back arrow. */}
      <Breadcrumbs items={path} className="max-sm:hidden" />
      <div className="flex flex-wrap items-center gap-2 sm:mt-4">
        {eyebrow && <span className="text-sm font-semibold text-mute">{eyebrow}</span>}
        {grades && <Chip>{grades} კლასი</Chip>}
      </div>
      <h1 className="mt-2 text-[1.75rem] leading-[1.4] text-ink [overflow-wrap:anywhere] sm:text-4xl">{title}</h1>
      {intro && <p className="mt-3 max-w-3xl text-base leading-7 text-copy sm:text-lg sm:leading-8">{intro}</p>}
    </header>
  );
}

/** The lesson's headed paragraphs. */
export function LessonSections({ sections }: { sections: { heading: string; text: string[] }[] }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.heading} className="lesson-paper mt-7">
          <h2 className="border-b border-line pb-4 text-xl text-ink">{s.heading}</h2>
          {s.text.map((p) => (
            <p key={p.slice(0, 30)} className="mt-3 text-base leading-8 text-copy">
              {p}
            </p>
          ))}
        </section>
      ))}
    </>
  );
}

export function TermsList({ terms }: { terms: { term: string; meaning: string }[] }) {
  return (
    <section className="mt-10 rounded-2xl border border-line bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-lg text-ink">მთავარი ტერმინები</h2>
      <dl className="mt-3 flex flex-col divide-y divide-chip">
        {terms.map((t) => (
          <div key={t.term} className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5">
            <dt className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">{t.term}</dt>
            <dd className="text-[15px] leading-7 text-copy">{t.meaning}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Yellow box with a short list; "remember" on lessons, also used for the atlas's interesting facts. */
export function RememberCallout({ items, title = "დაიმახსოვრე", icon: Icon = Lightbulb }: { items: string[]; title?: string; icon?: LucideIcon }) {
  return (
    <section className="mt-5 rounded-2xl border border-warning/20 bg-warning-soft p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg text-ink">
        <Icon className="size-5 text-warning" aria-hidden />
        {title}
      </h2>
      <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-[15px] leading-7 text-copy marker:text-warning">
        {items.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>
  );
}

export interface LessonLink {
  href: string;
  title: string;
  /** Lesson number within the topic, shown on the card. */
  n?: number;
}

const cardBase =
  "group flex min-h-20 items-center gap-3 rounded-xl border p-4 outline-none transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

/** Previous / next cards of equal size, and a link back to the whole topic. */
export function LessonNav({ prev, next, back, color }: { prev: LessonLink | null; next: LessonLink | null; back: { href: string; label: string }; color: string }) {
  return (
    <nav className="mt-14 border-t border-line pt-6" aria-label="გაკვეთილები">
      <div className="grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link href={prev.href} title={prev.title} className={cn(cardBase, "border-line-strong bg-card hover:border-faint")}>
            <ArrowLeft className="size-5 shrink-0 text-faint transition-transform group-hover:-translate-x-0.5" aria-hidden />
            <span className="min-w-0">
              <span className="block text-xs text-mute">წინა{prev.n ? ` · გაკვეთილი ${prev.n}` : ""}</span>
              {/* Two lines before cutting: a long Georgian title stays readable on a phone. */}
              <span className="[overflow-wrap:anywhere] leading-6 font-semibold text-ink [overflow-wrap:anywhere]">{prev.title}</span>
            </span>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
        {next ? (
          // On phones the cards stack, so the next lesson comes first.
          <Link href={next.href} title={next.title} className={cn(cardBase, "justify-end border-transparent text-end text-white max-sm:order-first")} style={{ backgroundColor: color }}>
            <span className="min-w-0">
              <span className="block text-xs text-white/85">შემდეგი{next.n ? ` · გაკვეთილი ${next.n}` : ""}</span>
              <span className="[overflow-wrap:anywhere] leading-6 font-semibold [overflow-wrap:anywhere]">{next.title}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
      </div>
      <Link href={back.href} className="mx-auto mt-5 flex min-h-11 w-fit max-w-full items-center gap-2 rounded-lg px-3 py-2 text-center text-sm font-semibold text-copy hover:bg-chip">
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        {back.label}
      </Link>
    </nav>
  );
}
