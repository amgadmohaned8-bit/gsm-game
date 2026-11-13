-- Run once in the Supabase SQL editor (after 012).
-- The cup is kept per league, so a manager with two leagues has two cups.

alter table public.cup_matches add column if not exists league_id text not null default 'premier-league';
alter table public.cup_matches drop constraint if exists cup_matches_user_id_season_round_no_slot_key;
alter table public.cup_matches drop constraint if exists cup_matches_user_league_season_round_slot_key;
alter table public.cup_matches add constraint cup_matches_user_league_season_round_slot_key unique (user_id, league_id, season, round_no, slot);
drop index if exists cup_matches_user_season_idx;
create index if not exists cup_matches_user_league_season_idx on public.cup_matches (user_id, league_id, season, round_no);
