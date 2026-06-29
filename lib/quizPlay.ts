"use client";

// Quiz Floor — solo timed play scoring + attempt storage (Phase 50).
//
// Each question runs on a short countdown. Scoring is "smartest AND
// fastest": a correct answer earns a flat base plus a speed bonus that
// decays linearly with how long you took. A wrong answer or a timeout
// earns nothing. Best attempt per quiz is kept locally — this is what
// the Phase 51 results + leaderboard read from.
//
// Rewards stay in the allowed invariant set (points/XP, ranks) — never
// cash, never tied to a market-prediction outcome.

export const QUIZ_SECONDS_PER_QUESTION = 5;
export const QUIZ_TIME_LIMIT_MS = QUIZ_SECONDS_PER_QUESTION * 1000;
export const QUIZ_BASE_POINTS = 100; // awarded for any correct answer
export const QUIZ_SPEED_POINTS = 100; // max additional speed bonus

/**
 * Points for one answer. Correct = base + speed bonus (1.0 → instant,
 * 0 → used the full clock). Wrong / timeout = 0.
 */
export function scoreQuizAnswer(
  correct: boolean,
  msTaken: number,
  limitMs = QUIZ_TIME_LIMIT_MS,
): number {
  if (!correct) return 0;
  const clamped = Math.max(0, Math.min(msTaken, limitMs));
  const remainingFraction = 1 - clamped / limitMs;
  return QUIZ_BASE_POINTS + Math.round(QUIZ_SPEED_POINTS * remainingFraction);
}

export type QuizAnswer = {
  questionId: string;
  chosen: number | null; // null = timed out with no pick
  correct: boolean;
  msTaken: number;
  points: number;
};

export type QuizAttempt = {
  festId: string;
  email: string;
  score: number;
  correct: number;
  total: number;
  totalMs: number;
  answers: QuizAnswer[];
  playedAt: number;
};

const ATTEMPTS_KEY = (email: string) => `tv.quizattempts.${email}`;

function readAttempts(email: string): Record<string, QuizAttempt> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY(email)) || "{}") as Record<
      string,
      QuizAttempt
    >;
  } catch {
    return {};
  }
}

function writeAttempts(email: string, map: Record<string, QuizAttempt>) {
  localStorage.setItem(ATTEMPTS_KEY(email), JSON.stringify(map));
}

/** True when `a` is a better result than `b` (higher score, then faster). */
function isBetter(a: QuizAttempt, b: QuizAttempt | undefined): boolean {
  if (!b) return true;
  if (a.score !== b.score) return a.score > b.score;
  return a.totalMs < b.totalMs;
}

/**
 * Persist an attempt, keeping only the player's best per quiz. Returns
 * the attempt now on record (the incoming one if it won, else the prior
 * best) plus whether it was a new personal best.
 */
export function saveAttempt(
  email: string,
  attempt: QuizAttempt,
): { best: QuizAttempt; improved: boolean } {
  const map = readAttempts(email);
  const prior = map[attempt.festId];
  const improved = isBetter(attempt, prior);
  if (improved) {
    map[attempt.festId] = attempt;
    writeAttempts(email, map);
  }
  return { best: improved ? attempt : prior!, improved };
}

export function getAttempt(email: string, festId: string): QuizAttempt | null {
  return readAttempts(email)[festId] ?? null;
}

export function getAttempts(email: string): QuizAttempt[] {
  return Object.values(readAttempts(email)).sort((a, b) => b.playedAt - a.playedAt);
}

export function quizAccuracy(attempt: QuizAttempt): number {
  if (attempt.total === 0) return 0;
  return Math.round((attempt.correct / attempt.total) * 100);
}
