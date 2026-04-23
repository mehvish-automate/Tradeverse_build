"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  Club,
  getClub,
  getInstitute,
  joinClub,
  leaveClub,
} from "@/lib/clubs";
import { useSession } from "@/lib/session";

export default function ClubPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <ClubInner />
        </RequireAuth>
      </main>
    </>
  );
}

function ClubInner() {
  const router = useRouter();
  const { user } = useSession();
  const params = useParams<{ id: string }>();
  const id = params?.id ? String(params.id) : "";

  const [club, setClub] = useState<Club | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    setClub(getClub(id));
  }, [id]);

  if (!user || club === undefined) return null;
  if (club === null) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Club not found</h1>
        <p className="mt-2 text-sm text-ink-400">
          It may have been deleted or never existed on this device.
        </p>
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
  const amMember = club.members.some((m) => m.email === user.email);
  const isOwner = club.members.some(
    (m) => m.email === user.email && m.role === "owner",
  );

  function onJoin() {
    const r = joinClub(club!.id, { email: user!.email, displayName: user!.displayName });
    if (r.ok) setClub(r.club);
  }

  function onLeave() {
    if (!confirm("Leave this club?")) return;
    leaveClub(club!.id, user!.email);
    setClub(getClub(club!.id));
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/clubs" className="text-xs text-ink-400 hover:text-ink-100">
            ← Clubs
          </Link>
          <h1 className="mt-1 text-3xl font-semibold">{club.name}</h1>
          <div className="mt-1 text-xs text-ink-500">
            {inst ? `${inst.short} · ${inst.name}` : "Unknown institute"} ·{" "}
            {club.members.length} member
            {club.members.length === 1 ? "" : "s"}
          </div>
          {club.description && (
            <p className="mt-2 max-w-xl text-sm text-ink-300">
              {club.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {amMember ? (
            <button
              onClick={onLeave}
              disabled={isOwner}
              className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-900 disabled:opacity-40"
              title={isOwner ? "Owners can't leave" : "Leave this club"}
            >
              Leave
            </button>
          ) : (
            <button
              onClick={onJoin}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              Join club
            </button>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
          Members
        </h2>
        <ul className="mt-3 divide-y divide-ink-900 rounded-lg border border-ink-800 bg-ink-950">
          {club.members.slice(0, 20).map((m) => (
            <li
              key={m.email}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
              <span className="flex items-center gap-2 text-ink-100">
                @{m.displayName}
                {m.role === "owner" && (
                  <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
                    Owner
                  </span>
                )}
                {m.email === user.email && (
                  <span className="text-xs text-ink-500">you</span>
                )}
              </span>
              <span className="text-xs text-ink-500">
                {new Date(m.joinedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
          {club.members.length > 20 && (
            <li className="px-4 py-2 text-xs text-ink-500">
              +{club.members.length - 20} more members
            </li>
          )}
        </ul>
      </section>

      <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Link
          href={`/clubs/${club.id}/floor`}
          className="group rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5 hover:border-brand-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            Floor
          </div>
          <div className="mt-1 text-lg font-semibold">Trading floor</div>
          <p className="mt-2 text-sm text-ink-300">
            Club chatter — chart reads, portfolio takes, reactions.
          </p>
          <div className="mt-3 text-sm text-brand-300 group-hover:underline">
            Open →
          </div>
        </Link>

        <Link
          href={`/clubs/${club.id}/fests`}
          className="group rounded-2xl border border-ink-700 bg-ink-900/40 p-5 hover:border-ink-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Fests
          </div>
          <div className="mt-1 text-lg font-semibold">Tournaments</div>
          <p className="mt-2 text-sm text-ink-300">
            Multi-day club tournaments with their own leaderboard.
          </p>
          <div className="mt-3 text-sm text-ink-300 group-hover:text-ink-50">
            Open →
          </div>
        </Link>

        <Link
          href="/trade-floors"
          className="group rounded-2xl border border-ink-700 bg-ink-900/40 p-5 hover:border-ink-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Trade floors
          </div>
          <div className="mt-1 text-lg font-semibold">Friend groups</div>
          <p className="mt-2 text-sm text-ink-300">
            Smaller 3–20 friend groups for weekly competition.
          </p>
          <div className="mt-3 text-sm text-ink-300 group-hover:text-ink-50">
            Open →
          </div>
        </Link>
      </div>

      {isOwner && (
        <p className="mt-6 text-xs text-ink-500">
          You&apos;re the owner — use the Fests link above to create a
          tournament. Members join via the fest invite code.
        </p>
      )}

      <div className="mt-6">
        <Link
          href="/clubs"
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          All clubs
        </Link>
      </div>
    </>
  );
}
