"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  CAPITAL_PRESETS,
  StrategyPortfolio,
  UniverseFilter,
  allowedUniverse,
  createPortfolio,
  listPortfolios,
  snapshot,
  totalAllocated,
} from "@/lib/portfolios";
import { ASSET_CLASSES, AssetClass, SECTORS, Sector } from "@/lib/stocks";
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
  const [capital, setCapital] = useState<number>(100_000);
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>([
    "stock",
    "etf",
    "index",
  ]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [nifty50Only, setNifty50Only] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) setPortfolios(listPortfolios(user.email));
  }, [user]);

  if (!user) return null;

  const filter: UniverseFilter = {
    assetClasses: assetClasses.length === 3 ? undefined : assetClasses,
    sectors: sectors.length === 0 ? undefined : sectors,
    nifty50Only: nifty50Only || undefined,
  };
  const allowedCount = allowedUniverse(filter).length;

  function toggleAC(a: AssetClass) {
    setAssetClasses((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );
  }
  function toggleSector(s: Sector) {
    setSectors((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const r = createPortfolio(user.email, {
      name,
      description: description || undefined,
      initialCapital: capital,
      universe: filter,
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
        <form onSubmit={onCreate} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          </div>

          <div className="rounded-lg border border-ink-700 bg-ink-950 p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-ink-400">
              Virtual capital
            </h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {CAPITAL_PRESETS.map((c) => (
                <button
                  key={c.amount}
                  type="button"
                  onClick={() => setCapital(c.amount)}
                  className={
                    "rounded-md border px-3 py-1.5 text-xs transition " +
                    (capital === c.amount
                      ? "border-brand-500 bg-brand-500/10 text-brand-200"
                      : "border-ink-700 text-ink-300 hover:border-ink-500")
                  }
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink-700 bg-ink-950 p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-ink-400">
              Asset class
            </h3>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ASSET_CLASSES.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => toggleAC(a)}
                  className={
                    "rounded-md border px-3 py-1.5 text-xs transition capitalize " +
                    (assetClasses.includes(a)
                      ? "border-brand-500 bg-brand-500/10 text-brand-200"
                      : "border-ink-700 text-ink-400 hover:border-ink-500")
                  }
                >
                  {a === "etf" ? "ETFs" : a === "index" ? "Indices" : "Stocks"}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink-700 bg-ink-950 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-ink-400">
                Industry filter
              </h3>
              <label className="flex items-center gap-2 text-xs text-ink-300">
                <input
                  type="checkbox"
                  checked={nifty50Only}
                  onChange={(e) => setNifty50Only(e.target.checked)}
                  className="h-4 w-4 accent-emerald-500"
                />
                Nifty 50 only
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SECTORS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSector(s)}
                  className={
                    "rounded-md border px-2.5 py-1 text-xs transition " +
                    (sectors.includes(s)
                      ? "border-brand-500 bg-brand-500/10 text-brand-200"
                      : "border-ink-700 text-ink-400 hover:border-ink-500")
                  }
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-ink-500">
              {sectors.length === 0
                ? "No filter — every sector allowed."
                : `${sectors.length} sector${sectors.length === 1 ? "" : "s"} selected.`}
              {" · "}
              {allowedCount} symbol{allowedCount === 1 ? "" : "s"} in current universe
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-500">
              ₹{capital.toLocaleString("en-IN")} paper capital · {allowedCount}{" "}
              symbols available
            </span>
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              Create portfolio
            </button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
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
