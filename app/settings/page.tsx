"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { getInstitute, INSTITUTES } from "@/lib/clubs";
import { getHomeInstitute, setHomeInstitute } from "@/lib/onboarding";
import {
  Prefs,
  deleteUserData,
  exportUserData,
  getPrefs,
  renameDisplayName,
  setPrefs,
} from "@/lib/prefs";
import { useSession } from "@/lib/session";

export default function SettingsPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <RequireAuth>
          <SettingsInner />
        </RequireAuth>
      </main>
    </>
  );
}

function SettingsInner() {
  const router = useRouter();
  const { user, signOut, refresh } = useSession();
  const [prefs, setP] = useState<Prefs | null>(null);
  const [name, setName] = useState("");
  const [instId, setInstId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setP(getPrefs(user.email));
    setName(user.displayName);
    setInstId(getHomeInstitute(user.email) ?? "");
  }, [user]);

  if (!user || !prefs) return null;

  function togglePref(k: keyof Prefs) {
    if (!user || !prefs) return;
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(user.email, { [k]: next[k] });
    setP(next);
  }

  function saveName() {
    setMsg(null);
    setErr(null);
    if (name.trim() === user!.displayName) return;
    const ok = renameDisplayName(user!.email, name);
    if (!ok) {
      setErr("Name must be 2–40 characters.");
      return;
    }
    refresh();
    setMsg("Display name updated.");
  }

  function saveInstitute(id: string) {
    setInstId(id);
    setHomeInstitute(user!.email, id);
    setMsg(id ? "Home institute updated." : "Home institute cleared.");
  }

  function download() {
    const json = exportUserData(user!.email);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tradeverse-${user!.email.split("@")[0]}-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function confirmDelete() {
    const phrase = prompt(
      `This wipes your TradeVerse data on this device. Type DELETE to confirm.`,
    );
    if (phrase !== "DELETE") return;
    deleteUserData(user!.email);
    signOut();
    router.push("/");
  }

  return (
    <>
      <div className="mb-8">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-brand-300">
          Account
        </div>
        <h1 className="mt-1 text-3xl font-semibold">Settings</h1>
      </div>

      {msg && (
        <p className="mb-4 rounded-md border border-brand-500/40 bg-brand-500/5 px-3 py-2 text-sm text-brand-200">
          {msg}
        </p>
      )}
      {err && (
        <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-300">
          {err}
        </p>
      )}

      <Section title="Profile">
        <Row label="Email">
          <span className="text-sm text-ink-300">{user.email}</span>
        </Row>
        <Row label="Display name">
          <div className="flex items-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input max-w-xs"
              minLength={2}
              maxLength={40}
            />
            <button
              onClick={saveName}
              disabled={name.trim() === user.displayName}
              className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </Row>
        <Row label="Home institute">
          <select
            value={instId}
            onChange={(e) => saveInstitute(e.target.value)}
            className="input max-w-sm"
          >
            <option value="">— None —</option>
            {INSTITUTES.map((i) => (
              <option key={i.id} value={i.id}>
                {i.short} — {i.name}
              </option>
            ))}
          </select>
          {instId && (
            <div className="mt-1 text-xs text-ink-500">
              {getInstitute(instId)?.city}
            </div>
          )}
        </Row>
      </Section>

      <Section title="Notifications">
        <Toggle
          label="Streak reminders"
          description="Nudge when you're about to break your streak."
          on={prefs.notifyStreak}
          onToggle={() => togglePref("notifyStreak")}
        />
        <Toggle
          label="Fest transitions"
          description="Pings when fests you joined go live or end soon."
          on={prefs.notifyFest}
          onToggle={() => togglePref("notifyFest")}
        />
        <Toggle
          label="Quest rewards"
          description="Claimable quest alerts."
          on={prefs.notifyQuests}
          onToggle={() => togglePref("notifyQuests")}
        />
        <Toggle
          label="Rival activity"
          description="Someone passed you, or you passed someone."
          on={prefs.notifyRivals}
          onToggle={() => togglePref("notifyRivals")}
        />
        <Toggle
          label="Weekly digest email"
          description="A once-a-week summary in your inbox (email coming with the backend)."
          on={prefs.weeklyDigestEmail}
          onToggle={() => togglePref("weeklyDigestEmail")}
        />
        <p className="mt-3 text-xs text-ink-500">
          V1: preferences are saved but the push/email bridge lands with the
          backend.
        </p>
      </Section>

      <Section title="Data">
        <p className="text-sm text-ink-300">
          Export everything we have on you — it&apos;s currently just this
          browser&apos;s localStorage — or wipe your account on this device.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={download}
            className="rounded-md border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
          >
            Download data (JSON)
          </button>
          <button
            onClick={confirmDelete}
            className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20"
          >
            Delete my account
          </button>
        </div>
      </Section>

      <div className="mt-10">
        <Link
          href="/profile"
          className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-100 hover:bg-ink-900"
        >
          Back to profile
        </Link>
      </div>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8 rounded-2xl border border-ink-700 bg-ink-900/40 p-6">
      <h2 className="text-sm font-medium uppercase tracking-wider text-ink-400">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-ink-300">{label}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  description,
  on,
  onToggle,
}: {
  label: string;
  description: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink-100">{label}</div>
        <div className="text-xs text-ink-500">{description}</div>
      </div>
      <button
        onClick={onToggle}
        aria-pressed={on}
        className={
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition " +
          (on ? "bg-brand-500" : "bg-ink-800")
        }
      >
        <span
          className={
            "inline-block h-4 w-4 transform rounded-full bg-ink-950 transition " +
            (on ? "translate-x-6" : "translate-x-1")
          }
        />
      </button>
    </div>
  );
}
