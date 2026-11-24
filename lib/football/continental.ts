/**
 * The CAF Champions League and the CAF Confederation Cup.
 *
 * 16 clubs: 14 African clubs (lib/football/africa) and 2 Egyptian clubs. In a
 * career in the Egyptian league the two Egyptian clubs come from the final
 * table (1st-2nd for the Champions League, 3rd-4th for the Confederation
 * Cup). In a stand-alone career the manager picks them.
 *
 * Format: four groups of four (home and away, six matchdays), the top two of
 * each group go to the quarter-finals, then semi-finals and the final. One
 * match per knockout tie, penalties if level. Everything is seeded, so the
 * same draw and the same scores come out for the same user and season.
 * Rounds 0-5 are the group matchdays, 6 quarter-finals, 7 semi-finals, 8 final.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { allClubs } from "@/lib/football/leagueClubs";
import { CAF_CUPS, EGYPT_LEAGUE, type CafCup } from "@/lib/football/africa";
import { getRating, simulateFixture, type SimOptions, type SimulationResult } from "@/lib/football/matchSim";
import { matchup, aiStyle } from "@/lib/football/tactics";
import type { SimContext } from "@/lib/football/strength";
import { nextSeason } from "@/lib/football/season";
import { calculateStandings, type Match } from "@/lib/football/table";

export const CONT_ROUNDS = [
  { no: 0, label: "Group stage · Matchday 1", ties: 8 },
  { no: 1, label: "Group stage · Matchday 2", ties: 8 },
  { no: 2, label: "Group stage · Matchday 3", ties: 8 },
  { no: 3, label: "Group stage · Matchday 4", ties: 8 },
  { no: 4, label: "Group stage · Matchday 5", ties: 8 },
  { no: 5, label: "Group stage · Matchday 6", ties: 8 },
  { no: 6, label: "Quarter-finals", ties: 4 },
  { no: 7, label: "Semi-finals", ties: 2 },
  { no: 8, label: "Final", ties: 1 },
] as const;

export const GROUP_NAMES = ["A", "B", "C", "D"];

export type ContMatch = {
  id: string;
  user_id: string;
  comp_id: string;
  season: string;
  round_no: number;
  slot: number;
  group_no: number | null;
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  pens_home: number | null;
  pens_away: number | null;
  winner: string | null;
  status: "scheduled" | "completed";
};

export type ContSetup = { comp_id: string; season: string; club_id: string; egypt: string[]; source: "standalone" | "league" };
export type ContResult = SimulationResult & { pens_home: number | null; pens_away: number | null; winner: string | null };
export type PlayedContRound = { mine: { match: ContMatch; result: ContResult } | null; others: { match: ContMatch; result: ContResult }[] };

export type GroupRow = { clubId: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number };

export const cafCup = (id: string): CafCup | undefined => CAF_CUPS.find((c) => c.id === id);
export const roundLabel = (no: number) => CONT_ROUNDS[no]?.label ?? "Match";
export const isGroupRound = (no: number) => no <= 5;

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

/* ---------- who is in, and the draw ---------- */

export function entrantsOf(compId: string, egypt: string[]): string[] {
  const cup = cafCup(compId);
  return [...egypt, ...(cup?.clubs.map((c) => c.id) ?? [])];
}

/** Four pots by strength, one club from each pot in every group. */
export function drawGroups(userId: string, season: string, compId: string, egypt: string[]): string[][] {
  const ids = entrantsOf(compId, egypt).sort((a, b) => getRating(b) - getRating(a) || a.localeCompare(b));
  const random = rng(`${userId}|${season}|${compId}|group-draw`);
  const groups: string[][] = [[], [], [], []];
  for (let pot = 0; pot < 4; pot++) {
    const part = ids.slice(pot * 4, pot * 4 + 4);
    for (let i = part.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [part[i], part[j]] = [part[j], part[i]];
    }
    part.forEach((id, g) => groups[g].push(id));
  }
  return groups;
}

/** The two matches of one group on one matchday (0-5). Matchdays 4-6 repeat 1-3 with home and away swapped. */
export function groupPairs(group: string[], roundNo: number): [string, string][] {
  const [a, b, c, d] = group;
  const base: [string, string][][] = [
    [[a, d], [b, c]],
    [[a, c], [d, b]],
    [[a, b], [c, d]],
  ];
  return base[roundNo % 3].map(([h, x]) => (roundNo >= 3 ? [x, h] : [h, x]) as [string, string]);
}

/** Group tables from the played group matches. */
export function groupTables(rows: ContMatch[], groups: string[][]): GroupRow[][] {
  return groups.map((ids, g) => {
    const table = new Map<string, GroupRow>(ids.map((id) => [id, { clubId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }]));
    for (const m of rows) {
      if (m.group_no !== g || m.status !== "completed" || m.home_score === null || m.away_score === null) continue;
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
      .sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || getRating(y.clubId) - getRating(x.clubId) || x.clubId.localeCompare(y.clubId));
  });
}

/** Who plays whom in a knockout round, or null while what it needs is unfinished. */
export function knockoutPairs(roundNo: number, rows: ContMatch[], groups: string[][]): [string, string][] | null {
  if (roundNo === 6) {
    const groupRows = rows.filter((m) => isGroupRound(m.round_no));
    if (groupRows.length < 24 || groupRows.some((m) => m.status !== "completed")) return null;
    const t = groupTables(groupRows, groups);
    return [[t[0][0].clubId, t[1][1].clubId], [t[1][0].clubId, t[0][1].clubId], [t[2][0].clubId, t[3][1].clubId], [t[3][0].clubId, t[2][1].clubId]];
  }
  const prev = rows.filter((m) => m.round_no === roundNo - 1).sort((a, b) => a.slot - b.slot);
  if (prev.length !== CONT_ROUNDS[roundNo - 1].ties || prev.some((m) => m.status !== "completed" || !m.winner)) return null;
  const ties: [string, string][] = [];
  for (let k = 0; k < CONT_ROUNDS[roundNo].ties; k++) ties.push([prev[2 * k].winner!, prev[2 * k + 1].winner!]);
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

export function simulateContMatch(userId: string, season: string, compId: string, roundNo: number, home: string, away: string, options: SimOptions = {}): ContResult {
  const base = simulateFixture({ leagueKey: `${userId}:${compId}`, season, matchday: 200 + roundNo, homeClub: home, awayClub: away, ...options });
  if (isGroupRound(roundNo)) return { ...base, pens_home: null, pens_away: null, winner: base.home_score === base.away_score ? null : base.home_score > base.away_score ? home : away };

  if (base.home_score !== base.away_score) {
    return { ...base, pens_home: null, pens_away: null, winner: base.home_score > base.away_score ? home : away };
  }

  // level after 90 minutes: a shoot-out
  const random = rng(`${userId}|${season}|${compId}|${roundNo}|${home}|${away}|pens`);
  const homeWins = random() < 0.5;
  const high = 3 + Math.floor(random() * 3);
  const low = Math.max(1, high - 1 - Math.floor(random() * 2));
  const winner = homeWins ? home : away;
  const events = [...base.events];
  const whistle = events.findIndex((e) => e.type === "whistle" && e.minute >= 90);
  const shootout = { minute: 90, text: `Level after 90 minutes. ${nameOf(winner)} win ${high}-${low} on penalties.`, type: "whistle" as const };
  if (whistle >= 0) events.splice(whistle, 0, shootout);
  else events.push(shootout);
  return { ...base, events, pens_home: homeWins ? high : low, pens_away: homeWins ? low : high, winner };
}

async function saveMatch(client: SupabaseClient, m: ContMatch, userId: string, playedAt: string, sim?: SimContext, fixed?: { home: number; away: number }) {
  const result = simulateContMatch(userId, m.season, m.comp_id, m.round_no, m.home_club, m.away_club, { ...simOptions(m.home_club, m.away_club, sim), ...(fixed ? { fixed } : {}) });
  const { error } = fixed ? { error: null } : await client
    .from("continental_matches")
    .update({ home_score: result.home_score, away_score: result.away_score, pens_home: result.pens_home, pens_away: result.pens_away, winner: result.winner, status: "completed", played_at: playedAt })
    .eq("id", m.id);
  if (error) throw error;
  return {
    match: { ...m, home_score: result.home_score, away_score: result.away_score, pens_home: result.pens_home, pens_away: result.pens_away, winner: result.winner, status: "completed" as const },
    result,
  };
}

/** Plays every match of a round together, the manager's included. */
export async function playContRound(client: SupabaseClient, all: ContMatch[], roundNo: number, myClub: string, userId: string, sim?: SimContext,
  /** scores the server already decided and saved (match id -> score): shown here, nothing is rolled or written */
  authority?: { scores: Map<string, { home: number; away: number }>; playedAt: string }
): Promise<PlayedContRound> {
  const todo = all.filter((m) => m.round_no === roundNo && m.status === "scheduled");
  const playedAt = authority?.playedAt ?? new Date().toISOString();
  const out: PlayedContRound = { mine: null, others: [] };
  await Promise.all(
    todo.map(async (m) => {
      const entry = await saveMatch(client, m, userId, playedAt, m.home_club === myClub || m.away_club === myClub ? sim : undefined, authority?.scores.get(m.id));
      if (m.home_club === myClub || m.away_club === myClub) out.mine = entry;
      else out.others.push(entry);
    })
  );
  return out;
}

/* ---------- the competition in the database ---------- */

export async function fetchContSetup(client: SupabaseClient, userId: string, compId: string, season?: string): Promise<ContSetup | null> {
  let q = client.from("continental_seasons").select("comp_id, season, club_id, egypt, source").eq("user_id", userId).eq("comp_id", compId);
  if (season) q = q.eq("season", season);
  const { data, error } = await q.order("season", { ascending: false }).limit(1);
  if (error) throw error;
  return (data?.[0] as ContSetup | undefined) ?? null;
}

export async function saveContSetup(client: SupabaseClient, userId: string, setup: ContSetup) {
  const { error } = await client.from("continental_seasons").upsert([{ user_id: userId, ...setup }], { onConflict: "user_id,comp_id,season", ignoreDuplicates: false });
  if (error) throw error;
}

export async function fetchCont(client: SupabaseClient, userId: string, compId: string, season: string) {
  const { data, error } = await client
    .from("continental_matches")
    .select("*")
    .eq("user_id", userId)
    .eq("comp_id", compId)
    .eq("season", season)
    .order("round_no", { ascending: true })
    .order("slot", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ContMatch[];
}

async function insertRound(client: SupabaseClient, userId: string, compId: string, season: string, roundNo: number, pairs: { home: string; away: string; group: number | null }[]) {
  const rows = pairs.map((p, slot) => ({ user_id: userId, comp_id: compId, season, round_no: roundNo, slot, group_no: p.group, home_club: p.home, away_club: p.away, status: "scheduled" }));
  const { error } = await client.from("continental_matches").upsert(rows, { onConflict: "user_id,comp_id,season,round_no,slot", ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * Draws the groups the first time, creates each knockout round once the round
 * before it is finished, and plays rounds the manager is not part of (after
 * being knocked out) so the competition always reaches its final.
 */
export async function settleCont(client: SupabaseClient, userId: string, setup: ContSetup): Promise<ContMatch[]> {
  const { comp_id: compId, season, club_id: myClub, egypt } = setup;
  const groups = drawGroups(userId, season, compId, egypt);
  let rows = await fetchCont(client, userId, compId, season);

  if (rows.length === 0) {
    for (let r = 0; r <= 5; r++) {
      const pairs = groups.flatMap((g, gi) => groupPairs(g, r).map(([home, away]) => ({ home, away, group: gi })));
      await insertRound(client, userId, compId, season, r, pairs);
    }
    rows = await fetchCont(client, userId, compId, season);
  }

  for (let guard = 0; guard < 12; guard++) {
    let changed = false;

    for (const round of [6, 7, 8]) {
      if (rows.some((m) => m.round_no === round)) continue;
      const ties = knockoutPairs(round, rows, groups);
      if (ties) {
        await insertRound(client, userId, compId, season, round, ties.map(([home, away]) => ({ home, away, group: null })));
        changed = true;
      }
      break;
    }

    if (!changed) {
      const nextRound = rows.filter((m) => m.status === "scheduled").reduce<number | null>((lowest, m) => (lowest === null || m.round_no < lowest ? m.round_no : lowest), null);
      if (nextRound !== null) {
        const involved = rows.some((m) => m.round_no === nextRound && m.status === "scheduled" && (m.home_club === myClub || m.away_club === myClub));
        if (!involved) {
          await playContRound(client, rows, nextRound, myClub, userId);
          changed = true;
        }
      }
    }

    if (!changed) break;
    rows = await fetchCont(client, userId, compId, season);
  }

  return rows;
}

/** Saves a win of the final for the manager's trophy cabinet (once per season). */
export async function recordContWin(client: SupabaseClient, userId: string, setup: ContSetup, rows: ContMatch[]) {
  const final = rows.find((m) => m.round_no === 8 && m.status === "completed");
  if (!final || final.winner !== setup.club_id) return;
  try {
    await client.from("trophies").upsert([{ user_id: userId, kind: "continental_cup", season: setup.season, club_id: setup.club_id, league_id: setup.comp_id }], { onConflict: "user_id,kind,season,league_id", ignoreDuplicates: true });
  } catch {
    /* the final still shows in the bracket */
  }
}

/** Where the manager stands. */
export function contStatus(rows: ContMatch[], myClub: string, groups: string[][]) {
  const mine = rows.filter((m) => m.home_club === myClub || m.away_club === myClub);
  const next = mine.find((m) => m.status === "scheduled") ?? null;
  const last = [...mine].reverse().find((m) => m.status === "completed") ?? null;
  const final = rows.find((m) => m.round_no === 8 && m.status === "completed");
  const champion = !!final && final.winner === myClub;
  const groupDone = rows.filter((m) => isGroupRound(m.round_no)).length === 48 && rows.filter((m) => isGroupRound(m.round_no)).every((m) => m.status === "completed");
  const tables = groupTables(rows.filter((m) => isGroupRound(m.round_no)), groups);
  const myGroup = groups.findIndex((g) => g.includes(myClub));
  const outInGroup = groupDone && myGroup >= 0 && !tables[myGroup].slice(0, 2).some((r) => r.clubId === myClub);
  const outInKnockout = !!last && !isGroupRound(last.round_no) && last.winner !== myClub && !next;
  const eliminated = outInGroup || outInKnockout;
  return { next, last, final, champion, eliminated, outInGroup, tables, myGroup };
}

/** The Egyptian clubs of a cup, read from a final league table (best first). */
export function egyptFromTable(compId: string, table: { clubId: string }[]): string[] {
  const cup = cafCup(compId);
  return (cup?.egypt ?? []).map((pos) => table[pos - 1]?.clubId).filter(Boolean) as string[];
}

/** Which cup a final league position leads to, if any. */
export function cupForPosition(position: number): string | null {
  return CAF_CUPS.find((c) => c.egypt.includes(position))?.id ?? null;
}

/** In a league career the cup rounds are tied to the league calendar: round N opens after this many of your league matches. */
export const CONT_UNLOCK = [3, 7, 11, 15, 19, 23, 27, 31, 36];

/** How many league matches your club has played in a season of the Egyptian league. */
export async function leagueProgress(client: SupabaseClient, userId: string, season: string, clubId: string): Promise<number> {
  const { data } = await client
    .from("league_matches")
    .select("home_club, away_club, status")
    .eq("user_id", userId)
    .eq("league_id", EGYPT_LEAGUE)
    .eq("season", season);
  return (data ?? []).filter((m: { home_club: string; away_club: string; status: string }) => m.status === "completed" && (m.home_club === clubId || m.away_club === clubId)).length;
}

/**
 * Looks at every finished Egyptian league season of the manager. Finishing 1st
 * to 4th opens a continental competition in the NEXT season (1st-2nd the
 * Champions League, 3rd-4th the Confederation Cup), with the two Egyptian
 * places taken from that final table. Returns every league-qualified entry
 * (new ones are saved), newest season first.
 */
export async function qualifyFromLeague(client: SupabaseClient, userId: string, clubId: string): Promise<ContSetup[]> {
  const { data } = await client
    .from("league_matches")
    .select("home_club, away_club, home_score, away_score, status, season, matchday, id")
    .eq("user_id", userId)
    .eq("league_id", EGYPT_LEAGUE);
  const bySeason = new Map<string, Match[]>();
  for (const m of (data ?? []) as (Match & { season: string })[]) {
    const list = bySeason.get(m.season) ?? [];
    list.push(m);
    bySeason.set(m.season, list);
  }

  const found: ContSetup[] = [];
  for (const [season, ms] of bySeason) {
    if (!ms.length || ms.some((m) => m.status !== "completed")) continue;
    const table = calculateStandings(ms, EGYPT_LEAGUE);
    const position = table.findIndex((r) => r.clubId === clubId) + 1;
    const compId = position ? cupForPosition(position) : null;
    if (!compId) continue;
    found.push({ comp_id: compId, season: nextSeason(season), club_id: clubId, egypt: egyptFromTable(compId, table), source: "league" });
  }

  for (const setup of found) {
    const { data: have } = await client.from("continental_seasons").select("comp_id").eq("user_id", userId).eq("comp_id", setup.comp_id).eq("season", setup.season).limit(1);
    if (!have?.length) {
      try {
        await saveContSetup(client, userId, setup);
      } catch {
        /* run supabase/014_continental.sql; the entry shows again next visit */
      }
    }
  }

  const { data: stored } = await client.from("continental_seasons").select("comp_id, season, club_id, egypt, source").eq("user_id", userId).eq("source", "league").order("season", { ascending: false });
  return (stored ?? []) as ContSetup[];
}

export { EGYPT_LEAGUE };
