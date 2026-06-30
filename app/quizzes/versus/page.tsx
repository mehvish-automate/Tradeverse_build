"use client";

// Phase 57 — You vs AI. Play a set head-to-head against a simulated bot
// whose accuracy + speed scale with difficulty. Deterministic per match.

import Link from "next/link";
import { useState } from "react";

import { Nav } from "@/components/Nav";
import { QuizResultCard } from "@/components/QuizResultCard";
import { QuizRunner } from "@/components/QuizRunner";
import { RequireAuth } from "@/components/RequireAuth";
import { EV, track } from "@/lib/analytics";
import { AI_LEVELS, AiLevel, AiResult, quickSet, simulateAi } from "@/lib/quizModes";
import { QUIZ_SECONDS_PER_QUESTION, QuizAttempt } from "@/lib/quizPlay";
import { useSession } from "@/lib/session";

const LIMIT_MS = QUIZ_SECONDS_PER_QUESTION * 1000;

export default function VersusPage() {
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
  const [level, setLevel] = useState<AiLevel>("pro");
  const [seed, setSeed] = useState<number>(() => Date.now());
  const [stage, setStage] = useState<"intro" | "playing" | "done">("intro");
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [ai, setAi] = useState<AiResult | null>(null);

  if (!user) return null;
  const questions = quickSet(seed);
  const aiLabel = AI_LEVELS.find((l) => l.id === level)!.label;

  if (stage === "playing") {
    return (
      <QuizRunner
        email={user.email}
        festId={`versus-${level}`}
        questions={questions}
        onFinish={(a) => {
          const aiRes = simulateAi(level, a.total, LIMIT_MS, seed);
          setAttempt(a);
          setAi(aiRes);
          track(EV.quizFinish, {
            festId: "versus",
            level,
            score: a.score,
            aiScore: aiRes.score,
            won: a.score >= aiRes.score,
          });
          setStage("done");
        }}
      />
    );
  }

  if (stage === "done" && attempt && ai) {
    const won = attempt.score >= ai.score;
    return (
      <QuizResultCard
        attempt={attempt}
        title={won ? "🏆 You win!" : "🤖 Bot wins"}
        onReplay={() => {
          setSeed(Date.now());
          setAttempt(null);
          setAi(null);
          setStage("playing");
        }}
        replayLabel="Rematch"
      >
        <div className="rounded-xl border border-ink-700 bg-ink-950/50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink-50">You</span>
            <span className="font-mono">{attempt.score} pts</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-ink-300">
            <span>{aiLabel}</span>
            <span className="font-mono">{ai.score} pts</span>
          </div>
          <div className="mt-3 text-xs text-ink-500">
            Bot: {ai.correct}/{ai.total} correct. Beat a tougher bot for a bigger flex.
          </div>
        </div>
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
      <h1 className="text-3xl font-semibold">You vs AI</h1>
      <p className="mt-2 text-sm text-ink-400">
        Same 8 questions, head-to-head against a bot. Pick your opponent.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {AI_LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => setLevel(l.id)}
            className={
              "rounded-xl border p-4 text-left transition " +
              (level === l.id
                ? "border-brand-500 bg-brand-500/10"
                : "border-ink-700 hover:border-ink-500")
            }
          >
            <div className="text-sm font-semibold text-ink-50">{l.label}</div>
            <div className="mt-1 text-xs text-ink-500">
              {Math.round(l.accuracy * 100)}% accuracy
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => {
          setSeed(Date.now());
          track(EV.quizStart, { festId: "versus", level });
          setStage("playing");
        }}
        className="mt-8 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-300"
      >
        Start match →
      </button>
    </>
  );
}
