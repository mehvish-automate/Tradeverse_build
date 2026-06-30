"use client";

// Phase 59 — reward config / prize pool for quizzes.
//
// An organizer attaches reward tiers (top 3 / 5 / 10) to a quiz. Each
// tier maps a rank range to one non-cash reward (XP or a discount
// coupon). Distribution happens when the quiz ends (Phase 61). All
// rewards pass the compliance gate — no cash, ever.

import { RewardType, isAllowedRewardType } from "./compliance";

export type Reward =
  | { type: "xp"; xp: number; label: string }
  | { type: "coupon"; couponId: string; label: string };

export type RewardTier = { rankFrom: number; rankTo: number; reward: Reward };

export type RewardTemplate = { id: string; label: string; blurb: string; tiers: RewardTier[] };

export const REWARD_TEMPLATES: RewardTemplate[] = [
  { id: "none", label: "No rewards", blurb: "Bragging rights only.", tiers: [] },
  {
    id: "top3",
    label: "Top 3 — XP",
    blurb: "500 / 300 / 300 XP to the top three.",
    tiers: [
      { rankFrom: 1, rankTo: 1, reward: { type: "xp", xp: 500, label: "500 XP" } },
      { rankFrom: 2, rankTo: 3, reward: { type: "xp", xp: 300, label: "300 XP" } },
    ],
  },
  {
    id: "top5",
    label: "Top 5 — XP + coupon",
    blurb: "Winner gets a 25% merch coupon; 2–5 get XP.",
    tiers: [
      { rankFrom: 1, rankTo: 1, reward: { type: "coupon", couponId: "merch25", label: "25% off merch" } },
      { rankFrom: 2, rankTo: 3, reward: { type: "xp", xp: 300, label: "300 XP" } },
      { rankFrom: 4, rankTo: 5, reward: { type: "xp", xp: 150, label: "150 XP" } },
    ],
  },
  {
    id: "top10",
    label: "Top 10 — tiered",
    blurb: "Premium coupon to #1, XP down to #10.",
    tiers: [
      { rankFrom: 1, rankTo: 1, reward: { type: "coupon", couponId: "premium1m", label: "50% off Premium" } },
      { rankFrom: 2, rankTo: 3, reward: { type: "xp", xp: 400, label: "400 XP" } },
      { rankFrom: 4, rankTo: 10, reward: { type: "xp", xp: 150, label: "150 XP" } },
    ],
  },
];

export function templateById(id: string): RewardTemplate | undefined {
  return REWARD_TEMPLATES.find((t) => t.id === id);
}

/** The reward a given final rank earns, or null. */
export function rewardForRank(tiers: RewardTier[], rank: number): Reward | null {
  if (rank < 1) return null;
  return tiers.find((t) => rank >= t.rankFrom && rank <= t.rankTo)?.reward ?? null;
}

/** Compliance gate — reject anything outside the allowed non-cash set. */
export function validateTiers(tiers: RewardTier[]): string | null {
  for (const t of tiers) {
    if (!isAllowedRewardType(t.reward.type as RewardType)) {
      return "Only XP and coupon rewards are allowed — no cash prizes.";
    }
    if (t.rankTo < t.rankFrom) return "A reward tier has an invalid rank range.";
  }
  return null;
}

export function tiersSummary(tiers: RewardTier[]): string {
  if (tiers.length === 0) return "No rewards";
  return tiers
    .map((t) =>
      t.rankFrom === t.rankTo
        ? `#${t.rankFrom}: ${t.reward.label}`
        : `#${t.rankFrom}–${t.rankTo}: ${t.reward.label}`,
    )
    .join(" · ");
}
