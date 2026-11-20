-- Run once in the Supabase SQL editor (safe to run again).
-- Keeps each manager's lineup, tactic and cards in the database, so every device shows the same ones.

create table if not exists public.manager_prefs (
  user_id uuid not null references auth.users(id) on delete cascade,
  k text not null,
  v text not null,
  ts bigint not null default 0,
  primary key (user_id, k)
);

alter table public.manager_prefs enable row level security;
grant select, insert, update, delete on public.manager_prefs to authenticated;

drop policy if exists "prefs read own" on public.manager_prefs;
create policy "prefs read own" on public.manager_prefs for select to authenticated using (auth.uid() = user_id);
drop policy if exists "prefs add own" on public.manager_prefs;
create policy "prefs add own" on public.manager_prefs for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "prefs change own" on public.manager_prefs;
create policy "prefs change own" on public.manager_prefs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "prefs delete own" on public.manager_prefs;
create policy "prefs delete own" on public.manager_prefs for delete to authenticated using (auth.uid() = user_id);
