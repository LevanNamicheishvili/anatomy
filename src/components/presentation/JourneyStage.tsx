"use client";

import { useEffect, useRef } from "react";
import { JourneyScene } from "@/components/journeys/JourneyScene";
import { zoomJourney } from "@/components/journeys/journey-zoom";
import type { StageProps } from "./stage";

/** The journey from the whole body down to the DNA, running by itself. */
export default function JourneyStage({ onReady }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(onReady);
  useEffect(() => {
    readyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const scene = new JourneyScene(canvas, overlay, { onStage: () => {}, onPlaying: () => {}, onLoading: (loading) => !loading && readyRef.current(), onProgress: () => {} }, { zoom: zoomJourney });
    void scene.start("zoom");
    return () => scene.dispose();
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label="სხეულიდან დნმ-მდე" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </>
  );
}
