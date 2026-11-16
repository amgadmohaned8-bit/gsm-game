-- Run once in the Supabase SQL editor (after 019).
-- Talks between managers of a shared league: an offer for a player, and the answer
-- (accept, refuse or a counter price).

create table if not exists public.manager_offers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  buyer_club text not null,
  seller_id uuid not null references auth.users(id) on delete cascade,
  seller_club text not null,
  player_id text not null,
  amount numeric(8, 1) not null check (amount > 0),
  counter numeric(8, 1) check (counter is null or counter > 0),
  status text not null default 'open' check (status in ('open', 'countered', 'accepted', 'rejected', 'withdrawn')),
  season text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists manager_offers_live_idx
  on public.manager_offers (buyer_id, player_id) where status in ('open', 'countered');
alter table public.manager_offers enable row level security;
drop policy if exists "offers read" on public.manager_offers;
drop policy if exists "offers add" on public.manager_offers;
drop policy if exists "offers edit" on public.manager_offers;
drop policy if exists "offers delete" on public.manager_offers;
create policy "offers read" on public.manager_offers for select to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "offers add" on public.manager_offers for insert to authenticated
  with check (auth.uid() = buyer_id and public.is_room_member(room_id));
create policy "offers edit" on public.manager_offers for update to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id) with check (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "offers delete" on public.manager_offers for delete to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

-- the seller accepts an open offer, or the buyer accepts the counter price: both get their deal
create or replace function public.accept_manager_offer(p_offer uuid, p_season text, p_matchday int)
returns void language plpgsql security definer set search_path = public as $$
declare o public.manager_offers; price numeric(8, 1);
begin
  select * into o from public.manager_offers where id = p_offer for update;
  if o.id is null then raise exception 'Offer not found'; end if;
  if o.status = 'open' then
    if o.seller_id <> auth.uid() then raise exception 'Only the seller can accept this offer'; end if;
    price := o.amount;
  elsif o.status = 'countered' then
    if o.buyer_id <> auth.uid() then raise exception 'Only the buyer can accept the counter price'; end if;
    price := o.counter;
  else
    raise exception 'This offer is closed';
  end if;

  insert into public.transfers (user_id, season, player_id, from_club, to_club, fee, kind, matchday)
    values (o.buyer_id, p_season, o.player_id, o.seller_club, o.buyer_club, price, 'buy', p_matchday);
  insert into public.transfers (user_id, season, player_id, from_club, to_club, fee, kind, matchday)
    values (o.seller_id, p_season, o.player_id, o.seller_club, o.buyer_club, price, 'sell', p_matchday);
  update public.manager_offers set status = 'accepted', updated_at = now() where id = o.id;
  -- nobody else can buy him any more
  update public.manager_offers set status = 'rejected', updated_at = now()
    where seller_id = o.seller_id and player_id = o.player_id and id <> o.id and status in ('open', 'countered');
  update public.manager_listings set status = 'sold' where seller_id = o.seller_id and player_id = o.player_id and status = 'open';
end $$;
grant execute on function public.accept_manager_offer(uuid, text, int) to authenticated;

-- the transfers of the other managers of my shared league (so their squads are right in my game)
drop function if exists public.room_member_deals();
create or replace function public.room_member_deals()
returns table (id uuid, user_id uuid, season text, player_id text, from_club text, to_club text, fee numeric, kind text, matchday int, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select t.id, t.user_id, t.season, t.player_id, t.from_club, t.to_club, t.fee, t.kind, t.matchday, t.created_at
  from public.transfers t
  where t.user_id <> auth.uid()
    and t.user_id in (
      select rm.user_id from public.room_members rm
      where rm.room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
$$;
grant execute on function public.room_member_deals() to authenticated;

-- career reset: offers disappear with the career
drop policy if exists "offers delete" on public.manager_offers;
create policy "offers delete" on public.manager_offers for delete to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id);
