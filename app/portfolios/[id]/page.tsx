"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  Holding,
  StrategyPortfolio,
  allowedUniverse,
  deletePortfolio,
  getPortfolio,
  snapshot,
  totalAllocated,
  updatePortfolio,
  valueSeries,
} from "@/lib/portfolios";
import { useSession } from "@/lib/session";
import { STOCKS } from "@/lib/stocks";

export default function PortfolioPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <RequireAuth>
          <PortfolioInner />
        </RequireAuth>
      </main>
    </>
  );
}

function PortfolioInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const [portfolio, setPortfolio] = useState<StrategyPortfolio | null | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user || !params?.id) return;
    setPortfolio(getPortfolio(user.email, String(params.id)));
  }, [user, params?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user || portfolio === undefined) return null;
  if (portfolio === null) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Portfolio not found</h1>
        <p className="mt-2 text-sm text-ink-400">It may have been deleted.</p>
        <Link
          href="/portfolios"
          className="mt-4 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to portfolios
        </Link>
      </div>
    );
  }

  const snap = snapshot(portfolio);
  const allocated = totalAllocated(portfolio);

  function setHoldings(next: Holding[]) {
    setError(null);
    if (!user) return;
    const r = updatePortfolio(user.email, portfolio!.id, { holdings: next });
    if (!r.ok) {
      setError(r.error ?? "Update failed.");
      return;
    }
    refresh();
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/portfolios" className="text-xs text-ink-400 hover:text-ink-100">
            ← Portfolios
          </Link>
          <h1 className="mt-1 text-3xl font-semibold">{portfolio.name}</h1>
          {portfolio.description && (
            <p className="mt-1 text-sm text-ink-400">{portfolio.description}</p>
          )}
          <div className="mt-1 text-xs text-ink-500">
            Based {portfolio.baseDate} · ₹
            {portfolio.initialCapital.toLocaleString("en-IN")} paper capital
          </div>
          {portfolio.universe &&
            (portfolio.universe.sectors?.length ||
              portfolio.universe.assetClasses?.length ||
              portfolio.universe.nifty50Only) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-400">
                <span className="text-ink-500">Universe:</span>
                {portfolio.universe.nifty50Only && (
                  <span className="rounded-md bg-ink-900 px-1.5 py-0.5">
                    Nifty 50
                  </span>
                )}
                {portfolio.universe.assetClasses?.map((a) => (
                  <span key={a} className="rounded-md bg-ink-900 px-1.5 py-0.5">
                    {a === "etf" ? "ETFs" : a === "index" ? "Indices" : "Stocks"}
                  </span>
                ))}
                {portfolio.universe.sectors?.map((s) => (
                  <span key={s} className="rounded-md bg-ink-900 px-1.5 py-0.5">
                    {s}
                  </span>
                ))}
              </div>
            )}
        </div>
        <button
          onClick={() => {
            if (!confirm("Delete this portfolio?")) return;
            deletePortfolio(user!.email, portfolio.id);
            router.push("/portfolios");
          }}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-900"
        >
          Delete
        </button>
      </div>

      <PerformanceHeader snap={snap} portfolio={portfolio} />

      <HoldingsEditor
        portfolio={portfolio}
        onChange={setHoldings}
        error={error}
        allocated={allocated}
      />

      <HoldingsTable portfolio={portfolio} onChange={setHoldings} />
    </>
  );
}

// --- Performance header ---

function PerformanceHeader({
  snap,
  portfolio,
}: {
  snap: ReturnType<typeof snapshot>;
  portfolio: StrategyPortfolio;
}) {
  const up = snap.portfolioReturnPct >= 0;
  const beats = snap.alphaPct >= 0;
  const series = useMemo(() => valueSeries(portfolio, 45), [portfolio]);
  return (
    <section
      className={
        "mt-8 overflow-hidden rounded-2xl border p-6 " +
        (up
          ? "border-brand-500/40 bg-brand-500/5"
          : "border-red-500/40 bg-red-500/5")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Portfolio value
          </div>
          <div className="mt-1 text-4xl font-semibold">
            ₹{snap.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </div>
          <div className={"mt-1 text-sm " + (up ? "text-brand-300" : "text-red-300")}>
            {up ? "+" : ""}
            {snap.portfolioReturnPct.toFixed(2)}% since {portfolio.baseDate}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <Metric label="NIFTY" value={`${snap.niftyReturnPct.toFixed(2)}%`} />
          <Metric
            label={beats ? "Alpha" : "Drag"}
            value={`${snap.alphaPct >= 0 ? "+" : ""}${snap.alphaPct.toFixed(2)}%`}
            tone={beats ? "good" : "bad"}
          />
          <Metric
            label="Invested"
            value={`${snap.investedPct.toFixed(0)}%`}
            sub={`${snap.cashPct.toFixed(0)}% cash`}
          />
        </div>
      </div>

      <Sparkline series={series} />

      <p className="mt-3 text-xs text-ink-500">
        Prices are deterministically simulated from a base anchor for the V1
        build. Same everywhere, but not live.
      </p>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="text-right">
      <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
      <div
        className={
          "mt-1 text-lg font-semibold " +
          (tone === "good"
            ? "text-brand-300"
            : tone === "bad"
              ? "text-red-300"
              : "text-ink-100")
        }
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-ink-500">{sub}</div>}
    </div>
  );
}

function Sparkline({
  series,
}: {
  series: { t: string; value: number; benchmark: number }[];
}) {
  if (series.length < 2) {
    return (
      <div className="mt-5 rounded-lg border border-ink-700/70 bg-ink-950 p-6 text-center text-xs text-ink-500">
        Add a holding and a time series will render here.
      </div>
    );
  }
  const W = 100;
  const H = 40;
  const pad = 2;

  const allVals = series.flatMap((p) => [p.value, p.benchmark]);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;
  const step = (W - pad * 2) / (series.length - 1);
  const y = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2);

  const d = (key: "value" | "benchmark") =>
    series
      .map((p, i) => `${i === 0 ? "M" : "L"} ${(pad + i * step).toFixed(2)} ${y(p[key]).toFixed(2)}`)
      .join(" ");

  return (
    <div className="mt-5 rounded-lg border border-ink-700/70 bg-ink-950 p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full" preserveAspectRatio="none">
        <path
          d={d("benchmark")}
          fill="none"
          stroke="#64748b"
          strokeWidth="0.5"
          strokeDasharray="1 1.5"
        />
        <path
          d={d("value")}
          fill="none"
          stroke="#10b981"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-2 flex items-center gap-4 text-[10px] text-ink-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-0.5 w-3 bg-brand-500" /> Portfolio
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-px w-3 border-t border-dashed border-ink-500" />
          NIFTY proxy
        </span>
      </div>
    </div>
  );
}

// --- Editor ---

function HoldingsEditor({
  portfolio,
  onChange,
  error,
  allocated,
}: {
  portfolio: StrategyPortfolio;
  onChange: (next: Holding[]) => void;
  error: string | null;
  allocated: number;
}) {
  const allowed = allowedUniverse(portfolio.universe);
  const [symbol, setSymbol] = useState<string>(
    allowed[0]?.symbol ?? STOCKS[0].symbol,
  );
  const [pct, setPct] = useState<number>(10);

  const existingSymbols = new Set(portfolio.holdings.map((h) => h.symbol));
  const available = allowed.filter((s) => !existingSymbols.has(s.symbol));

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!symbol || pct <= 0) return;
    onChange([...portfolio.holdings, { symbol, pct }]);
    const next = available.find((s) => s.symbol !== symbol);
    if (next) setSymbol(next.symbol);
    setPct(10);
  }

  return (
    <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-semibold">Add a holding</h2>
        <div className="text-xs text-ink-500">
          {allocated.toFixed(0)}% allocated · {(100 - allocated).toFixed(0)}% cash
        </div>
      </div>
      <form
        onSubmit={add}
        className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_auto]"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-300">Symbol</span>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="input"
          >
            {available.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol} — {s.name} ({s.sector})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Allocation %
          </span>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="input"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={available.length === 0}
            className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300 disabled:opacity-40 md:w-auto"
          >
            Add holding
          </button>
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {allocated >= 100 && (
        <p className="mt-3 text-xs text-ink-500">
          Fully allocated — drop something below or rebalance to add more.
        </p>
      )}
    </section>
  );
}

function HoldingsTable({
  portfolio,
  onChange,
}: {
  portfolio: StrategyPortfolio;
  onChange: (next: Holding[]) => void;
}) {
  const snap = snapshot(portfolio);

  if (portfolio.holdings.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
        No holdings yet. Add one above.
      </div>
    );
  }

  function drop(symbol: string) {
    onChange(portfolio.holdings.filter((h) => h.symbol !== symbol));
  }

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700">
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-ink-700 bg-ink-900/60 px-5 py-3 text-xs uppercase tracking-wider text-ink-400">
        <span>Holding</span>
        <span className="text-right">Alloc</span>
        <span className="text-right">Price</span>
        <span className="text-right">Return</span>
        <span />
      </div>
      {portfolio.holdings.map((h) => {
        const row = snap.holdings.find((r) => r.symbol === h.symbol);
        const up = (row?.pctReturn ?? 0) >= 0;
        return (
          <div
            key={h.symbol}
            className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-ink-900 px-5 py-3 text-sm last:border-b-0"
          >
            <div className="min-w-0">
              <div className="font-medium text-ink-50">{h.symbol}</div>
              <div className="truncate text-xs text-ink-500">
                {STOCKS.find((s) => s.symbol === h.symbol)?.name}
              </div>
            </div>
            <div className="text-right text-ink-200">{h.pct.toFixed(0)}%</div>
            <div className="text-right font-mono text-ink-200">
              ₹{row?.priceAtAsOf.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div
              className={
                "text-right font-mono " + (up ? "text-brand-300" : "text-red-300")
              }
            >
              {up ? "+" : ""}
              {row?.pctReturn.toFixed(2)}%
            </div>
            <button
              onClick={() => drop(h.symbol)}
              className="rounded-md border border-ink-700 px-2 py-1 text-xs text-ink-300 hover:bg-ink-900"
            >
              Remove
            </button>
          </div>
        );
      })}
    </section>
  );
}
