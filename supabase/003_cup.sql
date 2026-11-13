-- Run once in the Supabase SQL editor.

-- 1) The cup. Rows are created round by round from the app.
create table if not exists public.cup_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season text not null,
  round_no int not null check (round_no between 0 and 4), -- 0 qualifying, 1 round of 16, 2 quarter, 3 semi, 4 final
  slot int not null,
  home_club text not null,
  away_club text not null,
  home_score int,
  away_score int,
  pens_home int,
  pens_away int,
  winner text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed')),
  kickoff_at timestamptz not null,
  played_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, season, round_no, slot)
);

create index if not exists cup_matches_user_season_idx
  on public.cup_matches (user_id, season, round_no);

alter table public.cup_matches enable row level security;

drop policy if exists "Managers read own cup" on public.cup_matches;
create policy "Managers read own cup" on public.cup_matches
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Managers add own cup ties" on public.cup_matches;
create policy "Managers add own cup ties" on public.cup_matches
  for insert to authenticated with check (auth.uid() = user_id);

-- a tie can only be played once its kickoff has arrived (database clock)
drop policy if exists "Managers play own cup ties" on public.cup_matches;
create policy "Managers play own cup ties" on public.cup_matches
  for update to authenticated
  using (auth.uid() = user_id and now() >= kickoff_at)
  with check (auth.uid() = user_id);

-- 2) Open a free day for each cup round in a season that already exists.
--    League matchdays are re-dated from matchday 1: one cup day after
--    matchdays 6, 12, 18, 24 and 30. Only matches not yet played move, and it is
--    safe to run more than once. Skip this if your season has not started yet.
with opener as (
  select user_id, league_id, season, min(kickoff_at) as day1
  from public.league_matches
  where matchday = 1 and kickoff_at is not null
  group by user_id, league_id, season
)
update public.league_matches m
set kickoff_at = (
      ((o.day1 at time zone 'Africa/Cairo')
        + ((m.matchday - 1
            + (m.matchday > 6)::int + (m.matchday > 12)::int + (m.matchday > 18)::int
            + (m.matchday > 24)::int + (m.matchday > 30)::int) * interval '1 day')
      ) at time zone 'Africa/Cairo')
from opener o
where m.user_id = o.user_id and m.league_id = o.league_id and m.season = o.season
  and m.status = 'scheduled' and m.kickoff_at is not null and m.matchday > 1;
