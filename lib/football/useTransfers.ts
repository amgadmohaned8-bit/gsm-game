"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { activeSeason } from "@/lib/football/season";
import { buildFinance } from "@/lib/football/finance";
import { loadTransferState, type TransferState } from "@/lib/football/transfers";

export type TransferContext = {
  userId: string;
  clubId: string;
  leagueId: string;
  season: string;
  matchday: number | null;
  state: TransferState;
  /** club balance in millions, transfers included */
  balanceM: number;
};

/** The current matchday: the first one not played yet. Null once the season is over. */
export function currentMatchday(matches: { matchday: number; status: string }[]): number | null {
  if (matches.length === 0) return 1;
  const open = matches.filter((m) => m.status === "scheduled").map((m) => m.matchday);
  return open.length ? Math.min(...open) : null;
}

export function useTransfers() {
  const router = useRouter();
  const [ctx, setCtx] = useState<TransferContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/");

      const { data: contract } = await supabase
        .from("manager_contracts")
        .select("selected_club, selected_league")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!contract?.selected_club) return router.replace("/game/leagues");

      const leagueId = contract.selected_league || "premier-league";
      const season = await activeSeason(supabase, user.id, leagueId);

      const { data: matches } = await supabase
        .from("league_matches")
        .select("*")
        .eq("user_id", user.id)
        .eq("league_id", leagueId)
        .eq("season", season);

      const rows = matches ?? [];
      const matchday = currentMatchday(rows);
      const state = await loadTransferState(supabase, user.id, contract.selected_club, season, matchday, leagueId);
      const finance = buildFinance(contract.selected_club, rows, state.net * 1_000_000);

      setCtx({
        userId: user.id,
        clubId: contract.selected_club,
        leagueId,
        season,
        matchday,
        state,
        balanceM: finance.balance / 1_000_000,
      });
      setError("");
    } catch (err) {
      console.error("Transfer load error:", err);
      setError("Could not load the transfer market. Run supabase/004_transfers.sql first, then try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  return { ctx, loading, error, reload: load };
}
