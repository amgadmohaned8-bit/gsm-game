/**
 * Match simulation with a fixed seed.
 *
 * The same fixture always gives the same score and the same events, so two
 * managers who open the same match see the same result. Pass the same
 * `leagueKey` for everyone who shares a league (for now: the user id of the
 * league owner).
 */

import { GOAL_SHAPE, aiStyle, loggedStyle, type StyleId } from "@/lib/football/tactics";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { egyptRatings } from "@/lib/football/egypt";
import { africaRatings } from "@/lib/football/africa";
import { europeRatings } from "@/lib/football/europeClubs";
import { pickScorers, type Squads } from "@/lib/football/goals";
import { squads as baseSquads } from "@/lib/football/squads";
import { availableSquad, injuryBonus } from "@/lib/football/availability";

export type MatchEvent = {
  minute: number;
  text: string;
  type: "goal" | "chance" | "save" | "whistle" | "foul" | "pen_miss";
  /** goals, chances: who attacks. fouls: the side that was fouled */
  team?: "home" | "away";
  /** a goal scored from the penalty spot */
  pen?: boolean;
  /** a foul that ended in a card (the player is the one who committed it) */
  card?: "yellow" | "red";
  /** pen_miss: true when the keeper saved it */
  saved?: boolean;
  /** goals: who scored and who set it up */
  player?: string;
  playerId?: string;
  assist?: string;
  assistId?: string;
};

export type SimulationResult = {
  home_score: number;
  away_score: number;
  events: MatchEvent[];
};

// starting strength of each club (not player ratings)
const clubRatings: Record<string, number> = {
  "man-city": 92,
  arsenal: 90,
  liverpool: 89,
  chelsea: 86,
  "man-united": 85,
  tottenham: 84,
  newcastle: 83,
  "aston-villa": 82,
  brighton: 80,
  "crystal-palace": 77,
  "nottingham-forest": 76,
  fulham: 75,
  everton: 74,
  brentford: 74,
  bournemouth: 73,
  leeds: 72,
  ipswich: 70,
  sunderland: 70,
  coventry: 69,
  "hull-city": 68,
};

/**
 * How a computer club's season goes compared with its usual level: a good or a bad year, between -7 and +7.
 * Fixed for a club and a season, so everybody sees the same one. The manager's own club does not drift
 * (its strength comes from the squad the manager builds).
 */
export function formOf(clubId: string, season: string): number {
  const r = seedFromString(`${clubId}|${season}|form`) / 4294967296;
  return Math.round((r * 2 - 1) * 7 * 10) / 10;
}

/** How much of the gap between two ratings counts in a match (the rest is football being football). */
const GAP = 0.8;

export function getRating(clubId: string) {
  return clubRatings[clubId] ?? egyptRatings[clubId] ?? africaRatings[clubId] ?? europeRatings[clubId] ?? 72;
}

// ---- seeded random numbers ----

function seedFromString(text: string) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function createRng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Goals of one side. They follow a Poisson curve whose mean is the expected
 * goals, so a stronger side really scores more and concedes less. (The old
 * table only used the expectation for the chance of a blank.)
 */
function goalsFrom(expected: number, roll: number): number {
  const mean = Math.max(0.25, Math.min(expected, 3.8));
  let p = Math.exp(-mean);
  let cum = p;
  let k = 0;
  while (roll > cum && k < 7) {
    k += 1;
    p *= mean / k;
    cum += p;
  }
  return k;
}

/** Changes to one match: squad strength on top of the club rating, or a score that is already decided. */
export type SimOptions = {
  homeBonus?: number;
  awayBonus?: number;
  /** how each side plays (only given for the manager's match): changes how many goals there are */
  homeStyle?: StyleId;
  awayStyle?: StyleId;
  fixed?: { home: number; away: number };
  /** squads to pick the scorers from (club id -> players) */
  squads?: Squads;
};

export type FixtureKey = SimOptions & {
  leagueKey: string;
  season: string;
  matchday: number;
  homeClub: string;
  awayClub: string;
};

export function simulateFixture(key: FixtureKey): SimulationResult {
  const rng = createRng(
    seedFromString(
      [key.leagueKey, key.season, key.matchday, key.homeClub, key.awayClub].join("|")
    )
  );

  const pool = key.squads ?? baseSquads;
  const homeBonus = key.homeBonus ?? injuryBonus(key.homeClub, pool[key.homeClub] ?? [], key.leagueKey, key.season, key.matchday);
  const awayBonus = key.awayBonus ?? injuryBonus(key.awayClub, pool[key.awayClub] ?? [], key.leagueKey, key.season, key.matchday);
  const homeForm = key.homeBonus === undefined ? formOf(key.homeClub, key.season) : 0;
  const awayForm = key.awayBonus === undefined ? formOf(key.awayClub, key.season) : 0;
  const homeRating = getRating(key.homeClub) + 3 + homeBonus + homeForm; // home advantage
  const awayRating = getRating(key.awayClub) + awayBonus + awayForm;
  const difference = ((homeRating - awayRating) * GAP) / 20;

  const hs = key.homeStyle ? GOAL_SHAPE[key.homeStyle] : null;
  const as = key.awayStyle ? GOAL_SHAPE[key.awayStyle] : null;
  const homeExpected = Math.max(0.4, Math.min(3.4, (1.35 + difference) * (hs?.scores ?? 1) * (as?.concedes ?? 1)));
  const awayExpected = Math.max(0.3, Math.min(3.0, (1.15 - difference) * (as?.scores ?? 1) * (hs?.concedes ?? 1)));

  const rolledHome = goalsFrom(homeExpected, rng());
  const rolledAway = goalsFrom(awayExpected, rng());

  const homeName = clubs.find((c) => c.id === key.homeClub)?.name ?? key.homeClub;
  const awayName = clubs.find((c) => c.id === key.awayClub)?.name ?? key.awayClub;

  /* Fouls, cards and penalties. They come from their own random stream, so the
     same fixture always gives the same incidents. A red card and a converted
     penalty change the score; yellow cards and plain fouls are incidents only. */
  const er = createRng(seedFromString([key.leagueKey, key.season, key.matchday, key.homeClub, key.awayClub, "incidents"].join("|")));
  const sides = ["home", "away"] as const;
  type Side = (typeof sides)[number];
  const other = (s: Side): Side => (s === "home" ? "away" : "home");
  const nameOfSide = (s: Side) => (s === "home" ? homeName : awayName);
  const outfield = (s: Side) => availableSquad(pool[s === "home" ? key.homeClub : key.awayClub] ?? [], key.leagueKey, key.season, key.matchday).filter((p) => p.position !== "GK");
  // defenders and midfielders pick up more cards than forwards
  const CARD_W = { DF: 1.35, MF: 1.2, FW: 0.75, GK: 0 } as const;
  const someone = (s: Side, roll = er()) => {
    const l = outfield(s);
    if (!l.length) return undefined;
    const total = l.reduce((n, p) => n + CARD_W[p.position], 0);
    let at = roll * total;
    for (const p of l) { at -= CARD_W[p.position]; if (at < 0) return p; }
    return l[l.length - 1];
  };
  const incidents: MatchEvent[] = [];
  const adjust = { home: 0, away: 0 };
  const penalty = { home: false, away: false };

  for (const s of sides) {
    if (er() < 0.04) {
      const minute = 20 + Math.floor(er() * 65);
      const p = someone(s);
      incidents.push({ minute, type: "foul", team: other(s), card: "red", player: p?.name, playerId: p?.id, text: `Red card! ${p?.name ?? "A player"} (${nameOfSide(s)}) is sent off.` });
      const left = (90 - minute) / 90;
      if (er() < 0.5 * left) adjust[other(s)] += 1;
      if (er() < 0.35 * left) adjust[s] -= 1;
    }
  }
  const yellows = Math.floor(er() * 4);
  for (let i = 0; i < yellows; i++) {
    const s: Side = er() < 0.5 ? "home" : "away";
    const p = someone(s);
    incidents.push({ minute: 8 + Math.floor(er() * 80), type: "foul", team: other(s), card: "yellow", player: p?.name, playerId: p?.id, text: `Yellow card for ${p?.name ?? "a player"} (${nameOfSide(s)}).` });
  }
  // a match has more bookings than that: a few more from a stream of their own
  const yr = createRng(seedFromString([key.leagueKey, key.season, key.matchday, key.homeClub, key.awayClub, "yellows"].join("|")));
  const more = Math.floor(yr() * 3);
  for (let i = 0; i < more; i++) {
    const s: Side = yr() < 0.5 ? "home" : "away";
    const p = someone(s, yr());
    incidents.push({ minute: 8 + Math.floor(yr() * 80), type: "foul", team: other(s), card: "yellow", player: p?.name, playerId: p?.id, text: `Yellow card for ${p?.name ?? "a player"} (${nameOfSide(s)}).` });
  }
  for (let i = 0; i < 2; i++) {
    const s: Side = er() < 0.5 ? "home" : "away";
    incidents.push({ minute: 6 + Math.floor(er() * 82), type: "foul", team: other(s), text: `Foul on ${nameOfSide(other(s))}. Free kick.` });
  }
  if (er() < 0.13) {
    const s: Side = er() < 0.5 ? "home" : "away";
    const minute = 5 + Math.floor(er() * 84);
    if (er() < 0.78) { penalty[s] = true; adjust[s] += 1; }
    else incidents.push({ minute, type: "pen_miss", team: s, saved: er() < 0.6, text: `${nameOfSide(s)} miss a penalty.` });
  }

  const homeGoals = key.fixed ? key.fixed.home : Math.max(0, Math.min(6, rolledHome + adjust.home));
  const awayGoals = key.fixed ? key.fixed.away : Math.max(0, Math.min(6, rolledAway + adjust.away));

  const events: MatchEvent[] = [];

  const seedKey = [key.leagueKey, key.season, key.matchday, key.homeClub, key.awayClub].join("|");
  // who scores depends on how the club plays: the style it used (my club) or its usual one (the computer clubs)
  const homePlay = key.homeStyle ?? loggedStyle(key.season, key.matchday, key.homeClub) ?? aiStyle(key.homeClub);
  const awayPlay = key.awayStyle ?? loggedStyle(key.season, key.matchday, key.awayClub) ?? aiStyle(key.awayClub);
  const homeWho = pickScorers(availableSquad(pool[key.homeClub] ?? [], key.leagueKey, key.season, key.matchday), homeGoals, `${seedKey}|h`, undefined, homePlay);
  const awayWho = pickScorers(availableSquad(pool[key.awayClub] ?? [], key.leagueKey, key.season, key.matchday), awayGoals, `${seedKey}|a`, undefined, awayPlay);

  const goalEvent = (team: "home" | "away", name: string, who: ReturnType<typeof pickScorers>[number] | undefined): MatchEvent => ({
    minute: 5 + Math.floor(rng() * 85),
    text: who ? `GOAL! ${who.scorer.name} (${name})${who.assist ? `, assist ${who.assist.name}` : ""}` : `GOAL! ${name} score!`,
    type: "goal",
    team,
    player: who?.scorer.name,
    playerId: who?.scorer.id,
    assist: who?.assist?.name,
    assistId: who?.assist?.id,
  });

  for (let i = 0; i < homeGoals; i++) events.push(goalEvent("home", homeName, homeWho[i]));
  for (let i = 0; i < awayGoals; i++) events.push(goalEvent("away", awayName, awayWho[i]));

  // a converted penalty is the first goal of that side, from the spot
  for (const s of sides) {
    if (!penalty[s]) continue;
    const g = events.find((e) => e.type === "goal" && e.team === s);
    if (g) { g.pen = true; g.assist = undefined; g.assistId = undefined; g.text = `GOAL from the penalty spot! ${g.player ?? ""} (${nameOfSide(s)})`.replace("!  ", "! "); }
  }
  events.push(...incidents);

  const extra = [
    `${homeName} create a dangerous chance.`,
    `${awayName} try a shot from distance.`,
    "A big save from the goalkeeper.",
    `A dangerous attack from ${homeName}.`,
    `${awayName} win the ball in midfield.`,
    "The defence clears the danger.",
  ];

  for (let i = 0; i < 6; i++) {
    events.push({
      minute: 3 + Math.floor(rng() * 87),
      text: extra[Math.floor(rng() * extra.length)],
      type: rng() > 0.5 ? "chance" : "save",
    });
  }

  events.sort((a, b) => a.minute - b.minute);

  events.push({
    minute: 90,
    text: "Full time. The referee ends the match.",
    type: "whistle",
  });

  return { home_score: homeGoals, away_score: awayGoals, events };
}
