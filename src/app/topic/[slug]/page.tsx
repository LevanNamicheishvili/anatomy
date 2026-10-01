import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HumanAtlasApp } from "@/components/sites/human-atlas-co-f41dd540/root-8a5edab2/HumanAtlasApp";
import { requireUser } from "@/lib/auth";
import { TOPIC_BY_SLUG } from "@/components/sites/human-atlas-co-f41dd540/root-8a5edab2/topics";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const topic = TOPIC_BY_SLUG[slug];
  if (!topic) return {};
  return { title: `${topic.title} — ადამიანის ატლასი 3D`, description: topic.subtitle };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!TOPIC_BY_SLUG[slug]) notFound();
  // QR codes in textbooks lead here: after signing in the pupil comes straight back to this topic.
  await requireUser(`/topic/${slug}`);
  return <HumanAtlasApp initialTopic={slug} />;
}
