"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { fetchIsAdmin, isAdminLocal } from "@/lib/supabase/sync";
import { Skeleton } from "@/components/Skeleton";
import { decideFest, pendingFestsLocal } from "@/lib/fests";
import { listPendingFests, setFestStatus } from "@/lib/supabase/writes";

// Normalized review row, merged from the cloud queue + this device's
// local store (so quizzes created offline / before a cloud round-trip
// still surface for review).
type Row = {
  id: string;
  name: string;
  privacy: "public" | "private";
  eventType: string;
  difficulty: string;
  categories: string[];
  startDate: string;
  endDate: string;
  createdAt: number;
  origin: "cloud" | "local";
};

export default function AdminFestsPage() {
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
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  // Env allowlist / cached flag grants access immediately; otherwise do an
  // authoritative live DB check (which only ever upgrades to admin, so a
  // missing Supabase session can't flip an allowlisted admin back to false).
  useEffect(() => {
    if (!user) return;
    if (isAdminLocal(user.email)) {
      setAdmin(true);
      return;
    }
    let cancelled = false;
    setAdmin(null);
    void fetchIsAdmin().then((v) => {
      if (!cancelled) setAdmin(v);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const refresh = useCallback(async () => {
    const cloud = (await listPendingFests()) ?? [];
    const cloudRows: Row[] = cloud.map((r) => ({
      id: r.id,
      name: r.name,
      privacy: r.privacy,
      eventType: r.event_type,
      difficulty: r.difficulty,
      categories: r.categories ?? [],
      startDate: r.start_date,
      endDate: r.end_date,
      createdAt: new Date(r.created_at).getTime(),
      origin: "cloud",
    }));
    const localRows: Row[] = pendingFestsLocal().map((f) => ({
      id: f.id,
      name: f.name,
      privacy: f.privacy ?? "private",
      eventType: f.eventType ?? "quiz",
      difficulty: f.difficulty ?? "intermediate",
      categories: f.categories ?? [],
      startDate: f.startDate,
      endDate: f.endDate,
      createdAt: f.createdAt,
      origin: "local",
    }));
    const byId = new Map<string, Row>();
    for (const r of localRows) byId.set(r.id, r);
    for (const r of cloudRows) byId.set(r.id, r); // cloud wins on overlap
    setRows([...byId.values()].sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!user) return null;

  if (admin === null) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <Skeleton lines={2} />
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
        <h1 className="text-xl font-semibold">Not authorized</h1>
        <p className="mt-2 text-sm text-ink-400">
          This page is only visible to admins. Two ways to grant it:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-400">
          <li>
            Quickest — set{" "}
            <code className="rounded bg-ink-900 px-1 text-ink-200">
              NEXT_PUBLIC_ADMIN_EMAILS={user.email}
            </code>{" "}
            in your Vercel env and redeploy (no DB needed).
          </li>
          <li>
            Or set{" "}
            <code className="rounded bg-ink-900 px-1 text-ink-200">
              profiles.is_admin = true
            </code>{" "}
            on your row in Supabase, then reload. Confirm you&apos;re signed in
            with the same email.
          </li>
        </ul>
        <Link href="/profile" className="mt-4 inline-block btn-ghost">
          Back to profile
        </Link>
      </div>
    );
  }

  async function decide(id: string, next: "live" | "rejected", reason?: string) {
    setBusyId(id);
    // Updates the local store (if present) + fire-and-forget cloud mirror.
    const local = decideFest(id, next, reason);
    // Cloud-only pending (not in this device's store) still needs the
    // cloud status written directly.
    if (!local) await setFestStatus(id, next, reason);
    setBusyId(null);
    setRejectingId(null);
    setReason("");
    void refresh();
  }

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Admin
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Quiz Floor &amp; event approvals</h1>
        <p className="mt-2 text-sm text-ink-400">
          Public Quiz Floors and events — plus any private quiz above 100
          participants — land here for review. Approve to set status
          &quot;live&quot;, reject to mark rejected. Private under-100 quizzes
          go live instantly.{" "}
          <Link href="/admin/comms" className="text-brand-300 hover:underline">
            Broadcast →
          </Link>
        </p>
      </div>

      {rows === null && (
        <ul className="divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
          {Array.from({ length: 3 }, (_, i) => (
            <li key={i} className="px-5 py-4">
              <Skeleton lines={2} />
            </li>
          ))}
        </ul>
      )}

      {rows && rows.length === 0 && (
        <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6 text-sm text-ink-400">
          Nothing pending. ✨
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
          {rows.map((r) => (
            <li key={r.id} className="px-5 py-4">
             <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink-50">{r.name}</span>
                  <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
                    {r.privacy}
                  </span>
                  <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
                    {r.eventType}
                  </span>
                  <span className="rounded-md bg-ink-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-400">
                    {r.difficulty}
                  </span>
                  {(r.categories ?? []).map((c) => (
                    <span
                      key={c}
                      className="rounded-md bg-brand-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-brand-300"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <div className="mt-0.5 text-xs text-ink-500">
                  Code {r.id} · {r.startDate} → {r.endDate} · created{" "}
                  {new Date(r.createdAt).toLocaleString()} ·{" "}
                  <span className="uppercase tracking-wider">{r.origin}</span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/fests/${r.id}/edit`}
                  className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 transition hover:bg-ink-900"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  disabled={busyId === r.id}
                  onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)}
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
             </div>

              {rejectingId === r.id && (
                <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                  <label className="block text-xs font-medium text-red-200">
                    Reason for rejection (shown to the host)
                  </label>
                  <input
                    className="input mt-1.5"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Duplicate of an existing quiz; please adjust the dates."
                    maxLength={200}
                    autoFocus
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id || !reason.trim()}
                      onClick={() => void decide(r.id, "rejected", reason)}
                      className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-ink-950 transition hover:bg-red-400 disabled:opacity-50"
                    >
                      {busyId === r.id ? "Working…" : "Confirm reject"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(null);
                        setReason("");
                      }}
                      className="btn-ghost"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
