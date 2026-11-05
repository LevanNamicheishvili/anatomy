"use client";

import { useEffect, useRef } from "react";
import { NarrationSubtitles, NarrationTextProvider } from "@/components/portal/NarrationScene";
import { SeasonsGlobe } from "@/components/geography/seasons/SeasonsGlobe";
import { narrationAudio, narrationTimings, type NarrationBlock, type NarrationInfo } from "@/lib/narration";
import { narrationAt } from "@/lib/narration-cues";
import type { StageProps } from "./stage";

/*
 * A piece of a real lesson, as a pupil gets it: the voice tells why the seasons change, and the scene shows what it
 * says at that moment. From "the Earth goes round the Sun" to "in Australia it is the other way round".
 */

const FROM_WORD = 110;
const TO_WORD = 176;

export default function SeasonsStage({ onReady, blocks, narration }: StageProps & { blocks: NarrationBlock[]; narration: NarrationInfo | null }) {
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    if (!narration) {
      readyRef.current();
      return;
    }
    const audio = new Audio(narrationAudio(narration));
    audio.preload = "auto";
    let raf = 0;
    let done = false;
    let starts: number[] = [];
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = audio.currentTime;
      let w = FROM_WORD;
      while (w + 1 < starts.length && starts[w + 1] <= t) w++;
      if (w >= TO_WORD && !done && t >= starts[TO_WORD + 1]) {
        // The piece is told: the last picture stays while the presenter speaks.
        done = true;
        audio.pause();
      }
      narrationAt(w);
    };
    let cancelled = false;
    (async () => {
      const timing = (await (await fetch(narrationTimings(narration))).json()) as { words: [number, number][] };
      if (cancelled) return;
      starts = timing.words.map((w) => w[0]);
      audio.currentTime = starts[FROM_WORD];
      readyRef.current();
      narrationAt(FROM_WORD);
      await audio.play().catch(() => {});
      if (!cancelled) tick();
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      audio.pause();
      narrationAt(-1);
    };
  }, [narration]);

  return (
    <div data-present-scene className="absolute inset-0">
      <NarrationTextProvider blocks={blocks} seconds={narration?.duration ?? 0}>
        <SeasonsGlobe />
        <NarrationSubtitles onToggle={() => {}} playing />
      </NarrationTextProvider>
    </div>
  );
}
