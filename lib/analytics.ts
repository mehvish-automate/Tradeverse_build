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
// Grouped by the three lenses the board calls out: attribution (where a
// user came from), engagement (what they do), and comms (how we reach
// them + what they open).
export const EV = {
  // attribution
  attribution: "attribution_captured",
  screenView: "screen_view",
  signUp: "sign_up",
  signIn: "sign_in",
  // engagement
  dailyFinish: "daily_finish",
  quizLaunch: "quiz_launch",
  quizStart: "quiz_start",
  quizFinish: "quiz_finish",
  joinByCode: "join_by_code",
  register: "register",
  share: "share",
  ctaClick: "cta_click",
  // comms
  inboxOpen: "inbox_open",
  notificationOpen: "notification_open",
} as const;

// Stable screen names for screen_view tracking. Dynamic segments (ids,
// codes) collapse to one name so the analytics dimension stays bounded.
export function screenName(pathname: string): string {
  const clean = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  const seg = clean.split("/").filter(Boolean);
  const head = seg[0] ?? "";

  // Dynamic-route refinements first.
  if (head === "quizzes" && seg[1] === "new") return "quiz_launch";
  if (head === "fests" && seg[2] === "play") return "quiz_play";
  if (head === "fests") return "event_detail";
  if (head === "learn" && seg[1]) return "lesson";
  if (head === "admin" && seg[1] === "fests") return "admin_approvals";
  if (head === "admin" && seg[1] === "floors") return "admin_floors";
  if (head === "clubs" && seg[1]) return "club_detail";
  if (head === "portfolios" && seg[1]) return "portfolio_detail";
  if (head === "live" && seg[1]) return "live_session";
  if (head === "s") return "share_landing";

  const map: Record<string, string> = {
    "": "landing",
    learn: "learn",
    quests: "quests",
    play: "daily_challenge",
    quizzes: "quiz_floor",
    floors: "floors",
    events: "market_events",
    strategy: "strategy_builder",
    trade: "paper_trading",
    portfolios: "portfolios",
    watchlist: "watchlist",
    charts: "multi_chart",
    chart: "chart",
    social: "social",
    clubs: "clubs",
    marketplace: "events_marketplace",
    leaderboards: "leaderboards",
    badges: "badges",
    history: "history",
    profile: "profile",
    inbox: "inbox",
    alerts: "alerts",
    settings: "settings",
    referrals: "referrals",
    ambassadors: "ambassadors",
    creator: "creator",
    creators: "creators",
    welcome: "welcome",
    signin: "sign_in",
    signup: "sign_up",
    "forgot-password": "forgot_password",
    widgets: "widgets",
  };
  return map[head] ?? (head || "unknown");
}

export type Attribution = {
  ref?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPath: string;
  landedAt: number;
};

// Attribution persists outside the `tv.` namespace so first-touch survives
// the sign-out wipe and ties a later signup back to its source.
const ATTRIBUTION_KEY = "tv-attribution";

export function getAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

/** First-touch capture of ?ref / ?via / utm_* params. Idempotent. */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  if (getAttribution()) return; // first touch only
  const q = new URLSearchParams(window.location.search);
  const ref = q.get("ref") || q.get("via") || undefined;
  const utmSource = q.get("utm_source") || undefined;
  const utmMedium = q.get("utm_medium") || undefined;
  const utmCampaign = q.get("utm_campaign") || undefined;
  const attribution: Attribution = {
    ref,
    utmSource,
    utmMedium,
    utmCampaign,
    landingPath: window.location.pathname,
    landedAt: Date.now(),
  };
  localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  if (ref || utmSource || utmCampaign) {
    track(EV.attribution, {
      ref: ref ?? null,
      utmSource: utmSource ?? null,
      utmMedium: utmMedium ?? null,
      utmCampaign: utmCampaign ?? null,
      landingPath: attribution.landingPath,
    });
  }
}

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

  // Attach first-touch attribution to every event (without clobbering an
  // explicit prop of the same name) so any event can be analysed by source.
  const attr = getAttribution();
  if (attr) {
    if (attr.ref && cleaned.attr_ref === undefined) cleaned.attr_ref = attr.ref;
    if (attr.utmSource && cleaned.attr_utm_source === undefined)
      cleaned.attr_utm_source = attr.utmSource;
    if (attr.utmCampaign && cleaned.attr_utm_campaign === undefined)
      cleaned.attr_utm_campaign = attr.utmCampaign;
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
