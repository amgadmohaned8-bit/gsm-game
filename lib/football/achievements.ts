/**
 * Trophies and the board's objective.
 *
 * League titles and the board objective are worked out from the season's
 * matches, so nothing extra is stored. Cup wins are read from the `trophies`
 * table (see supabase/002_profile_trophies.sql) once the cup is added.
 */

import { calculateStandings, type Match } from "@/lib/football/table";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTier } from "@/lib/football/finance";

export type Objective = { position: number; label: string };

/** The board sets a different target for strong, middle and small clubs. */
export function boardObjective(clubId: string): Objective {
  const tier = getTier(clubId);
  if (tier === "elite") return { position: 1, label: "Win the league" };
  if (tier === "mid") return { position: 8, label: "Finish in the top 8" };
  return { position: 16, label: "Stay up, finish 16th or higher" };
}

export type SeasonSummary = {
  complete: boolean;
  played: number;
  position: number;
  leagueTitle: boolean;
  objective: Objective;
  objectiveMet: boolean;
};

export function summarizeSeason(clubId: string, matches: Match[]): SeasonSummary {
  const mine = matches.filter((m) => m.home_club === clubId || m.away_club === clubId);
  const played = mine.filter((m) => m.status === "completed").length;
  const complete = mine.length > 0 && played === mine.length;
  const position = calculateStandings(matches).findIndex((row) => row.clubId === clubId) + 1;
  const objective = boardObjective(clubId);

  return {
    complete,
    played,
    position,
    leagueTitle: complete && position === 1,
    objective,
    objectiveMet: complete && position > 0 && position <= objective.position,
  };
}

/** Saves this season's league title and board objective (once each). */
export async function recordSeasonTrophies(
  client: SupabaseClient,
  userId: string,
  clubId: string,
  leagueId: string,
  season: string,
  summary: SeasonSummary
) {
  const rows = [
    summary.leagueTitle && { kind: "league" },
    summary.objectiveMet && { kind: "objective" },
  ]
    .filter(Boolean)
    .map((r) => ({ ...(r as { kind: string }), user_id: userId, season, club_id: clubId, league_id: leagueId }));

  if (rows.length === 0) return;

  try {
    await client.from("trophies").upsert(rows, { onConflict: "user_id,kind,season,league_id", ignoreDuplicates: true });
  } catch {
    /* the trophy is still counted from the season's matches */
  }
}
