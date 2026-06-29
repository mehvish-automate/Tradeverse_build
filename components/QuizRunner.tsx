"use client";

// Solo timed quiz runner (Phase 50). Each question runs on a short
// countdown; picking locks the answer, a timeout locks it as a miss.
// A brief reveal shows the correct option + points before auto-advancing.

import { useCallback, useEffect, useRef, useState } from "react";

import type { FestQuestion } from "@/lib/fests";
import {
  QUIZ_TIME_LIMIT_MS,
  QuizAnswer,
  QuizAttempt,
  scoreQuizAnswer,
} from "@/lib/quizPlay";

const REVEAL_MS = 1600;

export function QuizRunner({
  email,
  festId,
  questions,
  onFinish,
}: {
  email: string;
  festId: string;
  questions: FestQuestion[];
  onFinish: (attempt: QuizAttempt) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"question" | "reveal">("question");
  const [chosen, setChosen] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(QUIZ_TIME_LIMIT_MS);
  const answersRef = useRef<QuizAnswer[]>([]);
  const startedAt = useRef<number>(Date.now());
  const lockedRef = useRef(false);

  const q = questions[idx];

  // Commit the current answer and move to the reveal.
  const lock = useCallback(
    (pick: number | null) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      const msTaken = Math.min(Date.now() - startedAt.current, QUIZ_TIME_LIMIT_MS);
      const correct = pick != null && pick === q.answer;
      answersRef.current.push({
        questionId: q.id,
        chosen: pick,
        correct,
        msTaken,
        points: scoreQuizAnswer(correct, msTaken),
      });
      setChosen(pick);
      setPhase("reveal");
    },
    [q],
  );

  // Per-question lifecycle: reset the clock on each new question, tick the
  // countdown, auto-lock on timeout, then hold the reveal and advance.
  useEffect(() => {
    if (phase === "question") {
      lockedRef.current = false;
      startedAt.current = Date.now();
      setChosen(null);
      setRemainingMs(QUIZ_TIME_LIMIT_MS);
      const tick = setInterval(() => {
        const left = QUIZ_TIME_LIMIT_MS - (Date.now() - startedAt.current);
        if (left <= 0) {
          setRemainingMs(0);
          lock(null);
        } else {
          setRemainingMs(left);
        }
      }, 50);
      return () => clearInterval(tick);
    }

    const t = setTimeout(() => {
      if (idx + 1 >= questions.length) {
        const answers = answersRef.current;
        onFinish({
          festId,
          email,
          score: answers.reduce((s, a) => s + a.points, 0),
          correct: answers.filter((a) => a.correct).length,
          total: questions.length,
          totalMs: answers.reduce((s, a) => s + a.msTaken, 0),
          answers,
          playedAt: Date.now(),
        });
      } else {
        setIdx((i) => i + 1);
        setPhase("question");
      }
    }, REVEAL_MS);
    return () => clearTimeout(t);
  }, [phase, idx, questions.length, lock, onFinish, festId, email]);

  const reveal = phase === "reveal";
  const pct = Math.max(0, Math.min(100, (remainingMs / QUIZ_TIME_LIMIT_MS) * 100));
  const urgent = remainingMs <= 1500;
  const lastPoints = reveal ? answersRef.current[answersRef.current.length - 1] : null;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-ink-400">
        <span>
          Question {idx + 1} of {questions.length}
        </span>
        <span
          className={
            "font-mono tabular-nums " + (urgent && !reveal ? "text-red-300" : "text-ink-300")
          }
        >
          {reveal ? "—" : `${(remainingMs / 1000).toFixed(1)}s`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-900">
        <div
          className={
            "h-full transition-[width] duration-75 ease-linear " +
            (reveal ? "bg-ink-700" : urgent ? "bg-red-500" : "bg-brand-500")
          }
          style={{ width: reveal ? "100%" : `${pct}%` }}
        />
      </div>

      <div className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
        <h2 className="text-lg font-semibold text-ink-50 md:text-xl">{q.prompt}</h2>

        <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
          {q.options.map((label, i) => {
            const picked = chosen === i;
            const isCorrect = reveal && i === q.answer;
            const isWrongPick = reveal && picked && i !== q.answer;
            return (
              <button
                key={label + i}
                onClick={() => !reveal && lock(i)}
                disabled={reveal}
                className={
                  "rounded-lg border px-4 py-3 text-left text-sm transition " +
                  (isCorrect
                    ? "border-brand-500 bg-brand-500/10 text-ink-50"
                    : isWrongPick
                      ? "border-red-500/70 bg-red-500/10 text-ink-50"
                      : picked
                        ? "border-ink-500 bg-ink-900 text-ink-50"
                        : "border-ink-700 text-ink-200 hover:border-ink-500")
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {reveal && (
          <div className="mt-5 rounded-lg border border-ink-700 bg-ink-950/50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span
                className={
                  "text-xs font-medium uppercase tracking-wider " +
                  (lastPoints?.correct ? "text-brand-300" : "text-red-300")
                }
              >
                {lastPoints?.correct
                  ? "Correct"
                  : chosen == null
                    ? "Time's up"
                    : "Not quite"}
              </span>
              <span className="font-mono text-xs text-ink-300">
                +{lastPoints?.points ?? 0} pts
              </span>
            </div>
            {q.explain && <p className="mt-1 text-ink-200">{q.explain}</p>}
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-ink-500">
        Scored on accuracy + speed. No real money — points and ranks only.
      </p>
    </div>
  );
}
