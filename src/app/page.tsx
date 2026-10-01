import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, Globe2, HeartPulse, Landmark, QrCode, type LucideIcon } from "lucide-react";
import { SUBJECTS, type Subject, type SubjectIcon } from "@/lib/subjects";

export const metadata: Metadata = {
  title: "სასწავლო პორტალი",
  description: "ინტერაქტიული სასწავლო მასალა საქართველოს სკოლებისთვის: ბიოლოგია, გეოგრაფია, ისტორია.",
};

const ICONS: Record<SubjectIcon, LucideIcon> = {
  biology: HeartPulse,
  geography: Globe2,
  history: Landmark,
};

function SubjectMark({ subject, size = "md" }: { subject: Subject; size?: "md" | "lg" }) {
  const Icon = ICONS[subject.icon];
  return (
    <span
      className={size === "lg" ? "flex size-11 shrink-0 items-center justify-center rounded-lg text-white" : "flex size-9 shrink-0 items-center justify-center rounded-md text-white"}
      style={{ backgroundColor: subject.color }}
    >
      <Icon className={size === "lg" ? "size-6" : "size-5"} strokeWidth={2} />
    </span>
  );
}

/** A subject that is ready: large card with a preview of what opens. */
function FeaturedSubject({ subject }: { subject: Subject & { href: string } }) {
  return (
    <article className="overflow-hidden rounded-xl border border-[#d5dcd9] bg-white md:grid md:grid-cols-[1.15fr_1fr]">
      {subject.image && (
        <Link href={subject.href} className="relative block aspect-[22/15] border-b border-[#e2e7e5] bg-[#eef2f0] md:aspect-auto md:min-h-[340px] md:border-e md:border-b-0">
          <Image
            src={subject.image}
            alt={`${subject.name} — ატლასის ხედი`}
            fill
            priority
            sizes="(min-width: 768px) 55vw, 100vw"
            className="object-cover object-top"
          />
        </Link>
      )}
      <div className="flex flex-col p-6 md:p-8">
        <div className="flex items-center gap-3">
          <SubjectMark subject={subject} size="lg" />
          <h2 className="text-2xl font-semibold">{subject.name}</h2>
        </div>
        <p className="mt-4 text-[15px] leading-7 text-[#33413e]">{subject.description}</p>
        {subject.facts && (
          <ul className="mt-5 flex flex-wrap gap-2">
            {subject.facts.map((f) => (
              <li key={f} className="rounded-md border border-[#e2e7e5] bg-[#f5f7f6] px-2.5 py-1 text-[13px] text-[#33413e]">
                {f}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto flex flex-col gap-3 pt-7">
          <Link
            href={subject.href}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-md px-5 text-[15px] font-semibold text-white transition-colors hover:brightness-95"
            style={{ backgroundColor: subject.color }}
          >
            გახსნა
            <ArrowRight className="size-[18px]" />
          </Link>
          {subject.tools?.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="flex items-center gap-3 rounded-md border border-[#d5dcd9] px-3 py-2.5 transition-colors hover:bg-[#f5f7f6]"
            >
              <QrCode className="size-5 shrink-0 text-[#33413e]" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-[#111a18]">{tool.name}</span>
                <span className="block text-[13px] text-[#66736f]">{tool.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
}

/** A subject still being prepared. */
function UpcomingSubject({ subject }: { subject: Subject }) {
  return (
    <article className="flex flex-col rounded-xl border border-[#e2e7e5] bg-white p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <SubjectMark subject={subject} />
          <h2 className="text-lg font-semibold">{subject.name}</h2>
        </div>
        <span className="rounded-full bg-[#eef2f0] px-2.5 py-0.5 text-xs font-medium text-[#66736f]">მალე</span>
      </div>
      <p className="mt-3 text-[15px] leading-7 text-[#66736f]">{subject.description}</p>
    </article>
  );
}

export default function PortalPage() {
  const ready = SUBJECTS.filter((s): s is Subject & { href: string } => !!s.href);
  const upcoming = SUBJECTS.filter((s) => !s.href);

  return (
    <div className="min-h-dvh bg-[#f4f6f5] font-sans text-[#111a18]">
      <header className="border-b border-[#e2e7e5] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <span className="flex size-9 items-center justify-center rounded-md bg-[#111a18] text-white">
            <BookOpen className="size-5" strokeWidth={2} />
          </span>
          <span className="text-[17px] font-semibold">სასწავლო პორტალი</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-3xl font-semibold sm:text-4xl">საგნები</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#33413e]">ინტერაქტიული მასალა გაკვეთილისთვის — სმარტ დაფაზე, კომპიუტერსა და ტელეფონზე.</p>

        <div className="mt-8 flex flex-col gap-6">
          {ready.map((s) => (
            <FeaturedSubject key={s.slug} subject={s} />
          ))}
          {upcoming.length > 0 && (
            <div className="grid gap-6 md:grid-cols-2">
              {upcoming.map((s) => (
                <UpcomingSubject key={s.slug} subject={s} />
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-[#e2e7e5]">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-5 text-[#66736f] sm:px-6">
          3D მოდელები: BodyParts3D, © The Database Center for Life Science, CC BY 4.0.
        </div>
      </footer>
    </div>
  );
}
