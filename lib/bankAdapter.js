// lib/bankAdapter.js — الملف الوحيد اللي بتربطه بلعبتك.
// لحد ما تربطه، صفحة البنك بتعرض رسالة "غير متصل" بدل ما تتعطل.

// لازم يساوي bank_unit() في ملف الـ SQL (1000000 لو الفلوس كاملة، 1 لو بالملايين).
export const UNIT = 1_000_000;

// 1) تقويم اللعبة. كل الأرقام "أيام مطلقة" بنفس المقياس وتزيد مع كل يوم في اللعبة:
//    gameDay   = اليوم الحالي
//    midDay    = يوم منتصف الموسم الحالي
//    seasonLen = عدد أيام الموسم
//    season    = اسم/رقم الموسم زي ما هو مخزن في Supabase (text)
//    clubId    = نادي المدير
export function useGameCalendar() {
  // مثال:
  // const g = useGameStore();
  // return { connected: true, season: g.season, gameDay: g.dayNumber,
  //          midDay: g.midSeasonDay, seasonLen: g.seasonLength, clubId: g.clubId };
  return { connected: false };
}

// 2) ميزانية النادي الفعلية.
//    budget         = الرصيد الحالي
//    applyToBudget  = دالة موجودة عندك بتزوّد/بتخصم الرصيد (موجب = إضافة، سالب = خصم)
export function useClubBudget() {
  // مثال:
  // const { budget, addMoney } = useClubStore();
  // return { connected: true, budget, applyToBudget: (d) => addMoney(d) };
  return { connected: false };
}
