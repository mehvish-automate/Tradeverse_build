"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Nav } from "@/components/Nav";
import { RequireAuth } from "@/components/RequireAuth";
import { getInstitute, INSTITUTES } from "@/lib/clubs";
import { getHomeInstitute, setHomeInstitute } from "@/lib/onboarding";
import { supabaseConfigured, getBrowserSupabase } from "@/lib/supabase/client";
import { signOutEverywhere } from "@/lib/auth";
import {
  pullDailyResults,
  syncDailyResults,
  syncProfile,
} from "@/lib/supabase/sync";
import {
  Prefs,
  deleteUserData,
  exportUserData,
  getPrefs,
  renameDisplayName,
  setPrefs,
} from "@/lib/prefs";
import { useSession } from "@/lib/session";
import {
  PermissionState,
  currentPermission,
  getReminder,
  notificationSupported,
  registerSW,
  requestPermission,
  setReminder,
  showLocalNotification,
} from "@/lib/webPush";

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
  const [perm, setPerm] = useState<PermissionState>("default");
  const [reminderOn, setReminderOn] = useState(false);
  const [remH, setRemH] = useState(19);
  const [remM, setRemM] = useState(30);

  useEffect(() => {
    if (!user) return;
    setP(getPrefs(user.email));
    setName(user.displayName);
    setInstId(getHomeInstitute(user.email) ?? "");
    setPerm(currentPermission());
    const r = getReminder(user.email);
    setReminderOn(r.enabled);
    setRemH(r.hour);
    setRemM(r.minute);
  }, [user]);

  async function enablePush() {
    if (!user) return;
    setMsg(null);
    setErr(null);
    await registerSW();
    const p = await requestPermission();
    setPerm(p);
    if (p === "granted") setMsg("Notifications enabled.");
    else if (p === "denied")
      setErr("Browser blocked notifications. Unblock in site settings to retry.");
  }

  function saveReminder(patch: Partial<{ enabled: boolean; hour: number; minute: number }>) {
    if (!user) return;
    const next = {
      enabled: patch.enabled ?? reminderOn,
      hour: patch.hour ?? remH,
      minute: patch.minute ?? remM,
    };
    setReminder(user.email, next);
    setReminderOn(next.enabled);
    setRemH(next.hour);
    setRemM(next.minute);
  }

  async function testNotif() {
    const ok = await showLocalNotification(
      "TradeVerse test",
      "If you see this, local notifications are working.",
      "/inbox",
    );
    if (!ok) setErr("Can't show a test — check that notifications are enabled.");
  }

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

  async function confirmDelete() {
    const phrase = prompt(
      `This wipes your TradeVerse data on this device. Type DELETE to confirm.`,
    );
    if (phrase !== "DELETE") return;
    deleteUserData(user!.email);
    await signOutEverywhere();
    signOut(); // refresh in-memory session state
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

      <CloudSection />

      <Section title="Push & reminders">
        {notificationSupported() ? (
          <>
            <Row label="Browser notifications">
              <div className="flex items-center gap-3">
                <span
                  className={
                    "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                    (perm === "granted"
                      ? "bg-brand-500/15 text-brand-300"
                      : perm === "denied"
                        ? "bg-red-500/15 text-red-300"
                        : "bg-ink-800 text-ink-400")
                  }
                >
                  {perm}
                </span>
                {perm !== "granted" && (
                  <button
                    onClick={enablePush}
                    className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-brand-300"
                  >
                    Enable
                  </button>
                )}
                {perm === "granted" && (
                  <button
                    onClick={testNotif}
                    className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-900"
                  >
                    Test notification
                  </button>
                )}
              </div>
            </Row>

            <Row label="Daily streak reminder">
              <div className="flex flex-wrap items-center gap-2 text-sm text-ink-200">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reminderOn}
                    onChange={(e) => saveReminder({ enabled: e.target.checked })}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span>Remind me at</span>
                </label>
                <input
                  type="time"
                  value={`${String(remH).padStart(2, "0")}:${String(remM).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    saveReminder({ hour: h, minute: m });
                  }}
                  disabled={!reminderOn}
                  className="input max-w-[120px] disabled:opacity-50"
                />
                <span className="text-xs text-ink-500">
                  fires once per day if you haven&apos;t played yet
                </span>
              </div>
            </Row>
          </>
        ) : (
          <p className="text-sm text-ink-400">
            This browser doesn&apos;t support web notifications. Install the
            PWA for a better experience.
          </p>
        )}
      </Section>

      <Section title="Alert types">
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

function CloudSection() {
  const [state, setState] = useState<
    "missing" | "signed-out" | "signed-in"
  >("missing");
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!supabaseConfigured()) {
      setState("missing");
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (!data.user) setState("signed-out");
      else {
        setState("signed-in");
        setEmail(data.user.email ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function syncNow() {
    setBusy(true);
    setMsg(null);
    await syncProfile();
    const pulled = await pullDailyResults();
    const pushed = await syncDailyResults();
    setBusy(false);
    setMsg(
      `Synced — pulled ${pulled} result${pulled === 1 ? "" : "s"} from cloud, pushed ${pushed}.`,
    );
  }

  return (
    <Section title="Cloud sync">
      {state === "missing" ? (
        <p className="text-sm text-ink-400">
          Supabase isn&apos;t configured on this device — the app is running
          in local-only mode. See <code className="text-ink-200">BACKEND.md</code>{" "}
          to wire it up.
        </p>
      ) : state === "signed-out" ? (
        <p className="text-sm text-ink-400">
          Backend configured. Sign in with the magic-link flow to sync
          across devices.
        </p>
      ) : (
        <>
          <p className="text-sm text-ink-300">
            Signed in as <span className="text-ink-100">{email}</span>. Your
            progress syncs to the cloud every minute and on each play.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={syncNow}
              disabled={busy}
              className="rounded-md border border-ink-700 px-3 py-1.5 text-xs text-ink-200 hover:bg-ink-900 disabled:opacity-40"
            >
              {busy ? "Syncing…" : "Sync now"}
            </button>
          </div>
          {msg && (
            <p className="mt-2 text-xs text-brand-300">{msg}</p>
          )}
        </>
      )}
    </Section>
  );
}
