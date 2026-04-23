"use client";

// Global leaderboards. In the absence of a shared backend each
// browser can only see its own user's real XP — so we mix the
// signed-in user's real totals with a deterministic seeded peer set
// so the boards feel populated. Backend swap-in later.
//
// Invariant: ranks are purely skill / activity based — no capital,
// no cash, no pay-to-rank.

import { Club, INSTITUTES, Institute, listClubs } from "./clubs";
import { getProgress } from "./progress";

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
