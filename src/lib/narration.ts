import { NARRATION_MANIFEST } from "./narration-manifest";

/*
 * Lesson narration: the lesson read aloud (Gemini voice, scripts/narration/build-narration.ts) with karaoke
 * text — the words on the page light up as they are said. This module is what the build script and the pages
 * share: which text is read, how it is cut into words (the same way on both sides, so word n of the timings is
 * word n on the page), and a fingerprint of the text, so a recording is only used while its text is unchanged.
 */

export interface NarrationBlock {
  heading?: string;
  paragraphs: string[];
}

/** What a lesson's narration reads: the introduction, then each section with its heading. */
export function narrationBlocks(content: { intro: string; sections: { heading: string; text: string[] }[] }): NarrationBlock[] {
  return [{ paragraphs: [content.intro] }, ...content.sections.map((s) => ({ heading: s.heading, paragraphs: s.text }))];
}

/** Words as shown and as timed: the text split at white space. */
export const narrationWords = (text: string) => text.split(/\s+/).filter(Boolean);

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
/** Biology lessons are keyed by textbook number ("1.2"), or by title where the book has none (grade XII). */
export const bioNarrationId = (grade: number, key: string) => `bio-${grade}-${/^[0-9.]+$/.test(key) ? key.replace(/\./g, "-") : fnv(key)}`;

export interface NarrationInfo {
  id: string;
  /** Seconds. */
  duration: number;
  /** The recording's fingerprint: new audio, new URLs (browsers and the service worker keep the old ones). */
  rev: string;
}

/** The narration of a lesson, if one was recorded from exactly this text. */
export function lessonNarration(id: string, content: { intro: string; sections: { heading: string; text: string[] }[] }): NarrationInfo | null {
  const entry = NARRATION_MANIFEST[id];
  if (!entry || entry.hash !== narrationHash(narrationBlocks(content))) return null;
  return { id, duration: entry.duration, rev: entry.rev };
}

export const narrationAudio = (n: NarrationInfo) => `/narration/${n.id}.m4a?v=${n.rev}`;
export const narrationTimings = (n: NarrationInfo) => `/narration/${n.id}.json?v=${n.rev}`;
