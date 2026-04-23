"use client";

// Auth surface. V1 localStorage + V2 Supabase live side-by-side:
//
//   - When Supabase env is configured, signUp / signIn flow uses the
//     real magic-link route. We still mirror the user into the legacy
//     localStorage user store so every other surface (progress, posts,
//     etc.) keeps working through the incremental migration.
//   - When Supabase env is missing, we fall back to the V1 flow
//     unchanged.
//
// ageFromDob / useSession / User type still come from lib/session so
// callers don't need to care which mode they're in.

import { getBrowserSupabase, supabaseConfigured } from "./supabase/client";
import { ageFromDob, signIn as localSignIn, signUp as localSignUp } from "./session";

export type AuthMode = "supabase" | "local";

export function authMode(): AuthMode {
  return supabaseConfigured() ? "supabase" : "local";
}

export type MagicLinkResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Send a magic link to the user's email. Supabase creates an auth.users
 * row on first sign-in; our handle_new_user() trigger seeds profiles +
 * user_stats + paper_accounts. Display name and DOB are stored in
 * auth user_metadata and copied by the trigger.
 */
export async function sendMagicLink(input: {
  email: string;
  displayName?: string;
  dob?: string;
}): Promise<MagicLinkResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }

  if (input.dob && ageFromDob(input.dob) < 18) {
    return { ok: false, error: "TradeVerse is 18+ only." };
  }

  const supabase = getBrowserSupabase();
  if (!supabase) {
    return {
      ok: false,
      error: "Backend auth isn't configured yet on this device.",
    };
  }

  const redirectTo =
    (typeof window !== "undefined" ? window.location.origin : "") +
    "/auth/callback";

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        display_name: input.displayName,
        dob: input.dob,
      },
    },
  });

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    message: `Check ${email} for a magic link. It expires in 1 hour.`,
  };
}

/** Returns the current Supabase session's user, or null. */
export async function supabaseUser() {
  const supabase = getBrowserSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function supabaseSignOut() {
  const supabase = getBrowserSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
}

/**
 * Universal signup.
 *
 * Supabase mode: fires a magic-link + writes a local placeholder row so
 *   the rest of the app can read a User while the email lands.
 * Local mode: falls back to lib/session's pure-localStorage signUp.
 */
export async function signUpUniversal(input: {
  email: string;
  displayName: string;
  dob: string;
}): Promise<
  | { ok: true; mode: AuthMode; message?: string }
  | { ok: false; error: string }
> {
  if (authMode() === "supabase") {
    const r = await sendMagicLink(input);
    if (!r.ok) return r;
    // Mirror into local store so the session hook has a user right away.
    localSignUp(input);
    return { ok: true, mode: "supabase", message: r.message };
  }
  const r = localSignUp(input);
  if (!r.ok) return r;
  return { ok: true, mode: "local" };
}

/** Universal sign-in: magic-link in Supabase mode, local otherwise. */
export async function signInUniversal(
  email: string,
): Promise<
  | { ok: true; mode: AuthMode; message?: string }
  | { ok: false; error: string }
> {
  if (authMode() === "supabase") {
    const r = await sendMagicLink({ email });
    if (!r.ok) return r;
    return { ok: true, mode: "supabase", message: r.message };
  }
  const r = localSignIn(email);
  if (!r.ok) return r;
  return { ok: true, mode: "local" };
}
