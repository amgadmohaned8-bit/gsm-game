-- Run once in the Supabase SQL editor (after 018).
-- Phones that can receive a message while the game is closed (Firebase push).

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
drop policy if exists "push own" on public.push_tokens;
create policy "push own" on public.push_tokens for select to authenticated using (auth.uid() = user_id);

-- a phone belongs to whoever is signed in on it now
create or replace function public.save_push_token(p_token text, p_platform text default 'android')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (p_token, auth.uid(), coalesce(p_platform, 'android'), now())
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
end $$;
grant execute on function public.save_push_token(text, text) to authenticated;
