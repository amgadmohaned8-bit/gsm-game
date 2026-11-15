-- شغّله مرة واحدة في Supabase SQL Editor
-- النتيجة المعتمدة = اللي في room_results (التعادل 1-1)

-- 1) السبب الحقيقي: جدول room_results مفيهوش سياسة UPDATE
--    فتعديل الشوط الثاني (halftime) كان بيفشل بصمت.
drop policy if exists "results update" on public.room_results;
create policy "results update" on public.room_results for update to authenticated
  using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));

-- 2) رجّع نتيجة كل لاعب لتطابق room_results (يرجّع ماتشك لتعادل 1-1)
update public.league_matches m
set home_score = r.home_score, away_score = r.away_score
from public.room_members rm
join public.room_results r on r.room_id = rm.room_id
where rm.user_id = m.user_id
  and r.season = m.season and r.matchday = m.matchday
  and r.home_club = m.home_club and r.away_club = m.away_club
  and m.status = 'completed'
  and (m.home_score, m.away_score) is distinct from (r.home_score, r.away_score);
