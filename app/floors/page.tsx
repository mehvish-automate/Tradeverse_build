"use client";

import { HubCard } from "@/components/HubCard";
import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";

export default function FloorsPage() {
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
          Floors
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Where you compete</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Two competitive surfaces. Allocate sectors on a real market event and
          watch it resolve, or launch a multi-day Quiz Floor your club hosts and
          race friends on the leaderboard.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HubCard
          href="/events"
          accent="brand"
          eyebrow="Market events"
          title="Analysis Challenge"
          body="Budget week, IT earnings, festive auto. Pick a sector allocation, resolve, see your alpha."
        />
        <HubCard
          href="/quizzes"
          eyebrow="Quiz Floor"
          title="Launch or join a Quiz Floor"
          body="Multi-day quiz competitions. Use our question bank or upload custom Qs. Private up to 100 goes live instantly; public + larger go through admin review."
        />
      </div>
    </>
  );
}
