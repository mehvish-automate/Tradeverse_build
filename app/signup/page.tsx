"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Nav } from "@/components/Nav";
import { signUpUniversal } from "@/lib/auth";
import { applyReferral, handleForCode, registerOwnCode } from "@/lib/referral";

export default function SignupPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </main>
    </>
  );
}

function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const ref = (search.get("ref") || "").toUpperCase();
  const inviter = ref ? handleForCode(ref) : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dob, setDob] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!agree) {
      setError("Please confirm you're 18+ and understand this is a skill platform.");
      return;
    }

    setLoading(true);
    const result = await signUpUniversal({ email, password, displayName, dob });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    // Mirror: local identity is always available so the UI has a User.
    registerOwnCode(email.trim().toLowerCase(), displayName);
    if (ref) applyReferral(email.trim().toLowerCase(), ref);

    if (result.mode === "supabase" && result.needsEmailConfirmation) {
      setMessage(
        `Account created. Check ${email} for a confirmation link, then sign in.`,
      );
      return;
    }
    router.push("/welcome");
  }

  return (
    <>
      <h1 className="text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-sm text-ink-400">
        TradeVerse is 18+ only. No trading, no real money.
      </p>

      {ref && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-brand-500/40 bg-brand-500/5 p-4 text-sm">
          <span className="text-xl leading-none">🎁</span>
          <div className="flex-1">
            <div className="font-medium text-ink-50">
              {inviter ? `@${inviter} invited you` : "You were invited"}
            </div>
            <div className="text-xs text-ink-400">
              Finish signup and both of you get +150 XP. Code:{" "}
              <span className="font-mono">{ref}</span>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Field label="Display name">
            <input
              type="text"
              required
              minLength={2}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="rohan.98"
              className="input"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@iit.ac.in"
              className="input"
            />
          </Field>

          <Field label="Password" hint="Minimum 8 characters.">
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
            />
          </Field>

          <Field label="Date of birth" hint="Must be 18 or older.">
            <input
              type="date"
              required
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="input"
            />
          </Field>

          <label className="flex cursor-pointer items-start gap-3 text-xs text-ink-400">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-ink-600 bg-ink-900"
            />
            <span>
              I am 18+ and understand TradeVerse is a pure skill platform — no
              brokerage, no KYC, no real-money trading, and no investment
              advice.
            </span>
          </label>

          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-md border border-brand-500/40 bg-brand-500/5 px-3 py-2 text-sm text-brand-200">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-brand-300 disabled:opacity-60"
          >
            {loading ? "Working…" : "Create account"}
          </button>

          <p className="text-center text-sm text-ink-400">
            Already have an account?{" "}
            <Link href="/signin" className="text-brand-300 hover:underline">
              Sign in
            </Link>
          </p>
      </form>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-300">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
