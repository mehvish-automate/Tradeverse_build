"use client";

// Leaderboards. Three player scopes (Phase 47):
//   - Global   — all of TradeVerse. Viewer's real lifetime XP, peers seeded.
//   - Friends  — people in clubs + trade floors I'm a member of. Real cross-
//                user XP for the current week, pulled via pullScoresFor.
//   - Private  — list of my private trade-floor competitions, with my P&L
//                rank inside each. Click-through to the floor leaderboard.
//
// Invariant: ranks are purely skill / activity / paper-P&L based — no
// real money, no pay-to-rank.

import { myClubs, Club, INSTITUTES, Institute, listClubs } from "./clubs";
import { getProgress } from "./progress";
import { competitionLeaderboard } from "./competitions";
import {
  TradeFloor,
  currentWeekStart,
  getMyTradeFloors,
} from "./tradeFloors";
import { lookupScore } from "./supabase/scores-sync";

export type PlayerRow = {
  handle: string;
  xp: number;
  plays: number;
  isYou: boolean;
};

export type ClubRow = {
  id: string;
  name: string;
  instituteShort: string;
  memberCount: number;
  postsCount: number;
  score: number;
};

export type InstituteRow = {
  id: string;
  short: string;
  name: string;
  clubs: number;
  members: number;
  score: number;
};

const SEED_PLAYERS: { handle: string; xpBase: number }[] = [
  { handle: "ananya_b",   xpBase: 9240 },
  { handle: "rohan.98",   xpBase: 7810 },
  { handle: "kabir_m",    xpBase: 7200 },
  { handle: "tara.99",    xpBase: 6850 },
  { handle: "advait.dev", xpBase: 6420 },
  { handle: "rhea_k",     xpBase: 5910 },
  { handle: "neha_iitb",  xpBase: 5280 },
  { handle: "vihaan.c",   xpBase: 4600 },
  { handle: "anika_mehta",xpBase: 4280 },
  { handle: "dev_jhaveri",xpBase: 3950 },
  { handle: "manasi.b",   xpBase: 3640 },
  { handle: "raghav_s",   xpBase: 3210 },
  { handle: "aisha.99",   xpBase: 2840 },
  { handle: "yash_bose",  xpBase: 2460 },
  { handle: "priya_it",   xpBase: 2120 },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

function readClubs(): Club[] {
  return listClubs();
}

function readFloorPostCount(clubId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const arr = JSON.parse(localStorage.getItem(`tv.floor.${clubId}`) || "[]") as unknown[];
    return arr.length;
  } catch {
    return 0;
  }
}

export function topPlayers(
  viewerEmail: string,
  viewerDisplayName: string,
): PlayerRow[] {
  const p = getProgress(viewerEmail);
  const me: PlayerRow = {
    handle: `@${viewerDisplayName}`,
    xp: p.totalXp,
    plays: p.history.length,
    isYou: true,
  };
  const peers: PlayerRow[] = SEED_PLAYERS.map((sp) => ({
    handle: `@${sp.handle}`,
    xp: sp.xpBase,
    plays: 8 + (hash(sp.handle) % 48),
    isYou: false,
  }));
  const rows = [...peers, me];
  rows.sort((a, b) => b.xp - a.xp);
  return rows;
}

export function topClubs(): ClubRow[] {
  const clubs = readClubs();
  const rows: ClubRow[] = clubs.map((c) => {
    const inst = INSTITUTES.find((i) => i.id === c.instituteId);
    const posts = readFloorPostCount(c.id);
    const memberCount = c.members.length;
    // Score: member count weighted + post velocity
    const score = memberCount * 10 + posts * 3;
    return {
      id: c.id,
      name: c.name,
      instituteShort: inst?.short ?? "—",
      memberCount,
      postsCount: posts,
      score,
    };
  });
  return rows.sort((a, b) => b.score - a.score).slice(0, 20);
}

export function topInstitutes(): InstituteRow[] {
  const clubs = readClubs();
  const byInst = new Map<string, { clubs: number; members: number }>();
  for (const c of clubs) {
    const cur = byInst.get(c.instituteId) ?? { clubs: 0, members: 0 };
    cur.clubs++;
    cur.members += c.members.length;
    byInst.set(c.instituteId, cur);
  }
  const rows: InstituteRow[] = [];
  for (const [id, stat] of byInst.entries()) {
    const inst = INSTITUTES.find((i) => i.id === id);
    if (!inst) continue;
    rows.push({
      id: inst.id,
      short: inst.short,
      name: inst.name,
      clubs: stat.clubs,
      members: stat.members,
      score: stat.clubs * 5 + stat.members,
    });
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, 15);
}

export function institutesWithNone(): Institute[] {
  return INSTITUTES;
}

// --- Phase 47: Friends + Private scopes ---

export type FriendRow = {
  email: string;
  handle: string;
  xp: number;
  plays: number;
  correct: number;
  isYou: boolean;
  /** True if cloud score wasn't found and this row reflects local data only. */
  unresolved?: boolean;
};

/** Union of every email I share a club or trade floor with. */
export function friendEmails(
  viewerEmail: string,
): { email: string; displayName: string }[] {
  const map = new Map<string, string>();
  for (const c of myClubs(viewerEmail)) {
    for (const m of c.members) map.set(m.email, m.displayName);
  }
  for (const f of getMyTradeFloors(viewerEmail)) {
    for (const m of f.members) map.set(m.email, m.displayName);
  }
  return [...map.entries()].map(([email, displayName]) => ({
    email,
    displayName,
  }));
}

/**
 * Friends leaderboard for the current week. Viewer's row reads local
 * progress; peers come from the score cache populated by pullScoresFor().
 * Peers we don't have a cloud score for are still listed (xp=0,
 * unresolved=true) so they aren't silently invisible.
 */
export function topFriends(
  viewerEmail: string,
  viewerDisplayName: string,
  now = new Date(),
): FriendRow[] {
  const since = currentWeekStart(now);
  const until = now.toISOString().slice(0, 10);
  const wsMs = new Date(since).getTime();
  const weMs = new Date(until).getTime() + 24 * 60 * 60 * 1000 - 1;

  const rows: FriendRow[] = [];
  const seen = new Set<string>();

  // Seed the viewer first (always show even without friends).
  const p = getProgress(viewerEmail);
  const myWeek = p.history.filter((h) => {
    const t = new Date(h.dateKey).getTime();
    return t >= wsMs && t <= weMs;
  });
  rows.push({
    email: viewerEmail,
    handle: `@${viewerDisplayName}`,
    xp: myWeek.reduce((s, h) => s + h.xp, 0),
    plays: myWeek.length,
    correct: myWeek.reduce((s, h) => s + h.correct, 0),
    isYou: true,
  });
  seen.add(viewerEmail);

  for (const { email, displayName } of friendEmails(viewerEmail)) {
    if (seen.has(email)) continue;
    seen.add(email);
    const cloud = lookupScore(email, since, until);
    rows.push({
      email,
      handle: `@${displayName}`,
      xp: cloud?.xp ?? 0,
      plays: cloud?.plays ?? 0,
      correct: cloud?.correct ?? 0,
      isYou: false,
      unresolved: !cloud,
    });
  }

  rows.sort((a, b) => b.xp - a.xp);
  return rows;
}

export type PrivateFloorEntry = {
  floor: TradeFloor;
  myRank: number; // 1-indexed
  totalMembers: number;
  myPnl: number;
  myPnlPct: number;
};

/**
 * One row per private trade-floor competition I'm a member of.
 * Each entry carries my current P&L rank inside that competition so
 * the user can scan all their private races at a glance, then drill
 * into one for the full leaderboard.
 */
export function myPrivateFloors(viewerEmail: string): PrivateFloorEntry[] {
  const mine = getMyTradeFloors(viewerEmail).filter(
    (f) => f.privacy === "private",
  );
  return mine.map((f) => {
    const rows = competitionLeaderboard(f, viewerEmail);
    const myIdx = rows.findIndex((r) => r.isYou);
    const me = myIdx >= 0 ? rows[myIdx] : null;
    return {
      floor: f,
      myRank: myIdx + 1,
      totalMembers: rows.length,
      myPnl: me?.pnl ?? 0,
      myPnlPct: me?.pnlPct ?? 0,
    };
  });
}
