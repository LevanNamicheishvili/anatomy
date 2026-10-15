"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Headphones, Pause, Play, RotateCcw, X } from "lucide-react";
import { narrationAudio, narrationTimings, type NarrationInfo } from "@/lib/narration";
import { cn } from "@/lib/utils";

/*
 * The lesson read aloud, karaoke style: the words of the lesson text (spans marked data-nw by lesson.tsx) light up
 * as the voice says them, the page follows the voice down, and a click on a word moves the voice there. The
 * button sits under the introduction; while it plays, a bar at the foot of the screen holds the controls. When
 * "start by itself" is on (the default), the narration starts as the lesson opens — where the browser allows sound
 * without a click; otherwise the button waits for one.
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

export function LessonNarration({ narration }: { narration: NarrationInfo }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  /** Word starts and ends, flat: [s0, e0, s1, e1, …]. */
  const times = useRef<Float32Array | null>(null);
  const words = useRef<HTMLElement[]>([]);
  const shown = useRef(-1);
  const userScrolled = useRef(0);
  const frame = useRef(0);
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [time, setTime] = useState(0);
  const [rate, setRate] = useState(1);
  const [auto, setAuto] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const active = state !== "idle";

  /** Light the words up to word i (−1: none). */
  const show = useCallback((i: number, now: boolean) => {
    const list = words.current;
    const from = shown.current;
    if (i > from) for (let k = Math.max(0, from); k < i; k++) list[k]?.classList.add("nw-said");
    else for (let k = i; k <= from; k++) list[k]?.classList.remove("nw-said");
    list[from]?.classList.remove("nw-now");
    if (i >= 0 && now) list[i]?.classList.add("nw-now");
    if (i >= 0) list[i]?.classList.add("nw-said");
    shown.current = i;
    // Keep the spoken line in view, unless the pupil is reading elsewhere just now.
    const el = list[i];
    if (el && now && performance.now() - userScrolled.current > 4000) {
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.15 || r.bottom > innerHeight * 0.75) el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, []);

  const tick = useCallback(() => {
    const a = audio.current;
    const t = times.current;
    if (!a) return;
    if (t && words.current.length) {
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
      show(words.current.length - 1, false);
    });
    audio.current = a;
    try {
      const res = await fetch(narrationTimings(narration));
      const data = (await res.json()) as { words: [number, number][] };
      const spans = [...document.querySelectorAll<HTMLElement>("[data-nw]")];
      // The page's words and the recording's must be the same words; otherwise the voice plays without karaoke.
      if (spans.length === data.words.length) {
        times.current = Float32Array.from(data.words.flat());
        words.current = spans;
        spans.forEach((s, i) => (s.dataset.nw = String(i)));
      }
    } catch {
      // Timings missing: the voice alone.
    }
    return a;
  }, [narration, show, tick]);

  const play = useCallback(async () => {
    setState((s) => (s === "idle" ? "loading" : s));
    const a = await load();
    // Closed (or replaced) while the timings were loading: this one must stay quiet.
    if (a !== audio.current || a !== sounding) return silence(a);
    a.playbackRate = rate;
    document.documentElement.dataset.narrating = "";
    try {
      await a.play();
      setBlocked(false);
    } catch {
      // The browser wants a click first.
      setBlocked(true);
      setState("idle");
      delete document.documentElement.dataset.narrating;
    }
  }, [load, rate]);

  const stop = useCallback(() => {
    audio.current?.pause();
    if (audio.current) audio.current.currentTime = 0;
    setState("idle");
    show(-1, false);
    delete document.documentElement.dataset.narrating;
  }, [show]);

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

  // Start by itself if allowed; tidy up when the lesson closes.
  useEffect(() => {
    const on = readAuto();
    setAuto(on);
    if (on) void play();
    const mark = () => (userScrolled.current = performance.now());
    addEventListener("wheel", mark, { passive: true });
    addEventListener("touchmove", mark, { passive: true });
    return () => {
      removeEventListener("wheel", mark);
      removeEventListener("touchmove", mark);
      cancelAnimationFrame(frame.current);
      silence(audio.current);
      audio.current = null;
      for (const w of words.current) w.classList.remove("nw-said", "nw-now");
      delete document.documentElement.dataset.narrating;
    };
    // Once per lesson.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narration.id]);

  // While it plays, a click on a word moves the voice there.
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>("[data-nw]");
      const i = el ? Number(el.dataset.nw) : NaN;
      const t = times.current;
      if (!t || Number.isNaN(i)) return;
      seek(t[i * 2]);
      if (audio.current?.paused) void audio.current.play();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [active, seek]);

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

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "inline-flex min-h-12 items-center gap-2.5 rounded-xl px-5 text-base font-semibold text-white shadow-sm transition-colors",
            playing ? "bg-deep hover:bg-deep/90" : "bg-brand hover:bg-brand-strong",
            blocked && "animate-pulse",
          )}
        >
          {playing ? <Pause className="size-5" aria-hidden /> : state === "loading" ? <Headphones className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
          {playing ? "პაუზა" : state === "paused" ? "გაგრძელება" : "მოუსმინე გაკვეთილს"}
          <span className="font-normal opacity-80 tabular-nums">{clock(active ? narration.duration - time : narration.duration)}</span>
        </button>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-mute">
          <input type="checkbox" checked={auto} onChange={changeAuto} className="size-4 accent-[var(--color-brand)]" />
          გაკვეთილის გახსნისას თავისით ჩაირთოს
        </label>
        {blocked && <span className="text-sm text-mute">დააჭირე ღილაკს — ბრაუზერი ხმას პირველი დაჭერის შემდეგ რთავს.</span>}
      </div>

      {active && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/96 shadow-[0_-6px_24px_rgb(0_0_0/0.08)] backdrop-blur" role="region" aria-label="გაკვეთილის გახმოვანება">
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
            <button type="button" onClick={toggle} aria-label={playing ? "პაუზა" : "გაგრძელება"} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </button>
            <button type="button" onClick={() => seek(time - 10)} aria-label="10 წამით უკან" title="10 წამით უკან" className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-subtle">
              <RotateCcw className="size-5" />
            </button>
            <span className="w-11 shrink-0 text-right text-xs text-mute tabular-nums">{clock(time)}</span>
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
            <span className="w-11 shrink-0 text-xs text-mute tabular-nums">{clock(narration.duration)}</span>
            <button type="button" onClick={changeRate} title="სიჩქარე" className="h-9 shrink-0 rounded-lg bg-subtle px-2 text-sm font-semibold text-ink tabular-nums">
              {rate}×
            </button>
            <button type="button" onClick={stop} aria-label="გახმოვანების დახურვა" className="flex size-10 shrink-0 items-center justify-center rounded-full text-mute hover:bg-subtle">
              <X className="size-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
