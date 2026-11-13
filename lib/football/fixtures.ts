import { clubs } from "@/lib/football/clubs";

export type Fixture = {
  user_id: string;
  league_id: string;
  season: string;
  matchday: number;
  home_club: string;
  away_club: string;
  status: "scheduled" | "completed";
  home_score: number | null;
  away_score: number | null;
};

export function generateFixtures(
  userId: string,
  leagueId: string,
  season: string
): Fixture[] {
  const teams = clubs.map((club) => club.id);

  if (teams.length !== 20 || new Set(teams).size !== 20) {
    throw new Error("لازم يكون عندك 20 نادي مختلف بالضبط.");
  }

  const rotation = [...teams];
  const firstHalf: Fixture[] = [];

  // أول 19 جولة: كل فريق يقابل كل فريق مرة واحدة.
  for (let round = 1; round <= 19; round++) {
    for (let i = 0; i < 10; i++) {
      let home = rotation[i];
      let away = rotation[19 - i];

      // تبديل الملعب في بعض الجولات لتحقيق توزيع متوازن.
      if ((round + i) % 2 === 0) {
        [home, away] = [away, home];
      }

      firstHalf.push({
        user_id: userId,
        league_id: leagueId,
        season,
        matchday: round,
        home_club: home,
        away_club: away,
        status: "scheduled",
        home_score: null,
        away_score: null,
      });
    }

    // تثبيت أول فريق وتحريك باقي الفرق.
    const last = rotation.pop()!;
    rotation.splice(1, 0, last);
  }

  // الجولات من 20 إلى 38: نفس المواجهات مع عكس الملعب.
  const secondHalf = firstHalf.map((match) => ({
    ...match,
    matchday: match.matchday + 19,
    home_club: match.away_club,
    away_club: match.home_club,
  }));

  return [...firstHalf, ...secondHalf];
}