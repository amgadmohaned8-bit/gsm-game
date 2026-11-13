"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { activeSeason, seasonLabel } from "@/lib/football/season";
import { evaluateBoard, type BoardMatch, type BoardReport } from "@/lib/football/board";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "./board.css";

const MOODS: Record<BoardReport["mood"], { title: string; quote: string }> = {
  delighted: { title: "Delighted", quote: "This is exactly what we hoped for. Keep going." },
  happy: { title: "Happy", quote: "The results are good. We trust your work." },
  patient: { title: "Patient", quote: "We expected a little more, but there is time." },
  worried: { title: "Worried", quote: "The supporters are asking questions. We need a reaction." },
  angry: { title: "Furious", quote: "One more bad result and we will have to make a change." },
};

const STATUS = { done: "Achieved", "on-track": "On track", "at-risk": "At risk", failed: "Failed" } as const;

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function BoardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [club, setClub] = useState("");
  const [season, setSeason] = useState("");
  const [report, setReport] = useState<BoardReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return router.replace("/");
      const { data: c } = await supabase
        .from("manager_contracts")
        .select("selected_club, selected_league, club_appointed_at")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (!c?.selected_club) return router.replace("/game/leagues");
      const league = c.selected_league || "premier-league";
      const s = await activeSeason(supabase, auth.user.id, league);
      const { data: rows } = await supabase
        .from("league_matches")
        .select("home_club, away_club, home_score, away_score, status, matchday, played_at")
        .eq("user_id", auth.user.id)
        .eq("league_id", league)
        .eq("season", s);
      const r = evaluateBoard((rows ?? []) as BoardMatch[], c.selected_club, c.club_appointed_at);
      if (cancelled) return;
      if (r.sacked) return router.replace("/game/sacked");
      setClub(c.selected_club);
      setSeason(s);
      setReport(r);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading || !report) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Opening the boardroom...</p>
      </main>
    );
  }

  const me = clubs.find((c) => c.id === club);
  const mood = MOODS[report.mood];
  const R = 70;
  const C = 2 * Math.PI * R;
  const pts = report.history.length > 1
    ? report.history.map((h, i) => `${(i / (report.history.length - 1)) * 300},${70 - (h.confidence / 100) * 64}`).join(" ")
    : "";

  return (
    <main className="bd">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="bd-bg gx-kb" aria-hidden="true" />
      <div className="bd-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="bd-wrap">
        <header className="bd-head">
          <p>{me?.name} · Season {seasonLabel(season)}</p>
          <h1><span className="gx-slant">Board room</span></h1>
        </header>

        {report.warning && <p className="bd-warn" role="alert">{report.warning}</p>}

        <div className="bd-grid">
          <section className={`bd-confidence gx-cut mood-${report.mood}`} aria-label="Board confidence">
            <svg viewBox="0 0 180 180" role="img" aria-label={`Board confidence ${report.confidence} of 100`}>
              <circle cx="90" cy="90" r={R} className="bd-track" />
              <circle cx="90" cy="90" r={R} className="bd-fill" strokeDasharray={C} style={{ ["--to" as never]: C * (1 - report.confidence / 100) }} transform="rotate(-90 90 90)" />
              <text x="90" y="92" textAnchor="middle" className="bd-num">{report.confidence}</text>
              <text x="90" y="116" textAnchor="middle" className="bd-lbl">CONFIDENCE</text>
            </svg>
            <div>
              <h2>{mood.title}</h2>
              <p>“{mood.quote}”</p>
              <ul className="bd-form" aria-label="Recent form">
                {report.form.length === 0 ? <li className="none">No matches yet</li> : report.form.map((f, i) => <li key={i} className={`f-${f}`}>{f}</li>)}
              </ul>
              {pts && (
                <svg className="bd-spark" viewBox="0 0 300 76" preserveAspectRatio="none" aria-hidden="true">
                  <polyline points={pts} />
                </svg>
              )}
            </div>
          </section>

          <section className="bd-stats gx-cut" aria-label="Season so far">
            <div><span>Position</span><b>{ordinal(report.position)}</b></div>
            <div><span>Played</span><b>{report.played}</b></div>
            <div><span>Wins</span><b>{report.wins}</b></div>
            <div><span>Losing run</span><b className={report.lossStreak >= 3 ? "is-bad" : ""}>{report.lossStreak}</b></div>
          </section>
        </div>

        <section className="bd-objectives" aria-label="Season objectives">
          <h2>Season objectives</h2>
          <ul>
            {report.objectives.map((o, i) => {
              const pct = o.kind === "position" ? Math.max(0, Math.min(100, ((21 - o.value) / (21 - o.target)) * 100)) : Math.min(100, (o.value / o.target) * 100);
              return (
                <li key={o.id} className={`st-${o.status} gx-cut`} style={{ animationDelay: `${i * 90}ms` }}>
                  <div>
                    <strong>{o.title}</strong>
                    <small>{o.detail}</small>
                  </div>
                  <span className="bd-chip">{STATUS[o.status]}</span>
                  <p className="bd-val">
                    {o.kind === "position" ? `Now ${ordinal(o.value)}` : o.kind === "wins" ? `${o.value} of ${o.target}` : `${o.value} of ${o.target - 1} allowed`}
                  </p>
                  <span className="bd-meter"><i style={{ width: `${o.kind === "streak" ? (o.value / o.target) * 100 : pct}%` }} /></span>
                </li>
              );
            })}
          </ul>
          <p className="bd-note">Your objectives follow the size of your club. A weaker club gets easier targets. A manager who falls far short, loses five in a row, or loses the board completely is sacked, and other clubs may then make an offer.</p>
        </section>
      </div>
    </main>
  );
}
