"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { activeSeason } from "@/lib/football/season";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { CUP_ROUNDS } from "@/lib/football/cup";
import Icon from "./Icon";
import "./kickoff.css";


type NextMatch = {
  id: string;
  kind: "league" | "cup";
  title: string;
  matchday: number;
  home_club: string;
  away_club: string;
  kickoff_at: string | null;
};

/**
 * Sits in the game layout, so it follows the manager through every screen.
 * When the kickoff time of the next match arrives it shows a banner (and a
 * browser notification if the manager turned them on in the match centre).
 */
export default function KickoffNotifier() {
  const router = useRouter();
  const pathname = usePathname();

  const [next, setNext] = useState<NextMatch | null>(null);
  const [now, setNow] = useState(0);
  const [dismissed, setDismissed] = useState<string | null>(null);

  // find the manager's next scheduled match (again after every page change)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: contract } = await supabase
          .from("manager_contracts")
          .select("selected_club, selected_league")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!contract?.selected_club || !contract?.selected_league) return;

        const season = await activeSeason(supabase, user.id, contract.selected_league);

        const { data } = await supabase
          .from("league_matches")
          .select("id, matchday, home_club, away_club, kickoff_at")
          .eq("user_id", user.id)
          .eq("league_id", contract.selected_league)
          .eq("season", season)
          .eq("status", "scheduled")
          .or(
            `home_club.eq.${contract.selected_club},away_club.eq.${contract.selected_club}`
          )
          .order("matchday", { ascending: true })
          .limit(1);

        const league = data?.[0]
          ? ({
              ...data[0],
              id: `league-${data[0].id}`,
              kind: "league",
              title: `Matchday ${data[0].matchday} is ready`,
            } as NextMatch)
          : null;

        // the cup (the table may not exist yet, which is fine)
        let cup: NextMatch | null = null;
        try {
          const { data: ties } = await supabase
            .from("cup_matches")
            .select("id, round_no, home_club, away_club, kickoff_at")
            .eq("user_id", user.id)
            .eq("season", season)
            .eq("status", "scheduled")
            .or(
              `home_club.eq.${contract.selected_club},away_club.eq.${contract.selected_club}`
            )
            .order("round_no", { ascending: true })
            .limit(1);
          if (ties?.[0]) {
            cup = {
              id: `cup-${ties[0].id}`,
              kind: "cup",
              title: `Cup: ${CUP_ROUNDS[ties[0].round_no]?.label ?? "tie"} is ready`,
              matchday: 100 + ties[0].round_no,
              home_club: ties[0].home_club,
              away_club: ties[0].away_club,
              kickoff_at: ties[0].kickoff_at,
            };
          }
        } catch {
          cup = null;
        }

        // show whichever is ready first
        const pick =
          league && cup
            ? new Date(cup.kickoff_at ?? 0).getTime() <= new Date(league.kickoff_at ?? 0).getTime()
              ? cup
              : league
            : (cup ?? league);

        if (!cancelled) setNext(pick);
      } catch {
        if (!cancelled) setNext(null);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // one tick a second: sleeping tabs and long waits both stay correct
useEffect(() => {
  setNow(Date.now());

  const timer = setInterval(() => {
    setNow(Date.now());
  }, 1000);

  return () => clearInterval(timer);
}, []);

  const ready =
    !!next?.kickoff_at && new Date(next.kickoff_at).getTime() <= now;

  // browser notification, once per matchday
  useEffect(() => {
    if (!ready || !next) return;
    try {
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        const home = clubs.find((c) => c.id === next.home_club)?.name;
        const away = clubs.find((c) => c.id === next.away_club)?.name;
        new Notification(next.title, {
          body: `${home} v ${away}. Open GSM and start your match.`,
          tag: `gsm-${next.id}`,
        });
      }
    } catch {
      /* notifications are optional */
    }
  }, [ready, next]);

  if (!next || !ready || dismissed === next.id) return null;
  if (pathname?.startsWith("/game/fixtures") || pathname?.startsWith("/game/cup")) return null;

  const home = clubs.find((c) => c.id === next.home_club);
  const away = clubs.find((c) => c.id === next.away_club);

  return (
    <div className="ko-banner gx-cut" role="alert">
      <div className="ko-crests" aria-hidden="true">
        {home && <img src={home.logo} alt="" />}
        <span>v</span>
        {away && <img src={away.logo} alt="" />}
      </div>

      <div className="ko-text">
        <strong>{next.title}</strong>
        <span>
          {home?.name} v {away?.name}
        </span>
      </div>

      <button
        type="button"
        className="gx-btn ko-go"
        onClick={() => router.push(next.kind === "cup" ? "/game/cup" : "/game/fixtures")}
      >
        Start match
      </button>

      <button
        type="button"
        className="ko-close"
        onClick={() => setDismissed(next.id)}
        aria-label="Dismiss"
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
