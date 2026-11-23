/**
 * Season calendar.
 *
 * Every matchday has its own date and kicks off at 8 PM Cairo time,
 * one matchday per day. The same kickoff applies to every match of that
 * matchday, so all managers in the same league play at the same minute.
 */

import { clubsOfLeague } from "@/lib/football/leagueClubs";

import { nowMs } from "@/lib/serverTime";
export const KICKOFF_TIME_ZONE = "Africa/Cairo";
export const KICKOFF_HOUR = 19;
export const MATCHDAYS = 38;

export type ScheduledFixture = {
  user_id: string;
  league_id: string;
  season: string;
  matchday: number;
  home_club: string;
  away_club: string;
  status: "scheduled" | "completed";
  home_score: number | null;
  away_score: number | null;
  kickoff_at: string;
};

function zoneParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    h: get("hour"),
    min: get("minute"),
    s: get("second"),
  };
}

/** Wall-clock time in a time zone -> the real instant (handles daylight saving). */
export function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
  timeZone = KICKOFF_TIME_ZONE
): Date {
  const wanted = Date.UTC(y, m - 1, d, hour, minute);
  let utc = wanted;

  for (let i = 0; i < 2; i++) {
    const p = zoneParts(new Date(utc), timeZone);
    const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
    utc += wanted - shown;
  }

  return new Date(utc);
}

/** The next 8 PM (Cairo) that is at least five minutes away. */
export function firstKickoff(now = new Date(nowMs())): Date {
  const p = zoneParts(now, KICKOFF_TIME_ZONE);
  const today = zonedTimeToUtc(p.y, p.m, p.d, KICKOFF_HOUR, 0);

  return today.getTime() > now.getTime() + 5 * 60_000
    ? today
    : zonedTimeToUtc(p.y, p.m, p.d + 1, KICKOFF_HOUR, 0);
}

/**
 * The cup has its own days. One cup round is played after league matchdays
 * 6, 12, 18, 24 and 30, so a season runs 43 days: six league days, a cup day,
 * and again.
 */
export const CUP_AFTER_MATCHDAYS = [6, 12, 18, 24, 30];

function atDayOffset(first: Date, days: number): Date {
  const p = zoneParts(first, KICKOFF_TIME_ZONE);
  return zonedTimeToUtc(p.y, p.m, p.d + days, KICKOFF_HOUR, 0);
}

/** Kickoff of matchday N, given the kickoff of matchday 1. */
export function matchdayKickoff(first: Date, matchday: number): Date {
  const cupDaysBefore = CUP_AFTER_MATCHDAYS.filter((m) => m < matchday).length;
  return atDayOffset(first, matchday - 1 + cupDaysBefore);
}

/** Kickoff of cup round 0-4 (qualifying ... final), given matchday 1. */
export function cupKickoff(first: Date, roundNo: number): Date {
  return atDayOffset(first, 7 * (roundNo + 1) - 1);
}

/**
 * Builds the 380 fixtures of a 20-club season (circle method), each with
 * its kickoff. Matchdays 20-38 repeat 1-19 with the venues swapped.
 */
export function buildSeasonFixtures(
  userId: string,
  leagueId: string,
  season: string,
  first: Date = firstKickoff()
): ScheduledFixture[] {
  const teams = clubsOfLeague(leagueId).map((club) => club.id);

  if (teams.length !== 20 || new Set(teams).size !== 20) {
    throw new Error("لازم يكون عندك 20 نادي مختلف بالضبط.");
  }

  const rotation = [...teams];
  const firstHalf: ScheduledFixture[] = [];

  for (let round = 1; round <= 19; round++) {
    const kickoff = matchdayKickoff(first, round).toISOString();

    for (let i = 0; i < 10; i++) {
      let home = rotation[i];
      let away = rotation[19 - i];

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
        kickoff_at: kickoff,
      });
    }

    const last = rotation.pop()!;
    rotation.splice(1, 0, last);
  }

  const secondHalf = firstHalf.map((match) => ({
    ...match,
    matchday: match.matchday + 19,
    home_club: match.away_club,
    away_club: match.home_club,
    kickoff_at: matchdayKickoff(first, match.matchday + 19).toISOString(),
  }));

  return [...firstHalf, ...secondHalf];
}

/** "Sat 8 Nov, 8:00 pm" in Cairo time. */
export function formatKickoff(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KICKOFF_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function formatKickoffDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: KICKOFF_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

export function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
