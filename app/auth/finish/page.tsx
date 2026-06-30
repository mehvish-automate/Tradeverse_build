"use client";

// Phase 68 — post-OAuth hydration. After the server callback exchanges
// the code, SSO users land here with a Supabase session but no local
// session yet (SyncRuntime only hydrates once a local user exists). We
// pull the canonical profile into localStorage, then route into the app.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { getBrowserSupabase } from "@/lib/supabase/client";
import { registerOwnCode } from "@/lib/referral";
import { getCurrentUser, signUp as localSignUp } from "@/lib/session";

export default function AuthFinishPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { pullProfile } = await import("@/lib/supabase/sync");
        const ok = await pullProfile();
        if (!ok) {
          // Fallback: seed a local user from the Supabase session metadata.
          const supabase = getBrowserSupabase();
          if (supabase) {
            const { data } = await supabase.auth.getUser();
            if (data.user) {
              const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
              const email = (data.user.email ?? "").toLowerCase();
              const displayName =
                (meta.full_name as string) ||
                (meta.name as string) ||
                (meta.display_name as string) ||
                email.split("@")[0] ||
                "trader";
              const dob = (meta.dob as string) || "2000-01-01";
              if (email) localSignUp({ email, displayName, dob });
            }
          }
        }
        const u = getCurrentUser();
        if (u) {
          registerOwnCode(u.email, u.displayName);
          void import("@/lib/analytics").then(({ EV, track }) =>
            track(EV.signIn, { mode: "oauth" }),
          );
        }
        if (!cancelled) router.replace(u ? "/profile" : "/signin?err=oauth");
      } catch {
        if (!cancelled) setError("Could not finish signing in. Try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="text-center">
        {error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : (
          <p className="text-sm text-ink-400">Signing you in…</p>
        )}
      </div>
    </main>
  );
}
