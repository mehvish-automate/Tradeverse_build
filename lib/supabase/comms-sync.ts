"use client";

// Cloud sync for the comms engine. createBroadcast inserts a broadcast
// (RLS gates to admins + event organizers). pullBroadcasts returns the
// in-app broadcasts the current user is allowed to read (RLS filters to
// 'all' + events they're in), for the inbox to render. No-op without env.

import { getBrowserSupabase } from "./client";
import type { Campaign } from "../comms";

export type InAppBroadcast = {
  id: string;
  subject: string;
  body: string;
  audience: "all" | "event";
  audienceRef: string | null;
  createdAt: number;
};

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function createBroadcast(c: Campaign): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = {
    id: c.id,
    created_by: userId,
    audience: c.audience,
    audience_ref: c.audienceRef ?? null,
    channel: c.channel,
    subject: c.subject,
    body: c.body,
    status: c.status,
    created_at: new Date(c.createdAt).toISOString(),
  };
  const { error } = await (supabase.from("broadcasts") as unknown as {
    insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).insert(row);
  return !error;
}

/** In-app broadcasts the current user can read (RLS does the filtering). */
export async function pullBroadcasts(): Promise<InAppBroadcast[]> {
  const supabase = getBrowserSupabase();
  if (!supabase) return [];
  type Row = {
    id: string;
    subject: string;
    body: string;
    audience: "all" | "event";
    audience_ref: string | null;
    channel: string;
    created_at: string;
  };
  const res = await (supabase.from("broadcasts") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
      };
    };
  })
    .select("id, subject, body, audience, audience_ref, channel, created_at")
    .eq("channel", "inapp")
    .order("created_at", { ascending: false });
  if (res.error || !res.data) return [];
  return res.data.map((r) => ({
    id: r.id,
    subject: r.subject,
    body: r.body,
    audience: r.audience,
    audienceRef: r.audience_ref,
    createdAt: new Date(r.created_at).getTime(),
  }));
}
