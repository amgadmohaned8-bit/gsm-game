/**
 * Transfers between the other clubs of a league.
 *
 * The computer clubs trade with each other during the two windows. Nothing is
 * stored: for a manager, a league and a season the same list is worked out
 * every time, so it never changes by itself. Players the manager has bought
 * are simply not there for the others to buy: the deals are applied in time
 * order, and a deal whose player has already left his club is skipped.
 */

import { clubsOfLeague } from "@/lib/football/leagueClubs";
import { marketValue, squads as baseSquads, teamRating, type Player } from "@/lib/football/squads";
import { FIRST_SEASON, nextSeason } from "@/lib/football/season";
import type { Deal } from "@/lib/football/transfers";

export const AI_USER = "league";

/** matchdays on which the computer clubs trade: the summer and the winter window */
const DAYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21, 22, 23, 24, 25, 26];
const MIN: Record<string, number> = { GK: 2, DF: 5, MF: 5, FW: 3 };

function seed(text: string) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function unit(text: string) {
  let a = seed(text) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The seasons from the first one up to this one. */
function seasonsUpTo(season: string): string[] {
  const out: string[] = [];
  let s = FIRST_SEASON;
  for (let i = 0; i < 30; i++) {
    out.push(s);
    if (s >= season) break;
    s = nextSeason(s);
  }
  return out;
}

/**
 * Every deal between computer clubs of the league up to this season (the whole
 * of the earlier ones). The manager's own club never takes part.
 */
export function aiDeals(userId: string, leagueId: string, myClub: string, season: string, human: string[] = []): Deal[] {
  // clubs with a human manager do not trade by themselves
  const clubs = clubsOfLeague(leagueId).map((c) => c.id).filter((id) => id !== myClub && !human.includes(id) && baseSquads[id]?.length);
  if (clubs.length < 3) return [];

  const squads: Record<string, Player[]> = {};
  for (const id of clubs) squads[id] = [...baseSquads[id]];

  const out: Deal[] = [];
  for (const s of seasonsUpTo(season)) {
    DAYS.forEach((day) => {
      // one or two moves on a matchday of a window
      const moves = unit(`${userId}|${leagueId}|${s}|${day}|n`) < 0.45 ? 2 : 1;
      for (let k = 0; k < moves; k++) {
        const key = `${userId}|${leagueId}|${s}|${day}|${k}`;
        const seller = clubs[Math.floor(unit(`${key}|from`) * clubs.length)];
        let buyer = clubs[Math.floor(unit(`${key}|to`) * clubs.length)];
        if (buyer === seller) buyer = clubs[(clubs.indexOf(seller) + 1) % clubs.length];

        const list = squads[seller];
        if (list.length <= 20) continue;
        // a useful player, not the best of the side and not a youngster on the bench
        const ranked = [...list].sort((a, b) => b.rating - a.rating);
        const pool = ranked.slice(2, 16);
        const player = pool[Math.floor(unit(`${key}|who`) * pool.length)];
        if (!player) continue;
        const left = list.filter((p) => p.position === player.position && p.id !== player.id).length;
        if (left < (MIN[player.position] ?? 3)) continue;
        // the buyer must be able to use him
        if (player.rating < teamRating(squads[buyer]) - 14) continue;

        squads[seller] = list.filter((p) => p.id !== player.id);
        squads[buyer] = [...squads[buyer], { ...player, club: buyer }];
        out.push({
          id: `ai-${s}-${day}-${k}`,
          user_id: AI_USER,
          season: s,
          player_id: player.id,
          from_club: seller,
          to_club: buyer,
          fee: round1(Math.max(0.5, marketValue(player) * (0.9 + 0.3 * unit(`${key}|fee`)))),
          kind: "buy",
          matchday: day,
          created_at: "",
        });
      }
    });
  }
  return out;
}

/** Only what has happened by that matchday of that season. */
export function aiDealsAt(all: Deal[], season: string, matchday: number | null): Deal[] {
  return all.filter((d) => d.season < season || (d.season === season && (matchday === null || d.matchday <= matchday)));
}
