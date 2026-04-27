"use client";

// Phase 33 — mirror clubs and club_members to Supabase.
// localStorage is the read source of truth for the UI. Cloud gives
// cross-device visibility: create on laptop → shows on phone.
//
// Write pattern: fire-and-forget lazy imports (no circular dep risk).
// Pull pattern: fetch my clubs + all members + profile resolution, merge.

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";
import type { Club } from "../clubs";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Upsert the club row + owner membership. Skips non-UUID ids (legacy local-only clubs). */
export async function mirrorClub(club: Club): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  // Only push clubs whose id is a valid UUID (created after the genId fix).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(club.id)) return false;

  const clubRow = {
    id: club.id,
    institute_id: club.instituteId,
    name: club.name,
    description: club.description ?? null,
    created_by: userId,
  };
  const { error: clubErr } = await (supabase.from("clubs") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(clubRow, { onConflict: "id", ignoreDuplicates: true });
  if (clubErr) return false;

  // Owner membership row.
  const memRow = { club_id: club.id, user_id: userId, role: "owner" };
  const { error: memErr } = await (supabase.from("club_members") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(memRow, { onConflict: "club_id,user_id", ignoreDuplicates: true });
  return !memErr;
}

/** Insert/upsert a member row when the current user joins a club. */
export async function mirrorJoinClub(clubId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(clubId)) return false;
  const row = { club_id: clubId, user_id: userId, role: "member" };
  const { error } = await (supabase.from("club_members") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "club_id,user_id", ignoreDuplicates: true });
  return !error;
}

/** Delete the current user's membership row when they leave a club. */
export async function mirrorLeaveClub(clubId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const { error } = await (supabase.from("club_members") as unknown as {
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
    .eq("club_id", clubId)
    .eq("user_id", userId);
  return !error;
}

/**
 * Pull clubs I'm a member of from cloud, resolve member identities via
 * profiles, and merge into localStorage. Cloud wins for member lists of
 * shared clubs (other-device joins aren't in local store).
 */
export async function pullMyClubs(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  // 1. My membership rows → club ids.
  type MemRow = { club_id: string };
  const myMemRes = await (supabase.from("club_members") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: MemRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("club_id")
    .eq("user_id", userId);
  if (myMemRes.error || !myMemRes.data) return 0;
  const clubIds = myMemRes.data.map((r) => r.club_id);
  if (clubIds.length === 0) return 0;

  // 2. Club rows.
  type ClubRow = {
    id: string;
    institute_id: string;
    name: string;
    description: string | null;
    created_by: string;
    created_at: string;
  };
  const clubsRes = await (supabase.from("clubs") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: ClubRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("id, institute_id, name, description, created_by, created_at")
    .in("id", clubIds);
  if (clubsRes.error || !clubsRes.data) return 0;

  // 3. All member rows for those clubs.
  type AllMemRow = { club_id: string; user_id: string; role: string; joined_at: string };
  const allMemRes = await (supabase.from("club_members") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: AllMemRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("club_id, user_id, role, joined_at")
    .in("club_id", clubIds);
  if (allMemRes.error || !allMemRes.data) return 0;

  // 4. Resolve user_ids → email + display_name.
  const userIds = Array.from(new Set(allMemRes.data.map((m) => m.user_id)));
  type ProfileRow = { id: string; email: string; display_name: string };
  const profilesRes = await (supabase.from("profiles") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: ProfileRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("id, email, display_name")
    .in("id", userIds);
  const profileById = new Map<string, ProfileRow>();
  for (const p of profilesRes.data ?? []) profileById.set(p.id, p);

  // 5. Stitch into Club[].
  const cloudClubs: Club[] = clubsRes.data.map((c) => {
    const creator = profileById.get(c.created_by);
    const members = allMemRes.data!
      .filter((m) => m.club_id === c.id)
      .map((m) => {
        const p = profileById.get(m.user_id);
        return {
          email: p?.email ?? m.user_id,
          displayName: p?.display_name ?? "Member",
          role: (m.role === "owner" ? "owner" : "member") as "owner" | "member",
          joinedAt: new Date(m.joined_at).getTime(),
        };
      });
    return {
      id: c.id,
      instituteId: c.institute_id,
      name: c.name,
      description: c.description ?? undefined,
      createdBy: creator?.email ?? c.created_by,
      createdAt: new Date(c.created_at).getTime(),
      members,
    };
  });

  // 6. Merge into localStorage. Cloud wins for shared IDs.
  const CLUBS_KEY = "tv.clubs";
  const MY_CLUBS_KEY = `tv.myclubs.${local.email}`;
  let existing: Club[] = [];
  try {
    existing = JSON.parse(localStorage.getItem(CLUBS_KEY) || "[]") as Club[];
  } catch { existing = []; }
  const byId = new Map<string, Club>();
  for (const c of existing) byId.set(c.id, c);
  for (const c of cloudClubs) byId.set(c.id, c);
  localStorage.setItem(CLUBS_KEY, JSON.stringify(Array.from(byId.values())));

  let mem: string[] = [];
  try {
    mem = JSON.parse(localStorage.getItem(MY_CLUBS_KEY) || "[]") as string[];
  } catch { mem = []; }
  const memSet = new Set(mem);
  for (const id of clubIds) memSet.add(id);
  localStorage.setItem(MY_CLUBS_KEY, JSON.stringify(Array.from(memSet)));

  return cloudClubs.length;
}
