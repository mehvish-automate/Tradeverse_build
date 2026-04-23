"use client";

import { myAmbassadorships } from "./ambassadors";
import { myClubs } from "./clubs";
import { beatNiftyCount, resolvedParticipations } from "./eventPortfolios";
import { festsParticipatedCount, festsWonCount } from "./fests";
import { postsAuthoredCount } from "./floor";
import { completedSet } from "./learnProgress";
import { getMyTradeFloors } from "./tradeFloors";
import { listPortfolios } from "./portfolios";
import { DailyResult, getProgress } from "./progress";
import { currentWeekStart } from "./tradeFloors";
import { todayKey } from "./questions";
import { hostedSessionsCount, mySessions } from "./sessions";
import { watchlistCount } from "./watchlist";

export type QuestWindow = "daily" | "weekly" | "monthly";

export type Quest = {
  id: string;
  window: QuestWindow;
  title: string;
  description: string;
  rewardXp: number;
  progress: (ctx: ProgressCtx) => { done: number; target: number };
};

export type ProgressCtx = {
  email: string;
  todayRun: DailyResult | null;
  windowRuns: DailyResult[]; // runs within the active window
  streak: number;
  lessonsDone: number;
  tradeFloorsCount: number;
  portfoliosCount: number;
  resolvedEvents: number;
  beatNiftyEvents: number;
  clubsCount: number;
  festsJoined: number;
  festsWon: number;
  ambassadorships: number;
  postsAuthored: number;
  sessionsHosted: number;
  sessionsRsvp: number;
  watchlistSize: number;
};

const CLAIM_KEY = (email: string) => `tv.quests.claims.${email}`;

type ClaimStore = Record<string /* questId|windowKey */, number /* claimed ts */>;

function readClaims(email: string): ClaimStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CLAIM_KEY(email)) || "{}") as ClaimStore;
  } catch {
    return {};
  }
}

function writeClaims(email: string, store: ClaimStore) {
  localStorage.setItem(CLAIM_KEY(email), JSON.stringify(store));
}

/** Window bucket key used to scope claims. */
export function windowKey(win: QuestWindow, now = new Date()): string {
  if (win === "daily") return `d:${todayKey(now)}`;
  if (win === "weekly") return `w:${currentWeekStart(now)}`;
  // monthly: YYYY-MM
  return `m:${now.toISOString().slice(0, 7)}`;
}

export const QUESTS: Quest[] = [
  // --- Daily ---
  {
    id: "d-play",
    window: "daily",
    title: "Play today's challenge",
    description: "Finish the 5-question daily run.",
    rewardXp: 50,
    progress: ({ todayRun }) => ({ done: todayRun ? 1 : 0, target: 1 }),
  },
  {
    id: "d-accuracy",
    window: "daily",
    title: "Get at least 3 right today",
    description: "Quality over speed. 3/5 or better.",
    rewardXp: 75,
    progress: ({ todayRun }) => ({
      done: todayRun ? Math.min(todayRun.correct, 3) : 0,
      target: 3,
    }),
  },
  // --- Weekly ---
  {
    id: "w-streak",
    window: "weekly",
    title: "Build a 3-day streak",
    description: "Play 3 days in a row any time this week.",
    rewardXp: 200,
    progress: ({ streak }) => ({ done: Math.min(streak, 3), target: 3 }),
  },
  {
    id: "w-lessons",
    window: "weekly",
    title: "Complete 2 lessons",
    description: "Any two lessons from the skill tree.",
    rewardXp: 150,
    progress: ({ lessonsDone }) => ({ done: Math.min(lessonsDone, 2), target: 2 }),
  },
  {
    id: "w-trade floor",
    window: "weekly",
    title: "Join or create a trade floor",
    description: "Race against friends, not alone.",
    rewardXp: 100,
    progress: ({ tradeFloorsCount }) => ({
      done: Math.min(tradeFloorsCount, 1),
      target: 1,
    }),
  },
  {
    id: "w-portfolio",
    window: "weekly",
    title: "Build a strategy portfolio",
    description: "One allocation this week. No real money.",
    rewardXp: 200,
    progress: ({ portfoliosCount }) => ({
      done: Math.min(portfoliosCount, 1),
      target: 1,
    }),
  },
  {
    id: "w-event",
    window: "weekly",
    title: "Submit an event allocation",
    description: "Pick a sector allocation on any open event.",
    rewardXp: 150,
    progress: ({ email }) => {
      const raw =
        typeof window !== "undefined"
          ? localStorage.getItem(`tv.events.${email}`) || "[]"
          : "[]";
      let participated = 0;
      try {
        participated = (JSON.parse(raw) as { eventId: string }[]).length;
      } catch {
        // keep 0
      }
      return { done: Math.min(participated, 1), target: 1 };
    },
  },
  // --- Monthly ---
  {
    id: "m-plays",
    window: "monthly",
    title: "Play 15 daily challenges this month",
    description: "Build the habit. Showing up is the game.",
    rewardXp: 500,
    progress: ({ windowRuns }) => ({
      done: Math.min(windowRuns.length, 15),
      target: 15,
    }),
  },
  {
    id: "m-perfect",
    window: "monthly",
    title: "Score 5/5 on any day",
    description: "One flawless run this month.",
    rewardXp: 400,
    progress: ({ windowRuns }) => ({
      done: Math.min(windowRuns.filter((r) => r.correct === r.total).length, 1),
      target: 1,
    }),
  },
  {
    id: "m-beat-nifty",
    window: "monthly",
    title: "Beat NIFTY on an event",
    description: "Resolve one Market Events challenge with positive alpha.",
    rewardXp: 500,
    progress: ({ beatNiftyEvents }) => ({
      done: Math.min(beatNiftyEvents, 1),
      target: 1,
    }),
  },
  {
    id: "w-club",
    window: "weekly",
    title: "Join or start a club",
    description: "Find your institute, join its finance club.",
    rewardXp: 150,
    progress: ({ clubsCount }) => ({
      done: Math.min(clubsCount, 1),
      target: 1,
    }),
  },
  {
    id: "m-fest",
    window: "monthly",
    title: "Join a fest",
    description: "Enter a multi-day club tournament via invite code.",
    rewardXp: 300,
    progress: ({ festsJoined }) => ({
      done: Math.min(festsJoined, 1),
      target: 1,
    }),
  },
  {
    id: "m-fest-win",
    window: "monthly",
    title: "Win a fest",
    description: "Finish #1 on a resolved fest leaderboard.",
    rewardXp: 800,
    progress: ({ festsWon }) => ({
      done: Math.min(festsWon, 1),
      target: 1,
    }),
  },
  {
    id: "w-post",
    window: "weekly",
    title: "Post on a club floor",
    description: "Share a chart read, take, or portfolio note.",
    rewardXp: 100,
    progress: ({ postsAuthored }) => ({
      done: Math.min(postsAuthored, 1),
      target: 1,
    }),
  },
  {
    id: "w-rsvp",
    window: "weekly",
    title: "RSVP to a live session",
    description: "Show up to a club walkthrough, AMA, or market-open watch.",
    rewardXp: 100,
    progress: ({ sessionsRsvp }) => ({
      done: Math.min(sessionsRsvp, 1),
      target: 1,
    }),
  },
  {
    id: "m-host",
    window: "monthly",
    title: "Host a live session",
    description: "Schedule and run your own club session.",
    rewardXp: 400,
    progress: ({ sessionsHosted }) => ({
      done: Math.min(sessionsHosted, 1),
      target: 1,
    }),
  },
  {
    id: "w-watch",
    window: "weekly",
    title: "Watchlist 3 stocks",
    description: "Pick three names to follow this week.",
    rewardXp: 100,
    progress: ({ watchlistSize }) => ({
      done: Math.min(watchlistSize, 3),
      target: 3,
    }),
  },
];

function runsForWindow(
  history: DailyResult[],
  win: QuestWindow,
  now = new Date(),
): DailyResult[] {
  if (win === "daily") {
    const k = todayKey(now);
    return history.filter((h) => h.dateKey === k);
  }
  if (win === "weekly") {
    const ws = currentWeekStart(now);
    const wsMs = new Date(ws).getTime();
    return history.filter((h) => new Date(h.dateKey).getTime() >= wsMs);
  }
  // monthly
  const month = now.toISOString().slice(0, 7);
  return history.filter((h) => h.dateKey.startsWith(month));
}

export function buildContext(email: string, now = new Date()): ProgressCtx {
  const p = getProgress(email);
  const today = p.history.find((h) => h.dateKey === todayKey(now)) ?? null;
  return {
    email,
    todayRun: today,
    windowRuns: p.history,
    streak: p.streak,
    lessonsDone: completedSet(email).size,
    tradeFloorsCount: getMyTradeFloors(email).length,
    portfoliosCount: listPortfolios(email).length,
    resolvedEvents: resolvedParticipations(email),
    beatNiftyEvents: beatNiftyCount(email),
    clubsCount: myClubs(email).length,
    festsJoined: festsParticipatedCount(email),
    festsWon: festsWonCount(email),
    ambassadorships: myAmbassadorships(email).length,
    postsAuthored: postsAuthoredCount(email),
    sessionsHosted: hostedSessionsCount(email),
    sessionsRsvp: mySessions(email).length,
    watchlistSize: watchlistCount(email),
  };
}

export type QuestView = {
  quest: Quest;
  done: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  canClaim: boolean;
  key: string; // id|windowKey
};

export function viewQuests(email: string, now = new Date()): QuestView[] {
  const base = buildContext(email, now);
  const p = getProgress(email);
  const claims = readClaims(email);

  return QUESTS.map((q) => {
    const scopedRuns = runsForWindow(p.history, q.window, now);
    const ctx: ProgressCtx = { ...base, windowRuns: scopedRuns };
    const { done, target } = q.progress(ctx);
    const completed = done >= target;
    const key = `${q.id}|${windowKey(q.window, now)}`;
    const claimed = Boolean(claims[key]);
    return {
      quest: q,
      done,
      target,
      completed,
      claimed,
      canClaim: completed && !claimed,
      key,
    };
  });
}

export function claimQuest(
  email: string,
  key: string,
  rewardXp: number,
): { ok: boolean; error?: string } {
  const claims = readClaims(email);
  if (claims[key]) return { ok: false, error: "Already claimed." };
  claims[key] = Date.now();
  writeClaims(email, claims);

  // Credit XP into the main progress store.
  const PROGRESS_KEY = `tv.progress.${email}`;
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (raw) {
    try {
      const store = JSON.parse(raw) as {
        streak: number;
        lastPlayedKey: string | null;
        totalXp: number;
        history: DailyResult[];
      };
      store.totalXp += rewardXp;
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
    } catch {
      // fall through — quest is marked claimed regardless
    }
  }
  return { ok: true };
}
