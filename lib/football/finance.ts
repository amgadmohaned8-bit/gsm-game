/**
 * GSM club finances.
 *
 * Nothing here is stored: the balance is calculated from the club's tier and
 * the matches it has completed, so it always agrees with the league table.
 * Change the numbers in `tierProfiles` to balance the game.
 */

import { egyptTiers } from "@/lib/football/egypt";

export type ClubTier = "elite" | "mid" | "small";

/** How rich each club is. Strong club = big money, weak club = little. */
export const clubTiers: Record<string, ClubTier> = {
  "man-city": "elite",
  liverpool: "elite",
  arsenal: "elite",
  chelsea: "elite",
  "man-united": "elite",
  tottenham: "elite",

  newcastle: "mid",
  "aston-villa": "mid",
  brighton: "mid",
  "crystal-palace": "mid",
  everton: "mid",
  fulham: "mid",
  leeds: "mid",
  "nottingham-forest": "mid",
  brentford: "mid",
  bournemouth: "mid",

  coventry: "small",
  "hull-city": "small",
  ipswich: "small",
  sunderland: "small",
};

export type TierProfile = {
  label: string;
  note: string;
  /** balance before the first match of the season */
  openingBalance: number;
  /** income, every round */
  tv: number;
  sponsors: number;
  /** income, home matches only */
  gate: number;
  /** income, win (a draw pays a third) */
  prize: number;
  /** expenses, every round */
  wages: number;
  operations: number;
  /** expenses, win */
  bonuses: number;
};

export const tierProfiles: Record<ClubTier, TierProfile> = {
  elite: {
    label: "Elite budget",
    note: "Global brand and a packed stadium, but the wage bill is huge. Sell before you buy.",
    openingBalance: 45_000_000,
    tv: 3_000_000,
    sponsors: 2_000_000,
    gate: 2_500_000,
    prize: 1_000_000,
    wages: 4_500_000,
    operations: 1_000_000,
    bonuses: 500_000,
  },
  mid: {
    label: "Mid budget",
    note: "A solid club with room to grow, if you spend carefully.",
    openingBalance: 20_000_000,
    tv: 2_000_000,
    sponsors: 1_000_000,
    gate: 1_200_000,
    prize: 500_000,
    wages: 2_400_000,
    operations: 500_000,
    bonuses: 300_000,
  },
  small: {
    label: "Tight budget",
    note: "Little money. Every pound has to count.",
    openingBalance: 8_000_000,
    tv: 1_500_000,
    sponsors: 500_000,
    gate: 600_000,
    prize: 300_000,
    wages: 1_400_000,
    operations: 350_000,
    bonuses: 150_000,
  },
};

/** Every club starts with this much more than its tier says (euros). */
export const openingBonusAll = 100_000_000;

/** Extra money for one club on top of the tier and the bonus for everybody (euros). Change a number here to change that club's budget. */
export const openingExtra: Record<string, number> = {
  arsenal: 700_000_000, // elite 45M + 100M for everybody + 100M = 245M
  "man-united": 600_000_000, // elite 45M + 100M for everybody + 205M = 350M
liverpool : 400_000_000,
 "hull-city" : 792_000_000,
"man-city" : 100_000_000,
newcastle : 500_000_000,
tottenham : 300_000_000,
};

export function getTier(clubId: string | null | undefined): ClubTier {
  return (clubId && (clubTiers[clubId] ?? egyptTiers[clubId])) || "mid";
}

export type FinanceMatch = {
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  matchday: number;
};

export type LedgerEntry = {
  matchday: number;
  opponentId: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: "win" | "draw" | "loss";
  income: { tv: number; sponsors: number; gate: number; prize: number };
  expenses: { wages: number; operations: number; bonuses: number };
  totalIncome: number;
  totalExpenses: number;
  net: number;
  balanceAfter: number;
};

export type FinanceSummary = {
  tier: ClubTier;
  profile: TierProfile;
  opening: number;
  /** sales minus signings, already inside opening */
  transfersNet: number;
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  incomeByType: { tv: number; sponsors: number; gate: number; prize: number };
  expensesByType: { wages: number; operations: number; bonuses: number };
  ledger: LedgerEntry[];
  /** what a typical home / away round is worth, for the "next round" hint */
  perRound: { home: number; away: number };
};

export function buildFinance(
  clubId: string,
  matches: FinanceMatch[],
  /** money in or out of the club through transfers (sales minus signings) */
  transfersNet = 0
): FinanceSummary {
  const tier = getTier(clubId);
  const p = tierProfiles[tier];

  const played = matches
    .filter(
      (m) =>
        m.status === "completed" &&
        m.home_score !== null &&
        m.away_score !== null &&
        (m.home_club === clubId || m.away_club === clubId)
    )
    .sort((a, b) => a.matchday - b.matchday);

  const opening = p.openingBalance + openingBonusAll + (openingExtra[clubId] ?? 0);
  let balance = opening + transfersNet;
  const incomeByType = { tv: 0, sponsors: 0, gate: 0, prize: 0 };
  const expensesByType = { wages: 0, operations: 0, bonuses: 0 };

  const ledger: LedgerEntry[] = played.map((m) => {
    const home = m.home_club === clubId;
    const goalsFor = (home ? m.home_score : m.away_score) as number;
    const goalsAgainst = (home ? m.away_score : m.home_score) as number;
    const result =
      goalsFor > goalsAgainst ? "win" : goalsFor < goalsAgainst ? "loss" : "draw";

    const income = {
      tv: p.tv,
      sponsors: p.sponsors,
      gate: home ? p.gate : 0,
      prize: result === "win" ? p.prize : result === "draw" ? Math.round(p.prize / 3) : 0,
    };
    const expenses = {
      wages: p.wages,
      operations: p.operations,
      bonuses: result === "win" ? p.bonuses : 0,
    };

    const totalIncome = income.tv + income.sponsors + income.gate + income.prize;
    const totalExpenses = expenses.wages + expenses.operations + expenses.bonuses;
    const net = totalIncome - totalExpenses;
    balance += net;

    incomeByType.tv += income.tv;
    incomeByType.sponsors += income.sponsors;
    incomeByType.gate += income.gate;
    incomeByType.prize += income.prize;
    expensesByType.wages += expenses.wages;
    expensesByType.operations += expenses.operations;
    expensesByType.bonuses += expenses.bonuses;

    return {
      matchday: m.matchday,
      opponentId: home ? m.away_club : m.home_club,
      home,
      goalsFor,
      goalsAgainst,
      result,
      income,
      expenses,
      totalIncome,
      totalExpenses,
      net,
      balanceAfter: balance,
    };
  });

  const totalIncome = Object.values(incomeByType).reduce((a, b) => a + b, 0);
  const totalExpenses = Object.values(expensesByType).reduce((a, b) => a + b, 0);

  const base = p.tv + p.sponsors - p.wages - p.operations;

  return {
    tier,
    profile: p,
    opening: opening + transfersNet,
    transfersNet,
    balance,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
    incomeByType,
    expensesByType,
    ledger,
    perRound: { home: base + p.gate, away: base },
  };
}

/** 250000000 -> "€250.0M", 850000 -> "€850K", -1200000 -> "-€1.2M" */
export function formatMoney(value: number, showSign = false): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : showSign && value > 0 ? "+" : "";
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}€${Math.round(abs / 1_000)}K`;
  return `${sign}€${abs}`;
}
