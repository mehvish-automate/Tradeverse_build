"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { QuestView, QuestWindow, claimQuest, viewQuests } from "@/lib/quests";
import { useSession } from "@/lib/session";

export default function QuestsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <QuestsInner />
        </RequireAuth>
      </main>
    </>
  );
}

function QuestsInner() {
  const { user } = useSession();
  const [quests, setQuests] = useState<QuestView[]>([]);

  const refresh = useCallback(() => {
    if (!user) return;
    setQuests(viewQuests(user.email));
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) return null;

  const groups: { window: QuestWindow; label: string; sub: string }[] = [
    { window: "daily", label: "Today", sub: "Resets at midnight" },
    { window: "weekly", label: "This week", sub: "Resets Monday" },
    { window: "monthly", label: "This month", sub: "Resets on the 1st" },
  ];

  return (
    <>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Quests
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Goals & rewards</h1>
          <p className="mt-2 text-sm text-ink-400">
            Small, bounded goals that pay XP. Come back each window and claim
            what you&apos;ve earned.
          </p>
        </div>
      </div>

      <Link
        href="/play"
        className="group mb-8 flex items-center justify-between rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-5 transition hover:border-brand-500"
      >
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            Daily · today
          </div>
          <div className="mt-1 text-xl font-semibold text-ink-50">
            Today&apos;s chart challenge
          </div>
          <p className="mt-1 text-sm text-ink-300">
            5 questions from yesterday&apos;s tape. ~3 minutes. Counts toward
            today&apos;s quests.
          </p>
        </div>
        <span className="text-sm text-brand-300 group-hover:underline">
          Play →
        </span>
      </Link>

      {groups.map((g) => {
        const items = quests.filter((q) => q.quest.window === g.window);
        const totalClaimable = items
          .filter((q) => q.canClaim)
          .reduce((s, q) => s + q.quest.rewardXp, 0);
        const doneCount = items.filter((q) => q.completed).length;

        return (
          <section key={g.window} className="mb-8">
            <header className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="text-xl font-semibold text-ink-50">{g.label}</h2>
                <div className="text-xs text-ink-500">{g.sub}</div>
              </div>
              <div className="text-right text-xs">
                <div className="text-ink-400">
                  {doneCount}/{items.length} complete
                </div>
                {totalClaimable > 0 && (
                  <div className="text-brand-300">
                    {totalClaimable} XP ready to claim
                  </div>
                )}
              </div>
            </header>

            <ul className="space-y-2">
              {items.map((q) => (
                <li key={q.key}>
                  <QuestRow
                    q={q}
                    onClaim={() => {
                      claimQuest(user.email, q.key, q.quest.rewardXp);
                      refresh();
                    }}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="mt-10 rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
              Looking for the Quiz Floor?
            </div>
            <p className="mt-1 text-sm text-ink-200">
              Multi-day quiz competitions you host or join via invite code live
              under <strong>Floors → Quiz Floor</strong> (not here — this page
              is your daily XP quest list).
            </p>
          </div>
          <Link href="/quizzes" className="btn-primary shrink-0">
            Open Quiz Floor →
          </Link>
        </div>
      </div>

      <div className="mt-6">
        <Link
          href="/learn"
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Open skill tree →
        </Link>
      </div>
    </>
  );
}

function QuestRow({ q, onClaim }: { q: QuestView; onClaim: () => void }) {
  const pct = Math.min(100, Math.round((q.done / q.target) * 100));

  return (
    <div
      className={
        "flex items-center gap-4 rounded-xl border px-4 py-3 transition " +
        (q.claimed
          ? "border-ink-800 bg-ink-900/20 opacity-70"
          : q.completed
            ? "border-brand-500/50 bg-brand-500/5"
            : "border-ink-700 bg-ink-900/40")
      }
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink-50">{q.quest.title}</span>
          <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-xs text-ink-300">
            {q.quest.rewardXp} XP
          </span>
        </div>
        <div className="mt-1 truncate text-sm text-ink-400">
          {q.quest.description}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900">
            <div
              className="h-full bg-brand-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-ink-500">
            {q.done}/{q.target}
          </span>
        </div>
      </div>
      <div className="shrink-0">
        {q.claimed ? (
          <span className="text-xs text-ink-500">Claimed ✓</span>
        ) : q.canClaim ? (
          <button
            onClick={onClaim}
            className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300"
          >
            Claim {q.quest.rewardXp} XP
          </button>
        ) : (
          <span className="text-xs text-ink-500">In progress</span>
        )}
      </div>
    </div>
  );
}
