"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { getClub, getInstitute } from "@/lib/clubs";
import { Fest, festStatus } from "@/lib/fests";
import {
  MarketplaceEntry,
  toMarketplaceEntries,
} from "@/lib/officialTournaments";
import { useSession } from "@/lib/session";

type Group = "live" | "upcoming" | "ended";
type Filter = "all" | "official" | "community";

export default function MarketplacePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <RequireAuth>
          <MarketplaceInner />
        </RequireAuth>
      </main>
    </>
  );
}

function readUserFests(): Fest[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("tv.fests") || "[]") as Fest[];
  } catch {
    return [];
  }
}

function MarketplaceInner() {
  const { user } = useSession();
  const [userFests, setUserFests] = useState<Fest[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    // Read *all* fests, strip out officials (they'll be re-added by
    // toMarketplaceEntries) to avoid duplicates on devices that have
    // already cached an official fest via ensureOfficialInStore.
    const all = readUserFests();
    setUserFests(all.filter((f) => !f.id.startsWith("TV-")));
  }, [user]);

  const entries = useMemo<MarketplaceEntry[]>(
    () => toMarketplaceEntries(userFests),
    [userFests],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "official" && !e.official) return false;
      if (filter === "community" && e.official) return false;
      if (!q) return true;
      return (
        e.fest.name.toLowerCase().includes(q) ||
        e.fest.description?.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [entries, filter, query]);

  const groups: Record<Group, MarketplaceEntry[]> = {
    live: [],
    upcoming: [],
    ended: [],
  };
  for (const e of filtered) {
    groups[festStatus(e.fest)].push(e);
  }
  // Sort: live by soonest end, upcoming by soonest start, ended by most recent end.
  groups.live.sort(
    (a, b) => new Date(a.fest.endDate).getTime() - new Date(b.fest.endDate).getTime(),
  );
  groups.upcoming.sort(
    (a, b) => new Date(a.fest.startDate).getTime() - new Date(b.fest.startDate).getTime(),
  );
  groups.ended.sort(
    (a, b) => new Date(b.fest.endDate).getTime() - new Date(a.fest.endDate).getTime(),
  );

  if (!user) return null;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Marketplace
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Events</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-400">
            Every tournament running on TradeVerse — the official
            TradeVerse-hosted ones plus anything your clubs and others have
            scheduled. Join, race, flex.
          </p>
        </div>
      </div>

      <JoinByCodeCard code={code} setCode={setCode} />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search by name, category, or keyword"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input max-w-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {(["all", "official", "community"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={
                "rounded-md border px-3 py-1.5 text-xs transition capitalize " +
                (filter === f
                  ? "border-brand-500 bg-brand-500/10 text-brand-200"
                  : "border-ink-700 text-ink-300 hover:border-ink-500")
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <Section title="Live now" count={groups.live.length}>
        {groups.live.length === 0 ? (
          <Empty label="Nothing live right now. Check upcoming below." />
        ) : (
          <Grid entries={groups.live} />
        )}
      </Section>

      <Section title="Upcoming" count={groups.upcoming.length}>
        {groups.upcoming.length === 0 ? (
          <Empty label="No upcoming events match this filter." />
        ) : (
          <Grid entries={groups.upcoming} />
        )}
      </Section>

      <Section title="Ended" count={groups.ended.length}>
        {groups.ended.length === 0 ? (
          <Empty label="Nothing recently ended." />
        ) : (
          <Grid entries={groups.ended} />
        )}
      </Section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/clubs"
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Host your own →
        </Link>
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

function JoinByCodeCard({
  code,
  setCode,
}: {
  code: string;
  setCode: (v: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            Got a code?
          </div>
          <div className="mt-1 text-sm text-ink-200">
            Paste a 6-character invite or a TV-* official code.
          </div>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) {
              window.location.href = `/fests/${code.trim().toUpperCase()}`;
            }
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={16}
            placeholder="AB3K9P or TV-SUMMERCUP26"
            className="input font-mono tracking-[0.2em]"
          />
          <button
            type="submit"
            disabled={!code.trim()}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300 disabled:opacity-40"
          >
            Go
          </button>
        </form>
      </div>
    </section>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <header className="mb-3 flex items-end justify-between">
        <h2 className="text-xl font-semibold text-ink-50">{title}</h2>
        <span className="text-xs text-ink-500">
          {count} event{count === 1 ? "" : "s"}
        </span>
      </header>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-5 text-sm text-ink-400">
      {label}
    </div>
  );
}

function Grid({ entries }: { entries: MarketplaceEntry[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {entries.map((e) => (
        <li key={e.fest.id}>
          <EntryCard entry={e} />
        </li>
      ))}
    </ul>
  );
}

function EntryCard({ entry }: { entry: MarketplaceEntry }) {
  const { fest, official, category, sponsor } = entry;
  const status = festStatus(fest);
  const club = official || !fest.clubId ? null : getClub(fest.clubId);
  const inst = club ? getInstitute(club.instituteId) : null;

  return (
    <Link
      href={`/fests/${fest.id}`}
      className={
        "block rounded-2xl border p-5 transition " +
        (official
          ? "border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-transparent hover:border-violet-500"
          : status === "live"
            ? "border-brand-500/40 bg-brand-500/5 hover:border-brand-500"
            : "border-ink-700 bg-ink-900/40 hover:border-ink-500")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {official && (
              <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-violet-300">
                Official
              </span>
            )}
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
            <span className="text-ink-500">· {category}</span>
          </div>
          <h3 className="mt-1.5 text-lg font-semibold text-ink-50">
            {fest.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-ink-300">
            {fest.description?.split("\n")[0] ?? ""}
          </p>
          <div className="mt-2 text-xs text-ink-500">
            {fest.startDate} → {fest.endDate}
            {" · "}
            {official
              ? sponsor ?? "TradeVerse"
              : club
                ? `${club.name}${inst ? ` · ${inst.short}` : ""}`
                : "Community"}
          </div>
        </div>
        <span className="shrink-0 text-sm text-ink-400">→</span>
      </div>
    </Link>
  );
}
