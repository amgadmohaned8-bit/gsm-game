/**
 * Achievements: 500 of them, from "win your first match" to "win the league
 * three times with the same club". Progress is worked out from what the
 * database already holds (matches, trophies, transfers, training, friendlies,
 * press conferences). Each unlocked achievement is saved once, so nothing is
 * ever lost, and every one adds experience to the manager's coach level. A
 * higher coach level makes training work better.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTier } from "@/lib/football/finance";

export type Tier = "easy" | "medium" | "hard" | "legend";
export type Cat = "matches" | "goals" | "streaks" | "trophies" | "transfers" | "club" | "special";

export type Badge = {
  id: string;
  cat: Cat;
  name: string;
  desc: string;
  icon: string;
  tier: Tier;
  xp: number;
  metric: string;
  target: number;
};

export const TIER_XP: Record<Tier, number> = { easy: 10, medium: 25, hard: 60, legend: 150 };
export const TIER_LABEL: Record<Tier, string> = { easy: "Easy", medium: "Medium", hard: "Hard", legend: "Legendary" };
export const CAT_LABEL: Record<Cat, string> = {
  matches: "Matches",
  goals: "Goals",
  streaks: "Streaks",
  trophies: "Trophies",
  transfers: "Transfers",
  club: "Club life",
  special: "Special",
};

const RANKS = [
  "Rookie", "Junior", "Regular", "Reliable", "Skilled", "Seasoned", "Veteran", "Pro", "Elite", "Master",
  "Champion", "Star", "Superstar", "Legend", "Icon", "Mythic", "Titan", "Immortal", "Eternal", "Ultimate",
];

const L20 = {
  wins: [1, 3, 5, 10, 15, 20, 30, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 400, 500, 750],
  draws: [1, 3, 5, 10, 15, 20, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300, 350, 400, 500],
  played: [1, 5, 10, 20, 38, 50, 76, 100, 114, 150, 190, 228, 300, 380, 456, 570, 760, 950, 1140, 1520],
  goals: [1, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 400, 500, 650, 800, 1000, 1250, 1500, 2000, 2500],
  clean: [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 400],
  big: [1, 2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300],
  streak: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 25, 30],
  unbeaten: [3, 4, 5, 6, 8, 10, 12, 14, 15, 17, 19, 20, 22, 25, 28, 30, 33, 36, 38, 40],
  venue: [1, 3, 5, 10, 15, 20, 30, 40, 50, 60, 75, 100, 125, 150, 175, 200, 250, 300, 350, 400],
  seasons: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 25, 30, 40, 50, 75],
  trophies: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 18, 20, 25, 30, 40, 50, 75],
  count: [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50, 65, 80, 100, 125, 150, 200, 250, 300, 400],
  money: [1, 5, 10, 25, 50, 75, 100, 150, 200, 300, 400, 500, 650, 800, 1000, 1250, 1500, 2000, 2500, 3000],
  sessions: [1, 3, 5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 400, 500, 650, 800, 1000, 1250, 1500, 2000],
  press: [1, 3, 5, 10, 15, 20, 30, 40, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000, 1500],
};

type Series = { metric: string; cat: Cat; noun: string; icon: string; unit: string; list: number[] };

const SERIES: Series[] = [
  { metric: "wins", cat: "matches", noun: "Winner", icon: "🏅", unit: "Win {n} league matches", list: L20.wins },
  { metric: "draws", cat: "matches", noun: "Peacemaker", icon: "🤝", unit: "Draw {n} league matches", list: L20.draws },
  { metric: "played", cat: "matches", noun: "Regular", icon: "📅", unit: "Play {n} league matches", list: L20.played },
  { metric: "homeWins", cat: "matches", noun: "Home Hero", icon: "🏟️", unit: "Win {n} home matches", list: L20.venue },
  { metric: "awayWins", cat: "matches", noun: "Road Warrior", icon: "🚌", unit: "Win {n} away matches", list: L20.venue },
  { metric: "bigWins", cat: "matches", noun: "Thrasher", icon: "💥", unit: "Win {n} matches by 3 goals or more", list: L20.big },
  { metric: "goals", cat: "goals", noun: "Goal Machine", icon: "⚽", unit: "Score {n} league goals", list: L20.goals },
  { metric: "clean", cat: "goals", noun: "Brick Wall", icon: "🧤", unit: "Keep {n} clean sheets", list: L20.clean },
  { metric: "winStreak", cat: "streaks", noun: "Streaker", icon: "🔥", unit: "Win {n} league matches in a row", list: L20.streak },
  { metric: "unbeaten", cat: "streaks", noun: "Untouchable", icon: "🛡️", unit: "Go {n} league matches without defeat", list: L20.unbeaten },
  { metric: "seasons", cat: "club", noun: "Survivor", icon: "🗓️", unit: "Finish {n} full seasons", list: L20.seasons },
  { metric: "titles", cat: "trophies", noun: "Champion", icon: "🏆", unit: "Win the league {n} times", list: L20.trophies },
  { metric: "cups", cat: "trophies", noun: "Cup Hunter", icon: "🥇", unit: "Win the League Cup {n} times", list: L20.trophies },
  { metric: "objectives", cat: "club", noun: "Board Pleaser", icon: "📋", unit: "Meet the board's objective {n} times", list: L20.trophies },
  { metric: "signed", cat: "transfers", noun: "Scout", icon: "🔍", unit: "Sign {n} players", list: L20.count },
  { metric: "sold", cat: "transfers", noun: "Dealer", icon: "🤑", unit: "Sell {n} players", list: L20.count },
  { metric: "spent", cat: "transfers", noun: "Big Spender", icon: "💸", unit: "Spend €{n}M on transfers", list: L20.money },
  { metric: "income", cat: "transfers", noun: "Merchant", icon: "💰", unit: "Earn €{n}M from sales", list: L20.money },
  { metric: "sessions", cat: "club", noun: "Coach", icon: "🏋️", unit: "Run {n} training sessions", list: L20.sessions },
  { metric: "friendlies", cat: "club", noun: "Warm-up Pro", icon: "🎽", unit: "Play {n} friendlies", list: L20.count },
  { metric: "friendlyWins", cat: "club", noun: "Friendly Fire", icon: "🎯", unit: "Win {n} friendlies", list: L20.count },
  { metric: "press", cat: "club", noun: "Spokesman", icon: "🎤", unit: "Give {n} press conferences", list: L20.press },
];

const tierAt = (i: number, n: number): Tier => {
  const f = n <= 1 ? 0 : i / (n - 1);
  return f < 0.35 ? "easy" : f < 0.7 ? "medium" : f < 0.9 ? "hard" : "legend";
};

function fromSeries(): Badge[] {
  const out: Badge[] = [];
  for (const s of SERIES) {
    s.list.forEach((n, i) => {
      const tier = tierAt(i, s.list.length);
      const rank = RANKS[Math.round((i / (s.list.length - 1)) * (RANKS.length - 1))];
      out.push({
        id: `${s.metric}-${n}`,
        cat: s.cat,
        name: `${rank} ${s.noun}`,
        desc: s.unit.replace("{n}", String(n)),
        icon: s.icon,
        tier,
        xp: TIER_XP[tier],
        metric: s.metric,
        target: n,
      });
    });
  }
  return out;
}

type Special = [metric: string, target: number, name: string, desc: string, icon: string, tier: Tier];
const SPECIAL: Special[] = [
  ["sameClubTitles", 2, "Faithful", "Win the league twice with the same club", "💛", "medium"],
  ["sameClubTitles", 3, "Loyal", "Win the league 3 times with the same club", "💍", "hard"],
  ["sameClubTitles", 4, "Old Guard", "Win the league 4 times with the same club", "🏰", "hard"],
  ["sameClubTitles", 5, "Dynasty", "Win the league 5 times with the same club", "👑", "legend"],
  ["doubles", 1, "The Double", "Win the league and the League Cup in one season", "✌️", "hard"],
  ["doubles", 3, "Double Trouble", "Do the double 3 times", "🎭", "legend"],
  ["backToBack", 2, "Back to Back", "Win the league two seasons in a row", "🔁", "hard"],
  ["backToBack", 3, "Three-peat", "Win the league three seasons in a row", "🔱", "legend"],
  ["invincible", 1, "Invincible", "Finish a whole season without losing a league match", "🦸", "legend"],
  ["fortress", 1, "Fortress", "Finish a season without losing at home", "🏯", "hard"],
  ["cinderella", 1, "Cinderella Story", "Win the league with a club that is not a big one", "👠", "legend"],
  ["giantKiller", 1, "Giant Killer", "Beat one of the biggest clubs", "🗡️", "easy"],
  ["giantKiller", 5, "Giant Hunter", "Beat the biggest clubs 5 times", "🐉", "medium"],
  ["giantKiller", 10, "Giant Slayer", "Beat the biggest clubs 10 times", "⚔️", "hard"],
  ["giantKiller", 25, "Titan Breaker", "Beat the biggest clubs 25 times", "🌋", "legend"],
  ["bounceBack", 1, "Phoenix", "Win right after losing 3 in a row", "🐦‍🔥", "medium"],
  ["bounceBack", 3, "Never Say Die", "Win after a 3-match losing run, 3 times", "🧗", "hard"],
  ["goalFest", 1, "Goal Fest", "Play a match with 8 goals or more", "🎆", "medium"],
  ["goalFest", 3, "Fireworks Night", "Play 3 matches with 8 goals or more", "🎇", "hard"],
  ["top4", 1, "Top Four", "Finish in the top 4", "4️⃣", "easy"],
  ["top4", 2, "Top Four Regular", "Finish in the top 4 twice", "🌟", "medium"],
  ["top4", 3, "Champions Class", "Finish in the top 4 three times", "🎖️", "medium"],
  ["top4", 5, "Always There", "Finish in the top 4 five times", "💎", "hard"],
  ["top4", 10, "Eternal Elite", "Finish in the top 4 ten times", "🪐", "legend"],
];

const SERIES2: [string, Cat, string, string, string, number[], string][] = [
  ["shutouts", "streaks", "Locked Door", "🚪", "Keep {n} clean sheets in a row", [2, 3, 4, 5, 6, 7, 8, 9, 10], ""],
  ["maxMargin", "matches", "Demolition", "🧨", "Win a match by {n} goals", [3, 4, 5, 6, 7, 8, 9, 10], ""],
  ["maxGoals", "goals", "Scoring Spree", "🎯", "Score {n} goals in one match", [3, 4, 5, 6, 7, 8, 9, 10], ""],
  ["bestPoints", "matches", "Points Hoarder", "📈", "Reach {n} points in a season", [30, 40, 50, 60, 70, 80, 85, 90, 95, 100, 105], ""],
];

export const CATALOG: Badge[] = (() => {
  const list = fromSeries();
  for (const [metric, target, name, desc, icon, tier] of SPECIAL) {
    list.push({ id: `${metric}-${target}-${name}`, cat: "special", name, desc, icon, tier, xp: TIER_XP[tier], metric, target });
  }
  for (const [metric, cat, noun, icon, unit, targets] of SERIES2) {
    targets.forEach((n, i) => {
      const tier = tierAt(i, targets.length);
      const rank = RANKS[Math.round((i / Math.max(1, targets.length - 1)) * (RANKS.length - 1))];
      list.push({ id: `${metric}-${n}`, cat, name: `${rank} ${noun}`, desc: unit.replace("{n}", String(n)), icon, tier, xp: TIER_XP[tier], metric, target: n });
    });
  }
  return list.slice(0, 500);
})();

/* ---------- coach level ---------- */

export const MAX_LEVEL = 40;
export const xpOf = (ids: Iterable<string>) => {
  const byId = new Map(CATALOG.map((b) => [b.id, b]));
  let xp = 0;
  for (const id of ids) xp += byId.get(id)?.xp ?? 0;
  return xp;
};
export const levelOf = (xp: number) => Math.min(MAX_LEVEL, Math.floor(Math.sqrt(xp / 20)) + 1);
export const xpForLevel = (level: number) => 20 * (level - 1) ** 2;
/** Training works this much better at this coach level. */
export const trainingBoost = (level: number) => 1 + 0.02 * (level - 1);
/** And players can gain a little more per season. */
export const capBoost = (level: number) => 1 + 0.01 * (level - 1);

/* ---------- the data ---------- */

type M = {
  league_id: string | null;
  season: string;
  matchday: number;
  home_club: string;
  away_club: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};
export type BadgeData = {
  club: string;
  matches: M[];
  trophies: { kind: string; season: string; club_id: string | null }[];
  deals: { kind: string; fee: number }[];
  sessions: number;
  friendlies: { home_club: string; away_club: string; home_score: number; away_score: number }[];
  press: number;
};

export async function loadBadgeData(client: SupabaseClient, userId: string, club: string): Promise<BadgeData> {
  const safe = async <T,>(p: PromiseLike<{ data: T | null }>, fallback: T): Promise<T> => {
    try {
      return ((await p).data ?? fallback) as T;
    } catch {
      return fallback;
    }
  };
  const [matches, trophies, deals, sessions, friendlies, press] = await Promise.all([
    safe(client.from("league_matches").select("league_id, season, matchday, home_club, away_club, home_score, away_score, status").eq("user_id", userId), [] as M[]),
    safe(client.from("trophies").select("kind, season, club_id").eq("user_id", userId), [] as BadgeData["trophies"]),
    safe(client.from("transfers").select("kind, fee").eq("user_id", userId), [] as BadgeData["deals"]),
    safe(client.from("training_sessions").select("id").eq("user_id", userId), [] as { id: string }[]),
    safe(client.from("friendlies").select("home_club, away_club, home_score, away_score").eq("user_id", userId), [] as BadgeData["friendlies"]),
    safe(client.from("press_quotes").select("id").eq("user_id", userId), [] as { id: string }[]),
  ]);
  return { club, matches, trophies, deals, sessions: sessions.length, friendlies, press: press.length };
}

/** Every metric an achievement can ask for. */
export function measure(d: BadgeData): Record<string, number> {
  const mine = d.matches
    .filter((m) => m.status === "completed" && m.home_score !== null && m.away_score !== null && (m.home_club === d.club || m.away_club === d.club))
    .sort((a, b) => (a.season === b.season ? a.matchday - b.matchday : a.season < b.season ? -1 : 1));

  const v: Record<string, number> = {};
  let wins = 0, draws = 0, homeWins = 0, awayWins = 0, bigWins = 0, goals = 0, clean = 0, giant = 0, bounce = 0, fest = 0;
  let winStreak = 0, maxWin = 0, unbeaten = 0, maxUnbeaten = 0, shut = 0, maxShut = 0, lossRun = 0, maxMargin = 0, maxGoals = 0;
  const bySeason = new Map<string, { pts: number; played: number; lost: number; homeLost: number }>();

  for (const m of mine) {
    const home = m.home_club === d.club;
    const f = (home ? m.home_score : m.away_score) as number;
    const a = (home ? m.away_score : m.home_score) as number;
    const opp = home ? m.away_club : m.home_club;
    goals += f;
    maxGoals = Math.max(maxGoals, f);
    if (f + a >= 8) fest++;
    const s = bySeason.get(`${m.league_id ?? ""}|${m.season}`) ?? { pts: 0, played: 0, lost: 0, homeLost: 0 };
    s.played++;
    if (a === 0) { clean++; shut++; maxShut = Math.max(maxShut, shut); } else shut = 0;
    if (f > a) {
      wins++; winStreak++; unbeaten++; s.pts += 3;
      if (home) homeWins++; else awayWins++;
      if (f - a >= 3) bigWins++;
      maxMargin = Math.max(maxMargin, f - a);
      if (getTier(opp) === "elite") giant++;
      if (lossRun >= 3) bounce++;
      lossRun = 0;
    } else if (f === a) {
      draws++; winStreak = 0; unbeaten++; s.pts += 1; lossRun = 0;
    } else {
      winStreak = 0; unbeaten = 0; lossRun++; s.lost++;
      if (home) s.homeLost++;
    }
    maxWin = Math.max(maxWin, winStreak);
    maxUnbeaten = Math.max(maxUnbeaten, unbeaten);
    bySeason.set(`${m.league_id ?? ""}|${m.season}`, s);
  }

  let seasons = 0, invincible = 0, fortress = 0, bestPoints = 0;
  for (const s of bySeason.values()) {
    if (s.played >= 30) {
      seasons++;
      if (s.lost === 0) invincible++;
      if (s.homeLost === 0) fortress++;
      bestPoints = Math.max(bestPoints, s.pts);
    }
  }

  // titles, cups and the club they were won with
  const league = d.trophies.filter((t) => t.kind === "league");
  const cups = d.trophies.filter((t) => t.kind === "league_cup");
  const perClub = new Map<string, number>();
  for (const t of league) perClub.set(t.club_id ?? "?", (perClub.get(t.club_id ?? "?") ?? 0) + 1);
  const titleSeasons = new Set(league.map((t) => t.season));
  const cupSeasons = new Set(cups.map((t) => t.season));
  const years = [...titleSeasons].map((s) => parseInt(s, 10)).filter(Number.isFinite).sort((a, b) => a - b);
  let run = 0, back = 0;
  years.forEach((y, i) => { run = i > 0 && y === years[i - 1] + 1 ? run + 1 : 1; back = Math.max(back, run); });

  // finishing in the top four, from the season tables
  const groups = new Map<string, M[]>();
  for (const m of d.matches) {
    const k = `${m.league_id ?? ""}|${m.season}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(m);
  }
  let top4 = 0;
  for (const rows of groups.values()) {
    const played = rows.filter((m) => m.status === "completed" && m.home_score !== null && (m.home_club === d.club || m.away_club === d.club)).length;
    if (played < 30 || played < rows.filter((m) => m.home_club === d.club || m.away_club === d.club).length) continue;
    const t = new Map<string, { pts: number; gd: number; gf: number }>();
    for (const m of rows) {
      if (m.status !== "completed" || m.home_score === null || m.away_score === null) continue;
      const h = t.get(m.home_club) ?? t.set(m.home_club, { pts: 0, gd: 0, gf: 0 }).get(m.home_club)!;
      const a = t.get(m.away_club) ?? t.set(m.away_club, { pts: 0, gd: 0, gf: 0 }).get(m.away_club)!;
      h.gf += m.home_score; a.gf += m.away_score; h.gd += m.home_score - m.away_score; a.gd += m.away_score - m.home_score;
      if (m.home_score > m.away_score) h.pts += 3; else if (m.home_score < m.away_score) a.pts += 3; else { h.pts++; a.pts++; }
    }
    const order = [...t.entries()].sort((x, y) => y[1].pts - x[1].pts || y[1].gd - x[1].gd || y[1].gf - x[1].gf).map(([id]) => id);
    if (order.indexOf(d.club) >= 0 && order.indexOf(d.club) < 4) top4++;
  }

  const buys = d.deals.filter((x) => x.kind === "buy");
  const sells = d.deals.filter((x) => x.kind === "sell");
  const f = d.friendlies;
  const myFriendlyWin = (x: (typeof f)[number]) => (x.home_club === d.club ? x.home_score > x.away_score : x.away_score > x.home_score);

  Object.assign(v, {
    wins, draws, played: mine.length, homeWins, awayWins, bigWins, goals, clean,
    winStreak: maxWin, unbeaten: maxUnbeaten, shutouts: maxShut, maxMargin, maxGoals, bestPoints,
    seasons, titles: league.length, cups: cups.length, objectives: d.trophies.filter((t) => t.kind === "objective").length,
    signed: buys.length, sold: sells.length,
    spent: Math.round(buys.reduce((s, x) => s + Number(x.fee), 0)),
    income: Math.round(sells.reduce((s, x) => s + Number(x.fee), 0)),
    sessions: d.sessions, friendlies: f.length, friendlyWins: f.filter(myFriendlyWin).length, press: d.press,
    sameClubTitles: Math.max(0, ...perClub.values()),
    doubles: [...titleSeasons].filter((s) => cupSeasons.has(s)).length,
    backToBack: back, invincible, fortress, top4, giantKiller: giant, bounceBack: bounce, goalFest: fest,
    cinderella: league.filter((t) => t.club_id && getTier(t.club_id) !== "elite").length,
  });
  return v;
}

export type Progress = Badge & { value: number; ratio: number; done: boolean };

export function progressOf(values: Record<string, number>, unlocked: Set<string>): Progress[] {
  return CATALOG.map((b) => {
    const value = values[b.metric] ?? 0;
    const done = unlocked.has(b.id) || value >= b.target;
    return { ...b, value: Math.min(value, b.target), ratio: done ? 1 : Math.min(1, value / b.target), done };
  });
}

/** Ids saved as unlocked, newest included. */
export async function loadUnlocked(client: SupabaseClient, userId: string): Promise<Set<string>> {
  try {
    const { data } = await client.from("achievements_unlocked").select("id").eq("user_id", userId);
    return new Set((data ?? []).map((r: { id: string }) => r.id));
  } catch {
    return new Set();
  }
}

export async function saveUnlocked(client: SupabaseClient, userId: string, ids: string[]) {
  if (!ids.length) return;
  try {
    await client.from("achievements_unlocked").upsert(ids.map((id) => ({ user_id: userId, id })), { onConflict: "user_id,id", ignoreDuplicates: true });
  } catch {
    /* it is found again on the next visit */
  }
}
