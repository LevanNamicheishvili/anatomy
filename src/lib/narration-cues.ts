import { narrationLayout, narrationWords, type NarrationBlock } from "./narration";

/*
 * The lesson's 3D scene follows the narration: a scene lists cues — "from this phrase of the text on, the scene
 * looks like this" — and is told, word by word, where the voice is. Cues are anchored to phrases of the text (not
 * to seconds), so they stay right when a lesson is recorded again; a jump in the narration (a click on a word,
 * the timeline) puts the scene where it is at that word, because the state is everything the cues up to that
 * word have set.
 */

export interface Cue<S> {
  /** A phrase of the lesson text (punctuation and case do not matter); the cue starts at its first word. Empty: the start of `block`. */
  at: string;
  /** Look for the phrase in this block only (0: the introduction, 1…: the sections). */
  block?: number;
  /** What the scene shows from here on (merged over the cues before). */
  set: Partial<S>;
}

export interface ResolvedCue<S> {
  word: number;
  set: Partial<S>;
}

const norm = (w: string) => w.toLowerCase().replace(/[„“"«»()[\].,!?:;…—–-]+/g, "");

/** Word numbers of the cues (the phrases are looked for in order, each after the one before). */
export function resolveCues<S>(blocks: NarrationBlock[], cues: Cue<S>[]): ResolvedCue<S>[] {
  // Words that are only punctuation (a dash) are left out of the matching, keeping their numbers.
  const all = blocks.flatMap((b) => [...(b.heading ? narrationWords(b.heading) : []), ...b.paragraphs.flatMap(narrationWords)]).map(norm);
  const words: { n: number; w: string }[] = all.flatMap((w, n) => (w ? [{ n, w }] : []));
  const layout = narrationLayout(blocks);
  const out: ResolvedCue<S>[] = [];
  let from = 0;
  for (const cue of cues) {
    const phrase = narrationWords(cue.at).map(norm).filter(Boolean);
    const lo = cue.block !== undefined ? (layout[cue.block]?.start ?? 0) : from;
    const hi = cue.block !== undefined ? (layout[cue.block + 1]?.start ?? all.length) : all.length;
    let found = phrase.length ? -1 : lo;
    for (let i = 0; phrase.length && i + phrase.length <= words.length && found < 0; i++) {
      if (words[i].n < lo || words[i + phrase.length - 1].n >= hi) continue;
      if (phrase.every((p, k) => words[i + k].w === p)) found = words[i].n;
    }
    if (found < 0) {
      if (process.env.NODE_ENV !== "production") console.warn(`narration cue not found: "${cue.at}"`);
      continue;
    }
    out.push({ word: found, set: cue.set });
    from = found;
  }
  return out.sort((a, b) => a.word - b.word);
}

/** The scene at word w: everything the cues up to it have set (null before the first cue). */
export function stateAt<S>(cues: ResolvedCue<S>[], w: number): { index: number; state: Partial<S> } | null {
  let index = -1;
  for (let i = 0; i < cues.length && cues[i].word <= w; i++) index = i;
  if (index < 0) return null;
  const state: Partial<S> = {};
  for (let i = 0; i <= index; i++) Object.assign(state, cues[i].set);
  return { index, state };
}

// ---- Where the voice is (the narration player tells, the scenes listen) ----------------------------------------------

type Listener = (word: number) => void;
const listeners = new Set<Listener>();
let current = -1;

/** The narration is at word `word` (−1: not playing). */
export function narrationAt(word: number) {
  if (word === current) return;
  current = word;
  for (const l of listeners) l(word);
}

export function onNarration(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
