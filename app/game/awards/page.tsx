"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { inCareer } from "@/lib/football/leagueIds";
import { loadDeductions } from "@/lib/football/bank";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { activeSeason, seasonLabel } from "@/lib/football/season";
import { calculateStandings, type Match } from "@/lib/football/table";
import { summarizeSeason } from "@/lib/football/achievements";
import { buildAwards, loadAwardRows, prevSeason, prizeFor, saveAwards, type AwardPlayer, type AwardRow } from "@/lib/football/awards";
import type { StatMatch } from "@/lib/football/stats";
import type { Deal } from "@/lib/football/transfers";
import type { TrainingRow } from "@/lib/football/development";
import type { Renewal } from "@/lib/football/contracts";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "./awards.css";

const clubOf = (id: string) => clubs.find((c) => c.id === id);
const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 10 > 3 || [11, 12, 13].includes(n % 100) ? 0 : n % 10]}`;
const LINES = [
  { key: "FW", name: "Attack" },
  { key: "MF", name: "Midfield" },
  { key: "DF", name: "Defence" },
  { key: "GK", name: "Goalkeeper" },
] as const;

function Winner({ title, note, p, unit, value }: { title: string; note: string; p: AwardPlayer | null; unit: string; value: number }) {
  const c = p ? clubOf(p.club) : null;
  return (
    <article className="aw-prize">
      <small>{title}</small>
      {p ? (
        <>
          <div className="aw-who">
            {c && <img src={c.logo} alt="" />}
            <div>
              <strong>{p.name}</strong>
              <span>{c?.name ?? p.club}</span>
            </div>
          </div>
          <b>{value}</b>
          <em>{unit}</em>
        </>
      ) : (
        <p>{note}</p>
      )}
    </article>
  );
}

export default function AwardsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<AwardRow[]>([]);
  const [picked, setPicked] = useState("");
  const [myClub, setMyClub] = useState("");
  const [fresh, setFresh] = useState<string[]>([]);
  const [current, setCurrent] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) {
          router.replace("/");
          return;
        }
        const uid = auth.user.id;
        const { data: contract } = await supabase.from("manager_contracts").select("selected_club, selected_league, signed_at, room_id").eq("user_id", uid).maybeSingle();
        if (!contract?.signed_at || !contract.selected_club) {
          router.replace("/game/contract");
          return;
        }
        const league = contract.selected_league || "premier-league";
        const club = contract.selected_club as string;
        const leagueKey = (contract.room_id as string | null) ?? uid;
        const now = await activeSeason(supabase, uid, league);

        let saved = await loadAwardRows(supabase, uid, league, club);
        const have = new Set(saved.map((r) => r.season));

        // every finished season that has no awards yet: work them out and save them (this pays the prize once)
        let deals: Deal[] | null = null;
        let training: TrainingRow[] = [];
        let renewals: Renewal[] = [];
        const added: string[] = [];
        let failed = "";
        let season: string | null = now;
        let guard = 0;
        while (season && guard++ < 12) {
          const { data } = await supabase.from("league_matches").select("id, home_club, away_club, home_score, away_score, status, matchday, season").eq("user_id", uid).eq("league_id", league).eq("season", season);
          const matches = (data ?? []) as Match[];
          if (!matches.length) break;
          const summary = summarizeSeason(club, matches);
          if (summary.complete && !have.has(season)) {
            try {
              if (!deals) {
                const [d, t, r] = await Promise.all([
                  supabase.from("transfers").select("*").eq("user_id", uid),
                  supabase.from("training_sessions").select("season, matchday, player_id, gain, created_at, league_id").eq("user_id", uid),
                  supabase.from("contract_renewals").select("club_id, player_id, season, end_year, wage, fee").eq("user_id", uid).order("created_at", { ascending: true }),
                ]);
                deals = ((d.data ?? []) as Deal[]).filter((x) => inCareer(x.league_id, league));
                training = ((t.data ?? []) as TrainingRow[]).filter((x) => inCareer(x.league_id, league));
                renewals = (r.data ?? []) as Renewal[];
              }
              const cut = await loadDeductions(supabase, uid, league, season);
              const table = calculateStandings(matches, undefined, { [club]: cut });
              const position = table.findIndex((s) => s.clubId === club) + 1;
              const awards = buildAwards({ matches: matches as unknown as StatMatch[], table, deals, training, renewals, leagueKey, myClub: club, season });
              const result = await saveAwards(supabase, { userId: uid, leagueId: league, clubId: club, season, position, awards });
              if (result === "saved") added.push(season);
            } catch (e) {
              failed = e instanceof Error ? e.message : "Could not save the season awards.";
              break;
            }
          }
          season = prevSeason(season);
        }
        if (added.length) saved = await loadAwardRows(supabase, uid, league, club);

        if (!cancelled) {
          setMyClub(club);
          setRows(saved);
          setFresh(added);
          setCurrent(now);
          setPicked(saved[0]?.season ?? "");
          setError(failed);
        }
      } catch (e) {
        console.error("Awards error:", e);
        if (!cancelled) setError("Could not load the season awards.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const row = useMemo(() => rows.find((r) => r.season === picked) ?? null, [rows, picked]);

  if (loading) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Counting the votes...</p>
      </main>
    );
  }

  const aw = row?.awards;
  const champion = aw ? clubOf(aw.champion) : null;
  const club = clubOf(myClub);
  const attackClub = aw?.attack ? clubOf(aw.attack.club) : null;
  const prize = row ? row.prize || prizeFor(row.position, row.league_id) : 0;

  return (
    <main className="aw">
      <div className="aw-bg" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="aw-wrap">
        <header className="aw-head">
          <small>Season awards</small>
          <h1>{row ? seasonLabel(row.season) : "Awards"}</h1>
        </header>

        {error && <p className="aw-error" role="alert">{error}</p>}

        {rows.length > 1 && (
          <nav className="aw-seasons" aria-label="Seasons">
            {rows.map((r) => (
              <button key={r.season} type="button" className={r.season === picked ? "is-on" : ""} onClick={() => setPicked(r.season)} aria-pressed={r.season === picked}>
                {seasonLabel(r.season)}
              </button>
            ))}
          </nav>
        )}

        {!row || !aw ? (
          <section className="aw-empty">
            <strong>No finished season yet</strong>
            <p>When your league season ends you get the prize money for your finish and the awards of the season here.{current ? ` Season ${seasonLabel(current)} is still being played.` : ""}</p>
            <Link href="/game/fixtures" className="aw-btn">Open the fixtures</Link>
          </section>
        ) : (
          <>
            <section className="aw-finish">
              <div className="aw-finish-club">
                {club && <img src={club.logo} alt="" />}
                <div>
                  <small>{club?.name ?? "Your club"}</small>
                  <strong>{row.position === 1 ? "League champions" : `Finished ${ordinal(row.position)}`}</strong>
                  <span>{aw.points} points</span>
                </div>
              </div>
              <div className="aw-money">
                <small>Prize money</small>
                <b>+{prize}M</b>
                <span>{fresh.includes(row.season) ? "Added to your club balance now" : "Added to your club balance"}</span>
              </div>
            </section>

            {champion && row.position !== 1 && (
              <p className="aw-champ">Champions: <img src={champion.logo} alt="" /> <strong>{champion.name}</strong></p>
            )}

            <div className="aw-prizes">
              <Winner title="Golden Boot" note="Nobody scored." p={aw.golden} unit="goals" value={aw.golden?.goals ?? 0} />
              <Winner title="Playmaker" note="No assists." p={aw.playmaker} unit="assists" value={aw.playmaker?.assists ?? 0} />
              <Winner title="Player of the season" note="No goals or assists." p={aw.best} unit="goals + assists" value={(aw.best?.goals ?? 0) + (aw.best?.assists ?? 0)} />
              <article className="aw-prize">
                <small>Best attack</small>
                {aw.attack ? (
                  <>
                    <div className="aw-who">
                      {attackClub && <img src={attackClub.logo} alt="" />}
                      <div>
                        <strong>{attackClub?.name ?? aw.attack.club}</strong>
                        <span>Most goals scored</span>
                      </div>
                    </div>
                    <b>{aw.attack.goals}</b>
                    <em>goals</em>
                  </>
                ) : (
                  <p>No goals.</p>
                )}
              </article>
            </div>

            <section className="aw-xi" aria-label="Team of the season">
              <h2>Team of the season</h2>
              <p>The best eleven of the league: rating first, with a bonus for goals and assists.</p>
              {LINES.map((line) => {
                const list = aw.xi.filter((p) => p.position === line.key);
                if (!list.length) return null;
                return (
                  <div key={line.key} className="aw-line" aria-label={line.name}>
                    {list.map((p) => {
                      const c = clubOf(p.club);
                      return (
                        <div key={p.id} className={`aw-pl ${p.club === myClub ? "is-mine" : ""}`}>
                          {c && <img src={c.logo} alt="" />}
                          <strong>{p.name}</strong>
                          <small>{p.rating}{p.goals || p.assists ? ` · ${p.goals}G ${p.assists}A` : ""}</small>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
