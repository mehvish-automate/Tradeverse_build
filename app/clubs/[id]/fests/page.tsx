"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Club, getClub, getInstitute } from "@/lib/clubs";
import { Fest, createFest, festStatus, festsForClub } from "@/lib/fests";
import { useSession } from "@/lib/session";

export default function ClubFestsPage() {
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
  const router = useRouter();
  const { user } = useSession();
  const params = useParams<{ id: string }>();
  const clubId = params?.id ? String(params.id) : "";

  const [club, setClub] = useState<Club | null | undefined>(undefined);
  const [fests, setFests] = useState<Fest[]>([]);

  useEffect(() => {
    if (!clubId) return;
    setClub(getClub(clubId));
    setFests(festsForClub(clubId));
  }, [clubId]);

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
  const isOwner = club.members.some(
    (m) => m.email === user.email && m.role === "owner",
  );

  return (
    <>
      <div className="mb-6">
        <Link href={`/clubs/${club.id}`} className="text-xs text-ink-400 hover:text-ink-100">
          ← {club.name}
        </Link>
        <h1 className="mt-1 text-3xl font-semibold">Fests</h1>
        <p className="mt-1 text-xs text-ink-500">
          {inst?.short ?? "—"} · Multi-day tournaments. Free to host, free to
          join. Scored on XP accrued during the fest window.
        </p>
      </div>

      {isOwner && (
        <CreateFestCard
          clubId={club.id}
          onCreated={(fest) => router.push(`/fests/${fest.id}`)}
        />
      )}

      <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
        All fests at {club.name}
      </h2>
      {fests.length === 0 ? (
        <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
          No fests yet.{" "}
          {isOwner
            ? "Use the form above to create one."
            : "Check back when your club owner schedules one."}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {fests.map((f) => (
            <li key={f.id}>
              <FestRow fest={f} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FestRow({ fest }: { fest: Fest }) {
  const status = festStatus(fest);
  const tone =
    status === "live"
      ? "border-brand-500/50 bg-brand-500/5 text-brand-300"
      : status === "upcoming"
        ? "border-amber-500/40 bg-amber-500/5 text-amber-300"
        : "border-ink-700 bg-ink-900/40 text-ink-400";
  return (
    <Link
      href={`/fests/${fest.id}`}
      className={"flex items-center justify-between rounded-xl border px-5 py-4 hover:border-ink-500 " + tone.replace(/text-[^\s]+/, "")}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs">
          <span
            className={
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
              (status === "live"
                ? "bg-brand-500/20 text-brand-300"
                : status === "upcoming"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-ink-800 text-ink-400")
            }
          >
            {status}
          </span>
          <span className="font-mono text-ink-400">{fest.id}</span>
        </div>
        <div className="mt-1 font-medium text-ink-50">{fest.name}</div>
        <div className="text-xs text-ink-500">
          {fest.startDate} → {fest.endDate} · {fest.participants.length} player
          {fest.participants.length === 1 ? "" : "s"}
        </div>
      </div>
      <span className="text-sm text-ink-400">→</span>
    </Link>
  );
}

function CreateFestCard({
  clubId,
  onCreated,
}: {
  clubId: string;
  onCreated: (fest: Fest) => void;
}) {
  const { user } = useSession();

  const today = new Date().toISOString().slice(0, 10);
  const inWeek = new Date();
  inWeek.setDate(inWeek.getDate() + 7);
  const weekStr = inWeek.toISOString().slice(0, 10);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(weekStr);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!user) return;
    const r = createFest({
      clubId,
      name,
      description: description || undefined,
      startDate,
      endDate,
      creator: { email: user.email, displayName: user.displayName },
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onCreated(r.fest);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-6"
    >
      <h2 className="text-lg font-semibold">Host a new fest</h2>
      <p className="mt-1 text-xs text-ink-500">
        You&apos;re the owner — pick a window, share the invite code.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="md:col-span-2 block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Fest name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Finverse Fest 2026"
            className="input"
            required
          />
        </label>
        <label className="md:col-span-2 block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Pitch (optional)
          </span>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="7-day TradeVerse tournament across finance clubs"
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            Start date
          </span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-300">
            End date
          </span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input"
            required
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-5">
        <button
          type="submit"
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Create fest
        </button>
      </div>
    </form>
  );
}
