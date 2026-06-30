"use client";

// Admin broadcast composer (Phase 67). Send an in-app broadcast to all
// users or to a specific event's participants; it lands in recipients'
// inboxes. Email/WhatsApp to a registrant list lives on the event's
// registrations dashboard (where the recipient emails are).

import Link from "next/link";
import { useEffect, useState } from "react";

import { CommsComposer } from "@/components/CommsComposer";
import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { Skeleton } from "@/components/Skeleton";
import { Campaign, CommsAudience, campaignLog } from "@/lib/comms";
import { useSession } from "@/lib/session";
import { fetchIsAdmin, isAdminLocal } from "@/lib/supabase/sync";

export default function AdminCommsPage() {
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

function Inner() {
  const { user } = useSession();
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [audience, setAudience] = useState<CommsAudience>("all");
  const [code, setCode] = useState("");
  const [log, setLog] = useState<Campaign[]>([]);

  useEffect(() => {
    if (!user) return;
    if (isAdminLocal(user.email)) {
      setAdmin(true);
      return;
    }
    let cancelled = false;
    setAdmin(null);
    void fetchIsAdmin().then((v) => !cancelled && setAdmin(v));
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    setLog(campaignLog());
  }, []);

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
          Admins only. Set{" "}
          <code className="rounded bg-ink-900 px-1 text-ink-200">
            NEXT_PUBLIC_ADMIN_EMAILS={user.email}
          </code>{" "}
          and redeploy, or flip{" "}
          <code className="rounded bg-ink-900 px-1 text-ink-200">
            profiles.is_admin
          </code>
          .
        </p>
        <Link href="/profile" className="mt-4 inline-block btn-ghost">
          Back to profile
        </Link>
      </div>
    );
  }

  const audienceRef = audience === "event" ? code.trim().toUpperCase() : undefined;
  const label =
    audience === "all" ? "all users" : audienceRef ? `event ${audienceRef}` : "an event";

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Admin
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Broadcast</h1>
        <p className="mt-2 text-sm text-ink-400">
          Send an in-app message that lands in recipients&apos; inboxes.{" "}
          <Link href="/admin/fests" className="text-brand-300 hover:underline">
            Approvals →
          </Link>
        </p>
      </div>

      <section className="rounded-2xl border border-ink-700 bg-ink-900/40 p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <AudienceBtn on={audience === "all"} onClick={() => setAudience("all")}>
            All users
          </AudienceBtn>
          <AudienceBtn on={audience === "event"} onClick={() => setAudience("event")}>
            Event participants
          </AudienceBtn>
        </div>
        {audience === "event" && (
          <input
            className="input mb-3 font-mono tracking-widest"
            placeholder="EVENT CODE"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
        )}

        <CommsComposer
          audience={audience}
          audienceRef={audienceRef}
          label={label}
          channels={["inapp"]}
          onSent={() => setLog(campaignLog())}
        />
      </section>

      <h2 className="mt-8 text-sm font-medium uppercase tracking-wider text-ink-400">
        Recent campaigns
      </h2>
      {log.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">No campaigns yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-900 rounded-xl border border-ink-700 bg-ink-900/40">
          {log.map((c) => (
            <li key={c.id} className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium text-ink-100">{c.subject}</span>
                <span className="shrink-0 text-xs text-ink-500">
                  {c.channel} ·{" "}
                  {c.status === "sent" ? "sent" : `queued ${c.recipientCount}`}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-ink-500">
                {c.audience === "all" ? "All users" : `Event ${c.audienceRef}`} ·{" "}
                {new Date(c.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AudienceBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md border px-3 py-1.5 text-xs transition " +
        (on
          ? "border-brand-500 bg-brand-500/10 text-ink-50"
          : "border-ink-700 text-ink-300 hover:border-ink-500")
      }
    >
      {children}
    </button>
  );
}
