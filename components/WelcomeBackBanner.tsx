"use client";

import Link from "next/link";

import { useSession } from "@/lib/session";

/**
 * Compact "you're already signed in — pick up where you left off" strip
 * shown above the marketing hero on the home page. Renders nothing when
 * the user isn't signed in (or before the session has loaded), so the
 * unauthed marketing experience is unaffected.
 */
export function WelcomeBackBanner() {
  const { user, loaded } = useSession();
  if (!loaded || !user) return null;

  return (
    <div className="border-b border-ink-900/80 bg-brand-500/[0.04]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3">
        <div className="text-sm text-ink-200">
          Welcome back,{" "}
          <span className="font-medium text-ink-50">@{user.displayName}</span>.
          Pick up where you left off.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/play"
            className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-brand-300"
          >
            Today&apos;s challenge →
          </Link>
          <Link
            href="/profile"
            className="rounded-md border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-100 transition hover:border-ink-500 hover:bg-ink-900"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
