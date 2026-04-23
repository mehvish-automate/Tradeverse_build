"use client";

// Curated corporate actions. Real NSE corporate-action feed replaces
// this later; for V1 we show markers on the chart so the concept
// surfaces even without a real feed.

export type CorporateAction =
  | {
      symbol: string;
      date: string; // ISO yyyy-mm-dd (ex-date)
      kind: "split";
      ratio: [number, number]; // new:old (e.g. 2:1 means [2,1])
      note: string;
    }
  | {
      symbol: string;
      date: string;
      kind: "dividend";
      amount: number; // ₹ per share
      note: string;
    }
  | {
      symbol: string;
      date: string;
      kind: "bonus";
      ratio: [number, number]; // bonus:held (e.g. 1:2 means [1,2])
      note: string;
    };

// Offsets-from-today keep the demo data alive.
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const CORPORATE_ACTIONS: CorporateAction[] = [
  { symbol: "TATAMOTORS", date: daysAgo(120), kind: "split", ratio: [2, 1], note: "2-for-1 stock split" },
  { symbol: "ITC",        date: daysAgo(45),  kind: "dividend", amount: 6.25, note: "Interim dividend ₹6.25/sh" },
  { symbol: "RELIANCE",   date: daysAgo(200), kind: "bonus",    ratio: [1, 1], note: "1:1 bonus issue" },
  { symbol: "INFY",       date: daysAgo(30),  kind: "dividend", amount: 20,   note: "Final dividend ₹20/sh" },
  { symbol: "HDFCBANK",   date: daysAgo(60),  kind: "dividend", amount: 19,   note: "Interim dividend ₹19/sh" },
  { symbol: "TCS",        date: daysAgo(15),  kind: "dividend", amount: 28,   note: "Interim dividend ₹28/sh" },
  { symbol: "BAJFINANCE", date: daysAgo(90),  kind: "split",    ratio: [5, 1], note: "5-for-1 stock split" },
  { symbol: "HINDUNILVR", date: daysAgo(75),  kind: "dividend", amount: 17,   note: "Final dividend ₹17/sh" },
  { symbol: "ASIANPAINT", date: daysAgo(300), kind: "bonus",    ratio: [1, 2], note: "1:2 bonus issue" },
  { symbol: "MARUTI",     date: daysAgo(40),  kind: "dividend", amount: 125,  note: "Final dividend ₹125/sh" },
];

export function actionsFor(symbol: string): CorporateAction[] {
  return CORPORATE_ACTIONS.filter((a) => a.symbol === symbol).sort((a, b) =>
    a.date < b.date ? 1 : -1,
  );
}

export function actionsInWindow(
  symbol: string,
  fromMs: number,
  toMs: number,
): CorporateAction[] {
  return CORPORATE_ACTIONS.filter((a) => {
    if (a.symbol !== symbol) return false;
    const t = new Date(a.date).getTime();
    return t >= fromMs && t <= toMs;
  });
}
