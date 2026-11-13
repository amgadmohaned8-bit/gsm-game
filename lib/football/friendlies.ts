/** Friendly matches: one before every league matchday, a small gate income. */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTier } from "@/lib/football/finance";

export const friendlyIncome = (opponent: string) => {
  const t = getTier(opponent);
  return t === "elite" ? 0.5 : t === "mid" ? 0.35 : 0.2;
};

export type Friendly = {
  after_matchday: number;
  home_club: string;
  away_club: string;
  home_score: number;
  away_score: number;
  income: number;
};

export async function loadFriendlies(client: SupabaseClient, userId: string, season?: string): Promise<Friendly[]> {
  try {
    let q = client.from("friendlies").select("*").eq("user_id", userId);
    if (season) q = q.eq("season", season);
    const { data } = await q;
    return (data ?? []) as Friendly[];
  } catch {
    return [];
  }
}
