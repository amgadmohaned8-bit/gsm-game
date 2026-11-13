import { clubs } from "./clubs";

export type Match = {
  id: string;
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

export type Standing = {
  clubId: string;
  name: string;
  logo: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export function calculateStandings(matches: Match[]): Standing[] {
  const table: Record<string, Standing> = {};

  clubs.forEach((club) => {
    table[club.id] = {
      clubId: club.id,
      name: club.name,
      logo: club.logo,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    };
  });

  matches
    .filter(
      (match) =>
        match.status === "completed" &&
        match.home_score !== null &&
        match.away_score !== null &&
        table[match.home_club] &&
        table[match.away_club]
    )
    .forEach((match) => {
      const home = table[match.home_club];
      const away = table[match.away_club];

      const homeGoals = Number(match.home_score);
      const awayGoals = Number(match.away_score);

      home.played++;
      away.played++;

      home.gf += homeGoals;
      home.ga += awayGoals;

      away.gf += awayGoals;
      away.ga += homeGoals;

      if (homeGoals > awayGoals) {
        home.won++;
        away.lost++;
        home.points += 3;
      } else if (homeGoals < awayGoals) {
        away.won++;
        home.lost++;
        away.points += 3;
      } else {
        home.drawn++;
        away.drawn++;
        home.points++;
        away.points++;
      }
    });

  return Object.values(table)
    .map((club) => ({
      ...club,
      gd: club.gf - club.ga,
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.name.localeCompare(b.name)
    );
}