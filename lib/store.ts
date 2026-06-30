"use client";

// Phase 64 — TradeVerse store. XP-priced merch + Premium tiers, payable
// with XP and discounted by perk coupons from the wallet. Real fulfilment
// / payment is seam'd (an order is recorded; a provider wires in later).

import { consumeCouponForPerk, spendXp } from "./coupons";
import { grantPremium } from "./subscription";

export type StoreItem = {
  id: string;
  label: string;
  xpCost: number;
  perk: "merch" | "premium";
  days?: number; // for premium tiers
  emoji: string;
};

export const MERCH: StoreItem[] = [
  { id: "sticker-pack", label: "Sticker pack", xpCost: 300, perk: "merch", emoji: "🩹" },
  { id: "tee", label: "TradeVerse tee", xpCost: 1500, perk: "merch", emoji: "👕" },
  { id: "hoodie", label: "TradeVerse hoodie", xpCost: 3000, perk: "merch", emoji: "🧥" },
  { id: "mug", label: "Chart-pattern mug", xpCost: 800, perk: "merch", emoji: "☕" },
];

export const PREMIUM_TIERS: StoreItem[] = [
  { id: "premium-month", label: "Premium · 1 month", xpCost: 1200, perk: "premium", days: 30, emoji: "✨" },
  { id: "premium-year", label: "Premium · 1 year", xpCost: 10000, perk: "premium", days: 365, emoji: "🌟" },
];

export function storeItem(id: string): StoreItem | undefined {
  return [...MERCH, ...PREMIUM_TIERS].find((i) => i.id === id);
}

export type Order = {
  id: string;
  itemId: string;
  label: string;
  xpPaid: number;
  couponApplied?: string;
  createdAt: number;
};

const ORDERS_KEY = (email: string) => `tv.orders.${email}`;

export function orders(email: string): Order[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY(email)) || "[]") as Order[];
  } catch {
    return [];
  }
}

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}

/** Effective XP cost after the best matching unused coupon (preview only). */
export function previewCost(email: string, item: StoreItem, discountPct: number): number {
  void email;
  return Math.max(0, Math.round(item.xpCost * (1 - discountPct / 100)));
}

export function purchase(
  email: string,
  itemId: string,
): { ok: true; order: Order } | { ok: false; error: string } {
  const item = storeItem(itemId);
  if (!item) return { ok: false, error: "Unknown item." };

  // Apply one matching coupon as a discount (consumes it).
  const coupon = consumeCouponForPerk(email, item.perk);
  const cost = coupon
    ? Math.max(0, Math.round(item.xpCost * (1 - coupon.discountPct / 100)))
    : item.xpCost;

  if (!spendXp(email, cost)) {
    return { ok: false, error: "Not enough XP for this." };
  }

  if (item.perk === "premium" && item.days) {
    grantPremium(email, item.days);
  }

  const order: Order = {
    id: uuid(),
    itemId: item.id,
    label: item.label,
    xpPaid: cost,
    couponApplied: coupon?.label,
    createdAt: Date.now(),
  };
  const all = orders(email);
  localStorage.setItem(ORDERS_KEY(email), JSON.stringify([order, ...all]));
  return { ok: true, order };
}
