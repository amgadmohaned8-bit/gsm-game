import { clubs } from "@/lib/football/clubs";

export type MatchEvent = {
  minute: number;
  text: string;
  type: "goal" | "chance" | "save" | "whistle";
};

export type SimulationResult = {
  home_score: number;
  away_score: number;
  events: MatchEvent[];
};

// تقييمات مبدئية للأندية، وليست تقييمات اللاعبين الفعلية.
const clubRatings: Record<string, number> = {
  "man-city": 92,
  arsenal: 90,
  liverpool: 89,
  "chelsea": 86,
  "man-united": 85,
  "tottenham": 84,
  "newcastle": 83,
  "aston-villa": 82,
  brighton: 80,
  "west-ham": 79,
  "crystal-palace": 77,
  "nottingham-forest": 76,
  fulham: 75,
  everton: 74,
  brentford: 74,
  bournemouth: 73,
  ipswich: 70,
  leeds: 72,
  sunderland: 70,
  coventry: 69,
  "hull-city": 68,
};

function getRating(clubId: string) {
  return clubRatings[clubId] ?? 72;
}

function randomGoals(expected: number): number {
  // توزيع احتمالي مبسط لعدد الأهداف.
  const roll = Math.random();
  const adjusted = Math.max(0.25, Math.min(expected, 3.2));

  if (roll < 0.30 / adjusted) return 0;
  if (roll < 0.68) return 1;
  if (roll < 0.91) return 2;
  if (roll < 0.98) return 3;
  return 4;
}

export function simulateMatch(
  homeClub: string,
  awayClub: string
): SimulationResult {
  const homeRating = getRating(homeClub) + 3;
  const awayRating = getRating(awayClub);

  const difference = (homeRating - awayRating) / 20;

  const homeExpected = Math.max(0.45, Math.min(3.2, 1.35 + difference));
  const awayExpected = Math.max(0.35, Math.min(2.8, 1.15 - difference));

  const homeGoals = randomGoals(homeExpected);
  const awayGoals = randomGoals(awayExpected);

  const homeName = clubs.find((club) => club.id === homeClub)?.name ?? homeClub;
  const awayName = clubs.find((club) => club.id === awayClub)?.name ?? awayClub;

  const events: MatchEvent[] = [];

  for (let i = 0; i < homeGoals; i++) {
    events.push({
      minute: 5 + Math.floor(Math.random() * 85),
      text: `GOAL! ${homeName} scores!`,
      type: "goal",
    });
  }

  for (let i = 0; i < awayGoals; i++) {
    events.push({
      minute: 5 + Math.floor(Math.random() * 85),
      text: `GOAL! ${awayName} scores!`,
      type: "goal",
    });
  }

  const extraEvents = [
    `${homeName} creates a dangerous chance!`,
    `${awayName} tries a long-range shot!`,
    `What a save by the goalkeeper!`,
    `A dangerous attack from ${homeName}!`,
    `${awayName} wins possession in midfield!`,
    `The defense clears the ball!`,
  ];

  for (let i = 0; i < 5; i++) {
    events.push({
      minute: 3 + Math.floor(Math.random() * 87),
      text: extraEvents[Math.floor(Math.random() * extraEvents.length)],
      type: Math.random() > 0.5 ? "chance" : "save",
    });
  }

  events.sort((a, b) => a.minute - b.minute);

  events.push({
    minute: 90,
    text: "FULL TIME! The referee ends the match.",
    type: "whistle",
  });

  return {
    home_score: homeGoals,
    away_score: awayGoals,
    events,
  };
}