/**
 * A new appointment is a new career.
 *
 * Everything the manager did in a league (matches, cups, signings, training,
 * lineups, contracts, press, friendlies) belongs to that career. When he takes
 * a club in a league again, even the same club, all of it starts from zero.
 * Trophies and achievements are a record of the person, so they stay.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { clubsOfLeague } from "@/lib/football/leagueClubs";

const chunks = <T,>(list: T[], n = 100) => {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
};

export async function resetCareerData(client: SupabaseClient, userId: string, leagueId: string, clubId?: string | null) {
  const ids = new Set<string>();
  try { for (const c of clubsOfLeague(leagueId)) ids.add(c.id); } catch { /* not a club league */ }
  if (clubId) ids.add(clubId);
  const clubIds = [...ids];

  const step = async (job: () => PromiseLike<unknown>) => {
    try { await job(); } catch { /* one table failing must not stop the rest */ }
  };
  const isPlayerOfLeague = (pid: string) => clubIds.some((c) => pid.startsWith(`${c}-`) && /^\d+$/.test(pid.slice(c.length + 1)));

  // signings and sales that touch a club of this league, and the players in them
  const players = new Set<string>();
  await step(async () => {
    const { data } = await client.from("transfers").select("id, player_id, from_club, to_club").eq("user_id", userId);
    const mine = ((data ?? []) as { id: string; player_id: string; from_club: string; to_club: string }[]).filter((d) => ids.has(d.from_club) || ids.has(d.to_club));
    mine.forEach((d) => players.add(d.player_id));
    for (const part of chunks(mine.map((d) => d.id))) await client.from("transfers").delete().in("id", part);
  });

  for (const table of ["training_sessions", "transfer_listings"]) {
    await step(async () => {
      const { data } = await client.from(table).select("id, player_id").eq("user_id", userId);
      const mine = ((data ?? []) as { id: string; player_id: string }[]).filter((r) => players.has(r.player_id) || isPlayerOfLeague(r.player_id));
      for (const part of chunks(mine.map((r) => r.id))) await client.from(table).delete().in("id", part);
    });
  }

  await step(() => client.from("league_matches").delete().eq("user_id", userId).eq("league_id", leagueId));
  await step(() => client.from("cup_matches").delete().eq("user_id", userId).eq("league_id", leagueId));
  await step(() => client.from("friendlies").delete().eq("user_id", userId).eq("league_id", leagueId));

  // CAF competitions
  await step(async () => {
    if (leagueId.startsWith("caf-")) {
      await client.from("continental_matches").delete().eq("user_id", userId).eq("comp_id", leagueId);
      await client.from("continental_seasons").delete().eq("user_id", userId).eq("comp_id", leagueId);
      return;
    }
    if (!clubIds.length) return;
    const { data } = await client.from("continental_seasons").select("comp_id, season, club_id").eq("user_id", userId).in("club_id", clubIds);
    for (const s of (data ?? []) as { comp_id: string; season: string }[]) {
      await client.from("continental_matches").delete().eq("user_id", userId).eq("comp_id", s.comp_id).eq("season", s.season);
      await client.from("continental_seasons").delete().eq("user_id", userId).eq("comp_id", s.comp_id).eq("season", s.season);
    }
  });

  if (clubIds.length) {
    for (const table of ["match_lineups", "contract_renewals", "press_quotes"]) {
      await step(() => client.from(table).delete().eq("user_id", userId).in("club_id", clubIds));
    }
  }
  await step(() => client.from("manager_careers").delete().eq("user_id", userId).eq("league_id", leagueId));

  // what the phone remembers for these clubs: lineups, tactics and transfer talks
  try {
    const gone: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (k.startsWith(`gsm-talks:${userId}:`) || clubIds.some((c) => k === `gsm-lineup:${userId}:${c}` || k === `gsm-tactic:${userId}:${c}`)) gone.push(k);
    }
    gone.forEach((k) => localStorage.removeItem(k));
  } catch { /* storage is optional */ }
}
