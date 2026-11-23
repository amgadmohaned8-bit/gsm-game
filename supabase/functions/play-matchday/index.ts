// @ts-nocheck  (this file runs on Supabase with Deno, not in the Next.js build)
// Supabase Edge Function: plays a league matchday on the SERVER and saves the scores.
// The browser only asks; it can no longer decide a score.
// Before deploying run:  node scripts/build-edge.mjs   (copies the match engine next to this function)
// Secrets used (Supabase gives them to every function itself): SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { playMatchday } from "../_shared/src/lib/football/matchday.ts";
import { loadSim } from "../_shared/src/lib/football/strength.ts";

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
  const matchday = Number(body.matchday);
  if (!season || !Number.isInteger(matchday) || matchday < 1) return reply(400, { error: "Bad request." });

  const { data: contract } = await asUser
    .from("manager_contracts")
    .select("selected_club, selected_league, room_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!contract?.selected_club) return reply(403, { error: "No club." });
  const myClub = contract.selected_club as string;

  // the manager's own fixtures of this league and season, read with the service key but only his rows
  const { data: all } = await admin
    .from("league_matches")
    .select("*")
    .eq("user_id", user.id)
    .eq("league_id", contract.selected_league)
    .eq("season", season)
    .order("matchday", { ascending: true });
  const matches = (all ?? []) as any[];
  const round = matches.filter((m) => m.matchday === matchday);
  if (!round.length) return reply(404, { error: "No such matchday." });

  const mine = round.find((m) => m.home_club === myClub || m.away_club === myClub);
  if (!mine) return reply(403, { error: "Your club does not play this round." });

  // the matches are played in order, and never before the kickoff of the manager's match (database clock)
  const earlier = matches.filter((m) => m.matchday < matchday && m.status !== "completed" && (m.home_club === myClub || m.away_club === myClub));
  if (earlier.length) return reply(409, { error: "Play the earlier matchday first." });
  if (mine.kickoff_at && new Date(mine.kickoff_at).getTime() > Date.now()) return reply(425, { error: "The match has not kicked off yet." });

  const scheduled = round.filter((m) => m.status === "scheduled");
  if (!scheduled.length) {
    // already played (a double tap, a second phone): return what is saved
    return reply(200, { scores: round.map((m) => ({ home: m.home_club, away: m.away_club, hs: m.home_score, as: m.away_score })), playedAt: mine.played_at, already: true });
  }

  // the lineup and the tactic of THIS manager: saved ones first, then the ones the page just sent
  store.clear();
  const { data: prefs } = await asUser.from("manager_prefs").select("k, v").eq("user_id", user.id);
  for (const r of prefs ?? []) store.set(r.k, r.v);
  const own = (k: string) => k.startsWith(`gsm-lineup:${user.id}:`) || k.startsWith(`gsm-tactic:${user.id}:`);
  for (const [k, v] of Object.entries(body.prefs ?? {})) if (own(k) && typeof v === "string" && v.length < 20000) store.set(k, v);

  const sim = await loadSim(asUser, { userId: user.id, clubId: myClub, roomId: contract.room_id ?? null, season, matchday, leagueId: contract.selected_league });
  // the server's own picture of the match: no browser value reaches the score
  const played = await playMatchday(admin, matches, matchday, myClub, contract.room_id ?? user.id, sim);

  const entries = [...(played.mine ? [played.mine] : []), ...played.others];
  return reply(200, {
    scores: entries.map((e) => ({ home: e.match.home_club, away: e.match.away_club, hs: e.result.home_score, as: e.result.away_score })),
    playedAt: entries[0]?.match.played_at ?? new Date().toISOString(),
  });
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return alone(() => handle(req)).catch((e) => {
    console.error("play-matchday failed:", e);
    return reply(500, { error: "The server could not play this matchday." });
  });
});
