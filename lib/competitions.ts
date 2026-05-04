"use client";

// Phase 45 / 45.5 — virtual trading competition mechanics layered on
// the trade-floor model from Phase 42. Each floor IS a competition:
// it has a window (startAt/endAt), a virtual capital allocation per
// player, a stock universe, and asset classes. The viewer's P&L
// reads their floor-scoped paper account; other members are still
// demo-seeded until per-floor cloud sync lands.

import { ensureAccount, portfolioValue } from "./paper";
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

/**
 * Live P&L leaderboard. Viewer reads their floor-scoped paper account
 * (seeded with floor.virtualCapital on first visit). Other members get
 * a deterministic demo P&L seeded by (floor.id, email) so ranks are
 * stable across reloads — until per-floor cloud sync lands and we can
 * pull their real scoped account.
 */
export function competitionLeaderboard(
  floor: TradeFloor,
  viewerEmail: string,
): CompetitionRow[] {
  const cap = floor.virtualCapital;
  return floor.members
    .map((m) => {
      if (m.email === viewerEmail) {
        // Make sure the scoped account exists with the right starting
        // capital. ensureAccount is a no-op when already present.
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
      // Demo P&L from a seed of (floor.id, email).
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
