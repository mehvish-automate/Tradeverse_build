"use client";

import { getProgress } from "./progress";

export type SquadMember = {
  email: string;
  displayName: string;
  joinedAt: number;
};

export type Squad = {
  id: string; // invite/share code, short human-friendly
  name: string;
  createdBy: string; // email
  createdAt: number;
  members: SquadMember[];
};

const SQUADS_KEY = "tv.squads";
const MEMBERSHIP_KEY = (email: string) => `tv.memberships.${email}`;

function readSquads(): Squad[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SQUADS_KEY) || "[]") as Squad[];
  } catch {
    return [];
  }
}

function writeSquads(ls: Squad[]) {
  localStorage.setItem(SQUADS_KEY, JSON.stringify(ls));
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

export function createSquad(input: {
  name: string;
  creator: { email: string; displayName: string };
}): { ok: true; squad: Squad } | { ok: false; error: string } {
  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: "Squad name too short." };
  if (name.length > 40) return { ok: false, error: "Squad name too long." };

  const all = readSquads();
  let id = genCode();
  while (all.some((l) => l.id === id)) id = genCode();

  const squad: Squad = {
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
  all.push(squad);
  writeSquads(all);

  const mem = readMemberships(input.creator.email);
  if (!mem.includes(squad.id)) mem.push(squad.id);
  writeMemberships(input.creator.email, mem);

  return { ok: true, squad };
}

export function joinSquad(input: {
  code: string;
  user: { email: string; displayName: string };
}): { ok: true; squad: Squad } | { ok: false; error: string } {
  const code = input.code.trim().toUpperCase();
  const all = readSquads();
  const squad = all.find((l) => l.id === code);
  if (!squad) return { ok: false, error: "No squad with that code." };
  if (squad.members.length >= 20)
    return { ok: false, error: "Squad is full (20 members)." };

  if (!squad.members.some((m) => m.email === input.user.email)) {
    squad.members.push({
      email: input.user.email,
      displayName: input.user.displayName,
      joinedAt: Date.now(),
    });
    writeSquads(all);

    const mem = readMemberships(input.user.email);
    if (!mem.includes(squad.id)) mem.push(squad.id);
    writeMemberships(input.user.email, mem);
  }
  return { ok: true, squad };
}

export function getSquad(id: string): Squad | null {
  return readSquads().find((l) => l.id === id.toUpperCase()) ?? null;
}

export function getMySquads(email: string): Squad[] {
  const ids = new Set(readMemberships(email));
  return readSquads().filter(
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
 * Weekly leaderboard for a squad.
 *
 * V1 caveat: each browser only holds its own user's progress in
 * localStorage, so the "live" numbers you see here mix your real score
 * with deterministic demo scores for the other members. Phase 5 replaces
 * this with server-backed scores.
 */
export function weeklyLeaderboard(
  squad: Squad,
  viewerEmail: string,
): LeaderboardRow[] {
  const weekStart = currentWeekStart();
  const weekStartMs = new Date(weekStart).getTime();

  return squad.members
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

export function whatsappInviteUrl(squad: Squad): string {
  const text = `Join my TradeVerse squad "${squad.name}". Code: ${squad.id} — https://tradeverse.app/squads/${squad.id}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
