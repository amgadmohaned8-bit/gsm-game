/**
 * Fatigue is switched off: every player is always fresh and plays at his full rating.
 * The functions stay so the rest of the game keeps working, but they no longer take anything away.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Player } from "@/lib/football/squads";
import type { TrainingRow } from "@/lib/football/development";

export const FIT_MIN = 45;
export const TIRED_BELOW = 70;

export type LineupRow = { matchday: number; starters: string[] };

/** Points a player loses from his rating when he is not fresh. */
export function fatiguePenalty(_fit?: number) {
  return 0;
}

/** The player as he plays today. */
export function tired(p: Player, _fit?: Record<string, number>): Player {
  return p;
}

/** Nobody is tired: an empty list means every player is at 100%. */
export function fitnessAt(_rows: LineupRow[], _training: TrainingRow[], _season: string, _matchday: number, _squad: Player[]): Record<string, number> {
  return {};
}

export async function loadFitness(_client: SupabaseClient, _userId: string, _season: string, _matchday: number, _training: TrainingRow[], _squad: Player[]): Promise<Record<string, number>> {
  return {};
}

export async function saveLineup(client: SupabaseClient, userId: string, season: string, matchday: number, clubId: string, starters: string[]) {
  try {
    await client.from("match_lineups").upsert({ user_id: userId, season, matchday, club_id: clubId, starters }, { onConflict: "user_id,season,matchday" });
  } catch {
    /* the player simply counts as rested */
  }
}
