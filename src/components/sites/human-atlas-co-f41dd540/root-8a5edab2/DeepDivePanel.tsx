"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Layers, Microscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { LabeledSlider, SegmentedTabs } from "@/components/portal/controls";
import type { DiveTemplate } from "./deep-dive-data";
import { CrossSection, MicroView } from "./DeepDiveScenes";
import type { Strings } from "./i18n";
import { iconBtn, sectionLabel } from "./primitives";
import { SheetHeader, dockedSheet } from "./Sheets";

type Level = "section" | "micro";

export function DeepDivePanel({
  t,
  template,
  structure,
  canCut,
  cutDepth,
  onCutDepth,
  onClose,
}: {
  t: Strings;
  template: DiveTemplate;
  structure: string;
  canCut: boolean;
  cutDepth: number;
  onCutDepth: (v: number) => void;
  onClose: () => void;
}) {
  const [level, setLevel] = useState<Level>("section");
  const [active, setActive] = useState<string | null>(template.layers[0]?.id ?? null);

  const items =
    level === "section"
      ? template.layers.map((l) => ({ id: l.id, name: l.name, tooltip: l.tooltip, visual: l.visual, color: l.color }))
      : template.micro.map((m) => ({ id: m.id, name: m.name, tooltip: m.tooltip, visual: "", color: "" }));
  const index = Math.max(0, items.findIndex((i) => i.id === active));
  const current = items[index];

  const switchLevel = (next: Level) => {
    setLevel(next);
    setActive(next === "section" ? (template.layers[0]?.id ?? null) : (template.micro[0]?.id ?? null));
  };
  const step = (d: 1 | -1) => setActive(items[(index + d + items.length) % items.length]?.id ?? null);

  return (
    <aside aria-label={t.deepDive} className={cn(dockedSheet, "max-md:h-[70dvh]")}>
      <SheetHeader label={t.deepDive} dot={template.cutColor} title={structure} subtitle={template.title} onClose={onClose} closeLabel={t.close} />

      <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 pb-6 max-md:px-5">
        {canCut && (
          <div className="mt-4 rounded-2xl border border-line bg-card px-3 pt-2.5 pb-1.5">
            <LabeledSlider
              label={t.cutDepth}
              value={Math.round(cutDepth * 100)}
              display={`${Math.round(cutDepth * 100)}%`}
              min={0}
              max={100}
              onChange={(v) => onCutDepth(v / 100)}
            />
          </div>
        )}

        <SegmentedTabs<Level>
          equal
          label={t.deepDive}
          className="mt-4"
          options={[
            { id: "section", label: t.crossSection, icon: Layers },
            { id: "micro", label: t.microscope, icon: Microscope },
          ]}
          value={level}
          onChange={switchLevel}
        />

        <div className="mt-5 flex items-center justify-between gap-3">
          <h3 className={cn(sectionLabel, "min-w-0")}>{level === "section" ? t.outsideIn : template.microTitle}</h3>
          {level === "micro" && <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-xs text-mute tabular-nums">{template.magnification}</span>}
        </div>
        <div className="mt-2 rounded-2xl border border-line bg-subtle p-2">
          {level === "section" ? (
            <CrossSection template={template} active={active} onSelect={setActive} />
          ) : (
            <MicroView template={template} active={active} onSelect={setActive} />
          )}
        </div>
        <p className="mt-2 text-xs text-mute">{t.tapHint}</p>

        {current && (
          <div className="mt-4 rounded-2xl border border-line bg-card shadow-card shadow-[0_1px_2px_rgba(17,26,24,0.04)]">
            <div className="flex items-center gap-2 border-b border-line py-1.5 ps-3 pe-1.5">
              {current.color && <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: current.color }} />}
              <span className="min-w-0 flex-1 py-1 text-sm leading-5 font-semibold text-ink [overflow-wrap:anywhere]">
                {index + 1}. {current.name}
              </span>
              <button type="button" aria-label={t.previous} onClick={() => step(-1)} className={iconBtn}>
                <ChevronLeft className="size-4" />
              </button>
              <button type="button" aria-label={t.next} onClick={() => step(1)} className={iconBtn}>
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="px-3 py-3">
              <p className="text-[15px] leading-7 text-copy">{current.tooltip}</p>
              {current.visual && (
                <p className="mt-2 text-[13px] leading-5 text-mute">
                  <span className="font-medium text-copy">{t.visualGuide}: </span>
                  {current.visual}
                </p>
              )}
            </div>
          </div>
        )}

        <ol className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
          {items.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                aria-current={it.id === active ? "step" : undefined}
                onClick={() => setActive(it.id)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 px-3 text-start text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand/50 focus-visible:ring-inset",
                  it.id === active ? "bg-brand-soft font-medium text-brand-strong" : "text-copy hover:bg-subtle",
                )}
              >
                <span className="w-5 shrink-0 text-end text-xs text-faint tabular-nums">{i + 1}</span>
                {it.color && <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: it.color }} />}
                <span className="min-w-0 flex-1 py-2 [overflow-wrap:anywhere]">{it.name}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
