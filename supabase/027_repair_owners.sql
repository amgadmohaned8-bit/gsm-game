-- Run once in the Supabase SQL editor (after 026). Safe to run again.
-- Rebuilds "who owns which player" in every shared league from the recorded transfers,
-- so a sale is never refused with "He is not at your club any more" because of a stale record.

do $$
declare t record; r record; holder uuid;
begin
  delete from public.room_player_owner;
  for t in select * from public.transfers order by created_at, id loop
    for r in
      select rm.room_id from public.room_members rm join public.rooms ro on ro.id = rm.room_id
      where rm.user_id = t.user_id
        and (t.league_id is null or split_part(ro.league_id, '~', 1) = split_part(t.league_id, '~', 1))
    loop
      if t.kind = 'buy' then holder := t.user_id;
      else select user_id into holder from public.room_members where room_id = r.room_id and club_id = t.to_club;
      end if;
      insert into public.room_player_owner (room_id, player_id, club_id, user_id, updated_at)
        values (r.room_id, t.player_id, t.to_club, holder, now())
        on conflict (room_id, player_id) do update set club_id = excluded.club_id, user_id = excluded.user_id, updated_at = now();
    end loop;
  end loop;
end $$;
