"use client";

import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonContent } from "@/lib/lessons/types";

const LETTERS = ["ა", "ბ", "გ", "დ", "ე", "ვ"];

/** Self-check after a lesson: pick an answer, see at once whether it's right and why. */
export function LessonQuiz({ quiz }: { quiz: LessonContent["quiz"] }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => quiz.map(() => null));
  const done = picked.filter((p) => p !== null).length;
  const right = picked.filter((p, i) => p === quiz[i].answer).length;
  const finished = done === quiz.length;

  return (
    <section className="mt-12" aria-labelledby="quiz-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="quiz-title" className="text-xl">
          შეამოწმე თავი
        </h2>
        <span className="rounded-full bg-chip px-3 py-1 text-sm font-semibold text-copy tabular-nums" aria-live="polite">
          {done > 0 ? `სწორია ${right} / ${quiz.length}` : `${quiz.length} კითხვა`}
        </span>
      </div>
      <ol className="mt-4 flex flex-col gap-4">
        {quiz.map((item, qi) => {
          const p = picked[qi];
          const correct = p !== null && p === item.answer;
          return (
            <li key={item.q} className="rounded-xl border border-line-strong bg-white p-5 shadow-card sm:p-6">
              <p className="flex gap-3 text-base leading-7 font-semibold text-ink">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-chip text-sm tabular-nums">{qi + 1}</span>
                <span>{item.q}</span>
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2" role="group" aria-label={`პასუხები: კითხვა ${qi + 1}`}>
                {item.options.map((o, oi) => {
                  const isAnswer = oi === item.answer;
                  const state = p === null ? "idle" : isAnswer ? "right" : p === oi ? "wrong" : "dim";
                  return (
                    <button
                      key={o}
                      type="button"
                      disabled={p !== null}
                      aria-pressed={p === oi}
                      onClick={() => setPicked((s) => s.map((x, i) => (i === qi ? oi : x)))}
                      className={cn(
                        "flex min-h-12 items-center gap-3 rounded-lg border px-3.5 py-2.5 text-start text-[15px] leading-6 transition-colors disabled:cursor-default",
                        state === "idle" && "border-line-strong bg-white hover:border-brand hover:bg-brand-soft/50",
                        state === "right" && "border-brand bg-brand-soft font-semibold text-[#0c5c4d]",
                        state === "wrong" && "border-[#d9434f] bg-danger-soft text-[#912018]",
                        state === "dim" && "border-line bg-subtle text-faint",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          state === "idle" && "bg-chip text-mute",
                          state === "right" && "bg-brand text-white",
                          state === "wrong" && "bg-[#d9434f] text-white",
                          state === "dim" && "bg-chip text-faint",
                        )}
                        aria-hidden
                      >
                        {state === "right" ? <Check className="size-3.5" /> : state === "wrong" ? <X className="size-3.5" /> : LETTERS[oi]}
                      </span>
                      <span className="min-w-0">{o}</span>
                    </button>
                  );
                })}
              </div>
              {p !== null && (
                <p className={cn("mt-4 rounded-lg px-3.5 py-3 text-sm leading-6", correct ? "bg-brand-soft text-[#0c5c4d]" : "bg-subtle text-copy")} role="status">
                  <b>{correct ? "სწორია. " : "არასწორია. "}</b>
                  {item.why}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {finished && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong bg-white p-4 shadow-card">
          <p className="text-base font-semibold">
            შედეგი: {right} / {quiz.length}
          </p>
          <button
            type="button"
            onClick={() => setPicked(quiz.map(() => null))}
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-line-strong bg-white px-4 text-sm font-semibold transition-colors hover:bg-subtle"
          >
            <RotateCcw className="size-4" aria-hidden />
            თავიდან
          </button>
        </div>
      )}
    </section>
  );
}
