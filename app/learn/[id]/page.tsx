"use client";

import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ChartSvg } from "@/components/ChartSvg";
import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { findLesson } from "@/lib/learn";
import {
  completedSet,
  isLessonUnlocked,
  markComplete,
  nextLesson,
} from "@/lib/learnProgress";
import { Question } from "@/lib/questions";
import { useSession } from "@/lib/session";

export default function LessonPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <LessonInner />
        </RequireAuth>
      </main>
    </>
  );
}

type Phase = "intro" | "practice" | "done";

function LessonInner() {
  const { user } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ? String(params.id) : "";

  const match = useMemo(() => findLesson(id), [id]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [qIdx, setQIdx] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  useEffect(() => {
    if (!match || !user) return;
    if (!isLessonUnlocked(user.email, match.track.id, match.lesson.id)) {
      router.replace("/learn");
    }
  }, [match, user, router]);

  if (!match) {
    notFound();
  }
  if (!user) return null;

  const { track, lesson } = match;
  const q = lesson.practice[qIdx];

  function pick(i: number) {
    if (chosen != null) return;
    setChosen(i);
    if (i === q.answer) setCorrectCount((c) => c + 1);
  }

  function next() {
    if (chosen == null) return;
    if (qIdx + 1 < lesson.practice.length) {
      setQIdx(qIdx + 1);
      setChosen(null);
    } else {
      markComplete(user!.email, lesson.id);
      setPhase("done");
    }
  }

  const done = completedSet(user.email).has(lesson.id);
  const upNext = phase === "done" ? nextLesson(user.email) : null;

  return (
    <>
      <div className="mb-6 flex items-center justify-between text-sm text-ink-400">
        <Link href="/learn" className="hover:text-ink-100">
          ← {track.title}
        </Link>
        <span className="text-xs">
          {done ? "Completed" : `${lesson.minutes} min lesson`}
        </span>
      </div>

      <h1 className="text-3xl font-semibold">{lesson.title}</h1>
      <p className="mt-1 text-sm text-ink-400">{lesson.summary}</p>

      {phase === "intro" && (
        <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
          {lesson.explainer.map((p, i) => (
            <p key={i} className="mb-3 text-ink-200 last:mb-0">
              {p}
            </p>
          ))}
          <div className="mt-6 flex items-center justify-between">
            <div className="text-xs text-ink-500">
              {lesson.practice.length} quick question
              {lesson.practice.length === 1 ? "" : "s"} to cement it
            </div>
            <button
              onClick={() => setPhase("practice")}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              Try it →
            </button>
          </div>
        </section>
      )}

      {phase === "practice" && (
        <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
          <PracticeQuestion
            q={q}
            chosen={chosen}
            onPick={pick}
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
              Question {qIdx + 1} of {lesson.practice.length}
            </div>
            <button
              onClick={next}
              disabled={chosen == null}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300 disabled:opacity-40"
            >
              {qIdx + 1 < lesson.practice.length ? "Next question" : "Finish lesson"}
            </button>
          </div>
        </section>
      )}

      {phase === "done" && (
        <section className="mt-8 rounded-2xl border border-brand-500/40 bg-brand-500/5 p-8 text-center">
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            Lesson complete
          </div>
          <div className="mt-2 text-4xl font-semibold">
            {correctCount}/{lesson.practice.length} correct
          </div>
          <p className="mt-3 text-sm text-ink-300">
            You unlocked the next lesson in {track.title}. Keep the streak going.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {upNext && (
              <Link
                href={`/learn/${upNext.lessonId}`}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
              >
                Next lesson →
              </Link>
            )}
            <Link
              href="/learn"
              className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
            >
              Back to tree
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

function PracticeQuestion({
  q,
  chosen,
  onPick,
}: {
  q: Question;
  chosen: number | null;
  onPick: (i: number) => void;
}) {
  const options = "options" in q ? q.options : [];
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-400">
        <span className="rounded-md bg-brand-500/10 px-2 py-0.5 font-medium text-brand-300">
          {q.kind}
        </span>
        {"symbol" in q && <span>{q.symbol}</span>}
        {"interval" in q && <span>· {q.interval}</span>}
      </div>
      <h2 className="mt-3 text-lg font-semibold md:text-xl">{q.prompt}</h2>
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
          const picked = chosen === i;
          const isCorrect = chosen != null && i === q.answer;
          const isWrongPick = chosen != null && picked && i !== q.answer;
          const locked = chosen != null;
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
    </>
  );
}
