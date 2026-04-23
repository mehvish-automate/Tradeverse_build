"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { handleForCode } from "@/lib/referral";

// Metadata for /s/[code] is handled in metadata.ts at the layout level —
// this is a client component so we can't export metadata here.

export default function SharePage() {
  const params = useParams<{ code: string }>();
  const code = params?.code ? String(params.code).toUpperCase() : "";
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setHandle(handleForCode(code));
  }, [code]);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-8 text-center">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            You&apos;ve been invited
          </div>
          <h1 className="mt-3 text-3xl font-semibold md:text-4xl">
            {handle ? `@${handle} invited you to TradeVerse` : "Join TradeVerse"}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm text-ink-300">
            Daily chart challenges and trade floors on live Indian market
            data. Not a trading app. No real money. Never.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 text-xs text-ink-200">
            Invite code:{" "}
            <span className="font-mono font-semibold text-ink-50">{code}</span>
          </div>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={`/signup?ref=${code}`}
              className="rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              Claim invite & sign up
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-ink-700 px-5 py-3 text-sm text-ink-100 hover:bg-ink-900"
            >
              Explore first
            </Link>
          </div>
          <p className="mt-6 text-xs text-ink-500">
            Both of you get +150 XP when you finish signup.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 text-sm text-ink-300 md:grid-cols-3">
          <Bullet label="5-min daily" body="System-generated chart questions from live market data." />
          <Bullet label="Zero money" body="No broker, no KYC, no demat. Compete on skill only." />
          <Bullet label="WhatsApp-native" body="Pull your group chat into a trade floor in 2 taps." />
        </div>
      </main>
    </>
  );
}

function Bullet({ label, body }: { label: string; body: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
        {label}
      </div>
      <div className="mt-1 text-sm">{body}</div>
    </div>
  );
}
