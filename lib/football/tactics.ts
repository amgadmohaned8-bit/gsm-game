/**
 * Tactics.
 *
 * A manager picks a style of play, tunes four sliders and switches on a few
 * team instructions. A style only works as well as the players suit it, and a
 * style can be strong or weak against the way the other club plays. All of it
 * ends up as rating points for the match, like squad strength does.
 */

import type { FormationName, Player } from "@/lib/football/squads";
import { getTier } from "@/lib/football/finance";

export type StyleId = "balanced" | "possession" | "longball" | "counter" | "wings" | "press" | "bus";
export type OptId = "offside" | "counterpress" | "playout" | "target" | "overlap" | "setpieces";

export type Tactic = {
  style: StyleId;
  /** 0-100 */
  tempo: number;
  width: number;
  press: number;
  line: number;
  opts: Partial<Record<OptId, boolean>>;
};

type Slider = Pick<Tactic, "tempo" | "width" | "press" | "line">;

export type StyleDef = {
  id: StyleId;
  name: string;
  tag: string;
  desc: string;
  ideal: Slider;
  needs: string;
  /** which players it leans on, to explain the fit score */
  leans: Partial<Record<Player["position"], number>>;
  /** instructions that go with this style */
  synergy: OptId[];
  beats: StyleId[];
};

export const STYLES: StyleDef[] = [
  {
    id: "balanced",
    name: "Balanced",
    tag: "No risks",
    desc: "A solid shape that reacts to the match. Nothing special, nothing wrong.",
    ideal: { tempo: 50, width: 50, press: 50, line: 50 },
    needs: "A good all-round eleven",
    leans: { GK: 0.1, DF: 0.3, MF: 0.3, FW: 0.3 },
    synergy: [],
    beats: [],
  },
  {
    id: "possession",
    name: "Possession",
    tag: "Tiki-taka",
    desc: "Keep the ball, move it short and quick, and tire the other side out until a gap opens.",
    ideal: { tempo: 55, width: 45, press: 65, line: 70 },
    needs: "Technical midfielders",
    leans: { MF: 0.6, DF: 0.2, FW: 0.2 },
    synergy: ["playout", "counterpress"],
    beats: ["longball", "bus"],
  },
  {
    id: "longball",
    name: "Long ball",
    tag: "Direct",
    desc: "Skip the midfield. Hit a strong forward early and fight for the second ball.",
    ideal: { tempo: 75, width: 40, press: 40, line: 45 },
    needs: "A strong forward and a good keeper",
    leans: { FW: 0.55, GK: 0.2, DF: 0.25 },
    synergy: ["target", "setpieces"],
    beats: ["press", "wings"],
  },
  {
    id: "counter",
    name: "Counter-attack",
    tag: "Fast break",
    desc: "Sit deep, win the ball, and go forward in three passes while the other side is open.",
    ideal: { tempo: 85, width: 55, press: 35, line: 30 },
    needs: "Quick forwards and a calm defence",
    leans: { FW: 0.5, DF: 0.3, MF: 0.2 },
    synergy: ["offside", "target"],
    beats: ["possession", "press"],
  },
  {
    id: "wings",
    name: "Wing play",
    tag: "Down the flanks",
    desc: "Stretch the pitch, get the ball wide and put crosses into the box.",
    ideal: { tempo: 65, width: 90, press: 55, line: 55 },
    needs: "Wide players and a forward who wins headers",
    leans: { FW: 0.4, MF: 0.4, DF: 0.2 },
    synergy: ["overlap", "setpieces"],
    beats: ["bus", "counter"],
  },
  {
    id: "press",
    name: "High press",
    tag: "Gegenpress",
    desc: "Squeeze the other side high up the pitch and win the ball close to their goal.",
    ideal: { tempo: 85, width: 55, press: 95, line: 85 },
    needs: "Young, fit players who run all game",
    leans: { MF: 0.4, FW: 0.3, DF: 0.3 },
    synergy: ["counterpress", "offside"],
    beats: ["possession", "wings"],
  },
  {
    id: "bus",
    name: "Park the bus",
    tag: "Defend deep",
    desc: "Two banks of four near your box. Hard to score against, and you win games on one chance.",
    ideal: { tempo: 30, width: 25, press: 15, line: 10 },
    needs: "A strong defence and keeper",
    leans: { DF: 0.5, GK: 0.3, MF: 0.2 },
    synergy: ["setpieces"],
    beats: ["counter", "press"],
  },
];

export const OPTIONS: { id: OptId; name: string; note: string }[] = [
  { id: "offside", name: "Offside trap", note: "Step up together. Great with a high line, risky if not." },
  { id: "counterpress", name: "Counter-press", note: "Win it back in the first five seconds." },
  { id: "playout", name: "Play out from the back", note: "The keeper and defenders start every attack." },
  { id: "target", name: "Target man", note: "Aim long passes at your tallest forward." },
  { id: "overlap", name: "Overlapping full-backs", note: "Defenders run past the wingers." },
  { id: "setpieces", name: "Set-piece specialists", note: "Practice corners and free kicks." },
];

export const styleOf = (id: StyleId) => STYLES.find((s) => s.id === id) ?? STYLES[0];

export const defaultTactic = (): Tactic => ({ style: "balanced", ...STYLES[0].ideal, opts: {} });

const key = (userId: string, clubId: string) => `gsm-tactic:${userId}:${clubId}`;

export function readTactic(userId: string, clubId: string): Tactic | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key(userId, clubId)) ?? "null");
    if (saved && STYLES.some((s) => s.id === saved.style)) return { ...defaultTactic(), ...saved };
  } catch {
    /* no tactic saved */
  }
  return null;
}

export function saveTactic(userId: string, clubId: string, t: Tactic) {
  try {
    localStorage.setItem(key(userId, clubId), JSON.stringify(t));
  } catch {
    /* it still applies for this visit */
  }
}

/* ---------- how well the players suit a style ---------- */

const avg = (list: Player[]) => (list.length ? list.reduce((s, p) => s + p.rating, 0) / list.length : 60);

export type Fit = { score: number; parts: { label: string; value: number }[] };

/** 0-100: how well this eleven suits the style. */
export function fitOf(style: StyleId, eleven: Player[]): Fit {
  const def = styleOf(style);
  const by = (pos: Player["position"]) => avg(eleven.filter((p) => p.position === pos));
  let weighted = 0;
  const parts: Fit["parts"] = [];
  for (const [pos, w] of Object.entries(def.leans) as [Player["position"], number][]) {
    const v = by(pos);
    weighted += v * w;
    parts.push({ label: { GK: "Goalkeeper", DF: "Defence", MF: "Midfield", FW: "Attack" }[pos], value: Math.round(v) });
  }
  if (style === "press") {
    const age = eleven.length ? eleven.reduce((s, p) => s + p.age, 0) / eleven.length : 27;
    weighted += (28 - age) * 1.2;
    parts.push({ label: "Fitness (age)", value: Math.round(Math.max(40, Math.min(95, 100 - (age - 20) * 4))) });
  }
  return { score: Math.max(0, Math.min(100, Math.round((weighted - 55) * 3))), parts };
}

/** How close the sliders are to what the style wants: 0-100. */
export function coherence(t: Tactic): number {
  const ideal = styleOf(t.style).ideal;
  const d = (Math.abs(t.tempo - ideal.tempo) + Math.abs(t.width - ideal.width) + Math.abs(t.press - ideal.press) + Math.abs(t.line - ideal.line)) / 4;
  return Math.max(0, Math.round(100 - d * 2));
}

export const MAX_TACTIC = 6;

/** Formations that suit a style (+1), and ones that work against it (-1). Everything else is neutral. */
const SHAPES: Record<StyleId, { good: FormationName[]; bad: FormationName[] }> = {
  balanced: { good: ["4-3-3", "4-4-2"], bad: [] },
  possession: { good: ["4-3-3", "4-2-3-1", "3-5-2"], bad: ["5-3-2"] },
  longball: { good: ["4-4-2", "3-5-2"], bad: ["4-2-3-1"] },
  counter: { good: ["4-4-2", "5-3-2", "4-2-3-1"], bad: ["3-4-3"] },
  wings: { good: ["4-3-3", "3-4-3", "4-4-2"], bad: ["4-2-3-1"] },
  press: { good: ["4-3-3", "3-4-3", "4-2-3-1"], bad: ["5-3-2"] },
  bus: { good: ["5-3-2", "4-4-2"], bad: ["3-4-3", "4-3-3"] },
};

/** Rating points for playing this formation with this style: -1.5 to +1.5. */
export function formationEdge(style: StyleId, formation: FormationName): number {
  const s = SHAPES[style] ?? SHAPES.balanced;
  return s.good.includes(formation) ? 1.5 : s.bad.includes(formation) ? -1.5 : 0;
}

/** How a style changes the goals of a match: what it scores, and what the other side scores against it. */
export const GOAL_SHAPE: Record<StyleId, { scores: number; concedes: number }> = {
  balanced: { scores: 1, concedes: 1 },
  possession: { scores: 1.05, concedes: 0.93 },
  longball: { scores: 1, concedes: 1.06 },
  counter: { scores: 0.95, concedes: 1 },
  wings: { scores: 1.08, concedes: 1.05 },
  press: { scores: 1.1, concedes: 1.1 },
  bus: { scores: 0.78, concedes: 0.78 },
};

/** Rating points from the style, the sliders and the instructions. */
export function tacticBonus(t: Tactic | null, eleven: Player[], formation?: FormationName): number {
  if (!t) return 0;
  const shape = formation ? formationEdge(t.style, formation) : 0;
  if (t.style === "balanced" && !Object.values(t.opts).some(Boolean)) return shape;
  const fit = fitOf(t.style, eleven).score;
  const fitPart = ((fit - 60) / 40) * 1.8;
  const coh = ((coherence(t) - 50) / 50) * 1.0;
  const syn = styleOf(t.style).synergy;
  const opts = (Object.entries(t.opts) as [OptId, boolean][])
    .filter(([, on]) => on)
    .reduce((sum, [id]) => sum + (syn.includes(id) ? 0.3 : -0.1), 0);
  const total = (fitPart + coh + opts) * 1.6 + shape;
  return Math.max(-MAX_TACTIC, Math.min(MAX_TACTIC, Math.round(total * 10) / 10));
}

/* ---------- the other clubs ---------- */

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

/** How a club plays. Fixed for a club, so a manager can scout it. */
export function aiStyle(clubId: string): StyleId {
  const r = hash(`${clubId}|style`);
  const tier = getTier(clubId);
  const pool: StyleId[] =
    tier === "elite" ? ["possession", "press", "counter", "wings", "possession"]
    : tier === "mid" ? ["balanced", "wings", "counter", "press", "possession", "longball"]
    : ["bus", "longball", "counter", "balanced", "bus"];
  return pool[Math.floor(r * pool.length)];
}

/** Rating points for my style against theirs: +2.4, 0 or -2.4. */
export function matchup(mine: StyleId, theirs: StyleId): number {
  if (mine === theirs) return 0;
  const win = styleOf(mine).beats.includes(theirs);
  const lose = styleOf(theirs).beats.includes(mine);
  return win && !lose ? 2.4 : lose && !win ? -2.4 : 0;
}
