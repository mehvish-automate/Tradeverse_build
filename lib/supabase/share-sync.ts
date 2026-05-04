"use client";

// Phase 48.5 — cloud sync for share-link click + join attribution.
//
// The local lib/referral.ts pattern (trackShareClick / attributeShareJoin)
// stays the source of truth for the inviter's view since /referrals reads
// `tv.shares.<email>`. This module:
//
//   1. Mirrors local writes to share_clicks / share_joins so they cross
//      devices.
//   2. Pulls the inviter's full server-side aggregate on first-load and
//      merges it INTO the local store, so the host sees clicks they got
//      while signed in on a different device.
//
// Resolution path: refCode → profiles.referral_code → inviter_id (uuid),
// done lazily inside the mirror call via a single profiles select.

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";
import type { ShareKind, ShareStat } from "../referral";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function lookupInviterUserId(
  refCode: string,
): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const code = refCode.trim().toUpperCase();
  if (!code) return null;
  type Row = { id: string };
  const res = await (supabase.from("profiles") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: Row | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();
  if (res.error || !res.data) return null;
  return res.data.id;
}

/** Insert one share_clicks row. Best-effort. */
export async function mirrorShareClick(
  refCode: string,
  kind: ShareKind,
  resourceId: string,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const clickerId = await authedUserId();
  if (!clickerId) return false; // anonymous clicks don't sync (spam guard)
  const inviterId = await lookupInviterUserId(refCode);
  if (!inviterId) return false;
  if (inviterId === clickerId) return false;

  const row = {
    inviter_id: inviterId,
    kind,
    resource_id: resourceId.toUpperCase(),
    clicker_id: clickerId,
  };
  const { error } = await (supabase.from("share_clicks") as unknown as {
    insert: (
      row: unknown,
    ) => Promise<{ error: { message: string } | null }>;
  }).insert(row);
  return !error;
}

/** Upsert one share_joins row (PK on (inviter, invitee, kind, resource)). */
export async function mirrorShareJoin(
  refCode: string,
  kind: ShareKind,
  resourceId: string,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const inviteeId = await authedUserId();
  if (!inviteeId) return false;
  const inviterId = await lookupInviterUserId(refCode);
  if (!inviterId) return false;
  if (inviterId === inviteeId) return false;

  const row = {
    inviter_id: inviterId,
    invitee_id: inviteeId,
    kind,
    resource_id: resourceId.toUpperCase(),
  };
  const { error } = await (supabase.from("share_joins") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, {
    onConflict: "inviter_id,invitee_id,kind,resource_id",
    ignoreDuplicates: true,
  });
  return !error;
}

/**
 * Pull the inviter's clicks + joins for THIS user and merge into
 * `tv.shares.<email>`. Cloud counts win when they're higher (the local
 * tracker sees only this device, cloud aggregates across all of them).
 */
export async function pullShareStats(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  type ClickRow = { kind: ShareKind; resource_id: string; clicked_at: string };
  type JoinRow = { kind: ShareKind; resource_id: string; joined_at: string };

  const clicksRes = await (supabase.from("share_clicks") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: ClickRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("kind, resource_id, clicked_at")
    .eq("inviter_id", userId);
  if (clicksRes.error) return 0;

  const joinsRes = await (supabase.from("share_joins") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: JoinRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("kind, resource_id, joined_at")
    .eq("inviter_id", userId);
  if (joinsRes.error) return 0;

  // Aggregate.
  const agg = new Map<string, ShareStat>();
  for (const c of clicksRes.data ?? []) {
    const key = `${c.kind}:${c.resource_id.toUpperCase()}`;
    const cur =
      agg.get(key) ??
      ({
        kind: c.kind,
        resourceId: c.resource_id.toUpperCase(),
        clicks: 0,
        joins: 0,
        lastClickAt: 0,
        lastJoinAt: 0,
      } as ShareStat);
    cur.clicks++;
    const t = new Date(c.clicked_at).getTime();
    if (t > cur.lastClickAt) cur.lastClickAt = t;
    agg.set(key, cur);
  }
  for (const j of joinsRes.data ?? []) {
    const key = `${j.kind}:${j.resource_id.toUpperCase()}`;
    const cur =
      agg.get(key) ??
      ({
        kind: j.kind,
        resourceId: j.resource_id.toUpperCase(),
        clicks: 0,
        joins: 0,
        lastClickAt: 0,
        lastJoinAt: 0,
      } as ShareStat);
    cur.joins++;
    const t = new Date(j.joined_at).getTime();
    if (t > cur.lastJoinAt) cur.lastJoinAt = t;
    agg.set(key, cur);
  }

  // Merge into local. Cloud aggregates supersede when they're larger.
  const KEY = `tv.shares.${local.email}`;
  let existing: Record<string, ShareStat> = {};
  try {
    existing = JSON.parse(localStorage.getItem(KEY) || "{}") as Record<
      string,
      ShareStat
    >;
  } catch {
    existing = {};
  }
  for (const [key, cloud] of agg) {
    const local_s = existing[key];
    existing[key] = {
      kind: cloud.kind,
      resourceId: cloud.resourceId,
      clicks: Math.max(local_s?.clicks ?? 0, cloud.clicks),
      joins: Math.max(local_s?.joins ?? 0, cloud.joins),
      lastClickAt: Math.max(local_s?.lastClickAt ?? 0, cloud.lastClickAt),
      lastJoinAt: Math.max(local_s?.lastJoinAt ?? 0, cloud.lastJoinAt),
    };
  }
  localStorage.setItem(KEY, JSON.stringify(existing));
  return agg.size;
}
