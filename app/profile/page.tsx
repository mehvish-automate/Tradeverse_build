"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { TRACKS } from "@/lib/learn";
import { nextLesson, overallCompletion } from "@/lib/learnProgress";
import { isAmbassador } from "@/lib/ambassadors";
import { earnedCount } from "@/lib/badges";
import { getInstitute } from "@/lib/clubs";
import {
  CreatorTier,
  TIER_ICONS,
  TIER_LABELS,
  creatorStats,
} from "@/lib/creator";
import { EVENTS, isResolved } from "@/lib/events";
import { myAllocation } from "@/lib/eventPortfolios";
import { getHomeInstitute } from "@/lib/onboarding";
import { getMyTradeFloors } from "@/lib/tradeFloors";
import { getProgress } from "@/lib/progress";
import { viewQuests } from "@/lib/quests";
import { ageFromDob, useSession } from "@/lib/session";

export default function ProfilePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <RequireAuth>
          <ProfileInner />
        </RequireAuth>
      </main>
    </>
  );
}

function ProfileInner() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const [progress, setProgress] = useState({
    streak: 0,
    totalXp: 0,
    plays: 0,
    tradeFloors: 0,
    learnPct: 0,
    learnDone: 0,
    learnTotal: 0,
    nextLessonId: null as string | null,
    nextLessonTitle: "",
    nextTrackTitle: "",
    questsClaimable: 0,
    questsClaimableXp: 0,
    badgesEarned: 0,
    badgesTotal: 0,
    eventClaimable: 0,
    ambassador: false,
    homeInstitute: "",
    creatorTier: "apprentice" as CreatorTier,
  });

  useEffect(() => {
    if (!user) return;
    const p = getProgress(user.email);
    const ls = getMyTradeFloors(user.email);
    const learn = overallCompletion(user.email);
    const nxt = nextLesson(user.email);
    const nxtLesson = nxt
      ? TRACKS.find((t) => t.id === nxt.track.id)?.lessons.find(
          (l) => l.id === nxt.lessonId,
        )
      : null;
    const qs = viewQuests(user.email);
    const claimable = qs.filter((q) => q.canClaim);
    const badges = earnedCount(user.email);
    let eventClaimable = 0;
    for (const ev of EVENTS) {
      if (!isResolved(ev)) continue;
      const a = myAllocation(user.email, ev.id);
      if (a && !a.claimed) eventClaimable++;
    }
    setProgress({
      streak: p.streak,
      totalXp: p.totalXp,
      plays: p.history.length,
      tradeFloors: ls.length,
      learnPct: learn.pct,
      learnDone: learn.done,
      learnTotal: learn.total,
      nextLessonId: nxt?.lessonId ?? null,
      nextLessonTitle: nxtLesson?.title ?? "",
      nextTrackTitle: nxt?.track.title ?? "",
      questsClaimable: claimable.length,
      questsClaimableXp: claimable.reduce((s, q) => s + q.quest.rewardXp, 0),
      badgesEarned: badges.earned,
      badgesTotal: badges.total,
      eventClaimable,
      ambassador: isAmbassador(user.email),
      homeInstitute: (() => {
        const id = getHomeInstitute(user.email);
        if (!id) return "";
        return getInstitute(id)?.short ?? "";
      })(),
      creatorTier: creatorStats(user.email).tier,
    });
  }, [user]);

  if (!user) return null;

  const age = ageFromDob(user.dob);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-semibold">@{user.displayName}</h1>
            {progress.ambassador && (
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                🎖️ Ambassador
              </span>
            )}
            {progress.creatorTier !== "apprentice" && (
              <Link
                href="/creator"
                className="rounded-md bg-brand-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300 hover:bg-brand-500/25"
              >
                {TIER_ICONS[progress.creatorTier]} {TIER_LABELS[progress.creatorTier]}
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-400">
            {user.email} · {age} yrs
            {progress.homeInstitute && ` · ${progress.homeInstitute}`} · joined{" "}
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => {
            signOut();
            router.push("/");
          }}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-900"
        >
          Sign out
        </button>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat
          label="Current streak"
          value={`${progress.streak}`}
          hint={progress.streak === 0 ? "Play today to start one" : `${progress.plays} days played`}
        />
        <Stat
          label="XP"
          value={progress.totalXp.toLocaleString()}
          hint="Earn by answering correctly + fast"
        />
        <Stat
          label="Trade Floors"
          value={`${progress.tradeFloors}`}
          hint={progress.tradeFloors === 0 ? "Create or join one" : "View your trade floors →"}
        />
      </div>

      {progress.eventClaimable > 0 && (
        <Link
          href="/events"
          className="group mt-10 flex items-center justify-between rounded-2xl border border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-transparent p-5 hover:border-amber-500"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🗞️</span>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-amber-300">
                Market Events
              </div>
              <div className="text-sm text-ink-100">
                {progress.eventClaimable} Analysis Challenge
                {progress.eventClaimable === 1 ? "" : "s"} resolved — claim your reward
              </div>
            </div>
          </div>
          <span className="text-sm text-amber-300 group-hover:underline">Open →</span>
        </Link>
      )}

      {progress.questsClaimable > 0 && (
        <Link
          href="/quests"
          className={
            "group flex items-center justify-between rounded-2xl border border-amber-500/50 bg-gradient-to-br from-amber-500/10 to-transparent p-5 hover:border-amber-500 " +
            (progress.eventClaimable > 0 ? "mt-4" : "mt-10")
          }
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎁</span>
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-amber-300">
                Quests
              </div>
              <div className="text-sm text-ink-100">
                {progress.questsClaimable} reward
                {progress.questsClaimable === 1 ? "" : "s"} ready ·{" "}
                {progress.questsClaimableXp} XP to claim
              </div>
            </div>
          </div>
          <span className="text-sm text-amber-300 group-hover:underline">Claim →</span>
        </Link>
      )}

      {progress.nextLessonId && (
        <Link
          href={`/learn/${progress.nextLessonId}`}
          className={
            "group block rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-6 hover:border-brand-500 " +
            (progress.questsClaimable > 0 ? "mt-4" : "mt-10")
          }
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
                Up next · Learn
              </div>
              <div className="mt-1 text-xl font-semibold">
                {progress.nextLessonTitle}
              </div>
              <div className="mt-1 text-xs text-ink-400">
                {progress.nextTrackTitle} · {progress.learnDone}/
                {progress.learnTotal} lessons complete
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-ink-500">Tree</div>
              <div className="text-2xl font-semibold">{progress.learnPct}%</div>
            </div>
          </div>
        </Link>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Link
          href="/play"
          className="group rounded-2xl border border-brand-500/40 bg-brand-500/5 p-6 hover:bg-brand-500/10"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            Daily
          </div>
          <div className="mt-1 text-xl font-semibold">Today&apos;s chart challenge</div>
          <p className="mt-2 text-sm text-ink-300">
            5 questions from yesterday&apos;s tape.
          </p>
          <div className="mt-4 text-sm text-brand-300 group-hover:underline">
            Play →
          </div>
        </Link>

        <Link
          href="/trade-floors"
          className="group rounded-2xl border border-ink-700 bg-ink-900/40 p-6 hover:border-ink-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Social
          </div>
          <div className="mt-1 text-xl font-semibold">Trade floors</div>
          <p className="mt-2 text-sm text-ink-300">
            3–20 friends, weekly cycle, zero money.
          </p>
          <div className="mt-4 text-sm text-ink-300 group-hover:text-ink-50">
            Open →
          </div>
        </Link>

        <Link
          href="/learn"
          className="group rounded-2xl border border-ink-700 bg-ink-900/40 p-6 hover:border-ink-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Learn
          </div>
          <div className="mt-1 text-xl font-semibold">Skill tree</div>
          <p className="mt-2 text-sm text-ink-300">
            Bite-sized lessons. Unlock as you go.
          </p>
          <div className="mt-4 text-sm text-ink-300 group-hover:text-ink-50">
            Open →
          </div>
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/portfolios"
          className="group rounded-2xl border border-ink-700 bg-ink-900/40 p-6 hover:border-ink-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Portfolios
          </div>
          <div className="mt-1 text-xl font-semibold">Virtual portfolios</div>
          <p className="mt-2 text-sm text-ink-300">
            Build a paper ₹1L allocation. See it move against NIFTY. Zero
            real money.
          </p>
          <div className="mt-4 text-sm text-ink-300 group-hover:text-ink-50">Open →</div>
        </Link>

        <Link
          href="/events"
          className="group rounded-2xl border border-ink-700 bg-ink-900/40 p-6 hover:border-ink-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Market Events
          </div>
          <div className="mt-1 text-xl font-semibold">Analysis Challenge</div>
          <p className="mt-2 text-sm text-ink-300">
            Budget week, IT earnings, festive auto. Pick an allocation,
            resolve and see how you ranked.
          </p>
          <div className="mt-4 text-sm text-ink-300 group-hover:text-ink-50">Open →</div>
        </Link>

        <Link
          href="/watchlist"
          className="group rounded-2xl border border-ink-700 bg-ink-900/40 p-6 hover:border-ink-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Watchlist
          </div>
          <div className="mt-1 text-xl font-semibold">Stocks you follow</div>
          <p className="mt-2 text-sm text-ink-300">
            Pick names to track. RSI alerts land in your inbox when they
            cross 70 or 30.
          </p>
          <div className="mt-4 text-sm text-ink-300 group-hover:text-ink-50">Open →</div>
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        <Link
          href="/trade"
          className="group rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-6 hover:border-brand-500"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
                Paper trading
              </div>
              <div className="mt-1 text-xl font-semibold">
                Trade ticket & L2 book
              </div>
              <p className="mt-2 text-sm text-ink-300">
                Market, Limit, Stop, Stop-Limit — with slippage, latency and
                partial fills. Starts with ₹10L paper cash. Zero real money.
              </p>
            </div>
            <span className="text-sm text-brand-300 group-hover:underline">Open →</span>
          </div>
        </Link>
      </div>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
              Community
            </div>
            <h2 className="mt-1 text-xl font-semibold text-ink-50">
              Clubs & tournaments
            </h2>
            <p className="mt-1 text-sm text-ink-400">
              Find your institute, host a fest, or jump into any tournament
              running on TradeVerse right now.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            href="/clubs"
            className="group rounded-2xl border border-ink-700 bg-ink-900/40 p-6 hover:border-ink-500"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
              Institutes · Clubs
            </div>
            <div className="mt-1 text-xl font-semibold">Clubs</div>
            <p className="mt-2 text-sm text-ink-300">
              Your college or CA institute&apos;s finance club. Find it or
              start one.
            </p>
            <div className="mt-4 text-sm text-ink-300 group-hover:text-ink-50">Open →</div>
          </Link>

          <Link
            href="/marketplace"
            className="group rounded-2xl border border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-transparent p-6 hover:border-violet-500"
          >
            <div className="text-xs font-medium uppercase tracking-wider text-violet-300">
              Marketplace
            </div>
            <div className="mt-1 text-xl font-semibold">Events</div>
            <p className="mt-2 text-sm text-ink-300">
              Every tournament running — official TradeVerse cups plus
              community-hosted fests. Browse, join by code.
            </p>
            <div className="mt-4 text-sm text-violet-300 group-hover:underline">Open →</div>
          </Link>
        </div>
      </section>

      <div className="mt-10 flex flex-wrap gap-4 text-sm text-ink-400">
        <Link href="/quests" className="hover:text-ink-100">
          Quests →
        </Link>
        <Link href="/badges" className="hover:text-ink-100">
          Badges {progress.badgesEarned}/{progress.badgesTotal} →
        </Link>
        <Link href="/history" className="hover:text-ink-100">
          History →
        </Link>
        <Link href="/referrals" className="hover:text-ink-100">
          Invite friends →
        </Link>
        <Link href="/ambassadors" className="hover:text-ink-100">
          Ambassador →
        </Link>
        <Link href="/inbox" className="hover:text-ink-100">
          Inbox →
        </Link>
        <Link href="/leaderboards" className="hover:text-ink-100">
          Leaderboards →
        </Link>
        <Link href="/creator" className="hover:text-ink-100">
          Creator →
        </Link>
        <Link href="/settings" className="hover:text-ink-100">
          Settings →
        </Link>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-ink-500">{hint}</div>
    </div>
  );
}
