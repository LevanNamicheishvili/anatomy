import type { Chapter, Grade, Lesson } from "@/lib/curriculum";
import { GRADE_8 } from "./grade-8";
import { GRADE_9 } from "./grade-9";
import type { LessonContent } from "./types";

export type { LessonContent } from "./types";

/** Written lesson pages, by grade and textbook number. */
const LESSONS: Record<number, Record<string, LessonContent>> = { 8: GRADE_8, 9: GRADE_9 };

export const lessonContent = (grade: number, n: string) => LESSONS[grade]?.[n] ?? null;

/** Where a lesson opens: its own 3D section if it has one, else its lesson page if written. */
export function lessonHref(grade: number, l: Lesson) {
  if (l.href) return l.href;
  return lessonContent(grade, l.n) ? `/biology/lesson/${grade}/${encodeURIComponent(l.n)}` : null;
}

export function findLesson(grade: Grade, n: string): { lesson: Lesson; chapter: Chapter; index: number; all: Lesson[] } | null {
  const all = grade.chapters.flatMap((c) => c.lessons);
  for (const chapter of grade.chapters) {
    const lesson = chapter.lessons.find((l) => l.n === n);
    if (lesson) return { lesson, chapter, index: all.indexOf(lesson), all };
  }
  return null;
}
