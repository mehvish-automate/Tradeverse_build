"use client";

import { getProgress } from "./progress";
import { lookupScore } from "./supabase/scores-sync";

export type TradeFloorMember = {
  email: string;
  displayName: string;
  joinedAt: number;
};

export type TradeFloorPrivacy = "public" | "private";
export type TradeFloorStatus =
  | "pending_approval"
  | "live"
  | "ended"
  | "rejected";
export type TradeFloorCreatorKind = "user" | "club" | "ambassador";
export type AssetClass = "stocks" | "etfs" | "indices";
export type MarketRegion = "IN" | "UAE" | "US" | "GLOBAL";

export type StockUniverse =
  | { kind: "nifty50" }
  | { kind: "nifty100" }
  | { kind: "all" }
  | { kind: "custom-sectors"; sectors: string[] }
  | { kind: "handpicked"; symbols: string[] };

export type TradeFloor = {
  id: string; // invite/share code, short human-friendly
  name: string;
  createdBy: string; // email
  createdByKind: TradeFloorCreatorKind;
  createdAt: number;
  members: TradeFloorMember[];
  // Phase 42 launch fields
  privacy: TradeFloorPrivacy;
  startAt: number; // ms epoch
  endAt: number; // ms epoch
  memberCap: number;
  virtualCapital: number;
  stockUniverse: StockUniverse;
  assetClasses: AssetClass[];
  marketRegion: MarketRegion;
  status: TradeFloorStatus;
};

/** Default missing Phase 42 fields on legacy floors (created before launch flow). */
function withDefaults(f: Partial<TradeFloor> & { id: string; name: string; createdBy: string; createdAt: number; members: TradeFloorMember[] }): TradeFloor {
  return {
    createdByKind: "user",
    privacy: "public",
    startAt: f.createdAt,
    endAt: f.createdAt + 7 * 24 * 60 * 60 * 1000,
    memberCap: 20,
    virtualCapital: 1_000_000,
    stockUniverse: { kind: "nifty50" },
    assetClasses: ["stocks"],
    marketRegion: "IN",
    status: "live",
    ...f,
  } as TradeFloor;
}

/** True when a launched floor must wait for admin approval. */
export function needsAdminApproval(input: {
  privacy: TradeFloorPrivacy;
  memberCap: number;
}): boolean {
  if (input.privacy === "public") return true;
  return input.memberCap > 15;
}

const TRADE_FLOORS_KEY = "tv.tradeFloors";
const MEMBERSHIP_KEY = (email: string) => `tv.memberships.${email}`;

function readTradeFloors(): TradeFloor[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(
      localStorage.getItem(TRADE_FLOORS_KEY) || "[]",
    ) as TradeFloor[];
    return raw.map((f) => withDefaults(f));
  } catch {
    return [];
  }
}

function writeTradeFloors(ls: TradeFloor[]) {
  localStorage.setItem(TRADE_FLOORS_KEY, JSON.stringify(ls));
}

function readMemberships(email: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(MEMBERSHIP_KEY(email)) || "[]") as string[];
  } catch {
    return [];
  }
}

function writeMemberships(email: string, ids: string[]) {
  localStorage.setItem(MEMBERSHIP_KEY(email), JSON.stringify(ids));
}

function genCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return out;
}

export type CreateTradeFloorInput = {
  name: string;
  creator: { email: string; displayName: string };
  privacy: TradeFloorPrivacy;
  startAt: number;
  endAt: number;
  memberCap: number;
  virtualCapital: number;
  stockUniverse: StockUniverse;
  assetClasses: AssetClass[];
  marketRegion: MarketRegion;
  createdByKind?: TradeFloorCreatorKind;
};

export type CreateTradeFloorResult =
  | { ok: true; tradeFloor: TradeFloor; needsApproval: boolean }
  | { ok: false; error: string };

export function createTradeFloor(
  input: CreateTradeFloorInput,
): CreateTradeFloorResult {
  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: "Trade floor name too short." };
  if (name.length > 40) return { ok: false, error: "Trade floor name too long." };

  if (!Number.isFinite(input.startAt) || !Number.isFinite(input.endAt)) {
    return { ok: false, error: "Pick a valid schedule." };
  }
  if (input.endAt <= input.startAt) {
    return { ok: false, error: "End must be after start." };
  }
  if (input.memberCap < 2 || input.memberCap > 200) {
    return { ok: false, error: "Member cap must be between 2 and 200." };
  }
  if (input.virtualCapital < 100_000 || input.virtualCapital > 10_000_000) {
    return { ok: false, error: "Virtual capital must be ₹1L–₹1Cr." };
  }
  if (input.assetClasses.length === 0) {
    return { ok: false, error: "Pick at least one asset class." };
  }

  const approval = needsAdminApproval({
    privacy: input.privacy,
    memberCap: input.memberCap,
  });

  const all = readTradeFloors();
  let id = genCode();
  while (all.some((l) => l.id === id)) id = genCode();

  const tradeFloor: TradeFloor = {
    id,
    name,
    createdBy: input.creator.email,
    createdByKind: input.createdByKind ?? "user",
    createdAt: Date.now(),
    members: [
      {
        email: input.creator.email,
        displayName: input.creator.displayName,
        joinedAt: Date.now(),
      },
    ],
    privacy: input.privacy,
    startAt: input.startAt,
    endAt: input.endAt,
    memberCap: input.memberCap,
    virtualCapital: input.virtualCapital,
    stockUniverse: input.stockUniverse,
    assetClasses: input.assetClasses,
    marketRegion: input.marketRegion,
    status: approval ? "pending_approval" : "live",
  };
  all.push(tradeFloor);
  writeTradeFloors(all);

  const mem = readMemberships(input.creator.email);
  if (!mem.includes(tradeFloor.id)) mem.push(tradeFloor.id);
  writeMemberships(input.creator.email, mem);

  return { ok: true, tradeFloor, needsApproval: approval };
}

export function joinTradeFloor(input: {
  code: string;
  user: { email: string; displayName: string };
}): { ok: true; tradeFloor: TradeFloor } | { ok: false; error: string } {
  const code = input.code.trim().toUpperCase();
  const all = readTradeFloors();
  const tradeFloor = all.find((l) => l.id === code);
  if (!tradeFloor) return { ok: false, error: "No trade floor with that code." };
  if (tradeFloor.status === "pending_approval")
    return { ok: false, error: "This floor is awaiting admin approval." };
  if (tradeFloor.status === "rejected")
    return { ok: false, error: "This floor was rejected." };
  if (tradeFloor.status === "ended")
    return { ok: false, error: "This floor has ended." };
  if (tradeFloor.members.length >= tradeFloor.memberCap)
    return { ok: false, error: `Trade floor is full (${tradeFloor.memberCap} members).` };

  if (!tradeFloor.members.some((m) => m.email === input.user.email)) {
    tradeFloor.members.push({
      email: input.user.email,
      displayName: input.user.displayName,
      joinedAt: Date.now(),
    });
    writeTradeFloors(all);

    const mem = readMemberships(input.user.email);
    if (!mem.includes(tradeFloor.id)) mem.push(tradeFloor.id);
    writeMemberships(input.user.email, mem);
  }
  return { ok: true, tradeFloor };
}

export function getTradeFloor(id: string): TradeFloor | null {
  return readTradeFloors().find((l) => l.id === id.toUpperCase()) ?? null;
}

export function getMyTradeFloors(email: string): TradeFloor[] {
  const ids = new Set(readMemberships(email));
  return readTradeFloors().filter(
    (l) => ids.has(l.id) || l.members.some((m) => m.email === email),
  );
}

/** Mon 00:00 of the current week, ISO yyyy-mm-dd. */
export function currentWeekStart(now = new Date()): string {
  const d = new Date(now);
  const day = d.getDay(); // 0 Sun ... 6 Sat
  const offset = (day + 6) % 7; // days since Monday
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

export type LeaderboardRow = {
  email: string;
  displayName: string;
  xp: number;
  correct: number;
  plays: number;
  streak: number;
  isYou: boolean;
};

/**
 * Weekly leaderboard for a trade floor.
 *
 * Real cloud scores (from daily_results + user_stats) are used when
 * a prior pullScoresFor() call has cached them for the current week.
 * Falls back to a deterministic demo seed when there's no cloud row
 * (offline mode, or member hasn't played any cloud-mirrored runs yet).
 */
export function weeklyLeaderboard(
  tradeFloor: TradeFloor,
  viewerEmail: string,
): LeaderboardRow[] {
  const weekStart = currentWeekStart();
  const weekStartMs = new Date(weekStart).getTime();
  const today = new Date().toISOString().slice(0, 10);

  return tradeFloor.members
    .map((m) => {
      if (m.email === viewerEmail) {
        const p = getProgress(m.email);
        const thisWeek = p.history.filter(
          (h) => new Date(h.dateKey).getTime() >= weekStartMs,
        );
        const xp = thisWeek.reduce((s, h) => s + h.xp, 0);
        const correct = thisWeek.reduce((s, h) => s + h.correct, 0);
        return {
          email: m.email,
          displayName: m.displayName,
          xp,
          correct,
          plays: thisWeek.length,
          streak: p.streak,
          isYou: true,
        };
      }
      const cloud = lookupScore(m.email, weekStart, today);
      if (cloud) {
        return {
          email: m.email,
          displayName: m.displayName,
          xp: cloud.xp,
          correct: cloud.correct,
          plays: cloud.plays,
          streak: cloud.streak,
          isYou: false,
        };
      }
      // Deterministic demo score from email so ranks are stable.
      const seed = [...m.email].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
      const plays = 3 + (seed % 5);
      const xp = 300 + (seed % 1600);
      const correct = Math.min(plays * 5, 2 + (seed % (plays * 4 + 1)));
      const streak = (seed % 22) + 1;
      return {
        email: m.email,
        displayName: m.displayName,
        xp,
        correct,
        plays,
        streak,
        isYou: false,
      };
    })
    .sort((a, b) => b.xp - a.xp);
}

export function whatsappInviteUrl(tradeFloor: TradeFloor): string {
  const text = `Join my TradeVerse trading competition "${tradeFloor.name}". Code: ${tradeFloor.id} — https://tradeverse.app/trade-floors/${tradeFloor.id}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
