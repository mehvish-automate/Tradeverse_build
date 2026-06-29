"use client";

// Cloud mirror for analytics events (Phase 65). Append-only insert into
// public.analytics_events. Anonymous (signed-out) events are dropped —
// RLS requires user_id = auth.uid(), so there's no row to write without
// a session. No-op when Supabase env is absent.

import { getBrowserSupabase } from "./client";
import type { AnalyticsEvent } from "../analytics";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function mirrorEvent(ev: AnalyticsEvent): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const row = {
    id: ev.id,
    user_id: userId,
    device_id: ev.deviceId,
    name: ev.name,
    props: ev.props,
    path: ev.path || null,
    occurred_at: new Date(ev.ts).toISOString(),
  };

  const { error } = await (supabase.from("analytics_events") as unknown as {
    insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).insert(row);
  return !error;
}
