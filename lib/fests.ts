"use client";

// Club-hosted fests: multi-day tournaments with their own invite code
// and leaderboard. Hosts (club owners) set a start + end date; anyone
// with the 6-char code can enter. Scored on XP accrued during the
// window. Rewards are XP/ranks — NEVER paid entry or cash prizes (V3
// tournaments are a separate legal entity, per the spec).

import { getClub, getInstitute } from "./clubs";
import { getProgress } from "./progress";
import type { RewardTier } from "./rewardTiers";
import { lookupScore } from "./supabase/scores-sync";

export type FestEventType =
  | "paper-trading"
  | "prediction"
  | "quiz"
  | "case-study"
  | "hackathon"
  | "markets-news"
  | "crossword"
  | "mixed";

export type FestDifficulty = "beginner" | "intermediate" | "advanced";

export type FestSource = "system" | "custom";

export type FestQuestion = {
  id: string;
  prompt: string;
  options: string[]; // 2–5 options
  answer: number; // index into options
  explain?: string;
};

export type FestPrivacy = "public" | "private";
export type FestLifecycleStatus =
  | "pending_approval"
  | "live"
  | "ended"
  | "rejected";

export type Fest = {
  id: string; // 6-char invite code (A–Z, 2–9)
  /** Null = standalone quiz (not tied to a club). */
  clubId: string | null;
  name: string;
  description?: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  createdBy: string;
  createdAt: number;
  participants: { email: string; displayName: string; joinedAt: number }[];
  eventType?: FestEventType;
  difficulty?: FestDifficulty;
  source?: FestSource;
  questions?: FestQuestion[];
  // Phase 43 launch fields
  privacy?: FestPrivacy;
  lifecycleStatus?: FestLifecycleStatus;
  categories?: string[];
  /** Quiz-launch cap. Default 50. Approval if private && cap > 100. */
  memberCap?: number;
  /** Optional time-of-day precision (ms epoch). Fall back to startDate. */
  startsAtMs?: number;
  endsAtMs?: number;
  /** Phase 59 — reward tiers (non-cash: XP / coupon). */
  rewards?: RewardTier[];
  /** Admin's reason when lifecycleStatus = 'rejected'. */
  rejectionReason?: string;
};

/** Default missing Phase 43 fields when reading legacy fests. */
function withFestDefaults(f: Fest): Fest {
  return {
    privacy: "private",
    lifecycleStatus: "live",
    categories: [],
    memberCap: 50,
    rewards: [],
    ...f,
  };
}

/**
 * Public fests are always reviewed. Private fests are reviewed when
 * the cap exceeds 100 (quiz launch threshold from the spec board).
 */
export function festNeedsAdminApproval(input: {
  privacy: FestPrivacy;
  memberCap?: number;
}): boolean {
  if (input.privacy === "public") return true;
  if ((input.memberCap ?? 0) > 100) return true;
  return false;
}

export const FEST_EVENT_TYPES: { id: FestEventType; label: string; blurb: string }[] = [
  { id: "paper-trading", label: "Paper trading", blurb: "Who finishes the window with the highest paper P&L." },
  { id: "prediction",    label: "Prediction",    blurb: "Breakouts, sector moves, earnings direction." },
  { id: "quiz",          label: "Quiz",          blurb: "Finance knowledge MCQs — speed + accuracy." },
  { id: "case-study",    label: "Case study",    blurb: "Long-form scenario, pick an answer or write one." },
  { id: "hackathon",     label: "Hackathon",     blurb: "Multi-day open-ended challenge; host grades entries." },
  { id: "markets-news",  label: "Markets news",  blurb: "News-to-market-move matching." },
  { id: "crossword",     label: "Crossword",     blurb: "Finance-term crossword run." },
  { id: "mixed",         label: "Mixed",         blurb: "A combination across the formats above." },
];

export const FEST_DIFFICULTIES: { id: FestDifficulty; label: string }[] = [
  { id: "beginner",     label: "Beginner" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced",     label: "Advanced" },
];

const FESTS_KEY = "tv.fests";
const MY_FESTS_KEY = (email: string) => `tv.myfests.${email}`;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function genCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++)
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

function readFests(): Fest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(FESTS_KEY) || "[]") as Fest[];
    return raw.map(withFestDefaults);
  } catch {
    return [];
  }
}
function writeFests(fs: Fest[]) {
  localStorage.setItem(FESTS_KEY, JSON.stringify(fs));
}

function readMyFests(email: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(MY_FESTS_KEY(email)) || "[]") as string[];
  } catch {
    return [];
  }
}
function writeMyFests(email: string, ids: string[]) {
  localStorage.setItem(MY_FESTS_KEY(email), JSON.stringify(ids));
}

// --- CRUD ---

export function festsForClub(clubId: string): Fest[] {
  return readFests()
    .filter((f) => f.clubId === clubId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getFest(code: string): Fest | null {
  return readFests().find((f) => f.id === code.toUpperCase()) ?? null;
}

export function myFests(email: string): Fest[] {
  const ids = new Set(readMyFests(email));
  return readFests().filter(
    (f) => ids.has(f.id) || f.participants.some((p) => p.email === email),
  );
}

export function createFest(input: {
  /** Null for standalone quizzes (any authed user can launch). */
  clubId: string | null;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  creator: { email: string; displayName: string };
  eventType?: FestEventType;
  difficulty?: FestDifficulty;
  source?: FestSource;
  questions?: FestQuestion[];
  // Phase 43 launch fields
  privacy?: FestPrivacy;
  categories?: string[];
  startsAtMs?: number;
  endsAtMs?: number;
  // Quiz-launch field
  memberCap?: number;
  rewards?: RewardTier[];
}): { ok: true; fest: Fest; needsApproval: boolean } | { ok: false; error: string } {
  // Club-bound flow: must be an owner. Standalone flow (clubId=null):
  // any authed user can launch — the approval gate handles abuse.
  if (input.clubId !== null) {
    const club = getClub(input.clubId);
    if (!club) return { ok: false, error: "Club not found." };
    const isOwner = club.members.some(
      (m) => m.email === input.creator.email && m.role === "owner",
    );
    if (!isOwner)
      return { ok: false, error: "Only the club owner can host a fest." };
  }

  const name = input.name.trim();
  if (name.length < 3) return { ok: false, error: "Name too short (min 3)." };
  if (name.length > 60) return { ok: false, error: "Name too long (max 60)." };

  const memberCap = input.memberCap ?? 50;
  if (memberCap < 2 || memberCap > 1000) {
    return { ok: false, error: "Member cap must be between 2 and 1000." };
  }

  const s = new Date(input.startDate);
  const e = new Date(input.endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()))
    return { ok: false, error: "Pick valid dates." };
  if (e.getTime() < s.getTime())
    return { ok: false, error: "End date must be on or after start date." };

  const all = readFests();
  let id = genCode();
  while (all.some((f) => f.id === id)) id = genCode();

  // Validate custom questions when source = custom.
  const source: FestSource = input.source ?? "system";
  let questions: FestQuestion[] | undefined;
  if (source === "custom") {
    const qs = input.questions ?? [];
    if (qs.length === 0)
      return { ok: false, error: "Add at least one custom question." };
    for (const q of qs) {
      if (!q.prompt?.trim())
        return { ok: false, error: "A custom question has an empty prompt." };
      if (!Array.isArray(q.options) || q.options.length < 2)
        return { ok: false, error: "Each question needs at least 2 options." };
      if (typeof q.answer !== "number" || q.answer < 0 || q.answer >= q.options.length)
        return { ok: false, error: "Each question needs a valid correct answer." };
    }
    questions = qs;
  }

  const privacy = input.privacy ?? "private";
  const categories = (input.categories ?? [])
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 12);
  const needsApproval = festNeedsAdminApproval({ privacy, memberCap });
  const lifecycleStatus: FestLifecycleStatus = needsApproval
    ? "pending_approval"
    : "live";

  const fest: Fest = {
    id,
    clubId: input.clubId,
    memberCap,
    name,
    description: input.description?.trim() || undefined,
    startDate: input.startDate,
    endDate: input.endDate,
    createdBy: input.creator.email,
    createdAt: Date.now(),
    participants: [
      {
        email: input.creator.email,
        displayName: input.creator.displayName,
        joinedAt: Date.now(),
      },
    ],
    eventType: input.eventType ?? "paper-trading",
    difficulty: input.difficulty ?? "intermediate",
    source,
    questions,
    privacy,
    lifecycleStatus,
    categories,
    startsAtMs: input.startsAtMs,
    endsAtMs: input.endsAtMs,
    rewards: input.rewards ?? [],
  };
  all.push(fest);
  writeFests(all);

  const my = readMyFests(input.creator.email);
  if (!my.includes(fest.id)) my.push(fest.id);
  writeMyFests(input.creator.email, my);

  void (async () => {
    try {
      const { mirrorFest } = await import("./supabase/fest-sync");
      await mirrorFest(fest);
    } catch { /* best-effort */ }
  })();

  return { ok: true, fest, needsApproval };
}

export function joinFest(
  code: string,
  user: { email: string; displayName: string },
): { ok: true; fest: Fest } | { ok: false; error: string } {
  const all = readFests();
  const fest = all.find((f) => f.id === code.toUpperCase());
  if (!fest) return { ok: false, error: "No fest with that code." };
  if (fest.lifecycleStatus === "pending_approval")
    return { ok: false, error: "This fest is awaiting admin approval." };
  if (fest.lifecycleStatus === "rejected")
    return { ok: false, error: "This fest was rejected." };
  if (fest.participants.some((p) => p.email === user.email)) {
    return { ok: true, fest };
  }
  const cap = fest.memberCap ?? 50;
  if (fest.participants.length >= cap) {
    return { ok: false, error: `This fest is full (${cap} participants).` };
  }
  fest.participants.push({
    email: user.email,
    displayName: user.displayName,
    joinedAt: Date.now(),
  });
  writeFests(all);

  const my = readMyFests(user.email);
  if (!my.includes(fest.id)) my.push(fest.id);
  writeMyFests(user.email, my);

  void (async () => {
    try {
      const { mirrorJoinFest } = await import("./supabase/fest-sync");
      await mirrorJoinFest(fest.id);
    } catch { /* best-effort */ }
  })();

  return { ok: true, fest };
}

// --- Admin approval ---

/** Fests/quizzes awaiting admin review in the local store on this device. */
export function pendingFestsLocal(): Fest[] {
  return readFests()
    .filter((f) => f.lifecycleStatus === "pending_approval")
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Admin decision on a fest/quiz. Updates the local store immediately so
 * the host sees it flip on this device, and fire-and-forget mirrors the
 * new status to the cloud so their other devices converge on next pull.
 * Returns the updated fest, or null if it isn't in this device's store
 * (cloud-only pending — the caller should still write the cloud status).
 */
export function decideFest(
  id: string,
  status: "live" | "rejected",
  reason?: string,
): Fest | null {
  const all = readFests();
  const f = all.find((x) => x.id === id.toUpperCase());
  if (f) {
    f.lifecycleStatus = status;
    f.rejectionReason = status === "rejected" ? reason?.trim() || undefined : undefined;
    writeFests(all);
  }
  void (async () => {
    try {
      const { setFestStatus } = await import("./supabase/writes");
      await setFestStatus(id.toUpperCase(), status, reason);
    } catch {
      /* best-effort */
    }
  })();
  return f ?? null;
}

/**
 * Edit a fest's editable fields (host or admin). Merges the patch over
 * the stored fest, keeps the id, writes locally and mirrors to cloud.
 */
export function updateFest(id: string, patch: Partial<Fest>): Fest | null {
  const all = readFests();
  const i = all.findIndex((x) => x.id === id.toUpperCase());
  if (i < 0) return null;
  const updated: Fest = { ...all[i], ...patch, id: all[i].id };
  all[i] = updated;
  writeFests(all);
  void (async () => {
    try {
      const { mirrorFest } = await import("./supabase/fest-sync");
      await mirrorFest(updated);
    } catch {
      /* best-effort */
    }
  })();
  return updated;
}

// --- Scoring ---

export type FestStatus = "upcoming" | "live" | "ended";

export function festStatus(fest: Fest, now = new Date()): FestStatus {
  const nowMs = now.getTime();
  const startMs = new Date(fest.startDate).getTime();
  const endMs = new Date(fest.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
  if (nowMs < startMs) return "upcoming";
  if (nowMs > endMs) return "ended";
  return "live";
}

/** Sum of XP a user accrued on daily challenges during the fest window. */
export function userFestScore(email: string, fest: Fest): number {
  const p = getProgress(email);
  const startMs = new Date(fest.startDate).getTime();
  const endMs = new Date(fest.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
  return p.history.reduce((sum, h) => {
    const t = new Date(h.dateKey).getTime();
    return t >= startMs && t <= endMs ? sum + h.xp : sum;
  }, 0);
}

export type FestLeaderRow = {
  handle: string;
  email: string;
  xp: number;
  plays: number;
  isYou: boolean;
};

/**
 * Real cloud scores (from daily_results aggregated over the fest
 * window) are used when pullScoresFor() has cached them for this fest.
 * Viewer always reads local progress. Falls back to a deterministic
 * demo seed when no cloud row is cached.
 */
export function festLeaderboard(
  fest: Fest,
  viewerEmail: string,
): FestLeaderRow[] {
  return fest.participants
    .map((p) => {
      if (p.email === viewerEmail) {
        const prog = getProgress(p.email);
        const xp = userFestScore(p.email, fest);
        const startMs = new Date(fest.startDate).getTime();
        const endMs = new Date(fest.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
        const plays = prog.history.filter((h) => {
          const t = new Date(h.dateKey).getTime();
          return t >= startMs && t <= endMs;
        }).length;
        return {
          handle: `@${p.displayName}`,
          email: p.email,
          xp,
          plays,
          isYou: true,
        };
      }
      const cloud = lookupScore(p.email, fest.startDate, fest.endDate);
      if (cloud) {
        return {
          handle: `@${p.displayName}`,
          email: p.email,
          xp: cloud.xp,
          plays: cloud.plays,
          isYou: false,
        };
      }
      let seed = 13;
      for (const c of fest.id + p.email) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
      const plays = 2 + (seed % 6);
      const xp = 150 + (seed % 1800);
      return {
        handle: `@${p.displayName}`,
        email: p.email,
        xp,
        plays,
        isYou: false,
      };
    })
    .sort((a, b) => b.xp - a.xp);
}

export function festWhatsappInvite(fest: Fest): string {
  const club = fest.clubId ? getClub(fest.clubId) : null;
  const inst = club ? getInstitute(club.instituteId) : null;
  const where = club ? `${club.name}${inst ? ` (${inst.short})` : ""}` : "TradeVerse";
  const text = `Join "${fest.name}" at ${where} on TradeVerse. Code: ${fest.id} — https://tradeverse.app/fests/${fest.id}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

// --- Counters for quests / badges / profile ---

export function festsParticipatedCount(email: string): number {
  return myFests(email).length;
}

export function festsWonCount(email: string, now = new Date()): number {
  return myFests(email).filter((f) => {
    if (festStatus(f, now) !== "ended") return false;
    const rows = festLeaderboard(f, email);
    return rows[0]?.email === email;
  }).length;
}
