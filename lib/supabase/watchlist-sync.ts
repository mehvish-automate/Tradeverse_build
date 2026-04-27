"use client";

// Phase 30 — mirror the user's watchlist into Supabase whenever they
// have a live session. Additive: localStorage stays authoritative and
// the UI keeps reading from it. Cloud rows survive across devices and
// power future server-side RSI alerting.

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";
import { getStock } from "../stocks";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Insert one row (idempotent — pkey is user_id+symbol). */
export async function addWatchlistCloud(symbol: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = { user_id: userId, symbol };
  const { error } = await (supabase.from("watchlist_items") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "user_id,symbol" });
  return !error;
}

/** Delete one row. */
export async function removeWatchlistCloud(symbol: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const { error } = await (supabase.from("watchlist_items") as unknown as {
    delete: () => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  })
    .delete()
    .eq("user_id", userId)
    .eq("symbol", symbol);
  return !error;
}

/**
 * Pull cloud watchlist into localStorage on auth boot. Union of
 * cloud + local — additions either side are preserved so a quick
 * add on one device doesn't get reverted by an older snapshot from
 * another. The next mirror call will reconcile.
 */
export async function pullWatchlist(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  type Row = { symbol: string };
  const res = await (supabase.from("watchlist_items") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
    };
  })
    .select("symbol")
    .eq("user_id", userId);
  if (res.error || !res.data) return 0;

  const KEY = `tv.watchlist.${local.email}`;
  const raw = localStorage.getItem(KEY);
  const localList: string[] = raw ? JSON.parse(raw) : [];
  const have = new Set(localList);
  let added = 0;
  for (const r of res.data) {
    if (!getStock(r.symbol)) continue; // ignore symbols not in our universe
    if (!have.has(r.symbol)) {
      localList.push(r.symbol);
      have.add(r.symbol);
      added++;
    }
  }
  if (added > 0) {
    localStorage.setItem(KEY, JSON.stringify(localList));
  }
  return added;
}

/**
 * Push the entire local watchlist up after a pull/merge — guarantees
 * the cloud reflects every symbol the user added on this device while
 * offline. Idempotent.
 */
export async function pushLocalWatchlist(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const local = getCurrentUser();
  if (!local) return false;

  const KEY = `tv.watchlist.${local.email}`;
  const raw = localStorage.getItem(KEY);
  const list: string[] = raw ? JSON.parse(raw) : [];
  if (list.length === 0) return true;

  const rows = list.map((symbol) => ({ user_id: userId, symbol }));
  const { error } = await (supabase.from("watchlist_items") as unknown as {
    upsert: (
      rows: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(rows, { onConflict: "user_id,symbol" });
  return !error;
}
