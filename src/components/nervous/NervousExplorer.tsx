"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { SectionPager } from "@/components/portal/controls";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { explorerGrid, explorerPage, explorerText } from "@/components/portal/ui";
import { cn } from "@/lib/utils";
import { NervousScene } from "./NervousScene";
import { SECTIONS } from "./nervous-data";

const ACCENT = "#7d5ba6";

/** `initial`: section to open first (its view name), e.g. from a textbook lesson link. */
export function NervousExplorer({ initial }: { initial?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<NervousScene | null>(null);
  const [index, setIndex] = useState(() => Math.max(0, SECTIONS.findIndex((s) => s.view === initial)));
  const [step, setStep] = useState("");
  const [playing, setPlaying] = useState(true);
  const section = SECTIONS[index];

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const scene = new NervousScene(canvas, overlay, setStep);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);
  useEffect(() => {
    sceneRef.current?.setView(section.view);
  }, [section.view]);
  useEffect(() => {
    if (sceneRef.current) sceneRef.current.playing = playing;
  }, [playing]);

  return (
    <div className={explorerPage}>
      <TopicHeader subject={{ name: "ბიოლოგია", href: "/biology" }} topic="ნერვული სისტემა" color={ACCENT} icon="nerve">
        <Link href="/topic/brain" className="rounded-md px-3 py-1.5 text-sm font-medium text-[#33413e] hover:bg-[#eef2f0] max-sm:hidden">
          თავის ტვინი ატლასში
        </Link>
        <Link href="/biology/journeys?j=impulse" className="rounded-md px-3 py-1.5 text-sm font-medium text-[#33413e] hover:bg-[#eef2f0] max-sm:hidden">
          იმპულსის გზა კუნთამდე
        </Link>
      </TopicHeader>

      <div className={cn(explorerGrid, "lg:grid-cols-[240px_minmax(0,1fr)_400px]")}>
        <nav aria-label="თემის ნაწილები" className="border-e border-[#e2e7e5] bg-white max-lg:border-e-0 max-lg:border-b">
          <ol className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0.5 lg:p-3">
            {SECTIONS.map((s, i) => (
              <li key={s.view}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:whitespace-normal",
                    i === index ? "bg-[#f1ebf8] font-semibold text-[#4f3478]" : "text-[#33413e] hover:bg-[#f5f7f6]",
                  )}
                >
                  <span
                    className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i === index ? "text-white" : "bg-[#eef2f0] text-[#66736f]")}
                    style={i === index ? { backgroundColor: ACCENT } : undefined}
                  >
                    {i + 1}
                  </span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="relative isolate min-h-0 overflow-hidden bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#eef1f0_75%)]">
          <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`3D: ${section.title}`} />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
          {step && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3 max-sm:top-[88px] max-sm:justify-end">
              <span className="rounded-full bg-[#111a18]/85 px-4 py-1.5 text-sm font-semibold text-white max-sm:text-xs">{step}</span>
            </div>
          )}
          <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
            <button
              type="button"
              onClick={() => setPlaying(!playing)}
              aria-label={playing ? "პაუზა" : "გაგრძელება"}
              className="flex h-11 items-center gap-2 rounded-lg bg-[#111a18] px-5 text-sm font-semibold text-white shadow-panel"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              {playing ? "პაუზა" : "გაგრძელება"}
            </button>
          </div>
        </div>

        <article className={explorerText}>
          <p className="text-xs font-semibold" style={{ color: ACCENT }}>
            {index + 1} / {SECTIONS.length}
          </p>
          <h2 className="mt-1 text-2xl">{section.title}</h2>
          <p className="mt-1 text-sm text-[#66736f]">{section.subtitle}</p>
          <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {section.facts.map((f) => (
              <div key={f.label} className="rounded-lg bg-[#f5f7f6] px-3 py-2.5">
                <dt className="text-[11px] leading-4 text-[#66736f]">{f.label}</dt>
                <dd className="mt-1 text-sm leading-5 font-semibold [overflow-wrap:anywhere]">{f.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-5 flex flex-col gap-4">
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="text-[15px] leading-7 text-[#33413e]">
                {p}
              </p>
            ))}
          </div>
          <SectionPager index={index} count={SECTIONS.length} onGo={setIndex} />
        </article>
      </div>
    </div>
  );
}
