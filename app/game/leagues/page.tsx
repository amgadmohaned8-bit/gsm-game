"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import { JoinModal } from "@/components/RoomModals";
import { forgetCode, normalizeCode, pendingCode, rememberCode } from "@/lib/football/rooms";
import { CAF_CUPS } from "@/lib/football/africa";
import { CUPS, LEAGUES } from "@/lib/football/leaguesCatalog";
import { supabase } from "@/lib/supabase";
import { loadCareers } from "@/lib/football/careers";
import { baseLeague, freeSlot, MAX_CAREERS } from "@/lib/football/leagueIds";
import "./leagues.css";

export default function LeaguesPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"leagues" | "cups">("leagues");
  const leagues = mode === "cups" ? CUPS : LEAGUES;

  const [centerIndex, setCenterIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const rail = useRef<HTMLDivElement>(null);
  // leagues this manager already runs a club in (only filled when adding another league)
  const [owned, setOwned] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("add") !== "1") return;
    setAdding(true);
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) loadCareers(supabase, data.user.id).then((rows) => setOwned(rows.map((r) => r.league_id)));
    });
  }, []);

  // an invite link (?code=ABC123) or a code kept from before the login opens the join window
  useEffect(() => {
    const fromLink = normalizeCode(new URLSearchParams(window.location.search).get("code") ?? "");
    if (fromLink) rememberCode(fromLink);
    const code = fromLink || pendingCode();
    if (code) {
      setJoinCode(code);
      setJoinOpen(true);
    }
  }, []);

  const currentLeague = leagues[centerIndex];
  // a manager can run up to four teams, also in the same league: only the limit stops him
  const taken = adding && owned.length >= MAX_CAREERS;

  // left / right arrow keys move through the leagues
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") {
        setCenterIndex((i) => (i + 1) % leagues.length);
      } else if (event.key === "ArrowLeft") {
        setCenterIndex((i) => (i - 1 + leagues.length) % leagues.length);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leagues.length]);

  // on a phone the cards sit in a swipe row: keep the chosen one in view
  useEffect(() => {
    const el = rail.current?.children[centerIndex] as HTMLElement | undefined;
    if (el && window.matchMedia("(max-width: 860px)").matches) el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [centerIndex]);

  function handleContinue() {
    if (!currentLeague.available || taken || loading) return;

    setLoading(true);
    router.push(`/game/team-selection?league=${adding ? freeSlot(currentLeague.id, owned) : currentLeague.id}`);
  }

  return (
    <main
      className="lg gx-grain"
      style={{ "--lc": currentLeague.color, "--lc2": currentLeague.color2 } as CSSProperties}
    >
      <div className="gx-curtain" aria-hidden="true" />
      <div className="lg-bg gx-kb" aria-hidden="true" />
      {leagues.map((l, i) => (
        <div key={l.id} className={`lg-aura ${i === centerIndex ? "is-on" : ""}`} aria-hidden="true" style={{ "--c1": l.color, "--c2": l.color2 } as CSSProperties} />
      ))}
      <div className="lg-pitch" aria-hidden="true">
        <svg viewBox="0 0 1200 760" preserveAspectRatio="xMidYMid slice">
          <g fill="none" stroke="currentColor" strokeWidth="3">
            <rect x="40" y="40" width="1120" height="680" rx="6" />
            <path d="M600 40v680" />
            <circle cx="600" cy="380" r="118" />
            <circle cx="600" cy="380" r="6" fill="currentColor" />
            <rect x="40" y="190" width="190" height="380" />
            <rect x="40" y="290" width="70" height="180" />
            <rect x="970" y="190" width="190" height="380" />
            <rect x="1090" y="290" width="70" height="180" />
            <path d="M230 320a118 118 0 0 1 0 120M970 320a118 118 0 0 0 0 120" />
          </g>
        </svg>
      </div>
      <div className="lg-beams" aria-hidden="true"><i /><i /><i /></div>
      <div className="lg-shade" aria-hidden="true" />

      <GameHud step={2} onBack={() => router.back()} />

      <section className="lg-stage">
        <div className="lg-title">
          <h1>{mode === "cups" ? "Continental cups" : "Pick your league"}</h1>
          <div className="lg-mode" role="tablist" aria-label="Competition type">
            {(["leagues", "cups"] as const).map((m) => (
              <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setCenterIndex(0); }}>{m === "leagues" ? "Leagues" : "Cups"}</button>
            ))}
          </div>
          <p>{mode === "cups" ? "Play a continental cup on its own: pick the Egyptian clubs you want in it, then choose your club from the 16. Finish top 4 in the Egyptian league and you qualify automatically too." : adding ? "Adding a league to your career. The leagues you already run stay as they are, and you can switch between them from your manager page." : "Swipe, tap or use the arrow keys. Your whole career plays out in the one you choose."}</p>
        </div>

        <div className="lg-rail" role="group" aria-label="Leagues" ref={rail}>
          {leagues.map((league, index) => {
            const active = index === centerIndex;
            return (
              <button
                key={league.id}
                type="button"
                data-league={league.id}
                className={`lg-card ${active ? "is-active" : ""} ${league.available && !taken ? "" : "is-locked"} ${league.facts ? "is-cup" : ""}`}
                style={{ "--c1": league.color, "--c2": league.color2 } as CSSProperties}
                onClick={() => setCenterIndex(index)}
                aria-pressed={active}
                aria-label={`${league.name}, ${league.country}${league.available ? "" : ", coming soon"}`}
              >
                <span className="lg-art" aria-hidden="true">
                  <span className="lg-pattern" />
                  <img className="lg-mark" src={league.logo} alt="" />
                </span>

                <span className="lg-status">
                  {owned.includes(league.id) ? (
                    <>
                      <Icon name="check" size={13} strokeWidth={2.8} /> You manage here
                    </>
                  ) : league.available ? (
                    <>
                      <Icon name="check" size={13} strokeWidth={2.8} /> Ready to play
                    </>
                  ) : (
                    <>
                      <Icon name="lock" size={13} /> Coming soon
                    </>
                  )}
                </span>

                <span className="lg-disc">
                  <img src={league.logo} alt="" />
                </span>

                <span className="lg-body">
                  <span className="lg-country">{league.country}</span>
                  <strong>{league.name}</strong>
                  <span className="lg-blurb">{league.blurb}</span>
                  <span className="lg-facts">
                    {league.facts ? (
                      league.facts.map(([v, l]) => <span key={l}><b>{v}</b> {l}</span>)
                    ) : (
                      <>
                        <span><b>{league.clubs}</b> clubs</span>
                        <span><b>{league.rounds}</b> matchdays</span>
                      </>
                    )}
                  </span>
                  {league.facts && (
                    <span className="lg-teams">
                      {(CAF_CUPS.find((x) => x.id === league.id)?.egypt ?? []).map((pos) => (
                        <span key={pos} className="lg-seat" title={`Egypt, league position ${pos}`}>EGY {pos}</span>
                      ))}
                      {(CAF_CUPS.find((x) => x.id === league.id)?.clubs ?? []).map((c) => (
                        <span key={c.id} className="lg-tc" title={`${c.name} (${c.country})`} style={{ "--a": c.colors[0], "--b": c.colors[1] } as CSSProperties}>
                          {c.logo ? <img src={c.logo} alt={c.name} /> : <b>{c.short}</b>}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <footer className="lg-bar">
        <div className="lg-bar-pick">
          <span className="lg-bar-dot" />
          <div>
            <small>Selected competition</small>
            <strong>{currentLeague.name}</strong>
          </div>
        </div>

        <button type="button" className="lg-join" onClick={() => { setJoinCode(""); setJoinOpen(true); }}>
          <Icon name="user" size={18} /> Join with code
        </button>

        <button
          type="button"
          className="gx-btn"
          onClick={handleContinue}
          disabled={!currentLeague.available || taken || loading}
        >
          {loading
            ? "Loading..."
            : taken
              ? `You already manage ${MAX_CAREERS} teams`
              : currentLeague.available
                ? "Choose your club"
                : "Coming soon"}
          <Icon name="arrow-right" size={22} strokeWidth={2.2} />
        </button>
      </footer>
      {joinOpen && (
        <JoinModal
          initialCode={joinCode}
          onClose={() => {
            forgetCode();
            setJoinOpen(false);
          }}
        />
      )}
    </main>
  );
}
