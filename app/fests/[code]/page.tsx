"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { getClub, getInstitute } from "@/lib/clubs";
import {
  Fest,
  festLeaderboard,
  festStatus,
  festWhatsappInvite,
  getFest,
  joinFest,
} from "@/lib/fests";
import {
  ensureOfficialInStore,
  getOfficialTournament,
  isOfficial,
} from "@/lib/officialTournaments";
import { useSession } from "@/lib/session";

export default function FestPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <FestInner />
        </RequireAuth>
      </main>
    </>
  );
}

function FestInner() {
  const { user } = useSession();
  const params = useParams<{ code: string }>();
  const code = params?.code ? String(params.code).toUpperCase() : "";

  const [fest, setFest] = useState<Fest | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code || !user) return;
    let f = getFest(code);
    if (!f && isOfficial(code)) {
      ensureOfficialInStore(code);
      f = getFest(code);
    }
    if (!f) {
      setFest(null);
      return;
    }
    if (!f.participants.some((p) => p.email === user.email)) {
      const r = joinFest(f.id, { email: user.email, displayName: user.displayName });
      if (r.ok) setFest(r.fest);
      else setFest(f);
    } else {
      setFest(f);
    }
  }, [code, user]);

  if (!user || fest === undefined) return null;
  if (fest === null) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Fest not found</h1>
        <p className="mt-2 text-sm text-ink-400">
          That invite code doesn&apos;t match any fest on this device. Ask
          the host to resend the code.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to profile
        </Link>
      </div>
    );
  }

  const official = getOfficialTournament(fest.id);
  const club = official ? null : getClub(fest.clubId);
  const inst = club ? getInstitute(club.instituteId) : null;
  const status = festStatus(fest);
  const rows = festLeaderboard(fest, user.email);
  const myRank = rows.findIndex((r) => r.email === user.email) + 1;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(fest!.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={
                "rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider " +
                (status === "live"
                  ? "bg-brand-500/20 text-brand-300"
                  : status === "upcoming"
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-ink-800 text-ink-400")
              }
            >
              {status}
            </span>
            {official && (
              <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-violet-300">
                Official
              </span>
            )}
            {fest.eventType && (
              <span className="rounded-md bg-ink-900 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-ink-300">
                {fest.eventType}
              </span>
            )}
            {fest.difficulty && (
              <span className="rounded-md bg-ink-900 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-ink-300">
                {fest.difficulty}
              </span>
            )}
            {fest.source === "custom" && (
              <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-amber-300">
                custom Qs
              </span>
            )}
            <span className="text-ink-500">
              {fest.startDate} → {fest.endDate}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold">{fest.name}</h1>
          {fest.description && (
            <p className="mt-1 max-w-xl text-sm text-ink-300">
              {fest.description}
            </p>
          )}
          <div className="mt-2 text-xs text-ink-500">
            {official ? (
              <>Hosted by <span className="text-violet-300">TradeVerse Official</span></>
            ) : (
              <>
                Hosted by{" "}
                {club ? (
                  <Link href={`/clubs/${club.id}`} className="hover:text-ink-100">
                    {club.name}
                  </Link>
                ) : (
                  "Unknown club"
                )}
                {inst && ` · ${inst.short}`}
              </>
            )}
          </div>
          <div className="mt-2 text-xs text-ink-500">
            Code:{" "}
            <button
              onClick={copyCode}
              className="rounded-md border border-ink-700 bg-ink-900 px-1.5 py-0.5 font-mono tracking-widest text-ink-100 hover:bg-ink-900/60"
              title="Click to copy"
            >
              {fest.id}
            </button>
            {copied && <span className="ml-2 text-brand-300">copied</span>}
          </div>
        </div>
        <a
          href={festWhatsappInvite(fest)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Invite via WhatsApp
        </a>
      </div>

      <section className="rounded-2xl border border-ink-700 bg-ink-900/40">
        <header className="flex items-center justify-between border-b border-ink-700/70 px-5 py-3 text-xs text-ink-400">
          <span>Leaderboard · {fest.participants.length} players</span>
          <span>You&apos;re #{myRank || "-"}</span>
        </header>
        <ol className="divide-y divide-ink-900">
          {rows.map((r, i) => {
            const you = r.email === user.email;
            return (
              <li
                key={r.email}
                className={
                  "flex items-center justify-between px-5 py-3 text-sm " +
                  (you ? "bg-brand-500/5" : "")
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
                  <span className={you ? "font-medium text-ink-50" : "text-ink-200"}>
                    {r.handle}
                    {you && <span className="ml-2 text-xs text-brand-300">you</span>}
                  </span>
                </span>
                <span className="flex items-center gap-5 text-xs text-ink-400">
                  <span>{r.plays} plays</span>
                  <span className="font-mono text-ink-50">
                    {r.xp.toLocaleString()} XP
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/play"
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Play today to earn XP →
        </Link>
        {club && (
          <Link
            href={`/clubs/${club.id}`}
            className="rounded-lg border border-ink-700 px-5 py-2.5 text-sm text-ink-100 hover:bg-ink-900"
          >
            Club
          </Link>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-500">
        V1 note: peer scores are deterministic demo data based on their
        handles until the backend lands — your own row uses your real
        window-to-date XP.
      </p>
    </>
  );
}
