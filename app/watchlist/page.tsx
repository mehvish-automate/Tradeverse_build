"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import {
  WatchlistRow,
  addToWatchlist,
  addableStocks,
  removeFromWatchlist,
  watchlistRows,
} from "@/lib/watchlist";

export default function WatchlistPage() {
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
  const [rows, setRows] = useState<WatchlistRow[]>([]);
  const [availableCount, setAvailableCount] = useState(0);

  const refresh = useCallback(() => {
    if (!user) return;
    setRows(watchlistRows(user.email));
    setAvailableCount(addableStocks(user.email).length);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) return null;

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Watchlist
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Stocks you&apos;re watching</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Follow a stock without putting money on it. Track its
          deterministic V1 price path + synthesised RSI. We alert you in
          the inbox when anything on here crosses 70 or 30.
        </p>
      </div>

      <AddStock refresh={refresh} />

      {rows.length === 0 ? (
        <div className="mt-8 rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
          Nothing watched yet. Pick from the dropdown above — {availableCount}{" "}
          symbols in our V1 universe.
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {rows.map((r) => (
            <li key={r.stock.symbol}>
              <WatchlistCard row={r} onRemove={refresh} />
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

function AddStock({ refresh }: { refresh: () => void }) {
  const { user } = useSession();
  const [available, setAvailable] = useState<ReturnType<typeof addableStocks>>([]);
  const [symbol, setSymbol] = useState("");

  useEffect(() => {
    if (!user) return;
    const list = addableStocks(user.email);
    setAvailable(list);
    setSymbol(list[0]?.symbol ?? "");
  }, [user]);

  if (!user) return null;

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol) return;
    addToWatchlist(user!.email, symbol);
    refresh();
    // Update local list
    const next = addableStocks(user!.email);
    setAvailable(next);
    setSymbol(next[0]?.symbol ?? "");
  }

  return (
    <form
      onSubmit={onAdd}
      className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-[240px]">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Add a stock
          </span>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="input"
            disabled={available.length === 0}
          >
            {available.length === 0 && (
              <option>All V1 symbols already on the list</option>
            )}
            {available.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} — {s.name} ({s.sector})
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={available.length === 0}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300 disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </form>
  );
}

function WatchlistCard({
  row,
  onRemove,
}: {
  row: WatchlistRow;
  onRemove: () => void;
}) {
  const { user } = useSession();

  const up1 = row.pct1d >= 0;
  const zone: "overbought" | "oversold" | "neutral" =
    row.rsi >= 70 ? "overbought" : row.rsi <= 30 ? "oversold" : "neutral";

  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-ink-50">
              {row.stock.symbol}
            </h3>
            <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
              {row.stock.sector}
            </span>
            {zone !== "neutral" && (
              <span
                className={
                  "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                  (zone === "overbought"
                    ? "bg-red-500/15 text-red-300"
                    : "bg-brand-500/15 text-brand-300")
                }
              >
                RSI {zone}
              </span>
            )}
          </div>
          <div className="text-xs text-ink-500">{row.stock.name}</div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/chart/${row.stock.symbol}`}
            className="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-200 hover:bg-ink-900"
          >
            Chart →
          </Link>
          <button
            onClick={() => {
              if (!user) return;
              removeFromWatchlist(user.email, row.stock.symbol);
              onRemove();
            }}
            className="rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 hover:bg-ink-900"
          >
            Remove
          </button>
        </div>
      </div>

      <Sparkline series={row.series} />

      <div className="mt-4 grid grid-cols-4 gap-3 text-xs">
        <Metric label="Price" value={`₹${row.priceNow.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`} />
        <Metric
          label="1d"
          value={`${up1 ? "+" : ""}${row.pct1d.toFixed(2)}%`}
          tone={up1 ? "good" : "bad"}
        />
        <Metric
          label="7d"
          value={`${row.pct7d >= 0 ? "+" : ""}${row.pct7d.toFixed(2)}%`}
          tone={row.pct7d >= 0 ? "good" : "bad"}
        />
        <Metric
          label="RSI(14)"
          value={`${row.rsi.toFixed(0)}`}
          tone={
            zone === "overbought" ? "bad" : zone === "oversold" ? "good" : undefined
          }
        />
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-950 p-3 text-right">
      <div className="text-[10px] uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div
        className={
          "mt-1 font-mono text-sm " +
          (tone === "good"
            ? "text-brand-300"
            : tone === "bad"
              ? "text-red-300"
              : "text-ink-100")
        }
      >
        {value}
      </div>
    </div>
  );
}

function Sparkline({
  series,
}: {
  series: { t: string; p: number }[];
}) {
  if (series.length < 2) return null;
  const W = 100;
  const H = 24;
  const pad = 1;
  const prices = series.map((s) => s.p);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const step = (W - pad * 2) / (series.length - 1);
  const y = (p: number) => H - pad - ((p - min) / range) * (H - pad * 2);
  const d = series
    .map((s, i) => `${i === 0 ? "M" : "L"} ${(pad + i * step).toFixed(2)} ${y(s.p).toFixed(2)}`)
    .join(" ");
  const up = series[series.length - 1].p >= series[0].p;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-4 h-12 w-full"
      preserveAspectRatio="none"
    >
      <path
        d={d}
        fill="none"
        stroke={up ? "#10b981" : "#f87171"}
        strokeWidth={0.8}
        strokeLinecap="round"
      />
    </svg>
  );
}
