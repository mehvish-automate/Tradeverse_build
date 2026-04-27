"use client";

import Link from "next/link";
import { useState } from "react";

import { Nav } from "@/components/Nav";
import { sendPasswordReset } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await sendPasswordReset(email);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setSent(true);
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-3xl font-semibold">Reset your password</h1>
        <p className="mt-2 text-sm text-ink-400">
          Enter the email you signed up with and we&apos;ll send you a reset
          link.
        </p>

        {sent ? (
          <div className="mt-8 rounded-md border border-green-500/30 bg-green-500/5 px-4 py-4 text-sm text-green-300">
            Check <strong>{email}</strong> for a reset link. It expires in 1
            hour.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-ink-300">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@iit.ac.in"
                className="input"
              />
            </label>

            {error && (
              <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-brand-300 disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <p className="text-center text-sm text-ink-400">
              Remembered it?{" "}
              <Link href="/signin" className="text-brand-300 hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </main>
    </>
  );
}
