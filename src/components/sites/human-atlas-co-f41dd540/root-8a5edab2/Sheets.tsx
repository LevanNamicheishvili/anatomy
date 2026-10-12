"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, EyeOff, Microscope, Scan, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/portal/ui";
import { SYSTEM_BY_KEY, titleCase, type SystemKey } from "./atlas-data";
import type { Strings } from "./i18n";
import { SwitchRow, btnPrimary, btnSecondary, floating, iconBtn, sectionLabel } from "./primitives";
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
  "absolute end-14 top-14 bottom-0 z-20 flex w-[400px] flex-col border-s border-line bg-card shadow-panel max-[1100px]:w-[340px]",
  "max-md:inset-x-0 max-md:top-auto max-md:z-30 max-md:w-auto max-md:rounded-t-2xl max-md:border-s-0 max-md:border-t max-md:shadow-[0_-8px_24px_rgba(17,26,24,0.12)]",
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
    <div className="flex shrink-0 items-start gap-3 border-b border-line bg-subtle py-5 ps-6 pe-3 max-md:ps-5">
      <div className="min-w-0 flex-1 pt-1">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-chip py-0.5 ps-2 pe-2.5 text-xs font-semibold text-copy">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dot }} aria-hidden />
          <span className="break-words" title={label}>{label}</span>
        </span>
        <h2
          ref={titleRef}
          tabIndex={-1}
          title={typeof title === "string" ? title : undefined}
          className="mt-2 text-xl leading-8 font-semibold text-ink outline-none [overflow-wrap:anywhere]"
        >
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm leading-6 text-mute [overflow-wrap:anywhere]">{subtitle}</p>}
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

      <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5 max-md:px-5">
        {info ? (
          <p className="text-[15px] leading-7 text-copy">{info}</p>
        ) : (
          <>
            <p className="text-[15px] leading-7 text-copy">{t.systemDescriptions[selection.system]}</p>
            <p className="mt-2 text-xs leading-5 text-faint">{t.systemOverview}</p>
          </>
        )}
        <p className="mt-4">
          <Chip>
            {t.selectedPieces}: <span className="tabular-nums">{selection.ids.length}</span>
          </Chip>
        </p>
        {/* Isolating is a state you switch on and off, so it reads as a switch rather than two different buttons. */}
        <div className="mt-5 overflow-hidden rounded-xl border border-line">
          <SwitchRow
            checked={isolated}
            onChange={onIsolate}
            label={t.isolate}
            lead={<Scan className={cn("size-[18px] shrink-0", isolated ? "text-brand" : "text-mute")} strokeWidth={2} aria-hidden />}
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-line p-4">
        <button type="button" onClick={onDeepDive} className={cn(btnPrimary, "w-full")}>
          <Microscope className="size-4" strokeWidth={2} />
          {t.deepDive}
        </button>
        <div className="grid grid-cols-2 gap-2">
          {/* Long Georgian labels may take two lines in the narrow sheet instead of being cut off. */}
          <button type="button" onClick={onHide} className={cn(btnSecondary, "h-auto min-h-10 py-2 leading-5 whitespace-normal max-md:min-h-11")}>
            <EyeOff className="size-4 shrink-0" strokeWidth={2} />
            {t.hideStructure}
          </button>
          <button type="button" onClick={onClear} className={cn(btnSecondary, "h-auto min-h-10 py-2 leading-5 whitespace-normal max-md:min-h-11")}>
            <X className="size-4 shrink-0" strokeWidth={2} />
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
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-mute" />
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
            className="h-11 w-full rounded-lg border border-line-strong bg-card ps-9 pe-3 text-[15px] text-ink outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20 max-md:text-base"
          />
        </div>
        <button type="button" onClick={onClose} aria-label={t.close} className={iconBtn}>
          <X className="size-5" />
        </button>
      </div>
      {query.trim() ? (
        <ul id="atlas-search-results" role="listbox" className="atlas-scroll -mx-3 mt-3 max-h-[min(380px,calc(100dvh-220px))] overflow-y-auto border-t border-line">
          {results.length ? (
            results.map((r, i) => (
              <li key={r.key} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => onChoose(r)}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 px-4 text-start text-sm text-ink [overflow-wrap:anywhere]",
                    i === active && "bg-chip",
                  )}
                >
                  <span className="min-w-0 flex-1 py-2">{titleCase(r.name)}</span>
                  <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-xs text-mute tabular-nums">{r.ids.length}</span>
                </button>
              </li>
            ))
          ) : (
            <li className="px-4 py-3 text-sm text-mute">{t.noResults}</li>
          )}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] leading-5 text-mute">{t.searchNote}</p>
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
        <h2 className="text-sm font-semibold text-ink">{t.askAnatomy}</h2>
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
          className="h-10 min-w-0 flex-1 rounded-lg border border-line-strong bg-card px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20 max-md:h-11 max-md:text-base"
        />
        <button type="submit" disabled={!question.trim()} className={btnPrimary}>
          {t.ask}
        </button>
      </form>
      {missed && <p className="mt-2 text-[13px] text-danger">{t.askNoMatch}</p>}
      <p className="mt-2 text-xs leading-5 text-mute">{t.askNote}</p>
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
      <button type="button" aria-label={t.close} onClick={onClose} className="absolute inset-0 bg-deep/30" />
      <aside className="absolute inset-y-0 end-0 flex w-[min(440px,100vw)] flex-col border-s border-line bg-card">
        <SheetHeader label={t.aboutEyebrow} dot="#0f8a74" title={t.aboutTitle} onClose={onClose} closeLabel={t.close} />
        <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5 text-[15px] leading-7 text-copy">
          <p>{t.aboutLead}</p>
          <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
            <div className="py-2.5">
              <dt className="font-medium text-ink">{t.aboutStats}</dt>
              <dd className="text-mute">{t.aboutStatsDetail}</dd>
            </div>
          </dl>
          <p className="mt-5">{t.aboutDisclaimer}</p>
          <p className="mt-2 text-[13px] leading-6 text-mute">{t.controlsHint}</p>
          <h3 className={cn(sectionLabel, "mt-6")}>{t.aboutSourceHeading}</h3>
          <p className="mt-1">{t.aboutSource}</p>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {links.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-between text-sm font-medium text-brand hover:underline"
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
