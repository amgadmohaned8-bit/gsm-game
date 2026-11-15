-- Run once in the Supabase SQL editor (after 020).
-- A manager can run up to four teams, even in the same league. Each team is its own
-- save: its signings, sales and training carry the team's id (league_id, like
-- "egyptian-premier-league" or "egyptian-premier-league~2"). Old rows stay empty
-- and count as the first team of their league.

alter table public.transfers add column if not exists league_id text;
alter table public.transfer_listings add column if not exists league_id text;
alter table public.training_sessions add column if not exists league_id text;
create index if not exists transfers_user_league_idx on public.transfers (user_id, league_id);

-- deals between managers carry the shared league's id
create or replace function public.accept_manager_offer(p_offer uuid, p_season text, p_matchday int)
returns void language plpgsql security definer set search_path = public as $$
declare o public.manager_offers; price numeric(8, 1); lg text;
begin
  select * into o from public.manager_offers where id = p_offer for update;
  if o.id is null then raise exception 'Offer not found'; end if;
  select league_id into lg from public.rooms where id = o.room_id;
  if o.status = 'open' then
    if o.seller_id <> auth.uid() then raise exception 'Only the seller can accept this offer'; end if;
    price := o.amount;
  elsif o.status = 'countered' then
    if o.buyer_id <> auth.uid() then raise exception 'Only the buyer can accept the counter price'; end if;
    price := o.counter;
  else
    raise exception 'This offer is closed';
  end if;

  insert into public.transfers (user_id, season, player_id, from_club, to_club, fee, kind, matchday, league_id)
    values (o.buyer_id, p_season, o.player_id, o.seller_club, o.buyer_club, price, 'buy', p_matchday, lg);
  insert into public.transfers (user_id, season, player_id, from_club, to_club, fee, kind, matchday, league_id)
    values (o.seller_id, p_season, o.player_id, o.seller_club, o.buyer_club, price, 'sell', p_matchday, lg);
  update public.manager_offers set status = 'accepted', updated_at = now() where id = o.id;
  update public.manager_offers set status = 'rejected', updated_at = now()
    where seller_id = o.seller_id and player_id = o.player_id and id <> o.id and status in ('open', 'countered');
  update public.manager_listings set status = 'sold' where seller_id = o.seller_id and player_id = o.player_id and status = 'open';
end $$;
grant execute on function public.accept_manager_offer(uuid, text, int) to authenticated;

drop function if exists public.room_member_deals();
create or replace function public.room_member_deals()
returns table (id uuid, user_id uuid, season text, player_id text, from_club text, to_club text, fee numeric, kind text, matchday int, created_at timestamptz, league_id text)
language sql security definer stable set search_path = public as $$
  select t.id, t.user_id, t.season, t.player_id, t.from_club, t.to_club, t.fee, t.kind, t.matchday, t.created_at, t.league_id
  from public.transfers t
  where t.user_id <> auth.uid()
    and t.user_id in (
      select rm.user_id from public.room_members rm
      where rm.room_id in (select room_id from public.room_members where user_id = auth.uid())
    )
$$;
grant execute on function public.room_member_deals() to authenticated;

create or replace function public.buy_manager_listing(
  p_listing uuid, p_buyer_club text, p_from_club text, p_season text, p_matchday int
) returns void language plpgsql security definer set search_path = public as $$
declare l public.manager_listings; lg text;
begin
  select * into l from public.manager_listings where id = p_listing for update;
  if l.id is null or l.status <> 'open' then raise exception 'Listing is not available'; end if;
  if l.seller_id = auth.uid() then raise exception 'You cannot buy your own player'; end if;
  if not public.is_room_member(l.room_id) then raise exception 'Not in this league'; end if;
  select league_id into lg from public.rooms where id = l.room_id;

  insert into public.transfers (user_id, season, player_id, from_club, to_club, fee, kind, matchday, league_id)
    values (auth.uid(), p_season, l.player_id, p_from_club, p_buyer_club, l.asking, 'buy', p_matchday, lg);
  insert into public.transfers (user_id, season, player_id, from_club, to_club, fee, kind, matchday, league_id)
    values (l.seller_id, p_season, l.player_id, l.seller_club, p_buyer_club, l.asking, 'sell', p_matchday, lg);
  update public.manager_listings set status = 'sold' where id = l.id;
end $$;
grant execute on function public.buy_manager_listing(uuid, text, text, text, int) to authenticated;
