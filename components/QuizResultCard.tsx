"use client";

// Shared result card for the practice/quick/daily/versus quiz modes.

import Link from "next/link";

import { QuizAttempt, quizAccuracy } from "@/lib/quizPlay";

export function QuizResultCard({
  attempt,
  title,
  onReplay,
  replayLabel = "Play again",
  backHref = "/quizzes",
  backLabel = "Quiz Floor",
  children,
}: {
  attempt: QuizAttempt;
  title: string;
  onReplay?: () => void;
  replayLabel?: string;
  backHref?: string;
  backLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-8 text-center">
      <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
        {title}
      </div>
      <div className="mt-2 text-5xl font-semibold">{attempt.score}</div>
      <div className="mt-1 text-sm text-ink-300">points</div>

      <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3 text-sm">
        <Stat label="Correct" value={`${attempt.correct}/${attempt.total}`} />
        <Stat label="Accuracy" value={`${quizAccuracy(attempt)}%`} />
        <Stat label="Time" value={`${(attempt.totalMs / 1000).toFixed(1)}s`} />
      </div>

      {children && <div className="mx-auto mt-6 max-w-md">{children}</div>}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {onReplay && (
          <button onClick={onReplay} className="btn-ghost">
            {replayLabel}
          </button>
        )}
        <Link
          href={backHref}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          {backLabel} →
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950/60 p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
