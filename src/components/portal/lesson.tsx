import Link from "next/link";
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
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
    <header>
      <Breadcrumbs items={path} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {eyebrow && <span className="text-sm font-semibold text-mute">{eyebrow}</span>}
        {grades && <Chip>{grades} კლასი</Chip>}
      </div>
      <h1 className="mt-2 text-3xl leading-tight text-ink sm:text-4xl">{title}</h1>
      {intro && <p className="mt-3 max-w-3xl text-lg leading-8 text-copy">{intro}</p>}
    </header>
  );
}

/** The lesson's headed paragraphs. */
export function LessonSections({ sections }: { sections: { heading: string; text: string[] }[] }) {
  return (
    <>
      {sections.map((s) => (
        <section key={s.heading} className="mt-10">
          <h2 className="text-xl text-ink">{s.heading}</h2>
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
    <section className="mt-10 rounded-xl border border-line-strong bg-white p-5 shadow-card sm:p-6">
      <h2 className="text-lg text-ink">მთავარი ტერმინები</h2>
      <dl className="mt-3 flex flex-col divide-y divide-chip">
        {terms.map((t) => (
          <div key={t.term} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-5">
            <dt className="font-semibold text-ink">{t.term}</dt>
            <dd className="text-[15px] leading-7 text-copy">{t.meaning}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function RememberCallout({ items }: { items: string[] }) {
  return (
    <section className="mt-5 rounded-xl border border-[#f2d98a] bg-[#fdf8e6] p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-lg text-ink">
        <Lightbulb className="size-5 text-[#c08a00]" aria-hidden />
        დაიმახსოვრე
      </h2>
      <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-[15px] leading-7 text-copy marker:text-[#c08a00]">
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
          <Link href={prev.href} className={cn(cardBase, "border-line-strong bg-white hover:border-faint")}>
            <ArrowLeft className="size-5 shrink-0 text-faint transition-transform group-hover:-translate-x-0.5" aria-hidden />
            <span className="min-w-0">
              <span className="block text-xs text-mute">წინა{prev.n ? ` · გაკვეთილი ${prev.n}` : ""}</span>
              <span className="block truncate font-semibold text-ink">{prev.title}</span>
            </span>
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
        {next ? (
          <Link href={next.href} className={cn(cardBase, "justify-end border-transparent text-end text-white")} style={{ backgroundColor: color }}>
            <span className="min-w-0">
              <span className="block text-xs text-white/85">შემდეგი{next.n ? ` · გაკვეთილი ${next.n}` : ""}</span>
              <span className="block truncate font-semibold">{next.title}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : (
          <span className="hidden sm:block" />
        )}
      </div>
      <Link href={back.href} className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-copy hover:bg-chip">
        <ArrowLeft className="size-4" aria-hidden />
        {back.label}
      </Link>
    </nav>
  );
}
