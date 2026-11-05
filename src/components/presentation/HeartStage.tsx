"use client";

import { useEffect, useRef } from "react";
import { HeartScene } from "@/components/heart/HeartScene";
import type { StageProps } from "./stage";

/** The beating heart, with the blood going through it. */
export default function HeartStage({ onReady }: StageProps) {
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
    let scene: HeartScene | null = null;
    scene = new HeartScene(canvas, overlay, { onPick: () => {}, onPhase: () => {}, onLoading: (loading) => !loading && readyRef.current() });
    scene.setView("cycle", { circuit: "both", disease: false, slow: true, playing: true });
    return () => scene?.dispose();
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label="გული" />
      <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </>
  );
}
