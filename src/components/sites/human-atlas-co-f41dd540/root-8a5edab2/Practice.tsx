"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AtlasPart } from "./atlas-data";
import { georgianName } from "./georgian-names";
import {
  LEARN_ITEMS,
  LEVELS,
  fitsLevel,
  loadBoxes,
  nextCard,
  saveBoxes,
  shuffle,
  type LearnItem,
  type Level,
} from "./learn-data";
import { btnPrimary, btnSecondary, sectionLabel } from "./primitives";
import { SheetHeader, dockedSheet } from "./Sheets";
import { structureInfo } from "./structure-info";

export type PracticeMode = "quiz" | "cards";

export interface PracticeHost {
  /** Ids of the structure with this name, or null if the model doesn't have it. */
  resolve: (name: string) => string[] | null;
  /** Show the systems needed for this item, whole body, nothing highlighted. */
  present: (item: LearnItem) => void;
  /** Highlight (and fly to) a structure, or clear the highlight. */
  highlight: (ids: string[] | null, frame: boolean) => void;
  /** While set, taps on the model go to this handler instead of opening the detail sheet. */
  setPickHandler: (fn: ((part: AtlasPart) => void) | null) => void;
}

const QUESTIONS = 10;

type Question =
  | { kind: "find"; item: LearnItem; ids: string[] }
  | { kind: "name"; item: LearnItem; ids: string[]; options: string[] };

type Answer = { correct: boolean; picked?: string };

function buildQuiz(items: LearnItem[], host: PracticeHost): Question[] {
  const usable = items.flatMap((item) => {
    const ids = host.resolve(item.name);
    return ids ? [{ item, ids }] : [];
  });
  return shuffle(usable)
    .slice(0, QUESTIONS)
    .map(({ item, ids }, i) => {
      if (i % 2 === 0) return { kind: "find" as const, item, ids };
      const others = shuffle(usable.filter((u) => u.item.group === item.group && u.item.name !== item.name))
        .slice(0, 3)
        .map((u) => u.item.name);
      return { kind: "name" as const, item, ids, options: shuffle([item.name, ...others]) };
    });
}

export function PracticeSheet({
  mode,
  level,
  host,
  onClose,
}: {
  mode: PracticeMode;
  level: Level;
  host: PracticeHost;
  onClose: () => void;
}) {
  const items = useMemo(
    () => LEARN_ITEMS.filter((i) => fitsLevel(i.level, level) && host.resolve(i.name)),
    [level, host],
  );
  const levelName = LEVELS.find((l) => l.key === level)?.name ?? "";

  return mode === "quiz" ? (
    <Quiz items={items} host={host} levelName={levelName} onClose={onClose} />
  ) : (
    <Cards items={items} host={host} levelName={levelName} onClose={onClose} />
  );
}

// ---- Quiz ------------------------------------------------------------------------------------------

function Quiz({ items, host, levelName, onClose }: { items: LearnItem[]; host: PracticeHost; levelName: string; onClose: () => void }) {
  const [round, setRound] = useState(0);
  const questions = useMemo(() => buildQuiz(items, host), [items, host, round]); // eslint-disable-line react-hooks/exhaustive-deps -- new round, new questions
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const q = questions[step] as Question | undefined;
  const answered = answers.length > step;
  const done = step >= questions.length;
  const score = answers.filter((a) => a.correct).length;

  // Set up the model for each question.
  useEffect(() => {
    if (!q) return;
    host.present(q.item);
    if (q.kind === "name") host.highlight(q.ids, true);
    else host.highlight(null, false);
  }, [q, host]);

  // "Find" questions are answered by tapping the model.
  const answerRef = useRef<(part: AtlasPart) => void>(() => {});
  useEffect(() => {
    answerRef.current = (part) => {
      if (!q || q.kind !== "find" || answered) return;
      // The heart's own group misses some wall pieces; any piece of the heart counts.
      const correct = q.ids.includes(part.id) || (q.item.name === "გული" && part.system === "cardiac");
      const picked = georgianName(part.name, part.system, part.bounds).name.replace(/^(მარცხენა|მარჯვენა) /, "");
      setAnswers((a) => [...a, { correct, picked }]);
      host.highlight(q.ids, !correct);
    };
  }, [q, answered, host]);
  useEffect(() => {
    host.setPickHandler((part) => answerRef.current(part));
    return () => host.setPickHandler(null);
  }, [host]);

  const choose = (option: string) => {
    if (!q || answered) return;
    setAnswers((a) => [...a, { correct: option === q.item.name, picked: option }]);
  };

  const restart = () => {
    setRound((r) => r + 1);
    setStep(0);
    setAnswers([]);
  };

  return (
    <aside aria-label="ქვიზი" className={cn(dockedSheet, "max-md:h-auto max-md:max-h-[50dvh]")}>
      <SheetHeader
        label={`ქვიზი · ${levelName}`}
        dot="#0f8a74"
        title={done ? "შედეგი" : `კითხვა ${step + 1} / ${questions.length}`}
        onClose={onClose}
        closeLabel="დახურვა"
      />
      <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-5 flex gap-1" aria-hidden>
          {questions.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i < answers.length ? (answers[i].correct ? "bg-[#0f8a74]" : "bg-[#c0392b]") : i === step ? "bg-[#97a29e]" : "bg-[#e2e7e5]",
              )}
            />
          ))}
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-5xl font-semibold text-[#111a18]">
              {score} / {questions.length}
            </p>
            <p className="text-[15px] leading-7 text-[#33413e]">
              {score === questions.length ? "ყველა პასუხი სწორია — შესანიშნავია!" : score >= questions.length * 0.7 ? "ძალიან კარგია!" : "კიდევ ერთხელ სცადე — ყოველ ჯერზე უკეთ გამოგივა."}
            </p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={restart} className={btnPrimary}>
                <RotateCcw className="size-4" />
                თავიდან
              </button>
              <button type="button" onClick={onClose} className={btnSecondary}>
                დასრულება
              </button>
            </div>
          </div>
        ) : q ? (
          <>
            {q.kind === "find" ? (
              <>
                <p className={sectionLabel}>იპოვე მოდელზე და დააჭირე</p>
                <p className="mt-2 text-2xl leading-9 font-semibold text-[#111a18]">{q.item.name}</p>
                {!answered && <p className="mt-3 text-sm leading-6 text-[#66736f]">მოდელის შემობრუნება და გადიდება შეგიძლია.</p>}
              </>
            ) : (
              <>
                <p className={sectionLabel}>რა ჰქვია მონიშნულ ნაწილს?</p>
                <div className="mt-3 grid gap-2">
                  {q.options.map((o) => {
                    const isRight = answered && o === q.item.name;
                    const isWrong = answered && o === answers[step].picked && !answers[step].correct;
                    return (
                      <button
                        key={o}
                        type="button"
                        disabled={answered}
                        onClick={() => choose(o)}
                        className={cn(
                          "flex min-h-11 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-[15px] font-medium transition-colors disabled:cursor-default",
                          isRight
                            ? "border-[#0f8a74] bg-[#e6f3ef] text-[#0c7563]"
                            : isWrong
                              ? "border-[#c0392b] bg-[#fbeceb] text-[#a3302a]"
                              : "border-[#d5dcd9] bg-white text-[#111a18] hover:bg-[#f5f7f6]",
                        )}
                      >
                        {o}
                        {isRight && <Check className="size-4 shrink-0" />}
                        {isWrong && <X className="size-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {answered && (
              <div
                className={cn(
                  "mt-5 rounded-md border-s-2 py-3 ps-4 pe-3",
                  answers[step].correct ? "border-[#0f8a74] bg-[#e6f3ef]" : "border-[#c0392b] bg-[#fbeceb]",
                )}
              >
                <p className="text-[15px] font-semibold text-[#111a18]">{answers[step].correct ? "სწორია!" : "არასწორია"}</p>
                {!answers[step].correct && (
                  <p className="mt-1 text-sm leading-6 text-[#33413e]">
                    {q.kind === "find" ? `შენ მონიშნე: ${answers[step].picked}. ` : ""}
                    სწორი პასუხი: <b>{q.item.name}</b>{q.kind === "find" ? " — მოდელზე მონიშნულია." : "."}
                  </p>
                )}
                {structureInfo(q.item.name) && <p className="mt-2 text-sm leading-6 text-[#33413e]">{structureInfo(q.item.name)}</p>}
              </div>
            )}

            {answered && (
              <button type="button" onClick={() => setStep((s) => s + 1)} className={cn(btnPrimary, "mt-5 w-full")}>
                {step + 1 < questions.length ? "შემდეგი კითხვა" : "შედეგის ნახვა"}
              </button>
            )}
          </>
        ) : (
          <p className="text-sm text-[#66736f]">ამ საფეხურისთვის კითხვები ვერ მოიძებნა.</p>
        )}
      </div>
    </aside>
  );
}

// ---- Flashcards --------------------------------------------------------------------------------------

function Cards({ items, host, levelName, onClose }: { items: LearnItem[]; host: PracticeHost; levelName: string; onClose: () => void }) {
  const [boxes, setBoxes] = useState<Record<string, number>>(loadBoxes);
  const [card, setCard] = useState<LearnItem | null>(() => nextCard(items, loadBoxes(), null));
  const [revealed, setRevealed] = useState(false);
  const known = items.filter((i) => (boxes[i.name] ?? 1) >= 4).length;

  useEffect(() => {
    if (!card) return;
    const ids = host.resolve(card.name);
    host.present(card);
    host.highlight(ids, true);
  }, [card, host]);

  // Taps on the model don't open the detail sheet (it would give the answer away).
  useEffect(() => {
    host.setPickHandler(() => {});
    return () => host.setPickHandler(null);
  }, [host]);

  const grade = (knewIt: boolean) => {
    if (!card) return;
    const next = { ...boxes, [card.name]: knewIt ? Math.min(5, (boxes[card.name] ?? 1) + 1) : 1 };
    setBoxes(next);
    saveBoxes(next);
    setRevealed(false);
    setCard(nextCard(items, next, card.name));
  };

  const info = card ? structureInfo(card.name) : null;

  return (
    <aside aria-label="ბარათები" className={cn(dockedSheet, "max-md:h-auto max-md:max-h-[50dvh]")}>
      <SheetHeader label={`ბარათები · ${levelName}`} dot="#0f8a74" title="რა არის ეს?" onClose={onClose} closeLabel="დახურვა" />
      <div className="atlas-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="flex items-center justify-between text-xs text-[#66736f]">
          <span>
            ნასწავლი: {known} / {items.length}
          </span>
          <span>{card ? `ყუთი ${boxes[card.name] ?? 1} / 5` : ""}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e2e7e5]">
          <div className="h-full rounded-full bg-[#0f8a74] transition-[width]" style={{ width: `${items.length ? (known / items.length) * 100 : 0}%` }} />
        </div>

        {card && (
          <div className="mt-5 rounded-lg border border-[#d5dcd9] p-5">
            <p className={sectionLabel}>მოდელზე მონიშნულია ერთი ნაწილი. გაიხსენე მისი სახელი.</p>
            {revealed ? (
              <>
                <p className="mt-3 text-2xl leading-9 font-semibold text-[#111a18]">{card.name}</p>
                {info && <p className="mt-2 text-[15px] leading-7 text-[#33413e]">{info}</p>}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => grade(false)} className={btnSecondary}>
                    ვერ გავიხსენე
                  </button>
                  <button type="button" onClick={() => grade(true)} className={btnPrimary}>
                    ვიცოდი
                  </button>
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setRevealed(true)} className={cn(btnPrimary, "mt-4 w-full")}>
                პასუხის ნახვა
              </button>
            )}
          </div>
        )}
        <p className="mt-4 text-xs leading-5 text-[#97a29e]">რასაც ვერ იხსენებ, უფრო ხშირად გამოჩნდება. პროგრესი ამ ბრაუზერში ინახება.</p>
      </div>
    </aside>
  );
}
