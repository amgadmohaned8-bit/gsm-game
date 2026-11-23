// @ts-nocheck
/**
 * Seasons. The first one is 2026-2027 and every new season adds a year.
 * Nothing is stored for this: the current season is the newest one that has
 * matches in the database.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const FIRST_SEASON = "2026-2027";

export function nextSeason(season: string): string {
  const start = parseInt(season.split("-")[0], 10);
  return Number.isFinite(start) ? `${start + 1}-${start + 2}` : FIRST_SEASON;
}

/** "2026-2027" -> "2026/27" */
export function seasonLabel(season: string): string {
  const [a, b] = season.split("-");
  return b ? `${a}/${b.slice(2)}` : season;
}

async function newest(client: SupabaseClient, userId: string, leagueId?: string) {
  let query = client.from("league_matches").select("season").eq("user_id", userId);
  if (leagueId) query = query.eq("league_id", leagueId);
  const { data } = await query.order("season", { ascending: false }).limit(1);
  return (data?.[0]?.season as string | undefined) ?? null;
}

/**
 * The season a manager is playing in this league. If the league has no
 * matches yet but the manager has played elsewhere, the new league starts the
 * following season.
 */
export async function activeSeason(
  client: SupabaseClient,
  userId: string,
  leagueId: string
): Promise<string> {
  const inLeague = await newest(client, userId, leagueId);
  if (inLeague) return inLeague;
  const anywhere = await newest(client, userId);
  return anywhere ? nextSeason(anywhere) : FIRST_SEASON;
}
