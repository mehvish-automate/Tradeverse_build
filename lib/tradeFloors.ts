"use client";

import { getProgress } from "./progress";
import { lookupScore } from "./supabase/scores-sync";

export type TradeFloorMember = {
  email: string;
  displayName: string;
  joinedAt: number;
};

export type TradeFloor = {
  id: string; // invite/share code, short human-friendly
  name: string;
  createdBy: string; // email
  createdAt: number;
  members: TradeFloorMember[];
};

const TRADE_FLOORS_KEY = "tv.tradeFloors";
const MEMBERSHIP_KEY = (email: string) => `tv.memberships.${email}`;

function readTradeFloors(): TradeFloor[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(TRADE_FLOORS_KEY) || "[]") as TradeFloor[];
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

export function createTradeFloor(input: {
  name: string;
  creator: { email: string; displayName: string };
}): { ok: true; tradeFloor: TradeFloor } | { ok: false; error: string } {
  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: "Trade Floor name too short." };
  if (name.length > 40) return { ok: false, error: "Trade Floor name too long." };

  const all = readTradeFloors();
  let id = genCode();
  while (all.some((l) => l.id === id)) id = genCode();

  const tradeFloor: TradeFloor = {
    id,
    name,
    createdBy: input.creator.email,
    createdAt: Date.now(),
    members: [
      {
        email: input.creator.email,
        displayName: input.creator.displayName,
        joinedAt: Date.now(),
      },
    ],
  };
  all.push(tradeFloor);
  writeTradeFloors(all);

  const mem = readMemberships(input.creator.email);
  if (!mem.includes(tradeFloor.id)) mem.push(tradeFloor.id);
  writeMemberships(input.creator.email, mem);

  return { ok: true, tradeFloor };
}

export function joinTradeFloor(input: {
  code: string;
  user: { email: string; displayName: string };
}): { ok: true; tradeFloor: TradeFloor } | { ok: false; error: string } {
  const code = input.code.trim().toUpperCase();
  const all = readTradeFloors();
  const tradeFloor = all.find((l) => l.id === code);
  if (!tradeFloor) return { ok: false, error: "No trade floor with that code." };
  if (tradeFloor.members.length >= 20)
    return { ok: false, error: "Trade Floor is full (20 members)." };

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
  const text = `Join my TradeVerse trade floor "${tradeFloor.name}". Code: ${tradeFloor.id} — https://tradeverse.app/trade-floors/${tradeFloor.id}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
