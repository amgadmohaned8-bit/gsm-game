"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadSim } from "@/lib/football/strength";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { activeSeason, seasonLabel } from "@/lib/football/season";
import {
  cupKickoff,
  firstKickoff,
  formatKickoff,
  formatKickoffDay,
  splitDuration,
} from "@/lib/football/schedule";
import {
  CUP_ROUNDS,
  cupStatus,
  playCupRound,
  recordCupWin,
  settleCup,
  type CupMatch,
  type PlayedCupRound,
} from "@/lib/football/cup";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import MatchOverlay from "@/components/MatchOverlay";
import "../fixtures/fixtures.css";
import "./cup.css";

type ManagerData = { manager_name?: string | null; selected_club: string; selected_league: string; room_id?: string | null };

const pad = (n: number) => String(n).padStart(2, "0");
const clubOf = (id: string) => clubs.find((c) => c.id === id);
const roundLabel = (no: number) => CUP_ROUNDS[no]?.label ?? "Cup";

export default function CupPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsSeason, setNeedsSeason] = useState(false);
  const [userId, setUserId] = useState("");
  const [manager, setManager] = useState<ManagerData | null>(null);
  const [season, setSeason] = useState("");
  const [first, setFirst] = useState<Date>(() => firstKickoff());
  const [rows, setRows] = useState<CupMatch[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState<PlayedCupRound | null>(null);

  const refresh = useCallback(
    async (uid: string, seasonName: string, club: string, start: Date, seed?: string | null, leagueId = "premier-league") => {
      const sim = await loadSim(supabase, { userId: uid, clubId: club, roomId: seed, season: seasonName, matchday: null });
      const next = await settleCup(supabase, uid, seasonName, club, start, Date.now(), seed ?? uid, sim, leagueId);
      await recordCupWin(supabase, uid, seasonName, club, next, leagueId);
      setRows(next);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/");
          return;
        }

        const { data: contract } = await supabase
          .from("manager_contracts")
          .select("manager_name, selected_club, selected_league, room_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!contract?.selected_club) {
          router.replace("/game/leagues");
          return;
        }

        const seasonName = await activeSeason(supabase, user.id, contract.selected_league);

        // the cup calendar hangs off matchday 1 of the league season
        const { data: opener } = await supabase
          .from("league_matches")
          .select("kickoff_at")
          .eq("user_id", user.id)
          .eq("league_id", contract.selected_league)
          .eq("season", seasonName)
          .eq("matchday", 1)
          .limit(1);

        const start = opener?.[0]?.kickoff_at ? new Date(opener[0].kickoff_at) : null;

        if (!start) {
          if (!cancelled) {
            setNeedsSeason(true);
            setManager(contract as ManagerData);
            setLoading(false);
          }
          return;
        }

        if (cancelled) return;
        setUserId(user.id);
        setManager(contract as ManagerData);
        setSeason(seasonName);
        setFirst(start);
        await refresh(user.id, seasonName, contract.selected_club, start, contract.room_id, contract.selected_league || "premier-league");
      } catch (err) {
        console.error("Cup load error:", err);
        if (!cancelled) setError("Could not load the cup. Run supabase/003_cup.sql first, then try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [router, refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const myClub = manager?.selected_club ?? "";
  const status = useMemo(() => cupStatus(rows, myClub), [rows, myClub]);
  const next = status.next;
  const ready = !!next && new Date(next.kickoff_at).getTime() <= now;
  const t = next ? splitDuration(new Date(next.kickoff_at).getTime() - now) : null;

  const rounds = useMemo(
    () =>
      CUP_ROUNDS.map((round) => ({
        ...round,
        date: formatKickoffDay(cupKickoff(first, round.no).toISOString()),
        matches: rows.filter((m) => m.round_no === round.no),
      })),
    [rows, first]
  );

  const entryRound = useMemo(() => {
    if (!rows.length || status.next || status.last || status.champion) return null;
    return rounds.find((r) => r.no === 1) ?? null;
  }, [rows, status, rounds]);

  async function startMatch() {
    if (!next || !ready || saving) return;
    setSaving(true);
    setError("");
    try {
      const sim = await loadSim(supabase, { userId, clubId: myClub, roomId: manager?.room_id, season, matchday: null });
      const result = await playCupRound(supabase, rows, next.round_no, myClub, manager?.room_id ?? userId, sim);
      setPlaying(result);
    } catch (err) {
      console.error("Cup match error:", err);
      setError("The match could not start. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function closeMatch() {
    setPlaying(null);
    try {
      await refresh(userId, season, myClub, first, manager?.room_id, manager?.selected_league || "premier-league");
    } catch {
      /* the bracket refreshes on the next visit */
    }
  }

  if (loading) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Drawing the cup...</p>
      </main>
    );
  }

  if (needsSeason || !manager) {
    return (
      <main className="fx-loading">
        <p>{needsSeason ? "Open the match centre once so the season calendar is built, then come back." : error}</p>
        <button type="button" onClick={() => router.push(needsSeason ? "/game/fixtures" : "/game/dashboard")}>
          {needsSeason ? "Open match centre" : "Back to dashboard"}
        </button>
      </main>
    );
  }

  const nextHome = next ? clubOf(next.home_club) : null;
  const nextAway = next ? clubOf(next.away_club) : null;

  return (
    <main className="fx cp gx-grain">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="fx-bg gx-kb" aria-hidden="true" />
      <div className="fx-shade" aria-hidden="true" />

      <GameHud
        season={season ? seasonLabel(season) : undefined}
        onBack={() => router.push("/game/dashboard")}
      />

      <div className="fx-body">
        <section className="fx-hero">
          <div className="fx-title">
            <h1>
              <span className="gx-slant">League</span>
              <span className="gx-slant">cup</span>
            </h1>
            <p>
              Eight clubs fight through a qualifying round, then 16 clubs play knockout football.
              One match a round, penalties if it is level, and a cup day between league weeks.
            </p>
          </div>

          {next ? (
            <article className="fx-next gx-cut" aria-label="Your next cup match">
              <header>
                <span>{roundLabel(next.round_no)}</span>
                <time>{formatKickoff(next.kickoff_at)}</time>
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

              {!ready && t && (
                <div className="fx-count" role="timer" aria-label="Time to kickoff">
                  {[
                    ["Days", t.days],
                    ["Hours", t.hours],
                    ["Min", t.minutes],
                    ["Sec", t.seconds],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <b key={`${label}-${value}`}>{pad(value as number)}</b>
                      <small>{label}</small>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                className={`gx-btn fx-start ${ready ? "is-ready" : ""}`}
                disabled={!ready || saving}
                onClick={startMatch}
              >
                {saving ? "Starting..." : ready ? "Start match" : "Locked until kickoff"}
              </button>
              {error && <p className="fx-error" role="alert">{error}</p>}
            </article>
          ) : (
            <article className="fx-next fx-done gx-cut" aria-label="Your cup run">
              {status.champion ? (
                <>
                  <img className="cp-win" src="/trophies/league-cup.png" alt="" />
                  <h2>Cup winners</h2>
                  <p>The trophy is in your cabinet.</p>
                </>
              ) : status.eliminated && status.last ? (
                <>
                  <Icon name="close" size={30} />
                  <h2>Knocked out</h2>
                  <p>Your cup run ended in the {roundLabel(status.last.round_no)}.</p>
                </>
              ) : entryRound ? (
                <>
                  <Icon name="calendar" size={30} />
                  <h2>Waiting for the 16</h2>
                  <p>
                    Your club goes straight into the {entryRound.label} on {entryRound.date}.
                  </p>
                </>
              ) : (
                <>
                  <Icon name="calendar" size={30} />
                  <h2>Nothing to play</h2>
                  <p>Your next cup tie will appear here.</p>
                </>
              )}
              {error && <p className="fx-error" role="alert">{error}</p>}
            </article>
          )}
        </section>

        <section className="cp-bracket" aria-label="Cup bracket">
          <h2 className="cp-h">The bracket</h2>
          <div className="cp-scroll" tabIndex={0}>
            {rounds.map((round) => (
              <div className="cp-round" key={round.no}>
                <header>
                  <strong>{round.label}</strong>
                  <small>{round.date}</small>
                </header>

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
      </div>

      {playing?.mine && (
        <MatchOverlay
          homeClub={playing.mine.match.home_club}
          awayClub={playing.mine.match.away_club}
          homeScore={playing.mine.result.home_score}
          awayScore={playing.mine.result.away_score}
          events={playing.mine.result.events}
          penalties={
            playing.mine.result.pens_home !== null
              ? [playing.mine.result.pens_home, playing.mine.result.pens_away ?? 0]
              : null
          }
          myClub={myClub}
          label={`League Cup · ${roundLabel(playing.mine.match.round_no)}`}
          press={{ userId, season: playing.mine.match.season, matchday: playing.mine.match.round_no, kind: "cup", roomId: manager?.room_id, managerName: manager?.manager_name }}
          othersTitle={`Other ties, ${roundLabel(playing.mine.match.round_no)}`}
          others={playing.others.map(({ match }) => ({
            id: match.id,
            home_club: match.home_club,
            away_club: match.away_club,
            home_score: match.home_score,
            away_score: match.away_score,
            pens:
              match.pens_home !== null ? `pens ${match.pens_home}-${match.pens_away}` : undefined,
          }))}
          closeLabel="Back to the cup"
          onClose={closeMatch}
        />
      )}
    </main>
  );
}

function Tie({ match, myClub }: { match: CupMatch; myClub: string }) {
  const done = match.status === "completed";
  const mine = match.home_club === myClub || match.away_club === myClub;

  const side = (id: string, score: number | null, pens: number | null) => {
    const club = clubOf(id);
    const won = done && match.winner === id;
    return (
      <div className={`cp-side ${won ? "is-won" : done ? "is-lost" : ""} ${id === myClub ? "is-me" : ""}`}>
        {club && <img src={club.logo} alt="" />}
        <span>{club?.name ?? id}</span>
        {done && (
          <b>
            {score}
            {pens !== null && <sup>({pens})</sup>}
          </b>
        )}
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
