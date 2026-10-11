import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GeoLessonPage } from "@/components/geography/lesson/GeoLessonPage";
import { requireUser } from "@/lib/auth";
import { GEO_LESSONS, GEO_LESSON_BY_SLUG } from "@/lib/geography-lessons";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const lesson = GEO_LESSON_BY_SLUG[(await params).slug];
  return lesson ? { title: `${lesson.title} — გეოგრაფია` } : {};
}

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  const lesson = GEO_LESSON_BY_SLUG[slug];
  if (!lesson) notFound();
  await requireUser(`/geography/lesson/${slug}`);
  const i = GEO_LESSONS.indexOf(lesson);
  return <GeoLessonPage lesson={lesson} prev={GEO_LESSONS[i - 1] ?? null} next={GEO_LESSONS[i + 1] ?? null} />;
}
