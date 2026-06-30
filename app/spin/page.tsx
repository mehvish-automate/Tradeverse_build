"use client";

// Phase 69 — Spin the wheel. One free daily spin (+ earned bonus spins).
// Non-cash prizes only (XP / streak freeze / perk coupon).

import Link from "next/link";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { WHEEL, WheelPrize, spin, wheelStatus } from "@/lib/wheel";

function short(p: WheelPrize): string {
  if (p.kind === "xp") return String(p.xp);
  if (p.kind === "freeze") return "❄️";
  if (p.kind === "coupon") return "🎟️";
  if (p.kind === "bonus") return "↻";
  return "✗";
}

const SEG = 360 / WHEEL.length;

export default function SpinPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<WheelPrize | null>(null);
  const [status, setStatus] = useState({ canSpin: false, freeToday: false, extraSpins: 0 });

  useEffect(() => {
    if (user) setStatus(wheelStatus(user.email));
  }, [user]);

  if (!user) return null;

  const grad = WHEEL.map((s, i) => `${s.color} ${i * SEG}deg ${(i + 1) * SEG}deg`).join(", ");

  function handleSpin() {
    if (spinning || !user) return;
    const r = spin(user.email);
    if (!r) return;
    setResult(null);
    setSpinning(true);
    const centerAngle = r.index * SEG + SEG / 2;
    setRotation((prev) => {
      const base = Math.ceil((prev + 1) / 360) * 360;
      return base + 360 * 5 + (360 - centerAngle);
    });
    window.setTimeout(() => {
      setSpinning(false);
      setResult(r.prize);
      setStatus(wheelStatus(user.email));
    }, 4200);
  }

  return (
    <>
      <div className="mb-2 text-xs">
        <Link href="/quests" className="text-ink-400 hover:text-ink-100">
          ← Quests
        </Link>
      </div>
      <h1 className="text-3xl font-semibold">Spin the wheel</h1>
      <p className="mt-2 text-sm text-ink-400">
        One free spin a day. Prizes are XP, streak freezes and perk coupons —
        never cash.
      </p>

      <div className="relative mx-auto mt-8 h-[280px] w-[280px]">
        {/* pointer */}
        <div className="absolute left-1/2 top-[-6px] z-10 -translate-x-1/2 text-2xl">▼</div>
        <div
          className="h-full w-full rounded-full border-4 border-ink-700 shadow-[0_0_40px_-10px_rgba(16,185,129,0.4)]"
          style={{
            background: `conic-gradient(${grad})`,
            transform: `rotate(${rotation}deg)`,
            transition: "transform 4s cubic-bezier(0.17,0.67,0.16,0.99)",
          }}
        >
          {WHEEL.map((s, i) => {
            const angle = i * SEG + SEG / 2;
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 text-sm font-semibold text-ink-50"
                style={{
                  transform: `rotate(${angle}deg) translateY(-104px)`,
                  transformOrigin: "center",
                }}
              >
                {short(s.prize)}
              </div>
            );
          })}
        </div>
        {/* hub */}
        <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-ink-700 bg-ink-950" />
      </div>

      <div className="mt-8 text-center">
        {result ? (
          <div className="rounded-2xl border border-brand-500/40 bg-brand-500/5 p-5">
            <div className="text-xs uppercase tracking-wider text-brand-300">You won</div>
            <div className="mt-1 text-2xl font-semibold">
              {result.kind === "nothing" ? "Better luck tomorrow" : result.label}
            </div>
            {result.kind === "coupon" && (
              <div className="mt-1 text-xs text-ink-400">
                Find it in your{" "}
                <Link href="/wallet" className="underline">
                  wallet
                </Link>
                .
              </div>
            )}
            {result.kind === "bonus" && (
              <div className="mt-1 text-xs text-ink-400">Spin again — it&apos;s on us.</div>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-500">
            {status.canSpin
              ? status.freeToday
                ? "Your free spin is ready."
                : `${status.extraSpins} bonus spin(s) available.`
              : "No spins left — come back tomorrow."}
          </p>
        )}

        <button
          onClick={handleSpin}
          disabled={spinning || !status.canSpin}
          className="mt-5 rounded-lg bg-brand-500 px-8 py-3 text-sm font-semibold text-ink-950 hover:bg-brand-300 disabled:opacity-40"
        >
          {spinning ? "Spinning…" : status.canSpin ? "Spin" : "No spins left"}
        </button>
      </div>
    </>
  );
}
