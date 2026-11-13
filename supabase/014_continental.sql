-- Run once in the Supabase SQL editor (after 013).
-- CAF Champions League and Confederation Cup: who is in, and every match.

create table if not exists public.continental_seasons (
  user_id uuid not null references auth.users(id) on delete cascade,
  comp_id text not null,            -- caf-champions-league | caf-confederation-cup
  season text not null,
  club_id text not null,            -- the manager's club in this competition
  egypt text[] not null,            -- the two Egyptian clubs (from the league table, or chosen by the manager)
  source text not null default 'standalone' check (source in ('standalone', 'league')),
  created_at timestamptz not null default now(),
  primary key (user_id, comp_id, season)
);

create table if not exists public.continental_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comp_id text not null,
  season text not null,
  round_no int not null check (round_no between 0 and 8), -- 0-5 group matchdays, 6 quarter, 7 semi, 8 final
  slot int not null,
  group_no int,
  home_club text not null,
  away_club text not null,
  home_score int,
  away_score int,
  pens_home int,
  pens_away int,
  winner text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed')),
  played_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, comp_id, season, round_no, slot)
);
create index if not exists continental_matches_idx on public.continental_matches (user_id, comp_id, season, round_no);

alter table public.continental_seasons enable row level security;
alter table public.continental_matches enable row level security;

do $$
declare t text;
begin
  foreach t in array array['continental_seasons', 'continental_matches'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
