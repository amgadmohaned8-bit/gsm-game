// @ts-nocheck
/**
 * Every club of every league in one place.
 *
 * `clubs` (lib/football/clubs) is the Premier League. Other leagues keep their
 * clubs in their own file and are joined here. Use:
 *   allClubs          to look any club up by id (names, logos),
 *   clubsOfLeague(id) for the clubs that play in one league,
 *   leagueOfClub(id)  to know which league a club belongs to.
 * To add a league: put its clubs in a file like egypt.ts and add it to LEAGUE_CLUBS.
 */

import { clubs as premierClubs } from "./clubs.ts";
import { egyptClubs } from "./egypt.ts";
import { africanClubs } from "./africa.ts";
import { europeanClubs } from "./europeClubs.ts";
import { baseLeague } from "./leagueIds.ts";

export type LeagueClub = { id: string; name: string; city: string; stadium: string; logo: string };

const LEAGUE_CLUBS: Record<string, LeagueClub[]> = {
  "premier-league": premierClubs as LeagueClub[],
  "egyptian-premier-league": egyptClubs,
};

// the African cup clubs belong to no league: they are only here so names and logos can be looked up
export const allClubs: LeagueClub[] = [...Object.values(LEAGUE_CLUBS).flat(), ...africanClubs, ...europeanClubs];

const owner = new Map<string, string>();
for (const [league, list] of Object.entries(LEAGUE_CLUBS)) for (const c of list) owner.set(c.id, league);

export const clubsOfLeague = (leagueId: string | null | undefined): LeagueClub[] => LEAGUE_CLUBS[baseLeague(leagueId) || "premier-league"] ?? LEAGUE_CLUBS["premier-league"];
export const leagueOfClub = (clubId: string | null | undefined): string => (clubId && owner.get(clubId)) || "premier-league";
export const hasClubs = (leagueId: string) => !!LEAGUE_CLUBS[baseLeague(leagueId)]?.length;
