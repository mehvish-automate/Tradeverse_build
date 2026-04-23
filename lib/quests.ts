"use client";

import { completedSet } from "./learnProgress";
import { getMyLeagues } from "./leagues";
import { DailyResult, getProgress } from "./progress";
import { currentWeekStart } from "./leagues";
import { todayKey } from "./questions";

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
  leaguesCount: number;
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
    id: "w-league",
    window: "weekly",
    title: "Join or create a league",
    description: "Race against friends, not alone.",
    rewardXp: 100,
    progress: ({ leaguesCount }) => ({
      done: Math.min(leaguesCount, 1),
      target: 1,
    }),
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
    leaguesCount: getMyLeagues(email).length,
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
