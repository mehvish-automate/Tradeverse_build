"use client";

// /charts — multi-symbol view. URL carries `symbols=A,B,C` and an
// optional `floor=<id>` so quick trades from any cell respect the
// active competition scope. Each cell shows a compact 30-day price
// line, last + change %, and a one-row quick-trade form.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { ChartSvg } from "@/components/ChartSvg";
import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  GLOBAL_SCOPE,
  ensureAccount,
  getAccount,
  placeOrder,
} from "@/lib/paper";
import { useSession } from "@/lib/session";
import { STOCKS, getStock, price } from "@/lib/stocks";
import { TradeFloor, getTradeFloor } from "@/lib/tradeFloors";

const MAX_OPEN = 8;

export default function ChartsPage() {
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

function parseSymbols(raw: string | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const s = part.trim().toUpperCase();
    if (!s) continue;
    if (!getStock(s)) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.slice(0, MAX_OPEN);
}

function Inner() {
  const { user } = useSession();
  const router = useRouter();
  const search = useSearchParams();

  const symbols = useMemo(
    () => parseSymbols(search?.get("symbols") ?? null),
    [search],
  );
  const floorParam = search?.get("floor")?.toUpperCase() ?? null;
  const floor: TradeFloor | null = useMemo(
    () => (floorParam ? getTradeFloor(floorParam) : null),
    [floorParam],
  );
  const scopeId = floor ? floor.id : GLOBAL_SCOPE;

  // Seed the scoped paper account once.
  useEffect(() => {
    if (!user || !floor) return;
    ensureAccount(user.email, floor.id, floor.virtualCapital);
  }, [user, floor]);

  function setSymbols(next: string[]) {
    const params = new URLSearchParams();
    if (next.length > 0) params.set("symbols", next.join(","));
    if (floor) params.set("floor", floor.id);
    const qs = params.toString();
    router.replace(qs ? `/charts?${qs}` : "/charts");
  }

  function add(sym: string) {
    if (symbols.includes(sym)) return;
    setSymbols([...symbols, sym].slice(0, MAX_OPEN));
  }

  function remove(sym: string) {
    setSymbols(symbols.filter((s) => s !== sym));
  }

  if (!user) return null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Charts
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Multi-symbol view</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-400">
            Compare up to {MAX_OPEN} symbols side-by-side. Each cell trades
            against {floor ? <strong>{floor.name}</strong> : "your global account"}{" "}
            — switch via the floor link.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {floor && (
            <span
              className="rounded-md bg-brand-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-brand-300"
              title={`Trading inside ${floor.name}`}
            >
              In {floor.name}
            </span>
          )}
          <Link
            href={floor ? `/trade?floor=${floor.id}` : "/trade"}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-100 hover:bg-ink-900"
          >
            Full ticket →
          </Link>
        </div>
      </div>

      <SymbolAdder
        open={symbols}
        onAdd={add}
        onClearAll={() => setSymbols([])}
      />

      {symbols.length === 0 ? (
        <EmptyState onPick={(s) => add(s)} />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {symbols.map((s) => (
            <ChartCell
              key={s}
              symbol={s}
              email={user.email}
              scopeId={scopeId}
              floorId={floor?.id ?? null}
              onRemove={() => remove(s)}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function SymbolAdder({
  open,
  onAdd,
  onClearAll,
}: {
  open: string[];
  onAdd: (s: string) => void;
  onClearAll: () => void;
}) {
  const [pick, setPick] = useState("");
  const remaining = STOCKS.filter((s) => !open.includes(s.symbol));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pick) return;
    onAdd(pick);
    setPick("");
  }

  const atCap = open.length >= MAX_OPEN;

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900/40 p-4"
    >
      <span className="text-xs uppercase tracking-wider text-ink-500">
        Open ({open.length}/{MAX_OPEN})
      </span>
      <div className="flex flex-1 flex-wrap gap-2 items-center min-w-[260px]">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="input flex-1 min-w-[200px]"
          disabled={atCap || remaining.length === 0}
        >
          <option value="">
            {atCap
              ? "At max — remove one to add another"
              : remaining.length === 0
                ? "All symbols open"
                : "Add a symbol…"}
          </option>
          {remaining.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.symbol} — {s.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!pick}
          className="btn-primary disabled:opacity-50"
        >
          + Add
        </button>
        {open.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="btn-ghost"
          >
            Clear all
          </button>
        )}
      </div>
    </form>
  );
}

function EmptyState({ onPick }: { onPick: (s: string) => void }) {
  const presets: { name: string; symbols: string[] }[] = [
    { name: "Banking trio", symbols: ["HDFCBANK", "ICICIBANK", "SBIN"] },
    { name: "IT trio", symbols: ["TCS", "INFY", "WIPRO"] },
    { name: "Auto trio", symbols: ["MARUTI", "TATAMOTORS", "M&M"] },
  ].filter((p) => p.symbols.every((s) => getStock(s)));

  return (
    <div className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/40 p-8 text-center">
      <h2 className="text-lg font-semibold">No charts open yet</h2>
      <p className="mt-2 text-sm text-ink-400">
        Add a symbol from the dropdown above, or jump into a preset comparison.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {presets.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => p.symbols.forEach((s) => onPick(s))}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-900"
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One chart cell — header + sparkline + compact quick trade.
// ---------------------------------------------------------------------------

function ChartCell({
  symbol,
  email,
  scopeId,
  floorId,
  onRemove,
}: {
  symbol: string;
  email: string;
  scopeId: string;
  floorId: string | null;
  onRemove: () => void;
}) {
  const stock = getStock(symbol);
  const now = new Date();

  const prices = useMemo(() => {
    const points: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      points.push(price(symbol, d));
    }
    return points;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const last = prices[prices.length - 1] ?? 0;
  const first = prices[0] ?? last;
  const changePct = first === 0 ? 0 : ((last - first) / first) * 100;
  const positive = changePct >= 0;

  // Compact quick-trade local state.
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState(10);
  const [ack, setAck] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [accTick, setAccTick] = useState(0);

  const acct = useMemo(
    () => getAccount(email, scopeId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [email, scopeId, accTick],
  );
  const holding = acct.holdings.find((h) => h.symbol === symbol);
  const estCost = last * qty;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setAck(null);
    setErr(null);
    const r = placeOrder(
      email,
      { symbol, side, kind: "market", qty },
      undefined,
      scopeId,
    );
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    setAck(`${side.toUpperCase()} ${qty} ${symbol} submitted`);
    setTimeout(() => setAccTick((t) => t + 1), 700);
    setTimeout(() => setAck(null), 2500);
  }

  if (!stock) return null;

  const chartHref =
    floorId !== null
      ? `/chart/${symbol}?floor=${floorId}`
      : `/chart/${symbol}`;

  return (
    <article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-900/40">
      <header className="flex items-center justify-between gap-2 border-b border-ink-700/70 px-4 py-2.5">
        <Link href={chartHref} className="min-w-0 flex-1 hover:bg-ink-900/40">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold text-ink-50">
              {symbol}
            </span>
            <span className="text-[10px] text-ink-500">{stock.sector}</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-ink-100">
              ₹
              {last.toLocaleString("en-IN", {
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={
                "text-xs " + (positive ? "text-brand-300" : "text-red-300")
              }
            >
              {positive ? "+" : ""}
              {changePct.toFixed(2)}%
            </span>
          </div>
        </Link>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${symbol}`}
          title="Close"
          className="rounded-md border border-ink-700 px-2 py-0.5 text-xs text-ink-400 hover:border-red-500/50 hover:text-red-300"
        >
          ×
        </button>
      </header>

      <div className="px-2 py-1">
        <ChartSvg points={prices} className="h-40 w-full" />
      </div>

      <form
        onSubmit={submit}
        className="flex flex-wrap items-center gap-2 border-t border-ink-700/70 px-3 py-2.5 text-xs"
      >
        <div className="grid grid-cols-2 gap-1">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className={
                "rounded-md border px-2 py-1 font-semibold uppercase tracking-wider transition " +
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
        <input
          type="number"
          min={1}
          step={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          className="input w-20 px-2 py-1 text-xs"
          aria-label="Quantity"
        />
        <span className="text-[11px] text-ink-500">
          ≈ ₹
          {estCost.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
        </span>
        {holding && (
          <span className="text-[11px] text-ink-500">
            holding {holding.shares}
          </span>
        )}
        <button
          type="submit"
          className={
            "ml-auto rounded-md px-3 py-1 text-xs font-semibold transition " +
            (side === "buy"
              ? "bg-brand-500 text-ink-950 hover:bg-brand-300"
              : "bg-red-500 text-ink-950 hover:bg-red-400")
          }
        >
          {side === "buy" ? "Buy" : "Sell"} {qty}
        </button>
      </form>

      {(ack || err) && (
        <div
          className={
            "border-t px-3 py-1.5 text-[11px] " +
            (err
              ? "border-red-500/30 bg-red-500/5 text-red-300"
              : "border-brand-500/40 bg-brand-500/5 text-brand-200")
          }
        >
          {err ?? ack}
        </div>
      )}
    </article>
  );
}
