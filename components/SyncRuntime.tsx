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
import { pullPortfolios } from "@/lib/supabase/portfolio-sync";
import { pullMyTradeFloors } from "@/lib/supabase/tradefloor-sync";
import {
  pullWatchlist,
  pushLocalWatchlist,
} from "@/lib/supabase/watchlist-sync";
import {
  mirrorEarnedBadges,
  pullBadgeUnlocks,
  pullQuestClaims,
  pullStreakFreezes,
} from "@/lib/supabase/progress-sync";
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
      // Idempotent — only inserts badges that aren't already in
      // badge_unlocks. Cheap to re-run on every tick.
      await mirrorEarnedBadges();
    };

    // First-load only: pull paper-trading state + strategy portfolios
    // + trade floors + watchlist + quest claims + badge unlocks +
    // streak freezes down so a phone session shows up on desktop.
    // Local stores stay authoritative thereafter. Watchlist also pushes
    // any local-only symbols up to reconcile both directions.
    void pullPaperState();
    void pullPortfolios();
    void pullMyTradeFloors();
    void (async () => {
      await pullWatchlist();
      await pushLocalWatchlist();
    })();
    void pullQuestClaims();
    void pullBadgeUnlocks();
    void pullStreakFreezes();
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
