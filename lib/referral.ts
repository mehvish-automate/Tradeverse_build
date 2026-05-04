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

// --- Phase 48: per-resource share links + click/join tracking -----------

export type ShareKind = "floor" | "fest" | "event";

export type ShareStat = {
  kind: ShareKind;
  resourceId: string;
  clicks: number;
  joins: number;
  lastClickAt: number;
  lastJoinAt: number;
};

const SHARES_KEY = (email: string) => `tv.shares.${email}`;

function readShares(email: string): Record<string, ShareStat> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SHARES_KEY(email)) || "{}") as Record<
      string,
      ShareStat
    >;
  } catch {
    return {};
  }
}

function writeShares(email: string, all: Record<string, ShareStat>) {
  localStorage.setItem(SHARES_KEY(email), JSON.stringify(all));
}

const shareKey = (kind: ShareKind, resourceId: string) =>
  `${kind}:${resourceId.toUpperCase()}`;

/**
 * Build a tracked share URL for a specific resource. The recipient
 * lands on /s/<kind>/<id>?ref=<inviterCode> which:
 *   - displays the resource preview
 *   - increments the inviter's click count
 *   - sends them onward to the resource page with ?via=<inviterCode>
 *     so a successful join can attribute back to the inviter.
 */
export function shareUrl(
  kind: ShareKind,
  resourceId: string,
  inviterEmail: string,
): string {
  const code = codeFor(inviterEmail);
  return `${getOrigin()}/s/${kind}/${resourceId.toUpperCase()}?ref=${code}`;
}

/** WhatsApp share helper for a resource — wraps shareUrl with copy. */
export function shareWhatsapp(
  kind: ShareKind,
  resourceId: string,
  resourceName: string,
  inviterEmail: string,
): string {
  const url = shareUrl(kind, resourceId, inviterEmail);
  const verb =
    kind === "floor"
      ? "trading competition"
      : kind === "fest"
        ? "fest"
        : "market event";
  const text = `Join my TradeVerse ${verb} "${resourceName}" — ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Increment click count for a resource share. */
export function trackShareClick(
  inviterCode: string,
  kind: ShareKind,
  resourceId: string,
): void {
  const inviterEmail = lookupInviter(inviterCode);
  if (!inviterEmail) return;
  const all = readShares(inviterEmail);
  const k = shareKey(kind, resourceId);
  const cur = all[k] ?? {
    kind,
    resourceId: resourceId.toUpperCase(),
    clicks: 0,
    joins: 0,
    lastClickAt: 0,
    lastJoinAt: 0,
  };
  cur.clicks += 1;
  cur.lastClickAt = Date.now();
  all[k] = cur;
  writeShares(inviterEmail, all);
}

/**
 * Idempotent join attribution: flips a per-(invitee, resource) flag so
 * re-visits don't re-count. The first successful join from a `via=`
 * link increments the inviter's join count.
 */
const JOIN_ATTRIBUTED = (
  inviteeEmail: string,
  kind: ShareKind,
  id: string,
) => `tv.shareJoin.${inviteeEmail}.${kind}.${id.toUpperCase()}`;

export function attributeShareJoin(
  inviteeEmail: string,
  inviterCode: string,
  kind: ShareKind,
  resourceId: string,
): boolean {
  if (typeof window === "undefined") return false;
  if (!inviterCode) return false;
  const flag = JOIN_ATTRIBUTED(inviteeEmail, kind, resourceId);
  if (localStorage.getItem(flag)) return false;
  const inviterEmail = lookupInviter(inviterCode);
  if (!inviterEmail) return false;
  if (inviterEmail === inviteeEmail) return false; // self-attribution guard
  localStorage.setItem(flag, "1");
  const all = readShares(inviterEmail);
  const k = shareKey(kind, resourceId);
  const cur = all[k] ?? {
    kind,
    resourceId: resourceId.toUpperCase(),
    clicks: 0,
    joins: 0,
    lastClickAt: 0,
    lastJoinAt: 0,
  };
  cur.joins += 1;
  cur.lastJoinAt = Date.now();
  all[k] = cur;
  writeShares(inviterEmail, all);
  return true;
}

export function getShareStats(inviterEmail: string): ShareStat[] {
  return Object.values(readShares(inviterEmail)).sort(
    (a, b) => Math.max(b.lastClickAt, b.lastJoinAt) - Math.max(a.lastClickAt, a.lastJoinAt),
  );
}
