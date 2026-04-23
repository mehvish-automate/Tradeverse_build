"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Nav } from "@/components/Nav";
import { registerOwnCode } from "@/lib/referral";
import { signIn } from "@/lib/session";

export default function SigninPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = signIn(email);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    registerOwnCode(result.user.email, result.user.displayName);
    router.push("/profile");
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-6 py-16">
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

          {error && (
            <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-brand-300"
          >
            Sign in
          </button>

          <p className="text-center text-sm text-ink-400">
            New to TradeVerse?{" "}
            <Link href="/signup" className="text-brand-300 hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </main>
    </>
  );
}
