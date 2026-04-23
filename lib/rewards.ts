"use client";

// Variable-ratio rewards layered on top of the deterministic base XP.
// Following the Hook model: Tribe (rival), Hunt (mystery multiplier),
// Self (streak freeze when you miss a day). All rewards stay in the
// allowed invariant set: XP, badges, trade floor position, streak freezes.
// Never cash. Never prediction-outcome tied.

import { currentWeekStart, getMyTradeFloors, weeklyLeaderboard } from "./tradeFloors";

const FREEZE_KEY = (email: string) => `tv.streakfreezes.${email}`;
const REWARD_LOG_KEY = (email: string) => `tv.rewardlog.${email}`;

export type RivalEvent =
  | { kind: "passed"; rival: string; tradeFloor: string }
  | { kind: "about-to-be-passed"; rival: string; tradeFloor: string; gap: number }
  | { kind: "lead"; tradeFloor: string; rank: number; total: number };

export type MysteryReward = {
  label: string;
  multiplier: number; // >= 1
  description: string;
};

/**
 * Pick a mystery multiplier with a variable-ratio schedule.
 *
 * Seeded by the user + the daily challenge date so rolling the page
 * doesn't reroll the reward — but the user still gets a "what will it
 * be today?" moment.
 */
export function rollMysteryReward(email: string, dateKey: string): MysteryReward {
  const seed = hash(`${email}|${dateKey}`);
  const r = seed % 100;
  if (r < 60) {
    return {
      label: "1.0×",
      multiplier: 1,
      description: "Standard payout — your base XP stands.",
    };
  }
  if (r < 85) {
    return {
      label: "1.25× XP",
      multiplier: 1.25,
      description: "Small boost. Welcome to the streak.",
    };
  }
  if (r < 97) {
    return {
      label: "1.5× XP",
      multiplier: 1.5,
      description: "Nice one — bigger pot than usual today.",
    };
  }
  return {
    label: "2× XP",
    multiplier: 2,
    description: "Jackpot. The streak gods smile.",
  };
}

/**
 * Find the most narrative-worthy rival event across the player's
 * trade floors, for showing on the results screen.
 *
 * - "passed": you overtook someone this week
 * - "about-to-be-passed": someone is ≤ 200 XP behind you
 * - "lead": you're #1 in at least one trade floor
 *
 * Falls back to null when the player is in no trade floors.
 */
export function computeRivalEvent(
  email: string,
  displayName: string,
): RivalEvent | null {
  const mine = getMyTradeFloors(email);
  if (mine.length === 0) return null;

  let best: RivalEvent | null = null;
  let bestScore = -Infinity;

  for (const tradeFloor of mine) {
    const rows = weeklyLeaderboard(tradeFloor, email);
    const myIdx = rows.findIndex((r) => r.isYou);
    if (myIdx < 0) continue;

    // #1 is a nice "lead" moment.
    if (myIdx === 0) {
      const candidate: RivalEvent = {
        kind: "lead",
        tradeFloor: tradeFloor.name,
        rank: 1,
        total: rows.length,
      };
      if (2 > bestScore) {
        best = candidate;
        bestScore = 2;
      }
      continue;
    }

    // Just passed someone (you > them, you are right above them).
    const below = rows[myIdx + 1];
    if (below) {
      const candidate: RivalEvent = {
        kind: "passed",
        rival: below.displayName,
        tradeFloor: tradeFloor.name,
      };
      const score = 3; // richest narrative; pick this when possible
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    // Someone is breathing down your neck.
    const above = rows[myIdx - 1];
    if (above) {
      const gap = above.xp - rows[myIdx].xp;
      if (gap > 0 && gap <= 250) {
        const candidate: RivalEvent = {
          kind: "about-to-be-passed",
          rival: above.displayName,
          tradeFloor: tradeFloor.name,
          gap,
        };
        const score = 2.5;
        if (score > bestScore) {
          best = candidate;
          bestScore = score;
        }
      }
    }
  }
  // Silence unused parameter warnings in TS by referencing it.
  void displayName;
  return best;
}

// --- Streak freeze tokens ---

export function getStreakFreezes(email: string): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(FREEZE_KEY(email)) || "0") || 0;
}

export function awardStreakFreeze(email: string, n = 1) {
  const cur = getStreakFreezes(email);
  localStorage.setItem(FREEZE_KEY(email), String(cur + n));
}

export function consumeStreakFreeze(email: string): boolean {
  const cur = getStreakFreezes(email);
  if (cur <= 0) return false;
  localStorage.setItem(FREEZE_KEY(email), String(cur - 1));
  return true;
}

// --- Reward log (small audit trail, also drives "earned a freeze" toast) ---

export type RewardEvent = {
  ts: number;
  kind: "mystery" | "freeze" | "streak-milestone";
  detail: string;
};

export function logReward(email: string, ev: Omit<RewardEvent, "ts">) {
  const raw = localStorage.getItem(REWARD_LOG_KEY(email));
  const arr: RewardEvent[] = raw ? JSON.parse(raw) : [];
  arr.push({ ...ev, ts: Date.now() });
  localStorage.setItem(REWARD_LOG_KEY(email), JSON.stringify(arr.slice(-50)));
}

export function rewardLog(email: string): RewardEvent[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(REWARD_LOG_KEY(email));
  return raw ? (JSON.parse(raw) as RewardEvent[]) : [];
}

// --- Helpers ---

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

export function weekKey(now = new Date()): string {
  return currentWeekStart(now);
}
