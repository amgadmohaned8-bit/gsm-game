"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { seasonLabel } from "@/lib/football/season";
import { resetCareerData } from "@/lib/football/careerReset";
import { loadCareers, switchCareer } from "@/lib/football/careers";
import { isCafCup } from "@/lib/football/africa";
import { squadOf, type Player } from "@/lib/football/squads";
import { loadSim } from "@/lib/football/strength";
import { loadTransferState } from "@/lib/football/transfers";
import {
  CONT_ROUNDS,
  CONT_UNLOCK,
  EGYPT_LEAGUE,
  cafCup,
  contStatus,
  drawGroups,
  fetchContSetup,
  isGroupRound,
  leagueProgress,
  playContRound,
  qualifyFromLeague,
  recordContWin,
  roundLabel,
  settleCont,
  GROUP_NAMES,
  type ContMatch,
  type ContSetup,
  type PlayedContRound,
} from "@/lib/football/continental";
import GsmMark from "@/components/GsmMark";
import CompBackdrop from "@/components/CompBackdrop";
import TrophyCelebration from "@/components/TrophyCelebration";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import MatchOverlay from "@/components/MatchOverlay";
import "../fixtures/fixtures.css";
import "../cup/cup.css";
import "./continental.css";

type Manager = { manager_name?: string | null; selected_club: string; selected_league: string; room_id?: string | null };
type Tab = "groups" | "knockout" | "squad";

const clubOf = (id: string) => clubs.find((c) => c.id === id);

export default function ContinentalPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");
  const [manager, setManager] = useState<Manager | null>(null);
  const [setup, setSetup] = useState<ContSetup | null>(null);
  const [rows, setRows] = useState<ContMatch[]>([]);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState<PlayedContRound | null>(null);
  const [tab, setTab] = useState<Tab>("groups");

  const settle = useCallback(async (uid: string, s: ContSetup) => {
    const next = await settleCont(supabase, uid, s);
    await recordContWin(supabase, uid, s, next);
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

        let found: ContSetup | null = null;
        if (isCafCup(contract.selected_league)) {
          found = await fetchContSetup(supabase, user.id, contract.selected_league);
        } else if (contract.selected_league === EGYPT_LEAGUE) {
          const list = await qualifyFromLeague(supabase, user.id, contract.selected_club);
          found = list.find((x) => x.club_id === contract.selected_club) ?? null;
        } else {
          router.replace("/game/dashboard");
          return;
        }

        if (cancelled) return;
        setUserId(user.id);
        setManager(contract as Manager);
        setSetup(found);
        if (found) {
          await settle(user.id, found);
          if (found.source === "league") setProgress(await leagueProgress(supabase, user.id, found.season, found.club_id));
        }
      } catch (err) {
        console.error("Continental load error:", err);
        if (!cancelled) setError("Could not load the competition. Run supabase/014_continental.sql first, then try again.");
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
  const cup = setup ? cafCup(setup.comp_id) : undefined;
  const standalone = setup?.source === "standalone";
  const groups = useMemo(() => (setup ? drawGroups(userId, setup.season, setup.comp_id, setup.egypt) : []), [setup, userId]);
  const status = useMemo(() => (setup && groups.length ? contStatus(rows, myClub, groups) : null), [rows, myClub, groups, setup]);
  const next = status?.next ?? null;
  const unlockAt = next ? CONT_UNLOCK[next.round_no] : 0;
  const ready = !!next && (standalone || progress >= unlockAt);
  const finished = !!status?.final;
  const mySquad = useMemo(() => [...(live && live.length ? live : squadOf(myClub))].sort((a, b) => b.rating - a.rating), [myClub, live]);

  async function startMatch() {
    if (!next || !ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const sim = await loadSim(supabase, { userId, clubId: myClub, roomId: null, season: setup!.season, matchday: null, leagueId: manager?.selected_league });
      const res = await playContRound(supabase, rows, next.round_no, myClub, userId, sim);
      setPlaying(res);
    } catch (err) {
      console.error("Continental match error:", err);
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

  /** The competition is over: its slot goes away and you go back to your other team. */
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
      setError("Could not close this competition. Try again.");
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

  const back = () => router.push("/game/myteams");

  if (!setup || !cup || !status || !manager) {
    return (
      <main className="fx-loading">
        <p>{error || "No continental competition yet. Finish the Egyptian league season in the top four and you qualify for the CAF Champions League (1st-2nd) or the Confederation Cup (3rd-4th) in the next season."}</p>
        <button type="button" onClick={() => router.push("/game/myteams")}>Back to my teams</button>
      </main>
    );
  }

  const nextHome = next ? clubOf(next.home_club) : null;
  const nextAway = next ? clubOf(next.away_club) : null;
  const knockout = CONT_ROUNDS.filter((r) => r.no >= 6).map((r) => ({ ...r, matches: rows.filter((m) => m.round_no === r.no) }));
  const theme = cup.id === "caf-champions-league" ? { "--cn1": "#caa24a", "--cn2": "#5b3a00" } : { "--cn1": "#e5cf2a", "--cn2": "#1d6b3a" };

  return (
    <main className="fx cp cn gx-grain" style={theme as React.CSSProperties}>
      <div className="gx-curtain" aria-hidden="true" />
      <div className="fx-bg gx-kb" aria-hidden="true" />
      <div className="fx-shade" aria-hidden="true" />
      <CompBackdrop comp={cup.id} />
      {finished && <TrophyCelebration />}

      <GameHud season={seasonLabel(setup.season)} onBack={back} />

      <div className="fx-body">
        <section className="fx-hero">
          <div className="fx-title">
            <img className="cn-emblem" src={`/league-logos/${cup.id}.png`} alt="" />
            <h1>
              <span className="gx-slant">{cup.id === "caf-champions-league" ? "Champions" : "Confederation"}</span>
              <span className="gx-slant">{cup.id === "caf-champions-league" ? "League" : "Cup"}</span>
            </h1>
            <p>
              16 clubs in four groups of four, home and away. The top two of each group go through to the quarter-finals, then the semi-finals and the final.
              {standalone ? " Your own career: play every round when you are ready." : " It runs alongside your Egyptian league season: each round opens after a number of league matches."}
            </p>
          </div>

          {next ? (
            <article className="fx-next gx-cut" aria-label="Your next match">
              <header>
                <span>{roundLabel(next.round_no)}</span>
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
                  <img className="cp-win" src={`/trophies/${cup.id}.png`} alt="" />
                  <h2>Champions of Africa</h2>
                  <p>The trophy is in your cabinet.</p>
                </>
              ) : status.eliminated ? (
                <>
                  <Icon name="close" size={30} />
                  <h2>{status.last?.round_no === 8 ? "Runners-up" : "Knocked out"}</h2>
                  <p>{status.outInGroup ? "Your run ended in the group stage." : status.last?.round_no === 8 ? "You lost the final. So close." : `Your run ended in the ${status.last ? roundLabel(status.last.round_no) : "knockouts"}.`}</p>
                </>
              ) : (
                <>
                  <Icon name="calendar" size={30} />
                  <h2>Waiting</h2>
                  <p>Your next tie appears when the round before it is finished.</p>
                </>
              )}
              {(finished || status.eliminated) && (
                standalone ? (
                  <button type="button" className="gx-btn fx-start is-ready" disabled={saving} onClick={finishCareer}>
                    {saving ? "Closing..." : "Finish and go back to your team"}
                  </button>
                ) : (
                  <button type="button" className="gx-btn fx-start is-ready" onClick={back}>Back to my teams</button>
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
          {([["groups", "Groups"], ["knockout", "Knockout"], ["squad", "Your squad"]] as [Tab, string][]).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>

        {tab === "groups" && (
          <section className="cn-groups" aria-label="Group tables">
            {status.tables.map((table, g) => (
              <div className={`cn-group ${g === status.myGroup ? "is-mine" : ""}`} key={g}>
                <h3>Group {GROUP_NAMES[g]}</h3>
                <table>
                  <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
                  <tbody>
                    {table.map((r, i) => {
                      const c = clubOf(r.clubId);
                      return (
                        <tr key={r.clubId} className={`${i < 2 ? "is-through" : ""} ${r.clubId === myClub ? "is-me" : ""}`}>
                          <td>{i + 1}</td>
                          <td><span className="cn-club">{c && <img src={c.logo} alt="" />}<em>{c?.name ?? r.clubId}</em></span></td>
                          <td>{r.played}</td><td>{r.won}</td><td>{r.drawn}</td><td>{r.lost}</td>
                          <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td><td><b>{r.points}</b></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </section>
        )}

        {tab === "knockout" && (
          <section className="cp-bracket" aria-label="Knockout bracket">
            <div className="cp-scroll" tabIndex={0}>
              {knockout.map((round) => (
                <div className="cp-round" key={round.no}>
                  <header><strong>{round.label}</strong><small>{CONT_UNLOCK[round.no] && !standalone ? `League match ${CONT_UNLOCK[round.no]}` : ""}</small></header>
                  {round.matches.length > 0
                    ? round.matches.map((m) => <Tie key={m.id} match={m} myClub={myClub} />)
                    : Array.from({ length: round.ties }, (_, i) => (
                        <div className="cp-tie is-tbd" key={i}>
                          <div className="cp-side"><span>To be decided</span></div>
                          <div className="cp-side"><span>To be decided</span></div>
                        </div>
                      ))}
                </div>
              ))}
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
          label={`${cup.name} · ${roundLabel(playing.mine.match.round_no)}`}
          othersTitle={`Other matches, ${roundLabel(playing.mine.match.round_no)}`}
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

function Tie({ match, myClub }: { match: ContMatch; myClub: string }) {
  const done = match.status === "completed";
  const mine = match.home_club === myClub || match.away_club === myClub;
  const side = (id: string, score: number | null, pens: number | null) => {
    const club = clubOf(id);
    const won = done && match.winner === id;
    return (
      <div className={`cp-side ${won ? "is-won" : done ? "is-lost" : ""} ${id === myClub ? "is-me" : ""}`}>
        {club && <img src={club.logo} alt="" />}
        <span>{club?.name ?? id}</span>
        {done && <b>{score}{pens !== null && <sup>({pens})</sup>}</b>}
      </div>
    );
  };
  return (
    <div className={`cp-tie ${mine ? "is-mine" : ""}`}>
      {side(match.home_club, match.home_score, match.pens_home)}
      {side(match.away_club, match.away_score, match.pens_away)}
    </div>
  );
}
