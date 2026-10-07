import Link from "next/link";
import { ArrowLeft, ArrowRight, Box, Lightbulb } from "lucide-react";
import type { BioLesson, BioTopic } from "@/lib/biology-topics";
import type { Lesson } from "@/lib/curriculum";
import type { LessonContent } from "@/lib/lessons";
import { LessonVisual } from "@/components/visuals/LessonVisual";
import type { LessonVisualDef } from "@/components/visuals/lesson-visuals";
import { LessonQuiz } from "./LessonQuiz";
import { PunnettSquare } from "./PunnettSquare";
import { TopicHeader } from "./TopicHeader";

const COLOR = "#0f8a74";

/** One lesson: text, key terms, what to remember, 3D links and a self-check; moves on within its topic. */
export function LessonPage({
  topic,
  prev,
  next,
  lesson,
  content,
  locked = false,
  visual = null,
}: {
  topic: BioTopic | null;
  prev: BioLesson | null;
  next: BioLesson | null;
  lesson: Lesson;
  content: LessonContent;
  locked?: boolean;
  visual?: LessonVisualDef | null;
}) {
  const back = topic ? `/biology/themes/${topic.slug}` : "/biology";
  const title = lesson.title.replace(/\s*\(\+.*\)$/, "");

  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "ბიოლოგია", href: "/biology" }} topic={topic?.title ?? title} color={COLOR} icon={topic?.icon ?? "body"} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {topic && (
          <Link href={back} className="text-sm text-[#66736f] hover:text-[#111a18]">
            {topic.title}
          </Link>
        )}
        <h1 className="mt-2 text-3xl leading-tight">{title}</h1>

        {locked ? (
          <p className="mt-6 rounded-xl border border-[#d5dcd9] bg-white p-5 text-[15px] leading-7 text-[#33413e]">
            ამ გაკვეთილს მასწავლებელი გაკვეთილზე გაჩვენებს. თუ კითხვა გაქვს,
            მიმართე მასწავლებელს ან სკოლის ექიმს.
          </p>
        ) : (
          <>
            {visual && <LessonVisual id={visual.id} stages={visual.stages} />}
            <p className="mt-6 text-lg leading-8 text-[#33413e]">
              {content.intro}
            </p>

            {content.related && content.related.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {content.related.map((r) => (
                  <Link
                    key={r.href}
                    href={r.href}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#0f8a74]/30 bg-[#e6f3ef] px-4 py-2 text-sm font-semibold text-[#0c5c4d] transition-colors hover:bg-[#d5ece5]"
                  >
                    <Box className="size-4" />
                    {r.label}
                  </Link>
                ))}
              </div>
            )}

            {content.sections.map((s) => (
              <section key={s.heading} className="mt-9">
                <h2 className="text-xl">{s.heading}</h2>
                {s.text.map((p) => (
                  <p
                    key={p.slice(0, 30)}
                    className="mt-3 text-[16px] leading-8 text-[#33413e]"
                  >
                    {p}
                  </p>
                ))}
              </section>
            ))}

            <section className="mt-10 rounded-xl border border-[#d5dcd9] bg-white p-5">
              <h2 className="text-base font-semibold">მთავარი ტერმინები</h2>
              <dl className="mt-3 flex flex-col divide-y divide-[#eef2f0]">
                {content.terms.map((t) => (
                  <div
                    key={t.term}
                    className="grid gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4"
                  >
                    <dt className="font-semibold">{t.term}</dt>
                    <dd className="text-[15px] leading-6 text-[#33413e]">
                      {t.meaning}
                    </dd>
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
                {content.remember.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>

            {content.widget && <PunnettSquare mode={content.widget === "punnett-di" ? "di" : content.widget === "punnett-x" ? "x" : "mono"} />}

        <LessonQuiz quiz={content.quiz} />
          </>
        )}

        <nav
          className="mt-12 grid gap-3 border-t border-[#e2e7e5] pt-6 sm:grid-cols-2"
          aria-label="გაკვეთილები"
        >
          {prev ? (
            <Link
              href={prev.href}
              className="group flex items-center gap-3 rounded-xl border border-[#d5dcd9] bg-white p-4 hover:border-[#97a29e]"
            >
              <ArrowLeft className="size-5 shrink-0 text-[#97a29e]" />
              <span className="min-w-0">
                <span className="block text-xs text-[#66736f]">წინა</span>
                <span className="block truncate font-semibold">
                  {prev.title}
                </span>
              </span>
            </Link>
          ) : (
            <Link
              href={back}
              className="flex items-center gap-3 rounded-xl border border-[#d5dcd9] bg-white p-4 hover:border-[#97a29e]"
            >
              <ArrowLeft className="size-5 shrink-0 text-[#97a29e]" />
              <span className="font-semibold">{topic ? topic.title : "ბიოლოგია"}</span>
            </Link>
          )}
          {next && (
            <Link
              href={next.href}
              className="group flex items-center justify-end gap-3 rounded-xl p-4 text-right text-white"
              style={{ backgroundColor: COLOR }}
            >
              <span className="min-w-0">
                <span className="block text-xs text-white/80">შემდეგი</span>
                <span className="block truncate font-semibold">
                  {next.title}
                </span>
              </span>
              <ArrowRight className="size-5 shrink-0" />
            </Link>
          )}
        </nav>
      </main>
    </div>
  );
}
