/**
 * Deals between managers of a shared league (supabase/025_transfer_security.sql).
 *
 * Every function here calls a database function that checks the owner of the player and the
 * money of the buyer, takes a lock on the player, and writes the deal. A deal is only reported
 * as done after the database has confirmed it: the new owner is read back from the table.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Player } from "@/lib/football/squads";
import { recordDeal } from "@/lib/football/transfers";

export type DealCtx = {
  roomId: string | null;
  userId: string;
  clubId: string;
  leagueId: string;
  season: string;
  matchday: number | null;
  /** what the club can spend now, in millions */
  spendM: number;
  squadSize: number;
};

export type ManagerListing = {
  id: string;
  room_id: string;
  seller_id: string;
  seller_club: string;
  player_id: string;
  asking: number;
  status: string;
  created_at: string;
};

export type LogRow = {
  id: string;
  season: string;
  player_id: string;
  from_club: string;
  to_club: string;
  fee: number;
  matchday: number;
  created_at: string;
};

/** the plain sentence the database raised, without the technical wrapping */
export function dealError(err: unknown): string {
  const m = (err as { message?: string })?.message ?? "";
  if (!m || /fetch|network|failed to/i.test(m)) return "No connection. Nothing was changed: try again.";
  if (/function .* does not exist|could not find the function/i.test(m)) return "The transfer system is not installed yet: run supabase/025_transfer_security.sql.";
  if (/permission denied|violates row-level/i.test(m)) return `The database refused this (${m}). Run supabase/029_fix_transfer_permissions.sql, then try again.`;
  return m;
}

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(dealError(error));
  return data;
}

/** reads the owner back: a deal is only real once this says so */
async function confirmOwner(client: SupabaseClient, roomId: string, playerId: string, club: string) {
  const { data, error } = await client.from("room_player_owner").select("club_id").eq("room_id", roomId).eq("player_id", playerId).maybeSingle();
  if (error || data?.club_id !== club) throw new Error("The deal could not be confirmed. Nothing was charged: check Transfer Windows before trying again.");
}

/** a signing from the world market or a computer club */
export async function signFromClub(client: SupabaseClient, c: DealCtx, player: Player, fee: number) {
  if (!c.roomId) {
    await recordDeal(client, { league_id: c.leagueId, user_id: c.userId, season: c.season, player_id: player.id, from_club: player.club, to_club: c.clubId, fee, kind: "buy", matchday: c.matchday ?? 0 });
    return;
  }
  await must(client.rpc("room_sign", { p_room: c.roomId, p_player: player.id, p_from_club: player.club, p_fee: fee, p_season: c.season, p_matchday: c.matchday ?? 0, p_balance: c.spendM, p_squad: c.squadSize }));
  await confirmOwner(client, c.roomId, player.id, c.clubId);
}

/** Buy Now: the asking price, at once */
export async function buyNow(client: SupabaseClient, c: DealCtx, listing: ManagerListing) {
  await must(client.rpc("buy_manager_listing", { p_listing: listing.id, p_buyer_club: c.clubId, p_season: c.season, p_matchday: c.matchday ?? 0, p_balance: c.spendM, p_squad: c.squadSize }));
  await confirmOwner(client, listing.room_id, listing.player_id, c.clubId);
}

export async function listPlayer(client: SupabaseClient, roomId: string, playerId: string, asking: number) {
  await must(client.rpc("listing_create", { p_room: roomId, p_player: playerId, p_asking: asking }));
}

export async function withdrawListing(client: SupabaseClient, id: string) {
  await must(client.rpc("listing_withdraw", { p_listing: id }));
}

export async function loadListings(client: SupabaseClient, roomId: string): Promise<ManagerListing[]> {
  const { data } = await client.from("manager_listings").select("*").eq("room_id", roomId).eq("status", "open").order("created_at", { ascending: false });
  return ((data ?? []) as ManagerListing[]).map((l) => ({ ...l, asking: Number(l.asking) }));
}

/** Make Offer: goes to the manager who owns the player */
export async function makeOffer(client: SupabaseClient, c: DealCtx, playerId: string, amount: number): Promise<string> {
  if (!c.roomId) throw new Error("You are not in a shared league.");
  return must(client.rpc("offer_send", { p_room: c.roomId, p_player: playerId, p_amount: amount, p_season: c.season, p_balance: c.spendM })) as Promise<string>;
}

export async function answerOffer(client: SupabaseClient, offerId: string, action: "reject" | "counter" | "withdraw", counter?: number) {
  await must(client.rpc("offer_answer", { p_offer: offerId, p_action: action, p_counter: counter ?? null }));
}

/** the seller accepts an open offer, or the buyer accepts the counter price */
export async function acceptOffer(client: SupabaseClient, c: DealCtx, offerId: string, roomId: string, playerId: string, newOwnerClub: string) {
  await must(client.rpc("accept_manager_offer", { p_offer: offerId, p_season: c.season, p_matchday: c.matchday ?? 0, p_balance: c.spendM, p_squad: c.squadSize }));
  await confirmOwner(client, roomId, playerId, newOwnerClub);
}

/** the central record of the league */
export async function loadLog(client: SupabaseClient, roomId: string): Promise<LogRow[]> {
  const { data, error } = await client.rpc("room_transfer_log", { p_room: roomId, p_limit: 300 });
  if (error) return [];
  return ((data ?? []) as LogRow[]).map((r) => ({ ...r, fee: Number(r.fee), created_at: String(r.created_at) }));
}

/** A computer club pays for a player the manager listed in a shared league (the league's own rules are checked by the database). */
export async function sellToComputer(client: SupabaseClient, listingId: string, club: string, fee: number, season: string, matchday: number): Promise<void> {
  await must(client.rpc("listing_sell_to_computer", { p_listing: listingId, p_club: club, p_fee: fee, p_season: season, p_matchday: matchday }));
}
