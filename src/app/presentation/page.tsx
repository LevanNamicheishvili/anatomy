import type { Metadata } from "next";
import { Presentation } from "@/components/presentation/Presentation";
import { requireUser } from "@/lib/auth";
import { BIO_TOPICS } from "@/lib/biology-topics";
import { GEO_LESSONS } from "@/lib/geography-lessons";
import { geoNarrationId, lessonNarration, narrationBlocks } from "@/lib/narration";
import { NARRATION_MANIFEST } from "@/lib/narration-manifest";
import { OFFLINE } from "@/lib/offline";
import { PORTAL_NAME } from "@/components/portal/ui";

export const metadata: Metadata = { title: `პრეზენტაცია — ${PORTAL_NAME}` };

/** The product's own numbers, counted from what is really in it. */
function counts() {
  // The same count the biology page shows: lessons that really open something, each place once.
  const biology = BIO_TOPICS.reduce((n, t) => n + t.lessons.length, 0);
  const recordings = Object.values(NARRATION_MANIFEST);
  return {
    lessons: biology + GEO_LESSONS.length,
    narrated: recordings.length,
    hours: Math.round(recordings.reduce((sum, r) => sum + r.duration, 0) / 360) / 10,
  };
}

export default async function PresentationPage() {
  await requireUser("/presentation");
  const seasons = GEO_LESSONS.find((l) => l.slug === "seasons")!;
  return <Presentation offline={OFFLINE} counts={counts()} seasons={{ blocks: narrationBlocks(seasons), narration: lessonNarration(geoNarrationId("seasons"), seasons) }} />;
}
