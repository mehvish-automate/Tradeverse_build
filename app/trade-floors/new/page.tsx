"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import {
  AssetClass,
  MarketRegion,
  StockUniverse,
  TradeFloorPrivacy,
  createTradeFloor,
  needsAdminApproval,
} from "@/lib/tradeFloors";
import { writeTradeFloor } from "@/lib/supabase/writes";

export default function NewTradeFloorPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function defaultDateTimeLocal(offsetHours: number): string {
  const d = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  // Slice to YYYY-MM-DDTHH:mm for <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Inner() {
  const router = useRouter();
  const { user } = useSession();

  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<TradeFloorPrivacy>("private");
  const [startStr, setStartStr] = useState(defaultDateTimeLocal(0));
  const [endStr, setEndStr] = useState(defaultDateTimeLocal(24 * 7));
  const [memberCap, setMemberCap] = useState(15);
  const [virtualLakhs, setVirtualLakhs] = useState(10); // 1L–100L
  const [universeKind, setUniverseKind] = useState<
    "nifty50" | "nifty100" | "all"
  >("nifty50");
  const [assetClasses, setAssetClasses] = useState<AssetClass[]>(["stocks"]);
  const [region, setRegion] = useState<MarketRegion>("IN");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const willNeedApproval = useMemo(
    () => needsAdminApproval({ privacy, memberCap }),
    [privacy, memberCap],
  );

  if (!user) return null;

  function toggleClass(c: AssetClass) {
    setAssetClasses((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);

    const startAt = new Date(startStr).getTime();
    const endAt = new Date(endStr).getTime();
    const universe: StockUniverse = { kind: universeKind };
    const virtualCapital = virtualLakhs * 100_000;

    const r = createTradeFloor({
      name,
      creator: { email: user.email, displayName: user.displayName },
      privacy,
      startAt,
      endAt,
      memberCap,
      virtualCapital,
      stockUniverse: universe,
      assetClasses,
      marketRegion: region,
    });

    if (!r.ok) {
      setError(r.error);
      setSubmitting(false);
      return;
    }

    void writeTradeFloor({
      id: r.tradeFloor.id,
      name: r.tradeFloor.name,
      privacy: r.tradeFloor.privacy,
      startAt: r.tradeFloor.startAt,
      endAt: r.tradeFloor.endAt,
      memberCap: r.tradeFloor.memberCap,
      virtualCapital: r.tradeFloor.virtualCapital,
      stockUniverse: r.tradeFloor.stockUniverse,
      assetClasses: r.tradeFloor.assetClasses,
      marketRegion: r.tradeFloor.marketRegion,
      status: r.tradeFloor.status,
      createdByKind: r.tradeFloor.createdByKind,
    });

    setSubmitting(false);
    router.push(`/trade-floors/${r.tradeFloor.id}`);
  }

  return (
    <>
      <div className="mb-2 text-xs">
        <Link href="/trade-floors" className="text-ink-400 hover:text-ink-100">
          ← Trade floors
        </Link>
      </div>
      <h1 className="text-3xl font-semibold">Launch a trade floor</h1>
      <p className="mt-2 text-sm text-ink-400">
        Private floors up to 15 members go live instantly. Public floors and
        private floors above 15 members are reviewed by an admin first.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        {/* Basics */}
        <Section eyebrow="Basics" title="Name & privacy">
          <Field label="Trade floor name">
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="IIM-B Finance Club Q4"
              className="input"
            />
          </Field>
          <RadioRow
            label="Privacy"
            value={privacy}
            onChange={(v) => setPrivacy(v as TradeFloorPrivacy)}
            options={[
              {
                value: "private",
                label: "Private",
                blurb: "Invite-only via 6-char code.",
              },
              {
                value: "public",
                label: "Public",
                blurb: "Anyone with the code can join.",
              },
            ]}
          />
        </Section>

        {/* Schedule */}
        <Section eyebrow="Schedule" title="Run window">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Starts">
              <input
                type="datetime-local"
                required
                value={startStr}
                onChange={(e) => setStartStr(e.target.value)}
                className="input"
              />
            </Field>
            <Field label="Ends">
              <input
                type="datetime-local"
                required
                value={endStr}
                onChange={(e) => setEndStr(e.target.value)}
                className="input"
              />
            </Field>
          </div>
        </Section>

        {/* Capacity */}
        <Section eyebrow="Capacity" title="Member cap">
          <Field label={`Up to ${memberCap} members`}>
            <input
              type="range"
              min={2}
              max={200}
              value={memberCap}
              onChange={(e) => setMemberCap(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-ink-500">
              <span>2</span>
              <span>15 (self-launch limit)</span>
              <span>200</span>
            </div>
          </Field>
        </Section>

        {/* Money */}
        <Section eyebrow="Money" title="Virtual capital per player">
          <Field label={`₹${virtualLakhs}L paper`}>
            <input
              type="range"
              min={1}
              max={100}
              value={virtualLakhs}
              onChange={(e) => setVirtualLakhs(Number(e.target.value))}
              className="w-full"
            />
            <div className="mt-1 flex justify-between text-xs text-ink-500">
              <span>₹1L</span>
              <span>₹10L (default)</span>
              <span>₹1Cr</span>
            </div>
          </Field>
        </Section>

        {/* Universe */}
        <Section eyebrow="Universe" title="What can players trade?">
          <RadioRow
            label="Stock universe"
            value={universeKind}
            onChange={(v) => setUniverseKind(v as typeof universeKind)}
            options={[
              { value: "nifty50", label: "NIFTY 50" },
              { value: "nifty100", label: "NIFTY 100" },
              { value: "all", label: "All listed" },
            ]}
          />
          <div className="mt-4">
            <div className="mb-1.5 block text-xs font-medium text-ink-300">
              Asset classes
            </div>
            <div className="flex flex-wrap gap-2">
              {(["stocks", "etfs", "indices"] as AssetClass[]).map((c) => {
                const on = assetClasses.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleClass(c)}
                    className={
                      "rounded-md border px-3 py-1.5 text-xs uppercase tracking-wider transition " +
                      (on
                        ? "border-brand-500 bg-brand-500/10 text-brand-200"
                        : "border-ink-700 text-ink-300 hover:border-ink-500")
                    }
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>
          <RadioRow
            label="Market region"
            value={region}
            onChange={(v) => setRegion(v as MarketRegion)}
            options={[
              { value: "IN", label: "Indian Market" },
              { value: "UAE", label: "UAE" },
              { value: "US", label: "US" },
              { value: "GLOBAL", label: "Global" },
            ]}
          />
        </Section>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div
          className={
            "rounded-xl border px-4 py-3 text-sm " +
            (willNeedApproval
              ? "border-amber-500/40 bg-amber-500/5 text-amber-200"
              : "border-brand-500/40 bg-brand-500/5 text-brand-200")
          }
        >
          {willNeedApproval ? (
            <>
              <strong>Admin approval required.</strong> Public floors and
              private floors above 15 members are reviewed first. You&apos;ll
              see it under &quot;Pending&quot; until an admin approves.
            </>
          ) : (
            <>
              <strong>Goes live instantly.</strong> Private with a member cap
              of 15 or fewer — no approval needed.
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Link href="/trade-floors" className="btn-ghost">
            Cancel
          </Link>
          <button type="submit" disabled={submitting} className="btn-primary">
            {submitting
              ? "Launching…"
              : willNeedApproval
                ? "Submit for approval"
                : "Launch floor"}
          </button>
        </div>
      </form>
    </>
  );
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
        {eyebrow}
      </div>
      <h2 className="mt-1 text-lg font-semibold text-ink-50">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-ink-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function RadioRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; blurb?: string }[];
}) {
  return (
    <div>
      <div className="mb-1.5 block text-xs font-medium text-ink-300">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={
                "rounded-md border px-3 py-2 text-left text-xs transition " +
                (on
                  ? "border-brand-500 bg-brand-500/10 text-ink-50"
                  : "border-ink-700 text-ink-300 hover:border-ink-500")
              }
            >
              <div className="font-medium">{o.label}</div>
              {o.blurb && (
                <div className="mt-0.5 text-[11px] text-ink-500">
                  {o.blurb}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
