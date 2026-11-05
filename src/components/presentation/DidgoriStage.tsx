"use client";

import { useEffect, useRef } from "react";
import { createDidgori } from "@/components/history/didgori";
import { NARRATION_CUES, NarrationSubtitles, useNarration } from "@/components/history/narration";
import { JourneyScene } from "@/components/journeys/JourneyScene";
import type { StageProps } from "./stage";

/*
 * The battle of Didgori with its spoken story, as in the lesson: from the trick of the 200 horsemen on, the voice
 * telling it, the words on the screen, the field following the voice.
 */

/** The stage the story starts from: the 200 horsemen. */
const FROM_STAGE = 2;

export default function DidgoriStage({ onReady }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<JourneyScene | null>(null);
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  const narration = useNarration({
    onCue: (cue, seconds, restart) => {
      const s = sceneRef.current;
      if (!s) return;
      if (restart || s.currentStage !== cue) s.goTo(cue);
      const d = s.stageDuration(cue);
      if (d) s.setPlaybackRate(Math.max(0.5, Math.min(2, d / seconds)));
      s.setPlaying(true);
    },
    onPlaying: (p) => sceneRef.current?.setPlaying(p),
    onEnd: () => {},
  });
  const seekRef = useRef(narration.seek);
  useEffect(() => {
    seekRef.current = narration.seek;
  }, [narration.seek]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    let told = false;
    const scene = new JourneyScene(
      canvas,
      overlay,
      {
        onStage: () => {},
        onPlaying: () => {},
        onLoading: (loading) => {
          if (loading || told) return;
          told = true;
          readyRef.current();
          seekRef.current(NARRATION_CUES.find((c) => c.stage === FROM_STAGE)?.time ?? 0);
        },
        onProgress: () => {},
      },
      { didgori: createDidgori({ camera: "cinematic" }) },
    );
    sceneRef.current = scene;
    void scene.start("didgori");
    return () => {
      sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label="დიდგორის ბრძოლა" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
      <NarrationSubtitles n={narration} className="absolute inset-x-0 bottom-[6vh] [&>div]:max-w-[80vw] [&_p]:text-[clamp(1.1rem,2vw,2.25rem)]! [&_p]:leading-snug!" />
    </>
  );
}
