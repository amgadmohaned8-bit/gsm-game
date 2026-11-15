/**
 * Talks between managers of a shared league (supabase/020).
 * A buyer offers a price for a player of another manager's club. The seller
 * accepts, refuses, or answers with his own price; the buyer can accept that.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendFriendNotice } from "@/lib/football/friendlies";

export type OfferStatus = "open" | "countered" | "accepted" | "rejected" | "withdrawn";

export type ManagerOffer = {
  id: string;
  room_id: string;
  buyer_id: string;
  buyer_club: string;
  seller_id: string;
  seller_club: string;
  player_id: string;
  amount: number;
  counter: number | null;
  status: OfferStatus;
  season: string;
  created_at: string;
  updated_at: string;
};

export async function loadOffers(client: SupabaseClient, userId: string): Promise<ManagerOffer[]> {
  try {
    const { data, error } = await client
      .from("manager_offers")
      .select("*")
      .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
      .order("updated_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    return ((data ?? []) as ManagerOffer[]).map((o) => ({ ...o, amount: Number(o.amount), counter: o.counter == null ? null : Number(o.counter) }));
  } catch {
    return [];
  }
}

/** the message the other manager gets (a banner, and a phone alert when the app is closed) */
export async function tellAbout(client: SupabaseClient, to: string, from: string, fromName: string, season: string, text: string) {
  await sendFriendNotice(client, { to, from, fromName, season, home: text, away: "", hs: 0, as: 0, kind: "offer" });
}
