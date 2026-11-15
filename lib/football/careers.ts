/**
 * Careers: a manager can run more than one league at the same time, one club
 * in each. The active career lives in manager_contracts (so the rest of the
 * game does not change); every career, active or not, is also saved in
 * manager_careers so it can be switched back to later.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type Career = { league_id: string; club_id: string; room_id: string | null; appointed_at: string | null };
type Active = { selected_league: string | null; selected_club: string | null; room_id?: string | null; club_appointed_at?: string | null };

export async function loadCareers(client: SupabaseClient, userId: string): Promise<Career[]> {
  try {
    const { data } = await client.from("manager_careers").select("league_id, club_id, room_id, appointed_at").eq("user_id", userId).order("appointed_at", { ascending: true });
    return (data ?? []) as Career[];
  } catch {
    return [];
  }
}

/**
 * Makes sure the active career is saved. A friends room belongs to one league:
 * if the contract still points at a room that another career holds, the manager
 * has just started a new league, so the new career starts without a room.
 */
export async function syncCareers(client: SupabaseClient, userId: string, active: Active): Promise<Career[]> {
  const league = active.selected_league || "premier-league";
  const club = active.selected_club;
  const rows = await loadCareers(client, userId);
  if (!club) return rows;

  try {
    const here = rows.find((r) => r.league_id === league);
    if (!here) {
      const stale = !!active.room_id && rows.some((r) => r.room_id === active.room_id);
      const row: Career = { league_id: league, club_id: club, room_id: stale ? null : active.room_id ?? null, appointed_at: active.club_appointed_at ?? new Date().toISOString() };
      await client.from("manager_careers").upsert({ user_id: userId, ...row }, { onConflict: "user_id,league_id" });
      if (stale) await client.from("manager_contracts").update({ room_id: null }).eq("user_id", userId);
      return [...rows, row];
    }
    if (here.club_id !== club) {
      await client.from("manager_careers").update({ club_id: club, appointed_at: active.club_appointed_at ?? new Date().toISOString() }).eq("user_id", userId).eq("league_id", league);
      return rows.map((r) => (r.league_id === league ? { ...r, club_id: club } : r));
    }
  } catch {
    /* the career is saved the next time the page opens */
  }
  return rows;
}

/** Keeps the current room with the current league, then makes another career the active one. */
export async function switchCareer(client: SupabaseClient, userId: string, active: Active, target: Career) {
  const league = active.selected_league || "premier-league";
  await client.from("manager_careers").update({ room_id: active.room_id ?? null }).eq("user_id", userId).eq("league_id", league);
  const { error } = await client
    .from("manager_contracts")
    .update({ selected_league: target.league_id, selected_club: target.club_id, room_id: target.room_id ?? null })
    .eq("user_id", userId);
  if (error) throw error;
}

/** Saves the current career (and its room) before the manager picks another league. */
export async function stashCareer(client: SupabaseClient, userId: string, active: Active) {
  const league = active.selected_league || "premier-league";
  if (!active.selected_club) return;
  await client
    .from("manager_careers")
    .upsert({ user_id: userId, league_id: league, club_id: active.selected_club, room_id: active.room_id ?? null, appointed_at: active.club_appointed_at ?? new Date().toISOString() }, { onConflict: "user_id,league_id" });
}

type M = { league_id?: string | null; season: string; home_club: string; away_club: string; home_score: number | null; away_score: number | null; status: string };
export type SeasonRow = { league_id: string; season: string; club: string; pos: number; teams: number; pts: number; w: number; d: number; l: number; gf: number; ga: number; done: boolean };
export type Totals = { played: number; w: number; d: number; l: number; gf: number; ga: number };

/** Totals and one row per season for the club managed in each league. */
export function careerStats(matches: M[], careers: { league_id: string; club_id: string }[]): { totals: Totals; seasons: SeasonRow[] } {
  const totals: Totals = { played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  const seasons: SeasonRow[] = [];
  for (const c of careers) {
    const inLeague = matches.filter((m) => (m.league_id ?? "premier-league") === c.league_id);
    const bySeason = new Map<string, M[]>();
    for (const m of inLeague) (bySeason.get(m.season) ?? bySeason.set(m.season, []).get(m.season)!).push(m);
    for (const [season, rows] of bySeason) {
      const table = new Map<string, { pts: number; gd: number; gf: number; ga: number; w: number; d: number; l: number }>();
      const row = (id: string) => table.get(id) ?? table.set(id, { pts: 0, gd: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0 }).get(id)!;
      for (const m of rows) {
        if (m.status !== "completed" || m.home_score === null || m.away_score === null) continue;
        const h = row(m.home_club), a = row(m.away_club);
        h.gf += m.home_score; h.ga += m.away_score; a.gf += m.away_score; a.ga += m.home_score;
        h.gd += m.home_score - m.away_score; a.gd += m.away_score - m.home_score;
        if (m.home_score > m.away_score) { h.pts += 3; h.w++; a.l++; } else if (m.home_score < m.away_score) { a.pts += 3; a.w++; h.l++; } else { h.pts++; a.pts++; h.d++; a.d++; }
      }
      const mine = table.get(c.club_id);
      if (!mine) continue;
      const order = [...table.entries()].sort((x, y) => y[1].pts - x[1].pts || y[1].gd - x[1].gd || y[1].gf - x[1].gf).map(([id]) => id);
      const mineAll = rows.filter((m) => m.home_club === c.club_id || m.away_club === c.club_id);
      const played = mine.w + mine.d + mine.l;
      totals.played += played; totals.w += mine.w; totals.d += mine.d; totals.l += mine.l; totals.gf += mine.gf; totals.ga += mine.ga;
      seasons.push({ league_id: c.league_id, season, club: c.club_id, pos: order.indexOf(c.club_id) + 1, teams: order.length, pts: mine.pts, w: mine.w, d: mine.d, l: mine.l, gf: mine.gf, ga: mine.ga, done: mineAll.length > 0 && played === mineAll.length });
    }
  }
  seasons.sort((a, b) => (a.season < b.season ? 1 : a.season > b.season ? -1 : 0));
  return { totals, seasons };
}

/** Leaves the shared league of the career in play, and only that one: the other careers keep their seats. */
export async function leaveCurrentRoom(client: SupabaseClient, userId: string) {
  try {
    const { data } = await client.from("manager_contracts").select("room_id").eq("user_id", userId).maybeSingle();
    const rid = (data?.room_id as string | null) ?? null;
    if (rid) await client.from("room_members").delete().eq("user_id", userId).eq("room_id", rid);
  } catch {
    /* the seat is freed the next time */
  }
}
