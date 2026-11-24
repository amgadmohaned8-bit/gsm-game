/**
 * Asks the server (Supabase Edge Function "play-matchday") to play a league matchday.
 * Returns the scores it saved, or null when the function is not deployed yet
 * (the page then plays on the device, as before).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { scoreKey } from "@/lib/football/strength";
import type { SimulationResult } from "@/lib/football/matchSim";
import type { Revised } from "@/lib/football/halftime";

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

/** A cup, European or CAF round played by the server ("play-round"): the scores it saved, by match id. */
export type ServerCompRound = { scores: Map<string, { home: number; away: number }>; playedAt: string };

export async function playRoundOnServer(
  client: SupabaseClient,
  kind: "cup" | "euro" | "cont",
  season: string,
  roundNo: number,
  compId: string | null,
  prefs: Record<string, string>
): Promise<ServerCompRound | null> {
  const { data, error } = await client.functions.invoke("play-round", { body: { kind, season, round_no: roundNo, comp_id: compId, prefs } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === undefined || status === 404) return null;
    let message = "The server refused this match.";
    try { message = (await (error as { context: Response }).context.json()).error ?? message; } catch { /* keep the default */ }
    throw new Error(message);
  }
  const rows = (data?.scores ?? []) as { id: string; hs: number; as: number }[];
  return { scores: new Map(rows.map((r) => [r.id, { home: r.hs, away: r.as }])), playedAt: String(data?.playedAt ?? new Date().toISOString()) };
}

/** The lineups and tactics of this manager kept on the device: sent along so the server plays with the latest ones. */
export function ownPrefs(userId: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(`gsm-lineup:${userId}:`) || k.startsWith(`gsm-tactic:${userId}:`))) out[k] = localStorage.getItem(k) ?? "";
    }
  } catch { /* the saved ones are used */ }
  return out;
}

/** A friendly played by the server ("play-friendly"). Null when the function is not deployed yet. */
export async function friendlyOnServer(client: SupabaseClient, season: string, slot: number, opponent: string, oppManager: string | null): Promise<{ home: string; away: string; result: SimulationResult } | null> {
  const { data, error } = await client.functions.invoke("play-friendly", { body: { season, slot, opponent, opp_manager: oppManager } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === undefined || status === 404) return null;
    let message = "The server refused this friendly.";
    try { message = (await (error as { context: Response }).context.json()).error ?? message; } catch { /* keep the default */ }
    throw new Error(message);
  }
  return data as { home: string; away: string; result: SimulationResult };
}

/** The half-time changes decided by the server ("play-halftime"), once per match. Null when it is not deployed yet. */
export async function halftimeOnServer(client: SupabaseClient, matchId: string, starters: string[], style: string, prefs: Record<string, string>): Promise<Revised | null> {
  const { data, error } = await client.functions.invoke("play-halftime", { body: { match_id: matchId, starters, style, prefs } });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === undefined || status === 404) return null;
    let message = "The server refused these changes.";
    try { message = (await (error as { context: Response }).context.json()).error ?? message; } catch { /* keep the default */ }
    throw new Error(message);
  }
  return data as Revised;
}

/**
 * Asks the server (Edge Function "settle-sales") to complete the sales of listed players that are due.
 * Returns true when the server did it (the page then only reads the result), false when the function is
 * not deployed yet (the page completes the sales itself, as before). Asked at most once every 15 seconds.
 */
let lastSettle = 0;
let lastServed = false;
export async function settleOnServer(client: SupabaseClient): Promise<boolean> {
  if (Date.now() - lastSettle < 15_000) return lastServed;
  lastSettle = Date.now();
  try {
    const { error } = await client.functions.invoke("settle-sales", { body: {} });
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      lastServed = !(status === undefined || status === 404);
    } else {
      lastServed = true;
    }
  } catch {
    lastServed = false;
  }
  return lastServed;
}
