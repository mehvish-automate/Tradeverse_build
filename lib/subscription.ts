"use client";

// Phase 64 — Premium subscription state (local). Granted by spending XP
// or redeeming a Premium coupon. Non-cash: Premium unlocks app perks, not
// anything purchasable with money here.

const KEY = (email: string) => `tv.premium.${email}`;

export function premiumUntil(email: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const v = JSON.parse(localStorage.getItem(KEY(email)) || "null") as { until: number } | null;
    return v?.until ?? null;
  } catch {
    return null;
  }
}

export function isPremium(email: string): boolean {
  const until = premiumUntil(email);
  return until != null && until > Date.now();
}

/** Extend Premium by `days` from the later of now / current expiry. */
export function grantPremium(email: string, days: number): number {
  const base = Math.max(Date.now(), premiumUntil(email) ?? 0);
  const until = base + days * 24 * 60 * 60 * 1000;
  localStorage.setItem(KEY(email), JSON.stringify({ until }));
  return until;
}
