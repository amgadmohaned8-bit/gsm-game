// @ts-nocheck
/**
 * Half-time changes. The manager can bring on up to three substitutes and
 * pick a style for the second half. The first half stays as it was; the
 * second half is drawn again from the seed, so the same changes always give
 * the same result.
 */

import type { MatchEvent } from "./matchSim.ts";
import { pickScorers, rng } from "./goals.ts";
import type { Player } from "./squads.ts";

export type Style = "attack" | "balanced" | "defend";
export const MAX_SUBS = 3;

export type Revised = { events: MatchEvent[]; home_score: number; away_score: number };

export function reviseSecondHalf(o: {
  events: MatchEvent[];
  myIsHome: boolean;
  /** rating change of the new eleven, already scaled for half a match */
  delta: number;
  style: Style;
  seed: string;
  myClub: string;
  myEleven: Player[];
  mySquad: Player[];
  theirSquad: Player[];
  clubName: { mine: string; theirs: string };
}): Revised {
  const r = rng(`${o.seed}|second-half`);
  const mine = o.myIsHome ? "home" : "away";
  const theirs = o.myIsHome ? "away" : "home";
  let events = [...o.events];

  const later = (team: "home" | "away") => events.filter((e) => e.type === "goal" && e.team === team && e.minute > 45);
  const remove = (team: "home" | "away") => {
    const last = later(team).sort((a, b) => b.minute - a.minute)[0];
    if (last) events = events.filter((e) => e !== last);
  };
  const add = (team: "home" | "away") => {
    const mineSide = team === mine;
    const who = pickScorers(mineSide ? o.mySquad : o.theirSquad, 1, `${o.seed}|${team}|${events.length}`, mineSide ? o.myEleven : undefined)[0];
    const name = mineSide ? o.clubName.mine : o.clubName.theirs;
    events.push({
      minute: 46 + Math.floor(r() * 44),
      text: who ? `GOAL! ${who.scorer.name} (${name})${who.assist ? `, assist ${who.assist.name}` : ""}` : `GOAL! ${name} score!`,
      type: "goal",
      team,
      player: who?.scorer.name,
      playerId: who?.scorer.id,
      assist: who?.assist?.name,
      assistId: who?.assist?.id,
    });
  };

  // better players on the pitch: more for us, or fewer against
  const gain = Math.min(0.8, Math.abs(o.delta) * 0.1);
  const rounds = Math.abs(o.delta) > 5 ? 2 : 1;
  for (let i = 0; i < rounds; i++) {
    if (o.delta > 0.2) (r() < gain ? add(mine) : r() < gain * 0.6 && remove(theirs));
    else if (o.delta < -0.2) (r() < gain ? add(theirs) : r() < gain * 0.6 && remove(mine));
  }

  if (o.style === "attack") {
    if (r() < 0.34) add(mine);
    if (r() < 0.28) add(theirs);
  } else if (o.style === "defend") {
    if (r() < 0.3) remove(mine);
    if (r() < 0.42) remove(theirs);
  }

  const count = (team: "home" | "away") => events.filter((e) => e.type === "goal" && e.team === team).length;
  return { events, home_score: count("home"), away_score: count("away") };
}
