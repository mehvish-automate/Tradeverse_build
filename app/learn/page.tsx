"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { TRACKS, Track } from "@/lib/learn";
import {
  completedSet,
  isLessonUnlocked,
  nextLesson,
  overallCompletion,
  trackCompletion,
} from "@/lib/learnProgress";
import { useSession } from "@/lib/session";

const TRACK_TONE: Record<Track["accent"], string> = {
  basics: "from-sky-500/10 border-sky-500/40 text-sky-300",
  patterns: "from-brand-500/10 border-brand-500/40 text-brand-300",
  levels: "from-amber-500/10 border-amber-500/40 text-amber-300",
  fundamentals: "from-violet-500/10 border-violet-500/40 text-violet-300",
};

export default function LearnPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <RequireAuth>
          <LearnInner />
        </RequireAuth>
      </main>
    </>
  );
}

function LearnInner() {
  const { user } = useSession();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Re-render when returning from a lesson via back button.
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (!user) return null;

  const overall = overallCompletion(user.email);
  const next = nextLesson(user.email);
  const done = completedSet(user.email);

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Learn mode
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Skill tree</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-400">
            Short, bite-sized lessons. Each one ends with a couple of practice
            questions. Complete lessons to unlock the next in a track.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-ink-700 bg-ink-900/40 p-4 text-right">
          <div className="text-xs text-ink-500">Tree complete</div>
          <div className="text-2xl font-semibold">{overall.pct}%</div>
          <div className="text-xs text-ink-500">
            {overall.done}/{overall.total} lessons
          </div>
        </div>
      </div>

      {next && (
        <Link
          href={`/learn/${next.lessonId}`}
          className="group mb-10 block rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-6 hover:border-brand-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            Up next
          </div>
          <div className="mt-1 text-2xl font-semibold">
            {next.track.lessons.find((l) => l.id === next.lessonId)?.title}
          </div>
          <div className="mt-1 text-sm text-ink-300">
            {next.track.title} ·{" "}
            {next.track.lessons.find((l) => l.id === next.lessonId)?.minutes} min
          </div>
          <div className="mt-3 text-sm text-brand-300 group-hover:underline">
            Start lesson →
          </div>
        </Link>
      )}

      <div className="space-y-8" key={tick}>
        {TRACKS.map((track) => {
          const { done: d, total, pct } = trackCompletion(user.email, track);
          const tone = TRACK_TONE[track.accent];
          return (
            <section
              key={track.id}
              className={`rounded-2xl border bg-gradient-to-br ${tone} to-transparent p-6`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-ink-50">
                    {track.title}
                  </h2>
                  <p className="mt-1 text-sm text-ink-300">{track.blurb}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs text-ink-400">
                    {d}/{total}
                  </div>
                  <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-ink-900">
                    <div
                      className="h-full bg-current"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              <ol className="mt-5 space-y-2">
                {track.lessons.map((lesson, i) => {
                  const isDone = done.has(lesson.id);
                  const unlocked = isLessonUnlocked(user.email, track.id, lesson.id);
                  return (
                    <li key={lesson.id}>
                      <LessonRow
                        n={i + 1}
                        title={lesson.title}
                        minutes={lesson.minutes}
                        summary={lesson.summary}
                        done={isDone}
                        unlocked={unlocked}
                        href={`/learn/${lesson.id}`}
                      />
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      <div className="mt-10 flex gap-3">
        <Link
          href="/profile"
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to profile
        </Link>
        <Link
          href="/play"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Play today&apos;s challenge →
        </Link>
      </div>
    </>
  );
}

function LessonRow({
  n,
  title,
  minutes,
  summary,
  done,
  unlocked,
  href,
}: {
  n: number;
  title: string;
  minutes: number;
  summary: string;
  done: boolean;
  unlocked: boolean;
  href: string;
}) {
  const content = (
    <div
      className={
        "flex items-center gap-4 rounded-xl border px-4 py-3 transition " +
        (done
          ? "border-brand-500/50 bg-brand-500/5"
          : unlocked
            ? "border-ink-700 bg-ink-900/60 hover:border-ink-500"
            : "border-ink-800 bg-ink-900/20 opacity-60")
      }
    >
      <span
        className={
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
          (done
            ? "bg-brand-500 text-ink-950"
            : unlocked
              ? "bg-ink-800 text-ink-100"
              : "bg-ink-900 text-ink-500")
        }
      >
        {done ? "✓" : unlocked ? n : "🔒"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-ink-50">{title}</span>
          <span className="text-xs text-ink-500">{minutes} min</span>
        </div>
        <div className="truncate text-sm text-ink-400">{summary}</div>
      </div>
      <span className="shrink-0 text-sm text-ink-400">
        {done ? "Review" : unlocked ? "Start" : "Locked"}
      </span>
    </div>
  );
  if (!unlocked) return <div aria-disabled>{content}</div>;
  return <Link href={href}>{content}</Link>;
}
