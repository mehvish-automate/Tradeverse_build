"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  CreatorStats,
  TIER_ICONS,
  TIER_LABELS,
  allTiers,
  creatorStats,
} from "@/lib/creator";
import { useSession } from "@/lib/session";

export default function CreatorPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const [stats, setStats] = useState<CreatorStats | null>(null);

  useEffect(() => {
    if (!user) return;
    setStats(creatorStats(user.email));
  }, [user]);

  if (!user || !stats) return null;

  const tiers = allTiers();

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Creator programme
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Your creator status</h1>
          <p className="mt-2 max-w-xl text-sm text-ink-400">
            Tier unlocks from the work — posts, fests, sessions, referrals,
            fest wins. No money, no pay-to-tier.
          </p>
        </div>
        <Link
          href="/creators"
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-100 hover:bg-ink-900"
        >
          Directory →
        </Link>
      </div>

      <section
        className={
          "rounded-2xl border p-6 " +
          (stats.tier === "apprentice"
            ? "border-ink-700 bg-ink-900/40"
            : "border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent")
        }
      >
        <div className="flex items-center gap-4">
          <div className="text-5xl leading-none">{TIER_ICONS[stats.tier]}</div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
              Current tier
            </div>
            <div className="text-3xl font-semibold">
              {TIER_LABELS[stats.tier]}
            </div>
            <div className="mt-0.5 text-xs text-ink-500">
              {stats.points.toLocaleString()} creator points
            </div>
          </div>
        </div>

        {stats.nextTier ? (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-ink-400">
              <span>
                Next: {TIER_ICONS[stats.nextTier]} {TIER_LABELS[stats.nextTier]}
              </span>
              <span>{stats.toNext} points to go</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-900">
              <div
                className="h-full bg-brand-500 transition-all"
                style={{ width: `${stats.pctToNext}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="mt-5 text-xs text-ink-400">
            You&apos;re at the top tier. Your activity keeps the directory
            warm.
          </div>
        )}
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Posts" value={stats.posts} weight="1 pt" />
        <Stat label="Fests hosted" value={stats.festsHosted} weight="5 pts" />
        <Stat label="Sessions hosted" value={stats.sessionsHosted} weight="5 pts" />
        <Stat label="Referrals" value={stats.referrals} weight="3 pts" />
        <Stat label="Fest wins" value={stats.festsWon} weight="10 pts" />
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
          Tier ladder
        </h2>
        <ul className="mt-3 space-y-2">
          {tiers.map((t) => {
            const active = stats.tier === t.tier;
            return (
              <li
                key={t.tier}
                className={
                  "flex items-center justify-between rounded-md border px-4 py-2.5 text-sm " +
                  (active
                    ? "border-brand-500 bg-brand-500/10"
                    : "border-ink-800 bg-ink-950")
                }
              >
                <span className="flex items-center gap-3">
                  <span className="text-xl">{TIER_ICONS[t.tier]}</span>
                  <span
                    className={
                      active
                        ? "font-semibold text-ink-50"
                        : "text-ink-200"
                    }
                  >
                    {TIER_LABELS[t.tier]}
                  </span>
                  {active && (
                    <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
                      you
                    </span>
                  )}
                </span>
                <span className="text-xs text-ink-400">
                  {t.min === 0 ? "Default" : `${t.min}+ points`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
          What each tier unlocks
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-300">
          <li className="flex gap-2">
            <span className="text-brand-300">🥉</span>
            <span>
              <span className="text-ink-100">Creator</span> — Profile chip and
              a line in the public creator directory.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-300">🥈</span>
            <span>
              <span className="text-ink-100">Contributor</span> — Prezone
              launch access to run bigger cohort events (Ambassador path).
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-300">🥇</span>
            <span>
              <span className="text-ink-100">Creator+</span> — Priority
              surfacing in the marketplace + eligibility for TradeVerse
              Official co-hosted fests.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-brand-300">💎</span>
            <span>
              <span className="text-ink-100">Top Creator</span> — Feature
              spot on the home surface and first access to any monetisation
              lever we add.
            </span>
          </li>
        </ul>
        <p className="mt-4 text-[10px] text-ink-500">
          V1 note: the benefit lines describe the direction — the underlying
          surfaces roll out as we land the backend.
        </p>
      </section>

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

function Stat({
  label,
  value,
  weight,
}: {
  label: string;
  value: number;
  weight: string;
}) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
      <div className="mt-0.5 text-[10px] text-ink-500">{weight} each</div>
    </div>
  );
}
