-- Run once in the Supabase SQL editor (safe to run again).
-- The performance analyst: a manager pays him for the report on one match.

create table if not exists public.analyst_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id text not null,
  season text not null,
  matchday integer not null,
  opponent text not null,
  fee numeric not null default 5,
  created_at timestamptz not null default now(),
  unique (user_id, club_id, season, matchday)
);

alter table public.analyst_reports enable row level security;
grant select, insert, delete on public.analyst_reports to authenticated;

drop policy if exists "analyst read own" on public.analyst_reports;
create policy "analyst read own" on public.analyst_reports for select to authenticated using (auth.uid() = user_id);
drop policy if exists "analyst add own" on public.analyst_reports;
create policy "analyst add own" on public.analyst_reports for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "analyst delete own" on public.analyst_reports;
create policy "analyst delete own" on public.analyst_reports for delete to authenticated using (auth.uid() = user_id);
