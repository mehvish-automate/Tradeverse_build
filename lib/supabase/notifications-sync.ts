"use client";

// Phase 41 — mirror notification read receipts to Supabase so the bell
// counter unifies across devices. The notification *feed* itself is
// derived from local state (rewards, fests, quests, sessions) and
// every input to that feed is already cloud-synced. The only per-device
// state was the read set — that's what this file moves to cloud.
//
// Pattern:
//   - markRead / markAllRead (in lib/notifications.ts) call
//     mirrorNotificationReads with the new ids → upsert one row per id.
//   - SyncRuntime calls pullNotificationReads on first-load → union-merge
//     server-side reads into the local set.

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Upsert one row per notif id. PK is (user_id, notif_id) so no dupes. */
export async function mirrorNotificationReads(
  ids: string[],
): Promise<boolean> {
  if (ids.length === 0) return true;
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const rows = ids.map((id) => ({ user_id: userId, notif_id: id }));
  const { error } = await (supabase.from("notification_reads") as unknown as {
    upsert: (
      rows: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(rows, {
    onConflict: "user_id,notif_id",
    ignoreDuplicates: true,
  });
  return !error;
}

/**
 * Pull cloud read receipts and union-merge into the local read set.
 * Local-marked reads always survive (we never un-mark anything from
 * cloud absence).
 */
export async function pullNotificationReads(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  type Row = { notif_id: string };
  const res = await (supabase.from("notification_reads") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
    };
  })
    .select("notif_id")
    .eq("user_id", userId);
  if (res.error || !res.data) return 0;

  const KEY = `tv.notif.read.${local.email}`;
  let existing: string[] = [];
  try {
    existing = JSON.parse(localStorage.getItem(KEY) || "[]") as string[];
  } catch {
    existing = [];
  }
  const merged = new Set(existing);
  let added = 0;
  for (const r of res.data) {
    if (!merged.has(r.notif_id)) {
      merged.add(r.notif_id);
      added++;
    }
  }
  if (added > 0) {
    localStorage.setItem(KEY, JSON.stringify([...merged]));
  }
  return added;
}
