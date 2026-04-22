"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { ChartSvg } from "@/components/ChartSvg";
import { recordResult, scoreAnswer, todayResult } from "@/lib/progress";
import {
  Question,
  dailyQuestions,
  todayKey,
} from "@/lib/questions";
import { User } from "@/lib/session";

type Answered = {
  questionId: string;
  chosen: number;
  correct: boolean;
  msTaken: number;
  xp: number;
};

export function ChallengeRunner({ user }: { user: User }) {
  const questions = useMemo(() => dailyQuestions(new Date(), 5), []);
  const priorResult = useMemo(() => todayResult(user.email), [user.email]);

  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [done, setDone] = useState(priorResult != null);
  const [summary, setSummary] = useState(priorResult);

  const startedAt = useRef<number>(Date.now());
  useEffect(() => {
    startedAt.current = Date.now();
    setChosen(null);
  }, [idx]);

  if (done && summary) {
    return <Results user={user} result={summary} replayable={priorResult == null} />;
  }

  const q = questions[idx];

  function submit(answerIdx: number) {
    if (chosen != null) return;
    setChosen(answerIdx);
  }

  function next() {
    if (chosen == null) return;
    const msTaken = Date.now() - startedAt.current;
    const correct = chosen === q.answer;
    const { xp } = scoreAnswer(correct, msTaken);

    const entry: Answered = {
      questionId: q.id,
      chosen,
      correct,
      msTaken,
      xp,
    };
    const nextAnswered = [...answered, entry];
    setAnswered(nextAnswered);

    if (idx + 1 >= questions.length) {
      const totalCorrect = nextAnswered.filter((a) => a.correct).length;
      const totalXp = nextAnswered.reduce((s, a) => s + a.xp, 0);
      const totalMs = nextAnswered.reduce((s, a) => s + a.msTaken, 0);
      const result = {
        dateKey: todayKey(),
        correct: totalCorrect,
        total: questions.length,
        xp: totalXp,
        timeMs: totalMs,
      };
      recordResult(user.email, result);
      setSummary(result);
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  }

  return (
    <div>
      <Progress current={idx + 1} total={questions.length} />
      <div className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
        <QuestionCard
          q={q}
          chosenIdx={chosen}
          correctIdx={q.answer}
          onPick={submit}
        />

        {chosen != null && (
          <div className="mt-5 rounded-lg border border-ink-700 bg-ink-950/50 p-4 text-sm">
            <div
              className={
                "text-xs font-medium uppercase tracking-wider " +
                (chosen === q.answer ? "text-brand-300" : "text-red-300")
              }
            >
              {chosen === q.answer ? "Correct" : "Not quite"}
            </div>
            <p className="mt-1 text-ink-200">{q.explain}</p>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <div className="text-xs text-ink-500">
            Scored on accuracy + speed. No real money.
          </div>
          <button
            onClick={next}
            disabled={chosen == null}
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300 disabled:opacity-40"
          >
            {idx + 1 >= questions.length ? "Finish" : "Next question"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Progress({ current, total }: { current: number; total: number }) {
  const pct = Math.round(((current - 1) / total) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-ink-400">
        <span>
          Question {current} of {total}
        </span>
        <span>Today&apos;s challenge</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-900">
        <div
          className="h-full bg-brand-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  chosenIdx,
  correctIdx,
  onPick,
}: {
  q: Question;
  chosenIdx: number | null;
  correctIdx: number;
  onPick: (i: number) => void;
}) {
  const options = "options" in q ? q.options : [];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
        <span className="rounded-md bg-brand-500/10 px-2 py-0.5 font-medium text-brand-300">
          {q.kind}
        </span>
        {"symbol" in q && <span>{q.symbol}</span>}
        {"interval" in q && <span>· {q.interval}</span>}
        {"date" in q && <span>· {q.date}</span>}
      </div>

      <h2 className="mt-3 text-lg font-semibold text-ink-50 md:text-xl">
        {q.prompt}
      </h2>

      {(q.kind === "pattern" || q.kind === "level") && (
        <div className="mt-4 rounded-lg border border-ink-700/70 bg-ink-950 p-3">
          <ChartSvg
            points={q.series.points}
            levels={q.kind === "level" ? q.levels : undefined}
          />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
        {options.map((label, i) => {
          const picked = chosenIdx === i;
          const isCorrect = chosenIdx != null && i === correctIdx;
          const isWrongPick = chosenIdx != null && picked && i !== correctIdx;
          const locked = chosenIdx != null;

          return (
            <button
              key={label + i}
              onClick={() => onPick(i)}
              disabled={locked}
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
    </div>
  );
}

function Results({
  result,
  replayable,
}: {
  user: User;
  result: NonNullable<ReturnType<typeof todayResult>>;
  replayable: boolean;
}) {
  const pct = Math.round((result.correct / result.total) * 100);
  return (
    <div className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-8 text-center">
      <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
        Today&apos;s run
      </div>
      <div className="mt-2 text-5xl font-semibold">
        {result.correct}/{result.total}
      </div>
      <div className="mt-1 text-sm text-ink-300">{pct}% accuracy</div>

      <div className="mx-auto mt-6 grid max-w-md grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-ink-700 bg-ink-950/60 p-4">
          <div className="text-xs text-ink-500">XP earned</div>
          <div className="mt-1 text-2xl font-semibold">{result.xp}</div>
        </div>
        <div className="rounded-lg border border-ink-700 bg-ink-950/60 p-4">
          <div className="text-xs text-ink-500">Time</div>
          <div className="mt-1 text-2xl font-semibold">
            {(result.timeMs / 1000).toFixed(0)}s
          </div>
        </div>
      </div>

      {!replayable && (
        <p className="mt-6 text-sm text-ink-400">
          You&apos;ve already played today&apos;s challenge. A fresh set drops
          at midnight.
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href="/profile"
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to profile
        </Link>
        <Link
          href="/leagues"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Compare with friends →
        </Link>
      </div>
    </div>
  );
}
