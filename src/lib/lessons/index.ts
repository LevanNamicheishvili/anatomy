import type { Chapter, Grade, Lesson } from "@/lib/curriculum";
import { GRADE_8 } from "./grade-8";
import { GRADE_9 } from "./grade-9";
import { GRADE_10 } from "./grade-10";
import { GRADE_11 } from "./grade-11";
import type { LessonContent } from "./types";

export type { LessonContent } from "./types";

/** Written lesson pages, by grade and textbook number. */
const LESSONS: Record<number, Record<string, LessonContent>> = { 8: GRADE_8, 9: GRADE_9, 10: GRADE_10, 11: GRADE_11 };

/** A lesson's key: its textbook number, or its title where the book doesn't number lessons (grade XII). */
export const lessonKey = (l: Lesson) => l.n || l.title;

export const lessonContent = (grade: number, key: string) => LESSONS[grade]?.[key] ?? null;

/** Where a lesson opens: its own 3D section if it has one, else its lesson page if written. */
export function lessonHref(grade: number, l: Lesson) {
  if (l.href) return l.href;
  return lessonContent(grade, lessonKey(l)) ? `/biology/lesson/${grade}/${encodeURIComponent(lessonKey(l))}` : null;
}

export function findLesson(grade: Grade, key: string): { lesson: Lesson; chapter: Chapter; index: number; all: Lesson[] } | null {
  const all = grade.chapters.flatMap((c) => c.lessons);
  for (const chapter of grade.chapters) {
    const lesson = chapter.lessons.find((l) => lessonKey(l) === key);
    if (lesson) return { lesson, chapter, index: all.indexOf(lesson), all };
  }
  return null;
}
