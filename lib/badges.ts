"use client";

import { beatNiftyCount, resolvedParticipations } from "./eventPortfolios";
import { TRACKS } from "./learn";
import { completedSet, overallCompletion } from "./learnProgress";
import { getMyTradeFloors } from "./tradeFloors";
import { listPortfolios } from "./portfolios";
import { getProgress } from "./progress";

export type Badge = {
  id: string;
  title: string;
  icon: string; // single emoji; keeps it dependency-free
  description: string;
  /** Tier purely for visual grouping: bronze/silver/gold */
  tier: "bronze" | "silver" | "gold";
  earned: (ctx: BadgeCtx) => boolean;
};

export type BadgeCtx = {
  email: string;
  streak: number;
  longestStreak: number;
  plays: number;
  totalXp: number;
  perfectDays: number;
  lessonsDone: number;
  tracksCompleted: number;
  tradeFloorsCount: number;
  portfoliosCount: number;
  resolvedEvents: number;
  beatNiftyEvents: number;
};

export const BADGES: Badge[] = [
  {
    id: "b-first-play",
    title: "First run",
    icon: "🎯",
    description: "Finish your first daily challenge.",
    tier: "bronze",
    earned: ({ plays }) => plays >= 1,
  },
  {
    id: "b-first-perfect",
    title: "Flawless",
    icon: "🏆",
    description: "Score 5/5 on a single daily run.",
    tier: "silver",
    earned: ({ perfectDays }) => perfectDays >= 1,
  },
  {
    id: "b-streak-5",
    title: "Habit forming",
    icon: "🔥",
    description: "Keep a 5-day streak.",
    tier: "bronze",
    earned: ({ longestStreak }) => longestStreak >= 5,
  },
  {
    id: "b-streak-15",
    title: "Two-week veteran",
    icon: "🪨",
    description: "Keep a 15-day streak.",
    tier: "silver",
    earned: ({ longestStreak }) => longestStreak >= 15,
  },
  {
    id: "b-streak-30",
    title: "Month of muscle memory",
    icon: "💎",
    description: "Keep a 30-day streak.",
    tier: "gold",
    earned: ({ longestStreak }) => longestStreak >= 30,
  },
  {
    id: "b-xp-1k",
    title: "First 1,000 XP",
    icon: "⚡",
    description: "Cross the 1,000 lifetime XP mark.",
    tier: "bronze",
    earned: ({ totalXp }) => totalXp >= 1000,
  },
  {
    id: "b-xp-10k",
    title: "Ten thousand",
    icon: "🚀",
    description: "Cross 10,000 lifetime XP.",
    tier: "gold",
    earned: ({ totalXp }) => totalXp >= 10000,
  },
  {
    id: "b-lesson-first",
    title: "First lesson",
    icon: "📘",
    description: "Complete any skill-tree lesson.",
    tier: "bronze",
    earned: ({ lessonsDone }) => lessonsDone >= 1,
  },
  {
    id: "b-track-done",
    title: "Track complete",
    icon: "🧭",
    description: "Finish every lesson in any track.",
    tier: "silver",
    earned: ({ tracksCompleted }) => tracksCompleted >= 1,
  },
  {
    id: "b-tradefloor-joined",
    title: "In the arena",
    icon: "🤝",
    description: "Create or join your first trade floor.",
    tier: "bronze",
    earned: ({ tradeFloorsCount }) => tradeFloorsCount >= 1,
  },
  {
    id: "b-portfolio-first",
    title: "Allocator",
    icon: "📊",
    description: "Build your first strategy portfolio.",
    tier: "bronze",
    earned: ({ portfoliosCount }) => portfoliosCount >= 1,
  },
  {
    id: "b-event-first",
    title: "Event picker",
    icon: "🗞️",
    description: "Resolve your first event portfolio.",
    tier: "silver",
    earned: ({ resolvedEvents }) => resolvedEvents >= 1,
  },
  {
    id: "b-event-alpha",
    title: "Beat the benchmark",
    icon: "🎯",
    description: "Finish an event portfolio with positive alpha vs NIFTY.",
    tier: "gold",
    earned: ({ beatNiftyEvents }) => beatNiftyEvents >= 1,
  },
];

export function buildBadgeCtx(email: string): BadgeCtx {
  const p = getProgress(email);
  const learn = overallCompletion(email);
  const done = completedSet(email);
  const perfectDays = p.history.filter((h) => h.correct === h.total).length;

  // Walk history in chronological order to compute longest-ever streak.
  const sorted = [...p.history].sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const h of sorted) {
    if (prev) {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      const expect = d.toISOString().slice(0, 10);
      run = h.dateKey === expect ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = h.dateKey;
  }
  longest = Math.max(longest, p.streak);

  const tracksCompleted = TRACKS.filter((t) =>
    t.lessons.every((l) => done.has(l.id)),
  ).length;
  const portfoliosCount = listPortfolios(email).length;
  const resolvedEvents = resolvedParticipations(email);
  const beatNiftyEvents = beatNiftyCount(email);

  return {
    email,
    streak: p.streak,
    longestStreak: longest,
    plays: p.history.length,
    totalXp: p.totalXp,
    perfectDays,
    lessonsDone: learn.done,
    tracksCompleted,
    tradeFloorsCount: getMyTradeFloors(email).length,
    portfoliosCount,
    resolvedEvents,
    beatNiftyEvents,
  };
}

export type BadgeView = { badge: Badge; earned: boolean };

export function viewBadges(email: string): BadgeView[] {
  const ctx = buildBadgeCtx(email);
  return BADGES.map((b) => ({ badge: b, earned: b.earned(ctx) }));
}

export function earnedCount(email: string): { earned: number; total: number } {
  const vs = viewBadges(email);
  return { earned: vs.filter((v) => v.earned).length, total: vs.length };
}
