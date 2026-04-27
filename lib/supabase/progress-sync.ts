"use client";

// Phase 31 — mirror quest claims, badge unlocks, and streak freezes
// to Supabase. Additive: localStorage stays the source of truth and
// the UI keeps reading from it. Cloud rows give us cross-device parity
// and a base to build server-side claim audit / badge feeds on later.

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";
import { viewBadges } from "../badges";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// --- Quest claims ---

/** Record one quest claim. PK is (user_id, quest_id, window_key). */
export async function mirrorQuestClaim(input: {
  questId: string;
  windowKey: string;
  rewardXp: number;
}): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = {
    user_id: userId,
    quest_id: input.questId,
    window_key: input.windowKey,
    reward_xp: input.rewardXp,
  };
  const { error } = await (supabase.from("quest_claims") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, {
    onConflict: "user_id,quest_id,window_key",
    ignoreDuplicates: true,
  });
  return !error;
}

/**
 * Pull claimed quests from cloud into the local claims store. Local
 * claims always win (claim ts is set on click, not first-seen). Server
 * rows we don't have locally are added with their server ts.
 */
export async function pullQuestClaims(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  type Row = { quest_id: string; window_key: string; claimed_at: string };
  const res = await (supabase.from("quest_claims") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
    };
  })
    .select("quest_id, window_key, claimed_at")
    .eq("user_id", userId);
  if (res.error || !res.data) return 0;

  const KEY = `tv.quests.claims.${local.email}`;
  const raw = localStorage.getItem(KEY);
  const store: Record<string, number> = raw ? JSON.parse(raw) : {};
  let added = 0;
  for (const r of res.data) {
    const k = `${r.quest_id}|${r.window_key}`;
    if (!store[k]) {
      store[k] = new Date(r.claimed_at).getTime();
      added++;
    }
  }
  if (added > 0) {
    localStorage.setItem(KEY, JSON.stringify(store));
  }
  return added;
}

// --- Badge unlocks ---

/**
 * Walk the current badge view and idempotently insert one row per
 * earned badge. Conflict on (user_id, badge_id) so the original
 * earned_at is preserved.
 */
export async function mirrorEarnedBadges(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  const earned = viewBadges(local.email).filter((v) => v.earned);
  if (earned.length === 0) return 0;

  const rows = earned.map((v) => ({
    user_id: userId,
    badge_id: v.badge.id,
  }));
  const { error } = await (supabase.from("badge_unlocks") as unknown as {
    upsert: (
      rows: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(rows, {
    onConflict: "user_id,badge_id",
    ignoreDuplicates: true,
  });
  return error ? 0 : rows.length;
}

/**
 * Pull badge_unlocks for diagnostics and future cross-device "earned
 * 2 minutes ago" feeds. Stored under tv.badges.unlocks.<email> as a
 * map of badge_id → earned_at ms. Local store is union-merged.
 */
export async function pullBadgeUnlocks(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  type Row = { badge_id: string; earned_at: string };
  const res = await (supabase.from("badge_unlocks") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
    };
  })
    .select("badge_id, earned_at")
    .eq("user_id", userId);
  if (res.error || !res.data) return 0;

  const KEY = `tv.badges.unlocks.${local.email}`;
  const raw = localStorage.getItem(KEY);
  const store: Record<string, number> = raw ? JSON.parse(raw) : {};
  let added = 0;
  for (const r of res.data) {
    if (!store[r.badge_id]) {
      store[r.badge_id] = new Date(r.earned_at).getTime();
      added++;
    }
  }
  if (added > 0) {
    localStorage.setItem(KEY, JSON.stringify(store));
  }
  return added;
}

// --- Streak freezes ---

/**
 * Pull user_stats.streak_freezes back into localStorage on first load.
 * Push side already handled by syncProfile() in sync.ts (read-write
 * mirror via the existing 60s tick). This makes a fresh device see
 * the right freeze count immediately.
 */
export async function pullStreakFreezes(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const local = getCurrentUser();
  if (!local) return false;

  type Row = { streak_freezes: number };
  const res = await (supabase.from("user_stats") as unknown as {
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
    .select("streak_freezes")
    .eq("user_id", userId)
    .maybeSingle();
  if (res.error || !res.data) return false;

  const KEY = `tv.streakfreezes.${local.email}`;
  const local_n = Number(localStorage.getItem(KEY) || "0") || 0;
  // Only overwrite if cloud value is higher — local may have just
  // consumed a freeze that hasn't been pushed yet.
  if (res.data.streak_freezes > local_n) {
    localStorage.setItem(KEY, String(res.data.streak_freezes));
  }
  return true;
}
