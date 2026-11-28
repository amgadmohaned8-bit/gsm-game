-- Manager trophy cabinet: one row per trophy a manager has won.
-- Rename the file prefix (033) to the next number in your migrations folder.
--
-- Writes happen only on the server (Edge Function / service role), never from
-- the browser, so a player cannot give himself trophies.

create table if not exists public.manager_trophies (
  id             uuid primary key default gen_random_uuid(),
  manager_id     uuid not null references auth.users(id) on delete cascade,
  trophy_type    text not null check (trophy_type ~ '^[a-z0-9_]+$'),
  season         integer not null check (season between 1900 and 3000),
  club_id        text not null,
  club_name      text not null,
  competition_id text,
  awarded_at     timestamptz not null default now(),
  -- the same trophy cannot be awarded twice for the same season and club
  unique (manager_id, trophy_type, season, club_id)
);

create index if not exists manager_trophies_manager_idx
  on public.manager_trophies (manager_id, season);

alter table public.manager_trophies enable row level security;

-- Any signed-in player can look at any manager's cabinet (multiplayer leagues).
drop policy if exists "manager_trophies_read" on public.manager_trophies;
create policy "manager_trophies_read"
  on public.manager_trophies
  for select
  to authenticated
  using (true);

-- No insert/update/delete policies on purpose: only the service role writes.
revoke insert, update, delete on public.manager_trophies from anon, authenticated;

-- Server-side helper. Returns true if a new trophy was recorded, false if it
-- was already there (safe to call twice when a season-end job is retried).
create or replace function public.award_trophy(
  p_manager_id     uuid,
  p_trophy_type    text,
  p_season         integer,
  p_club_id        text,
  p_club_name      text,
  p_competition_id text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.manager_trophies
    (manager_id, trophy_type, season, club_id, club_name, competition_id)
  values
    (p_manager_id, p_trophy_type, p_season, p_club_id, p_club_name, p_competition_id)
  on conflict (manager_id, trophy_type, season, club_id) do nothing;

  return found;
end;
$$;

revoke all on function public.award_trophy(uuid, text, integer, text, text, text)
  from public, anon, authenticated;
grant execute on function public.award_trophy(uuid, text, integer, text, text, text)
  to service_role;
