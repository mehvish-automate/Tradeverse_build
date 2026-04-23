"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Club, getClub, getInstitute } from "@/lib/clubs";
import { Fest, festStatus, festsForClub } from "@/lib/fests";
import { Post, listPosts, REACTIONS } from "@/lib/floor";
import { LiveSession, sessionStatus, sessionsForClub } from "@/lib/sessions";
import { useSession } from "@/lib/session";

export default function ClubAdminPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const router = useRouter();
  const { user } = useSession();
  const params = useParams<{ id: string }>();
  const clubId = params?.id ? String(params.id) : "";

  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);
  const [fests, setFests] = useState<Fest[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);

  useEffect(() => {
    if (!clubId) return;
    setClub(getClub(clubId));
    setPosts(listPosts(clubId));
    setFests(festsForClub(clubId));
    setSessions(sessionsForClub(clubId));
  }, [clubId]);

  useEffect(() => {
    if (!user || club === undefined) return;
    if (!club) return;
    const isOwner = club.members.some(
      (m) => m.email === user.email && m.role === "owner",
    );
    if (!isOwner) router.replace(`/clubs/${club.id}`);
  }, [user, club, router]);

  if (!user || club === undefined) return null;
  if (club === null) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Club not found</h1>
        <Link
          href="/clubs"
          className="mt-4 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to clubs
        </Link>
      </div>
    );
  }

  const inst = getInstitute(club.instituteId);

  // --- Derived metrics ---

  const memberCount = club.members.length;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const newThisWeek = club.members.filter((m) => now - m.joinedAt < weekMs).length;
  const newThisMonth = club.members.filter((m) => now - m.joinedAt < monthMs).length;

  // Floor activity
  const totalPosts = posts.length;
  const postsThisWeek = posts.filter((p) => now - p.createdAt < weekMs).length;
  const reactionsTotal = posts.reduce(
    (s, p) =>
      s +
      REACTIONS.reduce((k, e) => k + (p.reactions[e] || []).length, 0),
    0,
  );
  const commentsTotal = posts.reduce((s, p) => s + p.comments.length, 0);
  const postsByAuthor = new Map<string, { handle: string; count: number }>();
  for (const p of posts) {
    const existing = postsByAuthor.get(p.email);
    if (existing) existing.count++;
    else postsByAuthor.set(p.email, { handle: p.displayName, count: 1 });
  }
  const topPosters = [...postsByAuthor.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const mostReacted =
    [...posts].sort((a, b) => {
      const ra = REACTIONS.reduce((k, e) => k + (a.reactions[e] || []).length, 0);
      const rb = REACTIONS.reduce((k, e) => k + (b.reactions[e] || []).length, 0);
      return rb - ra;
    })[0] ?? null;

  // Fests
  const activeFest = fests.find((f) => festStatus(f) === "live");
  const upcomingFests = fests.filter((f) => festStatus(f) === "upcoming");
  const endedFests = fests.filter((f) => festStatus(f) === "ended");
  const totalFestParticipants = fests.reduce(
    (s, f) => s + f.participants.length,
    0,
  );

  // Sessions
  const upcomingSessions = sessions.filter(
    (s) => sessionStatus(s, now) === "upcoming",
  );
  const endedSessions = sessions.filter((s) => sessionStatus(s, now) === "ended");
  const avgRsvp =
    sessions.length > 0
      ? Math.round(
          sessions.reduce((s, x) => s + x.rsvps.length, 0) / sessions.length,
        )
      : 0;

  return (
    <>
      <div className="mb-6">
        <Link
          href={`/clubs/${club.id}`}
          className="text-xs text-ink-400 hover:text-ink-100"
        >
          ← {club.name}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">Admin dashboard</h1>
          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
            Owner only
          </span>
        </div>
        <div className="mt-1 text-xs text-ink-500">
          {inst?.short ?? "—"} · snapshot of activity across Floor, Fests,
          and Sessions.
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Members" value={`${memberCount}`} sub={`+${newThisWeek} this week`} />
        <Stat label="Posts" value={`${totalPosts}`} sub={`+${postsThisWeek} this week`} />
        <Stat label="Reactions" value={`${reactionsTotal}`} sub={`${commentsTotal} replies`} />
        <Stat
          label="Fests"
          value={`${fests.length}`}
          sub={`${activeFest ? "1 live · " : ""}${upcomingFests.length} upcoming`}
        />
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Top posters (all-time)">
          {topPosters.length === 0 ? (
            <Empty label="No posts yet. Seed one from the floor." />
          ) : (
            <ul className="divide-y divide-ink-900 text-sm">
              {topPosters.map((p, i) => (
                <li key={p.handle + i} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink-800 text-xs">
                      {i + 1}
                    </span>
                    <span className="text-ink-100">@{p.handle}</span>
                  </span>
                  <span className="font-mono text-ink-400">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Most-reacted post">
          {mostReacted ? (
            <>
              <div className="text-xs text-ink-500">
                @{mostReacted.displayName} · {relativeTime(mostReacted.createdAt)}
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-ink-200">
                {mostReacted.body}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {REACTIONS.map((e) => {
                  const n = (mostReacted.reactions[e] || []).length;
                  if (n === 0) return null;
                  return (
                    <span
                      key={e}
                      className="rounded-md border border-ink-700 px-2 py-0.5"
                    >
                      {e} {n}
                    </span>
                  );
                })}
              </div>
            </>
          ) : (
            <Empty label="Nothing reacted to yet." />
          )}
        </Card>

        <Card title="Fests at a glance">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-ink-400">Total hosted</span>
              <span className="text-ink-100 font-mono">{fests.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-400">Live now</span>
              <span className="text-ink-100 font-mono">{activeFest ? 1 : 0}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-400">Upcoming</span>
              <span className="text-ink-100 font-mono">{upcomingFests.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-400">Ended</span>
              <span className="text-ink-100 font-mono">{endedFests.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-400">Total participants</span>
              <span className="text-ink-100 font-mono">{totalFestParticipants}</span>
            </li>
          </ul>
          <Link
            href={`/clubs/${club.id}/fests`}
            className="mt-4 inline-block text-xs text-brand-300 hover:underline"
          >
            Open fests →
          </Link>
        </Card>

        <Card title="Sessions">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span className="text-ink-400">Total scheduled</span>
              <span className="text-ink-100 font-mono">{sessions.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-400">Upcoming</span>
              <span className="text-ink-100 font-mono">{upcomingSessions.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-400">Past</span>
              <span className="text-ink-100 font-mono">{endedSessions.length}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-ink-400">Avg RSVP</span>
              <span className="text-ink-100 font-mono">{avgRsvp}</span>
            </li>
          </ul>
          <Link
            href={`/clubs/${club.id}/sessions`}
            className="mt-4 inline-block text-xs text-brand-300 hover:underline"
          >
            Open sessions →
          </Link>
        </Card>
      </section>

      <section className="mt-8">
        <Card title="Member roster">
          <div className="mb-3 text-xs text-ink-500">
            +{newThisMonth} joined in the last 30 days
          </div>
          <ul className="divide-y divide-ink-900 rounded-lg border border-ink-800 bg-ink-950 text-sm">
            {club.members
              .slice()
              .sort((a, b) => b.joinedAt - a.joinedAt)
              .slice(0, 25)
              .map((m) => (
                <li
                  key={m.email}
                  className="flex items-center justify-between px-4 py-2"
                >
                  <span className="flex items-center gap-2 text-ink-100">
                    @{m.displayName}
                    {m.role === "owner" && (
                      <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
                        Owner
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-ink-500">
                    joined {new Date(m.joinedAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
          </ul>
          {club.members.length > 25 && (
            <p className="mt-2 text-xs text-ink-500">
              +{club.members.length - 25} more members
            </p>
          )}
        </Card>
      </section>

      <div className="mt-10">
        <Link
          href={`/clubs/${club.id}`}
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to club
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

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
      <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm text-ink-400">{label}</p>;
}

function relativeTime(ts: number): string {
  const delta = Math.max(0, Date.now() - ts);
  const m = Math.floor(delta / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
