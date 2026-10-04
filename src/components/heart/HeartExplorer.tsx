"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { cn } from "@/lib/utils";
import { HeartScene, type HeartOptions } from "./HeartScene";
import { PARTS, PHASES, SECTIONS, STRUCTURE_PARTS, type Circuit, type HeartPart } from "./heart-data";

const ACCENT = "#c62f36";

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

const CIRCUITS: { id: Circuit; name: string }[] = [
  { id: "both", name: "ორივე წრე" },
  { id: "pulmonary", name: "მცირე წრე" },
  { id: "systemic", name: "დიდი წრე" },
];

export function HeartExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HeartScene | null>(null);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<HeartPart | null>(null);
  const [phase, setPhase] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opts, setOpts] = useState<HeartOptions>({ circuit: "both", disease: false, slow: true, playing: true });
  const section = SECTIONS[index];
  const set = (patch: Partial<HeartOptions>) => setOpts((o) => ({ ...o, ...patch }));
  const animated = section.view === "cycle" || section.view === "pulse";

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const scene = new HeartScene(canvas, overlay, { onPick: setPicked, onPhase: setPhase, onLoading: setLoading });
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setView(section.view, opts);
  }, [section.view, opts]);
  useEffect(() => {
    sceneRef.current?.select(picked);
  }, [picked, section.view]);

  const go = (i: number) => {
    setIndex(i);
    setPicked(null);
  };
  const info = picked ? PARTS[picked] : null;

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "ბიოლოგია", href: "/biology" }} topic="გული და სისხლის მიმოქცევა" color={ACCENT} icon="heart">
        <Link href="/biology/blood" className="rounded-md px-3 py-1.5 text-sm font-medium text-[#33413e] hover:bg-[#eef2f0] max-sm:hidden">
          სისხლი
        </Link>
      </TopicHeader>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_46dvh_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_400px] lg:grid-rows-1">
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
                    i === index ? "bg-[#fbeceb] font-semibold text-[#8f1c22]" : "text-[#33413e] hover:bg-[#f5f7f6]",
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
          <canvas ref={canvasRef} className={cn("absolute inset-0 size-full touch-none", section.view === "structure" && "cursor-pointer")} aria-label={`3D: ${section.title}`} />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0 overflow-hidden" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium shadow-sm">გულის მოდელი იტვირთება…</span>
            </div>
          )}
          {section.view === "cycle" && (
            <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center px-3 max-sm:top-[88px] max-sm:justify-end">
              <span className="rounded-full bg-[#111a18]/85 px-4 py-1.5 text-sm font-semibold text-white max-sm:px-3 max-sm:text-xs">
                {PHASES[phase].name} · {PHASES[phase].duration}
              </span>
            </div>
          )}
          {animated && (
            <Toolbar>
              <button
                type="button"
                onClick={() => set({ playing: !opts.playing })}
                aria-label={opts.playing ? "პაუზა" : "გაგრძელება"}
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#111a18] text-white"
              >
                {opts.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              </button>
              <Chip active={opts.slow} onClick={() => set({ slow: true })}>
                შენელებით
              </Chip>
              <Chip active={!opts.slow} onClick={() => set({ slow: false })}>
                ნამდვილი სიჩქარე (75/წთ)
              </Chip>
            </Toolbar>
          )}
          {section.view === "circulation" && (
            <Toolbar>
              {CIRCUITS.map((c) => (
                <Chip key={c.id} active={opts.circuit === c.id} onClick={() => set({ circuit: c.id })}>
                  {c.name}
                </Chip>
              ))}
            </Toolbar>
          )}
          {section.view === "diseases" && (
            <Toolbar>
              <Chip active={!opts.disease} onClick={() => set({ disease: false })}>
                ჯანმრთელი არტერია
              </Chip>
              <Chip active={opts.disease} onClick={() => set({ disease: true })}>
                ათეროსკლეროზი
              </Chip>
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

          {section.view === "structure" && info && (
            <section className="mt-6 rounded-xl border-2 p-4" style={{ borderColor: info.color }}>
              <div className="flex items-center gap-2">
                <span className="size-3.5 shrink-0 rounded-full" style={{ background: info.color }} />
                <h3 className="text-base font-semibold">{info.name}</h3>
              </div>
              {info.blood && <p className="mt-1 text-xs text-[#66736f]">{info.blood === "arterial" ? "არტერიული სისხლი — ჟანგბადით მდიდარი" : "ვენური სისხლი — ჟანგბადით ღარიბი"}</p>}
              <p className="mt-3 text-[15px] leading-7 text-[#33413e]">{info.text}</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {info.facts.map((f) => (
                  <li key={f} className="rounded-md bg-[#f5f7f6] px-3 py-1.5 text-sm">
                    {f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {section.view === "structure" && (
            <section className="mt-6">
              <h3 className="text-xs font-semibold text-[#66736f]">გულის ნაწილები — დააჭირე</h3>
              <ul className="mt-2 grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-1">
                {STRUCTURE_PARTS.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setPicked(picked === id ? null : id)}
                      aria-current={picked === id ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                        picked === id ? "bg-[#fbeceb] font-semibold text-[#8f1c22]" : "text-[#33413e] hover:bg-[#f5f7f6]",
                      )}
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: PARTS[id].color }} />
                      {PARTS[id].name}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {section.view === "cycle" && (
            <section className="mt-6 rounded-xl border border-[#e2e7e5] p-4">
              <ol className="flex flex-col gap-3">
                {PHASES.map((p, i) => (
                  <li key={p.name} className={cn("rounded-lg px-3 py-2 transition-colors", i === phase ? "bg-[#fbeceb]" : "")}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={cn("text-sm font-semibold", i === phase && "text-[#8f1c22]")}>{p.name}</span>
                      <span className="text-xs text-[#66736f]">{p.duration}</span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#33413e]">{p.text}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="mt-5 flex flex-col gap-4">
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="text-[15px] leading-7 text-[#33413e]">
                {p}
              </p>
            ))}
          </div>

          {(section.view === "structure" || section.view === "cycle" || section.view === "circulation") && (
            <p className="mt-6 text-[11px] leading-5 text-[#97a29e]">გულისა და ფილტვების მოდელი: BodyParts3D © DBCLS (CC BY 4.0), Z-Anatomy (CC BY-SA 4.0).</p>
          )}

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
