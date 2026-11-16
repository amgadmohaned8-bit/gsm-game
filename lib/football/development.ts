/**
 * Player development.
 *
 * Every new season players get a year older: the young improve, the players
 * past thirty lose a little. On top of that a manager can train three players
 * a week. Training helps the young most and the old only a little, and a
 * player cannot gain more than a cap per season.
 *
 * Nothing is stored for ageing: it is worked out from the season, so every
 * manager of a shared league sees the same ratings.
 */

import type { Player } from "@/lib/football/squads";

export const FIRST_YEAR = 2026;
export const SLOTS = 3;
/** a session of up to three players takes this long to finish; the gains count once it is done */
export const TRAIN_HOURS = 8;
export const TRAIN_MS = TRAIN_HOURS * 3600_000;
export const MAX_RATING = 99;

export type TrainingRow = { season: string; matchday: number; player_id: string; gain: number; created_at?: string; league_id?: string | null };

/** When this session finishes (null for old rows without a time: they are done). */
export function finishesAt(r: TrainingRow): number | null {
  if (!r.created_at) return null;
  const t = Date.parse(r.created_at);
  return Number.isFinite(t) ? t + TRAIN_MS : null;
}

export function startYear(season: string) {
  const y = parseInt(season.split("-")[0], 10);
  return Number.isFinite(y) ? y : FIRST_YEAR;
}

function unit(text: string) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^= h >>> 16) >>> 0) / 4294967296;
}

/** Expected change in one year for a player of this age. */
function yearly(age: number) {
  if (age <= 19) return 3.2;
  if (age <= 21) return 2.4;
  if (age <= 23) return 1.4;
  if (age <= 25) return 0.5;
  if (age <= 28) return 0;
  if (age <= 30) return -0.8;
  if (age <= 32) return -1.8;
  if (age <= 34) return -2.6;
  return -3.4;
}

/** Where a player's career points: rising, in his prime or declining. */
export function phase(age: number): "rising" | "prime" | "declining" {
  return age <= 23 ? "rising" : age <= 29 ? "prime" : "declining";
}

/**
 * Rating gained by one training session.
 * Age 24 and under: 1 session = +1 rating.
 * Age 25 to 29: 2 sessions = +1 rating.
 * Age 30 and over: 2.5 sessions = +1 rating.
 */
export function sessionGain(age: number) {
  if (age <= 24) return 1;
  if (age <= 29) return 0.5;
  return 0.4;
}

/** Most a player can gain from training in one season. High on purpose: the real limit is rating 99. */
export function seasonCap(_age: number) {
  return 40;
}

/** How far a player is towards his next rating point (0 to 1), from his training total. */
export function progressOf(total: number) {
  const t = Math.max(0, total) + 1e-6;
  return Math.min(0.999, t - Math.floor(t));
}

/** Total training gain per player, counting rows up to that matchday of that season. */
export function gainsAt(rows: TrainingRow[], season: string, matchday: number, players?: Player[]) {
  const ageOf = new Map((players ?? []).map((p) => [p.id, p.age]));
  const perSeason = new Map<string, number>();
  const now = Date.now();
  for (const r of rows) {
    const end = finishesAt(r);
    if (end !== null && end > now) continue; // still training: no gain yet
    const earlier = r.season < season;
    if (!earlier && !(r.season === season && r.matchday <= matchday)) continue;
    const k = `${r.season}|${r.player_id}`;
    perSeason.set(k, (perSeason.get(k) ?? 0) + Number(r.gain));
  }
  const out: Record<string, number> = {};
  for (const [k, v] of perSeason) {
    const id = k.slice(k.indexOf("|") + 1);
    // a high coach level raises the cap; the training page keeps lower levels under it
    out[id] = (out[id] ?? 0) + Math.min(v, seasonCap(ageOf.get(id) ?? 24) * 1.4);
  }
  return out;
}

/** The player as he is in that season, with his training gains. */
export function evolve(p: Player, season: string, gain = 0): Player {
  const years = season ? Math.max(0, startYear(season) - FIRST_YEAR) : 0;
  let rating = p.rating;
  for (let y = 0; y < years; y++) {
    const age = p.age + y;
    const noise = (unit(`${p.id}|${FIRST_YEAR + y}|dev`) - 0.5) * 2; // -1 .. 1
    rating += Math.round(yearly(age) + noise * 1.1);
  }
  // a point is added only when the training adds up to a whole one (the green bar fills)
  rating = Math.max(45, Math.min(MAX_RATING, Math.floor(rating + gain + 1e-6)));
  if (rating === p.rating && years === 0) return p;
  return { ...p, age: p.age + years, rating };
}
