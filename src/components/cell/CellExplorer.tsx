"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { cn } from "@/lib/utils";
import { CellScene } from "./CellScene";
import { ANIMAL_ORGANELLES, MEIOSIS_PHASES, MITOSIS_PHASES, ORGANELLES, PLANT_ORGANELLES, SECTIONS, type OrganelleId } from "./cell-data";

const ACCENT = "#0f8a74";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 rounded-md border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
        active ? "border-[#111a18] bg-[#111a18] text-white" : "border-[#d5dcd9] bg-white text-[#33413e] hover:bg-[#f5f7f6]",
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
      <div className="flex max-w-full gap-1.5 overflow-x-auto rounded-lg border border-[#e2e7e5] bg-white/95 p-1.5 shadow-sm backdrop-blur">{children}</div>
    </div>
  );
}

const MEMBRANES: Record<string, string> = {
  nucleus: "ორმემბრანიანი",
  mitochondrion: "ორმემბრანიანი",
  chloroplast: "ორმემბრანიანი",
  rer: "ერთმემბრანიანი",
  ser: "ერთმემბრანიანი",
  golgi: "ერთმემბრანიანი",
  lysosome: "ერთმემბრანიანი",
  vacuole: "ერთმემბრანიანი",
  ribosome: "უმემბრანო",
  nucleolus: "უმემბრანო",
  centriole: "უმემბრანო",
  cytoskeleton: "უმემბრანო",
};

export function CellExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CellScene | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<OrganelleId | null>(null);
  const [labels, setLabels] = useState(true);
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(true);
  const section = SECTIONS[index];
  const organelles = section.view === "animal" ? ANIMAL_ORGANELLES : section.view === "plant" ? PLANT_ORGANELLES : null;
  const phases = section.view === "mitosis" ? MITOSIS_PHASES : section.view === "meiosis" ? MEIOSIS_PHASES : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const scene = new CellScene(canvas, overlay, { onPick: setPicked, onPhase: setPhase });
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
    sceneRef.current?.select(picked);
  }, [picked, section.view]);
  useEffect(() => {
    sceneRef.current?.setLabels(labels);
  }, [labels, section.view]);
  useEffect(() => {
    sceneRef.current?.setPlaying(playing);
  }, [playing]);

  const go = (i: number) => {
    setIndex(i);
    setPicked(null);
    setPhase(0);
    setPlaying(true);
  };
  const pickedInfo = picked ? ORGANELLES[picked] : null;

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "ბიოლოგია", href: "/biology" }} topic="უჯრედი" color={ACCENT} icon="cell">
        <Link href="/biology/dna" className="rounded-md px-3 py-1.5 text-sm font-medium text-[#33413e] hover:bg-[#eef2f0] max-sm:hidden">
          დნმ
        </Link>
      </TopicHeader>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_44dvh_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_400px] lg:grid-rows-1">
        <nav aria-label="თემის ნაწილები" className="border-e border-[#e2e7e5] bg-white max-lg:border-e-0 max-lg:border-b">
          <ol className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0.5 lg:p-3">
            {SECTIONS.map((s, i) => (
              <li key={s.view}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:whitespace-normal",
                    i === index ? "bg-[#e6f3ef] font-semibold text-[#0c5c4d]" : "text-[#33413e] hover:bg-[#f5f7f6]",
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

        <div className="relative min-h-0 overflow-hidden bg-[radial-gradient(ellipse_at_center,#ffffff_0%,#eef1f0_75%)]">
          <canvas ref={canvasRef} className={cn("absolute inset-0 size-full touch-none", organelles && "cursor-pointer")} aria-label={`3D: ${section.title}`} />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
          {phases && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3">
              <span className="rounded-full bg-[#111a18]/85 px-4 py-1.5 text-sm font-semibold text-white">
                {phase + 1}. {phases[phase]?.name}
              </span>
            </div>
          )}
          {organelles && (
            <Toolbar>
              <Chip active={labels} onClick={() => setLabels(!labels)}>
                წარწერები
              </Chip>
              {picked && (
                <Chip active={false} onClick={() => setPicked(null)}>
                  მონიშვნის მოხსნა
                </Chip>
              )}
            </Toolbar>
          )}
          {phases && (
            <Toolbar>
              <button
                type="button"
                onClick={() => setPlaying(!playing)}
                aria-label={playing ? "პაუზა" : "გაგრძელება"}
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#111a18] text-white"
              >
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              {phases.map((p, i) => (
                <Chip
                  key={p.name}
                  active={phase === i}
                  onClick={() => {
                    sceneRef.current?.jumpToPhase(i);
                    setPhase(i);
                  }}
                >
                  {p.name}
                </Chip>
              ))}
            </Toolbar>
          )}
        </div>

        <article className="atlas-scroll min-h-0 overflow-y-auto border-s border-[#e2e7e5] bg-white px-6 py-6 max-lg:border-s-0 max-lg:border-t">
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

          {pickedInfo && picked && (
            <section className="mt-6 rounded-xl border-2 p-4" style={{ borderColor: pickedInfo.color }}>
              <div className="flex items-center gap-2">
                <span className="size-3.5 shrink-0 rounded-full" style={{ background: pickedInfo.color }} />
                <h3 className="text-base font-semibold">{pickedInfo.name}</h3>
              </div>
              <p className="mt-1 text-xs text-[#66736f]">
                {pickedInfo.in === "both" ? "ცხოველურ და მცენარეულ უჯრედებში" : pickedInfo.in === "plant" ? "მხოლოდ მცენარეულ უჯრედებში" : "ცხოველურ უჯრედებში"}
                {MEMBRANES[picked] ? ` · ${MEMBRANES[picked]}` : ""}
              </p>
              <p className="mt-3 text-[15px] leading-7 text-[#33413e]">{pickedInfo.text}</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {pickedInfo.facts.map((f) => (
                  <li key={f} className="rounded-md bg-[#f5f7f6] px-3 py-1.5 text-sm">
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {organelles && (
            <section className="mt-6">
              <h3 className="text-xs font-semibold text-[#66736f]">ორგანოიდები — დააჭირე</h3>
              <ul className="mt-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-1">
                {organelles.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setPicked(picked === id ? null : id)}
                      aria-current={picked === id ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                        picked === id ? "bg-[#e6f3ef] font-semibold text-[#0c5c4d]" : "text-[#33413e] hover:bg-[#f5f7f6]",
                      )}
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: ORGANELLES[id].color }} />
                      {ORGANELLES[id].name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {phases && (
            <section className="mt-6 rounded-xl border border-[#e2e7e5] p-4">
              <p className="text-xs font-semibold" style={{ color: ACCENT }}>
                ფაზა {phase + 1} / {phases.length}
              </p>
              <h3 className="mt-0.5 text-base font-semibold">{phases[phase]?.name}</h3>
              <p className="mt-2 text-[15px] leading-7 text-[#33413e]">{phases[phase]?.text}</p>
            </section>
          )}

          <div className="mt-5 flex flex-col gap-4">
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="text-[15px] leading-7 text-[#33413e]">
                {p}
              </p>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => go(index - 1)}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-[#d5dcd9] text-sm font-semibold hover:bg-[#f5f7f6] disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              წინა
            </button>
            <button
              type="button"
              disabled={index === SECTIONS.length - 1}
              onClick={() => go(index + 1)}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-[#111a18] text-sm font-semibold text-white hover:bg-[#2a3532] disabled:opacity-40"
            >
              შემდეგი
              <ChevronRight className="size-4" />
            </button>
          </div>
        </article>
      </div>
    </div>
  );
}
