-- Run once in the Supabase SQL editor (after 016).
-- A new appointment starts a clean career, so a manager may delete his own rows in these tables.

do $$
declare t text;
begin
  foreach t in array array['transfers', 'transfer_listings', 'training_sessions', 'match_lineups', 'contract_renewals', 'press_quotes', 'manager_careers', 'friendlies']
  loop
    execute format('drop policy if exists "career reset" on public.%I', t);
    execute format('create policy "career reset" on public.%I for delete to authenticated using (auth.uid() = user_id)', t);
  end loop;
end $$;
