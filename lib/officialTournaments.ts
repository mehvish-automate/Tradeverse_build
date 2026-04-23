"use client";

// TradeVerse-hosted tournaments. A curated seed so the marketplace has
// content on day one. They're scheduled by "offset days from today" so
// the mix of live / upcoming / ended stays stable as real dates roll.
//
// Participation is tracked in the same user-fest membership store as
// user-hosted fests, so the leaderboard / score / quest / badge paths
// all continue to work without forking a second code path.

import { Fest, festLeaderboard as rawFestLeaderboard, festStatus, userFestScore } from "./fests";
import { InstituteCategory } from "./clubs";

export type OfficialTournament = {
  id: string; // 6–10 char invite code; official ones use TV- prefix
  name: string;
  tagline: string;
  description: string;
  category: InstituteCategory | "Open" | "Alumni";
  baseOffsetDays: number; // start date relative to today
  durationDays: number;
  /** A cosmetic sticker ("sponsor") string — never tied to a real brand. */
  sponsor?: string;
  /** Seeded peers shown on the leaderboard in the absence of real data. */
  seedPeers: string[];
};

export const OFFICIAL_TOURNAMENTS: OfficialTournament[] = [
  {
    id: "TV-BUDGETCUP26",
    name: "Budget Week Cup 2026",
    tagline: "Five days, five sessions. Budget-reaction chart reads.",
    description:
      "Pattern recognition, indicator, and sector-allocation questions pulled from Budget-day market reactions. Played over the five trading days either side of the Union Budget speech.",
    category: "Open",
    baseOffsetDays: -6,
    durationDays: 5,
    sponsor: "TradeVerse Official",
    seedPeers: ["ananya_b", "rohan.98", "kabir_m", "tara.99", "advait.dev", "neha_iitb", "anika_mehta"],
  },
  {
    id: "TV-SUMMERCUP26",
    name: "Summer Markets Cup",
    tagline: "14-day skill gauntlet across the Nifty 50.",
    description:
      "Two weeks of daily chart challenges tuned to the summer-dull tape. Top 100 finishers get the Summer Cup badge.",
    category: "Open",
    baseOffsetDays: 2,
    durationDays: 14,
    sponsor: "TradeVerse Official",
    seedPeers: ["rhea_k", "vihaan.c", "kabir_m", "anika_mehta", "neha_iitb", "advait.dev"],
  },
  {
    id: "TV-IITALUMNI26",
    name: "IIT Alumni League",
    tagline: "Batches 2018–2024. Flexing rights only.",
    description:
      "A light-touch week-long cross-campus tournament between IIT alumni who remember their finance club fondly.",
    category: "Alumni",
    baseOffsetDays: 8,
    durationDays: 7,
    sponsor: "TradeVerse Official",
    seedPeers: ["rohan.98", "advait.dev", "kabir_m", "tara.99"],
  },
  {
    id: "TV-CAFEST26",
    name: "CA Fresher Fest",
    tagline: "For the ICAI / ICMAI / ICSI cohort.",
    description:
      "Fundamentals-weighted question mix — valuation, ratios, quarterly-decode, event-allocation. Built for the CA student cohort.",
    category: "CA",
    baseOffsetDays: -14,
    durationDays: 7,
    sponsor: "TradeVerse Official",
    seedPeers: ["neha_iitb", "rhea_k", "vihaan.c", "anika_mehta"],
  },
];

function offsetDate(days: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** Convert an OfficialTournament into the same shape as a user Fest. */
export function toFest(t: OfficialTournament): Fest {
  const start = offsetDate(t.baseOffsetDays);
  const end = offsetDate(t.baseOffsetDays + t.durationDays - 1);
  return {
    id: t.id,
    clubId: "official-tradeverse",
    name: t.name,
    description: `${t.tagline}\n\n${t.description}`,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    createdBy: "tradeverse-official@",
    createdAt: Date.now(),
    participants: [], // real participants come from localStorage on lookup
  };
}

export function isOfficial(code: string): boolean {
  return code.toUpperCase().startsWith("TV-");
}

export function getOfficialTournament(code: string): OfficialTournament | null {
  return OFFICIAL_TOURNAMENTS.find((t) => t.id === code.toUpperCase()) ?? null;
}

/**
 * Marketplace-facing list: official tournaments first (as pseudo-fests),
 * followed by the user-fest callers can append.
 */
export function officialFests(): Fest[] {
  return OFFICIAL_TOURNAMENTS.map(toFest);
}

export type MarketplaceEntry = {
  fest: Fest;
  official: boolean;
  category: string;
  sponsor?: string;
};

export function toMarketplaceEntries(userFests: Fest[]): MarketplaceEntry[] {
  const official = OFFICIAL_TOURNAMENTS.map((t) => ({
    fest: toFest(t),
    official: true,
    category: t.category,
    sponsor: t.sponsor,
  }));
  const community = userFests.map((f) => ({
    fest: f,
    official: false,
    category: "Community",
  }));
  return [...official, ...community];
}

/** Thin wrappers that know about the official peer seeds. */
export function officialLeaderboard(
  tournament: OfficialTournament,
  viewerEmail: string,
  viewerDisplayName: string,
): { handle: string; email: string; xp: number; plays: number; isYou: boolean }[] {
  const fest = toFest(tournament);

  // Build a deterministic score for each seeded peer.
  const peers = tournament.seedPeers.map((handle) => {
    let seed = 17;
    for (const c of tournament.id + handle) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const plays = 2 + (seed % 7);
    const xp = 200 + (seed % 2000);
    return {
      handle: `@${handle}`,
      email: `${handle}@demo.tradeverse.local`,
      xp,
      plays,
      isYou: false,
    };
  });

  // Include the viewer if they've played inside the window.
  const viewerXp = userFestScore(viewerEmail, fest);
  if (viewerXp > 0) {
    peers.push({
      handle: `@${viewerDisplayName}`,
      email: viewerEmail,
      xp: viewerXp,
      plays: 1,
      isYou: true,
    });
  }

  return peers.sort((a, b) => b.xp - a.xp);
}

export function officialStatus(t: OfficialTournament, now = new Date()) {
  return festStatus(toFest(t), now);
}

/**
 * Ensure the given official tournament exists in the user-fest store so
 * the standard /fests/[code] page and joinFest(…) work without a fork.
 * Idempotent; safe to call on every page load.
 */
export function ensureOfficialInStore(code: string): Fest | null {
  if (typeof window === "undefined") return null;
  const tournament = getOfficialTournament(code);
  if (!tournament) return null;

  const KEY = "tv.fests";
  let all: Fest[] = [];
  try {
    all = JSON.parse(localStorage.getItem(KEY) || "[]") as Fest[];
  } catch {
    all = [];
  }
  const existing = all.find((f) => f.id === tournament.id);
  if (existing) return existing;

  const seeded = toFest(tournament);
  // Seed a few deterministic peers so the leaderboard isn't empty.
  seeded.participants = tournament.seedPeers.map((handle, idx) => ({
    email: `${handle}@demo.tradeverse.local`,
    displayName: handle,
    joinedAt: Date.now() - (idx + 1) * 86400000,
  }));
  all.push(seeded);
  localStorage.setItem(KEY, JSON.stringify(all));
  return seeded;
}

// Avoid unused-import warnings when consumers only want the re-export.
export { rawFestLeaderboard };
