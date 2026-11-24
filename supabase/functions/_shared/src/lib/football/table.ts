// @ts-nocheck
/**
 * The league table. Same job as calculateStandings in lib/football/standings,
 * but it knows about every league: the table is built from the clubs of the
 * league the matches belong to (read from the first match), so an Egyptian
 * season never shows Premier League clubs.
 */

import { clubsOfLeague, leagueOfClub } from "./leagueClubs.ts";

export type Match = {
  id: string;
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  [key: string]: unknown;
};

export type StandingRow = {
  clubId: string;
  name: string;
  logo: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

/** `deductions`: league points taken away from a club (by the bank), by club id. */
export function calculateStandings(matches: Match[], leagueId?: string, deductions?: Record<string, number>): StandingRow[] {
  const league = leagueId ?? (matches.length ? leagueOfClub(matches[0].home_club) : "premier-league");
  const table = new Map<string, StandingRow>();
  for (const c of clubsOfLeague(league)) {
    table.set(c.id, { clubId: c.id, name: c.name, logo: c.logo, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
  }

  for (const m of matches) {
    if (m.status !== "completed" || m.home_score === null || m.away_score === null) continue;
    const h = table.get(m.home_club);
    const a = table.get(m.away_club);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) { h.won++; a.lost++; h.points += 3; }
    else if (m.home_score < m.away_score) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }

  return [...table.values()]
    .map((r) => ({ ...r, gd: r.gf - r.ga, points: r.points - (deductions?.[r.clubId] ?? 0) }))
    .sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name));
}
