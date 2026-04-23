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
