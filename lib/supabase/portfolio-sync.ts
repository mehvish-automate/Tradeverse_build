"use client";

// Phase 29 — mirror strategy portfolios from localStorage into Supabase
// whenever the user has a live session. Additive: reads still come from
// localStorage. Cloud rows survive across devices and seed future
// server-side analytics (leaderboards, alpha vs benchmark, etc).

import { getBrowserSupabase } from "./client";
import {
  type StrategyPortfolio,
  type Holding,
  type UniverseFilter,
} from "../portfolios";
import { getCurrentUser } from "../session";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Upsert one portfolio + its holdings as a full reconciliation. Holdings
 * not present in `p.holdings` are deleted server-side so the cloud row
 * matches localStorage exactly.
 */
export async function mirrorPortfolio(p: StrategyPortfolio): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const portfolioRow = {
    id: p.id,
    user_id: userId,
    name: p.name,
    description: p.description ?? null,
    base_date: p.baseDate,
    initial_capital: p.initialCapital,
    universe: p.universe ?? null,
  };
  const { error: pErr } = await (supabase.from("portfolios") as unknown as {
    upsert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).upsert(portfolioRow);
  if (pErr) return false;

  const symbols = p.holdings.map((h) => h.symbol);
  if (p.holdings.length > 0) {
    const rows = p.holdings.map((h) => ({
      portfolio_id: p.id,
      symbol: h.symbol,
      pct: h.pct,
    }));
    const { error: hErr } = await (
      supabase.from("portfolio_holdings") as unknown as {
        upsert: (
          rows: unknown,
          opts: { onConflict: string },
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).upsert(rows, { onConflict: "portfolio_id,symbol" });
    if (hErr) return false;
  }

  const del = supabase.from("portfolio_holdings") as unknown as {
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
    const { error: dErr } = await del
      .delete()
      .eq("portfolio_id", p.id)
      .not("symbol", "in", symbols);
    if (dErr) return false;
  } else {
    const { error: dErr } = await del.delete().eq("portfolio_id", p.id);
    if (dErr) return false;
  }
  return true;
}

/** Delete a portfolio (cascade drops holdings via FK). */
export async function deletePortfolioCloud(id: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const { error } = await (supabase.from("portfolios") as unknown as {
    delete: () => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .delete()
    .eq("id", id);
  return !error;
}

/**
 * Pull cloud portfolios down into localStorage on auth boot. Local rows
 * win on id collision so an in-progress edit isn't clobbered.
 */
export async function pullPortfolios(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  type PortfolioRow = {
    id: string;
    name: string;
    description: string | null;
    base_date: string;
    initial_capital: number;
    universe: UniverseFilter | null;
    created_at: string;
  };
  const portfoliosRes = await (supabase.from("portfolios") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{
        data: PortfolioRow[] | null;
        error: { message: string } | null;
      }>;
    };
  })
    .select("id, name, description, base_date, initial_capital, universe, created_at")
    .eq("user_id", userId);
  if (portfoliosRes.error || !portfoliosRes.data) return 0;

  type HoldingRow = { portfolio_id: string; symbol: string; pct: number };
  const ids = portfoliosRes.data.map((r) => r.id);
  let holdingsByPortfolio = new Map<string, Holding[]>();
  if (ids.length > 0) {
    const holdingsRes = await (supabase.from("portfolio_holdings") as unknown as {
      select: (cols: string) => {
        in: (
          col: string,
          vals: string[],
        ) => Promise<{
          data: HoldingRow[] | null;
          error: { message: string } | null;
        }>;
      };
    })
      .select("portfolio_id, symbol, pct")
      .in("portfolio_id", ids);
    if (!holdingsRes.error && holdingsRes.data) {
      holdingsByPortfolio = holdingsRes.data.reduce((m, r) => {
        const arr = m.get(r.portfolio_id) ?? [];
        arr.push({ symbol: r.symbol, pct: Number(r.pct) });
        m.set(r.portfolio_id, arr);
        return m;
      }, new Map<string, Holding[]>());
    }
  }

  const KEY = `tv.portfolios.${local.email}`;
  const raw = localStorage.getItem(KEY);
  const localList: StrategyPortfolio[] = raw ? JSON.parse(raw) : [];
  const haveIds = new Set(localList.map((p) => p.id));

  let added = 0;
  for (const row of portfoliosRes.data) {
    if (haveIds.has(row.id)) continue;
    localList.push({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      createdAt: new Date(row.created_at).getTime(),
      baseDate: row.base_date,
      initialCapital: Number(row.initial_capital),
      holdings: holdingsByPortfolio.get(row.id) ?? [],
      universe: row.universe ?? undefined,
    });
    added++;
  }
  if (added > 0) {
    localStorage.setItem(KEY, JSON.stringify(localList));
  }
  return added;
}
