"use client";

import Link from "next/link";

import { useSession } from "@/lib/session";

export function Nav() {
  const { user, loaded } = useSession();

  return (
    <header className="sticky top-0 z-40 border-b border-ink-900/80 bg-ink-950/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="inline-block h-2 w-2 rounded-full bg-brand-500" />
          TradeVerse
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-ink-300 md:flex">
          <a href="/#how" className="hover:text-ink-50">How it works</a>
          <a href="/#heroes" className="hover:text-ink-50">Game modes</a>
          <a href="/#faq" className="hover:text-ink-50">FAQ</a>
        </nav>

        {loaded && user ? (
          <div className="flex items-center gap-2">
            <Link
              href="/learn"
              className="hidden rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-100 hover:bg-ink-900 md:inline-block"
            >
              Learn
            </Link>
            <Link
              href="/profile"
              className="rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-100 hover:bg-ink-900"
            >
              @{user.displayName}
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/signin"
              className="hidden rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-100 hover:bg-ink-900 md:inline-block"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-ink-950 hover:bg-brand-300"
            >
              Join waitlist
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
