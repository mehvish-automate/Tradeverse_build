"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { QuestionView } from "@/components/QuestionView";
import { DailyResult, recordResult, scoreAnswer, todayResult } from "@/lib/progress";
import { dailyQuestions, todayKey } from "@/lib/questions";
import { codeFor, shareLinks } from "@/lib/referral";
import {
  RivalEvent,
  awardStreakFreeze,
  computeRivalEvent,
  getStreakFreezes,
  logReward,
  rollMysteryReward,
} from "@/lib/rewards";
import { User } from "@/lib/session";

type Answered = {
  questionId: string;
  chosen: number;
  correct: boolean;
  msTaken: number;
  xp: number;
};

type BonusSummary = {
  base: number;
  multiplier: number;
  multiplierLabel: string;
  multiplierDescription: string;
  rival: RivalEvent | null;
  streak: number;
  streakFreezes: number;
  freezeEarned: boolean;
};

export function ChallengeRunner({ user }: { user: User }) {
  const questions = useMemo(() => dailyQuestions(new Date(), 5), []);
  const priorResult = useMemo(() => todayResult(user.email), [user.email]);

  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [answered, setAnswered] = useState<Answered[]>([]);
  const [done, setDone] = useState(priorResult != null);
  const [summary, setSummary] = useState(priorResult);
  const [bonus, setBonus] = useState<BonusSummary | null>(null);

  const startedAt = useRef<number>(Date.now());
  useEffect(() => {
    startedAt.current = Date.now();
    setChosen(null);
  }, [idx]);

  if (done && summary) {
    return (
      <Results
        user={user}
        result={summary}
        replayable={priorResult == null}
        bonus={bonus}
      />
    );
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
      const baseXp = nextAnswered.reduce((s, a) => s + a.xp, 0);
      const totalMs = nextAnswered.reduce((s, a) => s + a.msTaken, 0);
      const dateKey = todayKey();

      const mystery = rollMysteryReward(user.email, dateKey);
      const totalXp = Math.round(baseXp * mystery.multiplier);
      logReward(user.email, {
        kind: "mystery",
        detail: `${mystery.label} → ${totalXp} XP`,
      });

      const result: DailyResult = {
        dateKey,
        correct: totalCorrect,
        total: questions.length,
        xp: totalXp,
        timeMs: totalMs,
      };
      const store = recordResult(user.email, result);

      // Every 5th streak day awards a freeze token + a celebratory log.
      if (store.streak > 0 && store.streak % 5 === 0) {
        awardStreakFreeze(user.email, 1);
        logReward(user.email, {
          kind: "freeze",
          detail: `Streak ${store.streak} → +1 streak freeze`,
        });
      }

      setSummary(result);
      setBonus({
        base: baseXp,
        multiplier: mystery.multiplier,
        multiplierLabel: mystery.label,
        multiplierDescription: mystery.description,
        rival: computeRivalEvent(user.email, user.displayName),
        streak: store.streak,
        streakFreezes: getStreakFreezes(user.email),
        freezeEarned: store.streak > 0 && store.streak % 5 === 0,
      });
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
  user,
  result,
  replayable,
  bonus,
}: {
  user: User;
  result: NonNullable<ReturnType<typeof todayResult>>;
  replayable: boolean;
  bonus: BonusSummary | null;
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
          {bonus && bonus.multiplier > 1 && (
            <div className="mt-0.5 text-xs text-brand-300">
              +{result.xp - bonus.base} bonus
            </div>
          )}
        </div>
        <div className="rounded-lg border border-ink-700 bg-ink-950/60 p-4">
          <div className="text-xs text-ink-500">Time</div>
          <div className="mt-1 text-2xl font-semibold">
            {(result.timeMs / 1000).toFixed(0)}s
          </div>
        </div>
      </div>

      {bonus && (
        <div className="mx-auto mt-6 max-w-md space-y-3 text-left">
          <MysteryCard bonus={bonus} />
          {bonus.rival && <RivalCard event={bonus.rival} />}
          <StreakCard bonus={bonus} />
        </div>
      )}

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
        <ShareButton user={user} result={result} />
        <Link
          href="/trade-floors"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Compare with friends →
        </Link>
      </div>
    </div>
  );
}

function ShareButton({
  user,
  result,
}: {
  user: User;
  result: DailyResult;
}) {
  const code = codeFor(user.email);
  const copy = `I scored ${result.correct}/${result.total} on today's TradeVerse chart challenge.`;
  const links = shareLinks(code, copy);
  return (
    <a
      href={links.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-lg border border-brand-500/60 bg-brand-500/10 px-4 py-2 text-sm font-medium text-brand-200 hover:bg-brand-500/20"
    >
      Share on WhatsApp
    </a>
  );
}

function MysteryCard({ bonus }: { bonus: BonusSummary }) {
  const isBoost = bonus.multiplier > 1;
  return (
    <div
      className={
        "flex items-start gap-3 rounded-xl border p-4 " +
        (isBoost
          ? "border-brand-500/50 bg-brand-500/10"
          : "border-ink-700 bg-ink-950/50")
      }
    >
      <span
        className={
          "shrink-0 rounded-md px-2 py-1 text-xs font-semibold " +
          (isBoost ? "bg-brand-500 text-ink-950" : "bg-ink-800 text-ink-300")
        }
      >
        {bonus.multiplierLabel}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink-50">
          {isBoost ? "Mystery bonus hit" : "Today's mystery pull"}
        </div>
        <div className="text-xs text-ink-400">{bonus.multiplierDescription}</div>
      </div>
    </div>
  );
}

function RivalCard({ event }: { event: RivalEvent }) {
  let icon = "👥";
  let title = "";
  let body = "";

  if (event.kind === "passed") {
    icon = "📈";
    title = `You just passed @${event.rival}`;
    body = `In ${event.tradeFloor}. Keep the pressure on.`;
  } else if (event.kind === "about-to-be-passed") {
    icon = "⚠️";
    title = `@${event.rival} is ${event.gap} XP behind`;
    body = `In ${event.tradeFloor}. One good run and they're ahead.`;
  } else if (event.kind === "lead") {
    icon = "👑";
    title = `You're #1 in ${event.tradeFloor}`;
    body = `${event.total - 1} players trying to catch you.`;
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-950/50 p-4">
      <span className="text-2xl leading-none">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink-50">{title}</div>
        <div className="text-xs text-ink-400">{body}</div>
      </div>
    </div>
  );
}

function StreakCard({ bonus }: { bonus: BonusSummary }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-ink-700 bg-ink-950/50 p-4">
      <span className="text-2xl leading-none">🔥</span>
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink-50">
          {bonus.streak}-day streak
          {bonus.freezeEarned && (
            <span className="ml-2 rounded-md bg-brand-500/15 px-1.5 py-0.5 text-xs text-brand-300">
              +1 streak freeze
            </span>
          )}
        </div>
        <div className="text-xs text-ink-400">
          {bonus.streakFreezes > 0
            ? `${bonus.streakFreezes} freeze${bonus.streakFreezes === 1 ? "" : "s"} in the bank — miss a day and your streak survives.`
            : "Play tomorrow to keep it alive. Earn a freeze token every 5 days."}
        </div>
      </div>
    </div>
  );
}
