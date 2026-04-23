"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { codeFor, myReferrals, registerOwnCode, shareLinks } from "@/lib/referral";
import { useSession } from "@/lib/session";

export default function ReferralsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <ReferralsInner />
        </RequireAuth>
      </main>
    </>
  );
}

function ReferralsInner() {
  const { user } = useSession();
  const [referrals, setReferrals] = useState<{ email: string; ts: number }[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    registerOwnCode(user.email, user.displayName);
    setReferrals(myReferrals(user.email));
  }, [user]);

  if (!user) return null;

  const code = codeFor(user.email);
  const links = shareLinks(
    code,
    `I'm building a daily streak on TradeVerse — come race me.`,
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(links.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Growth
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Invite friends</h1>
        <p className="mt-2 text-sm text-ink-400">
          Both of you get +150 XP when they finish signup. No cash rewards —
          just XP, streaks, and bragging rights.
        </p>
      </div>

      <section className="rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-6">
        <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
          Your code
        </div>
        <div className="mt-2 flex items-center gap-4">
          <div className="rounded-md border border-ink-700 bg-ink-950 px-4 py-3 font-mono text-2xl font-semibold tracking-[0.3em] text-ink-50">
            {code}
          </div>
          <div className="min-w-0 flex-1 text-xs text-ink-400">
            <div className="truncate">{links.url}</div>
            <button
              onClick={copyLink}
              className="mt-1 text-brand-300 hover:underline"
            >
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a
            href={links.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 hover:bg-brand-300"
          >
            Share on WhatsApp
          </a>
          <a
            href={links.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
          >
            Share on X
          </a>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-400">
          Joined via your code
        </h2>
        {referrals.length === 0 ? (
          <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
            Nobody yet. The invite link above unfurls as a share card in
            WhatsApp and X — paste it into a group chat.
          </div>
        ) : (
          <ul className="divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
            {referrals.map((r) => (
              <li
                key={r.email}
                className="flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="text-ink-100">{r.email}</span>
                <span className="text-xs text-ink-500">
                  {new Date(r.ts).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

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
