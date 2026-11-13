create table if not exists public.league_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id text not null,
  season text not null,
  matchday integer not null check (matchday between 1 and 38),
  home_club text not null,
  away_club text not null,
  home_score integer,
  away_score integer,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed')),
  played_at timestamptz,
  created_at timestamptz not null default now(),

  constraint different_clubs check (home_club <> away_club),
  constraint valid_scores check (
    (home_score is null or home_score >= 0)
    and (away_score is null or away_score >= 0)
  ),
  constraint completed_has_scores check (
    status <> 'completed'
    or (home_score is not null and away_score is not null)
  ),
  constraint unique_fixture unique (
    user_id, league_id, season, matchday, home_club, away_club
  )
);

create index if not exists league_matches_lookup
on public.league_matches (user_id, league_id, season, matchday);

alter table public.league_matches enable row level security;

drop policy if exists "Managers can view own matches"
on public.league_matches;

create policy "Managers can view own matches"
on public.league_matches
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Managers can insert own matches"
on public.league_matches;

create policy "Managers can insert own matches"
on public.league_matches
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Managers can update own matches"
on public.league_matches;

create policy "Managers can update own matches"
on public.league_matches
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);