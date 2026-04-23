"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { isAmbassador } from "@/lib/ambassadors";
import { TIER_ICONS, creatorStats } from "@/lib/creator";
import { EVENTS, isResolved } from "@/lib/events";
import { myAllocation } from "@/lib/eventPortfolios";
import { getFest, myFests, festStatus } from "@/lib/fests";
import { getHomeInstitute } from "@/lib/onboarding";
import { getInstitute } from "@/lib/clubs";
import { hasPlayedToday, getProgress } from "@/lib/progress";
import { viewQuests } from "@/lib/quests";
import { useSession } from "@/lib/session";
import { currentRsiAlerts } from "@/lib/watchlist";

export default function WidgetsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  if (!user) return null;

  const progress = getProgress(user.email);
  const played = hasPlayedToday(user.email);
  const quests = viewQuests(user.email);
  const claimable = quests.filter((q) => q.canClaim);
  const stats = creatorStats(user.email);
  const alerts = currentRsiAlerts(user.email);
  const mine = myFests(user.email);
  const upcomingFest = mine
    .map((f) => getFest(f.id) ?? f)
    .filter((f) => festStatus(f) !== "ended")
    .sort(
      (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    )[0];
  const unclaimedEvent = EVENTS.find(
    (ev) => isResolved(ev) && !myAllocation(user.email, ev.id)?.claimed,
  );
  const homeInst = (() => {
    const id = getHomeInstitute(user.email);
    return id ? getInstitute(id) : null;
  })();

  // `tick` is referenced to keep the periodic refresh from being optimised out.
  void tick;

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Widgets
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Home-screen summary</h1>
        <p className="mt-1 max-w-xl text-sm text-ink-400">
          The glanceable cards TradeVerse shows as widgets (and will push as
          nudges when you have notifications on).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Widget
          tone={played ? "brand" : "amber"}
          label="Today"
          title={played ? "Run complete" : "Daily challenge"}
          body={
            played
              ? `🔥 ${progress.streak}-day streak · ${progress.totalXp.toLocaleString()} XP lifetime`
              : "5 questions · ~5 minutes · accuracy + speed"
          }
          cta={played ? "See history" : "Play now"}
          href={played ? "/history" : "/play"}
        />

        <Widget
          tone="neutral"
          label="Inbox"
          title={`${claimable.length} quest${claimable.length === 1 ? "" : "s"} ready`}
          body={
            claimable.length === 0
              ? "Nothing to claim right now."
              : `Total ${claimable.reduce((s, q) => s + q.quest.rewardXp, 0)} XP waiting`
          }
          cta="Open quests"
          href="/quests"
        />

        {upcomingFest && (
          <Widget
            tone="brand"
            label={festStatus(upcomingFest) === "live" ? "Live fest" : "Upcoming fest"}
            title={upcomingFest.name}
            body={`${upcomingFest.startDate} → ${upcomingFest.endDate} · ${upcomingFest.participants.length} players`}
            cta="Open fest"
            href={`/fests/${upcomingFest.id}`}
          />
        )}

        {unclaimedEvent && (
          <Widget
            tone="amber"
            label="Resolved event"
            title={unclaimedEvent.title}
            body="Claim your Market Events reward before it gets buried."
            cta="Claim"
            href={`/events/${unclaimedEvent.id}`}
          />
        )}

        {alerts.length > 0 && (
          <Widget
            tone="violet"
            label="Watchlist alert"
            title={`${alerts.length} RSI ${alerts.length === 1 ? "alert" : "alerts"}`}
            body={alerts
              .slice(0, 3)
              .map((a) => `${a.symbol} ${a.rsi.toFixed(0)} (${a.zone})`)
              .join(" · ")}
            cta="Open watchlist"
            href="/watchlist"
          />
        )}

        <Widget
          tone="neutral"
          label="Creator"
          title={`${TIER_ICONS[stats.tier]} ${stats.points} creator points`}
          body={
            stats.nextTier
              ? `${stats.toNext} to ${stats.nextTier} · ${stats.pctToNext}%`
              : "Top tier — you're at the peak."
          }
          cta="Dashboard"
          href="/creator"
        />

        {homeInst && (
          <Widget
            tone="neutral"
            label="Institute"
            title={homeInst.short}
            body={`${homeInst.name} · ${homeInst.city}`}
            cta="Clubs"
            href="/clubs"
          />
        )}

        {isAmbassador(user.email) && (
          <Widget
            tone="amber"
            label="Ambassador"
            title="🎖️ Active"
            body="You represent your institute on TradeVerse."
            cta="View"
            href="/ambassadors"
          />
        )}
      </div>

      <p className="mt-6 text-xs text-ink-500">
        Android Chrome &amp; Edge: long-press the TradeVerse app icon on your
        home screen to see Play · Trade floor · Inbox shortcuts. iOS web
        widgets aren&apos;t yet exposed by Safari — this page mirrors what
        we&apos;ll surface when they land.
      </p>

      <div className="mt-10">
        <Link
          href="/profile"
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to profile
        </Link>
      </div>
    </>
  );
}

function Widget({
  tone,
  label,
  title,
  body,
  cta,
  href,
}: {
  tone: "brand" | "amber" | "violet" | "neutral";
  label: string;
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  const border =
    tone === "brand"
      ? "border-brand-500/40 bg-brand-500/5"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-500/5"
        : tone === "violet"
          ? "border-violet-500/40 bg-violet-500/5"
          : "border-ink-700 bg-ink-900/40";
  const labelTone =
    tone === "brand"
      ? "text-brand-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "violet"
          ? "text-violet-300"
          : "text-ink-400";
  return (
    <Link
      href={href}
      className={"block rounded-2xl border p-5 transition hover:border-ink-500 " + border}
    >
      <div
        className={
          "text-[10px] font-semibold uppercase tracking-[0.18em] " + labelTone
        }
      >
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-ink-50">{title}</div>
      <div className="mt-1 text-sm text-ink-300">{body}</div>
      <div className={"mt-3 text-sm " + labelTone}>{cta} →</div>
    </Link>
  );
}
