-- Run once in the Supabase SQL editor (after 025).
-- UEFA Champions League and Europa League: who is in, and every match.

create table if not exists public.euro_seasons (
  user_id uuid not null references auth.users(id) on delete cascade,
  comp_id text not null check (comp_id in ('ucl', 'uel')),
  season text not null,
  club_id text not null,            -- the manager's club
  english text[] not null,          -- the English clubs in the competition (from the final Premier League table)
  source text not null default 'league',
  created_at timestamptz not null default now(),
  primary key (user_id, comp_id, season)
);

create table if not exists public.euro_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  comp_id text not null check (comp_id in ('ucl', 'uel')),
  season text not null,
  round_no int not null check (round_no between 0 and 16), -- 0-7 league phase, 8-9 play-off, 10-11 last 16, 12-13 quarter, 14-15 semi, 16 final
  slot int not null,
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
create index if not exists euro_matches_idx on public.euro_matches (user_id, comp_id, season, round_no);

alter table public.euro_seasons enable row level security;
alter table public.euro_matches enable row level security;

do $$
declare t text;
begin
  foreach t in array array['euro_seasons', 'euro_matches'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
