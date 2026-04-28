"use client";

import { HubCard } from "@/components/HubCard";
import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";

export default function StrategyBuilderPage() {
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
          Strategy Builder
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Build, hold, watch</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-400">
          Three places to practice running money on paper. Pick a ticker and
          place an order, build a long-term allocation against NIFTY, or just
          follow what you care about. Zero real money — every rupee here is
          paper.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <HubCard
          href="/trade"
          accent="brand"
          eyebrow="Paper trading"
          title="Trade ticket & L2 book"
          body="Market, limit, stop, stop-limit. Slippage, latency, partial fills. Starts with ₹10L paper cash."
        />
        <HubCard
          href="/portfolios"
          eyebrow="Allocation"
          title="Virtual portfolios"
          body="Build a paper ₹1L allocation. See it move against NIFTY across the week."
        />
        <HubCard
          href="/watchlist"
          eyebrow="Track"
          title="Watchlist"
          body="Pick names to follow. RSI alerts land in your inbox when they cross 70 or 30."
        />
      </div>
    </>
  );
}
