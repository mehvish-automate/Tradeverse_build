"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import {
  CardParams,
  RankCardParams,
  RunCardParams,
  cardUrl,
  defaultCopyFor,
  parseCard,
  twitterShareUrl,
  whatsappShareUrl,
} from "@/lib/shareCards";

export default function CardClient() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <Suspense fallback={null}>
          <Inner />
        </Suspense>
      </main>
    </>
  );
}

function Inner() {
  const search = useSearchParams();
  const params = useMemo(() => parseCard(search), [search]);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUrl(window.location.href);
    }
  }, []);

  if (!params) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">No card to show</h1>
        <p className="mt-2 text-sm text-ink-400">
          Make sure you followed a share link — the card data is encoded in
          the URL.
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

  const copy = defaultCopyFor(params);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="mb-6">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Share card
        </div>
        <h1 className="mt-1 text-3xl font-semibold">
          {params.kind === "run" ? "Daily run" : "Leaderboard rank"}
        </h1>
        <p className="mt-1 text-sm text-ink-400">
          Screenshot this card, or share the link — it recreates the card on
          any device.
        </p>
      </div>

      {params.kind === "run" ? (
        <RunCard params={params} />
      ) : (
        <RankCard params={params} />
      )}

      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-ink-400">
          Share
        </div>
        <p className="mt-1 text-sm text-ink-300">{copy}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={whatsappShareUrl(copy, url)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-brand-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-brand-300"
          >
            Share on WhatsApp
          </a>
          <a
            href={twitterShareUrl(copy, url)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
          >
            Share on X
          </a>
          <button
            onClick={onCopy}
            className="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
        <p className="mt-3 break-all text-[10px] text-ink-500">{url}</p>
      </section>

      <div className="mt-6">
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

function RunCard({ params }: { params: RunCardParams }) {
  const isPerfect = params.accuracy >= 100;
  return (
    <div
      className={
        "relative overflow-hidden rounded-2xl border p-8 shadow-[0_0_60px_-20px_rgba(16,185,129,0.35)] " +
        (isPerfect
          ? "border-brand-500/60 bg-gradient-to-br from-brand-500/20 via-ink-950 to-ink-950"
          : "border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-ink-900 to-ink-950")
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl"
      />
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-brand-500" />
        <span className="text-sm font-semibold text-ink-100">TradeVerse</span>
        <span className="ml-auto text-xs text-ink-500">
          {params.date ?? new Date().toISOString().slice(0, 10)}
        </span>
      </div>
      <div className="mt-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Today&apos;s chart challenge
        </div>
        <div className="mt-2 text-6xl font-semibold tracking-tight md:text-7xl">
          {params.score}
        </div>
        <div className="mt-2 text-sm text-ink-300">
          {params.accuracy.toFixed(0)}% accuracy · @{params.handle}
        </div>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
        <MiniStat label="XP earned" value={params.xp.toLocaleString()} />
        <MiniStat
          label="Streak"
          value={params.streak ? `${params.streak} days` : "—"}
        />
      </div>
      <div className="mt-6 text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Mathiks for markets · zero real money
      </div>
    </div>
  );
}

function RankCard({ params }: { params: RankCardParams }) {
  const medal =
    params.rank === 1 ? "🥇" : params.rank === 2 ? "🥈" : params.rank === 3 ? "🥉" : "🏅";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 via-ink-900 to-ink-950 p-8 shadow-[0_0_60px_-20px_rgba(16,185,129,0.35)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl"
      />
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-brand-500" />
        <span className="text-sm font-semibold text-ink-100">TradeVerse</span>
        <span className="ml-auto text-xs text-ink-500">
          Leaderboard rank
        </span>
      </div>
      <div className="mt-8 flex items-baseline gap-4">
        <div className="text-7xl leading-none">{medal}</div>
        <div>
          <div className="text-6xl font-semibold tracking-tight md:text-7xl">
            #{params.rank}
          </div>
          <div className="mt-1 text-sm text-ink-300">
            of {params.outOf} · @{params.handle}
          </div>
        </div>
      </div>
      <div className="mt-6 text-lg text-ink-100">{params.context}</div>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <MiniStat
          label="XP in window"
          value={params.xp != null ? params.xp.toLocaleString() : "—"}
        />
        <MiniStat label="Delta" value={params.delta ?? "—"} />
      </div>
      <div className="mt-6 text-[10px] uppercase tracking-[0.2em] text-ink-500">
        Ranked on skill · never on capital
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-950/70 p-4">
      <div className="text-[10px] uppercase tracking-wider text-ink-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

// Avoid "unused" on CardParams when minified.
export type _keepTypeRefs = CardParams;
