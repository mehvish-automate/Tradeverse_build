"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { getClub, getInstitute } from "@/lib/clubs";
import { attributeShareJoin, shareWhatsapp } from "@/lib/referral";
import {
  Fest,
  festLeaderboard,
  festStatus,
  getFest,
  joinFest,
} from "@/lib/fests";
import {
  ensureOfficialInStore,
  getOfficialTournament,
  isOfficial,
} from "@/lib/officialTournaments";
import { QuizLeaderRow, quizLeaderboard } from "@/lib/quizLeaderboard";
import { pickQuizQuestions } from "@/lib/quizQuestions";
import { COMPLIANCE_DISCLOSURE, hasGrantFor, logGrant } from "@/lib/compliance";
import { grantCoupon } from "@/lib/coupons";
import { awardXp } from "@/lib/progress";
import { rewardForRank, tiersSummary } from "@/lib/rewardTiers";
import { isAdminLocal } from "@/lib/supabase/sync";
import {
  CloudQuizAttempt,
  QuizRoom,
  getQuizRoom,
  openQuizRoom,
  pullQuizAttempts,
  setQuizRoomState,
} from "@/lib/supabase/quiz-sync";
import { useSession } from "@/lib/session";
import { useRealtimeLeaderboards } from "@/lib/supabase/realtime";
import { pullScoresFor } from "@/lib/supabase/scores-sync";

export default function FestPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <Suspense fallback={null}>
            <FestInner />
          </Suspense>
        </RequireAuth>
      </main>
    </>
  );
}

function FestInner() {
  const { user } = useSession();
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const viaCode = search?.get("via")?.toUpperCase() ?? "";
  const code = params?.code ? String(params.code).toUpperCase() : "";

  const [fest, setFest] = useState<Fest | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);
  const live = useRealtimeLeaderboards();
  const [scoresTick, setScoresTick] = useState(0);
  const [cloudAttempts, setCloudAttempts] = useState<CloudQuizAttempt[]>([]);
  const [room, setRoom] = useState<QuizRoom | null>(null);
  const [roomBusy, setRoomBusy] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!code || !user) return;
    let f = getFest(code);
    if (!f && isOfficial(code)) {
      ensureOfficialInStore(code);
      f = getFest(code);
    }
    if (!f) {
      setFest(null);
      return;
    }
    if (!f.participants.some((p) => p.email === user.email)) {
      const r = joinFest(f.id, { email: user.email, displayName: user.displayName });
      if (r.ok) {
        setFest(r.fest);
        if (viaCode) {
          attributeShareJoin(user.email, viaCode, "fest", r.fest.id);
        }
      } else {
        setFest(f);
      }
    } else {
      setFest(f);
    }
  }, [code, user, viaCode]);

  // Pull real cross-user XP for the fest window. Re-pulls on live.tick.
  useEffect(() => {
    if (!fest) return;
    const emails = fest.participants.map((p) => p.email);
    let cancelled = false;
    void (async () => {
      await pullScoresFor(emails, fest.startDate, fest.endDate);
      if (!cancelled) setScoresTick((t) => t + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [fest, live.tick]);

  // Phase 52 — near-live: poll cloud attempts + room state every 5s for
  // quizzes. No-ops without Supabase; the solo flow works regardless.
  useEffect(() => {
    if (!fest || fest.eventType !== "quiz") return;
    let cancelled = false;
    const poll = async () => {
      const [att, rm] = await Promise.all([
        pullQuizAttempts(fest.id),
        getQuizRoom(fest.id),
      ]);
      if (cancelled) return;
      setCloudAttempts(att);
      setRoom(rm);
    };
    void poll();
    const t = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [fest]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(fest!.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  if (!user || fest === undefined) return null;
  if (fest === null) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Fest not found</h1>
        <p className="mt-2 text-sm text-ink-400">
          That invite code doesn&apos;t match any fest on this device. Ask
          the host to resend the code.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to profile
        </Link>
      </div>
    );
  }

  const official = getOfficialTournament(fest.id);
  const club = official || !fest.clubId ? null : getClub(fest.clubId);
  const inst = club ? getInstitute(club.instituteId) : null;
  const dateStatus = festStatus(fest);
  const lifecycle = fest.lifecycleStatus ?? "live";
  const isPending = lifecycle === "pending_approval";
  const isRejected = lifecycle === "rejected";
  // The displayed status prioritises the approval lifecycle over the
  // date window — a pending quiz must NOT read "LIVE" just because its
  // date window is open.
  const displayStatus = isPending
    ? "pending"
    : isRejected
      ? "rejected"
      : dateStatus;
  const playable = !isPending && !isRejected;

  void scoresTick;
  const isQuiz = fest.eventType === "quiz";
  const quizTotal = isQuiz ? pickQuizQuestions(fest).length : 0;
  const quizRows = isQuiz ? quizLeaderboard(fest, user.email, quizTotal) : [];
  const rows = festLeaderboard(fest, user.email);
  const myRank = isQuiz
    ? quizRows.findIndex((r) => r.isYou && r.played) + 1
    : rows.findIndex((r) => r.email === user.email) + 1;

  // Near-live standings come from the cloud when any player has synced.
  const hasLive = isQuiz && cloudAttempts.length > 0;
  const liveRows = [...cloudAttempts].sort(
    (a, b) => b.score - a.score || a.totalMs - b.totalMs,
  );
  const isHost = isQuiz && fest.createdBy === user.email;
  const isAdmin = isAdminLocal(user.email);

  // Prize pool + claim (Phases 59/61). Final rank prefers live cloud
  // standings; reward is granted once the quiz has ended.
  const rewardTiers = (isQuiz && fest.rewards) || [];
  const quizEnded = isQuiz && (lifecycle === "ended" || dateStatus === "ended");
  const claimRank = hasLive
    ? liveRows.findIndex((r) => r.displayName === user.displayName) + 1
    : myRank;
  const myReward = rewardTiers.length > 0 ? rewardForRank(rewardTiers, claimRank) : null;
  const rewardContext = `quiz:${fest.id}`;
  const alreadyClaimed = claimed || hasGrantFor(user.email, rewardContext);

  function claimReward() {
    if (!myReward) return;
    if (myReward.type === "xp") awardXp(user!.email, myReward.xp);
    else if (myReward.type === "coupon") grantCoupon(user!.email, myReward.couponId, fest!.name);
    logGrant(user!.email, {
      rewardLabel: myReward.label,
      type: myReward.type,
      context: rewardContext,
    });
    setClaimed(true);
  }

  async function roomAction(next: "open" | "live" | "ended") {
    if (!fest) return;
    setRoomBusy(true);
    if (next === "open") await openQuizRoom(fest.id);
    else await setQuizRoomState(fest.id, next);
    const rm = await getQuizRoom(fest.id);
    setRoom(rm);
    setRoomBusy(false);
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={
                "rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wider " +
                (isRejected
                  ? "bg-red-500/20 text-red-300"
                  : isPending
                    ? "bg-amber-500/20 text-amber-300"
                    : displayStatus === "live"
                      ? "bg-brand-500/20 text-brand-300"
                      : displayStatus === "upcoming"
                        ? "bg-amber-500/20 text-amber-300"
                        : "bg-ink-800 text-ink-400")
              }
            >
              {displayStatus}
            </span>
            {official && (
              <span className="rounded-md bg-violet-500/20 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-violet-300">
                Official
              </span>
            )}
            {fest.eventType && (
              <span className="rounded-md bg-ink-900 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-ink-300">
                {fest.eventType}
              </span>
            )}
            {fest.difficulty && (
              <span className="rounded-md bg-ink-900 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-ink-300">
                {fest.difficulty}
              </span>
            )}
            {fest.source === "custom" && (
              <span className="rounded-md bg-amber-500/20 px-1.5 py-0.5 font-semibold uppercase tracking-wider text-amber-300">
                custom Qs
              </span>
            )}
            <span className="text-ink-500">
              {fest.startDate} → {fest.endDate}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold">{fest.name}</h1>
          {fest.description && (
            <p className="mt-1 max-w-xl text-sm text-ink-300">
              {fest.description}
            </p>
          )}
          <div className="mt-2 text-xs text-ink-500">
            {official ? (
              <>Hosted by <span className="text-violet-300">TradeVerse Official</span></>
            ) : (
              <>
                Hosted by{" "}
                {club ? (
                  <Link href={`/clubs/${club.id}`} className="hover:text-ink-100">
                    {club.name}
                  </Link>
                ) : (
                  "Unknown club"
                )}
                {inst && ` · ${inst.short}`}
              </>
            )}
          </div>
          <div className="mt-2 text-xs text-ink-500">
            Code:{" "}
            <button
              onClick={copyCode}
              className="rounded-md border border-ink-700 bg-ink-900 px-1.5 py-0.5 font-mono tracking-widest text-ink-100 hover:bg-ink-900/60"
              title="Click to copy"
            >
              {fest.id}
            </button>
            {copied && <span className="ml-2 text-brand-300">copied</span>}
          </div>
        </div>
        <a
          href={shareWhatsapp("fest", fest.id, fest.name, user.email)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
        >
          Invite via WhatsApp
        </a>
      </div>

      {isQuiz && !playable && (
        <div
          className={
            "mb-6 rounded-2xl border p-5 " +
            (isRejected
              ? "border-red-500/40 bg-red-500/5"
              : "border-amber-500/40 bg-amber-500/5")
          }
        >
          <div className="text-sm font-medium text-ink-100">
            {isRejected
              ? "This quiz was not approved."
              : isHost
                ? "Your quiz is awaiting admin approval."
                : "This quiz is awaiting admin approval."}
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {isRejected
              ? "It can't be played. Tweak it and launch again from the Quiz Floor."
              : "Public quizzes — and private quizzes above 100 participants — are reviewed before going live. It'll be playable once approved."}
          </p>
          {isAdmin && !isRejected && (
            <Link
              href="/admin/fests"
              className="mt-3 inline-block rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300"
            >
              Review in admin queue →
            </Link>
          )}
        </div>
      )}

      {isQuiz && playable && (
        <RoomPanel
          room={room}
          isHost={isHost}
          busy={roomBusy}
          playHref={`/fests/${fest.id}/play`}
          onAction={roomAction}
        />
      )}

      {isQuiz && rewardTiers.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-amber-300">
            🏆 Prizes
          </div>
          <div className="mt-1 text-sm text-ink-100">{tiersSummary(rewardTiers)}</div>

          {quizEnded && myReward && !alreadyClaimed && (
            <button
              onClick={claimReward}
              className="mt-3 rounded-md bg-amber-500 px-4 py-1.5 text-xs font-semibold text-ink-950 hover:bg-amber-400"
            >
              Claim your reward — {myReward.label} (you placed #{claimRank})
            </button>
          )}
          {quizEnded && myReward && alreadyClaimed && (
            <div className="mt-3 text-xs text-brand-300">
              Reward claimed ✓ — {myReward.label}. See it in your{" "}
              <Link href="/wallet" className="underline">
                wallet
              </Link>
              .
            </div>
          )}
          {quizEnded && !myReward && claimRank > 0 && (
            <div className="mt-3 text-xs text-ink-500">
              You placed #{claimRank} — outside the prize tiers this time.
            </div>
          )}
          {!quizEnded && (
            <div className="mt-2 text-xs text-ink-500">
              Awarded to the top ranks when the quiz ends.
            </div>
          )}
          <p className="mt-3 text-[11px] text-ink-500">{COMPLIANCE_DISCLOSURE}</p>
        </div>
      )}

      <section className="rounded-2xl border border-ink-700 bg-ink-900/40">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/70 px-5 py-3 text-xs text-ink-400">
          <span className="flex items-center gap-2">
            <span>
              {hasLive ? "Live standings" : "Leaderboard"} ·{" "}
              {hasLive ? liveRows.length : fest.participants.length} players
            </span>
            {(hasLive || live.connected) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-300">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                Live
              </span>
            )}
          </span>
          <span className="flex items-center gap-3">
            <span>You&apos;re #{myRank || "-"}</span>
            {myRank > 0 && (
              <Link
                href={
                  "/s/card?kind=rank" +
                  `&handle=${encodeURIComponent(user.displayName)}` +
                  `&context=${encodeURIComponent(fest.name)}` +
                  `&rank=${myRank}` +
                  `&outOf=${fest.participants.length}` +
                  `&xp=${(isQuiz ? quizRows[myRank - 1]?.score : rows[myRank - 1]?.xp) ?? 0}`
                }
                className="rounded-md border border-ink-700 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-200 hover:bg-ink-900"
              >
                Share card
              </Link>
            )}
          </span>
        </header>
        {isQuiz && hasLive ? (
          <LiveBoard rows={liveRows} youHandle={user.displayName} />
        ) : isQuiz ? (
          <QuizBoard rows={quizRows} />
        ) : (
          <ol className="divide-y divide-ink-900">
            {rows.map((r, i) => {
              const you = r.email === user.email;
              return (
                <li
                  key={r.email}
                  className={
                    "flex items-center justify-between px-5 py-3 text-sm " +
                    (you ? "bg-brand-500/5" : "")
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
                    <span className={you ? "font-medium text-ink-50" : "text-ink-200"}>
                      {r.handle}
                      {you && <span className="ml-2 text-xs text-brand-300">you</span>}
                    </span>
                  </span>
                  <span className="flex items-center gap-5 text-xs text-ink-400">
                    <span>{r.plays} plays</span>
                    <span className="font-mono text-ink-50">
                      {r.xp.toLocaleString()} XP
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        {isQuiz ? (
          playable ? (
            <Link
              href={`/fests/${fest.id}/play`}
              className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              Play quiz →
            </Link>
          ) : (
            <span className="rounded-lg border border-ink-700 bg-ink-900/40 px-5 py-2.5 text-sm text-ink-500">
              {isRejected ? "Not available" : "Play unlocks once approved"}
            </span>
          )
        ) : (
          <Link
            href="/play"
            className="rounded-lg bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 hover:bg-brand-300"
          >
            Play today to earn XP →
          </Link>
        )}
        {club && (
          <Link
            href={`/clubs/${club.id}`}
            className="rounded-lg border border-ink-700 px-5 py-2.5 text-sm text-ink-100 hover:bg-ink-900"
          >
            Club
          </Link>
        )}
        {fest.createdBy === user.email && (
          <Link
            href={`/fests/${fest.id}/registrations`}
            className="rounded-lg border border-ink-700 px-5 py-2.5 text-sm text-ink-100 hover:bg-ink-900"
          >
            Registrations →
          </Link>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-500">
        {isQuiz
          ? hasLive
            ? "Live standings refresh every few seconds as players finish. True synchronized rooms land in the next phase."
            : "No one has synced a score yet — once players finish, real live standings replace this demo board. Your own row is real."
          : "V1 note: peer scores are deterministic demo data based on their handles until the backend lands — your own row uses your real window-to-date XP."}
      </p>
    </>
  );
}

function QuizBoard({ rows }: { rows: QuizLeaderRow[] }) {
  return (
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
                (r.played && i === 0
                  ? "bg-brand-500 text-ink-950"
                  : i < 3
                    ? "bg-ink-800 text-ink-100"
                    : "bg-ink-900 text-ink-400")
              }
            >
              {i + 1}
            </span>
            <span className={r.isYou ? "font-medium text-ink-50" : "text-ink-200"}>
              {r.handle}
              {r.isYou && <span className="ml-2 text-xs text-brand-300">you</span>}
            </span>
          </span>
          <span className="flex items-center gap-5 text-xs text-ink-400">
            {r.played ? (
              <>
                <span>
                  {r.correct}/{r.total} · {r.accuracy}%
                </span>
                <span className="font-mono text-ink-50">
                  {r.score.toLocaleString()} pts
                </span>
              </>
            ) : (
              <span className="italic text-ink-500">not played yet</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

function LiveBoard({
  rows,
  youHandle,
}: {
  rows: CloudQuizAttempt[];
  youHandle: string;
}) {
  return (
    <ol className="divide-y divide-ink-900">
      {rows.map((r, i) => {
        const you = r.displayName === youHandle;
        return (
          <li
            key={r.displayName + i}
            className={
              "flex items-center justify-between px-5 py-3 text-sm " +
              (you ? "bg-brand-500/5" : "")
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
              <span className={you ? "font-medium text-ink-50" : "text-ink-200"}>
                @{r.displayName}
                {you && <span className="ml-2 text-xs text-brand-300">you</span>}
              </span>
            </span>
            <span className="flex items-center gap-5 text-xs text-ink-400">
              <span>
                {r.correct}/{r.total} · {r.total ? Math.round((r.correct / r.total) * 100) : 0}%
              </span>
              <span className="font-mono text-ink-50">{r.score.toLocaleString()} pts</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function RoomPanel({
  room,
  isHost,
  busy,
  playHref,
  onAction,
}: {
  room: QuizRoom | null;
  isHost: boolean;
  busy: boolean;
  playHref: string;
  onAction: (next: "open" | "live" | "ended") => void;
}) {
  const state = room?.state ?? null;

  if (isHost) {
    return (
      <div className="mb-6 rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
          Live room · host
        </div>
        {state === "live" ? (
          <>
            <p className="mt-1 text-sm text-ink-200">
              🔴 Your room is live — players can jump in now.
            </p>
            <button
              onClick={() => onAction("ended")}
              disabled={busy}
              className="mt-3 rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-900 disabled:opacity-50"
            >
              End room
            </button>
          </>
        ) : state === "lobby" ? (
          <>
            <p className="mt-1 text-sm text-ink-200">
              Lobby is open — players are gathering. Start when ready.
            </p>
            <button
              onClick={() => onAction("live")}
              disabled={busy}
              className="mt-3 rounded-md bg-brand-500 px-4 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300 disabled:opacity-50"
            >
              {busy ? "Working…" : "Start for everyone"}
            </button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-200">
              Open a live lobby to gather players, then start together. Solo
              play stays available any time.
            </p>
            <button
              onClick={() => onAction("open")}
              disabled={busy}
              className="mt-3 rounded-md bg-brand-500 px-4 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300 disabled:opacity-50"
            >
              {busy ? "Working…" : "Open live lobby"}
            </button>
          </>
        )}
      </div>
    );
  }

  // Player view
  if (state === "live") {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-500/50 bg-brand-500/10 p-5">
        <p className="text-sm text-ink-100">
          <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-brand-500 align-middle" />
          The host has started — this quiz is live now.
        </p>
        <Link
          href={playHref}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-300"
        >
          Jump in →
        </Link>
      </div>
    );
  }
  if (state === "lobby") {
    return (
      <div className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 text-sm text-amber-200">
        The host is setting up a live room. Get ready — it&apos;ll start any
        moment.
      </div>
    );
  }
  return null;
}
