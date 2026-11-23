-- Run once in the Supabase SQL editor (after 032). Safe to run again.
--
-- End-of-season awards: the finish of the club, the prize money for that finish,
-- and the awards of the season (golden boot, playmaker, player of the season, best eleven).
-- One row per club and season, saved the first time the season is found complete.
-- The prize is worked out here from the position, so the browser cannot choose it.

create table if not exists public.season_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id text not null,
  club_id text not null,
  season text not null,
  position integer not null,
  prize numeric not null default 0,
  awards jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, league_id, club_id, season)
);

alter table public.season_awards enable row level security;
grant select, insert, delete on public.season_awards to authenticated;

drop policy if exists "awards read own" on public.season_awards;
create policy "awards read own" on public.season_awards for select to authenticated using (auth.uid() = user_id);
drop policy if exists "awards add own" on public.season_awards;
create policy "awards add own" on public.season_awards for insert to authenticated with check (auth.uid() = user_id);
-- a saved prize can only go when its season is gone too (a new appointment wipes the career)
drop policy if exists "awards delete own" on public.season_awards;
create policy "awards delete own" on public.season_awards for delete to authenticated
  using (
    auth.uid() = user_id
    and not exists (
      select 1 from public.league_matches lm
      where lm.user_id = season_awards.user_id and lm.league_id = season_awards.league_id and lm.season = season_awards.season
    )
  );

-- millions of prize money for a finishing position
create or replace function public.award_prize(p_position integer, p_league text) returns numeric
  language sql immutable as $$
  select round(
    (case
       when p_position = 1 then 25
       when p_position = 2 then 18
       when p_position = 3 then 14
       when p_position = 4 then 10
       when p_position = 5 then 8
       when p_position = 6 then 6
       when p_position <= 10 then 4
       when p_position <= 15 then 2
       else 1
     end) * (case when split_part(p_league, '~', 1) = 'egyptian-premier-league' then 0.4 else 1 end)
  , 1)
$$;

create or replace function public.award_guard() returns trigger
  language plpgsql as $$
begin
  if auth.uid() is null then return new; end if;
  new.created_at := now();
  if new.position < 1 or new.position > 24 then
    raise exception 'Impossible position' using errcode = 'P0001';
  end if;
  -- only a finished season pays: this club has played matches and none is left
  if not exists (
       select 1 from public.league_matches lm
       where lm.user_id = new.user_id and lm.league_id = new.league_id and lm.season = new.season
         and (lm.home_club = new.club_id or lm.away_club = new.club_id) and lm.status = 'completed'
     )
     or exists (
       select 1 from public.league_matches lm
       where lm.user_id = new.user_id and lm.league_id = new.league_id and lm.season = new.season
         and (lm.home_club = new.club_id or lm.away_club = new.club_id) and lm.status <> 'completed'
     ) then
    raise exception 'The season is not over yet' using errcode = 'P0001';
  end if;
  new.prize := public.award_prize(new.position, new.league_id);
  return new;
end $$;

drop trigger if exists award_guard_trg on public.season_awards;
create trigger award_guard_trg before insert on public.season_awards
  for each row execute function public.award_guard();
