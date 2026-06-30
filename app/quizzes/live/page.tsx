"use client";

// Phase 58 — Mass live event ("Big Quiz"). A daily large set everyone
// plays; scores mirror to the cloud and a live leaderboard (polled, like
// Phase 52) ranks the whole field. Synchronized showtime reveal is Phase
// 53 (true realtime) — this is the polling-based mass board.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { QuizResultCard } from "@/components/QuizResultCard";
import { QuizRunner } from "@/components/QuizRunner";
import { RequireAuth } from "@/components/RequireAuth";
import { EV, track } from "@/lib/analytics";
import { bigQuizId, bigQuizSet, dailyKey } from "@/lib/quizModes";
import { QuizAttempt } from "@/lib/quizPlay";
import { CloudQuizAttempt, mirrorQuizAttempt, pullQuizAttempts } from "@/lib/supabase/quiz-sync";
import { useSession } from "@/lib/session";

export default function LiveQuizPage() {
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
  const dkey = dailyKey();
  const id = bigQuizId(dkey);
  const questions = useMemo(() => bigQuizSet(dkey), [dkey]);

  const [stage, setStage] = useState<"intro" | "playing" | "done">("intro");
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [board, setBoard] = useState<CloudQuizAttempt[]>([]);

  const poll = useCallback(async () => {
    const rows = await pullQuizAttempts(id);
    setBoard(rows.sort((a, b) => b.score - a.score || a.totalMs - b.totalMs));
  }, [id]);

  useEffect(() => {
    void poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, [poll]);

  if (!user) return null;

  if (stage === "playing") {
    return (
      <QuizRunner
        email={user.email}
        festId={id}
        questions={questions}
        onFinish={(a) => {
          void mirrorQuizAttempt(a, user.displayName);
          track(EV.quizFinish, { festId: "bigquiz", score: a.score });
          setAttempt(a);
          setStage("done");
          setTimeout(() => void poll(), 600);
        }}
      />
    );
  }

  if (stage === "done" && attempt) {
    return (
      <QuizResultCard
        attempt={attempt}
        title="Big Quiz"
        onReplay={() => {
          setAttempt(null);
          setStage("playing");
        }}
        replayLabel="Replay (practice)"
      >
        <LiveBoard board={board} you={user.displayName} />
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
      <div className="rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-6">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
          Live today · {board.length} playing
        </div>
        <h1 className="mt-1 text-3xl font-semibold">The Big Quiz</h1>
        <p className="mt-2 text-sm text-ink-300">
          {questions.length} questions, 5 seconds each — the whole field on one
          board. Same set for everyone today. Resets at midnight.
        </p>
        <button
          onClick={() => {
            track(EV.quizStart, { festId: "bigquiz" });
            setStage("playing");
          }}
          className="mt-4 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-300"
        >
          Enter the Big Quiz →
        </button>
      </div>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-ink-400">
        Today&apos;s leaderboard
      </h2>
      {board.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">
          Be the first to set a score today.
        </p>
      ) : (
        <div className="mt-3">
          <LiveBoard board={board} you={user.displayName} />
        </div>
      )}
      <p className="mt-4 text-xs text-ink-500">
        Live board refreshes every few seconds. Synchronized showtime (everyone
        on the same question at once) lands with true realtime.
      </p>
    </>
  );
}

function LiveBoard({ board, you }: { board: CloudQuizAttempt[]; you: string }) {
  if (board.length === 0) return null;
  return (
    <ol className="divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
      {board.slice(0, 20).map((r, i) => {
        const mine = r.displayName === you;
        return (
          <li
            key={r.displayName + i}
            className={
              "flex items-center justify-between px-5 py-2.5 text-sm " +
              (mine ? "bg-brand-500/5" : "")
            }
          >
            <span className="flex items-center gap-3">
              <span
                className={
                  "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
                  (i === 0 ? "bg-brand-500 text-ink-950" : "bg-ink-900 text-ink-400")
                }
              >
                {i + 1}
              </span>
              <span className={mine ? "font-medium text-ink-50" : "text-ink-200"}>
                @{r.displayName}
                {mine && <span className="ml-2 text-xs text-brand-300">you</span>}
              </span>
            </span>
            <span className="font-mono text-xs text-ink-50">{r.score} pts</span>
          </li>
        );
      })}
    </ol>
  );
}
