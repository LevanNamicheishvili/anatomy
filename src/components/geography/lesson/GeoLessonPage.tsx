import { LessonHeader, LessonNav, LessonSections, Reading, RememberCallout, TermsList, VisualWide, type LessonLink } from "@/components/portal/lesson";
import { LessonQuiz } from "@/components/portal/LessonQuiz";
import { TopicHeader } from "@/components/portal/TopicHeader";
import type { GeoLesson } from "@/lib/geography-lessons";
import { GeoVisual } from "./GeoVisual";

const COLOR = "#2f6fb0";

const link = (l: GeoLesson | null): LessonLink | null => (l ? { href: `/geography/lesson/${l.slug}`, title: l.title, n: l.n } : null);

/** A geography lesson: compact header, the 3D scene as the hero, then the explainer, key terms, what to remember and a self-check. */
export function GeoLessonPage({ lesson, prev, next }: { lesson: GeoLesson; prev: GeoLesson | null; next: GeoLesson | null }) {
  return (
    <div className="flex min-h-dvh flex-col bg-page font-sans text-ink">
      <TopicHeader subject={{ name: "გეოგრაფია", href: "/geography" }} topic={lesson.title} color={COLOR} icon={lesson.icon} />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <Reading>
          <LessonHeader
            path={[{ label: "გეოგრაფია", href: "/geography" }, { label: lesson.title }]}
            eyebrow={`გეოგრაფია · გაკვეთილი ${lesson.n}`}
            grades={lesson.grades}
            title={lesson.title}
            intro={lesson.intro}
          />
        </Reading>

        <VisualWide>
          <GeoVisual kind={lesson.visual} />
        </VisualWide>

        <Reading>
          <LessonSections sections={lesson.sections} />
          <TermsList terms={lesson.terms} />
          <RememberCallout items={lesson.remember} />
          <LessonQuiz quiz={lesson.quiz} />
          <LessonNav prev={link(prev)} next={link(next)} back={{ href: "/geography", label: "ყველა თემა" }} color={COLOR} />
        </Reading>
      </main>
    </div>
  );
}
