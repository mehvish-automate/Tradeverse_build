"use client";

import { STOCKS, Stock, getStock, pctReturn, price } from "./stocks";

const KEY = (email: string) => `tv.watchlist.${email}`;

// Phase 30 — fire-and-forget cloud mirrors. Lazy import to keep this
// module SSR-safe and to avoid eager evaluation of the supabase client.
async function cloudAdd(symbol: string) {
  try {
    const { addWatchlistCloud } = await import("./supabase/watchlist-sync");
    await addWatchlistCloud(symbol);
  } catch {
    // best-effort
  }
}
async function cloudRemove(symbol: string) {
  try {
    const { removeWatchlistCloud } = await import("./supabase/watchlist-sync");
    await removeWatchlistCloud(symbol);
  } catch {
    // best-effort
  }
}

export function getWatchlist(email: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY(email)) || "[]") as string[];
  } catch {
    return [];
  }
}

export function isWatched(email: string, symbol: string): boolean {
  return getWatchlist(email).includes(symbol);
}

export function addToWatchlist(email: string, symbol: string): boolean {
  if (!getStock(symbol)) return false;
  const cur = getWatchlist(email);
  if (cur.includes(symbol)) return true;
  cur.push(symbol);
  localStorage.setItem(KEY(email), JSON.stringify(cur));
  void cloudAdd(symbol);
  return true;
}

export function removeFromWatchlist(email: string, symbol: string) {
  const cur = getWatchlist(email).filter((s) => s !== symbol);
  localStorage.setItem(KEY(email), JSON.stringify(cur));
  void cloudRemove(symbol);
}

export type WatchlistRow = {
  stock: Stock;
  priceNow: number;
  pct1d: number;
  pct7d: number;
  pct30d: number;
  rsi: number;
  series: { t: string; p: number }[];
};

/**
 * Synthesise an RSI from our deterministic price model: ratio of
 * up-day move sum to total move sum over the last 14 days, mapped
 * into the standard 0–100 RSI scale.
 */
function synthesizeRsi(symbol: string, asOf = new Date()): number {
  const period = 14;
  let up = 0;
  let down = 0;
  const msDay = 24 * 60 * 60 * 1000;
  for (let i = period; i > 0; i--) {
    const t1 = new Date(asOf.getTime() - (i - 1) * msDay);
    const t0 = new Date(asOf.getTime() - i * msDay);
    const p0 = price(symbol, t0);
    const p1 = price(symbol, t1);
    const diff = p1 - p0;
    if (diff >= 0) up += diff;
    else down += -diff;
  }
  if (up + down === 0) return 50;
  const rs = up / Math.max(1, down);
  const rsi = 100 - 100 / (1 + rs);
  return +rsi.toFixed(1);
}

export function watchlistRows(
  email: string,
  asOf: Date = new Date(),
): WatchlistRow[] {
  const wl = getWatchlist(email);
  const days = 30;
  const msDay = 24 * 60 * 60 * 1000;
  return wl
    .map((symbol) => {
      const stock = getStock(symbol);
      if (!stock) return null;
      const priceNow = price(symbol, asOf);
      const back = (n: number) => new Date(asOf.getTime() - n * msDay);
      const series: { t: string; p: number }[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = back(i);
        series.push({
          t: d.toISOString().slice(0, 10),
          p: price(symbol, d),
        });
      }
      return {
        stock,
        priceNow,
        pct1d: pctReturn(symbol, back(1), asOf),
        pct7d: pctReturn(symbol, back(7), asOf),
        pct30d: pctReturn(symbol, back(30), asOf),
        rsi: synthesizeRsi(symbol, asOf),
        series,
      };
    })
    .filter((r): r is WatchlistRow => r !== null);
}

/**
 * Picks up any watchlisted symbol whose RSI is currently > 70 or < 30
 * so the inbox can surface it as a live alert.
 */
export type RsiAlert = {
  symbol: string;
  name: string;
  rsi: number;
  zone: "overbought" | "oversold";
};

export function currentRsiAlerts(email: string, asOf = new Date()): RsiAlert[] {
  return getWatchlist(email)
    .map((symbol) => {
      const s = getStock(symbol);
      if (!s) return null;
      const rsi = synthesizeRsi(symbol, asOf);
      if (rsi >= 70) return { symbol, name: s.name, rsi, zone: "overbought" as const };
      if (rsi <= 30) return { symbol, name: s.name, rsi, zone: "oversold" as const };
      return null;
    })
    .filter((a): a is RsiAlert => a !== null);
}

export function addableStocks(email: string): Stock[] {
  const set = new Set(getWatchlist(email));
  return STOCKS.filter((s) => !set.has(s.symbol));
}

export function watchlistCount(email: string): number {
  return getWatchlist(email).length;
}
