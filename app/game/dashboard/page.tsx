
"use client";

import { baseLeague } from "@/lib/football/leagueIds";
import { egyptClubs } from "@/lib/football/egypt";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { GAME_NAV } from "@/lib/gameNav";
import { supabase } from "@/lib/supabase";
import GsmMark from "@/components/GsmMark";
import CompBackdrop from "@/components/CompBackdrop";
import TrophyCelebration from "@/components/TrophyCelebration";
import GameHud from "@/components/GameHud";
import type { CSSProperties } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { buildFinance, formatMoney, tierProfiles } from "@/lib/football/finance";
import { formatKickoff } from "@/lib/football/schedule";
import { evaluateBoard } from "@/lib/football/board";
import { calculateStandings } from "@/lib/football/table";
import { teamRating, type Player } from "@/lib/football/squads";
import { loadTransferState } from "@/lib/football/transfers";
import { currentMatchday } from "@/lib/football/useTransfers";
import { InviteModal } from "@/components/RoomModals";
import { pendingCode } from "@/lib/football/rooms";
import PressConference from "@/components/PressConference";
import type { Quote } from "@/lib/football/press";
import { syncCareers } from "@/lib/football/careers";
import { isCafCup } from "@/lib/football/africa";
import { qualifyFromLeague } from "@/lib/football/continental";
import { qualifyFromEngland, isEuroComp } from "@/lib/football/europe";

type TrophyCounts = { league: number; league_cup: number; objective: number };
import { summarizeSeason, recordSeasonTrophies, type SeasonSummary } from "@/lib/football/achievements";
import { activeSeason, seasonLabel } from "@/lib/football/season";
import "./dashboard.css";

type Manager = {
  manager_name: string;
  avatar: string | null;
  experience: string;
  selected_club: string | null;
  selected_league: string | null;
};

type Club = {
  id: string;
  name: string;
  city: string;
  stadium: string;
  logo: string;
};

const premierClubs: Record<string, Club> = {
  arsenal: { id: "arsenal", name: "Arsenal", city: "London", stadium: "Emirates Stadium", logo: "/club-logos/arsenal.png" },
  "aston-villa": { id: "aston-villa", name: "Aston Villa", city: "Birmingham", stadium: "Villa Park", logo: "/club-logos/aston-villa.png" },
  bournemouth: { id: "bournemouth", name: "Bournemouth", city: "Bournemouth", stadium: "Vitality Stadium", logo: "/club-logos/bournemouth.png" },
  brentford: { id: "brentford", name: "Brentford", city: "London", stadium: "Gtech Community Stadium", logo: "/club-logos/brentford.png" },
  brighton: { id: "brighton", name: "Brighton", city: "Brighton", stadium: "Amex Stadium", logo: "/club-logos/brighton.png" },
  chelsea: { id: "chelsea", name: "Chelsea", city: "London", stadium: "Stamford Bridge", logo: "/club-logos/chelsea.png" },
  coventry: { id: "coventry", name: "Coventry City", city: "Coventry", stadium: "Coventry Building Society Arena", logo: "/club-logos/coventry.png" },
  "crystal-palace": { id: "crystal-palace", name: "Crystal Palace", city: "London", stadium: "Selhurst Park", logo: "/club-logos/crystal-palace.png" },
  everton: { id: "everton", name: "Everton", city: "Liverpool", stadium: "Hill Dickinson Stadium", logo: "/club-logos/everton.png" },
  fulham: { id: "fulham", name: "Fulham", city: "London", stadium: "Craven Cottage", logo: "/club-logos/fulham.png" },
  "hull-city": { id: "hull-city", name: "Hull City", city: "Hull", stadium: "MKM Stadium", logo: "/club-logos/hull-city.png" },
  ipswich: { id: "ipswich", name: "Ipswich Town", city: "Ipswich", stadium: "Portman Road", logo: "/club-logos/ipswich.png" },
  leeds: { id: "leeds", name: "Leeds United", city: "Leeds", stadium: "Elland Road", logo: "/club-logos/leeds.png" },
  liverpool: { id: "liverpool", name: "Liverpool", city: "Liverpool", stadium: "Anfield", logo: "/club-logos/liverpool.png" },
  "man-city": { id: "man-city", name: "Manchester City", city: "Manchester", stadium: "Etihad Stadium", logo: "/club-logos/man-city.png" },
  "man-united": { id: "man-united", name: "Manchester United", city: "Manchester", stadium: "Old Trafford", logo: "/club-logos/man-united.png" },
  newcastle: { id: "newcastle", name: "Newcastle United", city: "Newcastle", stadium: "St James' Park", logo: "/club-logos/newcastle.png" },
  "nottingham-forest": { id: "nottingham-forest", name: "Nottingham Forest", city: "Nottingham", stadium: "City Ground", logo: "/club-logos/nottingham-forest.png" },
  sunderland: { id: "sunderland", name: "Sunderland", city: "Sunderland", stadium: "Stadium of Light", logo: "/club-logos/sunderland.png" },
  tottenham: { id: "tottenham", name: "Tottenham Hotspur", city: "London", stadium: "Tottenham Hotspur Stadium", logo: "/club-logos/tottenham.png" },
};

const clubs: Record<string, Club> = { ...premierClubs, ...Object.fromEntries(egyptClubs.map((c) => [c.id, c])) };

const leagueNames: Record<string, string> = {
  "premier-league": "Premier League",
  "egyptian-premier-league": "Egyptian Premier League",
  "la-liga": "La Liga",
  "serie-a": "Serie A",
  bundesliga: "Bundesliga",
};

const navigation = GAME_NAV.map((n) => ({ ...n, active: false }));


type Row = { clubId: string; name: string; logo: string; played: number; gd: number; points: number };

const ordinal = (n: number) => {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10 > 3 ? 0 : n % 10]}`;
};

/** counts up to a number once, unless the person prefers less motion */
function useCountUp(target: number | null, ms = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setValue(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<Manager | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [mySquad, setMySquad] = useState<Player[]>([]);
  const [roomOpen, setRoomOpen] = useState(false);
  const [pressOpen, setPressOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hasCont, setHasCont] = useState(false);
  const [hasEuro, setHasEuro] = useState(false);
  /** the shared game menu sends "?open=press" or "?open=room" to the hub */
  const [wanted, setWanted] = useState<string | null>(null);
  useEffect(() => {
    try {
      const w = new URLSearchParams(window.location.search).get("open");
      if (w === "press" || w === "room") setWanted(w);
    } catch { /* no panel */ }
  }, []);
  useEffect(() => {
    if (!wanted || !club || !manager) return;
    if (wanted === "room") setRoomOpen(true);
    else if (nextMatch) setPressOpen(true);
    else return;
    setWanted(null);
    try { window.history.replaceState(null, "", "/game/dashboard"); } catch { /* fine */ }
  }, [wanted, club, manager, nextMatch]);
  const [table, setTable] = useState<Row[]>([]);
  const [form, setForm] = useState<("W" | "D" | "L")[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [season, setSeason] = useState("");
  const [seasonDone, setSeasonDone] = useState(false);
  const [userId, setUserId] = useState("");
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [, setCounts] = useState<TrophyCounts>({ league: 0, league_cup: 0, objective: 0 });
  const [nextMatch, setNextMatch] = useState<{ matchday: number; opponent: string; home: boolean; kickoff: string | null } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const { data: authData, error: authError } =
          await supabase.auth.getUser();

        if (authError || !authData.user) {
          router.replace("/");
          return;
        }

        const { data, error } = await supabase
          .from("manager_contracts")
          .select(
            "manager_name, avatar, experience, selected_club, selected_league, signed_at, room_id"
          )
          .eq("user_id", authData.user.id)
          .maybeSingle();

        if (error) throw error;

        if (!data?.signed_at) {
          router.replace("/game/contract");
          return;
        }

        // an invite link was opened before logging in: finish joining that league first
        if (pendingCode()) {
          router.replace("/game/leagues");
          return;
        }

        if (!data.selected_club) {
          router.replace("/game/leagues");
          return;
        }

        // a stand-alone CAF cup career lives on its own page
        if (isCafCup(data.selected_league)) {
          router.replace("/game/continental");
          return;
        }

        // a stand-alone European cup career lives on its own page
        if (isEuroComp(data.selected_league)) {
          router.replace("/game/europe");
          return;
        }

        const selectedClub = clubs[data.selected_club];

        if (!selectedClub) {
          router.replace("/game/team-selection");
          return;
        }

        // club balance comes from the club tier and the matches it has played
        let clubBalance: number | null = null;
        let currentSeason = "";
        let seasonSummary: SeasonSummary | null = null;
        const trophyCounts: TrophyCounts = { league: 0, league_cup: 0, objective: 0 };
        let tableRows: Row[] = [];
        let formRows: ("W" | "D" | "L")[] = [];
        let nextFixture: { matchday: number; opponent: string; home: boolean; kickoff: string | null } | null = null;
        try {
          const season = await activeSeason(supabase, authData.user.id, data.selected_league || "premier-league");
          currentSeason = season;
          const { data: matchData } = await supabase
            .from("league_matches")
            .select("home_club, away_club, home_score, away_score, status, matchday, kickoff_at, played_at")
            .eq("user_id", authData.user.id)
            .eq("league_id", data.selected_league || "premier-league")
            .eq("season", season);

          // the board has the last word: a sacked manager goes to the offers
          if (evaluateBoard((matchData ?? []) as never[], data.selected_club, (data as { club_appointed_at?: string | null }).club_appointed_at).sacked) {
            router.replace("/game/sacked");
            return;
          }

          const ts = await loadTransferState(supabase, authData.user.id, data.selected_club, season, currentMatchday(matchData ?? []), data.selected_league, true);
          clubBalance = buildFinance(data.selected_club, matchData ?? [], ts.net * 1_000_000).balance;
          setMySquad(ts.squads[data.selected_club] ?? []);

          tableRows = calculateStandings((matchData ?? []) as never[], undefined, { [data.selected_club]: ts.bank.deduction }) as Row[];
          formRows = (matchData ?? [])
            .filter((m) => m.status === "completed" && m.home_score !== null && m.away_score !== null && (m.home_club === data.selected_club || m.away_club === data.selected_club))
            .sort((a, b) => b.matchday - a.matchday)
            .slice(0, 5)
            .map((m) => {
              const home = m.home_club === data.selected_club;
              const f = home ? m.home_score : m.away_score;
              const a = home ? m.away_score : m.home_score;
              return f > a ? "W" : f < a ? "L" : "D";
            }) as ("W" | "D" | "L")[];

          seasonSummary = summarizeSeason(data.selected_club, (matchData ?? []) as never[]);

          // trophies saved from earlier seasons and cups
          const { data: won } = await supabase
            .from("trophies")
            .select("kind, season, league_id")
            .eq("user_id", authData.user.id);
          const saved = new Set((won ?? []).map((t: { kind: string; season: string; league_id?: string | null }) => `${t.kind}|${t.season}|${t.league_id ?? "premier-league"}`));
          for (const t of won ?? []) {
            const k = (t as { kind: keyof TrophyCounts }).kind;
            if (k in trophyCounts) trophyCounts[k] += 1;
          }
          // this season's league title and objective count as soon as the season ends
          // a finished season is saved for good, so a new season never erases it
          if (seasonSummary.complete) {
            await recordSeasonTrophies(supabase, authData.user.id, data.selected_club, data.selected_league || "premier-league", season, seasonSummary);
          }
          if (seasonSummary.leagueTitle && !saved.has(`league|${season}|${data.selected_league || "premier-league"}`)) trophyCounts.league += 1;
          if (seasonSummary.objectiveMet && !saved.has(`objective|${season}|${data.selected_league || "premier-league"}`)) trophyCounts.objective += 1;

          const upcoming = (matchData ?? [])
            .filter(
              (m) =>
                m.status === "scheduled" &&
                (m.home_club === data.selected_club || m.away_club === data.selected_club)
            )
            .sort((a, b) => a.matchday - b.matchday)[0];

          if (upcoming) {
            const home = upcoming.home_club === data.selected_club;
            nextFixture = {
              matchday: upcoming.matchday,
              opponent: home ? upcoming.away_club : upcoming.home_club,
              home,
              kickoff: upcoming.kickoff_at,
            };
          }
        } catch {
          clubBalance = null;
        }

        void syncCareers(supabase, authData.user.id, data as never);

        // finishing 1st-4th in Egypt opens a CAF competition in the next season
        let qualified = false;
        if (data.selected_league === "egyptian-premier-league") {
          try {
            const list = await qualifyFromLeague(supabase, authData.user.id, data.selected_club);
            qualified = list.some((x) => x.club_id === data.selected_club);
          } catch {
            /* run supabase/014_continental.sql */
          }
        }
        // finishing 1st-6th in England opens the Champions League or the Europa League in the next season
        let euro = false;
        if (baseLeague(data.selected_league) === "premier-league") {
          try {
            const list = await qualifyFromEngland(supabase, authData.user.id, data.selected_club, data.selected_league);
            euro = list.length > 0;
          } catch {
            /* run supabase/026_europe.sql */
          }
        }
        if (!cancelled) {
          setHasCont(qualified);
          setHasEuro(euro);
          setRoomId((data as { room_id?: string | null }).room_id ?? null);
          setManager(data as Manager);
          setClub(selectedClub);
          setBalance(clubBalance);
          setNextMatch(nextFixture);
          setTable(tableRows);
          setForm(formRows);
          setUserId(authData.user.id);
          setSummary(seasonSummary);
          setSeason(currentSeason);
          setSeasonDone(!!seasonSummary?.complete);
          setCounts(trophyCounts);
        }
      } catch (error) {
        console.error("Dashboard loading error:", error);

        if (!cancelled) {
          alert("Could not load your club dashboard.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("Could not sign out. Please try again.");
      return;
    }

    router.replace("/");
  }

  const shownBalance = useCountUp(balance);
  const shownSquad = useCountUp(mySquad.length, 800);
  const shownRating = useCountUp(mySquad.length ? teamRating(mySquad) : null, 900);

  if (loading) {
    return (
      <main className="gsm-dashboard-loading">
        <div className="loading-emblem"><GsmMark size={64} /></div>
        <span>Preparing your club...</span>
      </main>
    );
  }

  if (!manager || !club) return null;

  const leagueName =
    leagueNames[baseLeague(manager.selected_league) || ""] || "Competition";

  const myIndex = table.findIndex((row) => row.clubId === club.id);
  const myRow = myIndex >= 0 ? table[myIndex] : null;
  const windowStart = Math.max(0, Math.min(myIndex - 2, table.length - 5));
  const snapshot = myIndex >= 0 ? table.slice(windowStart, windowStart + 5) : [];

  return (
    <main className="hub gx-grain">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="hub-bg gx-kb" aria-hidden="true" />
      <CompBackdrop comp={manager.selected_league} />
      <TrophyCelebration />
      <div className="hub-beams" aria-hidden="true"><i /><i /><i /></div>
      <div className="hub-pitch" aria-hidden="true">
        <svg viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice">
          <g fill="none" stroke="currentColor" strokeWidth="3">
            <rect x="40" y="40" width="1120" height="680" rx="6" />
            <path d="M600 40v680" />
            <circle cx="600" cy="380" r="118" />
            <rect x="40" y="190" width="190" height="380" />
            <rect x="970" y="190" width="190" height="380" />
          </g>
        </svg>
      </div>
      <div className="hub-shade" aria-hidden="true" />

      <GameHud
        menu={
          <button type="button" className="hub-burger" onClick={() => setMenuOpen(true)} aria-label="Open game menu" aria-expanded={menuOpen} aria-controls="hub-drawer">
            <Icon name="menu" size={22} />
          </button>
        }
        right={
          <>
            <span className="gx-season">
              Season <b>{season ? seasonLabel(season) : ""}</b>
            </span>
            <button
              type="button"
              className="hub-manager"
              onClick={() => router.push("/game/management")}
              aria-label="Open your manager page"
            >
              {manager.avatar ? (
                <img src={manager.avatar} alt="" />
              ) : (
                <span className="hub-avatar">GSM</span>
              )}
              <div>
                <strong>{manager.manager_name}</strong>
                <small>Profile</small>
              </div>
            </button>
            <button type="button" className="hub-out" onClick={handleLogout} aria-label="Sign out">
              <Icon name="logout" size={20} />
            </button>
          </>
        }
      />

      <div className="hub-body">
        <div className="hq-top">
          <div className="hq-id">
            <img src={club.logo} alt="" />
            <div>
              <h1>{club.name}</h1>
              <p>{club.stadium}, {club.city} · {leagueName}</p>
            </div>
          </div>
          <button type="button" className="hq-continue" onClick={() => router.push("/game/fixtures")}>
            <span>
              <small>{nextMatch ? `Matchday ${nextMatch.matchday}` : seasonDone ? "Season finished" : "Calendar"}</small>
              <strong>{nextMatch?.kickoff ? formatKickoff(nextMatch.kickoff) : nextMatch ? "Time to be set" : "Open fixtures"}</strong>
            </span>
            <b>Continue</b>
            <Icon name="chevron-right" size={26} />
          </button>
        </div>

        <div className="hq-grid">
          {/* inbox */}
          <section className="hq-tile hq-inbox" style={{ "--i": 0 } as CSSProperties} aria-label="Inbox">
            <h2><Icon name="news" size={20} /> Inbox</h2>
            <ul>
              <li><button type="button" onClick={() => router.push("/game/fixtures")}><Icon name="calendar" size={18} /><span>{nextMatch ? `Next match: ${clubs[nextMatch.opponent]?.name ?? "opponent"}` : "Fixture list"}</span></button></li>
              <li><button type="button" disabled={!nextMatch} onClick={() => setPressOpen(true)}><Icon name="news" size={18} /><span>Press conference</span></button></li>
              <li><button type="button" onClick={() => router.push("/game/standings")}><Icon name="table" size={18} /><span>{myRow ? `You are ${ordinal(myIndex + 1)} in the table` : "League table"}</span></button></li>
              <li><button type="button" onClick={() => router.push("/game/board")}><Icon name="flag" size={18} /><span>Board objectives</span></button></li>
              <li><button type="button" onClick={() => router.push("/game/social")}><Icon name="chat" size={18} /><span>Feed and stories</span></button></li>
              <li><button type="button" onClick={() => setRoomOpen(true)}><Icon name="user" size={18} /><span>Friends league</span></button></li>
            </ul>
          </section>

          {/* team */}
          <button type="button" className="hq-tile hq-team" style={{ "--i": 1 } as CSSProperties} onClick={() => router.push("/game/squad")} aria-label="Open your lineups">
            <h2><Icon name="squad" size={20} /> Team</h2>
            <span className="hq-team-body">
              <img src={club.logo} alt={`${club.name} crest`} />
              <span className="hq-ring" style={{ "--p": mySquad.length ? Math.round(shownRating) : 0 } as CSSProperties}>
                <b>{mySquad.length ? Math.round(shownRating) : "—"}</b>
                <small>Rating</small>
              </span>
            </span>
            <small className="hq-foot">{Math.round(shownSquad)} players · Lineups and tactics</small>
          </button>

          {/* schedule */}
          <button type="button" className="hq-tile hq-sched" style={{ "--i": 2 } as CSSProperties} onClick={() => router.push("/game/fixtures")} aria-label="Open the fixtures">
            <h2><Icon name="calendar" size={20} /> Schedule</h2>
            {nextMatch ? (
              <span className="hq-sched-body">
                <span className="hq-vs">
                  <img src={(nextMatch.home ? club : clubs[nextMatch.opponent])?.logo} alt="" />
                  <i>vs</i>
                  <img src={(nextMatch.home ? clubs[nextMatch.opponent] : club)?.logo} alt="" />
                </span>
                <strong>{clubs[nextMatch.opponent]?.name}</strong>
                <small>Matchday {nextMatch.matchday} · {nextMatch.home ? "Home" : "Away"}</small>
                <small>{nextMatch.kickoff ? `${formatKickoff(nextMatch.kickoff)} · Cairo time` : "Time to be set"}</small>
              </span>
            ) : (
              <span className="hq-sched-body"><strong>{seasonDone ? "Season finished" : "No match scheduled"}</strong><small>Open the fixtures</small></span>
            )}
          </button>

          {/* competitions */}
          <button type="button" className="hq-tile hq-comp" style={{ "--i": 3 } as CSSProperties} onClick={() => router.push("/game/standings")} aria-label="Open the league table">
            <h2><Icon name="table" size={20} /> Competitions</h2>
            <span className="hq-league">{leagueName}</span>
            {snapshot.length > 0 ? (
              <ul className="hq-mini">
                {snapshot.slice(0, 5).map((row, i) => (
                  <li key={row.clubId} className={row.clubId === club.id ? "is-me" : undefined}>
                    <b>{windowStart + i + 1}</b><img src={row.logo} alt="" /><span>{row.name}</span><em>{row.played}</em><strong>{row.points}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="hq-empty">The table appears once your calendar is ready.</span>
            )}
          </button>

          {/* facilities / finances */}
          <button type="button" className="hq-tile hq-fin" style={{ "--i": 4 } as CSSProperties} onClick={() => router.push("/game/finances")} aria-label="Open the finances">
            <h2><Icon name="wallet" size={20} /> Finances</h2>
            <strong>{balance !== null ? formatMoney(shownBalance) : "—"}</strong>
            <small>{balance !== null ? `${tierProfiles[buildFinance(club.id, []).tier].label} · Club balance` : "Unavailable"}</small>
          </button>

          {/* manager */}
          <button type="button" className="hq-tile hq-mgr" style={{ "--i": 5 } as CSSProperties} onClick={() => router.push("/game/management")} aria-label="Open your manager page">
            <h2><Icon name="user" size={20} /> Manager</h2>
            <span className="hq-mgr-body">
              {manager.avatar ? <img src={manager.avatar} alt="" /> : <span className="hub-avatar">GSM</span>}
              <span><strong>{manager.manager_name}</strong><small>Season {season ? seasonLabel(season) : ""}</small></span>
            </span>
          </button>

          {/* transfers */}
          <button type="button" className="hq-tile hq-trf" style={{ "--i": 6 } as CSSProperties} onClick={() => router.push("/game/transfers")} aria-label="Open the transfers">
            <h2><Icon name="transfer" size={20} /> Transfers</h2>
            <strong>Buy and sell</strong>
            <small>Window open all season · World market</small>
          </button>

          {/* season panel */}
          <aside className="hq-tile hq-season" style={{ "--i": 7 } as CSSProperties} aria-label="Your season">
            <h2><Icon name="star" size={20} /> Season</h2>
            <div className="hq-pos">
              <strong>{myRow ? ordinal(myIndex + 1) : "—"}</strong>
              <small>{myRow ? `${myRow.points} pts from ${myRow.played} played` : "Table unavailable"}</small>
            </div>
            <div className="hq-bar" role="img" aria-label={`${myRow?.played ?? 0} of 38 matches played`}><i style={{ width: `${Math.min(100, ((myRow?.played ?? 0) / 38) * 100)}%` }} /></div>
            {form.length > 0 && (
              <ul className="hub-form" aria-label={`Last ${form.length} results, newest first`}>
                {form.map((r, i) => <li key={i} className={`is-${r}`}>{r}</li>)}
              </ul>
            )}
            <div className="hq-links">
              <button type="button" onClick={() => router.push("/game/cup")}><Icon name="star" size={18} /> League Cup</button>
              {hasCont && <button type="button" onClick={() => router.push("/game/continental")}><Icon name="star" size={18} /> CAF Cup</button>}
              {hasEuro && <button type="button" onClick={() => router.push("/game/europe")}><Icon name="star" size={18} /> Europe</button>}
              <button type="button" onClick={() => router.push("/game/friendlies")}><Icon name="ball" size={18} /> Friendlies</button>
              <button type="button" onClick={() => router.push("/game/training")}><Icon name="training" size={18} /> Training</button>
            </div>
          </aside>
        </div>

        <nav className="hq-bar-nav" aria-label="Shortcuts">
          <button type="button" onClick={() => router.push("/game/squad")}><Icon name="squad" size={20} /> Lineups</button>
          <button type="button" onClick={() => router.push("/game/transfers")}><Icon name="transfer" size={20} /> Transfers</button>
          <button type="button" onClick={() => router.push("/game/contracts")}><Icon name="contract" size={20} /> Contracts</button>
          <button type="button" onClick={() => router.push("/game/bank")}><Icon name="wallet" size={20} /> Bank</button>
          <button type="button" onClick={() => setMenuOpen(true)}><Icon name="menu" size={20} /> All menu</button>
        </nav>
      </div>
    {menuOpen && (
        <div className="hub-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}
      <aside id="hub-drawer" className={`hub-drawer ${menuOpen ? "is-open" : ""}`} aria-label="Game menu" aria-hidden={!menuOpen} inert={!menuOpen}>
        <header>
          <h2>Game menu</h2>
          <button type="button" ref={closeRef} onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon name="close" size={22} /></button>
        </header>
        <nav>
          {navigation.map((item) => {
            const open = Boolean(item.href || (item.action === "press" ? nextMatch : item.action));
            return (
              <button
                key={item.label}
                type="button"
                className={open ? "is-open" : "is-soon"}
                disabled={!open}
                onClick={() => {
                  setMenuOpen(false);
                  if (item.action === "room") setRoomOpen(true);
                  else if (item.action === "press") setPressOpen(true);
                  else if (item.href) router.push(item.href);
                }}
              >
                <Icon name={item.icon} size={22} />
                <span><strong>{item.label}</strong><small>{open ? item.note : item.action === "press" ? "No match to prepare for" : "Coming soon"}</small></span>
                <Icon name="chevron-right" size={18} />
              </button>
            );
          })}
        </nav>
      </aside>
    {pressOpen && club && manager && nextMatch && (
        <PressConference
          myClub={club.id}
          oppClub={nextMatch.opponent}
          cup={false}
          home={nextMatch.home}
          seed={`${userId}|${season}|league|${nextMatch.matchday}`}
          label={`Matchday ${nextMatch.matchday}`}
          onDone={async (quotes: Quote[]) => {
            setPressOpen(false);
            if (!quotes.length) return;
            try {
              await supabase.from("press_quotes").upsert(
                {
                  user_id: userId,
                  room_id: roomId,
                  manager_name: (manager as { manager_name?: string }).manager_name ?? null,
                  club_id: club.id,
                  opponent_id: nextMatch.opponent,
                  season,
                  kind: "league",
                  matchday: nextMatch.matchday,
                  quotes,
                },
                { onConflict: "user_id,season,kind,matchday" }
              );
            } catch {
              /* ignore */
            }
          }}
        />
      )}
    {roomOpen && club && manager && (
        <InviteModal
          userId={userId}
          roomId={roomId}
          leagueId={manager.selected_league ?? ""}
          season={season}
          clubId={club.id}
          onClose={() => setRoomOpen(false)}
          onCreated={setRoomId}
        />
      )}
    </main>
  );
}
