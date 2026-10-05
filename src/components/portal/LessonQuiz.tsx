"use client";

import { useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonContent } from "@/lib/lessons/types";

/** Self-check after a lesson: pick an answer, see at once whether it's right and why. */
export function LessonQuiz({ quiz }: { quiz: LessonContent["quiz"] }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => quiz.map(() => null));
  const done = picked.filter((p) => p !== null).length;
  const right = picked.filter((p, i) => p === quiz[i].answer).length;

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl">შეამოწმე თავი</h2>
        {done > 0 && (
          <span className="text-sm text-[#66736f]">
            სწორია {right} / {quiz.length}
          </span>
        )}
      </div>
      <ol className="mt-4 flex flex-col gap-4">
        {quiz.map((item, qi) => {
          const p = picked[qi];
          return (
            <li key={item.q} className="rounded-xl border border-[#d5dcd9] bg-white p-5">
              <p className="font-semibold">
                {qi + 1}. {item.q}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {item.options.map((o, oi) => {
                  const isAnswer = oi === item.answer;
                  const state = p === null ? "idle" : isAnswer ? "right" : p === oi ? "wrong" : "idle";
                  return (
                    <button
                      key={o}
                      type="button"
                      disabled={p !== null}
                      onClick={() => setPicked((s) => s.map((x, i) => (i === qi ? oi : x)))}
                      className={cn(
                        "flex min-h-12 items-center gap-2 rounded-lg border px-4 py-2.5 text-left text-[15px] transition-colors",
                        state === "right" && "border-[#0f8a74] bg-[#e6f3ef] font-semibold text-[#0c5c4d]",
                        state === "wrong" && "border-[#d9434f] bg-[#fdf3f2] text-[#912018]",
                        state === "idle" && "border-[#d5dcd9]",
                        p === null && "hover:border-[#97a29e] hover:bg-[#f5f7f6]",
                        p !== null && state === "idle" && "text-[#97a29e]",
                      )}
                    >
                      {state === "right" && <Check className="size-4 shrink-0" />}
                      {state === "wrong" && <X className="size-4 shrink-0" />}
                      {o}
                    </button>
                  );
                })}
              </div>
              {p !== null && <p className="mt-3 text-sm leading-6 text-[#33413e]">{item.why}</p>}
            </li>
          );
        })}
      </ol>
      {done === quiz.length && (
        <button
          type="button"
          onClick={() => setPicked(quiz.map(() => null))}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg border border-[#d5dcd9] bg-white px-4 text-sm font-semibold hover:bg-[#f5f7f6]"
        >
          <RotateCcw className="size-4" />
          თავიდან
        </button>
      )}
    </section>
  );
}
