"use client";

import { supabase } from "@/lib/supabase";
import { baseLeague } from "@/lib/football/leagueIds";
import { loadCareers } from "@/lib/football/careers";
import { egyptClubs, egyptColors } from "@/lib/football/egypt";
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isCup, leagueOf } from "@/lib/football/leaguesCatalog";
import { CAF_CUPS, africanClubs, africaColors } from "@/lib/football/africa";
import { UCL_CLUBS, UEL_CLUBS, europeColors } from "@/lib/football/europeClubs";
import { defaultEnglish, euroComp } from "@/lib/football/europe";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import "./clubs.css";

type Club = {
  id: string;
  name: string;
  city: string;
  stadium: string;
  logo: string;
};

// primary colour of each club: the whole screen takes it on when selected
const premierColors: Record<string, string> = {
  arsenal: "#e0262f",
  "aston-villa": "#8a2a5b",
  bournemouth: "#d3181e",
  brentford: "#e30613",
  brighton: "#1f7ae0",
  chelsea: "#1b5fc4",
  coventry: "#4fb3e6",
  "crystal-palace": "#2a5cc0",
  everton: "#2d56c9",
  fulham: "#c9c9c9",
  "hull-city": "#f5a12d",
  ipswich: "#2f6fd6",
  leeds: "#f0c419",
  liverpool: "#d3142f",
  "man-city": "#6cabdd",
  "man-united": "#e0301f",
  newcastle: "#b8b8b8",
  "nottingham-forest": "#e01a1a",
  sunderland: "#eb172b",
  tottenham: "#5b7bd5",
};

const premierClubs: Club[] = [
  { id: "arsenal", name: "Arsenal", city: "London", stadium: "Emirates Stadium", logo: "/club-logos/arsenal.png" },
  { id: "aston-villa", name: "Aston Villa", city: "Birmingham", stadium: "Villa Park", logo: "/club-logos/aston-villa.png" },
  { id: "bournemouth", name: "Bournemouth", city: "Bournemouth", stadium: "Vitality Stadium", logo: "/club-logos/bournemouth.png" },
  { id: "brentford", name: "Brentford", city: "London", stadium: "Gtech Community Stadium", logo: "/club-logos/brentford.png" },
  { id: "brighton", name: "Brighton", city: "Brighton", stadium: "Amex Stadium", logo: "/club-logos/brighton.png" },
  { id: "chelsea", name: "Chelsea", city: "London", stadium: "Stamford Bridge", logo: "/club-logos/chelsea.png" },
  { id: "coventry", name: "Coventry City", city: "Coventry", stadium: "Coventry Building Society Arena", logo: "/club-logos/coventry.png" },
  { id: "crystal-palace", name: "Crystal Palace", city: "London", stadium: "Selhurst Park", logo: "/club-logos/crystal-palace.png" },
  { id: "everton", name: "Everton", city: "Liverpool", stadium: "Hill Dickinson Stadium", logo: "/club-logos/everton.png" },
  { id: "fulham", name: "Fulham", city: "London", stadium: "Craven Cottage", logo: "/club-logos/fulham.png" },
  { id: "hull-city", name: "Hull City", city: "Hull", stadium: "MKM Stadium", logo: "/club-logos/hull-city.png" },
  { id: "ipswich", name: "Ipswich Town", city: "Ipswich", stadium: "Portman Road", logo: "/club-logos/ipswich.png" },
  { id: "leeds", name: "Leeds United", city: "Leeds", stadium: "Elland Road", logo: "/club-logos/leeds.png" },
  { id: "liverpool", name: "Liverpool", city: "Liverpool", stadium: "Anfield", logo: "/club-logos/liverpool.png" },
  { id: "man-city", name: "Manchester City", city: "Manchester", stadium: "Etihad Stadium", logo: "/club-logos/man-city.png" },
  { id: "man-united", name: "Manchester United", city: "Manchester", stadium: "Old Trafford", logo: "/club-logos/man-united.png" },
  { id: "newcastle", name: "Newcastle United", city: "Newcastle", stadium: "St James' Park", logo: "/club-logos/newcastle.png" },
  { id: "nottingham-forest", name: "Nottingham Forest", city: "Nottingham", stadium: "City Ground", logo: "/club-logos/nottingham-forest.png" },
  { id: "sunderland", name: "Sunderland", city: "Sunderland", stadium: "Stadium of Light", logo: "/club-logos/sunderland.png" },
  { id: "tottenham", name: "Tottenham Hotspur", city: "London", stadium: "Tottenham Hotspur Stadium", logo: "/club-logos/tottenham.png" },
];

const clubColors: Record<string, string> = { ...premierColors, ...egyptColors, ...africaColors, ...Object.fromEntries(Object.entries(europeColors).map(([k, v]) => [k, v[0]])) };

export default function TeamSelectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const league = searchParams.get("league") || "premier-league";
  const cupDef = CAF_CUPS.find((c) => c.id === league);
  const euroDef = euroComp(league);
  // in a CAF cup the manager first picks the Egyptian clubs; the club list is then those two plus the African clubs
  const [egypt, setEgypt] = useState<string[] | null>(cupDef ? null : []);
  const [usedClubs, setUsedClubs] = useState<string[]>([]);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) loadCareers(supabase, data.user.id).then((rows) => setUsedClubs(rows.filter((r) => r.league_id !== league).map((r) => r.club_id))).catch(() => setUsedClubs([]));
    });
  }, [league]);
  const clubs: Club[] = useMemo(() => {
    if (euroDef) {
      // a European cup: the English clubs that take part, then the foreign clubs
      const eng = defaultEnglish(euroDef.id).map((id) => premierClubs.find((c) => c.id === id)).filter(Boolean) as Club[];
      const foreign = (euroDef.id === "ucl" ? UCL_CLUBS : UEL_CLUBS).map((c) => ({ id: c.id, name: c.name, city: c.city, stadium: c.stadium, logo: c.logo }));
      return [...eng, ...foreign];
    }
    if (cupDef) {
      const africa = africanClubs.filter((a) => cupDef.clubs.some((c) => c.id === a.id));
      const mine = (egypt ?? []).map((id) => egyptClubs.find((c) => c.id === id)).filter(Boolean) as Club[];
      return [...mine, ...africa];
    }
    const all = baseLeague(league) === "egyptian-premier-league" ? egyptClubs : premierClubs;
    // a club another team of yours already manages is not free
    return all.filter((c) => !usedClubs.includes(c.id));
  }, [league, egypt, cupDef, euroDef, usedClubs]);

  const [selectedClub, setSelectedClub] = useState<Club>(clubs[0] ?? egyptClubs[0]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  // the list changes once the Egyptian clubs are chosen
  useEffect(() => {
    setSelectedClub((current) => clubs.find((c) => c.id === current.id) ?? clubs[0] ?? current);
  }, [clubs]);

  const filteredClubs = useMemo(() => {
    return clubs.filter((club) =>
      club.name.toLowerCase().includes(search.trim().toLowerCase())
    );
  }, [search, clubs]);

  const selectedIndex = clubs.findIndex(
    (club) => club.id === selectedClub.id
  );

  function selectPreviousClub() {
    const previousIndex =
      (selectedIndex - 1 + clubs.length) % clubs.length;
    setSelectedClub(clubs[previousIndex]);
  }

  function selectNextClub() {
    const nextIndex = (selectedIndex + 1) % clubs.length;
    setSelectedClub(clubs[nextIndex]);
  }

  function continueToProfile() {
    router.push(
      `/game/final-contract?league=${encodeURIComponent(league)}&club=${selectedClub.id}${cupDef ? `&egypt=${(egypt ?? []).join(",")}` : ""}`
    );
  }

  // up / down arrow keys flip through the clubs (not while typing in search)
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.target as HTMLElement)?.tagName === "INPUT") return;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        setSelectedClub((current) => {
          const i = clubs.findIndex((c) => c.id === current.id);
          return clubs[(i + 1) % clubs.length];
        });
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        setSelectedClub((current) => {
          const i = clubs.findIndex((c) => c.id === current.id);
          return clubs[(i - 1 + clubs.length) % clubs.length];
        });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clubs]);

  const color = clubColors[selectedClub.id] || "#2fe6c8";

  if (cupDef && egypt === null) {
    return (
      <main className="cl gx-grain" style={{ "--cc": "#2fe6c8" } as CSSProperties}>
        <div className="gx-curtain" aria-hidden="true" />
        <div className="cl-bg" aria-hidden="true" />
        <GameHud step={3} onBack={() => router.back()} />
        <div className="cl-wrap">
          <header className="cl-head">
            <h1>Pick your Egyptian clubs</h1>
            <p>Choose the {cupDef.egypt.length} Egyptian clubs you want in the {cupDef.name}. They join the 14 African clubs, and you then choose your own club from the 16.</p>
          </header>
          <section className="cl-directory" aria-label="Egyptian clubs">
            <div className="cl-dir-head">
              <h2>Egyptian clubs <b>{picked.length}/{cupDef.egypt.length}</b></h2>
            </div>
            <div className="cl-grid">
              {egyptClubs.map((club) => {
                const on = picked.includes(club.id);
                return (
                  <button
                    type="button"
                    key={club.id}
                    onClick={() => setPicked((cur) => (cur.includes(club.id) ? cur.filter((x) => x !== club.id) : cur.length < cupDef.egypt.length ? [...cur, club.id] : cur))}
                    className={`cl-tile ${on ? "is-active" : ""}`}
                    style={{ "--rc": clubColors[club.id] || "#2fe6c8" } as CSSProperties}
                    aria-pressed={on}
                  >
                    <img src={club.logo} alt="" />
                    <span>
                      <strong>{club.name}</strong>
                      <small>{club.city}</small>
                    </span>
                    {on && <Icon name="check" size={16} strokeWidth={2.8} />}
                  </button>
                );
              })}
            </div>
            <div className="cl-actions" style={{ marginTop: 18, gridTemplateColumns: "minmax(0, 360px)" }}>
              <button type="button" className="gx-btn cl-confirm" disabled={picked.length !== cupDef.egypt.length} onClick={() => setEgypt(picked)}>
                Continue
                <Icon name="arrow-right" size={22} strokeWidth={2.2} />
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="cl gx-grain" style={{ "--cc": color } as CSSProperties}>
      <div className="gx-curtain" aria-hidden="true" />
      <div className="cl-bg" aria-hidden="true" />

      <GameHud step={3} onBack={() => router.back()} />

      <div className="cl-wrap">
        <header className="cl-head">
          <h1>Choose your club</h1>
          <p>{clubs.length} clubs, one job. Pick the badge you want to carry for the whole season.</p>
        </header>

        <div className="cl-body">
          {/* the club you are looking at */}
          <section className="cl-feature" aria-live="polite" aria-label="Selected club">
            <div className="cl-stage" aria-hidden="true">
              <span className="cl-ring cl-ring-a" />
              <span className="cl-ring cl-ring-b" />
              <span className="cl-halo" />
              <span className="cl-burst" key={`b-${selectedClub.id}`} />
              <span className="cl-crest" key={`s-${selectedClub.id}`}>
                <img src={selectedClub.logo} alt="" />
                <i className="cl-shine" style={{ "--logo": `url(${selectedClub.logo})` } as CSSProperties} />
              </span>
            </div>
            <img className="cl-sr" src={selectedClub.logo} alt={`${selectedClub.name} crest`} />

            <div className="cl-id" key={`n-${selectedClub.id}`}>
              <span className="cl-count">Club {selectedIndex + 1} of {clubs.length}</span>
              <h2 aria-label={selectedClub.name}>
                {Array.from(selectedClub.name).map((ch, i) => (
                  <span key={i} aria-hidden="true" style={{ "--i": i } as CSSProperties}>{ch === " " ? "\u00a0" : ch}</span>
                ))}
              </h2>
            </div>

            <dl className="cl-specs" key={`d-${selectedClub.id}`}>
              <div><dt>Home ground</dt><dd>{selectedClub.stadium}</dd></div>
              <div><dt>City</dt><dd>{selectedClub.city}</dd></div>
              <div><dt>League</dt><dd>{leagueOf(league).name}</dd></div>
            </dl>

            <div className="cl-actions">
              <button type="button" className="cl-step" onClick={selectPreviousClub} aria-label="Previous club">
                <Icon name="arrow-left" size={22} />
              </button>
              <button type="button" className="gx-btn cl-confirm" onClick={continueToProfile}>
                Take charge
                <Icon name="arrow-right" size={22} strokeWidth={2.2} />
              </button>
              <button type="button" className="cl-step" onClick={selectNextClub} aria-label="Next club">
                <Icon name="arrow-right" size={22} />
              </button>
            </div>
          </section>

          {/* the directory */}
          <section className="cl-directory" aria-label="Club directory">
            <div className="cl-dir-head">
              <h2>All clubs <b>{filteredClubs.length}</b></h2>
              <label className="cl-search">
                <Icon name="search" size={18} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search clubs" aria-label="Search clubs" />
                {search && (
                  <button type="button" onClick={() => setSearch("")} aria-label="Clear search">
                    <Icon name="close" size={16} />
                  </button>
                )}
              </label>
            </div>

            <div className="cl-grid">
              {filteredClubs.map((club) => {
                const active = selectedClub.id === club.id;
                return (
                  <button
                    type="button"
                    key={club.id}
                    onClick={() => setSelectedClub(club)}
                    className={`cl-tile ${active ? "is-active" : ""}`}
                    style={{ "--rc": clubColors[club.id] || "#2fe6c8", "--n": clubs.indexOf(club) } as CSSProperties}
                    aria-pressed={active}
                  >
                    <img src={club.logo} alt="" />
                    <span>
                      <strong>{club.name}</strong>
                      <small>{club.city}</small>
                    </span>
                    {active && <Icon name="check" size={16} strokeWidth={2.8} />}
                  </button>
                );
              })}
            </div>

            {filteredClubs.length === 0 && (
              <div className="cl-empty">No club matches that name. Try a different spelling.</div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
