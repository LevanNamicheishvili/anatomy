import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPage } from "@/components/portal/LessonPage";
import { requireUser } from "@/lib/auth";
import { BIOLOGY_GRADES } from "@/lib/curriculum";
import { findLesson, lessonContent } from "@/lib/lessons";

type Params = Promise<{ grade: string; n: string }>;

async function resolve(params: Params) {
  const { grade: g, n: raw } = await params;
  const n = decodeURIComponent(raw);
  const grade = BIOLOGY_GRADES.find((x) => x.grade === Number(g));
  const content = grade && lessonContent(grade.grade, n);
  const found = grade && findLesson(grade, n);
  return grade && content && found ? { grade, content, ...found } : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const r = await resolve(params);
  return r ? { title: `${r.lesson.n} ${r.lesson.title} — ბიოლოგია ${r.grade.roman}` } : {};
}

export default async function Page({ params }: { params: Params }) {
  const r = await resolve(params);
  if (!r) notFound();
  await requireUser(`/biology/lesson/${r.grade.grade}/${encodeURIComponent(r.lesson.n)}`);
  return <LessonPage grade={r.grade} chapter={r.chapter} lesson={r.lesson} content={r.content} index={r.index} all={r.all} />;
}
