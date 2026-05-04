"use client";

// Phase 32 — pull trade floors from cloud into localStorage so cross-
// device works: sign in on a phone and your floors show up. Writes are
// already done at create/join time (see lib/supabase/writes.ts), this
// is the missing read side.
//
// localStorage stays the read source of truth for the UI. Cloud is
// authoritative for *membership* (who else is in your floor) — local
// member lists are replaced for floors that exist in cloud, since
// joins from other devices won't be in your local copy otherwise.

import { getBrowserSupabase } from "./client";
import { getCurrentUser } from "../session";
import type { TradeFloor, TradeFloorMember } from "../tradeFloors";

async function authedUserId(): Promise<string | null> {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Pull every trade floor I'm a member of (RLS already filters), plus
 * every member of those floors (so leaderboards show real names), and
 * merge into localStorage.
 *
 * Local-only floors (created while offline, not yet pushed) are kept.
 * Cloud floors override local member lists since other-device joins
 * won't be in local.
 */
export async function pullMyTradeFloors(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const userId = await authedUserId();
  if (!userId) return 0;
  const local = getCurrentUser();
  if (!local) return 0;

  // 1. My memberships → which floor ids to fetch.
  type MemRow = { trade_floor_id: string };
  const myMemRes = await (supabase.from("trade_floor_members") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: MemRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("trade_floor_id")
    .eq("user_id", userId);
  if (myMemRes.error || !myMemRes.data) return 0;
  const floorIds = myMemRes.data.map((r) => r.trade_floor_id);
  if (floorIds.length === 0) return 0;

  // 2. The floor rows themselves (Phase 42 columns included; legacy
  //    rows without them get safe defaults via withDefaults() in the
  //    consuming reader).
  type FloorRow = {
    id: string;
    name: string;
    created_by: string;
    created_at: string;
    privacy: "public" | "private" | null;
    start_at: string | null;
    end_at: string | null;
    member_cap: number | null;
    virtual_capital: number | null;
    stock_universe: unknown;
    asset_classes: string[] | null;
    market_region: "IN" | "UAE" | "US" | "GLOBAL" | null;
    status: "pending_approval" | "live" | "ended" | "rejected" | null;
    created_by_kind: "user" | "club" | "ambassador" | null;
  };
  const floorsRes = await (supabase.from("trade_floors") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: FloorRow[] | null; error: { message: string } | null }>;
    };
  })
    .select(
      "id, name, created_by, created_at, privacy, start_at, end_at, member_cap, virtual_capital, stock_universe, asset_classes, market_region, status, created_by_kind",
    )
    .in("id", floorIds);
  if (floorsRes.error || !floorsRes.data) return 0;

  // 3. All members of those floors.
  type AllMemRow = {
    trade_floor_id: string;
    user_id: string;
    joined_at: string;
  };
  const allMemRes = await (supabase.from("trade_floor_members") as unknown as {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: AllMemRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("trade_floor_id, user_id, joined_at")
    .in("trade_floor_id", floorIds);
  if (allMemRes.error || !allMemRes.data) return 0;

  // 4. Resolve user_ids → email + display_name via profiles.
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
  if (profilesRes.error) return 0;
  const profileById = new Map<string, ProfileRow>();
  for (const p of profilesRes.data ?? []) profileById.set(p.id, p);

  // 5. Stitch into TradeFloor[] using the local schema.
  const cloudFloors: TradeFloor[] = floorsRes.data.map((f) => {
    const creator = profileById.get(f.created_by);
    const members: TradeFloorMember[] = allMemRes.data!
      .filter((m) => m.trade_floor_id === f.id)
      .map((m) => {
        const p = profileById.get(m.user_id);
        return {
          email: p?.email ?? m.user_id,
          displayName: p?.display_name ?? "Member",
          joinedAt: new Date(m.joined_at).getTime(),
        };
      });
    const createdAtMs = new Date(f.created_at).getTime();
    return {
      id: f.id,
      name: f.name,
      createdBy: creator?.email ?? f.created_by,
      createdByKind: f.created_by_kind ?? "user",
      createdAt: createdAtMs,
      members,
      privacy: f.privacy ?? "public",
      startAt: f.start_at ? new Date(f.start_at).getTime() : createdAtMs,
      endAt: f.end_at
        ? new Date(f.end_at).getTime()
        : createdAtMs + 7 * 24 * 60 * 60 * 1000,
      memberCap: f.member_cap ?? 20,
      virtualCapital: Number(f.virtual_capital ?? 1_000_000),
      stockUniverse:
        (f.stock_universe as TradeFloor["stockUniverse"]) ?? { kind: "nifty50" },
      assetClasses: ((f.asset_classes ?? ["stocks"]) as TradeFloor["assetClasses"]),
      marketRegion: f.market_region ?? "IN",
      status: f.status ?? "live",
    };
  });

  // 6. Merge into local. Cloud wins for floors that exist in both
  //    (membership might have grown). Local-only floors stay.
  const TF_KEY = "tv.tradeFloors";
  const ME_KEY = `tv.memberships.${local.email}`;
  let raw = localStorage.getItem(TF_KEY);
  let existing: TradeFloor[] = [];
  try {
    existing = raw ? (JSON.parse(raw) as TradeFloor[]) : [];
  } catch {
    existing = [];
  }
  const byId = new Map<string, TradeFloor>();
  for (const f of existing) byId.set(f.id, f);
  for (const f of cloudFloors) byId.set(f.id, f);
  localStorage.setItem(TF_KEY, JSON.stringify(Array.from(byId.values())));

  // Membership index for the current user.
  let memRaw = localStorage.getItem(ME_KEY);
  let mem: string[] = [];
  try {
    mem = memRaw ? (JSON.parse(memRaw) as string[]) : [];
  } catch {
    mem = [];
  }
  const memSet = new Set(mem);
  for (const id of floorIds) memSet.add(id);
  localStorage.setItem(ME_KEY, JSON.stringify(Array.from(memSet)));

  return cloudFloors.length;
}
