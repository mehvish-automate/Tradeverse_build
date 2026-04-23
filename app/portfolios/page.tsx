"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  StrategyPortfolio,
  createPortfolio,
  listPortfolios,
  snapshot,
  totalAllocated,
} from "@/lib/portfolios";
import { useSession } from "@/lib/session";

export default function PortfoliosPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <RequireAuth>
          <PortfoliosInner />
        </RequireAuth>
      </main>
    </>
  );
}

function PortfoliosInner() {
  const router = useRouter();
  const { user } = useSession();
  const [portfolios, setPortfolios] = useState<StrategyPortfolio[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setPortfolios(listPortfolios(user.email));
  }, [user]);

  if (!user) return null;

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const r = createPortfolio(user.email, {
      name,
      description: description || undefined,
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push(`/portfolios/${r.portfolio.id}`);
  }

  return (
    <>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Portfolios
          </div>
          <h1 className="mt-1 text-3xl font-semibold">Virtual portfolios</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-400">
            Build a ₹1,00,000 paper allocation, see how it would&apos;ve done vs
            NIFTY. No real money changes hands — ever. Scored on skill, not
            capital.
          </p>
        </div>
        <Link
          href="/events"
          className="shrink-0 rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-2.5 text-sm text-ink-100 hover:border-ink-500"
        >
          Market Events →
        </Link>
      </div>

      <section className="mb-10 rounded-2xl border border-brand-500/40 bg-brand-500/5 p-6">
        <h2 className="text-lg font-semibold">Create a strategy portfolio</h2>
        <form onSubmit={onCreate} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-300">Name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My balanced basket"
              className="input"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink-300">Thesis (optional)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quality compounders + one cyclical bet"
              className="input"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300 md:w-auto"
            >
              Create
            </button>
          </div>
        </form>
        {error && (
          <p className="mt-3 text-sm text-red-300">{error}</p>
        )}
      </section>

      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
        Your portfolios
      </h2>
      {portfolios.length === 0 ? (
        <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
          You haven&apos;t built one yet. Start with the form above — add a
          few stocks with target allocations, watch it move against NIFTY.
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {portfolios.map((p) => (
            <li key={p.id}>
              <PortfolioRow portfolio={p} />
            </li>
          ))}
        </ul>
      )}

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

function PortfolioRow({ portfolio }: { portfolio: StrategyPortfolio }) {
  const snap = snapshot(portfolio);
  const allocated = totalAllocated(portfolio);
  const up = snap.portfolioReturnPct >= 0;
  const beatsNifty = snap.alphaPct >= 0;

  return (
    <Link
      href={`/portfolios/${portfolio.id}`}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-700 bg-ink-900/40 px-5 py-4 hover:border-ink-500"
    >
      <div className="min-w-0">
        <div className="font-medium text-ink-50">{portfolio.name}</div>
        <div className="text-xs text-ink-500">
          {portfolio.holdings.length} holding
          {portfolio.holdings.length === 1 ? "" : "s"} · {allocated.toFixed(0)}%
          allocated · based {portfolio.baseDate}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-6 text-sm">
        <div className="text-right">
          <div className={"font-semibold " + (up ? "text-brand-300" : "text-red-300")}>
            {up ? "+" : ""}
            {snap.portfolioReturnPct.toFixed(2)}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-ink-500">
            Return
          </div>
        </div>
        <div className="text-right">
          <div
            className={
              "font-semibold " + (beatsNifty ? "text-brand-300" : "text-ink-400")
            }
          >
            {snap.alphaPct >= 0 ? "+" : ""}
            {snap.alphaPct.toFixed(2)}%
          </div>
          <div className="text-[10px] uppercase tracking-wider text-ink-500">
            vs NIFTY
          </div>
        </div>
      </div>
    </Link>
  );
}
