"use client";

import { HubCard } from "@/components/HubCard";
import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";

export default function SocialPage() {
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
  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Social
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Find your people</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Your institute&apos;s finance club lives here. Post a chart read,
          host a live walkthrough, or browse every tournament running across
          TradeVerse right now.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HubCard
          href="/clubs"
          accent="brand"
          eyebrow="Community"
          title="Clubs"
          body="Find your college or CA institute's finance club. Post on the floor, host a live session, run a fest."
        />
        <HubCard
          href="/marketplace"
          eyebrow="Discover"
          title="Events marketplace"
          body="Every tournament running — official TradeVerse cups plus community-hosted fests. Browse, join by code."
        />
      </div>
    </>
  );
}
