"use client";

// Paper trading engine.
//
// Invariant: zero real money. The account starts with ₹10,00,000 of
// notional cash, holdings are expressed in integer shares, and orders
// fill against a synthetic L2 book (see lib/orderbook.ts).
//
// The engine models:
//   - Market / Limit / Stop / Stop-Limit order kinds
//   - Slippage (market orders walk the book, paying worse fills)
//   - Latency (250–500ms delay before fill, via setTimeout)
//   - Partial fills (qty split across book levels)
//
// All state is localStorage — a real backend slot-in is a later phase.

import { bookAtPrice, L2Level } from "./orderbook";
import { price } from "./stocks";

// Phase 28 — fire-and-forget cloud mirrors. Imported lazily to keep
// paper.ts SSR-safe and to avoid eager evaluation of the supabase client.
async function cloudMirrorOrder(order: Order) {
  try {
    const { mirrorOrder } = await import("./supabase/paper-sync");
    await mirrorOrder(order);
  } catch {
    // Cloud mirror is best-effort; localStorage stays authoritative.
  }
}
async function cloudMirrorAccount() {
  try {
    const { mirrorAccountState } = await import("./supabase/paper-sync");
    await mirrorAccountState();
  } catch {
    // best-effort
  }
}

const STARTING_CASH = 1_000_000;

/**
 * Phase 45.5 — paper accounts can be scoped to a virtual trading
 * competition (a trade-floor id). When `scopeId` is the sentinel
 * GLOBAL_SCOPE, behaviour matches the pre-Phase-45.5 single-account
 * model and continues to mirror to Supabase. Floor-scoped accounts
 * (any other scopeId) live in localStorage only for V0.5 — cloud
 * sync of scoped writes lands once the orders/paper_holdings tables
 * pick up a scope_id column.
 */
export const GLOBAL_SCOPE = "global";

export type Holding = { symbol: string; shares: number; avgPrice: number };

export type PaperAccount = {
  cash: number;
  holdings: Holding[];
  createdAt: number;
  /** Optional capital baseline for P&L calc. Defaults to STARTING_CASH. */
  startingCash?: number;
};

export type OrderKind = "market" | "limit" | "stop" | "stop-limit";
export type OrderSide = "buy" | "sell";
export type OrderStatus =
  | "pending"
  | "partial"
  | "filled"
  | "cancelled"
  | "rejected";

export type Fill = { qty: number; price: number; ts: number };

export type Order = {
  id: string;
  symbol: string;
  side: OrderSide;
  kind: OrderKind;
  qty: number;
  filledQty: number;
  avgFillPrice: number;
  limitPrice?: number;
  stopPrice?: number;
  status: OrderStatus;
  placedAt: number;
  lastUpdated: number;
  fills: Fill[];
  note?: string;
};

const ACCT_KEY = (email: string, scope: string) =>
  scope === GLOBAL_SCOPE
    ? `tv.paper.account.${email}`
    : `tv.paper.account.${email}.${scope}`;
const ORDERS_KEY = (email: string, scope: string) =>
  scope === GLOBAL_SCOPE
    ? `tv.paper.orders.${email}`
    : `tv.paper.orders.${email}.${scope}`;

// --- Account ---

function emptyAccount(startingCash = STARTING_CASH): PaperAccount {
  return { cash: startingCash, holdings: [], createdAt: Date.now(), startingCash };
}

export function getAccount(
  email: string,
  scopeId: string = GLOBAL_SCOPE,
): PaperAccount {
  if (typeof window === "undefined") return emptyAccount();
  try {
    const raw = localStorage.getItem(ACCT_KEY(email, scopeId));
    if (!raw) {
      const acct = emptyAccount();
      localStorage.setItem(ACCT_KEY(email, scopeId), JSON.stringify(acct));
      return acct;
    }
    return JSON.parse(raw) as PaperAccount;
  } catch {
    return emptyAccount();
  }
}

function saveAccount(
  email: string,
  acct: PaperAccount,
  scopeId: string = GLOBAL_SCOPE,
) {
  localStorage.setItem(ACCT_KEY(email, scopeId), JSON.stringify(acct));
}

/**
 * Initialize a scoped account with a specific starting cash if it
 * doesn't already exist. No-op if the account is already in storage.
 * Used by the floor-scoped trade page to seed the competition's
 * virtual capital on first visit.
 */
export function ensureAccount(
  email: string,
  scopeId: string,
  startingCash: number,
): PaperAccount {
  if (typeof window === "undefined") return emptyAccount(startingCash);
  const raw = localStorage.getItem(ACCT_KEY(email, scopeId));
  if (raw) {
    try {
      return JSON.parse(raw) as PaperAccount;
    } catch {
      // fall through to re-init
    }
  }
  const acct = emptyAccount(startingCash);
  localStorage.setItem(ACCT_KEY(email, scopeId), JSON.stringify(acct));
  return acct;
}

export function resetAccount(email: string, scopeId: string = GLOBAL_SCOPE) {
  // Preserve the original starting cash for scoped accounts.
  const existing = (() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(ACCT_KEY(email, scopeId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PaperAccount;
    } catch {
      return null;
    }
  })();
  const startingCash = existing?.startingCash ?? STARTING_CASH;
  saveAccount(email, emptyAccount(startingCash), scopeId);
  localStorage.setItem(ORDERS_KEY(email, scopeId), "[]");
  if (scopeId === GLOBAL_SCOPE) void cloudMirrorAccount();
}

// --- Orders ---

function readOrders(
  email: string,
  scopeId: string = GLOBAL_SCOPE,
): Order[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(
      localStorage.getItem(ORDERS_KEY(email, scopeId)) || "[]",
    ) as Order[];
  } catch {
    return [];
  }
}

function writeOrders(
  email: string,
  orders: Order[],
  scopeId: string = GLOBAL_SCOPE,
) {
  localStorage.setItem(ORDERS_KEY(email, scopeId), JSON.stringify(orders));
}

export function listOrders(
  email: string,
  scopeId: string = GLOBAL_SCOPE,
): Order[] {
  return readOrders(email, scopeId).sort((a, b) => b.placedAt - a.placedAt);
}

export function openOrders(
  email: string,
  scopeId: string = GLOBAL_SCOPE,
): Order[] {
  return readOrders(email, scopeId).filter(
    (o) => o.status === "pending" || o.status === "partial",
  );
}

function genId(): string {
  // UUID so local ids match the orders.id uuid column in Supabase.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (older runtimes / SSR) — shape-compatible with uuid v4.
  const hex = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${((Math.random() * 4) | 8).toString(16)}${hex(3)}-${hex(12)}`;
}

function clampQty(n: number): number {
  return Math.max(1, Math.floor(n));
}

// --- Validation / placement ---

export type PlaceInput = {
  symbol: string;
  side: OrderSide;
  kind: OrderKind;
  qty: number;
  limitPrice?: number;
  stopPrice?: number;
};

export function validate(
  email: string,
  input: PlaceInput,
  scopeId: string = GLOBAL_SCOPE,
): { ok: true } | { ok: false; error: string } {
  if (!input.symbol) return { ok: false, error: "Pick a symbol." };
  const qty = clampQty(input.qty);
  if (qty <= 0) return { ok: false, error: "Quantity must be ≥ 1." };

  if (input.kind === "limit" || input.kind === "stop-limit") {
    if (!input.limitPrice || input.limitPrice <= 0)
      return { ok: false, error: "Limit price required." };
  }
  if (input.kind === "stop" || input.kind === "stop-limit") {
    if (!input.stopPrice || input.stopPrice <= 0)
      return { ok: false, error: "Stop price required." };
  }

  // Buy power check against a conservative estimate.
  const acct = getAccount(email, scopeId);
  if (input.side === "buy") {
    const estPrice = input.limitPrice ?? price(input.symbol, new Date());
    const est = estPrice * qty * 1.002; // small buffer for slippage
    if (est > acct.cash)
      return {
        ok: false,
        error: `Need ≈ ₹${est.toLocaleString("en-IN", { maximumFractionDigits: 0 })}, have ₹${acct.cash.toLocaleString("en-IN", { maximumFractionDigits: 0 })}.`,
      };
  } else {
    const h = acct.holdings.find((x) => x.symbol === input.symbol);
    if (!h || h.shares < qty)
      return { ok: false, error: `You hold ${h?.shares ?? 0} shares of ${input.symbol}.` };
  }
  return { ok: true };
}

export function placeOrder(
  email: string,
  input: PlaceInput,
  onUpdate?: (order: Order) => void,
  scopeId: string = GLOBAL_SCOPE,
): { ok: true; order: Order } | { ok: false; error: string } {
  const v = validate(email, input, scopeId);
  if (!v.ok) return v;

  const now = Date.now();
  const order: Order = {
    id: genId(),
    symbol: input.symbol,
    side: input.side,
    kind: input.kind,
    qty: clampQty(input.qty),
    filledQty: 0,
    avgFillPrice: 0,
    limitPrice: input.limitPrice,
    stopPrice: input.stopPrice,
    status: "pending",
    placedAt: now,
    lastUpdated: now,
    fills: [],
  };
  const all = readOrders(email, scopeId);
  all.push(order);
  writeOrders(email, all, scopeId);
  if (scopeId === GLOBAL_SCOPE) void cloudMirrorOrder(order);

  // Deterministic-but-feels-real latency.
  const latency = 250 + Math.floor(Math.random() * 250);
  setTimeout(() => {
    processOrder(email, order.id, onUpdate, scopeId);
  }, latency);

  return { ok: true, order };
}

export function cancelOrder(
  email: string,
  orderId: string,
  scopeId: string = GLOBAL_SCOPE,
): boolean {
  const all = readOrders(email, scopeId);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return false;
  const o = all[idx];
  if (o.status !== "pending" && o.status !== "partial") return false;
  o.status = "cancelled";
  o.lastUpdated = Date.now();
  writeOrders(email, all, scopeId);
  if (scopeId === GLOBAL_SCOPE) void cloudMirrorOrder(o);
  return true;
}

// --- Matching engine ---

function takeLiquidity(
  levels: L2Level[],
  qtyNeeded: number,
): { fills: Fill[]; totalFilled: number } {
  // Walk the book, filling at each level until qty satisfied or book empty.
  const fills: Fill[] = [];
  let remaining = qtyNeeded;
  const ts = Date.now();
  for (const lv of levels) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, lv.size);
    if (take <= 0) continue;
    fills.push({ qty: take, price: lv.price, ts });
    remaining -= take;
  }
  return { fills, totalFilled: qtyNeeded - remaining };
}

function applyFills(
  acct: PaperAccount,
  symbol: string,
  side: OrderSide,
  fills: Fill[],
): PaperAccount {
  const totalQty = fills.reduce((s, f) => s + f.qty, 0);
  const totalCost = fills.reduce((s, f) => s + f.qty * f.price, 0);
  const h = acct.holdings.find((x) => x.symbol === symbol);

  if (side === "buy") {
    acct.cash -= totalCost;
    if (h) {
      const newShares = h.shares + totalQty;
      h.avgPrice = (h.avgPrice * h.shares + totalCost) / Math.max(1, newShares);
      h.shares = newShares;
    } else {
      acct.holdings.push({
        symbol,
        shares: totalQty,
        avgPrice: totalCost / totalQty,
      });
    }
  } else {
    acct.cash += totalCost;
    if (h) {
      h.shares -= totalQty;
      if (h.shares <= 0) {
        acct.holdings = acct.holdings.filter((x) => x.symbol !== symbol);
      }
    }
  }
  return acct;
}

function finalizeOrder(
  email: string,
  orderId: string,
  fills: Fill[],
  scopeId: string = GLOBAL_SCOPE,
): Order | null {
  const all = readOrders(email, scopeId);
  const order = all.find((o) => o.id === orderId);
  if (!order) return null;
  const acct = getAccount(email, scopeId);

  if (fills.length === 0) {
    // Limit or stop didn't execute — leave pending.
    order.lastUpdated = Date.now();
    writeOrders(email, all, scopeId);
    return order;
  }

  applyFills(acct, order.symbol, order.side, fills);
  saveAccount(email, acct, scopeId);

  order.fills.push(...fills);
  const totalFilled = order.fills.reduce((s, f) => s + f.qty, 0);
  const totalValue = order.fills.reduce((s, f) => s + f.qty * f.price, 0);
  order.filledQty = totalFilled;
  order.avgFillPrice = totalValue / Math.max(1, totalFilled);
  order.status = totalFilled >= order.qty ? "filled" : "partial";
  order.lastUpdated = Date.now();
  writeOrders(email, all, scopeId);
  if (scopeId === GLOBAL_SCOPE) {
    void cloudMirrorOrder(order);
    void cloudMirrorAccount();
  }
  return order;
}

function processOrder(
  email: string,
  orderId: string,
  onUpdate?: (order: Order) => void,
  scopeId: string = GLOBAL_SCOPE,
) {
  const all = readOrders(email, scopeId);
  const order = all.find((o) => o.id === orderId);
  if (!order) return;
  if (order.status === "cancelled" || order.status === "filled") return;

  const now = new Date();
  const mid = price(order.symbol, now);

  if (order.kind === "market") {
    const book = bookAtPrice(order.symbol, mid);
    const levels = order.side === "buy" ? book.asks : book.bids;
    const remaining = order.qty - order.filledQty;
    const { fills } = takeLiquidity(levels, remaining);
    finalizeOrder(email, orderId, fills, scopeId);
  } else if (order.kind === "limit") {
    // Fill if price crosses the limit.
    const crosses =
      order.side === "buy"
        ? mid <= (order.limitPrice ?? 0)
        : mid >= (order.limitPrice ?? 0);
    if (!crosses) {
      finalizeOrder(email, orderId, [], scopeId);
    } else {
      const book = bookAtPrice(order.symbol, mid);
      const allLevels = order.side === "buy" ? book.asks : book.bids;
      const levels = allLevels.filter((l) =>
        order.side === "buy"
          ? l.price <= (order.limitPrice ?? Infinity)
          : l.price >= (order.limitPrice ?? 0),
      );
      const remaining = order.qty - order.filledQty;
      const { fills } = takeLiquidity(levels, remaining);
      finalizeOrder(email, orderId, fills, scopeId);
    }
  } else if (order.kind === "stop") {
    const triggered =
      order.side === "buy"
        ? mid >= (order.stopPrice ?? Infinity)
        : mid <= (order.stopPrice ?? 0);
    if (!triggered) {
      finalizeOrder(email, orderId, [], scopeId);
    } else {
      const book = bookAtPrice(order.symbol, mid);
      const levels = order.side === "buy" ? book.asks : book.bids;
      const remaining = order.qty - order.filledQty;
      const { fills } = takeLiquidity(levels, remaining);
      finalizeOrder(email, orderId, fills, scopeId);
    }
  } else if (order.kind === "stop-limit") {
    const triggered =
      order.side === "buy"
        ? mid >= (order.stopPrice ?? Infinity)
        : mid <= (order.stopPrice ?? 0);
    if (!triggered) {
      finalizeOrder(email, orderId, [], scopeId);
    } else {
      const book = bookAtPrice(order.symbol, mid);
      const allLevels = order.side === "buy" ? book.asks : book.bids;
      const levels = allLevels.filter((l) =>
        order.side === "buy"
          ? l.price <= (order.limitPrice ?? Infinity)
          : l.price >= (order.limitPrice ?? 0),
      );
      const remaining = order.qty - order.filledQty;
      const { fills } = takeLiquidity(levels, remaining);
      finalizeOrder(email, orderId, fills, scopeId);
    }
  }

  const updated = readOrders(email, scopeId).find((o) => o.id === orderId);
  if (updated && onUpdate) onUpdate(updated);
}

/**
 * Called periodically from the UI tick to re-check pending limit / stop
 * orders against the current price. Safe to call frequently — idempotent
 * per fill because completed orders short-circuit in processOrder.
 */
export function tickOpenOrders(email: string, scopeId: string = GLOBAL_SCOPE) {
  for (const o of openOrders(email, scopeId)) {
    processOrder(email, o.id, undefined, scopeId);
  }
}

// --- Derived ---

export type PortfolioValue = {
  cash: number;
  marketValue: number;
  total: number;
  pnl: number;
  pnlPct: number;
};

export function portfolioValue(
  email: string,
  now: Date = new Date(),
  scopeId: string = GLOBAL_SCOPE,
): PortfolioValue {
  const acct = getAccount(email, scopeId);
  const baseline = acct.startingCash ?? STARTING_CASH;
  let mv = 0;
  let cost = 0;
  for (const h of acct.holdings) {
    mv += h.shares * price(h.symbol, now);
    cost += h.shares * h.avgPrice;
  }
  const total = acct.cash + mv;
  const pnl = mv - cost;
  const invested = baseline - acct.cash + cost;
  const pnlPct = invested > 0 ? (total - baseline) / baseline : 0;
  return {
    cash: acct.cash,
    marketValue: mv,
    total,
    pnl,
    pnlPct: +(pnlPct * 100).toFixed(2),
  };
}

export function ordersPlacedCount(email: string): number {
  return readOrders(email).length;
}

export { STARTING_CASH };
