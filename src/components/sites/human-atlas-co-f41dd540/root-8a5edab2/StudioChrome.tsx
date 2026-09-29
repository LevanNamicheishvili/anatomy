"use client";

import Link from "next/link";
import { HeartPulse, Info, MessageCircleQuestionMark, QrCode, Search, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BreathPhase, HeartPhase } from "./anatomy-viewer";
import type { Strings } from "./i18n";
import { btnGhost, btnPrimary, floating, iconBtn } from "./primitives";

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
    <header className="absolute inset-x-0 top-0 z-30 flex h-14 items-stretch border-b border-[#e2e7e5] bg-white">
      {/* Brand column: same width as the sidebar so both share one vertical edge. */}
      <div className="flex w-[320px] shrink-0 items-center gap-3 border-e border-[#e2e7e5] px-4 max-[1100px]:w-[288px] max-md:w-auto max-md:border-e-0">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-[#0f8a74] text-white">
          <HeartPulse className="size-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-[15px] font-semibold text-[#111a18]">{t.title}</h1>
          <p className="truncate text-xs text-[#66736f] max-md:hidden">
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
          className="flex h-9 w-full max-w-[440px] items-center gap-2.5 rounded-md border border-[#d5dcd9] bg-[#f5f7f6] px-3 text-start text-[13px] text-[#66736f] transition-colors hover:border-[#c3ccc9] hover:bg-white max-md:hidden"
        >
          <Search className="size-4 shrink-0" strokeWidth={2} />
          <span className="flex-1 truncate">{t.searchPlaceholder}</span>
          <kbd className="rounded border border-[#d5dcd9] bg-white px-1.5 font-sans text-[11px] leading-4 text-[#66736f]">/</kbd>
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
          <span className="mx-1 h-5 w-px bg-[#e2e7e5] max-md:hidden" />
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
    <div role="status" aria-live="polite" className={cn(floating, "pointer-events-none flex h-10 items-center gap-3 px-3 text-[13px]")}>
      {heart && (
        <span className="flex items-center gap-2">
          <HeartPulse
            className={cn(
              "size-[18px] text-[#c0392b] transition-transform duration-150",
              heart === "ventricles" ? "scale-125" : heart === "atria" ? "scale-110" : "scale-100",
            )}
            strokeWidth={2.2}
          />
          <span className="font-medium text-[#111a18]">{t.phases[heart]}</span>
          <span className="text-[#66736f] tabular-nums">
            {bpm} {t.bpmUnit}
          </span>
        </span>
      )}
      {heart && breath && <span className="h-5 w-px bg-[#e2e7e5]" />}
      {breath && (
        <span className="flex items-center gap-2">
          <Wind
            className={cn("size-[18px] text-[#2d6fb3] transition-transform duration-700", breath === "inhale" ? "scale-125" : "scale-90")}
            strokeWidth={2.2}
          />
          <span className="font-medium text-[#111a18]">{t.phases[breath]}</span>
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
    <div role="status" className={cn(floating, "pointer-events-auto w-[320px] max-w-[calc(100%-32px)] p-5")}>
      {error ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-sm font-medium text-[#111a18]">{t.loadError}</p>
          <button type="button" onClick={onRetry} className={btnPrimary}>
            {t.retry}
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold text-[#111a18]">{t.loading}</p>
          <p className="mt-1 text-[13px] text-[#66736f] tabular-nums">{t.loadingDetail(done, total)}</p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-[#e2e7e5]">
            <i className="block h-full bg-[#0f8a74] transition-[width] duration-300" style={{ width: `${pct}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
