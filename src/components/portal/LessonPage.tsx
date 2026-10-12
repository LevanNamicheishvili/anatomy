import Link from "next/link";
import { Box } from "lucide-react";
import type { BioLesson, BioTopic } from "@/lib/biology-topics";
import type { Lesson } from "@/lib/curriculum";
import type { LessonContent } from "@/lib/lessons";
import { LessonVisual } from "@/components/visuals/LessonVisual";
import type { LessonVisualDef } from "@/components/visuals/lesson-visuals";
import { LessonNav, LessonHeader, LessonSections, Reading, RememberCallout, TermsList, VisualWide, type LessonLink } from "./lesson";
import { LessonQuiz } from "./LessonQuiz";
import { PunnettSquare } from "./PunnettSquare";
import { TopicHeader } from "./TopicHeader";

const COLOR = "#0f8a74";

/** One lesson: header, the 3D animation as the hero, text, key terms, what to remember, a self-check; moves on within its topic. */
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
  const link = (l: BioLesson | null): LessonLink | null => {
    if (!l) return null;
    const idx = topic ? topic.lessons.findIndex((x) => x.href === l.href) : -1;
    return { href: l.href, title: l.title, n: idx >= 0 ? idx + 1 : undefined };
  };
  // Position within the topic, worked out from the neighbours (the lesson itself is a curriculum entry).
  const prevAt = topic && prev ? topic.lessons.findIndex((x) => x.href === prev.href) : -1;
  const nextAt = topic && next ? topic.lessons.findIndex((x) => x.href === next.href) : -1;
  const index = prevAt >= 0 ? prevAt + 1 : nextAt > 0 ? nextAt - 1 : topic && topic.lessons.length === 1 ? 0 : -1;

  return (
    <div className="flex min-h-dvh flex-col bg-page font-sans text-ink">
      <TopicHeader
        subject={{ name: "ბიოლოგია", href: "/biology" }}
        back={topic ? { name: topic.title, href: back } : undefined}
        topic={topic?.title ?? title}
        color={COLOR}
        icon={topic?.icon ?? "body"}
      />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-10">
        <Reading>
          <LessonHeader
            path={[{ label: "ბიოლოგია", href: "/biology" }, ...(topic ? [{ label: topic.title, href: back }] : []), { label: title }]}
            eyebrow={topic ? `${topic.title}${index >= 0 ? ` · გაკვეთილი ${index + 1}` : ""}` : "ბიოლოგია"}
            title={title}
            intro={locked ? undefined : content.intro}
          />
        </Reading>

        {locked ? (
          <Reading>
            <p className="mt-6 rounded-xl border border-line-strong bg-card p-5 text-base leading-7 text-copy">
              ამ გაკვეთილს მასწავლებელი გაკვეთილზე გაჩვენებს. თუ კითხვა გაქვს, მიმართე მასწავლებელს ან სკოლის ექიმს.
            </p>
          </Reading>
        ) : (
          <>
            {visual && (
              <VisualWide>
                <LessonVisual id={visual.id} stages={visual.stages} />
              </VisualWide>
            )}

            <Reading>
              {content.related && content.related.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2">
                  {content.related.map((r) => (
                    <Link
                      key={r.href}
                      href={r.href}
                      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand/30 bg-brand-soft px-4 py-2 text-sm font-semibold text-brand-strong transition-colors hover:bg-brand-soft/70"
                    >
                      <Box className="size-4" aria-hidden />
                      {r.label}
                    </Link>
                  ))}
                </div>
              )}

              <LessonSections sections={content.sections} />
              <TermsList terms={content.terms} />
              <RememberCallout items={content.remember} />

              {content.widget && <PunnettSquare mode={content.widget === "punnett-di" ? "di" : content.widget === "punnett-x" ? "x" : "mono"} />}

              <LessonQuiz quiz={content.quiz} />
            </Reading>
          </>
        )}

        <Reading>
          <LessonNav prev={link(prev)} next={link(next)} back={{ href: back, label: topic ? `ყველა გაკვეთილი: ${topic.title}` : "ყველა თემა" }} color={COLOR} />
        </Reading>
      </main>
    </div>
  );
}
