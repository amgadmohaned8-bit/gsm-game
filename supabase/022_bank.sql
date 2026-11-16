-- Run once in the Supabase SQL editor (after 021).
-- The bank: loans, interest, late fines, credit score and the history of every move.
-- Money moves only through the functions at the bottom, never by a direct insert, and
-- every function takes a request id, so pressing a button twice (or a page reload)
-- can never charge or pay twice.
--
-- Amounts are in millions. "Days" are game days: one matchday is one day, a season is
-- 38 days, and mid-season is day 19 (see lib/football/bank.ts).

-- Safe to run more than once, and over an earlier draft of the bank: old bank functions
-- are dropped first (they hold no data) and any missing column is added to the tables.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'bank\_%' loop
    execute 'drop function if exists ' || f.sig || ' cascade';
  end loop;
end $$;

create table if not exists public.bank_profile (
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id text not null,
  score int not null default 600 check (score between 0 and 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, league_id)
);

create table if not exists public.bank_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id text not null,
  club_id text,
  request_id uuid not null,
  principal numeric(10, 2) not null check (principal > 0),
  rate numeric(5, 4) not null,
  interest numeric(10, 2) not null,
  fees numeric(10, 2) not null default 0,
  penalties numeric(10, 2) not null default 0,
  paid numeric(10, 2) not null default 0,
  status text not null default 'active' check (status in ('active', 'repaid')),
  taken_day int not null,
  taken_season text not null,
  taken_matchday int,
  due_day int not null,
  stage int not null default 0,
  reschedules int not null default 0,
  closed_day int,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index if not exists bank_loans_user_idx on public.bank_loans (user_id, league_id, status);

create table if not exists public.bank_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id text not null,
  loan_id uuid references public.bank_loans(id) on delete cascade,
  club_id text,
  kind text not null,
  amount numeric(10, 2) not null default 0,   -- money that moved into (+) or out of (-) the club balance
  debt numeric(10, 2) not null default 0,     -- change in what the club owes
  points int not null default 0,              -- league points taken away
  score_delta int not null default 0,
  stage int,
  note text,
  season text,
  matchday int,
  game_day int,
  key text,
  created_at timestamptz not null default now(),
  unique (loan_id, key)
);
create index if not exists bank_events_user_idx on public.bank_events (user_id, league_id, created_at desc);

-- an earlier draft of these tables may exist: bring it up to date
alter table public.bank_profile add column if not exists score int not null default 600;
alter table public.bank_profile add column if not exists updated_at timestamptz not null default now();
alter table public.bank_loans add column if not exists club_id text;
alter table public.bank_loans add column if not exists request_id uuid not null default gen_random_uuid();
alter table public.bank_loans add column if not exists principal numeric(10, 2) not null default 0;
alter table public.bank_loans add column if not exists rate numeric(5, 4) not null default 0;
alter table public.bank_loans add column if not exists interest numeric(10, 2) not null default 0;
alter table public.bank_loans add column if not exists fees numeric(10, 2) not null default 0;
alter table public.bank_loans add column if not exists penalties numeric(10, 2) not null default 0;
alter table public.bank_loans add column if not exists paid numeric(10, 2) not null default 0;
alter table public.bank_loans add column if not exists status text not null default 'active';
alter table public.bank_loans add column if not exists taken_day int not null default 0;
alter table public.bank_loans add column if not exists taken_season text not null default '';
alter table public.bank_loans add column if not exists taken_matchday int;
alter table public.bank_loans add column if not exists due_day int not null default 0;
alter table public.bank_loans add column if not exists stage int not null default 0;
alter table public.bank_loans add column if not exists reschedules int not null default 0;
alter table public.bank_loans add column if not exists closed_day int;
alter table public.bank_events add column if not exists club_id text;
alter table public.bank_events add column if not exists amount numeric(10, 2) not null default 0;
alter table public.bank_events add column if not exists debt numeric(10, 2) not null default 0;
alter table public.bank_events add column if not exists points int not null default 0;
alter table public.bank_events add column if not exists score_delta int not null default 0;
alter table public.bank_events add column if not exists stage int;
alter table public.bank_events add column if not exists note text;
alter table public.bank_events add column if not exists season text;
alter table public.bank_events add column if not exists matchday int;
alter table public.bank_events add column if not exists game_day int;
alter table public.bank_events add column if not exists key text;
alter table public.bank_profile enable row level security;
alter table public.bank_loans enable row level security;
alter table public.bank_events enable row level security;
drop policy if exists "bank profile read" on public.bank_profile;
drop policy if exists "bank loans read" on public.bank_loans;
drop policy if exists "bank events read" on public.bank_events;
create policy "bank profile read" on public.bank_profile for select to authenticated using (auth.uid() = user_id);
create policy "bank loans read" on public.bank_loans for select to authenticated using (auth.uid() = user_id);
create policy "bank events read" on public.bank_events for select to authenticated using (auth.uid() = user_id);
-- no insert / update / delete policies: only the functions below can change anything
revoke insert, update, delete on public.bank_profile, public.bank_loans, public.bank_events from authenticated, anon;

-- ---------- rules ----------

create or replace function public.bank_limit(p_score int) returns numeric language sql immutable as $$
  select case when p_score >= 750 then 300 when p_score >= 650 then 250 when p_score >= 550 then 200
              when p_score >= 450 then 120 when p_score >= 350 then 60 when p_score >= 200 then 25 else 0 end::numeric
$$;

create or replace function public.bank_rate(p_principal numeric, p_score int) returns numeric language sql immutable as $$
  select (case when p_principal <= 50 then 0.10 when p_principal <= 100 then 0.15 when p_principal <= 200 then 0.20 else 0.25 end)
       + (case when p_score >= 850 then -0.03 when p_score >= 750 then -0.02 when p_score >= 650 then -0.01
               when p_score >= 550 then 0 when p_score >= 450 then 0.01 when p_score >= 350 then 0.02 else 0.03 end)
$$;

create or replace function public.bank_owed(l public.bank_loans) returns numeric language sql immutable as $$
  select l.principal + l.interest + l.fees + l.penalties - l.paid
$$;

create or replace function public.bank_bump(p_user uuid, p_league text, p_delta int) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.bank_profile (user_id, league_id) values (p_user, p_league) on conflict do nothing;
  update public.bank_profile set score = greatest(0, least(1000, score + p_delta)), updated_at = now()
    where user_id = p_user and league_id = p_league;
end $$;

-- a loan that has been paid in full is closed, and the payment shapes the credit score
create or replace function public.bank_close_if_paid(p_loan uuid, p_day int, p_season text, p_matchday int)
returns void language plpgsql security definer set search_path = public as $$
declare l public.bank_loans; bonus int;
begin
  select * into l from public.bank_loans where id = p_loan for update;
  if l.status <> 'active' or public.bank_owed(l) > 0.004 then return; end if;
  bonus := case when p_day <= l.due_day - 5 then 80 when p_day <= l.due_day then 60 else 10 end;
  update public.bank_loans set status = 'repaid', closed_day = p_day, stage = 0 where id = l.id;
  perform public.bank_bump(l.user_id, l.league_id, bonus);
  insert into public.bank_events (user_id, league_id, loan_id, club_id, kind, score_delta, note, season, matchday, game_day, key)
    values (l.user_id, l.league_id, l.id, l.club_id, 'cleared', bonus,
            case when p_day <= l.due_day then 'Loan repaid on time' else 'Loan repaid late' end,
            p_season, p_matchday, p_day, 'cleared')
    on conflict (loan_id, key) do nothing;
end $$;

-- ---------- actions ----------

create or replace function public.bank_take_loan(
  p_league text, p_request uuid, p_principal numeric, p_due_day int, p_day int,
  p_season text, p_matchday int, p_club text
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); sc int; r numeric; out_now numeric; lid uuid; intr numeric;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select id into lid from public.bank_loans where user_id = uid and request_id = p_request;
  if lid is not null then return lid; end if;

  if p_principal < 10 or p_principal > 300 then raise exception 'Loans run from 10M to 300M'; end if;
  if p_due_day <= p_day then raise exception 'The due date must be in the future'; end if;

  insert into public.bank_profile (user_id, league_id) values (uid, p_league) on conflict do nothing;
  select score into sc from public.bank_profile where user_id = uid and league_id = p_league for update;

  if exists (select 1 from public.bank_loans where user_id = uid and league_id = p_league and status = 'active' and stage >= 2) then
    raise exception 'The bank has blocked new loans until your overdue debt is paid';
  end if;
  select coalesce(sum(principal), 0) into out_now from public.bank_loans
    where user_id = uid and league_id = p_league and status = 'active';
  if out_now + p_principal > public.bank_limit(sc) then
    raise exception 'Your credit rating allows % M in loans at most', public.bank_limit(sc);
  end if;

  r := public.bank_rate(p_principal, sc);
  intr := round(p_principal * r, 2);
  insert into public.bank_loans (user_id, league_id, club_id, request_id, principal, rate, interest,
                                 taken_day, taken_season, taken_matchday, due_day)
    values (uid, p_league, p_club, p_request, p_principal, r, intr, p_day, p_season, p_matchday, p_due_day)
    returning id into lid;
  insert into public.bank_events (user_id, league_id, loan_id, club_id, kind, amount, debt, note, season, matchday, game_day, key)
    values (uid, p_league, lid, p_club, 'loan', p_principal, p_principal + intr,
            'Loan approved at ' || round(r * 100, 1) || '%', p_season, p_matchday, p_day, 'loan');
  return lid;
end $$;

create or replace function public.bank_repay(
  p_loan uuid, p_request uuid, p_amount numeric, p_day int, p_season text, p_matchday int
) returns numeric language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l public.bank_loans; amt numeric;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into l from public.bank_loans where id = p_loan and user_id = uid for update;
  if l.id is null then raise exception 'Loan not found'; end if;
  if exists (select 1 from public.bank_events where loan_id = l.id and key = 'pay:' || p_request) then return 0; end if;
  if l.status <> 'active' then raise exception 'This loan is already repaid'; end if;
  amt := least(round(p_amount, 2), public.bank_owed(l));
  if amt <= 0 then raise exception 'Nothing to pay'; end if;
  update public.bank_loans set paid = paid + amt where id = l.id;
  insert into public.bank_events (user_id, league_id, loan_id, club_id, kind, amount, debt, note, season, matchday, game_day, key)
    values (uid, l.league_id, l.id, l.club_id, 'repay', -amt, -amt,
            case when p_day < l.due_day then 'Early payment' else 'Payment' end, p_season, p_matchday, p_day, 'pay:' || p_request);
  perform public.bank_close_if_paid(l.id, p_day, p_season, p_matchday);
  return amt;
end $$;

-- more time for a price: 10, 19 or 38 days, with a fee on what is still owed
create or replace function public.bank_reschedule(
  p_loan uuid, p_request uuid, p_days int, p_day int, p_season text, p_matchday int
) returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l public.bank_loans; fee numeric; nd int;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select * into l from public.bank_loans where id = p_loan and user_id = uid for update;
  if l.id is null then raise exception 'Loan not found'; end if;
  if exists (select 1 from public.bank_events where loan_id = l.id and key = 'rs:' || p_request) then return; end if;
  if l.status <> 'active' then raise exception 'This loan is already repaid'; end if;
  if p_days not in (10, 19, 38) then raise exception 'Choose 10, 19 or 38 days'; end if;
  if l.stage >= 2 then raise exception 'The bank no longer reschedules a loan this late'; end if;
  if l.reschedules >= 2 then raise exception 'A loan can be rescheduled twice at most'; end if;
  fee := round(public.bank_owed(l) * (case p_days when 10 then 0.04 when 19 then 0.08 else 0.15 end), 2);
  nd := greatest(l.due_day, p_day) + p_days;
  update public.bank_loans set fees = fees + fee, due_day = nd, stage = 0, reschedules = reschedules + 1 where id = l.id;
  perform public.bank_bump(uid, l.league_id, -10);
  insert into public.bank_events (user_id, league_id, loan_id, club_id, kind, debt, score_delta, note, season, matchday, game_day, key)
    values (uid, l.league_id, l.id, l.club_id, 'reschedule', fee, -10, 'Rescheduled by ' || p_days || ' days', p_season, p_matchday, p_day, 'rs:' || p_request);
end $$;

-- the game calendar moved on: apply every late stage that is due, each one only once
create or replace function public.bank_sync(p_league text, p_day int, p_season text, p_matchday int)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l record; late int; target int; s int; fine numeric; sd int; pts int; k text; note text; applied int := 0;
begin
  if uid is null then return 0; end if;
  for l in select * from public.bank_loans where user_id = uid and league_id = p_league and status = 'active' and due_day < p_day order by created_at for update loop
    late := p_day - l.due_day;
    target := case when late >= 45 then 5 when late >= 31 then 4 when late >= 16 then 3 when late >= 8 then 2 else 1 end;
    s := l.stage;
    while s < target loop
      s := s + 1;
      fine := l.principal * (case s when 1 then 0.05 when 2 then 0.10 when 3 then 0.10 else 0 end);
      sd := case s when 1 then -30 when 2 then -60 when 3 then -80 when 4 then -120 else -100 end;
      pts := case s when 5 then 6 else 0 end;
      k := case s when 1 then 'warning' when 2 then 'restriction' when 3 then 'freeze' when 4 then 'crisis' else 'points' end;
      note := case s
        when 1 then 'Official warning: payment is late. A 5% fine was added.'
        when 2 then 'A further 10% fine. New loans are blocked and your credit rating drops.'
        when 3 then 'Half of your transfer budget is frozen and signing players is banned. A 10% fine was added.'
        when 4 then 'The club is in a financial crisis. The bank may force a player sale.'
        else 'Extreme default: 6 league points were taken away.' end;
      insert into public.bank_events (user_id, league_id, loan_id, club_id, kind, debt, points, score_delta, stage, note, season, matchday, game_day, key)
        values (uid, p_league, l.id, l.club_id, k, round(fine, 2), pts, sd, s, note, p_season, p_matchday, p_day, 'stage' || s)
        on conflict (loan_id, key) do nothing;
      if found then
        update public.bank_loans set penalties = penalties + round(fine, 2) where id = l.id;
        perform public.bank_bump(uid, p_league, sd);
        applied := applied + 1;
      end if;
    end loop;
    update public.bank_loans set stage = greatest(stage, s) where id = l.id;
  end loop;
  return applied;
end $$;

-- a forced sale: what the club got for a player goes straight to the debt (once per round)
create or replace function public.bank_forced_sale(
  p_loan uuid, p_round int, p_amount numeric, p_player text, p_day int, p_season text, p_matchday int
) returns numeric language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l public.bank_loans; amt numeric;
begin
  if uid is null then return 0; end if;
  select * into l from public.bank_loans where id = p_loan and user_id = uid for update;
  if l.id is null or l.status <> 'active' or l.stage < 4 then return 0; end if;
  if exists (select 1 from public.bank_events where loan_id = l.id and key = 'forced:' || p_round) then return 0; end if;
  amt := least(round(p_amount, 2), public.bank_owed(l));
  if amt <= 0 then return 0; end if;
  update public.bank_loans set paid = paid + amt where id = l.id;
  insert into public.bank_events (user_id, league_id, loan_id, club_id, kind, amount, debt, note, season, matchday, game_day, key)
    values (uid, l.league_id, l.id, l.club_id, 'forced_sale', -amt, -amt, 'Forced sale: ' || p_player, p_season, p_matchday, p_day, 'forced:' || p_round);
  perform public.bank_close_if_paid(l.id, p_day, p_season, p_matchday);
  return amt;
end $$;

grant execute on function public.bank_take_loan(text, uuid, numeric, int, int, text, int, text) to authenticated;
grant execute on function public.bank_repay(uuid, uuid, numeric, int, text, int) to authenticated;
grant execute on function public.bank_reschedule(uuid, uuid, int, int, text, int) to authenticated;
grant execute on function public.bank_sync(text, int, text, int) to authenticated;
grant execute on function public.bank_forced_sale(uuid, int, numeric, text, int, text, int) to authenticated;
-- the helpers are used by the functions above only
revoke execute on function public.bank_bump(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.bank_close_if_paid(uuid, int, text, int) from public, anon, authenticated;
