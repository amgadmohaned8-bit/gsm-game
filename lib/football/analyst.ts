/**
 * The performance analyst.
 *
 * A manager pays for one report on the next opponent: how that club plays,
 * where it is strong and weak, and the plan (style, shape, sliders and
 * instructions) that suits the manager's own eleven best against it.
 * The report is worked out from the squads, so it is always the same one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { bestEleven, formations, type FormationName, type Player, type Position } from "@/lib/football/squads";
import { STYLES, aiStyle, formationEdge, matchup, styleOf, tacticBonus, fitOf, type StyleId, type Tactic } from "@/lib/football/tactics";
import { getRating } from "@/lib/football/matchSim";

/** millions */
export const ANALYST_FEE = 5;

export type Hire = { club_id: string; season: string; matchday: number; opponent: string; fee: number };

export async function loadHires(client: SupabaseClient, userId: string): Promise<Hire[]> {
  try {
    const { data } = await client.from("analyst_reports").select("club_id, season, matchday, opponent, fee").eq("user_id", userId);
    return (data ?? []) as Hire[];
  } catch {
    return [];
  }
}

export async function hireAnalyst(client: SupabaseClient, args: { userId: string; clubId: string; season: string; matchday: number; opponent: string }) {
  const { error } = await client.from("analyst_reports").insert({ user_id: args.userId, club_id: args.clubId, season: args.season, matchday: args.matchday, opponent: args.opponent, fee: ANALYST_FEE });
  if (error) throw new Error(error.code === "42P01" ? "The analyst is not set up yet: run supabase/031_analyst.sql first." : error.message);
}

const LINES: Position[] = ["GK", "DF", "MF", "FW"];
const LINE_NAME: Record<Position, string> = { GK: "Goalkeeper", DF: "Defence", MF: "Midfield", FW: "Attack" };
const avg = (l: Player[]) => (l.length ? l.reduce((s, p) => s + p.rating, 0) / l.length : 60);

export type LineRow = { line: Position; name: string; mine: number; theirs: number };
export type Plan = { style: StyleId; formation: FormationName; tactic: Tactic; gain: number; why: string[] };
export type Report = {
  theirStyle: StyleId;
  theirRating: number;
  myRating: number;
  lines: LineRow[];
  threats: Player[];
  weakest: Position;
  strongest: Position;
  plan: Plan;
  /** the same plan over the manager's current tactic */
  current: number;
  tips: string[];
};

const tacticFor = (style: StyleId): Tactic => ({ style, ...styleOf(style).ideal, opts: Object.fromEntries(styleOf(style).synergy.map((o) => [o, true])) });

export function analyze(args: { myClub: string; opponent: string; mySquad: Player[]; theirSquad: Player[]; currentTactic: Tactic | null; currentFormation: FormationName }): Report {
  const { opponent, mySquad, theirSquad } = args;
  const theirStyle = aiStyle(opponent);
  const theirEleven = bestEleven(theirSquad, "4-3-3");

  // the best style and shape for my squad against how they play
  let best: Plan | null = null;
  const names = Object.keys(formations) as FormationName[];
  for (const f of names) {
    const eleven = bestEleven(mySquad, f);
    for (const st of STYLES) {
      const t = tacticFor(st.id);
      const gain = tacticBonus(t, eleven, f) + matchup(st.id, theirStyle);
      if (!best || gain > best.gain) best = { style: st.id, formation: f, tactic: t, gain: Math.round(gain * 10) / 10, why: [] };
    }
  }
  const plan = best!;
  const planEleven = bestEleven(mySquad, plan.formation);
  const myEleven = bestEleven(mySquad, args.currentFormation);

  const lines: LineRow[] = LINES.map((line) => ({ line, name: LINE_NAME[line], mine: Math.round(avg(planEleven.filter((p) => p.position === line))), theirs: Math.round(avg(theirEleven.filter((p) => p.position === line))) }));
  const outfield = lines.filter((l) => l.line !== "GK");
  const weakest = outfield.reduce((a, b) => (b.theirs < a.theirs ? b : a)).line;
  const strongest = outfield.reduce((a, b) => (b.theirs > a.theirs ? b : a)).line;

  const m = matchup(plan.style, theirStyle);
  plan.why.push(`${styleOf(plan.style).name} with ${plan.formation} gives the best total for your players (${fitOf(plan.style, planEleven).score}/100 fit).`);
  if (m > 0) plan.why.push(`It beats their ${styleOf(theirStyle).name.toLowerCase()} (+${m}).`);
  else if (m < 0) plan.why.push(`Their ${styleOf(theirStyle).name.toLowerCase()} is strong against it (${m}), but nothing else fits your players better.`);
  else plan.why.push(`Against their ${styleOf(theirStyle).name.toLowerCase()} the match-up is even, so your players decide it.`);
  if (formationEdge(plan.style, plan.formation) > 0) plan.why.push(`${plan.formation} is a shape that suits this style.`);

  const current = args.currentTactic ? Math.round((tacticBonus(args.currentTactic, myEleven, args.currentFormation) + matchup(args.currentTactic.style, theirStyle)) * 10) / 10 : 0;

  const tips: string[] = [];
  const weakLine = lines.find((l) => l.line === weakest)!;
  tips.push(`Their ${weakLine.name.toLowerCase()} is the weak spot (${weakLine.theirs}). Aim your play at it.`);
  tips.push(`Their ${LINE_NAME[strongest].toLowerCase()} is their strength (${lines.find((l) => l.line === strongest)!.theirs}). Do not rely on beating it one against one.`);
  const style = styleOf(theirStyle);
  if (theirStyle === "bus" || theirStyle === "longball") tips.push("They will sit back or play long. Be patient and keep the ball, a goal early breaks them.");
  if (theirStyle === "press" || theirStyle === "possession") tips.push("They push up and leave space behind. A quick ball over the top hurts them.");
  if (theirStyle === "counter") tips.push("They wait for your mistakes. Keep a defender back when the full-backs go forward.");
  if (theirStyle === "wings") tips.push("Their danger is crosses. Stay narrow in defence and keep your tallest defenders in the box.");
  const gk = lines.find((l) => l.line === "GK")!;
  if (gk.theirs < gk.mine - 3) tips.push("Their keeper is weaker than yours: shoot from distance.");
  tips.push(`They play ${style.name.toLowerCase()}: ${style.desc.toLowerCase()}`);

  const threats = [...theirEleven].sort((a, b) => b.rating - a.rating).slice(0, 3);
  return { theirStyle, theirRating: getRating(opponent), myRating: Math.round(avg(planEleven)), lines, threats, weakest, strongest, plan, current, tips };
}
