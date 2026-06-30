"use client";

// Cloud sync for event registrations. Insert is allowed for anyone
// (anon or authed) so public registration links work without an account;
// reads are gated by RLS to the event's organizer. No-op without env.

import { getBrowserSupabase } from "./client";
import type { Registration } from "../registrations";

export async function mirrorRegistration(reg: Registration): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  // user_id is set when the registrant happens to be signed in.
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    userId = null;
  }
  const row = {
    id: reg.id,
    fest_id: reg.festId,
    name: reg.name,
    email: reg.email,
    phone: reg.phone ?? null,
    source: reg.source ?? null,
    user_id: userId,
    created_at: new Date(reg.createdAt).toISOString(),
  };
  const { error } = await (supabase.from("event_registrations") as unknown as {
    insert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).insert(row);
  return !error;
}

export async function pullRegistrations(festId: string): Promise<Registration[]> {
  const supabase = getBrowserSupabase();
  if (!supabase) return [];
  type Row = {
    id: string;
    fest_id: string;
    name: string;
    email: string;
    phone: string | null;
    source: string | null;
    created_at: string;
  };
  const res = await (supabase.from("event_registrations") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: Row[] | null; error: { message: string } | null }>;
    };
  })
    .select("id, fest_id, name, email, phone, source, created_at")
    .eq("fest_id", festId);
  if (res.error || !res.data) return [];
  return res.data.map((r) => ({
    id: r.id,
    festId: r.fest_id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? undefined,
    source: r.source ?? undefined,
    createdAt: new Date(r.created_at).getTime(),
  }));
}
