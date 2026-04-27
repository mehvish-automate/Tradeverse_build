import { NextResponse } from "next/server";

import { getServerSupabase } from "@/lib/supabase/server";

/**
 * Supabase magic-link callback. The email link drops the user here
 * with ?code=... + a PKCE pair stored by the browser client. We
 * exchange the code for a session and then redirect into the app.
 *
 * If env is missing, we treat it as a 404 equivalent (redirect home).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const next =
    url.searchParams.get("next") ??
    (type === "recovery" ? "/auth/reset-password" : "/profile");

  const supabase = getServerSupabase();
  if (!supabase || !code) {
    return NextResponse.redirect(new URL("/signin?err=auth", request.url));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(
        `/signin?err=${encodeURIComponent(error.message)}`,
        request.url,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
