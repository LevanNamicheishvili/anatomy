import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import type { Grade } from "@/lib/curriculum";
import type { Subject } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { PortalShell } from "./Shell";
import { SUBJECT_ICONS, TOPIC_ICONS } from "./TopicHeader";

/**
 * A subject as the school teaches it: pick a grade, see that grade's textbook chapter by chapter, open a
 * lesson. The 3D topics stay available below, for whoever wants to explore freely.
 */
export function CurriculumPage({ user, subject, grades, grade, ownGrade }: { user: CurrentUser; subject: Subject; grades: Grade[]; grade: Grade; ownGrade: number | null }) {
  const Icon = SUBJECT_ICONS[subject.icon];
  const lessons = grade.chapters.flatMap((c) => c.lessons);
  const ready = lessons.filter((l) => l.href).length;
  const tools = subject.topics.filter((t) => t.href && (!t.staffOnly || user.role !== "student"));

  return (
    <PortalShell user={user} active="/dashboard">
      <nav aria-label="გზა" className="flex items-center gap-1.5 text-sm text-[#66736f]">
        <Link href="/dashboard" className="hover:text-[#111a18]">
          საგნები
        </Link>
        <ChevronRight className="size-4 text-[#c3ccc9]" />
        <span className="font-semibold text-[#111a18]">{subject.name}</span>
      </nav>

      <div className="mt-5 flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl text-white" style={{ backgroundColor: subject.color }}>
          <Icon className="size-7" />
        </span>
        <div className="min-w-0">
          <h1 className="text-3xl">{subject.name}</h1>
          <p className="mt-1 text-[15px] leading-7 text-[#33413e]">აირჩიე კლასი და გაკვეთილი — სახელმძღვანელოს მიხედვით.</p>
        </div>
      </div>

      {/* Grade */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-[#66736f]">კლასი</span>
        <div role="tablist" aria-label="კლასი" className="flex gap-1 rounded-xl border border-[#d5dcd9] bg-white p-1">
          {grades.map((g) => (
            <Link
              key={g.grade}
              href={`?grade=${g.grade}`}
              role="tab"
              aria-selected={g.grade === grade.grade}
              scroll={false}
              className={cn(
                "relative flex h-11 min-w-14 items-center justify-center rounded-lg px-3 text-base font-semibold transition-colors",
                g.grade === grade.grade ? "text-white" : "text-[#33413e] hover:bg-[#f1f4f3]",
              )}
              style={g.grade === grade.grade ? { backgroundColor: subject.color } : undefined}
            >
              {g.roman}
              {g.grade === ownGrade && <span className={cn("absolute -top-1.5 -right-1.5 size-3 rounded-full border-2 border-white", g.grade === grade.grade ? "bg-[#f2b632]" : "bg-[#0f8a74]")} title="შენი კლასი" />}
            </Link>
          ))}
        </div>
        {ownGrade === grade.grade && <span className="rounded-full bg-[#e6f3ef] px-3 py-1 text-xs font-semibold text-[#0c5c4d]">შენი კლასი</span>}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-[#e2e7e5]">
          <div className="h-full rounded-full" style={{ width: `${(ready / lessons.length) * 100}%`, backgroundColor: subject.color }} />
        </div>
        <p className="text-sm text-[#66736f]">
          {ready} / {lessons.length} გაკვეთილს აქვს ინტერაქტიული მასალა
        </p>
      </div>

      {/* Textbook */}
      <div className="mt-6 flex flex-col gap-5">
        {grade.chapters.map((chapter) => (
          <section key={chapter.title} className="overflow-hidden rounded-xl border border-[#d5dcd9] bg-white">
            <h2 className="border-b border-[#e2e7e5] bg-[#f8faf9] px-5 py-3.5 text-base font-semibold">{chapter.title}</h2>
            <ol>
              {chapter.lessons.map((l, i) => {
                const body = (
                  <>
                    <span className={cn("w-10 shrink-0 text-sm tabular-nums", l.href ? "font-semibold text-[#33413e]" : "text-[#97a29e]")}>{l.n}</span>
                    <span className={cn("min-w-0 flex-1 text-[15px] leading-6", !l.href && "text-[#66736f]")}>{l.title}</span>
                    {l.page && <span className="hidden shrink-0 text-xs text-[#97a29e] sm:block">გვ. {l.page}</span>}
                    {l.href ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: subject.color }}>
                        გახსნა
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-md px-3 py-1.5 text-xs text-[#97a29e]">მზადდება</span>
                    )}
                  </>
                );
                const cls = cn("flex min-h-14 items-center gap-3 px-5 py-2", i > 0 && "border-t border-[#eef2f0]");
                return (
                  <li key={`${l.n}-${l.title}`}>
                    {l.href ? (
                      <Link href={l.href} className={cn(cls, "group transition-colors hover:bg-[#f5f8f7]")}>
                        {body}
                      </Link>
                    ) : (
                      <div className={cls}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      {/* Free exploration */}
      <h2 className="mt-12 text-sm font-semibold text-[#66736f]">ყველა 3D თემა — თავისუფლად დასათვალიერებლად</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => {
          const TIcon = TOPIC_ICONS[t.icon];
          return (
            <Link key={t.slug} href={t.href!} className="group flex items-center gap-3 rounded-xl border border-[#d5dcd9] bg-white p-4 transition-colors hover:border-[#97a29e]">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg" style={{ background: `${subject.color}1a`, color: subject.color }}>
                <TIcon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{t.name}</span>
                {t.grades && <span className="block text-xs text-[#66736f]">{t.grades} კლასი</span>}
              </span>
              <ArrowRight className="size-4 text-[#97a29e] transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </PortalShell>
  );
}
