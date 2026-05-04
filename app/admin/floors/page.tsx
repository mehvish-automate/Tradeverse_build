"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { isAdminLocal } from "@/lib/supabase/sync";
import {
  listPendingTradeFloors,
  setTradeFloorStatus,
} from "@/lib/supabase/writes";

type PendingRow = {
  id: string;
  name: string;
  privacy: "public" | "private";
  member_cap: number;
  virtual_capital: number;
  market_region: string;
  created_by: string;
  created_at: string;
};

export default function AdminFloorsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <RequireAuth>
          <Inner />
        </RequireAuth>
      </main>
    </>
  );
}

function Inner() {
  const { user } = useSession();
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const data = await listPendingTradeFloors();
    setRows(data ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!user) return null;
  const admin = isAdminLocal(user.email);

  if (!admin) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Not authorized</h1>
        <p className="mt-2 text-sm text-ink-400">
          This page is only visible to admins. If you should have access, set{" "}
          <code className="rounded bg-ink-900 px-1 text-ink-200">
            profiles.is_admin = true
          </code>{" "}
          on your row in Supabase, then sign out and back in.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block btn-ghost"
        >
          Back to profile
        </Link>
      </div>
    );
  }

  async function decide(id: string, next: "live" | "rejected") {
    setBusyId(id);
    const ok = await setTradeFloorStatus(id, next);
    setBusyId(null);
    if (ok) void refresh();
  }

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Admin
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Trade floor approvals</h1>
        <p className="mt-2 text-sm text-ink-400">
          Public floors and private floors above 15 members land here for
          review. Approve to set status &quot;live&quot;, reject to mark
          rejected.
        </p>
      </div>

      {rows === null && (
        <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
          Loading…
        </div>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
          Nothing pending. ✨
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-50">{r.name}</span>
                  <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
                    {r.privacy}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-ink-500">
                  Code {r.id} · cap {r.member_cap} · ₹
                  {(r.virtual_capital / 100000).toFixed(0)}L paper ·{" "}
                  {r.market_region} · created{" "}
                  {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void decide(r.id, "rejected")}
                  className="rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => void decide(r.id, "live")}
                  className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-brand-300 disabled:opacity-50"
                >
                  {busyId === r.id ? "Working…" : "Approve"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
