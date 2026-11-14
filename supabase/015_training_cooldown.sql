-- Run once in the Supabase SQL editor (after 014).
-- Training now works in sessions of up to three players that take 8 hours.
-- The same player can be trained again in the same matchday, so the old
-- "one row per player per matchday" rule is removed.

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.training_sessions'::regclass and contype = 'u'
  loop
    execute format('alter table public.training_sessions drop constraint %I', c);
  end loop;
end $$;
