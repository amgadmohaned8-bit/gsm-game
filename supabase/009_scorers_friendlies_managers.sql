-- Run once in the Supabase SQL editor (after 008).
-- 1) friendly matches   2) players that managers sell to each other

create table if not exists public.friendlies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season text not null,
  after_matchday int not null,
  home_club text not null,
  away_club text not null,
  home_score int not null,
  away_score int not null,
  income numeric(6, 2) not null default 0,   -- millions
  created_at timestamptz not null default now(),
  unique (user_id, season, after_matchday)
);
alter table public.friendlies enable row level security;
drop policy if exists "friendlies read" on public.friendlies;
drop policy if exists "friendlies add" on public.friendlies;
create policy "friendlies read" on public.friendlies for select to authenticated using (auth.uid() = user_id);
create policy "friendlies add" on public.friendlies for insert to authenticated with check (auth.uid() = user_id);

-- players a manager offers to the other managers of a shared league
create table if not exists public.manager_listings (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  seller_club text not null,
  player_id text not null,
  asking numeric(8, 1) not null check (asking > 0),
  status text not null default 'open' check (status in ('open', 'sold', 'withdrawn')),
  created_at timestamptz not null default now()
);
create unique index if not exists manager_listings_open_idx
  on public.manager_listings (seller_id, player_id) where status = 'open';
alter table public.manager_listings enable row level security;
drop policy if exists "mlist read" on public.manager_listings;
drop policy if exists "mlist add" on public.manager_listings;
drop policy if exists "mlist edit" on public.manager_listings;
create policy "mlist read" on public.manager_listings for select to authenticated
  using (public.is_room_member(room_id));
create policy "mlist add" on public.manager_listings for insert to authenticated
  with check (auth.uid() = seller_id and public.is_room_member(room_id));
create policy "mlist edit" on public.manager_listings for update to authenticated
  using (auth.uid() = seller_id) with check (auth.uid() = seller_id);

-- the buyer pays the asking price; both managers get their deal in one step
create or replace function public.buy_manager_listing(
  p_listing uuid, p_buyer_club text, p_from_club text, p_season text, p_matchday int
) returns void language plpgsql security definer set search_path = public as $$
declare l public.manager_listings;
begin
  select * into l from public.manager_listings where id = p_listing for update;
  if l.id is null or l.status <> 'open' then raise exception 'Listing is not available'; end if;
  if l.seller_id = auth.uid() then raise exception 'You cannot buy your own player'; end if;
  if not public.is_room_member(l.room_id) then raise exception 'Not in this league'; end if;

  insert into public.transfers (user_id, season, player_id, from_club, to_club, fee, kind, matchday)
    values (auth.uid(), p_season, l.player_id, p_from_club, p_buyer_club, l.asking, 'buy', p_matchday);
  insert into public.transfers (user_id, season, player_id, from_club, to_club, fee, kind, matchday)
    values (l.seller_id, p_season, l.player_id, l.seller_club, p_buyer_club, l.asking, 'sell', p_matchday);
  update public.manager_listings set status = 'sold' where id = l.id;
end $$;
grant execute on function public.buy_manager_listing(uuid, text, text, text, int) to authenticated;
