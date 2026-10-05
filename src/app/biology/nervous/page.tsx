import type { Metadata } from "next";
import { NervousExplorer } from "@/components/nervous/NervousExplorer";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "ნერვული სისტემა — ბიოლოგია 3D" };

export default async function NervousPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  await requireUser("/biology/nervous");
  const { s } = await searchParams;
  return <NervousExplorer initial={s} />;
}
