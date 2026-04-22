"use client";

import Link from "next/link";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";

export default function PlayPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <RequireAuth>
          <div className="rounded-2xl border border-ink-700 bg-ink-900/40 p-8">
            <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
              Phase 3 — coming next
            </div>
            <h1 className="mt-2 text-3xl font-semibold">Daily Chart Challenge</h1>
            <p className="mt-3 text-ink-300">
              This is where the daily 5-question run will live. We&apos;re
              building it next: question UI, scoring, timer, streaks, and a
              results screen.
            </p>
            <Link
              href="/profile"
              className="mt-6 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
            >
              Back to profile
            </Link>
          </div>
        </RequireAuth>
      </main>
    </>
  );
}
