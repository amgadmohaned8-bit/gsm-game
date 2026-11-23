/**
 * Playing a matchday: the manager's match and the other nine are decided
 * together, so the table is always in step with what the manager saw.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { simulateFixture, type SimulationResult } from "@/lib/football/matchSim";
import { aiStyle, matchup, recordStyle } from "@/lib/football/tactics";
import { recordCards } from "@/lib/football/availability";
import { scoreKey, sharedScores, shareScores, type SimContext } from "@/lib/football/strength";

import { nowMs } from "@/lib/serverTime";
export type StoredMatch = {
  id: string;
  user_id: string;
  league_id: string;
  season: string;
  matchday: number;
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  status: "scheduled" | "completed";
  kickoff_at: string | null;
  played_at?: string | null;
};

export type PlayedMatchday = {
  mine: { match: StoredMatch; result: SimulationResult } | null;
  others: { match: StoredMatch; result: SimulationResult }[];
};

export function canKickOff(match: StoredMatch, now = nowMs()) {
  return !match.kickoff_at || new Date(match.kickoff_at).getTime() <= now;
}

export async function playMatchday(
  client: SupabaseClient,
  all: StoredMatch[],
  matchday: number,
  myClub: string,
  leagueKey: string,
  sim?: SimContext
): Promise<PlayedMatchday> {
  const round = all.filter(
    (match) => match.matchday === matchday && match.status === "scheduled"
  );

  const playedAt = new Date().toISOString();
  const out: PlayedMatchday = { mine: null, others: [] };
  const bonus = sim?.bonus ?? {};

  // my style against how the other club plays
  const withMatchup = (_m: StoredMatch, club: string, opp: string, base: number | undefined) =>
    sim?.myClub === club && sim.style && base !== undefined ? base + matchup(sim.style, aiStyle(opp)) : base;

  // the styles of both sides, for the manager's own match only
  const styles = (m: StoredMatch) =>
    sim?.style && sim.myClub && (m.home_club === sim.myClub || m.away_club === sim.myClub)
      ? { homeStyle: m.home_club === sim.myClub ? sim.style : aiStyle(m.home_club), awayStyle: m.away_club === sim.myClub ? sim.style : aiStyle(m.away_club) }
      : {};

  const run = (match: StoredMatch, fixed?: { home: number; away: number }) =>
    simulateFixture({
      leagueKey,
      season: match.season,
      matchday: match.matchday,
      homeClub: match.home_club,
      awayClub: match.away_club,
      homeBonus: withMatchup(match, match.home_club, match.away_club, bonus[match.home_club]),
      awayBonus: withMatchup(match, match.away_club, match.home_club, bonus[match.away_club]),
      ...styles(match),
      fixed,
      squads: sim?.squads,
    });

  // results: a score another manager of this shared league already saved wins
  const results = new Map<string, SimulationResult>();
  if (round.length) {
    const season = round[0].season;
    const stored = sim?.roomId ? await sharedScores(client, sim.roomId, season, matchday) : new Map();
    const fresh: StoredMatch[] = [];
    for (const match of round) {
      const key = scoreKey(match.home_club, match.away_club);
      const fixed = stored.get(key);
      results.set(match.id, run(match, fixed));
      if (!fixed) fresh.push(match);
    }
    if (sim?.roomId && fresh.length) {
      await shareScores(
        client,
        sim.roomId,
        season,
        matchday,
        fresh.map((m) => ({ home: m.home_club, away: m.away_club, hs: results.get(m.id)!.home_score, as: results.get(m.id)!.away_score }))
      );
      // two managers can start at the same moment: whoever saved first decides
      const winner = await sharedScores(client, sim.roomId, season, matchday);
      for (const match of fresh) {
        const saved = winner.get(scoreKey(match.home_club, match.away_club));
        const mine = results.get(match.id)!;
        if (saved && (saved.home !== mine.home_score || saved.away !== mine.away_score)) results.set(match.id, run(match, saved));
      }
    }
  }

  await Promise.all(
    round.map(async (match) => {
      const result = results.get(match.id)!;

      const { error } = await client
        .from("league_matches")
        .update({
          home_score: result.home_score,
          away_score: result.away_score,
          status: "completed",
          played_at: playedAt,
        })
        .eq("id", match.id);

      if (error) throw error;

      const entry = {
        match: {
          ...match,
          home_score: result.home_score,
          away_score: result.away_score,
          status: "completed" as const,
          played_at: playedAt,
        },
        result,
      };

      if (match.home_club === myClub || match.away_club === myClub) {
        out.mine = entry;
      } else {
        out.others.push(entry);
      }
    })
  );

  // the cards my club's players got count for the next matches
  if (out.mine) {
    if (sim?.style) recordStyle(out.mine.match.season, out.mine.match.matchday, myClub, sim.style);
    const mySide = out.mine.match.home_club === myClub ? "home" : "away";
    recordCards(
      out.mine.match.season,
      out.mine.match.matchday,
      out.mine.result.events.filter((e) => e.type === "foul" && e.team && e.team !== mySide)
    );
  }

  return out;
}
