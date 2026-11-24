-- Run ONLY after the Edge Functions play-matchday, play-round, play-friendly and play-halftime are deployed
-- and a league match, a cup match, a friendly and a half-time change have each worked once.
-- From then on a signed-in player cannot write results from the browser: only the server can.
-- Safe to run again. (It replaces 034: running 034 first is fine.)

-- one set of half-time changes per match, kept by the server
create table if not exists public.halftime_used (
  user_id  uuid not null,
  match_id uuid not null,
  used_at  timestamptz not null default now(),
  primary key (user_id, match_id)
);
alter table public.halftime_used enable row level security;
-- no policy on purpose: the browser cannot read or write it, the server (service key) can

-- league matches: no first score and no score change from the browser
create or replace function public.league_match_lock() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if old.status = 'scheduled' and new.status = 'completed' then
    raise exception 'Matches are played by the server' using errcode = 'P0001';
  end if;
  if old.status = 'completed'
     and (new.home_score is distinct from old.home_score or new.away_score is distinct from old.away_score) then
    raise exception 'Scores are changed by the server' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists league_match_lock_trg on public.league_matches;
create trigger league_match_lock_trg
  before update on public.league_matches
  for each row execute function public.league_match_lock();

-- friendlies: written by the server only
create or replace function public.friendly_lock() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  raise exception 'Friendlies are played by the server' using errcode = 'P0001';
end $$;

drop trigger if exists friendly_lock_trg on public.friendlies;
create trigger friendly_lock_trg
  before insert on public.friendlies
  for each row execute function public.friendly_lock();

-- cup, European and CAF matches: no first result from the browser
create or replace function public.competition_lock() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  if old.status = 'scheduled' and new.status = 'completed' then
    raise exception 'Matches are played by the server' using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['cup_matches','euro_matches','continental_matches'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists competition_lock_trg on public.%I', t);
      execute format('create trigger competition_lock_trg before update on public.%I for each row execute function public.competition_lock()', t);
    end if;
  end loop;
end $$;
