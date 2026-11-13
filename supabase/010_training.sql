-- Run once in the Supabase SQL editor (after 009).
-- Training sessions: three players a week, the gain is stored when the session is done.

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season text not null,
  matchday int not null,
  player_id text not null,
  gain numeric(4, 2) not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, season, matchday, player_id)
);
alter table public.training_sessions enable row level security;
drop policy if exists "training read" on public.training_sessions;
drop policy if exists "training add" on public.training_sessions;
create policy "training read" on public.training_sessions for select to authenticated using (auth.uid() = user_id);
create policy "training add" on public.training_sessions for insert to authenticated with check (auth.uid() = user_id);
