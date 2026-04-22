"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { ageFromDob, useSession } from "@/lib/session";

export default function ProfilePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <RequireAuth>
          <ProfileInner />
        </RequireAuth>
      </main>
    </>
  );
}

function ProfileInner() {
  const router = useRouter();
  const { user, signOut } = useSession();
  if (!user) return null;

  const age = ageFromDob(user.dob);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">@{user.displayName}</h1>
          <p className="mt-1 text-sm text-ink-400">
            {user.email} · {age} yrs · joined{" "}
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button
          onClick={() => {
            signOut();
            router.push("/");
          }}
          className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-900"
        >
          Sign out
        </button>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Stat label="Current streak" value="0" hint="Play today to start one" />
        <Stat label="XP" value="0" hint="Earn by answering correctly + fast" />
        <Stat label="Leagues" value="0" hint="Create or join one in Phase 4" />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/play"
          className="group rounded-2xl border border-brand-500/40 bg-brand-500/5 p-6 hover:bg-brand-500/10"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            H1 · Daily
          </div>
          <div className="mt-1 text-2xl font-semibold">Play today&apos;s chart challenge</div>
          <p className="mt-2 text-sm text-ink-300">
            5 questions. ~5 minutes. Patterns, levels, and fundamentals from
            yesterday&apos;s tape.
          </p>
          <div className="mt-4 text-sm text-brand-300 group-hover:underline">
            Start →
          </div>
        </Link>

        <Link
          href="/leagues"
          className="group rounded-2xl border border-ink-700 bg-ink-900/40 p-6 hover:border-ink-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            H2 · Social
          </div>
          <div className="mt-1 text-2xl font-semibold">Friend leagues</div>
          <p className="mt-2 text-sm text-ink-300">
            Create one or join via invite code. 3–20 friends, weekly cycle,
            zero money.
          </p>
          <div className="mt-4 text-sm text-ink-300 group-hover:text-ink-50">
            Open →
          </div>
        </Link>
      </div>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-ink-500">{hint}</div>
    </div>
  );
}
