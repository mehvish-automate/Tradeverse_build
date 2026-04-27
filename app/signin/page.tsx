"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Nav } from "@/components/Nav";
import { signInUniversal } from "@/lib/auth";
import { registerOwnCode } from "@/lib/referral";

export default function SigninPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-6 py-16">
        <Suspense fallback={null}>
          <SigninForm />
        </Suspense>
      </main>
    </>
  );
}

function SigninForm() {
  const router = useRouter();
  const search = useSearchParams();
  const prefilledError = search.get("err");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(prefilledError);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await signInUniversal({ email, password });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    registerOwnCode(email.trim().toLowerCase(), email.split("@")[0]);
    router.push("/profile");
  }

  return (
    <>
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-400">
        Pick up your streak where you left off.
      </p>

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

        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink-300">
            Password
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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
          {loading ? "Working…" : "Sign in"}
        </button>

        <p className="text-center text-sm text-ink-400">
          New to TradeVerse?{" "}
          <Link href="/signup" className="text-brand-300 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </>
  );
}
