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
create policy "fests owner creates"
  on public.fests for insert to authenticated
  with check (
    exists (
      select 1 from public.club_members m
      where m.club_id = fests.club_id
        and m.user_id = auth.uid()
        and m.role = 'owner'
    )
  );

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
create index if not exists floor_posts_club_idx         on public.floor_posts(club_id, created_at desc);
create index if not exists orders_user_idx              on public.orders(user_id, placed_at desc);
create index if not exists portfolios_user_idx          on public.portfolios(user_id, created_at desc);
create index if not exists trade_floor_members_user_idx on public.trade_floor_members(user_id);
create index if not exists watchlist_user_idx           on public.watchlist_items(user_id, added_at desc);
create index if not exists quest_claims_user_idx        on public.quest_claims(user_id, claimed_at desc);
create index if not exists badge_unlocks_user_idx       on public.badge_unlocks(user_id, earned_at desc);
