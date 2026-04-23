"use client";

import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { baseDate, getEvent, isResolved, resolveDate } from "@/lib/events";
import {
  claimEventReward,
  eventLeaderboard,
  myAllocation,
  scoreEvent,
  submitAllocation,
} from "@/lib/eventPortfolios";
import { useSession } from "@/lib/session";

export default function EventPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <EventInner />
        </RequireAuth>
      </main>
    </>
  );
}

function EventInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();
  const id = params?.id ? String(params.id) : "";
  const def = useMemo(() => getEvent(id), [id]);

  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [existing, setExisting] = useState<ReturnType<typeof myAllocation>>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!def || !user) return;
    const mine = myAllocation(user.email, def.id);
    setExisting(mine);
    if (mine) setAlloc(mine.allocation);
    else {
      const empty: Record<string, number> = { CASH: 100 };
      def.sectors.forEach((s) => {
        empty[s] = 0;
      });
      setAlloc(empty);
    }
  }, [def, user]);

  if (!def) notFound();
  if (!user) return null;

  const resolved = isResolved(def);
  const total = Object.values(alloc).reduce((s, n) => s + n, 0);
  const score = existing ? scoreEvent(existing, def) : null;
  const board = resolved ? eventLeaderboard(user.email, user.displayName, def) : [];
  const myRank = board.findIndex((r) => r.isYou) + 1;

  function setKey(k: string, v: number) {
    setAlloc((prev) => ({ ...prev, [k]: Math.max(0, Math.min(100, Math.round(v))) }));
    setError(null);
    setOk(null);
  }

  function resetCash() {
    const next: Record<string, number> = { CASH: 100 };
    def!.sectors.forEach((s) => {
      next[s] = 0;
    });
    setAlloc(next);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    const r = submitAllocation(user!.email, def!.id, alloc);
    if (!r.ok) {
      setError(r.error ?? "Something went wrong.");
      return;
    }
    setOk("Allocation submitted.");
    setExisting(myAllocation(user!.email, def!.id));
  }

  function onClaim() {
    const r = claimEventReward(user!.email, def!.id);
    if (!r.ok) {
      setError(r.error ?? "Claim failed.");
      return;
    }
    setClaimed(true);
    setOk(`+${r.xp} XP credited.`);
    setExisting(myAllocation(user!.email, def!.id));
  }

  return (
    <>
      <div className="mb-6">
        <Link href="/events" className="text-xs text-ink-400 hover:text-ink-100">
          ← Events
        </Link>
        <h1 className="mt-1 text-3xl font-semibold">{def.title}</h1>
        <p className="mt-1 text-sm text-ink-400">{def.tagline}</p>
        <div className="mt-1 text-xs text-ink-500">
          {resolved ? "Ended" : "Resolves"} {resolveDate(def).toISOString().slice(0, 10)} ·
          thesis framed {baseDate(def).toISOString().slice(0, 10)} · {def.rewardXp}+ XP
          reward
        </div>
      </div>

      <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-brand-300">
          Thesis
        </h2>
        {def.thesis.map((p, i) => (
          <p key={i} className="mt-3 text-ink-200">
            {p}
          </p>
        ))}
      </section>

      <form
        onSubmit={onSubmit}
        className={
          "mt-6 rounded-2xl border p-6 " +
          (resolved
            ? "border-ink-700 bg-ink-900/40 opacity-90"
            : "border-brand-500/40 bg-brand-500/5")
        }
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Your allocation</h2>
          <div className="text-xs text-ink-500">
            Total <span className="font-mono text-ink-100">{total.toFixed(0)}%</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          {["CASH", ...def.sectors].map((key) => (
            <AllocRow
              key={key}
              label={key === "CASH" ? "Cash" : key}
              value={alloc[key] ?? 0}
              onChange={(v) => setKey(key, v)}
              disabled={resolved}
              tone={key === "CASH" ? "neutral" : "brand"}
            />
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        {ok && <p className="mt-3 text-sm text-brand-300">{ok}</p>}

        {!resolved && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              {existing ? "Update allocation" : "Submit allocation"}
            </button>
            <button
              type="button"
              onClick={resetCash}
              className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
            >
              Reset to 100% cash
            </button>
            <span className="text-xs text-ink-500">
              You can revise as many times as you want until resolution.
            </span>
          </div>
        )}
      </form>

      {resolved && score && (
        <section className="mt-6 rounded-2xl border border-brand-500/40 bg-brand-500/5 p-6">
          <h2 className="text-lg font-semibold">Resolution</h2>
          <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
            <Stat
              label="Your return"
              value={`${score.portfolioReturnPct >= 0 ? "+" : ""}${score.portfolioReturnPct.toFixed(2)}%`}
              tone={score.portfolioReturnPct >= 0 ? "good" : "bad"}
            />
            <Stat
              label="NIFTY"
              value={`${score.niftyReturnPct.toFixed(2)}%`}
            />
            <Stat
              label="Alpha"
              value={`${score.alphaPct >= 0 ? "+" : ""}${score.alphaPct.toFixed(2)}%`}
              tone={score.alphaPct >= 0 ? "good" : "bad"}
            />
          </div>
          <div className="mt-5">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-500">
              Sector moves
            </h3>
            <ul className="divide-y divide-ink-900 rounded-lg border border-ink-700 bg-ink-950">
              {score.perSector.map((s) => (
                <li
                  key={s.key}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="text-ink-100">
                    {s.key === "CASH" ? "Cash" : s.key}{" "}
                    <span className="ml-2 text-xs text-ink-500">{s.pct}%</span>
                  </span>
                  <span
                    className={
                      s.retPct >= 0 ? "text-brand-300 font-mono" : "text-red-300 font-mono"
                    }
                  >
                    {s.retPct >= 0 ? "+" : ""}
                    {s.retPct.toFixed(2)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {!existing?.claimed && !claimed && (
            <button
              onClick={onClaim}
              className="mt-5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              Claim reward
            </button>
          )}
          {(existing?.claimed || claimed) && (
            <p className="mt-5 text-sm text-ink-400">Reward already claimed ✓</p>
          )}
        </section>
      )}

      {resolved && board.length > 0 && (
        <section className="mt-6 overflow-hidden rounded-2xl border border-ink-700">
          <header className="flex items-center justify-between border-b border-ink-700/70 bg-ink-900/60 px-5 py-3 text-xs text-ink-400">
            <span>Leaderboard</span>
            <span>You&apos;re {myRank > 0 ? `#${myRank}` : "not ranked"}</span>
          </header>
          <ol className="divide-y divide-ink-900">
            {board.map((r, i) => (
              <li
                key={r.handle}
                className={
                  "flex items-center justify-between px-5 py-2.5 text-sm " +
                  (r.isYou ? "bg-brand-500/5" : "")
                }
              >
                <span className="flex items-center gap-3">
                  <span
                    className={
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
                      (i === 0 ? "bg-brand-500 text-ink-950" : "bg-ink-900 text-ink-400")
                    }
                  >
                    {i + 1}
                  </span>
                  <span className={r.isYou ? "text-ink-50 font-medium" : "text-ink-200"}>
                    {r.handle}
                    {r.isYou && (
                      <span className="ml-2 text-xs text-brand-300">you</span>
                    )}
                  </span>
                </span>
                <span
                  className={
                    "font-mono " +
                    (r.returnPct >= 0 ? "text-brand-300" : "text-red-300")
                  }
                >
                  {r.returnPct >= 0 ? "+" : ""}
                  {r.returnPct.toFixed(2)}%
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}

function AllocRow({
  label,
  value,
  onChange,
  disabled,
  tone,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  tone: "brand" | "neutral";
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-ink-700 bg-ink-950 px-4 py-3">
      <span className="w-24 shrink-0 text-sm font-medium text-ink-100">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="flex-1 accent-emerald-500"
      />
      <input
        type="number"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-16 rounded-md border border-ink-700 bg-ink-900 px-2 py-1 text-right text-sm text-ink-100 focus:border-brand-500 focus:outline-none"
      />
      <span className={"w-4 shrink-0 text-xs " + (tone === "brand" ? "text-brand-300" : "text-ink-500")}>
        %
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950 p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div
        className={
          "mt-1 text-xl font-semibold " +
          (tone === "good" ? "text-brand-300" : tone === "bad" ? "text-red-300" : "text-ink-100")
        }
      >
        {value}
      </div>
    </div>
  );
}
