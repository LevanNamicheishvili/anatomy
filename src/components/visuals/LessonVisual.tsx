"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Pause, Play, RotateCcw } from "lucide-react";
import { JourneyScene } from "@/components/journeys/JourneyScene";
import { cn } from "@/lib/utils";
import { VISUAL_BUILDERS } from "./builders";
import type { VisualStage } from "./lesson-visuals";

/** The animation at the top of a lesson: 3D scene, caption per stage, play/pause, stages, full screen. */
export function LessonVisual({ id, stages }: { id: string; stages: VisualStage[] }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<JourneyScene | null>(null);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const scene = new JourneyScene(
      canvas,
      overlay,
      {
        onStage: setStage,
        onPlaying: setPlaying,
        onLoading: setLoading,
        onProgress: (f) => {
          if (barRef.current) barRef.current.style.width = `${f * 100}%`;
        },
      },
      VISUAL_BUILDERS,
    );
    sceneRef.current = scene;
    void scene.start(id);
    const onFs = () => setFull(document.fullscreenElement === boxRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [id]);

  const go = (i: number) => {
    sceneRef.current?.goTo(i);
    sceneRef.current?.setPlaying(true);
  };
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void boxRef.current?.requestFullscreen?.();
  };
  const current = stages[stage] ?? stages[0];
  const last = stage === stages.length - 1;

  return (
    <section ref={boxRef} className={cn("mt-6 overflow-hidden rounded-xl border border-[#d5dcd9] bg-white", full && "flex flex-col rounded-none border-0")}>
      <div className={cn("relative bg-[radial-gradient(ellipse_at_center,#26312e_0%,#0e1413_80%)]", full ? "min-h-0 flex-1" : "aspect-[16/10] max-h-[68vh] w-full")}>
        <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`ანიმაცია: ${current.title}`} />
        <div ref={overlayRef} className="lesson-visual pointer-events-none absolute inset-0 overflow-hidden" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#33413e] shadow-sm">იტვირთება…</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 px-3">
          <button type="button" onClick={() => go(stage - 1)} disabled={stage === 0} aria-label="წინა" className="flex size-11 items-center justify-center rounded-lg bg-white text-[#111a18] shadow-sm disabled:opacity-40">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => sceneRef.current?.setPlaying(!playing)} className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg bg-[#0f8a74] px-4 text-sm font-semibold text-white shadow-sm">
            {playing ? <Pause className="size-4" /> : last ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
            {playing ? "პაუზა" : "გაგრძელება"}
          </button>
          <button type="button" onClick={() => go(stage + 1)} disabled={last} aria-label="შემდეგი" className="flex size-11 items-center justify-center rounded-lg bg-white text-[#111a18] shadow-sm disabled:opacity-40">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <button type="button" onClick={toggleFull} aria-label={full ? "სრული ეკრანიდან გამოსვლა" : "სრულ ეკრანზე"} className="absolute top-3 right-3 flex size-11 items-center justify-center rounded-lg bg-white/90 text-[#111a18] shadow-sm">
          {full ? <Minimize2 className="size-5" /> : <Maximize2 className="size-5" />}
        </button>
      </div>
      <div className="h-1 bg-[#eef2f0]">
        <div ref={barRef} className="h-full w-0 bg-[#0f8a74]" />
      </div>
      <div className={cn("px-5 py-4", full && "max-h-[30vh] overflow-y-auto")}>
        <ol className="flex flex-wrap gap-1.5">
          {stages.map((s, i) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === stage ? "step" : undefined}
                className={cn("flex h-9 items-center gap-2 rounded-full px-3 text-sm transition-colors", i === stage ? "bg-[#0f8a74] font-semibold text-white" : "bg-[#f1f4f3] text-[#33413e] hover:bg-[#e6ecea]")}
              >
                <span className="tabular-nums">{i + 1}</span>
                <span className="max-sm:hidden">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
        <h2 className="mt-3 text-lg">{current.title}</h2>
        <p className="mt-1 text-[15px] leading-7 text-[#33413e]">{current.text}</p>
        <p className="mt-3 text-[11px] leading-4 text-[#97a29e]">
          3D: BodyParts3D © DBCLS (CC BY 4.0); Poly Haven (CC0); Fox — PixelMannen, @tomkranis (CC BY 4.0). უჯრედები და მოლეკულები სქემატურია.
        </p>
      </div>
    </section>
  );
}
