# Backend setup (Supabase)

TradeVerse's V1 runs entirely against browser `localStorage`. Phase 27
introduces Supabase (Postgres + auth + realtime) so state becomes
multi-device + multi-user. This doc walks you through wiring it up.

## 1 · Create a Supabase project

1. Sign up / log in at https://supabase.com.
2. New project → pick the region nearest your users (Mumbai for India).
3. Set a strong database password and save it in your password manager.
4. Wait ~2 minutes for the project to provision.

## 2 · Run the schema

Paste the contents of `supabase/schema.sql` into the **SQL editor** in
the dashboard and click Run. It's idempotent — safe to re-run.

What it creates:

- `profiles`, `user_stats`, `daily_results` — identity + progress
- `trade_floors`, `trade_floor_members` — friend-group leagues
- `clubs`, `club_members`, `fests`, `fest_participants` — P8
- `floor_posts`, `floor_reactions`, `floor_comments` — club social
- `portfolios`, `portfolio_holdings` — strategy portfolios (P3)
- `paper_accounts`, `paper_holdings`, `orders` — paper execution (P17)
- `handle_new_user()` trigger — auto-seeds `profiles` + `user_stats` +
  `paper_accounts` on `auth.users` insert
- Row-Level Security on every table with per-user / per-club policies

## 3 · Copy credentials into `.env.local`

From your Supabase project's **Settings → API** page, copy:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` / `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server only)

Also set:

- `NEXT_PUBLIC_SITE_URL=http://localhost:3000` (or your Vercel URL in prod)

Use `.env.example` as the template; `.env.local` is gitignored.

## 4 · Auth setup

In the Supabase dashboard → **Authentication → Providers**:

- Enable **Email**. Magic Link is no longer required — TradeVerse uses
  email + password (`supabase.auth.signUp` / `signInWithPassword`).
- Decide whether you want **Confirm email** on or off:
  - **Off**: signup logs the user in immediately (best UX for dev).
  - **On**: signup creates the user but no session; the user clicks the
    link in their inbox to confirm, lands on `/auth/callback`, then can
    sign in. The signup screen shows a "check your email" hint.
- Set **Site URL** to your site (`http://localhost:3000` in dev,
  `https://<your-vercel-url>` in prod).
- Add both URLs (and `…/auth/callback`) to **Redirect URLs**. Only used
  if email confirmation is on.

## 5 · Test the wiring

```bash
npm run dev
```

Open http://localhost:3000/signup. With Supabase env set, the form calls
`supabase.auth.signUp({ email, password })` and signs the user in
straight away (or sends a confirmation link if email confirmation is
on). Without env, the browser client returns `null` and the legacy
localStorage flow takes over (password is ignored in V1 mode).

## 6 · Deploy

On Vercel: **Project → Settings → Environment Variables** — paste the
same three Supabase values. Redeploy. Add your Vercel URL to
Supabase's redirect allowlist.

## 7 · Type generation (optional)

The handwritten types at `lib/supabase/types.ts` match
`supabase/schema.sql` and are kept in sync manually. To regenerate
from your live project:

```bash
npx supabase gen types typescript --project-id <project-ref> \
  --schema public > lib/supabase/types.ts
```

## 8 · Migration approach

V1 localStorage keys stay intact through this phase. Each subsequent
phase migrates a concrete surface (auth → user stats → trade floors →
clubs → fests → …) and keeps a localStorage fallback so the app runs
end-to-end in either mode until cutover is complete.
