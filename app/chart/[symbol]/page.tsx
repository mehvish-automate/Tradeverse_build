"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdvancedChart } from "@/components/AdvancedChart";
import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { actionsFor } from "@/lib/corporate";
import { sessionAt, sessionLabel } from "@/lib/marketData";
import { useSession } from "@/lib/session";
import { STOCKS, getStock, price } from "@/lib/stocks";
import { addToWatchlist, isWatched, removeFromWatchlist } from "@/lib/watchlist";

export default function ChartPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const params = useParams<{ symbol: string }>();
  const symbol = params?.symbol ? String(params.symbol).toUpperCase() : "";
  const [watched, setWatched] = useState(false);
  const [sess, setSess] = useState(sessionAt());

  useEffect(() => {
    if (!user) return;
    setWatched(isWatched(user.email, symbol));
    const iv = setInterval(() => setSess(sessionAt()), 30_000);
    return () => clearInterval(iv);
  }, [user, symbol]);

  const stock = useMemo(() => getStock(symbol), [symbol]);
  const mid = useMemo(() => (stock ? price(symbol, new Date()) : 0), [stock, symbol]);
  const actions = useMemo(() => actionsFor(symbol), [symbol]);

  if (!user) return null;
  if (!stock) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Unknown symbol</h1>
        <p className="mt-2 text-sm text-ink-400">
          Pick from the V1 universe.
        </p>
        <Link
          href="/trade"
          className="mt-4 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to trade
        </Link>
      </div>
    );
  }

  function toggleWatch() {
    if (!user) return;
    if (watched) {
      removeFromWatchlist(user.email, symbol);
      setWatched(false);
    } else {
      addToWatchlist(user.email, symbol);
      setWatched(true);
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/trade"
            className="text-xs text-ink-400 hover:text-ink-100"
          >
            ← Trade ticket
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">{symbol}</h1>
            <SessionChip s={sess} />
          </div>
          <div className="mt-1 text-sm text-ink-400">
            {stock.name} · {stock.sector}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-ink-50">
              ₹{mid.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-ink-500">
              {sessionLabel(sess)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleWatch}
            className={
              "rounded-md border px-3 py-1.5 text-xs transition " +
              (watched
                ? "border-brand-500 bg-brand-500/10 text-brand-200"
                : "border-ink-700 text-ink-300 hover:border-ink-500")
            }
          >
            {watched ? "Watching ✓" : "+ Watchlist"}
          </button>
          <Link
            href="/trade"
            className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300"
          >
            Trade →
          </Link>
        </div>
      </div>

      <AdvancedChart symbol={symbol} />

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
            Symbol info
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <dt className="text-ink-500">Symbol</dt>
            <dd className="text-ink-100 font-mono">{stock.symbol}</dd>
            <dt className="text-ink-500">Sector</dt>
            <dd className="text-ink-100">{stock.sector}</dd>
            <dt className="text-ink-500">Last</dt>
            <dd className="text-ink-100 font-mono">₹{mid.toFixed(2)}</dd>
            <dt className="text-ink-500">Session</dt>
            <dd className="text-ink-100">{sess}</dd>
          </dl>
        </div>

        <div className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
            Corporate actions
          </h2>
          {actions.length === 0 ? (
            <p className="mt-3 text-sm text-ink-400">
              None in the curated V1 data.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {actions.map((a, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-md border border-ink-800 bg-ink-950 px-3 py-2"
                >
                  <div>
                    <div className="text-xs uppercase tracking-wider text-brand-300">
                      {a.kind}
                    </div>
                    <div className="text-ink-100">{a.note}</div>
                  </div>
                  <div className="text-xs text-ink-500">{a.date}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">Other symbols:</span>
        {STOCKS.slice(0, 10).map((s) => (
          <Link
            key={s.symbol}
            href={`/chart/${s.symbol}`}
            className={
              "rounded-md border px-2 py-1 text-xs transition " +
              (s.symbol === symbol
                ? "border-brand-500 bg-brand-500/10 text-brand-200"
                : "border-ink-700 text-ink-300 hover:border-ink-500")
            }
          >
            {s.symbol}
          </Link>
        ))}
      </section>
    </>
  );
}

function SessionChip({ s }: { s: ReturnType<typeof sessionAt> }) {
  const tone =
    s === "open"
      ? "bg-brand-500/15 text-brand-300"
      : s === "pre" || s === "post"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-ink-800 text-ink-400";
  return (
    <span
      className={
        "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        tone
      }
    >
      {s === "open" ? "Live" : s === "pre" ? "Pre-open" : s === "post" ? "Close block" : "Closed"}
    </span>
  );
}
