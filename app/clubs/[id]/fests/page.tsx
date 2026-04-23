"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";

export default function FestsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <FestsInner />
        </RequireAuth>
      </main>
    </>
  );
}

function FestsInner() {
  const params = useParams<{ id: string }>();
  const id = params?.id ? String(params.id) : "";

  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900/40 p-8">
      <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
        Phase 10.2 — coming next
      </div>
      <h1 className="mt-2 text-3xl font-semibold">Fests</h1>
      <p className="mt-3 max-w-xl text-ink-300">
        Multi-day club tournaments with their own invite code and
        leaderboard are landing next. For now, trade floors cover the weekly
        competition loop.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/clubs/${id}`}
          className="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to club
        </Link>
        <Link
          href="/trade-floors"
          className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Trade floors →
        </Link>
      </div>
    </div>
  );
}
