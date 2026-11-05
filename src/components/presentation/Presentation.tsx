"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Laptop, Monitor, Presentation as Board, Smartphone, WifiOff, X } from "lucide-react";
import { Logo, PORTAL_NAME } from "@/components/portal/ui";
import { cn } from "@/lib/utils";
import type { NarrationBlock, NarrationInfo } from "@/lib/narration";
import { capPixelRatio, releaseCanvases, type StageProps } from "./stage";

/*
 * The product presenting itself: a full-screen story for an audience, every screen a living scene of the product,
 * nothing recorded. A click anywhere, a remote clicker or the arrows move it on (a click on the left edge goes back);
 * a scene opens only when its picture is ready, behind a dark curtain. The buttons come up when the mouse moves; ✕ or
 * Esc leaves, by a full page load, which also gives back everything the scenes used.
 */

const load = {
  globe: () => import("./GlobeStage"),
  journey: () => import("./JourneyStage"),
  heart: () => import("./HeartStage"),
  atlas: () => import("./AtlasStage"),
  seasons: () => import("./SeasonsStage"),
  georgia: () => import("./GeorgiaStage"),
  didgori: () => import("./DidgoriStage"),
};
const GlobeStage = dynamic(load.globe, { ssr: false });
const JourneyStage = dynamic(load.journey, { ssr: false });
const HeartStage = dynamic(load.heart, { ssr: false });
const AtlasStage = dynamic(load.atlas, { ssr: false });
const SeasonsStage = dynamic(load.seasons, { ssr: false });
const GeorgiaStage = dynamic(load.georgia, { ssr: false });
const DidgoriStage = dynamic(load.didgori, { ssr: false });

interface Counts {
  lessons: number;
  narrated: number;
  hours: number;
}

const nf = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Counts up to a number when it comes on the screen. */
function CountUp({ to, delay = 0 }: { to: number; delay?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now() + delay;
    const step = () => {
      const k = Math.max(0, Math.min(1, (performance.now() - start) / 1400));
      setV(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, delay]);
  return <>{nf(v)}</>;
}

function Numbers({ counts }: { counts: Counts }) {
  const items = [
    { n: counts.lessons, label: "გაკვეთილი", note: "ბიოლოგია VIII–XII კლასი, გეოგრაფია VI–IX კლასი" },
    { n: 2239, label: "ანატომიური სტრუქტურა", note: "3D-ში, ქართული სახელებით" },
    { n: counts.narrated, label: "გაკვეთილი და თემა ქართული ხმით", note: `სულ ~${String(counts.hours).replace(".", ",")} საათი თხრობა` },
    { n: 3, label: "საგანი", note: "ბიოლოგია, გეოგრაფია, ისტორია" },
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,#12263f_0%,#05080f_75%)] px-[6vw]">
      <div className="w-full">
        <p className="present-rise font-heading text-[clamp(2rem,4.6vw,5rem)] leading-tight text-white">ეს იდეა არ არის. ეს უკვე აშენებულია.</p>
        <dl className="mt-[5vh] grid grid-cols-2 gap-[3vw] lg:grid-cols-4">
          {items.map((x, i) => (
            <div key={x.label} className="present-rise rounded-2xl bg-white/6 p-[2vw] ring-1 ring-white/12" style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
              <dd className="font-heading text-[clamp(2.5rem,5vw,6rem)] leading-none whitespace-nowrap text-[#ffd76a] tabular-nums">
                <CountUp to={x.n} delay={200 + i * 150} />
              </dd>
              <dt className="mt-3 text-[clamp(1rem,1.6vw,1.75rem)] leading-snug font-semibold text-white">{x.label}</dt>
              <p className="mt-1.5 text-[clamp(0.8rem,1.1vw,1.2rem)] leading-snug text-white/70">{x.note}</p>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Everywhere({ offline }: { offline: boolean }) {
  const items = [
    { icon: Board, title: "სმარტ დაფაზე", note: "შეხებით, მასწავლებლის ხელში" },
    { icon: Monitor, title: "სკოლის კომპიუტერზე", note: "აპლიკაცია, ინტერნეტის გარეშე" },
    { icon: Laptop, title: "ვებ-ვერსიით", note: "ნებისმიერი ბრაუზერიდან" },
    { icon: Smartphone, title: "ტელეფონზე", note: "მოსწავლესთან, სახლში" },
  ];
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,#12263f_0%,#05080f_75%)] px-[6vw]">
      <div className="w-full">
        <p className="present-rise font-heading text-[clamp(2rem,4.6vw,5rem)] leading-tight text-white">სკოლაში ინტერნეტი არ არის? არაფერი იცვლება.</p>
        <ul className="mt-[5vh] grid grid-cols-2 gap-[3vw] lg:grid-cols-4">
          {items.map((x, i) => (
            <li key={x.title} className="present-rise rounded-2xl bg-white/6 p-[2vw] ring-1 ring-white/12" style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
              <x.icon className="size-[clamp(2.25rem,4vw,4.5rem)] text-[#ffd76a]" strokeWidth={1.6} aria-hidden />
              <p className="mt-4 text-[clamp(1.1rem,1.8vw,2rem)] leading-snug font-semibold text-white">{x.title}</p>
              <p className="mt-1.5 text-[clamp(0.85rem,1.2vw,1.3rem)] leading-snug text-white/70">{x.note}</p>
            </li>
          ))}
        </ul>
        {offline && (
          <p className="present-rise mt-[5vh] flex items-center gap-3 text-[clamp(1.05rem,1.9vw,2.1rem)] font-semibold text-[#9fe8c9]" style={{ animationDelay: "1s" }}>
            <WifiOff className="size-[1.2em] shrink-0" aria-hidden />
            ყველაფერი, რაც ახლა ნახეთ, ამ კომპიუტერიდან მუშაობს. ინტერნეტი არ დაგვჭირვებია.
          </p>
        )}
      </div>
    </div>
  );
}

interface Stop {
  id: string;
  /** Small line over the title (the subject). */
  eyebrow?: string;
  title?: string;
  line?: string;
  /** The words leave after a few seconds, so the scene has the whole screen. */
  fade?: boolean;
  /** Where the words stand: bottom left (the default), bottom middle (first and last screen), or top (the voice's words take the bottom). */
  place?: "centre" | "top";
  /** Code to fetch ahead of time, so the next screen opens quickly. */
  preload?: () => Promise<unknown>;
  stage: (p: StageProps) => React.ReactNode;
}

export function Presentation({ offline, counts, seasons }: { offline: boolean; counts: Counts; seasons: { blocks: NarrationBlock[]; narration: NarrationInfo | null } }) {
  const stops: Stop[] = [
    { id: "open", place: "centre", title: PORTAL_NAME, line: "ცოცხალი, 3D სასწავლო მასალა საქართველოს სკოლებისთვის", preload: load.globe, stage: (p) => <GlobeStage {...p} /> },
    { id: "zoom", eyebrow: "ბიოლოგია", title: "სხეულიდან დნმ-მდე", line: "მოსწავლე სურათს აღარ იზეპირებს. ის შიგნით შედის.", fade: true, preload: load.journey, stage: (p) => <JourneyStage {...p} /> },
    { id: "heart", eyebrow: "ბიოლოგია", title: "გული, რომელიც ცემს", line: "კამერები, სარქვლები, სისხლის გზა: ისე, როგორც ცოცხალ სხეულშია.", fade: true, preload: load.heart, stage: (p) => <HeartStage {...p} /> },
    { id: "atlas", eyebrow: "ადამიანის ატლასი", title: "მთელი სხეული, ფენა-ფენა", line: "2 239 სტრუქტურა ქართული სახელებით.", fade: true, preload: load.atlas, stage: (p) => <AtlasStage {...p} /> },
    { id: "voice", eyebrow: "გეოგრაფია", title: "ხმა ხსნის, სცენა მიჰყვება", line: "რასაც მოსწავლე ისმენს, ზუსტად იმას ხედავს.", fade: true, place: "top", preload: load.seasons, stage: (p) => <SeasonsStage {...p} blocks={seasons.blocks} narration={seasons.narration} /> },
    { id: "georgia", eyebrow: "გეოგრაფია", title: "საქართველო, როგორიც არის", line: "ნამდვილი რელიეფი, მდინარეები, მთები და ქალაქები.", fade: true, preload: load.georgia, stage: (p) => <GeorgiaStage {...p} /> },
    { id: "didgori", eyebrow: "ისტორია", title: "დიდგორი, 1121", line: "ბრძოლა, რომელსაც მოსწავლე საკუთარი თვალით ხედავს.", fade: true, place: "top", preload: load.didgori, stage: (p) => <DidgoriStage {...p} /> },
    { id: "numbers", stage: (p) => <Reveal {...p}><Numbers counts={counts} /></Reveal> },
    { id: "everywhere", stage: (p) => <Reveal {...p}><Everywhere offline={offline} /></Reveal> },
    { id: "close", place: "centre", title: "მზად არის. შევიტანოთ სკოლებში.", line: "შემდეგი ნაბიჯი: პილოტი საქართველოს სკოლებში", preload: load.globe, stage: (p) => <GlobeStage {...p} far /> },
  ];

  useState(() => capPixelRatio());
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [black, setBlack] = useState(false);
  const [hint, setHint] = useState(true);
  const [wordsGone, setWordsGone] = useState(false);
  const [idle, setIdle] = useState(false);
  /** R starts the screen's scene again. */
  const [take, setTake] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const pressRef = useRef({ x: 0, y: 0 });
  const stop = stops[index];
  const count = stops.length;

  const go = useCallback(
    (to: number) => {
      const next = Math.max(0, Math.min(count - 1, to));
      setHint(false);
      setIndex((cur) => {
        if (cur !== next) {
          setReady(false);
          setWordsGone(false);
        }
        return next;
      });
    },
    [count],
  );
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen().catch(() => {});
  }, []);
  const leave = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    // A full page load on purpose: it gives back all the memory of the scenes (and the pixel ratio).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/dashboard");
  }, []);
  /** On: the first time it only takes the room (full screen, on the title); after the last screen it shows the way out. */
  const forward = useCallback(() => {
    if (hint && !document.fullscreenElement && document.fullscreenEnabled) {
      setHint(false);
      void rootRef.current?.requestFullscreen().catch(() => {});
      return;
    }
    if (index === count - 1) setIdle(false);
    go(index + 1);
  }, [hint, index, count, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        e.preventDefault();
        forward();
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        go(index - 1);
      } else if (e.key === "Home") go(0);
      else if (e.key === "End") go(count - 1);
      else if (e.key === "f" || e.key === "F") toggleFull();
      else if (e.key === "r" || e.key === "R") {
        setReady(false);
        setWordsGone(false);
        setTake((t) => t + 1);
      }
      // Clickers' "blank screen" button sends one of these.
      else if (e.key === "b" || e.key === "B" || e.key === ".") setBlack((b) => !b);
      else if (e.key === "Escape") {
        // In full screen Esc only leaves full screen (the browser does that); out of it, it leaves the presentation.
        if (black) setBlack(false);
        else if (!document.fullscreenElement) leave();
      }
      else if (/^[1-9]$/.test(e.key)) go(Number(e.key) - 1);
      else if (e.key === "0") go(9);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, count, go, forward, leave, toggleFull, black]);

  // The pointer goes away when it is not used; the words go too on the scenes that want the whole screen.
  useEffect(() => {
    let id = window.setTimeout(() => setIdle(true), 2500);
    const move = () => {
      setIdle(false);
      window.clearTimeout(id);
      id = window.setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener("pointermove", move);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("pointermove", move);
    };
  }, []);
  useEffect(() => {
    if (!ready || !stop.fade) return;
    const id = window.setTimeout(() => setWordsGone(true), 7000);
    return () => window.clearTimeout(id);
  }, [ready, stop.fade]);
  // A scene that never tells it is ready must not leave the room in the dark.
  useEffect(() => {
    if (ready) return;
    const id = window.setTimeout(() => setReady(true), 7000);
    return () => window.clearTimeout(id);
  }, [ready, index]);
  // The next screen's code is fetched ahead of time.
  useEffect(() => {
    void stops[index + 1]?.preload?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onReady = useCallback(() => setReady(true), []);

  return (
    <div
      ref={rootRef}
      data-present
      className={cn("fixed inset-0 z-[200] overflow-hidden bg-[#05080f] font-sans text-white select-none", idle && "cursor-none")}
      onPointerDown={(e) => {
        pressRef.current = { x: e.clientX, y: e.clientY };
      }}
      onClick={(e) => {
        // Turning a model with the mouse is not a click; a click on the left edge goes back, anywhere else on.
        if (Math.hypot(e.clientX - pressRef.current.x, e.clientY - pressRef.current.y) > 6) return;
        if (e.clientX / window.innerWidth < 0.18) go(index - 1);
        else forward();
      }}
    >
      <StageFrame key={`${stop.id}-${take}`}>{stop.stage({ onReady })}</StageFrame>

      {/* The words over the scene. */}
      {stop.title && (
        <div
          key={`${stop.id}-${take}-words`}
          className={cn(
            "pointer-events-none absolute inset-0 flex transition-opacity duration-1000",
            stop.place === "centre"
              ? "items-end justify-center bg-[linear-gradient(to_top,rgba(3,6,12,0.9)_0%,rgba(3,6,12,0.55)_28%,transparent_52%)] pb-[9vh] text-center"
              : stop.place === "top"
                ? "items-start bg-[linear-gradient(to_bottom,rgba(3,6,12,0.82)_0%,rgba(3,6,12,0.35)_24%,transparent_42%)] p-[4vw]"
                : "items-end bg-[linear-gradient(to_top,rgba(3,6,12,0.82)_0%,rgba(3,6,12,0.35)_30%,transparent_50%)] p-[5vw]",
            (wordsGone || !ready) && "opacity-0",
          )}
        >
          <div className={stop.place === "centre" ? "max-w-[84vw]" : "max-w-[70vw]"}>
            {stop.place === "centre" && <Logo className={cn("mx-auto mb-[2.5vh] size-[clamp(3.5rem,7vw,8rem)]", ready && "present-rise")} />}
            {stop.eyebrow && <p className={cn("text-[clamp(1rem,1.7vw,1.9rem)] font-semibold text-[#ffd76a]", ready && "present-rise")}>{stop.eyebrow}</p>}
            <h1 className={cn("mt-2 font-heading leading-[1.08] text-white [text-shadow:0_4px_30px_rgba(0,0,0,0.6)]", stop.place === "centre" ? "text-[clamp(2.5rem,6vw,7rem)]" : "text-[clamp(2rem,4.6vw,5.4rem)]", ready && "present-rise")} style={{ animationDelay: "0.12s" }}>
              {stop.title}
            </h1>
            {stop.line && (
              <p className={cn("mt-3 text-[clamp(1.05rem,2vw,2.3rem)] leading-snug font-medium text-white/92 [text-shadow:0_2px_16px_rgba(0,0,0,0.7)]", ready && "present-rise")} style={{ animationDelay: "0.28s" }}>
                {stop.line}
              </p>
            )}
          </div>
        </div>
      )}

      {/* The curtain: dark until the scene is ready; black when the presenter wants the room's attention. */}
      <div className={cn("pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-[#05080f] transition-opacity duration-700", ready && !black ? "opacity-0" : "opacity-100")}>
        {/* A scene that takes a moment must not look like a stopped computer. */}
        {!ready && !black && (
          <span className="present-rise flex flex-col items-center gap-3 text-[clamp(0.9rem,1.2vw,1.3rem)] text-white/60" style={{ animationDelay: "0.5s" }}>
            <span className="h-1 w-40 animate-pulse rounded-full bg-[#ffd76a]/70" />
            იტვირთება…
          </span>
        )}
      </div>

      {/* The way out and the way on, when the mouse moves. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          leave();
        }}
        title="გასვლა (Esc)"
        aria-label="პრეზენტაციიდან გასვლა"
        className={cn("absolute top-4 right-4 z-50 flex h-12 items-center gap-2 rounded-xl bg-black/65 px-4 font-semibold text-white ring-1 ring-white/25 backdrop-blur-sm transition-opacity duration-300 hover:bg-black/85", idle && "pointer-events-none opacity-0")}
      >
        <X className="size-5" aria-hidden />
        გასვლა
      </button>
      {[
        { label: "წინა", icon: ChevronLeft, side: "left-4", to: () => go(index - 1), off: index === 0 },
        { label: "შემდეგი", icon: ChevronRight, side: "right-4", to: forward, off: index === count - 1 },
      ].map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            b.to();
          }}
          title={b.label}
          aria-label={b.label}
          className={cn("absolute top-1/2 z-50 flex size-14 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/25 backdrop-blur-sm transition-opacity duration-300 hover:bg-black/85", b.side, (idle || b.off) && "pointer-events-none opacity-0")}
        >
          <b.icon className="size-7" aria-hidden />
        </button>
      ))}

      {/* How far along, out of the way. */}
      <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center gap-1.5 pb-3 transition-opacity duration-500", idle && "opacity-30")} aria-hidden>
        {stops.map((s, i) => (
          <span key={s.id} className={cn("h-1 w-8 rounded-full", i === index ? "bg-[#ffd76a]" : i < index ? "bg-white/55" : "bg-white/20")} />
        ))}
      </div>
      {hint && (
        <p className="pointer-events-none absolute inset-x-0 bottom-8 z-40 text-center text-sm text-white/70">
          დაწკაპუნება ან → დაწყება · ← წინა · B შავი ეკრანი · R სცენა თავიდან · Esc გასვლა
        </p>
      )}
    </div>
  );
}

/** Holds one screen's scene; when it goes, its graphics memory goes with it. */
function StageFrame({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    return () => {
      const canvases = el ? [...el.querySelectorAll("canvas")] : [];
      // After the scene has stopped drawing (its own clean-up comes right after this one).
      window.setTimeout(() => releaseCanvases(canvases), 150);
    };
  }, []);
  return (
    <div ref={ref} className="absolute inset-0">
      {children}
    </div>
  );
}

/** Screens with nothing to load are ready at once. */
function Reveal({ onReady, children }: StageProps & { children: React.ReactNode }) {
  useEffect(() => onReady(), [onReady]);
  return <>{children}</>;
}
