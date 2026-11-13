-- Run once in the Supabase SQL editor (after 011).
-- 1) a manager can run a club in more than one league  2) trophies are kept per league and can be any kind

create table if not exists public.manager_careers (
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id text not null,
  club_id text not null,
  room_id uuid,
  appointed_at timestamptz not null default now(),
  primary key (user_id, league_id)
);
alter table public.manager_careers enable row level security;
drop policy if exists "careers read" on public.manager_careers;
drop policy if exists "careers add" on public.manager_careers;
drop policy if exists "careers edit" on public.manager_careers;
create policy "careers read" on public.manager_careers for select to authenticated using (auth.uid() = user_id);
create policy "careers add" on public.manager_careers for insert to authenticated with check (auth.uid() = user_id);
create policy "careers edit" on public.manager_careers for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- trophies: any kind (new cups need no change here), one row per league, season and kind
update public.trophies set league_id = 'premier-league' where league_id is null;
alter table public.trophies alter column league_id set default 'premier-league';
alter table public.trophies alter column league_id set not null;
alter table public.trophies drop constraint if exists trophies_kind_check;
alter table public.trophies drop constraint if exists trophies_user_id_kind_season_key;
alter table public.trophies drop constraint if exists trophies_user_kind_season_league_key;
alter table public.trophies add constraint trophies_user_kind_season_league_key unique (user_id, kind, season, league_id);

-- start with the career you already have
insert into public.manager_careers (user_id, league_id, club_id, room_id, appointed_at)
select user_id, coalesce(selected_league, 'premier-league'), selected_club, room_id, coalesce(club_appointed_at, now())
from public.manager_contracts where selected_club is not null
on conflict do nothing;
