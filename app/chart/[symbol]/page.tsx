"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { AdvancedChart } from "@/components/AdvancedChart";
import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { actionsFor } from "@/lib/corporate";
import { sessionAt, sessionLabel } from "@/lib/marketData";
import {
  GLOBAL_SCOPE,
  ensureAccount,
  getAccount,
  placeOrder,
} from "@/lib/paper";
import { useSession } from "@/lib/session";
import { STOCKS, getStock, price } from "@/lib/stocks";
import { TradeFloor, getTradeFloor } from "@/lib/tradeFloors";
import { addToWatchlist, isWatched, removeFromWatchlist } from "@/lib/watchlist";

export default function ChartPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-6 py-10">
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
  const params = useParams<{ symbol: string }>();
  const search = useSearchParams();
  const symbol = params?.symbol ? String(params.symbol).toUpperCase() : "";
  const floorParam = search?.get("floor")?.toUpperCase() ?? null;
  const [watched, setWatched] = useState(false);
  const [sess, setSess] = useState(sessionAt());

  const floor: TradeFloor | null = useMemo(
    () => (floorParam ? getTradeFloor(floorParam) : null),
    [floorParam],
  );
  const scopeId = floor ? floor.id : GLOBAL_SCOPE;

  useEffect(() => {
    if (!user) return;
    setWatched(isWatched(user.email, symbol));
    const iv = setInterval(() => setSess(sessionAt()), 30_000);
    return () => clearInterval(iv);
  }, [user, symbol]);

  // Seed the scoped paper account on first chart-trade visit.
  useEffect(() => {
    if (!user || !floor) return;
    ensureAccount(user.email, floor.id, floor.virtualCapital);
  }, [user, floor]);

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
        <Link href="/trade" className="mt-4 inline-block btn-ghost">
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
            href={floor ? `/trade?floor=${floor.id}` : "/trade"}
            className="text-xs text-ink-400 hover:text-ink-100"
          >
            ← Trade ticket
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold">{symbol}</h1>
            <SessionChip s={sess} />
            {floor && (
              <span
                className="rounded-md bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300"
                title={`Trading inside competition ${floor.name}`}
              >
                In {floor.name}
              </span>
            )}
          </div>
          <div className="mt-1 text-sm text-ink-400">
            {stock.name} · {stock.sector}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-3xl font-semibold text-ink-50">
              ₹{mid.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-ink-500">{sessionLabel(sess)}</span>
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
            href={floor ? `/trade?floor=${floor.id}` : "/trade"}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-100 hover:bg-ink-900"
          >
            Full ticket →
          </Link>
        </div>
      </div>

      <AdvancedChart symbol={symbol} />

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <QuickTrade
          symbol={symbol}
          mid={mid}
          email={user.email}
          scopeId={scopeId}
        />

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
            href={
              floor ? `/chart/${s.symbol}?floor=${floor.id}` : `/chart/${s.symbol}`
            }
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

// ---------------------------------------------------------------------------
// Inline order ticket — Market and Limit only. Reuses lib/paper.placeOrder
// so it composes with the global account or any floor-scoped account
// driven by ?floor=<id>. Keeps the form to one column so it slots into
// the existing chart-page grid without crowding the chart above.
// ---------------------------------------------------------------------------

function QuickTrade({
  symbol,
  mid,
  email,
  scopeId,
}: {
  symbol: string;
  mid: number;
  email: string;
  scopeId: string;
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [kind, setKind] = useState<"market" | "limit">("market");
  const [qty, setQty] = useState(10);
  const [limitPrice, setLimitPrice] = useState<number>(+mid.toFixed(2));
  const [ack, setAck] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [accTick, setAccTick] = useState(0);

  // Snap limit price when the symbol or scope changes.
  useEffect(() => {
    setLimitPrice(+mid.toFixed(2));
  }, [mid]);

  const acct = useMemo(
    () => getAccount(email, scopeId),
    // accTick included so the holdings recompute after a fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [email, scopeId, accTick],
  );
  const holding = acct.holdings.find((h) => h.symbol === symbol);
  const estPrice = kind === "market" ? mid : limitPrice;
  const estValue = estPrice * qty;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAck(null);
    setErr(null);
    const r = placeOrder(
      email,
      {
        symbol,
        side,
        kind,
        qty,
        limitPrice: kind === "limit" ? limitPrice : undefined,
      },
      undefined,
      scopeId,
    );
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setAck(`${side.toUpperCase()} ${qty} ${symbol} submitted — filling…`);
    // Trigger a re-render so the holdings line picks up the fill once it
    // settles (~250-500ms via the engine's setTimeout).
    setTimeout(() => setAccTick((t) => t + 1), 700);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5"
    >
      <h2 className="text-sm font-medium uppercase tracking-wider text-brand-300">
        Quick trade
      </h2>
      <p className="mt-1 text-xs text-ink-500">
        Market or limit on this symbol. For stop / stop-limit, use the full
        ticket.
      </p>

      {/* Side */}
      <div className="mt-4 grid grid-cols-2 gap-1.5">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={
              "rounded-md border px-2 py-1.5 text-xs font-semibold uppercase tracking-wider transition " +
              (side === s
                ? s === "buy"
                  ? "border-brand-500 bg-brand-500/10 text-brand-200"
                  : "border-red-500 bg-red-500/10 text-red-300"
                : "border-ink-700 text-ink-300 hover:border-ink-500")
            }
          >
            {s}
          </button>
        ))}
      </div>

      {/* Kind */}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {(["market", "limit"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              "rounded-md border px-2 py-1.5 text-xs uppercase tracking-wider transition " +
              (kind === k
                ? "border-brand-500 bg-brand-500/10 text-brand-200"
                : "border-ink-700 text-ink-300 hover:border-ink-500")
            }
          >
            {k}
          </button>
        ))}
      </div>

      {/* Qty */}
      <label className="mt-3 block">
        <span className="mb-1 block text-xs font-medium text-ink-300">
          Quantity
        </span>
        <input
          type="number"
          min={1}
          step={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="input"
        />
      </label>

      {/* Limit price (only when kind=limit) */}
      {kind === "limit" && (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Limit price (₹)
          </span>
          <input
            type="number"
            min={0}
            step={0.05}
            value={limitPrice}
            onChange={(e) => setLimitPrice(+e.target.value)}
            className="input"
          />
        </label>
      )}

      {/* Estimate */}
      <div className="mt-3 rounded-md border border-ink-800 bg-ink-950 px-3 py-2 text-xs">
        <div className="flex items-center justify-between text-ink-400">
          <span>Est. {side === "buy" ? "cost" : "proceeds"}</span>
          <span className="font-mono text-ink-100">
            ₹{estValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between text-ink-500">
          <span>Cash available</span>
          <span className="font-mono">
            ₹{acct.cash.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </span>
        </div>
        {holding && (
          <div className="mt-1 flex items-center justify-between text-ink-500">
            <span>You hold</span>
            <span className="font-mono">{holding.shares} sh</span>
          </div>
        )}
      </div>

      {ack && (
        <p className="mt-3 rounded-md border border-brand-500/40 bg-brand-500/5 px-3 py-2 text-xs text-brand-200">
          {ack}
        </p>
      )}
      {err && (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-300">
          {err}
        </p>
      )}

      <button
        type="submit"
        className={
          "mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold transition " +
          (side === "buy"
            ? "bg-brand-500 text-ink-950 hover:bg-brand-300"
            : "bg-red-500 text-ink-950 hover:bg-red-400")
        }
      >
        {side === "buy" ? "Buy" : "Sell"} {qty} {symbol}
      </button>
    </form>
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
