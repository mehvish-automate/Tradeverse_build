"use client";

// Thin wrapper over the browser Notification + ServiceWorker APIs.
// V1: we register the SW and drive local notifications via
// registration.showNotification(). Server-driven push (VAPID +
// subscription store) slots in after the backend lands.

export type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function notificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function currentPermission(): PermissionState {
  if (!notificationSupported()) return "unsupported";
  return Notification.permission as PermissionState;
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!notificationSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch {
    return null;
  }
}

export async function requestPermission(): Promise<PermissionState> {
  if (!notificationSupported()) return "unsupported";
  const res = await Notification.requestPermission();
  return res as PermissionState;
}

// --- Phase 66: server push (VAPID) ---

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Push is wired only when a VAPID public key is configured. */
export function pushConfigured(): boolean {
  return !!VAPID_PUBLIC;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!notificationSupported()) return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  return !!(await reg.pushManager.getSubscription());
}

/** Request permission, subscribe via the SW push manager, mirror to cloud. */
export async function subscribeToPush(): Promise<{ ok: boolean; error?: string }> {
  if (!notificationSupported()) {
    return { ok: false, error: "Notifications aren't supported on this device." };
  }
  if (!VAPID_PUBLIC) {
    return { ok: false, error: "Push isn't configured yet (missing VAPID key)." };
  }
  const perm = await requestPermission();
  if (perm !== "granted") return { ok: false, error: "Permission denied." };

  const reg = (await registerSW()) ?? (await navigator.serviceWorker.ready);
  if (!reg) return { ok: false, error: "Service worker unavailable." };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  const { mirrorSubscription } = await import("./supabase/push-sync");
  await mirrorSubscription(sub);
  return { ok: true };
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!notificationSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = reg ? await reg.pushManager.getSubscription() : null;
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    const { removeSubscription } = await import("./supabase/push-sync");
    await removeSubscription(endpoint);
  }
}

/** Ask the server to push a test notification to this user's devices. */
export async function sendTestPush(): Promise<{ ok: boolean; sent?: number; error?: string }> {
  try {
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "TradeVerse",
        message: "Push is working — see you on the daily challenge.",
        target: "/play",
      }),
    });
    const data = (await res.json()) as { sent?: number; configured?: boolean };
    if (data.configured === false) {
      return { ok: false, error: "Server push isn't configured (VAPID keys missing)." };
    }
    return { ok: true, sent: data.sent ?? 0 };
  } catch {
    return { ok: false, error: "Could not reach the push endpoint." };
  }
}

/**
 * Show a one-off notification via the active SW (works even when the
 * tab is backgrounded or closed after SW activation — with a caveat
 * on iOS Safari where SW notifications require the user to add the
 * PWA to the home screen first).
 */
export async function showLocalNotification(
  title: string,
  body: string,
  url = "/inbox",
): Promise<boolean> {
  if (!notificationSupported()) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await reg.showNotification(title, {
        body,
        icon: "/icon-192.svg",
        badge: "/icon.svg",
        data: { url },
      });
      return true;
    }
    // Fallback: page-level notification (won't outlive the tab).
    new Notification(title, { body, icon: "/icon-192.svg" });
    return true;
  } catch {
    return false;
  }
}

// --- Streak-reminder scheduling (local, best-effort) ---
//
// We schedule a single recurring setTimeout that fires every ~minute
// while a tab is open; when the clock crosses the user's configured
// time and they haven't played today, we show a local notification.
// This is best-effort — a real backend push delivers reliability
// even when no tab is open.

const REMINDER_KEY = (email: string) => `tv.reminder.${email}`;

export type ReminderPrefs = {
  enabled: boolean;
  hour: number; // 0–23, local time
  minute: number; // 0–59
};

const DEFAULT_REMINDER: ReminderPrefs = { enabled: false, hour: 19, minute: 30 };

export function getReminder(email: string): ReminderPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_REMINDER };
  try {
    const raw = localStorage.getItem(REMINDER_KEY(email));
    if (!raw) return { ...DEFAULT_REMINDER };
    return { ...DEFAULT_REMINDER, ...(JSON.parse(raw) as Partial<ReminderPrefs>) };
  } catch {
    return { ...DEFAULT_REMINDER };
  }
}

export function setReminder(email: string, patch: Partial<ReminderPrefs>) {
  const next = { ...getReminder(email), ...patch };
  localStorage.setItem(REMINDER_KEY(email), JSON.stringify(next));
}

const LAST_FIRED_KEY = (email: string) => `tv.reminder.fired.${email}`;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Called every minute from a persistent hook. Fires a local
 * notification the first time "now" crosses the configured reminder
 * time on a given day when the user hasn't played yet.
 */
export async function tickReminder(
  email: string,
  hasPlayedToday: boolean,
): Promise<void> {
  if (!notificationSupported()) return;
  if (Notification.permission !== "granted") return;
  const prefs = getReminder(email);
  if (!prefs.enabled) return;

  const now = new Date();
  const crossedTime =
    now.getHours() * 60 + now.getMinutes() >= prefs.hour * 60 + prefs.minute;
  if (!crossedTime) return;
  if (hasPlayedToday) return;

  const lastFired = localStorage.getItem(LAST_FIRED_KEY(email));
  if (lastFired === todayStr()) return;

  const ok = await showLocalNotification(
    "Don't break your streak",
    "Today's 5-question chart challenge is waiting. ~5 minutes.",
    "/play",
  );
  if (ok) localStorage.setItem(LAST_FIRED_KEY(email), todayStr());
}
