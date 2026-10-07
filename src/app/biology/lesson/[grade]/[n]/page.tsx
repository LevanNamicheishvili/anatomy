import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LessonPage } from "@/components/portal/LessonPage";
import { requireUser } from "@/lib/auth";
import { BIOLOGY_GRADES } from "@/lib/curriculum";
import { lessonPlace } from "@/lib/biology-topics";
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
  return r ? { title: `${r.lesson.title} — ბიოლოგია` } : {};
}

export default async function Page({ params }: { params: Params }) {
  const r = await resolve(params);
  if (!r) notFound();
  const user = await requireUser(`/biology/lesson/${r.grade.grade}/${encodeURIComponent(r.lesson.n || r.lesson.title)}`);
  const place = lessonPlace(r.grade.grade, r.lesson.n || r.lesson.title);
  return <LessonPage locked={!!r.content.sensitive && user.role === "student"} topic={place?.topic ?? null} prev={place?.prev ?? null} next={place?.next ?? null} lesson={r.lesson} content={r.content} />;
}
