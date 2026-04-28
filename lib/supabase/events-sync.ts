"use client";

// Phase 39 — mirror market-event sector allocations and resolved-claim
// state to Supabase. PK is (user_id, event_id) so resubmits are idempotent.
//
// localStorage stays the read source of truth (UI keeps consulting
// `tv.events.<email>`). Cloud rows give cross-device parity: pick on
// phone, see resolved + claim on laptop.

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";
import type { EventAllocation } from "../eventPortfolios";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Upsert one allocation. Called after submitAllocation locally. */
export async function mirrorEventAllocation(
  alloc: EventAllocation,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = {
    user_id: userId,
    event_id: alloc.eventId,
    allocation: alloc.allocation,
    submitted_at: new Date(alloc.submittedAt).toISOString(),
    claimed: alloc.claimed,
  };
  const { error } = await (supabase.from("event_allocations") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "user_id,event_id" });
  return !error;
}

/** Flip the claimed flag on cloud after the user claims the reward. */
export async function mirrorEventClaim(eventId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const { error } = await (supabase.from("event_allocations") as unknown as {
    update: (vals: { claimed: boolean }) => {
      eq: (col: string, val: string) => {
        eq: (
          col: string,
          val: string,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
  })
    .update({ claimed: true })
    .eq("user_id", userId)
    .eq("event_id", eventId);
  return !error;
}

/**
 * Pull every event allocation for the current user and merge into
 * localStorage. Local wins on `claimed=true` (claim is a one-way bit
 * that may have been credited locally before the cloud roundtrip
 * acknowledged); otherwise cloud overwrites.
 */
export async function pullEventAllocations(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  type Row = {
    event_id: string;
    allocation: Record<string, number>;
    submitted_at: string;
    claimed: boolean;
  };
  const res = await (supabase.from("event_allocations") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
    };
  })
    .select("event_id, allocation, submitted_at, claimed")
    .eq("user_id", userId);
  if (res.error || !res.data) return 0;

  const KEY = `tv.events.${local.email}`;
  let local_arr: EventAllocation[] = [];
  try {
    local_arr = JSON.parse(localStorage.getItem(KEY) || "[]") as EventAllocation[];
  } catch {
    local_arr = [];
  }

  const byId = new Map<string, EventAllocation>();
  for (const a of local_arr) byId.set(a.eventId, a);
  for (const r of res.data) {
    const localRow = byId.get(r.event_id);
    const merged: EventAllocation = {
      eventId: r.event_id,
      submittedAt: new Date(r.submitted_at).getTime(),
      allocation: r.allocation,
      // Local-claimed is sticky — once the user has been credited XP
      // here, don't unclaim them just because cloud hasn't caught up.
      claimed: localRow?.claimed ? true : r.claimed,
    };
    byId.set(r.event_id, merged);
  }
  localStorage.setItem(KEY, JSON.stringify(Array.from(byId.values())));
  return res.data.length;
}
