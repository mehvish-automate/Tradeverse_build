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

/**
 * Insert a trade-floor row + owner membership. Phase 42 extends the
 * payload with the launch-flow fields. Defaults match the schema so
 * legacy callers (none in tree, but extensions / scripts) still work.
 */
export async function writeTradeFloor(input: {
  id: string;
  name: string;
  privacy?: "public" | "private";
  startAt?: number | null;
  endAt?: number | null;
  memberCap?: number;
  virtualCapital?: number;
  stockUniverse?: unknown;
  assetClasses?: string[];
  marketRegion?: "IN" | "UAE" | "US" | "GLOBAL";
  status?: "pending_approval" | "live" | "ended" | "rejected";
  createdByKind?: "user" | "club" | "ambassador";
}): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const floorRow = {
    id: input.id,
    name: input.name,
    created_by: userId,
    privacy: input.privacy ?? "public",
    start_at: input.startAt ? new Date(input.startAt).toISOString() : null,
    end_at: input.endAt ? new Date(input.endAt).toISOString() : null,
    member_cap: input.memberCap ?? 20,
    virtual_capital: input.virtualCapital ?? 1_000_000,
    stock_universe: input.stockUniverse ?? { kind: "nifty50" },
    asset_classes: input.assetClasses ?? ["stocks"],
    market_region: input.marketRegion ?? "IN",
    status: input.status ?? "live",
    created_by_kind: input.createdByKind ?? "user",
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

/** Admin-only — flip a trade floor's status. RLS gates by is_admin. */
export async function setTradeFloorStatus(
  floorId: string,
  status: "live" | "rejected" | "ended",
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const { error } = await (supabase.from("trade_floors") as unknown as {
    update: (vals: { status: string }) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({ status })
    .eq("id", floorId);
  return !error;
}

/** Admin-only — flip a fest's status. RLS gates by is_admin. */
export async function setFestStatus(
  festId: string,
  status: "live" | "rejected" | "ended",
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const { error } = await (supabase.from("fests") as unknown as {
    update: (vals: { status: string }) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({ status })
    .eq("id", festId);
  return !error;
}

/** Admin-only — list every fest in pending_approval status. */
export async function listPendingFests(): Promise<
  | {
      id: string;
      name: string;
      privacy: "public" | "private";
      club_id: string;
      event_type: string;
      difficulty: string;
      categories: string[];
      start_date: string;
      end_date: string;
      created_by: string;
      created_at: string;
    }[]
  | null
> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const res = await (supabase.from("fests") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{
          data:
            | {
                id: string;
                name: string;
                privacy: "public" | "private";
                club_id: string;
                event_type: string;
                difficulty: string;
                categories: string[];
                start_date: string;
                end_date: string;
                created_by: string;
                created_at: string;
              }[]
            | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select(
      "id, name, privacy, club_id, event_type, difficulty, categories, start_date, end_date, created_by, created_at",
    )
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false });
  if (res.error) return null;
  return res.data ?? [];
}

/** Admin-only — list every floor in pending_approval status. */
export async function listPendingTradeFloors(): Promise<
  | {
      id: string;
      name: string;
      privacy: "public" | "private";
      member_cap: number;
      virtual_capital: number;
      market_region: string;
      created_by: string;
      created_at: string;
    }[]
  | null
> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const res = await (supabase.from("trade_floors") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{
          data:
            | {
                id: string;
                name: string;
                privacy: "public" | "private";
                member_cap: number;
                virtual_capital: number;
                market_region: string;
                created_by: string;
                created_at: string;
              }[]
            | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select(
      "id, name, privacy, member_cap, virtual_capital, market_region, created_by, created_at",
    )
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false });
  if (res.error) return null;
  return res.data ?? [];
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
