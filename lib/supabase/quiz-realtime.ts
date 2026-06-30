"use client";

// Phase 53 — true real-time quiz show.
//
// The host drives progression by writing the room's phase + current
// question + per-question deadline; every client observes it over
// Realtime (postgres_changes on quiz_rooms). Players submit one answer
// per question into quiz_live_answers; the live leaderboard aggregates
// points from it (also Realtime). No-op without Supabase env.

import { getBrowserSupabase } from "./client";

export type ShowPhase = "lobby" | "question" | "reveal" | "ended";

export type LiveRoom = {
  state: "lobby" | "live" | "ended";
  phase: ShowPhase;
  currentQ: number;
  qDeadline: number | null;
};

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function getLiveRoom(festId: string): Promise<LiveRoom | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  type Row = {
    state: "lobby" | "live" | "ended";
    phase: ShowPhase;
    current_q: number;
    q_deadline: string | null;
  };
  const res = await (supabase.from("quiz_rooms") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => { maybeSingle: () => Promise<{ data: Row | null; error: unknown }> };
    };
  })
    .select("state, phase, current_q, q_deadline")
    .eq("fest_id", festId)
    .maybeSingle();
  if (!res.data) return null;
  return {
    state: res.data.state,
    phase: res.data.phase ?? "lobby",
    currentQ: res.data.current_q ?? -1,
    qDeadline: res.data.q_deadline ? new Date(res.data.q_deadline).getTime() : null,
  };
}

/** Host writes the show pointer. Players follow it via Realtime. */
export async function setShowState(
  festId: string,
  phase: ShowPhase,
  currentQ: number,
  deadlineMs: number | null,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const vals: Record<string, unknown> = {
    phase,
    current_q: currentQ,
    q_deadline: deadlineMs ? new Date(deadlineMs).toISOString() : null,
    state: phase === "ended" ? "ended" : "live",
    updated_at: new Date().toISOString(),
  };
  const { error } = await (supabase.from("quiz_rooms") as unknown as {
    update: (v: unknown) => {
      eq: (c: string, val: string) => Promise<{ error: unknown }>;
    };
  })
    .update(vals)
    .eq("fest_id", festId);
  return !error;
}

export async function submitLiveAnswer(input: {
  festId: string;
  displayName: string;
  qIndex: number;
  choice: number | null;
  correct: boolean;
  ms: number;
  points: number;
}): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = {
    fest_id: input.festId,
    user_id: userId,
    display_name: input.displayName,
    q_index: input.qIndex,
    choice: input.choice,
    correct: input.correct,
    ms: input.ms,
    points: input.points,
  };
  const { error } = await (supabase.from("quiz_live_answers") as unknown as {
    upsert: (r: unknown, o: { onConflict: string }) => Promise<{ error: unknown }>;
  }).upsert(row, { onConflict: "fest_id,user_id,q_index" });
  return !error;
}

export type LiveStanding = { displayName: string; points: number; correct: number };

export async function pullLiveStandings(festId: string): Promise<LiveStanding[]> {
  const supabase = getBrowserSupabase();
  if (!supabase) return [];
  type Row = { display_name: string; points: number; correct: boolean };
  const res = await (supabase.from("quiz_live_answers") as unknown as {
    select: (c: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: Row[] | null; error: unknown }>;
    };
  })
    .select("display_name, points, correct")
    .eq("fest_id", festId);
  if (!res.data) return [];
  const byName = new Map<string, LiveStanding>();
  for (const r of res.data) {
    const cur = byName.get(r.display_name) ?? { displayName: r.display_name, points: 0, correct: 0 };
    cur.points += Number(r.points) || 0;
    cur.correct += r.correct ? 1 : 0;
    byName.set(r.display_name, cur);
  }
  return [...byName.values()].sort((a, b) => b.points - a.points);
}
