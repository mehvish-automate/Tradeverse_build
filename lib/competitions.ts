"use client";

// Phase 45 / 45.5 / 45.5b — virtual trading competition mechanics
// layered on the trade-floor model from Phase 42. Each floor IS a
// competition with a window, capital, stock universe and asset classes.
//
// Phase 45.5b made paper accounts scope-aware end-to-end (localStorage
// + cloud), so every member's P&L can be real cross-device. The
// leaderboard now consults a per-floor competitor cache keyed by
// `tv.competitors.<floorId>` populated by pullCompetitorPnL(); when
// no cloud row exists for a member, we fall back to a deterministic
// demo seed so the rank is stable across reloads.

import { ensureAccount, portfolioValue } from "./paper";
import { price } from "./stocks";
import { TradeFloor, getMyTradeFloors } from "./tradeFloors";

export type CompetitionScheduleStatus = "upcoming" | "live" | "ended";

/** Time-based status (separate from the admin lifecycle status). */
export function competitionScheduleStatus(
  floor: TradeFloor,
  now = Date.now(),
): CompetitionScheduleStatus {
  if (now < floor.startAt) return "upcoming";
  if (now > floor.endAt) return "ended";
  return "live";
}

/** Format ms-epoch as a short "27 Apr · 14:30" tag. */
export function formatWhen(ms: number): string {
  const d = new Date(ms);
  const day = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

export type CompetitionRow = {
  email: string;
  displayName: string;
  startingCapital: number;
  totalValue: number;
  pnl: number;
  pnlPct: number;
  isYou: boolean;
};

type CompetitorCacheEntry = {
  cash: number;
  holdings: { symbol: string; shares: number; avgPrice: number }[];
};

const competitorsKey = (floorId: string) => `tv.competitors.${floorId}`;

/** Sync read of cached competitor cloud accounts for a floor. */
function readCompetitorCache(
  floorId: string,
): Record<string, CompetitorCacheEntry> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(competitorsKey(floorId)) || "{}") as Record<
      string,
      CompetitorCacheEntry
    >;
  } catch {
    return {};
  }
}

/** Compute mark-to-market value for a competitor cache entry. */
function valueFromCacheEntry(e: CompetitorCacheEntry): number {
  const now = new Date();
  let mv = 0;
  for (const h of e.holdings) {
    mv += h.shares * price(h.symbol, now);
  }
  return e.cash + mv;
}

/**
 * Live P&L leaderboard. Viewer reads their floor-scoped paper account
 * (Phase 45.5). Other members read from `tv.competitors.<floorId>`,
 * which the page populates via pullCompetitorPnL(). Members with no
 * cloud entry fall back to a deterministic demo seed so ranks stay
 * stable across reloads.
 */
export function competitionLeaderboard(
  floor: TradeFloor,
  viewerEmail: string,
): CompetitionRow[] {
  const cap = floor.virtualCapital;
  const cache = readCompetitorCache(floor.id);

  return floor.members
    .map((m) => {
      if (m.email === viewerEmail) {
        ensureAccount(m.email, floor.id, cap);
        const pv = portfolioValue(m.email, new Date(), floor.id);
        return {
          email: m.email,
          displayName: m.displayName,
          startingCapital: cap,
          totalValue: pv.total,
          pnl: pv.total - cap,
          pnlPct: ((pv.total - cap) / cap) * 100,
          isYou: true,
        };
      }
      const cloud = cache[m.email.toLowerCase()];
      if (cloud) {
        const total = valueFromCacheEntry(cloud);
        return {
          email: m.email,
          displayName: m.displayName,
          startingCapital: cap,
          totalValue: total,
          pnl: total - cap,
          pnlPct: ((total - cap) / cap) * 100,
          isYou: false,
        };
      }
      // Fallback: deterministic demo seed for members without cloud data
      // (haven't traded yet, or cloud sync isn't configured).
      let seed = 17;
      for (const c of floor.id + m.email) {
        seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
      }
      const pct = (seed % 4001) / 100 - 18;
      const pnl = Math.round((cap * pct) / 100);
      return {
        email: m.email,
        displayName: m.displayName,
        startingCapital: cap,
        totalValue: cap + pnl,
        pnl,
        pnlPct: pct,
        isYou: false,
      };
    })
    .sort((a, b) => b.pnl - a.pnl);
}

/**
 * Async pull: fetch competitor cloud accounts for this floor and cache
 * under tv.competitors.<floorId>. The page calls this on mount + on
 * every realtime tick on `paper_holdings` so other members' P&L moves
 * within seconds of any of them trading.
 */
export async function pullCompetitorPnL(
  floor: TradeFloor,
  viewerEmail: string,
): Promise<number> {
  if (typeof window === "undefined") return 0;
  const others = floor.members
    .filter((m) => m.email !== viewerEmail)
    .map((m) => m.email);
  if (others.length === 0) return 0;
  const { pullCompetitorAccounts } = await import("./supabase/paper-sync");
  const rows = await pullCompetitorAccounts(others, floor.id);
  const cache: Record<string, CompetitorCacheEntry> = {};
  for (const r of rows) {
    cache[r.email.toLowerCase()] = {
      cash: r.cash,
      holdings: r.holdings,
    };
  }
  localStorage.setItem(competitorsKey(floor.id), JSON.stringify(cache));
  return rows.length;
}

/**
 * Count of ended (window-closed) trade floors where I finished rank 1
 * by P&L. Used by the profile/history "wins" rollup.
 */
export function tradeFloorsWonCount(
  email: string,
  now = Date.now(),
): number {
  const ended = getMyTradeFloors(email).filter((f) => f.endAt < now);
  return ended.filter((f) => {
    const rows = competitionLeaderboard(f, email);
    return rows[0]?.email === email;
  }).length;
}

/** Pretty-print rupees as ₹1,23,456 (Indian grouping). */
export function formatRupees(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  // Indian numbering: last 3 digits, then groups of 2.
  const s = String(abs);
  if (s.length <= 3) return `${sign}₹${s}`;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${sign}₹${withCommas},${last3}`;
}
