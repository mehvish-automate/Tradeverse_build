"use client";

import { EVENTS, EventDef, baseDate, getEvent, isResolved, resolveDate } from "./events";
import { logReward } from "./rewards";
import { STOCKS, Sector, niftyReturn } from "./stocks";
import { price } from "./stocks";

export type EventAllocation = {
  eventId: string;
  submittedAt: number;
  // Sector id (or "CASH") → percentage. Always sums to 100.
  allocation: Record<string, number>;
  // Whether reward XP has been credited (after resolution).
  claimed: boolean;
};

const KEY = (email: string) => `tv.events.${email}`;

function read(email: string): EventAllocation[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY(email)) || "[]") as EventAllocation[];
  } catch {
    return [];
  }
}

function write(email: string, all: EventAllocation[]) {
  localStorage.setItem(KEY(email), JSON.stringify(all));
}

export function myAllocation(email: string, eventId: string): EventAllocation | null {
  return read(email).find((a) => a.eventId === eventId) ?? null;
}

export function myAllocations(email: string): EventAllocation[] {
  return read(email);
}

export function submitAllocation(
  email: string,
  eventId: string,
  allocation: Record<string, number>,
): { ok: boolean; error?: string } {
  const def = getEvent(eventId);
  if (!def) return { ok: false, error: "Event not found." };
  if (isResolved(def)) return { ok: false, error: "Event has already resolved." };

  const total = Object.values(allocation).reduce((s, n) => s + n, 0);
  if (Math.round(total) !== 100) {
    return { ok: false, error: `Allocation must total 100% (currently ${total.toFixed(0)}%).` };
  }

  const allowed = new Set<string>(def.sectors);
  allowed.add("CASH");
  for (const [k, v] of Object.entries(allocation)) {
    if (v < 0 || v > 100) return { ok: false, error: `Bad value for ${k}.` };
    if (v > 0 && !allowed.has(k)) {
      return { ok: false, error: `${k} is not allowed for this event.` };
    }
  }

  const all = read(email);
  const existing = all.findIndex((a) => a.eventId === eventId);
  const row: EventAllocation = {
    eventId,
    submittedAt: Date.now(),
    allocation,
    claimed: false,
  };
  if (existing >= 0) all[existing] = row;
  else all.push(row);
  write(email, all);
  return { ok: true };
}

// --- Scoring ---

/** Equal-weight sector return between two dates using our mock stocks. */
export function sectorReturn(sector: Sector, from: Date, to: Date): number {
  const names = STOCKS.filter((s) => s.sector === sector);
  if (names.length === 0) return 0;
  const sum = names.reduce((acc, s) => {
    const p0 = price(s.symbol, from);
    const p1 = price(s.symbol, to);
    if (p0 <= 0) return acc;
    return acc + ((p1 - p0) / p0) * 100;
  }, 0);
  return +(sum / names.length).toFixed(2);
}

export type EventScore = {
  eventId: string;
  resolved: boolean;
  portfolioReturnPct: number;
  niftyReturnPct: number;
  alphaPct: number;
  perSector: { key: string; pct: number; retPct: number }[];
};

export function scoreEvent(
  allocation: EventAllocation,
  def: EventDef,
  asOf: Date = new Date(),
): EventScore {
  const from = baseDate(def);
  const to = isResolved(def, asOf) ? resolveDate(def) : asOf;

  let total = 0;
  const perSector: EventScore["perSector"] = [];
  for (const [key, pct] of Object.entries(allocation.allocation)) {
    if (pct <= 0) continue;
    const ret = key === "CASH" ? 0 : sectorReturn(key as Sector, from, to);
    total += (pct / 100) * ret;
    perSector.push({ key, pct, retPct: ret });
  }
  const nifty = niftyReturn(from, to);
  return {
    eventId: def.id,
    resolved: isResolved(def, asOf),
    portfolioReturnPct: +total.toFixed(2),
    niftyReturnPct: +nifty.toFixed(2),
    alphaPct: +(total - nifty).toFixed(2),
    perSector,
  };
}

/**
 * Claim XP once per resolved event. Reward is base + alpha bonus for
 * beating the benchmark; invariants intact (no cash, just XP).
 */
export function claimEventReward(
  email: string,
  eventId: string,
): { ok: boolean; xp?: number; error?: string } {
  const def = getEvent(eventId);
  if (!def) return { ok: false, error: "Event not found." };
  if (!isResolved(def)) return { ok: false, error: "Event hasn't resolved yet." };

  const alloc = myAllocation(email, eventId);
  if (!alloc) return { ok: false, error: "No allocation to claim." };
  if (alloc.claimed) return { ok: false, error: "Already claimed." };

  const score = scoreEvent(alloc, def);
  const alphaBonus = Math.max(0, Math.round(score.alphaPct * 20));
  const xp = def.rewardXp + alphaBonus;

  // Credit into main XP store.
  const PROGRESS_KEY = `tv.progress.${email}`;
  const raw = localStorage.getItem(PROGRESS_KEY);
  if (raw) {
    try {
      const store = JSON.parse(raw);
      store.totalXp = (store.totalXp || 0) + xp;
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }

  const all = read(email);
  const idx = all.findIndex((a) => a.eventId === eventId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], claimed: true };
    write(email, all);
  }

  logReward(email, {
    kind: "mystery",
    detail: `${def.title}: +${xp} XP (alpha ${score.alphaPct >= 0 ? "+" : ""}${score.alphaPct}%)`,
  });

  return { ok: true, xp };
}

/** Count of resolved events the user placed an allocation on. */
export function resolvedParticipations(email: string): number {
  const mine = read(email);
  return mine.filter((a) => {
    const def = getEvent(a.eventId);
    return def && isResolved(def);
  }).length;
}

/** Count of resolved events where the user beat NIFTY. */
export function beatNiftyCount(email: string): number {
  const mine = read(email);
  return mine.filter((a) => {
    const def = getEvent(a.eventId);
    if (!def || !isResolved(def)) return false;
    return scoreEvent(a, def).alphaPct > 0;
  }).length;
}

/** A synthetic leaderboard for a single event — mixes the signed-in user's real score with seeded peers so the V1 demo feels populated. */
export function eventLeaderboard(
  email: string,
  displayName: string,
  def: EventDef,
): { handle: string; returnPct: number; isYou: boolean }[] {
  const mine = myAllocation(email, def.id);
  const youRow = mine
    ? {
        handle: `@${displayName}`,
        returnPct: scoreEvent(mine, def).portfolioReturnPct,
        isYou: true,
      }
    : null;

  // Seeded 9-player peer pool. Returns centred on NIFTY with spread.
  const nifty = niftyReturn(baseDate(def), isResolved(def) ? resolveDate(def) : new Date());
  const peers = [
    "ananya_b", "rohan.98", "kabir_m", "tara.99", "advait.dev",
    "rhea_k", "vihaan.c", "anika_mehta", "neha_iitb",
  ].map((h, i) => {
    // Deterministic bump per (event, peer).
    let seed = 7;
    for (const c of def.id + h) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const bump = ((seed % 1000) / 1000) * 8 - 3.5; // ~[-3.5, +4.5]
    return { handle: `@${h}`, returnPct: +(nifty + bump).toFixed(2), isYou: false };
  });

  const rows = youRow ? [...peers, youRow] : peers;
  rows.sort((a, b) => b.returnPct - a.returnPct);
  return rows;
}

export function hasAnyParticipation(email: string): boolean {
  return read(email).length > 0;
}

export function totalOpenEvents(): number {
  return EVENTS.filter((e) => !isResolved(e)).length;
}
