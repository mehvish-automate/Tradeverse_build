"use client";

// Phase 34 — mirror fests and fest_participants to Supabase.
// Fests use the same 6-char text PK as trade floors (no UUID mismatch).
// Writes are fire-and-forget from lib/fests.ts; pull is on auth boot.

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";
import type { Fest } from "../fests";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Upsert the fest row + creator participation row. */
export async function mirrorFest(fest: Fest): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;

  const festRow = {
    id: fest.id,
    // Quiz-launch: null when not tied to a club (standalone launch).
    club_id: fest.clubId ?? null,
    name: fest.name,
    description: fest.description ?? null,
    start_date: fest.startDate,
    end_date: fest.endDate,
    event_type: fest.eventType ?? "paper-trading",
    difficulty: fest.difficulty ?? "intermediate",
    source: fest.source ?? "system",
    created_by: userId,
    // Phase 43 launch fields. New columns are nullable / defaulted in
    // the schema so re-running this against a pre-Phase-43 DB is safe.
    privacy: fest.privacy ?? "private",
    status: fest.lifecycleStatus ?? "live",
    categories: fest.categories ?? [],
    starts_at: fest.startsAtMs
      ? new Date(fest.startsAtMs).toISOString()
      : null,
    ends_at: fest.endsAtMs ? new Date(fest.endsAtMs).toISOString() : null,
    member_cap: fest.memberCap ?? 50,
    rewards: fest.rewards ?? [],
  };
  const { error: festErr } = await (supabase.from("fests") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(festRow, { onConflict: "id", ignoreDuplicates: true });
  if (festErr) return false;

  const partRow = { fest_id: fest.id, user_id: userId };
  const { error: partErr } = await (supabase.from("fest_participants") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(partRow, { onConflict: "fest_id,user_id", ignoreDuplicates: true });
  return !partErr;
}

/** Upsert a participation row when the current user joins a fest. */
export async function mirrorJoinFest(festId: string): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const userId = await authedUserId();
  if (!userId) return false;
  const row = { fest_id: festId, user_id: userId };
  const { error } = await (supabase.from("fest_participants") as unknown as {
    upsert: (
      row: unknown,
      opts: { onConflict: string; ignoreDuplicates?: boolean },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(row, { onConflict: "fest_id,user_id", ignoreDuplicates: true });
  return !error;
}

/**
 * Pull fests I'm participating in, resolve all participants via profiles,
 * and merge into localStorage. Cloud wins for participant lists of shared
 * fests (joins from other devices aren't in local store).
 */
export async function pullMyFests(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  // 1. My participation rows → fest ids.
  type PartRow = { fest_id: string };
  const myPartRes = await (supabase.from("fest_participants") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: PartRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("fest_id")
    .eq("user_id", userId);
  if (myPartRes.error || !myPartRes.data) return 0;
  const festIds = myPartRes.data.map((r) => r.fest_id);
  if (festIds.length === 0) return 0;

  // 2. Fest rows.
  type FestRow = {
    id: string;
    club_id: string | null;
    name: string;
    description: string | null;
    start_date: string;
    end_date: string;
    event_type: string;
    difficulty: string;
    source: string;
    created_by: string;
    created_at: string;
    privacy: "public" | "private" | null;
    status: "pending_approval" | "live" | "ended" | "rejected" | null;
    categories: string[] | null;
    starts_at: string | null;
    ends_at: string | null;
    member_cap: number | null;
    rewards: unknown;
  };
  const festsRes = await (supabase.from("fests") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: FestRow[] | null; error: { message: string } | null }>;
    };
  })
    .select(
      "id, club_id, name, description, start_date, end_date, event_type, difficulty, source, created_by, created_at, privacy, status, categories, starts_at, ends_at, member_cap, rewards",
    )
    .in("id", festIds);
  if (festsRes.error || !festsRes.data) return 0;

  // 3. All participant rows for those fests.
  type AllPartRow = { fest_id: string; user_id: string; joined_at: string };
  const allPartRes = await (supabase.from("fest_participants") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: AllPartRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("fest_id, user_id, joined_at")
    .in("fest_id", festIds);
  if (allPartRes.error || !allPartRes.data) return 0;

  // 4. Resolve user_ids → email + display_name.
  const userIds = Array.from(
    new Set([
      ...allPartRes.data.map((p) => p.user_id),
      ...festsRes.data.map((f) => f.created_by),
    ]),
  );
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

  // 5. Stitch into Fest[].
  const cloudFests: Fest[] = festsRes.data.map((f) => {
    const creator = profileById.get(f.created_by);
    const participants = allPartRes.data!
      .filter((p) => p.fest_id === f.id)
      .map((p) => {
        const pr = profileById.get(p.user_id);
        return {
          email: pr?.email ?? p.user_id,
          displayName: pr?.display_name ?? "Participant",
          joinedAt: new Date(p.joined_at).getTime(),
        };
      });
    return {
      id: f.id,
      clubId: f.club_id,
      name: f.name,
      description: f.description ?? undefined,
      startDate: f.start_date,
      endDate: f.end_date,
      eventType: f.event_type as Fest["eventType"],
      difficulty: f.difficulty as Fest["difficulty"],
      source: f.source as Fest["source"],
      createdBy: creator?.email ?? f.created_by,
      createdAt: new Date(f.created_at).getTime(),
      participants,
      privacy: f.privacy ?? "private",
      lifecycleStatus: f.status ?? "live",
      categories: f.categories ?? [],
      startsAtMs: f.starts_at ? new Date(f.starts_at).getTime() : undefined,
      endsAtMs: f.ends_at ? new Date(f.ends_at).getTime() : undefined,
      memberCap: f.member_cap ?? 50,
      rewards: Array.isArray(f.rewards) ? (f.rewards as Fest["rewards"]) : [],
    };
  });

  // 6. Merge into localStorage. Cloud wins for shared ids.
  const FESTS_KEY = "tv.fests";
  const MY_FESTS_KEY = `tv.myfests.${local.email}`;
  let existing: Fest[] = [];
  try {
    existing = JSON.parse(localStorage.getItem(FESTS_KEY) || "[]") as Fest[];
  } catch { existing = []; }
  const byId = new Map<string, Fest>();
  for (const f of existing) byId.set(f.id, f);
  for (const f of cloudFests) byId.set(f.id, f);
  localStorage.setItem(FESTS_KEY, JSON.stringify(Array.from(byId.values())));

  let mem: string[] = [];
  try {
    mem = JSON.parse(localStorage.getItem(MY_FESTS_KEY) || "[]") as string[];
  } catch { mem = []; }
  const memSet = new Set(mem);
  for (const id of festIds) memSet.add(id);
  localStorage.setItem(MY_FESTS_KEY, JSON.stringify(Array.from(memSet)));

  return cloudFests.length;
}
