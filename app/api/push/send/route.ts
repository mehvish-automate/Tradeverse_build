// Phase 66 — server push send endpoint. Sends a Web Push to the
// authenticated caller's own subscriptions using VAPID. No-op (configured:
// false) until VAPID keys are set. Node runtime (web-push needs Node crypto).

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubRow = { endpoint: string; p256dh: string; auth: string };

export async function POST(req: Request) {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!pub || !priv || !url || !anon) {
    return NextResponse.json({ configured: false, sent: 0 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    message?: string;
    target?: string;
  };

  const cookieStore = cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      get: (n: string) => cookieStore.get(n)?.value,
      set() {},
      remove() {},
    },
  });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", auth.user.id);

  const rows = (subs ?? []) as SubRow[];
  if (rows.length === 0) return NextResponse.json({ sent: 0 });

  webpush.setVapidDetails("mailto:support@tradeverse.app", pub, priv);
  const payload = JSON.stringify({
    title: body.title || "TradeVerse",
    body: body.message || "",
    url: body.target || "/inbox",
  });

  let sent = 0;
  await Promise.all(
    rows.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode ?? 0;
        if (code === 404 || code === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }),
  );

  return NextResponse.json({ sent });
}
