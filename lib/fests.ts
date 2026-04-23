"use client";

// Club-hosted fests: multi-day tournaments with their own invite code
// and leaderboard. Hosts (club owners) set a start + end date; anyone
// with the 6-char code can enter. Scored on XP accrued during the
// window. Rewards are XP/ranks — NEVER paid entry or cash prizes (V3
// tournaments are a separate legal entity, per the spec).

import { getClub, getInstitute } from "./clubs";
import { getProgress } from "./progress";

export type Fest = {
  id: string; // 6-char invite code (A–Z, 2–9)
  clubId: string;
  name: string;
  description?: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  createdBy: string;
  createdAt: number;
  participants: { email: string; displayName: string; joinedAt: number }[];
};

const FESTS_KEY = "tv.fests";
const MY_FESTS_KEY = (email: string) => `tv.myfests.${email}`;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++)
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

function readFests(): Fest[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FESTS_KEY) || "[]") as Fest[];
  } catch {
    return [];
  }
}
function writeFests(fs: Fest[]) {
  localStorage.setItem(FESTS_KEY, JSON.stringify(fs));
}

function readMyFests(email: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(MY_FESTS_KEY(email)) || "[]") as string[];
  } catch {
    return [];
  }
}
function writeMyFests(email: string, ids: string[]) {
  localStorage.setItem(MY_FESTS_KEY(email), JSON.stringify(ids));
}

// --- CRUD ---

export function festsForClub(clubId: string): Fest[] {
  return readFests()
    .filter((f) => f.clubId === clubId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getFest(code: string): Fest | null {
  return readFests().find((f) => f.id === code.toUpperCase()) ?? null;
}

export function myFests(email: string): Fest[] {
  const ids = new Set(readMyFests(email));
  return readFests().filter(
    (f) => ids.has(f.id) || f.participants.some((p) => p.email === email),
  );
}

export function createFest(input: {
  clubId: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  creator: { email: string; displayName: string };
}): { ok: true; fest: Fest } | { ok: false; error: string } {
  const club = getClub(input.clubId);
  if (!club) return { ok: false, error: "Club not found." };

  const isOwner = club.members.some(
    (m) => m.email === input.creator.email && m.role === "owner",
  );
  if (!isOwner)
    return { ok: false, error: "Only the club owner can host a fest." };

  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: "Name too short (min 3)." };
  if (name.length > 60) return { ok: false, error: "Name too long (max 60)." };

  const s = new Date(input.startDate);
  const e = new Date(input.endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))
    return { ok: false, error: "Pick valid dates." };
  if (e.getTime() < s.getTime())
    return { ok: false, error: "End date must be on or after start date." };

  const all = readFests();
  let id = genCode();
  while (all.some((f) => f.id === id)) id = genCode();

  const fest: Fest = {
    id,
    clubId: input.clubId,
    name,
    description: input.description?.trim() || undefined,
    startDate: input.startDate,
    endDate: input.endDate,
    createdBy: input.creator.email,
    createdAt: Date.now(),
    participants: [
      {
        email: input.creator.email,
        displayName: input.creator.displayName,
        joinedAt: Date.now(),
      },
    ],
  };
  all.push(fest);
  writeFests(all);

  const my = readMyFests(input.creator.email);
  if (!my.includes(fest.id)) my.push(fest.id);
  writeMyFests(input.creator.email, my);

  return { ok: true, fest };
}

export function joinFest(
  code: string,
  user: { email: string; displayName: string },
): { ok: true; fest: Fest } | { ok: false; error: string } {
  const all = readFests();
  const fest = all.find((f) => f.id === code.toUpperCase());
  if (!fest) return { ok: false, error: "No fest with that code." };
  if (fest.participants.some((p) => p.email === user.email)) {
    return { ok: true, fest };
  }
  fest.participants.push({
    email: user.email,
    displayName: user.displayName,
    joinedAt: Date.now(),
  });
  writeFests(all);

  const my = readMyFests(user.email);
  if (!my.includes(fest.id)) my.push(fest.id);
  writeMyFests(user.email, my);

  return { ok: true, fest };
}

// --- Scoring ---

export type FestStatus = "upcoming" | "live" | "ended";

export function festStatus(fest: Fest, now = new Date()): FestStatus {
  const nowMs = now.getTime();
  const startMs = new Date(fest.startDate).getTime();
  const endMs = new Date(fest.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
  if (nowMs < startMs) return "upcoming";
  if (nowMs > endMs) return "ended";
  return "live";
}

/** Sum of XP a user accrued on daily challenges during the fest window. */
export function userFestScore(email: string, fest: Fest): number {
  const p = getProgress(email);
  const startMs = new Date(fest.startDate).getTime();
  const endMs = new Date(fest.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
  return p.history.reduce((sum, h) => {
    const t = new Date(h.dateKey).getTime();
    return t >= startMs && t <= endMs ? sum + h.xp : sum;
  }, 0);
}

export type FestLeaderRow = {
  handle: string;
  email: string;
  xp: number;
  plays: number;
  isYou: boolean;
};

/**
 * Real participants' scores come from their own localStorage when the
 * data exists; otherwise we fill them with a deterministic demo score
 * seeded by (fest id, email) so ranks are stable. Backend swap-in later.
 */
export function festLeaderboard(
  fest: Fest,
  viewerEmail: string,
): FestLeaderRow[] {
  return fest.participants
    .map((p) => {
      if (p.email === viewerEmail) {
        const prog = getProgress(p.email);
        const xp = userFestScore(p.email, fest);
        const startMs = new Date(fest.startDate).getTime();
        const endMs = new Date(fest.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
        const plays = prog.history.filter((h) => {
          const t = new Date(h.dateKey).getTime();
          return t >= startMs && t <= endMs;
        }).length;
        return {
          handle: `@${p.displayName}`,
          email: p.email,
          xp,
          plays,
          isYou: true,
        };
      }
      let seed = 13;
      for (const c of fest.id + p.email) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
      const plays = 2 + (seed % 6);
      const xp = 150 + (seed % 1800);
      return {
        handle: `@${p.displayName}`,
        email: p.email,
        xp,
        plays,
        isYou: false,
      };
    })
    .sort((a, b) => b.xp - a.xp);
}

export function festWhatsappInvite(fest: Fest): string {
  const club = getClub(fest.clubId);
  const inst = club ? getInstitute(club.instituteId) : null;
  const where = club ? `${club.name}${inst ? ` (${inst.short})` : ""}` : "TradeVerse";
  const text = `Join "${fest.name}" at ${where} on TradeVerse. Code: ${fest.id} — https://tradeverse.app/fests/${fest.id}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// --- Counters for quests / badges / profile ---

export function festsParticipatedCount(email: string): number {
  return myFests(email).length;
}

export function festsWonCount(email: string, now = new Date()): number {
  return myFests(email).filter((f) => {
    if (festStatus(f, now) !== "ended") return false;
    const rows = festLeaderboard(f, email);
    return rows[0]?.email === email;
  }).length;
}
