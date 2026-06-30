"use client";

// Organizer registrations dashboard (host-only). Shows everyone who
// registered via the /r/<code> link, with the shareable link, CSV export,
// copy-emails, and a "message all" seam (templated comms land in the
// comms phase). Reads through the active RegistrationProvider.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Skeleton } from "@/components/Skeleton";
import { Fest, getFest } from "@/lib/fests";
import {
  Registration,
  registrationProvider,
  registrationsToCsv,
} from "@/lib/registrations";
import { whatsappShareUrl } from "@/lib/shareCards";
import { useSession } from "@/lib/session";

export default function RegistrationsPage() {
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
  const params = useParams<{ code: string }>();
  const code = params?.code ? String(params.code).toUpperCase() : "";

  const [fest, setFest] = useState<Fest | null | undefined>(undefined);
  const [rows, setRows] = useState<Registration[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    setFest(getFest(code) ?? null);
  }, [code]);

  const refresh = useCallback(async () => {
    if (!fest) return;
    const list = await registrationProvider().list(fest.id);
    setRows(list);
  }, [fest]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const link = useMemo(
    () => (fest ? registrationProvider().linkFor(fest.id, fest.name) : ""),
    [fest],
  );

  if (!user || fest === undefined) return null;

  if (fest === null) {
    return (
      <Shell title="Not found">
        <p className="text-sm text-ink-400">No event matches that code on this device.</p>
      </Shell>
    );
  }

  const isHost = fest.createdBy === user.email;
  if (!isHost) {
    return (
      <Shell title="Organizer only">
        <p className="text-sm text-ink-400">
          Only the event host can see registrations.
        </p>
        <Link href={`/fests/${fest.id}`} className="mt-4 inline-block btn-ghost">
          Back to event
        </Link>
      </Shell>
    );
  }

  async function copy(text: string, tag: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  function downloadCsv() {
    if (!rows || rows.length === 0) return;
    const blob = new Blob([registrationsToCsv(rows)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fest!.id}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const emails = (rows ?? []).map((r) => r.email).join(", ");

  return (
    <>
      <div className="mb-2 text-xs">
        <Link href={`/fests/${fest.id}`} className="text-ink-400 hover:text-ink-100">
          ← {fest.name}
        </Link>
      </div>
      <h1 className="text-3xl font-semibold">Registrations</h1>
      <p className="mt-1 text-sm text-ink-400">
        Share your registration link to capture sign-ups for{" "}
        <strong>{fest.name}</strong>. {rows?.length ?? 0} registered so far.
      </p>

      {/* Share link */}
      <section className="mt-6 rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/10 to-transparent p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-brand-300">
          Registration link
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-xs text-ink-200">
            {link}
          </code>
          <button onClick={() => copy(link, "link")} className="btn-ghost shrink-0">
            {copied === "link" ? "Copied" : "Copy"}
          </button>
          <a
            href={whatsappShareUrl(`Register for ${fest.name} on TradeVerse:`, link)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-ink-950 hover:bg-brand-300"
          >
            Share on WhatsApp
          </a>
        </div>
      </section>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={downloadCsv}
          disabled={!rows || rows.length === 0}
          className="btn-ghost disabled:opacity-50"
        >
          Export CSV
        </button>
        <button
          onClick={() => copy(emails, "emails")}
          disabled={!rows || rows.length === 0}
          className="btn-ghost disabled:opacity-50"
        >
          {copied === "emails" ? "Copied" : "Copy all emails"}
        </button>
        <a
          href={`mailto:?bcc=${encodeURIComponent(emails)}`}
          className={
            "btn-ghost " + (!rows || rows.length === 0 ? "pointer-events-none opacity-50" : "")
          }
        >
          Email all
        </a>
      </div>
      <p className="mt-2 text-xs text-ink-500">
        Templated broadcasts (email / WhatsApp / push) land in the comms phase —
        for now, export or email the list directly.
      </p>

      {/* List */}
      <section className="mt-6 rounded-2xl border border-ink-700 bg-ink-900/40">
        <header className="border-b border-ink-700/70 px-5 py-3 text-xs font-medium uppercase tracking-wider text-ink-400">
          Registrants
        </header>
        {rows === null ? (
          <div className="px-5 py-4">
            <Skeleton lines={3} />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-ink-400">
            No registrations yet. Share the link above to get started.
          </div>
        ) : (
          <ul className="divide-y divide-ink-900">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink-50">{r.name}</div>
                  <div className="truncate text-xs text-ink-500">
                    {r.email}
                    {r.phone ? ` · ${r.phone}` : ""}
                    {r.source ? ` · via ${r.source}` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-ink-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-xs text-ink-500">
        Registrations sync across devices once Supabase is configured;
        otherwise this shows the ones captured on this device.
      </p>
    </>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900/40 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-2">{children}</div>
    </div>
  );
}
