/**
 * Squad strength in the match result.
 *
 * Every club has a base rating. A manager who changes the squad (signs a star,
 * sells the best players) or picks a weaker eleven moves their club's rating up
 * or down for the matches that club plays. The effect is limited so one signing
 * cannot decide a season.
 *
 * In a shared league each manager's strength is stored with their seat, and the
 * first manager to play a match saves its score, so everybody sees the same one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { bestEleven, squadOf, formations, type FormationName, type Player } from "@/lib/football/squads";
import { availableSquad } from "@/lib/football/availability";
import { loadFitness, tired } from "@/lib/football/fitness";
import { readTactic, tacticBonus, type StyleId } from "@/lib/football/tactics";
import { loadTransferState, type Squads } from "@/lib/football/transfers";
import { squadsAt } from "@/lib/football/stats";

export type SimContext = {
  /** rating points added to a club for its matches, by club id */
  bonus: Record<string, number>;
  /** the shared league, when there is one */
  roomId?: string | null;
  /** squads of that day, to pick the scorers from */
  squads?: Squads;
  /** the style my club plays, for the match-up against the opponent */
  style?: StyleId;
  myClub?: string;
  /** how fresh each of my players is */
  fitness?: Record<string, number>;
};

export const MAX_BONUS = 10;
const SCALE = 2.5;

export type DayCtx = { key: string; season: string; matchday: number; /** fitness of the players, 45-100 */ fit?: Record<string, number> };

/** The formation and eleven for the next match: the saved lineup, with injured or banned players replaced. */
export function currentLineup(userId: string, clubId: string, squad: Player[], day?: DayCtx): { formation: FormationName; starters: Player[] } {
  const pool = day ? availableSquad(squad, day.key, day.season, day.matchday) : squad;
  const ok = new Set(pool.map((p) => p.id));
  try {
    const saved = JSON.parse(localStorage.getItem(`gsm-lineup:${userId}:${clubId}`) ?? "null");
    if (saved && saved.formation in formations && Array.isArray(saved.starters) && saved.starters.length === 11) {
      const byId = new Map(squad.map((p) => [p.id, p]));
      const eleven = saved.starters.map((id: string) => byId.get(id)).filter(Boolean) as Player[];
      if (eleven.length === 11) {
        const used = new Set(eleven.filter((p) => ok.has(p.id)).map((p) => p.id));
        const fitted = eleven.map((p) => {
          if (ok.has(p.id)) return p;
          const sub = pool.filter((x) => x.position === p.position && !used.has(x.id)).sort((a, b) => b.rating - a.rating)[0];
          if (sub) used.add(sub.id);
          return sub ?? p;
        });
        return { formation: saved.formation as FormationName, starters: fitted };
      }
    }
  } catch {
    /* the best eleven is fine */
  }
  return { formation: "4-3-3", starters: bestEleven(pool, "4-3-3") };
}

/** Rating points for this club, from today's squad and lineup compared with the club's starting squad. */
export function strengthBonus(userId: string, clubId: string, squad: Player[], day?: DayCtx): number {
  const { starters: eleven, formation } = currentLineup(userId, clubId, squad, day);
  return Math.round((bonusFor(eleven, clubId, day?.fit) + tacticBonus(readTactic(userId, clubId), eleven, formation)) * 10) / 10;
}

/** Rating points for playing this eleven instead of the club's starting eleven. */
export function bonusFor(eleven: Player[], clubId: string, fit?: Record<string, number>): number {
  const start = bestEleven(squadOf(clubId), "4-3-3");
  if (!eleven.length || !start.length) return 0;
  const base = start.reduce((sum, p) => sum + p.rating, 0) / start.length;
  const now = eleven.reduce((sum, p) => sum + tired(p, fit).rating, 0) / eleven.length;
  const raw = (now - base) * SCALE;
  return Math.max(-MAX_BONUS, Math.min(MAX_BONUS, Math.round(raw * 10) / 10));
}

/** A call that never answers must not freeze the match centre. */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Everything a match needs to know about squad strength. Never throws: the base ratings are the fallback. */
export async function loadSim(
  client: SupabaseClient,
  opts: { userId: string; clubId: string; roomId?: string | null; season: string; matchday: number | null; leagueId?: string | null }
): Promise<SimContext> {
  const bonus: Record<string, number> = {};
  let squads: Squads | undefined;
  let fitness: Record<string, number> = {};
  try {
    const state = await withTimeout(loadTransferState(client, opts.userId, opts.clubId, opts.season, opts.matchday, opts.leagueId ?? undefined), 8000);
    if (opts.matchday !== null) squads = squadsAt(state.deals, opts.season, opts.matchday, state.training, { club: opts.clubId, renewals: state.renewals });
    const mySquad = state.squads[opts.clubId] ?? [];
    if (opts.matchday !== null) fitness = await withTimeout(loadFitness(client, opts.userId, opts.season, opts.matchday, state.training, mySquad), 6000).catch(() => ({}));
    const day = opts.matchday !== null ? { key: opts.roomId ?? opts.userId, season: opts.season, matchday: opts.matchday, fit: fitness } : undefined;
    bonus[opts.clubId] = strengthBonus(opts.userId, opts.clubId, state.squads[opts.clubId] ?? [], day);
  } catch {
    bonus[opts.clubId] = 0;
  }

  if (opts.roomId) {
    try {
      await withTimeout(Promise.resolve(client.from("room_members").update({ strength: bonus[opts.clubId] }).eq("room_id", opts.roomId).eq("user_id", opts.userId)), 6000);
      const { data } = await withTimeout(Promise.resolve(client.from("room_members").select("club_id, strength").eq("room_id", opts.roomId)), 6000);
      for (const m of (data ?? []) as { club_id: string; strength: number | null }[]) {
        if (m.club_id !== opts.clubId) bonus[m.club_id] = Number(m.strength ?? 0);
      }
    } catch {
      /* the other managers play at base strength */
    }
  }
  return { bonus, roomId: opts.roomId ?? null, squads, style: readTactic(opts.userId, opts.clubId)?.style, myClub: opts.clubId, fitness };
}

/* ---------- shared results ---------- */

export type Score = { home: number; away: number };
const pair = (home: string, away: string) => `${home}|${away}`;

export async function sharedScores(client: SupabaseClient, roomId: string, season: string, matchday: number) {
  const out = new Map<string, Score>();
  const { data } = await client
    .from("room_results")
    .select("home_club, away_club, home_score, away_score")
    .eq("room_id", roomId)
    .eq("season", season)
    .eq("matchday", matchday);
  for (const r of (data ?? []) as { home_club: string; away_club: string; home_score: number; away_score: number }[]) {
    out.set(pair(r.home_club, r.away_club), { home: r.home_score, away: r.away_score });
  }
  return out;
}

export async function shareScores(
  client: SupabaseClient,
  roomId: string,
  season: string,
  matchday: number,
  rows: { home: string; away: string; hs: number; as: number }[]
) {
  if (!rows.length) return;
  await client.from("room_results").upsert(
    rows.map((r) => ({ room_id: roomId, season, matchday, home_club: r.home, away_club: r.away, home_score: r.hs, away_score: r.as })),
    { onConflict: "room_id,season,matchday,home_club,away_club", ignoreDuplicates: true }
  );
}

export const scoreKey = pair;
