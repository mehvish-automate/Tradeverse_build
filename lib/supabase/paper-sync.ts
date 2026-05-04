"use client";

// Phase 28 — mirror the paper-trading engine (account / holdings / orders)
// from localStorage into Supabase whenever the user has a live session.
//
// Phase 45.5b — every mirror is scope-aware. scopeId === GLOBAL_SCOPE is
// the user's default account; any other value (a trade-floor id) is a
// competition-scoped account. Cloud rows carry scope_id and the local
// keys mirror the same shape (see lib/paper.ts ACCT_KEY / ORDERS_KEY).

import { getBrowserSupabase } from "./client";
import { writeOrder } from "./writes";
import {
  GLOBAL_SCOPE,
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

const acctKey = (email: string, scope: string) =>
  scope === GLOBAL_SCOPE
    ? `tv.paper.account.${email}`
    : `tv.paper.account.${email}.${scope}`;
const ordersKey = (email: string, scope: string) =>
  scope === GLOBAL_SCOPE
    ? `tv.paper.orders.${email}`
    : `tv.paper.orders.${email}.${scope}`;

/** Upsert the paper_accounts row for this (user, scope). */
export async function syncPaperAccount(
  scopeId: string = GLOBAL_SCOPE,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const local = getCurrentUser();
  if (!local) return false;

  const acct = getAccount(local.email, scopeId);
  const row = {
    user_id: userId,
    scope_id: scopeId,
    cash: acct.cash,
  };
  const { error } = await (supabase.from("paper_accounts") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "user_id,scope_id" });
  return !error;
}

/**
 * Mirror holdings as a full reconciliation: upsert each row, then delete
 * any server rows for symbols the user no longer holds in this scope.
 */
export async function syncPaperHoldings(
  scopeId: string = GLOBAL_SCOPE,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const local = getCurrentUser();
  if (!local) return false;

  const acct = getAccount(local.email, scopeId);
  const symbols = acct.holdings.map((h) => h.symbol);

  if (acct.holdings.length > 0) {
    const rows = acct.holdings.map((h) => ({
      user_id: userId,
      scope_id: scopeId,
      symbol: h.symbol,
      shares: h.shares,
      avg_price: h.avgPrice,
    }));
    const { error: upErr } = await (supabase.from("paper_holdings") as unknown as {
      upsert: (
        rows: unknown,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>;
    }).upsert(rows, { onConflict: "user_id,scope_id,symbol" });
    if (upErr) return false;
  }

  // Drop any symbols the user no longer holds (within this scope).
  const del = supabase.from("paper_holdings") as unknown as {
    delete: () => {
      eq: (
        col: string,
        val: string,
      ) => {
        eq: (col: string, val: string) => {
          not: (
            col: string,
            op: string,
            vals: string[],
          ) => Promise<{ error: { message: string } | null }>;
        } & Promise<{ error: { message: string } | null }>;
      };
    };
  };
  const baseDel = del.delete().eq("user_id", userId).eq("scope_id", scopeId);
  if (symbols.length > 0) {
    const { error: delErr } = await baseDel.not("symbol", "in", symbols);
    if (delErr) return false;
  } else {
    const { error: delErr } = await baseDel;
    if (delErr) return false;
  }
  return true;
}

/** Mirror a single order row (called after place / process / cancel). */
export async function mirrorOrder(
  order: Order,
  scopeId: string = GLOBAL_SCOPE,
): Promise<boolean> {
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
    scopeId,
  });
}

/** Mirror account + holdings together — call after every fill / reset. */
export async function mirrorAccountState(
  scopeId: string = GLOBAL_SCOPE,
): Promise<boolean> {
  const a = await syncPaperAccount(scopeId);
  const h = await syncPaperHoldings(scopeId);
  return a && h;
}

/**
 * Pull the user's paper state down into localStorage on first auth so
 * a phone session shows up on desktop. Local wins when both have data
 * for the same key.
 */
export async function pullPaperState(
  scopeId: string = GLOBAL_SCOPE,
): Promise<{ account: boolean; holdings: number; orders: number }> {
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
      eq: (col: string, val: string) => {
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
    };
  })
    .select("cash")
    .eq("user_id", userId)
    .eq("scope_id", scopeId)
    .maybeSingle();

  type HoldingRow = { symbol: string; shares: number; avg_price: number };
  const holdingsRes = await (supabase.from("paper_holdings") as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{
          data: HoldingRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select("symbol, shares, avg_price")
    .eq("user_id", userId)
    .eq("scope_id", scopeId);

  if (accountRes.error || holdingsRes.error) return result;

  const ACCT_KEY = acctKey(local.email, scopeId);
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
      startingCash: localAcct?.startingCash,
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
      eq: (col: string, val: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{
          data: OrderRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select(
      "id, symbol, side, kind, qty, filled_qty, avg_fill_price, limit_price, stop_price, status, placed_at, last_updated, fills",
    )
    .eq("user_id", userId)
    .eq("scope_id", scopeId);

  if (!ordersRes.error && ordersRes.data) {
    const ORDERS_KEY = ordersKey(local.email, scopeId);
    const localOrders = listOrders(local.email, scopeId);
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
 * Phase 38 / 45.5b — realtime reconcile, scope-aware. Cloud is authoritative
 * for shared order ids and the account/holdings within the given scope.
 */
export async function reconcilePaperFromCloud(
  scopeId: string = GLOBAL_SCOPE,
): Promise<{ ordersChanged: number; accountChanged: boolean }> {
  const out = { ordersChanged: 0, accountChanged: false };
  const supabase = getBrowserSupabase();
  if (!supabase) return out;
  const userId = await authedUserId();
  if (!userId) return out;
  const local = getCurrentUser();
  if (!local) return out;

  type AccountRow = { cash: number };
  const accountRes = await (supabase.from("paper_accounts") as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
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
    };
  })
    .select("cash")
    .eq("user_id", userId)
    .eq("scope_id", scopeId)
    .maybeSingle();

  type HoldingRow = { symbol: string; shares: number; avg_price: number };
  const holdingsRes = await (supabase.from("paper_holdings") as unknown as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{
          data: HoldingRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select("symbol, shares, avg_price")
    .eq("user_id", userId)
    .eq("scope_id", scopeId);

  if (!accountRes.error && !holdingsRes.error && accountRes.data) {
    const ACCT_KEY = acctKey(local.email, scopeId);
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
      startingCash: localAcct?.startingCash,
    };
    localStorage.setItem(ACCT_KEY, JSON.stringify(next));
    out.accountChanged = true;
  }

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
      eq: (col: string, val: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{
          data: OrderRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select(
      "id, symbol, side, kind, qty, filled_qty, avg_fill_price, limit_price, stop_price, status, placed_at, last_updated, fills",
    )
    .eq("user_id", userId)
    .eq("scope_id", scopeId);

  if (!ordersRes.error && ordersRes.data) {
    const ORDERS_KEY = ordersKey(local.email, scopeId);
    const localOrders = listOrders(local.email, scopeId);
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

// --- Phase 45.5b — competitor cloud P&L for the floor leaderboard -------

export type CompetitorAccount = {
  email: string;
  cash: number;
  holdings: { symbol: string; shares: number; avgPrice: number }[];
};

/**
 * Fetch every member's scoped paper account + holdings for one floor.
 * Used by competitionLeaderboard's async pull so other members' P&L is
 * real (when they've traded with cloud sync on) instead of demo-seeded.
 *
 * Resolves member emails → user_ids via profiles, then ranges scope_id.
 */
export async function pullCompetitorAccounts(
  memberEmails: string[],
  scopeId: string,
): Promise<CompetitorAccount[]> {
  const supabase = getBrowserSupabase();
  if (!supabase) return [];
  if (!scopeId || scopeId === GLOBAL_SCOPE) return [];

  const emails = Array.from(
    new Set(memberEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)),
  );
  if (emails.length === 0) return [];

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
    .in("email", emails);
  if (profilesRes.error || !profilesRes.data) return [];
  const idToEmail = new Map<string, string>();
  for (const p of profilesRes.data) idToEmail.set(p.id, p.email);
  const userIds = profilesRes.data.map((p) => p.id);
  if (userIds.length === 0) return [];

  type AcctRow = { user_id: string; cash: number };
  const accountsRes = await (supabase.from("paper_accounts") as unknown as {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ data: AcctRow[] | null; error: { message: string } | null }>;
      };
    };
  })
    .select("user_id, cash")
    .in("user_id", userIds)
    .eq("scope_id", scopeId);
  if (accountsRes.error) return [];

  type HoldRow = {
    user_id: string;
    symbol: string;
    shares: number;
    avg_price: number;
  };
  const holdingsRes = await (supabase.from("paper_holdings") as unknown as {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ data: HoldRow[] | null; error: { message: string } | null }>;
      };
    };
  })
    .select("user_id, symbol, shares, avg_price")
    .in("user_id", userIds)
    .eq("scope_id", scopeId);
  if (holdingsRes.error) return [];

  const out: CompetitorAccount[] = [];
  for (const a of accountsRes.data ?? []) {
    const email = idToEmail.get(a.user_id);
    if (!email) continue;
    out.push({
      email,
      cash: Number(a.cash),
      holdings: (holdingsRes.data ?? [])
        .filter((h) => h.user_id === a.user_id)
        .map((h) => ({
          symbol: h.symbol,
          shares: h.shares,
          avgPrice: Number(h.avg_price),
        })),
    });
  }
  return out;
}
