"use client";

// Deterministic per-user referral code + minimal tracking.
// Code is derived from email so a user's code is stable across devices
// (matters since real auth hasn't landed yet — but keeps the same shape
// when it does). Anyone who signs up with ?ref=CODE gets credited to the
// inviter, and both sides get a one-time XP bump.

const REF_KEY = "tv.refmap"; // code -> inviter email
const MY_REF_LOG = (email: string) => `tv.referrals.${email}`;
const PROGRESS_KEY = (email: string) => `tv.progress.${email}`;
const REF_APPLIED = (email: string) => `tv.refapplied.${email}`;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

export function codeFor(email: string): string {
  let h = hash(email.trim().toLowerCase());
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[h % ALPHABET.length];
    h = Math.floor(h / ALPHABET.length);
    if (h === 0) h = hash(email + String(i));
  }
  return out;
}

type RefMap = Record<string /* code */, string /* inviter email */>;

function readMap(): RefMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(REF_KEY) || "{}") as RefMap;
  } catch {
    return {};
  }
}

function writeMap(m: RefMap) {
  localStorage.setItem(REF_KEY, JSON.stringify(m));
}

/** Called once per user, at signup, so the code → email map is populated. */
export function registerOwnCode(email: string, displayName: string): string {
  const code = codeFor(email);
  const m = readMap();
  m[code] = email;
  writeMap(m);
  // Keep a tiny identity side-index so the landing page can show @name.
  localStorage.setItem(`tv.handle.${code}`, displayName);
  return code;
}

export function handleForCode(code: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`tv.handle.${code.toUpperCase()}`);
}

export function lookupInviter(code: string): string | null {
  const m = readMap();
  return m[code.toUpperCase()] ?? null;
}

/**
 * Apply a referral: credit both sides +150 XP, and log the new member
 * under the inviter's referral log. Idempotent per-invitee (we mark
 * REF_APPLIED so a user can't re-trigger by re-entering a code).
 */
export function applyReferral(newUserEmail: string, code: string): boolean {
  if (localStorage.getItem(REF_APPLIED(newUserEmail))) return false;
  const inviterEmail = lookupInviter(code);
  if (!inviterEmail || inviterEmail === newUserEmail) return false;

  creditXp(newUserEmail, 150);
  creditXp(inviterEmail, 150);

  const log = readReferralLog(inviterEmail);
  log.push({ email: newUserEmail, ts: Date.now() });
  localStorage.setItem(MY_REF_LOG(inviterEmail), JSON.stringify(log));

  localStorage.setItem(REF_APPLIED(newUserEmail), code.toUpperCase());
  return true;
}

type ReferralEntry = { email: string; ts: number };

function readReferralLog(email: string): ReferralEntry[] {
  try {
    return JSON.parse(localStorage.getItem(MY_REF_LOG(email)) || "[]") as ReferralEntry[];
  } catch {
    return [];
  }
}

export function myReferrals(email: string): ReferralEntry[] {
  return readReferralLog(email);
}

function creditXp(email: string, xp: number) {
  const raw = localStorage.getItem(PROGRESS_KEY(email));
  if (!raw) {
    // Haven't played yet — seed the progress store.
    localStorage.setItem(
      PROGRESS_KEY(email),
      JSON.stringify({
        streak: 0,
        lastPlayedKey: null,
        totalXp: xp,
        history: [],
      }),
    );
    return;
  }
  try {
    const store = JSON.parse(raw);
    store.totalXp = (store.totalXp || 0) + xp;
    localStorage.setItem(PROGRESS_KEY(email), JSON.stringify(store));
  } catch {
    // ignore
  }
}

export function shareLinks(code: string, copy: string) {
  const url = `${getOrigin()}/s/${code}`;
  const text = `${copy} Join me on TradeVerse — ${url}`;
  return {
    url,
    text,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  };
}

function getOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "https://tradeverse.app";
}
