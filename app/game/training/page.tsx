"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { levelOf, loadUnlocked, xpOf, trainingBoost, capBoost } from "@/lib/football/badges";
import { finishesAt, gainsAt, phase, progressOf, seasonCap, sessionGain, SLOTS, TRAIN_HOURS, TRAIN_MS } from "@/lib/football/development";
import { alertAt } from "@/lib/notify";
import { useTransfers } from "@/lib/football/useTransfers";
import type { Player, Position } from "@/lib/football/squads";
import GsmMark from "@/components/GsmMark";
import DxBar from "@/components/DxBar";
import { seasonLabel } from "@/lib/football/season";
import PlayerFace from "@/components/PlayerFace";
import { kitOf } from "@/lib/football/kits";
import "./training.css";

import { nowMs } from "@/lib/serverTime";
type Filter = "ALL" | "YOUNG";

export default function TrainingPage() {
  const router = useRouter();
  const { ctx, loading, error, reload } = useTransfers();
  const [level, setLevel] = useState(1);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [pos, setPos] = useState<Position>("FW");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [result, setResult] = useState<{ name: string; gain: number } | null>(null);

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
    setNow(nowMs());
    const t = setInterval(() => setNow(nowMs()), 1000);
    return () => clearInterval(t);
  }, []);

  /** the session in progress: its players and when it ends (8 hours after it started) */
  const doneToday = useMemo(
    () => (now ? training.filter((t) => { const end = finishesAt(t); return end !== null && end > now; }) : []),
    [now, training]
  );
  const running = useMemo(() => doneToday.slice().sort((a, b) => (finishesAt(a) ?? 0) - (finishesAt(b) ?? 0)), [doneToday]);
  const wasCount = useRef(0);
  useEffect(() => {
    // someone just finished while the page is open: load the new ratings
    if (running.length < wasCount.current) void reload();
    wasCount.current = running.length;
  }, [running.length, reload]);
  const runKey = running.map((t) => `${t.player_id}:${t.created_at}`).join("|");
  useEffect(() => {
    running.forEach((t, i) => {
      const end = finishesAt(t);
      if (end) void alertAt(40 + i, end, "Training finished", "A player finished training. Start the next one.");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);
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
    const list = squad.filter((p) => p.position === pos && (filter === "ALL" || p.age <= 23));
    return list.slice().sort((a, b) => a.age - b.age || b.rating - a.rating);
  }, [squad, filter, pos]);

  if (loading || !ctx) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>{error || "Loading the training ground..."}</p>
      </main>
    );
  }

  const byId = new Map(squad.map((p) => [p.id, p]));
  const posOf = (id: string) => byId.get(id)?.position;
  const runningBy = (k: Position) => running.filter((t) => posOf(t.player_id) === k).length;
  const trainingIds = new Set(running.map((t) => t.player_id));

  /** four sessions at a time, and every position keeps a place: nobody can fill the board with one position */
  function slotProblem(k: Position): string {
    if (day === null) return "The season is over.";
    const others = (["GK", "DF", "MF", "FW"] as Position[]).filter((x) => x !== k && runningBy(x) === 0).length;
    const reserved = runningBy(k) === 0 ? 0 : others;
    if (running.length + reserved >= SLOTS) {
      return running.length >= SLOTS ? "All four training places are busy. Wait for a player to finish." : "Keep a place free for the other positions: train a goalkeeper, defender, midfielder and forward first.";
    }
    return "";
  }

  /** one tap starts that player's own 8 hour countdown */
  async function train(p: Player) {
    if (!ctx || day === null || busy || trainingIds.has(p.id)) return;
    const why = slotProblem(p.position);
    if (why) { setProblem(why); return; }
    setBusy(true);
    setProblem("");
    try {
      const spent = seasonGain[p.id] ?? 0;
      const gain = Math.max(0, Math.min(sessionGain(p.age) * boost, cap(p.age) - spent));
      const row = { user_id: ctx.userId, league_id: ctx.leagueId, season: ctx.season, matchday: day, player_id: p.id, gain: Math.round(gain * 100) / 100 };
      const { error: insertError } = await supabase.from("training_sessions").insert(row);
      if (insertError) throw insertError;
      void alertAt(40 + running.length, nowMs() + TRAIN_MS, "Training finished", `${p.name} finished training.`);
      setResult({ name: p.name, gain: row.gain });
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
  function clock(ms: number) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  const kit = kitOf(ctx.clubId)[0];
  const TYPES: { pos: Position; title: string; tone: string }[] = [
    { pos: "GK", title: "Goalkeeper", tone: "gk" },
    { pos: "DF", title: "Defender", tone: "df" },
    { pos: "MF", title: "Midfielder", tone: "mf" },
    { pos: "FW", title: "Forward", tone: "fw" },
  ];
  const posIcon = (k: Position) =>
    k === "GK" ? <path d="M8 21v-7l-2-4 2-1 1 2V5l2 0v6l1-7 2 0v7l1-5 2 1-1 7 2 4v8z" fill="currentColor" /> :
    k === "DF" ? <path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="currentColor" /> :
    k === "MF" ? <g fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 5h-5L8 10z" /></g> :
    <g fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 1v5M12 18v5M1 12h5M18 12h5" /></g>;
  /** the cards of the session: four slots, each with the player's picture, rating and countdown */
  const slotRows = Array.from({ length: SLOTS }).map((_, i) => {
    const run = running[i];
    const p = run ? byId.get(run.player_id) : undefined;
    const end = run ? finishesAt(run) : null;
    const gain = run ? Number(run.gain) : 0;
    const share = end && now ? Math.min(1, Math.max(0, 1 - (end - now) / TRAIN_MS)) : 0;
    return { p, run: !!run, end, gain, share };
  });
  const chips: [Filter, string][] = [["ALL", "All ages"], ["YOUNG", "Young (23 and under)"]];

  return (
    <main className="tc dxp">
      <DxBar title="Training" onBack={() => router.push("/game/dashboard")} season={ctx.season ? seasonLabel(ctx.season) : undefined} />

      <div className="tc-wrap">
        <header className="tc-title">
          <h1><svg width="46" height="46" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> Player training</h1>
          <p>Choose a position, then tap a player: his own countdown starts at once. Train at least one player in every position. Young players build rating much faster than veterans.</p>
          <small>Coach level {level}: training works {Math.round((boost - 1) * 100)}% better. A session takes {TRAIN_HOURS} hours.</small>
        </header>

        <div className="tc-types" role="tablist" aria-label="Training type">
          {TYPES.map((t) => {
            const n = squad.filter((p) => p.position === t.pos).length;
            return (
              <button key={t.pos} type="button" role="tab" aria-selected={pos === t.pos} className={`tc-type is-${t.tone} ${pos === t.pos ? "is-on" : ""}`} onClick={() => setPos(t.pos)} style={{ "--kit": kit } as CSSProperties}>
                <span className="tc-badge"><svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">{posIcon(t.pos)}</svg></span>
                <svg className="tc-shirt" viewBox="0 0 100 100" aria-hidden="true"><path d="M30 12l14 6c3 4 9 4 12 0l14-6 20 14-9 16-11-6v50H30V36l-11 6-9-16z" fill="var(--kit)" stroke="rgba(255,255,255,.55)" strokeWidth="2.5" strokeLinejoin="round" /><path d="M44 18c3 6 9 6 12 0" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="3" /></svg>
                <strong>{t.title}</strong>
                <span className="tc-hours"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 9v4l3 2M9 2h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg> Select · {TRAIN_HOURS}h <em>{n} players</em></span>
              </button>
            );
          })}
        </div>

        {problem && <p className="tc-problem" role="alert">{problem}</p>}
        {result && (
          <p className="tc-result" role="status">
            {result.name} started training: +{result.gain.toFixed(2)}. It finishes in {TRAIN_HOURS} hours and we will notify you. When his green bar is full, his rating goes up by one.
          </p>
        )}

        <section className="tc-session" aria-label="Current session">
          {slotRows.map((r, i) => (
            <div key={i} className={`tc-slot ${r.p ? "is-full" : ""} ${r.run ? "is-run" : ""}`}>
              {r.p ? (
                <>
                  <div className="tc-photo">
                    <span className="tc-sil" aria-hidden="true" />
                    <PlayerFace player={r.p} />
                    <b>{r.p.rating}</b>
                    <i>{r.p.position}</i>
                  </div>
                  <strong>{r.p.name}</strong>
                  <small>{r.p.age} yrs · +{r.gain.toFixed(2)} per session</small>
                  <span className="tc-count" role="timer" aria-label="Time until the training ends">
                    {r.end ? clock(r.end - now) : clock(TRAIN_MS)}
                    <em>until he improves</em>
                  </span>
                  <span className="tc-meter"><i style={{ width: `${r.share * 100}%` }} /></span>
                </>
              ) : (
                <span className="tc-free">Free place</span>
              )}
            </div>
          ))}
        </section>

        <section className="tc-pick" aria-label={`Choose ${pos} players`}>
          <div className="tc-filters" role="group" aria-label="Filter by age">
            {chips.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
          <ul className="tc-grid">
            {rows.map((p, i) => {
              const trained = trainingIds.has(p.id);
              const spent = seasonGain[p.id] ?? 0;
              const capNow = cap(p.age);
              const prog = progressOf(finished[p.id] ?? 0);
              const wait = Math.min(1 - prog, pendingGain[p.id] ?? 0);
              const atCap = spent >= capNow - 0.005;
              const ph = phase(p.age);
              return (
                <li key={p.id} style={{ animationDelay: `${Math.min(i, 20) * 18}ms` }}>
                  <button type="button" className={`tc-card ph-${ph} ${trained ? "is-trained is-on" : ""}`} onClick={() => void train(p)} aria-pressed={trained} disabled={busy || trained || day === null}>
                    <b>{p.rating}</b>
                    <strong>{p.name}</strong>
                    <small>{trained ? "Training now" : `${p.age} yrs`} · {ph === "rising" ? "Rising" : ph === "prime" ? "Prime" : "Declining"}</small>
                    <span className="tc-gain">+{(sessionGain(p.age) * boost).toFixed(2)} / session</span>
                    <span className="tc-prog" role="img" aria-label={`${Math.round(prog * 100)} percent of the way to rating ${p.rating + 1}`}>
                      <em className="is-done" style={{ width: `${prog * 100}%` }} />
                      {wait > 0 && <em className="is-wait" style={{ width: `${wait * 100}%` }} />}
                    </span>
                    <span className="tc-next">{atCap ? "Season limit reached" : wait > 0 ? `${Math.round(prog * 100)}% → ${Math.round((prog + wait) * 100)}% to ${p.rating + 1}` : `${Math.round(prog * 100)}% to ${p.rating + 1}`}</span>
                  </button>
                </li>
              );
            })}
            {rows.length === 0 && <li className="tc-none">No players here{filter === "YOUNG" ? " aged 23 or under" : ""}.</li>}
          </ul>
        </section>

      </div>
    </main>
  );
}
