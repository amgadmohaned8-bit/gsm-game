// @ts-nocheck  (this file runs on Supabase with Deno, not in the Next.js build)
// Supabase Edge Function "play-friendly": plays a friendly on the SERVER (venue, shine and score are decided here) and saves it.
// Before deploying run:  node scripts/build-edge.mjs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { simulateFixture } from "../_shared/src/lib/football/matchSim.ts";
import { FRIENDLIES_PER_ROUND } from "../_shared/src/lib/football/friendlies.ts";
import { currentLineup, loadSim } from "../_shared/src/lib/football/strength.ts";
import { sessionGain } from "../_shared/src/lib/football/development.ts";
import { squadOf } from "../_shared/src/lib/football/squads.ts";
import { clubsOfLeague } from "../_shared/src/lib/football/leagueClubs.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors });

// the engine reads the lineup and the tactic from "localStorage": on the server it is a private, per-request copy
const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  },
});

// one request at a time, so two managers never share that copy
let queue: Promise<unknown> = Promise.resolve();
const alone = <T,>(job: () => Promise<T>): Promise<T> => {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
};

async function handle(req: Request): Promise<Response> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: u } = await asUser.auth.getUser();
  const user = u?.user;
  if (!user) return reply(401, { error: "Sign in first." });

  const body = await req.json().catch(() => ({}));
  const season = String(body.season ?? "");
  const opponent = String(body.opponent ?? "");
  const slot = Number(body.slot);
  if (!season || !opponent || !Number.isInteger(slot) || slot < 1) return reply(400, { error: "Bad request." });

  const { data: contract } = await asUser.from("manager_contracts").select("selected_club, selected_league, room_id").eq("user_id", user.id).maybeSingle();
  if (!contract?.selected_club) return reply(403, { error: "No club." });
  const myClub = contract.selected_club as string;
  const leagueId = contract.selected_league || "premier-league";
  if (opponent === myClub) return reply(400, { error: "Pick another club." });

  // the opponent is a club of this league, and the round is the one open now
  const { data: rows } = await admin.from("league_matches").select("home_club, away_club, matchday, status").eq("user_id", user.id).eq("league_id", leagueId).eq("season", season);
  const list = (rows ?? []) as { home_club: string; away_club: string; matchday: number; status: string }[];
  const known = new Set([...list.flatMap((m) => [m.home_club, m.away_club]), ...clubsOfLeague(leagueId).map((c) => c.id)]);
  if (!known.has(opponent)) return reply(400, { error: "That club is not in your league." });
  const open = list.filter((m) => m.status === "scheduled").map((m) => m.matchday);
  const openSlot = open.length ? Math.min(...open) : list.length === 0 ? 1 : null;
  if (openSlot === null || openSlot !== slot) return reply(409, { error: "This round is not open for friendlies." });

  const { data: played } = await admin.from("friendlies").select("home_club, away_club").eq("user_id", user.id).eq("season", season).eq("after_matchday", slot).eq("league_id", leagueId);
  const done = (played ?? []) as { home_club: string; away_club: string }[];
  if (done.length >= FRIENDLIES_PER_ROUND) return reply(409, { error: "No more friendlies this round." });
  if (done.some((f) => f.home_club === opponent || f.away_club === opponent)) return reply(409, { error: "You already played this club this round." });

  store.clear();
  const { data: prefs } = await asUser.from("manager_prefs").select("k, v").eq("user_id", user.id);
  for (const r of prefs ?? []) store.set(r.k, r.v);
  const sim = await loadSim(asUser, { userId: user.id, clubId: myClub, roomId: null, season, matchday: slot, leagueId });

  const home = Math.random() < 0.5; // only the venue is random
  const shine = 4 + Math.floor(Math.random() * 4);
  const homeClub = home ? myClub : opponent;
  const awayClub = home ? opponent : myClub;
  const count = done.length;
  const result = simulateFixture({
    leagueKey: `friendly|${user.id}`,
    season,
    matchday: 100 + slot + count * 1000,
    homeClub,
    awayClub,
    homeBonus: (sim.bonus[homeClub] ?? 0) + (homeClub === myClub ? shine : 0),
    awayBonus: (sim.bonus[awayClub] ?? 0) + (awayClub === myClub ? shine : 0),
    squads: sim.squads,
  });

  const oppManager = typeof body.opp_manager === "string" ? body.opp_manager.slice(0, 40) : null;
  const { error: ins } = await admin.from("friendlies").insert({
    user_id: user.id, season, after_matchday: slot, home_club: homeClub, away_club: awayClub,
    home_score: result.home_score, away_score: result.away_score, income: 0, league_id: leagueId, opp_manager: oppManager,
  });
  if (ins) return reply(500, { error: "Could not save the friendly." });

  // match practice: the starters gain a small share of a training session
  try {
    const own = sim.squads?.[myClub] ?? squadOf(myClub);
    const tr = currentLineup(user.id, myClub, own).starters.map((p) => ({
      user_id: user.id, league_id: leagueId, season, matchday: -(slot * 10 + count + 1), player_id: p.id,
      gain: Math.max(0.01, Math.round(sessionGain(p.age) * 0.2 * 100) / 100),
    }));
    if (tr.length) await admin.from("training_sessions").insert(tr);
  } catch { /* the friendly still counts */ }

  return reply(200, { home: homeClub, away: awayClub, result });
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return alone(() => handle(req)).catch((e) => {
    console.error("play-friendly failed:", e);
    return reply(500, { error: "The server could not play this matchday." });
  });
});
