"use client";

// Phase 60 — coupon wallet + XP→discount redemption.
//
// Coupons are non-cash discount vouchers for TradeVerse perks (merch,
// premium). Users redeem XP for catalog coupons, or receive them as quiz
// rewards. Spent XP is tracked here (progress.totalXp is append-only), so
// the spendable balance = totalXp − redeemed.

import { getProgress } from "./progress";

export type CouponDef = {
  id: string;
  label: string;
  discountPct: number;
  xpCost: number;
  perk: string; // what it applies to
};

export const COUPON_CATALOG: CouponDef[] = [
  { id: "merch10", label: "10% off TradeVerse merch", discountPct: 10, xpCost: 200, perk: "merch" },
  { id: "merch25", label: "25% off TradeVerse merch", discountPct: 25, xpCost: 600, perk: "merch" },
  { id: "premium1m", label: "1 month Premium, 50% off", discountPct: 50, xpCost: 800, perk: "premium" },
  { id: "premium100", label: "1 month Premium, free", discountPct: 100, xpCost: 1500, perk: "premium" },
];

export function couponDef(id: string): CouponDef | undefined {
  return COUPON_CATALOG.find((c) => c.id === id);
}

export type Coupon = {
  id: string; // unique grant id
  defId: string;
  code: string;
  label: string;
  discountPct: number;
  perk: string;
  source: string; // "redeem" | quiz name
  createdAt: number;
  used: boolean;
};

type Wallet = { coupons: Coupon[]; redeemedXp: number };

const KEY = (email: string) => `tv.wallet.${email}`;

function read(email: string): Wallet {
  if (typeof window === "undefined") return { coupons: [], redeemedXp: 0 };
  try {
    return JSON.parse(localStorage.getItem(KEY(email)) || "null") as Wallet ?? {
      coupons: [],
      redeemedXp: 0,
    };
  } catch {
    return { coupons: [], redeemedXp: 0 };
  }
}

function write(email: string, w: Wallet) {
  localStorage.setItem(KEY(email), JSON.stringify(w));
}

function genCode(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export function wallet(email: string): Wallet {
  return read(email);
}

/** Spendable XP = lifetime XP minus what's already been redeemed. */
export function availableXp(email: string): number {
  return Math.max(0, getProgress(email).totalXp - read(email).redeemedXp);
}

function makeCoupon(def: CouponDef, source: string): Coupon {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2),
    defId: def.id,
    code: genCode(),
    label: def.label,
    discountPct: def.discountPct,
    perk: def.perk,
    source,
    createdAt: Date.now(),
    used: false,
  };
}

export function redeemXpForCoupon(
  email: string,
  defId: string,
): { ok: true; coupon: Coupon } | { ok: false; error: string } {
  const def = couponDef(defId);
  if (!def) return { ok: false, error: "Unknown coupon." };
  if (availableXp(email) < def.xpCost) {
    return { ok: false, error: "Not enough XP yet." };
  }
  const w = read(email);
  const coupon = makeCoupon(def, "redeem");
  write(email, { coupons: [coupon, ...w.coupons], redeemedXp: w.redeemedXp + def.xpCost });
  void mirror(coupon, email);
  return { ok: true, coupon };
}

/** Grant a coupon for free (e.g. a quiz reward). Does not spend XP. */
export function grantCoupon(email: string, defId: string, source: string): Coupon | null {
  const def = couponDef(defId);
  if (!def) return null;
  const w = read(email);
  const coupon = makeCoupon(def, source);
  write(email, { coupons: [coupon, ...w.coupons], redeemedXp: w.redeemedXp });
  void mirror(coupon, email);
  return coupon;
}

async function mirror(coupon: Coupon, email: string) {
  try {
    const { mirrorCoupon } = await import("./supabase/coupons-sync");
    await mirrorCoupon(coupon, email);
  } catch {
    /* best-effort */
  }
}
