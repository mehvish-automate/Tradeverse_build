"use client";

// Thin, typed wrappers for the few write paths that should hit
// Supabase when the user is signed in. Each function is a no-op
// when Supabase isn't configured or the user isn't authenticated —
// the V1 localStorage flow keeps running untouched.

import type { DailyResult } from "../progress";
import { getBrowserSupabase } from "./client";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Write one daily result row (idempotent per user+date). */
export async function writeDailyResult(r: DailyResult): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const row = {
    user_id: userId,
    date_key: r.dateKey,
    correct: r.correct,
    total: r.total,
    xp: r.xp,
    time_ms: r.timeMs,
  };
  const { error } = await (supabase.from("daily_results") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "user_id,date_key" });
  return !error;
}

/** Insert or update user_stats after a run. */
export async function writeUserStats(
  streak: number,
  lastPlayedKey: string | null,
  totalXp: number,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = {
    user_id: userId,
    streak,
    last_played_key: lastPlayedKey,
    total_xp: totalXp,
  };
  const { error } = await (supabase.from("user_stats") as unknown as {
    upsert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).upsert(row);
  return !error;
}

/** Insert a trade-floor row + owner membership. */
export async function writeTradeFloor(input: {
  id: string;
  name: string;
}): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const floorRow = {
    id: input.id,
    name: input.name,
    created_by: userId,
  };
  const { error: floorErr } = await (supabase.from("trade_floors") as unknown as {
    insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).insert(floorRow);
  if (floorErr) return false;

  const memberRow = { trade_floor_id: input.id, user_id: userId };
  const { error: memErr } = await (supabase.from("trade_floor_members") as unknown as {
    insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).insert(memberRow);
  return !memErr;
}

/** Join an existing trade floor by code. RLS enforces self-join. */
export async function joinTradeFloorCloud(floorId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = { trade_floor_id: floorId, user_id: userId };
  const { error } = await (supabase.from("trade_floor_members") as unknown as {
    upsert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).upsert(row);
  return !error;
}

/** Insert a floor post. */
export async function writeFloorPost(input: {
  clubId: string;
  body: string;
  kind: "text" | "chart-read" | "portfolio-share";
  ticker?: string;
}): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = {
    club_id: input.clubId,
    user_id: userId,
    kind: input.kind,
    body: input.body,
    ticker: input.ticker ?? null,
  };
  const { error } = await (supabase.from("floor_posts") as unknown as {
    insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).insert(row);
  return !error;
}

/** Add a paper order row after the local engine processes it. */
export async function writeOrder(input: {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  kind: "market" | "limit" | "stop" | "stop-limit";
  qty: number;
  limitPrice?: number | null;
  stopPrice?: number | null;
  status: "pending" | "partial" | "filled" | "cancelled" | "rejected";
  filledQty: number;
  avgFillPrice: number;
  fills: unknown[];
  placedAt: number;
}): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = {
    id: input.id,
    user_id: userId,
    symbol: input.symbol,
    side: input.side,
    kind: input.kind,
    qty: input.qty,
    filled_qty: input.filledQty,
    avg_fill_price: input.avgFillPrice,
    limit_price: input.limitPrice ?? null,
    stop_price: input.stopPrice ?? null,
    status: input.status,
    placed_at: new Date(input.placedAt).toISOString(),
    fills: input.fills,
  };
  const { error } = await (supabase.from("orders") as unknown as {
    upsert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).upsert(row);
  return !error;
}

/** Add a symbol to the cloud watchlist (idempotent on (user_id, symbol)). */
export async function writeWatchlistAdd(symbol: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = { user_id: userId, symbol };
  const { error } = await (supabase.from("watchlist_items") as unknown as {
    upsert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).upsert(row);
  return !error;
}

/** Remove a symbol from the cloud watchlist. */
export async function writeWatchlistRemove(symbol: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const { error } = await (
    supabase.from("watchlist_items") as unknown as {
      delete: () => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
        };
      };
    }
  )
    .delete()
    .eq("user_id", userId)
    .eq("symbol", symbol);
  return !error;
}

/** Record a quest claim (idempotent on (user_id, quest_key)). */
export async function writeQuestClaim(
  questKey: string,
  rewardXp: number,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = { user_id: userId, quest_key: questKey, reward_xp: rewardXp };
  const { error } = await (supabase.from("quest_claims") as unknown as {
    upsert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).upsert(row);
  return !error;
}
