"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { BadgeView, viewBadges } from "@/lib/badges";
import { useSession } from "@/lib/session";

export default function BadgesPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <BadgesInner />
        </RequireAuth>
      </main>
    </>
  );
}

function BadgesInner() {
  const { user } = useSession();
  const [badges, setBadges] = useState<BadgeView[]>([]);

  useEffect(() => {
    if (user) setBadges(viewBadges(user.email));
  }, [user]);

  if (!user) return null;

  const earned = badges.filter((b) => b.earned).length;

  return (
    <>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Achievements
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Badges</h1>
          <p className="mt-2 text-sm text-ink-400">
            Milestones you&apos;ve cleared. Every badge is tied to doing the
            work — no pay-to-win, ever.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-ink-700 bg-ink-900/40 p-4 text-right">
          <div className="text-xs text-ink-500">Earned</div>
          <div className="text-2xl font-semibold">
            {earned}
            <span className="text-ink-500">/{badges.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {badges.map(({ badge, earned }) => (
          <article
            key={badge.id}
            className={
              "rounded-xl border p-4 " +
              (earned
                ? tierToClass(badge.tier)
                : "border-ink-800 bg-ink-900/30 opacity-55")
            }
          >
            <div className="text-3xl leading-none">{badge.icon}</div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-50">
                {badge.title}
              </span>
              {earned && (
                <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
                  Earned
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-ink-400">{badge.description}</p>
            <div className="mt-3 text-[10px] uppercase tracking-wider text-ink-500">
              {badge.tier}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/profile"
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to profile
        </Link>
        <Link
          href="/play"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Play today&apos;s challenge →
        </Link>
      </div>
    </>
  );
}

function tierToClass(tier: "bronze" | "silver" | "gold"): string {
  if (tier === "gold") return "border-amber-400/50 bg-amber-400/5";
  if (tier === "silver") return "border-slate-300/40 bg-slate-300/5";
  return "border-orange-700/40 bg-orange-700/5";
}
