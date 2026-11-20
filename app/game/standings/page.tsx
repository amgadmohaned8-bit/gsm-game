"use client";

import { inCareer } from "@/lib/football/leagueIds";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadDeductions } from "@/lib/football/bank";
import { leagueOf } from "@/lib/football/leaguesCatalog";
import { activeSeason, seasonLabel } from "@/lib/football/season";
import { calculateStandings, Match } from "@/lib/football/table";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import Link from "next/link";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import Leaders, { type LeaderTab } from "./Leaders";
import type { Deal } from "@/lib/football/transfers";
import type { TrainingRow } from "@/lib/football/development";
import type { Renewal } from "@/lib/football/contracts";
import "./standings.css";

export default function StandingsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [managerClub, setManagerClub] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [cut, setCut] = useState(0);
  const [error, setError] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [training, setTraining] = useState<TrainingRow[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [leagueKey, setLeagueKey] = useState("");
  const [leagueId, setLeagueId] = useState("premier-league");
  const [view, setView] = useState<"table" | LeaderTab>("table");

  useEffect(() => {
    let cancelled = false;

    async function loadStandings() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          router.replace("/");
          return;
        }

        const { data: contract, error: contractError } =
          await supabase
            .from("manager_contracts")
            .select("selected_club, selected_league, signed_at, room_id")
            .eq("user_id", authData.user.id)
            .maybeSingle();

        if (contractError) throw contractError;

        if (!contract?.signed_at || !contract.selected_club) {
          router.replace("/game/contract");
          return;
        }

        const league = contract.selected_league || "premier-league";

        const season = await activeSeason(supabase, authData.user.id, league);

        const { data, error: matchesError } = await supabase
          .from("league_matches")
          .select(
            "id, home_club, away_club, home_score, away_score, status, matchday, season"
          )
          .eq("user_id", authData.user.id)
          .eq("league_id", league)
          .eq("season", season);

        if (matchesError) throw matchesError;

        let trainingRows: TrainingRow[] = [];
        try {
          const { data: t } = await supabase.from("training_sessions").select("season, matchday, player_id, gain, created_at, league_id").eq("user_id", authData.user.id);
          trainingRows = ((t ?? []) as TrainingRow[]).filter((r) => inCareer(r.league_id, league));
        } catch {
          /* no training yet */
        }
        let renewalRows: Renewal[] = [];
        try {
          const { data: r } = await supabase.from("contract_renewals").select("club_id, player_id, season, end_year, wage, fee").eq("user_id", authData.user.id).order("created_at", { ascending: true });
          renewalRows = (r ?? []) as Renewal[];
        } catch {
          /* no renewals yet */
        }
        let dealRows: Deal[] = [];
        try {
          const { data: d } = await supabase.from("transfers").select("*").eq("user_id", authData.user.id);
          dealRows = ((d ?? []) as Deal[]).filter((r) => inCareer(r.league_id, league));
        } catch {
          /* base squads are the fallback */
        }

        const taken = await loadDeductions(supabase, authData.user.id, league, season);

        if (!cancelled) {
          setCut(taken);
          setDeals(dealRows);
          setTraining(trainingRows);
          setRenewals(renewalRows);
          setLeagueKey(contract.room_id ?? authData.user.id);
          setLeagueId(league);
          setSeasonName(season);
          setManagerClub(contract.selected_club);
          setMatches((data || []) as Match[]);
        }
      } catch (err) {
        console.error(err);

        if (!cancelled) {
          setError("Could not load league standings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadStandings();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const standings = calculateStandings(matches, undefined, managerClub ? { [managerClub]: cut } : undefined);
  const completedMatches = matches.filter(
    (match) => match.status === "completed"
  ).length;

  if (loading) {
    return (
      <main className="standings-loading">
        <GsmMark size={56} />
        <p>LOADING LEAGUE TABLE...</p>
      </main>
    );
  }

  const myIndex = standings.findIndex((team) => team.clubId === managerClub);
  const mine = myIndex >= 0 ? standings[myIndex] : null;

  return (
    <main className="st gx-grain">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="st-bg gx-kb" aria-hidden="true" />
      <div className="st-shade" aria-hidden="true" />

      <GameHud season={seasonName ? seasonLabel(seasonName) : undefined} onBack={() => router.push("/game/dashboard")} />

      <div className="st-body">
        <section className="st-head">
          <div>
            <h1>
              <span className="gx-slant">League table</span>
            </h1>
            <p>
              {leagueOf(leagueId).name}, season {seasonName ? seasonLabel(seasonName) : ""}. {completedMatches} of {matches.length} matches played.
            </p>
          </div>

          {mine && (
            <aside className="st-you gx-cut" aria-label="Your club">
              <img src={mine.logo} alt="" />
              <div>
                <small>Your club</small>
                <strong>{mine.name}</strong>
              </div>
              <dl>
                <div>
                  <dt>Position</dt>
                  <dd>{myIndex + 1}</dd>
                </div>
                <div>
                  <dt>Points</dt>
                  <dd>{mine.points}</dd>
                </div>
                <div>
                  <dt>Goal diff</dt>
                  <dd>{mine.gd > 0 ? `+${mine.gd}` : mine.gd}</dd>
                </div>
              </dl>
            </aside>
          )}
        </section>

        {error && (
          <div className="standings-error" role="alert">
            {error}
          </div>
        )}

        <nav className="st-tabs" role="tablist" aria-label="League views">
          {([
            ["table", "Table"],
            ["scorers", "Top scorers"],
            ["assists", "Assists"],
            ["teams", "Best attack"],
            ["best", "Best players"],
            ["value", "Market value"],
          ] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}>
              {label}
            </button>
          ))}
        </nav>

        {view !== "table" && (
          <Leaders tab={view} matches={matches as never} deals={deals} training={training} renewals={renewals} leagueKey={leagueKey} myClub={managerClub} />
        )}

        {view === "table" && (
        <section className="st-table gx-cut" aria-label="League table">
          <div className="standings-table-wrap">
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="position-cell">Pos</th>
                  <th className="club-cell">Club</th>
                  <th>P</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>GD</th>
                  <th className="points-cell">Pts</th>
                </tr>
              </thead>

              <tbody>
                {standings.map((team, index) => {
                  const isManagerClub = team.clubId === managerClub;

                  return (
                    <tr
                      key={team.clubId}
                      className={isManagerClub ? "manager-club-row" : ""}
                    >
                      <td className="position-cell">
                        <span className="position-number">{index + 1}</span>
                      </td>

                      <td className="club-cell">
                        <div className="standing-club">
                          <img src={team.logo} alt="" />
                          <strong>{isManagerClub ? team.name : <Link href={`/game/club/${team.clubId}`} className="club-link">{team.name}</Link>}</strong>
                          {isManagerClub && <span className="your-club-tag">You</span>}
                        </div>
                      </td>

                      <td>{team.played}</td>
                      <td>{team.won}</td>
                      <td>{team.drawn}</td>
                      <td>{team.lost}</td>
                      <td>{team.gf}</td>
                      <td>{team.ga}</td>

                      <td
                        className={
                          team.gd > 0 ? "positive-gd" : team.gd < 0 ? "negative-gd" : ""
                        }
                      >
                        {team.gd > 0 ? `+${team.gd}` : team.gd}
                      </td>

                      <td className="points-cell">{team.points}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {view === "table" && completedMatches === 0 && (
          <div className="standings-empty">
            <Icon name="ball" size={30} />
            <div>
              <h3>The season is waiting.</h3>
              <p>
                No matches have been played yet. The table updates automatically when results are recorded.
              </p>
            </div>
          </div>
        )}

        <div className="standings-legend">
          <span><i className="legend-champions" /> Champions League</span>
          <span><i className="legend-europa" /> Europa League</span>
          <span><i className="legend-relegation" /> Relegation</span>
          <span><i className="legend-manager" /> Your club</span>
        </div>
      </div>
    </main>
  );
}
