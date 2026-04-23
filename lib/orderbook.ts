"use client";

// Synthetic Level-2 order book built around a given mid price.
// Deterministic per (symbol, floor-of-minute-timestamp) so the book
// stays stable for ~60 seconds at a time. Real NSE data slots in by
// replacing bookAtPrice() later.

import { getStock } from "./stocks";

export type L2Level = { price: number; size: number };

export type L2Book = {
  symbol: string;
  mid: number;
  bids: L2Level[]; // highest price first
  asks: L2Level[]; // lowest price first
  spreadPct: number;
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

/**
 * Pick a depth profile per stock. Mega caps show deeper books and
 * tighter spreads; smaller names show wider spreads and thinner depth.
 */
function depthProfile(symbol: string): {
  spreadBps: number;
  tickBps: number;
  baseSize: number;
} {
  const s = getStock(symbol);
  const vol = s?.vol ?? 1.5;
  // Tighter spread when volatility is lower.
  const spreadBps = Math.max(4, Math.round(vol * 4));
  const tickBps = Math.max(2, Math.round(vol * 2));
  const baseSize = 250 + (hash(symbol) % 400);
  return { spreadBps, tickBps, baseSize };
}

export function bookAtPrice(symbol: string, mid: number, now = new Date()): L2Book {
  const { spreadBps, tickBps, baseSize } = depthProfile(symbol);
  const bucket = Math.floor(now.getTime() / 60_000); // 60s buckets
  const seed = hash(`${symbol}|${bucket}`);

  const halfSpread = mid * (spreadBps / 10000) * 0.5;
  const tick = mid * (tickBps / 10000);

  const bids: L2Level[] = [];
  const asks: L2Level[] = [];
  for (let i = 0; i < 5; i++) {
    const sizeNoise = ((seed >> (i * 3)) % 120) / 100; // 0–1.2×
    const bidSize = Math.max(
      10,
      Math.round(baseSize * (1 + i * 0.25) * (0.6 + sizeNoise)),
    );
    const askSize = Math.max(
      10,
      Math.round(
        baseSize * (1 + i * 0.25) * (0.6 + (((seed >> (i * 5)) % 140) / 100)),
      ),
    );
    const bidPrice = +(mid - halfSpread - i * tick).toFixed(2);
    const askPrice = +(mid + halfSpread + i * tick).toFixed(2);
    bids.push({ price: bidPrice, size: bidSize });
    asks.push({ price: askPrice, size: askSize });
  }

  const spread = asks[0].price - bids[0].price;
  const spreadPct = +((spread / mid) * 100).toFixed(3);

  return { symbol, mid, bids, asks, spreadPct };
}

export function topOfBook(
  book: L2Book,
): { bid: number; ask: number; bidSize: number; askSize: number } {
  return {
    bid: book.bids[0].price,
    ask: book.asks[0].price,
    bidSize: book.bids[0].size,
    askSize: book.asks[0].size,
  };
}
