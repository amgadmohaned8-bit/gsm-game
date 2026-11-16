"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { levelOf, loadUnlocked, xpOf, trainingBoost, capBoost } from "@/lib/football/badges";
import { finishesAt, gainsAt, MAX_RATING, phase, progressOf, seasonCap, sessionGain, SLOTS, TRAIN_HOURS, TRAIN_MS } from "@/lib/football/development";
import { alertAt } from "@/lib/notify";
import { useTransfers } from "@/lib/football/useTransfers";
import type { Player, Position } from "@/lib/football/squads";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "./training.css";

type Filter = "ALL" | "YOUNG" | Position;

export default function TrainingPage() {
  const router = useRouter();
  const { ctx, loading, error, reload } = useTransfers();
  const [level, setLevel] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<{ name: string; gain: number }[] | null>(null);

  const uid = ctx?.userId;
  useEffect(() => {
    if (uid) loadUnlocked(supabase, uid).then((ids) => setLevel(levelOf(xpOf(ids))));
  }, [uid]);
  const boost = trainingBoost(level);
  const cap = (age: number) => seasonCap(age) * capBoost(level);

  const squad: Player[] = ctx?.state.squads[ctx.clubId] ?? [];
  const training = ctx?.state.training ?? [];
  const day = ctx?.matchday ?? null;

  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);

  /** the session in progress: its players and when it ends (8 hours after it started) */
  const doneToday = useMemo(
    () => (now ? training.filter((t) => { const end = finishesAt(t); return end !== null && end > now; }) : []),
    [now, training]
  );
  const endsAt = useMemo(() => doneToday.reduce((m, t) => Math.max(m, finishesAt(t) ?? 0), 0), [doneToday]);
  const wasTraining = useRef(false);
  useEffect(() => {
    // the session just finished while the page is open: load the new ratings
    if (wasTraining.current && !endsAt) void reload();
    wasTraining.current = endsAt > 0;
  }, [endsAt, reload]);
  useEffect(() => {
    if (endsAt) void alertAt(4, endsAt, "Training finished", "Your players finished training. Start the next session.");
  }, [endsAt]);
  const seasonGain = useMemo(() => {
    const out: Record<string, number> = {};
    if (!ctx) return out;
    for (const t of training) if (t.season === ctx.season) out[t.player_id] = (out[t.player_id] ?? 0) + Number(t.gain);
    return out;
  }, [ctx, training]);

  /** finished training per player (the green bar) and what the running session will add */
  const finished = useMemo(() => (ctx ? gainsAt(training, ctx.season, ctx.matchday ?? 99, squad) : {}), [ctx, training, squad]);
  const pendingGain = useMemo(() => {
    const out: Record<string, number> = {};
    doneToday.forEach((t) => { out[t.player_id] = (out[t.player_id] ?? 0) + Number(t.gain); });
    return out;
  }, [doneToday]);

  const rows = useMemo(() => {
    const list = filter === "ALL" ? squad : filter === "YOUNG" ? squad.filter((p) => p.age <= 23) : squad.filter((p) => p.position === filter);
    return list.slice().sort((a, b) => a.age - b.age || b.rating - a.rating);
  }, [squad, filter]);

  if (loading || !ctx) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>{error || "Loading the training ground..."}</p>
      </main>
    );
  }

  const locked = day === null || doneToday.length > 0;
  const byId = new Map(squad.map((p) => [p.id, p]));

  function toggle(p: Player) {
    if (locked) return;
    setProblem("");
    if (p.rating >= MAX_RATING && !picked.includes(p.id)) {
      setProblem(`${p.name} is already at the maximum rating (${MAX_RATING}).`);
      return;
    }
    setPicked((cur) => {
      if (cur.includes(p.id)) return cur.filter((id) => id !== p.id);
      if (cur.length >= SLOTS) {
        setProblem(`Three players per session. Remove one first.`);
        return cur;
      }
      return [...cur, p.id];
    });
  }

  async function train() {
    if (!ctx || day === null || !picked.length || busy) return;
    setBusy(true);
    setProblem("");
    try {
      const rowsToSave = picked.map((id) => {
        const p = byId.get(id)!;
        const spent = seasonGain[id] ?? 0;
        const gain = Math.max(0, Math.min(sessionGain(p.age) * boost, cap(p.age) - spent));
        return { user_id: ctx.userId, league_id: ctx.leagueId, season: ctx.season, matchday: day, player_id: id, gain: Math.round(gain * 100) / 100 };
      });
      const { error: insertError } = await supabase.from("training_sessions").insert(rowsToSave);
      if (insertError) throw insertError;
      void alertAt(4, Date.now() + TRAIN_MS, "Training finished", "Your players finished training. Start the next session.");
      setResult(rowsToSave.map((r) => ({ name: byId.get(r.player_id)!.name, gain: r.gain })));
      setPicked([]);
      await reload();
    } catch (err) {
      console.error("Training error:", err);
      setProblem("The session did not save. Make sure supabase/010_training.sql and 015_training_cooldown.sql have been run.");
    } finally {
      setBusy(false);
    }
  }

  function left(ms: number) {
    const m = Math.max(0, Math.ceil(ms / 60000));
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m left` : `${m}m left`;
  }
  const chips: [Filter, string][] = [["ALL", "All"], ["YOUNG", "Young"], ["GK", "GK"], ["DF", "DF"], ["MF", "MF"], ["FW", "FW"]];

  return (
    <main className="tn">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="tn-bg gx-kb" aria-hidden="true" />
      <div className="tn-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="tn-wrap">
        <header className="tn-head">
          <div>
            <p>Training ground</p>
            <h1><span className="gx-slant">Training</span></h1>
            <small>Coach level {level}: training works {Math.round((boost - 1) * 100)}% better (earn levels with achievements). Train up to three players per session. A session takes 8 hours; then you can start the next one. Young players gain +1 rating in one session, players between 25 and 29 need two sessions, and players over 30 need about two and a half. Ratings can reach {MAX_RATING}.</small>
          </div>
          <div className="tn-slots" aria-label="Current session">
            {Array.from({ length: SLOTS }).map((_, i) => {
              const id = doneToday[i]?.player_id ?? picked[i];
              const p = id ? byId.get(id) : null;
              return (
                <div key={i} className={`tn-slot ${p ? "is-full" : ""} ${doneToday[i] ? "is-done" : ""}`}>
                  {p ? (<><b>{p.rating}</b><strong>{p.name}</strong><small>+{(doneToday[i] ? Number(doneToday[i].gain) : sessionGain(p.age) * boost).toFixed(2)}</small></>) : <span>Free slot</span>}
                </div>
              );
            })}
            <button type="button" className="gx-btn" disabled={locked || !picked.length || busy} onClick={train}>
              {day === null ? "Season over" : doneToday.length ? `Training ${left(endsAt - now)}` : busy ? "Training..." : `Train ${picked.length || ""}`.trim()}
            </button>
          </div>
        </header>

        {problem && <p className="tn-problem" role="alert">{problem}</p>}
        {result && (
          <p className="tn-result" role="status">
            Session started: {result.map((r) => `${r.name} +${r.gain.toFixed(2)}`).join(", ")}. It finishes in {TRAIN_HOURS} hours, and we will notify you. The green bar under each player fills a little with every session. When it is full, his rating goes up by one.
          </p>
        )}

        <div className="tn-tabs" role="tablist" aria-label="Filter">
          {chips.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>

        <ul className="tn-grid">
          {rows.map((p, i) => {
            const on = picked.includes(p.id);
            const trained = doneToday.some((t) => t.player_id === p.id);
            const spent = seasonGain[p.id] ?? 0;
            const capNow = cap(p.age);
            const prog = progressOf(finished[p.id] ?? 0);
            const wait = Math.min(1 - prog, pendingGain[p.id] ?? 0);
            const atMax = p.rating >= MAX_RATING;
            const atCap = atMax || spent >= capNow - 0.005;
            const ph = phase(p.age);
            return (
              <li key={p.id} style={{ animationDelay: `${Math.min(i, 20) * 18}ms` }}>
                <button type="button" className={`tn-card ph-${ph} ${on ? "is-on" : ""} ${trained ? "is-trained" : ""}`} onClick={() => toggle(p)} aria-pressed={on} disabled={locked && !trained}>
                  <b>{p.rating}</b>
                  <i>{p.position}</i>
                  <strong>{p.name}</strong>
                  <small>{p.age} yrs</small>
                  <span className="tn-phase">{ph === "rising" ? "↑ Rising" : ph === "prime" ? "● Prime" : "↓ Declining"}</span>
                  <span className="tn-gain">+{(sessionGain(p.age) * boost).toFixed(2)} / session</span>
                  <span className="tn-prog" role="img" aria-label={`${Math.round(prog * 100)} percent of the way to rating ${p.rating + 1}`}>
                    <em className="is-done" style={{ width: `${prog * 100}%` }} />
                    {wait > 0 && <em className="is-wait" style={{ width: `${wait * 100}%` }} />}
                  </span>
                  <span className="tn-next">
                    {atMax ? "Maximum rating" : atCap ? "Season limit reached" : wait > 0 ? `${Math.round(prog * 100)}% → ${Math.round((prog + wait) * 100)}% to ${p.rating + 1}` : `${Math.round(prog * 100)}% to ${p.rating + 1}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
