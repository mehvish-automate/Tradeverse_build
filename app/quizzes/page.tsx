"use client";

// Quizzes browse + join. Quizzes are fests with eventType='quiz' (the
// underlying entity is shared; the surface is just filtered + framed
// for quizzes). Launch CTA → /quizzes/new. Join-by-code mirrors the
// trade-floor pattern.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Fest, joinFest, myFests } from "@/lib/fests";
import { useSession } from "@/lib/session";

export default function QuizzesPage() {
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

function isQuiz(f: Fest): boolean {
  return f.eventType === "quiz";
}

function Inner() {
  const router = useRouter();
  const { user } = useSession();
  const [mine, setMine] = useState<Fest[]>([]);

  useEffect(() => {
    if (user) setMine(myFests(user.email).filter(isQuiz));
  }, [user]);

  if (!user) return null;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Quizzes</h1>
        <p className="mt-1 text-sm text-ink-400">
          Multi-day quiz events on markets, finance, technicals. Private
          quizzes up to 100 participants go live instantly. Public — and
          private above 100 — go through admin review.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/quizzes/new"
          className="group rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-6 transition hover:border-brand-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            Launch
          </div>
          <h3 className="mt-1 text-xl font-semibold">Launch a quiz</h3>
          <p className="mt-2 text-sm text-ink-300">
            Pick a window, capacity and topic. Use our question bank or
            upload your own — at least one custom Q is required.
          </p>
          <div className="mt-4 text-sm text-brand-300 group-hover:underline">
            Open launcher →
          </div>
        </Link>

        <JoinByCode
          onJoined={(f) => {
            setMine(myFests(user.email).filter(isQuiz));
            router.push(`/fests/${f.id}`);
          }}
        />
      </div>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wider text-ink-400">
        Your quizzes
      </h2>
      {mine.length === 0 ? (
        <p className="mt-3 rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
          You haven&apos;t hosted or joined a quiz yet. Launch one above, or
          paste an invite code a friend sent.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
          {mine.map((f) => (
            <li key={f.id}>
              <Link
                href={`/fests/${f.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-ink-900/60"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-ink-50">
                      {f.name}
                    </span>
                    <StatusChip status={f.lifecycleStatus ?? "live"} />
                    <PrivacyBadge privacy={f.privacy ?? "private"} />
                    {(f.categories ?? []).slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-brand-300"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    Code {f.id} · {f.participants.length}/
                    {f.memberCap ?? 50} participants · {f.startDate} →{" "}
                    {f.endDate}
                  </div>
                </div>
                <span className="shrink-0 text-ink-400">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function StatusChip({
  status,
}: {
  status: NonNullable<Fest["lifecycleStatus"]>;
}) {
  const map = {
    pending_approval: {
      label: "Pending",
      cls: "bg-amber-500/15 text-amber-300",
    },
    live: { label: "Live", cls: "bg-brand-500/15 text-brand-300" },
    ended: { label: "Ended", cls: "bg-ink-800 text-ink-400" },
    rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span
      className={
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {label}
    </span>
  );
}

function PrivacyBadge({ privacy }: { privacy: "public" | "private" }) {
  return (
    <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
      {privacy}
    </span>
  );
}

function JoinByCode({ onJoined }: { onJoined: (f: Fest) => void }) {
  const { user } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const r = joinFest(code, {
      email: user.email,
      displayName: user.displayName,
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onJoined(r.fest);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-ink-700 bg-ink-900/40 p-6"
    >
      <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
        Join
      </div>
      <h3 className="mt-1 text-xl font-semibold">Have an invite code?</h3>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium text-ink-300">
          6-character code
        </span>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="AB3K9P"
          className="input font-mono tracking-[0.3em]"
          required
        />
      </label>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <button type="submit" className="mt-4 w-full btn-ghost">
        Join quiz
      </button>
    </form>
  );
}
