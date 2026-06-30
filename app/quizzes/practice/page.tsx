"use client";

// Phase 55 — Topic-wise practice. Pick a category + difficulty and drill
// a fresh set on a relaxed clock. Not scored on a leaderboard — pure reps.

import Link from "next/link";
import { useState } from "react";

import { Nav } from "@/components/Nav";
import { QuizResultCard } from "@/components/QuizResultCard";
import { QuizRunner } from "@/components/QuizRunner";
import { RequireAuth } from "@/components/RequireAuth";
import { EV, track } from "@/lib/analytics";
import { QUIZ_CATEGORIES, practiceSet } from "@/lib/quizModes";
import { QuizAttempt } from "@/lib/quizPlay";
import { QuizCategory, QuizDifficulty } from "@/lib/quizQuestions";
import { useSession } from "@/lib/session";

const PRACTICE_SECONDS = 15;

export default function PracticePage() {
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
  const [category, setCategory] = useState<QuizCategory | "all">("all");
  const [difficulty, setDifficulty] = useState<QuizDifficulty | "all">("all");
  const [seed, setSeed] = useState<number>(() => Date.now());
  const [stage, setStage] = useState<"intro" | "playing" | "done">("intro");
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);

  if (!user) return null;

  const questions = practiceSet({
    category: category === "all" ? undefined : category,
    difficulty: difficulty === "all" ? undefined : difficulty,
    count: 8,
    seed,
  });

  if (stage === "playing") {
    return (
      <QuizRunner
        email={user.email}
        festId={`practice-${category}-${difficulty}`}
        questions={questions}
        secondsPerQuestion={PRACTICE_SECONDS}
        onFinish={(a) => {
          track(EV.quizFinish, { festId: "practice", category, difficulty, score: a.score });
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
        title="Practice run"
        onReplay={() => {
          setSeed(Date.now());
          setAttempt(null);
          setStage("playing");
        }}
        replayLabel="New set"
        backHref="/quizzes/practice"
        backLabel="Change topic"
      />
    );
  }

  return (
    <>
      <div className="mb-2 text-xs">
        <Link href="/quizzes" className="text-ink-400 hover:text-ink-100">
          ← Quiz Floor
        </Link>
      </div>
      <h1 className="text-3xl font-semibold">Topic practice</h1>
      <p className="mt-2 text-sm text-ink-400">
        Drill a topic at your own pace ({PRACTICE_SECONDS}s a question). Fresh
        set every run — no leaderboard, just reps.
      </p>

      <div className="mt-6">
        <div className="mb-1.5 text-xs font-medium text-ink-300">Category</div>
        <div className="flex flex-wrap gap-2">
          <Chip on={category === "all"} onClick={() => setCategory("all")}>
            All
          </Chip>
          {QUIZ_CATEGORIES.map((c) => (
            <Chip key={c} on={category === c} onClick={() => setCategory(c)}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-1.5 text-xs font-medium text-ink-300">Difficulty</div>
        <div className="flex flex-wrap gap-2">
          {(["all", "beginner", "intermediate", "advanced"] as const).map((d) => (
            <Chip key={d} on={difficulty === d} onClick={() => setDifficulty(d)}>
              {d}
            </Chip>
          ))}
        </div>
      </div>

      <button
        onClick={() => {
          setSeed(Date.now());
          track(EV.quizStart, { festId: "practice", category, difficulty });
          setStage("playing");
        }}
        className="mt-8 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-300"
      >
        Start practice →
      </button>
    </>
  );
}

function Chip({
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
        "rounded-md border px-3 py-1.5 text-xs capitalize transition " +
        (on
          ? "border-brand-500 bg-brand-500/10 text-ink-50"
          : "border-ink-700 text-ink-300 hover:border-ink-500")
      }
    >
      {children}
    </button>
  );
}
