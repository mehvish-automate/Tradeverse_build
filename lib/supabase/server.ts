import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import type { Database } from "./types";

/**
 * Server-side Supabase client bound to the request cookies.
 * Use in server components, server actions, and route handlers.
 *
 * Returns null if env isn't set — callers should gracefully fall back
 * to the V1 localStorage flow.
 */
export function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;

  const cookieStore = cookies();

  return createServerClient<Database>(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // The `set` method throws when called from a Server Component.
          // The middleware at middleware.ts handles session refresh; this
          // try/catch keeps Server Components safe without warnings.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Same reason as above.
        }
      },
    },
  });
}

/**
 * Admin client with the service-role key. SERVER ONLY. Skip RLS.
 * Use sparingly — most writes should go through the user-scoped
 * server client so RLS enforces permissions.
 */
export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return null;
  return createClient<Database>(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
