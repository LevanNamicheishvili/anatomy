"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Layers, Microscope, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiveTemplate } from "./deep-dive-data";
import { CrossSection, MicroView } from "./DeepDiveScenes";
import type { Strings } from "./i18n";
import { Slider, iconBtn, sectionLabel } from "./primitives";
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

      <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto">
        {canCut && (
          <div className="border-b border-[#e2e7e5] px-6 py-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-2 font-medium text-[#111a18]">
                <Scissors className="size-4 text-[#66736f]" strokeWidth={2} />
                {t.cutDepth}
              </span>
              <span className="text-[#66736f] tabular-nums">{Math.round(cutDepth * 100)}%</span>
            </div>
            <div className="-mx-2">
              <Slider value={Math.round(cutDepth * 100)} onChange={(v) => onCutDepth(v / 100)} label={t.cutDepth} />
            </div>
          </div>
        )}

        <div role="tablist" className="grid grid-cols-2 border-b border-[#e2e7e5]">
          {(
            [
              ["section", Layers, t.crossSection],
              ["micro", Microscope, t.microscope],
            ] as const
          ).map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={level === key}
              onClick={() => switchLevel(key)}
              className={cn(
                "relative flex h-11 items-center justify-center gap-2 text-[13px] transition-colors",
                level === key ? "font-semibold text-[#111a18]" : "text-[#66736f] hover:text-[#111a18]",
              )}
            >
              <Icon className="size-4" strokeWidth={2} />
              {label}
              {level === key && <span className="absolute inset-x-6 bottom-0 h-0.5 bg-[#0f8a74]" />}
            </button>
          ))}
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-center justify-between">
            <h3 className={sectionLabel}>{level === "section" ? t.outsideIn : template.microTitle}</h3>
            {level === "micro" && <span className="text-xs text-[#97a29e] tabular-nums">{template.magnification}</span>}
          </div>
          <div className="mt-2 rounded-md border border-[#e2e7e5] bg-[#fbfcfc] p-2">
            {level === "section" ? (
              <CrossSection template={template} active={active} onSelect={setActive} />
            ) : (
              <MicroView template={template} active={active} onSelect={setActive} />
            )}
          </div>
          <p className="mt-2 text-xs text-[#97a29e]">{t.tapHint}</p>
        </div>

        {current && (
          <div className="mx-6 my-4 rounded-md border border-[#e2e7e5]">
            <div className="flex items-center gap-2 border-b border-[#e2e7e5] py-2 ps-3 pe-1">
              {current.color && <span className="size-3 shrink-0 rounded-sm" style={{ backgroundColor: current.color }} />}
              <span className="flex-1 text-sm font-semibold text-[#111a18]">
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
              <p className="text-[15px] leading-7 text-[#33413e]">{current.tooltip}</p>
              {current.visual && (
                <p className="mt-2 text-[13px] leading-5 text-[#66736f]">
                  <span className="font-medium text-[#33413e]">{t.visualGuide}: </span>
                  {current.visual}
                </p>
              )}
            </div>
          </div>
        )}

        <ol className="mx-6 mb-6 divide-y divide-[#e2e7e5] border-y border-[#e2e7e5]">
          {items.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => setActive(it.id)}
                className={cn(
                  "flex min-h-10 w-full items-center gap-3 px-1 text-start text-sm transition-colors",
                  it.id === active ? "font-medium text-[#0c7563]" : "text-[#33413e] hover:bg-[#f5f7f6]",
                )}
              >
                <span className="w-5 text-end text-xs text-[#97a29e] tabular-nums">{i + 1}</span>
                {it.color && <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: it.color }} />}
                <span className="py-2">{it.name}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
