-- Run once in the Supabase SQL editor (after 017).
-- Messages between managers also cover league matches against each other.

alter table public.friendly_notices add column if not exists kind text not null default 'friendly';
alter table public.friendly_notices add column if not exists matchday int;
