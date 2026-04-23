"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  CreatorRow,
  TIER_ICONS,
  TIER_LABELS,
  creatorDirectory,
} from "@/lib/creator";
import { useSession } from "@/lib/session";

export default function CreatorsDirectoryPage() {
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
  const [rows, setRows] = useState<CreatorRow[]>([]);

  useEffect(() => {
    if (!user) return;
    setRows(creatorDirectory(user.email, user.displayName));
  }, [user]);

  if (!user) return null;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Creators
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Directory</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-400">
            The people doing the work on TradeVerse — ranked by creator
            points. All activity-based, never pay-to-rank.
          </p>
        </div>
        <Link
          href="/creator"
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300"
        >
          My status →
        </Link>
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-700">
        <header className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b border-ink-700 bg-ink-900/60 px-5 py-3 text-xs uppercase tracking-wider text-ink-400">
          <span>Rank</span>
          <span>Creator</span>
          <span>Tier</span>
          <span className="text-right">Points</span>
        </header>
        <ol className="divide-y divide-ink-900">
          {rows.map((r, i) => (
            <li
              key={r.handle + i}
              className={
                "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-5 py-3 text-sm " +
                (r.isYou ? "bg-brand-500/5" : "")
              }
            >
              <span
                className={
                  "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold " +
                  (i === 0
                    ? "bg-brand-500 text-ink-950"
                    : i < 3
                      ? "bg-ink-800 text-ink-100"
                      : "bg-ink-900 text-ink-400")
                }
              >
                {i + 1}
              </span>
              <span className="flex items-center gap-2">
                <span className={r.isYou ? "text-ink-50 font-medium" : "text-ink-200"}>
                  {r.handle}
                </span>
                {r.isYou && (
                  <span className="text-xs text-brand-300">you</span>
                )}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-ink-200">
                <span>{TIER_ICONS[r.tier]}</span>
                <span>{TIER_LABELS[r.tier]}</span>
              </span>
              <span className="text-right font-mono text-ink-100">
                {r.points.toLocaleString()}
              </span>
            </li>
          ))}
        </ol>
        <p className="border-t border-ink-900 px-5 py-3 text-xs text-ink-500">
          V1 note: peer entries are seeded until the backend lands; your row
          uses your real activity.
        </p>
      </section>

      <div className="mt-10 flex gap-3">
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
