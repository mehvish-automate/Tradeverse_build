"use client";

// Phase 60 — coupon wallet. Spend XP on non-cash discount coupons; see
// coupons earned from quiz rewards. All rewards are non-cash (compliance).

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { COMPLIANCE_DISCLOSURE, GrantLogEntry, grantLog } from "@/lib/compliance";
import { COUPON_CATALOG, Coupon, availableXp, redeemXpForCoupon, wallet } from "@/lib/coupons";
import { useSession } from "@/lib/session";

export default function WalletPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-10">
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
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [grants, setGrants] = useState<GrantLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user) return;
    setXp(availableXp(user.email));
    setCoupons(wallet(user.email).coupons);
    setGrants(grantLog(user.email));
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) return null;

  function redeem(defId: string) {
    setError(null);
    const r = redeemXpForCoupon(user!.email, defId);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    refresh();
  }

  return (
    <>
      <h1 className="text-3xl font-semibold">Wallet</h1>
      <p className="mt-1 text-sm text-ink-400">
        Spend XP on perks, and keep the coupons you win in quizzes.
      </p>

      <div className="mt-6 rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5">
        <div className="text-xs uppercase tracking-wider text-brand-300">Spendable XP</div>
        <div className="mt-1 text-3xl font-semibold">{xp.toLocaleString()}</div>
      </div>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-ink-400">
        Redeem
      </h2>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COUPON_CATALOG.map((c) => {
          const affordable = xp >= c.xpCost;
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-900/40 p-4"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink-50">{c.label}</div>
                <div className="text-xs text-ink-500">{c.xpCost} XP</div>
              </div>
              <button
                onClick={() => redeem(c.id)}
                disabled={!affordable}
                className="shrink-0 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300 disabled:opacity-40"
              >
                {affordable ? "Redeem" : "Need more XP"}
              </button>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-ink-400">
        Your coupons
      </h2>
      {coupons.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">
          No coupons yet. Redeem XP above or place top in a quiz with prizes.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
          {coupons.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink-50">{c.label}</div>
                <div className="text-xs text-ink-500">
                  from {c.source} · {new Date(c.createdAt).toLocaleDateString()}
                </div>
              </div>
              <code className="shrink-0 rounded-md border border-ink-700 bg-ink-950 px-2 py-1 font-mono text-xs tracking-widest text-brand-300">
                {c.code}
              </code>
            </li>
          ))}
        </ul>
      )}

      {grants.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-ink-400">
            Reward history
          </h2>
          <ul className="mt-3 space-y-1 text-xs text-ink-500">
            {grants.slice(0, 20).map((g) => (
              <li key={g.id}>
                {g.rewardLabel} · {g.context.replace("quiz:", "quiz ")} ·{" "}
                {new Date(g.ts).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="mt-8 rounded-md border border-ink-800 bg-ink-950 px-3 py-2 text-[11px] text-ink-500">
        {COMPLIANCE_DISCLOSURE}
      </p>

      <div className="mt-6">
        <Link href="/profile" className="btn-ghost">
          Back to profile
        </Link>
      </div>
    </>
  );
}
