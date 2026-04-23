"use client";

// Campus Ambassador system.
// One ambassador per institute. Eligibility: must own a club AND have
// hosted at least one fest at that institute. Claim is first-come for
// a given institute. Reward is a profile chip + the "Campus
// Ambassador" gold badge. No money changes hands.

import { getInstitute, getClub, myClubs } from "./clubs";
import { festsForClub } from "./fests";

const KEY = "tv.ambassadors";

export type Ambassadorship = {
  instituteId: string;
  email: string;
  displayName: string;
  clubId: string;
  claimedAt: number;
};

function readAll(): Ambassadorship[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]") as Ambassadorship[];
  } catch {
    return [];
  }
}

function writeAll(all: Ambassadorship[]) {
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function ambassadorFor(instituteId: string): Ambassadorship | null {
  return readAll().find((a) => a.instituteId === instituteId) ?? null;
}

export function myAmbassadorships(email: string): Ambassadorship[] {
  return readAll().filter((a) => a.email === email);
}

export type EligibleClub = {
  clubId: string;
  clubName: string;
  instituteId: string;
  instituteShort: string;
  festCount: number;
  slotTaken: boolean;
  slotHolderHandle?: string;
};

/**
 * A user is eligible to claim per-club: they're the owner AND they've
 * hosted at least one fest at that club. Returns one row per eligible
 * club with whether the institute's slot is already filled.
 */
export function eligibleClaims(email: string): EligibleClub[] {
  const mine = myClubs(email);
  const all = readAll();

  const out: EligibleClub[] = [];
  for (const club of mine) {
    const isOwner = club.members.some(
      (m) => m.email === email && m.role === "owner",
    );
    if (!isOwner) continue;
    const fests = festsForClub(club.id);
    if (fests.length === 0) continue;

    const inst = getInstitute(club.instituteId);
    const existing = all.find((a) => a.instituteId === club.instituteId);
    out.push({
      clubId: club.id,
      clubName: club.name,
      instituteId: club.instituteId,
      instituteShort: inst?.short ?? "—",
      festCount: fests.length,
      slotTaken: Boolean(existing) && existing?.email !== email,
      slotHolderHandle: existing?.email !== email ? existing?.displayName : undefined,
    });
  }
  return out;
}

export function claimAmbassadorship(
  email: string,
  displayName: string,
  clubId: string,
): { ok: boolean; error?: string; ambassador?: Ambassadorship } {
  const club = getClub(clubId);
  if (!club) return { ok: false, error: "Club not found." };

  const isOwner = club.members.some(
    (m) => m.email === email && m.role === "owner",
  );
  if (!isOwner) return { ok: false, error: "You must own this club." };

  const fests = festsForClub(clubId);
  if (fests.length === 0)
    return { ok: false, error: "Host at least one fest first." };

  const all = readAll();
  const existing = all.find((a) => a.instituteId === club.instituteId);
  if (existing) {
    if (existing.email === email) return { ok: true, ambassador: existing };
    return { ok: false, error: "This institute's slot is already taken." };
  }

  const amb: Ambassadorship = {
    instituteId: club.instituteId,
    email,
    displayName,
    clubId,
    claimedAt: Date.now(),
  };
  all.push(amb);
  writeAll(all);
  return { ok: true, ambassador: amb };
}

export function isAmbassador(email: string): boolean {
  return readAll().some((a) => a.email === email);
}
