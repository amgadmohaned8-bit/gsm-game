"use client";

import { alertState, askAlerts } from "@/lib/notify";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { loadDeductions } from "@/lib/football/bank";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { myRoom, seasonRows } from "@/lib/football/rooms";
import { sendFriendNotice } from "@/lib/football/friendlies";
import { bonusFor, currentLineup, loadSim, withTimeout } from "@/lib/football/strength";
import { playOnServer, halftimeOnServer, ownPrefs } from "@/lib/football/serverPlay";
import { activeSeason, nextSeason, seasonLabel } from "@/lib/football/season";
import { isCafCup } from "@/lib/football/africa";
import { cupForPosition, cafCup, fetchCont, fetchContSetup, roundLabel as contRoundLabel } from "@/lib/football/continental";
import { fetchCup } from "@/lib/football/cup";
import { euroRoundLabel, fetchEuro, fetchEuroSetups } from "@/lib/football/europe";
import { recordSeasonTrophies, summarizeSeason } from "@/lib/football/achievements";
import { evaluateBoard, type BoardMatch } from "@/lib/football/board";
import { calculateStandings } from "@/lib/football/table";
import {
  firstKickoff,
  matchdayKickoff,
  formatKickoff,
  formatKickoffDay,
  splitDuration,
} from "@/lib/football/schedule";
import {
  canKickOff,
  playMatchday,
  type PlayedMatchday,
  type StoredMatch,
} from "@/lib/football/matchday";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import TeamSheet from "@/components/TeamSheet";
import { saveLineup } from "@/lib/football/fitness";
import { availableSquad } from "@/lib/football/availability";
import { reviseSecondHalf, type Revised } from "@/lib/football/halftime";
import { squadOf, type Player } from "@/lib/football/squads";
import MatchOverlay from "@/components/MatchOverlay";
import "./fixtures.css";


import { nowMs } from "@/lib/serverTime";
type ManagerData = { manager_name?: string | null; selected_club: string; selected_league: string; room_id?: string | null; club_appointed_at?: string | null };
type Tab = "upcoming" | "results" | "all" | "round";
/** a match of mine in a cup, shown in the calendar next to the league matches */
type CupRow = { id: string; code: string; label: string; href: string; home_club: string; away_club: string; home_score: number | null; away_score: number | null; pens_home: number | null; pens_away: number | null; status: "scheduled" | "completed"; at: number | null };

function clubOf(id: string) {
  return clubs.find((club) => club.id === id);
}

function outcome(match: StoredMatch, myClub: string) {
  if (match.status !== "completed") return null;
  const home = match.home_club === myClub;
  const gf = (home ? match.home_score : match.away_score) ?? 0;
  const ga = (home ? match.away_score : match.home_score) ?? 0;
  return gf > ga ? "win" : gf < ga ? "loss" : "draw";
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function FixturesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [manager, setManager] = useState<ManagerData | null>(null);
  const [matches, setMatches] = useState<StoredMatch[]>([]);
  const [cut, setCut] = useState(0);
  const [season, setSeason] = useState("");
  const [cupRows, setCupRows] = useState<CupRow[]>([]);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(0); // set after mount: nowMs() during the first render breaks static prerendering
  const [tab, setTab] = useState<Tab>("upcoming");
  const [pickedRound, setPickedRound] = useState(0); // 0 = the latest round that was played
  const [saving, setSaving] = useState(false);
  const liveSquad = useRef<Player[]>([]);
  const [playing, setPlaying] = useState<PlayedMatchday | null>(null);
  const [permission, setPermission] = useState<string>("default");
  const [sheet, setSheet] = useState<{ squad: import("@/lib/football/squads").Player[]; fitness: Record<string, number> } | null>(null);

  const fetchMatches = useCallback(
    async (uid: string, league: string, seasonName: string): Promise<StoredMatch[]> => {
      const { data, error: fetchError } = await supabase
        .from("league_matches")
        .select("*")
        .eq("user_id", uid)
        .eq("league_id", league)
        .eq("season", seasonName)
        .order("matchday", { ascending: true });

      if (fetchError) throw fetchError;
      return (data ?? []) as StoredMatch[];
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/");
          return;
        }

        const { data: contract, error: contractError } = await supabase
          .from("manager_contracts")
          .select("manager_name, selected_club, selected_league, room_id, club_appointed_at")
          .eq("user_id", user.id)
          .maybeSingle();

        if (contractError) throw contractError;

        if (!contract?.selected_club || !contract?.selected_league) {
          router.replace("/game/leagues");
          return;
        }

        // a career inside one of the CAF cups keeps all its matches on the cup page
        if (isCafCup(contract.selected_league)) {
          router.replace("/game/continental");
          return;
        }

        const current = await activeSeason(supabase, user.id, contract.selected_league);
        let rows = await fetchMatches(user.id, contract.selected_league, current);

        setCut(await loadDeductions(supabase, user.id, contract.selected_league, current));

        // first visit: build the whole season with its dates
        if (rows.length === 0) {
          const season = await seasonRows(
            supabase,
            user.id,
            contract.selected_league,
            current,
            contract.room_id
          );

          for (let i = 0; i < season.length; i += 190) {
            const { error: insertError } = await supabase
              .from("league_matches")
              .insert(season.slice(i, i + 190));
            if (insertError) throw insertError;
          }

          rows = await fetchMatches(user.id, contract.selected_league, current);
        }

        // an older season has no dates yet: give every unplayed matchday its 8 pm
        const undated = [
          ...new Set(
            rows.filter((r) => r.status === "scheduled" && !r.kickoff_at).map((r) => r.matchday)
          ),
        ].sort((a, b) => a - b);

        if (undated.length > 0) {
          const first = firstKickoff();
          const pending = [
            ...new Set(rows.filter((r) => r.status === "scheduled").map((r) => r.matchday)),
          ].sort((a, b) => a - b);

          await Promise.all(
            undated.map((day) =>
              supabase
                .from("league_matches")
                .update({ kickoff_at: matchdayKickoff(first, pending.indexOf(day) + 1).toISOString() })
                .eq("user_id", user.id)
                .eq("league_id", contract.selected_league)
                .eq("season", current)
                .eq("matchday", day)
                .is("kickoff_at", null)
            )
          );

          rows = await fetchMatches(user.id, contract.selected_league, current);
        }

        if (!cancelled) {
          setSeason(current);
          setUserId(user.id);
          setManager(contract as ManagerData);
          setMatches(rows);
        }
      } catch (err) {
        console.error("Fixtures loading error:", err);
        if (!cancelled) setError("Could not load the match centre. Refresh the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router, fetchMatches]);

  // the clock behind the countdown
  // paused while a match is on screen, so the broadcast is never re-rendered every second
  const watching = !!playing;
  useEffect(() => {
    if (watching) return;
    setNow(nowMs());
    const timer = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(timer);
  }, [watching]);

  useEffect(() => {
    void alertState().then((a) => setPermission(a === "none" ? "unsupported" : a));
  }, []);

  const myClub = manager?.selected_club ?? "";

  // my cup matches (league cup, CAF cups, Europe) join the calendar
  useEffect(() => {
    if (!userId || !manager || !season) return;
    let off = false;
    (async () => {
      const out: CupRow[] = [];
      const mineIn = (h: string, a: string) => h === manager.selected_club || a === manager.selected_club;
      try {
        for (const c of await fetchCup(supabase, userId, season, manager.selected_league)) {
          if (mineIn(c.home_club, c.away_club)) out.push({ id: `cup-${c.id}`, code: "CUP", label: "League Cup", href: "/game/cup", home_club: c.home_club, away_club: c.away_club, home_score: c.home_score, away_score: c.away_score, pens_home: c.pens_home, pens_away: c.pens_away, status: c.status, at: c.kickoff_at ? new Date(c.kickoff_at).getTime() : null });
        }
      } catch { /* no league cup yet */ }
      try {
        for (const comp of ["caf-champions-league", "caf-confederation-cup"]) {
          const setup = await fetchContSetup(supabase, userId, comp);
          if (!setup) continue;
          for (const c of await fetchCont(supabase, userId, comp, setup.season)) {
            if (mineIn(c.home_club, c.away_club)) out.push({ id: `cont-${c.id}`, code: "CAF", label: `${cafCup(comp)?.name ?? "CAF"} · ${contRoundLabel(c.round_no)}`, href: "/game/continental", home_club: c.home_club, away_club: c.away_club, home_score: c.home_score, away_score: c.away_score, pens_home: c.pens_home, pens_away: c.pens_away, status: c.status, at: c.played_at ? new Date(c.played_at).getTime() : null });
          }
        }
      } catch { /* no CAF cup */ }
      try {
        for (const setup of await fetchEuroSetups(supabase, userId)) {
          for (const c of await fetchEuro(supabase, userId, setup.comp_id, setup.season)) {
            if (mineIn(c.home_club, c.away_club)) out.push({ id: `euro-${c.id}`, code: setup.comp_id.toUpperCase(), label: `${setup.comp_id === "ucl" ? "Champions League" : "Europa League"} · ${euroRoundLabel(c.round_no)}`, href: "/game/europe", home_club: c.home_club, away_club: c.away_club, home_score: c.home_score, away_score: c.away_score, pens_home: c.pens_home, pens_away: c.pens_away, status: c.status, at: c.played_at ? new Date(c.played_at).getTime() : null });
          }
        }
      } catch { /* no European cup */ }
      if (!off) setCupRows(out);
    })();
    return () => { off = true; };
  }, [userId, manager, season, matches]);

  const mine = useMemo(
    () =>
      matches
        .filter((m) => m.home_club === myClub || m.away_club === myClub)
        .sort((a, b) => a.matchday - b.matchday),
    [matches, myClub]
  );

  const next = mine.find((m) => m.status === "scheduled");
  const ready = !!next && canKickOff(next, now);
  const remaining =
    next?.kickoff_at ? new Date(next.kickoff_at).getTime() - now : 0;
  const t = splitDuration(remaining);

  const standings = useMemo(() => calculateStandings(matches, undefined, myClub ? { [myClub]: cut } : undefined), [matches, cut, myClub]);
  const position = standings.findIndex((s) => s.clubId === myClub) + 1;

  const visible = mine.filter((m) =>
    tab === "all"
      ? true
      : tab === "upcoming"
        ? m.status === "scheduled"
        : m.status === "completed"
  );
  type CalItem = { at: number; league?: StoredMatch; cup?: CupRow };
  const cupVisible = cupRows.filter((c) => (tab === "all" ? true : tab === "upcoming" ? c.status === "scheduled" : c.status === "completed"));
  const calendar: CalItem[] = [
    ...visible.map((m) => ({ at: m.kickoff_at ? new Date(m.kickoff_at).getTime() : Number.MAX_SAFE_INTEGER - m.matchday, league: m })),
    ...cupVisible.map((c) => ({ at: c.at ?? Number.MAX_SAFE_INTEGER, cup: c })),
  ].sort((x, y) => x.at - y.at);
  const rows = tab === "results" ? [...visible].reverse() : visible;
  const items = tab === "results" ? [...calendar].reverse() : calendar;

  // every match of one matchday, all clubs: the arrows move between rounds
  const lastRound = useMemo(() => matches.reduce((n, m) => Math.max(n, m.matchday), 0), [matches]);
  const latestPlayed = useMemo(() => matches.reduce((n, m) => (m.status === "completed" ? Math.max(n, m.matchday) : n), 0), [matches]);
  const round = Math.min(lastRound, Math.max(1, pickedRound || latestPlayed || next?.matchday || 1));
  const roundMatches = useMemo(() => matches.filter((m) => m.matchday === round).sort((a, b) => (a.home_club < b.home_club ? -1 : 1)), [matches, round]);

  async function openSheet() {
    if (!next || !ready || saving || !manager) return;
    setSaving(true);
    try {
      const sim = await withTimeout(loadSim(supabase, { userId, clubId: myClub, roomId: manager?.room_id ?? null, season, matchday: next.matchday, leagueId: manager?.selected_league }), 8000);
      setSheet({ squad: sim.squads?.[myClub] ?? squadOf(myClub), fitness: sim.fitness ?? {} });
    } catch {
      setSheet({ squad: squadOf(myClub), fitness: {} });
    } finally {
      setSaving(false);
    }
  }

  async function startMatch() {
    if (!next || !ready || saving || !manager) return;

    setSaving(true);
    setError("");

    try {
      const sim = await withTimeout(loadSim(supabase, { userId, clubId: myClub, roomId: manager.room_id, season, matchday: next.matchday, leagueId: manager.selected_league }), 8000).catch(() => ({ bonus: {} as Record<string, number>, roomId: manager.room_id, squads: undefined }));
      // the server decides the scores (it reads the same lineup and tactic): the page only shows them
      const prefs: Record<string, string> = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith(`gsm-lineup:${userId}:`) || k.startsWith(`gsm-tactic:${userId}:`))) prefs[k] = localStorage.getItem(k) ?? "";
        }
      } catch { /* the saved ones are used */ }
      const served = await withTimeout(playOnServer(supabase, season, next.matchday, prefs), 25000);
      const result = await withTimeout(
        playMatchday(supabase, matches, next.matchday, myClub, manager.room_id ?? userId, sim, served ?? undefined),
        20000
      );
      liveSquad.current = sim.squads?.[myClub] ?? squadOf(myClub);
      // the eleven that play are saved: it is what tires them
      void saveLineup(supabase, userId, season, next.matchday, myClub, currentLineup(userId, myClub, liveSquad.current, { key: manager.room_id ?? userId, season, matchday: next.matchday }).starters.map((p) => p.id));
      setPlaying(result);
    } catch (err) {
      console.error("Start match error:", err);
      setError(
        "The match could not start. Check your connection and try again. If it keeps failing, the kickoff time may not have arrived yet."
      );
    } finally {
      setSaving(false);
    }
  }

  /** what the manager can change at half-time, and how it is saved */
  function halftimeProps(match: StoredMatch) {
    if (!manager) return undefined;
    const squad = liveSquad.current;
    if (squad.length < 14) return undefined;
    const day = { key: manager.room_id ?? userId, season, matchday: match.matchday };
    const eleven = currentLineup(userId, myClub, squad, day).starters;
    const ids = new Set(eleven.map((p) => p.id));
    const fit = availableSquad(squad, day.key, day.season, day.matchday);
    const bench = fit.filter((p) => !ids.has(p.id));
    const home = match.home_club === myClub;
    const opp = home ? match.away_club : match.home_club;
    return {
      clubId: myClub,
      starters: eleven,
      bench,
      apply: async (change: { starters: Player[]; style: "attack" | "balanced" | "defend"; subs: number }, now: Revised) => {
        // the server redraws the second half and saves the new score (once per match)
        const served = await withTimeout(halftimeOnServer(supabase, match.id, change.starters.map((p) => p.id), change.style, ownPrefs(userId)), 25000);
        if (served) return served;
        const delta = (bonusFor(change.starters, myClub) - bonusFor(eleven, myClub)) * 0.6;
        const revised = reviseSecondHalf({
          events: now.events,
          myIsHome: home,
          delta,
          style: change.style,
          seed: `${day.key}|${season}|${match.matchday}|${match.home_club}|${match.away_club}|ht|${change.starters.map((p) => p.id).join(",")}|${change.style}`,
          myClub,
          myEleven: change.starters,
          mySquad: squad,
          theirSquad: availableSquad(squadOf(opp), day.key, day.season, day.matchday),
          clubName: { mine: clubOf(myClub)?.name ?? myClub, theirs: clubOf(opp)?.name ?? opp },
        });
        const { error: upError } = await supabase
          .from("league_matches")
          .update({ home_score: revised.home_score, away_score: revised.away_score })
          .eq("id", match.id);
        if (upError) throw upError;
        if (manager.room_id) {
          // the shared result follows, when the league allows the update
          await supabase
            .from("room_results")
            .update({ home_score: revised.home_score, away_score: revised.away_score })
            .eq("room_id", manager.room_id)
            .eq("season", season)
            .eq("matchday", match.matchday)
            .eq("home_club", match.home_club)
            .eq("away_club", match.away_club);
        }
        return revised;
      },
    };
  }

  async function closeMatch() {
    const played = playing?.mine?.match ?? null;
    setPlaying(null);
    if (manager) {
      try {
        const fresh = await fetchMatches(userId, manager.selected_league, season);
        setMatches(fresh);
        void tellFriend(played, fresh);
        // the board has the last word after every result
        if (evaluateBoard(fresh as unknown as BoardMatch[], manager.selected_club, (manager as { club_appointed_at?: string | null }).club_appointed_at).sacked) {
          router.replace("/game/sacked");
        }
      } catch {
        /* the list refreshes on the next visit */
      }
    }
  }

  /** when the opponent is a friend of this shared league, he is told the match was played */
  async function tellFriend(played: { id: string; matchday: number; home_club: string; away_club: string } | null, fresh: { id: string; home_score: number | null; away_score: number | null }[]) {
    if (!played || !manager?.room_id) return;
    try {
      const final = fresh.find((m) => m.id === played.id);
      if (!final || final.home_score === null || final.away_score === null) return;
      const opponent = played.home_club === myClub ? played.away_club : played.home_club;
      const room = await myRoom(supabase, manager.room_id);
      const pal = room?.members.find((m) => m.club_id === opponent && m.user_id !== userId);
      if (!pal) return;
      await sendFriendNotice(supabase, { to: pal.user_id, from: userId, fromName: manager.manager_name || "A friend", season, home: played.home_club, away: played.away_club, hs: final.home_score, as: final.away_score, kind: "league", matchday: played.matchday });
    } catch { /* the message is optional */ }
  }

  async function startNewSeason() {
    if (!manager || restarting) return;
    setRestarting(true);
    setError("");

    try {
      // keep this season's trophies before the table moves on
      await recordSeasonTrophies(
        supabase,
        userId,
        manager.selected_club,
        manager.selected_league,
        season,
        summarizeSeason(manager.selected_club, matches as never[])
      );

      const upcoming = nextSeason(season);
      const fixtures = await seasonRows(supabase, userId, manager.selected_league, upcoming, manager.room_id);

      for (let i = 0; i < fixtures.length; i += 190) {
        const { error: insertError } = await supabase
          .from("league_matches")
          .insert(fixtures.slice(i, i + 190));
        if (insertError) throw insertError;
      }

      setMatches(await fetchMatches(userId, manager.selected_league, upcoming));
      setSeason(upcoming);
      setConfirmRestart(false);
      setTab("upcoming");
    } catch (err) {
      console.error("New season error:", err);
      setError("Could not start the new season. Try again.");
    } finally {
      setRestarting(false);
    }
  }

  async function enableAlerts() {
    { const a = await askAlerts(); setPermission(a === "none" ? "unsupported" : a); }
  }

  if (loading) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Setting up the season calendar...</p>
      </main>
    );
  }

  if (!manager) {
    return (
      <main className="fx-loading">
        <p>{error || "Could not load the match centre."}</p>
        <button type="button" onClick={() => router.push("/game/dashboard")}>
          Back to dashboard
        </button>
      </main>
    );
  }

  const nextHome = next ? clubOf(next.home_club) : null;
  const nextAway = next ? clubOf(next.away_club) : null;
  const played = mine.filter((m) => m.status === "completed").length;

  return (
    <main className="fx gx-grain">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="fx-bg gx-kb" aria-hidden="true" />
      <div className="fx-shade" aria-hidden="true" />

      <GameHud season={season ? seasonLabel(season) : undefined} onBack={() => router.push("/game/dashboard")} />

      <div className="fx-body">
        <section className="fx-hero">
          <div className="fx-title">
            <h1>
              <span className="gx-slant">Match</span>
              <span className="gx-slant">centre</span>
            </h1>
            <p>
              Every matchday kicks off at 8:00 pm Cairo time. A match is only played when you
              press start.
            </p>
            <p className="fx-progress">
              {played} of {mine.length} played
              {position > 0 && played > 0 ? `, ${position}${["th", "st", "nd", "rd"][position % 10 > 3 || [11, 12, 13].includes(position) ? 0 : position % 10]} in the league` : ""}
            </p>
          </div>

          {next ? (
            <article className="fx-next gx-cut" aria-label="Next match">
              <header>
                <span>Matchday {next.matchday} of {mine.length}</span>
                <time>{next.kickoff_at ? formatKickoff(next.kickoff_at) : "Date to be set"}</time>
              </header>

              <div className="fx-versus">
                <div className="fx-team">
                  {nextHome && <img src={nextHome.logo} alt="" />}
                  <strong>{nextHome?.name}</strong>
                  <small>{next.home_club === myClub ? "Your club, home" : "Home"}</small>
                </div>
                <i>VS</i>
                <div className="fx-team">
                  {nextAway && <img src={nextAway.logo} alt="" />}
                  <strong>{nextAway?.name}</strong>
                  <small>{next.away_club === myClub ? "Your club, away" : "Away"}</small>
                </div>
              </div>

              {!ready && next.kickoff_at && (
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
                onClick={openSheet}
                disabled={!ready || saving}
              >
                {saving ? "Kicking off..." : ready ? "Start match" : "Waiting for kickoff"}
                <Icon name="ball" size={22} />
              </button>

              {error && (
                <p className="fx-error" role="alert">
                  {error}
                </p>
              )}
            </article>
          ) : (
            <article className="fx-next fx-done gx-cut">
              <Icon name="star" size={34} />
              <h2>Season complete</h2>
              <p>
                You finished {position}
                {["th", "st", "nd", "rd"][position % 10 > 3 || [11, 12, 13].includes(position) ? 0 : position % 10]} in
                the league.
              </p>
              {manager?.selected_league === "egyptian-premier-league" && cupForPosition(position) && (
                <p className="fx-done-warn">
                  You qualified for the {cafCup(cupForPosition(position) as string)?.name}. It opens next season, alongside the league: start the new season and play your first league matches to unlock its first round.
                </p>
              )}
              {!confirmRestart ? (
                <div className="fx-done-actions">
                  <button type="button" className="fx-ghost" onClick={() => router.push("/game/awards")}>
                    Season awards and prize money
                  </button>
                  <button type="button" className="gx-btn" onClick={() => setConfirmRestart(true)}>
                    Play {seasonLabel(nextSeason(season))} with {clubOf(myClub)?.name ?? "your club"}
                  </button>
                  <button type="button" className="fx-ghost" onClick={() => router.push("/game/leagues")}>
                    Change league or club
                  </button>
                </div>
              ) : (
                <div className="fx-done-actions" role="group" aria-label="Confirm a new season">
                  <p className="fx-done-warn">
                    A new 38-round season starts tomorrow at 8 pm. This season stays in your history and
                    the club balance starts again.
                  </p>
                  <button type="button" className="gx-btn" onClick={startNewSeason} disabled={restarting}>
                    {restarting ? "Building the season..." : "Yes, start it"}
                  </button>
                  <button type="button" className="fx-ghost" onClick={() => setConfirmRestart(false)} disabled={restarting}>
                    Not yet
                  </button>
                </div>
              )}
            </article>
          )}
        </section>

        {permission !== "unsupported" && (
          <div className="fx-alerts">
            <Icon name="chat" size={18} />
            {permission === "granted" ? (
              <span>Match alerts are on. You will be notified when a matchday kicks off.</span>
            ) : permission === "denied" ? (
              <span>Alerts are blocked in your browser. Allow notifications for this site to turn them on.</span>
            ) : (
              <>
                <span>Get a notification when a matchday kicks off.</span>
                <button type="button" onClick={enableAlerts}>
                  Turn on alerts
                </button>
              </>
            )}
          </div>
        )}

        <section className="fx-calendar gx-cut" aria-label="Season calendar">
          <div className="fx-cal-head">
            <h2>Season calendar</h2>
            <div className="fx-tabs" role="tablist">
              {(["upcoming", "results", "all", "round"] as Tab[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                >
                  {id === "upcoming" ? "Upcoming" : id === "results" ? "Results" : id === "all" ? "All" : "Round"}
                </button>
              ))}
            </div>
          </div>

          {tab === "round" ? (
            <div className="fx-round">
              <div className="fx-round-nav">
                <button type="button" aria-label="Previous matchday" disabled={round <= 1} onClick={() => setPickedRound(round - 1)}>&#8249;</button>
                <div>
                  <strong>Matchday {round}</strong>
                  <small>{roundMatches[0]?.kickoff_at ? formatKickoffDay(roundMatches[0].kickoff_at) : "All results of the round"}</small>
                </div>
                <button type="button" aria-label="Next matchday" disabled={round >= lastRound} onClick={() => setPickedRound(round + 1)}>&#8250;</button>
              </div>
              <ul className="fx-round-list">
                {roundMatches.map((m) => {
                  const h = clubOf(m.home_club), a = clubOf(m.away_club);
                  const done = m.status === "completed";
                  const mineRow = m.home_club === myClub || m.away_club === myClub;
                  return (
                    <li key={m.id} className={mineRow ? "is-mine" : undefined}>
                      <span className="fx-r-home">{h?.name ?? m.home_club}{h && <img src={h.logo} alt="" />}</span>
                      <b className="fx-r-score">{done ? `${m.home_score} - ${m.away_score}` : "vs"}</b>
                      <span className="fx-r-away">{a && <img src={a.logo} alt="" />}{a?.name ?? m.away_club}</span>
                    </li>
                  );
                })}
                {roundMatches.length === 0 && <li className="fx-empty">No matches in this round.</li>}
              </ul>
            </div>
          ) : items.length === 0 ? (
            <p className="fx-empty">
              {tab === "results"
                ? "No matches played yet. Your results will appear here."
                : "Nothing left to play this season."}
            </p>
          ) : (
            <ul className="fx-rows">
              {items.map((item) => {
                if (item.cup) {
                  const c = item.cup;
                  const isHome = c.home_club === myClub;
                  const opp = clubOf(isHome ? c.away_club : c.home_club);
                  const mineGoals = (isHome ? c.home_score : c.away_score) ?? 0;
                  const theirGoals = (isHome ? c.away_score : c.home_score) ?? 0;
                  const res = c.status === "completed" ? (mineGoals > theirGoals ? "win" : mineGoals < theirGoals ? "loss" : (c.pens_home ?? 0) !== (c.pens_away ?? 0) ? ((isHome ? (c.pens_home ?? 0) > (c.pens_away ?? 0) : (c.pens_away ?? 0) > (c.pens_home ?? 0)) ? "win" : "loss") : "draw") : null;
                  return (
                    <li key={c.id} className="fx-cuprow">
                      <span className="fx-md">{c.code}</span>
                      <span className="fx-date">
                        {c.at ? formatKickoffDay(new Date(c.at).toISOString()) : "-"}
                        <small>{c.label}</small>
                      </span>
                      <span className="fx-ha">{isHome ? "Home" : "Away"}</span>
                      <span className="fx-opp">
                        {opp && <img src={opp.logo} alt="" />}
                        {opp?.name}
                      </span>
                      {res ? (
                        <span className="fx-score" data-result={res}>{c.home_score}-{c.away_score}</span>
                      ) : (
                        <button type="button" className="fx-state" onClick={() => router.push(c.href)}>Open</button>
                      )}
                    </li>
                  );
                }
                const m = item.league!;
                const isHome = m.home_club === myClub;
                const opp = clubOf(isHome ? m.away_club : m.home_club);
                const result = outcome(m, myClub);
                const isNext = next?.id === m.id;
                return (
                  <li key={m.id} className={isNext ? "is-next" : undefined}>
                    <span className="fx-md">{m.matchday}</span>
                    <span className="fx-date">
                      {m.kickoff_at ? formatKickoffDay(m.kickoff_at) : "-"}
                      <small>8:00 pm</small>
                    </span>
                    <span className="fx-ha">{isHome ? "Home" : "Away"}</span>
                    <span className="fx-opp">
                      {opp && <img src={opp.logo} alt="" />}
                      {opp?.name}
                    </span>
                    {result ? (
                      <span className="fx-score" data-result={result}>
                        {m.home_score}-{m.away_score}
                      </span>
                    ) : (
                      <span className="fx-state">{isNext ? (ready ? "Ready" : "Next") : "Scheduled"}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {playing?.mine && (
        playing.mine && (
          <MatchOverlay
            homeClub={playing.mine.match.home_club}
            awayClub={playing.mine.match.away_club}
            homeScore={playing.mine.result.home_score}
            awayScore={playing.mine.result.away_score}
            events={playing.mine.result.events}
            myClub={myClub}
            label={`Matchday ${playing.mine.match.matchday}`}
            press={{ userId, season: playing.mine.match.season, matchday: playing.mine.match.matchday, kind: "league", roomId: manager?.room_id, managerName: manager?.manager_name }}
            halftime={halftimeProps(playing.mine.match)}
            othersTitle={`Other results, matchday ${playing.mine.match.matchday}`}
            others={playing.others.map(({ match }) => match)}
            closeLabel="Back to match centre"
            onClose={closeMatch}
          />
        )
      )}
      {sheet && next && (
        <TeamSheet
          userId={userId}
          clubId={myClub}
          squad={sheet.squad}
          day={{ key: manager?.room_id ?? userId, season, matchday: next.matchday }}
          fitness={sheet.fitness}
          opponent={clubOf(next.home_club === myClub ? next.away_club : next.home_club)?.name ?? "the opponent"}
          onCancel={() => setSheet(null)}
          onConfirm={() => {
            setSheet(null);
            startMatch();
          }}
        />
      )}
    </main>
  );
}
