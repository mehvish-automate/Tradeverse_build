"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import {
  TradeFloor,
  currentWeekStart,
  getTradeFloor,
  joinTradeFloor,
  weeklyLeaderboard,
  whatsappInviteUrl,
} from "@/lib/tradeFloors";
import { useSession } from "@/lib/session";

export default function TradeFloorPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <TradeFloorInner />
        </RequireAuth>
      </main>
    </>
  );
}

function TradeFloorInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();

  const [tradeFloor, setTradeFloor] = useState< TradeFloor | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user || !params?.id) return;
    const id = String(params.id).toUpperCase();
    const l = getTradeFloor(id);
    if (!l) {
      setTradeFloor(null);
      return;
    }
    // Auto-join on first visit via invite link.
    if (!l.members.some((m) => m.email === user.email)) {
      const r = joinTradeFloor({
        code: l.id,
        user: { email: user.email, displayName: user.displayName },
      });
      if (r.ok) setTradeFloor(r.tradeFloor);
      else setTradeFloor(l);
    } else {
      setTradeFloor(l);
    }
  }, [user, params?.id]);

  if (!user || tradeFloor === undefined) return null;

  if (tradeFloor === null) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Trade Floor not found</h1>
        <p className="mt-2 text-sm text-ink-400">
          That invite code doesn&apos;t match any trade floor on this device. Ask
          your friend to resend the code.
        </p>
        <button
          onClick={() => router.push("/trade-floors")}
          className="mt-4 rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back
        </button>
      </div>
    );
  }

  const rows = weeklyLeaderboard(tradeFloor, user.email);
  const myRank = rows.findIndex((r) => r.isYou) + 1;

  async function copyCode() {
    if (!tradeFloor) return;
    try {
      await navigator.clipboard.writeText(tradeFloor.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
            Week of {currentWeekStart()}
          </div>
          <h1 className="mt-1 text-3xl font-semibold">{tradeFloor.name}</h1>
          <div className="mt-1 text-sm text-ink-400">
            {tradeFloor.members.length} member
            {tradeFloor.members.length === 1 ? "" : "s"} ·{" "}
            <button
              onClick={copyCode}
              className="rounded-md border border-ink-700 bg-ink-900 px-1.5 py-0.5 font-mono tracking-widest text-ink-100 hover:bg-ink-900/60"
              title="Click to copy"
            >
              {tradeFloor.id}
            </button>
            {copied && <span className="ml-2 text-brand-300">copied</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href={whatsappInviteUrl(tradeFloor)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
          >
            Invite via WhatsApp
          </a>
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900/40">
        <header className="flex items-center justify-between border-b border-ink-700/70 px-5 py-3 text-xs text-ink-400">
          <span>Leaderboard · this week</span>
          <span>You&apos;re #{myRank || "-"}</span>
        </header>
        <ol className="divide-y divide-ink-900">
          {rows.map((r, i) => (
            <li
              key={r.email}
              className={
                "flex items-center justify-between px-5 py-3 text-sm " +
                (r.isYou ? "bg-brand-500/5" : "")
              }
            >
              <span className="flex items-center gap-3">
                <span
                  className={
                    "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold " +
                    (i === 0
                      ? "bg-brand-500 text-ink-950"
                      : i < 3
                        ? "bg-ink-800 text-ink-100"
                        : "bg-ink-900 text-ink-400")
                  }
                >
                  {i + 1}
                </span>
                <span className={r.isYou ? "font-medium text-ink-50" : "text-ink-200"}>
                  @{r.displayName}
                  {r.isYou && <span className="ml-2 text-xs text-brand-300">you</span>}
                </span>
              </span>
              <span className="flex items-center gap-5 text-xs text-ink-400">
                <span>{r.plays} plays</span>
                <span>{r.correct} correct</span>
                <span>🔥 {r.streak}</span>
                <span className="font-mono text-ink-50">{r.xp.toLocaleString()} XP</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/play"
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Play today&apos;s challenge →
        </Link>
        <Link
          href="/trade-floors"
          className="rounded-lg border border-ink-700 px-5 py-2.5 text-sm text-ink-100 hover:bg-ink-900"
        >
          All trade floors
        </Link>
      </div>

      <p className="mt-4 text-xs text-ink-500">
        V1 note: other members&apos; scores in this preview are demo data based
        on their handles — real live scores land with the server in Phase 5.
      </p>
    </>
  );
}
