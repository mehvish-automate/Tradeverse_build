"use client";

// Quiz modes (Phases 54–57): Question of the Day/Week, topic practice,
// quick play, and You-vs-AI. All draw from the shared QUIZ_BANK and run
// through the same QuizRunner. Daily/weekly sets are deterministic by
// date so everyone faces the same questions; practice/quick use a caller
// seed so each run is fresh.

import type { FestQuestion } from "./fests";
import { QuizAttempt, scoreQuizAnswer } from "./quizPlay";
import {
  BankQuestion,
  QUIZ_BANK,
  QuizCategory,
  QuizDifficulty,
} from "./quizQuestions";

// --- seeded RNG ---
function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function toFestQuestion(b: BankQuestion): FestQuestion {
  return { id: b.id, prompt: b.prompt, options: b.options, answer: b.answer, explain: b.explain };
}

export function dailyKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function weekKey(d = new Date()): string {
  const onejan = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function pickFromBank(
  seedStr: string,
  count: number,
  filter?: (q: BankQuestion) => boolean,
): FestQuestion[] {
  const rand = mulberry32(hash(seedStr));
  const pool = filter ? QUIZ_BANK.filter(filter) : QUIZ_BANK;
  const ordered = shuffle(pool.length ? pool : QUIZ_BANK, rand);
  return ordered.slice(0, Math.min(count, ordered.length)).map(toFestQuestion);
}

/** Deterministic daily quiz — same set for everyone on a given date. */
export function dailySet(key = dailyKey(), count = 5): FestQuestion[] {
  return pickFromBank(`daily:${key}`, count);
}

/** Deterministic weekly quiz. */
export function weeklySet(key = weekKey(), count = 10): FestQuestion[] {
  return pickFromBank(`weekly:${key}`, count);
}

/** Topic practice — fresh each run via the caller's seed. */
export function practiceSet(
  opts: { category?: QuizCategory; difficulty?: QuizDifficulty; count?: number; seed: number },
): FestQuestion[] {
  const { category, difficulty, count = 8, seed } = opts;
  return pickFromBank(
    `practice:${category ?? "all"}:${difficulty ?? "all"}:${seed}`,
    count,
    (q) =>
      (!category || q.category === category) && (!difficulty || q.difficulty === difficulty),
  );
}

/** Quick mixed play — fresh each run. */
export function quickSet(seed: number, count = 8): FestQuestion[] {
  return pickFromBank(`quick:${seed}`, count);
}

/** Today's big mass-event quiz — deterministic, larger set. */
export function bigQuizSet(key = dailyKey(), count = 10): FestQuestion[] {
  return pickFromBank(`big:${key}`, count);
}
export function bigQuizId(key = dailyKey()): string {
  return `BIGQUIZ-${key}`;
}

export const QUIZ_CATEGORIES: QuizCategory[] = [
  "basics",
  "technicals",
  "options",
  "fundamentals",
  "macro",
  "mutual-funds",
  "taxation",
  "history",
];

// --- You vs AI ---
export type AiLevel = "rookie" | "pro" | "legend";
export const AI_LEVELS: { id: AiLevel; label: string; accuracy: number; speed: number }[] = [
  { id: "rookie", label: "Rookie bot", accuracy: 0.55, speed: 0.45 },
  { id: "pro", label: "Pro bot", accuracy: 0.75, speed: 0.65 },
  { id: "legend", label: "Legend bot", accuracy: 0.92, speed: 0.85 },
];

export type AiResult = { score: number; correct: number; total: number; totalMs: number };

/**
 * Simulate the AI opponent over the same questions. Deterministic given
 * the seed so a replay of the same match is stable. `limitMs` matches the
 * human's per-question clock.
 */
export function simulateAi(
  level: AiLevel,
  total: number,
  limitMs: number,
  seed: number,
): AiResult {
  const cfg = AI_LEVELS.find((l) => l.id === level)!;
  const rand = mulberry32(hash(`ai:${level}:${seed}`));
  let score = 0;
  let correct = 0;
  let totalMs = 0;
  for (let i = 0; i < total; i++) {
    const isCorrect = rand() < cfg.accuracy;
    // Faster bots answer in a smaller fraction of the clock.
    const frac = 0.2 + (1 - cfg.speed) * 0.7 * rand();
    const msTaken = Math.min(limitMs, Math.round(frac * limitMs));
    totalMs += msTaken;
    if (isCorrect) {
      correct++;
      score += scoreQuizAnswer(true, msTaken, limitMs);
    }
  }
  return { score, correct, total, totalMs };
}

// --- Daily streak store ---
type DailyState = { lastDate: string; streak: number; plays: number };
const DAILY_KEY = (email: string) => `tv.dailyquiz.${email}`;

function readDaily(email: string): DailyState {
  if (typeof window === "undefined") return { lastDate: "", streak: 0, plays: 0 };
  try {
    return JSON.parse(localStorage.getItem(DAILY_KEY(email)) || "null") as DailyState ?? {
      lastDate: "",
      streak: 0,
      plays: 0,
    };
  } catch {
    return { lastDate: "", streak: 0, plays: 0 };
  }
}

function yesterdayKey(key: string): string {
  const d = new Date(key);
  d.setDate(d.getDate() - 1);
  return dailyKey(d);
}

export function dailyDoneToday(email: string, key = dailyKey()): boolean {
  return readDaily(email).lastDate === key;
}

export function dailyStreak(email: string): number {
  return readDaily(email).streak;
}

/** Record a daily-quiz completion; advances/resets the streak. Idempotent per day. */
export function recordDaily(email: string, key = dailyKey()): DailyState {
  const cur = readDaily(email);
  if (cur.lastDate === key) return cur; // already counted today
  const streak = cur.lastDate === yesterdayKey(key) ? cur.streak + 1 : 1;
  const next: DailyState = { lastDate: key, streak, plays: cur.plays + 1 };
  localStorage.setItem(DAILY_KEY(email), JSON.stringify(next));
  return next;
}

export function attemptSummary(a: QuizAttempt): string {
  const acc = a.total ? Math.round((a.correct / a.total) * 100) : 0;
  return `${a.score} pts · ${a.correct}/${a.total} · ${acc}%`;
}
