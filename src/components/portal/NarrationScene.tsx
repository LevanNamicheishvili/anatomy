"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { narrationWords, type NarrationBlock } from "@/lib/narration";
import { onNarration, resolveCues, stateAt, type Cue } from "@/lib/narration-cues";

/*
 * The lesson's 3D scene and the narration together. The page puts the narrated text in context
 * (NarrationTextProvider); a scene that has cues follows the voice (useNarrationDirector); and while the voice
 * speaks, the sentence being said runs as karaoke subtitles over the scene (NarrationSubtitles), so a pupil
 * watches what the voice explains — in full screen too.
 */

const TextContext = createContext<NarrationBlock[] | null>(null);

export function NarrationTextProvider({ blocks, children }: { blocks: NarrationBlock[] | null; children: React.ReactNode }) {
  return <TextContext.Provider value={blocks}>{children}</TextContext.Provider>;
}

export const useNarrationText = () => useContext(TextContext);

/** Scenes following the narration now (the player keeps the scene in view, not the text, when there is one). */
let directors = 0;
export const hasSceneDirector = () => directors > 0;

/**
 * The scene follows the narration: `apply` gets the scene's state whenever the voice reaches another cue (or
 * jumps). Returns whether the narration is driving the scene now (the scene's own autoplay should rest then).
 */
export function useNarrationDirector<S>(cues: Cue<S>[], apply: (state: Partial<S>) => void) {
  const blocks = useNarrationText();
  const resolved = useMemo(() => (blocks ? resolveCues(blocks, cues) : []), [blocks, cues]);
  const [driving, setDriving] = useState(false);
  const applyRef = useRef(apply);
  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);
  useEffect(() => {
    if (!resolved.length) return;
    directors++;
    let last = -2;
    const off = onNarration((w) => {
      setDriving(w >= 0);
      if (w < 0) {
        last = -2;
        return;
      }
      const at = stateAt(resolved, w);
      const index = at ? at.index : -1;
      if (index === last) return;
      last = index;
      if (at) applyRef.current(at.state);
    });
    return () => {
      directors--;
      off();
    };
  }, [resolved]);
  return driving;
}

/** Subtitle lines: sentences, long ones cut at commas, dashes or 14 words. */
function lines(blocks: NarrationBlock[]) {
  const words = blocks.flatMap((b) => [...(b.heading ? narrationWords(b.heading).map((w, i, a) => (i === a.length - 1 ? `${w}.` : w)) : []), ...b.paragraphs.flatMap(narrationWords)]);
  const out: [number, number][] = [];
  let from = 0;
  words.forEach((w, i) => {
    const n = i - from + 1;
    if (/[.!?:…]["“»)]*$/.test(w) || i === words.length - 1 || (n >= 8 && (/[,;]$/.test(w) || words[i + 1] === "—")) || n >= 14) {
      out.push([from, i]);
      from = i + 1;
    }
  });
  return { words, lines: out };
}

/**
 * The sentence being said, over the 3D scene (in the scene's frame, so it shows in full screen too), the spoken
 * words filling in. Clicking the subtitles pauses or resumes the voice.
 */
export function NarrationSubtitles({ onToggle, playing }: { onToggle: () => void; playing: boolean }) {
  const blocks = useNarrationText();
  const text = useMemo(() => (blocks ? lines(blocks) : null), [blocks]);
  const [word, setWord] = useState(-1);
  const [frame, setFrame] = useState<HTMLElement | null>(null);
  useEffect(() => onNarration(setWord), []);
  useEffect(() => {
    // The first scene on the page (a lesson has one).
    const find = () => setFrame(document.querySelector<HTMLElement>("[data-scene]"));
    find();
    const id = window.setInterval(find, 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!text || !frame || word < 0) return null;
  const line = text.lines.find(([a, b]) => word >= a && word <= b);
  if (!line) return null;
  return createPortal(
    <button
      type="button"
      onClick={onToggle}
      aria-label={playing ? "პაუზა" : "გაგრძელება"}
      className="absolute inset-x-0 bottom-14 z-20 mx-auto w-fit max-w-[min(92%,52rem)] cursor-pointer rounded-xl bg-black/62 px-4 py-2 text-center text-[17px] leading-7 font-semibold text-white/55 shadow-lg backdrop-blur-sm sm:bottom-16 sm:text-xl sm:leading-8 [[data-full]_&]:text-2xl [[data-full]_&]:leading-10"
    >
      {text.words.slice(line[0], line[1] + 1).map((w, k) => {
        const i = line[0] + k;
        return (
          <span key={i} className={i < word ? "text-white" : i === word ? "rounded bg-[#ffd76a] px-0.5 text-[#1d1a12]" : undefined}>
            {w}
            {k < line[1] - line[0] ? " " : ""}
          </span>
        );
      })}
      {!playing && <span className="ms-2 text-sm font-normal text-white/80">▶ გაგრძელება</span>}
    </button>,
    frame,
  );
}
