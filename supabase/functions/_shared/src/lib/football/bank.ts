// @ts-nocheck
/**
 * The bank.
 *
 * Loans, interest, late fines and the credit score. The rules live here and in
 * supabase/022_bank.sql (the database repeats the money rules, so a page can
 * never talk it into a wrong amount). Nothing uses the real clock: the bank runs
 * on game days. One matchday is one day, a season is 38 days, and mid-season is
 * day 19 of the season.
 *
 * The money is the club's own money: a loan adds to the balance the other
 * screens already show, and a payment takes it out of the same balance.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { FIRST_SEASON, nextSeason, seasonLabel } from "./season.ts";

export const SEASON_DAYS = 38;
export const MID_SEASON = 19;
export const MIN_LOAN = 10;
export const MAX_LOAN = 300;

/* ---------- the calendar ---------- */

/** Matchdays played so far (a season that is over counts all 38). */
export function playedDays(matchday: number | null): number {
  return matchday === null ? SEASON_DAYS : Math.max(0, Math.min(SEASON_DAYS, matchday - 1));
}

/** One number for "today" that only goes up: season by season, matchday by matchday. */
export function gameDay(season: string, matchday: number | null): number {
  const start = parseInt(season.split("-")[0], 10);
  const first = parseInt(FIRST_SEASON.split("-")[0], 10);
  const index = Number.isFinite(start) ? Math.max(0, start - first) : 0;
  return index * SEASON_DAYS + playedDays(matchday);
}

/** The next mid-season at or after a day: this season's if it is still ahead, otherwise the next one. */
export function dueDayFor(day: number): number {
  const index = Math.floor(day / SEASON_DAYS);
  return day % SEASON_DAYS >= MID_SEASON ? (index + 1) * SEASON_DAYS + MID_SEASON : index * SEASON_DAYS + MID_SEASON;
}

/** "Mid-season 2026/27" for a day, or "Matchday 31 2026/27" for any other one. */
export function dayLabel(day: number): string {
  let season = FIRST_SEASON;
  for (let i = 0; i < Math.floor(day / SEASON_DAYS); i++) season = nextSeason(season);
  const md = day % SEASON_DAYS;
  return `${md === 0 ? "Start of" : md === MID_SEASON ? "Mid-season" : `Matchday ${md}`} ${seasonLabel(season)}`;
}

/* ---------- credit ---------- */

export const START_SCORE = 600;

export type Rating = { grade: string; label: string; tone: "great" | "good" | "fair" | "poor" | "bad" };

export function ratingOf(score: number): Rating {
  if (score >= 850) return { grade: "AAA", label: "Outstanding", tone: "great" };
  if (score >= 750) return { grade: "AA", label: "Excellent", tone: "great" };
  if (score >= 650) return { grade: "A", label: "Good", tone: "good" };
  if (score >= 550) return { grade: "BBB", label: "Fair", tone: "fair" };
  if (score >= 450) return { grade: "BB", label: "Weak", tone: "fair" };
  if (score >= 350) return { grade: "B", label: "Poor", tone: "poor" };
  if (score >= 200) return { grade: "C", label: "Very poor", tone: "bad" };
  return { grade: "D", label: "Defaulted", tone: "bad" };
}

/** The most loan principal the bank lets the club carry. */
export function creditLimit(score: number): number {
  if (score >= 750) return 300;
  if (score >= 650) return 250;
  if (score >= 550) return 200;
  if (score >= 450) return 120;
  if (score >= 350) return 60;
  if (score >= 200) return 25;
  return 0;
}

export function baseRate(principal: number): number {
  if (principal <= 50) return 0.1;
  if (principal <= 100) return 0.15;
  if (principal <= 200) return 0.2;
  return 0.25;
}

/** A better rating shaves the rate, a worse one adds to it. */
export function scoreAdjust(score: number): number {
  if (score >= 850) return -0.03;
  if (score >= 750) return -0.02;
  if (score >= 650) return -0.01;
  if (score >= 550) return 0;
  if (score >= 450) return 0.01;
  if (score >= 350) return 0.02;
  return 0.03;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export type Quote = {
  principal: number;
  base: number;
  adjust: number;
  rate: number;
  interest: number;
  total: number;
  dueDay: number;
};

export function quote(principal: number, score: number, day: number): Quote {
  const base = baseRate(principal);
  const adjust = scoreAdjust(score);
  const rate = Math.round((base + adjust) * 10000) / 10000;
  const interest = cents(principal * rate);
  return { principal, base, adjust, rate, interest, total: cents(principal + interest), dueDay: dueDayFor(day) };
}

/* ---------- late payments ---------- */

export const STAGES = [
  { stage: 1, from: 1, title: "Official warning", note: "5% fine." },
  { stage: 2, from: 8, title: "Credit downgrade", note: "10% fine, no new loans, rating drops." },
  { stage: 3, from: 16, title: "Budget frozen", note: "Half the transfer budget is frozen and signing players is banned." },
  { stage: 4, from: 31, title: "Financial crisis", note: "The bank can force you to sell a player." },
  { stage: 5, from: 45, title: "Extreme default", note: "6 league points are taken away." },
] as const;

export function stageForLate(late: number): number {
  return late >= 45 ? 5 : late >= 31 ? 4 : late >= 16 ? 3 : late >= 8 ? 2 : late >= 1 ? 1 : 0;
}

/** Share of the transfer budget the bank freezes from stage 3. */
export const FROZEN_SHARE = 0.5;
/** League points taken away once a loan is 45 days late. */
export const POINTS_PER_DEFAULT = 6;

/* ---------- data ---------- */

export type Loan = {
  id: string;
  league_id: string;
  club_id: string | null;
  principal: number;
  rate: number;
  interest: number;
  fees: number;
  penalties: number;
  paid: number;
  status: "active" | "repaid";
  taken_day: number;
  taken_season: string;
  taken_matchday: number | null;
  due_day: number;
  stage: number;
  reschedules: number;
  closed_day: number | null;
  created_at: string;
};

export type BankEvent = {
  id: string;
  loan_id: string | null;
  kind: string;
  amount: number;
  debt: number;
  points: number;
  score_delta: number;
  stage: number | null;
  note: string | null;
  season: string | null;
  matchday: number | null;
  game_day: number | null;
  key?: string | null;
  created_at: string;
};

export type Bank = {
  loans: Loan[];
  events: BankEvent[];
  score: number;
  /** false while supabase/022_bank.sql has not been run */
  ready: boolean;
  /** money the loans put into the club balance, in millions */
  cash: number;
  /** league points taken away this season, by club */
  deduction: number;
  noLoans: boolean;
  noSigning: boolean;
  frozenShare: number;
  crisis: boolean;
};

export const emptyBank: Bank = {
  loans: [],
  events: [],
  score: START_SCORE,
  ready: false,
  cash: 0,
  deduction: 0,
  noLoans: false,
  noSigning: false,
  frozenShare: 0,
  crisis: false,
};

export const owed = (l: Loan) => cents(l.principal + l.interest + l.fees + l.penalties - l.paid);
export const lateDays = (l: Loan, day: number) => Math.max(0, day - l.due_day);

const num = (n: unknown) => Number(n ?? 0);

function clean(row: Loan): Loan {
  return {
    ...row,
    principal: num(row.principal),
    rate: num(row.rate),
    interest: num(row.interest),
    fees: num(row.fees),
    penalties: num(row.penalties),
    paid: num(row.paid),
  };
}

export function shape(loans: Loan[], events: BankEvent[], score: number, season: string): Bank {
  const active = loans.filter((l) => l.status === "active");
  return {
    loans,
    events,
    score,
    ready: true,
    cash: loans.reduce((s, l) => s + l.principal - l.paid, 0),
    deduction: events.filter((e) => e.season === season).reduce((s, e) => s + (e.points || 0), 0),
    noLoans: active.some((l) => l.stage >= 2),
    noSigning: active.some((l) => l.stage >= 3),
    frozenShare: active.some((l) => l.stage >= 3) ? FROZEN_SHARE : 0,
    crisis: active.some((l) => l.stage >= 4),
  };
}

/** Loads the bank of one team (each team a manager runs has its own). */
export async function loadBank(client: SupabaseClient, userId: string, leagueId: string, season: string): Promise<Bank> {
  try {
    const [{ data: loans, error }, { data: events }, { data: profile }] = await Promise.all([
      client.from("bank_loans").select("*").eq("user_id", userId).eq("league_id", leagueId).order("created_at", { ascending: false }),
      client.from("bank_events").select("*").eq("user_id", userId).eq("league_id", leagueId).order("created_at", { ascending: false }).limit(200),
      client.from("bank_profile").select("score").eq("user_id", userId).eq("league_id", leagueId).maybeSingle(),
    ]);
    if (error) return emptyBank;
    const evs = ((events ?? []) as BankEvent[]).map((e) => ({ ...e, amount: num(e.amount), debt: num(e.debt) }));
    return shape(((loans ?? []) as Loan[]).map(clean), evs, profile ? Number(profile.score) : START_SCORE, season);
  } catch {
    return emptyBank;
  }
}

/** Applies every late stage that has come due. Safe to call any number of times. */
export async function syncBank(client: SupabaseClient, leagueId: string, day: number, season: string, matchday: number | null) {
  const { data } = await client.rpc("bank_sync", { p_league: leagueId, p_day: day, p_season: season, p_matchday: matchday });
  return Number(data ?? 0);
}

export const needsSync = (bank: Bank, day: number) => bank.loans.some((l) => l.status === "active" && l.due_day < day && stageForLate(day - l.due_day) > l.stage);

export function newRequest(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });
}

export async function takeLoan(
  client: SupabaseClient,
  a: { leagueId: string; request: string; principal: number; day: number; season: string; matchday: number | null; club: string }
) {
  const { error } = await client.rpc("bank_take_loan", {
    p_league: a.leagueId,
    p_request: a.request,
    p_principal: a.principal,
    p_due_day: dueDayFor(a.day),
    p_day: a.day,
    p_season: a.season,
    p_matchday: a.matchday,
    p_club: a.club,
  });
  if (error) throw new Error(error.message);
}

export async function repayLoan(
  client: SupabaseClient,
  a: { loan: string; request: string; amount: number; day: number; season: string; matchday: number | null }
) {
  const { error } = await client.rpc("bank_repay", {
    p_loan: a.loan,
    p_request: a.request,
    p_amount: a.amount,
    p_day: a.day,
    p_season: a.season,
    p_matchday: a.matchday,
  });
  if (error) throw new Error(error.message);
}

export const RESCHEDULE_OPTIONS = [
  { days: 10, fee: 0.04 },
  { days: 19, fee: 0.08 },
  { days: 38, fee: 0.15 },
] as const;

export function rescheduleQuote(loan: Loan, days: number, day: number) {
  const opt = RESCHEDULE_OPTIONS.find((o) => o.days === days) ?? RESCHEDULE_OPTIONS[0];
  const fee = cents(owed(loan) * opt.fee);
  return { fee, newDue: Math.max(loan.due_day, day) + days, owed: cents(owed(loan) + fee) };
}

export function canReschedule(loan: Loan): string | null {
  if (loan.status !== "active") return "This loan is already repaid.";
  if (loan.stage >= 2) return "The bank no longer reschedules a loan this late.";
  if (loan.reschedules >= 2) return "A loan can be rescheduled twice at most.";
  return null;
}

export async function rescheduleLoan(
  client: SupabaseClient,
  a: { loan: string; request: string; days: number; day: number; season: string; matchday: number | null }
) {
  const { error } = await client.rpc("bank_reschedule", {
    p_loan: a.loan,
    p_request: a.request,
    p_days: a.days,
    p_day: a.day,
    p_season: a.season,
    p_matchday: a.matchday,
  });
  if (error) throw new Error(error.message);
}

/* ---------- what the bank does to the rest of the game ---------- */

/** Why a signing is not allowed, or null. */
export function signingBan(bank: Bank | undefined): string | null {
  return bank?.noSigning ? "The bank has banned new signings until your overdue debt is paid." : null;
}

/** The part of the balance a manager can spend on transfers, in millions. */
export function spendable(balanceM: number, bank: Bank | undefined): number {
  if (!bank || !bank.frozenShare || balanceM <= 0) return balanceM;
  return Math.round(balanceM * (1 - bank.frozenShare) * 10) / 10;
}

/** League points taken away by the bank this season, for the club's table row. */
export async function loadDeductions(client: SupabaseClient, userId: string, leagueId: string, season: string): Promise<number> {
  try {
    const { data } = await client.from("bank_events").select("points").eq("user_id", userId).eq("league_id", leagueId).eq("season", season).gt("points", 0);
    return (data ?? []).reduce((s: number, e: { points: number }) => s + Number(e.points), 0);
  } catch {
    return 0;
  }
}

/** One short line for the news or a notice. */
export function describeEvent(e: BankEvent): string {
  return e.note ?? e.kind;
}
