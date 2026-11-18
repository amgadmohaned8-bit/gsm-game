/**
 * Fitness. A player who starts every match gets tired, one who rests
 * a single match is back to 100%, and a training session takes a little out of him too. A tired
 * player plays below his rating. The lineups that were played are saved, so
 * fitness is worked out from them and the same for every visit.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Player } from "@/lib/football/squads";
import type { TrainingRow } from "@/lib/football/development";

export const FIT_MIN = 45;
export const TIRED_BELOW = 70;

export type LineupRow = { matchday: number; starters: string[] };

/** Points a player loses from his rating when he is not fresh. */
export function fatiguePenalty(fit: number) {
  return fit >= 85 ? 0 : Math.round((85 - fit) * 0.12 * 10) / 10;
}

/** The player as he plays today. */
export function tired(p: Player, fit?: Record<string, number>): Player {
  const pen = fatiguePenalty(fit?.[p.id] ?? 100);
  return pen ? { ...p, rating: p.rating - pen } : p;
}

/** Fitness, 45-100, of every player who played or trained before this matchday. */
export function fitnessAt(rows: LineupRow[], training: TrainingRow[], season: string, matchday: number, squad: Player[]) {
  const age = new Map(squad.map((p) => [p.id, p.age]));
  const byDay = new Map(rows.map((r) => [r.matchday, new Set(r.starters)]));
  const trained = new Map<number, Set<string>>();
  for (const t of training) if (t.season === season) (trained.get(t.matchday) ?? trained.set(t.matchday, new Set()).get(t.matchday)!).add(t.player_id);

  const seen = new Set<string>();
  for (const r of rows) r.starters.forEach((id) => seen.add(id));
  for (const t of training) if (t.season === season) seen.add(t.player_id);

  const out: Record<string, number> = {};
  for (const id of seen) {
    const factor = 1 + Math.max(0, (age.get(id) ?? 26) - 27) * 0.04;
    let f = 100;
    for (let md = 1; md < matchday; md++) {
      if (byDay.get(md)?.has(id)) {
        f -= 13 * factor;
        if (trained.get(md)?.has(id)) f -= 3;
      } else {
        f = 100; // one match on the bench or out of the squad and he is fresh again
      }
      f = Math.max(FIT_MIN, Math.min(100, f));
    }
    out[id] = Math.round(f);
  }
  return out;
}

export async function loadFitness(client: SupabaseClient, userId: string, season: string, matchday: number, training: TrainingRow[], squad: Player[]) {
  try {
    const { data } = await client.from("match_lineups").select("matchday, starters").eq("user_id", userId).eq("season", season);
    return fitnessAt((data ?? []) as LineupRow[], training, season, matchday, squad);
  } catch {
    return {};
  }
}

export async function saveLineup(client: SupabaseClient, userId: string, season: string, matchday: number, clubId: string, starters: string[]) {
  try {
    await client.from("match_lineups").upsert({ user_id: userId, season, matchday, club_id: clubId, starters }, { onConflict: "user_id,season,matchday" });
  } catch {
    /* the player simply counts as rested */
  }
}
