/**
 * Asks the server (Supabase Edge Function "play-matchday") to play a league matchday.
 * Returns the scores it saved, or null when the function is not deployed yet
 * (the page then plays on the device, as before).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreKey } from "@/lib/football/strength";

export type ServerRound = { scores: Map<string, { home: number; away: number }>; playedAt: string };

export async function playOnServer(client: SupabaseClient, season: string, matchday: number, prefs: Record<string, string>): Promise<ServerRound | null> {
  const { data, error } = await client.functions.invoke("play-matchday", { body: { season, matchday, prefs } });
  if (error) {
    // not deployed: keep the old way. Any other answer (too early, not your round...) is a real refusal.
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === undefined || status === 404) return null;
    let message = "The server refused this match.";
    try { message = (await (error as { context: Response }).context.json()).error ?? message; } catch { /* keep the default */ }
    throw new Error(message);
  }
  const rows = (data?.scores ?? []) as { home: string; away: string; hs: number; as: number }[];
  return { scores: new Map(rows.map((r) => [scoreKey(r.home, r.away), { home: r.hs, away: r.as }])), playedAt: String(data?.playedAt ?? new Date().toISOString()) };
}
