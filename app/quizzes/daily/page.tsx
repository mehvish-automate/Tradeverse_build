"use client";

// Phase 54 — Question of the Day / Week. Deterministic daily + weekly
// quiz sets (same for everyone) with a daily-completion streak.

import Link from "next/link";
import { useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { QuizResultCard } from "@/components/QuizResultCard";
import { QuizRunner } from "@/components/QuizRunner";
import { RequireAuth } from "@/components/RequireAuth";
import { EV, track } from "@/lib/analytics";
import { QuizAttempt } from "@/lib/quizPlay";
import {
  dailyDoneToday,
  dailyKey,
  dailySet,
  dailyStreak,
  recordDaily,
  weekKey,
  weeklySet,
} from "@/lib/quizModes";
import { useSession } from "@/lib/session";

export default function DailyQuizPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const [mode, setMode] = useState<"daily" | "weekly">("daily");
  const [stage, setStage] = useState<"intro" | "playing" | "done">("intro");
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [streak, setStreak] = useState<number>(() => 0);

  const dkey = dailyKey();
  const wkey = weekKey();
  const questions = useMemo(
    () => (mode === "daily" ? dailySet(dkey) : weeklySet(wkey)),
    [mode, dkey, wkey],
  );

  if (!user) return null;

  const doneToday = dailyDoneToday(user.email, dkey);
  const curStreak = streak || dailyStreak(user.email);

  if (stage === "playing") {
    return (
      <QuizRunner
        email={user.email}
        festId={`${mode}-${mode === "daily" ? dkey : wkey}`}
        questions={questions}
        onFinish={(a) => {
          if (mode === "daily") {
            const s = recordDaily(user.email, dkey);
            setStreak(s.streak);
          }
          track(EV.quizFinish, { festId: `${mode}-set`, mode, score: a.score });
          setAttempt(a);
          setStage("done");
        }}
      />
    );
  }

  if (stage === "done" && attempt) {
    return (
      <QuizResultCard
        attempt={attempt}
        title={mode === "daily" ? "Today's quiz" : "This week's quiz"}
        onReplay={() => {
          setAttempt(null);
          setStage("playing");
        }}
        replayLabel="Replay (practice)"
      >
        {mode === "daily" && (
          <div className="rounded-xl border border-ink-700 bg-ink-950/50 p-4 text-sm text-ink-200">
            🔥 {curStreak}-day streak — come back tomorrow to keep it alive.
          </div>
        )}
      </QuizResultCard>
    );
  }

  return (
    <>
      <div className="mb-2 text-xs">
        <Link href="/quizzes" className="text-ink-400 hover:text-ink-100">
          ← Quiz Floor
        </Link>
      </div>
      <div className="mb-4 flex gap-2">
        <Tab on={mode === "daily"} onClick={() => setMode("daily")}>
          Question of the Day
        </Tab>
        <Tab on={mode === "weekly"} onClick={() => setMode("weekly")}>
          Weekly
        </Tab>
      </div>

      <h1 className="text-3xl font-semibold">
        {mode === "daily" ? "Question of the Day" : "Weekly quiz"}
      </h1>
      <p className="mt-2 text-sm text-ink-400">
        {questions.length} questions · same set for everyone {mode === "daily" ? "today" : "this week"}.
        Scored on accuracy + speed.
      </p>

      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-md bg-ink-900 px-3 py-1.5 text-ink-200">
          🔥 {curStreak}-day streak
        </span>
        {mode === "daily" && doneToday && (
          <span className="rounded-md bg-brand-500/15 px-3 py-1.5 text-brand-300">
            Done today ✓ — replay for practice
          </span>
        )}
      </div>

      <button
        onClick={() => {
          track(EV.quizStart, { festId: `${mode}-set`, mode });
          setStage("playing");
        }}
        className="mt-8 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-300"
      >
        {mode === "daily" && doneToday ? "Replay →" : "Start →"}
      </button>
    </>
  );
}

function Tab({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "rounded-md px-3 py-1.5 text-sm transition " +
        (on ? "bg-ink-900 text-ink-50" : "text-ink-400 hover:bg-ink-900 hover:text-ink-50")
      }
    >
      {children}
    </button>
  );
}
