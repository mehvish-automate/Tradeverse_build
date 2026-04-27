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

export type Holding = { symbol: string; shares: number; avgPrice: number };

export type PaperAccount = {
  cash: number;
  holdings: Holding[];
  createdAt: number;
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

const ACCT_KEY = (email: string) => `tv.paper.account.${email}`;
const ORDERS_KEY = (email: string) => `tv.paper.orders.${email}`;

// --- Account ---

function emptyAccount(): PaperAccount {
  return { cash: STARTING_CASH, holdings: [], createdAt: Date.now() };
}

export function getAccount(email: string): PaperAccount {
  if (typeof window === "undefined") return emptyAccount();
  try {
    const raw = localStorage.getItem(ACCT_KEY(email));
    if (!raw) {
      const acct = emptyAccount();
      localStorage.setItem(ACCT_KEY(email), JSON.stringify(acct));
      return acct;
    }
    return JSON.parse(raw) as PaperAccount;
  } catch {
    return emptyAccount();
  }
}

function saveAccount(email: string, acct: PaperAccount) {
  localStorage.setItem(ACCT_KEY(email), JSON.stringify(acct));
}

export function resetAccount(email: string) {
  saveAccount(email, emptyAccount());
  localStorage.setItem(ORDERS_KEY(email), "[]");
  void cloudMirrorAccount();
}

// --- Orders ---

function readOrders(email: string): Order[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(ORDERS_KEY(email)) || "[]") as Order[];
  } catch {
    return [];
  }
}

function writeOrders(email: string, orders: Order[]) {
  localStorage.setItem(ORDERS_KEY(email), JSON.stringify(orders));
}

export function listOrders(email: string): Order[] {
  return readOrders(email).sort((a, b) => b.placedAt - a.placedAt);
}

export function openOrders(email: string): Order[] {
  return readOrders(email).filter(
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
  const acct = getAccount(email);
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
): { ok: true; order: Order } | { ok: false; error: string } {
  const v = validate(email, input);
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
  const all = readOrders(email);
  all.push(order);
  writeOrders(email, all);
  void cloudMirrorOrder(order);

  // Deterministic-but-feels-real latency.
  const latency = 250 + Math.floor(Math.random() * 250);
  setTimeout(() => {
    processOrder(email, order.id, onUpdate);
  }, latency);

  return { ok: true, order };
}

export function cancelOrder(email: string, orderId: string): boolean {
  const all = readOrders(email);
  const idx = all.findIndex((o) => o.id === orderId);
  if (idx < 0) return false;
  const o = all[idx];
  if (o.status !== "pending" && o.status !== "partial") return false;
  o.status = "cancelled";
  o.lastUpdated = Date.now();
  writeOrders(email, all);
  void cloudMirrorOrder(o);
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
): Order | null {
  const all = readOrders(email);
  const order = all.find((o) => o.id === orderId);
  if (!order) return null;
  const acct = getAccount(email);

  if (fills.length === 0) {
    // Limit or stop didn't execute — leave pending.
    order.lastUpdated = Date.now();
    writeOrders(email, all);
    return order;
  }

  applyFills(acct, order.symbol, order.side, fills);
  saveAccount(email, acct);

  order.fills.push(...fills);
  const totalFilled = order.fills.reduce((s, f) => s + f.qty, 0);
  const totalValue = order.fills.reduce((s, f) => s + f.qty * f.price, 0);
  order.filledQty = totalFilled;
  order.avgFillPrice = totalValue / Math.max(1, totalFilled);
  order.status = totalFilled >= order.qty ? "filled" : "partial";
  order.lastUpdated = Date.now();
  writeOrders(email, all);
  void cloudMirrorOrder(order);
  void cloudMirrorAccount();
  return order;
}

function processOrder(
  email: string,
  orderId: string,
  onUpdate?: (order: Order) => void,
) {
  const all = readOrders(email);
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
    finalizeOrder(email, orderId, fills);
  } else if (order.kind === "limit") {
    // Fill if price crosses the limit.
    const crosses =
      order.side === "buy"
        ? mid <= (order.limitPrice ?? 0)
        : mid >= (order.limitPrice ?? 0);
    if (!crosses) {
      finalizeOrder(email, orderId, []);
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
      finalizeOrder(email, orderId, fills);
    }
  } else if (order.kind === "stop") {
    // Stop becomes a market order once triggered.
    const triggered =
      order.side === "buy"
        ? mid >= (order.stopPrice ?? Infinity)
        : mid <= (order.stopPrice ?? 0);
    if (!triggered) {
      finalizeOrder(email, orderId, []);
    } else {
      const book = bookAtPrice(order.symbol, mid);
      const levels = order.side === "buy" ? book.asks : book.bids;
      const remaining = order.qty - order.filledQty;
      const { fills } = takeLiquidity(levels, remaining);
      finalizeOrder(email, orderId, fills);
    }
  } else if (order.kind === "stop-limit") {
    const triggered =
      order.side === "buy"
        ? mid >= (order.stopPrice ?? Infinity)
        : mid <= (order.stopPrice ?? 0);
    if (!triggered) {
      finalizeOrder(email, orderId, []);
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
      finalizeOrder(email, orderId, fills);
    }
  }

  const updated = readOrders(email).find((o) => o.id === orderId);
  if (updated && onUpdate) onUpdate(updated);
}

/**
 * Called periodically from the UI tick to re-check pending limit / stop
 * orders against the current price. Safe to call frequently — idempotent
 * per fill because completed orders short-circuit in processOrder.
 */
export function tickOpenOrders(email: string) {
  for (const o of openOrders(email)) {
    processOrder(email, o.id);
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

export function portfolioValue(email: string, now = new Date()): PortfolioValue {
  const acct = getAccount(email);
  let mv = 0;
  let cost = 0;
  for (const h of acct.holdings) {
    mv += h.shares * price(h.symbol, now);
    cost += h.shares * h.avgPrice;
  }
  const total = acct.cash + mv;
  const pnl = mv - cost;
  const invested = STARTING_CASH - acct.cash + cost;
  const pnlPct = invested > 0 ? (total - STARTING_CASH) / STARTING_CASH : 0;
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
