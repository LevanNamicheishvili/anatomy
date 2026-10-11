import Link from "next/link";
import { ArrowLeft, ArrowRight, Lightbulb } from "lucide-react";
import { LessonQuiz } from "@/components/portal/LessonQuiz";
import { TopicHeader } from "@/components/portal/TopicHeader";
import type { GeoLesson } from "@/lib/geography-lessons";
import { GeoVisual } from "./GeoVisual";

const COLOR = "#2f6fb0";

/** A geography lesson: 3D scene first, then the explainer, key terms, what to remember and a self-check. */
export function GeoLessonPage({ lesson, prev, next }: { lesson: GeoLesson; prev: GeoLesson | null; next: GeoLesson | null }) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "გეოგრაფია", href: "/geography" }} topic={lesson.title} color={COLOR} icon={lesson.icon} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <p className="text-sm text-[#66736f]">
          გეოგრაფია · თემა {lesson.n}
          {lesson.grades ? ` · ${lesson.grades} კლასი` : ""}
        </p>
        <h1 className="mt-2 text-3xl leading-tight">{lesson.title}</h1>
        <p className="mt-3 text-lg leading-8 text-[#33413e]">{lesson.intro}</p>

        <GeoVisual kind={lesson.visual} />

        {lesson.sections.map((s) => (
          <section key={s.heading} className="mt-9">
            <h2 className="text-xl">{s.heading}</h2>
            {s.text.map((p) => (
              <p key={p.slice(0, 30)} className="mt-3 text-[16px] leading-8 text-[#33413e]">
                {p}
              </p>
            ))}
          </section>
        ))}

        <section className="mt-10 rounded-xl border border-[#d5dcd9] bg-white p-5">
          <h2 className="text-base font-semibold">მთავარი ტერმინები</h2>
          <dl className="mt-3 flex flex-col divide-y divide-[#eef2f0]">
            {lesson.terms.map((t) => (
              <div key={t.term} className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4">
                <dt className="font-semibold">{t.term}</dt>
                <dd className="text-[15px] leading-6 text-[#33413e]">{t.meaning}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-5 rounded-xl border border-[#f2d98a] bg-[#fdf8e6] p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Lightbulb className="size-5 text-[#c08a00]" />
            დაიმახსოვრე
          </h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 ps-5 text-[15px] leading-6 text-[#33413e]">
            {lesson.remember.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <LessonQuiz quiz={lesson.quiz} />

        <nav className="mt-12 grid gap-3 border-t border-[#e2e7e5] pt-6 sm:grid-cols-2" aria-label="გაკვეთილები">
          {prev ? (
            <Link href={`/geography/lesson/${prev.slug}`} className="flex items-center gap-3 rounded-xl border border-[#d5dcd9] bg-white p-4 hover:border-[#97a29e]">
              <ArrowLeft className="size-5 shrink-0 text-[#97a29e]" />
              <span className="min-w-0">
                <span className="block text-xs text-[#66736f]">წინა</span>
                <span className="block truncate font-semibold">{prev.title}</span>
              </span>
            </Link>
          ) : (
            <Link href="/geography" className="flex items-center gap-3 rounded-xl border border-[#d5dcd9] bg-white p-4 hover:border-[#97a29e]">
              <ArrowLeft className="size-5 shrink-0 text-[#97a29e]" />
              <span className="font-semibold">გეოგრაფია</span>
            </Link>
          )}
          {next && (
            <Link href={`/geography/lesson/${next.slug}`} className="flex items-center justify-end gap-3 rounded-xl p-4 text-right text-white" style={{ backgroundColor: COLOR }}>
              <span className="min-w-0">
                <span className="block text-xs text-white/80">შემდეგი</span>
                <span className="block truncate font-semibold">{next.title}</span>
              </span>
              <ArrowRight className="size-5 shrink-0" />
            </Link>
          )}
        </nav>
      </main>
    </div>
  );
}
