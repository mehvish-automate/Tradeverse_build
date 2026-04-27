"use client";

import { useEffect, useState } from "react";

import { getBrowserSupabase } from "./client";

/**
 * Subscribe to live changes on a Postgres table and surface a monotonic
 * `tick` that consumers can use as a useEffect dep to re-fetch.
 *
 * Idempotent + silently no-op when Supabase isn't configured. Returns
 * a `connected` flag so UIs can show a "Live" chip only when we're
 * actually streaming updates.
 */
export function useRealtimeTable(table: string): {
  tick: number;
  connected: boolean;
} {
  const [tick, setTick] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const channel = (supabase.channel(`tv-realtime-${table}`) as unknown as {
      on: (
        event: string,
        filter: { event: string; schema: string; table: string },
        cb: () => void,
      ) => { subscribe: (cb: (s: string) => void) => unknown };
    })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => setTick((t) => t + 1),
      )
      .subscribe((status: string) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      supabase.removeChannel(channel as any);
    };
  }, [table]);

  return { tick, connected };
}

/** Convenience hook for the most common case — daily result inserts. */
export function useRealtimeLeaderboards() {
  return useRealtimeTable("daily_results");
}

/** Floor posts realtime — for the club trading floor. */
export function useRealtimeFloor() {
  return useRealtimeTable("floor_posts");
}

/**
 * Paper-trading realtime — bumps when a row in `orders` or
 * `paper_holdings` changes. Trade pages use this to re-pull cloud
 * state so an order placed/filled on another device appears here
 * within seconds (vs. the 60s SyncRuntime tick).
 */
export function useRealtimePaper(): { tick: number; connected: boolean } {
  const orders = useRealtimeTable("orders");
  const holdings = useRealtimeTable("paper_holdings");
  return {
    tick: orders.tick + holdings.tick,
    connected: orders.connected || holdings.connected,
  };
}
