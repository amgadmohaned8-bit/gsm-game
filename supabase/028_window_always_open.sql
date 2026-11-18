-- Run once in the Supabase SQL editor (safe to run again).
-- The transfer window is open on every matchday.
create or replace function public.window_open(p_matchday int) returns boolean language sql immutable as $$
  select true
$$;
