"use client";

// Phase 62 — compliance layer for rewards.
//
// TradeVerse rewards stay inside a strict non-cash invariant set: XP,
// badges, and discount coupons for TradeVerse perks. NEVER cash, never a
// real-money prize, never tied to a market-prediction outcome, never a
// paid entry. This module is the single gate every reward passes through,
// plus the disclosure shown on reward surfaces and an audit log of grants.

export const ALLOWED_REWARD_TYPES = ["xp", "badge", "coupon"] as const;
export type RewardType = (typeof ALLOWED_REWARD_TYPES)[number];

export const COMPLIANCE_DISCLOSURE =
  "Rewards are non-cash skill rewards — XP, badges, and discount coupons for TradeVerse perks only. No real-money prizes, no entry fee, no purchase necessary. 18+. Outcomes depend on skill, not chance or market predictions.";

export function isAllowedRewardType(type: string): type is RewardType {
  return (ALLOWED_REWARD_TYPES as readonly string[]).includes(type);
}

export type GrantLogEntry = {
  id: string;
  rewardLabel: string;
  type: RewardType;
  context: string; // e.g. quiz name
  ts: number;
};

const GRANT_KEY = (email: string) => `tv.rewardgrants.${email}`;

export function grantLog(email: string): GrantLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(GRANT_KEY(email)) || "[]") as GrantLogEntry[];
  } catch {
    return [];
  }
}

export function logGrant(email: string, entry: Omit<GrantLogEntry, "id" | "ts">): void {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  const rows = grantLog(email);
  rows.unshift({ ...entry, id, ts: Date.now() });
  localStorage.setItem(GRANT_KEY(email), JSON.stringify(rows.slice(0, 200)));
}

/** Has this user already been granted a reward for this context (idempotency)? */
export function hasGrantFor(email: string, context: string): boolean {
  return grantLog(email).some((g) => g.context === context);
}
