
"use client";

import { baseLeague } from "@/lib/football/leagueIds";
import { egyptClubs } from "@/lib/football/egypt";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { GAME_NAV } from "@/lib/gameNav";
import { supabase } from "@/lib/supabase";
import GsmMark from "@/components/GsmMark";
import TrophyCelebration from "@/components/TrophyCelebration";
import { nowMs } from "@/lib/serverTime";
import Icon from "@/components/Icon";
import { buildFinance, formatMoney } from "@/lib/football/finance";
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


/** "1d 11h 40m 52s" until the kick-off, or null once it has come (server clock) */
function countdown(iso: string | null, _tick: number): string | null {
  if (!iso) return null;
  const left = new Date(iso).getTime() - nowMs();
  if (left <= 0) return null;
  const sec = Math.floor(left / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const x = sec % 60;
  return d > 0 ? `${d}d ${h}h ${m}m ${x}s` : h > 0 ? `${h}h ${m}m ${x}s` : `${m}m ${x}s`;
}

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

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const shownBalance = useCountUp(balance);
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

  const timeLeft = countdown(nextMatch?.kickoff ?? null, tick);
  const opp = nextMatch ? clubs[nextMatch.opponent] : undefined;
  const homeClub = nextMatch ? (nextMatch.home ? club : opp) : club;
  const awayClub = nextMatch ? (nextMatch.home ? opp : club) : undefined;
  const strength = mySquad.length ? Math.round(shownRating) : 0;

  return (
    <main className="dx">
      <div className="dx-stage" aria-hidden="true">
        <i className="dx-lamp dx-lamp-a" />
        <i className="dx-lamp dx-lamp-b" />
        <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
          <g fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="60" y="80" width="1080" height="470" rx="6" />
            <path d="M600 80v470" />
            <circle cx="600" cy="315" r="92" />
            <rect x="60" y="200" width="150" height="230" />
            <rect x="990" y="200" width="150" height="230" />
          </g>
        </svg>
      </div>
      <TrophyCelebration />

      <header className="dx-top">
        <button type="button" className="dx-me" onClick={() => router.push("/game/management")} aria-label="Open your manager page">
          {manager.avatar ? <img src={manager.avatar} alt="" /> : <span className="dx-me-init">{manager.manager_name.slice(0, 1).toUpperCase()}</span>}
          <b>{myRow ? myIndex + 1 : "–"}</b>
        </button>
        <button type="button" className="dx-pill dx-money" onClick={() => router.push("/game/finances")} aria-label="Open the finances">
          <Icon name="wallet" size={18} />
          <span>{balance !== null ? formatMoney(shownBalance) : "—"}</span>
        </button>
        <span className="dx-pill dx-season">{season ? seasonLabel(season) : ""}</span>
        <span className="dx-grow" />
        <button type="button" className="dx-ico" onClick={() => router.push("/game/standings")} aria-label="League table"><Icon name="table" size={22} /></button>
        <button type="button" className="dx-ico" disabled={!nextMatch} onClick={() => setPressOpen(true)} aria-label="Press conference">
          <Icon name="news" size={22} />
          {nextMatch && <em aria-hidden="true" />}
        </button>
        <button type="button" className="dx-ico" onClick={() => setRoomOpen(true)} aria-label="Friends league"><Icon name="user" size={22} /></button>
        <button type="button" className="dx-ico" onClick={handleLogout} aria-label="Sign out"><Icon name="logout" size={22} /></button>
        <button type="button" className="dx-ico dx-burger" onClick={() => setMenuOpen(true)} aria-label="Open game menu" aria-expanded={menuOpen} aria-controls="dx-drawer">
          <Icon name="menu" size={24} />
        </button>
      </header>

      <div className="dx-body">
        <section className="dx-hero" aria-label="Next match">
          <div className="dx-team">
            <img src={homeClub?.logo} alt="" />
            <strong>{homeClub?.name ?? club.name}</strong>
            {homeClub?.id === club.id && <small>{manager.manager_name}</small>}
          </div>

          <div className="dx-mid">
            <span className="dx-chip">{nextMatch ? `Matchday ${nextMatch.matchday}` : seasonDone ? "Season finished" : "No match yet"}</span>
            <span className="dx-clock" aria-live="off">
              {nextMatch ? (nextMatch.kickoff ? (timeLeft ?? "Kick-off time!") : "Time to be set") : leagueName}
            </span>
            <span className="dx-vs">VS</span>
            {nextMatch && <small className="dx-where">{nextMatch.home ? "Home" : "Away"} · {nextMatch.kickoff ? `${formatKickoff(nextMatch.kickoff)} · Cairo` : leagueName}</small>}
            {form.length > 0 && (
              <ul className="dx-form" aria-label={`Last ${form.length} results, newest first`}>
                {form.map((r, i) => <li key={i} className={`is-${r}`}>{r}</li>)}
              </ul>
            )}
          </div>

          <div className="dx-team">
            {awayClub ? <img src={awayClub.logo} alt="" /> : <span className="dx-blank" />}
            <strong>{awayClub?.name ?? "—"}</strong>
          </div>
        </section>

        <section className="dx-actions" aria-label="Actions">
          <button type="button" className="dx-card dx-play" onClick={() => router.push("/game/fixtures")}>
            <span className="dx-card-h">Play match</span>
            <span className="dx-card-b">{nextMatch ? (timeLeft ? "Opens at kick-off" : "Ready to play") : seasonDone ? "Season complete" : "Open fixtures"}</span>
            <Icon name="chevron-right" size={26} />
          </button>
          <button type="button" className="dx-card" onClick={() => router.push("/game/squad")}>
            <Icon name="squad" size={26} />
            <span className="dx-card-h">Match preparation</span>
            <span className="dx-meter" role="img" aria-label={`Squad rating ${strength}`}><i style={{ width: `${Math.min(100, strength)}%` }} /></span>
            <span className="dx-card-b">Rating {strength || "—"} · lineup and tactics</span>
          </button>
          <button type="button" className="dx-card" onClick={() => router.push("/game/training")}>
            <Icon name="training" size={26} />
            <span className="dx-card-h">Training</span>
            <span className="dx-card-b">Develop your players</span>
          </button>
          <button type="button" className="dx-card" onClick={() => router.push("/game/transfers")}>
            <Icon name="transfer" size={26} />
            <span className="dx-card-h">Transfers</span>
            <span className="dx-card-b">Buy and sell</span>
          </button>
        </section>

        <section className="dx-lower">
          <div className="dx-left">
            <button type="button" className="dx-banner" onClick={() => router.push("/game/friendlies")}>
              <Icon name="ball" size={28} />
              <span><strong>Friendlies</strong><small>Play warm-up matches against clubs in your league</small></span>
            </button>
            <div className="dx-tiles">
              <button type="button" onClick={() => router.push("/game/cup")}><Icon name="star" size={26} /><strong>League Cup</strong><small>Knockout run</small></button>
              {hasCont && <button type="button" onClick={() => router.push("/game/continental")}><Icon name="star" size={26} /><strong>CAF Cup</strong><small>Africa&apos;s stage</small></button>}
              {hasEuro && <button type="button" onClick={() => router.push("/game/europe")}><Icon name="star" size={26} /><strong>Europe</strong><small>Continental nights</small></button>}
              <button type="button" onClick={() => router.push("/game/board")}><Icon name="flag" size={26} /><strong>Board</strong><small>Objectives and trust</small></button>
              <button type="button" onClick={() => router.push("/game/contracts")}><Icon name="contract" size={26} /><strong>Contracts</strong><small>Renew and release</small></button>
            </div>
          </div>

          <button type="button" className="dx-table" onClick={() => router.push("/game/standings")} aria-label="Open the league table">
            <span className="dx-table-h">{leagueName}</span>
            {snapshot.length > 0 ? (
              <ul>
                {snapshot.map((row, i) => (
                  <li key={row.clubId} className={row.clubId === club.id ? "is-me" : undefined}>
                    <b>{windowStart + i + 1}</b><img src={row.logo} alt="" /><span>{row.name}</span><strong>{row.points}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="dx-table-empty">The table appears once your calendar is ready.</span>
            )}
          </button>
        </section>
      </div>

      {menuOpen && <div className="dx-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <aside id="dx-drawer" className={`dx-drawer ${menuOpen ? "is-open" : ""}`} aria-label="Game menu" aria-hidden={!menuOpen} inert={!menuOpen}>
        <header>
          <h2>Menu</h2>
          <button type="button" ref={closeRef} onClick={() => setMenuOpen(false)} aria-label="Close menu"><Icon name="close" size={22} /></button>
        </header>
        <nav>
          {navigation.map((item) => {
            const open = Boolean(item.href || (item.action === "press" ? nextMatch : item.action));
            return (
              <button
                key={item.label}
                type="button"
                disabled={!open}
                onClick={() => {
                  setMenuOpen(false);
                  if (item.action === "room") setRoomOpen(true);
                  else if (item.action === "press") setPressOpen(true);
                  else if (item.href) router.push(item.href);
                }}
              >
                <Icon name={item.icon} size={26} />
                <span>{item.label}</span>
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
