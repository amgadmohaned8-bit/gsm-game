"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { readTactic, saveTactic, styleOf } from "@/lib/football/tactics";
import { currentLineup } from "@/lib/football/strength";
import { useTransfers } from "@/lib/football/useTransfers";
import { ANALYST_FEE, analyze, hireAnalyst, loadHires, type Hire } from "@/lib/football/analyst";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "./analyst.css";

export default function AnalystPage() {
  const router = useRouter();
  const { ctx, loading, error, reload } = useTransfers();
  const [hires, setHires] = useState<Hire[]>([]);
  const [hiring, setHiring] = useState(false);
  const [hireError, setHireError] = useState("");
  const [opponent, setOpponent] = useState<string | null>(null);
  /** which match the opponent belongs to: the league matchday, or 200 / 300 + the round of a continental cup */
  const [slot, setSlot] = useState<number | null>(null);
  const [looked, setLooked] = useState(false);
  const [applied, setApplied] = useState(false);

  const uid = ctx?.userId;
  const clubId = ctx?.clubId;

  useEffect(() => {
    if (!uid || !clubId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("league_matches")
          .select("home_club, away_club, matchday")
          .eq("user_id", uid)
          .eq("status", "scheduled")
          .order("matchday", { ascending: true })
          .limit(40);
        const next = (data ?? []).find((m) => m.home_club === clubId || m.away_club === clubId);
        if (next) {
          if (cancelled) return;
          setOpponent(next.home_club === clubId ? next.away_club : next.home_club);
          setSlot(next.matchday);
          return;
        }
        // a cup career (Africa or Europe): the next tie of the competition
        for (const [table, base] of [["continental_matches", 200], ["euro_matches", 300]] as const) {
          const { data: ties } = await supabase.from(table).select("home_club, away_club, round_no").eq("user_id", uid).eq("status", "scheduled").order("round_no", { ascending: true }).limit(40);
          const tie = (ties ?? []).find((m) => m.home_club === clubId || m.away_club === clubId);
          if (tie) {
            if (cancelled) return;
            setOpponent(tie.home_club === clubId ? tie.away_club : tie.home_club);
            setSlot(base + tie.round_no);
            return;
          }
        }
      } catch {
        /* scouting is optional */
      } finally {
        if (!cancelled) setLooked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, clubId]);

  useEffect(() => {
    if (uid) void loadHires(supabase, uid).then(setHires);
  }, [uid]);

  const squad = ctx?.state.squads[ctx.clubId] ?? [];
  const day = ctx && ctx.matchday !== null ? { key: ctx.userId, season: ctx.season, matchday: ctx.matchday } : undefined;
  const lineup = useMemo(() => (ctx ? currentLineup(ctx.userId, ctx.clubId, squad, day) : null), [ctx, squad, day]);
  const formation = lineup?.formation;
  const hired = !!ctx && slot !== null && !!opponent && hires.some((h) => h.club_id === ctx.clubId && h.season === ctx.season && h.matchday === slot);
  const saved = ctx ? readTactic(ctx.userId, ctx.clubId) : null;
  const report = useMemo(() => {
    if (!hired || !ctx || !opponent) return null;
    const theirs = ctx.state.squads[opponent] ?? [];
    if (!theirs.length) return null;
    return analyze({ myClub: ctx.clubId, opponent, mySquad: squad, theirSquad: theirs, currentTactic: readTactic(ctx.userId, ctx.clubId), currentFormation: formation ?? "4-3-3" });
  }, [hired, ctx, opponent, squad, formation]);

  if (loading || !ctx) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>{error || "Opening the analyst's office..."}</p>
      </main>
    );
  }

  const oppClub = clubs.find((c) => c.id === opponent);

  async function hire() {
    if (!ctx || !opponent || slot === null) return;
    setHiring(true);
    setHireError("");
    try {
      await hireAnalyst(supabase, { userId: ctx.userId, clubId: ctx.clubId, season: ctx.season, matchday: slot, opponent });
      setHires(await loadHires(supabase, ctx.userId));
      await reload();
    } catch (e) {
      setHireError(e instanceof Error ? e.message : "Could not hire the analyst.");
    } finally {
      setHiring(false);
    }
  }

  function applyPlan() {
    if (!report || !ctx) return;
    saveTactic(ctx.userId, ctx.clubId, report.plan.tactic);
    setApplied(true);
  }

  return (
    <main className="an">
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <header className="an-hero">
        <img src="/staff/analyst.webp" alt="The performance analyst's office" />
        <div className="an-hero-text">
          <h1>Performance analyst</h1>
          <p>He studies the next opponent and gives you the plan that suits your players best.</p>
        </div>
      </header>

      <div className="an-wrap">
        {!looked ? (
          <section className="an-card"><p>Looking for your next match...</p></section>
        ) : !oppClub || slot === null ? (
          <section className="an-card">
            <strong>No match to study</strong>
            <p>There is no next match right now. When the new season starts, the analyst can report on each opponent.</p>
            <Link href="/game/fixtures" className="an-btn is-ghost">Open the fixtures</Link>
          </section>
        ) : (
          <>
            <section className="an-card an-next">
              <img src={oppClub.logo} alt="" />
              <div>
                <small>Next opponent</small>
                <strong>{oppClub.name}</strong>
              </div>
            </section>

            {!hired ? (
              <section className="an-card">
                <strong>Report on {oppClub.name}</strong>
                <p>How they play, where they are weak, and the style and shape that suit your eleven best. One match, {ANALYST_FEE}M.</p>
                <button type="button" className="an-btn" onClick={hire} disabled={hiring || ctx.spendM < ANALYST_FEE}>
                  {hiring ? "Hiring..." : ctx.spendM < ANALYST_FEE ? `Not enough money (${ANALYST_FEE}M)` : `Hire for ${ANALYST_FEE}M`}
                </button>
                {hireError && <p className="is-down" role="alert">{hireError}</p>}
              </section>
            ) : report ? (
              <>
                <section className="an-card">
                  <strong>{oppClub.name} play {styleOf(report.theirStyle).name.toLowerCase()}</strong>
                  <dl className="an-lines">
                    {report.lines.map((l) => (
                      <div key={l.line}>
                        <dt>{l.name}{l.line === report.weakest ? " (weak)" : l.line === report.strongest ? " (strong)" : ""}</dt>
                        <dd><b>{l.mine}</b> vs {l.theirs}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="an-note">Left is your line, right is theirs. Their best players: {report.threats.map((p) => `${p.name} (${p.rating})`).join(", ")}.</p>
                </section>

                <section className="an-card">
                  <strong>The plan: {styleOf(report.plan.style).name}, {report.plan.formation}</strong>
                  <p>{report.plan.why.join(" ")}</p>
                  <p className={report.plan.gain >= report.current ? "is-up" : "is-down"}>
                    Plan: {report.plan.gain > 0 ? "+" : ""}{report.plan.gain.toFixed(1)} rating points. Your saved tactic: {report.current > 0 ? "+" : ""}{report.current.toFixed(1)}.
                  </p>
                  <button type="button" className="an-btn" onClick={applyPlan} disabled={applied}>
                    {applied ? "Plan saved to your tactics" : "Use this plan"}
                  </button>
                  <p className="an-note">The plan sets the style and the sliders. Set the shape to {report.plan.formation} in <Link href="/game/squad">Lineups</Link>. {saved ? "" : "You had no saved tactic yet."}</p>
                </section>

                <section className="an-card">
                  <strong>Tips for the match</strong>
                  <ul className="an-tips">{report.tips.map((t) => <li key={t}>{t}</li>)}</ul>
                </section>
              </>
            ) : (
              <section className="an-card"><p>The report is not ready yet. Try again in a moment.</p></section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
