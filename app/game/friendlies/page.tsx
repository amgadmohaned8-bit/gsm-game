
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs, clubsOfLeague } from "@/lib/football/leagueClubs";
import { getTier } from "@/lib/football/finance";
import { activeSeason, seasonLabel } from "@/lib/football/season";
import { simulateFixture, type SimulationResult } from "@/lib/football/matchSim";
import {
  FRIENDLIES_PER_ROUND,
  loadFriendlies,
  sendFriendNotice,
  type Friendly,
} from "@/lib/football/friendlies";
import { myRoom } from "@/lib/football/rooms";
import { friendlyOnServer } from "@/lib/football/serverPlay";
import {
  currentLineup,
  loadSim,
  withTimeout,
} from "@/lib/football/strength";
import { sessionGain } from "@/lib/football/development";
import { squadOf, teamRating } from "@/lib/football/squads";
import { aiStyle, matchup } from "@/lib/football/tactics";
import GsmMark from "@/components/GsmMark";
import DxBar from "@/components/DxBar";
import MatchOverlay from "@/components/MatchOverlay";
import "./friendlies.css";

type Played = {
  home: string;
  away: string;
  result: SimulationResult;
  income: number;
};

const tierLabel = (id: string) =>
  getTier(id) === "elite"
    ? "Big club"
    : getTier(id) === "mid"
      ? "Mid-table"
      : "Smaller club";

export default function FriendliesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [myClub, setMyClub] = useState("");
  const [season, setSeason] = useState("");
  const [slot, setSlot] = useState<number | null>(null);
  const [opponents, setOpponents] = useState<string[]>([]);
  const [history, setHistory] = useState<Friendly[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [played, setPlayed] = useState<Played | null>(null);

  const roomRef = useRef<string | null>(null);

  const [leagueId, setLeagueId] = useState("");
  const [myName, setMyName] = useState("");

  /** clubs run by a friend in the same shared league: club id -> the friend */
  const [friends, setFriends] = useState<
    Record<string, { user_id: string; name: string }>
  >({});

  async function refresh(
    uid: string,
    s: string,
    league = leagueId,
    club = myClub
  ) {
    setHistory(
      await loadFriendlies(supabase, uid, s, {
        leagueId: league,
        club,
      })
    );
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
        .select(
          "selected_club, selected_league, room_id, manager_name"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (!contract?.selected_club) {
        return router.replace("/game/leagues");
      }

      const leagueId = contract.selected_league || "premier-league";

      const s = await activeSeason(supabase, user.id, leagueId);

      const { data: rows } = await supabase
        .from("league_matches")
        .select("home_club, away_club, matchday, status")
        .eq("user_id", user.id)
        .eq("league_id", leagueId)
        .eq("season", s);

      const list = (rows ?? []) as {
        home_club: string;
        away_club: string;
        matchday: number;
        status: string;
      }[];

      const open = list
        .filter((m) => m.status === "scheduled")
        .map((m) => m.matchday);

      // the club of the next league match is not a friendly opponent
      const nextDay = open.length ? Math.min(...open) : null;

      const nextMatch =
        nextDay === null
          ? undefined
          : list.find(
              (m) =>
                m.matchday === nextDay &&
                (m.home_club === contract.selected_club ||
                  m.away_club === contract.selected_club)
            );

      const nextOpp = nextMatch
        ? nextMatch.home_club === contract.selected_club
          ? nextMatch.away_club
          : nextMatch.home_club
        : "";

      const ids = [
        ...new Set(
          list.flatMap((m) => [m.home_club, m.away_club])
        ),
      ].filter(
        (id) =>
          id !== contract.selected_club &&
          id !== nextOpp
      );

      const fallback = clubsOfLeague(leagueId)
        .filter(
          (c) =>
            c.id !== contract.selected_club &&
            c.id !== nextOpp
        )
        .map((c) => c.id);

      if (cancelled) return;

      roomRef.current = contract.room_id ?? null;

      const pals: Record<
        string,
        { user_id: string; name: string }
      > = {};

      if (contract.room_id) {
        try {
          const room = await myRoom(
            supabase,
            contract.room_id
          );

          for (const m of room?.members ?? []) {
            if (m.user_id !== user.id) {
              pals[m.club_id] = {
                user_id: m.user_id,
                name: m.name || "Friend",
              };
            }
          }
        } catch {
          /* no friends to show */
        }
      }

      if (cancelled) return;

      setFriends(pals);
      setLeagueId(leagueId);
      setMyName(contract.manager_name || "A friend");
      setUserId(user.id);
      setMyClub(contract.selected_club);
      setSeason(s);

      setSlot(
        open.length
          ? Math.min(...open)
          : list.length === 0
            ? 1
            : null
      );

      setOpponents(ids.length ? ids : fallback);

      await refresh(
        user.id,
        s,
        leagueId,
        contract.selected_club
      );

      if (!cancelled) {
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const inRound =
    slot === null
      ? []
      : history.filter((f) => f.after_matchday === slot);

  const count = inRound.length;

  const used =
    slot !== null && count >= FRIENDLIES_PER_ROUND;

  /** a club already played in this round is not offered again */
  const metClubs = new Set(
    inRound.flatMap((f) => [
      f.home_club,
      f.away_club,
    ])
  );

  const list = useMemo(
    () =>
      opponents
        .filter((id) => !metClubs.has(id))
        .map((id) => clubs.find((c) => c.id === id))
        .filter(Boolean) as NonNullable<
        ReturnType<typeof clubs.find>
      >[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [opponents, friends, history, slot]
  ).sort(
    (a, b) =>
      Number(!!friends[b.id]) -
      Number(!!friends[a.id])
  );

  async function play(target: string) {
    if (slot === null || !target || used || busy) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      // the server plays it (venue, shine and score);
      // the old way below is only for before it is deployed
      const served = await withTimeout(
        friendlyOnServer(
          supabase,
          season,
          slot,
          target,
          friends[target]?.name ?? null,
          friends[target]?.user_id ?? null
        ),
        25000
      );

      let homeClub: string;
      let awayClub: string;
      let result: SimulationResult;

      const income = 0; // friendlies pay nothing

      if (served) {
        homeClub = served.home;
        awayClub = served.away;
        result = served.result;
      } else {
        const sim = await withTimeout(
          loadSim(supabase, {
            userId,
            clubId: myClub,
            roomId: null,
            season,
            matchday: slot,
            leagueId,
          }),
          8000
        ).catch(() => ({
          bonus: {} as Record<string, number>,
          squads: undefined,
          style: undefined,
        }));

        const home = Math.random() < 0.5;

        const shine =
          4 + Math.floor(Math.random() * 4);

        homeClub = home ? myClub : target;
        awayClub = home ? target : myClub;

        const mine = sim.style;
        const theirs = mine
          ? aiStyle(target)
          : undefined;

        const edge =
          mine && theirs
            ? matchup(mine, theirs)
            : 0;

        result = simulateFixture({
          leagueKey: `friendly|${userId}`,
          season,
          matchday: 100 + slot + count * 1000,
          homeClub,
          awayClub,

          // in a friendly my players shine
          homeBonus:
            (sim.bonus[homeClub] ?? 0) +
            (homeClub === myClub
              ? shine + edge
              : 0),

          awayBonus:
            (sim.bonus[awayClub] ?? 0) +
            (awayClub === myClub
              ? shine + edge
              : 0),

          ...(mine && theirs
            ? {
                homeStyle:
                  homeClub === myClub
                    ? mine
                    : theirs,
                awayStyle:
                  awayClub === myClub
                    ? mine
                    : theirs,
              }
            : {}),

          squads: sim.squads,
        });

        const { error: insertError } = await supabase
          .from("friendlies")
          .insert({
            user_id: userId,
            season,
            after_matchday: slot,
            home_club: homeClub,
            away_club: awayClub,
            home_score: result.home_score,
            away_score: result.away_score,
            income,
            league_id: leagueId || "premier-league",
            opp_manager:
              friends[target]?.name ?? null,
          });

        if (insertError) throw insertError;

        // a friendly is also a little match practice
        try {
          const own =
            sim.squads?.[myClub] ?? squadOf(myClub);

          const rows = currentLineup(
            userId,
            myClub,
            own
          ).starters.map((p) => ({
            user_id: userId,
            league_id: leagueId,
            season,
            matchday: -(slot * 10 + count + 1),
            player_id: p.id,
            gain: Math.max(
              0.01,
              Math.round(
                sessionGain(p.age) * 0.2 * 100
              ) / 100
            ),
          }));

          if (rows.length) {
            await supabase
              .from("training_sessions")
              .insert(rows);
          }
        } catch {
          /* the friendly still counts without the practice */
        }
      }

      const pal = friends[target];

      if (pal) {
        // the friend is told he was played
        void sendFriendNotice(supabase, {
          to: pal.user_id,
          from: userId,
          fromName: myName,
          season,
          home: homeClub,
          away: awayClub,
          hs: result.home_score,
          as: result.away_score,
        });
      }

      setPlayed({
        home: homeClub,
        away: awayClub,
        result,
        income,
      });
    } catch (err) {
      console.error("Friendly error:", err);

      setError(
        "Could not play the friendly. Make sure supabase/009 and 016_friendlies_scope_notices.sql have been run."
      );
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

  const name = (id: string) =>
    clubs.find((c) => c.id === id)?.name ?? id;

  const outcome = (f: Friendly) => {
    const mine =
      f.home_club === myClub
        ? f.home_score
        : f.away_score;

    const theirs =
      f.home_club === myClub
        ? f.away_score
        : f.home_score;

    return mine > theirs
      ? "win"
      : mine < theirs
        ? "loss"
        : "draw";
  };

  const past = [...history].sort(
    (a, b) => b.after_matchday - a.after_matchday
  );

  const canPlay = slot !== null && !used;

  // the recommended opponent:
  // the club closest to you in strength
  let rec: (typeof list)[number] | undefined;

  try {
    const mine = teamRating(squadOf(myClub));

    rec = list
      .filter((c) => !friends[c.id])
      .sort(
        (x, y) =>
          Math.abs(teamRating(squadOf(x.id)) - mine) -
          Math.abs(teamRating(squadOf(y.id)) - mine)
      )[0];
  } catch {
    /* no recommendation */
  }

  const rest = list.filter(
    (c) => c.id !== rec?.id
  );

  const card = (
    c: (typeof list)[number],
    recommended: boolean
  ) => (
    <article
      key={c.id}
      className={`ff-club ${recommended ? "is-rec" : ""} ${
        friends[c.id] ? "is-pal" : ""
      }`}
    >
      {recommended && (
        <span className="ff-tag">Recommended</span>
      )}

      <img src={c.logo} alt="" />

      <strong>{c.name}</strong>

      <small>
        {friends[c.id]
          ? `Friend: ${friends[c.id].name}`
          : tierLabel(c.id)}
      </small>

      <button
        type="button"
        className="ff-go"
        disabled={busy}
        onClick={() => play(c.id)}
      >
        {busy ? "Warming up..." : "Play Friendly"}
      </button>
    </article>
  );

  return (
    <main className="ff dxp">
      <DxBar
        title="Friendlies"
        onBack={() => router.push("/game/dashboard")}
        season={
          season ? seasonLabel(season) : undefined
        }
      />

      <div className="ff-wrap">
        <h1 className="ff-lead">
          Play friendlies to progress your players and
          test your tactics
        </h1>

        <p className="ff-meta">
          <span>
            {slot === null
              ? "Season over"
              : `Before matchday ${slot + 1}`}
          </span>

          <b>
            {count} / {FRIENDLIES_PER_ROUND} played
          </b>
        </p>

        {error && (
          <p className="ff-error" role="alert">
            {error}
          </p>
        )}

        {slot === null ? (
          <p className="ff-done">
            The season is over. Friendlies come back
            with the new one.
          </p>
        ) : used ? (
          <p className="ff-done">
            All {FRIENDLIES_PER_ROUND} played this
            round. More open after matchday {slot + 1}.
          </p>
        ) : canPlay ? (
          <div className="ff-grid">
            {rec && card(rec, true)}

            {rest.map((c) => card(c, false))}
          </div>
        ) : null}

        <p className="ff-note">
          There is no money in friendlies and your
          table is not affected. You play with your
          saved lineup and tactics, and the starters
          get a little match practice. The club of
          your next league match is not on the list.
        </p>

        <section
          className="ff-past"
          aria-label="Past friendly matches"
        >
          <h2>Past friendlies</h2>

          {past.length === 0 ? (
            <p className="ff-none">
              No friendlies yet. Pick a club and play
              the first one.
            </p>
          ) : (
            <ul>
              {past.map((f) => {
                const h = clubs.find(
                  (c) => c.id === f.home_club
                );

                const a = clubs.find(
                  (c) => c.id === f.away_club
                );

                const o = outcome(f);

                return (
                  <li
                    key={`${f.after_matchday}-${f.home_club}-${f.away_club}`}
                  >
                    <span className="ff-h">
                      {h && (
                        <img src={h.logo} alt="" />
                      )}
                      {name(f.home_club)}
                    </span>

                    <b className="ff-sc">
                      {f.home_score} - {f.away_score}
                    </b>

                    <span className="ff-a">
                      {a && (
                        <img src={a.logo} alt="" />
                      )}

                      {name(f.away_club)}

                      {f.opp_manager ? (
                        <em>
                          {" "}
                          · vs {f.opp_manager}
                        </em>
                      ) : null}
                    </span>

                    <i className={`ff-res is-${o}`}>
                      {o === "win"
                        ? "Win"
                        : o === "loss"
                          ? "Loss"
                          : "Draw"}
                    </i>
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
