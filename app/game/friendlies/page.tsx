"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs, clubsOfLeague } from "@/lib/football/leagueClubs";
import { getTier } from "@/lib/football/finance";
import { activeSeason, seasonLabel } from "@/lib/football/season";
import { simulateFixture, type SimulationResult } from "@/lib/football/matchSim";
import { friendlyIncome, loadFriendlies, sendFriendNotice, type Friendly } from "@/lib/football/friendlies";
import { myRoom } from "@/lib/football/rooms";
import { loadSim, withTimeout } from "@/lib/football/strength";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
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
      const ids = [...new Set(list.flatMap((m) => [m.home_club, m.away_club]))].filter((id) => id !== contract.selected_club);
      const fallback = clubsOfLeague(leagueId).filter((c) => c.id !== contract.selected_club).map((c) => c.id);
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

  const used = slot !== null && history.some((f) => f.after_matchday === slot);
  const earned = history.reduce((sum, f) => sum + Number(f.income), 0);
  const list = useMemo(
    () => (opponents.map((id) => clubs.find((c) => c.id === id)).filter(Boolean) as NonNullable<ReturnType<typeof clubs.find>>[])
      .sort((a, b) => Number(!!friends[b.id]) - Number(!!friends[a.id])),
    [opponents, friends]
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
      const homeClub = home ? myClub : target;
      const awayClub = home ? target : myClub;
      const result = simulateFixture({
        leagueKey: `friendly|${userId}`,
        season,
        matchday: 100 + slot,
        homeClub,
        awayClub,
        homeBonus: sim.bonus[homeClub],
        awayBonus: sim.bonus[awayClub],
        squads: sim.squads,
      });
      const income = friendlyIncome(target);
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
      const pal = friends[target];
      if (pal) {
        // the friend is told he was played
        void sendFriendNotice(supabase, { to: pal.user_id, from: userId, fromName: myName, season, home: homeClub, away: awayClub, hs: result.home_score, as: result.away_score });
      }
      setPlayed({ home: homeClub, away: awayClub, result, income });
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

  return (
    <main className="fr">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="fr-bg gx-kb" aria-hidden="true" />
      <div className="fr-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="fr-wrap">
        <header className="fr-head">
          <p>Season {seasonLabel(season)}</p>
          <h1><span className="gx-slant">Friendlies</span></h1>
          <small>One warm-up match before each league matchday. A little gate money, and your players get match practice. The table is not affected.</small>
        </header>

        <section className="fr-stage gx-cut" aria-label="Next friendly">
          <div className="fr-side">
            {me && <img src={me.logo} alt="" />}
            <strong>{me?.name}</strong>
          </div>
          <div className="fr-vs">
            <i>VS</i>
            {slot === null ? (
              <span className="fr-done">The season is over. Friendlies come back with the new one.</span>
            ) : used ? (
              <span className="fr-done">Played this week. The next one opens after matchday {slot}.</span>
            ) : (
              <button type="button" className="gx-btn" disabled={!target || busy} onClick={play}>
                {busy ? "Warming up..." : target ? `Play friendly +${friendlyIncome(target).toFixed(2)}M` : "Choose an opponent"}
              </button>
            )}
            {error && <span className="fr-error" role="alert">{error}</span>}
          </div>
          <div className={`fr-side ${opp ? "" : "is-empty"}`}>
            {opp ? <img src={opp.logo} alt="" key={opp.id} /> : <span aria-hidden="true">?</span>}
            <strong>{opp?.name ?? "Opponent"}</strong>
            {opp && friends[opp.id] && <small className="fr-pal">Friend: {friends[opp.id].name}</small>}
          </div>
        </section>

        {slot !== null && !used && (
          <section className="fr-grid" aria-label="Choose an opponent">
            {list.map((c, i) => (
              <button
                key={c.id}
                type="button"
                className={`fr-club gx-cut ${target === c.id ? "is-on" : ""} ${friends[c.id] ? "is-pal" : ""}`}
                style={{ animationDelay: `${i * 25}ms` }}
                onClick={() => setTarget(c.id)}
                aria-pressed={target === c.id}
              >
                <img src={c.logo} alt="" />
                <strong>{c.name}</strong>
                <small>{friends[c.id] ? `Friend: ${friends[c.id].name}` : tierLabel(c.id)}</small>
                <em>+{friendlyIncome(c.id).toFixed(2)}M</em>
              </button>
            ))}
          </section>
        )}

        <section className="fr-history gx-cut" aria-label="Played friendlies">
          <header>
            <h2>This season</h2>
            <span>Earned <b>{earned.toFixed(2)}M</b></span>
          </header>
          {history.length === 0 ? (
            <p>No friendlies yet.</p>
          ) : (
            <ul>
              {[...history].sort((a, b) => b.after_matchday - a.after_matchday).map((f) => (
                <li key={f.after_matchday}>
                  <small>Before matchday {f.after_matchday + 1}</small>
                  <span>{name(f.home_club)} <b>{f.home_score}-{f.away_score}</b> {name(f.away_club)}{f.opp_manager ? <em className="fr-with"> · vs {f.opp_manager}</em> : null}</span>
                  <em>+{Number(f.income).toFixed(2)}M</em>
                </li>
              ))}
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
          closeLabel={`Back to friendlies (+${played.income.toFixed(2)}M)`}
          onClose={() => {
            setPlayed(null);
            refresh(userId, season);
          }}
        />
      )}
    </main>
  );
}
