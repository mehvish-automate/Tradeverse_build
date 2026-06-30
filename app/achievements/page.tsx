"use client";

// Phase 63 — Achievements. A trophy wall on top of the badge system:
// headline milestones with progress bars, plus every badge grouped by
// tier (earned vs locked).

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { BadgeCtx, BadgeView, buildBadgeCtx, viewBadges } from "@/lib/badges";
import { useSession } from "@/lib/session";

export default function AchievementsPage() {
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
  const [views, setViews] = useState<BadgeView[]>([]);
  const [ctx, setCtx] = useState<BadgeCtx | null>(null);

  useEffect(() => {
    if (!user) return;
    setViews(viewBadges(user.email));
    setCtx(buildBadgeCtx(user.email));
  }, [user]);

  if (!user || !ctx) return null;

  const earned = views.filter((v) => v.earned).length;
  const milestones = [
    { label: "XP", value: ctx.totalXp, target: 10000, icon: "⚡" },
    { label: "Longest streak", value: ctx.longestStreak, target: 30, icon: "🔥" },
    { label: "Quizzes won", value: ctx.festsWon, target: 5, icon: "🏆" },
    { label: "Lessons done", value: ctx.lessonsDone, target: 20, icon: "📚" },
  ];

  const tiers: { id: "gold" | "silver" | "bronze"; label: string }[] = [
    { id: "gold", label: "Gold" },
    { id: "silver", label: "Silver" },
    { id: "bronze", label: "Bronze" },
  ];

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Achievements
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Trophy wall</h1>
        <p className="mt-2 text-sm text-ink-400">
          {earned} of {views.length} badges earned. Chase the milestones below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {milestones.map((m) => {
          const pct = Math.min(100, Math.round((m.value / m.target) * 100));
          return (
            <div key={m.label} className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-300">
                  {m.icon} {m.label}
                </span>
                <span className="text-xs text-ink-500">
                  {m.value.toLocaleString()} / {m.target.toLocaleString()}
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-900">
                <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {tiers.map((tier) => {
        const items = views.filter((v) => v.badge.tier === tier.id);
        if (items.length === 0) return null;
        return (
          <section key={tier.id} className="mt-8">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
              {tier.label}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((v) => (
                <div
                  key={v.badge.id}
                  className={
                    "rounded-xl border p-4 text-center transition " +
                    (v.earned
                      ? "border-brand-500/40 bg-brand-500/5"
                      : "border-ink-800 bg-ink-900/30 opacity-60")
                  }
                >
                  <div className={"text-3xl " + (v.earned ? "" : "grayscale")}>
                    {v.badge.icon}
                  </div>
                  <div className="mt-1 text-sm font-medium text-ink-50">{v.badge.title}</div>
                  <div className="mt-0.5 text-[11px] text-ink-500">
                    {v.earned ? "Earned" : v.badge.description}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <div className="mt-8">
        <Link href="/profile" className="btn-ghost">
          Back to profile
        </Link>
      </div>
    </>
  );
}
