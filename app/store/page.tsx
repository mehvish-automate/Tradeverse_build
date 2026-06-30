"use client";

// Phase 64 — TradeVerse store. Spend XP on merch + Premium; perk coupons
// from the wallet auto-discount. Real fulfilment/payment is seam'd.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { availableXp, wallet } from "@/lib/coupons";
import { MERCH, Order, PREMIUM_TIERS, StoreItem, orders, purchase } from "@/lib/store";
import { isPremium, premiumUntil } from "@/lib/subscription";
import { useSession } from "@/lib/session";

export default function StorePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const [xp, setXp] = useState(0);
  const [premiumTill, setPremiumTill] = useState<number | null>(null);
  const [premium, setPremium] = useState(false);
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [couponPerks, setCouponPerks] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user) return;
    setXp(availableXp(user.email));
    setPremiumTill(premiumUntil(user.email));
    setPremium(isPremium(user.email));
    setOrderList(orders(user.email));
    setCouponPerks(
      new Set(wallet(user.email).coupons.filter((c) => !c.used).map((c) => c.perk)),
    );
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) return null;

  function buy(item: StoreItem) {
    const r = purchase(user!.email, item.id);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    setMsg(
      `Got it — ${r.order.label}${r.order.couponApplied ? ` (coupon: ${r.order.couponApplied})` : ""}. Paid ${r.order.xpPaid} XP.`,
    );
    refresh();
  }

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Store
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Spend your XP</h1>
          <p className="mt-2 text-sm text-ink-400">
            Merch and Premium, paid in XP. Wallet coupons auto-apply.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-brand-500/40 bg-brand-500/5 p-4 text-right">
          <div className="text-xs text-ink-500">Spendable XP</div>
          <div className="text-2xl font-semibold">{xp.toLocaleString()}</div>
        </div>
      </div>

      {premium && premiumTill && (
        <div className="mb-6 rounded-xl border border-brand-500/40 bg-brand-500/5 px-4 py-3 text-sm text-brand-200">
          ✨ Premium active until {new Date(premiumTill).toLocaleDateString()}
        </div>
      )}
      {msg && (
        <p className="mb-6 rounded-md border border-ink-700 bg-ink-900/40 px-3 py-2 text-sm text-ink-200">
          {msg}
        </p>
      )}

      <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">Premium</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PREMIUM_TIERS.map((i) => (
          <ItemCard key={i.id} item={i} xp={xp} hasCoupon={couponPerks.has(i.perk)} onBuy={() => buy(i)} />
        ))}
      </div>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-ink-400">Merch</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MERCH.map((i) => (
          <ItemCard key={i.id} item={i} xp={xp} hasCoupon={couponPerks.has(i.perk)} onBuy={() => buy(i)} />
        ))}
      </div>

      {orderList.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-ink-400">Orders</h2>
          <ul className="mt-3 divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
            {orderList.map((o) => (
              <li key={o.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="text-ink-100">{o.label}</span>
                <span className="text-xs text-ink-500">
                  {o.xpPaid} XP · {new Date(o.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-8 text-xs text-ink-500">
        Physical merch fulfilment and any real-money checkout are handled by a
        provider that wires in later — orders here are recorded against your XP.
      </p>
      <div className="mt-4 flex gap-3">
        <Link href="/wallet" className="btn-ghost">
          Wallet
        </Link>
        <Link href="/profile" className="btn-ghost">
          Profile
        </Link>
      </div>
    </>
  );
}

function ItemCard({
  item,
  xp,
  hasCoupon,
  onBuy,
}: {
  item: StoreItem;
  xp: number;
  hasCoupon: boolean;
  onBuy: () => void;
}) {
  const affordable = xp >= item.xpCost; // worst case (coupon only lowers it)
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-900/40 p-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink-50">
          {item.emoji} {item.label}
        </div>
        <div className="text-xs text-ink-500">
          {item.xpCost.toLocaleString()} XP
          {hasCoupon && <span className="ml-1 text-brand-300">· coupon applies</span>}
        </div>
      </div>
      <button
        onClick={onBuy}
        disabled={!affordable && !hasCoupon}
        className="shrink-0 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300 disabled:opacity-40"
      >
        {affordable || hasCoupon ? "Get" : "Need XP"}
      </button>
    </div>
  );
}
