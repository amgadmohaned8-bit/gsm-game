/**
 * End-of-season awards.
 *
 * The finish of the club pays prize money (once per season, worked out by the
 * database as well), and the awards of the season are saved with it so the
 * history keeps them: golden boot, playmaker, player of the season, the best
 * attack and the best eleven of the league.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { baseLeague } from "@/lib/football/leagueIds";
import { FIRST_SEASON } from "@/lib/football/season";
import { computeStats, squadsAt, type StatMatch } from "@/lib/football/stats";
import type { Deal } from "@/lib/football/transfers";
import type { Renewal } from "@/lib/football/contracts";
import type { TrainingRow } from "@/lib/football/development";
import type { Position } from "@/lib/football/squads";
import type { StandingRow } from "@/lib/football/table";

/** "2027-2028" -> "2026-2027"; null before the first season */
export function prevSeason(season: string): string | null {
  const start = parseInt(season.split("-")[0], 10);
  if (!Number.isFinite(start)) return null;
  const prev = `${start - 1}-${start}`;
  return prev < FIRST_SEASON ? null : prev;
}

/** Millions of prize money for a finishing position. The database uses the same table (supabase/033). */
export function prizeFor(position: number, leagueId: string): number {
  const base = position === 1 ? 25 : position === 2 ? 18 : position === 3 ? 14 : position === 4 ? 10 : position === 5 ? 8 : position === 6 ? 6 : position <= 10 ? 4 : position <= 15 ? 2 : 1;
  const scale = baseLeague(leagueId) === "egyptian-premier-league" ? 0.4 : 1;
  return Math.round(base * scale * 10) / 10;
}

export type AwardPlayer = { id: string; name: string; club: string; position: Position; goals: number; assists: number; rating: number };

export type SeasonAwards = {
  champion: string;
  points: number;
  golden: AwardPlayer | null;
  playmaker: AwardPlayer | null;
  best: AwardPlayer | null;
  attack: { club: string; goals: number } | null;
  /** best eleven of the league: 1 goalkeeper, 4 defenders, 3 midfielders, 3 forwards */
  xi: AwardPlayer[];
};

export type AwardRow = {
  league_id: string;
  club_id: string;
  season: string;
  position: number;
  prize: number;
  awards: SeasonAwards;
  created_at: string;
};

export async function loadAwardRows(client: SupabaseClient, userId: string, leagueId: string, clubId: string): Promise<AwardRow[]> {
  try {
    const { data } = await client.from("season_awards").select("league_id, club_id, season, position, prize, awards, created_at").eq("user_id", userId).eq("league_id", leagueId).eq("club_id", clubId);
    return ((data ?? []) as AwardRow[]).map((r) => ({ ...r, prize: Number(r.prize) })).sort((a, b) => (a.season < b.season ? 1 : -1));
  } catch {
    return [];
  }
}

/** Works the awards out of the matches of a finished season. */
export function buildAwards(args: {
  matches: StatMatch[];
  table: StandingRow[];
  deals: Deal[];
  training: TrainingRow[];
  renewals: Renewal[];
  leagueKey: string;
  myClub: string;
  season: string;
}): SeasonAwards {
  const { matches, table, deals, training, renewals, leagueKey, myClub, season } = args;
  const stats = computeStats({ matches, deals, leagueKey, training, own: { club: myClub, renewals } });
  const squads = squadsAt(deals, season, 999, training, { club: myClub, renewals });

  const credit = new Map<string, { goals: number; assists: number }>();
  for (const p of stats.best) credit.set(p.id, { goals: p.goals, assists: p.assists });
  const asAward = (p: { id: string; name: string; club: string; position: Position; goals: number; assists: number }): AwardPlayer => {
    const rating = Object.values(squads).flat().find((x) => x.id === p.id)?.rating ?? 0;
    return { id: p.id, name: p.name, club: p.club, position: p.position, goals: p.goals, assists: p.assists, rating };
  };

  // the best eleven: rating first, with a bonus for goals and assists
  const pool: (AwardPlayer & { score: number })[] = [];
  for (const [club, list] of Object.entries(squads)) {
    for (const p of list) {
      const c = credit.get(p.id) ?? { goals: 0, assists: 0 };
      pool.push({ id: p.id, name: p.name, club, position: p.position, goals: c.goals, assists: c.assists, rating: p.rating, score: p.rating + c.goals * 0.8 + c.assists * 0.5 });
    }
  }
  const need: Record<Position, number> = { GK: 1, DF: 4, MF: 3, FW: 3 };
  const xi: AwardPlayer[] = [];
  for (const line of ["GK", "DF", "MF", "FW"] as const) {
    pool
      .filter((p) => p.position === line)
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
      .slice(0, need[line])
      .forEach((p) => xi.push({ id: p.id, name: p.name, club: p.club, position: p.position, goals: p.goals, assists: p.assists, rating: p.rating }));
  }

  const top = stats.teams[0];
  return {
    champion: table[0]?.clubId ?? "",
    points: table.find((r) => r.clubId === myClub)?.points ?? 0,
    golden: stats.scorers[0] ? asAward(stats.scorers[0]) : null,
    playmaker: stats.assisters[0] ? asAward(stats.assisters[0]) : null,
    best: stats.best[0] && stats.best[0].total > 0 ? asAward(stats.best[0]) : null,
    attack: top ? { club: top.club, goals: top.goals } : null,
    xi,
  };
}

/** Saves the finish of a season once. The prize is added to the club money (transfers.ts reads it). */
export async function saveAwards(client: SupabaseClient, args: { userId: string; leagueId: string; clubId: string; season: string; position: number; awards: SeasonAwards }): Promise<"saved" | "exists"> {
  const { error } = await client.from("season_awards").insert({
    user_id: args.userId,
    league_id: args.leagueId,
    club_id: args.clubId,
    season: args.season,
    position: args.position,
    prize: prizeFor(args.position, args.leagueId),
    awards: args.awards,
  });
  if (!error) return "saved";
  if (error.code === "23505") return "exists";
  throw new Error(error.code === "42P01" ? "Season awards are not set up yet: run supabase/033_season_awards.sql first." : error.message);
}
