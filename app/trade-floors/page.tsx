"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  TradeFloor,
  createTradeFloor,
  getMyTradeFloors,
  joinTradeFloor,
} from "@/lib/tradeFloors";
import { useSession } from "@/lib/session";

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
        <h1 className="text-3xl font-semibold">Trade Floors</h1>
        <p className="mt-1 text-sm text-ink-400">
          Race your friends on the same daily questions. 3–20 per trade floor.
          Weekly cycle. Zero money.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CreateTradeFloorCard
          onCreated={(l) => {
            setTradeFloors(getMyTradeFloors(user.email));
            router.push(`/trade-floors/${l.id}`);
          }}
        />
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
          You&apos;re not in any trade floor yet. Create one above, or paste an
          invite code a friend sent you.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
          {tradeFloors.map((l) => (
            <li key={l.id}>
              <Link
                href={`/trade-floors/${l.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-ink-900/60"
              >
                <div>
                  <div className="font-medium text-ink-50">{l.name}</div>
                  <div className="text-xs text-ink-500">
                    Code {l.id} · {l.members.length} member
                    {l.members.length === 1 ? "" : "s"}
                  </div>
                </div>
                <span className="text-ink-400">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function CreateTradeFloorCard({ onCreated }: { onCreated: (l: TradeFloor) => void }) {
  const { user } = useSession();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    const r = createTradeFloor({ name, creator: { email: user.email, displayName: user.displayName } });
    if (!r.ok) {
      setError(r.error);
      return;
    }
    onCreated(r.tradeFloor);
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-6">
      <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
        Create
      </div>
      <h3 className="mt-1 text-xl font-semibold">Start a new trade floor</h3>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-xs font-medium text-ink-300">
          Trade Floor name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="IIM-B Finance Club"
          className="input"
          required
        />
      </label>
      {error && (
        <p className="mt-2 text-sm text-red-300">{error}</p>
      )}
      <button
        type="submit"
        className="mt-4 w-full rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300"
      >
        Create trade floor
      </button>
    </form>
  );
}

function JoinTradeFloorCard({ onJoined }: { onJoined: (l: TradeFloor) => void }) {
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
      <button
        type="submit"
        className="mt-4 w-full rounded-lg border border-ink-600 px-5 py-2.5 text-sm font-medium text-ink-100 hover:bg-ink-900"
      >
        Join trade floor
      </button>
    </form>
  );
}
