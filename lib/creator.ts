"use client";

// Creator programme. Purely activity-based — no money, no pay-to-tier.
// A single creatorPoints() score rolls up posts, fests hosted, sessions
// hosted, referrals, and fest wins. Tier thresholds are static. Each
// tier unlocks UI chrome (chip on profile, directory entry) and sets
// expectations for what a serious organiser is doing.

import { myReferrals } from "./referral";
import { postsAuthoredCount } from "./floor";
import { hostedSessionsCount } from "./sessions";
import { festsWonCount } from "./fests";

// Hosted-fest count: lives here so other libs don't depend on clubs.
import { listClubs } from "./clubs";

export type CreatorTier = "apprentice" | "bronze" | "silver" | "gold" | "platinum";

export type CreatorStats = {
  posts: number;
  festsHosted: number;
  sessionsHosted: number;
  referrals: number;
  festsWon: number;
  points: number;
  tier: CreatorTier;
  nextTier: CreatorTier | null;
  toNext: number; // points to next tier (0 if at top)
  pctToNext: number; // 0..100
};

export const TIER_LABELS: Record<CreatorTier, string> = {
  apprentice: "Apprentice",
  bronze: "Creator",
  silver: "Contributor",
  gold: "Creator+",
  platinum: "Top Creator",
};

export const TIER_ICONS: Record<CreatorTier, string> = {
  apprentice: "🌱",
  bronze: "🥉",
  silver: "🥈",
  gold: "🥇",
  platinum: "💎",
};

const THRESHOLDS: { tier: CreatorTier; min: number }[] = [
  { tier: "apprentice", min: 0 },
  { tier: "bronze", min: 10 },
  { tier: "silver", min: 30 },
  { tier: "gold", min: 75 },
  { tier: "platinum", min: 150 },
];

function festsHostedCountBy(email: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("tv.fests");
    if (!raw) return 0;
    const fests = JSON.parse(raw) as { createdBy: string }[];
    return fests.filter((f) => f.createdBy === email).length;
  } catch {
    return 0;
  }
}

export function creatorStats(email: string): CreatorStats {
  const posts = postsAuthoredCount(email);
  const festsHosted = festsHostedCountBy(email);
  const sessionsHosted = hostedSessionsCount(email);
  const referrals = myReferrals(email).length;
  const festsWon = festsWonCount(email);

  const points =
    posts + festsHosted * 5 + sessionsHosted * 5 + referrals * 3 + festsWon * 10;

  let tier: CreatorTier = "apprentice";
  for (const t of THRESHOLDS) {
    if (points >= t.min) tier = t.tier;
  }
  const currentIdx = THRESHOLDS.findIndex((t) => t.tier === tier);
  const next = THRESHOLDS[currentIdx + 1];
  const nextMin = next?.min ?? 0;
  const toNext = next ? Math.max(0, nextMin - points) : 0;
  const cur = THRESHOLDS[currentIdx];
  const pctToNext = next
    ? Math.min(100, Math.round(((points - cur.min) / (nextMin - cur.min)) * 100))
    : 100;

  return {
    posts,
    festsHosted,
    sessionsHosted,
    referrals,
    festsWon,
    points,
    tier,
    nextTier: next?.tier ?? null,
    toNext,
    pctToNext,
  };
}

export function nextTierMin(tier: CreatorTier): number {
  const idx = THRESHOLDS.findIndex((t) => t.tier === tier);
  return THRESHOLDS[idx + 1]?.min ?? THRESHOLDS[idx].min;
}

export function tierMin(tier: CreatorTier): number {
  return THRESHOLDS.find((t) => t.tier === tier)?.min ?? 0;
}

export function allTiers(): { tier: CreatorTier; min: number }[] {
  return THRESHOLDS.slice();
}

// --- Creator directory ---

export type CreatorRow = {
  handle: string;
  tier: CreatorTier;
  points: number;
  isYou: boolean;
};

const SEED_CREATORS: { handle: string; points: number }[] = [
  { handle: "ananya_b",   points: 210 },
  { handle: "rohan.98",   points: 142 },
  { handle: "kabir_m",    points: 98 },
  { handle: "tara.99",    points: 76 },
  { handle: "advait.dev", points: 58 },
  { handle: "rhea_k",     points: 44 },
  { handle: "neha_iitb",  points: 31 },
  { handle: "vihaan.c",   points: 24 },
  { handle: "anika_mehta",points: 18 },
  { handle: "dev_jhaveri",points: 12 },
];

function tierForPoints(points: number): CreatorTier {
  let tier: CreatorTier = "apprentice";
  for (const t of THRESHOLDS) if (points >= t.min) tier = t.tier;
  return tier;
}

export function creatorDirectory(
  email: string,
  displayName: string,
): CreatorRow[] {
  const you = creatorStats(email);
  const seeded: CreatorRow[] = SEED_CREATORS.map((s) => ({
    handle: `@${s.handle}`,
    tier: tierForPoints(s.points),
    points: s.points,
    isYou: false,
  }));
  const rows = [...seeded];
  if (you.tier !== "apprentice") {
    rows.push({
      handle: `@${displayName}`,
      tier: you.tier,
      points: you.points,
      isYou: true,
    });
  }
  return rows.sort((a, b) => b.points - a.points);
}

// Silence unused-warning on listClubs (kept for future club-boost credit).
void listClubs;
