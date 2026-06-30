"use client";

// Phase 27.3 — mirror the localStorage progress store into Supabase
// whenever the user has a live Supabase session. Additive: reads still
// come from localStorage; this just pushes state up so it survives
// across devices and becomes the source of truth for future phases.

import { getBrowserSupabase } from "./client";
import { getProgress } from "../progress";
import { getCurrentUser } from "../session";
import { getHomeInstitute, hasOnboarded } from "../onboarding";
import { codeFor } from "../referral";

const LAST_SYNC_KEY = (email: string) => `tv.sync.lastResult.${email}`;

/**
 * Upsert the local profile summary into profiles + user_stats. Runs
 * on first sign-in and on any subsequent change. Safe to call often.
 */
export async function syncProfile(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;

  const local = getCurrentUser();
  if (!local) return false;

  const longest = computeLongestStreak(local.email);
  const p = getProgress(local.email);

  const profileRow = {
    id: auth.user.id,
    email: auth.user.email ?? local.email,
    display_name: local.displayName,
    dob: local.dob,
    home_institute: getHomeInstitute(local.email),
    onboarded: hasOnboarded(local.email),
    // Phase 48.5 — server-side resolvable referral code so the share
    // landing can map a ?ref=<code> to a Supabase user_id.
    referral_code: codeFor(local.email),
  };
  const { error: profErr } = await (supabase.from("profiles") as unknown as {
    upsert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).upsert(profileRow);
  if (profErr) return false;

  const statsRow = {
    user_id: auth.user.id,
    streak: p.streak,
    last_played_key: p.lastPlayedKey,
    total_xp: p.totalXp,
    longest_streak: Math.max(longest, p.streak),
    streak_freezes: readFreezeCount(local.email),
  };
  const { error: statsErr } = await (supabase.from("user_stats") as unknown as {
    upsert: (row: unknown) => Promise<{ error: { message: string } | null }>;
  }).upsert(statsRow);
  if (statsErr) return false;

  return true;
}

/**
 * Insert any daily_results rows that haven't been uploaded yet. We
 * watermark by `placedAt` to avoid duplicate inserts; Supabase enforces
 * unique(user_id, date_key) at the DB level as a belt-and-braces.
 */
export async function syncDailyResults(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;

  const local = getCurrentUser();
  if (!local) return 0;

  const last = Number(localStorage.getItem(LAST_SYNC_KEY(local.email)) || "0");
  const p = getProgress(local.email);
  const toSync = p.history.filter(
    (r) => new Date(r.dateKey).getTime() > last,
  );
  if (toSync.length === 0) return 0;

  const rows = toSync.map((r) => ({
    user_id: auth.user!.id,
    date_key: r.dateKey,
    correct: r.correct,
    total: r.total,
    xp: r.xp,
    time_ms: r.timeMs,
  }));

  const { error } = await (supabase.from("daily_results") as unknown as {
    upsert: (
      rows: unknown[],
      opts: { onConflict: string },
    ) => Promise<{ error: { message: string } | null }>;
  }).upsert(rows, { onConflict: "user_id,date_key" });
  if (error) return 0;

  const newest = toSync.reduce(
    (m, r) => Math.max(m, new Date(r.dateKey).getTime()),
    last,
  );
  localStorage.setItem(LAST_SYNC_KEY(local.email), String(newest));
  return rows.length;
}

/**
 * Bring server-side daily_results down into localStorage on first load
 * (so a user who plays on phone still sees those runs on desktop).
 * Merges by date_key; local wins ties to avoid clobbering a fresh
 * in-memory run that hasn't been uploaded yet.
 */
export async function pullDailyResults(): Promise<number> {
  const supabase = getBrowserSupabase();
  if (!supabase) return 0;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return 0;

  const local = getCurrentUser();
  if (!local) return 0;

  type SelectedRow = {
    date_key: string;
    correct: number;
    total: number;
    xp: number;
    time_ms: number;
  };
  const res = await (supabase.from("daily_results") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => Promise<{ data: SelectedRow[] | null; error: { message: string } | null }>;
    };
  })
    .select("date_key, correct, total, xp, time_ms")
    .eq("user_id", auth.user.id);
  if (res.error || !res.data) return 0;
  const data = res.data;

  const PROGRESS_KEY = `tv.progress.${local.email}`;
  const raw = localStorage.getItem(PROGRESS_KEY);
  const store = raw
    ? (JSON.parse(raw) as {
        streak: number;
        lastPlayedKey: string | null;
        totalXp: number;
        history: { dateKey: string; correct: number; total: number; xp: number; timeMs: number }[];
      })
    : { streak: 0, lastPlayedKey: null, totalXp: 0, history: [] };

  let added = 0;
  for (const row of data) {
    if (!store.history.some((h) => h.dateKey === row.date_key)) {
      store.history.push({
        dateKey: row.date_key,
        correct: row.correct,
        total: row.total,
        xp: row.xp,
        timeMs: row.time_ms,
      });
      added++;
    }
  }
  if (added > 0) {
    store.totalXp = store.history.reduce((s, h) => s + h.xp, 0);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(store));
  }
  return added;
}

/**
 * Pull the canonical profile row from Supabase and hydrate localStorage:
 *   - tv.users[] gets a row matching the cloud display_name + dob
 *   - tv.session is set to the email so useSession picks up the user
 *   - tv.homeInstitute.<email> reflects the cloud home_institute
 *   - tv.onboarded.<email> reflects the cloud onboarded flag
 *
 * Used by sign-in (so a fresh device gets the real profile, not just
 * placeholder data from user_metadata) and by the first-load sync (so
 * profile edits made on another device propagate back).
 *
 * Best-effort: silently exits when Supabase is offline or no profile row.
 */
export async function pullProfile(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;

  type Row = {
    email: string;
    display_name: string;
    dob: string;
    home_institute: string | null;
    onboarded: boolean;
    is_admin: boolean | null;
  };
  const res = await (supabase.from("profiles") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: Row | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select("email, display_name, dob, home_institute, onboarded, is_admin")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (res.error || !res.data) return false;

  const row = res.data;
  const email = (row.email || auth.user.email || "").trim().toLowerCase();
  if (!email) return false;

  // Upsert into tv.users and set tv.session.
  type StoredUser = {
    email: string;
    displayName: string;
    dob: string;
    createdAt: number;
  };
  let users: StoredUser[] = [];
  try {
    users = JSON.parse(localStorage.getItem("tv.users") || "[]") as StoredUser[];
  } catch {
    users = [];
  }
  const idx = users.findIndex((u) => u.email === email);
  const merged: StoredUser = {
    email,
    displayName: row.display_name,
    dob: row.dob,
    createdAt: idx >= 0 ? users[idx]!.createdAt : Date.now(),
  };
  if (idx >= 0) users[idx] = merged;
  else users.push(merged);
  localStorage.setItem("tv.users", JSON.stringify(users));
  localStorage.setItem("tv.session", email);

  if (row.home_institute) {
    localStorage.setItem(`tv.homeInstitute.${email}`, row.home_institute);
  }
  if (row.onboarded) {
    localStorage.setItem(`tv.onboarded.${email}`, "1");
  }
  // Phase 42 — admin flag, used to gate /admin/* routes client-side.
  // RLS at the DB layer is the actual security boundary.
  localStorage.setItem(
    `tv.isAdmin.${email}`,
    row.is_admin ? "1" : "0",
  );
  return true;
}

/**
 * Env-based admin allowlist — a reliable escape hatch that needs no DB
 * row or RLS. Set NEXT_PUBLIC_ADMIN_EMAILS="a@x.com,b@y.com" in the
 * environment (e.g. Vercel) and those emails are admins immediately on
 * the next deploy. (NEXT_PUBLIC_* is inlined at build time.)
 */
export function isAdminEmail(email: string): boolean {
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
  const list = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.trim().toLowerCase());
}

/** Sync read: env allowlist OR the cached DB flag (fast first paint). */
export function isAdminLocal(email: string): boolean {
  if (isAdminEmail(email)) return true;
  if (typeof window === "undefined") return false;
  return localStorage.getItem(`tv.isAdmin.${email}`) === "1";
}

/**
 * Authoritative admin check — queries profiles.is_admin for the current
 * session directly, so flipping is_admin in Supabase takes effect on the
 * next page load without a sign-out/in. Refreshes the local cache as a
 * side effect. Returns the cached value's fallback (false) when there's
 * no Supabase session.
 */
export async function fetchIsAdmin(): Promise<boolean> {
  const supabase = getBrowserSupabase();
  if (!supabase) return false;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  // Env allowlist short-circuits the DB lookup entirely.
  if (auth.user.email && isAdminEmail(auth.user.email)) {
    localStorage.setItem(`tv.isAdmin.${auth.user.email.trim().toLowerCase()}`, "1");
    return true;
  }
  const res = await (supabase.from("profiles") as unknown as {
    select: (cols: string) => {
      eq: (
        col: string,
        val: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { is_admin: boolean | null } | null;
          error: { message: string } | null;
        }>;
      };
    };
  })
    .select("is_admin")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (res.error || !res.data) return false;
  const isAdmin = !!res.data.is_admin;
  const email = (auth.user.email || "").trim().toLowerCase();
  if (email) {
    localStorage.setItem(`tv.isAdmin.${email}`, isAdmin ? "1" : "0");
  }
  return isAdmin;
}

// --- Helpers ---

function readFreezeCount(email: string): number {
  const v = localStorage.getItem(`tv.streakfreezes.${email}`);
  return v ? Number(v) || 0 : 0;
}

function computeLongestStreak(email: string): number {
  const p = getProgress(email);
  const sorted = [...p.history].sort((a, b) =>
    a.dateKey < b.dateKey ? -1 : 1,
  );
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const h of sorted) {
    if (prev) {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      run = d.toISOString().slice(0, 10) === h.dateKey ? run + 1 : 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = h.dateKey;
  }
  return longest;
}
