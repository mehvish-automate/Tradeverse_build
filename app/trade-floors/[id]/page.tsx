"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { attributeShareJoin, shareWhatsapp } from "@/lib/referral";
import {
  TradeFloor,
  currentWeekStart,
  getTradeFloor,
  joinTradeFloor,
  weeklyLeaderboard,
} from "@/lib/tradeFloors";
import {
  competitionLeaderboard,
  competitionScheduleStatus,
  formatRupees,
  formatWhen,
} from "@/lib/competitions";
import { useSession } from "@/lib/session";
import { useRealtimeLeaderboards } from "@/lib/supabase/realtime";
import { pullScoresFor } from "@/lib/supabase/scores-sync";

type LeaderboardMode = "pnl" | "xp";

export default function TradeFloorPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <Suspense fallback={null}>
            <TradeFloorInner />
          </Suspense>
        </RequireAuth>
      </main>
    </>
  );
}

function TradeFloorInner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const viaCode = search?.get("via")?.toUpperCase() ?? "";
  const router = useRouter();
  const { user } = useSession();

  const [tradeFloor, setTradeFloor] = useState<TradeFloor | null | undefined>(
    undefined,
  );
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<LeaderboardMode>("pnl");
  const live = useRealtimeLeaderboards();
  const [scoresTick, setScoresTick] = useState(0);

  useEffect(() => {
    if (!user || !params?.id) return;
    const id = String(params.id).toUpperCase();
    const l = getTradeFloor(id);
    if (!l) {
      setTradeFloor(null);
      return;
    }
    if (!l.members.some((m) => m.email === user.email)) {
      const r = joinTradeFloor({
        code: l.id,
        user: { email: user.email, displayName: user.displayName },
      });
      if (r.ok) {
        setTradeFloor(r.tradeFloor);
        // Phase 48 — credit the inviter once per (invitee, floor).
        if (viaCode) {
          attributeShareJoin(user.email, viaCode, "floor", r.tradeFloor.id);
        }
      } else {
        setTradeFloor(l);
      }
    } else {
      setTradeFloor(l);
    }
  }, [user, params?.id, viaCode]);

  // Pull real cross-user XP scores so the XP tab is real, not demo.
  useEffect(() => {
    if (!tradeFloor) return;
    const emails = tradeFloor.members.map((m) => m.email);
    const since = currentWeekStart();
    const until = new Date().toISOString().slice(0, 10);
    let cancelled = false;
    void (async () => {
      await pullScoresFor(emails, since, until);
      if (!cancelled) setScoresTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [tradeFloor, live.tick]);

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

  const xpRows = useMemo(
    () => (tradeFloor && user ? weeklyLeaderboard(tradeFloor, user.email) : []),
    // scoresTick included so the memo refreshes after a cloud pull lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tradeFloor, user, scoresTick],
  );
  const pnlRows = useMemo(
    () =>
      tradeFloor && user ? competitionLeaderboard(tradeFloor, user.email) : [],
    [tradeFloor, user],
  );

  if (!user || tradeFloor === undefined) return null;

  if (tradeFloor === null) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Trade floor not found</h1>
        <p className="mt-2 text-sm text-ink-400">
          That invite code doesn&apos;t match any trade floor on this device.
          Ask your friend to resend the code.
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

  const sched = competitionScheduleStatus(tradeFloor);
  const myPnlRank = pnlRows.findIndex((r) => r.isYou) + 1;
  const myXpRank = xpRows.findIndex((r) => r.isYou) + 1;
  const myRank = mode === "pnl" ? myPnlRank : myXpRank;
  const totalRows = mode === "pnl" ? pnlRows.length : xpRows.length;
  const myPnl = pnlRows.find((r) => r.isYou);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <ScheduleBadge status={sched} />
            <span className="rounded-md bg-ink-900 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-ink-400">
              {tradeFloor.privacy}
            </span>
            <StatusChip status={tradeFloor.status} />
          </div>
          <h1 className="mt-2 text-3xl font-semibold">{tradeFloor.name}</h1>
          <div className="mt-1 text-sm text-ink-400">
            {tradeFloor.members.length}/{tradeFloor.memberCap} members ·{" "}
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
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/trade?floor=${tradeFloor.id}`}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
          >
            Trade now →
          </Link>
          <a
            href={shareWhatsapp(
              "floor",
              tradeFloor.id,
              tradeFloor.name,
              user.email,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
          >
            Invite via WhatsApp
          </a>
        </div>
      </div>

      {/* Competition meta strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-ink-700 bg-ink-900/40 p-4 md:grid-cols-4">
        <Meta label="Window">
          {formatWhen(tradeFloor.startAt)} → {formatWhen(tradeFloor.endAt)}
        </Meta>
        <Meta label="Capital / player">
          {formatRupees(tradeFloor.virtualCapital)}
        </Meta>
        <Meta label="Universe">
          {prettyUniverse(tradeFloor.stockUniverse.kind)}
        </Meta>
        <Meta label="Region · classes">
          {tradeFloor.marketRegion} · {tradeFloor.assetClasses.join(", ")}
        </Meta>
      </div>

      {/* My P&L card — only when joined (always true on this page) */}
      {myPnl && (
        <div
          className={
            "mt-4 rounded-2xl border p-5 " +
            (myPnl.pnl >= 0
              ? "border-brand-500/40 bg-brand-500/5"
              : "border-red-500/40 bg-red-500/5")
          }
        >
          <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
            Your competition P&amp;L
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span
              className={
                "text-3xl font-semibold " +
                (myPnl.pnl >= 0 ? "text-brand-300" : "text-red-300")
              }
            >
              {myPnl.pnl >= 0 ? "+" : ""}
              {formatRupees(myPnl.pnl)}
            </span>
            <span
              className={
                "text-sm " +
                (myPnl.pnl >= 0 ? "text-brand-300" : "text-red-300")
              }
            >
              {myPnl.pnlPct >= 0 ? "+" : ""}
              {myPnl.pnlPct.toFixed(2)}%
            </span>
          </div>
          <div className="mt-1 text-xs text-ink-500">
            Portfolio {formatRupees(myPnl.totalValue)} vs{" "}
            {formatRupees(myPnl.startingCapital)} starting capital
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/40">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/70 px-5 py-3 text-xs text-ink-400">
          <div className="flex items-center gap-3">
            <ModeTabs mode={mode} setMode={setMode} />
            {live.connected && mode === "xp" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                Live
              </span>
            )}
          </div>
          <span>
            You&apos;re #{myRank || "-"} of {totalRows || "-"}
          </span>
        </header>
        <ol className="divide-y divide-ink-900">
          {mode === "pnl"
            ? pnlRows.map((r, i) => <PnlRow key={r.email} row={r} index={i} />)
            : xpRows.map((r, i) => <XpRow key={r.email} row={r} index={i} />)}
        </ol>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/trade?floor=${tradeFloor.id}`}
          className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Place a trade →
        </Link>
        <Link
          href="/trade-floors"
          className="rounded-lg border border-ink-700 px-5 py-2.5 text-sm text-ink-100 hover:bg-ink-900"
        >
          All trade floors
        </Link>
      </div>

      <p className="mt-4 text-xs text-ink-500">
        Your P&amp;L is computed against this competition&apos;s scoped paper
        account — fresh capital per floor. Other members&apos; P&amp;L shown
        here is demo data until per-floor cloud sync lands.
      </p>
    </>
  );
}

// --- Subcomponents -------------------------------------------------------

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm text-ink-100">{children}</div>
    </div>
  );
}

function ModeTabs({
  mode,
  setMode,
}: {
  mode: LeaderboardMode;
  setMode: (m: LeaderboardMode) => void;
}) {
  const tabs: { id: LeaderboardMode; label: string }[] = [
    { id: "pnl", label: "Live P&L" },
    { id: "xp", label: "Daily XP" },
  ];
  return (
    <div className="flex items-center gap-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setMode(t.id)}
          className={
            "rounded-md px-2.5 py-1 text-xs font-medium transition " +
            (mode === t.id
              ? "bg-ink-800 text-ink-50"
              : "text-ink-400 hover:bg-ink-900 hover:text-ink-200")
          }
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ScheduleBadge({
  status,
}: {
  status: "upcoming" | "live" | "ended";
}) {
  const map = {
    upcoming: { label: "Upcoming", cls: "bg-amber-500/15 text-amber-300" },
    live: { label: "Live", cls: "bg-brand-500/15 text-brand-300" },
    ended: { label: "Ended", cls: "bg-ink-800 text-ink-400" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span
      className={
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {label}
    </span>
  );
}

function StatusChip({
  status,
}: {
  status: TradeFloor["status"];
}) {
  if (status === "live") return null; // already implied by Live schedule chip
  const map: Record<TradeFloor["status"], { label: string; cls: string }> = {
    pending_approval: {
      label: "Pending approval",
      cls: "bg-amber-500/15 text-amber-300",
    },
    rejected: { label: "Rejected", cls: "bg-red-500/15 text-red-300" },
    ended: { label: "Ended", cls: "bg-ink-800 text-ink-400" },
    live: { label: "Live", cls: "bg-brand-500/15 text-brand-300" },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={
        "rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
        cls
      }
    >
      {label}
    </span>
  );
}

function PnlRow({
  row,
  index,
}: {
  row: ReturnType<typeof competitionLeaderboard>[number];
  index: number;
}) {
  const positive = row.pnl >= 0;
  return (
    <li
      className={
        "flex items-center justify-between px-5 py-3 text-sm " +
        (row.isYou ? "bg-brand-500/5" : "")
      }
    >
      <span className="flex items-center gap-3">
        <RankBadge index={index} />
        <span
          className={row.isYou ? "font-medium text-ink-50" : "text-ink-200"}
        >
          @{row.displayName}
          {row.isYou && (
            <span className="ml-2 text-xs text-brand-300">you</span>
          )}
        </span>
      </span>
      <span className="flex items-center gap-5 text-xs">
        <span className="text-ink-400">
          {formatRupees(row.totalValue)}
        </span>
        <span
          className={
            "font-mono " + (positive ? "text-brand-300" : "text-red-300")
          }
        >
          {positive ? "+" : ""}
          {row.pnlPct.toFixed(2)}%
        </span>
      </span>
    </li>
  );
}

function XpRow({
  row,
  index,
}: {
  row: ReturnType<typeof weeklyLeaderboard>[number];
  index: number;
}) {
  return (
    <li
      className={
        "flex items-center justify-between px-5 py-3 text-sm " +
        (row.isYou ? "bg-brand-500/5" : "")
      }
    >
      <span className="flex items-center gap-3">
        <RankBadge index={index} />
        <span
          className={row.isYou ? "font-medium text-ink-50" : "text-ink-200"}
        >
          @{row.displayName}
          {row.isYou && (
            <span className="ml-2 text-xs text-brand-300">you</span>
          )}
        </span>
      </span>
      <span className="flex items-center gap-5 text-xs text-ink-400">
        <span>{row.plays} plays</span>
        <span>{row.correct} correct</span>
        <span>🔥 {row.streak}</span>
        <span className="font-mono text-ink-50">
          {row.xp.toLocaleString()} XP
        </span>
      </span>
    </li>
  );
}

function RankBadge({ index }: { index: number }) {
  return (
    <span
      className={
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold " +
        (index === 0
          ? "bg-brand-500 text-ink-950"
          : index < 3
            ? "bg-ink-800 text-ink-100"
            : "bg-ink-900 text-ink-400")
      }
    >
      {index + 1}
    </span>
  );
}

function prettyUniverse(kind: string): string {
  if (kind === "nifty50") return "NIFTY 50";
  if (kind === "nifty100") return "NIFTY 100";
  if (kind === "all") return "All listed";
  if (kind === "custom-sectors") return "Custom sectors";
  if (kind === "handpicked") return "Handpicked";
  return kind;
}
