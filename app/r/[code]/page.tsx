"use client";

// Public registration link target (/r/<code>). No account required — a
// prospect registers interest and is nudged to create an account. The
// event name is passed via ?e= so the page reads well even when the
// fest isn't in this visitor's local store.

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Nav } from "@/components/Nav";
import { EV, track } from "@/lib/analytics";
import { getFest } from "@/lib/fests";
import { NewRegistration, registrationProvider, validateRegistration } from "@/lib/registrations";

export default function RegisterPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-lg px-6 py-12">
        <Suspense fallback={null}>
          <Inner />
        </Suspense>
      </main>
    </>
  );
}

function Inner() {
  const params = useParams<{ code: string }>();
  const search = useSearchParams();
  const code = params?.code ? String(params.code).toUpperCase() : "";
  const nameFromQuery = search?.get("e") ?? "";
  const localFest = code ? getFest(code) : null;
  const eventName = nameFromQuery || localFest?.name || "this event";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input: NewRegistration = { festId: code, name, email, phone: phone || undefined };
    const err = validateRegistration(input);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await registrationProvider().create(input);
      track(EV.register, { festId: code });
      setDone(true);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Could not register. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-8 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="mt-3 text-2xl font-semibold">You&apos;re registered</h1>
        <p className="mt-2 text-sm text-ink-300">
          We&apos;ve saved your spot for <strong>{eventName}</strong>. Create a
          free TradeVerse account to actually play when it goes live.
        </p>
        <Link
          href={`/signup?ref=${encodeURIComponent(code)}`}
          className="mt-6 inline-block rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-ink-950 hover:bg-brand-300"
        >
          Create my account →
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
        Registration
      </div>
      <h1 className="mt-1 text-3xl font-semibold">Register for {eventName}</h1>
      <p className="mt-2 text-sm text-ink-400">
        Pop your details in and we&apos;ll hold your spot. No payment, no real
        money — TradeVerse is a pure skill platform.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Your name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aanya Sharma"
            required
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            required
          />
        </Field>
        <Field label="Phone (optional)">
          <input
            type="tel"
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98xxxxxxx"
          />
        </Field>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-ink-950 hover:bg-brand-300 disabled:opacity-50"
        >
          {submitting ? "Registering…" : "Register"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-ink-500">
        Already have an account?{" "}
        <Link href="/signin" className="text-brand-300 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-300">{label}</span>
      {children}
    </label>
  );
}
