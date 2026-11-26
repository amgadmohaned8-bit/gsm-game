-- In a shared league a listed player was only ever sold if another manager bought him.
-- Now a computer club can pay too, on the same day, exactly like in a solo league:
-- the game picks the moment between the listing and midnight (Cairo) and the price (the asking price, or the fair price at midnight).
-- The server (Edge Function "settle-sales") does it with the service role; the page can still do it for the signed-in seller.

create or replace function public.listing_sell_to_computer_as(
  p_seller uuid, p_listing uuid, p_club text, p_fee numeric, p_season text, p_matchday int
) returns void language plpgsql security definer set search_path = public as $$
declare l public.manager_listings; lg text;
begin
  if p_seller is null then raise exception 'Sign in first'; end if;
  select * into l from public.manager_listings where id = p_listing;
  if l.id is null or l.seller_id <> p_seller then raise exception 'This listing is gone'; end if;
  perform pg_advisory_xact_lock(hashtextextended(l.room_id::text || '|' || l.player_id, 0));
  select * into l from public.manager_listings where id = p_listing for update;
  if l.status <> 'open' then raise exception 'This player was just sold'; end if;
  if exists (select 1 from public.room_members where room_id = l.room_id and club_id = p_club) then
    raise exception 'That club is run by a manager';
  end if;
  if p_fee is null or p_fee <= 0 or p_fee > l.asking then raise exception 'That price is not allowed'; end if;
  if public.room_owner(l.room_id, l.player_id) <> l.seller_club then raise exception 'He is not in your squad'; end if;

  perform set_config('gsm.deal', '1', true);
  select league_id into lg from public.rooms where id = l.room_id;
  update public.manager_listings set status = 'sold' where id = l.id;
  insert into public.transfers (user_id, season, player_id, from_club, to_club, fee, kind, matchday, league_id)
    values (p_seller, p_season, l.player_id, l.seller_club, p_club, round(p_fee, 1), 'sell', p_matchday, lg);
  insert into public.room_player_owner (room_id, player_id, club_id, user_id, updated_at)
    values (l.room_id, l.player_id, p_club, null, now())
    on conflict (room_id, player_id) do update set club_id = excluded.club_id, user_id = null, updated_at = now();
  update public.manager_offers set status = 'rejected', updated_at = now()
    where room_id = l.room_id and player_id = l.player_id and status in ('open', 'countered');
end $$;
-- only the server (service role) may name the seller
revoke execute on function public.listing_sell_to_computer_as(uuid, uuid, text, numeric, text, int) from public, anon, authenticated;
grant execute on function public.listing_sell_to_computer_as(uuid, uuid, text, numeric, text, int) to service_role;

create or replace function public.listing_sell_to_computer(
  p_listing uuid, p_club text, p_fee numeric, p_season text, p_matchday int
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.listing_sell_to_computer_as(auth.uid(), p_listing, p_club, p_fee, p_season, p_matchday);
end $$;
revoke execute on function public.listing_sell_to_computer(uuid, text, numeric, text, int) from public, anon;
grant execute on function public.listing_sell_to_computer(uuid, text, numeric, text, int) to authenticated;
