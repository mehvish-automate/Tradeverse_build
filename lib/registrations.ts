"use client";

// Organizer registration links + lead capture.
//
// A registration link (/r/<code>) lets prospects register interest in a
// quiz/event without an account. Registrations are stored locally and
// mirrored to Supabase (event_registrations); the organizer reads them
// in a dashboard.
//
// API seam: all UI goes through the active RegistrationProvider. The
// native provider (localStorage + Supabase) is the default; an internal
// system can be plugged in later via registerRegistrationProvider()
// without touching any call site.

import { getAttribution } from "./analytics";

export type Registration = {
  id: string;
  festId: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  createdAt: number;
};

export type NewRegistration = {
  festId: string;
  name: string;
  email: string;
  phone?: string;
  source?: string;
};

export interface RegistrationProvider {
  /** Shareable registration link for an event (optionally name-stamped). */
  linkFor(festId: string, name?: string, origin?: string): string;
  /** Persist a registration. Throws on validation error. */
  create(input: NewRegistration): Promise<Registration>;
  /** Organizer view — every registration for an event. */
  list(festId: string): Promise<Registration[]>;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const KEY = (festId: string) => `tv.registrations.${festId}`;

function readLocal(festId: string): Registration[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY(festId)) || "[]") as Registration[];
  } catch {
    return [];
  }
}

function writeLocal(festId: string, rows: Registration[]) {
  localStorage.setItem(KEY(festId), JSON.stringify(rows));
}

export function validateRegistration(input: NewRegistration): string | null {
  if (!input.name?.trim() || input.name.trim().length < 2) return "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return "Enter a valid email.";
  if (input.phone && !/^[+\d][\d\s-]{6,}$/.test(input.phone.trim())) return "Enter a valid phone, or leave it blank.";
  return null;
}

/** A short attribution summary string for the `source` column. */
export function attributionSource(): string | undefined {
  const a = getAttribution();
  if (!a) return undefined;
  return a.ref || a.utmCampaign || a.utmSource || undefined;
}

const nativeProvider: RegistrationProvider = {
  linkFor(festId, name, origin) {
    const base =
      origin ??
      (typeof window !== "undefined" ? window.location.origin : "https://tradeverse.app");
    const q = name ? `?e=${encodeURIComponent(name)}` : "";
    return `${base}/r/${festId}${q}`;
  },

  async create(input) {
    const err = validateRegistration(input);
    if (err) throw new Error(err);
    const reg: Registration = {
      id: uuid(),
      festId: input.festId,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || undefined,
      source: input.source ?? attributionSource(),
      createdAt: Date.now(),
    };
    // De-dupe by email on this device.
    const rows = readLocal(input.festId).filter((r) => r.email !== reg.email);
    writeLocal(input.festId, [reg, ...rows]);
    void (async () => {
      try {
        const { mirrorRegistration } = await import("./supabase/registrations-sync");
        await mirrorRegistration(reg);
      } catch {
        /* best-effort */
      }
    })();
    return reg;
  },

  async list(festId) {
    const local = readLocal(festId);
    let cloud: Registration[] = [];
    try {
      const { pullRegistrations } = await import("./supabase/registrations-sync");
      cloud = await pullRegistrations(festId);
    } catch {
      cloud = [];
    }
    // Merge by email (cloud is authoritative for cross-device reach).
    const byEmail = new Map<string, Registration>();
    for (const r of local) byEmail.set(r.email, r);
    for (const r of cloud) byEmail.set(r.email, r);
    return [...byEmail.values()].sort((a, b) => b.createdAt - a.createdAt);
  },
};

let active: RegistrationProvider = nativeProvider;

export function registerRegistrationProvider(p: RegistrationProvider): void {
  active = p;
}

export function registrationProvider(): RegistrationProvider {
  return active;
}

/** CSV export for the organizer dashboard. */
export function registrationsToCsv(rows: Registration[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["Name", "Email", "Phone", "Source", "Registered at"].join(",");
  const lines = rows.map((r) =>
    [
      esc(r.name),
      esc(r.email),
      esc(r.phone ?? ""),
      esc(r.source ?? ""),
      esc(new Date(r.createdAt).toISOString()),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}
