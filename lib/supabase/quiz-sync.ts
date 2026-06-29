"use client";

// Phase 52 — near-live Quiz Floor cloud sync.
//
//   - mirrorQuizAttempt: upsert the player's best attempt so other
//     players' polling picks it up (the shared live standings).
//   - pullQuizAttempts: read every attempt for a quiz (RLS allows read).
//   - getQuizRoom / openQuizRoom / setQuizRoomState: host-controlled
//     lobby -> live -> ended state players poll.
//
// All calls no-op gracefully without Supabase env, matching the rest of
// the codebase's additive pattern. Cross-device state needs the cloud;
// single-device still works through the local solo flow regardless.

import { getBrowserSupabase } from "./client";
import type { QuizAttempt } from "../quizPlay";

export type CloudQuizAttempt = {
  festId: string;
  displayName: string;
  score: number;
  correct: number;
  total: number;
  totalMs: number;
  playedAt: number;
};

export type QuizRoomState = "lobby" | "live" | "ended";
export type QuizRoom = {
  festId: string;
  state: QuizRoomState;
  startedAt: number | null;
};

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function mirrorQuizAttempt(
  attempt: QuizAttempt,
  displayName: string,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const row = {
    fest_id: attempt.festId,
    user_id: userId,
    display_name: displayName,
    score: attempt.score,
    correct: attempt.correct,
    total: attempt.total,
    total_ms: attempt.totalMs,
    played_at: new Date(attempt.playedAt).toISOString(),
  };
  const { error } = await (supabase.from("quiz_attempts") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "fest_id,user_id" });
  return !error;
}

export async function pullQuizAttempts(festId: string): Promise<CloudQuizAttempt[]> {
  const supabase = getBrowserSupabase();
  if (!supabase) return [];
  type Row = {
    fest_id: string;
    display_name: string;
    score: number;
    correct: number;
    total: number;
    total_ms: number;
    played_at: string;
  };
  const res = await (supabase.from("quiz_attempts") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
    };
  })
    .select("fest_id, display_name, score, correct, total, total_ms, played_at")
    .eq("fest_id", festId);
  if (res.error || !res.data) return [];
  return res.data.map((r) => ({
    festId: r.fest_id,
    displayName: r.display_name,
    score: Number(r.score),
    correct: Number(r.correct),
    total: Number(r.total),
    totalMs: Number(r.total_ms),
    playedAt: new Date(r.played_at).getTime(),
  }));
}

export async function getQuizRoom(festId: string): Promise<QuizRoom | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  type Row = { fest_id: string; state: QuizRoomState; started_at: string | null };
  const res = await (supabase.from("quiz_rooms") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: Row | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select("fest_id, state, started_at")
    .eq("fest_id", festId)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return {
    festId: res.data.fest_id,
    state: res.data.state,
    startedAt: res.data.started_at ? new Date(res.data.started_at).getTime() : null,
  };
}

/** Host opens (or re-opens) the lobby. host_id is the calling user. */
export async function openQuizRoom(festId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = {
    fest_id: festId,
    host_id: userId,
    state: "lobby" as QuizRoomState,
    started_at: null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await (supabase.from("quiz_rooms") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "fest_id" });
  return !error;
}

export async function setQuizRoomState(
  festId: string,
  state: QuizRoomState,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const vals: Record<string, string> = { state, updated_at: new Date().toISOString() };
  if (state === "live") vals.started_at = new Date().toISOString();
  const { error } = await (supabase.from("quiz_rooms") as unknown as {
    update: (vals: unknown) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update(vals)
    .eq("fest_id", festId);
  return !error;
}
