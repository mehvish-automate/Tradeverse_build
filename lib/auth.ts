"use client";

// Auth surface. V1 localStorage + V2 Supabase live side-by-side:
//
//   - When Supabase env is configured, signUp / signIn flow uses real
//     email + password auth. We still mirror the user into the legacy
//     localStorage user store so every other surface (progress, posts,
//     etc.) keeps working through the incremental migration.
//   - When Supabase env is missing, we fall back to the V1 flow
//     unchanged (email-only local "auth", password ignored).
//
// ageFromDob / useSession / User type still come from lib/session so
// callers don't need to care which mode they're in.

import { getBrowserSupabase, supabaseConfigured } from "./supabase/client";
import { ageFromDob, signIn as localSignIn, signUp as localSignUp } from "./session";

export type AuthMode = "supabase" | "local";

export function authMode(): AuthMode {
  return supabaseConfigured() ? "supabase" : "local";
}

export type AuthResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; error: string };

function validateEmail(email: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email.";
  return null;
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  if (password.length > 72) {
    return "Password must be at most 72 characters.";
  }
  return null;
}

/**
 * Create a Supabase user with email + password. Display name and DOB
 * are written into auth user_metadata; the handle_new_user() trigger
 * copies them into public.profiles on insert.
 *
 * If the project requires email confirmation, the returned session
 * will be null — the caller should surface a "check your email" hint.
 */
export async function signUpWithPassword(input: {
  email: string;
  password: string;
  displayName: string;
  dob: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };
  const pwErr = validatePassword(input.password);
  if (pwErr) return { ok: false, error: pwErr };
  if (input.dob && ageFromDob(input.dob) < 18) {
    return { ok: false, error: "TradeVerse is 18+ only." };
  }

  const supabase = getBrowserSupabase();
  if (!supabase) {
    return { ok: false, error: "Backend auth isn't configured yet on this device." };
  }

  const redirectTo =
    (typeof window !== "undefined" ? window.location.origin : "") +
    "/auth/callback";

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: redirectTo,
      data: {
        display_name: input.displayName,
        dob: input.dob,
      },
    },
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, needsEmailConfirmation: !data.session };
}

/** Sign in an existing user with email + password. */
export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  const emailErr = validateEmail(email);
  if (emailErr) return { ok: false, error: emailErr };
  if (!input.password) return { ok: false, error: "Enter your password." };

  const supabase = getBrowserSupabase();
  if (!supabase) {
    return { ok: false, error: "Backend auth isn't configured yet on this device." };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, needsEmailConfirmation: false };
}

/**
 * Send a password-reset email. Supabase emails the user a link that
 * lands on /auth/callback?code=...&type=recovery, which exchanges the
 * code and redirects to /auth/reset-password for the new-password form.
 */
export async function sendPasswordReset(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();
  const emailErr = validateEmail(trimmed);
  if (emailErr) return { ok: false, error: emailErr };

  const supabase = getBrowserSupabase();
  if (!supabase) return { ok: false, error: "Auth backend not configured." };

  const redirectTo =
    (typeof window !== "undefined" ? window.location.origin : "") +
    "/auth/callback?next=/auth/reset-password&type=recovery";

  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
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
 * Sign out everywhere: end the Supabase session AND wipe every local
 * TradeVerse cache so the next user on this device starts clean.
 * Use this from sign-out buttons; the bare lib/session.signOut() only
 * clears localStorage and is exposed via useSession() as a fallback.
 */
export async function signOutEverywhere(): Promise<void> {
  // Local wipe first so that even if the Supabase signout fails (no
  // network), the device is logged out from the user's perspective.
  const { signOut } = await import("./session");
  signOut();
  await supabaseSignOut();
}

/**
 * Universal signup.
 *
 * Supabase mode: email + password signUp, and writes a local placeholder
 *   row so the rest of the app has a User to read while migration
 *   surfaces are still localStorage-backed.
 * Local mode: falls back to lib/session's pure-localStorage signUp
 *   (password is ignored — there's no V1 password store).
 */
export async function signUpUniversal(input: {
  email: string;
  password: string;
  displayName: string;
  dob: string;
}): Promise<
  | { ok: true; mode: AuthMode; needsEmailConfirmation?: boolean }
  | { ok: false; error: string }
> {
  if (authMode() === "supabase") {
    const r = await signUpWithPassword(input);
    if (!r.ok) return r;
    // Mirror into local store so the session hook has a user right away.
    localSignUp({
      email: input.email,
      displayName: input.displayName,
      dob: input.dob,
    });
    return {
      ok: true,
      mode: "supabase",
      needsEmailConfirmation: r.needsEmailConfirmation,
    };
  }
  const r = localSignUp({
    email: input.email,
    displayName: input.displayName,
    dob: input.dob,
  });
  if (!r.ok) return r;
  return { ok: true, mode: "local" };
}

/** Universal sign-in: email+password in Supabase mode, local otherwise. */
export async function signInUniversal(input: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; mode: AuthMode }
  | { ok: false; error: string }
> {
  if (authMode() === "supabase") {
    const r = await signInWithPassword(input);
    if (!r.ok) return r;

    // Hydrate the local session from the canonical profiles row. This
    // gives a fresh device the real display_name + dob + home_institute
    // + onboarded flag — no more "2000-01-01" placeholder. If the pull
    // fails (no profile row, offline, etc), fall back to user_metadata.
    const email = input.email.trim().toLowerCase();
    try {
      const { pullProfile } = await import("./supabase/sync");
      const ok = await pullProfile();
      if (!ok) {
        const supabase = getBrowserSupabase();
        if (supabase) {
          const { data } = await supabase.auth.getUser();
          if (data.user) {
            const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
            const displayName = (meta.display_name as string) || email.split("@")[0];
            const dob = (meta.dob as string) || "2000-01-01";
            localSignUp({ email, displayName, dob });
          }
        }
      }
    } catch {
      // best-effort — Supabase session still drives auth even if local mirror fails
    }

    return { ok: true, mode: "supabase" };
  }
  const r = localSignIn(input.email);
  if (!r.ok) return r;
  return { ok: true, mode: "local" };
}
