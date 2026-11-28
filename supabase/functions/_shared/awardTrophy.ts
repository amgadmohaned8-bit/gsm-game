// Call this from the Edge Function that finishes a competition or a season.
// It uses the service-role client, so players cannot award themselves trophies.
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AwardTrophyInput {
  managerId: string;
  /** One of the types in lib/trophies/catalog.ts, e.g. 'league_title'. */
  trophyType: string;
  season: number;
  clubId: string;
  clubName: string;
  competitionId?: string;
}

/** Returns true if the trophy is new, false if it was already recorded. */
export async function awardTrophy(admin: SupabaseClient, input: AwardTrophyInput): Promise<boolean> {
  const { data, error } = await admin.rpc('award_trophy', {
    p_manager_id: input.managerId,
    p_trophy_type: input.trophyType,
    p_season: input.season,
    p_club_id: input.clubId,
    p_club_name: input.clubName,
    p_competition_id: input.competitionId ?? null,
  });
  if (error) throw error;
  return data === true;
}

// Example, inside the function that closes the league table:
//
//   const winner = table[0];                       // your standings
//   if (winner.managerId) {
//     await awardTrophy(admin, {
//       managerId: winner.managerId,
//       trophyType: 'league_title',
//       season,
//       clubId: winner.clubId,
//       clubName: winner.clubName,
//       competitionId: leagueId,
//     });
//   }
