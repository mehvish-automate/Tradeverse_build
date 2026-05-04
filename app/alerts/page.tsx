"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  AlertCondition,
  PriceAlert,
  createAlert,
  listAlerts,
  rearmAlert,
  removeAlert,
} from "@/lib/alerts";
import { useSession } from "@/lib/session";
import { STOCKS, getStock, price } from "@/lib/stocks";

export default function AlertsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <Suspense fallback={null}>
            <Inner />
          </Suspense>
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const search = useSearchParams();
  const prefilledSymbol = search?.get("symbol")?.toUpperCase() ?? "";
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);

  const refresh = useCallback(() => {
    if (!user) return;
    setAlerts(listAlerts(user.email));
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) return null;

  const armed = alerts.filter((a) => a.armed);
  const fired = alerts.filter((a) => !a.armed || a.triggeredAt);

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Alerts
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Price triggers</h1>
        <p className="mt-2 text-sm text-ink-400">
          Set a condition and we&apos;ll surface it in your inbox the moment
          it crosses. One-shot by default — re-arm to listen again after a
          fire.
        </p>
      </div>

      <CreateAlertCard
        defaultSymbol={prefilledSymbol}
        onCreated={refresh}
      />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
          Armed ({armed.length})
        </h2>
        {armed.length === 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
            Nothing armed. Add a condition above to listen for a price
            crossing.
          </div>
        ) : (
          <ul className="space-y-2">
            {armed.map((a) => (
              <li key={a.id}>
                <AlertRow alert={a} onChange={refresh} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {fired.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
            Triggered
          </h2>
          <ul className="space-y-2">
            {fired
              .filter((a) => !a.armed || a.triggeredAt)
              .map((a) => (
                <li key={a.id}>
                  <AlertRow alert={a} onChange={refresh} />
                </li>
              ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-xs text-ink-500">
        Alerts sync across your devices via Supabase. Web Push delivery is
        a future enhancement — for now, an alert lands in your inbox the
        moment it crosses, and your other devices pick it up on their next
        sync tick. Prices stay deterministic-synthetic until a live data
        feed is wired.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------

function CreateAlertCard({
  defaultSymbol,
  onCreated,
}: {
  defaultSymbol: string;
  onCreated: () => void;
}) {
  const { user } = useSession();
  const [symbol, setSymbol] = useState<string>(
    defaultSymbol && getStock(defaultSymbol)
      ? defaultSymbol
      : STOCKS[0].symbol,
  );
  const [condition, setCondition] = useState<AlertCondition>("above");
  const [priceInput, setPriceInput] = useState<string>("");
  const [oneShot, setOneShot] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const live = useMemo(
    () => (getStock(symbol) ? price(symbol, new Date()) : 0),
    [symbol],
  );

  // Default the price input to a sensible side of the live price.
  useEffect(() => {
    if (priceInput) return;
    if (!live) return;
    const suggested = condition === "above" ? live * 1.03 : live * 0.97;
    setPriceInput(suggested.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) return;
    const r = createAlert(user.email, {
      symbol,
      condition,
      price: Number(priceInput),
      oneShot,
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setPriceInput("");
    onCreated();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5"
    >
      <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
        New alert
      </div>
      <h2 className="mt-1 text-lg font-semibold">Set a price trigger</h2>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Symbol
          </span>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="input"
          >
            {STOCKS.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} — {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Condition
          </span>
          <div className="grid grid-cols-2 gap-1">
            {(["above", "below"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCondition(c)}
                className={
                  "rounded-md border px-3 py-2 text-xs uppercase tracking-wider transition " +
                  (condition === c
                    ? "border-brand-500 bg-brand-500/10 text-brand-200"
                    : "border-ink-700 text-ink-300 hover:border-ink-500")
                }
              >
                {c}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Trigger price (₹)
          </span>
          <input
            type="number"
            step={0.05}
            min={0}
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            className="input"
            required
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-500">
        <span>
          Last for {symbol}: ₹{live.toFixed(2)}
        </span>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={oneShot}
            onChange={(e) => setOneShot(e.target.checked)}
            className="accent-emerald-500"
          />
          <span>One-shot (disarm after firing once)</span>
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button type="submit" className="btn-primary">
          Arm alert
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

function AlertRow({
  alert,
  onChange,
}: {
  alert: PriceAlert;
  onChange: () => void;
}) {
  const { user } = useSession();
  const live = useMemo(
    () => (getStock(alert.symbol) ? price(alert.symbol, new Date()) : 0),
    [alert.symbol],
  );

  // How far away the trigger is, expressed as % of last.
  const distancePct =
    live > 0 ? ((alert.price - live) / live) * 100 : 0;

  const tone = alert.armed
    ? "border-brand-500/40 bg-brand-500/5"
    : "border-amber-500/40 bg-amber-500/5";

  return (
    <div
      className={"flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 " + tone}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            href={`/chart/${alert.symbol}`}
            className="font-mono font-semibold text-ink-50 hover:underline"
          >
            {alert.symbol}
          </Link>
          <span className="text-ink-400">
            {alert.condition === "above" ? "≥" : "≤"} ₹{alert.price.toFixed(2)}
          </span>
          {!alert.armed && alert.triggeredAt && (
            <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Fired {new Date(alert.triggeredAt).toLocaleString()}
            </span>
          )}
          {alert.armed && (
            <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
              Armed
            </span>
          )}
          {alert.oneShot && (
            <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
              One-shot
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-ink-500">
          Last ₹{live.toFixed(2)}
          {alert.armed && live > 0 && (
            <>
              {" "}· {distancePct >= 0 ? "+" : ""}
              {distancePct.toFixed(2)}% to trigger
            </>
          )}
          {alert.triggeredPrice !== undefined && (
            <> · fired at ₹{alert.triggeredPrice.toFixed(2)}</>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {!alert.armed && (
          <button
            type="button"
            onClick={() => {
              if (!user) return;
              rearmAlert(user.email, alert.id);
              onChange();
            }}
            className="rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-brand-200 hover:bg-brand-500/20"
          >
            Re-arm
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            if (!user) return;
            if (!confirm("Delete this alert?")) return;
            removeAlert(user.email, alert.id);
            onChange();
          }}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:border-red-500/50 hover:text-red-300"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
