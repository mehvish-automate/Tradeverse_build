"use client";

// Quiz Floor post-quiz leaderboard + community stats (Phase 51).
//
// The viewer's row is their real stored best attempt. Other
// participants get deterministic demo scores seeded by the quiz code +
// their email — the same V1 stand-in the XP fest leaderboard uses until
// cloud sync of attempts lands (folded into the realtime phases 52/53).

import type { Fest } from "./fests";
import { getAttempt } from "./quizPlay";

export type QuizLeaderRow = {
  handle: string;
  email: string;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  totalMs: number;
  isYou: boolean;
  played: boolean;
};

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function demoResult(festId: string, email: string, total: number) {
  const seed = hash(`${festId}|${email}`);
  const accPct = 45 + (seed % 51); // 45–95%
  const correct = Math.round((accPct / 100) * total);
  const avgPts = 110 + ((seed >> 8) % 80); // 110–189 per correct
  const perQMs = 1500 + ((seed >> 16) % 3000); // 1.5–4.5s avg
  return { score: correct * avgPts, correct, totalMs: perQMs * total };
}

const pct = (correct: number, total: number) =>
  total > 0 ? Math.round((correct / total) * 100) : 0;

export function quizLeaderboard(
  fest: Fest,
  viewerEmail: string,
  total: number,
): QuizLeaderRow[] {
  const rows: QuizLeaderRow[] = fest.participants.map((p) => {
    if (p.email === viewerEmail) {
      const a = getAttempt(viewerEmail, fest.id);
      if (a) {
        return {
          handle: `@${p.displayName}`,
          email: p.email,
          score: a.score,
          correct: a.correct,
          total: a.total,
          accuracy: pct(a.correct, a.total),
          totalMs: a.totalMs,
          isYou: true,
          played: true,
        };
      }
      return {
        handle: `@${p.displayName}`,
        email: p.email,
        score: 0,
        correct: 0,
        total,
        accuracy: 0,
        totalMs: 0,
        isYou: true,
        played: false,
      };
    }
    const d = demoResult(fest.id, p.email, total);
    return {
      handle: `@${p.displayName}`,
      email: p.email,
      score: d.score,
      correct: d.correct,
      total,
      accuracy: pct(d.correct, total),
      totalMs: d.totalMs,
      isYou: false,
      played: true,
    };
  });

  return rows.sort((a, b) => {
    if (a.played !== b.played) return a.played ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.totalMs - b.totalMs;
  });
}

/** Your 1-based rank, or 0 if you haven't played. */
export function myQuizRank(fest: Fest, viewerEmail: string, total: number): number {
  const rows = quizLeaderboard(fest, viewerEmail, total);
  const i = rows.findIndex((r) => r.isYou && r.played);
  return i < 0 ? 0 : i + 1;
}

/** Deterministic community "% got this right" for a question (V1 stand-in). */
export function quizQuestionPctCorrect(festId: string, questionId: string): number {
  return 35 + (hash(`${festId}::${questionId}`) % 61); // 35–95%
}
