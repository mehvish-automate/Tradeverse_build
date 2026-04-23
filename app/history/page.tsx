"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { DailyResult, getProgress } from "@/lib/progress";
import { useSession } from "@/lib/session";

export default function HistoryPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <HistoryInner />
        </RequireAuth>
      </main>
    </>
  );
}

function HistoryInner() {
  const { user } = useSession();
  const [store, setStore] = useState<{
    streak: number;
    totalXp: number;
    history: DailyResult[];
  }>({ streak: 0, totalXp: 0, history: [] });

  useEffect(() => {
    if (!user) return;
    const p = getProgress(user.email);
    setStore({
      streak: p.streak,
      totalXp: p.totalXp,
      history: [...p.history].sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)),
    });
  }, [user]);

  if (!user) return null;

  const totalQs = store.history.reduce((s, r) => s + r.total, 0);
  const totalCorrect = store.history.reduce((s, r) => s + r.correct, 0);
  const accuracy = totalQs === 0 ? 0 : Math.round((totalCorrect / totalQs) * 100);
  const avgMs =
    store.history.length === 0
      ? 0
      : Math.round(
          store.history.reduce((s, r) => s + r.timeMs, 0) / store.history.length,
        );

  return (
    <>
      <div className="mb-8">
        <h1 className="text-3xl font-semibold">History</h1>
        <p className="mt-1 text-sm text-ink-400">
          Your daily challenge runs. Accuracy drifts up once you start
          recognising the same patterns in new places.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Plays" value={`${store.history.length}`} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
        <Stat label="Total XP" value={store.totalXp.toLocaleString()} />
        <Stat label="Avg time" value={`${Math.round(avgMs / 1000)}s`} />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
          Last {store.history.length} runs
        </h2>
        {store.history.length === 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
            No plays yet.{" "}
            <Link href="/play" className="text-brand-300 hover:underline">
              Start today&apos;s challenge →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
            {store.history.map((r) => {
              const pct = Math.round((r.correct / r.total) * 100);
              return (
                <li
                  key={r.dateKey}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <span className="text-ink-200">{formatDate(r.dateKey)}</span>
                  <span className="flex items-center gap-6 text-ink-400">
                    <Bar pct={pct} />
                    <span className="w-16 text-right">
                      {r.correct}/{r.total}
                    </span>
                    <span className="w-12 text-right">{pct}%</span>
                    <span className="w-14 text-right font-mono text-ink-100">
                      {r.xp.toLocaleString()} XP
                    </span>
                    <span className="w-12 text-right text-xs">
                      {Math.round(r.timeMs / 1000)}s
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-10 flex gap-3">
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
          Play today →
        </Link>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-ink-900 md:inline-block">
      <span
        className="block h-full bg-brand-500"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}

function formatDate(key: string): string {
  const d = new Date(key);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
