// @ts-nocheck  (this file runs on Supabase with Deno, not in the Next.js build)
// Supabase Edge Function: plays a round of the league cup, the European cups or the CAF cups on the SERVER.
// Before deploying run:  node scripts/build-edge.mjs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { playCupRound, fetchCup } from "../_shared/src/lib/football/cup.ts";
import { playEuroRound, fetchEuro } from "../_shared/src/lib/football/europe.ts";
import { playContRound, fetchCont } from "../_shared/src/lib/football/continental.ts";
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
  const kind = String(body.kind ?? "");
  const season = String(body.season ?? "");
  const roundNo = Number(body.round_no);
  const compId = String(body.comp_id ?? "");
  if (!["cup", "euro", "cont"].includes(kind) || !season || !Number.isInteger(roundNo) || roundNo < 1) return reply(400, { error: "Bad request." });

  const { data: contract } = await asUser
    .from("manager_contracts")
    .select("selected_club, selected_league, room_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!contract?.selected_club) return reply(403, { error: "No club." });
  const myClub = contract.selected_club as string;

  const rows: any[] =
    kind === "cup" ? await fetchCup(admin, user.id, season, contract.selected_league)
    : kind === "euro" ? await fetchEuro(admin, user.id, compId, season)
    : await fetchCont(admin, user.id, compId, season);

  const round = rows.filter((m) => m.round_no === roundNo);
  if (!round.length) return reply(404, { error: "No such round." });
  const mine = round.find((m) => m.home_club === myClub || m.away_club === myClub);
  if (!mine) return reply(403, { error: "Your club does not play this round." });

  const answer = (list: any[], playedAt: string | null, already = false) =>
    reply(200, { scores: list.map((m) => ({ id: m.id, hs: m.home_score, as: m.away_score })), playedAt, already });
  if (!round.some((m) => m.status === "scheduled")) return answer(round, mine.played_at, true);

  // rounds go in order, and never before the kickoff (database clock)
  if (rows.some((m) => m.round_no < roundNo && m.status === "scheduled" && (m.home_club === myClub || m.away_club === myClub))) return reply(409, { error: "Play the earlier round first." });
  if (mine.kickoff_at && new Date(mine.kickoff_at).getTime() > Date.now()) return reply(425, { error: "The match has not kicked off yet." });

  store.clear();
  const { data: prefs } = await asUser.from("manager_prefs").select("k, v").eq("user_id", user.id);
  for (const r of prefs ?? []) store.set(r.k, r.v);
  const own = (k: string) => k.startsWith(`gsm-lineup:${user.id}:`) || k.startsWith(`gsm-tactic:${user.id}:`);
  for (const [k, v] of Object.entries(body.prefs ?? {})) if (own(k) && typeof v === "string" && v.length < 20000) store.set(k, v);

  const sim = await loadSim(asUser, { userId: user.id, clubId: myClub, roomId: kind === "cup" ? contract.room_id ?? null : null, season, matchday: null, leagueId: contract.selected_league });
  const played =
    kind === "cup" ? await playCupRound(admin, rows, roundNo, myClub, contract.room_id ?? user.id, sim)
    : kind === "euro" ? await playEuroRound(admin, rows, roundNo, myClub, user.id, sim)
    : await playContRound(admin, rows, roundNo, myClub, user.id, sim);

  const entries = [...(played.mine ? [played.mine] : []), ...played.others];
  return answer(entries.map((e) => e.match), entries[0]?.match.played_at ?? new Date().toISOString());
}

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return alone(() => handle(req)).catch((e) => {
    console.error("play-round failed:", e);
    return reply(500, { error: "The server could not play this matchday." });
  });
});
