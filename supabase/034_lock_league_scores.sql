-- Run ONLY after the Edge Function "play-matchday" is deployed and a match played through it works.
-- From then on a signed-in player can no longer turn a scheduled league match into a played one:
-- only the server (the Edge Function, which has no player session) can save the first score.
-- The half-time revision of a score just played is not touched. Safe to run again.

create or replace function public.league_match_lock() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if old.status = 'scheduled' and new.status = 'completed' then
    raise exception 'Matches are played by the server' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists league_match_lock_trg on public.league_matches;
create trigger league_match_lock_trg
  before update on public.league_matches
  for each row execute function public.league_match_lock();
