"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Order, listOrders, resetAccount } from "@/lib/paper";
import { useSession } from "@/lib/session";

export default function OrderHistoryPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    setOrders(listOrders(user.email));
  }, [user, tick]);

  if (!user) return null;

  function reset() {
    if (!confirm("Reset paper account and clear all orders?")) return;
    resetAccount(user!.email);
    setTick((t) => t + 1);
  }

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/trade" className="text-xs text-ink-400 hover:text-ink-100">
            ← Trade ticket
          </Link>
          <h1 className="mt-1 text-3xl font-semibold">Order history</h1>
          <p className="mt-1 text-sm text-ink-400">
            {orders.length} order{orders.length === 1 ? "" : "s"} placed all-time.
          </p>
        </div>
        <button
          onClick={reset}
          className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
        >
          Reset paper account
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
          No orders yet.{" "}
          <Link href="/trade" className="text-brand-300 hover:underline">
            Place your first →
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <OrderRow order={o} />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-10">
        <Link
          href="/profile"
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to profile
        </Link>
      </div>
    </>
  );
}

function OrderRow({ order }: { order: Order }) {
  const tone =
    order.status === "filled"
      ? "border-brand-500/40 bg-brand-500/5"
      : order.status === "partial"
        ? "border-amber-500/40 bg-amber-500/5"
        : order.status === "cancelled" || order.status === "rejected"
          ? "border-ink-700 bg-ink-900/40 opacity-70"
          : "border-ink-700 bg-ink-900/40";
  return (
    <article className={"rounded-xl border p-4 " + tone}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={
                "rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider " +
                (order.side === "buy"
                  ? "bg-brand-500/15 text-brand-300"
                  : "bg-red-500/15 text-red-300")
              }
            >
              {order.side}
            </span>
            <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
              {order.kind}
            </span>
            <span
              className={
                "rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider " +
                (order.status === "filled"
                  ? "bg-brand-500/15 text-brand-300"
                  : order.status === "partial"
                    ? "bg-amber-500/15 text-amber-300"
                    : "bg-ink-800 text-ink-400")
              }
            >
              {order.status}
            </span>
          </div>
          <div className="mt-1 text-sm text-ink-100">
            {order.qty} × {order.symbol}
            {order.limitPrice != null && (
              <span className="ml-2 text-xs text-ink-400">
                limit ₹{order.limitPrice.toFixed(2)}
              </span>
            )}
            {order.stopPrice != null && (
              <span className="ml-2 text-xs text-ink-400">
                stop ₹{order.stopPrice.toFixed(2)}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-ink-500">
            {new Date(order.placedAt).toLocaleString()} · filled{" "}
            {order.filledQty}/{order.qty}
            {order.avgFillPrice > 0 && ` @ ₹${order.avgFillPrice.toFixed(2)} avg`}
          </div>
        </div>
        <div className="shrink-0 text-right text-sm">
          {order.filledQty > 0 && (
            <>
              <div className="font-mono text-ink-100">
                ₹{Math.round(order.filledQty * order.avgFillPrice).toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-ink-500">filled value</div>
            </>
          )}
        </div>
      </div>
      {order.fills.length > 1 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-ink-400 hover:text-ink-200">
            {order.fills.length} partial fills
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-ink-400">
            {order.fills.map((f, i) => (
              <li key={i} className="flex justify-between">
                <span>{f.qty} @ ₹{f.price.toFixed(2)}</span>
                <span>{new Date(f.ts).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
