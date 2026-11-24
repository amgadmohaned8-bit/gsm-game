"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { seasonLabel } from "@/lib/football/season";
import { resetCareerData } from "@/lib/football/careerReset";
import { loadCareers, switchCareer } from "@/lib/football/careers";
import { baseLeague } from "@/lib/football/leagueIds";
import { squadOf, type Player } from "@/lib/football/squads";
import { loadSim, withTimeout } from "@/lib/football/strength";
import { playRoundOnServer, ownPrefs } from "@/lib/football/serverPlay";
import { loadTransferState } from "@/lib/football/transfers";
import { euroLogo } from "@/lib/football/europeClubs";
import {
  EURO_STAGES,
  EURO_UNLOCK,
  entrantsOf,
  euroComp,
  euroLeagueProgress,
  euroRoundLabel,
  euroStatus,
  fetchEuroSetups,
  isEuroComp,
  playEuroRound,
  qualifyFromEngland,
  recordEuroWin,
  settleEuro,
  stageTies,
  type EuroMatch,
  type EuroSetup,
  type PlayedEuroRound,
} from "@/lib/football/europe";
import GsmMark from "@/components/GsmMark";
import CompBackdrop from "@/components/CompBackdrop";
import TrophyCelebration from "@/components/TrophyCelebration";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import MatchOverlay from "@/components/MatchOverlay";
import "../fixtures/fixtures.css";
import "../cup/cup.css";
import "../continental/continental.css";
import "./europe.css";

type Manager = { manager_name?: string | null; selected_club: string; selected_league: string; room_id?: string | null };
type Tab = "table" | "knockout" | "squad";

const clubOf = (id: string) => clubs.find((c) => c.id === id);

export default function EuropePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [manager, setManager] = useState<Manager | null>(null);
  const [setup, setSetup] = useState<EuroSetup | null>(null);
  const [rows, setRows] = useState<EuroMatch[]>([]);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState<PlayedEuroRound | null>(null);
  const [tab, setTab] = useState<Tab>("table");

  const settle = useCallback(async (uid: string, s: EuroSetup) => {
    const next = await settleEuro(supabase, uid, s);
    await recordEuroWin(supabase, uid, s, next);
    setRows(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/"); return; }
        const { data: contract } = await supabase.from("manager_contracts").select("manager_name, selected_club, selected_league, room_id").eq("user_id", user.id).maybeSingle();
        if (!contract?.selected_club) { router.replace("/game/leagues"); return; }
        const own = isEuroComp(contract.selected_league);
        if (!own && baseLeague(contract.selected_league) !== "premier-league") { router.replace("/game/dashboard"); return; }

        // your own European career, or the place you earned from the Premier League
        const list = own
          ? (await fetchEuroSetups(supabase, user.id)).filter((x) => x.comp_id === contract.selected_league && x.club_id === contract.selected_club)
          : await qualifyFromEngland(supabase, user.id, contract.selected_club, contract.selected_league);
        const found = list[0] ?? null;
        if (cancelled) return;
        setUserId(user.id);
        setManager(contract as Manager);
        setSetup(found);
        if (found) {
          await settle(user.id, found);
          if (!own) setProgress(await euroLeagueProgress(supabase, user.id, contract.selected_league, found.season, found.club_id));
        }
      } catch (err) {
        console.error("Europe load error:", err);
        if (!cancelled) setError("Could not load the competition. Run supabase/026_europe.sql first, then try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router, settle]);

  // the squad as it is today, signings included
  const [live, setLive] = useState<Player[] | null>(null);
  useEffect(() => {
    if (!userId || !setup?.club_id) return;
    let off = false;
    void loadTransferState(supabase, userId, setup.club_id, setup.season, null, manager?.selected_league)
      .then((st) => { if (!off) setLive(st.squads[setup.club_id] ?? null); })
      .catch(() => undefined);
    return () => { off = true; };
  }, [userId, setup?.club_id, setup?.season, manager?.selected_league]);

  const myClub = setup?.club_id ?? "";
  const comp = setup ? euroComp(setup.comp_id) : undefined;
  const entrants = useMemo(() => (setup ? entrantsOf(setup.comp_id, setup.english) : []), [setup]);
  const status = useMemo(() => (setup ? euroStatus(rows, myClub, entrants) : null), [rows, myClub, entrants, setup]);
  const next = status?.next ?? null;
  const unlockAt = next ? EURO_UNLOCK[next.round_no] : 0;
  const standalone = setup?.source === "standalone";
  const ready = !!next && (standalone || progress >= unlockAt);
  const finished = !!status?.final;
  const mySquad = useMemo(() => [...(live && live.length ? live : squadOf(myClub))].sort((a, b) => b.rating - a.rating), [myClub, live]);

  async function startMatch() {
    if (!next || !ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const sim = await loadSim(supabase, { userId, clubId: myClub, roomId: null, season: setup!.season, matchday: null, leagueId: manager?.selected_league });
      const served = await withTimeout(playRoundOnServer(supabase, "euro", setup!.season, next.round_no, setup!.comp_id, ownPrefs(userId)), 25000);
      setPlaying(await playEuroRound(supabase, rows, next.round_no, myClub, userId, sim, served ?? undefined));
    } catch (err) {
      console.error("Europe match error:", err);
      setError("The match could not start. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function closeMatch() {
    setPlaying(null);
    if (setup) {
      try { await settle(userId, setup); } catch { /* refreshes on the next visit */ }
    }
  }

  /** The cup is over: its slot goes away and you go back to your other team. */
  async function finishCareer() {
    if (!setup || !manager || saving) return;
    setSaving(true);
    try {
      await resetCareerData(supabase, userId, setup.comp_id, setup.club_id);
      const others = (await loadCareers(supabase, userId)).filter((c) => c.league_id !== setup.comp_id);
      if (others.length) {
        await switchCareer(supabase, userId, { selected_league: manager.selected_league, selected_club: manager.selected_club, room_id: manager.room_id ?? null }, others[0]);
        router.push("/game/myteams");
      } else {
        router.push("/game/leagues");
      }
    } catch (err) {
      console.error(err);
      setError("Could not close this career. Try again.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Opening the competition...</p>
      </main>
    );
  }

  const back = () => router.push(standalone ? "/game/myteams" : "/game/dashboard");

  if (!setup || !comp || !status || !manager) {
    return (
      <main className="fx-loading">
        <p>{error || "No European competition yet. Finish the Premier League season in the top four and you play the Champions League next season. 5th and 6th play the Europa League."}</p>
        <button type="button" onClick={back}>Back to the game</button>
      </main>
    );
  }

  const nextHome = next ? clubOf(next.home_club) : null;
  const nextAway = next ? clubOf(next.away_club) : null;
  const theme = comp.id === "ucl" ? { "--cn1": "#7aa2ff", "--cn2": "#0b1b4d" } : { "--cn1": "#ff9a3c", "--cn2": "#3b1d00" };
  const leg1 = next && next.round_no % 2 === 1 && next.round_no >= 9 && next.round_no <= 15 ? rows.find((m) => m.round_no === next.round_no - 1 && m.slot === next.slot) : null;
  const zone = (i: number) => (i < 8 ? "is-top" : i < 24 ? "is-play" : "is-out");

  return (
    <main className="fx cp cn eu gx-grain" style={theme as React.CSSProperties}>
      <div className="gx-curtain" aria-hidden="true" />
      <div className="fx-bg gx-kb" aria-hidden="true" />
      <div className="fx-shade" aria-hidden="true" />
      <CompBackdrop comp={comp.id} />
      {finished && status.champion && <TrophyCelebration />}

      <GameHud season={seasonLabel(setup.season)} onBack={back} />

      <div className="fx-body">
        <section className="fx-hero">
          <div className="fx-title">
            <img className="cn-emblem" src={euroLogo(comp.id)} alt="" />
            <h1>
              <span className="gx-slant">{comp.id === "ucl" ? "Champions" : "Europa"}</span>
              <span className="gx-slant">League</span>
            </h1>
            <p>
              36 clubs in one table, 8 matches each against 8 different opponents. The top 8 go straight to the round of 16, 9th to 24th play off over two legs, and the rest are out. {standalone ? " Your own career: play every round when you are ready." : " It runs alongside your Premier League season: each round opens after a number of league matches."}
            </p>
          </div>

          {next ? (
            <article className="fx-next gx-cut" aria-label="Your next match">
              <header>
                <span>{euroRoundLabel(next.round_no)}</span>
                <time>{ready ? "Ready" : `After league match ${unlockAt}`}</time>
              </header>
              <div className="fx-versus">
                <div className="fx-team">
                  {nextHome && <img src={nextHome.logo} alt="" />}
                  <strong>{nextHome?.name}</strong>
                  <small>{next.home_club === myClub ? "Your club" : "Home"}</small>
                </div>
                <i>V</i>
                <div className="fx-team">
                  {nextAway && <img src={nextAway.logo} alt="" />}
                  <strong>{nextAway?.name}</strong>
                  <small>{next.away_club === myClub ? "Your club" : "Away"}</small>
                </div>
              </div>
              {leg1 && leg1.home_score !== null && <p className="cn-lock">First leg: {clubOf(leg1.home_club)?.name} {leg1.home_score}-{leg1.away_score} {clubOf(leg1.away_club)?.name}</p>}
              {!ready && <p className="cn-lock">League matches played: {progress} of {unlockAt}. Play your league matches to open this round.</p>}
              <button type="button" className={`gx-btn fx-start ${ready ? "is-ready" : ""}`} disabled={!ready || saving} onClick={startMatch}>
                {saving ? "Starting..." : ready ? "Start match" : "Locked"}
              </button>
              {error && <p className="fx-error" role="alert">{error}</p>}
            </article>
          ) : (
            <article className="fx-next fx-done gx-cut" aria-label="Your competition">
              {status.champion ? (
                <>
                  <img className="cp-win" src={`/trophies/${comp.id === "ucl" ? "uefa-champions-league" : "uefa-europa-league"}.png`} alt="" />
                  <h2>Champions of Europe</h2>
                  <p>The trophy is in your cabinet.</p>
                </>
              ) : status.eliminated ? (
                <>
                  <Icon name="close" size={30} />
                  <h2>{status.last?.round_no === 16 ? "Runners-up" : "Knocked out"}</h2>
                  <p>{status.outInLeague ? `You finished ${status.position}th in the league phase. Only the top 24 go on.` : status.last?.round_no === 16 ? "You lost the final. So close." : `Your run ended in the ${status.last ? euroRoundLabel(status.last.round_no).split(" · ")[0].toLowerCase() : "knockouts"}.`}</p>
                </>
              ) : (
                <>
                  <Icon name="calendar" size={30} />
                  <h2>Waiting</h2>
                  <p>{status.position && status.position <= 8 && status.phaseDone ? `You finished ${status.position}${status.position === 1 ? "st" : status.position === 2 ? "nd" : status.position === 3 ? "rd" : "th"} and skip the play-off. Your round of 16 tie appears when the play-off is finished.` : "Your next tie appears when the round before it is finished."}</p>
                </>
              )}
              {(finished || status.eliminated) && (
                standalone ? (
                  <button type="button" className="gx-btn fx-start is-ready" disabled={saving} onClick={finishCareer}>
                    {saving ? "Closing..." : "Finish and go back to your team"}
                  </button>
                ) : (
                  <button type="button" className="gx-btn fx-start is-ready" onClick={back}>Back to the dashboard</button>
                )
              )}
              {error && <p className="fx-error" role="alert">{error}</p>}
            </article>
          )}
        </section>

        <nav className="cn-tools" aria-label="Your team">
          <Link href="/game/squad">Lineup</Link>
          <Link href="/game/tactics">Tactics</Link>
        </nav>

        <nav className="cn-tabs" role="tablist" aria-label="Competition views">
          {([["table", "League phase"], ["knockout", "Knockout"], ["squad", "Your squad"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>

        {tab === "table" && (
          <section className="eu-table cn-group" aria-label="League phase table">
            <table>
              <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
              <tbody>
                {status.table.map((r, i) => {
                  const c = clubOf(r.clubId);
                  return (
                    <tr key={r.clubId} className={`${zone(i)} ${r.clubId === myClub ? "is-me" : ""} ${setup.english.includes(r.clubId) ? "is-eng" : ""}`}>
                      <td>{i + 1}</td>
                      <td><span className="cn-club">{c && <img src={c.logo} alt="" />}<em>{c?.name ?? r.clubId}</em></span></td>
                      <td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td>
                      <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td><td><b>{r.points}</b></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="eu-key"><i className="k-top" /> Top 8: round of 16 <i className="k-play" /> 9th-24th: play-off <i className="k-out" /> Out</p>
          </section>
        )}

        {tab === "knockout" && (
          <section className="cp-bracket" aria-label="Knockout bracket">
            <div className="cp-scroll" tabIndex={0}>
              {EURO_STAGES.map((stage) => {
                const ties = stageTies(rows, stage.first);
                const count = stage.first === 8 ? 8 : stage.first === 10 ? 8 : stage.first === 12 ? 4 : stage.first === 14 ? 2 : 1;
                return (
                  <div className="cp-round" key={stage.first}>
                    <header><strong>{stage.name}</strong><small>{stage.first === 16 ? "" : "Two legs"}</small></header>
                    {ties.length > 0
                      ? ties.map((t) => <TieCard key={t.slot} tie={t} myClub={myClub} single={stage.first === 16} />)
                      : Array.from({ length: count }, (_, i) => (
                          <div className="cp-tie is-tbd" key={i}>
                            <div className="cp-side"><span>To be decided</span></div>
                            <div className="cp-side"><span>To be decided</span></div>
                          </div>
                        ))}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "squad" && (
          <section className="cn-squad" aria-label="Your squad">
            {(["GK", "DF", "MF", "FW"] as const).map((pos) => (
              <div key={pos} className="cn-pos">
                <h3>{{ GK: "Goalkeepers", DF: "Defenders", MF: "Midfielders", FW: "Forwards" }[pos]}</h3>
                {mySquad.filter((p) => p.position === pos).map((p) => (
                  <div className="cn-player" key={p.id}>
                    <span className="cn-no">{p.number ?? "-"}</span>
                    <strong>{p.name}</strong>
                    <small>{p.nationality} · {p.age}</small>
                    <b>{p.rating}</b>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
      </div>

      {playing?.mine && (
        <MatchOverlay
          homeClub={playing.mine.match.home_club}
          awayClub={playing.mine.match.away_club}
          homeScore={playing.mine.result.home_score}
          awayScore={playing.mine.result.away_score}
          events={playing.mine.result.events}
          penalties={playing.mine.result.pens_home !== null ? [playing.mine.result.pens_home, playing.mine.result.pens_away ?? 0] : null}
          myClub={myClub}
          label={`${comp.name} · ${euroRoundLabel(playing.mine.match.round_no)}`}
          othersTitle={`Other matches, ${euroRoundLabel(playing.mine.match.round_no)}`}
          others={playing.others.map(({ match }) => ({
            id: match.id,
            home_club: match.home_club,
            away_club: match.away_club,
            home_score: match.home_score,
            away_score: match.away_score,
            pens: match.pens_home !== null ? `pens ${match.pens_home}-${match.pens_away}` : undefined,
          }))}
          closeLabel="Back to the competition"
          onClose={closeMatch}
        />
      )}
    </main>
  );
}

function TieCard({ tie, myClub, single }: { tie: ReturnType<typeof stageTies>[number]; myClub: string; single: boolean }) {
  const mine = tie.a === myClub || tie.b === myClub;
  const done = tie.winner !== null;
  const side = (id: string, k: 0 | 1) => {
    const club = clubOf(id);
    const total = (tie.l1 ? tie.l1[k] : 0) + (tie.l2 ? tie.l2[k] : 0);
    const shown = tie.l1 !== null;
    const pens = tie.pens ? tie.pens[k] : null;
    return (
      <div className={`cp-side ${done && tie.winner === id ? "is-won" : done ? "is-lost" : ""} ${id === myClub ? "is-me" : ""}`}>
        {club && <img src={club.logo} alt="" />}
        <span>{club?.name ?? id}</span>
        {shown && (
          <b>
            {!single && <small className="eu-legs">{tie.l1![k]}{tie.l2 ? ` · ${tie.l2[k]}` : ""}</small>}
            {single || tie.l2 ? total : ""}
            {pens !== null && <sup>({pens})</sup>}
          </b>
        )}
      </div>
    );
  };
  return (
    <div className={`cp-tie ${mine ? "is-mine" : ""}`}>
      {side(tie.a, 0)}
      {side(tie.b, 1)}
    </div>
  );
}
