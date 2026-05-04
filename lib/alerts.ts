"use client";

// Phase: price alerts.
//
// User-defined conditions ("RELIANCE > 3600", "TCS < 3800") that fire
// into the notifications inbox when met. Storage is localStorage-only
// for V0.1; cloud sync is a future phase.
//
// Alerts are checked from two places:
//   - lib/notifications.buildFeed() — synchronously when the inbox /
//     bell counter reads, so a triggered alert always shows.
//   - SyncRuntime's 60s tick — fires checkAlerts so a tab left open
//     in the background still picks up new triggers.
//
// One-shot is the default. A triggered one-shot alert stays visible
// in the inbox + alerts list but is `armed=false` until the user
// re-arms or deletes it.

import { getStock, price } from "./stocks";

export type AlertCondition = "above" | "below";

export type PriceAlert = {
  id: string;
  symbol: string;
  condition: AlertCondition;
  price: number;
  createdAt: number;
  /** ms epoch when the alert first fired, undefined if never. */
  triggeredAt?: number;
  /** Last seen price when triggered (for the inbox blurb). */
  triggeredPrice?: number;
  /** Disarms after firing once when true (default). */
  oneShot: boolean;
  /** False after a one-shot fires; user can re-arm to listen again. */
  armed: boolean;
};

const KEY = (email: string) => `tv.alerts.${email}`;

function read(email: string): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY(email)) || "[]") as PriceAlert[];
  } catch {
    return [];
  }
}

function write(email: string, all: PriceAlert[]) {
  localStorage.setItem(KEY(email), JSON.stringify(all));
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

export function listAlerts(email: string): PriceAlert[] {
  return read(email).sort((a, b) => b.createdAt - a.createdAt);
}

export function createAlert(
  email: string,
  input: {
    symbol: string;
    condition: AlertCondition;
    price: number;
    oneShot?: boolean;
  },
): { ok: true; alert: PriceAlert } | { ok: false; error: string } {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) return { ok: false, error: "Pick a symbol." };
  if (!getStock(symbol)) {
    return { ok: false, error: `${symbol} isn't in the V1 universe.` };
  }
  const px = Number(input.price);
  if (!Number.isFinite(px) || px <= 0) {
    return { ok: false, error: "Pick a valid trigger price." };
  }
  const alert: PriceAlert = {
    id: genId(),
    symbol,
    condition: input.condition,
    price: +px.toFixed(2),
    createdAt: Date.now(),
    oneShot: input.oneShot ?? true,
    armed: true,
  };
  const all = read(email);
  all.push(alert);
  write(email, all);

  void (async () => {
    try {
      const { mirrorAlert } = await import("./supabase/alerts-sync");
      await mirrorAlert(alert);
    } catch { /* best-effort */ }
  })();

  return { ok: true, alert };
}

export function removeAlert(email: string, id: string): boolean {
  const all = read(email);
  const next = all.filter((a) => a.id !== id);
  if (next.length === all.length) return false;
  write(email, next);

  void (async () => {
    try {
      const { mirrorAlertDelete } = await import("./supabase/alerts-sync");
      await mirrorAlertDelete(id);
    } catch { /* best-effort */ }
  })();

  return true;
}

export function rearmAlert(email: string, id: string): boolean {
  const all = read(email);
  const a = all.find((x) => x.id === id);
  if (!a) return false;
  a.armed = true;
  a.triggeredAt = undefined;
  a.triggeredPrice = undefined;
  write(email, all);

  const snapshot = { ...a };
  void (async () => {
    try {
      const { mirrorAlert } = await import("./supabase/alerts-sync");
      await mirrorAlert(snapshot);
    } catch { /* best-effort */ }
  })();

  return true;
}

/**
 * Check every armed alert against current prices. Mutates fired alerts
 * to set triggeredAt + triggeredPrice and disarm one-shots. Returns
 * the alerts that fired this call (so callers can choose to push-notify
 * or surface a toast).
 */
export function checkAlerts(email: string, now = new Date()): PriceAlert[] {
  const all = read(email);
  const fired: PriceAlert[] = [];
  let dirty = false;
  for (const a of all) {
    if (!a.armed) continue;
    const last = price(a.symbol, now);
    const hit =
      (a.condition === "above" && last >= a.price) ||
      (a.condition === "below" && last <= a.price);
    if (!hit) continue;
    a.triggeredAt = now.getTime();
    a.triggeredPrice = +last.toFixed(2);
    if (a.oneShot) a.armed = false;
    fired.push(a);
    dirty = true;
  }
  if (dirty) {
    write(email, all);
    // Fire-and-forget cloud bulk-upsert so other devices see the
    // fired/disarmed state on their next pull.
    const snapshot = fired.map((a) => ({ ...a }));
    void (async () => {
      try {
        const { mirrorAlerts } = await import("./supabase/alerts-sync");
        await mirrorAlerts(snapshot);
      } catch { /* best-effort */ }
    })();
  }
  return fired;
}

/**
 * Triggered (still-listed) alerts for the notifications feed. Returns
 * one entry per fired alert with stable id so isRead() works across
 * renders.
 */
export type AlertNotification = {
  id: string;
  symbol: string;
  condition: AlertCondition;
  price: number;
  triggeredAt: number;
  triggeredPrice: number;
};

export function triggeredAlerts(email: string): AlertNotification[] {
  return read(email)
    .filter(
      (a): a is PriceAlert & { triggeredAt: number; triggeredPrice: number } =>
        Boolean(a.triggeredAt && a.triggeredPrice),
    )
    .map((a) => ({
      id: a.id,
      symbol: a.symbol,
      condition: a.condition,
      price: a.price,
      triggeredAt: a.triggeredAt!,
      triggeredPrice: a.triggeredPrice!,
    }))
    .sort((a, b) => b.triggeredAt - a.triggeredAt);
}
