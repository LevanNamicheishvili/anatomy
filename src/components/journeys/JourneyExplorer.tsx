"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { cn } from "@/lib/utils";
import { JourneyScene, type Builder } from "./JourneyScene";
import { JOURNEYS, JOURNEY_BY_ID, type JourneyId } from "./journeys-data";
import { bloodJourney } from "./journey-blood";
import { zoomJourney } from "./journey-zoom";
import { boneJourney } from "./journey-bone";
import { impulseJourney, muscleJourney } from "./journey-arm";

const BUILDERS: Record<JourneyId, Builder> = { blood: bloodJourney, zoom: zoomJourney, bone: boneJourney, muscle: muscleJourney, impulse: impulseJourney };

export function JourneyExplorer({ initial }: { initial: JourneyId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<JourneyScene | null>(null);
  const [id, setId] = useState<JourneyId>(initial);
  const [stage, setStage] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [loading, setLoading] = useState(true);
  const journey = JOURNEY_BY_ID[id];
  const current = journey.stages[stage] ?? journey.stages[0];

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
      BUILDERS,
    );
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);
  useEffect(() => {
    void sceneRef.current?.start(id);
  }, [id]);

  const choose = (next: JourneyId) => {
    if (next === id) return;
    setStage(0);
    setId(next);
    window.history.replaceState(null, "", `/biology/journeys?j=${next}`);
  };
  const go = (i: number) => {
    sceneRef.current?.goTo(i);
    sceneRef.current?.setPlaying(true);
  };
  const last = stage === journey.stages.length - 1;

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "ბიოლოგია", href: "/biology" }} topic="მოგზაურობა სხეულში" color={journey.color} icon="journey" />

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_48dvh_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)_400px] lg:grid-rows-1">
        <nav aria-label="მოგზაურობები" className="border-e border-[#e2e7e5] bg-white max-lg:border-e-0 max-lg:border-b">
          <ol className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-1 lg:p-3">
            {JOURNEYS.map((j) => (
              <li key={j.id}>
                <button
                  type="button"
                  onClick={() => choose(j.id)}
                  aria-current={j.id === id ? "page" : undefined}
                  className={cn("flex w-full flex-col items-start rounded-md border-s-4 px-3 py-2 text-left transition-colors max-lg:whitespace-nowrap", j.id === id ? "bg-[#f5f7f6]" : "border-transparent hover:bg-[#f5f7f6]")}
                  style={j.id === id ? { borderColor: j.color } : undefined}
                >
                  <span className={cn("text-sm", j.id === id ? "font-semibold" : "text-[#33413e]")}>{j.title}</span>
                  <span className="text-xs text-[#66736f] max-lg:hidden">{j.subtitle}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="relative min-h-0 overflow-hidden bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#eef1f0_75%)]">
          <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`3D: ${journey.title} — ${current.title}`} />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-[#33413e] shadow-sm">იტვირთება…</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
            <span className="rounded-full bg-[#111a18]/85 px-4 py-1.5 text-sm font-semibold text-white max-sm:text-xs">
              {stage + 1}. {current.title}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 px-3">
            <button type="button" onClick={() => go(stage - 1)} disabled={stage === 0} aria-label="წინა ეტაპი" className="flex size-11 items-center justify-center rounded-lg bg-white text-[#111a18] shadow-sm disabled:opacity-40">
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => sceneRef.current?.setPlaying(!playing)}
              className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg bg-[#111a18] px-4 text-sm font-semibold text-white shadow-sm"
            >
              {playing ? <Pause className="size-4" /> : last ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
              {playing ? "პაუზა" : "გაგრძელება"}
            </button>
            <button type="button" onClick={() => go(stage + 1)} disabled={last} aria-label="შემდეგი ეტაპი" className="flex size-11 items-center justify-center rounded-lg bg-white text-[#111a18] shadow-sm disabled:opacity-40">
              <ChevronRight className="size-5" />
            </button>
          </div>
          {!playing && <p className="pointer-events-none absolute bottom-16 w-full text-center text-xs text-[#66736f]">პაუზისას მოდელი შეგიძლია მოატრიალო</p>}
        </div>

        <article className="atlas-scroll min-h-0 overflow-y-auto border-s border-[#e2e7e5] bg-white px-6 py-6 max-lg:border-s-0 max-lg:border-t">
          <p className="text-xs font-semibold" style={{ color: journey.color }}>
            {journey.title} · კლასი {journey.grades}
          </p>
          <h2 className="mt-1 text-2xl">{current.title}</h2>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#eef2f0]">
            <div ref={barRef} className="h-full w-0" style={{ backgroundColor: journey.color }} />
          </div>
          <p className="mt-4 text-[15px] leading-7 text-[#33413e]">{current.text}</p>
          <ol className="mt-6 flex flex-col gap-0.5">
            {journey.stages.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === stage ? "step" : undefined}
                  className={cn("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors", i === stage ? "bg-[#f5f7f6] font-semibold" : "text-[#33413e] hover:bg-[#f5f7f6]")}
                >
                  <span
                    className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i === stage ? "text-white" : i < stage ? "bg-[#dfe6e3] text-[#33413e]" : "bg-[#eef2f0] text-[#97a29e]")}
                    style={i === stage ? { backgroundColor: journey.color } : undefined}
                  >
                    {i + 1}
                  </span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs leading-5 text-[#97a29e]">
            სხეული: BodyParts3D © DBCLS (CC BY 4.0), ფილტვები: Z-Anatomy (CC BY-SA 4.0). უჯრედები, ქსოვილები და ზურგის ტვინი — სქემატური, ზომები მასშტაბში არ არის.
          </p>
        </article>
      </div>
    </div>
  );
}
