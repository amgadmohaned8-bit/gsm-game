// @ts-nocheck
/**
 * The League Cup.
 *
 * Every season the 20 clubs are drawn (same draw for the same user and
 * season). Eight clubs play a qualifying round of four ties, the four winners
 * join the other twelve clubs, and 16 clubs play a knockout: round of 16,
 * quarter-finals, semi-finals, final. One match per tie, penalties if level.
 *
 * Rows are created round by round, once the round before it is finished.
 * Results use the same seeded simulation as the league.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { allClubs as clubs, clubsOfLeague } from "./leagueClubs.ts";
import { sharedScores, shareScores, type SimContext } from "./strength.ts";
import { simulateFixture, type SimOptions, type SimulationResult } from "./matchSim.ts";
import { cupKickoff } from "./schedule.ts";

import { nowMs } from "../serverTime.ts";
export const CUP_ROUNDS = [
  { no: 0, label: "Qualifying round", ties: 4 },
  { no: 1, label: "Round of 16", ties: 8 },
  { no: 2, label: "Quarter-finals", ties: 4 },
  { no: 3, label: "Semi-finals", ties: 2 },
  { no: 4, label: "Final", ties: 1 },
] as const;

export type CupMatch = {
  id: string;
  user_id: string;
  season: string;
  round_no: number;
  slot: number;
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  pens_home: number | null;
  pens_away: number | null;
  winner: string | null;
  status: "scheduled" | "completed";
  kickoff_at: string;
  played_at?: string | null;
};

export type CupResult = SimulationResult & {
  pens_home: number | null;
  pens_away: number | null;
  winner: string;
};

export type PlayedCupRound = {
  mine: { match: CupMatch; result: CupResult } | null;
  others: { match: CupMatch; result: CupResult }[];
};

/* ---------- seeded random numbers ---------- */

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

function rng(text: string) {
  let a = seed(text);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- the draw ---------- */

export function drawCup(userId: string, season: string, leagueId = "premier-league") {
  const ids = clubsOfLeague(leagueId).map((c) => c.id);
  const random = rng(`${userId}|${season}|cup-draw`);

  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  return {
    qualifiers: [0, 1, 2, 3].map((k) => [ids[2 * k], ids[2 * k + 1]] as [string, string]),
    direct: ids.slice(8),
  };
}

/** Who plays whom in a round, or null while the round before is unfinished. */
export function pairingsFor(
  userId: string,
  season: string,
  roundNo: number,
  previous: CupMatch[],
  leagueId = "premier-league"
): [string, string][] | null {
  const draw = drawCup(userId, season, leagueId);

  if (roundNo === 0) return draw.qualifiers;

  const prev = [...previous].sort((a, b) => a.slot - b.slot);
  const expected = CUP_ROUNDS[roundNo - 1].ties;
  if (prev.length !== expected || prev.some((m) => m.status !== "completed" || !m.winner)) {
    return null;
  }

  if (roundNo === 1) {
    const ties: [string, string][] = [];
    for (let k = 0; k < 4; k++) ties.push([draw.direct[k], prev[k].winner!]);
    for (let k = 0; k < 4; k++) ties.push([draw.direct[4 + 2 * k], draw.direct[5 + 2 * k]]);
    return ties;
  }

  const ties: [string, string][] = [];
  for (let k = 0; k < CUP_ROUNDS[roundNo].ties; k++) {
    ties.push([prev[2 * k].winner!, prev[2 * k + 1].winner!]);
  }
  return ties;
}

/* ---------- playing a tie ---------- */

function nameOf(id: string) {
  return clubs.find((c) => c.id === id)?.name ?? id;
}

export function simulateTie(
  userId: string,
  season: string,
  roundNo: number,
  home: string,
  away: string,
  options: SimOptions = {}
): CupResult {
  const base = simulateFixture({
    ...options,
    leagueKey: `${userId}:cup`,
    season,
    matchday: 100 + roundNo,
    homeClub: home,
    awayClub: away,
  });

  if (base.home_score !== base.away_score) {
    return {
      ...base,
      pens_home: null,
      pens_away: null,
      winner: base.home_score > base.away_score ? home : away,
    };
  }

  // level after 90 minutes: a shoot-out, decided by the same fixed seed
  const random = rng(`${userId}|${season}|${roundNo}|${home}|${away}|pens`);
  const homeWins = random() < 0.5;
  const high = 3 + Math.floor(random() * 3);
  const low = Math.max(1, high - 1 - Math.floor(random() * 2));
  const pens_home = homeWins ? high : low;
  const pens_away = homeWins ? low : high;
  const winner = homeWins ? home : away;

  const events = [...base.events];
  const whistle = events.findIndex((e) => e.type === "whistle" && e.minute >= 90);
  const shootout = {
    minute: 90,
    text: `Level after 90 minutes. ${nameOf(winner)} win ${high}-${low} on penalties.`,
    type: "whistle" as const,
  };
  if (whistle >= 0) events.splice(whistle, 0, shootout);
  else events.push(shootout);

  return { ...base, events, pens_home, pens_away, winner };
}

async function saveTie(
  client: SupabaseClient,
  match: CupMatch,
  seed: string,
  playedAt: string,
  sim?: SimContext,
  fixed?: { home: number; away: number }
) {
  const bonus = sim?.bonus ?? {};
  const options = (fixed?: SimOptions["fixed"]): SimOptions => ({ homeBonus: bonus[match.home_club], awayBonus: bonus[match.away_club], fixed });
  const day = 100 + match.round_no;
  let result = simulateTie(seed, match.season, match.round_no, match.home_club, match.away_club, options(fixed));
  if (sim?.roomId && !fixed) {
    // in a shared league the first manager to play a tie decides it for everybody
    const stored = (await sharedScores(client, sim.roomId, match.season, day)).get(`${match.home_club}|${match.away_club}`);
    if (!stored) {
      await shareScores(client, sim.roomId, match.season, day, [{ home: match.home_club, away: match.away_club, hs: result.home_score, as: result.away_score }]);
      const again = (await sharedScores(client, sim.roomId, match.season, day)).get(`${match.home_club}|${match.away_club}`);
      if (again && (again.home !== result.home_score || again.away !== result.away_score)) result = simulateTie(seed, match.season, match.round_no, match.home_club, match.away_club, options(again));
    } else if (stored.home !== result.home_score || stored.away !== result.away_score) {
      result = simulateTie(seed, match.season, match.round_no, match.home_club, match.away_club, options(stored));
    }
  }

  const { error } = fixed ? { error: null } : await client
    .from("cup_matches")
    .update({
      home_score: result.home_score,
      away_score: result.away_score,
      pens_home: result.pens_home,
      pens_away: result.pens_away,
      winner: result.winner,
      status: "completed",
      played_at: playedAt,
    })
    .eq("id", match.id);
  if (error) throw error;

  return {
    match: {
      ...match,
      home_score: result.home_score,
      away_score: result.away_score,
      pens_home: result.pens_home,
      pens_away: result.pens_away,
      winner: result.winner,
      status: "completed" as const,
      played_at: playedAt,
    },
    result,
  };
}

/** Plays every tie of a round together, the manager's tie included. */
export async function playCupRound(
  client: SupabaseClient,
  all: CupMatch[],
  roundNo: number,
  myClub: string,
  seed: string,
  sim?: SimContext,
  /** scores the server already decided and saved (match id -> score): shown here, nothing is rolled or written */
  authority?: { scores: Map<string, { home: number; away: number }>; playedAt: string }
): Promise<PlayedCupRound> {
  const ties = all.filter((m) => m.round_no === roundNo && m.status === "scheduled");
  const playedAt = authority?.playedAt ?? new Date().toISOString();
  const out: PlayedCupRound = { mine: null, others: [] };

  await Promise.all(
    ties.map(async (match) => {
      const entry = await saveTie(client, match, seed, playedAt, sim, authority?.scores.get(match.id));
      if (match.home_club === myClub || match.away_club === myClub) out.mine = entry;
      else out.others.push(entry);
    })
  );

  return out;
}

/* ---------- keeping the bracket moving ---------- */

export async function fetchCup(client: SupabaseClient, userId: string, season: string, leagueId = "premier-league") {
  const { data, error } = await client
    .from("cup_matches")
    .select("*")
    .eq("user_id", userId)
    .eq("season", season)
    .eq("league_id", leagueId)
    .order("round_no", { ascending: true })
    .order("slot", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CupMatch[];
}

async function createRound(
  client: SupabaseClient,
  userId: string,
  season: string,
  roundNo: number,
  ties: [string, string][],
  first: Date,
  leagueId: string
) {
  const kickoff = cupKickoff(first, roundNo).toISOString();
  const rows = ties.map(([home, away], slot) => ({
    user_id: userId,
    league_id: leagueId,
    season,
    round_no: roundNo,
    slot,
    home_club: home,
    away_club: away,
    status: "scheduled",
    kickoff_at: kickoff,
  }));

  const { error } = await client
    .from("cup_matches")
    .upsert(rows, { onConflict: "user_id,league_id,season,round_no,slot", ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * Creates the next round when the last one is finished, and plays rounds the
 * manager is not part of (out of the cup, or a tie that is not theirs) once
 * their date has passed. Returns the up-to-date matches.
 */
export async function settleCup(
  client: SupabaseClient,
  userId: string,
  season: string,
  myClub: string,
  first: Date,
  now = nowMs(),
  seed: string = userId,
  sim?: SimContext,
  leagueId = "premier-league"
): Promise<CupMatch[]> {
  let rows = await fetchCup(client, userId, season, leagueId);

  for (let guard = 0; guard < 12; guard++) {
    let changed = false;

    // create whatever round is due next
    const lastNo = rows.length ? Math.max(...rows.map((m) => m.round_no)) : -1;
    const lastRound = rows.filter((m) => m.round_no === lastNo);
    const nextNo = lastNo + 1;

    if (nextNo <= 4 && (lastNo === -1 || lastRound.every((m) => m.status === "completed"))) {
      const ties = pairingsFor(seed, season, nextNo, lastRound, leagueId);
      if (ties) {
        await createRound(client, userId, season, nextNo, ties, first, leagueId);
        changed = true;
      }
    }

    if (changed) {
      rows = await fetchCup(client, userId, season, leagueId);
      continue;
    }

    // play a due round the manager is not in
    for (const round of CUP_ROUNDS) {
      const ties = rows.filter((m) => m.round_no === round.no && m.status === "scheduled");
      if (ties.length === 0) continue;
      const due = new Date(ties[0].kickoff_at).getTime() <= now;
      const involved = ties.some((m) => m.home_club === myClub || m.away_club === myClub);
      if (due && !involved) {
        await playCupRound(client, rows, round.no, myClub, seed, sim);
        changed = true;
      }
      break; // rounds go in order
    }

    if (!changed) break;
    rows = await fetchCup(client, userId, season, leagueId);
  }

  return rows;
}

/** Saves a cup win for the manager's trophy cabinet (once per season). */
export async function recordCupWin(
  client: SupabaseClient,
  userId: string,
  season: string,
  myClub: string,
  rows: CupMatch[],
  leagueId = "premier-league"
) {
  const final = rows.find((m) => m.round_no === 4 && m.status === "completed");
  if (!final || final.winner !== myClub) return;

  try {
    await client.from("trophies").upsert(
      [{ user_id: userId, kind: "league_cup", season, club_id: myClub, league_id: leagueId }],
      { onConflict: "user_id,kind,season,league_id", ignoreDuplicates: true }
    );
  } catch {
    /* the final still shows in the bracket */
  }
}

/** Where the manager stands in the cup. */
export function cupStatus(rows: CupMatch[], myClub: string) {
  const mine = rows.filter((m) => m.home_club === myClub || m.away_club === myClub);
  const next = mine.find((m) => m.status === "scheduled") ?? null;
  const last = [...mine].reverse().find((m) => m.status === "completed") ?? null;
  const final = rows.find((m) => m.round_no === 4 && m.status === "completed");
  const eliminated = !!last && last.winner !== myClub && !next;
  const champion = !!final && final.winner === myClub;
  const absent = rows.length > 0 && mine.length === 0; // not drawn into the round yet
  return { next, last, eliminated, champion, absent, final };
}
