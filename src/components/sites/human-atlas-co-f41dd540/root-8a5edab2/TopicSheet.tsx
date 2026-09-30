"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Microscope } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Strings } from "./i18n";
import { btnPrimary, btnSecondary, sectionLabel } from "./primitives";
import { SheetHeader, dockedSheet } from "./Sheets";
import type { Topic } from "./topics";

export function TopicSheet({
  t,
  topic,
  onClose,
  onDeepDive,
  steps = false,
}: {
  t: Strings;
  topic: Topic;
  onClose: () => void;
  onDeepDive: () => void;
  /** Board mode: one section at a time, in large type, for presenting to a class. */
  steps?: boolean;
}) {
  // On phones the sheet can collapse to its header so the 3D model is fully visible.
  const [collapsed, setCollapsed] = useState(false);
  const [step, setStep] = useState(0);
  const [prevSlug, setPrevSlug] = useState(topic.slug);
  if (prevSlug !== topic.slug) {
    setPrevSlug(topic.slug);
    setStep(0);
  }

  if (steps) {
    // Sections, then the facts, then the health note — each its own slide.
    const slides = [
      ...topic.sections.map((s) => ({ heading: s.heading, body: <p className="text-xl leading-9 text-[#33413e]">{s.body}</p> })),
      {
        heading: t.topicFacts,
        body: (
          <ul className="flex flex-col gap-4">
            {topic.facts.map((f) => (
              <li key={f} className="grid grid-cols-[8px_1fr] gap-3 text-xl leading-9 text-[#33413e]">
                <span className="mt-[15px] size-2 rounded-full bg-[#97a29e]" />
                {f}
              </li>
            ))}
          </ul>
        ),
      },
      { heading: t.topicHealth, body: <p className="text-xl leading-9 text-[#33413e]">{topic.health}</p> },
    ];
    const i = Math.min(step, slides.length - 1);
    return (
      <aside aria-label={topic.title} className={cn(dockedSheet, "max-md:h-[60dvh]")}>
        <SheetHeader label={t.topics} dot={topic.color} title={topic.title} subtitle={topic.subtitle} onClose={onClose} closeLabel={t.close} />
        <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <p className={sectionLabel}>
            {i + 1} / {slides.length}
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-[#111a18]">{slides[i].heading}</h3>
          <div className="mt-4">{slides[i].body}</div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#e2e7e5] p-4">
          <button type="button" disabled={i === 0} onClick={() => setStep(i - 1)} className={cn(btnSecondary, "h-12 text-base")}>
            <ChevronLeft className="size-5" />
            წინა
          </button>
          <button type="button" disabled={i === slides.length - 1} onClick={() => setStep(i + 1)} className={cn(btnPrimary, "h-12 text-base")}>
            შემდეგი
            <ChevronRight className="size-5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label={topic.title} className={cn(dockedSheet, collapsed ? "max-md:h-auto" : "max-md:h-[60dvh]")}>
      <SheetHeader
        label={t.topics}
        dot={topic.color}
        title={topic.title}
        subtitle={topic.subtitle}
        onClose={onClose}
        closeLabel={t.close}
      />
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="hidden h-10 shrink-0 items-center justify-center gap-1 border-b border-[#e2e7e5] text-[13px] font-medium text-[#0f8a74] max-md:flex"
      >
        {collapsed ? t.expand : t.collapse}
        {collapsed ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      <div className={cn("atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5", collapsed && "max-md:hidden")}>
        {topic.sections.map((s, i) => (
          <section key={s.heading} className={cn(i > 0 && "mt-6")}>
            <h3 className="text-base font-semibold text-[#111a18]">{s.heading}</h3>
            <p className="mt-2 text-[15px] leading-7 text-[#33413e]">{s.body}</p>
          </section>
        ))}

        <section className="mt-6 border-t border-[#e2e7e5] pt-5">
          <h3 className={sectionLabel}>{t.topicFacts}</h3>
          <ul className="mt-3 flex flex-col gap-3">
            {topic.facts.map((f) => (
              <li key={f} className="grid grid-cols-[6px_1fr] gap-3 text-[15px] leading-7 text-[#33413e]">
                <span className="mt-[11px] size-1.5 rounded-full bg-[#97a29e]" />
                {f}
              </li>
            ))}
          </ul>
        </section>

        <button type="button" onClick={onDeepDive} className={cn(btnPrimary, "mt-6 w-full")}>
          <Microscope className="size-4" strokeWidth={2} />
          {t.deepDive}
        </button>

        <section className="mt-6 border-s-2 border-[#0f8a74] bg-[#f5f7f6] py-3 ps-4 pe-3">
          <h3 className="text-sm font-semibold text-[#111a18]">{t.topicHealth}</h3>
          <p className="mt-1 text-[15px] leading-7 text-[#33413e]">{topic.health}</p>
        </section>
      </div>
    </aside>
  );
}
