"use client";

// Phase 40 — mirror live sessions and RSVPs to Supabase.
// localStorage stays the read source of truth (UI keeps reading from
// `tv.sessions`). Cloud rows give cross-device parity: host on phone,
// see RSVPs land from your laptop.
//
// Sessions use uuid PKs (lib/sessions.ts genId switched to randomUUID).
// Only sessions with valid UUIDs sync — legacy 8-char ids stay local.

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";
import type { LiveSession, SessionRsvp } from "../sessions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Upsert the session row + the host's RSVP row. */
export async function mirrorSession(session: LiveSession): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  if (!UUID_RE.test(session.id) || !UUID_RE.test(session.clubId)) return false;

  const sessionRow = {
    id: session.id,
    club_id: session.clubId,
    title: session.title,
    description: session.description ?? null,
    kind: session.kind,
    host_id: userId,
    host_display: session.hostDisplayName,
    starts_at: new Date(session.startsAt).toISOString(),
    duration_mins: session.durationMins,
    external_link: session.externalLink ?? null,
    notes: session.notes ?? null,
  };
  const { error: sErr } = await (supabase.from("live_sessions") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(sessionRow, { onConflict: "id", ignoreDuplicates: true });
  if (sErr) return false;

  const rsvpRow = {
    session_id: session.id,
    user_id: userId,
    display_name: session.hostDisplayName,
  };
  const { error: rErr } = await (supabase.from("session_rsvps") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(rsvpRow, { onConflict: "session_id,user_id", ignoreDuplicates: true });
  return !rErr;
}

/** Add the current user's RSVP row. */
export async function mirrorRsvp(
  sessionId: string,
  displayName: string,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  if (!UUID_RE.test(sessionId)) return false;
  const row = { session_id: sessionId, user_id: userId, display_name: displayName };
  const { error } = await (supabase.from("session_rsvps") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "session_id,user_id", ignoreDuplicates: true });
  return !error;
}

/** Drop the current user's RSVP row. */
export async function mirrorUnRsvp(sessionId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  if (!UUID_RE.test(sessionId)) return false;
  const { error } = await (supabase.from("session_rsvps") as unknown as {
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
    .eq("session_id", sessionId)
    .eq("user_id", userId);
  return !error;
}

/** Delete a cancelled session. RLS allows host only. */
export async function mirrorCancelSession(sessionId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  if (!UUID_RE.test(sessionId)) return false;
  const { error } = await (supabase.from("live_sessions") as unknown as {
    delete: () => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .delete()
    .eq("id", sessionId);
  return !error;
}

/** Update host's notes after the session. RLS gates by host_id. */
export async function mirrorSessionNotes(
  sessionId: string,
  notes: string,
): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  if (!UUID_RE.test(sessionId)) return false;
  const { error } = await (supabase.from("live_sessions") as unknown as {
    update: (vals: { notes: string }) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  })
    .update({ notes })
    .eq("id", sessionId);
  return !error;
}

/**
 * Pull every session for clubs I'm a member of (the same surface the
 * UI shows), plus all RSVPs, and merge into localStorage. Cloud is
 * authoritative for shared session ids — RSVPs from other devices land
 * here, host's edited notes propagate, etc.
 */
export async function pullClubSessions(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  // 1. My club ids.
  type MemRow = { club_id: string };
  const memRes = await (supabase.from("club_members") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: MemRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("club_id")
    .eq("user_id", userId);
  if (memRes.error || !memRes.data) return 0;
  const clubIds = memRes.data.map((r) => r.club_id);
  if (clubIds.length === 0) return 0;

  // 2. Sessions in those clubs.
  type SessionRow = {
    id: string;
    club_id: string;
    title: string;
    description: string | null;
    kind: "walkthrough" | "open-market" | "ama" | "other";
    host_id: string;
    host_display: string;
    starts_at: string;
    duration_mins: number;
    external_link: string | null;
    notes: string | null;
  };
  const sessionsRes = await (supabase.from("live_sessions") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: SessionRow[] | null; error: { message: string } | null }>;
    };
  })
    .select(
      "id, club_id, title, description, kind, host_id, host_display, starts_at, duration_mins, external_link, notes",
    )
    .in("club_id", clubIds);
  if (sessionsRes.error || !sessionsRes.data) return 0;
  if (sessionsRes.data.length === 0) return 0;

  const sessionIds = sessionsRes.data.map((s) => s.id);

  // 3. All RSVPs for those sessions.
  type RsvpRow = {
    session_id: string;
    user_id: string;
    display_name: string;
    joined_at: string;
  };
  const rsvpsRes = await (supabase.from("session_rsvps") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: RsvpRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("session_id, user_id, display_name, joined_at")
    .in("session_id", sessionIds);
  const rsvps = rsvpsRes.data ?? [];

  // 4. Resolve user_ids → email for the RSVPs (host_email comes from
  //    the session's host_id). One profiles fetch covers both.
  const userIds = Array.from(
    new Set([
      ...rsvps.map((r) => r.user_id),
      ...sessionsRes.data.map((s) => s.host_id),
    ]),
  );
  type ProfileRow = { id: string; email: string };
  const profilesRes = await (supabase.from("profiles") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: ProfileRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("id, email")
    .in("id", userIds);
  const emailById = new Map<string, string>();
  for (const p of profilesRes.data ?? []) emailById.set(p.id, p.email);

  // 5. Stitch into LiveSession[].
  const cloudSessions: LiveSession[] = sessionsRes.data.map((s) => {
    const rsvpRows: SessionRsvp[] = rsvps
      .filter((r) => r.session_id === s.id)
      .map((r) => ({
        email: emailById.get(r.user_id) ?? r.user_id,
        displayName: r.display_name,
        ts: new Date(r.joined_at).getTime(),
      }));
    return {
      id: s.id,
      clubId: s.club_id,
      title: s.title,
      description: s.description ?? undefined,
      kind: s.kind,
      hostEmail: emailById.get(s.host_id) ?? s.host_id,
      hostDisplayName: s.host_display,
      startsAt: new Date(s.starts_at).getTime(),
      durationMins: s.duration_mins,
      externalLink: s.external_link ?? undefined,
      notes: s.notes ?? undefined,
      rsvps: rsvpRows,
    };
  });

  // 6. Merge into localStorage. Cloud wins for shared ids; local-only
  //    sessions (legacy non-UUID, just-created offline) stay.
  const KEY = "tv.sessions";
  let existing: LiveSession[] = [];
  try {
    existing = JSON.parse(localStorage.getItem(KEY) || "[]") as LiveSession[];
  } catch {
    existing = [];
  }
  const byId = new Map<string, LiveSession>();
  for (const s of existing) byId.set(s.id, s);
  for (const s of cloudSessions) byId.set(s.id, s);
  localStorage.setItem(KEY, JSON.stringify(Array.from(byId.values())));

  return cloudSessions.length;
}
