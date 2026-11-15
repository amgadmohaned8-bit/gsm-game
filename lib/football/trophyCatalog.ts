/**
 * The trophy room reads from this file.
 *
 * To add a new cup:
 *   1. add a line to KINDS (its `kind` is what you save in the trophies table),
 *   2. list the kind in LEAGUE_KINDS for each league that has it,
 *   3. save a row in `trophies` when the manager wins it.
 * Nothing in the page has to change. A kind that is saved but not listed here
 * still shows up in the room, with a plain gold cup, so nothing is ever lost.
 */

import { baseLeague } from "@/lib/football/leagueIds";
import { CUPS, isCup, leagueOf } from "@/lib/football/leaguesCatalog";

export type Kind = {
  title: string;
  note: string;
  image: string;
  /** lower shelves first, bigger prizes on top */
  rank: number;
  /** a medal-sized prize rather than a big cup */
  small?: boolean;
};

export const KINDS: Record<string, Kind> = {
  league: { title: "League champion", note: "Finish first in the league", image: "/trophies/premier-league.png", rank: 1 },
  league_cup: { title: "League Cup", note: "Win the knockout cup", image: "/trophies/league-cup.png", rank: 2 },
  continental_cup: { title: "Cup winner", note: "Win the competition", image: "/trophies/league-cup.png", rank: 1 },
  objective: { title: "Board objective", note: "Reach the target the board set", image: "/trophies/board-objective.png", rank: 9, small: true },
};

/** Which kinds each league has. Locked slots are drawn for the ones you have not won yet. */
export const LEAGUE_KINDS: Record<string, string[]> = {
  "premier-league": ["league", "league_cup", "objective"],
  "egyptian-premier-league": ["league", "league_cup", "objective"],
  "caf-champions-league": ["continental_cup"],
  "caf-confederation-cup": ["continental_cup"],
  "la-liga": ["league", "league_cup", "objective"],
  "serie-a": ["league", "league_cup", "objective"],
  bundesliga: ["league", "league_cup", "objective"],
};

/** A league can have its own picture and name for a kind. Anything not listed here uses the default in KINDS. */
export const LEAGUE_OVERRIDES: Record<string, Record<string, { image?: string; title?: string }>> = {
  "caf-champions-league": { continental_cup: { image: "/trophies/caf-champions-league.png", title: "CAF Champions League" } },
  "caf-confederation-cup": { continental_cup: { image: "/trophies/caf-confederation-cup.png", title: "CAF Confederation Cup" } },
  "egyptian-premier-league": {
    league: { image: "/trophies/egyptian-premier-league.png", title: "Egyptian League champion" },
    league_cup: { image: "/trophies/egypt-cup.png", title: "Egypt Cup" },
  },
};

const FALLBACK: Kind = { title: "Trophy", note: "A trophy for the cabinet", image: "/trophies/league-cup.png", rank: 5 };

export function kindInfo(kind: string): Kind {
  return (
    KINDS[kind] ?? {
      ...FALLBACK,
      title: kind.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    }
  );
}

/** "Premier League champion", "La Liga Cup"... */
export function trophyTitle(kind: string, leagueId: string) {
  const own = LEAGUE_OVERRIDES[baseLeague(leagueId)]?.[kind]?.title;
  if (own) return own;
  const l = leagueOf(leagueId).name;
  if (kind === "league") return `${l} champion`;
  if (kind === "league_cup") return `${l} Cup`;
  return kindInfo(kind).title;
}

export type Win = { kind: string; season: string; club_id: string | null; league_id: string };

export type Slot = { soon: boolean; kind: string; leagueId: string; title: string; note: string; image: string; small: boolean; rank: number; wins: Win[] };

/** Every slot of every league: the won ones and the locked ones, plus any kind found only in the data. */
export function buildCabinet(allWins: Win[], rawLeagueIds: string[]): { leagueId: string; cup: boolean; slots: Slot[] }[] {
  // a second team in the same league adds to the same cabinet
  const wins = allWins.map((w) => ({ ...w, league_id: baseLeague(w.league_id) }));
  const leagueIds = rawLeagueIds.map((l) => baseLeague(l));
  // every continental cup always has its own cabinet, after the leagues
  const ids = [...new Set([...leagueIds, ...wins.map((w) => w.league_id)])].filter((id) => !isCup(id)).concat(CUPS.map((c) => c.id));
  return ids.map((leagueId) => {
    const cup = isCup(leagueId);
    const kinds = new Set([...(LEAGUE_KINDS[leagueId] ?? ["league", "league_cup", "objective"]), ...wins.filter((w) => w.league_id === leagueId).map((w) => w.kind)]);
    const slots = [...kinds]
      .map((kind) => {
        const info = kindInfo(kind);
        return {
          kind,
          soon: cup && !leagueOf(leagueId).available,
          leagueId,
          title: trophyTitle(kind, leagueId),
          note: info.note,
          image: LEAGUE_OVERRIDES[baseLeague(leagueId)]?.[kind]?.image ?? info.image,
          small: !!info.small,
          rank: info.rank,
          wins: wins.filter((w) => w.league_id === leagueId && w.kind === kind).sort((a, b) => (a.season < b.season ? 1 : -1)),
        };
      })
      .sort((a, b) => a.rank - b.rank);
    return { leagueId, cup, slots };
  });
}
