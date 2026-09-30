"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, EyeOff, Microscope, Scan, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SYSTEM_BY_KEY, titleCase, type SystemKey } from "./atlas-data";
import type { Strings } from "./i18n";
import { btnPrimary, btnSecondary, floating, iconBtn, sectionLabel } from "./primitives";
import { searchIndex, type SearchEntry } from "./search-index";
import { structureInfo } from "./structure-info";

export interface Selection {
  name: string;
  conceptId: string;
  system: SystemKey;
  ids: string[];
}

/** Right-hand panel docked between the 3D view and the camera rail (bottom sheet on phones). */
export const dockedSheet = cn(
  "absolute end-14 top-14 bottom-0 z-20 flex w-[400px] flex-col border-s border-[#e2e7e5] bg-white max-[1100px]:w-[340px]",
  "max-md:inset-x-0 max-md:top-auto max-md:z-30 max-md:w-auto max-md:rounded-t-xl max-md:border-s-0 max-md:border-t max-md:shadow-[0_-8px_24px_rgba(17,26,24,0.12)]",
);

export function SheetHeader({
  label,
  dot,
  title,
  subtitle,
  onClose,
  closeLabel,
  titleRef,
}: {
  label: string;
  dot: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel: string;
  titleRef?: React.Ref<HTMLHeadingElement>;
}) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-[#e2e7e5] py-4 ps-6 pe-3">
      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
          <span className={sectionLabel}>{label}</span>
        </div>
        <h2
          ref={titleRef}
          tabIndex={-1}
          className="mt-1.5 text-xl leading-7 font-semibold text-[#111a18] outline-none [overflow-wrap:anywhere]"
        >
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-[#66736f]">{subtitle}</p>}
      </div>
      <button type="button" onClick={onClose} aria-label={closeLabel} className={iconBtn}>
        <X className="size-5" />
      </button>
    </div>
  );
}

export function DetailSheet({
  t,
  selection,
  isolated,
  onIsolate,
  onHide,
  onClear,
  onDeepDive,
}: {
  t: Strings;
  selection: Selection;
  isolated: boolean;
  onIsolate: () => void;
  onHide: () => void;
  onClear: () => void;
  onDeepDive: () => void;
}) {
  const sys = SYSTEM_BY_KEY[selection.system];
  const info = structureInfo(selection.name);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus({ preventScroll: true }), [selection.name]);

  return (
    <aside aria-label={titleCase(selection.name)} className={cn(dockedSheet, "max-md:h-[52dvh]")}>
      <SheetHeader
        label={t.systemNames[selection.system]}
        dot={sys.dot}
        title={titleCase(selection.name)}
        onClose={onClear}
        closeLabel={t.close}
        titleRef={titleRef}
      />

      <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {info ? (
          <p className="text-[15px] leading-7 text-[#33413e]">{info}</p>
        ) : (
          <>
            <p className="text-[15px] leading-7 text-[#33413e]">{t.systemDescriptions[selection.system]}</p>
            <p className="mt-2 text-xs leading-5 text-[#97a29e]">{t.systemOverview}</p>
          </>
        )}
        <dl className="mt-5 border-y border-[#e2e7e5] text-sm">
          <div className="flex h-10 items-center justify-between">
            <dt className="text-[#66736f]">{t.selectedPieces}</dt>
            <dd className="font-medium text-[#111a18] tabular-nums">{selection.ids.length}</dd>
          </div>
        </dl>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-[#e2e7e5] p-4">
        <button type="button" onClick={onDeepDive} className={cn(btnPrimary, "w-full")}>
          <Microscope className="size-4" strokeWidth={2} />
          {t.deepDive}
        </button>
        <button type="button" onClick={onIsolate} className={cn(btnSecondary, "w-full")}>
          <Scan className="size-4" strokeWidth={2} />
          {isolated ? t.showSurrounding : t.isolate}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onHide} className={btnSecondary}>
            <EyeOff className="size-4" strokeWidth={2} />
            {t.hideStructure}
          </button>
          <button type="button" onClick={onClear} className={btnSecondary}>
            {t.clearSelection}
          </button>
        </div>
      </div>
    </aside>
  );
}

// Popovers start at the same x as the search field in the header (sidebar width + 16px).
const popover =
  "atlas-pop-in absolute start-[336px] top-16 z-40 w-[480px] max-w-[calc(100%-352px)] p-3 max-[1100px]:start-[304px] max-md:inset-x-2 max-md:w-auto max-md:max-w-none";

export function SearchPanel({
  t,
  index,
  onChoose,
  onClose,
}: {
  t: Strings;
  index: SearchEntry[];
  onChoose: (entry: SearchEntry) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => searchIndex(index, query), [index, query]);

  return (
    <div role="dialog" aria-label={t.findStructure} className={cn(floating, popover)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[#66736f]" />
          <input
            autoFocus
            value={query}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="atlas-search-results"
            placeholder={t.searchPlaceholder}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(results.length - 1, a + 1));
              else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
              else if (e.key === "Enter" && results[active]) onChoose(results[active]);
              else return;
              e.preventDefault();
            }}
            className="h-10 w-full rounded-md border border-[#d5dcd9] bg-white ps-9 pe-3 text-[15px] text-[#111a18] outline-none placeholder:text-[#97a29e] focus:border-[#0f8a74] focus:ring-2 focus:ring-[#0f8a74]/20 max-md:h-11 max-md:text-base"
          />
        </div>
        <button type="button" onClick={onClose} aria-label={t.close} className={iconBtn}>
          <X className="size-5" />
        </button>
      </div>
      {query.trim() ? (
        <ul id="atlas-search-results" role="listbox" className="atlas-scroll -mx-3 mt-3 max-h-[min(380px,calc(100dvh-220px))] overflow-y-auto border-t border-[#e2e7e5]">
          {results.length ? (
            results.map((r, i) => (
              <li key={r.key} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onChoose(r)}
                  className={cn(
                    "flex min-h-10 w-full items-center gap-3 px-4 text-start text-sm text-[#111a18] [overflow-wrap:anywhere]",
                    i === active && "bg-[#eef2f0]",
                  )}
                >
                  <span className="flex-1 py-2">{titleCase(r.name)}</span>
                  <span className="text-xs text-[#97a29e] tabular-nums">{r.ids.length}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-[#66736f]">{t.noResults}</li>
          )}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] leading-5 text-[#66736f]">{t.searchNote}</p>
      )}
    </div>
  );
}

export function AskPanel({
  t,
  onAsk,
  onClose,
}: {
  t: Strings;
  onAsk: (question: string) => boolean;
  onClose: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [missed, setMissed] = useState(false);

  return (
    <div role="dialog" aria-label={t.askAnatomy} className={cn(floating, popover)}>
      <div className="flex h-9 items-center justify-between">
        <h2 className="text-sm font-semibold text-[#111a18]">{t.askAnatomy}</h2>
        <button type="button" onClick={onClose} aria-label={t.close} className={iconBtn}>
          <X className="size-5" />
        </button>
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          setMissed(!onAsk(question));
        }}
      >
        <input
          autoFocus
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
            setMissed(false);
          }}
          placeholder={t.askPlaceholder}
          className="h-9 min-w-0 flex-1 rounded-md border border-[#d5dcd9] bg-white px-3 text-sm text-[#111a18] outline-none placeholder:text-[#97a29e] focus:border-[#0f8a74] focus:ring-2 focus:ring-[#0f8a74]/20 max-md:h-11 max-md:text-base"
        />
        <button type="submit" disabled={!question.trim()} className={btnPrimary}>
          {t.ask}
        </button>
      </form>
      {missed && <p className="mt-2 text-[13px] text-[#b4412f]">{t.askNoMatch}</p>}
      <p className="mt-2 text-xs leading-5 text-[#66736f]">{t.askNote}</p>
    </div>
  );
}

export function AboutSheet({ t, onClose }: { t: Strings; onClose: () => void }) {
  const links = [
    { label: t.datasetLicense, href: "https://creativecommons.org/licenses/by/4.0/" },
    { label: t.originalGeometry, href: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html" },
    { label: t.publication, href: "https://academic.oup.com/nar/article/37/suppl_1/D782/1000752" },
  ];
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t.aboutEyebrow}>
      <button type="button" aria-label={t.close} onClick={onClose} className="absolute inset-0 bg-[#111a18]/30" />
      <aside className="absolute inset-y-0 end-0 flex w-[min(440px,100vw)] flex-col border-s border-[#e2e7e5] bg-white">
        <SheetHeader label={t.aboutEyebrow} dot="#0f8a74" title={t.aboutTitle} onClose={onClose} closeLabel={t.close} />
        <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5 text-[15px] leading-7 text-[#33413e]">
          <p>{t.aboutLead}</p>
          <dl className="mt-5 divide-y divide-[#e2e7e5] border-y border-[#e2e7e5] text-sm">
            <div className="py-2.5">
              <dt className="font-medium text-[#111a18]">{t.aboutStats}</dt>
              <dd className="text-[#66736f]">{t.aboutStatsDetail}</dd>
            </div>
          </dl>
          <p className="mt-5">{t.aboutDisclaimer}</p>
          <p className="mt-2 text-[13px] leading-6 text-[#66736f]">{t.controlsHint}</p>
          <h3 className={cn(sectionLabel, "mt-6")}>{t.aboutSourceHeading}</h3>
          <p className="mt-1">{t.aboutSource}</p>
          <ul className="mt-3 divide-y divide-[#e2e7e5] border-y border-[#e2e7e5]">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-between text-sm font-medium text-[#0f8a74] hover:underline"
                >
                  {l.label}
                  <ArrowUpRight className="size-4" strokeWidth={2} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
