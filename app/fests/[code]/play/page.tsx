"use client";

// Solo timed quiz play (Phase 50). Entry point: /fests/<code>/play for a
// fest with eventType='quiz'. Resolves the question set (custom or a
// deterministic system slice), runs the timed runner, and stores the
// best attempt locally for the Phase 51 results + leaderboard.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { QuizRunner } from "@/components/QuizRunner";
import { RequireAuth } from "@/components/RequireAuth";
import { Fest, FestQuestion, festStatus, getFest, joinFest } from "@/lib/fests";
import {
  QUIZ_SECONDS_PER_QUESTION,
  QuizAttempt,
  getAttempt,
  quizAccuracy,
  saveAttempt,
} from "@/lib/quizPlay";
import {
  myQuizRank,
  quizQuestionPctCorrect,
} from "@/lib/quizLeaderboard";
import { pickQuizQuestions } from "@/lib/quizQuestions";
import { cardUrl, whatsappShareUrl } from "@/lib/shareCards";
import { useSession } from "@/lib/session";

export default function QuizPlayPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const params = useParams<{ code: string }>();
  const code = params?.code ? String(params.code).toUpperCase() : "";

  const [fest, setFest] = useState<Fest | null | undefined>(undefined);
  const [stage, setStage] = useState<"intro" | "playing" | "done">("intro");
  const [result, setResult] = useState<{ attempt: QuizAttempt; improved: boolean } | null>(null);

  useEffect(() => {
    if (!code || !user) return;
    const f = getFest(code);
    if (!f) {
      setFest(null);
      return;
    }
    // Join live quizzes the player isn't in yet (best-effort).
    if (
      f.eventType === "quiz" &&
      festStatus(f) === "live" &&
      !f.participants.some((p) => p.email === user.email)
    ) {
      const r = joinFest(f.id, { email: user.email, displayName: user.displayName });
      setFest(r.ok ? r.fest : f);
    } else {
      setFest(f);
    }
  }, [code, user]);

  const questions = useMemo(
    () => (fest ? pickQuizQuestions(fest) : []),
    [fest],
  );

  const onFinish = useCallback(
    (attempt: QuizAttempt) => {
      if (!user) return;
      const { improved } = saveAttempt(user.email, attempt);
      setResult({ attempt, improved });
      setStage("done");
    },
    [user],
  );

  if (!user || fest === undefined) return null;

  if (fest === null) {
    return (
      <Shell title="Quiz not found">
        <p className="text-sm text-ink-400">
          That code doesn&apos;t match any quiz on this device. Ask the host to
          resend it, or browse the Quiz Floor.
        </p>
        <Link href="/quizzes" className="mt-4 inline-block btn-ghost">
          Open Quiz Floor
        </Link>
      </Shell>
    );
  }

  if (fest.eventType !== "quiz") {
    return (
      <Shell title="Not a quiz">
        <p className="text-sm text-ink-400">
          This event isn&apos;t a quiz, so there&apos;s nothing to play here.
        </p>
        <Link href={`/fests/${fest.id}`} className="mt-4 inline-block btn-ghost">
          Back to event
        </Link>
      </Shell>
    );
  }

  if (fest.lifecycleStatus === "pending_approval" || fest.lifecycleStatus === "rejected") {
    return (
      <Shell title={fest.lifecycleStatus === "rejected" ? "Quiz rejected" : "Awaiting approval"}>
        <p className="text-sm text-ink-400">
          {fest.lifecycleStatus === "rejected"
            ? "This quiz was not approved, so it can't be played."
            : "This quiz is still awaiting admin review. Check back once it's live."}
        </p>
        <Link href="/quizzes" className="mt-4 inline-block btn-ghost">
          Open Quiz Floor
        </Link>
      </Shell>
    );
  }

  if (questions.length === 0) {
    return (
      <Shell title={fest.name}>
        <p className="text-sm text-ink-400">
          This quiz has no questions yet. Ask the host to add some.
        </p>
        <Link href={`/fests/${fest.id}`} className="mt-4 inline-block btn-ghost">
          Back to quiz
        </Link>
      </Shell>
    );
  }

  const status = festStatus(fest);
  const best = getAttempt(user.email, fest.id);

  if (stage === "playing") {
    return (
      <>
        <div className="mb-6">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Quiz Floor · {fest.name}
          </div>
        </div>
        <QuizRunner
          email={user.email}
          festId={fest.id}
          questions={questions}
          onFinish={onFinish}
        />
      </>
    );
  }

  if (stage === "done" && result) {
    return (
      <Results
        fest={fest}
        questions={questions}
        viewerEmail={user.email}
        viewerHandle={user.displayName}
        attempt={result.attempt}
        improved={result.improved}
        onReplay={() => {
          setResult(null);
          setStage("playing");
        }}
      />
    );
  }

  // intro
  return (
    <>
      <div className="mb-2 text-xs">
        <Link href={`/fests/${fest.id}`} className="text-ink-400 hover:text-ink-100">
          ← {fest.name}
        </Link>
      </div>
      <h1 className="text-3xl font-semibold">{fest.name}</h1>
      <p className="mt-2 text-sm text-ink-400">
        {questions.length} questions · {QUIZ_SECONDS_PER_QUESTION}s each ·
        scored on accuracy + speed. Answer fast and right to top the board.
      </p>

      {status !== "live" && (
        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {status === "upcoming"
            ? "This quiz hasn't officially started — you can take it as a practice run now."
            : "This quiz has ended — you can still play it for practice."}
        </div>
      )}

      {best && (
        <div className="mt-4 rounded-lg border border-ink-700 bg-ink-900/40 px-4 py-3 text-sm text-ink-300">
          Your best: <span className="font-semibold text-ink-50">{best.score} pts</span> ·{" "}
          {best.correct}/{best.total} correct · {quizAccuracy(best)}% accuracy
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-6">
        <h2 className="text-lg font-semibold">Ready?</h2>
        <p className="mt-1 text-sm text-ink-300">
          The clock starts the moment a question appears. Each question gives
          you {QUIZ_SECONDS_PER_QUESTION} seconds — faster correct answers score
          more.
        </p>
        <button
          onClick={() => setStage("playing")}
          className="mt-4 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-300"
        >
          Start quiz →
        </button>
      </div>
    </>
  );
}

function Results({
  fest,
  questions,
  viewerEmail,
  viewerHandle,
  attempt,
  improved,
  onReplay,
}: {
  fest: Fest;
  questions: FestQuestion[];
  viewerEmail: string;
  viewerHandle: string;
  attempt: QuizAttempt;
  improved: boolean;
  onReplay: () => void;
}) {
  const acc = quizAccuracy(attempt);
  const rank = myQuizRank(fest, viewerEmail, attempt.total);
  const outOf = fest.participants.length;

  const promptById = new Map(questions.map((q) => [q.id, q.prompt]));
  const fastestCorrect = attempt.answers
    .filter((a) => a.correct)
    .reduce<number | null>((min, a) => (min == null ? a.msTaken : Math.min(min, a.msTaken)), null);

  const shareUrl = cardUrl({
    kind: "rank",
    handle: viewerHandle,
    context: fest.name,
    rank: rank || outOf,
    outOf,
    xp: attempt.score,
  });
  const shareText = `I scored ${attempt.score} pts (${acc}%) in "${fest.name}" on TradeVerse.`;

  return (
    <div>
      <div className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-8 text-center">
        <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
          {fest.name}
        </div>
        <div className="mt-2 text-5xl font-semibold">{attempt.score}</div>
        <div className="mt-1 text-sm text-ink-300">points</div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {rank > 0 && (
            <span className="rounded-md bg-ink-900 px-2 py-0.5 text-xs font-semibold text-ink-100">
              #{rank} of {outOf}
            </span>
          )}
          {improved && (
            <span className="rounded-md bg-brand-500/15 px-2 py-0.5 text-xs font-semibold text-brand-300">
              New personal best 🎉
            </span>
          )}
        </div>

        <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3 text-sm">
          <Stat label="Correct" value={`${attempt.correct}/${attempt.total}`} />
          <Stat label="Accuracy" value={`${acc}%`} />
          <Stat label="Time" value={`${(attempt.totalMs / 1000).toFixed(1)}s`} />
        </div>

        {fastestCorrect != null && (
          <p className="mt-4 text-xs text-ink-400">
            ⚡ Fastest correct answer: {(fastestCorrect / 1000).toFixed(1)}s
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={onReplay} className="btn-ghost">
            Play again
          </button>
          <a
            href={whatsappShareUrl(shareText, shareUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-brand-500/60 bg-brand-500/10 px-4 py-2 text-sm font-medium text-brand-200 hover:bg-brand-500/20"
          >
            Share result
          </a>
          <Link
            href={`/fests/${fest.id}`}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
          >
            Leaderboard →
          </Link>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/40">
        <header className="border-b border-ink-700/70 px-5 py-3 text-xs font-medium uppercase tracking-wider text-ink-400">
          Question breakdown
        </header>
        <ol className="divide-y divide-ink-900">
          {attempt.answers.map((a, i) => {
            const community = quizQuestionPctCorrect(fest.id, a.questionId);
            return (
              <li key={a.questionId + i} className="px-5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span
                        className={
                          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold " +
                          (a.correct
                            ? "bg-brand-500 text-ink-950"
                            : "bg-red-500/20 text-red-300")
                        }
                      >
                        {a.correct ? "✓" : a.chosen == null ? "⏱" : "✗"}
                      </span>
                      <span className="truncate text-ink-200">
                        {promptById.get(a.questionId) ?? `Question ${i + 1}`}
                      </span>
                    </div>
                    <div className="mt-1 pl-7 text-xs text-ink-500">
                      {a.chosen == null
                        ? "Timed out"
                        : `Your time ${(a.msTaken / 1000).toFixed(1)}s`}{" "}
                      · {community}% of players got this right
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-ink-300">
                    +{a.points}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <p className="mt-4 text-center text-xs text-ink-500">
        Peer scores and community percentages are V1 stand-ins until cloud
        sync lands — your own score is real. Live multiplayer rooms come next.
      </p>
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

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-2">{children}</div>
    </div>
  );
}
