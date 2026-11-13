/**
 * The board.
 *
 * Every club has its own objectives, set by how strong the club is: a title
 * for the best side, a place in the top half for a middle club, staying up
 * for a small one. The board's confidence moves with every result. Five
 * defeats in a row, or no confidence left, and the manager is sacked.
 * After that other clubs make offers, and they are weaker than the last one.
 */

import { clubsOfLeague, leagueOfClub } from "@/lib/football/leagueClubs";
import { getRating } from "@/lib/football/matchSim";

export type BoardMatch = {
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  matchday: number;
  played_at?: string | null;
};

export const LOSSES_TO_SACK = 5;
export const START_CONFIDENCE = 70;
const SACK_BELOW = 10;

/** Clubs by strength, strongest first. */
export const ranked = (clubId?: string) => [...clubsOfLeague(leagueOfClub(clubId))].sort((a, b) => getRating(b.id) - getRating(a.id) || a.name.localeCompare(b.name));
export const strengthRank = (clubId: string) => ranked(clubId).findIndex((c) => c.id === clubId) + 1;

export type Objective = {
  id: string;
  title: string;
  detail: string;
  /** league position to reach, or wins to reach */
  target: number;
  kind: "position" | "wins" | "streak";
};

/** What the board expects of this club this season. */
export function objectivesFor(clubId: string): Objective[] {
  const rank = strengthRank(clubId) || 10;
  const total = clubsOfLeague(leagueOfClub(clubId)).length || 20;
  const target = Math.max(1, Math.min(total - 3, rank - 1));
  const wins = Math.max(10, Math.round(38 * (0.76 - (target - 1) * 0.026)));
  const title =
    target === 1 ? "Win the league"
    : target <= 4 ? `Finish in the top ${target}`
    : target <= Math.floor(total / 2) ? "Finish in the top half"
    : "Stay up: finish above the drop zone";
  return [
    { id: "position", title, detail: `Finish ${target === 1 ? "first" : `${target}th or better`}`, target, kind: "position" },
    { id: "wins", title: `Win ${wins} matches`, detail: `${wins} league wins this season`, target: wins, kind: "wins" },
    { id: "streak", title: "Never lose five in a row", detail: "Five straight defeats and you are sacked", target: LOSSES_TO_SACK, kind: "streak" },
  ];
}

/* ---------- the table at a matchday ---------- */

function positionAfter(all: BoardMatch[], matchday: number, club: string): number {
  const t = new Map<string, { pts: number; gd: number; gf: number }>();
  for (const c of clubsOfLeague(leagueOfClub(club))) t.set(c.id, { pts: 0, gd: 0, gf: 0 });
  for (const m of all) {
    if (m.status !== "completed" || m.home_score === null || m.away_score === null || m.matchday > matchday) continue;
    const h = t.get(m.home_club);
    const a = t.get(m.away_club);
    if (!h || !a) continue;
    h.gf += m.home_score; a.gf += m.away_score;
    h.gd += m.home_score - m.away_score; a.gd += m.away_score - m.home_score;
    if (m.home_score > m.away_score) h.pts += 3;
    else if (m.home_score < m.away_score) a.pts += 3;
    else { h.pts += 1; a.pts += 1; }
  }
  const order = [...t.entries()].sort((x, y) => y[1].pts - x[1].pts || y[1].gd - x[1].gd || y[1].gf - x[1].gf);
  return order.findIndex(([id]) => id === club) + 1;
}

/* ---------- the verdict ---------- */

export type Result = "W" | "D" | "L";

export type BoardReport = {
  confidence: number;
  mood: "delighted" | "happy" | "patient" | "worried" | "angry";
  played: number;
  wins: number;
  position: number;
  lossStreak: number;
  form: Result[];
  seasonOver: boolean;
  sacked: boolean;
  reason: string;
  warning: string;
  history: { matchday: number; confidence: number }[];
  objectives: (Objective & { value: number; status: "done" | "on-track" | "at-risk" | "failed" })[];
};

export function evaluateBoard(all: BoardMatch[], clubId: string, appointedAt?: string | null): BoardReport {
  const objectives = objectivesFor(clubId);
  const target = objectives[0].target;
  const since = appointedAt ? new Date(appointedAt).getTime() : 0;

  const mine = all
    .filter((m) => m.status === "completed" && m.home_score !== null && m.away_score !== null && (m.home_club === clubId || m.away_club === clubId))
    // matches played before he took charge are not his
    .filter((m) => !since || (m.played_at ? new Date(m.played_at).getTime() >= since : false))
    .sort((a, b) => a.matchday - b.matchday);

  let confidence = START_CONFIDENCE;
  let lossStreak = 0;
  let wins = 0;
  let sackedAt: string | null = null;
  const form: Result[] = [];
  const history: BoardReport["history"] = [];

  for (const m of mine) {
    const home = m.home_club === clubId;
    const f = (home ? m.home_score : m.away_score) as number;
    const a = (home ? m.away_score : m.home_score) as number;
    if (f > a) { confidence += 4; lossStreak = 0; wins++; form.push("W"); }
    else if (f === a) { confidence -= 1; lossStreak = 0; form.push("D"); }
    else {
      confidence -= 5;
      lossStreak++;
      form.push("L");
      if (lossStreak >= 3) confidence -= 2 * (lossStreak - 2);
      if (a - f >= 3) confidence -= 2;
    }
    if (m.matchday >= 6) {
      const gap = positionAfter(all, m.matchday, clubId) - target;
      confidence += gap > 6 ? -3 : gap > 2 ? -1 : gap <= 0 ? 1 : 0;
    }
    confidence = Math.max(0, Math.min(100, confidence));
    history.push({ matchday: m.matchday, confidence });
    if (!sackedAt && lossStreak >= LOSSES_TO_SACK) sackedAt = `You lost ${LOSSES_TO_SACK} matches in a row.`;
    if (!sackedAt && confidence <= SACK_BELOW) sackedAt = "The board has lost all confidence in you.";
  }

  const lastDay = mine.length ? mine[mine.length - 1].matchday : 0;
  const position = positionAfter(all, lastDay || 99, clubId);
  const scheduledLeft = all.some((m) => m.status === "scheduled" && (m.home_club === clubId || m.away_club === clubId));
  const seasonOver = !scheduledLeft && mine.length >= 30;

  // the season is over: a miss by far costs the job
  if (!sackedAt && seasonOver && position > target + 5) sackedAt = `You finished ${position}th. The board expected ${target === 1 ? "the title" : `${target}th or better`}.`;

  const winsGoal = objectives[1].target;
  const withStatus = objectives.map((o) => {
    if (o.kind === "position") {
      const status = seasonOver ? (position <= o.target ? "done" : "failed") : mine.length < 6 ? "on-track" : position <= o.target ? "on-track" : position <= o.target + 4 ? "at-risk" : "at-risk";
      return { ...o, value: position, status } as BoardReport["objectives"][number];
    }
    if (o.kind === "wins") {
      const left = 38 - mine.length;
      const status = wins >= winsGoal ? "done" : seasonOver ? "failed" : wins + left < winsGoal ? "failed" : wins + left * 0.55 < winsGoal ? "at-risk" : "on-track";
      return { ...o, value: wins, status } as BoardReport["objectives"][number];
    }
    return { ...o, value: lossStreak, status: lossStreak >= 4 ? "at-risk" : lossStreak >= LOSSES_TO_SACK ? "failed" : "on-track" } as BoardReport["objectives"][number];
  });

  let warning = "";
  if (!sackedAt) {
    if (lossStreak === LOSSES_TO_SACK - 1) warning = "Final warning: one more defeat and you are sacked.";
    else if (lossStreak === LOSSES_TO_SACK - 2) warning = `${lossStreak} defeats in a row. The board is meeting about your future.`;
    else if (confidence < 30) warning = "The board is losing patience. You need results.";
  }

  const mood = confidence >= 85 ? "delighted" : confidence >= 60 ? "happy" : confidence >= 40 ? "patient" : confidence >= 20 ? "worried" : "angry";

  return {
    confidence: Math.round(confidence),
    mood,
    played: mine.length,
    wins,
    position,
    lossStreak,
    form: form.slice(-6),
    seasonOver,
    sacked: !!sackedAt,
    reason: sackedAt ?? "",
    warning,
    history,
    objectives: withStatus,
  };
}

/* ---------- offers after the sack ---------- */

export type Offer = { clubId: string; rank: number; objective: string; note: string };

/** Weaker clubs than the one the manager lost, a few of them, always the same for the same sacking. */
export function jobOffers(lostClub: string, seed: string): Offer[] {
  const list = ranked(lostClub);
  const lost = list.findIndex((c) => c.id === lostClub);
  let pool = list.slice(lost + 1).filter((c) => c.id !== lostClub);
  if (pool.length < 3) pool = list.slice(-4).filter((c) => c.id !== lostClub);
  const hash = (t: string) => {
    let h = 2166136261;
    for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
    return (h >>> 0) / 4294967296;
  };
  const picked = [...pool].sort((a, b) => hash(`${seed}|${a.id}`) - hash(`${seed}|${b.id}`)).slice(0, 4);
  return picked
    .sort((a, b) => getRating(b.id) - getRating(a.id))
    .map((c) => {
      const rank = strengthRank(c.id);
      const o = objectivesFor(c.id)[0];
      return {
        clubId: c.id,
        rank,
        objective: o.title,
        note: rank > 14 ? "A struggling club, desperate for a new manager." : rank > 8 ? "A mid-table club with a modest budget." : "A solid club, a step down.",
      };
    });
}
