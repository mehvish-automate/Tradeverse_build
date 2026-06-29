"use client";

// First-party event pipeline (Phase 65).
//
// track(name, props) stamps an event with a stable anonymous device id +
// the signed-in email (if any), appends it to a capped local ring buffer,
// runs any registered vendor sinks, and fire-and-forget mirrors it to
// Supabase (analytics_events) — the same additive pattern as the other
// cloud syncs. localStorage is never the read source for product UI; the
// buffer exists only for debugging + offline durability.
//
// The sink seam (registerAnalyticsSink) lets a vendor — PostHog / GA /
// Mixpanel — be added later by registering one adapter, without touching
// any call site.

import { getCurrentUser } from "./session";

export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

export type AnalyticsEvent = {
  id: string;
  name: string;
  props: Record<string, string | number | boolean | null>;
  email: string | null;
  deviceId: string;
  path: string;
  ts: number;
};

// Canonical event names — use these constants at call sites to avoid typos.
export const EV = {
  signUp: "sign_up",
  signIn: "sign_in",
  dailyFinish: "daily_finish",
  quizLaunch: "quiz_launch",
  quizStart: "quiz_start",
  quizFinish: "quiz_finish",
  joinByCode: "join_by_code",
  share: "share",
} as const;

// Device id lives OUTSIDE the `tv.` namespace so it survives the
// sign-out wipe (lib/session.signOut clears every `tv.*` key) — keeping
// funnel continuity across logout/login on the same device.
const DEVICE_KEY = "tv-device-id";
const BUFFER_KEY = "tv.analytics.buffer";
const BUFFER_CAP = 200;

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function deviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

type Sink = (e: AnalyticsEvent) => void;
const sinks: Sink[] = [];

/** Register a vendor adapter. Called once at startup if/when keys exist. */
export function registerAnalyticsSink(sink: Sink): void {
  sinks.push(sink);
}

function readBuffer(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(BUFFER_KEY) || "[]") as AnalyticsEvent[];
  } catch {
    return [];
  }
}

function writeBuffer(events: AnalyticsEvent[]): void {
  localStorage.setItem(BUFFER_KEY, JSON.stringify(events.slice(-BUFFER_CAP)));
}

/** Most-recent-first buffered events — for a debug/admin surface. */
export function recentEvents(limit = 50): AnalyticsEvent[] {
  return readBuffer().slice(-limit).reverse();
}

export function track(name: string, props: AnalyticsProps = {}): void {
  if (typeof window === "undefined") return;

  const cleaned: Record<string, string | number | boolean | null> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined) cleaned[k] = v;
  }

  const ev: AnalyticsEvent = {
    id: uuid(),
    name,
    props: cleaned,
    email: getCurrentUser()?.email ?? null,
    deviceId: deviceId(),
    path: window.location?.pathname ?? "",
    ts: Date.now(),
  };

  writeBuffer([...readBuffer(), ev]);

  for (const sink of sinks) {
    try {
      sink(ev);
    } catch {
      // never let a sink break the app
    }
  }

  // First-party cloud mirror — fire-and-forget, lazy import so the
  // Supabase client never loads on pages that don't already need it.
  void (async () => {
    try {
      const { mirrorEvent } = await import("./supabase/analytics-sync");
      await mirrorEvent(ev);
    } catch {
      // best-effort; the local buffer retains the event
    }
  })();
}
