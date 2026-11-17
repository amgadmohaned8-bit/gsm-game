/** Shirt colours used on the match pitch. Egyptian and African clubs keep theirs in their own files. */
import { egyptClubs } from "@/lib/football/egypt";
import { africanClubs } from "@/lib/football/africa";
import { europeColors } from "@/lib/football/europeClubs";

const PL: Record<string, [string, string]> = {
  "man-city": ["#6cabdd", "#ffffff"], arsenal: ["#ef0107", "#ffffff"], liverpool: ["#c8102e", "#f6eb61"], chelsea: ["#034694", "#ffffff"],
  "man-united": ["#da291c", "#fbe122"], tottenham: ["#ffffff", "#132257"], newcastle: ["#2b2b2b", "#ffffff"], "aston-villa": ["#95bfe5", "#670e36"],
  brighton: ["#0057b8", "#ffffff"], "crystal-palace": ["#1b458f", "#c4122e"], "nottingham-forest": ["#dd0000", "#ffffff"], fulham: ["#f5f5f5", "#111111"],
  everton: ["#003399", "#ffffff"], brentford: ["#e30613", "#ffffff"], bournemouth: ["#b50e12", "#111111"], leeds: ["#ffcd00", "#1d428a"],
  ipswich: ["#0044aa", "#ffffff"], sunderland: ["#eb172b", "#ffffff"], coventry: ["#5bc2e7", "#ffffff"], "hull-city": ["#f5a300", "#111111"],
};

function hash(t: string) { let h = 2166136261; for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619); return h >>> 0; }

export function kitOf(id: string): [string, string] {
  if (PL[id]) return PL[id];
  const e = egyptClubs.find((c) => c.id === id);
  const ec = (e as { colors?: [string, string] } | undefined)?.colors;
  if (ec) return ec;
  const a = africanClubs.find((c) => c.id === id);
  const ac = (a as { colors?: [string, string] } | undefined)?.colors;
  if (ac) return ac;
  if (europeColors[id]) return europeColors[id];
  const h = hash(id) % 360;
  return [`hsl(${h} 70% 50%)`, "#ffffff"];
}

function rgb(c: string): [number, number, number] {
  if (c.startsWith("#")) { const n = c.length === 4 ? c.slice(1).split("").map((x) => x + x).join("") : c.slice(1); return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)) as [number, number, number]; }
  return [128, 128, 128];
}
const dist = (a: string, b: string) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

/** Home and away shirt colours, never too close to each other. */
export function matchKits(home: string, away: string): { home: string; away: string } {
  const h = kitOf(home)[0];
  const [a1, a2] = kitOf(away);
  if (dist(h, a1) > 110) return { home: h, away: a1 };
  if (dist(h, a2) > 110) return { home: h, away: a2 };
  return { home: h, away: dist(h, "#ffffff") > 140 ? "#ffffff" : "#ffd23f" };
}
