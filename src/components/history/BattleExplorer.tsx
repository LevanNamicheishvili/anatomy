"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { JourneyScene } from "@/components/journeys/JourneyScene";
import { cn } from "@/lib/utils";
import { didgori } from "./didgori";
import { DIDGORI_FORCES, DIDGORI_SOURCES, DIDGORI_STAGES } from "./didgori-data";

const ACCENT = "#a0662b";

/** The Didgori battle simulation: stages on the left, the 3D field in the middle, the story on the right. */
export function BattleExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<JourneyScene | null>(null);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const current = DIDGORI_STAGES[stage];
  const last = stage === DIDGORI_STAGES.length - 1;

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
      { didgori },
    );
    sceneRef.current = scene;
    void scene.start("didgori");
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const go = (i: number) => {
    sceneRef.current?.goTo(i);
    sceneRef.current?.setPlaying(true);
  };

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "ისტორია", href: "/history" }} topic="დიდგორის ბრძოლა, 1121" color={ACCENT} icon="battle" />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_52dvh_minmax(0,1fr)] lg:grid-cols-[250px_minmax(0,1fr)_400px] lg:grid-rows-1">
        <nav aria-label="ბრძოლის ეტაპები" className="border-e border-[#e2e7e5] bg-white max-lg:border-e-0 max-lg:border-b">
          <ol className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0.5 lg:p-3">
            {DIDGORI_STAGES.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === stage ? "step" : undefined}
                  className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:whitespace-normal", i === stage ? "bg-[#f6efe6] font-semibold text-[#6b4218]" : "text-[#33413e] hover:bg-[#f5f7f6]")}
                >
                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i === stage ? "text-white" : "bg-[#eef2f0] text-[#66736f]")} style={i === stage ? { backgroundColor: ACCENT } : undefined}>
                    {i + 1}
                  </span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="relative min-h-0 overflow-hidden bg-[#c8d4da]">
          <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`3D სიმულაცია: ${current.title}`} />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#33413e] shadow-sm">იტვირთება ბრძოლის ველი…</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
            <span className="rounded-full bg-[#111a18]/85 px-4 py-1.5 text-sm font-semibold text-white max-sm:text-xs">
              {current.date} · {current.title}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 px-3">
            <button type="button" onClick={() => go(stage - 1)} disabled={stage === 0} aria-label="წინა" className="flex size-11 items-center justify-center rounded-lg bg-white text-[#111a18] shadow-sm disabled:opacity-40">
              <ChevronLeft className="size-5" />
            </button>
            <button type="button" onClick={() => sceneRef.current?.setPlaying(!playing)} className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: ACCENT }}>
              {playing ? <Pause className="size-4" /> : last ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
              {playing ? "პაუზა" : "გაგრძელება"}
            </button>
            <button type="button" onClick={() => go(stage + 1)} disabled={last} aria-label="შემდეგი" className="flex size-11 items-center justify-center rounded-lg bg-white text-[#111a18] shadow-sm disabled:opacity-40">
              <ChevronRight className="size-5" />
            </button>
          </div>
        </div>

        <article className="atlas-scroll min-h-0 overflow-y-auto border-s border-[#e2e7e5] bg-white px-6 py-6 max-lg:border-s-0 max-lg:border-t">
          <p className="text-xs font-semibold" style={{ color: ACCENT }}>
            {current.date}
          </p>
          <h2 className="mt-1 text-2xl">{current.title}</h2>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#eef2f0]">
            <div ref={barRef} className="h-full w-0" style={{ backgroundColor: ACCENT }} />
          </div>
          <p className="mt-4 text-[15px] leading-7 text-[#33413e]">{current.text}</p>

          <h3 className="mt-8 text-sm font-semibold text-[#66736f]">ძალები</h3>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border-s-4 border-[#c0392b] bg-[#f8f4f2] p-3">
              <p className="text-sm font-semibold">საქართველო — დავით IV</p>
              <ul className="mt-1 text-sm text-[#33413e]">
                {DIDGORI_FORCES.georgia.map((f) => (
                  <li key={f.name} className="flex justify-between gap-2">
                    <span>{f.name}</span>
                    <span className="tabular-nums">{f.n}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border-s-4 border-[#2b3a6b] bg-[#f1f3f8] p-3">
              <p className="text-sm font-semibold">სელჯუკთა კოალიცია</p>
              <ul className="mt-1 text-sm text-[#33413e]">
                {DIDGORI_FORCES.coalition.map((f) => (
                  <li key={f.name}>
                    <span className="text-[#66736f]">{f.name}: </span>
                    {f.n}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <h3 className="mt-8 text-sm font-semibold text-[#66736f]">წყაროები</h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-[#33413e]">
            {DIDGORI_SOURCES.map((s) => (
              <li key={s.label}>{"href" in s && s.href ? <a href={s.href} target="_blank" rel="noreferrer" className="underline decoration-[#c3ccc9] underline-offset-2 hover:text-[#111a18]">{s.label}</a> : s.label}</li>
            ))}
          </ul>
          <p className="mt-6 text-xs leading-5 text-[#97a29e]">
            რელიეფი: AWS Terrain Tiles; თანამგზავრული სურათი: EOxCloudless 2024 (CC BY-NC-SA 4.0), თანამედროვე ქალაქი და წყალსაცავი მოშორებულია. ჯარების განლაგება რეკონსტრუქციაა წყაროების აღწერით; ერთი ფიგურა ≈ 100 მეომარი (კოალიციის რიცხვი სქემატურია).
          </p>
        </article>
      </div>
    </div>
  );
}
