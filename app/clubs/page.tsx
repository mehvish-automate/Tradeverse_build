"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  CATEGORIES,
  Club,
  INSTITUTES,
  InstituteCategory,
  createClub,
  getInstitute,
  listClubs,
  myClubs,
} from "@/lib/clubs";
import { useSession } from "@/lib/session";

export default function ClubsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <RequireAuth>
          <ClubsInner />
        </RequireAuth>
      </main>
    </>
  );
}

function ClubsInner() {
  const router = useRouter();
  const { user } = useSession();

  const [mine, setMine] = useState<Club[]>([]);
  const [all, setAll] = useState<Club[]>([]);
  const [category, setCategory] = useState<InstituteCategory | "all">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!user) return;
    setMine(myClubs(user.email));
    setAll(listClubs());
  }, [user]);

  const filteredInstitutes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INSTITUTES.filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (!q ||
          i.name.toLowerCase().includes(q) ||
          i.short.toLowerCase().includes(q) ||
          i.city.toLowerCase().includes(q)),
    );
  }, [category, query]);

  if (!user) return null;

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Institutes · Clubs
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Clubs</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-400">
            Your college / CA institute&apos;s finance or investment club
            lives here. Join the existing one, or start a new one under your
            institute.
          </p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
          Your clubs
        </h2>
        {mine.length === 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
            You haven&apos;t joined a club yet. Find your institute below to
            see existing clubs, or start one.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {mine.map((c) => (
              <li key={c.id}>
                <ClubRow club={c} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
          Find your institute
        </h2>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Search by name, short code, or city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input max-w-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...CATEGORIES] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c as InstituteCategory | "all")}
                className={
                  "rounded-md border px-3 py-1.5 text-xs transition " +
                  (category === c
                    ? "border-brand-500 bg-brand-500/10 text-brand-200"
                    : "border-ink-700 text-ink-300 hover:border-ink-500")
                }
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
        </div>

        {filteredInstitutes.length === 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
            No match. If your institute isn&apos;t listed, ping us on the
            waitlist and we&apos;ll seed it.
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {filteredInstitutes.map((inst) => {
              const clubs = all.filter((c) => c.instituteId === inst.id);
              return (
                <li
                  key={inst.id}
                  className="rounded-xl border border-ink-700 bg-ink-900/40 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-brand-300">
                        {inst.category}
                      </div>
                      <div className="mt-1 font-semibold text-ink-50">
                        {inst.short}
                      </div>
                      <div className="text-xs text-ink-500">
                        {inst.name} · {inst.city}
                      </div>
                    </div>
                    <div className="text-right text-xs text-ink-500">
                      {clubs.length} club
                      {clubs.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {clubs.length > 0 && (
                    <ul className="mt-3 space-y-1 text-sm">
                      {clubs.slice(0, 3).map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/clubs/${c.id}`}
                            className="flex items-center justify-between rounded-md border border-ink-800 bg-ink-950 px-3 py-2 text-ink-200 hover:border-ink-500"
                          >
                            <span>{c.name}</span>
                            <span className="text-xs text-ink-500">
                              {c.members.length} mem
                            </span>
                          </Link>
                        </li>
                      ))}
                      {clubs.length > 3 && (
                        <li className="text-xs text-ink-500">
                          +{clubs.length - 3} more
                        </li>
                      )}
                    </ul>
                  )}
                  <StartClubForm
                    instituteId={inst.id}
                    onCreated={(club) => {
                      setMine(myClubs(user.email));
                      setAll(listClubs());
                      router.push(`/clubs/${club.id}`);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
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

function ClubRow({ club }: { club: Club }) {
  const inst = getInstitute(club.instituteId);
  return (
    <Link
      href={`/clubs/${club.id}`}
      className="flex items-center justify-between rounded-xl border border-ink-700 bg-ink-900/40 px-5 py-4 hover:border-ink-500"
    >
      <div className="min-w-0">
        <div className="font-medium text-ink-50">{club.name}</div>
        <div className="text-xs text-ink-500">
          {inst?.short ?? "—"} · {club.members.length} member
          {club.members.length === 1 ? "" : "s"}
        </div>
      </div>
      <span className="text-sm text-ink-400">→</span>
    </Link>
  );
}

function StartClubForm({
  instituteId,
  onCreated,
}: {
  instituteId: string;
  onCreated: (c: Club) => void;
}) {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const r = createClub({
      name,
      instituteId,
      description: description || undefined,
      creator: { email: user!.email, displayName: user!.displayName },
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onCreated(r.club);
    setOpen(false);
    setName("");
    setDescription("");
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 text-xs text-brand-300 hover:underline"
      >
        + Start a club here
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Club name (e.g. Finance & Investment Club)"
        className="input"
        required
      />
      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="One-line description (optional)"
        className="input"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300"
        >
          Create
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-300 hover:bg-ink-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
