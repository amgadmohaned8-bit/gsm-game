-- =====================================================================
-- GSM Bank & Loans  |  شغّله مرة واحدة في Supabase SQL Editor
-- لا يعدّل ولا يحذف أي جدول أو دالة موجودة.
-- الأيام = "يوم لعبة" مطلق (رقم صحيح يزيد مع تقويم اللعبة) ويتبعت من الكلاينت.
-- لا يوجد استخدام لـ now() في حساب التأخير أبداً.
-- =====================================================================

-- وحدة المبالغ: 1000000 لو اللعبة بتخزن الفلوس كاملة (مثلاً 10000000)،
-- وغيّرها لـ 1 لو بتخزن بالملايين (10 = 10M).
create or replace function public.bank_unit() returns numeric
language sql immutable as $$ select 1000000::numeric $$;

-- ---------------------------------------------------------------- tables
create table if not exists public.credit_scores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  score      int  not null default 600 check (score between 0 and 1000),
  updated_at timestamptz not null default now()
);

create table if not exists public.loans (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  club_id         text,
  season          text not null,
  principal       numeric not null check (principal > 0),
  interest_rate   numeric not null,
  interest_amount numeric not null,
  fines_amount    numeric not null default 0,
  reschedule_fees numeric not null default 0,
  paid_amount     numeric not null default 0,
  start_game_day  int not null,
  due_game_day    int not null,
  penalty_stage   int not null default 0 check (penalty_stage between 0 and 5),
  status          text not null default 'active' check (status in ('active','paid')),
  created_at      timestamptz not null default now(),
  paid_at         timestamptz
);
create index if not exists loans_user_status_idx on public.loans(user_id, status);

create table if not exists public.loan_penalties (
  id              uuid primary key default gen_random_uuid(),
  loan_id         uuid not null references public.loans(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  stage           int not null check (stage between 1 and 5),
  kind            text not null,
  amount          numeric not null default 0,
  points_deducted int not null default 0,
  game_day        int not null,
  created_at      timestamptz not null default now(),
  unique (loan_id, stage)            -- كل مرحلة تتنفذ مرة واحدة فقط
);

create table if not exists public.loan_reschedules (
  id          uuid primary key default gen_random_uuid(),
  loan_id     uuid not null references public.loans(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  old_due_day int not null,
  new_due_day int not null,
  extend_days int not null,
  fee         numeric not null,
  game_day    int not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.loan_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  loan_id         uuid references public.loans(id) on delete set null,
  kind            text not null check (kind in ('disburse','repay','reschedule_fee','fine')),
  amount          numeric not null,
  cash_delta      numeric not null default 0,   -- + يدخل ميزانية النادي، - يتخصم منها
  cash_applied    boolean not null default false,
  game_day        int not null,
  season          text,
  idempotency_key text not null,
  created_at      timestamptz not null default now(),
  unique (user_id, idempotency_key)             -- يمنع تكرار الخصم/الإضافة
);

-- ------------------------------------------------------------------- RLS
alter table public.credit_scores     enable row level security;
alter table public.loans             enable row level security;
alter table public.loan_penalties    enable row level security;
alter table public.loan_reschedules  enable row level security;
alter table public.loan_transactions enable row level security;

drop policy if exists "credit read own"  on public.credit_scores;
drop policy if exists "loans read own"   on public.loans;
drop policy if exists "pen read own"     on public.loan_penalties;
drop policy if exists "resch read own"   on public.loan_reschedules;
drop policy if exists "tx read own"      on public.loan_transactions;
create policy "credit read own" on public.credit_scores     for select using (auth.uid() = user_id);
create policy "loans read own"  on public.loans             for select using (auth.uid() = user_id);
create policy "pen read own"    on public.loan_penalties    for select using (auth.uid() = user_id);
create policy "resch read own"  on public.loan_reschedules  for select using (auth.uid() = user_id);
create policy "tx read own"     on public.loan_transactions for select using (auth.uid() = user_id);
-- مفيش INSERT/UPDATE/DELETE للكلاينت: الكتابة بس عن طريق الدوال تحت (SECURITY DEFINER).

-- --------------------------------------------------------------- helpers
create or replace function public._bank_begin() returns uuid
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'NOT_AUTHENTICATED'; end if;
  perform pg_advisory_xact_lock(hashtext('bank:' || u::text));   -- يمنع السباق والتكرار
  insert into credit_scores(user_id) values (u) on conflict (user_id) do nothing;
  return u;
end $$;

create or replace function public._bank_score(u uuid, delta int) returns void
language sql security definer set search_path = public as $$
  update credit_scores
     set score = greatest(0, least(1000, score + delta)), updated_at = now()
   where user_id = u
$$;

-- نسبة الفائدة حسب المبلغ + خصم/زيادة حسب التصنيف الائتماني
create or replace function public.bank_rate(p_amount numeric, p_score int) returns numeric
language sql immutable as $$
  select (case
            when p_amount <=  50 * public.bank_unit() then 10
            when p_amount <= 100 * public.bank_unit() then 15
            when p_amount <= 200 * public.bank_unit() then 20
            else 25 end)
       - (case when p_score >= 800 then 3
               when p_score >= 650 then 1
               when p_score <  300 then -3
               else 0 end)
$$;

-- ------------------------------------------------------------ quote loan
-- لشاشة التأكيد: يعرض الإجمالي المطلوب سداده قبل ما المدير يأكد
create or replace function public.quote_loan(p_amount numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); v_score int; v_rate numeric; v_int numeric;
begin
  if u is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select coalesce((select score from credit_scores where user_id = u), 600) into v_score;
  v_rate := bank_rate(p_amount, v_score);
  v_int  := round(p_amount * v_rate / 100);
  return jsonb_build_object('rate', v_rate, 'interest', v_int,
                            'total_due', p_amount + v_int, 'credit_score', v_score);
end $$;

-- ---------------------------------------------------------- request loan
create or replace function public.request_loan(
  p_amount numeric, p_season text, p_club text,
  p_game_day int, p_mid_day int, p_season_len int, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := _bank_begin();
  v_tx loan_transactions; v_score int; v_rate numeric; v_int numeric; v_due int; v_id uuid;
begin
  select * into v_tx from loan_transactions where user_id = u and idempotency_key = p_key;
  if found then
    return jsonb_build_object('applied', false, 'loan_id', v_tx.loan_id);
  end if;

  if exists (select 1 from loans where user_id = u and status = 'active' and penalty_stage >= 2) then
    raise exception 'LOANS_BLOCKED';
  end if;
  if p_amount < 10 * bank_unit() or p_amount > 300 * bank_unit() then
    raise exception 'AMOUNT_OUT_OF_RANGE';
  end if;
  if p_season_len is null or p_season_len <= 0 then raise exception 'BAD_CALENDAR'; end if;

  select score into v_score from credit_scores where user_id = u;
  if v_score < 300 and p_amount > 50 * bank_unit() then raise exception 'LIMIT_BY_CREDIT'; end if;

  v_rate := bank_rate(p_amount, v_score);
  v_int  := round(p_amount * v_rate / 100);          -- فائدة مرة واحدة على الأصل
  -- قبل منتصف الموسم => منتصف الموسم الحالي، وإلا => منتصف الموسم التالي
  v_due  := case when p_game_day < p_mid_day then p_mid_day else p_mid_day + p_season_len end;

  insert into loans(user_id, club_id, season, principal, interest_rate, interest_amount,
                    start_game_day, due_game_day)
  values (u, p_club, p_season, p_amount, v_rate, v_int, p_game_day, v_due)
  returning id into v_id;

  insert into loan_transactions(user_id, loan_id, kind, amount, cash_delta, game_day, season, idempotency_key)
  values (u, v_id, 'disburse', p_amount, p_amount, p_game_day, p_season, p_key);

  return jsonb_build_object('applied', true, 'loan_id', v_id, 'rate', v_rate,
         'interest', v_int, 'total_due', p_amount + v_int,
         'due_game_day', v_due, 'cash_delta', p_amount);
end $$;

-- ------------------------------------------------------------- repay loan
-- سداد كامل أو جزئي أو مبكر. الكلاينت لازم يتأكد إن الرصيد كافي قبل النداء.
create or replace function public.repay_loan(
  p_loan uuid, p_amount numeric, p_game_day int, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := _bank_begin();
  v_tx loan_transactions; l loans; v_out numeric; v_pay numeric; v_left numeric;
begin
  select * into v_tx from loan_transactions where user_id = u and idempotency_key = p_key;
  if found then
    return jsonb_build_object('applied', false, 'loan_id', v_tx.loan_id);
  end if;

  select * into l from loans where id = p_loan and user_id = u and status = 'active' for update;
  if not found then raise exception 'LOAN_NOT_FOUND'; end if;

  v_out := l.principal + l.interest_amount + l.fines_amount + l.reschedule_fees - l.paid_amount;
  v_pay := least(p_amount, v_out);
  if v_pay <= 0 then raise exception 'BAD_AMOUNT'; end if;
  v_left := v_out - v_pay;

  update loans
     set paid_amount = paid_amount + v_pay,
         status  = case when v_left <= 0 then 'paid' else 'active' end,
         paid_at = case when v_left <= 0 then now() else null end
   where id = l.id;

  insert into loan_transactions(user_id, loan_id, kind, amount, cash_delta, game_day, season, idempotency_key)
  values (u, l.id, 'repay', v_pay, -v_pay, p_game_day, l.season, p_key);

  if v_left <= 0 then   -- سداد كامل: القيود بتزول لوحدها لأنها مبنية على القروض النشطة
    perform _bank_score(u, case when p_game_day <= l.due_game_day then 40 else 10 end);
  end if;

  return jsonb_build_object('applied', true, 'paid', v_pay, 'remaining', v_left,
                            'cash_delta', -v_pay, 'fully_paid', v_left <= 0);
end $$;

-- ------------------------------------------------- daily penalties engine
-- نادِها مع كل يوم جديد في تقويم اللعبة (وعند فتح اللعبة). آمنة للتكرار.
-- المرحلة 1: تأخير 1-7   | غرامة 5% + تحذير
-- المرحلة 2: تأخير 8-15  | غرامة 10% + منع قروض جديدة + خفض تصنيف
-- المرحلة 3: تأخير 16-30 | تجميد جزء من ميزانية الانتقالات + منع التعاقد + غرامة إضافية 5%
-- المرحلة 4: تأخير 31+   | أزمة مالية + إمكانية بيع إجباري
-- المرحلة 5: تأخير 46+   | خصم نقاط (الحالات القصوى)
create or replace function public.process_loan_penalties(p_game_day int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := _bank_begin();
  l loans; late int; target int; s int;
  v_fine numeric; v_pts int; v_delta int; v_out jsonb := '[]'::jsonb;
begin
  for l in select * from loans
            where user_id = u and status = 'active' and due_game_day < p_game_day
            for update
  loop
    late   := p_game_day - l.due_game_day;
    target := case when late >= 46 then 5 when late >= 31 then 4
                   when late >= 16 then 3 when late >= 8  then 2 else 1 end;
    s := l.penalty_stage;
    while s < target loop
      s := s + 1;
      v_fine  := (case s when 1 then 0.05 when 2 then 0.10 when 3 then 0.05 else 0 end) * l.principal;
      v_pts   := case when s = 5 then 3 else 0 end;
      v_delta := case s when 1 then -30 when 2 then -60 when 3 then -100 when 4 then -150 else -100 end;

      insert into loan_penalties(loan_id, user_id, stage, kind, amount, points_deducted, game_day)
      values (l.id, u, s,
              (array['late_fine_1','late_fine_2','transfer_freeze','financial_crisis','points_deduction'])[s],
              v_fine, v_pts, p_game_day)
      on conflict (loan_id, stage) do nothing;

      if found then
        update loans set penalty_stage = s, fines_amount = fines_amount + v_fine where id = l.id;
        perform _bank_score(u, v_delta);
        v_out := v_out || jsonb_build_object('loan_id', l.id, 'stage', s, 'fine', v_fine, 'points', v_pts);
      end if;
    end loop;
  end loop;
  return jsonb_build_object('new_stages', v_out);
end $$;

-- ------------------------------------------------------------ reschedule
create or replace function public.bank_reschedule_fee(p_outstanding numeric, p_days int) returns numeric
language sql immutable as $$
  select round(p_outstanding * (case p_days when 15 then 0.04 when 30 then 0.08 when 60 then 0.15
                                else null end))
$$;

create or replace function public.quote_reschedule(p_loan uuid, p_days int, p_game_day int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); l loans; v_out numeric; v_fee numeric; v_new int;
begin
  select * into l from loans where id = p_loan and user_id = u and status = 'active';
  if not found then raise exception 'LOAN_NOT_FOUND'; end if;
  v_out := l.principal + l.interest_amount + l.fines_amount + l.reschedule_fees - l.paid_amount;
  v_fee := bank_reschedule_fee(v_out, p_days);
  if v_fee is null then raise exception 'BAD_EXTENSION'; end if;   -- المسموح 15 / 30 / 60 يوم
  v_new := greatest(l.due_game_day, p_game_day) + p_days;
  return jsonb_build_object('fee', v_fee, 'old_due_day', l.due_game_day, 'new_due_day', v_new,
                            'new_total_outstanding', v_out + v_fee);
end $$;

create or replace function public.reschedule_loan(
  p_loan uuid, p_days int, p_game_day int, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  u uuid := _bank_begin();
  v_tx loan_transactions; l loans; v_out numeric; v_fee numeric; v_new int;
begin
  select * into v_tx from loan_transactions where user_id = u and idempotency_key = p_key;
  if found then return jsonb_build_object('applied', false, 'loan_id', v_tx.loan_id); end if;

  select * into l from loans where id = p_loan and user_id = u and status = 'active' for update;
  if not found then raise exception 'LOAN_NOT_FOUND'; end if;
  if l.penalty_stage >= 2 then raise exception 'RESCHEDULE_NOT_ALLOWED'; end if;

  v_out := l.principal + l.interest_amount + l.fines_amount + l.reschedule_fees - l.paid_amount;
  v_fee := bank_reschedule_fee(v_out, p_days);
  if v_fee is null then raise exception 'BAD_EXTENSION'; end if;
  v_new := greatest(l.due_game_day, p_game_day) + p_days;

  update loans set due_game_day = v_new, reschedule_fees = reschedule_fees + v_fee where id = l.id;
  insert into loan_reschedules(loan_id, user_id, old_due_day, new_due_day, extend_days, fee, game_day)
  values (l.id, u, l.due_game_day, v_new, p_days, v_fee, p_game_day);
  insert into loan_transactions(user_id, loan_id, kind, amount, cash_delta, game_day, season, idempotency_key)
  values (u, l.id, 'reschedule_fee', v_fee, 0, p_game_day, l.season, p_key);   -- الرسوم بتتضاف للدين

  return jsonb_build_object('applied', true, 'fee', v_fee, 'new_due_day', v_new);
end $$;

-- ----------------------------------------------------------- bank status
-- كل بيانات الواجهة + أعلام القيود اللي لازم تطبقها اللعبة
create or replace function public.bank_status(p_game_day int, p_season text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u uuid := _bank_begin();
  v_score int; v_principal numeric; v_debt numeric; v_interest numeric;
  v_next int; v_stage int; v_pts int;
begin
  select score into v_score from credit_scores where user_id = u;
  select coalesce(sum(principal), 0),
         coalesce(sum(principal + interest_amount + fines_amount + reschedule_fees - paid_amount), 0),
         coalesce(sum(interest_amount + fines_amount + reschedule_fees), 0),
         min(due_game_day), coalesce(max(penalty_stage), 0)
    into v_principal, v_debt, v_interest, v_next, v_stage
    from loans where user_id = u and status = 'active';
  select coalesce(sum(p.points_deducted), 0) into v_pts
    from loan_penalties p join loans l on l.id = p.loan_id
   where p.user_id = u and l.season = p_season;

  return jsonb_build_object(
    'credit_score', v_score,
    'active_principal', v_principal,
    'total_debt', v_debt,
    'total_interest', v_interest,
    'next_due_game_day', v_next,
    'days_left', case when v_next is null then null else v_next - p_game_day end,
    'penalty_stage', v_stage,
    'loans_blocked', v_stage >= 2,
    'transfers_frozen', v_stage >= 3,
    'frozen_transfer_pct', case when v_stage >= 3 then 50 else 0 end,
    'signings_blocked', v_stage >= 3,
    'financial_crisis', v_stage >= 4,
    'forced_sale_allowed', v_stage >= 4,
    'points_deducted_season', v_pts
  );
end $$;

-- ---------------------------------- ربط الفلوس بميزانية النادي الحالية
-- الميزانية مش في Supabase، فالحركات بتتسجل هنا كـ "معلّقة" والكلاينت يطبقها ثم يعمل ack.
create or replace function public.bank_pending_cash()
returns table(id uuid, cash_delta numeric, kind text, loan_id uuid)
language sql security definer set search_path = public as $$
  select t.id, t.cash_delta, t.kind, t.loan_id
    from loan_transactions t
   where t.user_id = auth.uid() and not t.cash_applied and t.cash_delta <> 0
   order by t.created_at
$$;

create or replace function public.bank_ack_cash(p_ids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update loan_transactions set cash_applied = true
   where user_id = auth.uid() and id = any(p_ids) and not cash_applied;
  get diagnostics n = row_count;
  return n;
end $$;

-- --------------------------------------------------------------- grants
revoke all on function public._bank_begin()                       from public, anon, authenticated;
revoke all on function public._bank_score(uuid, int)              from public, anon, authenticated;
revoke all on function public.quote_loan(numeric)                 from public, anon;
revoke all on function public.request_loan(numeric,text,text,int,int,int,text) from public, anon;
revoke all on function public.repay_loan(uuid,numeric,int,text)   from public, anon;
revoke all on function public.process_loan_penalties(int)         from public, anon;
revoke all on function public.quote_reschedule(uuid,int,int)      from public, anon;
revoke all on function public.reschedule_loan(uuid,int,int,text)  from public, anon;
revoke all on function public.bank_status(int,text)               from public, anon;
revoke all on function public.bank_pending_cash()                 from public, anon;
revoke all on function public.bank_ack_cash(uuid[])               from public, anon;

grant execute on function public.quote_loan(numeric)                 to authenticated;
grant execute on function public.request_loan(numeric,text,text,int,int,int,text) to authenticated;
grant execute on function public.repay_loan(uuid,numeric,int,text)   to authenticated;
grant execute on function public.process_loan_penalties(int)         to authenticated;
grant execute on function public.quote_reschedule(uuid,int,int)      to authenticated;
grant execute on function public.reschedule_loan(uuid,int,int,text)  to authenticated;
grant execute on function public.bank_status(int,text)               to authenticated;
grant execute on function public.bank_pending_cash()                 to authenticated;
grant execute on function public.bank_ack_cash(uuid[])               to authenticated;
