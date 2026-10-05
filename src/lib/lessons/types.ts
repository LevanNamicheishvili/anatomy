/** A textbook lesson as a page: text by section, key terms, what to remember, related 3D, a self-check. */
export interface LessonContent {
  intro: string;
  sections: { heading: string; text: string[] }[];
  terms: { term: string; meaning: string }[];
  remember: string[];
  /** Places on the portal that show this lesson in 3D. */
  related?: { label: string; href: string }[];
  quiz: { q: string; options: string[]; answer: number; why: string }[];
}
