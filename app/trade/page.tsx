"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { formatRupees } from "@/lib/competitions";
import { sessionAt, sessionLabel } from "@/lib/marketData";
import { bookAtPrice, L2Book } from "@/lib/orderbook";
import {
  GLOBAL_SCOPE,
  Order,
  OrderKind,
  OrderSide,
  cancelOrder,
  ensureAccount,
  getAccount,
  listOrders,
  openOrders,
  placeOrder,
  portfolioValue,
  tickOpenOrders,
} from "@/lib/paper";
import { useSession } from "@/lib/session";
import { reconcilePaperFromCloud } from "@/lib/supabase/paper-sync";
import { useRealtimePaper } from "@/lib/supabase/realtime";
import { STOCKS, Stock, filterStocksForFloor, price } from "@/lib/stocks";
import { TradeFloor, getTradeFloor } from "@/lib/tradeFloors";

export default function TradePage() {
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
  const search = useSearchParams();
  const floorParam = search?.get("floor")?.toUpperCase() ?? null;

  // Lookup the floor (if scoped) so we know virtual capital + name.
  const floor: TradeFloor | null = useMemo(
    () => (floorParam ? getTradeFloor(floorParam) : null),
    [floorParam],
  );
  const scopeId = floor ? floor.id : GLOBAL_SCOPE;

  // First-visit seed: scoped account inherits the floor's virtual capital.
  useEffect(() => {
    if (!user || !floor) return;
    ensureAccount(user.email, floor.id, floor.virtualCapital);
  }, [user, floor]);

  // Phase 49 — universe filtering. When scoped to a floor, the symbol
  // picker only shows stocks/etfs/indices that match the floor's
  // marketRegion + assetClasses + stockUniverse. Empty result set is
  // surfaced as a clear panel below.
  const availableStocks: Stock[] = useMemo(() => {
    if (!floor) return STOCKS;
    return filterStocksForFloor({
      universeKind: floor.stockUniverse.kind,
      customSectors:
        floor.stockUniverse.kind === "custom-sectors"
          ? floor.stockUniverse.sectors
          : undefined,
      handpickedSymbols:
        floor.stockUniverse.kind === "handpicked"
          ? floor.stockUniverse.symbols
          : undefined,
      assetClasses: floor.assetClasses,
      marketRegion: floor.marketRegion,
    });
  }, [floor]);

  const [symbol, setSymbol] = useState<string>(STOCKS[0].symbol);

  // Whenever the universe changes (or page first mounts in a scoped
  // run), snap the picker to a symbol that's actually allowed.
  useEffect(() => {
    if (availableStocks.length === 0) return;
    if (!availableStocks.some((s) => s.symbol === symbol)) {
      setSymbol(availableStocks[0].symbol);
    }
  }, [availableStocks, symbol]);
  const [book, setBook] = useState<L2Book | null>(null);
  const [tick, setTick] = useState(0);
  const [orders, setOrders] = useState<Order[]>([]);
  const [opens, setOpens] = useState<Order[]>([]);
  const [ack, setAck] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user) return;
    const mid = price(symbol, new Date());
    setBook(bookAtPrice(symbol, mid));
    setOrders(listOrders(user.email, scopeId));
    setOpens(openOrders(user.email, scopeId));
    setTick((t) => t + 1);
  }, [user, symbol, scopeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const iv = setInterval(() => {
      tickOpenOrders(user.email, scopeId);
      refresh();
    }, 3000);
    return () => clearInterval(iv);
  }, [user, refresh, scopeId]);

  // Cross-device realtime — Phase 45.5b makes per-scope mirroring
  // first-class, so we reconcile both global and floor-scoped accounts.
  // The reconcile is filtered by the active scopeId, so a global tab
  // never clobbers scoped state and vice versa.
  const live = useRealtimePaper();
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      await reconcilePaperFromCloud(scopeId);
      if (!cancelled) refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [user, live.tick, refresh, scopeId]);

  if (!user || !book) return null;

  // floorParam was set but the floor isn't on this device yet —
  // surface a clear hint instead of silently falling back to global.
  if (floorParam && !floor) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Competition not found</h1>
        <p className="mt-2 text-sm text-ink-400">
          Couldn&apos;t find a trade floor with code {floorParam} on this
          device. Open it from the Floors list to load it first.
        </p>
        <Link
          href="/trade-floors"
          className="mt-4 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Open trade floors
        </Link>
      </div>
    );
  }

  const pv = portfolioValue(user.email, new Date(), scopeId);
  const acct = getAccount(user.email, scopeId);
  const holding = acct.holdings.find((h) => h.symbol === symbol);

  // Universe is empty (e.g. floor.marketRegion = "UAE" but our V1
  // catalog is Indian-only). Show a clear panel so the user knows
  // why the trade ticket is blank.
  if (availableStocks.length === 0) {
    return (
      <>
        {floor && <CompetitionBanner floor={floor} />}
        <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-6">
          <h1 className="text-xl font-semibold">No instruments configured</h1>
          <p className="mt-2 text-sm text-ink-300">
            This competition is set to{" "}
            <strong>{floor?.marketRegion}</strong> · {floor?.stockUniverse.kind}
            {" "}with asset classes{" "}
            <strong>{floor?.assetClasses.join(", ")}</strong>, but no
            instruments matching that filter are loaded yet. Multi-region
            catalogs land in a future phase.
          </p>
          <Link
            href={`/trade-floors/${floor?.id ?? ""}`}
            className="mt-4 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
          >
            Back to leaderboard
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {floor && <CompetitionBanner floor={floor} />}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            {floor ? "Competition trading" : "Paper trading"}
          </div>
          <h1 className="mt-1 text-3xl font-semibold">
            {floor ? floor.name : "Trade ticket"}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-ink-400">
            Simulated order engine: Market / Limit / Stop / Stop-Limit, book
            walked for slippage, 250–500ms latency, partial fills. Every ₹
            is paper.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SessionChip />
          <Link
            href={`/chart/${symbol}`}
            className="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
          >
            Open chart →
          </Link>
          <Link
            href={
              floor
                ? `/trade-floors/${floor.id}`
                : "/trade/history"
            }
            className="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
          >
            {floor ? "Leaderboard →" : "Order history →"}
          </Link>
        </div>
      </div>

      <PortfolioRow pv={pv} cash={acct.cash} />

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
          <SymbolPicker
            symbol={symbol}
            setSymbol={setSymbol}
            stocks={availableStocks}
          />
          <Quote symbol={symbol} book={book} holding={holding} key={tick} />
          <OrderBook book={book} />
        </section>

        <section>
          <OrderTicket
            symbol={symbol}
            book={book}
            scopeId={scopeId}
            onAck={(m) => {
              setAck(m);
              setErr(null);
              refresh();
            }}
            onErr={(m) => {
              setErr(m);
              setAck(null);
            }}
          />
          {(ack || err) && (
            <p
              className={
                "mt-3 rounded-md border px-3 py-2 text-sm " +
                (err
                  ? "border-red-500/30 bg-red-500/5 text-red-300"
                  : "border-brand-500/40 bg-brand-500/5 text-brand-200")
              }
            >
              {err ?? ack}
            </p>
          )}

          <OpenOrders opens={opens} refresh={refresh} scopeId={scopeId} />
        </section>
      </div>

      <Holdings orders={orders} scopeId={scopeId} />

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

function CompetitionBanner({ floor }: { floor: TradeFloor }) {
  const now = Date.now();
  const status =
    now < floor.startAt
      ? "upcoming"
      : now > floor.endAt
        ? "ended"
        : "live";
  const statusCls =
    status === "live"
      ? "border-brand-500/40 bg-brand-500/5 text-brand-200"
      : status === "upcoming"
        ? "border-amber-500/40 bg-amber-500/5 text-amber-200"
        : "border-ink-700 bg-ink-900/40 text-ink-300";
  return (
    <div
      className={
        "mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm " +
        statusCls
      }
    >
      <div>
        <span className="font-medium">Trading in {floor.name}</span>
        <span className="mx-2 text-ink-500">·</span>
        <span className="text-xs uppercase tracking-wider">
          {status === "live"
            ? "Window live"
            : status === "upcoming"
              ? "Window opens "
              : "Window closed"}
          {status !== "live" && new Date(floor.startAt).toLocaleString()}
        </span>
        <span className="mx-2 text-ink-500">·</span>
        <span className="text-xs">
          {formatRupees(floor.virtualCapital)} starting · {floor.marketRegion}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/trade-floors/${floor.id}`}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-100 hover:bg-ink-900"
        >
          Leaderboard →
        </Link>
        <Link
          href="/trade"
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-100 hover:bg-ink-900"
        >
          Exit competition
        </Link>
      </div>
    </div>
  );
}

function SessionChip() {
  const [s, setS] = useState(sessionAt());
  useEffect(() => {
    const iv = setInterval(() => setS(sessionAt()), 30_000);
    return () => clearInterval(iv);
  }, []);
  const tone =
    s === "open"
      ? "bg-brand-500/15 text-brand-300"
      : s === "pre" || s === "post"
        ? "bg-amber-500/15 text-amber-300"
        : "bg-ink-800 text-ink-400";
  return (
    <span
      className={
        "rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider " +
        tone
      }
      title={sessionLabel(s)}
    >
      {s === "open" ? "Live" : s === "pre" ? "Pre-open" : s === "post" ? "Close block" : "Closed"}
    </span>
  );
}

function PortfolioRow({
  pv,
  cash,
}: {
  pv: ReturnType<typeof portfolioValue>;
  cash: number;
}) {
  const up = pv.pnlPct >= 0;
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Stat
        label="Total value"
        value={`₹${pv.total.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
        sub={`${up ? "+" : ""}${pv.pnlPct.toFixed(2)}%`}
        tone={up ? "good" : "bad"}
      />
      <Stat
        label="Cash"
        value={`₹${cash.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
      />
      <Stat
        label="Market value"
        value={`₹${pv.marketValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
      />
      <Stat
        label="Unrealised P&L"
        value={`${pv.pnl >= 0 ? "+" : ""}₹${Math.round(pv.pnl).toLocaleString("en-IN")}`}
        tone={pv.pnl >= 0 ? "good" : "bad"}
      />
    </section>
  );
}

function SymbolPicker({
  symbol,
  setSymbol,
  stocks,
}: {
  symbol: string;
  setSymbol: (s: string) => void;
  stocks: Stock[];
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-ink-300">
        <span>Symbol</span>
        <span className="text-[10px] uppercase tracking-wider text-ink-500">
          {stocks.length} instrument{stocks.length === 1 ? "" : "s"}
        </span>
      </span>
      <select
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        className="input max-w-md"
      >
        {stocks.map((s) => (
          <option key={s.symbol} value={s.symbol}>
            {s.symbol} — {s.name} ({s.sector})
          </option>
        ))}
      </select>
    </label>
  );
}

function Quote({
  symbol,
  book,
  holding,
}: {
  symbol: string;
  book: L2Book;
  holding: { shares: number; avgPrice: number } | undefined;
}) {
  const mid = book.mid;
  return (
    <div className="mt-4 flex flex-wrap items-end justify-between gap-3 rounded-lg border border-ink-700 bg-ink-950 p-4">
      <div>
        <div className="text-xs uppercase tracking-wider text-ink-500">{symbol}</div>
        <div className="mt-1 text-3xl font-semibold">
          ₹{mid.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </div>
        <div className="mt-0.5 text-xs text-ink-500">
          Spread {book.spreadPct.toFixed(3)}% · best bid ₹
          {book.bids[0].price.toFixed(2)} · best ask ₹
          {book.asks[0].price.toFixed(2)}
        </div>
      </div>
      {holding && (
        <div className="text-right text-xs text-ink-400">
          <div>
            You hold{" "}
            <span className="text-ink-100 font-mono">{holding.shares}</span> @ ₹
            {holding.avgPrice.toFixed(2)}
          </div>
          <div>
            Unrealised{" "}
            <span
              className={
                (mid - holding.avgPrice) * holding.shares >= 0
                  ? "text-brand-300 font-mono"
                  : "text-red-300 font-mono"
              }
            >
              ₹
              {Math.round(
                (mid - holding.avgPrice) * holding.shares,
              ).toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderBook({ book }: { book: L2Book }) {
  const maxSize = Math.max(
    ...book.bids.map((b) => b.size),
    ...book.asks.map((a) => a.size),
  );
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-ink-700">
      <header className="grid grid-cols-3 gap-2 border-b border-ink-700 bg-ink-900/60 px-4 py-2 text-[10px] uppercase tracking-wider text-ink-400">
        <span>Bid size</span>
        <span className="text-center">Price</span>
        <span className="text-right">Ask size</span>
      </header>
      <ul className="divide-y divide-ink-900 text-sm">
        {[...book.asks].reverse().map((lv, i) => (
          <li
            key={"a" + i}
            className="relative grid grid-cols-3 gap-2 px-4 py-1.5"
          >
            <span />
            <span className="text-center font-mono text-red-300">
              {lv.price.toFixed(2)}
            </span>
            <span className="text-right font-mono text-ink-200">{lv.size}</span>
            <span
              className="pointer-events-none absolute inset-y-0 right-0 -z-10 bg-red-500/5"
              style={{ width: `${(lv.size / maxSize) * 40}%` }}
            />
          </li>
        ))}
        <li className="border-y border-ink-700 bg-ink-950 px-4 py-1.5 text-center text-xs text-ink-500">
          mid ₹{book.mid.toFixed(2)} · spread {book.spreadPct.toFixed(3)}%
        </li>
        {book.bids.map((lv, i) => (
          <li
            key={"b" + i}
            className="relative grid grid-cols-3 gap-2 px-4 py-1.5"
          >
            <span className="font-mono text-ink-200">{lv.size}</span>
            <span className="text-center font-mono text-brand-300">
              {lv.price.toFixed(2)}
            </span>
            <span />
            <span
              className="pointer-events-none absolute inset-y-0 left-0 -z-10 bg-brand-500/5"
              style={{ width: `${(lv.size / maxSize) * 40}%` }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrderTicket({
  symbol,
  book,
  scopeId,
  onAck,
  onErr,
}: {
  symbol: string;
  book: L2Book;
  scopeId: string;
  onAck: (msg: string) => void;
  onErr: (msg: string) => void;
}) {
  const { user } = useSession();
  const [side, setSide] = useState<OrderSide>("buy");
  const [kind, setKind] = useState<OrderKind>("market");
  const [qty, setQty] = useState<number>(10);
  const [limitPrice, setLimitPrice] = useState<number>(
    +book.asks[0].price.toFixed(2),
  );
  const [stopPrice, setStopPrice] = useState<number>(
    +book.mid.toFixed(2),
  );

  useEffect(() => {
    setLimitPrice(+book.asks[0].price.toFixed(2));
    setStopPrice(+book.mid.toFixed(2));
  }, [symbol, book]);

  if (!user) return null;

  const estPrice =
    kind === "market" ? (side === "buy" ? book.asks[0].price : book.bids[0].price) : limitPrice;
  const estValue = estPrice * qty;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const r = placeOrder(
      user!.email,
      {
        symbol,
        side,
        kind,
        qty,
        limitPrice: kind === "limit" || kind === "stop-limit" ? limitPrice : undefined,
        stopPrice: kind === "stop" || kind === "stop-limit" ? stopPrice : undefined,
      },
      undefined,
      scopeId,
    );
    if (!r.ok) {
      onErr(r.error);
      return;
    }
    onAck(`${side.toUpperCase()} ${qty} ${symbol} submitted — filling…`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5"
    >
      <div className="flex gap-1.5">
        {(["buy", "sell"] as OrderSide[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={
              "flex-1 rounded-md border py-2 text-sm font-semibold uppercase tracking-wider transition " +
              (side === s
                ? s === "buy"
                  ? "border-brand-500 bg-brand-500/15 text-brand-200"
                  : "border-red-500 bg-red-500/10 text-red-300"
                : "border-ink-700 text-ink-300 hover:border-ink-500")
            }
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {(["market", "limit", "stop", "stop-limit"] as OrderKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={
              "rounded-md border px-2.5 py-1 text-xs transition " +
              (kind === k
                ? "border-brand-500 bg-brand-500/10 text-brand-200"
                : "border-ink-700 text-ink-300 hover:border-ink-500")
            }
          >
            {k}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="mb-1 block text-xs font-medium text-ink-300">Quantity</span>
        <input
          type="number"
          min={1}
          step={1}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          className="input"
        />
      </label>

      {(kind === "limit" || kind === "stop-limit") && (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Limit price (₹)
          </span>
          <input
            type="number"
            step="0.01"
            value={limitPrice}
            onChange={(e) => setLimitPrice(Number(e.target.value))}
            className="input"
          />
        </label>
      )}
      {(kind === "stop" || kind === "stop-limit") && (
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Stop price (₹)
          </span>
          <input
            type="number"
            step="0.01"
            value={stopPrice}
            onChange={(e) => setStopPrice(Number(e.target.value))}
            className="input"
          />
        </label>
      )}

      <div className="mt-4 rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-xs text-ink-400">
        Est. value{" "}
        <span className="font-mono text-ink-100">
          ₹{estValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>{" "}
        @ ₹{estPrice.toFixed(2)}
      </div>

      <button
        type="submit"
        className={
          "mt-4 w-full rounded-md py-2.5 text-sm font-semibold transition " +
          (side === "buy"
            ? "bg-brand-500 text-ink-950 hover:bg-brand-300"
            : "bg-red-500 text-ink-50 hover:bg-red-400")
        }
      >
        Submit {side === "buy" ? "buy" : "sell"} order
      </button>
      <p className="mt-2 text-[10px] text-ink-500">
        Fills come back in 250–500ms after walking the synthesised book. Zero
        real money — ever.
      </p>
    </form>
  );
}

function OpenOrders({
  opens,
  refresh,
  scopeId,
}: {
  opens: Order[];
  refresh: () => void;
  scopeId: string;
}) {
  const { user } = useSession();
  if (!user) return null;
  if (opens.length === 0) return null;
  return (
    <section className="mt-4 rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
      <h3 className="text-sm font-medium uppercase tracking-wider text-ink-400">
        Open orders ({opens.length})
      </h3>
      <ul className="mt-3 space-y-2 text-sm">
        {opens.map((o) => (
          <li
            key={o.id}
            className="flex items-center justify-between rounded-md border border-ink-800 bg-ink-950 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-ink-100">
                <span className={o.side === "buy" ? "text-brand-300" : "text-red-300"}>
                  {o.side.toUpperCase()}
                </span>{" "}
                {o.qty} {o.symbol}{" "}
                <span className="text-xs text-ink-400">({o.kind})</span>
              </div>
              <div className="text-xs text-ink-500">
                {o.kind === "limit" || o.kind === "stop-limit"
                  ? `limit ₹${o.limitPrice?.toFixed(2)}`
                  : ""}
                {o.kind === "stop" || o.kind === "stop-limit"
                  ? ` stop ₹${o.stopPrice?.toFixed(2)}`
                  : ""}
                {o.filledQty > 0 && ` · ${o.filledQty}/${o.qty} filled`}
              </div>
            </div>
            <button
              onClick={() => {
                cancelOrder(user.email, o.id, scopeId);
                refresh();
              }}
              className="shrink-0 rounded-md border border-ink-700 px-2.5 py-1 text-xs text-ink-300 hover:bg-ink-900"
            >
              Cancel
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Holdings({ orders, scopeId }: { orders: Order[]; scopeId: string }) {
  const { user } = useSession();
  if (!user) return null;
  const acct = getAccount(user.email, scopeId);
  if (acct.holdings.length === 0) return null;
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-ink-700">
      <header className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-ink-700 bg-ink-900/60 px-5 py-3 text-xs uppercase tracking-wider text-ink-400">
        <span>Holding</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Avg cost</span>
        <span className="text-right">Price</span>
        <span className="text-right">P&L</span>
      </header>
      {acct.holdings.map((h) => {
        const p = price(h.symbol, new Date());
        const pnl = (p - h.avgPrice) * h.shares;
        const up = pnl >= 0;
        return (
          <div
            key={h.symbol}
            className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-4 border-b border-ink-900 px-5 py-3 text-sm last:border-b-0"
          >
            <div className="font-medium text-ink-100">{h.symbol}</div>
            <div className="text-right font-mono text-ink-200">{h.shares}</div>
            <div className="text-right font-mono text-ink-400">
              ₹{h.avgPrice.toFixed(2)}
            </div>
            <div className="text-right font-mono text-ink-200">
              ₹{p.toFixed(2)}
            </div>
            <div
              className={
                "text-right font-mono " + (up ? "text-brand-300" : "text-red-300")
              }
            >
              {up ? "+" : ""}₹{Math.round(pnl).toLocaleString("en-IN")}
            </div>
          </div>
        );
      })}
      <div className="border-t border-ink-700 bg-ink-900/40 px-5 py-3 text-xs text-ink-500">
        Orders placed all-time: {orders.length}
      </div>
    </section>
  );
}

function Stat({
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
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
      {sub && (
        <div
          className={
            "mt-0.5 text-xs " +
            (tone === "good"
              ? "text-brand-300"
              : tone === "bad"
                ? "text-red-300"
                : "text-ink-500")
          }
        >
          {sub}
        </div>
      )}
    </div>
  );
}
