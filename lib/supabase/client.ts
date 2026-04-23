"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

/**
 * Browser-side Supabase client. Safe to use in client components.
 * Reads env at module init — ensure NEXT_PUBLIC_* vars are set.
 *
 * Returns null when env is missing so the app still renders in the
 * localStorage-only V1 mode while the backend is being wired up.
 */
let cached: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getBrowserSupabase() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  cached = createBrowserClient<Database>(url, anon);
  return cached;
}

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
