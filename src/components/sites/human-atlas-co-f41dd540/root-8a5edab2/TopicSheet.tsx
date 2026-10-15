"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Microscope, ShieldPlus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { RememberCallout, Spoken } from "@/components/portal/lesson";
import { LessonNarration } from "@/components/portal/LessonNarration";
import { narrationFor, narrationLayout, topicNarrationBlocks, topicNarrationId } from "@/lib/narration";
import type { Strings } from "./i18n";
import { btnPrimary, btnSecondary, sectionLabel } from "./primitives";
import { SheetHeader, dockedSheet } from "./Sheets";
import type { Topic } from "./topics";

/** Green box with the topic's health advice; `spokenFrom`: the narration reads it (karaoke words from there). */
function HealthNote({ title, text, large = false, spokenFrom }: { title: string; text: string; large?: boolean; spokenFrom?: number }) {
  const layout = spokenFrom === undefined ? null : narrationLayout([{ heading: title, paragraphs: [text] }])[0];
  return (
    <section className="mt-4 rounded-2xl border border-brand/30 bg-brand-soft p-4">
      <h3 className={cn("flex items-center gap-2 font-semibold text-brand-strong", large ? "text-lg" : "text-sm")}>
        <ShieldPlus className={large ? "size-5" : "size-4"} strokeWidth={2} aria-hidden />
        <span>
          <Spoken text={title} from={layout ? spokenFrom! + layout.heading : undefined} />
        </span>
      </h3>
      <p className={cn("mt-1.5 text-copy", large ? "text-xl leading-9" : "text-[15px] leading-7")}>
        <Spoken text={text} from={layout ? spokenFrom! + layout.paragraphs[0] : undefined} />
      </p>
    </section>
  );
}

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
  // The topic read aloud (karaoke), when recorded: sections, then the facts, then the health note.
  const spoken = useMemo(() => {
    const blocks = topicNarrationBlocks(topic, t.topicFacts, t.topicHealth);
    const narration = narrationFor(topicNarrationId(topic.slug), blocks);
    return narration ? { narration, layout: narrationLayout(blocks) } : null;
  }, [topic, t.topicFacts, t.topicHealth]);
  const at = (block: number, part: "heading" | number) => (spoken ? (part === "heading" ? spoken.layout[block].heading : spoken.layout[block].paragraphs[part]) : undefined);
  const facts = topic.sections.length;
  const player = spoken && (
    <LessonNarration
      key={topic.slug}
      narration={spoken.narration}
      variant="sheet"
      blockStarts={spoken.layout.map((b) => b.start)}
      // Board mode: the slide follows the voice (one slide per part).
      onBlock={steps ? setStep : undefined}
    />
  );

  if (steps) {
    // Sections, then the facts, then the health note — each its own slide.
    const slides = [
      ...topic.sections.map((s, k) => ({
        heading: s.heading,
        title: <Spoken text={s.heading} from={at(k, "heading")} />,
        body: (
          <p className="text-xl leading-9 text-copy">
            <Spoken text={s.body} from={at(k, 0)} />
          </p>
        ),
      })),
      {
        heading: t.topicFacts,
        title: <Spoken text={t.topicFacts} from={at(facts, "heading")} />,
        body: (
          <ul className="flex flex-col gap-4">
            {topic.facts.map((f, k) => (
              <li key={f} className="grid grid-cols-[8px_1fr] gap-3 text-xl leading-9 text-copy">
                <span className="mt-[15px] size-2 rounded-full" style={{ backgroundColor: topic.color }} />
                <span>
                  <Spoken text={f} from={at(facts, k)} />
                </span>
              </li>
            ))}
          </ul>
        ),
      },
      { heading: t.topicHealth, title: null, body: <HealthNote title={t.topicHealth} text={topic.health} large spokenFrom={spoken ? spoken.layout[facts + 1].start : undefined} /> },
    ];
    const i = Math.min(step, slides.length - 1);
    const last = i === slides.length - 1;
    return (
      <aside aria-label={topic.title} className={cn(dockedSheet, "max-md:h-[60dvh]")}>
        <SheetHeader label={t.topics} dot={topic.color} title={topic.title} subtitle={topic.subtitle} onClose={onClose} closeLabel={t.close} />
        {player}
        <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex flex-1 gap-1" aria-hidden>
              {slides.map((s, k) => (
                <span key={s.heading} className={cn("h-1.5 flex-1 rounded-full transition-colors", k <= i ? "bg-brand" : "bg-line")} />
              ))}
            </div>
            <p className={cn(sectionLabel, "tabular-nums")}>
              {i + 1} / {slides.length}
            </p>
          </div>
          {/* The health slide carries its own heading inside the green box. */}
          {!last && <h3 className="mt-5 text-2xl font-semibold text-ink [overflow-wrap:anywhere]">{slides[i].title}</h3>}
          <div className={last ? "mt-1" : "mt-4"}>{slides[i].body}</div>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-line p-4">
          <button type="button" disabled={i === 0} onClick={() => setStep(i - 1)} className={cn(btnSecondary, "h-12 text-base")}>
            <ChevronLeft className="size-5" />
            წინა
          </button>
          <button type="button" disabled={last} onClick={() => setStep(i + 1)} className={cn(btnPrimary, "h-12 text-base")}>
            შემდეგი
            <ChevronRight className="size-5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label={topic.title} className={cn(dockedSheet, collapsed ? "max-md:h-auto" : "max-md:h-[60dvh]")}>
      {/* Phones: the grab handle on top folds the sheet away so the whole model is visible. */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="hidden min-h-11 shrink-0 flex-col items-center justify-center gap-1 pt-2 text-xs font-semibold text-brand max-md:flex"
      >
        <span className="h-1 w-10 rounded-full bg-line-strong" aria-hidden />
        <span className="flex items-center gap-1">
          {collapsed ? t.expand : t.collapse}
          {collapsed ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
        </span>
      </button>
      <SheetHeader label={t.topics} dot={topic.color} title={topic.title} subtitle={topic.subtitle} onClose={onClose} closeLabel={t.close} />
      {/* Folded on a phone, the voice goes on; only the controls hide. */}
      <div className={cn("contents", collapsed && "max-md:hidden")}>{player}</div>

      <div className={cn("atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5 max-md:px-5", collapsed && "max-md:hidden")}>
        {topic.sections.map((s, i) => (
          <section key={s.heading} className={cn(i > 0 && "mt-6")}>
            <h3 className="text-base font-semibold text-ink">
              <Spoken text={s.heading} from={at(i, "heading")} />
            </h3>
            <p className="mt-1.5 text-[15px] leading-7 text-copy">
              <Spoken text={s.body} from={at(i, 0)} />
            </p>
          </section>
        ))}

        <RememberCallout items={topic.facts} title={t.topicFacts} icon={Sparkles} spokenFrom={spoken ? spoken.layout[facts].start : undefined} />
        <HealthNote title={t.topicHealth} text={topic.health} spokenFrom={spoken ? spoken.layout[facts + 1].start : undefined} />
      </div>

      <div className={cn("shrink-0 border-t border-line p-4", collapsed && "max-md:hidden")}>
        <button type="button" onClick={onDeepDive} className={cn(btnPrimary, "w-full")}>
          <Microscope className="size-4" strokeWidth={2} />
          {t.deepDive}
        </button>
      </div>
    </aside>
  );
}
