/**
 * The shared transfer system of a league with several managers (supabase/024).
 *
 * Every move of a player goes through a database function that locks the player,
 * checks who owns him, the transfer window, the budget and the squad, and writes
 * one shared record (room_transfers). The app only asks; the database decides.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type RoomDeal = {
  id: string;
  seq: number;
  room_id: string;
  season: string;
  matchday: number;
  player_id: string;
  from_club: string;
  to_club: string;
  seller_id: string | null;
  buyer_id: string | null;
  fee: number;
  kind: "listing" | "offer" | "counter" | "market" | "club_buy" | "club_sell" | "abroad" | "legacy";
  created_at: string;
};

/** The league's transfer record, newest first: the same list for every manager. */
export async function loadLedger(client: SupabaseClient, roomId: string, limit = 300): Promise<RoomDeal[]> {
  try {
    const { data, error } = await client
      .from("room_transfers")
      .select("id, seq, room_id, season, matchday, player_id, from_club, to_club, seller_id, buyer_id, fee, kind, created_at")
      .eq("room_id", roomId)
      .order("seq", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return ((data ?? []) as RoomDeal[]).map((d) => ({ ...d, fee: Number(d.fee), created_at: String(d.created_at) }));
  } catch {
    return [];
  }
}

/** What the database says, in words a manager understands. */
const MESSAGES: [string, string][] = [
  ["PLAYER_MOVED", "That player is not at that club any more. The deal was cancelled."],
  ["UNKNOWN_PLAYER", "The database does not know this player yet. Run supabase/025_base_squads.sql."],
  ["WINDOW_CLOSED", "The transfer window is closed."],
  ["SIGNING_BANNED", "The bank has banned signings until the overdue debt is paid."],
  ["NO_WALLET", "The buyer's budget is not known yet. He must open the Transfers page once."],
  ["INSUFFICIENT_FUNDS", "Not enough money for this deal."],
  ["SQUAD_FULL", "The buyer's squad is full."],
  ["SQUAD_TOO_SMALL", "The seller would be left with too few players in that position."],
  ["NOT_AVAILABLE", "That is not available any more: it was sold, withdrawn or answered already."],
  ["NOT_ALLOWED", "You cannot do that."],
  ["duplicate key", "You already have an open offer or listing for this player."],
];

export function explain(err: unknown, fallback: string): string {
  const raw =
    typeof err === "object" && err && "message" in err ? String((err as { message: unknown }).message) : String(err ?? "");
  for (const [code, text] of MESSAGES) if (raw.includes(code)) return text;
  return fallback;
}

/** Put a player of my club up for sale at a fixed asking price (Buy Now). */
export async function listPlayer(client: SupabaseClient, a: { roomId: string; playerId: string; asking: number }) {
  const { error } = await client.rpc("list_room_player", { p_room: a.roomId, p_player: a.playerId, p_asking: a.asking });
  if (error) throw error;
}

export async function withdrawListing(client: SupabaseClient, listingId: string) {
  const { error } = await client.rpc("withdraw_room_listing", { p_listing: listingId });
  if (error) throw error;
}

/** Make Offer: a price to the manager who owns the player. He answers in Negotiations. */
export async function sendOffer(
  client: SupabaseClient,
  a: { roomId: string; sellerClub: string; playerId: string; amount: number; season: string }
) {
  const { error } = await client.rpc("send_room_offer", {
    p_room: a.roomId,
    p_seller_club: a.sellerClub,
    p_player: a.playerId,
    p_amount: a.amount,
    p_season: a.season,
  });
  if (error) throw error;
}

/** reject / counter (seller) or withdraw (buyer). Accepting goes through accept_manager_offer. */
export async function answerOffer(
  client: SupabaseClient,
  a: { offerId: string; action: "reject" | "counter" | "withdraw"; counter?: number }
) {
  const { error } = await client.rpc("answer_room_offer", {
    p_offer: a.offerId,
    p_action: a.action,
    p_counter: a.counter ?? null,
  });
  if (error) throw error;
}

/**
 * Live updates: calls back when an offer, a listing or a deal of the league changes.
 * Returns the function that stops listening.
 */
export function watchRoom(client: SupabaseClient, roomId: string, onChange: (table: string) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tables = new Set<string>();
  const fire = (table: string) => {
    tables.add(table);
    if (timer) clearTimeout(timer);
    // one deal touches several rows: answer once
    timer = setTimeout(() => {
      const seen = [...tables];
      tables.clear();
      seen.forEach((t) => onChange(t));
    }, 400);
  };
  const channel = client
    .channel(`room-transfers-${roomId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "manager_offers", filter: `room_id=eq.${roomId}` }, () => fire("manager_offers"))
    .on("postgres_changes", { event: "*", schema: "public", table: "manager_listings", filter: `room_id=eq.${roomId}` }, () => fire("manager_listings"))
    .on("postgres_changes", { event: "*", schema: "public", table: "room_transfers", filter: `room_id=eq.${roomId}` }, () => fire("room_transfers"))
    .subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    void client.removeChannel(channel);
  };
}
