"use client";

// In-app notifications / activity inbox. Every reward, streak
// milestone, fest transition, quest-ready moment surfaces here.
//
// V1: we synthesise notifications on demand by scanning existing
// state (rewards log, fest status, quest claimables). Phase 12+
// backend will push real server-side events through the same shape.

import { getFest } from "./fests";
import { myFests } from "./fests";
import { festStatus } from "./fests";
import { rewardLog } from "./rewards";
import { viewQuests } from "./quests";
import { EVENTS, isResolved as eventResolved } from "./events";
import { myAllocation } from "./eventPortfolios";
import { mySessions, sessionStatus } from "./sessions";
import { currentRsiAlerts } from "./watchlist";

export type NotificationKind =
  | "reward"
  | "streak"
  | "quest-ready"
  | "event-resolved"
  | "fest-live"
  | "fest-starting"
  | "fest-ending"
  | "session-starting"
  | "session-live"
  | "rsi-alert";

export type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  ts: number;
  href?: string;
  emoji?: string;
};

const READ_KEY = (email: string) => `tv.notif.read.${email}`;

function readReadSet(email: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY(email)) || "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeReadSet(email: string, set: Set<string>) {
  localStorage.setItem(READ_KEY(email), JSON.stringify([...set]));
}

export function markRead(email: string, id: string) {
  const s = readReadSet(email);
  s.add(id);
  writeReadSet(email, s);
}

export function markAllRead(email: string, notifications: Notification[]) {
  const s = readReadSet(email);
  for (const n of notifications) s.add(n.id);
  writeReadSet(email, s);
}

export function isRead(email: string, id: string): boolean {
  return readReadSet(email).has(id);
}

/**
 * Build the current notification feed for the user. Deterministic for a
 * given state — same source data => same feed.
 */
export function buildFeed(email: string, now = new Date()): Notification[] {
  const out: Notification[] = [];
  const nowMs = now.getTime();

  // Reward log entries become notifications.
  for (const r of rewardLog(email).slice(-20)) {
    out.push({
      id: `reward:${r.ts}:${r.kind}`,
      kind: "reward",
      title:
        r.kind === "mystery"
          ? "Mystery reward"
          : r.kind === "freeze"
            ? "Streak freeze earned"
            : "Streak milestone",
      body: r.detail,
      ts: r.ts,
      emoji: r.kind === "freeze" ? "❄️" : r.kind === "mystery" ? "🎁" : "🔥",
    });
  }

  // Unclaimed quest rewards.
  const claimable = viewQuests(email, now).filter((q) => q.canClaim);
  if (claimable.length > 0) {
    const totalXp = claimable.reduce((s, q) => s + q.quest.rewardXp, 0);
    out.push({
      id: `quests:ready:${claimable.map((q) => q.key).join("|")}`,
      kind: "quest-ready",
      title: `${claimable.length} quest reward${claimable.length === 1 ? "" : "s"} ready`,
      body: `Claim ${totalXp} XP in total — your active quests completed.`,
      ts: nowMs,
      href: "/quests",
      emoji: "🎁",
    });
  }

  // Resolved event portfolios with unclaimed rewards.
  for (const ev of EVENTS) {
    if (!eventResolved(ev, now)) continue;
    const a = myAllocation(email, ev.id);
    if (!a || a.claimed) continue;
    out.push({
      id: `event:${ev.id}:claim`,
      kind: "event-resolved",
      title: `${ev.title} resolved`,
      body: "Claim your reward and see where you ranked.",
      ts: nowMs,
      href: `/events/${ev.id}`,
      emoji: "🗞️",
    });
  }

  // Fest transitions for fests the user is in.
  for (const f of myFests(email)) {
    const fresh = getFest(f.id) ?? f;
    const status = festStatus(fresh, now);
    const startMs = new Date(fresh.startDate).getTime();
    const endMs = new Date(fresh.endDate).getTime() + 24 * 60 * 60 * 1000 - 1;
    if (status === "live" && nowMs - startMs < 3 * 24 * 60 * 60 * 1000) {
      out.push({
        id: `fest:live:${fresh.id}`,
        kind: "fest-live",
        title: `${fresh.name} is live`,
        body: `Play today — scores count through ${fresh.endDate}.`,
        ts: startMs,
        href: `/fests/${fresh.id}`,
        emoji: "🎪",
      });
    }
    if (status === "upcoming" && startMs - nowMs < 3 * 24 * 60 * 60 * 1000) {
      out.push({
        id: `fest:soon:${fresh.id}`,
        kind: "fest-starting",
        title: `${fresh.name} starts soon`,
        body: `Kicks off ${fresh.startDate}.`,
        ts: startMs,
        href: `/fests/${fresh.id}`,
        emoji: "⏳",
      });
    }
    if (status === "live" && endMs - nowMs < 2 * 24 * 60 * 60 * 1000) {
      out.push({
        id: `fest:ending:${fresh.id}`,
        kind: "fest-ending",
        title: `${fresh.name} ends soon`,
        body: `Final stretch — less than 48 hours on the clock.`,
        ts: endMs,
        href: `/fests/${fresh.id}`,
        emoji: "⏱️",
      });
    }
  }

  // Upcoming live sessions the user RSVP'd to.
  for (const s of mySessions(email)) {
    const status = sessionStatus(s, nowMs);
    if (status === "live") {
      out.push({
        id: `session:live:${s.id}`,
        kind: "session-live",
        title: `Live now: ${s.title}`,
        body: `Hosted by @${s.hostDisplayName}. Join if you can.`,
        ts: s.startsAt,
        href: `/clubs/${s.clubId}/sessions`,
        emoji: "🎤",
      });
    } else if (status === "upcoming" && s.startsAt - nowMs < 6 * 60 * 60 * 1000) {
      out.push({
        id: `session:soon:${s.id}`,
        kind: "session-starting",
        title: `${s.title} starts soon`,
        body: `${new Date(s.startsAt).toLocaleString()} · hosted by @${s.hostDisplayName}`,
        ts: s.startsAt,
        href: `/clubs/${s.clubId}/sessions`,
        emoji: "⏰",
      });
    }
  }

  // Watchlist RSI alerts.
  for (const a of currentRsiAlerts(email, now)) {
    out.push({
      id: `rsi:${a.symbol}:${a.zone}`,
      kind: "rsi-alert",
      title: `${a.symbol} is ${a.zone}`,
      body: `RSI sitting at ${a.rsi.toFixed(0)} — the momentum is stretched ${a.zone === "overbought" ? "up" : "down"}. Context, not a tip.`,
      ts: nowMs,
      href: "/watchlist",
      emoji: a.zone === "overbought" ? "🔥" : "❄️",
    });
  }

  // Deduplicate by id, newest first.
  const dedup = new Map<string, Notification>();
  for (const n of out) dedup.set(n.id, n);
  return [...dedup.values()].sort((a, b) => b.ts - a.ts);
}

export function unreadCount(email: string, now = new Date()): number {
  const set = readReadSet(email);
  return buildFeed(email, now).filter((n) => !set.has(n.id)).length;
}
