"use client";

import { isAmbassador } from "./ambassadors";
import { myClubs } from "./clubs";
import { beatNiftyCount, resolvedParticipations } from "./eventPortfolios";
import { festsParticipatedCount, festsWonCount } from "./fests";
import { postsAuthoredCount } from "./floor";
import { TRACKS } from "./learn";
import { completedSet, overallCompletion } from "./learnProgress";
import { getMyTradeFloors } from "./tradeFloors";
import { listPortfolios } from "./portfolios";
import { getProgress } from "./progress";
import { creatorStats } from "./creator";
import { ordersPlacedCount } from "./paper";
import { hostedSessionsCount } from "./sessions";
import { watchlistCount } from "./watchlist";

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
  clubsCount: number;
  festsJoined: number;
  festsWon: number;
  isAmbassador: boolean;
  postsAuthored: number;
  sessionsHosted: number;
  watchlistSize: number;
  ordersPlaced: number;
  creatorPoints: number;
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
    description: "Resolve your first Market Events Analysis Challenge.",
    tier: "silver",
    earned: ({ resolvedEvents }) => resolvedEvents >= 1,
  },
  {
    id: "b-event-alpha",
    title: "Beat the benchmark",
    icon: "🎯",
    description: "Finish a Market Events challenge with positive alpha vs NIFTY.",
    tier: "gold",
    earned: ({ beatNiftyEvents }) => beatNiftyEvents >= 1,
  },
  {
    id: "b-club-first",
    title: "Club member",
    icon: "🎓",
    description: "Join or start your first institute club.",
    tier: "bronze",
    earned: ({ clubsCount }) => clubsCount >= 1,
  },
  {
    id: "b-fest-first",
    title: "Fest entrant",
    icon: "🎪",
    description: "Join your first multi-day fest.",
    tier: "silver",
    earned: ({ festsJoined }) => festsJoined >= 1,
  },
  {
    id: "b-fest-win",
    title: "Fest champion",
    icon: "🏅",
    description: "Finish #1 on a resolved fest leaderboard.",
    tier: "gold",
    earned: ({ festsWon }) => festsWon >= 1,
  },
  {
    id: "b-ambassador",
    title: "Campus Ambassador",
    icon: "🎖️",
    description: "Own an institute ambassadorship.",
    tier: "gold",
    earned: ({ isAmbassador }) => isAmbassador,
  },
  {
    id: "b-first-post",
    title: "Trader on the floor",
    icon: "💬",
    description: "Post your first take on a club trading floor.",
    tier: "bronze",
    earned: ({ postsAuthored }) => postsAuthored >= 1,
  },
  {
    id: "b-session-host",
    title: "Session host",
    icon: "🎤",
    description: "Schedule and host your first live session.",
    tier: "silver",
    earned: ({ sessionsHosted }) => sessionsHosted >= 1,
  },
  {
    id: "b-watchlist-5",
    title: "On the watch",
    icon: "👁️",
    description: "Track five stocks on your watchlist.",
    tier: "bronze",
    earned: ({ watchlistSize }) => watchlistSize >= 5,
  },
  {
    id: "b-first-trade",
    title: "First paper trade",
    icon: "📝",
    description: "Place your first paper order.",
    tier: "bronze",
    earned: ({ ordersPlaced }) => ordersPlaced >= 1,
  },
  {
    id: "b-ten-trades",
    title: "Ten clicks in",
    icon: "⚡",
    description: "Place ten paper orders across any kinds.",
    tier: "silver",
    earned: ({ ordersPlaced }) => ordersPlaced >= 10,
  },
  {
    id: "b-creator-bronze",
    title: "Creator unlocked",
    icon: "🥉",
    description: "Cross 10 creator points — the first tier of the programme.",
    tier: "silver",
    earned: ({ creatorPoints }) => creatorPoints >= 10,
  },
  {
    id: "b-creator-gold",
    title: "Top creator",
    icon: "💎",
    description: "Cross 150 creator points — platinum tier.",
    tier: "gold",
    earned: ({ creatorPoints }) => creatorPoints >= 150,
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
  const clubsCount = myClubs(email).length;
  const festsJoined = festsParticipatedCount(email);
  const festsWon = festsWonCount(email);
  const postsAuthored = postsAuthoredCount(email);
  const sessionsHosted = hostedSessionsCount(email);
  const watchlistSize = watchlistCount(email);
  const ordersPlaced = ordersPlacedCount(email);
  const creatorPoints = creatorStats(email).points;

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
    clubsCount,
    festsJoined,
    festsWon,
    isAmbassador: isAmbassador(email),
    postsAuthored,
    sessionsHosted,
    watchlistSize,
    ordersPlaced,
    creatorPoints,
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
