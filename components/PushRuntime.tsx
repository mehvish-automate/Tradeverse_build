"use client";

import { useEffect } from "react";

import { hasPlayedToday } from "@/lib/progress";
import { useSession } from "@/lib/session";
import { notificationSupported, registerSW, tickReminder } from "@/lib/webPush";

/**
 * Runtime hooks that live above the whole app:
 *  - register the service worker once per session
 *  - tick the daily-streak reminder every minute while a tab is open
 *
 * Silent when notifications aren't supported / granted.
 */
export function PushRuntime() {
  const { user } = useSession();

  // SW registration — one-shot per tab lifetime.
  useEffect(() => {
    if (!notificationSupported()) return;
    registerSW();
  }, []);

  // Reminder tick.
  useEffect(() => {
    if (!user) return;
    const tick = () => {
      const played = hasPlayedToday(user.email);
      void tickReminder(user.email, played);
    };
    tick();
    const iv = setInterval(tick, 60_000);
    return () => clearInterval(iv);
  }, [user]);

  return null;
}
