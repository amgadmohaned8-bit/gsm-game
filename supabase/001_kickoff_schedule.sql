-- Run once in the Supabase SQL editor.
-- Adds a kickoff time to every match and stops matches being completed
-- before their kickoff (the check uses the database clock, not the browser).

alter table public.league_matches
  add column if not exists kickoff_at timestamptz;

create index if not exists league_matches_kickoff
  on public.league_matches (user_id, status, kickoff_at);

drop policy if exists "Managers can update own matches"
  on public.league_matches;

create policy "Managers can update own matches"
  on public.league_matches
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and (kickoff_at is null or now() >= kickoff_at)
  )
  with check (auth.uid() = user_id);

-- Matches created before this change have no kickoff_at (null) and stay
-- playable at any time, so an existing season keeps working.
