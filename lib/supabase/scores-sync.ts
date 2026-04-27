"use client";

// Phase 36 — pull real cross-user XP / plays / correct / streak from
// Supabase and cache by date window so the synchronous leaderboard
// functions in tradeFloors.ts and fests.ts can return real numbers
// for other members instead of deterministic demo seeds.
//
// Cache shape: tv.scores.<since>_<until> → { [email]: { xp, plays, correct, streak } }
//
// The viewer is always read from localStorage (their own progress is
// authoritative locally and the cache may lag behind the latest play).

import { getBrowserSupabase } from "./client";

export type CloudScore = {
  xp: number;
  plays: number;
  correct: number;
  streak: number;
};

const cacheKey = (since: string, until: string) =>
  `tv.scores.${since}_${until}`;

/**
 * Aggregate daily_results for the given emails in [since, until] and
 * fetch streak from user_stats. Writes one cache entry per (since,until).
 * No-op when Supabase isn't configured. Best-effort: silently exits on
 * error so the demo-seed fallback in the leaderboard takes over.
 */
export async function pullScoresFor(
  emails: string[],
  since: string,
  until: string,
): Promise<void> {
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  const normalized = Array.from(
    new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  );
  if (normalized.length === 0) return;

  // 1. Resolve emails → user_ids.
  type ProfileRow = { id: string; email: string };
  const profilesRes = await (supabase.from("profiles") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: ProfileRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("id, email")
    .in("email", normalized);
  if (profilesRes.error || !profilesRes.data) return;
  const userIdToEmail = new Map<string, string>();
  for (const p of profilesRes.data) userIdToEmail.set(p.id, p.email);
  const userIds = profilesRes.data.map((p) => p.id);
  if (userIds.length === 0) return;

  // 2. Sum daily_results in window.
  type ResultRow = {
    user_id: string;
    xp: number;
    correct: number;
    total: number;
  };
  const resultsRes = await (supabase.from("daily_results") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => {
        gte: (col: string, val: string) => {
          lte: (
            col: string,
            val: string,
          ) => Promise<{
            data: ResultRow[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  })
    .select("user_id, xp, correct, total")
    .in("user_id", userIds)
    .gte("date_key", since)
    .lte("date_key", until);

  // 3. Streaks (current, not windowed — that's a single number per user).
  type StatsRow = { user_id: string; streak: number };
  const statsRes = await (supabase.from("user_stats") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: StatsRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("user_id, streak")
    .in("user_id", userIds);

  const scoresByEmail: Record<string, CloudScore> = {};
  for (const e of normalized) {
    scoresByEmail[e] = { xp: 0, plays: 0, correct: 0, streak: 0 };
  }
  for (const r of resultsRes.data ?? []) {
    const email = userIdToEmail.get(r.user_id);
    if (!email) continue;
    const s = scoresByEmail[email]!;
    s.xp += r.xp;
    s.plays += 1;
    s.correct += r.correct;
  }
  for (const r of statsRes.data ?? []) {
    const email = userIdToEmail.get(r.user_id);
    if (!email) continue;
    scoresByEmail[email]!.streak = r.streak;
  }

  // 4. Merge into cache.
  const KEY = cacheKey(since, until);
  let cache: Record<string, CloudScore> = {};
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    cache = {};
  }
  for (const [email, s] of Object.entries(scoresByEmail)) cache[email] = s;
  localStorage.setItem(KEY, JSON.stringify(cache));
}

/** Sync read for a previously-pulled score. Null if not in cache. */
export function lookupScore(
  email: string,
  since: string,
  until: string,
): CloudScore | null {
  if (typeof window === "undefined") return null;
  const KEY = cacheKey(since, until);
  try {
    const cache = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<
      string,
      CloudScore
    >;
    return cache[email.trim().toLowerCase()] ?? null;
  } catch {
    return null;
  }
}
