"use client";

// Phase 28 — mirror the paper-trading engine (account / holdings / orders)
// from localStorage into Supabase whenever the user has a live session.
// Additive: reads still come from localStorage and the local matching
// engine remains authoritative. Cloud rows are best-effort mirrors so
// state survives across devices and seeds future server-side execution.

import { getBrowserSupabase } from "./client";
import { writeOrder } from "./writes";
import {
  getAccount,
  listOrders,
  type Order,
  type PaperAccount,
} from "../paper";
import { getCurrentUser } from "../session";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Upsert the paper_accounts row (cash balance) for this user. */
export async function syncPaperAccount(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const local = getCurrentUser();
  if (!local) return false;

  const acct = getAccount(local.email);
  const row = {
    user_id: userId,
    cash: acct.cash,
  };
  const { error } = await (supabase.from("paper_accounts") as unknown as {
    upsert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).upsert(row);
  return !error;
}

/**
 * Mirror holdings as a full reconciliation: upsert each row, then delete
 * any server rows for symbols the user no longer holds. Keeps the cloud
 * exactly in sync with localStorage after a fill, sale, or reset.
 */
export async function syncPaperHoldings(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const local = getCurrentUser();
  if (!local) return false;

  const acct = getAccount(local.email);
  const symbols = acct.holdings.map((h) => h.symbol);

  if (acct.holdings.length > 0) {
    const rows = acct.holdings.map((h) => ({
      user_id: userId,
      symbol: h.symbol,
      shares: h.shares,
      avg_price: h.avgPrice,
    }));
    const { error: upErr } = await (supabase.from("paper_holdings") as unknown as {
      upsert: (
        rows: unknown,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    }).upsert(rows, { onConflict: "user_id,symbol" });
    if (upErr) return false;
  }

  // Drop any symbols the user no longer holds.
  const del = supabase.from("paper_holdings") as unknown as {
    delete: () => {
      eq: (
        col: string,
        val: string,
      ) => {
        not: (
          col: string,
          op: string,
          vals: string[],
        ) => Promise<{ error: { message: string } | null }>;
      } & Promise<{ error: { message: string } | null }>;
    };
  };
  if (symbols.length > 0) {
    const { error: delErr } = await del
      .delete()
      .eq("user_id", userId)
      .not("symbol", "in", symbols);
    if (delErr) return false;
  } else {
    const { error: delErr } = await del.delete().eq("user_id", userId);
    if (delErr) return false;
  }
  return true;
}

/** Mirror a single order row (called after place / process / cancel). */
export async function mirrorOrder(order: Order): Promise<boolean> {
  return writeOrder({
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    kind: order.kind,
    qty: order.qty,
    filledQty: order.filledQty,
    avgFillPrice: order.avgFillPrice,
    limitPrice: order.limitPrice ?? null,
    stopPrice: order.stopPrice ?? null,
    status: order.status,
    fills: order.fills,
    placedAt: order.placedAt,
  });
}

/** Mirror account + holdings together — call after every fill / reset. */
export async function mirrorAccountState(): Promise<boolean> {
  const a = await syncPaperAccount();
  const h = await syncPaperHoldings();
  return a && h;
}

/**
 * Pull the user's paper state down into localStorage on first auth so
 * a phone session shows up on desktop. Local wins when both have data
 * for the same key (avoids clobbering an in-progress run).
 */
export async function pullPaperState(): Promise<{
  account: boolean;
  holdings: number;
  orders: number;
}> {
  const result = { account: false, holdings: 0, orders: 0 };
  const supabase = getBrowserSupabase();
  if (!supabase) return result;
  const userId = await authedUserId();
  if (!userId) return result;
  const local = getCurrentUser();
  if (!local) return result;

  type AccountRow = { cash: number };
  const accountRes = await (supabase.from("paper_accounts") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: AccountRow | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select("cash")
    .eq("user_id", userId)
    .maybeSingle();

  type HoldingRow = { symbol: string; shares: number; avg_price: number };
  const holdingsRes = await (supabase.from("paper_holdings") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{
        data: HoldingRow[] | null;
        error: { message: string } | null;
      }>;
    };
  })
    .select("symbol, shares, avg_price")
    .eq("user_id", userId);

  if (accountRes.error || holdingsRes.error) return result;

  // Merge into localStorage. We only overwrite when the server has data
  // and local is empty / fresh; otherwise the local engine is canonical.
  const ACCT_KEY = `tv.paper.account.${local.email}`;
  const raw = localStorage.getItem(ACCT_KEY);
  const localAcct: PaperAccount | null = raw
    ? (JSON.parse(raw) as PaperAccount)
    : null;

  const isFresh =
    !localAcct ||
    (localAcct.cash === 1_000_000 && localAcct.holdings.length === 0);

  if (isFresh && accountRes.data) {
    const acct: PaperAccount = {
      cash: Number(accountRes.data.cash),
      holdings: (holdingsRes.data ?? []).map((r) => ({
        symbol: r.symbol,
        shares: r.shares,
        avgPrice: Number(r.avg_price),
      })),
      createdAt: Date.now(),
    };
    localStorage.setItem(ACCT_KEY, JSON.stringify(acct));
    result.account = true;
    result.holdings = acct.holdings.length;
  }

  // Orders: pull rows we don't have locally (by id).
  type OrderRow = {
    id: string;
    symbol: string;
    side: "buy" | "sell";
    kind: "market" | "limit" | "stop" | "stop-limit";
    qty: number;
    filled_qty: number;
    avg_fill_price: number;
    limit_price: number | null;
    stop_price: number | null;
    status: Order["status"];
    placed_at: string;
    last_updated: string;
    fills: unknown;
  };
  const ordersRes = await (supabase.from("orders") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{
        data: OrderRow[] | null;
        error: { message: string } | null;
      }>;
    };
  })
    .select(
      "id, symbol, side, kind, qty, filled_qty, avg_fill_price, limit_price, stop_price, status, placed_at, last_updated, fills",
    )
    .eq("user_id", userId);

  if (!ordersRes.error && ordersRes.data) {
    const ORDERS_KEY = `tv.paper.orders.${local.email}`;
    const localOrders = listOrders(local.email);
    const haveIds = new Set(localOrders.map((o) => o.id));
    const additions: Order[] = [];
    for (const row of ordersRes.data) {
      if (haveIds.has(row.id)) continue;
      additions.push({
        id: row.id,
        symbol: row.symbol,
        side: row.side,
        kind: row.kind,
        qty: row.qty,
        filledQty: row.filled_qty,
        avgFillPrice: Number(row.avg_fill_price),
        limitPrice: row.limit_price ?? undefined,
        stopPrice: row.stop_price ?? undefined,
        status: row.status,
        placedAt: new Date(row.placed_at).getTime(),
        lastUpdated: new Date(row.last_updated).getTime(),
        fills: Array.isArray(row.fills) ? (row.fills as Order["fills"]) : [],
      });
    }
    if (additions.length > 0) {
      const merged = [...localOrders, ...additions];
      localStorage.setItem(ORDERS_KEY, JSON.stringify(merged));
      result.orders = additions.length;
    }
  }

  return result;
}

/**
 * Phase 38 — realtime reconcile. Stronger than pullPaperState: when
 * a `orders` or `paper_holdings` change lands via the realtime channel,
 * cloud is authoritative. We overwrite the order rows we have locally
 * (so a fill that happened on another device flips our `pending` →
 * `filled`) and replace cash + holdings wholesale.
 *
 * Used only on realtime ticks. First-load still uses the conservative
 * pullPaperState so a brand-new device doesn't clobber an in-progress
 * local engine state.
 */
export async function reconcilePaperFromCloud(): Promise<{
  ordersChanged: number;
  accountChanged: boolean;
}> {
  const out = { ordersChanged: 0, accountChanged: false };
  const supabase = getBrowserSupabase();
  if (!supabase) return out;
  const userId = await authedUserId();
  if (!userId) return out;
  const local = getCurrentUser();
  if (!local) return out;

  // 1. Account + holdings.
  type AccountRow = { cash: number };
  const accountRes = await (supabase.from("paper_accounts") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: AccountRow | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select("cash")
    .eq("user_id", userId)
    .maybeSingle();

  type HoldingRow = { symbol: string; shares: number; avg_price: number };
  const holdingsRes = await (supabase.from("paper_holdings") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{
        data: HoldingRow[] | null;
        error: { message: string } | null;
      }>;
    };
  })
    .select("symbol, shares, avg_price")
    .eq("user_id", userId);

  if (!accountRes.error && !holdingsRes.error && accountRes.data) {
    const ACCT_KEY = `tv.paper.account.${local.email}`;
    const raw = localStorage.getItem(ACCT_KEY);
    const localAcct: PaperAccount | null = raw
      ? (JSON.parse(raw) as PaperAccount)
      : null;
    const next: PaperAccount = {
      cash: Number(accountRes.data.cash),
      holdings: (holdingsRes.data ?? []).map((r) => ({
        symbol: r.symbol,
        shares: r.shares,
        avgPrice: Number(r.avg_price),
      })),
      createdAt: localAcct?.createdAt ?? Date.now(),
    };
    localStorage.setItem(ACCT_KEY, JSON.stringify(next));
    out.accountChanged = true;
  }

  // 2. Orders — overwrite by id; preserve any local-only rows (just-placed
  //    on this tab whose insert hasn't acked yet).
  type OrderRow = {
    id: string;
    symbol: string;
    side: "buy" | "sell";
    kind: "market" | "limit" | "stop" | "stop-limit";
    qty: number;
    filled_qty: number;
    avg_fill_price: number;
    limit_price: number | null;
    stop_price: number | null;
    status: Order["status"];
    placed_at: string;
    last_updated: string;
    fills: unknown;
  };
  const ordersRes = await (supabase.from("orders") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: OrderRow[] | null; error: { message: string } | null }>;
    };
  })
    .select(
      "id, symbol, side, kind, qty, filled_qty, avg_fill_price, limit_price, stop_price, status, placed_at, last_updated, fills",
    )
    .eq("user_id", userId);

  if (!ordersRes.error && ordersRes.data) {
    const ORDERS_KEY = `tv.paper.orders.${local.email}`;
    const localOrders = listOrders(local.email);
    const localById = new Map(localOrders.map((o) => [o.id, o] as const));
    const cloudById = new Map<string, Order>();
    for (const row of ordersRes.data) {
      cloudById.set(row.id, {
        id: row.id,
        symbol: row.symbol,
        side: row.side,
        kind: row.kind,
        qty: row.qty,
        filledQty: row.filled_qty,
        avgFillPrice: Number(row.avg_fill_price),
        limitPrice: row.limit_price ?? undefined,
        stopPrice: row.stop_price ?? undefined,
        status: row.status,
        placedAt: new Date(row.placed_at).getTime(),
        lastUpdated: new Date(row.last_updated).getTime(),
        fills: Array.isArray(row.fills) ? (row.fills as Order["fills"]) : [],
      });
    }
    // Merge: cloud wins for shared ids, local-only ids stay (just placed,
    // mirror still in-flight). Count "changed" = ids whose status or
    // fills differ from local.
    const merged: Order[] = [];
    let changed = 0;
    const seen = new Set<string>();
    for (const [id, cloudO] of cloudById) {
      const localO = localById.get(id);
      if (
        !localO ||
        localO.status !== cloudO.status ||
        localO.filledQty !== cloudO.filledQty
      ) {
        changed++;
      }
      merged.push(cloudO);
      seen.add(id);
    }
    for (const localO of localOrders) {
      if (!seen.has(localO.id)) merged.push(localO);
    }
    localStorage.setItem(ORDERS_KEY, JSON.stringify(merged));
    out.ordersChanged = changed;
  }

  return out;
}
