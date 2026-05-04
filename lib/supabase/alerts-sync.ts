"use client";

// Alert cloud sync. Mirrors lib/alerts.ts state to Supabase so a phone
// alert fires on the laptop too.
//
// Pattern matches the rest of the codebase:
//   - Local writes (create / delete / re-arm / trigger) fire-and-forget
//     a cloud upsert/delete.
//   - SyncRuntime first-load + 60s tick pulls and merges from cloud.
//   - localStorage stays the read source of truth — the UI keeps
//     reading tv.alerts.<email> and the inbox feed builds from it.

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";
import type { PriceAlert } from "../alerts";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Upsert one alert. Used on create + on trigger + on rearm. */
export async function mirrorAlert(alert: PriceAlert): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = {
    id: alert.id,
    user_id: userId,
    symbol: alert.symbol,
    condition: alert.condition,
    price: alert.price,
    one_shot: alert.oneShot,
    armed: alert.armed,
    triggered_at: alert.triggeredAt
      ? new Date(alert.triggeredAt).toISOString()
      : null,
    triggered_price: alert.triggeredPrice ?? null,
  };
  const { error } = await (supabase.from("alerts") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "id" });
  return !error;
}

/** Bulk upsert — used by checkAlerts when several fire in one tick. */
export async function mirrorAlerts(alerts: PriceAlert[]): Promise<boolean> {
  if (alerts.length === 0) return true;
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const rows = alerts.map((a) => ({
    id: a.id,
    user_id: userId,
    symbol: a.symbol,
    condition: a.condition,
    price: a.price,
    one_shot: a.oneShot,
    armed: a.armed,
    triggered_at: a.triggeredAt
      ? new Date(a.triggeredAt).toISOString()
      : null,
    triggered_price: a.triggeredPrice ?? null,
  }));
  const { error } = await (supabase.from("alerts") as unknown as {
    upsert: (
      rows: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(rows, { onConflict: "id" });
  return !error;
}

export async function mirrorAlertDelete(id: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const { error } = await (supabase.from("alerts") as unknown as {
    delete: () => {
      eq: (col: string, val: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  })
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  return !error;
}

/**
 * Pull cloud alerts and replace the local set. Cloud is authoritative
 * because triggered/armed state needs to converge across devices —
 * keeping a "local wins" merge would let one device re-fire a
 * one-shot another device already triggered.
 */
export async function pullAlerts(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  type Row = {
    id: string;
    symbol: string;
    condition: "above" | "below";
    price: number;
    one_shot: boolean;
    armed: boolean;
    triggered_at: string | null;
    triggered_price: number | null;
    created_at: string;
  };
  const res = await (supabase.from("alerts") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
    };
  })
    .select(
      "id, symbol, condition, price, one_shot, armed, triggered_at, triggered_price, created_at",
    )
    .eq("user_id", userId);
  if (res.error || !res.data) return 0;

  const cloudAlerts: PriceAlert[] = res.data.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    condition: r.condition,
    price: Number(r.price),
    oneShot: r.one_shot,
    armed: r.armed,
    triggeredAt: r.triggered_at ? new Date(r.triggered_at).getTime() : undefined,
    triggeredPrice:
      r.triggered_price !== null ? Number(r.triggered_price) : undefined,
    createdAt: new Date(r.created_at).getTime(),
  }));

  // Merge: cloud is authoritative for shared ids, but preserve any
  // local-only alerts (just-created on this tab whose insert hasn't
  // round-tripped yet).
  const KEY = `tv.alerts.${local.email}`;
  let existing: PriceAlert[] = [];
  try {
    existing = JSON.parse(localStorage.getItem(KEY) || "[]") as PriceAlert[];
  } catch {
    existing = [];
  }
  const cloudIds = new Set(cloudAlerts.map((a) => a.id));
  const localOnly = existing.filter((a) => !cloudIds.has(a.id));
  const merged = [...cloudAlerts, ...localOnly];
  localStorage.setItem(KEY, JSON.stringify(merged));
  return cloudAlerts.length;
}
