"use client";

// User preferences (notifications, etc.) + account ops
// (data export, delete) all against localStorage.

const PREFS_KEY = (email: string) => `tv.prefs.${email}`;

export type Prefs = {
  notifyStreak: boolean;
  notifyFest: boolean;
  notifyQuests: boolean;
  notifyRivals: boolean;
  weeklyDigestEmail: boolean;
};

const DEFAULTS: Prefs = {
  notifyStreak: true,
  notifyFest: true,
  notifyQuests: true,
  notifyRivals: true,
  weeklyDigestEmail: false,
};

export function getPrefs(email: string): Prefs {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(PREFS_KEY(email));
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setPrefs(email: string, patch: Partial<Prefs>) {
  const next = { ...getPrefs(email), ...patch };
  localStorage.setItem(PREFS_KEY(email), JSON.stringify(next));
}

/** One-shot: rename your handle. Syncs across user + squads + clubs + fests. */
export function renameDisplayName(email: string, newName: string): boolean {
  if (typeof window === "undefined") return false;
  const trimmed = newName.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return false;

  // tv.users
  const users = JSON.parse(localStorage.getItem("tv.users") || "[]") as Array<{
    email: string;
    displayName: string;
  }>;
  const u = users.find((x) => x.email === email);
  if (!u) return false;
  u.displayName = trimmed;
  localStorage.setItem("tv.users", JSON.stringify(users));

  // Patch member names everywhere we might be listed.
  patchMemberName("tv.tradeFloors", "members", email, trimmed);
  patchMemberName("tv.clubs", "members", email, trimmed);
  patchMemberName("tv.fests", "participants", email, trimmed);

  // Referral handle map.
  const code = localStorage.getItem(`tv.handle.code.${email}`);
  if (code) localStorage.setItem(`tv.handle.${code}`, trimmed);

  return true;
}

function patchMemberName(
  key: string,
  listField: "members" | "participants",
  email: string,
  newName: string,
) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const arr = JSON.parse(raw) as Array<Record<string, unknown>>;
    let dirty = false;
    for (const row of arr) {
      const list = row[listField] as Array<{ email: string; displayName: string }> | undefined;
      if (!list) continue;
      for (const m of list) {
        if (m.email === email && m.displayName !== newName) {
          m.displayName = newName;
          dirty = true;
        }
      }
    }
    if (dirty) localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

/** Returns every localStorage key tied to this user, as a download-ready JSON blob. */
export function exportUserData(email: string): string {
  if (typeof window === "undefined") return "{}";
  const out: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k === "tv.users" || k.endsWith(`.${email}`) || k.startsWith("tv.")) {
      const val = localStorage.getItem(k);
      try {
        out[k] = val ? JSON.parse(val) : null;
      } catch {
        out[k] = val;
      }
    }
  }
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      email,
      data: out,
    },
    null,
    2,
  );
}

/** Deletes every localStorage key scoped to this user. */
export function deleteUserData(email: string) {
  if (typeof window === "undefined") return;
  const toDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.endsWith(`.${email}`)) toDelete.push(k);
  }
  for (const k of toDelete) localStorage.removeItem(k);

  // Remove from shared multi-user stores.
  dropFromList("tv.users", (u) => (u as { email: string }).email === email);
  dropMemberFromList("tv.tradeFloors", "members", email);
  dropMemberFromList("tv.clubs", "members", email);
  dropMemberFromList("tv.fests", "participants", email);
  dropFromList("tv.ambassadors", (a) => (a as { email: string }).email === email);
  localStorage.removeItem("tv.session");
}

function dropFromList(key: string, pred: (row: unknown) => boolean) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const arr = (JSON.parse(raw) as unknown[]).filter((r) => !pred(r));
    localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    // ignore
  }
}

function dropMemberFromList(
  key: string,
  listField: "members" | "participants",
  email: string,
) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const arr = JSON.parse(raw) as Array<Record<string, unknown>>;
    let dirty = false;
    for (const row of arr) {
      const list = row[listField] as Array<{ email: string }> | undefined;
      if (!list) continue;
      const next = list.filter((m) => m.email !== email);
      if (next.length !== list.length) {
        row[listField] = next;
        dirty = true;
      }
    }
    if (dirty) localStorage.setItem(key, JSON.stringify(arr));
  } catch {
    // ignore
  }
}
