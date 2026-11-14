-- Run once in the Supabase SQL editor (after 015).
-- 1) friendlies belong to one league (a new league starts clean)
-- 2) a friend you play a friendly against gets a message

alter table public.friendlies add column if not exists league_id text;
alter table public.friendlies add column if not exists opp_manager text;

-- old rows: find the league they were played in
update public.friendlies f
set league_id = coalesce(
  (select m.league_id from public.league_matches m
    where m.user_id = f.user_id and m.season = f.season
      and (m.home_club = f.home_club or m.away_club = f.home_club) limit 1),
  'premier-league')
where f.league_id is null;
alter table public.friendlies alter column league_id set default 'premier-league';
alter table public.friendlies alter column league_id set not null;

-- one friendly per matchday used to be unique per season: it must be per league now
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.friendlies'::regclass and contype = 'u'
  loop
    execute format('alter table public.friendlies drop constraint %I', c);
  end loop;
end $$;
create index if not exists friendlies_scope_idx on public.friendlies (user_id, league_id, season);

-- joining a shared league clears this manager's old friendlies of that league and season
drop policy if exists "friendlies delete" on public.friendlies;
create policy "friendlies delete" on public.friendlies for delete to authenticated using (auth.uid() = user_id);

-- messages between managers of the same shared league
create table if not exists public.friendly_notices (
  id uuid primary key default gen_random_uuid(),
  to_user uuid not null references auth.users(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  from_name text,
  season text not null,
  home_club text not null,
  away_club text not null,
  home_score int not null,
  away_score int not null,
  seen boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.friendly_notices enable row level security;
drop policy if exists "notices read" on public.friendly_notices;
drop policy if exists "notices send" on public.friendly_notices;
drop policy if exists "notices seen" on public.friendly_notices;
create policy "notices read" on public.friendly_notices for select to authenticated using (auth.uid() = to_user);
create policy "notices send" on public.friendly_notices for insert to authenticated
  with check (
    auth.uid() = from_user
    and exists (
      select 1 from public.room_members a join public.room_members b on a.room_id = b.room_id
      where a.user_id = auth.uid() and b.user_id = to_user
    )
  );
create policy "notices seen" on public.friendly_notices for update to authenticated using (auth.uid() = to_user) with check (auth.uid() = to_user);
