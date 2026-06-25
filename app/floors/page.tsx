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
          Three competitive surfaces. Allocate sectors on a real market event
          and watch it resolve, jump into a quiz a student club is hosting,
          or run a real-time virtual trading competition with friends on the
          trade floor.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HubCard
          href="/events"
          accent="brand"
          eyebrow="Market events"
          title="Analysis Challenge"
          body="Budget week, IT earnings, festive auto. Pick a sector allocation, resolve, see your alpha."
        />
        <HubCard
          href="/quizzes"
          eyebrow="Quizzes"
          title="Launch or join a quiz"
          body="Multi-day quiz events. Use our question bank or upload custom Qs. Private up to 100 goes live instantly; public + larger go through admin review."
        />
        <HubCard
          href="/trade-floors"
          eyebrow="Virtual trading"
          title="Trade floors"
          body="Real-time virtual trading competitions. Pick a window, capital and stock universe — race friends on live P&L."
        />
      </div>
    </>
  );
}
