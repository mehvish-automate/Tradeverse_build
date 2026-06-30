"use client";

// Phase 56 — Direct quick-play. One tap, instant mixed quiz, no setup.

import Link from "next/link";
import { useState } from "react";

import { Nav } from "@/components/Nav";
import { QuizResultCard } from "@/components/QuizResultCard";
import { QuizRunner } from "@/components/QuizRunner";
import { RequireAuth } from "@/components/RequireAuth";
import { EV, track } from "@/lib/analytics";
import { quickSet } from "@/lib/quizModes";
import { QuizAttempt } from "@/lib/quizPlay";
import { useSession } from "@/lib/session";

export default function QuickPlayPage() {
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
  const [seed, setSeed] = useState<number>(() => Date.now());
  const [stage, setStage] = useState<"intro" | "playing" | "done">("intro");
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);

  if (!user) return null;
  const questions = quickSet(seed);

  if (stage === "playing") {
    return (
      <QuizRunner
        email={user.email}
        festId="quick"
        questions={questions}
        onFinish={(a) => {
          track(EV.quizFinish, { festId: "quick", score: a.score });
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
        title="Quick play"
        onReplay={() => {
          setSeed(Date.now());
          setAttempt(null);
          setStage("playing");
        }}
        replayLabel="Again"
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
      <h1 className="text-3xl font-semibold">Quick play</h1>
      <p className="mt-2 text-sm text-ink-400">
        8 mixed questions, 5 seconds each. No setup — just play.
      </p>
      <button
        onClick={() => {
          setSeed(Date.now());
          track(EV.quizStart, { festId: "quick" });
          setStage("playing");
        }}
        className="mt-8 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-300"
      >
        Play now →
      </button>
    </>
  );
}
