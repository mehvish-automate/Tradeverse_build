-- TradeVerse Postgres schema for Supabase.
--
-- Run once against a fresh Supabase project:
--   - SQL editor → paste this whole file → Run
--   - or: psql "$DATABASE_URL" -f supabase/schema.sql
--
-- Safe to re-run: every statement is IF NOT EXISTS / DROP ... IF EXISTS.
--
-- Structure:
--   Part 1 — All CREATE TABLE statements (so policies can forward-ref).
--   Part 2 — ENABLE ROW LEVEL SECURITY + policies.
--   Part 3 — Trigger function + trigger.
--   Part 4 — Indexes.

-- ============================================================================
-- Part 1 — Tables
-- ============================================================================

create extension if not exists "pgcrypto";

-- --- Identity ---
create table if not exists public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  email           text not null unique,
  display_name    text not null check (char_length(display_name) between 2 and 40),
  dob             date not null,
  created_at      timestamptz not null default now(),
  home_institute  text,
  onboarded       boolean not null default false
);

-- Phase 42 — admin role flag. Default false; bootstrap by manually
-- updating one row in the SQL editor: update profiles set is_admin=true
-- where email='you@example.com';
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Phase 48.5 — referral code (deterministic from email; computed and
-- mirrored client-side via lib/referral.codeFor). Unique-or-null so
-- legacy rows that haven't synced yet don't block writes.
alter table public.profiles
  add column if not exists referral_code text;
create unique index if not exists profiles_referral_code_uniq
  on public.profiles (referral_code)
  where referral_code is not null;

-- --- Progress ---
create table if not exists public.daily_results (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  date_key    date not null,
  correct     integer not null check (correct >= 0),
  total       integer not null check (total >= 0),
  xp          integer not null check (xp >= 0),
  time_ms     integer not null check (time_ms >= 0),
  created_at  timestamptz not null default now(),
  unique (user_id, date_key)
);

create table if not exists public.user_stats (
  user_id         uuid primary key references auth.users on delete cascade,
  streak          integer not null default 0,
  last_played_key date,
  total_xp        integer not null default 0,
  longest_streak  integer not null default 0,
  streak_freezes  integer not null default 0,
  updated_at      timestamptz not null default now()
);

-- --- Compete: trade floors ---
create table if not exists public.trade_floors (
  id          text primary key check (char_length(id) = 6),
  name        text not null check (char_length(name) between 3 and 40),
  created_by  uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

-- Phase 42 — launch flow columns. Added with `if not exists` so the
-- migration is safe to re-run; defaults make pre-Phase-42 rows valid.
alter table public.trade_floors
  add column if not exists privacy text not null default 'public'
    check (privacy in ('public','private')),
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists member_cap integer not null default 20
    check (member_cap between 2 and 200),
  add column if not exists virtual_capital bigint not null default 1000000
    check (virtual_capital between 100000 and 10000000),
  add column if not exists stock_universe jsonb not null
    default '{"kind":"nifty50"}'::jsonb,
  add column if not exists asset_classes text[] not null
    default array['stocks']::text[],
  add column if not exists market_region text not null default 'IN'
    check (market_region in ('IN','UAE','US','GLOBAL')),
  add column if not exists status text not null default 'live'
    check (status in ('pending_approval','live','ended','rejected')),
  add column if not exists created_by_kind text not null default 'user'
    check (created_by_kind in ('user','club','ambassador'));

create table if not exists public.trade_floor_members (
  trade_floor_id text not null references public.trade_floors on delete cascade,
  user_id        uuid not null references auth.users on delete cascade,
  joined_at      timestamptz not null default now(),
  primary key (trade_floor_id, user_id)
);

-- --- Clubs + fests ---
create table if not exists public.clubs (
  id            uuid primary key default gen_random_uuid(),
  institute_id  text not null,
  name          text not null check (char_length(name) between 3 and 50),
  description   text,
  created_by    uuid not null references auth.users on delete cascade,
  created_at    timestamptz not null default now()
);

create table if not exists public.club_members (
  club_id    uuid not null references public.clubs on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null default 'member' check (role in ('owner','member')),
  joined_at  timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table if not exists public.fests (
  id           text primary key check (char_length(id) between 6 and 16),
  club_id      uuid not null references public.clubs on delete cascade,
  name         text not null check (char_length(name) between 3 and 60),
  description  text,
  start_date   date not null,
  end_date     date not null,
  event_type   text not null default 'paper-trading',
  difficulty   text not null default 'intermediate',
  source       text not null default 'system' check (source in ('system','custom')),
  created_by   uuid not null references auth.users on delete cascade,
  created_at   timestamptz not null default now(),
  check (end_date >= start_date)
);

-- Phase 43 — fest launch polish + admin approval. New columns are
-- added if-not-exists with safe defaults so legacy rows stay valid.
alter table public.fests
  add column if not exists privacy text not null default 'private'
    check (privacy in ('public','private')),
  add column if not exists status text not null default 'live'
    check (status in ('pending_approval','live','ended','rejected')),
  add column if not exists categories text[] not null default array[]::text[],
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz;

-- Quiz launch flow — fests can now be launched standalone (not tied to
-- a club) and carry an explicit participant cap. Threshold of 100 is
-- the new admin-approval trigger for private fests; public fests are
-- still always reviewed.
alter table public.fests alter column club_id drop not null;
alter table public.fests
  add column if not exists member_cap integer not null default 50
    check (member_cap between 2 and 1000);

create table if not exists public.fest_participants (
  fest_id    text not null references public.fests on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (fest_id, user_id)
);

-- --- Club trading floor (posts + reactions + comments) ---
create table if not exists public.floor_posts (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  kind        text not null default 'text' check (kind in ('text','chart-read','portfolio-share')),
  body        text not null check (char_length(body) between 2 and 500),
  ticker      text,
  created_at  timestamptz not null default now()
);

create table if not exists public.floor_reactions (
  post_id     uuid not null references public.floor_posts on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.floor_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.floor_posts on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  body        text not null check (char_length(body) between 2 and 280),
  created_at  timestamptz not null default now()
);

-- --- Strategy portfolios + paper trading ---
create table if not exists public.portfolios (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  name             text not null,
  description      text,
  base_date        date not null,
  initial_capital  numeric not null check (initial_capital >= 10000),
  universe         jsonb,
  created_at       timestamptz not null default now()
);

create table if not exists public.portfolio_holdings (
  portfolio_id uuid not null references public.portfolios on delete cascade,
  symbol       text not null,
  pct          numeric not null check (pct >= 0 and pct <= 100),
  primary key (portfolio_id, symbol)
);

create table if not exists public.paper_accounts (
  user_id     uuid primary key references auth.users on delete cascade,
  cash        numeric not null default 1000000,
  created_at  timestamptz not null default now()
);

create table if not exists public.paper_holdings (
  user_id    uuid not null references auth.users on delete cascade,
  symbol     text not null,
  shares     integer not null check (shares >= 0),
  avg_price  numeric not null check (avg_price >= 0),
  primary key (user_id, symbol)
);

create table if not exists public.orders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  symbol           text not null,
  side             text not null check (side in ('buy','sell')),
  kind             text not null check (kind in ('market','limit','stop','stop-limit')),
  qty              integer not null check (qty > 0),
  filled_qty       integer not null default 0,
  avg_fill_price   numeric not null default 0,
  limit_price      numeric,
  stop_price       numeric,
  status           text not null default 'pending' check (status in ('pending','partial','filled','cancelled','rejected')),
  placed_at        timestamptz not null default now(),
  last_updated     timestamptz not null default now(),
  fills            jsonb not null default '[]'::jsonb
);

-- Phase 45.5b — paper accounts can be scoped to a virtual trading
-- competition (a trade-floor id). Existing rows default to the
-- 'global' sentinel which preserves pre-Phase-45.5b behaviour.
alter table public.paper_accounts
  add column if not exists scope_id text not null default 'global';
alter table public.paper_holdings
  add column if not exists scope_id text not null default 'global';
alter table public.orders
  add column if not exists scope_id text not null default 'global';

-- Swap the existing PKs to composite (user_id, scope_id, ...). These
-- are guarded with `do $$` so re-running this migration is safe.
do $$
begin
  alter table public.paper_accounts drop constraint if exists paper_accounts_pkey;
exception when others then null;
end $$;
do $$
begin
  alter table public.paper_accounts add primary key (user_id, scope_id);
exception when others then null;
end $$;

do $$
begin
  alter table public.paper_holdings drop constraint if exists paper_holdings_pkey;
exception when others then null;
end $$;
do $$
begin
  alter table public.paper_holdings add primary key (user_id, scope_id, symbol);
exception when others then null;
end $$;

-- --- Watchlist (Phase 30) ---
create table if not exists public.watchlist_items (
  user_id     uuid not null references auth.users on delete cascade,
  symbol      text not null,
  added_at    timestamptz not null default now(),
  primary key (user_id, symbol)
);

-- --- Quests + badges (Phase 31) ---
create table if not exists public.quest_claims (
  user_id     uuid not null references auth.users on delete cascade,
  quest_id    text not null,
  window_key  text not null,
  reward_xp   integer not null default 0,
  claimed_at  timestamptz not null default now(),
  primary key (user_id, quest_id, window_key)
);

create table if not exists public.badge_unlocks (
  user_id     uuid not null references auth.users on delete cascade,
  badge_id    text not null,
  earned_at   timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- --- Market events (Phase 39) ---
create table if not exists public.event_allocations (
  user_id      uuid not null references auth.users on delete cascade,
  event_id     text not null,
  allocation   jsonb not null,
  submitted_at timestamptz not null default now(),
  claimed      boolean not null default false,
  primary key (user_id, event_id)
);

-- --- Live sessions (Phase 40) ---
create table if not exists public.live_sessions (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs on delete cascade,
  title          text not null check (char_length(title) between 3 and 80),
  description    text,
  kind           text not null default 'walkthrough'
    check (kind in ('walkthrough','open-market','ama','other')),
  host_id        uuid not null references auth.users on delete cascade,
  host_display   text not null,
  starts_at      timestamptz not null,
  duration_mins  integer not null check (duration_mins between 15 and 240),
  external_link  text,
  notes          text,
  created_at     timestamptz not null default now()
);

create table if not exists public.session_rsvps (
  session_id   uuid not null references public.live_sessions on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  display_name text not null,
  joined_at    timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- --- Notification read receipts (Phase 41) ---
create table if not exists public.notification_reads (
  user_id   uuid not null references auth.users on delete cascade,
  notif_id  text not null,
  read_at   timestamptz not null default now(),
  primary key (user_id, notif_id)
);

-- --- Price alerts (Alerts cloud sync) ---
create table if not exists public.alerts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  symbol           text not null,
  condition        text not null check (condition in ('above','below')),
  price            numeric not null check (price > 0),
  one_shot         boolean not null default true,
  armed            boolean not null default true,
  triggered_at     timestamptz,
  triggered_price  numeric,
  created_at       timestamptz not null default now()
);

-- --- Share-link tracking (Phase 48.5) ---
-- Inviters generate /s/<kind>/<id>?ref=<code> URLs. Each click +
-- registration that lands on a TradeVerse account writes one row here.
-- Anonymous (signed-out) clicks are silently dropped at the application
-- layer to keep this table spam-resistant.
create table if not exists public.share_clicks (
  id          uuid primary key default gen_random_uuid(),
  inviter_id  uuid not null references auth.users on delete cascade,
  kind        text not null check (kind in ('floor','fest','event')),
  resource_id text not null,
  clicker_id  uuid references auth.users on delete set null,
  clicked_at  timestamptz not null default now()
);

create table if not exists public.share_joins (
  inviter_id  uuid not null references auth.users on delete cascade,
  invitee_id  uuid not null references auth.users on delete cascade,
  kind        text not null check (kind in ('floor','fest','event')),
  resource_id text not null,
  joined_at   timestamptz not null default now(),
  primary key (inviter_id, invitee_id, kind, resource_id)
);

-- ============================================================================
-- Part 2 — Row-Level Security + policies
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.daily_results       enable row level security;
alter table public.user_stats          enable row level security;
alter table public.trade_floors        enable row level security;
alter table public.trade_floor_members enable row level security;
alter table public.clubs               enable row level security;
alter table public.club_members        enable row level security;
alter table public.fests               enable row level security;
alter table public.fest_participants   enable row level security;
alter table public.floor_posts         enable row level security;
alter table public.floor_reactions     enable row level security;
alter table public.floor_comments      enable row level security;
alter table public.portfolios          enable row level security;
alter table public.portfolio_holdings  enable row level security;
alter table public.paper_accounts      enable row level security;
alter table public.paper_holdings      enable row level security;
alter table public.orders              enable row level security;
alter table public.watchlist_items     enable row level security;
alter table public.quest_claims        enable row level security;
alter table public.badge_unlocks       enable row level security;
alter table public.event_allocations   enable row level security;
alter table public.live_sessions       enable row level security;
alter table public.session_rsvps       enable row level security;
alter table public.notification_reads  enable row level security;
alter table public.alerts              enable row level security;
alter table public.share_clicks        enable row level security;
alter table public.share_joins         enable row level security;

-- Idempotency helper: drop then recreate each policy.
drop policy if exists "profiles world-readable"        on public.profiles;
drop policy if exists "profiles self update"           on public.profiles;
drop policy if exists "profiles self insert"           on public.profiles;
drop policy if exists "own results read"               on public.daily_results;
drop policy if exists "own results insert"             on public.daily_results;
drop policy if exists "own stats read"                 on public.user_stats;
drop policy if exists "own stats write"                on public.user_stats;
drop policy if exists "trade floors readable"          on public.trade_floors;
drop policy if exists "trade floors create"            on public.trade_floors;
drop policy if exists "trade floors admin read"        on public.trade_floors;
drop policy if exists "trade floors admin update"      on public.trade_floors;
drop policy if exists "trade floors creator update"    on public.trade_floors;
drop policy if exists "members readable"               on public.trade_floor_members;
drop policy if exists "self join floor"                on public.trade_floor_members;
drop policy if exists "self leave floor"               on public.trade_floor_members;
drop policy if exists "clubs public read"              on public.clubs;
drop policy if exists "clubs create"                   on public.clubs;
drop policy if exists "club members public read"       on public.club_members;
drop policy if exists "self join club"                 on public.club_members;
drop policy if exists "self leave club"                on public.club_members;
drop policy if exists "fests public read"              on public.fests;
drop policy if exists "fests owner creates"            on public.fests;
drop policy if exists "fests admin update"             on public.fests;
drop policy if exists "fests creator update"           on public.fests;
drop policy if exists "fest participants public read"  on public.fest_participants;
drop policy if exists "self join fest"                 on public.fest_participants;
drop policy if exists "floor posts readable"           on public.floor_posts;
drop policy if exists "own post insert"                on public.floor_posts;
drop policy if exists "own post delete"                on public.floor_posts;
drop policy if exists "reactions readable"             on public.floor_reactions;
drop policy if exists "self react"                     on public.floor_reactions;
drop policy if exists "self unreact"                   on public.floor_reactions;
drop policy if exists "comments readable"              on public.floor_comments;
drop policy if exists "self comment"                   on public.floor_comments;
drop policy if exists "own portfolios"                 on public.portfolios;
drop policy if exists "holdings scoped to owner"       on public.portfolio_holdings;
drop policy if exists "own paper account"              on public.paper_accounts;
drop policy if exists "own paper holdings"             on public.paper_holdings;
drop policy if exists "own orders"                     on public.orders;
drop policy if exists "own watchlist"                  on public.watchlist_items;
drop policy if exists "own quest claims"               on public.quest_claims;
drop policy if exists "own badge unlocks"              on public.badge_unlocks;
drop policy if exists "own event allocations"          on public.event_allocations;
drop policy if exists "live sessions readable"         on public.live_sessions;
drop policy if exists "live sessions host writes"      on public.live_sessions;
drop policy if exists "live sessions host updates"     on public.live_sessions;
drop policy if exists "live sessions host deletes"     on public.live_sessions;
drop policy if exists "session rsvps readable"         on public.session_rsvps;
drop policy if exists "self rsvp"                      on public.session_rsvps;
drop policy if exists "self un-rsvp"                   on public.session_rsvps;
drop policy if exists "own notification reads"         on public.notification_reads;
drop policy if exists "own alerts"                     on public.alerts;
drop policy if exists "share clicks inviter read"      on public.share_clicks;
drop policy if exists "share clicks insert"            on public.share_clicks;
drop policy if exists "share joins inviter read"       on public.share_joins;
drop policy if exists "share joins invitee insert"     on public.share_joins;

-- profiles
create policy "profiles world-readable"
  on public.profiles for select to authenticated using (true);
create policy "profiles self update"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles self insert"
  on public.profiles for insert to authenticated with check (auth.uid() = id);

-- daily_results
create policy "own results read"
  on public.daily_results for select to authenticated using (auth.uid() = user_id);
create policy "own results insert"
  on public.daily_results for insert to authenticated with check (auth.uid() = user_id);

-- user_stats
create policy "own stats read"
  on public.user_stats for select to authenticated using (auth.uid() = user_id);
create policy "own stats write"
  on public.user_stats for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- trade_floors
create policy "trade floors readable"
  on public.trade_floors for select to authenticated
  using (
    exists (
      select 1 from public.trade_floor_members m
      where m.trade_floor_id = trade_floors.id and m.user_id = auth.uid()
    )
  );
create policy "trade floors create"
  on public.trade_floors for insert to authenticated
  with check (auth.uid() = created_by);

-- Admins (profiles.is_admin = true) can read all trade floors so they
-- can review pending_approval rows.
create policy "trade floors admin read"
  on public.trade_floors for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Admins can update status (approve / reject).
create policy "trade floors admin update"
  on public.trade_floors for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Creator can update their own floor (e.g. notes — not status).
create policy "trade floors creator update"
  on public.trade_floors for update to authenticated
  using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- trade_floor_members
create policy "members readable"
  on public.trade_floor_members for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.trade_floor_members m2
      where m2.trade_floor_id = trade_floor_members.trade_floor_id
        and m2.user_id = auth.uid()
    )
  );
create policy "self join floor"
  on public.trade_floor_members for insert to authenticated
  with check (user_id = auth.uid());
create policy "self leave floor"
  on public.trade_floor_members for delete to authenticated
  using (user_id = auth.uid());

-- clubs
create policy "clubs public read"
  on public.clubs for select to authenticated using (true);
create policy "clubs create"
  on public.clubs for insert to authenticated with check (auth.uid() = created_by);

-- club_members
create policy "club members public read"
  on public.club_members for select to authenticated using (true);
create policy "self join club"
  on public.club_members for insert to authenticated with check (user_id = auth.uid());
create policy "self leave club"
  on public.club_members for delete to authenticated using (user_id = auth.uid());

-- fests
create policy "fests public read"
  on public.fests for select to authenticated using (true);
-- Insert allowed either when the user owns the club this fest is under,
-- OR when it's a standalone (club_id null) fest the user is creating
-- for themselves. The latter is the "quiz self-launch" path — any
-- authed user can host a quiz; admin approval gates the public ones.
create policy "fests owner creates"
  on public.fests for insert to authenticated
  with check (
    (club_id is not null and exists (
      select 1 from public.club_members m
      where m.club_id = fests.club_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    ))
    or (club_id is null and created_by = auth.uid())
  );

-- Admins can update fest status (approve / reject pending public fests).
create policy "fests admin update"
  on public.fests for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Creators can update their own fest's notes / non-status fields.
create policy "fests creator update"
  on public.fests for update to authenticated
  using (auth.uid() = created_by) with check (auth.uid() = created_by);

-- fest_participants
create policy "fest participants public read"
  on public.fest_participants for select to authenticated using (true);
create policy "self join fest"
  on public.fest_participants for insert to authenticated with check (user_id = auth.uid());

-- floor_posts
create policy "floor posts readable"
  on public.floor_posts for select to authenticated
  using (
    exists (
      select 1 from public.club_members m
      where m.club_id = floor_posts.club_id and m.user_id = auth.uid()
    )
  );
create policy "own post insert"
  on public.floor_posts for insert to authenticated with check (user_id = auth.uid());
create policy "own post delete"
  on public.floor_posts for delete to authenticated using (user_id = auth.uid());

-- floor_reactions
create policy "reactions readable"
  on public.floor_reactions for select to authenticated using (true);
create policy "self react"
  on public.floor_reactions for insert to authenticated with check (user_id = auth.uid());
create policy "self unreact"
  on public.floor_reactions for delete to authenticated using (user_id = auth.uid());

-- floor_comments
create policy "comments readable"
  on public.floor_comments for select to authenticated using (true);
create policy "self comment"
  on public.floor_comments for insert to authenticated with check (user_id = auth.uid());

-- portfolios + holdings
create policy "own portfolios"
  on public.portfolios for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "holdings scoped to owner"
  on public.portfolio_holdings for all to authenticated
  using (
    exists (select 1 from public.portfolios p where p.id = portfolio_holdings.portfolio_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.portfolios p where p.id = portfolio_holdings.portfolio_id and p.user_id = auth.uid())
  );

-- paper accounts + holdings + orders
create policy "own paper account"
  on public.paper_accounts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own paper holdings"
  on public.paper_holdings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own orders"
  on public.orders for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- watchlist
create policy "own watchlist"
  on public.watchlist_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- quest claims + badge unlocks
create policy "own quest claims"
  on public.quest_claims for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own badge unlocks"
  on public.badge_unlocks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own event allocations"
  on public.event_allocations for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- live_sessions: any authed user can read; only host can write/update/delete
create policy "live sessions readable"
  on public.live_sessions for select to authenticated using (true);
create policy "live sessions host writes"
  on public.live_sessions for insert to authenticated
  with check (host_id = auth.uid());
create policy "live sessions host updates"
  on public.live_sessions for update to authenticated
  using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "live sessions host deletes"
  on public.live_sessions for delete to authenticated
  using (host_id = auth.uid());

-- session_rsvps: public read; users RSVP / un-RSVP only themselves
create policy "session rsvps readable"
  on public.session_rsvps for select to authenticated using (true);
create policy "self rsvp"
  on public.session_rsvps for insert to authenticated
  with check (user_id = auth.uid());
create policy "self un-rsvp"
  on public.session_rsvps for delete to authenticated
  using (user_id = auth.uid());

-- notification_reads: own rows only (CRUD limited to self)
create policy "own notification reads"
  on public.notification_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- alerts: own rows only
create policy "own alerts"
  on public.alerts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- share_clicks: inviter reads their own; any authed clicker can insert
-- (the application enforces inviter_id != auth.uid() to block self-
-- attribution; we also enforce it as a check for defense in depth).
create policy "share clicks inviter read"
  on public.share_clicks for select to authenticated
  using (inviter_id = auth.uid());
create policy "share clicks insert"
  on public.share_clicks for insert to authenticated
  with check (inviter_id <> auth.uid());

-- share_joins: inviter reads their own; the invitee inserts the row
-- and is gated to their own user_id.
create policy "share joins inviter read"
  on public.share_joins for select to authenticated
  using (inviter_id = auth.uid());
create policy "share joins invitee insert"
  on public.share_joins for insert to authenticated
  with check (invitee_id = auth.uid() and inviter_id <> auth.uid());

-- ============================================================================
-- Part 3 — Auth trigger (seed profile + stats + paper account on signup)
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, dob)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'dob')::date, (current_date - interval '21 years')::date)
  )
  on conflict (id) do nothing;

  insert into public.user_stats (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.paper_accounts (user_id) values (new.id) on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Part 4 — Indexes
-- ============================================================================

create index if not exists daily_results_user_date_idx on public.daily_results(user_id, date_key desc);
create index if not exists fests_club_idx               on public.fests(club_id);
create index if not exists fests_status_idx             on public.fests(status, created_at desc);
create index if not exists floor_posts_club_idx         on public.floor_posts(club_id, created_at desc);
create index if not exists orders_user_idx              on public.orders(user_id, placed_at desc);
create index if not exists orders_scope_idx             on public.orders(user_id, scope_id, placed_at desc);
create index if not exists paper_accounts_scope_idx     on public.paper_accounts(scope_id, user_id);
create index if not exists paper_holdings_scope_idx     on public.paper_holdings(scope_id, user_id);
create index if not exists portfolios_user_idx          on public.portfolios(user_id, created_at desc);
create index if not exists trade_floor_members_user_idx on public.trade_floor_members(user_id);
create index if not exists trade_floors_status_idx      on public.trade_floors(status, created_at desc);
create index if not exists watchlist_user_idx           on public.watchlist_items(user_id, added_at desc);
create index if not exists quest_claims_user_idx        on public.quest_claims(user_id, claimed_at desc);
create index if not exists badge_unlocks_user_idx       on public.badge_unlocks(user_id, earned_at desc);
create index if not exists event_allocations_user_idx   on public.event_allocations(user_id, submitted_at desc);
create index if not exists live_sessions_club_idx       on public.live_sessions(club_id, starts_at desc);
create index if not exists session_rsvps_user_idx       on public.session_rsvps(user_id);
create index if not exists notification_reads_user_idx  on public.notification_reads(user_id);
create index if not exists alerts_user_idx              on public.alerts(user_id, created_at desc);
create index if not exists share_clicks_inviter_idx     on public.share_clicks(inviter_id, clicked_at desc);
create index if not exists share_joins_inviter_idx      on public.share_joins(inviter_id, joined_at desc);

-- ============================================================================
-- Phase 65 — First-party analytics events
-- ============================================================================
-- Append-only funnel events (sign-up, quiz start/finish, launch, join,
-- share, daily finish). Anonymous (signed-out) events are dropped at the
-- application layer; RLS pins every row to its author. props is free-form
-- jsonb so new events don't need migrations.
create table if not exists public.analytics_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  device_id    text not null,
  name         text not null,
  props        jsonb not null default '{}'::jsonb,
  path         text,
  occurred_at  timestamptz not null default now()
);

alter table public.analytics_events enable row level security;

drop policy if exists "own analytics" on public.analytics_events;
create policy "own analytics"
  on public.analytics_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists analytics_user_idx on public.analytics_events(user_id, occurred_at desc);
create index if not exists analytics_name_idx on public.analytics_events(name, occurred_at desc);
