"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  TradeFloor,
  TradeFloorStatus,
  getMyTradeFloors,
  joinTradeFloor,
} from "@/lib/tradeFloors";
import { useSession } from "@/lib/session";
import { joinTradeFloorCloud } from "@/lib/supabase/writes";

export default function TradeFloorsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <TradeFloorsInner />
        </RequireAuth>
      </main>
    </>
  );
}

function TradeFloorsInner() {
  const router = useRouter();
  const { user } = useSession();
  const [tradeFloors, setTradeFloors] = useState<TradeFloor[]>([]);

  useEffect(() => {
    if (user) setTradeFloors(getMyTradeFloors(user.email));
  }, [user]);

  if (!user) return null;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-semibold">Trade floors</h1>
        <p className="mt-1 text-sm text-ink-400">
          Real-time virtual trading competitions. Pick a window, virtual
          capital and stock universe — race friends on live P&amp;L. Public
          floors and private floors above 15 members go through admin
          approval.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link
          href="/trade-floors/new"
          className="group rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-6 transition hover:border-brand-500"
        >
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            Launch
          </div>
          <h3 className="mt-1 text-xl font-semibold">Launch a trading competition</h3>
          <p className="mt-2 text-sm text-ink-300">
            Pick a privacy mode, schedule, virtual capital and stock universe
            — private floors up to 15 members go live instantly.
          </p>
          <div className="mt-4 text-sm text-brand-300 group-hover:underline">
            Open launcher →
          </div>
        </Link>

        <JoinTradeFloorCard
          onJoined={(l) => {
            setTradeFloors(getMyTradeFloors(user.email));
            router.push(`/trade-floors/${l.id}`);
          }}
        />
      </div>

      <h2 className="mt-10 text-sm font-medium uppercase tracking-wider text-ink-400">
        Your trade floors
      </h2>
      {tradeFloors.length === 0 ? (
        <p className="mt-3 rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
          You&apos;re not in any trade floor yet. Launch one above, or paste an
          invite code a friend sent you.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
          {tradeFloors.map((l) => (
            <li key={l.id}>
              <Link
                href={`/trade-floors/${l.id}`}
                className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-ink-900/60"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-ink-50">
                      {l.name}
                    </span>
                    <StatusBadge status={l.status} />
                    <PrivacyBadge privacy={l.privacy} />
                  </div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    Code {l.id} · {l.members.length}/{l.memberCap} member
                    {l.members.length === 1 ? "" : "s"} ·{" "}
                    ₹{(l.virtualCapital / 100000).toFixed(0)}L paper ·{" "}
                    {l.marketRegion}
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

function StatusBadge({ status }: { status: TradeFloorStatus }) {
  const map: Record<
    TradeFloorStatus,
    { label: string; className: string }
  > = {
    pending_approval: {
      label: "Pending",
      className: "bg-amber-500/15 text-amber-300",
    },
    live: { label: "Live", className: "bg-brand-500/15 text-brand-300" },
    ended: { label: "Ended", className: "bg-ink-800 text-ink-400" },
    rejected: { label: "Rejected", className: "bg-red-500/15 text-red-300" },
  };
  const { label, className } = map[status];
  return (
    <span
      className={
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        className
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

function JoinTradeFloorCard({
  onJoined,
}: {
  onJoined: (l: TradeFloor) => void;
}) {
  const { user } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const r = joinTradeFloor({
      code,
      user: { email: user.email, displayName: user.displayName },
    });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    void joinTradeFloorCloud(r.tradeFloor.id);
    onJoined(r.tradeFloor);
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
        Join trade floor
      </button>
    </form>
  );
}
