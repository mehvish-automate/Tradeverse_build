"use client";

// Phase 69 — daily spin-the-wheel. One free spin a day (earn extra spins
// from bonus segments / referrals). Prizes stay inside the non-cash
// invariant set: XP, streak freezes, perk coupons. No cash, ever.

import { grantCoupon } from "./coupons";
import { dailyKey } from "./quizModes";
import { awardXp } from "./progress";
import { awardStreakFreeze } from "./rewards";

export type WheelPrize =
  | { kind: "xp"; xp: number; label: string }
  | { kind: "freeze"; label: string }
  | { kind: "coupon"; couponId: string; label: string }
  | { kind: "bonus"; label: string }
  | { kind: "nothing"; label: string };

export type WheelSegment = { prize: WheelPrize; weight: number; color: string };

// 8 segments arranged clockwise from the top pointer.
export const WHEEL: WheelSegment[] = [
  { prize: { kind: "xp", xp: 50, label: "50 XP" }, weight: 26, color: "#10b981" },
  { prize: { kind: "nothing", label: "Try again" }, weight: 16, color: "#1f2937" },
  { prize: { kind: "xp", xp: 100, label: "100 XP" }, weight: 18, color: "#0ea5e9" },
  { prize: { kind: "freeze", label: "Streak freeze" }, weight: 10, color: "#6366f1" },
  { prize: { kind: "xp", xp: 50, label: "50 XP" }, weight: 26, color: "#10b981" },
  { prize: { kind: "bonus", label: "Bonus spin" }, weight: 8, color: "#f59e0b" },
  { prize: { kind: "xp", xp: 250, label: "250 XP" }, weight: 6, color: "#0ea5e9" },
  { prize: { kind: "coupon", couponId: "merch10", label: "10% merch" }, weight: 4, color: "#a855f7" },
];

type WheelState = { lastSpinKey: string; extraSpins: number };
const KEY = (email: string) => `tv.wheel.${email}`;

function read(email: string): WheelState {
  if (typeof window === "undefined") return { lastSpinKey: "", extraSpins: 0 };
  try {
    return JSON.parse(localStorage.getItem(KEY(email)) || "null") as WheelState ?? {
      lastSpinKey: "",
      extraSpins: 0,
    };
  } catch {
    return { lastSpinKey: "", extraSpins: 0 };
  }
}
function write(email: string, s: WheelState) {
  localStorage.setItem(KEY(email), JSON.stringify(s));
}

export function wheelStatus(email: string): { canSpin: boolean; freeToday: boolean; extraSpins: number } {
  const s = read(email);
  const freeToday = s.lastSpinKey !== dailyKey();
  return { canSpin: freeToday || s.extraSpins > 0, freeToday, extraSpins: s.extraSpins };
}

/** Award a bonus spin (e.g. from a referral) — adds to the extra-spin pool. */
export function grantBonusSpin(email: string, n = 1): void {
  const s = read(email);
  write(email, { ...s, extraSpins: s.extraSpins + n });
}

function pickIndex(): number {
  const total = WHEEL.reduce((sum, s) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < WHEEL.length; i++) {
    r -= WHEEL[i].weight;
    if (r <= 0) return i;
  }
  return WHEEL.length - 1;
}

/**
 * Spin (consuming the daily free spin or an extra one), apply the prize,
 * and return the landed segment index. Returns null if there's no spin
 * available.
 */
export function spin(email: string): { index: number; prize: WheelPrize } | null {
  const status = wheelStatus(email);
  if (!status.canSpin) return null;

  const s = read(email);
  if (status.freeToday) {
    write(email, { lastSpinKey: dailyKey(), extraSpins: s.extraSpins });
  } else {
    write(email, { ...s, extraSpins: Math.max(0, s.extraSpins - 1) });
  }

  const index = pickIndex();
  const prize = WHEEL[index].prize;

  if (prize.kind === "xp") awardXp(email, prize.xp);
  else if (prize.kind === "freeze") awardStreakFreeze(email, 1);
  else if (prize.kind === "coupon") grantCoupon(email, prize.couponId, "spin wheel");
  else if (prize.kind === "bonus") grantBonusSpin(email, 1);

  return { index, prize };
}
