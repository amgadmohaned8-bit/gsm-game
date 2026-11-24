// @ts-nocheck  (this file runs on Supabase with Deno, not in the Next.js build)
// Supabase Edge Function "play-halftime": changes the second half of a match just played (substitutes and style), once per match, and saves the new score.
// Before deploying run:  node scripts/build-edge.mjs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { replayFixture } from "../_shared/src/lib/football/matchday.ts";
import { reviseSecondHalf, MAX_SUBS } from "../_shared/src/lib/football/halftime.ts";
import { bonusFor, currentLineup, loadSim } from "../_shared/src/lib/football/strength.ts";
import { availableSquad } from "../_shared/src/lib/football/availability.ts";
import { squadOf } from "../_shared/src/lib/football/squads.ts";
import { allClubs } from "../_shared/src/lib/football/leagueClubs.ts";

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
  const matchId = String(body.match_id ?? "");
  const style = ["attack", "balanced", "defend"].includes(body.style) ? body.style : "balanced";
  const ids: string[] = Array.isArray(body.starters) ? body.starters.map(String) : [];
  if (!matchId || ids.length !== 11 || new Set(ids).size !== 11) return reply(400, { error: "Bad request." });

  const { data: contract } = await asUser.from("manager_contracts").select("selected_club, selected_league, room_id").eq("user_id", user.id).maybeSingle();
  if (!contract?.selected_club) return reply(403, { error: "No club." });
  const myClub = contract.selected_club as string;

  const { data: match } = await admin.from("league_matches").select("*").eq("id", matchId).eq("user_id", user.id).maybeSingle();
  if (!match || (match.home_club !== myClub && match.away_club !== myClub)) return reply(404, { error: "No such match." });
  if (match.status !== "completed" || !match.played_at) return reply(409, { error: "The match is not played yet." });
  if (Date.now() - new Date(match.played_at).getTime() > 25 * 60 * 1000) return reply(409, { error: "Too late for half-time changes." });

  store.clear();
  const { data: prefs } = await asUser.from("manager_prefs").select("k, v").eq("user_id", user.id);
  for (const r of prefs ?? []) store.set(r.k, r.v);
  const own = (k: string) => k.startsWith(`gsm-lineup:${user.id}:`) || k.startsWith(`gsm-tactic:${user.id}:`);
  for (const [k, v] of Object.entries(body.prefs ?? {})) if (own(k) && typeof v === "string" && v.length < 20000) store.set(k, v);

  const leagueKey = contract.room_id ?? user.id;
  const sim = await loadSim(asUser, { userId: user.id, clubId: myClub, roomId: contract.room_id ?? null, season: match.season, matchday: match.matchday, leagueId: contract.selected_league });
  const squad = sim.squads?.[myClub] ?? squadOf(myClub);
  const day = { key: leagueKey, season: match.season, matchday: match.matchday };
  const eleven = currentLineup(user.id, myClub, squad, day).starters;
  const fit = availableSquad(squad, day.key, day.season, day.matchday);
  const pool = new Map(fit.map((p) => [p.id, p]));
  const chosen = ids.map((id) => pool.get(id));
  if (chosen.some((p) => !p)) return reply(400, { error: "A chosen player is not available." });
  const before = new Set(eleven.map((p) => p.id));
  if (ids.filter((id) => !before.has(id)).length > MAX_SUBS) return reply(400, { error: "At most three substitutes." });

  // one set of changes per match, kept by the server
  const { error: used } = await admin.from("halftime_used").insert({ user_id: user.id, match_id: matchId });
  if (used) return reply(409, { error: used.code === "23505" ? "The half-time changes were already made." : "Could not save the changes." });

  const home = match.home_club === myClub;
  const opp = home ? match.away_club : match.home_club;
  const base = replayFixture(match, leagueKey, sim);
  const delta = (bonusFor(chosen as any, myClub) - bonusFor(eleven, myClub)) * 0.6;
  const nameOf = (id: string) => allClubs.find((c) => c.id === id)?.name ?? id;
  const revised = reviseSecondHalf({
    events: base.events,
    myIsHome: home,
    delta,
    style,
    seed: `${leagueKey}|${match.season}|${match.matchday}|${match.home_club}|${match.away_club}|ht|${ids.join(",")}|${style}`,
    myClub,
    myEleven: chosen as any,
    mySquad: squad,
    theirSquad: availableSquad(squadOf(opp), day.key, day.season, day.matchday),
    clubName: { mine: nameOf(myClub), theirs: nameOf(opp) },
  });

  const { error: up } = await admin.from("league_matches").update({ home_score: revised.home_score, away_score: revised.away_score }).eq("id", matchId);
  if (up) return reply(500, { error: "Could not save the result." });
  if (contract.room_id) {
    await admin.from("room_results").update({ home_score: revised.home_score, away_score: revised.away_score })
      .eq("room_id", contract.room_id).eq("season", match.season).eq("matchday", match.matchday).eq("home_club", match.home_club).eq("away_club", match.away_club);
  }
  return reply(200, revised);
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return alone(() => handle(req)).catch((e) => {
    console.error("play-halftime failed:", e);
    return reply(500, { error: "The server could not play this matchday." });
  });
});
