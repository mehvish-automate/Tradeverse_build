"use client";

// Market data layer: OHLC bar generator, VWAP, trading sessions.
// Built on top of the deterministic daily price in lib/stocks — we
// simulate intraday by sampling a seeded noise function at regular
// intervals and bucketing into bars.
//
// Everything is deterministic per (symbol, timestamp). A real NSE
// feed replaces generateBars() later without changing callers.
//
// V0.1 disclosure: marketDataSource() is the single seam between mock
// and live. Today it always returns "mock". When NEXT_PUBLIC_LIVE_QUOTES
// is wired to a real provider (Polygon / Alpha Vantage / NSE feed),
// this returns "live" and downstream callers can swap their underlying
// price() → providerQuote() implementation. Until then, the UI shows
// a "Synthetic prices" disclosure so users aren't misled.

import { getStock, price } from "./stocks";

export type MarketDataSource = "mock" | "live";

export function marketDataSource(): MarketDataSource {
  // Wire to a real provider by setting NEXT_PUBLIC_LIVE_QUOTES=1 and
  // implementing the live path in tickPrice / generateBars. Until then,
  // honest default = "mock".
  if (typeof process !== "undefined") {
    if (process.env.NEXT_PUBLIC_LIVE_QUOTES === "1") return "live";
  }
  return "mock";
}

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1d" | "1w";

export type Bar = {
  t: number; // bar start ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

const MS = {
  m1: 60_000,
  m5: 5 * 60_000,
  m15: 15 * 60_000,
  h1: 60 * 60_000,
  d1: 24 * 60 * 60_000,
  w1: 7 * 24 * 60 * 60_000,
};

function tfMs(tf: Timeframe): number {
  switch (tf) {
    case "1m":
      return MS.m1;
    case "5m":
      return MS.m5;
    case "15m":
      return MS.m15;
    case "1h":
      return MS.h1;
    case "1d":
      return MS.d1;
    case "1w":
      return MS.w1;
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/** Seeded noise in [-1, 1]. */
function noise(symbol: string, tMs: number): number {
  const seed = hash(`${symbol}|${Math.floor(tMs / 60_000)}`);
  const a = ((seed % 10000) / 10000) * 2 - 1;
  const b = (((seed >> 5) % 10000) / 10000) * 2 - 1;
  return (a + b) / 2;
}

/**
 * Simulated tick price at a given timestamp. Anchored to the daily
 * close from lib/stocks, then wobbled inside the day by a seeded
 * function so intraday bars are plausible and stable.
 */
export function tickPrice(symbol: string, at: Date): number {
  const s = getStock(symbol);
  if (!s) return 0;
  const dayPrice = price(symbol, at);
  const vol = s.vol;
  const intradayBand = dayPrice * (vol / 100) * 0.35;
  const n = noise(symbol, at.getTime());
  return +(dayPrice + n * intradayBand).toFixed(2);
}

/**
 * Plausible per-bar volume. Shape resembles a U: heavier at the open
 * and close, lighter midday. Weekly/daily bars aggregate into larger
 * numbers. Seeded per (symbol, timeframe, bar-start).
 */
function barVolume(
  symbol: string,
  tf: Timeframe,
  tMs: number,
  intrabar: number,
): number {
  const base = 25000 + (hash(`${symbol}|v`) % 40000);
  // Time-of-day U: factor ranges 0.4 (midday) to 1.6 (open/close).
  const mins = (new Date(tMs).getUTCHours() * 60 + new Date(tMs).getUTCMinutes()) % (6 * 60 + 15); // trading-day minutes
  const total = 6 * 60 + 15;
  const tod = total > 0 ? mins / total : 0.5; // 0..1
  const uShape = 1 - 2 * Math.abs(0.5 - tod); // 0..1 midday..edges, invert
  const factor = 0.4 + (1 - uShape) * 1.2;
  const tfMultiplier =
    tf === "1m" ? 1 : tf === "5m" ? 5 : tf === "15m" ? 15 : tf === "1h" ? 60 : tf === "1d" ? 375 : 5 * 375;
  const seedWobble =
    ((hash(`${symbol}|${tMs}|${intrabar}`) % 300) / 300) * 0.4 + 0.8; // 0.8..1.2
  return Math.max(200, Math.round(base * factor * tfMultiplier * seedWobble * 0.015));
}

/**
 * Generate `count` bars of the given timeframe ending at `asOf`.
 * Samples tickPrice at ~10 points per bar and aggregates to O/H/L/C.
 */
export function generateBars(
  symbol: string,
  tf: Timeframe,
  count: number,
  asOf: Date = new Date(),
): Bar[] {
  const step = tfMs(tf);
  const end = Math.floor(asOf.getTime() / step) * step;
  const bars: Bar[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const t = end - i * step;
    const subSamples = 10;
    const samples: number[] = [];
    for (let s = 0; s < subSamples; s++) {
      const ts = t + Math.floor((step * s) / subSamples);
      samples.push(tickPrice(symbol, new Date(ts)));
    }
    const o = samples[0];
    const c = samples[samples.length - 1];
    const h = Math.max(...samples);
    const l = Math.min(...samples);
    const v = barVolume(symbol, tf, t, i);
    bars.push({ t, o, h, l, c, v });
  }
  return bars;
}

/** Volume-weighted average price over a bar set. */
export function vwap(bars: Bar[]): number {
  let num = 0;
  let denom = 0;
  for (const b of bars) {
    const typical = (b.h + b.l + b.c) / 3;
    num += typical * b.v;
    denom += b.v;
  }
  return denom > 0 ? +(num / denom).toFixed(2) : 0;
}

// --- Trading sessions (IST) ---

export type Session = "pre" | "open" | "post" | "closed";

/**
 * Maps a Date to NSE equity session. Pre-open 09:00–09:15, regular
 * 09:15–15:30, post/closing 15:40–16:00, closed otherwise + weekends.
 * We treat browser-local time as IST for the demo.
 */
export function sessionAt(date: Date = new Date()): Session {
  const day = date.getDay();
  if (day === 0 || day === 6) return "closed";
  const h = date.getHours();
  const m = date.getMinutes();
  const mins = h * 60 + m;
  if (mins >= 9 * 60 && mins < 9 * 60 + 15) return "pre";
  if (mins >= 9 * 60 + 15 && mins < 15 * 60 + 30) return "open";
  if (mins >= 15 * 60 + 40 && mins < 16 * 60) return "post";
  return "closed";
}

export function sessionLabel(s: Session): string {
  if (s === "pre") return "Pre-open (09:00–09:15 IST)";
  if (s === "open") return "Live (09:15–15:30 IST)";
  if (s === "post") return "Closing block (15:40–16:00 IST)";
  return "Closed";
}

// --- Indicator computations ---

/** Simple moving average over the last N bars' closes. */
export function sma(bars: Bar[], period: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i + 1 < period) {
      out.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += bars[i - j].c;
    out.push(sum / period);
  }
  return out;
}

/** Standard RSI(14) via Wilder's smoothing. */
export function rsi(bars: Bar[], period = 14): number[] {
  const out: number[] = new Array(bars.length).fill(NaN);
  if (bars.length < period + 1) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = bars[i].c - bars[i - 1].c;
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  out[period] = 100 - 100 / (1 + gain / Math.max(1e-9, loss));
  for (let i = period + 1; i < bars.length; i++) {
    const d = bars[i].c - bars[i - 1].c;
    const g = Math.max(0, d);
    const l = Math.max(0, -d);
    gain = (gain * (period - 1) + g) / period;
    loss = (loss * (period - 1) + l) / period;
    out[i] = 100 - 100 / (1 + gain / Math.max(1e-9, loss));
  }
  return out;
}

/** Bollinger Bands (period, stdDev). Returns upper/mid/lower series. */
export function bollinger(
  bars: Bar[],
  period = 20,
  std = 2,
): { upper: number[]; mid: number[]; lower: number[] } {
  const mid = sma(bars, period);
  const upper = new Array(bars.length).fill(NaN);
  const lower = new Array(bars.length).fill(NaN);
  for (let i = 0; i < bars.length; i++) {
    if (i + 1 < period) continue;
    const m = mid[i];
    let acc = 0;
    for (let j = 0; j < period; j++) {
      const d = bars[i - j].c - m;
      acc += d * d;
    }
    const sd = Math.sqrt(acc / period);
    upper[i] = m + std * sd;
    lower[i] = m - std * sd;
  }
  return { upper, mid, lower };
}

function ema(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  const k = 2 / (period + 1);
  let prev = NaN;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (!Number.isFinite(prev)) {
      prev = v;
      out[i] = v;
    } else {
      prev = v * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

/** MACD(12, 26, 9). Returns the macd line, signal line, and histogram. */
export function macd(
  bars: Bar[],
  fast = 12,
  slow = 26,
  signal = 9,
): { macd: number[]; signal: number[]; hist: number[] } {
  const closes = bars.map((b) => b.c);
  const ef = ema(closes, fast);
  const es = ema(closes, slow);
  const macdLine = closes.map((_, i) =>
    Number.isFinite(ef[i]) && Number.isFinite(es[i]) ? ef[i] - es[i] : NaN,
  );
  const signalLine = ema(
    macdLine.map((v) => (Number.isFinite(v) ? v : 0)),
    signal,
  );
  const hist = macdLine.map((v, i) =>
    Number.isFinite(v) && Number.isFinite(signalLine[i]) ? v - signalLine[i] : NaN,
  );
  return { macd: macdLine, signal: signalLine, hist };
}

/** Rolling VWAP series across the bar set (useful as an overlay). */
export function vwapSeries(bars: Bar[]): number[] {
  const out: number[] = new Array(bars.length).fill(NaN);
  let num = 0;
  let denom = 0;
  for (let i = 0; i < bars.length; i++) {
    const typical = (bars[i].h + bars[i].l + bars[i].c) / 3;
    num += typical * bars[i].v;
    denom += bars[i].v;
    out[i] = denom > 0 ? num / denom : NaN;
  }
  return out;
}
