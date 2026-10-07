import type { Metadata } from "next";
import { JourneyExplorer } from "@/components/journeys/JourneyExplorer";
import { JOURNEY_BY_ID, type JourneyId } from "@/components/journeys/journeys-data";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "მოგზაურობა სხეულში — ბიოლოგია 3D" };

export default async function JourneysPage({ searchParams }: { searchParams: Promise<{ j?: string }> }) {
  await requireUser("/biology/journeys");
  const { j } = await searchParams;
  const id: JourneyId = j && j in JOURNEY_BY_ID ? (j as JourneyId) : "blood";
  return <JourneyExplorer initial={id} />;
}
