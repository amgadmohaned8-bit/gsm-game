"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { levelOf, loadUnlocked, xpOf, trainingBoost, capBoost } from "@/lib/football/badges";
import { phase, seasonCap, sessionGain, SLOTS } from "@/lib/football/development";
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

  const doneToday = useMemo(
    () => (ctx && day !== null ? training.filter((t) => t.season === ctx.season && t.matchday === day) : []),
    [ctx, day, training]
  );
  const seasonGain = useMemo(() => {
    const out: Record<string, number> = {};
    if (!ctx) return out;
    for (const t of training) if (t.season === ctx.season) out[t.player_id] = (out[t.player_id] ?? 0) + Number(t.gain);
    return out;
  }, [ctx, training]);

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
    setPicked((cur) => {
      if (cur.includes(p.id)) return cur.filter((id) => id !== p.id);
      if (cur.length >= SLOTS) {
        setProblem(`Three players a week. Remove one first.`);
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
        return { user_id: ctx.userId, season: ctx.season, matchday: day, player_id: id, gain: Math.round(gain * 100) / 100 };
      });
      const { error: insertError } = await supabase.from("training_sessions").insert(rowsToSave);
      if (insertError) throw insertError;
      setResult(rowsToSave.map((r) => ({ name: byId.get(r.player_id)!.name, gain: r.gain })));
      setPicked([]);
      await reload();
    } catch (err) {
      console.error("Training error:", err);
      setProblem("The session did not save. Make sure supabase/010_training.sql has been run.");
    } finally {
      setBusy(false);
    }
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
            <small>Coach level {level}: training works {Math.round((boost - 1) * 100)}% better (earn levels with achievements). Train three players a week. Young players improve fast, older players only a little. Each new season the young grow and the veterans slow down.</small>
          </div>
          <div className="tn-slots" aria-label="This week's session">
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
              {day === null ? "Season over" : doneToday.length ? "Done this week" : busy ? "Training..." : `Train ${picked.length || ""}`.trim()}
            </button>
          </div>
        </header>

        {problem && <p className="tn-problem" role="alert">{problem}</p>}
        {result && (
          <p className="tn-result" role="status">
            Session done: {result.map((r) => `${r.name} +${r.gain.toFixed(2)}`).join(", ")}. Small gains add up: a player's rating moves up one point when they add up.
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
                  <span className="tn-bar" aria-label={`Trained ${spent.toFixed(1)} of ${capNow.toFixed(1)} this season`}><em style={{ width: `${Math.min(100, (spent / capNow) * 100)}%` }} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
