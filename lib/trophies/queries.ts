import type { SupabaseClient } from '@supabase/supabase-js';
import type { TrophyWin } from './aggregate';

/** Every trophy one manager has won. Works with the browser or the server client. */
export async function fetchManagerTrophies(
  supabase: SupabaseClient,
  managerId: string,
): Promise<TrophyWin[]> {
  const { data, error } = await supabase
    .from('manager_trophies')
    .select('id, trophy_type, season, club_id, club_name')
    .eq('manager_id', managerId)
    .order('season', { ascending: true });

  if (error) throw error;
  return (data ?? []) as TrophyWin[];
}
