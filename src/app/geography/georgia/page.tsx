import type { Metadata } from "next";
import { GeorgiaMap } from "@/components/geography/GeorgiaMap";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "საქართველოს რუკა — გეოგრაფია" };

export default async function GeorgiaPage() {
  await requireUser("/geography/georgia");
  return <GeorgiaMap />;
}
