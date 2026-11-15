/**
 * The bank.
 *
 * Money is plain euros, like finance.ts. The club balance is still calculated
 * (nothing is stored there): loan cash is a row in `loan_transactions` for the
 * season and the league, and loadTransferState() adds it to `net`, so every
 * screen that already shows the balance includes it.
 *
 * Game days come from the game calendar (schedule.ts), never from the clock:
 * the day of a season is the day of its matchday, counting the cup days, and a
 * season has 43 days. The day number keeps growing across seasons.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { CUP_AFTER_MATCHDAYS, MATCHDAYS } from "@/lib/football/schedule";
import { startYear } from "@/lib/football/development";

/* ---------- the calendar ---------- */

/** 38 league days and 5 cup days. */
export const SEASON_DAYS = MATCHDAYS + CUP_AFTER_MATCHDAYS.length;

/** The loan money in this game is plain euros, so the loan range is 10M to 300M. */
export const LOAN_MIN = 10_000_000;
export const LOAN_MAX = 300_000_000;

const dayInSeason = (matchday: number) => matchday - 1 + CUP_AFTER_MATCHDAYS.filter((m) => m < matchday).length;
const seasonStart = (season: string) => (startYear(season) - 2000) * SEASON_DAYS;

/** Today in game days: the day of the matchday that is next to be played. Null matchday = the season is over. */
export const gameDayOf = (season: string, matchday: number | null) =>
  seasonStart(season) + (matchday === null ? SEASON_DAYS : dayInSeason(matchday));

/** Mid-season: the day the second half starts (matchday 20). */
export const midSeasonDay = (season: string) => seasonStart(season) + dayInSeason(20);

export type BankCalendar = { season: string; gameDay: number; midDay: number; seasonLen: number };
export const calendarOf = (season: string, matchday: number | null): BankCalendar => ({
  season,
  gameDay: gameDayOf(season, matchday),
  midDay: midSeasonDay(season),
  seasonLen: SEASON_DAYS,
});

/** When a loan taken today falls due. */
export const dueDayFor = (c: BankCalendar) => (c.gameDay < c.midDay ? c.midDay : c.midDay + c.seasonLen);

/* ---------- types ---------- */

export type BankStatus = {
  credit_score: number;
  active_principal: number;
  total_debt: number;
  total_interest: number;
  next_due_game_day: number | null;
  days_left: number | null;
  penalty_stage: number;
  loans_blocked: boolean;
  transfers_frozen: boolean;
  frozen_transfer_pct: number;
  signings_blocked: boolean;
  financial_crisis: boolean;
  forced_sale_allowed: boolean;
  points_deducted_season: number;
  cash_net_season: number;
  unseen_penalties: { id: string; stage: number }[];
};

export type BankState = {
  status: BankStatus | null;
  /** loan money in or out of the club this season, in euros */
  cashNet: number;
  gameDay: number;
};

export const noBank = (gameDay = 0): BankState => ({ status: null, cashNet: 0, gameDay });

export type Loan = {
  id: string;
  league_id: string;
  season: string;
  principal: number;
  interest_rate: number;
  interest_amount: number;
  fines_amount: number;
  reschedule_fees: number;
  paid_amount: number;
  start_game_day: number;
  due_game_day: number;
  penalty_stage: number;
  status: "active" | "paid";
  created_at: string;
};

export type LoanTx = {
  id: string;
  kind: "disburse" | "repay" | "reschedule_fee";
  amount: number;
  game_day: number;
  season: string;
  created_at: string;
};

export type LoanPenalty = {
  id: string;
  kind: string;
  amount: number;
  points_deducted: number;
  game_day: number;
  created_at: string;
};

export const outstanding = (l: Loan) =>
  Number(l.principal) + Number(l.interest_amount) + Number(l.fines_amount) + Number(l.reschedule_fees) - Number(l.paid_amount);

/* ---------- loading ---------- */

/**
 * Applies the penalties that are due (each stage once, by game day) and returns the bank's state.
 * If supabase/030_bank.sql has not been run, the game goes on without a bank.
 */
export async function loadBank(
  client: SupabaseClient,
  leagueId: string,
  season: string,
  matchday: number | null
): Promise<BankState> {
  const gameDay = gameDayOf(season, matchday);
  try {
    const { data, error } = await client.rpc("bank_sync", { p_game_day: gameDay, p_season: season, p_league: leagueId });
    if (error) throw error;
    const status = data as BankStatus;
    return { status, cashNet: Number(status.cash_net_season) || 0, gameDay };
  } catch {
    return noBank(gameDay);
  }
}

export async function loadLoans(client: SupabaseClient, leagueId: string) {
  const [l, t, p] = await Promise.all([
    client.from("loans").select("*").eq("league_id", leagueId).order("created_at", { ascending: false }),
    client.from("loan_transactions").select("id, kind, amount, game_day, season, created_at").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(100),
    client.from("loan_penalties").select("id, kind, amount, points_deducted, game_day, created_at").eq("league_id", leagueId).order("created_at", { ascending: false }).limit(100),
  ]);
  if (l.error) throw l.error;
  return {
    loans: ((l.data ?? []) as Loan[]).map((x) => ({
      ...x,
      principal: Number(x.principal), interest_amount: Number(x.interest_amount), fines_amount: Number(x.fines_amount),
      reschedule_fees: Number(x.reschedule_fees), paid_amount: Number(x.paid_amount), interest_rate: Number(x.interest_rate),
    })),
    history: (t.data ?? []) as LoanTx[],
    penalties: (p.data ?? []) as LoanPenalty[],
  };
}

/* ---------- actions (every one has a key, so a repeated tap or a retry never moves money twice) ---------- */

export const newKey = () => crypto.randomUUID();

async function rpc<T>(client: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export type LoanQuote = { rate: number; interest: number; total_due: number; credit_score: number };
export type RescheduleQuote = { fee: number; old_due_day: number; new_due_day: number; new_total_outstanding: number };

export const quoteLoan = (c: SupabaseClient, amount: number) => rpc<LoanQuote>(c, "quote_loan", { p_amount: amount });

export const requestLoan = (c: SupabaseClient, a: { amount: number; leagueId: string; clubId: string; cal: BankCalendar; key: string }) =>
  rpc<{ applied: boolean; loan_id: string }>(c, "request_loan", {
    p_amount: a.amount, p_season: a.cal.season, p_league: a.leagueId, p_club: a.clubId,
    p_game_day: a.cal.gameDay, p_mid_day: a.cal.midDay, p_season_len: a.cal.seasonLen, p_key: a.key,
  });

export const repayLoan = (c: SupabaseClient, a: { loanId: string; amount: number; cal: BankCalendar; key: string }) =>
  rpc<{ applied: boolean; paid: number; remaining: number; fully_paid: boolean }>(c, "repay_loan", {
    p_loan: a.loanId, p_amount: a.amount, p_game_day: a.cal.gameDay, p_season: a.cal.season, p_key: a.key,
  });

export const quoteReschedule = (c: SupabaseClient, loanId: string, days: number, gameDay: number) =>
  rpc<RescheduleQuote>(c, "quote_reschedule", { p_loan: loanId, p_days: days, p_game_day: gameDay });

export const rescheduleLoan = (c: SupabaseClient, a: { loanId: string; days: number; gameDay: number; key: string }) =>
  rpc<{ applied: boolean; fee: number; new_due_day: number }>(c, "reschedule_loan", {
    p_loan: a.loanId, p_days: a.days, p_game_day: a.gameDay, p_key: a.key,
  });

export const markPenaltiesSeen = (c: SupabaseClient, ids: string[]) => rpc<number>(c, "bank_mark_seen", { p_ids: ids });

/* ---------- the league table ---------- */

/**
 * League points taken by the bank (the extreme case). Put the standings through
 * this before showing them: it takes the points off the club and re-sorts.
 */
export function withBankPenalty<T extends { clubId: string; points: number }>(rows: T[], clubId: string, points: number): T[] {
  if (!points) return rows;
  return rows
    .map((r, i) => ({ r: r.clubId === clubId ? { ...r, points: r.points - points } : r, i }))
    .sort((a, b) => b.r.points - a.r.points || a.i - b.i)
    .map((x) => x.r);
}