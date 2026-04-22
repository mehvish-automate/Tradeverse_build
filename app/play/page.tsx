"use client";

import { ChallengeRunner } from "@/components/ChallengeRunner";
import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";

export default function PlayPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <PlayInner />
        </RequireAuth>
      </main>
    </>
  );
}

function PlayInner() {
  const { user } = useSession();
  if (!user) return null;
  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Daily Chart Challenge</h1>
        <p className="mt-1 text-sm text-ink-400">
          5 questions from yesterday&apos;s tape. Scored on accuracy + speed.
        </p>
      </div>
      <ChallengeRunner user={user} />
    </>
  );
}
