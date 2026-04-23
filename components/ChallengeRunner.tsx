"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { QuestionView } from "@/components/QuestionView";
import { recordResult, scoreAnswer, todayResult } from "@/lib/progress";
import { dailyQuestions, todayKey } from "@/lib/questions";
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
        <QuestionView q={q} chosenIdx={chosen} onPick={submit} />

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
