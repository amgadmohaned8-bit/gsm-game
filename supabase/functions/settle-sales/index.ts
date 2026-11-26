// @ts-nocheck  (this file runs on Supabase with Deno, not in the Next.js build)
// Supabase Edge Function "settle-sales": completes the sales of listed players on the SERVER, by the server clock.
//  - called by the game (signed in): settles that manager's listings
//  - called by the scheduler (header x-cron-secret): settles every manager that has an open listing
// Before deploying run:  node scripts/build-edge.mjs
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { loadTransferState, dueSale, canSell } from "../_shared/src/lib/football/transfers.ts";
import { activeSeason } from "../_shared/src/lib/football/season.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Content-Type": "application/json",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: cors });

/** the first matchday not played yet; null once the season is over (same rule as the game) */
const currentMatchday = (rows: { matchday: number; status: string }[]) => {
  if (rows.length === 0) return 1;
  const open = rows.filter((m) => m.status === "scheduled").map((m) => m.matchday);
  return open.length ? Math.min(...open) : null;
};

async function settle(admin, userId: string): Promise<number> {
  const { data: contract } = await admin.from("manager_contracts").select("selected_club, selected_league").eq("user_id", userId).maybeSingle();
  if (!contract?.selected_club) return 0;
  const leagueId = contract.selected_league || "premier-league";
  const open = async () => {
    const solo = await admin.from("transfer_listings").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "open");
    const room = await admin.from("manager_listings").select("id", { count: "exact", head: true }).eq("seller_id", userId).eq("status", "open");
    return (solo.count ?? 0) + (room.count ?? 0);
  };
  const before = await open();
  if (!before) return 0;
  const season = await activeSeason(admin, userId, leagueId);
  const { data: matches } = await admin.from("league_matches").select("matchday, status").eq("user_id", userId).eq("league_id", leagueId).eq("season", season);
  const matchday = currentMatchday(matches ?? []);
  // solo listings: the state loader completes every sale that is due (a listing is claimed once, so nothing sells twice)
  const state = await loadTransferState(admin, userId, contract.selected_club, season, matchday, leagueId, false, true);

  // listings in a shared league: a computer club pays on the day, the database checks the rules
  const { data: roomListings } = await admin.from("manager_listings").select("*").eq("seller_id", userId).eq("status", "open");
  const mine = state.squads[contract.selected_club] ?? [];
  for (const l of roomListings ?? []) {
    try {
      const { data: members } = await admin.from("room_members").select("club_id").eq("room_id", l.room_id);
      const humans = new Set((members ?? []).map((m: { club_id: string }) => m.club_id));
      const player = mine.find((p) => p.id === l.player_id);
      if (!player || canSell(mine, player)) continue;
      const sale = dueSale(userId, { ...l, asking: Number(l.asking) }, player, contract.selected_club, Date.now(), humans);
      if (!sale) continue;
      const { error } = await admin.rpc("listing_sell_to_computer_as", { p_seller: userId, p_listing: l.id, p_club: sale.club, p_fee: sale.fee, p_season: season, p_matchday: matchday ?? 0 });
      if (error) console.error("room sale refused:", error.message);
    } catch (e) {
      console.error("room sale failed:", e);
    }
  }
  return Math.max(0, before - (await open()));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const secret = Deno.env.get("CRON_SECRET");
    if (secret && req.headers.get("x-cron-secret") === secret) {
      const solo = await admin.from("transfer_listings").select("user_id").eq("status", "open").limit(500);
      const room = await admin.from("manager_listings").select("seller_id").eq("status", "open").limit(500);
      const users = [...new Set([...(solo.data ?? []).map((r: { user_id: string }) => r.user_id), ...(room.data ?? []).map((r: { seller_id: string }) => r.seller_id)])];
      let sold = 0;
      for (const id of users) {
        try { sold += await settle(admin, id); } catch (e) { console.error("settle failed for", id, e); }
      }
      return reply(200, { users: users.length, sold });
    }

    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: u } = await asUser.auth.getUser();
    if (!u?.user) return reply(401, { error: "Sign in first." });
    const sold = await settle(admin, u.user.id);
    return reply(200, { sold });
  } catch (e) {
    console.error("settle-sales failed:", e);
    return reply(500, { error: "Could not settle the sales." });
  }
});
