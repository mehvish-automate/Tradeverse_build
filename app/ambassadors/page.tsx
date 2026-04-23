"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  Ambassadorship,
  EligibleClub,
  claimAmbassadorship,
  eligibleClaims,
  myAmbassadorships,
} from "@/lib/ambassadors";
import { useSession } from "@/lib/session";

export default function AmbassadorsPage() {
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
  const [claims, setClaims] = useState<EligibleClub[]>([]);
  const [mine, setMine] = useState<Ambassadorship[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!user) return;
    setClaims(eligibleClaims(user.email));
    setMine(myAmbassadorships(user.email));
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!user) return null;

  function claim(clubId: string) {
    setError(null);
    setOk(null);
    const r = claimAmbassadorship(user!.email, user!.displayName, clubId);
    if (!r.ok) {
      setError(r.error ?? "Claim failed.");
      return;
    }
    setOk("You're the campus ambassador. Profile chip unlocked.");
    refresh();
  }

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Campus Ambassadors
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Ambassador program</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          One ambassador per institute. Eligibility: own a club and host at
          least one fest. Ambassadors get a profile chip, a gold badge, and
          first access to new features. No cash rewards — just
          recognition.
        </p>
      </div>

      <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
          Your ambassadorships
        </h2>
        {mine.length === 0 ? (
          <p className="mt-3 text-sm text-ink-400">
            None yet. Qualifying clubs are below.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink-900 rounded-lg border border-ink-800 bg-ink-950">
            {mine.map((a) => (
              <li
                key={a.instituteId}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-ink-100">
                  Ambassador for{" "}
                  <span className="font-semibold">{a.instituteId}</span>
                </span>
                <span className="text-xs text-ink-500">
                  since {new Date(a.claimedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
          Claim at a qualifying club
        </h2>
        {claims.length === 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
            No qualifying clubs yet. You need to own a club at your institute
            AND have hosted at least one fest there.
            <div className="mt-4">
              <Link
                href="/clubs"
                className="rounded-md border border-ink-700 px-4 py-2 text-xs text-ink-100 hover:bg-ink-900"
              >
                Start or find your club →
              </Link>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {claims.map((c) => (
              <li
                key={c.clubId}
                className="rounded-xl border border-ink-700 bg-ink-900/40 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-brand-300">
                      {c.instituteShort}
                    </div>
                    <div className="mt-1 font-semibold text-ink-50">
                      {c.clubName}
                    </div>
                    <div className="mt-1 text-xs text-ink-500">
                      {c.festCount} fest
                      {c.festCount === 1 ? "" : "s"} hosted
                    </div>
                  </div>
                  {c.slotTaken ? (
                    <span className="shrink-0 rounded-md bg-ink-800 px-3 py-1.5 text-xs text-ink-400">
                      Taken
                      {c.slotHolderHandle && ` by @${c.slotHolderHandle}`}
                    </span>
                  ) : (
                    <button
                      onClick={() => claim(c.clubId)}
                      className="shrink-0 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300"
                    >
                      Claim
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        {ok && <p className="mt-3 text-sm text-brand-300">{ok}</p>}
      </section>

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
