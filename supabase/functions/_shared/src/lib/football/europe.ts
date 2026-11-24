// @ts-nocheck
/**
 * The UEFA Champions League and the UEFA Europa League.
 *
 * Format (the league phase format): 36 clubs in ONE table. Every club plays 8
 * matches against 8 different opponents (four at home, four away). The top 8
 * go straight to the round of 16, places 9-24 play a two-legged knockout
 * play-off (9th-16th are seeded and play the second leg at home), places 25-36
 * are out. Then the round of 16, quarter-finals and semi-finals over two legs,
 * and a single final.
 *
 * Champions League: 4 English clubs (1st-4th of the Premier League) + 32 foreign clubs.
 * Europa League:    2 English clubs (5th-6th) + 34 foreign clubs.
 * An English club enters the NEXT season after the league table is final.
 *
 * Everything is seeded: the same draw and scores come out for the same user and season.
 * Rounds 0-7 league phase, 8-9 play-off, 10-11 round of 16, 12-13 quarter-finals,
 * 14-15 semi-finals, 16 final.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { allClubs } from "./leagueClubs.ts";
import { UCL_CLUBS, UEL_CLUBS } from "./europeClubs.ts";
import { clubs as premierClubs } from "./clubs.ts";
import { getRating, simulateFixture, type SimOptions, type SimulationResult } from "./matchSim.ts";
import { matchup, aiStyle } from "./tactics.ts";
import type { SimContext } from "./strength.ts";
import { nextSeason } from "./season.ts";
import { calculateStandings, type Match } from "./table.ts";

export type EuroComp = { id: "ucl" | "uel"; name: string; short: string; english: number[]; foreign: string[] };

export const EURO_COMPS: EuroComp[] = [
  { id: "ucl", name: "UEFA Champions League", short: "Champions League", english: [1, 2, 3, 4], foreign: UCL_CLUBS.map((c) => c.id) },
  { id: "uel", name: "UEFA Europa League", short: "Europa League", english: [5, 6], foreign: UEL_CLUBS.map((c) => c.id) },
];

/** A stand-alone European career: the English places go to the best rated Premier League clubs (the top 4, or the next 2 for the Europa League). */
export function defaultEnglish(compId: string): string[] {
  const sorted = premierClubs.map((c) => c.id).sort((a, b) => getRating(b) - getRating(a) || a.localeCompare(b));
  return compId === "ucl" ? sorted.slice(0, 4) : sorted.slice(4, 6);
}

export const euroComp = (id: string) => EURO_COMPS.find((c) => c.id === id);
export const isEuroComp = (id: string | null | undefined) => !!id && EURO_COMPS.some((c) => c.id === id);

export const EURO_ROUNDS = [
  ...Array.from({ length: 8 }, (_, i) => ({ no: i, label: `League phase · Matchday ${i + 1}`, ties: 18 })),
  { no: 8, label: "Play-off · 1st leg", ties: 8 },
  { no: 9, label: "Play-off · 2nd leg", ties: 8 },
  { no: 10, label: "Round of 16 · 1st leg", ties: 8 },
  { no: 11, label: "Round of 16 · 2nd leg", ties: 8 },
  { no: 12, label: "Quarter-finals · 1st leg", ties: 4 },
  { no: 13, label: "Quarter-finals · 2nd leg", ties: 4 },
  { no: 14, label: "Semi-finals · 1st leg", ties: 2 },
  { no: 15, label: "Semi-finals · 2nd leg", ties: 2 },
  { no: 16, label: "Final", ties: 1 },
] as const;

/** The knockout stages: the round of the first leg, and its name */
export const EURO_STAGES = [
  { first: 8, name: "Play-off" },
  { first: 10, name: "Round of 16" },
  { first: 12, name: "Quarter-finals" },
  { first: 14, name: "Semi-finals" },
  { first: 16, name: "Final" },
] as const;

/** In a league career round N opens after this many of your league matches. */
export const EURO_UNLOCK = [4, 8, 12, 16, 19, 22, 25, 28, 30, 31, 32, 33, 34, 35, 36, 37, 38];

export type EuroMatch = {
  id: string;
  user_id: string;
  comp_id: string;
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
};

export type EuroSetup = { comp_id: string; season: string; club_id: string; english: string[]; source: "league" | "standalone" };
export type EuroResult = SimulationResult & { pens_home: number | null; pens_away: number | null; winner: string | null };
export type PlayedEuroRound = { mine: { match: EuroMatch; result: EuroResult } | null; others: { match: EuroMatch; result: EuroResult }[] };
export type EuroRow = { clubId: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number };

export const euroRoundLabel = (no: number) => EURO_ROUNDS[no]?.label ?? "Match";
export const isLeagueRound = (no: number) => no <= 7;
const isFirstLeg = (no: number) => no >= 8 && no <= 14 && no % 2 === 0;
const isSecondLeg = (no: number) => no >= 9 && no <= 15 && no % 2 === 1;

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

/* ---------- who is in, and the league phase draw ---------- */

/** The 36 clubs, strongest first. */
export function entrantsOf(compId: string, english: string[]): string[] {
  const comp = euroComp(compId);
  const ids = [...new Set([...english, ...(comp?.foreign ?? [])])];
  return ids.sort((a, b) => getRating(b) - getRating(a) || a.localeCompare(b));
}

/**
 * The eight matchdays of the league phase: a list per matchday of [home, away].
 * Every matchday is a round of a round-robin (each club plays once), eight of the
 * 35 rounds are chosen by the draw. Home and away are then dealt so that every club has four of each.
 */
export function leaguePhase(userId: string, season: string, compId: string, english: string[]): [string, string][][] {
  const ids = entrantsOf(compId, english);
  const n = ids.length; // 36
  const random = rng(`${userId}|${season}|${compId}|league-phase`);
  const ks = Array.from({ length: n - 1 }, (_, i) => i);
  for (let i = ks.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ks[i], ks[j]] = [ks[j], ks[i]];
  }
  const picked = ks.slice(0, 8);

  const edges: { r: number; a: number; b: number }[] = [];
  picked.forEach((k, r) => {
    edges.push({ r, a: n - 1, b: k });
    for (let i = 1; i <= (n - 2) / 2; i++) edges.push({ r, a: (k + i) % (n - 1), b: (k - i + (n - 1)) % (n - 1) });
  });

  // every club has 8 matches (even): walk closed trails and play each edge in the walking direction, which gives 4 home and 4 away
  const at: number[][] = Array.from({ length: n }, () => []);
  edges.forEach((e, i) => { at[e.a].push(i); at[e.b].push(i); });
  const used = new Array(edges.length).fill(false);
  const home = new Array<number>(edges.length).fill(-1);
  for (let v = 0; v < n; v++) {
    for (;;) {
      let cur = v;
      let moved = false;
      for (;;) {
        const e = at[cur].find((i) => !used[i]);
        if (e === undefined) break;
        used[e] = true;
        home[e] = cur;
        cur = edges[e].a === cur ? edges[e].b : edges[e].a;
        moved = true;
      }
      if (!moved) break;
    }
  }

  const rounds: [string, string][][] = picked.map(() => []);
  edges.forEach((e, i) => {
    const h = home[i];
    const aw = e.a === h ? e.b : e.a;
    rounds[e.r].push([ids[h], ids[aw]]);
  });
  return rounds;
}

/** The league phase table from the played matches. */
export function leagueTable(rows: EuroMatch[], entrants: string[]): EuroRow[] {
  const table = new Map<string, EuroRow>(entrants.map((id) => [id, { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }]));
  for (const m of rows) {
    if (!isLeagueRound(m.round_no) || m.status !== "completed" || m.home_score === null || m.away_score === null) continue;
    const h = table.get(m.home_club);
    const a = table.get(m.away_club);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += m.home_score; h.ga += m.away_score;
    a.gf += m.away_score; a.ga += m.home_score;
    if (m.home_score > m.away_score) { h.won++; a.lost++; h.points += 3; }
    else if (m.home_score < m.away_score) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  return [...table.values()]
    .map((r) => ({ ...r, gd: r.gf - r.ga }))
    .sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || y.won - x.won || getRating(y.clubId) - getRating(x.clubId) || x.clubId.localeCompare(y.clubId));
}

const SEED_ORDER = [1, 8, 4, 5, 2, 7, 3, 6]; // round of 16: where each top-8 seed sits in the bracket

/** Who the next knockout stage plays, as first-leg pairs [home, away], or null while it is not decided. */
export function stagePairs(first: number, rows: EuroMatch[], entrants: string[]): [string, string][] | null {
  const leagueRows = rows.filter((m) => isLeagueRound(m.round_no));
  if (leagueRows.length < 144 || leagueRows.some((m) => m.status !== "completed")) return null;
  const table = leagueTable(leagueRows, entrants).map((r) => r.clubId);
  const place = (id: string) => table.indexOf(id);
  const win = (stageFirst: number, slot: number) => {
    const row = rows.find((m) => m.round_no === (stageFirst === 16 ? 16 : stageFirst + 1) && m.slot === slot);
    return row && row.status === "completed" ? row.winner : null;
  };
  // the better placed club plays the second leg at home
  const order = (a: string, b: string): [string, string] => (place(a) < place(b) ? [b, a] : [a, b]);

  if (first === 8) {
    return Array.from({ length: 8 }, (_, j) => [table[23 - j], table[8 + j]] as [string, string]);
  }
  if (first === 10) {
    const out: [string, string][] = [];
    for (const s of SEED_ORDER) {
      const w = win(8, 8 - s);
      if (!w) return null;
      out.push([w, table[s - 1]]);
    }
    return out;
  }
  const prevFirst = first - 2;
  const count = EURO_ROUNDS[first].ties;
  const ties: [string, string][] = [];
  for (let k = 0; k < count; k++) {
    const a = win(prevFirst, 2 * k);
    const b = win(prevFirst, 2 * k + 1);
    if (!a || !b) return null;
    ties.push(first === 16 ? [a, b] : order(a, b));
  }
  return ties;
}

/* ---------- playing a match ---------- */

const nameOf = (id: string) => allClubs.find((c) => c.id === id)?.name ?? id;

/** The manager's own club in a cup match: its squad strength, its signings and its style count, like in the league. */
function simOptions(home: string, away: string, sim?: SimContext): SimOptions {
  if (!sim?.myClub) return {};
  const mine = sim.myClub === home ? "home" : sim.myClub === away ? "away" : null;
  if (!mine) return {};
  const style = sim.style;
  const edge = style ? matchup(style, aiStyle(mine === "home" ? away : home)) : 0;
  const bonus = (sim.bonus[sim.myClub] ?? 0) + edge;
  return {
    squads: sim.squads,
    ...(mine === "home" ? { homeBonus: bonus, ...(style ? { homeStyle: style, awayStyle: aiStyle(away) } : {}) } : { awayBonus: bonus, ...(style ? { awayStyle: style, homeStyle: aiStyle(home) } : {}) }),
  };
}

export function simulateEuroMatch(userId: string, season: string, compId: string, roundNo: number, home: string, away: string, leg1?: EuroMatch | null, options: SimOptions = {}): EuroResult {
  const base = simulateFixture({ leagueKey: `${userId}:${compId}`, season, matchday: 300 + roundNo, homeClub: home, awayClub: away, ...options });
  const none = { pens_home: null, pens_away: null };
  if (isLeagueRound(roundNo)) return { ...base, ...none, winner: null };
  if (isFirstLeg(roundNo)) return { ...base, ...none, winner: null };

  let level = base.home_score === base.away_score;
  let winner: string | null = base.home_score > base.away_score ? home : away;
  let note = "";
  if (isSecondLeg(roundNo)) {
    const h = base.home_score + (leg1?.away_score ?? 0);
    const a = base.away_score + (leg1?.home_score ?? 0);
    level = h === a;
    winner = h > a ? home : away;
    note = `Level on aggregate (${h}-${a}).`;
  } else {
    note = "Level after 90 minutes.";
  }
  if (!level) return { ...base, ...none, winner };

  const random = rng(`${userId}|${season}|${compId}|${roundNo}|${home}|${away}|pens`);
  const homeWins = random() < 0.5;
  const high = 3 + Math.floor(random() * 3);
  const low = Math.max(1, high - 1 - Math.floor(random() * 2));
  winner = homeWins ? home : away;
  const events = [...base.events];
  const whistle = events.findIndex((e) => e.type === "whistle" && e.minute >= 90);
  const shootout = { minute: 90, text: `${note} ${nameOf(winner)} win ${high}-${low} on penalties.`, type: "whistle" as const };
  if (whistle >= 0) events.splice(whistle, 0, shootout);
  else events.push(shootout);
  return { ...base, events, pens_home: homeWins ? high : low, pens_away: homeWins ? low : high, winner };
}

async function saveMatch(client: SupabaseClient, m: EuroMatch, userId: string, playedAt: string, leg1: EuroMatch | null, sim?: SimContext, fixed?: { home: number; away: number }) {
  const result = simulateEuroMatch(userId, m.season, m.comp_id, m.round_no, m.home_club, m.away_club, leg1, { ...simOptions(m.home_club, m.away_club, sim), ...(fixed ? { fixed } : {}) });
  const { error } = fixed ? { error: null } : await client
    .from("euro_matches")
    .update({ home_score: result.home_score, away_score: result.away_score, pens_home: result.pens_home, pens_away: result.pens_away, winner: result.winner, status: "completed", played_at: playedAt })
    .eq("id", m.id);
  if (error) throw error;
  return {
    match: { ...m, home_score: result.home_score, away_score: result.away_score, pens_home: result.pens_home, pens_away: result.pens_away, winner: result.winner, status: "completed" as const },
    result,
  };
}

/** Plays every match of a round together, the manager's included. */
export async function playEuroRound(client: SupabaseClient, all: EuroMatch[], roundNo: number, myClub: string, userId: string, sim?: SimContext,
  /** scores the server already decided and saved (match id -> score): shown here, nothing is rolled or written */
  authority?: { scores: Map<string, { home: number; away: number }>; playedAt: string }
): Promise<PlayedEuroRound> {
  const todo = all.filter((m) => m.round_no === roundNo && m.status === "scheduled");
  const playedAt = authority?.playedAt ?? new Date().toISOString();
  const out: PlayedEuroRound = { mine: null, others: [] };
  await Promise.all(
    todo.map(async (m) => {
      const leg1 = isSecondLeg(roundNo) ? all.find((x) => x.round_no === roundNo - 1 && x.slot === m.slot) ?? null : null;
      const entry = await saveMatch(client, m, userId, playedAt, leg1, m.home_club === myClub || m.away_club === myClub ? sim : undefined, authority?.scores.get(m.id));
      if (m.home_club === myClub || m.away_club === myClub) out.mine = entry;
      else out.others.push(entry);
    })
  );
  return out;
}

/* ---------- the competition in the database ---------- */

export async function fetchEuroSetups(client: SupabaseClient, userId: string): Promise<EuroSetup[]> {
  const { data, error } = await client.from("euro_seasons").select("comp_id, season, club_id, english, source").eq("user_id", userId).order("season", { ascending: false });
  if (error) throw error;
  return (data ?? []) as EuroSetup[];
}

export async function saveEuroSetup(client: SupabaseClient, userId: string, setup: EuroSetup) {
  const { error } = await client.from("euro_seasons").upsert([{ user_id: userId, ...setup }], { onConflict: "user_id,comp_id,season", ignoreDuplicates: true });
  if (error) throw error;
}

export async function fetchEuro(client: SupabaseClient, userId: string, compId: string, season: string) {
  const { data, error } = await client
    .from("euro_matches")
    .select("*")
    .eq("user_id", userId)
    .eq("comp_id", compId)
    .eq("season", season)
    .order("round_no", { ascending: true })
    .order("slot", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as EuroMatch[]).sort((x, y) => x.round_no - y.round_no || x.slot - y.slot);
}

async function insertRound(client: SupabaseClient, userId: string, compId: string, season: string, roundNo: number, pairs: [string, string][]) {
  const rows = pairs.map(([home, away], slot) => ({ user_id: userId, comp_id: compId, season, round_no: roundNo, slot, home_club: home, away_club: away, status: "scheduled" }));
  const { error } = await client.from("euro_matches").upsert(rows, { onConflict: "user_id,comp_id,season,round_no,slot", ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * Draws the league phase the first time, creates each knockout stage once the
 * one before it is finished, and plays the rounds the manager is not part of
 * (a bye, or after being knocked out) so the competition always reaches its final.
 */
export async function settleEuro(client: SupabaseClient, userId: string, setup: EuroSetup): Promise<EuroMatch[]> {
  const { comp_id: compId, season, club_id: myClub, english } = setup;
  const entrants = entrantsOf(compId, english);
  let rows = await fetchEuro(client, userId, compId, season);

  if (rows.length === 0) {
    const phase = leaguePhase(userId, season, compId, english);
    for (let r = 0; r < phase.length; r++) await insertRound(client, userId, compId, season, r, phase[r]);
    rows = await fetchEuro(client, userId, compId, season);
  }

  for (let guard = 0; guard < 24; guard++) {
    let changed = false;

    for (const stage of EURO_STAGES) {
      if (rows.some((m) => m.round_no === stage.first)) continue;
      const ties = stagePairs(stage.first, rows, entrants);
      if (ties) {
        await insertRound(client, userId, compId, season, stage.first, ties);
        if (stage.first !== 16) await insertRound(client, userId, compId, season, stage.first + 1, ties.map(([h, a]) => [a, h] as [string, string]));
        changed = true;
      }
      break;
    }

    if (!changed) {
      const nextRound = rows.filter((m) => m.status === "scheduled").reduce<number | null>((lowest, m) => (lowest === null || m.round_no < lowest ? m.round_no : lowest), null);
      if (nextRound !== null) {
        const involved = rows.some((m) => m.round_no === nextRound && m.status === "scheduled" && (m.home_club === myClub || m.away_club === myClub));
        if (!involved) {
          await playEuroRound(client, rows, nextRound, myClub, userId);
          changed = true;
        }
      }
    }

    if (!changed) break;
    rows = await fetchEuro(client, userId, compId, season);
  }

  return rows;
}

/** Saves a win of the final for the manager's trophy cabinet (once per season). */
export async function recordEuroWin(client: SupabaseClient, userId: string, setup: EuroSetup, rows: EuroMatch[]) {
  const final = rows.find((m) => m.round_no === 16 && m.status === "completed");
  if (!final || final.winner !== setup.club_id) return;
  try {
    await client.from("trophies").upsert([{ user_id: userId, kind: "continental_cup", season: setup.season, club_id: setup.club_id, league_id: setup.comp_id }], { onConflict: "user_id,kind,season,league_id", ignoreDuplicates: true });
  } catch {
    /* the final still shows in the bracket */
  }
}

/** A two-legged tie, seen from the club that hosted the first leg. */
export type TieView = { stage: string; slot: number; a: string; b: string; l1: [number, number] | null; l2: [number, number] | null; winner: string | null; pens: [number, number] | null };

export function stageTies(rows: EuroMatch[], first: number): TieView[] {
  const stage = EURO_STAGES.find((s) => s.first === first)!;
  return rows.filter((m) => m.round_no === first).sort((x, y) => x.slot - y.slot).map((m1) => {
    const m2 = first === 16 ? null : rows.find((m) => m.round_no === first + 1 && m.slot === m1.slot) ?? null;
    const done = (m: EuroMatch | null) => !!m && m.status === "completed" && m.home_score !== null && m.away_score !== null;
    const decider = m2 ?? m1;
    const pensA = decider.pens_home === null ? null : ([decider.home_club === m1.home_club ? decider.pens_home : decider.pens_away ?? 0, decider.home_club === m1.home_club ? decider.pens_away ?? 0 : decider.pens_home] as [number, number]);
    return {
      stage: stage.name,
      slot: m1.slot,
      a: m1.home_club,
      b: m1.away_club,
      l1: done(m1) ? [m1.home_score!, m1.away_score!] : null,
      l2: m2 && done(m2) ? [m2.away_score!, m2.home_score!] : null,
      winner: decider.status === "completed" ? decider.winner : null,
      pens: pensA,
    };
  });
}

/** Where the manager stands. */
export function euroStatus(rows: EuroMatch[], myClub: string, entrants: string[]) {
  const mine = rows.filter((m) => m.home_club === myClub || m.away_club === myClub);
  const next = mine.find((m) => m.status === "scheduled") ?? null;
  const last = [...mine].reverse().find((m) => m.status === "completed") ?? null;
  const final = rows.find((m) => m.round_no === 16 && m.status === "completed");
  const champion = !!final && final.winner === myClub;
  const table = leagueTable(rows, entrants);
  const phaseDone = rows.filter((m) => isLeagueRound(m.round_no)).length === 144 && rows.filter((m) => isLeagueRound(m.round_no)).every((m) => m.status === "completed");
  const position = table.findIndex((r) => r.clubId === myClub) + 1;
  const outInLeague = phaseDone && position > 24;
  const outInKnockout = !!last && !isLeagueRound(last.round_no) && last.winner !== myClub && !next && (isSecondLeg(last.round_no) || last.round_no === 16);
  const eliminated = outInLeague || outInKnockout;
  return { next, last, final, champion, eliminated, outInLeague, table, position, phaseDone };
}

/** How many league matches your club has played in a season. */
export async function euroLeagueProgress(client: SupabaseClient, userId: string, leagueId: string, season: string, clubId: string): Promise<number> {
  const { data } = await client.from("league_matches").select("home_club, away_club, status").eq("user_id", userId).eq("league_id", leagueId).eq("season", season);
  return (data ?? []).filter((m: { home_club: string; away_club: string; status: string }) => m.status === "completed" && (m.home_club === clubId || m.away_club === clubId)).length;
}

/** Which competition a final Premier League position leads to, if any. */
export function compForPosition(position: number): EuroComp | null {
  return EURO_COMPS.find((c) => c.english.includes(position)) ?? null;
}

/**
 * Looks at every finished Premier League season of the manager. 1st-4th opens
 * the Champions League and 5th-6th the Europa League in the NEXT season; the
 * English places are taken from that final table. Returns every entry of the
 * manager's club (new ones are saved), newest season first.
 */
export async function qualifyFromEngland(client: SupabaseClient, userId: string, clubId: string, leagueId: string): Promise<EuroSetup[]> {
  const { data } = await client
    .from("league_matches")
    .select("home_club, away_club, home_score, away_score, status, season, matchday, id")
    .eq("user_id", userId)
    .eq("league_id", leagueId);
  const bySeason = new Map<string, Match[]>();
  for (const m of (data ?? []) as (Match & { season: string })[]) {
    const list = bySeason.get(m.season) ?? [];
    list.push(m);
    bySeason.set(m.season, list);
  }

  const found: EuroSetup[] = [];
  for (const [season, ms] of bySeason) {
    if (!ms.length || ms.some((m) => m.status !== "completed")) continue;
    const table = calculateStandings(ms, leagueId);
    const position = table.findIndex((r) => r.clubId === clubId) + 1;
    const comp = position ? compForPosition(position) : null;
    if (!comp) continue;
    const english = comp.english.map((p) => table[p - 1]?.clubId).filter(Boolean) as string[];
    found.push({ comp_id: comp.id, season: nextSeason(season), club_id: clubId, english, source: "league" });
  }

  for (const setup of found) {
    const { data: have } = await client.from("euro_seasons").select("comp_id").eq("user_id", userId).eq("comp_id", setup.comp_id).eq("season", setup.season).limit(1);
    if (!have?.length) {
      try {
        await saveEuroSetup(client, userId, setup);
      } catch {
        /* run supabase/026_europe.sql; the entry shows again next visit */
      }
    }
  }

  const { data: stored } = await client.from("euro_seasons").select("comp_id, season, club_id, english, source").eq("user_id", userId).eq("club_id", clubId).order("season", { ascending: false });
  return (stored ?? []) as EuroSetup[];
}
