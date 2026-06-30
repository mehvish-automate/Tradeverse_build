"use client";

// Phase 53 — true real-time quiz show. The host drives a synchronized
// run: everyone sees the same question with the same countdown, and the
// leaderboard updates live as answers land. State rides on Supabase
// Realtime (postgres_changes on quiz_rooms + quiz_live_answers), with a
// 2s poll fallback so it degrades gracefully if Realtime isn't enabled.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Fest, getFest } from "@/lib/fests";
import { QUIZ_TIME_LIMIT_MS, scoreQuizAnswer } from "@/lib/quizPlay";
import { pickQuizQuestions } from "@/lib/quizQuestions";
import { openQuizRoom } from "@/lib/supabase/quiz-sync";
import {
  LiveRoom,
  LiveStanding,
  getLiveRoom,
  pullLiveStandings,
  setShowState,
  submitLiveAnswer,
} from "@/lib/supabase/quiz-realtime";
import { useRealtimeTable } from "@/lib/supabase/realtime";
import { useSession } from "@/lib/session";

const REVEAL_MS = 2500;

export default function LiveShowPage() {
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
  const params = useParams<{ code: string }>();
  const code = params?.code ? String(params.code).toUpperCase() : "";

  const [fest, setFest] = useState<Fest | null | undefined>(undefined);
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [standings, setStandings] = useState<LiveStanding[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());
  const [chosen, setChosen] = useState<number | null>(null);
  const [answeredQ, setAnsweredQ] = useState<number>(-1);

  const roomRef = useRef<LiveRoom | null>(null);
  roomRef.current = room;

  const roomTick = useRealtimeTable("quiz_rooms");
  const ansTick = useRealtimeTable("quiz_live_answers");

  useEffect(() => {
    if (code) setFest(getFest(code) ?? null);
  }, [code]);

  const questions = fest ? pickQuizQuestions(fest) : [];
  const isHost = !!fest && !!user && fest.createdBy === user.email;

  const refetch = useCallback(async () => {
    if (!fest) return;
    const [r, s] = await Promise.all([getLiveRoom(fest.id), pullLiveStandings(fest.id)]);
    setRoom(r);
    setStandings(s);
  }, [fest]);

  // Refetch on realtime ticks + a 2s poll fallback.
  useEffect(() => {
    if (!fest) return;
    void refetch();
    const t = setInterval(refetch, 2000);
    return () => clearInterval(t);
  }, [fest, refetch, roomTick.tick, ansTick.tick]);

  // 100ms clock for countdown rendering.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, []);

  // Reset the local answer when the question changes.
  useEffect(() => {
    if (room?.phase === "question") {
      setChosen(null);
    }
  }, [room?.currentQ, room?.phase]);

  // Host authority: advance the show when deadlines pass.
  useEffect(() => {
    if (!isHost || !fest) return;
    const tick = setInterval(() => {
      const r = roomRef.current;
      if (!r) return;
      const t = Date.now();
      if (r.phase === "question" && r.qDeadline && t >= r.qDeadline) {
        void setShowState(fest.id, "reveal", r.currentQ, t + REVEAL_MS).then(refetch);
      } else if (r.phase === "reveal" && r.qDeadline && t >= r.qDeadline) {
        if (r.currentQ + 1 < questions.length) {
          void setShowState(fest.id, "question", r.currentQ + 1, t + QUIZ_TIME_LIMIT_MS).then(refetch);
        } else {
          void setShowState(fest.id, "ended", r.currentQ, null).then(refetch);
        }
      }
    }, 300);
    return () => clearInterval(tick);
  }, [isHost, fest, questions.length, refetch]);

  if (!user || fest === undefined) return null;
  if (fest === null) {
    return <Shell title="Not found">No quiz matches that code on this device.</Shell>;
  }
  if (fest.eventType !== "quiz") {
    return <Shell title="Not a quiz">Live shows are for quizzes.</Shell>;
  }

  async function startShow() {
    if (!fest) return;
    await openQuizRoom(fest.id); // ensure the room row exists (host = me)
    await setShowState(fest.id, "question", 0, Date.now() + QUIZ_TIME_LIMIT_MS);
    void refetch();
  }

  const phase: LiveRoom["phase"] = room?.phase ?? "lobby";
  const q = phase === "question" || phase === "reveal" ? questions[room?.currentQ ?? 0] : null;
  const timeLeft = room?.qDeadline ? Math.max(0, room.qDeadline - now) : 0;

  function answer(i: number) {
    if (!fest || !room || answeredQ === room.currentQ || phase !== "question") return;
    if (!q) return;
    setChosen(i);
    setAnsweredQ(room.currentQ);
    const qStart = (room.qDeadline ?? now) - QUIZ_TIME_LIMIT_MS;
    const ms = Math.min(QUIZ_TIME_LIMIT_MS, Math.max(0, now - qStart));
    const correct = i === q.answer;
    void submitLiveAnswer({
      festId: fest.id,
      displayName: user!.displayName,
      qIndex: room.currentQ,
      choice: i,
      correct,
      ms,
      points: scoreQuizAnswer(correct, ms),
    });
  }

  return (
    <>
      <div className="mb-2 text-xs">
        <Link href={`/fests/${fest.id}`} className="text-ink-400 hover:text-ink-100">
          ← {fest.name}
        </Link>
      </div>
      <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-brand-300">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
        Live show {isHost && "· host"}
      </div>

      {phase === "lobby" && (
        <div className="rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-6">
          <h1 className="text-2xl font-semibold">{fest.name}</h1>
          <p className="mt-2 text-sm text-ink-300">
            {questions.length} questions · everyone answers the same question at
            the same time. {standings.length} in the room.
          </p>
          {isHost ? (
            <button
              onClick={startShow}
              className="mt-4 rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-300"
            >
              Start the show →
            </button>
          ) : (
            <p className="mt-4 text-sm text-amber-300">
              Waiting for the host to start…
            </p>
          )}
        </div>
      )}

      {(phase === "question" || phase === "reveal") && q && (
        <div>
          <div className="flex items-center justify-between text-xs text-ink-400">
            <span>
              Question {(room?.currentQ ?? 0) + 1} of {questions.length}
            </span>
            <span className="font-mono tabular-nums">
              {phase === "question" ? `${(timeLeft / 1000).toFixed(1)}s` : "—"}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-900">
            <div
              className={"h-full " + (phase === "reveal" ? "bg-ink-700" : "bg-brand-500")}
              style={{
                width:
                  phase === "reveal"
                    ? "100%"
                    : `${Math.max(0, Math.min(100, (timeLeft / QUIZ_TIME_LIMIT_MS) * 100))}%`,
              }}
            />
          </div>

          <div className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
            <h2 className="text-lg font-semibold md:text-xl">{q.prompt}</h2>
            <div className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
              {q.options.map((label, i) => {
                const picked = chosen === i;
                const reveal = phase === "reveal";
                const isCorrect = reveal && i === q.answer;
                const isWrong = reveal && picked && i !== q.answer;
                const locked = reveal || answeredQ === room?.currentQ;
                return (
                  <button
                    key={label + i}
                    onClick={() => answer(i)}
                    disabled={locked}
                    className={
                      "rounded-lg border px-4 py-3 text-left text-sm transition " +
                      (isCorrect
                        ? "border-brand-500 bg-brand-500/10 text-ink-50"
                        : isWrong
                          ? "border-red-500/70 bg-red-500/10 text-ink-50"
                          : picked
                            ? "border-ink-500 bg-ink-900 text-ink-50"
                            : "border-ink-700 text-ink-200 hover:border-ink-500 disabled:opacity-60")
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {phase === "reveal" && q.explain && (
              <p className="mt-4 text-sm text-ink-300">{q.explain}</p>
            )}
          </div>
        </div>
      )}

      {phase === "ended" && (
        <div className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-6 text-center">
          <div className="text-3xl">🏁</div>
          <h1 className="mt-2 text-2xl font-semibold">Show over</h1>
          <p className="mt-1 text-sm text-ink-300">Final standings below.</p>
        </div>
      )}

      <Standings standings={standings} you={user.displayName} />

      <p className="mt-4 text-center text-xs text-ink-500">
        Synchronized via Realtime (2s poll fallback). Enable Realtime on
        quiz_rooms + quiz_live_answers for instant updates.
      </p>
    </>
  );
}

function Standings({ standings, you }: { standings: LiveStanding[]; you: string }) {
  if (standings.length === 0) return null;
  return (
    <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/40">
      <header className="border-b border-ink-700/70 px-5 py-3 text-xs font-medium uppercase tracking-wider text-ink-400">
        Live leaderboard
      </header>
      <ol className="divide-y divide-ink-900">
        {standings.slice(0, 20).map((r, i) => {
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
              <span className="font-mono text-xs text-ink-50">{r.points} pts</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-ink-400">{children}</p>
      <Link href="/quizzes" className="mt-4 inline-block btn-ghost">
        Quiz Floor
      </Link>
    </div>
  );
}
