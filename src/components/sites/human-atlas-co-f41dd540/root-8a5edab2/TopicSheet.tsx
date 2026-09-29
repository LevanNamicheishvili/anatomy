"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Microscope } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Strings } from "./i18n";
import { btnPrimary, sectionLabel } from "./primitives";
import { SheetHeader, dockedSheet } from "./Sheets";
import type { Topic } from "./topics";

export function TopicSheet({
  t,
  topic,
  onClose,
  onDeepDive,
}: {
  t: Strings;
  topic: Topic;
  onClose: () => void;
  onDeepDive: () => void;
}) {
  // On phones the sheet can collapse to its header so the 3D model is fully visible.
  const [collapsed, setCollapsed] = useState(false);

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
