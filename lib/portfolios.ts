"use client";

import { AssetClass, Sector, STOCKS, Stock, niftyPrice, niftyReturn, price } from "./stocks";

export type Holding = { symbol: string; pct: number };

export type UniverseFilter = {
  /** If set, only stocks with these sectors are allowed. */
  sectors?: Sector[];
  /** If set, only stocks with these asset classes are allowed. */
  assetClasses?: AssetClass[];
  /** If set, only Nifty-50 members (flag on Stock) are allowed. */
  nifty50Only?: boolean;
  /** If set, explicit symbol allow-list (overrides the others). */
  symbols?: string[];
};

export type StrategyPortfolio = {
  id: string;
  name: string;
  description?: string;
  createdAt: number; // ms epoch
  baseDate: string; // ISO yyyy-mm-dd — the "invested on" date
  initialCapital: number; // ₹, default 100,000
  holdings: Holding[];
  /** Optional filter on the investable universe. Omit = all symbols ok. */
  universe?: UniverseFilter;
};

/** Preset capital tiers surfaced in the create form. */
export const CAPITAL_PRESETS: { amount: number; label: string }[] = [
  { amount: 100_000,   label: "₹1 L"  },
  { amount: 500_000,   label: "₹5 L"  },
  { amount: 1_000_000, label: "₹10 L" },
  { amount: 5_000_000, label: "₹50 L" },
];

export function allowedUniverse(filter?: UniverseFilter): Stock[] {
  if (!filter) return STOCKS;
  if (filter.symbols && filter.symbols.length > 0) {
    const set = new Set(filter.symbols);
    return STOCKS.filter((s) => set.has(s.symbol));
  }
  return STOCKS.filter((s) => {
    const ac = s.assetClass ?? "stock";
    if (filter.assetClasses && filter.assetClasses.length > 0) {
      if (!filter.assetClasses.includes(ac)) return false;
    }
    if (filter.sectors && filter.sectors.length > 0) {
      if (!filter.sectors.includes(s.sector)) return false;
    }
    if (filter.nifty50Only && !s.nifty50) return false;
    return true;
  });
}

const KEY = (email: string) => `tv.portfolios.${email}`;

// --- Storage ---

function read(email: string): StrategyPortfolio[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY(email)) || "[]") as StrategyPortfolio[];
  } catch {
    return [];
  }
}

function write(email: string, all: StrategyPortfolio[]) {
  localStorage.setItem(KEY(email), JSON.stringify(all));
}

export function listPortfolios(email: string): StrategyPortfolio[] {
  return read(email).sort((a, b) => b.createdAt - a.createdAt);
}

export function getPortfolio(
  email: string,
  id: string,
): StrategyPortfolio | null {
  return read(email).find((p) => p.id === id) ?? null;
}

function genId(): string {
  // UUID so local ids match the portfolios.id uuid column in Supabase.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${((Math.random() * 4) | 8).toString(16)}${hex(3)}-${hex(12)}`;
}

// Phase 29 — fire-and-forget cloud mirrors. Lazy import to keep this
// module SSR-safe and to avoid eager evaluation of the supabase client.
async function cloudMirrorPortfolio(p: StrategyPortfolio) {
  try {
    const { mirrorPortfolio } = await import("./supabase/portfolio-sync");
    await mirrorPortfolio(p);
  } catch {
    // best-effort
  }
}
async function cloudDeletePortfolio(id: string) {
  try {
    const { deletePortfolioCloud } = await import("./supabase/portfolio-sync");
    await deletePortfolioCloud(id);
  } catch {
    // best-effort
  }
}

export function createPortfolio(
  email: string,
  input: {
    name: string;
    description?: string;
    baseDate?: string;
    initialCapital?: number;
    universe?: UniverseFilter;
  },
): { ok: true; portfolio: StrategyPortfolio } | { ok: false; error: string } {
  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: "Name too short (min 3)." };
  if (name.length > 40) return { ok: false, error: "Name too long (max 40)." };

  if (input.initialCapital != null && input.initialCapital < 10_000) {
    return { ok: false, error: "Capital must be ≥ ₹10,000." };
  }

  // Make sure the filter actually allows at least one symbol.
  const allowed = allowedUniverse(input.universe);
  if (allowed.length === 0) {
    return { ok: false, error: "Your universe filter excludes every symbol." };
  }

  const portfolio: StrategyPortfolio = {
    id: genId(),
    name,
    description: input.description?.trim() || undefined,
    createdAt: Date.now(),
    baseDate: input.baseDate || new Date().toISOString().slice(0, 10),
    initialCapital: input.initialCapital ?? 100000,
    holdings: [],
    universe: input.universe,
  };

  const all = read(email);
  all.push(portfolio);
  write(email, all);
  void cloudMirrorPortfolio(portfolio);
  return { ok: true, portfolio };
}

export function updatePortfolio(
  email: string,
  id: string,
  patch: Partial<Pick<StrategyPortfolio, "name" | "description" | "holdings">>,
): { ok: boolean; error?: string } {
  const all = read(email);
  const idx = all.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, error: "Portfolio not found." };

  if (patch.holdings) {
    const total = patch.holdings.reduce((s, h) => s + h.pct, 0);
    if (total > 100.01) {
      return { ok: false, error: `Allocations total ${total.toFixed(1)}% — keep it ≤ 100%.` };
    }
    const allowed = new Set(
      allowedUniverse(all[idx].universe).map((s) => s.symbol),
    );
    for (const h of patch.holdings) {
      if (!STOCKS.find((s) => s.symbol === h.symbol)) {
        return { ok: false, error: `Unknown symbol: ${h.symbol}` };
      }
      if (!allowed.has(h.symbol)) {
        return {
          ok: false,
          error: `${h.symbol} is outside this portfolio's universe filter.`,
        };
      }
      if (h.pct < 0 || h.pct > 100) {
        return { ok: false, error: `Allocation out of range for ${h.symbol}.` };
      }
    }
  }

  all[idx] = { ...all[idx], ...patch };
  write(email, all);
  void cloudMirrorPortfolio(all[idx]);
  return { ok: true };
}

export function deletePortfolio(email: string, id: string) {
  const all = read(email).filter((p) => p.id !== id);
  write(email, all);
  void cloudDeletePortfolio(id);
}

// --- Valuation ---

export type PortfolioSnapshot = {
  date: string;
  value: number; // ₹
  cashPct: number;
  investedPct: number;
  holdings: {
    symbol: string;
    pct: number;
    priceAtBase: number;
    priceAtAsOf: number;
    pctReturn: number;
    valueAtAsOf: number;
  }[];
  portfolioReturnPct: number;
  niftyReturnPct: number;
  alphaPct: number;
};

export function snapshot(
  portfolio: StrategyPortfolio,
  asOf: Date = new Date(),
): PortfolioSnapshot {
  const base = new Date(portfolio.baseDate);
  const cashPct = Math.max(
    0,
    100 - portfolio.holdings.reduce((s, h) => s + h.pct, 0),
  );
  const investedPct = 100 - cashPct;

  const cap = portfolio.initialCapital;
  const cashValue = (cashPct / 100) * cap;
  let investedValue = 0;
  const rows: PortfolioSnapshot["holdings"] = [];

  for (const h of portfolio.holdings) {
    const p0 = price(h.symbol, base);
    const p1 = price(h.symbol, asOf);
    const allocated = (h.pct / 100) * cap;
    const value = p0 > 0 ? (allocated * p1) / p0 : allocated;
    investedValue += value;
    rows.push({
      symbol: h.symbol,
      pct: h.pct,
      priceAtBase: p0,
      priceAtAsOf: p1,
      pctReturn: p0 > 0 ? +(((p1 - p0) / p0) * 100).toFixed(2) : 0,
      valueAtAsOf: +value.toFixed(2),
    });
  }

  const value = cashValue + investedValue;
  const portfolioReturnPct = +(((value - cap) / cap) * 100).toFixed(2);
  const niftyRet = niftyReturn(base, asOf);

  return {
    date: asOf.toISOString().slice(0, 10),
    value: +value.toFixed(2),
    cashPct: +cashPct.toFixed(2),
    investedPct: +investedPct.toFixed(2),
    holdings: rows,
    portfolioReturnPct,
    niftyReturnPct: niftyRet,
    alphaPct: +(portfolioReturnPct - niftyRet).toFixed(2),
  };
}

/** Time-series of portfolio value & benchmark value for a sparkline. */
export function valueSeries(
  portfolio: StrategyPortfolio,
  days = 30,
  asOf: Date = new Date(),
): { t: string; value: number; benchmark: number }[] {
  const base = new Date(portfolio.baseDate);
  const out: { t: string; value: number; benchmark: number }[] = [];
  const msDay = 24 * 60 * 60 * 1000;
  const asOfMs = asOf.getTime();
  const baseMs = base.getTime();
  const start = Math.max(baseMs, asOfMs - days * msDay);

  for (let t = start; t <= asOfMs; t += msDay) {
    const d = new Date(t);
    const snap = snapshot(portfolio, d);
    out.push({
      t: d.toISOString().slice(0, 10),
      value: snap.value,
      benchmark: +(
        portfolio.initialCapital *
        (niftyPrice(d) / niftyPrice(base))
      ).toFixed(2),
    });
  }
  return out;
}

// --- Tiny helpers the UI uses ---

export function totalAllocated(portfolio: StrategyPortfolio): number {
  return portfolio.holdings.reduce((s, h) => s + h.pct, 0);
}
