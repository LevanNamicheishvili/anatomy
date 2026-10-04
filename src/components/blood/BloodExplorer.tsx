"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { cn } from "@/lib/utils";
import { BloodScene } from "./BloodScene";
import { GROUP_NAMES, SECTIONS, WBC, compatible, type BloodGroup, type WbcKind } from "./blood-data";

const GROUPS: BloodGroup[] = ["O", "A", "B", "AB"];
const WBC_ORDER: WbcKind[] = ["neutrophil", "eosinophil", "basophil", "lymphocyte", "monocyte"];

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

/** Pick donor and recipient; see whether red cells can be given. */
function Compatibility() {
  const [donor, setDonor] = useState<BloodGroup>("O");
  const [donorRh, setDonorRh] = useState(false);
  const [recipient, setRecipient] = useState<BloodGroup>("A");
  const [recipientRh, setRecipientRh] = useState(true);
  const result = compatible(donor, donorRh, recipient, recipientRh);
  const side = (title: string, g: BloodGroup, setG: (g: BloodGroup) => void, rh: boolean, setRh: (v: boolean) => void) => (
    <div>
      <p className="text-xs font-semibold text-[#66736f]">{title}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {GROUPS.map((x) => (
          <Chip key={x} active={g === x} onClick={() => setG(x)}>
            {GROUP_NAMES[x]}
          </Chip>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        <Chip active={rh} onClick={() => setRh(true)}>
          Rh+
        </Chip>
        <Chip active={!rh} onClick={() => setRh(false)}>
          Rh−
        </Chip>
      </div>
    </div>
  );
  return (
    <section className="mt-6 rounded-xl border border-[#e2e7e5] p-4">
      <h3 className="text-sm font-semibold">გადასხმის შემოწმება</h3>
      <div className="mt-3 grid gap-4">
        {side("დონორი", donor, setDonor, donorRh, setDonorRh)}
        {side("მიმღები", recipient, setRecipient, recipientRh, setRecipientRh)}
      </div>
      <div
        className={cn(
          "mt-4 flex items-start gap-2 rounded-md px-3 py-2.5 text-sm leading-6",
          result.ok ? "bg-[#e6f3ef] text-[#0c5c4d]" : "bg-[#fdf3f2] text-[#912018]",
        )}
      >
        {result.ok ? <Check className="mt-1 size-4 shrink-0" /> : <X className="mt-1 size-4 shrink-0" />}
        <span>
          {result.ok
            ? "თავსებადია — დონორის ერითროციტებზე არ არის ანტიგენი, რომელიც მიმღებს არ აქვს."
            : !result.abo
              ? "არ შეიძლება — მიმღების ანტისხეულები დონორის ერითროციტებს შეაწებებს."
              : "არ შეიძლება — Rh− მიმღებს Rh+ სისხლი არ გადაესხმება."}
        </span>
      </div>
    </section>
  );
}

export function BloodExplorer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BloodScene | null>(null);
  const [index, setIndex] = useState(0);
  const [wbc, setWbc] = useState<WbcKind>("neutrophil");
  const [group, setGroup] = useState<BloodGroup>("A");
  const [rh, setRh] = useState(true);
  const section = SECTIONS[index];

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const scene = new BloodScene(canvas, overlay);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setView(section.view, { wbc, group, rh });
  }, [section.view, wbc, group, rh]);

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f5] font-sans text-[#111a18]">
      <TopicHeader subject={{ name: "ბიოლოგია", href: "/biology" }} topic="სისხლი" color="#b8232b" icon="blood">
        <Link href="/anatomy" className="rounded-md px-3 py-1.5 text-sm font-medium text-[#33413e] hover:bg-[#eef2f0] max-sm:hidden">
          ადამიანის ატლასი
        </Link>
      </TopicHeader>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[auto_42dvh_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_400px] lg:grid-rows-1">
        {/* Sections, in reading order. */}
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
                    i === index ? "bg-[#fbeceb] font-semibold text-[#8f1c22]" : "text-[#33413e] hover:bg-[#f5f7f6]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      i === index ? "bg-[#b8232b] text-white" : "bg-[#eef2f0] text-[#66736f]",
                    )}
                  >
                    {i + 1}
                  </span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <div className="relative min-h-0 overflow-hidden">
          <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`3D: ${section.title}`} />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0" />
          {section.view === "wbc" && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
              <div className="flex gap-1.5 overflow-x-auto rounded-lg border border-[#e2e7e5] bg-white/95 p-1.5 shadow-sm backdrop-blur">
                {WBC_ORDER.map((k) => (
                  <Chip key={k} active={wbc === k} onClick={() => setWbc(k)}>
                    {WBC[k].name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {section.view === "groups" && (
            <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
              <div className="flex gap-1.5 overflow-x-auto rounded-lg border border-[#e2e7e5] bg-white/95 p-1.5 shadow-sm backdrop-blur">
                {GROUPS.map((g) => (
                  <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
                    {GROUP_NAMES[g]}
                  </Chip>
                ))}
                <span className="mx-1 w-px bg-[#e2e7e5]" />
                <Chip active={rh} onClick={() => setRh(!rh)}>
                  {rh ? "Rh+" : "Rh−"}
                </Chip>
              </div>
            </div>
          )}
        </div>

        <article className="atlas-scroll min-h-0 overflow-y-auto border-s border-[#e2e7e5] bg-white px-6 py-6 max-lg:border-s-0 max-lg:border-t">
          <p className="text-xs font-semibold text-[#b8232b]">
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

          {section.view === "wbc" && (
            <section className="mt-6 rounded-xl border border-[#e2e7e5] p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold">{WBC[wbc].name}</h3>
                <span className="text-xs text-[#66736f]">
                  {WBC[wbc].group} · {WBC[wbc].share}
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-7 text-[#33413e]">{WBC[wbc].text}</p>
            </section>
          )}
          {section.view === "groups" && <Compatibility />}

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
        </article>
      </div>
    </div>
  );
}
