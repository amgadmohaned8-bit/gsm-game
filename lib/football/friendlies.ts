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
  league_id?: string | null;
  /** the friend (a human manager) this friendly was played against, if any */
  opp_manager?: string | null;
};

export type FriendNotice = {
  id: string;
  from_name: string | null;
  home_club: string;
  away_club: string;
  home_score: number;
  away_score: number;
  season: string;
  kind?: "friendly" | "league";
  matchday?: number | null;
};

/**
 * A manager's friendlies. `scope` keeps one career apart from another: only
 * this league, and only matches of the club he manages now.
 */
export async function loadFriendlies(client: SupabaseClient, userId: string, season?: string, scope?: { leagueId?: string; club?: string }): Promise<Friendly[]> {
  try {
    let q = client.from("friendlies").select("*").eq("user_id", userId);
    if (season) q = q.eq("season", season);
    if (scope?.leagueId) q = q.eq("league_id", scope.leagueId);
    const { data } = await q;
    const rows = (data ?? []) as Friendly[];
    return scope?.club ? rows.filter((f) => f.home_club === scope.club || f.away_club === scope.club) : rows;
  } catch {
    return [];
  }
}

/** tells a friend (a manager in the same shared league) that he was played */
export async function sendFriendNotice(
  client: SupabaseClient,
  n: { to: string; from: string; fromName: string; season: string; home: string; away: string; hs: number; as: number; kind?: "friendly" | "league"; matchday?: number }
) {
  try {
    const kind = n.kind ?? "friendly";
    if (kind === "league") {
      // he already told me about this match: no need to tell him back
      const { data } = await client.from("friendly_notices").select("id").eq("to_user", n.from).eq("from_user", n.to).eq("kind", "league").eq("season", n.season).eq("matchday", n.matchday ?? -1).limit(1);
      if (data?.length) return;
    }
    const row = { to_user: n.to, from_user: n.from, from_name: n.fromName, season: n.season, home_club: n.home, away_club: n.away, home_score: n.hs, away_score: n.as };
    let { error } = await client.from("friendly_notices").insert({ ...row, kind, matchday: n.matchday ?? null });
    // the database may not have the newest columns yet: send the plain message
    if (error) ({ error } = await client.from("friendly_notices").insert(row));
    if (error) console.error("friend message not sent:", error.message);
  } catch {
    /* the friendly still counts */
  }
}

export async function unseenNotices(client: SupabaseClient, userId: string): Promise<FriendNotice[]> {
  try {
    const query = (cols: string) =>
      client.from("friendly_notices").select(cols).eq("to_user", userId).eq("seen", false).order("created_at", { ascending: true }).limit(10);
    let res = await query("id, from_name, home_club, away_club, home_score, away_score, season, kind, matchday");
    if (res.error) res = await query("id, from_name, home_club, away_club, home_score, away_score, season");
    return ((res.data ?? []) as unknown as FriendNotice[]);
  } catch {
    return [];
  }
}

export async function markNoticesSeen(client: SupabaseClient, ids: string[]) {
  if (!ids.length) return;
  try {
    await client.from("friendly_notices").update({ seen: true }).in("id", ids);
  } catch {
    /* shown again next time */
  }
}
