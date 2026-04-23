"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  ClubRow,
  InstituteRow,
  PlayerRow,
  topClubs,
  topInstitutes,
  topPlayers,
} from "@/lib/leaderboards";
import { useSession } from "@/lib/session";

type Tab = "players" | "clubs" | "institutes";

export default function LeaderboardsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>("players");
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [insts, setInsts] = useState<InstituteRow[]>([]);

  useEffect(() => {
    if (!user) return;
    setPlayers(topPlayers(user.email, user.displayName));
    setClubs(topClubs());
    setInsts(topInstitutes());
  }, [user]);

  if (!user) return null;

  const myRank = players.findIndex((p) => p.isYou) + 1;

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Global
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Leaderboards</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Top players by lifetime XP, top clubs by member and post velocity,
          and top institutes by club density. All skill / activity — no
          capital, no cash.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {(["players", "clubs", "institutes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "rounded-md border px-3 py-1.5 text-xs transition capitalize " +
              (tab === t
                ? "border-brand-500 bg-brand-500/10 text-brand-200"
                : "border-ink-700 text-ink-300 hover:border-ink-500")
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "players" && (
        <section className="overflow-hidden rounded-2xl border border-ink-700">
          <header className="flex items-center justify-between border-b border-ink-700/70 bg-ink-900/60 px-5 py-3 text-xs text-ink-400">
            <span>Top players · lifetime XP</span>
            <span>You&apos;re #{myRank || "-"}</span>
          </header>
          <ol className="divide-y divide-ink-900">
            {players.map((r, i) => (
              <li
                key={r.handle + i}
                className={
                  "flex items-center justify-between px-5 py-3 text-sm " +
                  (r.isYou ? "bg-brand-500/5" : "")
                }
              >
                <span className="flex items-center gap-3">
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
                  <span className={r.isYou ? "font-medium text-ink-50" : "text-ink-200"}>
                    {r.handle}
                    {r.isYou && <span className="ml-2 text-xs text-brand-300">you</span>}
                  </span>
                </span>
                <span className="flex items-center gap-5 text-xs text-ink-400">
                  <span>{r.plays} plays</span>
                  <span className="font-mono text-ink-50">
                    {r.xp.toLocaleString()} XP
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="border-t border-ink-900 px-5 py-3 text-xs text-ink-500">
            V1 note: peer XP is seeded for the demo; your row uses your real
            lifetime total.
          </p>
        </section>
      )}

      {tab === "clubs" && (
        <section className="overflow-hidden rounded-2xl border border-ink-700">
          <header className="border-b border-ink-700/70 bg-ink-900/60 px-5 py-3 text-xs text-ink-400">
            Top clubs · weighted by members + post velocity
          </header>
          {clubs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">
              No clubs yet. Start one to seed the leaderboard.
            </p>
          ) : (
            <ol className="divide-y divide-ink-900">
              {clubs.map((c, i) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <Link
                    href={`/clubs/${c.id}`}
                    className="flex items-center gap-3 hover:text-ink-50"
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
                    <div>
                      <div className="text-ink-100">{c.name}</div>
                      <div className="text-xs text-ink-500">
                        {c.instituteShort}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-5 text-xs text-ink-400">
                    <span>{c.memberCount} mem</span>
                    <span>{c.postsCount} posts</span>
                    <span className="font-mono text-ink-50">{c.score}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {tab === "institutes" && (
        <section className="overflow-hidden rounded-2xl border border-ink-700">
          <header className="border-b border-ink-700/70 bg-ink-900/60 px-5 py-3 text-xs text-ink-400">
            Top institutes · total clubs + members
          </header>
          {insts.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">
              No clubs yet anywhere. Be the first to start one at your
              institute.
            </p>
          ) : (
            <ol className="divide-y divide-ink-900">
              {insts.map((inst, i) => (
                <li
                  key={inst.id}
                  className="flex items-center justify-between px-5 py-3 text-sm"
                >
                  <span className="flex items-center gap-3">
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
                    <div>
                      <div className="text-ink-100">{inst.short}</div>
                      <div className="text-xs text-ink-500">{inst.name}</div>
                    </div>
                  </span>
                  <div className="flex items-center gap-5 text-xs text-ink-400">
                    <span>{inst.clubs} clubs</span>
                    <span>{inst.members} mem</span>
                    <span className="font-mono text-ink-50">{inst.score}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
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
