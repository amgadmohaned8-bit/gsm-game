/**
 * Who scores. Goals belong to players of the squad: forwards score most,
 * midfielders set up most, and better players do both more often.
 * Everything is seeded, so the same match always gives the same scorers.
 */

import type { Player } from "@/lib/football/squads";
import { bestEleven } from "@/lib/football/squads";

export type Squads = Record<string, Player[]>;
export type GoalCredit = { scorer: Player; assist: Player | null };

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
export function rng(text: string) {
  let a = seed(text);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCORE_W = { GK: 0.01, DF: 0.7, MF: 2.6, FW: 6 } as const;
const ASSIST_W = { GK: 0.05, DF: 1.2, MF: 4, FW: 3 } as const;

/** Starters count fully, the rest of the first 16 a little. */
function pool(squad: Player[], xi?: Player[]) {
  const eleven = new Set((xi && xi.length === 11 ? xi : bestEleven(squad, "4-3-3")).map((p) => p.id));
  const bench = [...squad].filter((p) => !eleven.has(p.id)).sort((a, b) => b.rating - a.rating).slice(0, 5);
  const benchIds = new Set(bench.map((p) => p.id));
  return squad.filter((p) => eleven.has(p.id) || benchIds.has(p.id)).map((p) => ({ p, depth: eleven.has(p.id) ? 1 : 0.2 }));
}

function draw<T>(items: { item: T; w: number }[], r: number): T | null {
  const total = items.reduce((s, i) => s + i.w, 0);
  if (total <= 0) return null;
  let x = r * total;
  for (const i of items) {
    x -= i.w;
    if (x <= 0) return i.item;
  }
  return items[items.length - 1].item;
}

/** A scorer, and most of the time an assist from a different player, for each goal. */
export function pickScorers(squad: Player[], goals: number, key: string, xi?: Player[]): GoalCredit[] {
  if (!goals || !squad.length) return [];
  const r = rng(`${key}|scorers`);
  const list = pool(squad, xi);
  const out: GoalCredit[] = [];
  for (let g = 0; g < goals; g++) {
    const quality = (p: Player) => Math.pow(Math.max(p.rating, 40) / 75, 4);
    const scorer = draw(list.map(({ p, depth }) => ({ item: p, w: SCORE_W[p.position] * quality(p) * depth })), r())!;
    let assist: Player | null = null;
    if (r() < 0.78) {
      assist = draw(
        list.filter(({ p }) => p.id !== scorer.id).map(({ p, depth }) => ({ item: p, w: ASSIST_W[p.position] * quality(p) * depth })),
        r()
      );
    } else r();
    out.push({ scorer, assist });
  }
  return out;
}
