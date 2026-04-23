"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { EVENTS, EventDef, isResolved, resolveDate } from "@/lib/events";
import { myAllocation, scoreEvent } from "@/lib/eventPortfolios";
import { useSession } from "@/lib/session";

export default function EventsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <RequireAuth>
          <EventsInner />
        </RequireAuth>
      </main>
    </>
  );
}

function EventsInner() {
  const { user } = useSession();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onFocus = () => setTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  if (!user) return null;

  const open = EVENTS.filter((e) => !isResolved(e));
  const resolved = EVENTS.filter((e) => isResolved(e));

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Events
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Event portfolios</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Curated scenarios. Read the thesis, pick a sector allocation, come
          back at resolution to see how you did vs NIFTY. Zero money —
          rewarded in XP.
        </p>
      </div>

      <section className="mb-10" key={tick}>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
          Open now
        </h2>
        {open.length === 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
            Nothing open right now. Check back soon.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {open.map((e) => (
              <li key={e.id}>
                <EventCard def={e} userEmail={user.email} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
            Resolved
          </h2>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {resolved.map((e) => (
              <li key={e.id}>
                <EventCard def={e} userEmail={user.email} />
              </li>
            ))}
          </ul>
        </section>
      )}

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

function EventCard({ def, userEmail }: { def: EventDef; userEmail: string }) {
  const alloc = myAllocation(userEmail, def.id);
  const resolved = isResolved(def);
  const score = alloc ? scoreEvent(alloc, def) : null;
  const resolvesOn = resolveDate(def).toISOString().slice(0, 10);

  return (
    <Link
      href={`/events/${def.id}`}
      className={
        "block rounded-2xl border p-5 transition " +
        (resolved
          ? "border-ink-700 bg-ink-900/40 hover:border-ink-500"
          : "border-brand-500/40 bg-brand-500/5 hover:border-brand-500")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            {resolved ? "Resolved" : "Open"} ·{" "}
            {resolved
              ? `Ended ${resolvesOn}`
              : `Resolves ${resolvesOn}`}
          </div>
          <h3 className="mt-1 text-lg font-semibold text-ink-50">{def.title}</h3>
          <p className="mt-1 text-sm text-ink-300">{def.tagline}</p>
        </div>
        <div className="shrink-0 rounded-md bg-ink-900 px-2 py-0.5 text-xs text-ink-300">
          {def.rewardXp}+ XP
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-ink-500">
          {def.sectors.length} sectors + cash
        </span>
        {alloc ? (
          resolved && score ? (
            <span
              className={
                (score.portfolioReturnPct >= 0 ? "text-brand-300" : "text-red-300") +
                " font-semibold"
              }
            >
              {score.portfolioReturnPct >= 0 ? "+" : ""}
              {score.portfolioReturnPct.toFixed(2)}%
              <span className="ml-2 text-ink-500 font-normal">
                {score.alphaPct >= 0 ? "+" : ""}
                {score.alphaPct.toFixed(2)}% vs NIFTY
              </span>
            </span>
          ) : (
            <span className="text-brand-300">Submitted ✓</span>
          )
        ) : (
          <span className="text-ink-300">
            {resolved ? "Missed it" : "Not submitted"}
          </span>
        )}
      </div>
    </Link>
  );
}
