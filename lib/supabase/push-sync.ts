"use client";

// Phase 66 — push subscription cloud store. Mirrors the browser's push
// subscription (own-rows RLS) so the /api/push/send route can deliver to
// it. No-op without Supabase env.

import { getBrowserSupabase } from "./client";

export async function mirrorSubscription(sub: PushSubscription): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return false;
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const row = {
    endpoint: json.endpoint,
    user_id: userId,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  };
  const { error } = await (supabase.from("push_subscriptions") as unknown as {
    upsert: (
      r: unknown,
      o: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "endpoint" });
  return !error;
}

export async function removeSubscription(endpoint: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const { error } = await (supabase.from("push_subscriptions") as unknown as {
    delete: () => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
  })
    .delete()
    .eq("endpoint", endpoint);
  return !error;
}
