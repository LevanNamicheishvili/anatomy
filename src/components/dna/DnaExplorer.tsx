"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { cn } from "@/lib/utils";
import { DnaScene, type DnaOptions } from "./DnaScene";
import { BASE_COLORS, BASE_INFO, BASE_NAMES, CODONS, GLOBIN, MRNA, SECTIONS, STEP_INFO, STEP_NAMES, type Base, type ChromosomeStep } from "./dna-data";

const ACCENT = "#3a5bc7";
const BASES: Base[] = ["A", "T", "G", "C"];
const STEPS: ChromosomeStep[] = ["nucleosome", "fiber", "chromosome"];

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
      <div className="flex gap-1.5 overflow-x-auto rounded-lg border border-[#e2e7e5] bg-white/95 p-1.5 shadow-sm backdrop-blur">{children}</div>
    </div>
  );
}

function BaseLetter({ base }: { base: string }) {
  return (
    <span className="inline-flex size-6 items-center justify-center rounded text-xs font-bold text-white" style={{ backgroundColor: BASE_COLORS[base as Base] }}>
      {base}
    </span>
  );
}

/** Colour key for the four bases and the backbone. */
function Legend({ rna }: { rna?: boolean }) {
  const list: (Base | "U")[] = rna ? ["A", "U", "G", "C"] : BASES;
  return (
    <section className="mt-6 rounded-xl border border-[#e2e7e5] p-4">
      <h3 className="text-sm font-semibold">ფერები</h3>
      <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
        {list.map((b) => (
          <li key={b} className="flex items-center gap-2">
            <BaseLetter base={b} />
            {BASE_NAMES[b]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="size-6 rounded-full bg-[#f08c2e]" />
          ფოსფატი
        </li>
        <li className="flex items-center gap-2">
          <span className="size-6 rounded-full bg-[#c8d0da]" />
          {rna ? "შაქარი" : "დეზოქსირიბოზა"}
        </li>
      </ul>
    </section>
  );
}

/** β-globin codons, normal or with the sickle-cell change, with the amino acids they code. */
function GlobinStrip({ mutant }: { mutant: boolean }) {
  const codons = mutant ? GLOBIN.mutant : GLOBIN.normal;
  const amino = mutant ? GLOBIN.aminoMutant : GLOBIN.aminoNormal;
  return (
    <section className="mt-6 rounded-xl border border-[#e2e7e5] p-4">
      <h3 className="text-sm font-semibold">ჰემოგლობინის გენი · კოდონები 1–7</h3>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {codons.map((c, i) => {
          const changed = i === 5;
          return (
            <div key={i} className={cn("rounded-md border px-2 py-1.5 text-center", changed ? (mutant ? "border-[#d9434f] bg-[#fdf3f2]" : "border-[#2f9e62] bg-[#e6f3ef]") : "border-[#e2e7e5]")}>
              <div className="font-mono text-sm font-semibold tracking-wider">{c}</div>
              <div className={cn("mt-0.5 text-xs", changed ? "font-semibold" : "text-[#66736f]")}>{amino[i]}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm leading-6 text-[#33413e]">
        {mutant
          ? "მე-6 კოდონში A შეიცვალა T-თი: GAG → GTG. გლუტამინის მჟავის (Glu) ნაცვლად ვალინი (Val) ჩაერთვება."
          : "ნორმალურ გენში მე-6 კოდონი GAG-ია და გლუტამინის მჟავას (Glu) შიფრავს. გადართე „მუტაცია“."}
      </p>
    </section>
  );
}

function CodonTable() {
  return (
    <section className="mt-6 rounded-xl border border-[#e2e7e5] p-4">
      <h3 className="text-sm font-semibold">ანიმაციის ი-რნმ</h3>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[#66736f]">
            <th className="pb-2 font-medium">კოდონი</th>
            <th className="pb-2 font-medium">ამინომჟავა</th>
          </tr>
        </thead>
        <tbody>
          {MRNA.map((c) => (
            <tr key={c} className="border-t border-[#eef2f0]">
              <td className="py-1.5 font-mono font-semibold tracking-wider">{c}</td>
              <td className="py-1.5">
                {CODONS[c].name}
                {CODONS[c].short !== "—" && <span className="text-[#66736f]"> · {CODONS[c].short}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** `initial`: section to open first (its view name), e.g. from a textbook lesson link. */
export function DnaExplorer({ initial }: { initial?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DnaScene | null>(null);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(() => Math.max(0, SECTIONS.findIndex((s) => s.view === initial)));
  const [opts, setOpts] = useState<DnaOptions>({ mode: "atoms", base: "A", step: "nucleosome", mutant: false });
  const section = SECTIONS[index];
  const set = (patch: Partial<DnaOptions>) => setOpts((o) => ({ ...o, ...patch }));

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const scene = new DnaScene(canvas, overlay, () => setReady(true));
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setView(section.view, opts);
  }, [section.view, opts]);

  const modeChips = (
    <>
      <Chip active={opts.mode === "atoms"} onClick={() => set({ mode: "atoms" })}>
        ატომები
      </Chip>
      <Chip active={opts.mode === "scheme"} onClick={() => set({ mode: "scheme" })}>
        სქემა
      </Chip>
    </>
  );

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "ბიოლოგია", href: "/biology" }} topic="დნმ და მემკვიდრეობა" color={ACCENT} icon="dna">
        <Link href="/biology/blood" className="rounded-md px-3 py-1.5 text-sm font-medium text-[#33413e] hover:bg-[#eef2f0] max-sm:hidden">
          სისხლი
        </Link>
      </TopicHeader>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_42dvh_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_400px] lg:grid-rows-1">
        <nav aria-label="თემის ნაწილები" className="border-e border-[#e2e7e5] bg-white max-lg:border-e-0 max-lg:border-b">
          <ol className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0.5 lg:p-3">
            {SECTIONS.map((s, i) => (
              <li key={s.view}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:whitespace-normal",
                    i === index ? "bg-[#eaeefb] font-semibold text-[#26408f]" : "text-[#33413e] hover:bg-[#f5f7f6]",
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
          <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`3D: ${section.title}`} />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0" />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-lg bg-white px-4 py-2.5 text-sm font-medium shadow-sm">მოლეკულა იტვირთება…</span>
            </div>
          )}
          {section.view === "helix" && <Toolbar>{modeChips}</Toolbar>}
          {section.view === "nucleotide" && (
            <Toolbar>
              {BASES.map((b) => (
                <Chip key={b} active={opts.base === b} onClick={() => set({ base: b })}>
                  {b} · {BASE_NAMES[b]}
                </Chip>
              ))}
            </Toolbar>
          )}
          {section.view === "chromosome" && (
            <Toolbar>
              {STEPS.map((s, i) => (
                <Chip key={s} active={opts.step === s} onClick={() => set({ step: s })}>
                  {i + 1}. {STEP_NAMES[s]}
                </Chip>
              ))}
            </Toolbar>
          )}
          {section.view === "mutation" && (
            <Toolbar>
              <Chip active={!opts.mutant} onClick={() => set({ mutant: false })}>
                ნორმა
              </Chip>
              <Chip active={opts.mutant} onClick={() => set({ mutant: true })}>
                მუტაცია
              </Chip>
              <span className="mx-1 w-px bg-[#e2e7e5]" />
              {modeChips}
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

          {section.view === "nucleotide" && (
            <section className="mt-6 rounded-xl border border-[#e2e7e5] p-4">
              <div className="flex items-center gap-2">
                <BaseLetter base={opts.base} />
                <h3 className="text-base font-semibold">{BASE_NAMES[opts.base]}</h3>
                <span className="ms-auto text-xs text-[#66736f]">{BASE_INFO[opts.base].kind}</span>
              </div>
              <p className="mt-2 text-[15px] leading-7 text-[#33413e]">{BASE_INFO[opts.base].text}</p>
            </section>
          )}
          {section.view === "chromosome" && (
            <section className="mt-6 rounded-xl border border-[#e2e7e5] p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold">{STEP_NAMES[opts.step]}</h3>
                <span className="text-xs text-[#66736f]">სისქე {STEP_INFO[opts.step].size}</span>
              </div>
              <p className="mt-2 text-[15px] leading-7 text-[#33413e]">{STEP_INFO[opts.step].text}</p>
            </section>
          )}
          {section.view === "mutation" && <GlobinStrip mutant={opts.mutant} />}

          <div className="mt-5 flex flex-col gap-4">
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="text-[15px] leading-7 text-[#33413e]">
                {p}
              </p>
            ))}
          </div>

          {section.view === "translation" && <CodonTable />}
          {(section.view === "helix" || section.view === "pairing") && <Legend />}
          {(section.view === "transcription" || section.view === "translation") && <Legend rna />}

          <div className="mt-8 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-[#d5dcd9] text-sm font-semibold hover:bg-[#f5f7f6] disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
              წინა
            </button>
            <button
              type="button"
              disabled={index === SECTIONS.length - 1}
              onClick={() => setIndex(index + 1)}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-[#111a18] text-sm font-semibold text-white hover:bg-[#2a3532] disabled:opacity-40"
            >
              შემდეგი
              <ChevronRight className="size-4" />
            </button>
          </div>

          <p className="mt-8 text-xs leading-5 text-[#97a29e]">
            მოლეკულები: RCSB Protein Data Bank — 1BNA (Drew et al., 1981) და 1KX5 (Davey et al., 2002), CC0. პროცესები ნაჩვენებია გამარტივებული მოდელით.
          </p>
        </article>
      </div>
    </div>
  );
}
