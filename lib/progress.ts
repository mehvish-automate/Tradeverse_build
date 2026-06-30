"use client";

import { todayKey } from "./questions";

export type DailyResult = {
  dateKey: string;
  correct: number;
  total: number;
  xp: number;
  timeMs: number;
};

const PROGRESS_KEY = (email: string) => `tv.progress.${email}`;

type ProgressStore = {
  streak: number;
  lastPlayedKey: string | null;
  totalXp: number;
  history: DailyResult[];
};

function emptyStore(): ProgressStore {
  return { streak: 0, lastPlayedKey: null, totalXp: 0, history: [] };
}

function read(email: string): ProgressStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(PROGRESS_KEY(email));
    return raw ? (JSON.parse(raw) as ProgressStore) : emptyStore();
  } catch {
    return emptyStore();
  }
}

function write(email: string, store: ProgressStore) {
  localStorage.setItem(PROGRESS_KEY(email), JSON.stringify(store));
}

export function getProgress(email: string): ProgressStore {
  return read(email);
}

export function hasPlayedToday(email: string): boolean {
  return read(email).lastPlayedKey === todayKey();
}

export function todayResult(email: string): DailyResult | null {
  const s = read(email);
  return s.history.find((h) => h.dateKey === todayKey()) ?? null;
}

export function recordResult(email: string, result: DailyResult): ProgressStore {
  const store = read(email);

  // Avoid double-counting if the user replays the same day (e.g. refresh).
  const already = store.history.find((h) => h.dateKey === result.dateKey);
  if (already) return store;

  // Streak logic: +1 if last played was yesterday, otherwise reset to 1.
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterdayKey = y.toISOString().slice(0, 10);

  const nextStreak =
    store.lastPlayedKey === yesterdayKey ? store.streak + 1 : 1;

  const next: ProgressStore = {
    streak: nextStreak,
    lastPlayedKey: result.dateKey,
    totalXp: store.totalXp + result.xp,
    history: [...store.history, result].slice(-60),
  };
  write(email, next);
  return next;
}

/**
 * Add bonus XP outside the daily flow (e.g. a quiz reward grant). Returns
 * the updated store. Does not touch streak/history.
 */
export function awardXp(email: string, amount: number): ProgressStore {
  const store = read(email);
  if (amount <= 0) return store;
  const next: ProgressStore = { ...store, totalXp: store.totalXp + amount };
  write(email, next);
  return next;
}

/** Pure: score one question with a per-question time-bonus. */
export function scoreAnswer(
  correct: boolean,
  msTaken: number,
): { xp: number; points: number } {
  if (!correct) return { xp: 0, points: 0 };
  // 100 base, +up-to-50 for speed if answered under 15s.
  const speedBonus = Math.max(0, 50 - Math.floor(msTaken / 300));
  const points = 100 + speedBonus;
  return { xp: points, points };
}
