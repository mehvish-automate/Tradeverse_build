"use client";

// Phase 68 — SSO buttons. Shown on sign-in / sign-up. Each provider must
// be enabled in the Supabase dashboard (Authentication → Providers) to
// actually work; until then the click surfaces the provider's error.

import { useState } from "react";

import { OAuthProvider, signInWithProvider } from "@/lib/auth";

const PROVIDERS: { id: OAuthProvider; label: string; icon: string }[] = [
  { id: "google", label: "Continue with Google", icon: "G" },
];

export function OAuthButtons() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<OAuthProvider | null>(null);

  async function go(p: OAuthProvider) {
    setError(null);
    setBusy(p);
    const r = await signInWithProvider(p);
    // On success the browser redirects away; only failures return here.
    if (!r.ok) {
      setError(r.error ?? "Couldn't start sign-in.");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {PROVIDERS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => go(p.id)}
          disabled={busy !== null}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-ink-700 bg-ink-900/40 px-5 py-3 text-sm font-medium text-ink-100 transition hover:border-ink-500 hover:bg-ink-900 disabled:opacity-60"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-950">
            {p.icon}
          </span>
          {busy === p.id ? "Redirecting…" : p.label}
        </button>
      ))}
      {error && <p className="text-sm text-red-300">{error}</p>}

      <div className="flex items-center gap-3 py-1">
        <span className="h-px flex-1 bg-ink-800" />
        <span className="text-xs text-ink-500">or</span>
        <span className="h-px flex-1 bg-ink-800" />
      </div>
    </div>
  );
}
