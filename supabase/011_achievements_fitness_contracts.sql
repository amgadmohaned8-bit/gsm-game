-- Run once in the Supabase SQL editor (after 010).
-- 1) achievements   2) lineups played (for fitness)   3) contract renewals

create table if not exists public.achievements_unlocked (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.achievements_unlocked enable row level security;
drop policy if exists "ach read" on public.achievements_unlocked;
drop policy if exists "ach add" on public.achievements_unlocked;
create policy "ach read" on public.achievements_unlocked for select to authenticated using (auth.uid() = user_id);
create policy "ach add" on public.achievements_unlocked for insert to authenticated with check (auth.uid() = user_id);

create table if not exists public.match_lineups (
  user_id uuid not null references auth.users(id) on delete cascade,
  season text not null,
  matchday int not null,
  club_id text not null,
  starters text[] not null,
  primary key (user_id, season, matchday)
);
alter table public.match_lineups enable row level security;
drop policy if exists "lineups read" on public.match_lineups;
drop policy if exists "lineups add" on public.match_lineups;
drop policy if exists "lineups edit" on public.match_lineups;
create policy "lineups read" on public.match_lineups for select to authenticated using (auth.uid() = user_id);
create policy "lineups add" on public.match_lineups for insert to authenticated with check (auth.uid() = user_id);
create policy "lineups edit" on public.match_lineups for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.contract_renewals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id text not null,
  player_id text not null,
  season text not null,
  end_year int not null,        -- the season starting in this year is his last
  wage numeric(6, 2) not null,  -- millions a year
  fee numeric(6, 2) not null default 0, -- signing-on fee, millions
  created_at timestamptz not null default now()
);
alter table public.contract_renewals enable row level security;
drop policy if exists "renewals read" on public.contract_renewals;
drop policy if exists "renewals add" on public.contract_renewals;
create policy "renewals read" on public.contract_renewals for select to authenticated using (auth.uid() = user_id);
create policy "renewals add" on public.contract_renewals for insert to authenticated with check (auth.uid() = user_id);
