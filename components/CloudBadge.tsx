"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getBrowserSupabase, supabaseConfigured } from "@/lib/supabase/client";

type CloudState = "missing" | "signed-out" | "signed-in";

export function CloudBadge() {
  const [state, setState] = useState<CloudState>("missing");

  useEffect(() => {
    let cancelled = false;
    if (!supabaseConfigured()) {
      setState("missing");
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const check = async () => {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      setState(data.user ? "signed-in" : "signed-out");
    };
    void check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void check();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const label =
    state === "signed-in"
      ? "Cloud synced"
      : state === "signed-out"
        ? "Sign in to sync"
        : "Local only";

  const dotColor =
    state === "signed-in"
      ? "bg-brand-500"
      : state === "signed-out"
        ? "bg-amber-400"
        : "bg-ink-500";

  return (
    <Link
      href="/settings"
      title={
        state === "signed-in"
          ? "Progress is syncing to the cloud"
          : state === "signed-out"
            ? "Sign in to sync across devices"
            : "Local-only mode — cloud not configured"
      }
      className="hidden items-center gap-1.5 rounded-md border border-ink-800 px-2 py-1 text-[10px] font-medium text-ink-300 hover:bg-ink-900 md:inline-flex"
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
      {label}
    </Link>
  );
}
