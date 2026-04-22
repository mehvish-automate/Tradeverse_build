"use client";

import { useState } from "react";

export function Waitlist() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "ok" | "err">("idle");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState("err");
      return;
    }
    // No backend yet — stored client-side until Phase 2 lands auth.
    try {
      const key = "tv.waitlist";
      const existing = JSON.parse(localStorage.getItem(key) || "[]") as string[];
      if (!existing.includes(email)) existing.push(email);
      localStorage.setItem(key, JSON.stringify(existing));
    } catch {
      // ignore
    }
    setState("ok");
  }

  return (
    <section id="waitlist" className="mx-auto max-w-6xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 via-ink-900 to-ink-950 p-8 md:p-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl"
        />
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
              Closed beta · Q3 2026
            </div>
            <h2 className="mt-3 text-balance text-3xl font-semibold md:text-4xl">
              Get early access. Be one of the first 1,000 players.
            </h2>
            <p className="mt-3 text-pretty text-ink-300">
              Invitations roll out in waves tied to college clubs and city
              chapters. No spam, no hot tips, no &ldquo;buy this stock&rdquo; DMs — we
              couldn&apos;t send one if we wanted to.
            </p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <div className="flex gap-2">
              <input
                id="email"
                type="email"
                required
                placeholder="you@iit.ac.in"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (state !== "idle") setState("idle");
                }}
                className="w-full rounded-lg border border-ink-700 bg-ink-950 px-4 py-3 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-brand-300"
              >
                Join waitlist
              </button>
            </div>
            {state === "ok" && (
              <p className="text-sm text-brand-300">
                You&apos;re on the list. We&apos;ll be in touch.
              </p>
            )}
            {state === "err" && (
              <p className="text-sm text-red-300">
                That email looks off — double-check it?
              </p>
            )}
            <p className="text-xs text-ink-500">
              18+ only. Skill game. No brokerage, no KYC, no demat.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
