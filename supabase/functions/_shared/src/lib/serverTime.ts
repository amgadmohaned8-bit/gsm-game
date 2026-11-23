// @ts-nocheck
/**
 * The game's clock is the database clock, never the device clock.
 * A player who moves the time of the phone or the computer forward or back gains nothing:
 * every time check (kickoff, training, market rotation, cooldowns) reads nowMs().
 */
import type { SupabaseClient } from "@supabase/supabase-js";

let offset = 0;
let synced = false;

/** The current time in milliseconds, corrected to the server clock once it is known. */
export const nowMs = () => Date.now() + offset;

/** How far the device clock is from the server clock (ms): positive when the device is behind. */
export const clockOffsetMs = () => offset;

export const clockSynced = () => synced;

/** Asks the database for its time. Takes the middle of the round trip as the moment of the answer. */
export async function syncServerTime(client: SupabaseClient): Promise<number | null> {
  try {
    const before = Date.now();
    const { data, error } = await client.rpc("server_now");
    const after = Date.now();
    if (error || !data) return null;
    const server = new Date(data as string).getTime();
    if (!Number.isFinite(server)) return null;
    offset = Math.round(server - (before + after) / 2);
    synced = true;
    return offset;
  } catch {
    return null;
  }
}
