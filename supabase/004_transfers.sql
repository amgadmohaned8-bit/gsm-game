-- Run once in the Supabase SQL editor.

-- Every completed transfer (fees are in millions).
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season text not null,
  player_id text not null,
  from_club text not null,
  to_club text not null,
  fee numeric(8, 1) not null check (fee >= 0),
  kind text not null check (kind in ('buy', 'sell')),
  matchday int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists transfers_user_idx on public.transfers (user_id, created_at);

alter table public.transfers enable row level security;

drop policy if exists "Managers read own transfers" on public.transfers;
create policy "Managers read own transfers" on public.transfers
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Managers add own transfers" on public.transfers;
create policy "Managers add own transfers" on public.transfers
  for insert to authenticated with check (auth.uid() = user_id);

-- Players a manager has put up for sale.
create table if not exists public.transfer_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  season text not null,
  player_id text not null,
  asking numeric(8, 1) not null check (asking > 0),
  listed_matchday int not null default 0,
  status text not null default 'open' check (status in ('open', 'sold', 'withdrawn')),
  created_at timestamptz not null default now()
);

create unique index if not exists transfer_listings_open_idx
  on public.transfer_listings (user_id, player_id) where status = 'open';

alter table public.transfer_listings enable row level security;

drop policy if exists "Managers read own listings" on public.transfer_listings;
create policy "Managers read own listings" on public.transfer_listings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Managers add own listings" on public.transfer_listings;
create policy "Managers add own listings" on public.transfer_listings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Managers change own listings" on public.transfer_listings;
create policy "Managers change own listings" on public.transfer_listings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
