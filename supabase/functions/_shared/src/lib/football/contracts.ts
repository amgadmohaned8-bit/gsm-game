// @ts-nocheck
/**
 * Contracts. Every player has a last season. When it ends he leaves the club
 * as a free agent, unless the manager renewed him before. A renewal costs a
 * signing-on fee, and the player asks for a wage that goes up with his rating.
 *
 * The year in a contract is the year the player's last season starts: 2027
 * means his last season is 2027-2028. All money is in millions.
 */

import type { Player } from "./squads.ts";
import { marketValue } from "./squads.ts";
import { startYear } from "./development.ts";
import { getTier } from "./finance.ts";

export type Renewal = { club_id: string; player_id: string; season: string; end_year: number; wage: number; fee: number };
type DealLite = { player_id: string; to_club: string; kind: string; season: string };

export const MAX_YEARS = 5;

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
const round2 = (n: number) => Math.round(n * 100) / 100;

/** What a player earns in a year, from his value and rating. */
export function wageOf(p: Player) {
  return round2(Math.max(0.3, marketValue(p) * 0.07 + Math.max(0, p.rating - 60) * 0.03));
}

export type Contract = { endYear: number; wage: number };

/** His contract at this club: the start, a signing, or the latest renewal. */
export function contractOf(p: Player, club: string, deals: DealLite[], renewals: Renewal[]): Contract {
  let endYear = 2027 + Math.floor(unit(`${p.id}|contract`) * 4);
  const signed = deals.filter((d) => d.player_id === p.id && d.to_club === club && d.kind === "buy").pop();
  if (signed) endYear = startYear(signed.season) + 2 + Math.floor(unit(`${p.id}|signed`) * 3);
  const mine = renewals.filter((r) => r.player_id === p.id && r.club_id === club);
  const last = mine[mine.length - 1];
  return last ? { endYear: last.end_year, wage: Number(last.wage) } : { endYear, wage: wageOf(p) };
}

/** Seasons left, counting this one: 1 means this is his last. 0 or less: he has gone. */
export const seasonsLeft = (c: Contract, season: string) => c.endYear - startYear(season) + 1;

export type Ask = { wage: number; years: number[]; note: string };

/** What a player wants to sign again. Fixed for a manager, player and season. */
export function askFor(userId: string, season: string, p: Player): Ask {
  const mood = unit(`${userId}|${p.id}|${season}|renew`);
  const wage = round2(wageOf(p) * (1.05 + 0.35 * mood));
  const years = [1, 2, 3, 4, 5].filter((y) => !(p.age >= 33 && y > 1) && !(p.age >= 31 && y > 2) && !(p.age <= 22 && y < 2));
  const note = mood > 0.75 ? "Wants a big raise and has other offers." : mood < 0.25 ? "Happy here and easy to deal with." : "A fair ask for a player of his level.";
  return { wage, years, note };
}

export type Reply = { kind: "accept" | "counter" | "reject"; wage: number; line: string };

export function replyTo(ask: Ask, offered: number): Reply {
  const r = offered / ask.wage;
  if (r >= 1) return { kind: "accept", wage: offered, line: "He signs. He is pleased." };
  if (r >= 0.92) return { kind: "counter", wage: ask.wage, line: `Close. He will sign for ${ask.wage.toFixed(2)}M a year.` };
  return { kind: "reject", wage: ask.wage, line: "Not enough. He is thinking about leaving." };
}

/** The signing-on fee: half a year's wage. */
export const feeFor = (wage: number) => round2(wage * 0.5);

/** The wage a club can carry in a year, from its size. */
export const wageBudget = (club: string) => (getTier(club) === "elite" ? 160 : getTier(club) === "mid" ? 105 : 70);
