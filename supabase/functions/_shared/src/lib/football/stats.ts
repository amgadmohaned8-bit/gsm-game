// @ts-nocheck
/**
 * Season statistics: top scorers, assists and the teams that score most.
 * Derived at read time from the saved scores, because the scorers of a match
 * are a pure function of the fixture and the squads of that day.
 */

import { simulateFixture } from "./matchSim.ts";
import { applyDeals, type Deal } from "./transfers.ts";
import type { Renewal } from "./contracts.ts";
import type { TrainingRow } from "./development.ts";
import type { Squads } from "./goals.ts";
import type { Position } from "./squads.ts";

export type StatMatch = {
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  matchday: number;
  season: string;
};

export type PlayerStat = { id: string; name: string; club: string; position: Position; goals: number; assists: number; total: number };
export type TeamStat = { club: string; goals: number; played: number; per: number };

/** The squads as they were when a matchday was played: deals up to that day. */
export function squadsAt(deals: Deal[], season: string, matchday: number, training: TrainingRow[] = [], own?: { club: string; renewals: Renewal[] }): Squads {
  return applyDeals(deals.filter((d) => d.season !== season || d.matchday <= matchday), { season, training, matchday, own });
}

export function computeStats(opts: { matches: StatMatch[]; deals: Deal[]; leagueKey: string; training?: TrainingRow[]; own?: { club: string; renewals: Renewal[] } }) {
  const players = new Map<string, PlayerStat>();
  const teams = new Map<string, TeamStat>();
  const cache = new Map<number, Squads>();

  for (const m of opts.matches) {
    if (m.status !== "completed" || m.home_score === null || m.away_score === null) continue;
    let squads = cache.get(m.matchday);
    if (!squads) {
      squads = squadsAt(opts.deals, m.season, m.matchday, opts.training, opts.own);
      cache.set(m.matchday, squads);
    }
    for (const [club, gf] of [[m.home_club, m.home_score], [m.away_club, m.away_score]] as const) {
      const t = teams.get(club) ?? { club, goals: 0, played: 0, per: 0 };
      t.goals += gf;
      t.played += 1;
      teams.set(club, t);
    }
    const sim = simulateFixture({
      leagueKey: opts.leagueKey,
      season: m.season,
      matchday: m.matchday,
      homeClub: m.home_club,
      awayClub: m.away_club,
      fixed: { home: m.home_score, away: m.away_score },
      squads,
    });
    for (const e of sim.events) {
      if (e.type !== "goal" || !e.playerId) continue;
      const club = e.team === "home" ? m.home_club : m.away_club;
      const find = (id: string) => (squads![club] ?? []).find((p) => p.id === id);
      const credit = (id: string, name: string, key: "goals" | "assists") => {
        const p = find(id);
        const s = players.get(id) ?? { id, name, club, position: p?.position ?? "MF", goals: 0, assists: 0, total: 0 };
        s[key] += 1;
        s.total = s.goals + s.assists;
        players.set(id, s);
      };
      credit(e.playerId, e.player ?? "", "goals");
      if (e.assistId) credit(e.assistId, e.assist ?? "", "assists");
    }
  }

  for (const t of teams.values()) t.per = t.played ? t.goals / t.played : 0;
  const all = [...players.values()];
  const byName = (a: PlayerStat, b: PlayerStat) => a.name.localeCompare(b.name);
  return {
    scorers: all.filter((p) => p.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists || byName(a, b)),
    assisters: all.filter((p) => p.assists > 0).sort((a, b) => b.assists - a.assists || b.goals - a.goals || byName(a, b)),
    best: all.sort((a, b) => b.total - a.total || b.goals - a.goals || byName(a, b)),
    teams: [...teams.values()].sort((a, b) => b.goals - a.goals || a.club.localeCompare(b.club)),
  };
}
