"use client";

import Link from "next/link";
import { HeartPulse, Info, LayoutGrid, MessageCircleQuestionMark, QrCode, Search, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/portal/controls";
import type { BreathPhase, HeartPhase } from "./anatomy-viewer";
import type { Strings } from "./i18n";
import { btnGhost, btnPrimary, iconBtn } from "./primitives";

export function AppBar({
  t,
  pieces,
  onSearch,
  onAsk,
  onAbout,
  searchOpen,
  askOpen,
}: {
  t: Strings;
  pieces: string;
  onSearch: () => void;
  onAsk: () => void;
  onAbout: () => void;
  searchOpen: boolean;
  askOpen: boolean;
}) {
  return (
    <header className="absolute inset-x-0 top-0 z-30 flex h-14 items-stretch border-b border-line bg-card shadow-card">
      {/* Brand column: same width as the sidebar so both share one vertical edge. */}
      <div className="flex w-[320px] shrink-0 items-center gap-3 border-e border-line px-4 max-[1100px]:w-[288px] max-md:w-auto max-md:border-e-0">
        {/* Back to the school portal. */}
        <Link
          href="/biology"
          title="ბიოლოგია"
          aria-label="ბიოლოგიის თემებზე დაბრუნება"
          className="group relative flex size-8 shrink-0 items-center justify-center rounded-xl bg-deep text-white transition-colors hover:bg-deep-hover"
        >
          <HeartPulse className="size-[18px] group-hover:hidden" strokeWidth={2} />
          <LayoutGrid className="hidden size-[18px] group-hover:block" strokeWidth={2} />
        </Link>
        <div className="min-w-0 leading-5">
          <h1 className="break-words text-[15px] font-semibold text-ink" title={t.title}>{t.title}</h1>
          <p className="break-words text-xs text-mute max-md:hidden">
            3D · {pieces} {t.modeledPieces}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 ps-4 pe-2.5 max-md:ps-2">
        <button
          type="button"
          onClick={onSearch}
          aria-expanded={searchOpen}
          aria-label={t.findStructure}
          className="flex min-h-10 w-full max-w-[440px] items-center gap-2.5 rounded-xl border border-line bg-subtle px-3 py-1 text-start text-sm text-mute transition-colors hover:border-line-strong hover:bg-card max-md:hidden"
        >
          <Search className="size-4 shrink-0" strokeWidth={2} />
          <span className="flex-1 break-words">{t.searchPlaceholder}</span>
          <kbd className="rounded border border-line-strong bg-card px-1.5 font-sans text-[11px] leading-4 text-mute">/</kbd>
        </button>

        <div className="ms-auto flex items-center gap-1">
          <button type="button" onClick={onSearch} aria-label={t.findStructure} className={cn(iconBtn, "hidden max-md:inline-flex")}>
            <Search className="size-[18px]" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onAsk}
            aria-expanded={askOpen}
            aria-label={t.askAnatomy}
            className={cn(btnGhost, "max-lg:w-9 max-lg:px-0 max-md:w-11")}
          >
            <MessageCircleQuestionMark className="size-[18px]" strokeWidth={2} />
            <span className="max-lg:hidden">{t.askAnatomy}</span>
          </button>
          <Link href="/qr" aria-label={t.printQr} className={cn(btnGhost, "max-lg:w-9 max-lg:px-0 max-md:w-11")}>
            <QrCode className="size-[18px]" strokeWidth={2} />
            <span className="max-lg:hidden">{t.printQr}</span>
          </Link>
          <span className="mx-1 h-5 w-px bg-line max-md:hidden" />
          <button type="button" onClick={onAbout} aria-label={t.about} className={iconBtn}>
            <Info className="size-[18px]" strokeWidth={2} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function PhaseIndicator({
  t,
  heart,
  breath,
  bpm,
}: {
  t: Strings;
  heart: HeartPhase | null;
  breath: BreathPhase | null;
  bpm: number;
}) {
  if (!heart && !breath) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none flex min-h-11 flex-wrap items-center py-2 gap-3 rounded-full border border-line-strong bg-card/95 px-4 text-[13px] shadow-panel"
    >
      {heart && (
        <span className="flex items-center gap-2">
          <HeartPulse
            className={cn(
              "size-[18px] text-[#c0392b] transition-transform duration-150",
              heart === "ventricles" ? "scale-125" : heart === "atria" ? "scale-110" : "scale-100",
            )}
            strokeWidth={2.2}
          />
          <span className="font-medium text-ink">{t.phases[heart]}</span>
          <span className="text-mute tabular-nums">
            {bpm} {t.bpmUnit}
          </span>
        </span>
      )}
      {heart && breath && <span className="h-5 w-px bg-line" />}
      {breath && (
        <span className="flex items-center gap-2">
          <Wind
            className={cn("size-[18px] text-[#2d6fb3] transition-transform duration-700", breath === "inhale" ? "scale-125" : "scale-90")}
            strokeWidth={2.2}
          />
          <span className="font-medium text-ink">{t.phases[breath]}</span>
        </span>
      )}
    </div>
  );
}

export function LoadingCard({
  t,
  done,
  total,
  error,
  onRetry,
}: {
  t: Strings;
  done: number;
  total: number;
  error: boolean;
  onRetry: () => void;
}) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <Panel role="status" className="pointer-events-auto w-[320px] max-w-[calc(100%-32px)] bg-card p-5">
      {error ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm font-medium text-ink">{t.loadError}</p>
          <button type="button" onClick={onRetry} className={btnPrimary}>
            {t.retry}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-ink">{t.loading}</p>
            <span className="text-[13px] font-semibold text-brand tabular-nums">{pct}%</span>
          </div>
          <p className="mt-1 text-[13px] text-mute tabular-nums">{t.loadingDetail(done, total)}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-line">
            <i className="block h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </Panel>
  );
}
