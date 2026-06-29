"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { CATEGORIES, INSTITUTES, InstituteCategory } from "@/lib/clubs";
import { markOnboarded, setHomeInstitute } from "@/lib/onboarding";
import { useSession } from "@/lib/session";

type Step = "welcome" | "institute" | "ready";

export default function WelcomePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-14">
        <RequireAuth>
          <WelcomeInner />
        </RequireAuth>
      </main>
    </>
  );
}

function WelcomeInner() {
  const router = useRouter();
  const { user } = useSession();
  const [step, setStep] = useState<Step>("welcome");
  const [picked, setPicked] = useState<string | null>(null);
  const [category, setCategory] = useState<InstituteCategory | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INSTITUTES.filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (!q ||
          i.name.toLowerCase().includes(q) ||
          i.short.toLowerCase().includes(q) ||
          i.city.toLowerCase().includes(q)),
    );
  }, [category, query]);

  if (!user) return null;

  function finish() {
    if (!user) return;
    if (picked) setHomeInstitute(user.email, picked);
    markOnboarded(user.email);
    router.push("/play");
  }

  return (
    <>
      <Progress step={step} />

      {step === "welcome" && (
        <section className="mt-8 rounded-2xl border border-brand-500/40 bg-brand-500/5 p-8">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Welcome, @{user.displayName}
          </div>
          <h1 className="mt-2 text-3xl font-semibold md:text-4xl">
            3-minute setup, then the first challenge.
          </h1>
          <p className="mt-3 max-w-xl text-ink-300">
            TradeVerse is a skill platform on the Indian market, not a trading
            app. Your money stays in your bank; your XP, streaks, and rank
            live here. We&apos;ll get you into a daily run in two taps.
          </p>

          <ul className="mt-6 space-y-2 text-sm text-ink-300">
            <li className="flex gap-2">
              <span className="text-brand-300">✓</span>
              <span>Play today&apos;s 5-question chart challenge.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-300">✓</span>
              <span>Build a paper portfolio or join an event.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-brand-300">✓</span>
              <span>Invite friends into a Quiz Floor — race them weekly.</span>
            </li>
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => setStep("institute")}
              className="rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              Continue →
            </button>
            <button
              onClick={finish}
              className="rounded-lg border border-ink-700 px-5 py-3 text-sm text-ink-100 hover:bg-ink-900"
            >
              Skip setup
            </button>
          </div>
        </section>
      )}

      {step === "institute" && (
        <section className="mt-8 rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            Step 2 · Your institute
          </div>
          <h2 className="mt-2 text-2xl font-semibold">
            Where do you study (or work)?
          </h2>
          <p className="mt-2 text-sm text-ink-400">
            Optional — we&apos;ll show you clubs and fests at your institute
            first. You can change this later.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="Search by name, code, or city"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...CATEGORIES] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c as InstituteCategory | "all")}
                  className={
                    "rounded-md border px-2.5 py-1 text-xs transition " +
                    (category === c
                      ? "border-brand-500 bg-brand-500/10 text-brand-200"
                      : "border-ink-700 text-ink-300 hover:border-ink-500")
                  }
                >
                  {c === "all" ? "All" : c}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
            {filtered.slice(0, 30).map((i) => (
              <li key={i.id}>
                <button
                  onClick={() => setPicked(i.id)}
                  className={
                    "w-full rounded-lg border px-4 py-3 text-left transition " +
                    (picked === i.id
                      ? "border-brand-500 bg-brand-500/10"
                      : "border-ink-700 hover:border-ink-500")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-ink-50">{i.short}</div>
                      <div className="truncate text-xs text-ink-500">
                        {i.name} · {i.city}
                      </div>
                    </div>
                    <span className="rounded-md bg-ink-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
                      {i.category}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {filtered.length > 30 && (
            <p className="mt-2 text-xs text-ink-500">
              Showing first 30 of {filtered.length} — refine your search.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => setStep("ready")}
              className="rounded-lg bg-brand-500 px-5 py-3 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              {picked ? "Continue →" : "Skip this"}
            </button>
            <button
              onClick={() => setStep("welcome")}
              className="rounded-lg border border-ink-700 px-5 py-3 text-sm text-ink-100 hover:bg-ink-900"
            >
              Back
            </button>
          </div>
        </section>
      )}

      {step === "ready" && (
        <section className="mt-8 rounded-2xl border border-brand-500/40 bg-brand-500/5 p-8 text-center">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
            You&apos;re set
          </div>
          <div className="mt-3 text-5xl">🎯</div>
          <h2 className="mt-4 text-2xl font-semibold md:text-3xl">
            Ready for today&apos;s chart challenge?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-ink-300">
            5 questions. ~5 minutes. Answer correctly + fast for bonus XP. Then
            come back tomorrow to start a streak.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={finish}
              className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-medium text-ink-950 hover:bg-brand-300"
            >
              Start today&apos;s challenge →
            </button>
            <Link
              href="/profile"
              onClick={() => markOnboarded(user!.email)}
              className="rounded-lg border border-ink-700 px-5 py-3 text-sm text-ink-100 hover:bg-ink-900"
            >
              Explore my profile first
            </Link>
          </div>
        </section>
      )}
    </>
  );
}

function Progress({ step }: { step: Step }) {
  const steps: Step[] = ["welcome", "institute", "ready"];
  const cur = steps.indexOf(step);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div
          key={s}
          className={
            "h-1 flex-1 rounded-full " +
            (i <= cur ? "bg-brand-500" : "bg-ink-800")
          }
        />
      ))}
    </div>
  );
}
