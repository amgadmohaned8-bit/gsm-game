"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs, clubsOfLeague } from "@/lib/football/leagueClubs";
import { getTier } from "@/lib/football/finance";
import { activeSeason, seasonLabel } from "@/lib/football/season";
import { simulateFixture, type SimulationResult } from "@/lib/football/matchSim";
import { FRIENDLIES_PER_ROUND, loadFriendlies, sendFriendNotice, type Friendly } from "@/lib/football/friendlies";
import { myRoom } from "@/lib/football/rooms";
import { currentLineup, loadSim, withTimeout } from "@/lib/football/strength";
import { sessionGain } from "@/lib/football/development";
import { squadOf } from "@/lib/football/squads";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import MatchOverlay from "@/components/MatchOverlay";
import "./friendlies.css";

type Played = { home: string; away: string; result: SimulationResult; income: number };

const tierLabel = (id: string) => (getTier(id) === "elite" ? "Big club" : getTier(id) === "mid" ? "Mid-table" : "Smaller club");

export default function FriendliesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [myClub, setMyClub] = useState("");
  const [season, setSeason] = useState("");
  const [slot, setSlot] = useState<number | null>(null);
  const [opponents, setOpponents] = useState<string[]>([]);
  const [history, setHistory] = useState<Friendly[]>([]);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [played, setPlayed] = useState<Played | null>(null);
  const roomRef = useRef<string | null>(null);
  const [leagueId, setLeagueId] = useState("");
  const [myName, setMyName] = useState("");
  /** clubs run by a friend in the same shared league: club id -> the friend */
  const [friends, setFriends] = useState<Record<string, { user_id: string; name: string }>>({});

  async function refresh(uid: string, s: string, league = leagueId, club = myClub) {
    setHistory(await loadFriendlies(supabase, uid, s, { leagueId: league, club }));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/");
      const { data: contract } = await supabase
        .from("manager_contracts")
        .select("selected_club, selected_league, room_id, manager_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!contract?.selected_club) return router.replace("/game/leagues");

      const leagueId = contract.selected_league || "premier-league";
      const s = await activeSeason(supabase, user.id, leagueId);
      const { data: rows } = await supabase
        .from("league_matches")
        .select("home_club, away_club, matchday, status")
        .eq("user_id", user.id)
        .eq("league_id", leagueId)
        .eq("season", s);
      const list = (rows ?? []) as { home_club: string; away_club: string; matchday: number; status: string }[];
      const open = list.filter((m) => m.status === "scheduled").map((m) => m.matchday);
      // the club of the next league match is not a friendly opponent
      const nextDay = open.length ? Math.min(...open) : null;
      const nextMatch = nextDay === null ? undefined : list.find((m) => m.matchday === nextDay && (m.home_club === contract.selected_club || m.away_club === contract.selected_club));
      const nextOpp = nextMatch ? (nextMatch.home_club === contract.selected_club ? nextMatch.away_club : nextMatch.home_club) : "";
      const ids = [...new Set(list.flatMap((m) => [m.home_club, m.away_club]))].filter((id) => id !== contract.selected_club && id !== nextOpp);
      const fallback = clubsOfLeague(leagueId).filter((c) => c.id !== contract.selected_club && c.id !== nextOpp).map((c) => c.id);
      if (cancelled) return;
      roomRef.current = contract.room_id ?? null;
      const pals: Record<string, { user_id: string; name: string }> = {};
      if (contract.room_id) {
        try {
          const room = await myRoom(supabase, contract.room_id);
          for (const m of room?.members ?? []) if (m.user_id !== user.id) pals[m.club_id] = { user_id: m.user_id, name: m.name || "Friend" };
        } catch { /* no friends to show */ }
      }
      if (cancelled) return;
      setFriends(pals);
      setLeagueId(leagueId);
      setMyName(contract.manager_name || "A friend");
      setUserId(user.id);
      setMyClub(contract.selected_club);
      setSeason(s);
      setSlot(open.length ? Math.min(...open) : list.length === 0 ? 1 : null);
      setOpponents(ids.length ? ids : fallback);
      await refresh(user.id, s, leagueId, contract.selected_club);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const inRound = slot === null ? [] : history.filter((f) => f.after_matchday === slot);
  const count = inRound.length;
  const used = slot !== null && count >= FRIENDLIES_PER_ROUND;
  /** a club already played in this round is not offered again */
  const metClubs = new Set(inRound.flatMap((f) => [f.home_club, f.away_club]));
  const list = useMemo(
    () => (opponents.filter((id) => !metClubs.has(id)).map((id) => clubs.find((c) => c.id === id)).filter(Boolean) as NonNullable<ReturnType<typeof clubs.find>>[])
      .sort((a, b) => Number(!!friends[b.id]) - Number(!!friends[a.id])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opponents, friends, history, slot]
  );

  async function play() {
    if (slot === null || !target || used || busy) return;
    setBusy(true);
    setError("");
    try {
      const sim = await withTimeout(loadSim(supabase, { userId, clubId: myClub, roomId: null, season, matchday: slot, leagueId }), 8000).catch(() => ({
        bonus: {} as Record<string, number>,
        squads: undefined,
      }));
      const home = Math.random() < 0.5; // only the venue is random
      const shine = 4 + Math.floor(Math.random() * 4);
      const homeClub = home ? myClub : target;
      const awayClub = home ? target : myClub;
      const result = simulateFixture({
        leagueKey: `friendly|${userId}`,
        season,
        matchday: 100 + slot + count * 1000,
        homeClub,
        awayClub,
        // in a friendly my players shine: a few rating points more than usual, like a team in top form
        homeBonus: (sim.bonus[homeClub] ?? 0) + (homeClub === myClub ? shine : 0),
        awayBonus: (sim.bonus[awayClub] ?? 0) + (awayClub === myClub ? shine : 0),
        squads: sim.squads,
      });
      const income = 0; // friendlies pay nothing
      const { error: insertError } = await supabase.from("friendlies").insert({
        user_id: userId,
        season,
        after_matchday: slot,
        home_club: homeClub,
        away_club: awayClub,
        home_score: result.home_score,
        away_score: result.away_score,
        income,
        league_id: leagueId || "premier-league",
        opp_manager: friends[target]?.name ?? null,
      });
      if (insertError) throw insertError;

      // a friendly is also a little match practice: the starters gain a small share of a training session
      try {
        const own = sim.squads?.[myClub] ?? squadOf(myClub);
        const rows = currentLineup(userId, myClub, own).starters
          .map((p) => ({ user_id: userId, league_id: leagueId, season, matchday: -(slot * 10 + count + 1), player_id: p.id, gain: Math.max(0.01, Math.round(sessionGain(p.age) * 0.2 * 100) / 100) }));
        if (rows.length) await supabase.from("training_sessions").insert(rows);
      } catch { /* the friendly still counts without the practice */ }
      const pal = friends[target];
      if (pal) {
        // the friend is told he was played
        void sendFriendNotice(supabase, { to: pal.user_id, from: userId, fromName: myName, season, home: homeClub, away: awayClub, hs: result.home_score, as: result.away_score });
      }
      setPlayed({ home: homeClub, away: awayClub, result, income });
      setTarget("");
    } catch (err) {
      console.error("Friendly error:", err);
      setError("Could not play the friendly. Make sure supabase/009 and 016_friendlies_scope_notices.sql have been run.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Loading friendlies...</p>
      </main>
    );
  }

  const name = (id: string) => clubs.find((c) => c.id === id)?.name ?? id;
  const me = clubs.find((c) => c.id === myClub);
  const opp = clubs.find((c) => c.id === target);
  const outcome = (f: Friendly) => {
    const mine = f.home_club === myClub ? f.home_score : f.away_score;
    const theirs = f.home_club === myClub ? f.away_score : f.home_score;
    return mine > theirs ? "win" : mine < theirs ? "loss" : "draw";
  };
  const past = [...history].sort((a, b) => b.after_matchday - a.after_matchday);
  const canPlay = slot !== null && !used;
  const playLabel = busy ? "Warming up..." : target ? `Play Friendly Match` : "Choose an opponent";

  return (
    <main className="ff">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="ff-bg gx-kb" aria-hidden="true" />
      <div className="ff-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="ff-wrap">
        <header className="ff-banner">
          <Icon name="ball" size={44} />
          <div>
            <h1>Friendly Matches</h1>
            <p>Up to {FRIENDLIES_PER_ROUND} warm-up matches before each league matchday, each against a different club. You play with your saved lineup and tactics, your players shine a little more than usual, and there is no money in them. The club of your next league match is not on the list. Your table is not affected.</p>
          </div>
        </header>

        <div className="ff-top">
          <section className="ff-next" aria-label="Next friendly match">
            <h2><Icon name="calendar" size={22} /> Next Friendly Match</h2>
            <div className="ff-vsrow">
              <div className="ff-team">
                {me && <img src={me.logo} alt="" />}
                <strong>{me?.name}</strong>
              </div>
              <div className="ff-mid">
                <b>VS</b>
                <small>Friendly Match</small>
              </div>
              <div className={`ff-team ${opp ? "" : "is-empty"}`}>
                {opp ? <img src={opp.logo} alt="" key={opp.id} /> : <span aria-hidden="true">?</span>}
                <strong>{opp?.name ?? "Pick an opponent"}</strong>
                {opp && friends[opp.id] && <small className="ff-pal">Friend: {friends[opp.id].name}</small>}
              </div>
            </div>
            <p className="ff-meta">
              <span><Icon name="calendar" size={18} /> {slot === null ? "Season over" : `Before matchday ${slot + 1}`}</span>
              <i aria-hidden="true" />
              <span><Icon name="pin" size={18} /> {count} of {FRIENDLIES_PER_ROUND} played</span>
            </p>
          </section>

          <section className="ff-play" aria-label="Play">
            <svg className="ff-ball" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="ffb" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff" /><stop offset=".6" stopColor="#e3e7ee" /><stop offset="1" stopColor="#8f98a8" /></radialGradient></defs><circle cx="50" cy="50" r="48" fill="url(#ffb)" /><g fill="#161a22" stroke="#161a22" strokeWidth="1.5" strokeLinejoin="round"><polygon points="50,33 65,44 59,62 41,62 35,44" /><polygon points="50,2 61,10 50,17 39,10" /><polygon points="94,40 90,54 80,50 82,38" /><polygon points="76,88 62,92 60,80 70,74" /><polygon points="24,88 38,92 40,80 30,74" /><polygon points="6,40 10,54 20,50 18,38" /></g><g stroke="#161a22" strokeWidth="1.5" fill="none"><path d="M50 33V17M65 44l15 6M59 62l11 12M41 62L30 74M35 44l-15 6" /></g></svg>
            {slot === null ? (
              <p className="ff-done">The season is over. Friendlies come back with the new one.</p>
            ) : used ? (
              <p className="ff-done">All {FRIENDLIES_PER_ROUND} played this round. More open after matchday {slot + 1}.</p>
            ) : (
              <button type="button" className="ff-go" disabled={!target || busy || !canPlay} onClick={play}>
                <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor" /></svg> {playLabel}
              </button>
            )}
            {error && <span className="ff-error" role="alert">{error}</span>}
          </section>
        </div>

        {canPlay && (
          <section className="ff-pick" aria-label="Choose an opponent">
            <h2>Choose an opponent</h2>
            <div className="ff-grid">
              {list.map((c) => (
                <button key={c.id} type="button" className={`ff-club ${target === c.id ? "is-on" : ""} ${friends[c.id] ? "is-pal" : ""}`} onClick={() => setTarget(c.id)} aria-pressed={target === c.id}>
                  <img src={c.logo} alt="" />
                  <strong>{c.name}</strong>
                  <small>{friends[c.id] ? `Friend: ${friends[c.id].name}` : tierLabel(c.id)}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="ff-past" aria-label="Past friendly matches">
          <h2><Icon name="news" size={22} /> Past Friendly Matches</h2>
          {past.length === 0 ? (
            <p className="ff-none">No friendlies yet. Pick an opponent and play the first one.</p>
          ) : (
            <ul>
              {past.map((f) => {
                const h = clubs.find((c) => c.id === f.home_club), a = clubs.find((c) => c.id === f.away_club);
                const o = outcome(f);
                return (
                  <li key={`${f.after_matchday}-${f.home_club}-${f.away_club}`}>
                    <span className="ff-h">{h && <img src={h.logo} alt="" />}{name(f.home_club)}</span>
                    <b className="ff-sc">{f.home_score} - {f.away_score}</b>
                    <span className="ff-a">{a && <img src={a.logo} alt="" />}{name(f.away_club)}{f.opp_manager ? <em> · vs {f.opp_manager}</em> : null}</span>
                    <small className="ff-when">Before matchday {f.after_matchday + 1}</small>
                    <i className={`ff-res is-${o}`}>{o === "win" ? "Win" : o === "loss" ? "Loss" : "Draw"}</i>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {played && (
        <MatchOverlay
          homeClub={played.home}
          awayClub={played.away}
          homeScore={played.result.home_score}
          awayScore={played.result.away_score}
          events={played.result.events}
          myClub={myClub}
          label="Friendly match"
          othersTitle=""
          others={[]}
          closeLabel="Back to friendlies"
          onClose={() => {
            setPlayed(null);
            refresh(userId, season);
          }}
        />
      )}
    </main>
  );
}
