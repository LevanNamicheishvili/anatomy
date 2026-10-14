"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Panel, PillButton, SectionPager } from "@/components/portal/controls";
import { TopicHeader } from "@/components/portal/TopicHeader";
import { explorerGrid, explorerPage, explorerText } from "@/components/portal/ui";
import { FullscreenButton, useFullscreen } from "@/components/portal/fullscreen";
import { cn } from "@/lib/utils";
import { BloodScene } from "./BloodScene";
import { GROUP_NAMES, SECTIONS, WBC, compatible, type BloodGroup, type WbcKind } from "./blood-data";

const GROUPS: BloodGroup[] = ["O", "A", "B", "AB"];
const WBC_ORDER: WbcKind[] = ["neutrophil", "eosinophil", "basophil", "lymphocyte", "monocyte"];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <PillButton pressed={active} onClick={onClick} color="#111a18">
      {children}
    </PillButton>
  );
}

function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
      <Panel className="flex max-w-full gap-1.5 overflow-x-auto p-1.5">{children}</Panel>
    </div>
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
      <p className="text-xs font-semibold text-mute">{title}</p>
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
    <section className="mt-6 rounded-xl border border-line p-4">
      <h3 className="text-sm font-semibold">გადასხმის შემოწმება</h3>
      <div className="mt-3 grid gap-4">
        {side("დონორი", donor, setDonor, donorRh, setDonorRh)}
        {side("მიმღები", recipient, setRecipient, recipientRh, setRecipientRh)}
      </div>
      <div
        className={cn(
          "mt-4 flex items-start gap-2 rounded-md px-3 py-2.5 text-sm leading-6",
          result.ok ? "bg-brand-soft text-brand-strong" : "bg-danger-soft text-danger",
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

/** `initial`: section to open first (its view name), e.g. from a textbook lesson link. */
export function BloodExplorer({ initial }: { initial?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ref: fsRef, full: fsOn, toggle: fsToggle } = useFullscreen();
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<BloodScene | null>(null);
  const [index, setIndex] = useState(() => Math.max(0, SECTIONS.findIndex((s) => s.view === initial)));
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
    <div className={explorerPage}>
      <TopicHeader subject={{ name: "ბიოლოგია", href: "/biology" }} topic="სისხლი" color="#b8232b" icon="blood">
        <Link href="/anatomy" className="rounded-md px-3 py-1.5 text-sm font-medium text-copy hover:bg-chip max-sm:hidden">
          ადამიანის ატლასი
        </Link>
      </TopicHeader>

      <div className={cn(explorerGrid, "lg:grid-cols-[240px_minmax(0,1fr)_400px]")}>
        {/* Sections, in reading order. */}
        <nav aria-label="თემის ნაწილები" className="border-e border-line bg-card max-lg:border-e-0 max-lg:border-b">
          <ol className="flex gap-1 overflow-x-auto p-2 lg:flex-col lg:gap-0.5 lg:p-3">
            {SECTIONS.map((s, i) => (
              <li key={s.view}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={i === index ? "step" : undefined}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap transition-colors lg:whitespace-normal",
                    i === index ? "bg-[#fbeceb] font-semibold text-[#8f1c22]" : "text-copy hover:bg-subtle",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                      i === index ? "bg-[#b8232b] text-white" : "bg-chip text-mute",
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

        <div ref={fsRef} data-scene className="relative isolate min-h-0 overflow-hidden">
          <canvas ref={canvasRef} className="absolute inset-0 size-full touch-none" aria-label={`3D: ${section.title}`} />
          <FullscreenButton full={fsOn} onClick={fsToggle} className="absolute top-3 right-3" />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0" />
          {section.view === "wbc" && (
            <Toolbar>
              {WBC_ORDER.map((k) => (
                <Chip key={k} active={wbc === k} onClick={() => setWbc(k)}>
                  {WBC[k].name}
                </Chip>
              ))}
            </Toolbar>
          )}
          {section.view === "groups" && (
            <Toolbar>
              {GROUPS.map((g) => (
                <Chip key={g} active={group === g} onClick={() => setGroup(g)}>
                  {GROUP_NAMES[g]}
                </Chip>
              ))}
              <span className="mx-1 w-px shrink-0 bg-line" />
              <Chip active={rh} onClick={() => setRh(!rh)}>
                {rh ? "Rh+" : "Rh−"}
              </Chip>
            </Toolbar>
          )}
        </div>

        <article className={explorerText}>
          <p className="text-xs font-semibold text-[#b8232b]">
            {index + 1} / {SECTIONS.length}
          </p>
          <h2 className="mt-1 text-2xl">{section.title}</h2>
          <p className="mt-1 text-sm text-mute">{section.subtitle}</p>

          <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {section.facts.map((f) => (
              <div key={f.label} className="rounded-lg bg-subtle px-3 py-2.5">
                <dt className="text-[11px] leading-4 text-mute">{f.label}</dt>
                <dd className="mt-1 text-sm leading-5 font-semibold [overflow-wrap:anywhere]">{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-col gap-4">
            {section.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="text-[15px] leading-7 text-copy">
                {p}
              </p>
            ))}
          </div>

          {section.view === "wbc" && (
            <section className="mt-6 rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold">{WBC[wbc].name}</h3>
                <span className="text-xs text-mute">
                  {WBC[wbc].group} · {WBC[wbc].share}
                </span>
              </div>
              <p className="mt-2 text-[15px] leading-7 text-copy">{WBC[wbc].text}</p>
            </section>
          )}
          {section.view === "groups" && <Compatibility />}

          <SectionPager index={index} count={SECTIONS.length} onGo={setIndex} />
        </article>
      </div>
    </div>
  );
}
