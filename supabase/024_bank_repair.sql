-- Bank repair: takes back fines and bans that were applied before the real due date.
-- Safe to run more than once. Run it after 022_bank.sql.

create or replace function public.bank_rewind(p_league text, p_day int, p_season text, p_matchday int)
returns int language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); l public.bank_loans; e record; right_stage int; undone int := 0; sd int := 0;
begin
  if uid is null then return 0; end if;
  for l in select * from public.bank_loans where user_id = uid and league_id = p_league and status = 'active' for update loop
    right_stage := case when p_day - l.due_day >= 45 then 5 when p_day - l.due_day >= 31 then 4
                        when p_day - l.due_day >= 16 then 3 when p_day - l.due_day >= 8 then 2
                        when p_day - l.due_day >= 1 then 1 else 0 end;
    for e in select * from public.bank_events where loan_id = l.id and key ~ '^stage[1-5]$' and stage > right_stage loop
      update public.bank_loans set penalties = greatest(0, penalties - e.debt) where id = l.id;
      sd := sd + e.score_delta;
      delete from public.bank_events where id = e.id;
      undone := undone + 1;
    end loop;
    update public.bank_loans set stage = least(stage, right_stage) where id = l.id;
  end loop;
  if sd <> 0 then perform public.bank_bump(uid, p_league, -sd); end if;
  return undone;
end $$;

grant execute on function public.bank_rewind(text, int, text, int) to authenticated;
