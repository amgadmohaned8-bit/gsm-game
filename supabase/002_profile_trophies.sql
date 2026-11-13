-- Run once in the Supabase SQL editor.

-- 1) Cup wins (the cup system will insert a row when you lift the cup).
create table if not exists public.trophies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('league', 'league_cup', 'objective')),
  season text not null,
  club_id text,
  league_id text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, season)
);

alter table public.trophies enable row level security;

drop policy if exists "Managers read own trophies" on public.trophies;
create policy "Managers read own trophies" on public.trophies
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Managers add own trophies" on public.trophies;
create policy "Managers add own trophies" on public.trophies
  for insert to authenticated with check (auth.uid() = user_id);

-- 2) Let a manager edit their own name and photo from the profile.
--    Skip this block if you already have an update policy on manager_contracts.
drop policy if exists "Managers update own contract" on public.manager_contracts;
create policy "Managers update own contract" on public.manager_contracts
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) Optional: give the matches that have no date yet an 8 pm Cairo date,
--    one matchday per day starting tomorrow. The match centre already does
--    this by itself when you open it, so you only need this if you prefer SQL.
-- with days as (
--   select distinct user_id, league_id, season, matchday,
--          dense_rank() over (partition by user_id, league_id, season order by matchday) as n
--   from public.league_matches
--   where status = 'scheduled' and kickoff_at is null
-- )
-- update public.league_matches m
-- set kickoff_at = (((now() at time zone 'Africa/Cairo')::date + d.n)::timestamp + time '20:00')
--                  at time zone 'Africa/Cairo'
-- from days d
-- where m.user_id = d.user_id and m.league_id = d.league_id
--   and m.season = d.season and m.matchday = d.matchday
--   and m.status = 'scheduled' and m.kickoff_at is null;
