"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Headphones, Pause, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NARRATION_DURATION, NARRATION_WORDS } from "./didgori-narration-timing";

/*
 * The spoken story of Didgori (ElevenLabs voice) with karaoke text: the subtitles over the 3D scene fill word
 * by word as the voice speaks, the full text beside it follows along, and the scene moves to the stage the
 * voice is telling about. Word timings: scripts/history/align-narration.py.
 */

export const NARRATION_SRC = "/history/didgori-narration.mp3?v=2026-10-11";

interface Word {
  text: string;
  start: number;
  end: number;
  paragraph: number;
}

const WORDS: Word[] = NARRATION_WORDS.flatMap((p, paragraph) => p.map(([text, start, end]) => ({ text, start, end, paragraph })));

/** Subtitle lines: sentences, and long sentences cut at commas or dashes. */
const LINES: [number, number][] = (() => {
  const lines: [number, number][] = [];
  let from = 0;
  WORDS.forEach((w, i) => {
    const next = WORDS[i + 1];
    const length = i - from + 1;
    const sentenceEnd = /[.!?:…]["“»]?$/.test(w.text) || !next || next.paragraph !== w.paragraph;
    // Short lines (one or two rows), so the subtitles never hide the battle.
    const softEnd = length >= 6 && (/[,;]$/.test(w.text) || next?.text === "—");
    if (sentenceEnd || softEnd || length >= 12) {
      lines.push([from, i]);
      from = i + 1;
    }
  });
  return lines;
})();

/** Where the voice moves on to another stage of the battle: (paragraph, first word, stage). */
const CUE_WORDS: [number, string, number][] = [
  [0, "გამარჯობა", 0],
  [1, "მტერი", 1],
  [3, "ბრძოლის", 2],
  [3, "ამასობაში,", 3],
  [6, "და", 4],
  [7, "და", 5],
  [7, "აივსო", 6],
  [8, "ამ", 7],
];

export const NARRATION_CUES = CUE_WORDS.map(([paragraph, text, stage]) => {
  const w = WORDS.find((x) => x.paragraph === paragraph && x.text === text);
  return { stage, time: w ? w.start : 0 };
});

/** Index of the cue in effect at time t. */
function cueAt(t: number) {
  let k = 0;
  for (let i = 0; i < NARRATION_CUES.length; i++) if (NARRATION_CUES[i].time <= t + 0.05) k = i;
  return k;
}

/** Index of the word being spoken at time t (the last one started), -1 before the first. */
function wordAt(t: number) {
  let lo = 0;
  let hi = WORDS.length - 1;
  if (t < WORDS[0].start) return -1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (WORDS[mid].start <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export interface NarrationHandlers {
  /** The voice has moved to `stage`; `seconds` of narration remain for it. `restart`: after a jump or a fresh
   * start, so the stage should begin again even if it is already on screen. */
  onCue(stage: number, seconds: number, restart: boolean): void;
  /** Playing or paused (by the narration's own controls). */
  onPlaying(playing: boolean): void;
  /** Narration finished or was closed. */
  onEnd(): void;
}

export function useNarration(handlers: NarrationHandlers) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [word, setWord] = useState(-1);
  const [error, setError] = useState(false);
  const cueRef = useRef(-1);
  const restartRef = useRef(true);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  /** The word being filled in the subtitles (its fill is set every frame, without re-rendering). */
  const fillRef = useRef<HTMLSpanElement | null>(null);

  const audio = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio(NARRATION_SRC);
      a.preload = "auto";
      audioRef.current = a;
    }
    return audioRef.current;
  }, []);

  // Follow the voice: current word, subtitle fill, progress, and the battle stage.
  useEffect(() => {
    if (!active) return;
    const a = audio();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = a.currentTime;
      const w = wordAt(t);
      setWord((prev) => (prev === w ? prev : w));
      const cur = WORDS[w];
      if (fillRef.current && cur) {
        const f = Math.min(1, Math.max(0, (t - cur.start) / Math.max(0.12, cur.end - cur.start)));
        fillRef.current.style.setProperty("--fill", `${Math.round(f * 100)}%`);
      }
      if (progressRef.current) progressRef.current.style.width = `${(t / NARRATION_DURATION) * 100}%`;
      if (timeRef.current) timeRef.current.textContent = `${clock(t)} / ${clock(NARRATION_DURATION)}`;
      const c = cueAt(t);
      if (c !== cueRef.current && !a.paused) {
        cueRef.current = c;
        const end = NARRATION_CUES[c + 1]?.time ?? NARRATION_DURATION;
        handlersRef.current.onCue(NARRATION_CUES[c].stage, Math.max(1, end - t), restartRef.current);
        restartRef.current = false;
      }
    };
    tick();
    const onPlay = () => {
      setPlaying(true);
      handlersRef.current.onPlaying(true);
    };
    const onPause = () => {
      setPlaying(false);
      if (!a.ended) handlersRef.current.onPlaying(false);
    };
    const onEnded = () => {
      setPlaying(false);
      setActive(false);
      handlersRef.current.onEnd();
    };
    const onError = () => setError(true);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    return () => {
      cancelAnimationFrame(raf);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
  }, [active, audio]);

  // Stop the voice when leaving the page.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const play = useCallback(() => {
    setError(false);
    const a = audio();
    if (a.ended) a.currentTime = 0;
    if (!active || a.ended) {
      cueRef.current = -1;
      restartRef.current = true;
    }
    setActive(true);
    void a.play().catch(() => setError(true));
  }, [active, audio]);
  const pause = useCallback(() => audioRef.current?.pause(), []);
  const seek = useCallback(
    (t: number) => {
      const a = audio();
      a.currentTime = Math.max(0, Math.min(NARRATION_DURATION - 0.05, t));
      // Re-announce the stage for the new position.
      cueRef.current = -1;
      restartRef.current = true;
      if (!active || a.paused) play();
    },
    [active, audio, play],
  );
  const close = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    setActive(false);
    setPlaying(false);
    setWord(-1);
    handlersRef.current.onEnd();
  }, []);

  // Elements updated every frame without re-rendering (progress, clock, the filling word).
  const progressEl = useCallback((el: HTMLDivElement | null) => {
    progressRef.current = el;
  }, []);
  const timeEl = useCallback((el: HTMLSpanElement | null) => {
    timeRef.current = el;
  }, []);
  const fillEl = useCallback((el: HTMLSpanElement | null) => {
    fillRef.current = el;
  }, []);

  return { active, playing, word, error, play, pause, seek, close, progressEl, timeEl, fillEl };
}

export type Narration = ReturnType<typeof useNarration>;

/** Karaoke subtitles over the scene: the current line, filling word by word. */
export function NarrationSubtitles({ n, className }: { n: Narration; className?: string }) {
  const { fillEl } = n;
  if (!n.active) return null;
  const line = LINES.find(([a, b]) => n.word >= a && n.word <= b) ?? LINES[0];
  const words = [];
  for (let i = line[0]; i <= line[1]; i++) words.push(i);
  return (
    <div className={cn("pointer-events-none flex justify-center px-3", className)}>
      <div className="max-w-3xl rounded-xl bg-[#0f1714]/82 px-4 py-2 text-center shadow-lg backdrop-blur-sm lg:px-5 lg:py-3">
        <p className="text-[15px] leading-7 font-semibold tracking-[0.01em] sm:text-[17px] sm:leading-8 lg:text-[21px] lg:leading-9" lang="ka">
          {words.map((i) => {
            const state = i < n.word ? "done" : i === n.word ? "now" : "next";
            return (
              <span key={i}>
                <span
                  ref={state === "now" ? fillEl : undefined}
                  className={cn("karaoke-word", state === "done" && "text-[#ffe2a8]", state === "next" && "text-white/55", state === "now" && "karaoke-now")}
                >
                  {WORDS[i].text}
                </span>{" "}
              </span>
            );
          })}
        </p>
      </div>
    </div>
  );
}

/** A small bar on the scene: play/pause, time, progress (click to seek), close. */
export function NarrationBar({ n, className }: { n: Narration; className?: string }) {
  const { progressEl, timeEl } = n;
  if (!n.active) return null;
  return (
    <div className={cn("flex items-center gap-3 rounded-lg bg-[#0f1714]/82 px-3 py-2 text-xs text-white shadow-lg backdrop-blur-sm", className)}>
      <button type="button" onClick={n.playing ? n.pause : n.play} aria-label={n.playing ? "მოყოლის პაუზა" : "მოყოლის გაგრძელება"} className="flex size-8 items-center justify-center rounded-full bg-card/15 hover:bg-card/25">
        {n.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
      </button>
      <div
        role="slider"
        aria-label="მოყოლის ადგილი"
        aria-valuemin={0}
        aria-valuemax={Math.round(NARRATION_DURATION)}
        aria-valuenow={n.word >= 0 ? Math.round(WORDS[n.word].start) : 0}
        tabIndex={0}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          n.seek(((e.clientX - r.left) / r.width) * NARRATION_DURATION);
        }}
        onKeyDown={(e) => {
          const now = n.word >= 0 ? WORDS[n.word].start : 0;
          if (e.key === "ArrowRight") n.seek(now + 5);
          if (e.key === "ArrowLeft") n.seek(now - 5);
        }}
        className="relative h-2 w-40 cursor-pointer rounded-full bg-card/20 sm:w-56"
      >
        <div ref={progressEl} className="absolute inset-y-0 left-0 w-0 rounded-full bg-[#e8b867]" />
      </div>
      <span ref={timeEl} className="tabular-nums text-white/80">
        0:00 / {clock(NARRATION_DURATION)}
      </span>
      <button type="button" onClick={n.close} aria-label="მოყოლის დახურვა" className="flex size-8 items-center justify-center rounded-full hover:bg-card/15">
        <X className="size-4" />
      </button>
    </div>
  );
}

/** The whole text beside the scene; the spoken word is highlighted, and clicking a word jumps there. */
export function NarrationTranscript({ n, accent }: { n: Narration; accent: string }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const paragraphs = useMemo(() => {
    const ps: number[][] = [];
    WORDS.forEach((w, i) => (ps[w.paragraph] ??= []).push(i));
    return ps;
  }, []);
  // Keep the spoken word in view inside the box (not the whole page).
  useEffect(() => {
    const box = boxRef.current;
    if (!box || n.word < 0 || !n.active) return;
    const el = box.querySelector<HTMLElement>(`[data-w="${n.word}"]`);
    if (!el) return;
    // The box is positioned, so the word's offsetTop is measured from the box's top.
    const top = el.offsetTop;
    if (top < box.scrollTop + 24 || top > box.scrollTop + box.clientHeight - 48) box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: "smooth" });
  }, [n.word, n.active]);
  return (
    <section className="mb-5 rounded-xl border border-[#e5d9c8] bg-[#fbf7ef] p-4" aria-label="დიდგორის ბრძოლის აუდიო მოთხრობა">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-[#986627]">
          <Headphones className="size-4" />
          მოუსმინე ისტორიას · {clock(NARRATION_DURATION)}
        </p>
        <button
          type="button"
          onClick={n.playing ? n.pause : n.play}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: accent }}
        >
          {n.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {n.playing ? "პაუზა" : n.active ? "გაგრძელება" : "მოსმენა"}
        </button>
      </div>
      {n.error && <p className="mt-2 text-xs text-[#93541e]">ხმა ვერ ჩაირთო. შეამოწმე ხმის გამაძლიერებელი ან კავშირი და სცადე თავიდან.</p>}
      <div ref={boxRef} className="atlas-scroll relative mt-3 max-h-64 overflow-y-auto pe-1 text-[15px] leading-7 text-copy" lang="ka">
        {paragraphs.map((ids, pi) => (
          <p key={pi} className={cn("mb-3", (pi >= 5 && pi <= 7) && "border-s-2 border-[#d9c3a0] ps-3 italic text-[#4a4033]")}>
            {ids.map((i) => (
              <span key={i}>
                <button
                  type="button"
                  data-w={i}
                  onClick={() => n.seek(WORDS[i].start)}
                  className={cn(
                    "rounded px-0.5 text-left transition-colors hover:bg-[#f0e2c9]",
                    n.active && i === n.word && "bg-[#e8b867] text-ink",
                    n.active && i < n.word && "text-[#8b6337]",
                  )}
                >
                  {WORDS[i].text}
                </button>{" "}
              </span>
            ))}
          </p>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-[#7b7b70]">ხმა: ElevenLabs. დააჭირე სიტყვას — მოყოლა იქიდან გაგრძელდება. ციტატა მემატიანის თხრობას გადმოსცემს.</p>
    </section>
  );
}
