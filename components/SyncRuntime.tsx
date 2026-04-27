"use client";

import { useEffect } from "react";

import { supabaseConfigured } from "@/lib/supabase/client";
import {
  pullDailyResults,
  syncDailyResults,
  syncProfile,
} from "@/lib/supabase/sync";
import {
  mirrorAccountState,
  pullPaperState,
} from "@/lib/supabase/paper-sync";
import { useSession } from "@/lib/session";

/**
 * Hands the localStorage progress state to Supabase in the background.
 *   - On sign-in: upsert profile + user_stats, pull any server-side
 *     daily_results missing locally, push any local rows missing on
 *     the server.
 *   - Every minute while a tab is open: re-sync so new runs reach the
 *     server without waiting for the next load.
 *
 * Silent no-op when Supabase env is absent.
 */
export function SyncRuntime() {
  const { user } = useSession();

  useEffect(() => {
    if (!supabaseConfigured()) return;
    if (!user) return;

    let cancelled = false;

    const run = async () => {
      await syncProfile();
      await pullDailyResults();
      await syncDailyResults();
      await mirrorAccountState();
    };

    // First-load only: pull paper-trading state down so a phone session
    // shows up on desktop. Local engine stays authoritative thereafter.
    void pullPaperState();
    void run();

    const iv = setInterval(() => {
      if (!cancelled) void run();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [user]);

  return null;
}
