-- Run once in the Supabase SQL editor (after 001-004).
-- Friends (find by name, requests) and shared leagues (join with a code).

alter table public.manager_contracts add column if not exists room_id uuid;

-- A public card for every signed manager: used to search by name.
create or replace view public.manager_directory as
  select user_id, manager_name, avatar, selected_club, selected_league
  from public.manager_contracts
  where manager_name is not null and signed_at is not null;
grant select on public.manager_directory to authenticated;

-- ---------- friends ----------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;
drop policy if exists "friends read" on public.friendships;
drop policy if exists "friends request" on public.friendships;
drop policy if exists "friends answer" on public.friendships;
drop policy if exists "friends remove" on public.friendships;
create policy "friends read" on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
create policy "friends request" on public.friendships for insert to authenticated
  with check (auth.uid() = requester and status = 'pending');
create policy "friends answer" on public.friendships for update to authenticated
  using (auth.uid() = addressee) with check (auth.uid() = addressee);
create policy "friends remove" on public.friendships for delete to authenticated
  using (auth.uid() in (requester, addressee));

-- ---------- shared leagues ----------
create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  league_id text not null,
  season text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  club_id text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, club_id)
);

-- the one fixture list every member plays (all seasons of the room)
create table if not exists public.room_fixtures (
  room_id uuid not null references public.rooms(id) on delete cascade,
  season text not null,
  matchday int not null,
  home_club text not null,
  away_club text not null,
  kickoff_at timestamptz not null,
  primary key (room_id, season, matchday, home_club)
);

create or replace function public.is_room_member(rid uuid) returns boolean
  language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.room_members where room_id = rid and user_id = auth.uid());
$$;

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_fixtures enable row level security;

drop policy if exists "rooms read" on public.rooms;
drop policy if exists "members read" on public.room_members;
drop policy if exists "fixtures read" on public.room_fixtures;
drop policy if exists "fixtures add" on public.room_fixtures;
create policy "rooms read" on public.rooms for select to authenticated
  using (public.is_room_member(id));
create policy "members read" on public.room_members for select to authenticated
  using (public.is_room_member(room_id));
create policy "fixtures read" on public.room_fixtures for select to authenticated
  using (public.is_room_member(room_id));
create policy "fixtures add" on public.room_fixtures for insert to authenticated
  with check (public.is_room_member(room_id));

-- joining a league replaces the manager's own copy of that season
drop policy if exists "Managers can delete own matches" on public.league_matches;
create policy "Managers can delete own matches" on public.league_matches
  for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "Managers can delete own cup matches" on public.cup_matches;
create policy "Managers can delete own cup matches" on public.cup_matches
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.create_room(p_league text, p_season text, p_club text)
  returns table (id uuid, code text)
  language plpgsql security definer set search_path = public as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
  rid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms r where r.code = c);
  end loop;
  insert into public.rooms (code, owner_id, league_id, season)
    values (c, auth.uid(), p_league, p_season) returning rooms.id into rid;
  insert into public.room_members (room_id, user_id, club_id) values (rid, auth.uid(), p_club);
  update public.manager_contracts set room_id = rid where user_id = auth.uid();
  return query select rid, c;
end $$;

create or replace function public.room_preview(p_code text) returns json
  language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  select * into r from public.rooms where code = upper(trim(p_code));
  if not found then return null; end if;
  return json_build_object(
    'id', r.id, 'code', r.code, 'league_id', r.league_id, 'season', r.season,
    'owner', (select manager_name from public.manager_contracts where user_id = r.owner_id),
    'members', coalesce((
      select json_agg(json_build_object('user_id', m.user_id, 'club_id', m.club_id,
        'name', c.manager_name, 'avatar', c.avatar))
      from public.room_members m left join public.manager_contracts c on c.user_id = m.user_id
      where m.room_id = r.id), '[]'::json));
end $$;

create or replace function public.join_room(p_code text, p_club text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into r from public.rooms where code = upper(trim(p_code));
  if not found then raise exception 'room not found'; end if;
  if exists (select 1 from public.room_members where room_id = r.id and club_id = p_club and user_id <> auth.uid()) then
    raise exception 'club taken';
  end if;
  insert into public.room_members (room_id, user_id, club_id) values (r.id, auth.uid(), p_club)
    on conflict (room_id, user_id) do update set club_id = excluded.club_id;
  update public.manager_contracts
    set room_id = r.id, selected_league = r.league_id, selected_club = p_club, club_appointed_at = now()
    where user_id = auth.uid();
  return r.id;
end $$;

grant execute on function public.create_room(text, text, text) to authenticated;
grant execute on function public.room_preview(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
