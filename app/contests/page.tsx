"use client";

// Phase 63 — Contests. Competitions with stakes: your prize quizzes and
// the official TradeVerse cups, with prize summaries and status.

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Fest, festStatus, myFests } from "@/lib/fests";
import { officialFests } from "@/lib/officialTournaments";
import { tiersSummary } from "@/lib/rewardTiers";
import { useSession } from "@/lib/session";

export default function ContestsPage() {
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
  const [mine, setMine] = useState<Fest[]>([]);

  useEffect(() => {
    if (user) {
      setMine(myFests(user.email).filter((f) => (f.rewards ?? []).length > 0));
    }
  }, [user]);

  if (!user) return null;
  const official = officialFests();

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Contests
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Compete for prizes</h1>
        <p className="mt-2 text-sm text-ink-400">
          Quizzes and cups with reward pools. Non-cash only — XP, badges and
          perk coupons.
        </p>
      </div>

      <Section
        title="Your prize quizzes"
        count={mine.length}
        empty="No prize quizzes yet. Launch one with rewards, or join by code."
      >
        {mine.map((f) => (
          <Row
            key={f.id}
            href={`/fests/${f.id}`}
            name={f.name}
            status={festStatus(f)}
            prize={tiersSummary(f.rewards ?? [])}
          />
        ))}
      </Section>

      <Section title="Official cups" count={official.length} empty="">
        {official.map((f) => (
          <Row
            key={f.id}
            href={`/fests/${f.id}`}
            name={f.name}
            status={festStatus(f)}
            prize="Official TradeVerse cup"
            official
          />
        ))}
      </Section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/quizzes" className="btn-ghost">
          Browse Quiz Floor
        </Link>
        <Link href="/marketplace" className="btn-ghost">
          Events marketplace
        </Link>
      </div>
    </>
  );
}

function Section({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">{title}</h2>
      {count > 0 ? (
        <ul className="divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
          {children}
        </ul>
      ) : empty ? (
        <p className="rounded-xl border border-ink-700 bg-ink-900/40 p-5 text-sm text-ink-400">
          {empty}
        </p>
      ) : null}
    </section>
  );
}

function Row({
  href,
  name,
  status,
  prize,
  official,
}: {
  href: string;
  name: string;
  status: string;
  prize: string;
  official?: boolean;
}) {
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-ink-900/60">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-ink-50">{name}</span>
            {official && (
              <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                Official
              </span>
            )}
            <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
              {status}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-amber-300">🏆 {prize}</div>
        </div>
        <span className="shrink-0 text-ink-400">→</span>
      </Link>
    </li>
  );
}
