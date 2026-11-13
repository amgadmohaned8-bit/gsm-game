/**
 * Injuries and suspensions.
 *
 * Whether a player is out in a given matchday is a pure function of the
 * league, season and player, so everybody in a shared league sees the same
 * injury list and the scorers of an old match can be worked out again.
 */

import { bestEleven, squadOf, type Player } from "@/lib/football/squads";

export type Absence = { kind: "injury" | "ban"; from: number; to: number; label: string };

const INJURY = 0.015;
const BAN = 0; // bans now come from real cards (see recordCards)
const SCALE = 2.5;
const MAX_BONUS = 10;
const LAST_DAY = 38;
const LABELS = ["Hamstring strain", "Ankle sprain", "Knee knock", "Muscle fatigue", "Groin strain", "Calf injury"];

function hash(text: string) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
const unit = (text: string) => hash(text) / 4294967296;

const cache = new Map<string, Absence[]>();

/** Every spell out of the team this season for one player. */
export function absences(key: string, season: string, playerId: string): Absence[] {
  const k = `${key}|${season}|${playerId}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const list: Absence[] = [];
  let md = 1;
  while (md <= LAST_DAY) {
    const r = unit(`${k}|${md}`);
    if (r < INJURY) {
      const len = 1 + Math.floor(unit(`${k}|${md}|len`) * 6);
      const label = LABELS[Math.floor(unit(`${k}|${md}|what`) * LABELS.length)];
      list.push({ kind: "injury", from: md + 1, to: md + len, label });
      md += len + 1;
    } else if (r < INJURY + BAN) {
      list.push({ kind: "ban", from: md + 1, to: md + 1, label: "Red card ban" });
      md += 2;
    } else md += 1;
  }
  cache.set(k, list);
  return list;
}

/* ---------- cards the manager's own players really got ---------- */

type Card = { id: string; season: string; matchday: number; kind: "red" | "yellow" };
const DISCIPLINE = "gsm-discipline";
export const YELLOWS_FOR_BAN = 3;

function readCards(): Card[] {
  try {
    if (typeof localStorage === "undefined") return [];
    return JSON.parse(localStorage.getItem(DISCIPLINE) ?? "[]") as Card[];
  } catch {
    return [];
  }
}

/** Matchdays a player misses because of cards: the match after a red, and after every third yellow of the season. */
function banDays(playerId: string, season: string): number[] {
  const cards = readCards().filter((c) => c.id === playerId && c.season === season).sort((a, b) => a.matchday - b.matchday);
  const days: number[] = [];
  let yellows = 0;
  for (const c of cards) {
    if (c.kind === "red") days.push(c.matchday + 1);
    else if (++yellows % YELLOWS_FOR_BAN === 0) days.push(c.matchday + 1);
  }
  return days;
}

/** Yellow cards a player has this season (for the squad list). */
export const yellowsOf = (playerId: string, season: string) => readCards().filter((c) => c.id === playerId && c.season === season && c.kind === "yellow").length;

/**
 * Called once a match of the manager's club is played: its cards become real.
 * A sent-off player misses the next match; the third yellow of a season is a ban too.
 */
export function recordCards(season: string, matchday: number, cards: { playerId?: string; card?: "yellow" | "red" }[]) {
  try {
    const all = readCards();
    for (const c of cards) {
      if (!c.playerId || !c.card) continue;
      if (all.some((x) => x.id === c.playerId && x.season === season && x.matchday === matchday)) continue; // already counted
      all.push({ id: c.playerId, season, matchday, kind: c.card });
    }
    localStorage.setItem(DISCIPLINE, JSON.stringify(all.slice(-400)));
  } catch {
    /* the cards just do not carry over */
  }
}

export function absenceOn(key: string, season: string, playerId: string, matchday: number): Absence | null {
  if (banDays(playerId, season).includes(matchday)) {
    const red = readCards().some((c) => c.id === playerId && c.season === season && c.kind === "red" && c.matchday + 1 === matchday);
    return { kind: "ban", from: matchday, to: matchday, label: red ? "Red card ban" : "Yellow card ban (3 yellows)" };
  }
  return absences(key, season, playerId).find((a) => matchday >= a.from && matchday <= a.to) ?? null;
}

/** Players who can play that matchday. Always leaves a goalkeeper and enough outfield players. */
export function availableSquad(squad: Player[], key: string, season: string, matchday: number): Player[] {
  const ok = squad.filter((p) => !absenceOn(key, season, p.id, matchday));
  if (ok.length < 14) return squad;
  if (!ok.some((p) => p.position === "GK")) {
    const gk = squad.filter((p) => p.position === "GK").sort((a, b) => b.rating - a.rating)[0];
    if (gk) ok.push(gk);
  }
  return ok;
}

/** Rating points a club loses (or keeps) with today's injuries, against its starting eleven. */
export function injuryBonus(clubId: string, squad: Player[], key: string, season: string, matchday: number) {
  const start = bestEleven(squadOf(clubId), "4-3-3");
  const now = bestEleven(availableSquad(squad.length ? squad : squadOf(clubId), key, season, matchday), "4-3-3");
  if (!start.length || !now.length) return 0;
  const avg = (l: Player[]) => l.reduce((s, p) => s + p.rating, 0) / l.length;
  const raw = (avg(now) - avg(start)) * SCALE;
  return Math.max(-MAX_BONUS, Math.min(MAX_BONUS, Math.round(raw * 10) / 10));
}
