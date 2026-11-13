import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Where a signed-in manager belongs:
 * - no signed contract yet        -> contract
 * - contract signed, no club yet  -> league choice
 * - club chosen                   -> my teams home (never repeat the steps)
 */
export async function nextRoute(client: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await client
    .from("manager_contracts")
    .select("signed_at, signature_data, selected_club")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data?.signed_at || !data?.signature_data) return "/game/contract";
  if (!data.selected_club) return "/game/leagues";
  return "/game/myteams";
}
