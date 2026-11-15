// lib/bankApi.js — غلاف فوق دوال Supabase بتاعة البنك
// عدّل السطر ده لو الـ supabase client عندك في مسار تاني.
import { supabase } from '@/lib/supabaseClient';

// مفتاح فريد لكل عملية مالية (بيمنع تكرار الخصم/الإضافة)
export const newKey = () => crypto.randomUUID();

const rpc = async (fn, args = {}) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
};

export const getBankStatus = (gameDay, season) =>
  rpc('bank_status', { p_game_day: gameDay, p_season: season });

export const quoteLoan = (amount) => rpc('quote_loan', { p_amount: amount });

export const requestLoan = ({ amount, season, club, gameDay, midDay, seasonLen, key }) =>
  rpc('request_loan', {
    p_amount: amount, p_season: season, p_club: club,
    p_game_day: gameDay, p_mid_day: midDay, p_season_len: seasonLen, p_key: key,
  });

export const repayLoan = ({ loanId, amount, gameDay, key }) =>
  rpc('repay_loan', { p_loan: loanId, p_amount: amount, p_game_day: gameDay, p_key: key });

export const quoteReschedule = (loanId, days, gameDay) =>
  rpc('quote_reschedule', { p_loan: loanId, p_days: days, p_game_day: gameDay });

export const rescheduleLoan = ({ loanId, days, gameDay, key }) =>
  rpc('reschedule_loan', { p_loan: loanId, p_days: days, p_game_day: gameDay, p_key: key });

export const processPenalties = (gameDay) =>
  rpc('process_loan_penalties', { p_game_day: gameDay });

const select = async (table, limit) => {
  const { data, error } = await supabase
    .from(table).select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return data;
};
export const getLoans = () => select('loans', 100);
export const getHistory = () => select('loan_transactions', 100);
export const getPenalties = () => select('loan_penalties', 100);

// تطبيق حركات الفلوس المعلّقة على ميزانية النادي الحالية.
// القفل بيمنع تشغيلين في نفس الوقت (زي StrictMode) فتتطبق الحركة مرتين.
let syncing = null;
export function syncBankCash(applyToBudget) {
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const pending = await rpc('bank_pending_cash');
      if (!pending?.length) return 0;
      let total = 0;
      for (const row of pending) {
        applyToBudget(Number(row.cash_delta));
        total += Number(row.cash_delta);
      }
      await rpc('bank_ack_cash', { p_ids: pending.map((r) => r.id) });
      return total;
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}
