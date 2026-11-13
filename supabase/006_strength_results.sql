-- Run once in the Supabase SQL editor (after 005).
-- Squad strength in shared leagues, and one agreed score per match.

alter table public.room_members add column if not exists strength numeric not null default 0;

drop policy if exists "members update own" on public.room_members;
create policy "members update own" on public.room_members
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- the first manager to play a match saves its score; everyone else reads it
create table if not exists public.room_results (
  room_id uuid not null references public.rooms(id) on delete cascade,
  season text not null,
  matchday int not null,
  home_club text not null,
  away_club text not null,
  home_score int not null,
  away_score int not null,
  created_at timestamptz not null default now(),
  primary key (room_id, season, matchday, home_club, away_club)
);
alter table public.room_results enable row level security;
drop policy if exists "results read" on public.room_results;
drop policy if exists "results add" on public.room_results;
create policy "results read" on public.room_results for select to authenticated
  using (public.is_room_member(room_id));
create policy "results add" on public.room_results for insert to authenticated
  with check (public.is_room_member(room_id));
