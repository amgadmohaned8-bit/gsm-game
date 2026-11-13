-- Run once in the Supabase SQL editor (after 006).
-- Lets a manager leave a shared league and clear their own transfer history.

drop policy if exists "members leave" on public.room_members;
create policy "members leave" on public.room_members
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "transfers delete own" on public.transfers;
create policy "transfers delete own" on public.transfers
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "listings delete own" on public.transfer_listings;
create policy "listings delete own" on public.transfer_listings
  for delete to authenticated using (auth.uid() = user_id);
