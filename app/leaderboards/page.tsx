"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  ClubRow,
  FriendRow,
  InstituteRow,
  PlayerRow,
  PrivateFloorEntry,
  friendEmails,
  myPrivateFloors,
  topClubs,
  topFriends,
  topInstitutes,
  topPlayers,
} from "@/lib/leaderboards";
import { useSession } from "@/lib/session";
import { useRealtimeLeaderboards } from "@/lib/supabase/realtime";
import { pullScoresFor } from "@/lib/supabase/scores-sync";
import { currentWeekStart } from "@/lib/tradeFloors";
import { formatRupees } from "@/lib/competitions";

type Tab = "players" | "clubs" | "institutes";
type PlayerScope = "global" | "friends" | "private";

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
  const [scope, setScope] = useState<PlayerScope>("global");

  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [privates, setPrivates] = useState<PrivateFloorEntry[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [insts, setInsts] = useState<InstituteRow[]>([]);

  const live = useRealtimeLeaderboards();
  const [scoresTick, setScoresTick] = useState(0);

  // Always-on local refresh.
  useEffect(() => {
    if (!user) return;
    setPlayers(topPlayers(user.email, user.displayName));
    setClubs(topClubs());
    setInsts(topInstitutes());
    setPrivates(myPrivateFloors(user.email));
  }, [user]);

  // Pull cloud scores for friends so the Friends tab isn't all zeros.
  // Re-runs on every realtime tick on daily_results.
  useEffect(() => {
    if (!user) return;
    const peers = friendEmails(user.email).map((f) => f.email);
    if (peers.length === 0) return;
    const since = currentWeekStart();
    const until = new Date().toISOString().slice(0, 10);
    let cancelled = false;
    void (async () => {
      await pullScoresFor([user.email, ...peers], since, until);
      if (!cancelled) setScoresTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, live.tick]);

  // Recompute friends from cache after each pull / scoresTick.
  useEffect(() => {
    if (!user) return;
    setFriends(topFriends(user.email, user.displayName));
  }, [user, scoresTick]);

  if (!user) return null;

  const myGlobalRank = players.findIndex((p) => p.isYou) + 1;
  const myFriendsRank = friends.findIndex((p) => p.isYou) + 1;

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Leaderboards
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Where you rank</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Players ranked by lifetime XP (Global), this week&apos;s XP among
          people you know (Friends), or live P&amp;L inside each private
          competition you&apos;ve joined. Plus top clubs and institutes by
          activity.
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
        <>
          <ScopeChips scope={scope} setScope={setScope} />

          {scope === "global" && (
            <PlayersBoard
              rows={players}
              myRank={myGlobalRank}
              displayName={user.displayName}
              context="TradeVerse global · lifetime XP"
              footer="V1 note: peer XP is seeded for the demo; your row uses your real lifetime total."
              header="Top players · lifetime XP"
            />
          )}

          {scope === "friends" && (
            <FriendsBoard
              rows={friends}
              myRank={myFriendsRank}
              displayName={user.displayName}
            />
          )}

          {scope === "private" && <PrivateList rows={privates} />}
        </>
      )}

      {tab === "clubs" && <ClubsBoard rows={clubs} />}
      {tab === "institutes" && <InstitutesBoard rows={insts} />}

      <div className="mt-10">
        <Link href="/profile" className="btn-ghost">
          Back to profile
        </Link>
      </div>
    </>
  );
}

// --- Scope chips ---

function ScopeChips({
  scope,
  setScope,
}: {
  scope: PlayerScope;
  setScope: (s: PlayerScope) => void;
}) {
  const opts: { id: PlayerScope; label: string; sub: string }[] = [
    { id: "global", label: "Global", sub: "Everyone on TradeVerse" },
    { id: "friends", label: "Friends", sub: "Clubs + Quiz Floors you're in" },
    { id: "private", label: "Private", sub: "Your private competitions" },
  ];
  return (
    <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-3">
      {opts.map((o) => {
        const on = scope === o.id;
        return (
          <button
            key={o.id}
            onClick={() => setScope(o.id)}
            className={
              "rounded-xl border px-4 py-3 text-left transition " +
              (on
                ? "border-brand-500 bg-brand-500/10"
                : "border-ink-700 bg-ink-900/40 hover:border-ink-500")
            }
          >
            <div
              className={
                "text-sm font-semibold " +
                (on ? "text-ink-50" : "text-ink-100")
              }
            >
              {o.label}
            </div>
            <div className="mt-0.5 text-xs text-ink-500">{o.sub}</div>
          </button>
        );
      })}
    </div>
  );
}

// --- Boards ---

function PlayersBoard({
  rows,
  myRank,
  displayName,
  context,
  footer,
  header,
}: {
  rows: PlayerRow[];
  myRank: number;
  displayName: string;
  context: string;
  footer: string;
  header: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-700">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/70 bg-ink-900/60 px-5 py-3 text-xs text-ink-400">
        <span>{header}</span>
        <span className="flex items-center gap-3">
          <span>You&apos;re #{myRank || "-"}</span>
          {myRank > 0 && (
            <Link
              href={
                "/s/card?kind=rank" +
                `&handle=${encodeURIComponent(displayName)}` +
                `&context=${encodeURIComponent(context)}` +
                `&rank=${myRank}` +
                `&outOf=${rows.length}` +
                `&xp=${rows[myRank - 1]?.xp ?? 0}`
              }
              className="rounded-md border border-ink-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-200 hover:bg-ink-900"
            >
              Share card
            </Link>
          )}
        </span>
      </header>
      <ol className="divide-y divide-ink-900">
        {rows.map((r, i) => (
          <li
            key={r.handle + i}
            className={
              "flex items-center justify-between px-5 py-3 text-sm " +
              (r.isYou ? "bg-brand-500/5" : "")
            }
          >
            <span className="flex items-center gap-3">
              <RankBadge index={i} />
              <span
                className={r.isYou ? "font-medium text-ink-50" : "text-ink-200"}
              >
                {r.handle}
                {r.isYou && (
                  <span className="ml-2 text-xs text-brand-300">you</span>
                )}
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
        {footer}
      </p>
    </section>
  );
}

function FriendsBoard({
  rows,
  myRank,
  displayName,
}: {
  rows: FriendRow[];
  myRank: number;
  displayName: string;
}) {
  if (rows.length <= 1) {
    return (
      <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
        <h2 className="text-lg font-semibold">No friends here yet</h2>
        <p className="mt-2 text-sm text-ink-400">
          Join a club or a Quiz Floor to populate this board with people you
          know. Their week-of-{currentWeekStart()} XP shows up here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/clubs" className="btn-ghost">
            Browse clubs
          </Link>
          <Link href="/quizzes" className="btn-ghost">
            Open Quiz Floor
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-700">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/70 bg-ink-900/60 px-5 py-3 text-xs text-ink-400">
        <span>Friends · this week · real cross-user XP</span>
        <span className="flex items-center gap-3">
          <span>You&apos;re #{myRank || "-"}</span>
          {myRank > 0 && (
            <Link
              href={
                "/s/card?kind=rank" +
                `&handle=${encodeURIComponent(displayName)}` +
                `&context=${encodeURIComponent("Friends · weekly XP")}` +
                `&rank=${myRank}` +
                `&outOf=${rows.length}` +
                `&xp=${rows[myRank - 1]?.xp ?? 0}`
              }
              className="rounded-md border border-ink-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-200 hover:bg-ink-900"
            >
              Share card
            </Link>
          )}
        </span>
      </header>
      <ol className="divide-y divide-ink-900">
        {rows.map((r, i) => (
          <li
            key={r.email}
            className={
              "flex items-center justify-between px-5 py-3 text-sm " +
              (r.isYou ? "bg-brand-500/5" : "")
            }
          >
            <span className="flex items-center gap-3">
              <RankBadge index={i} />
              <span
                className={r.isYou ? "font-medium text-ink-50" : "text-ink-200"}
              >
                {r.handle}
                {r.isYou && (
                  <span className="ml-2 text-xs text-brand-300">you</span>
                )}
              </span>
              {r.unresolved && !r.isYou && (
                <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-500">
                  no cloud data
                </span>
              )}
            </span>
            <span className="flex items-center gap-5 text-xs text-ink-400">
              <span>{r.plays} plays</span>
              <span>{r.correct} correct</span>
              <span className="font-mono text-ink-50">
                {r.xp.toLocaleString()} XP
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PrivateList({ rows }: { rows: PrivateFloorEntry[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
        <h2 className="text-lg font-semibold">No private competitions yet</h2>
        <p className="mt-2 text-sm text-ink-400">
          Launch a private Quiz Floor or join one with an invite code, and
          your live P&amp;L rank inside each will show up here.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/quizzes" className="btn-primary">
            Launch a competition
          </Link>
          <Link href="/quizzes" className="btn-ghost">
            All Quiz Floors
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-700">
      <header className="border-b border-ink-700/70 bg-ink-900/60 px-5 py-3 text-xs text-ink-400">
        Private competitions · live P&amp;L
      </header>
      <ul className="divide-y divide-ink-900">
        {rows.map((r) => {
          const positive = r.myPnl >= 0;
          return (
            <li key={r.floor.id}>
              <Link
                href={`/trade-floors/${r.floor.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-ink-900/60"
              >
                <div className="min-w-0">
                  <div className="font-medium text-ink-50">{r.floor.name}</div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    Code {r.floor.id} · {r.totalMembers}/{r.floor.memberCap}{" "}
                    members · {formatRupees(r.floor.virtualCapital)} starting
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-ink-400">
                    Rank{" "}
                    <span className="font-mono text-ink-50">
                      #{r.myRank || "-"}/{r.totalMembers}
                    </span>
                  </span>
                  <span
                    className={
                      "font-mono " +
                      (positive ? "text-brand-300" : "text-red-300")
                    }
                  >
                    {positive ? "+" : ""}
                    {r.myPnlPct.toFixed(2)}%
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ClubsBoard({ rows }: { rows: ClubRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-700">
      <header className="border-b border-ink-700/70 bg-ink-900/60 px-5 py-3 text-xs text-ink-400">
        Top clubs · weighted by members + post velocity
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-400">
          No clubs yet. Start one to seed the leaderboard.
        </p>
      ) : (
        <ol className="divide-y divide-ink-900">
          {rows.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center justify-between px-5 py-3 text-sm"
            >
              <Link
                href={`/clubs/${c.id}`}
                className="flex items-center gap-3 hover:text-ink-50"
              >
                <RankBadge index={i} />
                <div>
                  <div className="text-ink-100">{c.name}</div>
                  <div className="text-xs text-ink-500">{c.instituteShort}</div>
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
  );
}

function InstitutesBoard({ rows }: { rows: InstituteRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-ink-700">
      <header className="border-b border-ink-700/70 bg-ink-900/60 px-5 py-3 text-xs text-ink-400">
        Top institutes · total clubs + members
      </header>
      {rows.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-400">
          No clubs yet anywhere. Be the first to start one at your institute.
        </p>
      ) : (
        <ol className="divide-y divide-ink-900">
          {rows.map((inst, i) => (
            <li
              key={inst.id}
              className="flex items-center justify-between px-5 py-3 text-sm"
            >
              <span className="flex items-center gap-3">
                <RankBadge index={i} />
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
  );
}

function RankBadge({ index }: { index: number }) {
  return (
    <span
      className={
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold " +
        (index === 0
          ? "bg-brand-500 text-ink-950"
          : index < 3
            ? "bg-ink-800 text-ink-100"
            : "bg-ink-900 text-ink-400")
      }
    >
      {index + 1}
    </span>
  );
}
