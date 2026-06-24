import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on each request so server
 * components see a valid user. Silent no-op when Supabase env isn't set
 * (V1 localStorage mode still works fine).
 *
 * Hardened against a flaky / paused Supabase: the auth.getUser() call
 * is raced against a short timeout so the middleware never blocks a
 * page load for more than ~3s. Without this, a paused Supabase project
 * surfaces as a Vercel MIDDLEWARE_INVOCATION_TIMEOUT (504) on every
 * route — the localStorage-driven UI would otherwise have rendered
 * just fine.
 */
const SUPABASE_TIMEOUT_MS = 3000;

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // Race the auth call against a hard timeout so a paused / unreachable
  // Supabase can't take down the entire site. Silently fall through to
  // a clean response when timing out — server components that need the
  // user will re-check via supabase.auth.getUser() and get a null user,
  // which is the correct behaviour for an offline auth backend.
  try {
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("supabase auth timeout")),
          SUPABASE_TIMEOUT_MS,
        ),
      ),
    ]);
  } catch {
    // Swallow — request still completes with whatever cookie state it had.
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next internals, static assets, image optimisation, favicons, the
    // PWA manifest, and the public service worker.
    "/((?!_next/static|_next/image|favicon.ico|icon.*\\.svg|manifest\\.webmanifest|sw\\.js|robots\\.txt|sitemap\\.xml).*)",
  ],
};
