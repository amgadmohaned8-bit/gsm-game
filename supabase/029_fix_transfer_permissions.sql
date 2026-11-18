-- Run once in the Supabase SQL editor (safe to run again). Fixes "The database refused this" when selling.

-- the table and its rules for the person who is signed in
grant select, insert, update, delete on public.transfers to authenticated;
grant select, insert, update, delete on public.transfer_listings to authenticated;
alter table public.transfers enable row level security;

drop policy if exists "Managers read own transfers" on public.transfers;
create policy "Managers read own transfers" on public.transfers for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Managers add own transfers" on public.transfers;
create policy "Managers add own transfers" on public.transfers for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "transfers delete own" on public.transfers;
create policy "transfers delete own" on public.transfers for delete to authenticated using (auth.uid() = user_id);

alter table public.transfer_listings enable row level security;
drop policy if exists "Managers read own listings" on public.transfer_listings;
create policy "Managers read own listings" on public.transfer_listings for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Managers add own listings" on public.transfer_listings;
create policy "Managers add own listings" on public.transfer_listings for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Managers change own listings" on public.transfer_listings;
create policy "Managers change own listings" on public.transfer_listings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- the three triggers that run after a sale must act with full rights, whoever signed in
alter function public.transfers_guard() security definer set search_path = public;
alter function public.transfers_owner() security definer set search_path = public;
alter function public.transfers_unowned() security definer set search_path = public;
alter function public.room_owner(uuid, text) security definer set search_path = public;
grant execute on function public.room_owner(uuid, text) to authenticated;
