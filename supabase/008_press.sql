-- Run once in the Supabase SQL editor (after 007).
-- What each manager said at the press conference, for the social feed.

create table if not exists public.press_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  manager_name text,
  club_id text not null,
  opponent_id text not null,
  season text not null,
  kind text not null default 'league',
  matchday int not null,
  quotes jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, season, kind, matchday)
);
alter table public.press_quotes enable row level security;

drop policy if exists "press read" on public.press_quotes;
drop policy if exists "press add" on public.press_quotes;
drop policy if exists "press edit" on public.press_quotes;
-- your own, and the other managers of a shared league you are in
create policy "press read" on public.press_quotes for select to authenticated
  using (auth.uid() = user_id or (room_id is not null and public.is_room_member(room_id)));
create policy "press add" on public.press_quotes for insert to authenticated
  with check (auth.uid() = user_id);
create policy "press edit" on public.press_quotes for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
