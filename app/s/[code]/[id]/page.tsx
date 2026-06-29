"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { formatRupees, formatWhen } from "@/lib/competitions";
import { EVENTS, getEvent } from "@/lib/events";
import { Fest, getFest } from "@/lib/fests";
import {
  ShareKind,
  handleForCode,
  trackShareClick,
} from "@/lib/referral";
import { TradeFloor, getTradeFloor } from "@/lib/tradeFloors";

const KIND_LABEL: Record<ShareKind, string> = {
  floor: "trading competition",
  fest: "fest",
  event: "market event",
};

export default function ResourceSharePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Suspense fallback={null}>
          <Inner />
        </Suspense>
      </main>
    </>
  );
}

function isShareKind(s: string): s is ShareKind {
  return s === "floor" || s === "fest" || s === "event";
}

function Inner() {
  // Param is named `code` to share the same dynamic-segment name as
  // the sibling /s/[code]/page.tsx — Next requires identical param
  // names at the same path depth. Semantically here it carries the
  // share kind ('floor' | 'fest' | 'event').
  const params = useParams<{ code: string; id: string }>();
  const search = useSearchParams();
  const kindRaw = String(params?.code ?? "");
  const id = String(params?.id ?? "").toUpperCase();
  const refCode = search?.get("ref")?.toUpperCase() ?? "";

  const [tracked, setTracked] = useState(false);
  const [inviterHandle, setInviterHandle] = useState<string | null>(null);

  // Track click + lookup the inviter handle on mount.
  useEffect(() => {
    if (!isShareKind(kindRaw)) return;
    if (!id) return;
    if (refCode) {
      trackShareClick(refCode, kindRaw, id);
      setInviterHandle(handleForCode(refCode));
    }
    setTracked(true);
  }, [kindRaw, id, refCode]);

  if (!isShareKind(kindRaw)) {
    return <NotFound message={`Unknown share kind "${kindRaw}".`} />;
  }
  if (!id) {
    return <NotFound message="Missing resource id." />;
  }
  if (!tracked) return null; // brief: render nothing until effect commits

  // Resolve resource details for preview.
  let title = "Invite";
  let subtitle = "Join this on TradeVerse.";
  let metaRows: { label: string; value: string }[] = [];
  let joinHref = "/";
  let cta = "Join";

  if (kindRaw === "floor") {
    const f: TradeFloor | null = getTradeFloor(id);
    if (f) {
      title = f.name;
      subtitle = `${KIND_LABEL.floor} · code ${f.id}`;
      metaRows = [
        { label: "Window", value: `${formatWhen(f.startAt)} → ${formatWhen(f.endAt)}` },
        { label: "Capital / player", value: formatRupees(f.virtualCapital) },
        { label: "Region", value: f.marketRegion },
        { label: "Members", value: `${f.members.length}/${f.memberCap}` },
      ];
      joinHref = `/trade-floors/${f.id}?via=${refCode}`;
      cta = "Open competition";
    } else {
      title = `Quiz Floor ${id}`;
      subtitle = "We can't preview this floor on this device yet.";
      joinHref = `/trade-floors?code=${id}${refCode ? `&via=${refCode}` : ""}`;
      cta = "Sign in to join";
    }
  } else if (kindRaw === "fest") {
    const f: Fest | null = getFest(id);
    if (f) {
      title = f.name;
      subtitle = `${KIND_LABEL.fest} · code ${f.id}`;
      metaRows = [
        { label: "Window", value: `${f.startDate} → ${f.endDate}` },
        { label: "Type", value: f.eventType ?? "—" },
        { label: "Difficulty", value: f.difficulty ?? "—" },
        { label: "Participants", value: `${f.participants.length}` },
      ];
      joinHref = `/fests/${f.id}?via=${refCode}`;
      cta = "Open fest";
    } else {
      title = `Fest ${id}`;
      subtitle = "We can't preview this fest on this device yet.";
      joinHref = `/fests/${id}?via=${refCode}`;
      cta = "Sign in to join";
    }
  } else {
    // event
    const ev = getEvent(id) ?? EVENTS.find((e) => e.id.toUpperCase() === id);
    if (ev) {
      title = ev.title;
      subtitle = `${KIND_LABEL.event}`;
      metaRows = [
        { label: "Reward", value: `${ev.rewardXp} XP` },
        { label: "Sectors", value: ev.sectors.join(", ") || "—" },
      ];
      joinHref = `/events/${ev.id}${refCode ? `?via=${refCode}` : ""}`;
      cta = "Open event";
    } else {
      title = `Event ${id}`;
      subtitle = "We can't preview this event on this device yet.";
      joinHref = `/events`;
      cta = "Browse events";
    }
  }

  return (
    <div className="rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-8">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
        {inviterHandle
          ? `@${inviterHandle} invited you`
          : "You've been invited"}
      </div>
      <h1 className="mt-3 text-3xl font-semibold md:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-ink-300">{subtitle}</p>

      {metaRows.length > 0 && (
        <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {metaRows.map((r) => (
            <div
              key={r.label}
              className="rounded-xl border border-ink-700 bg-ink-900/40 p-3"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {r.label}
              </dt>
              <dd className="mt-0.5 text-sm text-ink-100">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href={joinHref} className="btn-primary">
          {cta} →
        </Link>
        <Link href="/" className="btn-ghost">
          Explore TradeVerse
        </Link>
      </div>

      <p className="mt-6 text-xs text-ink-500">
        Skill platform on Indian markets — paper money only, no brokerage,
        no KYC.
      </p>
    </div>
  );
}

function NotFound({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
      <h1 className="text-xl font-semibold">Invite link unavailable</h1>
      <p className="mt-2 text-sm text-ink-400">{message}</p>
      <Link
        href="/"
        className="mt-4 inline-block rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
      >
        Back home
      </Link>
    </div>
  );
}
