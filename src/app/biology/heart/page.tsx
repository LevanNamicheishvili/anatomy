import type { Metadata } from "next";
import { HeartExplorer } from "@/components/heart/HeartExplorer";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "გული და სისხლის მიმოქცევა — ბიოლოგია 3D" };

export default async function HeartPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireUser("/biology/heart");
  const { s } = await searchParams;
  return <HeartExplorer initial={s} />;
}
