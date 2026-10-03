import type { Metadata } from "next";
import { GeorgiaMap } from "@/components/geography/GeorgiaMap";
import type { MapLayer } from "@/components/geography/georgia-data";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "საქართველოს რუკა — გეოგრაფია" };

const LAYERS: MapLayer[] = ["physical", "political", "zones", "climate"];

export default async function GeorgiaPage({ searchParams }: { searchParams: Promise<{ layer?: string }> }) {
  await requireUser("/geography/georgia");
  const { layer } = await searchParams;
  return <GeorgiaMap initialLayer={LAYERS.find((l) => l === layer) ?? "physical"} />;
}
