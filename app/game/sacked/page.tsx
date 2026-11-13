"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { activeSeason, seasonLabel } from "@/lib/football/season";
import { evaluateBoard, jobOffers, strengthRank, type BoardMatch, type BoardReport } from "@/lib/football/board";
import { getTier } from "@/lib/football/finance";
import GsmMark from "@/components/GsmMark";
import "./sacked.css";

export default function SackedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [league, setLeague] = useState("premier-league");
  const [club, setClub] = useState("");
  const [season, setSeason] = useState("");
  const [report, setReport] = useState<BoardReport | null>(null);
  const [step, setStep] = useState<"news" | "offers">("news");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

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
      const lg = c.selected_league || "premier-league";
      const s = await activeSeason(supabase, auth.user.id, lg);
      const { data: rows } = await supabase
        .from("league_matches")
        .select("home_club, away_club, home_score, away_score, status, matchday, played_at")
        .eq("user_id", auth.user.id)
        .eq("league_id", lg)
        .eq("season", s);
      const r = evaluateBoard((rows ?? []) as BoardMatch[], c.selected_club, c.club_appointed_at);
      if (cancelled) return;
      if (!r.sacked) return router.replace("/game/dashboard");
      setUserId(auth.user.id);
      setLeague(lg);
      setClub(c.selected_club);
      setSeason(s);
      setReport(r);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const offers = useMemo(() => (club ? jobOffers(club, `${userId}|${season}|${club}`) : []), [club, userId, season]);

  async function accept(clubId: string) {
    setBusy(clubId);
    setError("");
    try {
      await supabase.from("room_members").delete().eq("user_id", userId);
      const { data: saved, error: e } = await supabase
        .from("manager_contracts")
        .update({ selected_league: league, selected_club: clubId, club_appointed_at: new Date().toISOString(), room_id: null })
        .eq("user_id", userId)
        .select("selected_club");
      if (e) throw e;
      if (!saved?.length || saved[0].selected_club !== clubId) throw new Error("not saved");
      router.replace("/game/dashboard");
    } catch (err) {
      console.error("Offer error:", err);
      setError("Could not sign that contract. Try again.");
      setBusy("");
    }
  }

  async function leave() {
    setBusy("leave");
    try {
      await supabase.from("room_members").delete().eq("user_id", userId);
      await supabase.from("manager_contracts").update({ selected_league: null, selected_club: null, club_appointed_at: null, room_id: null }).eq("user_id", userId);
      router.replace("/game/leagues");
    } catch {
      setError("Could not leave the club. Try again.");
      setBusy("");
    }
  }

  if (loading || !report) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Calling the board...</p>
      </main>
    );
  }

  const old = clubs.find((c) => c.id === club);

  return (
    <main className="sk">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="sk-bg gx-kb" aria-hidden="true" />
      <div className="sk-shade" aria-hidden="true" />

      {step === "news" ? (
        <section className="sk-news" aria-label="You have been sacked">
          <span className="sk-tag">Breaking news</span>
          {old && <img src={old.logo} alt="" />}
          <h1>Sacked</h1>
          <p className="sk-line">{old?.name} have parted company with their manager.</p>
          <p className="sk-reason">{report.reason}</p>
          <dl className="sk-facts">
            <div><dt>Season</dt><dd>{seasonLabel(season)}</dd></div>
            <div><dt>Played</dt><dd>{report.played}</dd></div>
            <div><dt>Wins</dt><dd>{report.wins}</dd></div>
            <div><dt>Position</dt><dd>{report.position}</dd></div>
          </dl>
          <button type="button" className="gx-btn" onClick={() => setStep("offers")}>See your offers</button>
        </section>
      ) : (
        <section className="sk-offers" aria-label="Job offers">
          <header>
            <span className="sk-tag">New chapter</span>
            <h1>Job offers</h1>
            <p>Clubs are interested, but nobody at your old level is calling. These clubs are weaker than {old?.name}.</p>
          </header>
          <ul>
            {offers.map((o, i) => {
              const c = clubs.find((x) => x.id === o.clubId)!;
              return (
                <li key={o.clubId} className="gx-cut" style={{ animationDelay: `${i * 110}ms` }}>
                  <img src={c.logo} alt="" />
                  <div>
                    <strong>{c.name}</strong>
                    <small>{getTier(c.id) === "mid" ? "Mid-table" : getTier(c.id) === "elite" ? "Big club" : "Smaller club"} · strength rank {o.rank} of {clubs.length}</small>
                    <p>{o.note}</p>
                    <em>Objective: {o.objective}</em>
                  </div>
                  <button type="button" className="gx-btn" disabled={!!busy} onClick={() => accept(c.id)}>
                    {busy === c.id ? "Signing..." : "Accept"}
                  </button>
                </li>
              );
            })}
          </ul>
          {error && <p className="sk-error" role="alert">{error}</p>}
          <button type="button" className="sk-leave" disabled={!!busy} onClick={leave}>Turn them all down and pick any club</button>
          <small className="sk-foot">Your old club was ranked {strengthRank(club)} by strength.</small>
        </section>
      )}
    </main>
  );
}
