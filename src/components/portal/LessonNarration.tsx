"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, RotateCcw, X } from "lucide-react";
import { narrationAudio, narrationTimings, type NarrationInfo } from "@/lib/narration";
import { cn } from "@/lib/utils";

/*
 * A lesson read aloud, karaoke style: the words of the text (spans marked data-nw="<word number>", see Spoken in
 * lesson.tsx) light up as the voice says them, the text follows the voice, and a click on a word moves the voice
 * there. On a lesson page the button sits under the introduction and, while it plays, a bar at the foot of the
 * screen holds the controls; in the atlas's topic panel ("sheet") the controls stay in the panel. When "start by
 * itself" is on (the default), the narration starts as the lesson opens — where the browser allows sound without
 * a click; otherwise the button waits for one. `onBlock` hears which part is being read (the board mode turns
 * its slides with the voice).
 */

const AUTO_KEY = "lesson-narration-auto";
const RATES = [1, 1.2, 0.85];

/**
 * The one narration that may sound. A second voice would be heard as an echo of the first (React mounts a
 * component twice in development; a quick move between lessons does it too), so a new one silences the old.
 */
let sounding: HTMLAudioElement | null = null;

function silence(a: HTMLAudioElement | null) {
  if (!a) return;
  a.pause();
  a.removeAttribute("src");
  a.load();
  if (sounding === a) sounding = null;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function readAuto() {
  try {
    return localStorage.getItem(AUTO_KEY) !== "0";
  } catch {
    return true;
  }
}

/** Mark the spoken words (number ≤ i) and the one being said; −1 clears. */
function paint(i: number, now: boolean) {
  for (const el of document.querySelectorAll<HTMLElement>("[data-nw]")) {
    const k = Number(el.dataset.nw);
    el.classList.toggle("nw-said", k <= i);
    el.classList.toggle("nw-now", now && k === i);
  }
}

export function LessonNarration({
  narration,
  variant = "page",
  blockStarts,
  onBlock,
}: {
  narration: NarrationInfo;
  variant?: "page" | "sheet";
  /** Number of the first word of each part, for `onBlock`. */
  blockStarts?: number[];
  onBlock?: (block: number) => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  /** Word starts and ends, flat: [s0, e0, s1, e1, …]. */
  const times = useRef<Float32Array | null>(null);
  const shown = useRef(-1);
  const block = useRef(-1);
  const userScrolled = useRef(0);
  const frame = useRef(0);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [auto, setAuto] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const active = state !== "idle";
  const hooks = useRef({ blockStarts, onBlock });
  useEffect(() => {
    hooks.current = { blockStarts, onBlock };
  }, [blockStarts, onBlock]);

  /** Light the words up to word i (−1: none) and keep it in view. */
  const show = useCallback((i: number, now: boolean) => {
    shown.current = i;
    const { blockStarts: starts, onBlock: tell } = hooks.current;
    if (starts && tell && i >= 0) {
      let b = 0;
      while (b + 1 < starts.length && starts[b + 1] <= i) b++;
      if (b !== block.current) {
        block.current = b;
        tell(b);
      }
    }
    paint(i, now);
    // Keep the spoken line in view, unless the pupil is reading elsewhere just now.
    const el = document.querySelector<HTMLElement>(`[data-nw="${i}"]`);
    if (el && now && performance.now() - userScrolled.current > 4000) {
      const r = el.getBoundingClientRect();
      const box = el.closest(".atlas-scroll")?.getBoundingClientRect() ?? { top: 0, bottom: innerHeight, height: innerHeight };
      if (r.top < box.top + box.height * 0.15 || r.bottom > box.top + box.height * 0.75) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, []);

  const tick = useCallback(() => {
    const a = audio.current;
    const t = times.current;
    if (!a) return;
    if (t) {
      const now = a.currentTime;
      // Last word started by now (binary search on the starts).
      let lo = 0;
      let hi = t.length / 2 - 1;
      let at = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (t[mid * 2] <= now) {
          at = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      if (at !== shown.current) show(at, true);
    }
    setTime(a.currentTime);
    if (!a.paused) frame.current = requestAnimationFrame(tick);
  }, [show]);

  const load = useCallback(async () => {
    if (audio.current) return audio.current;
    silence(sounding);
    const a = new Audio(narrationAudio(narration));
    sounding = a;
    a.preload = "auto";
    a.addEventListener("play", () => {
      setState("playing");
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(tick);
    });
    a.addEventListener("pause", () => setState((s) => (s === "idle" ? s : "paused")));
    a.addEventListener("ended", () => {
      setState("paused");
      paint(shown.current, false);
    });
    audio.current = a;
    try {
      const res = await fetch(narrationTimings(narration));
      const data = (await res.json()) as { words: [number, number][] };
      times.current = Float32Array.from(data.words.flat());
    } catch {
      // Timings missing: the voice alone.
    }
    return a;
  }, [narration, tick]);

  const play = useCallback(async () => {
    setState((s) => (s === "idle" ? "loading" : s));
    const a = await load();
    // Closed (or replaced) while the timings were loading: this one must stay quiet.
    if (a !== audio.current || a !== sounding) return silence(a);
    a.playbackRate = rate;
    document.documentElement.dataset.narrating = variant;
    try {
      await a.play();
      setBlocked(false);
    } catch {
      // The browser wants a click first.
      setBlocked(true);
      setState("idle");
      delete document.documentElement.dataset.narrating;
    }
  }, [load, rate, variant]);

  const stop = useCallback(() => {
    audio.current?.pause();
    if (audio.current) audio.current.currentTime = 0;
    setState("idle");
    shown.current = -1;
    block.current = -1;
    paint(-1, false);
    delete document.documentElement.dataset.narrating;
  }, []);

  const seek = useCallback(
    (t: number) => {
      const a = audio.current;
      if (!a) return;
      a.currentTime = Math.max(0, Math.min(narration.duration, t));
      userScrolled.current = 0;
      tick();
    },
    [narration.duration, tick],
  );

  // Start by itself if allowed; tidy up when the lesson (or topic) closes.
  useEffect(() => {
    const on = readAuto();
    setAuto(on);
    if (on) void play();
    const mark = () => (userScrolled.current = performance.now());
    addEventListener("wheel", mark, { passive: true, capture: true });
    addEventListener("touchmove", mark, { passive: true, capture: true });
    return () => {
      removeEventListener("wheel", mark, { capture: true });
      removeEventListener("touchmove", mark, { capture: true });
      cancelAnimationFrame(frame.current);
      silence(audio.current);
      audio.current = null;
      times.current = null;
      shown.current = -1;
      block.current = -1;
      paint(-1, false);
      delete document.documentElement.dataset.narrating;
    };
    // Once per narration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narration.id]);

  // While it plays, a click on a word moves the voice there.
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-nw]");
      const i = el ? Number(el.dataset.nw) : NaN;
      const t = times.current;
      if (!t || Number.isNaN(i) || i * 2 >= t.length) return;
      seek(t[i * 2]);
      if (audio.current?.paused) void audio.current.play();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [active, seek]);

  // New words came on screen (a board slide turned): paint them too.
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => paint(shown.current, !audio.current?.paused), 400);
    return () => window.clearInterval(id);
  }, [active]);

  const toggle = () => {
    const a = audio.current;
    if (!a || state === "idle") void play();
    else if (a.paused) void a.play();
    else a.pause();
  };
  const changeRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    if (audio.current) audio.current.playbackRate = next;
  };
  const changeAuto = () => {
    const next = !auto;
    setAuto(next);
    try {
      localStorage.setItem(AUTO_KEY, next ? "1" : "0");
    } catch {
      // Private window: the choice lasts for this page only.
    }
  };
  const playing = state === "playing";
  const sheet = variant === "sheet";

  const controls = (
    <div className={cn("flex items-center gap-2 sm:gap-3", !sheet && "mx-auto max-w-3xl px-3 py-2 sm:px-4")}>
      <button type="button" onClick={toggle} aria-label={playing ? "პაუზა" : "გაგრძელება"} className={cn("flex shrink-0 items-center justify-center rounded-full bg-brand text-white", sheet ? "size-10" : "size-11")}>
        {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
      </button>
      <button type="button" onClick={() => seek(time - 10)} aria-label="10 წამით უკან" title="10 წამით უკან" className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-subtle">
        <RotateCcw className="size-5" />
      </button>
      <span className="w-10 shrink-0 text-right text-xs text-mute tabular-nums">{clock(time)}</span>
      <input
        type="range"
        min={0}
        max={narration.duration}
        step={0.1}
        value={time}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="სად არის ხმა"
        className="h-2 min-w-0 flex-1 cursor-pointer accent-[var(--color-brand)]"
      />
      <span className="w-10 shrink-0 text-xs text-mute tabular-nums">{clock(narration.duration)}</span>
      <button type="button" onClick={changeRate} title="სიჩქარე" className="h-9 shrink-0 rounded-lg bg-subtle px-2 text-sm font-semibold text-ink tabular-nums">
        {rate}×
      </button>
      <button type="button" onClick={stop} aria-label="გახმოვანების დახურვა" className="flex size-10 shrink-0 items-center justify-center rounded-full text-mute hover:bg-subtle">
        <X className="size-5" />
      </button>
    </div>
  );

  if (sheet && active) return <div className="shrink-0 border-b border-line px-4 py-2">{controls}</div>;

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", sheet ? "shrink-0 border-b border-line px-4 py-2.5" : "mt-4")}>
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "inline-flex items-center gap-2.5 rounded-xl font-semibold text-white shadow-sm transition-colors",
            sheet ? "min-h-10 px-4 text-sm" : "min-h-12 px-5 text-base",
            playing ? "bg-deep hover:bg-deep/90" : "bg-brand hover:bg-brand-strong",
            blocked && "animate-pulse",
          )}
        >
          {playing ? <Pause className="size-5" aria-hidden /> : state === "loading" ? <Headphones className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
          {playing ? "პაუზა" : state === "paused" ? "გაგრძელება" : sheet ? "მოუსმინე" : "მოუსმინე გაკვეთილს"}
          <span className="font-normal opacity-80 tabular-nums">{clock(active ? narration.duration - time : narration.duration)}</span>
        </button>
        <label className={cn("flex cursor-pointer items-center gap-2 text-mute", sheet ? "min-h-9 text-xs" : "min-h-10 text-sm")}>
          <input type="checkbox" checked={auto} onChange={changeAuto} className="size-4 accent-[var(--color-brand)]" />
          {sheet ? "თავისით ჩაირთოს" : "გაკვეთილის გახსნისას თავისით ჩაირთოს"}
        </label>
        {blocked && <span className={cn("text-mute", sheet ? "text-xs" : "text-sm")}>დააჭირე ღილაკს — ბრაუზერი ხმას პირველი დაჭერის შემდეგ რთავს.</span>}
      </div>

      {!sheet && active && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/96 shadow-[0_-6px_24px_rgb(0_0_0/0.08)] backdrop-blur" role="region" aria-label="გაკვეთილის გახმოვანება">
          {controls}
        </div>
      )}
    </>
  );
}
