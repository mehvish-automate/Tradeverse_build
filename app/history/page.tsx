"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { DailyResult, getProgress } from "@/lib/progress";
import { useSession } from "@/lib/session";

type Window = "1D" | "1W" | "1M" | "6M" | "ALL";

const WINDOWS: { id: Window; days: number | null; label: string }[] = [
  { id: "1D",  days: 1,    label: "1D" },
  { id: "1W",  days: 7,    label: "1W" },
  { id: "1M",  days: 30,   label: "1M" },
  { id: "6M",  days: 180,  label: "6M" },
  { id: "ALL", days: null, label: "All" },
];

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
  const [all, setAll] = useState<DailyResult[]>([]);
  const [streak, setStreak] = useState(0);
  const [window, setWindow] = useState<Window>("1M");

  useEffect(() => {
    if (!user) return;
    const p = getProgress(user.email);
    setStreak(p.streak);
    setAll([...p.history].sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)));
  }, [user]);

  const windowDays =
    WINDOWS.find((w) => w.id === window)?.days ?? null;

  const filtered = useMemo(() => {
    if (windowDays == null) return all;
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    return all.filter((r) => new Date(r.dateKey).getTime() >= cutoff);
  }, [all, windowDays]);

  if (!user) return null;

  const totalQs = filtered.reduce((s, r) => s + r.total, 0);
  const totalCorrect = filtered.reduce((s, r) => s + r.correct, 0);
  const totalXp = filtered.reduce((s, r) => s + r.xp, 0);
  const totalMs = filtered.reduce((s, r) => s + r.timeMs, 0);
  const accuracy = totalQs === 0 ? 0 : Math.round((totalCorrect / totalQs) * 100);
  const avgTimePerQ =
    totalQs === 0 ? 0 : Math.round(totalMs / totalQs / 1000);
  const avgTimePerRun =
    filtered.length === 0 ? 0 : Math.round(totalMs / filtered.length / 1000);
  const perfectRuns = filtered.filter((r) => r.correct === r.total).length;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">History</h1>
        <p className="mt-1 text-sm text-ink-400">
          Your daily challenge runs. Accuracy drifts up once you start
          recognising the same patterns in new places.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">Window:</span>
        {WINDOWS.map((w) => (
          <button
            key={w.id}
            onClick={() => setWindow(w.id)}
            className={
              "rounded-md border px-3 py-1.5 text-xs transition " +
              (window === w.id
                ? "border-brand-500 bg-brand-500/10 text-brand-200"
                : "border-ink-700 text-ink-300 hover:border-ink-500")
            }
          >
            {w.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-ink-500">
          🔥 {streak}-day streak
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Plays" value={`${filtered.length}`} />
        <Stat
          label="Accuracy"
          value={`${accuracy}%`}
          sub={`${totalCorrect}/${totalQs} correct`}
        />
        <Stat label="XP in window" value={totalXp.toLocaleString()} />
        <Stat
          label="Avg time"
          value={`${avgTimePerQ}s`}
          sub={`${avgTimePerRun}s per run`}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Perfect runs"
          value={`${perfectRuns}`}
          sub={
            filtered.length === 0
              ? "—"
              : `${Math.round((perfectRuns / filtered.length) * 100)}% of runs`
          }
        />
        <Stat
          label="Total time"
          value={formatDuration(totalMs)}
          sub="in window"
        />
        <Stat
          label="Questions"
          value={`${totalQs}`}
          sub="answered"
        />
        <Stat
          label="Avg XP / run"
          value={
            filtered.length === 0
              ? "0"
              : Math.round(totalXp / filtered.length).toLocaleString()
          }
        />
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
          {filtered.length} run{filtered.length === 1 ? "" : "s"} in window
        </h2>
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
            {all.length === 0 ? (
              <>
                No plays yet.{" "}
                <Link href="/play" className="text-brand-300 hover:underline">
                  Start today&apos;s challenge →
                </Link>
              </>
            ) : (
              <>
                Nothing inside {window}. Try a wider window or{" "}
                <Link href="/play" className="text-brand-300 hover:underline">
                  play today
                </Link>
                .
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
            {filtered.map((r) => {
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

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-4">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-500">{sub}</div>}
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

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}
