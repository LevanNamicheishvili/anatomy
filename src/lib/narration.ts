import { NARRATION_MANIFEST } from "./narration-manifest";

/*
 * Lesson narration: the lesson read aloud (Gemini voice, scripts/narration/build-narration.ts) with karaoke
 * text — the words on the page light up as they are said. This module is what the build script and the pages
 * share: which text is read, how it is cut into words and numbered through the whole narration (the same way on
 * both sides, so word n of the timings is the span marked data-nw="n" on the page), and a fingerprint of the
 * text, so a recording is only used while its text is unchanged.
 */

export interface NarrationBlock {
  heading?: string;
  paragraphs: string[];
}

/** What a lesson's narration reads: the introduction, then each section with its heading. */
export function narrationBlocks(content: { intro: string; sections: { heading: string; text: string[] }[] }): NarrationBlock[] {
  return [{ paragraphs: [content.intro] }, ...content.sections.map((s) => ({ heading: s.heading, paragraphs: s.text }))];
}

/** An atlas topic: its sections, then the facts and the health note under their headings. */
export function topicNarrationBlocks(topic: { sections: { heading: string; body: string }[]; facts: string[]; health: string }, factsTitle: string, healthTitle: string): NarrationBlock[] {
  return [...topic.sections.map((s) => ({ heading: s.heading, paragraphs: [s.body] })), { heading: factsTitle, paragraphs: topic.facts }, { heading: healthTitle, paragraphs: [topic.health] }];
}

/** Words as shown and as timed: the text split at white space. */
export const narrationWords = (text: string) => text.split(/\s+/).filter(Boolean);

/** Number of each block's first word, of its heading (−1: none) and of each of its paragraphs. */
export function narrationLayout(blocks: NarrationBlock[]) {
  let n = 0;
  return blocks.map((b) => {
    const start = n;
    const heading = b.heading ? n : -1;
    if (b.heading) n += narrationWords(b.heading).length;
    const paragraphs = b.paragraphs.map((p) => {
      const at = n;
      n += narrationWords(p).length;
      return at;
    });
    return { start, heading, paragraphs };
  });
}

/** FNV-1a, as 8 hex digits. */
function fnv(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Fingerprint of the text a narration reads. */
export const narrationHash = (blocks: NarrationBlock[]) => fnv(JSON.stringify(blocks));

export const geoNarrationId = (slug: string) => `geo-${slug}`;
export const topicNarrationId = (slug: string) => `topic-${slug}`;
/** Biology lessons are keyed by textbook number ("1.2"), or by title where the book has none (grade XII). */
export const bioNarrationId = (grade: number, key: string) => `bio-${grade}-${/^[0-9.]+$/.test(key) ? key.replace(/\./g, "-") : fnv(key)}`;

export interface NarrationInfo {
  id: string;
  /** Seconds. */
  duration: number;
  /** The recording's fingerprint: new audio, new URLs (browsers and the service worker keep the old ones). */
  rev: string;
}

/** The narration recorded from exactly these blocks, if there is one. */
export function narrationFor(id: string, blocks: NarrationBlock[]): NarrationInfo | null {
  const entry = NARRATION_MANIFEST[id];
  if (!entry || entry.hash !== narrationHash(blocks)) return null;
  return { id, duration: entry.duration, rev: entry.rev };
}

export const lessonNarration = (id: string, content: { intro: string; sections: { heading: string; text: string[] }[] }) => narrationFor(id, narrationBlocks(content));

export const narrationAudio = (n: NarrationInfo) => `/narration/${n.id}.m4a?v=${n.rev}`;
export const narrationTimings = (n: NarrationInfo) => `/narration/${n.id}.json?v=${n.rev}`;
