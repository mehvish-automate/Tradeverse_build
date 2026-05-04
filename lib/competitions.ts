"use client";

// Phase 45 — virtual trading competition mechanics layered on top of
// the trade-floor model from Phase 42. Each floor IS a competition:
// it has a window (startAt/endAt), a virtual capital allocation per
// player, a stock universe, and asset classes. This module computes
// the live P&L leaderboard during the window.
//
// V0.1 caveat: per-floor scoped paper accounts aren't built yet. The
// viewer's P&L is read from their global tv.paper.account.<email> via
// portfolioValue(). Other members' P&L is deterministic demo data
// seeded by (floor.id, email) until per-floor accounts land in 45.5.

import { portfolioValue } from "./paper";
import type { TradeFloor } from "./tradeFloors";

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
 * Live P&L leaderboard. Viewer reads their actual paper account;
 * others get a deterministic demo P&L seeded by (floor.id, email)
 * so ranks are stable across reloads.
 */
export function competitionLeaderboard(
  floor: TradeFloor,
  viewerEmail: string,
): CompetitionRow[] {
  const cap = floor.virtualCapital;
  return floor.members
    .map((m) => {
      if (m.email === viewerEmail) {
        const pv = portfolioValue(m.email);
        // V0.1: pv.total is the user's whole paper portfolio, not floor-
        // scoped. Treat that as their "competition value" for now.
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
      // ±20% range, biased lightly positive
      const pct = (seed % 4001) / 100 - 18; // -18% to +22%
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
