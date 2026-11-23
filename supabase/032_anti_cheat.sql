-- Run once in the Supabase SQL editor (after 031). Safe to run again.
--
-- Server-side validation, time protection and anti-cheat.
-- The browser can no longer decide on its own:
--   * the time (every check uses the database clock; the app asks server_now())
--   * when a match was played (played_at is always the database time)
--   * a result that is out of range, a played match changing, a kickoff moved
--   * what a service costs (the analyst, training time, renewal fees, friendly income)
--   * many requests in a few seconds
-- Everything here only applies to requests from a signed-in player (auth.uid() is set).
-- Changes you make yourself in the SQL editor are never blocked.

-- ---------- the clock ----------
create or replace function public.server_now() returns timestamptz
  language sql stable as $$ select now() $$;
grant execute on function public.server_now() to anon, authenticated;

create or replace function public.is_player() returns boolean
  language sql stable as $$ select auth.uid() is not null $$;

-- ---------- league matches ----------
create or replace function public.league_match_guard() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;

  if tg_op = 'INSERT' then
    -- a new fixture is always unplayed, and cannot be dated in the past (except the shared fixtures of a league)
    new.status := 'scheduled';
    new.home_score := null;
    new.away_score := null;
    new.played_at := null;
    if new.kickoff_at is not null
       and new.kickoff_at < now() - interval '15 minutes' + greatest(new.matchday - 1, 0) * interval '1 day' then
      if not exists (
        select 1
        from public.room_fixtures rf
        join public.room_members rm on rm.room_id = rf.room_id and rm.user_id = auth.uid()
        where rf.season = new.season and rf.matchday = new.matchday
          and rf.home_club = new.home_club and rf.away_club = new.away_club
      ) then
        raise exception 'Kickoff too early for matchday %', new.matchday using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  -- an update
  if new.user_id <> old.user_id or new.league_id is distinct from old.league_id
     or new.season is distinct from old.season or new.matchday is distinct from old.matchday
     or new.home_club is distinct from old.home_club or new.away_club is distinct from old.away_club then
    raise exception 'A fixture cannot change who plays or when in the season' using errcode = 'P0001';
  end if;

  -- the kickoff never moves; an old fixture without one may get its first
  if old.kickoff_at is not null and new.kickoff_at is distinct from old.kickoff_at then
    raise exception 'The kickoff of a fixture cannot be changed' using errcode = 'P0001';
  end if;
  if old.kickoff_at is null and new.kickoff_at is not null and new.kickoff_at < now() - interval '1 day' then
    raise exception 'Kickoff in the past' using errcode = 'P0001';
  end if;

  if old.status = 'completed' then
    if new.status <> 'completed' or new.played_at is distinct from old.played_at then
      raise exception 'A played match cannot be reopened' using errcode = 'P0001';
    end if;
    if new.home_score is distinct from old.home_score or new.away_score is distinct from old.away_score then
      -- only the half-time changes revise a score, within minutes of the match
      if old.played_at is null or now() - old.played_at > interval '30 minutes' then
        raise exception 'A played match cannot change its score' using errcode = 'P0001';
      end if;
      if new.home_score is null or new.away_score is null
         or new.home_score not between 0 and 12 or new.away_score not between 0 and 12 then
        raise exception 'Impossible score' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  if new.status = 'completed' then
    if old.kickoff_at is not null and now() < old.kickoff_at then
      raise exception 'This match has not kicked off yet' using errcode = 'P0001';
    end if;
    if new.home_score is null or new.away_score is null
       or new.home_score not between 0 and 12 or new.away_score not between 0 and 12 then
      raise exception 'Impossible score' using errcode = 'P0001';
    end if;
    new.played_at := now();
    return new;
  end if;

  -- still unplayed: nothing about the result may be written
  if new.home_score is not null or new.away_score is not null or new.played_at is not null then
    raise exception 'An unplayed match has no result' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists league_match_guard_trg on public.league_matches;
create trigger league_match_guard_trg
  before insert or update on public.league_matches
  for each row execute function public.league_match_guard();

-- ---------- cup and continental matches ----------
create or replace function public.competition_match_guard() returns trigger
  language plpgsql as $$
declare
  kick_old text;
  kick_new text;
begin
  if auth.uid() is null then return new; end if;

  if tg_op = 'INSERT' then
    new.status := 'scheduled';
    new.home_score := null;
    new.away_score := null;
    new.pens_home := null;
    new.pens_away := null;
    new.winner := null;
    new.played_at := null;
    return new;
  end if;

  if new.user_id <> old.user_id or new.season is distinct from old.season
     or new.round_no is distinct from old.round_no or new.slot is distinct from old.slot
     or new.home_club is distinct from old.home_club or new.away_club is distinct from old.away_club then
    raise exception 'A tie cannot change who plays' using errcode = 'P0001';
  end if;

  kick_old := to_jsonb(old) ->> 'kickoff_at';
  kick_new := to_jsonb(new) ->> 'kickoff_at';
  if kick_old is distinct from kick_new then
    raise exception 'The kickoff cannot be changed' using errcode = 'P0001';
  end if;

  if old.status = 'completed' then
    if new.status <> 'completed' or new.played_at is distinct from old.played_at then
      raise exception 'A played match cannot be reopened' using errcode = 'P0001';
    end if;
    if new.home_score is distinct from old.home_score or new.away_score is distinct from old.away_score
       or new.pens_home is distinct from old.pens_home or new.pens_away is distinct from old.pens_away
       or new.winner is distinct from old.winner then
      if old.played_at is null or now() - old.played_at > interval '30 minutes' then
        raise exception 'A played match cannot change its result' using errcode = 'P0001';
      end if;
    end if;
  elsif new.status = 'completed' then
    if kick_old is not null and now() < kick_old::timestamptz then
      raise exception 'This match has not kicked off yet' using errcode = 'P0001';
    end if;
    new.played_at := now();
  else
    if new.home_score is not null or new.away_score is not null or new.winner is not null or new.played_at is not null then
      raise exception 'An unplayed match has no result' using errcode = 'P0001';
    end if;
    return new;
  end if;

  if new.home_score is null or new.away_score is null
     or new.home_score not between 0 and 12 or new.away_score not between 0 and 12 then
    raise exception 'Impossible score' using errcode = 'P0001';
  end if;
  if (new.pens_home is not null and new.pens_home not between 0 and 20)
     or (new.pens_away is not null and new.pens_away not between 0 and 20) then
    raise exception 'Impossible penalty score' using errcode = 'P0001';
  end if;
  if new.winner is not null and new.winner <> new.home_club and new.winner <> new.away_club then
    raise exception 'The winner must be one of the two clubs' using errcode = 'P0001';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['cup_matches', 'continental_matches', 'euro_matches'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists %I on public.%I', t || '_guard_trg', t);
      execute format('create trigger %I before insert or update on public.%I for each row execute function public.competition_match_guard()', t || '_guard_trg', t);
    end if;
  end loop;
end $$;

-- ---------- time stamps and prices that the browser cannot choose ----------
-- analyst: always 5M, always now
create or replace function public.analyst_guard() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  new.fee := 5;
  new.created_at := now();
  if (select count(*) from public.analyst_reports where user_id = new.user_id and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'Too many requests, wait a moment' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists analyst_guard_trg on public.analyst_reports;
create trigger analyst_guard_trg before insert on public.analyst_reports
  for each row execute function public.analyst_guard();

-- training: the clock starts on the database time, a gain stays inside what a session can give
create or replace function public.training_guard() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  -- the small practice gain of a friendly (negative matchday) is not a session: it is done at once
  new.created_at := case when new.matchday < 0 then now() - interval '8 hours' else now() end;
  if new.gain < 0 or new.gain > 1 then
    raise exception 'Impossible training gain' using errcode = 'P0001';
  end if;
  if (select count(*) from public.training_sessions where user_id = new.user_id and created_at > now() - interval '1 minute') >= 40 then
    raise exception 'Too many requests, wait a moment' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists training_guard_trg on public.training_sessions;
create trigger training_guard_trg before insert on public.training_sessions
  for each row execute function public.training_guard();

-- contract renewals: the fee is half a year of the wage, never negative, never made up
create or replace function public.renewal_guard() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  new.created_at := now();
  if new.wage < 0 or new.wage > 60 then
    raise exception 'Impossible wage' using errcode = 'P0001';
  end if;
  new.fee := round(new.wage * 0.5, 2);
  if (select count(*) from public.contract_renewals where user_id = new.user_id and created_at > now() - interval '1 minute') >= 12 then
    raise exception 'Too many requests, wait a moment' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists renewal_guard_trg on public.contract_renewals;
create trigger renewal_guard_trg before insert on public.contract_renewals
  for each row execute function public.renewal_guard();

-- friendlies: no money in them, five friendlies before a matchday at most
create or replace function public.friendly_guard() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  new.created_at := now();
  if new.income <> 0 then
    raise exception 'Impossible friendly income' using errcode = 'P0001';
  end if;
  if new.home_score not between 0 and 12 or new.away_score not between 0 and 12 then
    raise exception 'Impossible score' using errcode = 'P0001';
  end if;
  if (select count(*) from public.friendlies
      where user_id = new.user_id and season = new.season and after_matchday = new.after_matchday) >= 5 then
    raise exception 'Five friendlies is the most before a matchday' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists friendly_guard_trg on public.friendlies;
create trigger friendly_guard_trg before insert on public.friendlies
  for each row execute function public.friendly_guard();
