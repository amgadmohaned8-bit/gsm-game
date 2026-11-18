"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import {
  OPTIONS,
  STYLES,
  aiStyle,
  coherence,
  defaultTactic,
  fitOf,
  matchup,
  readTactic,
  saveTactic,
  styleOf,
  tacticBonus,
  formationEdge,
  type StyleId,
  type Tactic,
} from "@/lib/football/tactics";
import { currentLineup } from "@/lib/football/strength";
import { useTransfers } from "@/lib/football/useTransfers";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "./tactics.css";

/** Arrows on the board for each style, drawn on a 100 x 140 pitch. */
const PLAYS: Record<StyleId, { zone?: [number, number]; paths: string[] }> = {
  balanced: { paths: ["M50 112 L50 84", "M30 84 L70 84", "M50 84 L50 50"] },
  possession: { paths: ["M32 84 L50 70 L68 84 L50 96 Z", "M50 70 L50 46", "M32 84 L26 60", "M68 84 L74 60"] },
  longball: { paths: ["M50 126 C50 90 52 60 50 26", "M26 108 C28 80 38 54 44 28", "M74 108 C72 80 62 54 56 28"] },
  counter: { zone: [84, 56], paths: ["M20 104 C20 70 28 50 38 24", "M80 104 C80 70 72 50 62 24", "M50 100 C50 70 50 50 50 28"] },
  wings: { paths: ["M10 104 L10 40 Q10 22 38 18", "M90 104 L90 40 Q90 22 62 18", "M24 96 L12 60"] },
  press: { zone: [8, 62], paths: ["M20 24 L36 46", "M80 24 L64 46", "M50 22 L50 44", "M30 60 L40 50", "M70 60 L60 50"] },
  bus: { zone: [78, 56], paths: ["M20 98 L80 98", "M24 112 L76 112", "M50 98 L50 126"] },
};

const LABELS = {
  tempo: ["Slow build-up", "Steady", "Fast tempo"],
  width: ["Narrow", "Normal", "Wide"],
  press: ["Stand off", "Mid-block", "Press high"],
  line: ["Deep line", "Normal line", "High line"],
} as const;

const label = (k: keyof typeof LABELS, v: number) => LABELS[k][v < 34 ? 0 : v < 67 ? 1 : 2];

export default function TacticsPage() {
  const router = useRouter();
  const { ctx, loading, error } = useTransfers();
  const [tactic, setTactic] = useState<Tactic>(defaultTactic());
  const [saved, setSaved] = useState<Tactic | null>(null);
  const [opponent, setOpponent] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const uid = ctx?.userId;
  const clubId = ctx?.clubId;
  useEffect(() => {
    if (!uid || !clubId) return;
    const t = readTactic(uid, clubId);
    setSaved(t);
    if (t) setTactic(t);
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
        if (next) setOpponent(next.home_club === clubId ? next.away_club : next.home_club);
      } catch {
        /* scouting is optional */
      }
    })();
  }, [uid, clubId]);

  const squad = ctx?.state.squads[ctx.clubId] ?? [];
  const day = ctx && ctx.matchday !== null ? { key: ctx.userId, season: ctx.season, matchday: ctx.matchday } : undefined;
  const lineup = useMemo(() => (ctx ? currentLineup(ctx.userId, ctx.clubId, squad, day) : null), [ctx, squad, day]);
  const eleven = useMemo(() => lineup?.starters ?? [], [lineup]);
  const formation = lineup?.formation;

  if (loading || !ctx) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>{error || "Loading the tactics board..."}</p>
      </main>
    );
  }

  const def = styleOf(tactic.style);
  const fit = fitOf(tactic.style, eleven);
  const coh = coherence(tactic);
  const bonus = tacticBonus(tactic, eleven, formation);
  const shape = formation ? formationEdge(tactic.style, formation) : 0;
  const theirStyle = opponent ? aiStyle(opponent) : null;
  const edge = theirStyle ? matchup(tactic.style, theirStyle) : 0;
  const oppClub = clubs.find((c) => c.id === opponent);
  const dirty = JSON.stringify(saved ?? defaultTactic()) !== JSON.stringify(tactic);

  function pickStyle(id: StyleId) {
    const ideal = styleOf(id).ideal;
    setTactic((t) => ({ ...t, style: id, ...ideal, opts: {} }));
  }
  const slide = (k: "tempo" | "width" | "press" | "line", v: number) => setTactic((t) => ({ ...t, [k]: v }));
  const toggle = (id: (typeof OPTIONS)[number]["id"]) => setTactic((t) => ({ ...t, opts: { ...t.opts, [id]: !t.opts[id] } }));

  function save() {
    saveTactic(ctx!.userId, ctx!.clubId, tactic);
    setSaved(tactic);
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  }

  // dots on the board from today's eleven
  const dots = (["GK", "DF", "MF", "FW"] as const).flatMap((g) => {
    const list = eleven.filter((p) => p.position === g);
    const y = { GK: 128, DF: 104, MF: 76, FW: 40 }[g];
    // a wide setup spreads the line, a narrow one squeezes it
    const spread = 34 + (tactic.width / 100) * 40;
    const lift = ((tactic.line - 50) / 50) * -8;
    return list.map((p, i) => ({
      id: p.id,
      name: p.name.split(" ").slice(-1)[0],
      x: list.length === 1 ? 50 : 50 - spread / 2 + (spread / (list.length - 1)) * i,
      y: g === "GK" ? y : y + lift,
    }));
  });
  const play = PLAYS[tactic.style];

  return (
    <main className="tc">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="tc-bg gx-kb" aria-hidden="true" />
      <div className="tc-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/squad")} />

      <div className="tc-wrap">
        <header className="tc-head">
          <p>Tactics room</p>
          <h1><span className="gx-slant">Tactics</span></h1>
        </header>

        <div className="tc-grid">
          <nav className="tc-styles" aria-label="Playing style">
            {STYLES.map((s, i) => {
              const f = fitOf(s.id, eleven).score;
              return (
                <button key={s.id} type="button" className={`tc-style gx-cut ${tactic.style === s.id ? "is-on" : ""}`} style={{ animationDelay: `${i * 45}ms` }} onClick={() => pickStyle(s.id)} aria-pressed={tactic.style === s.id}>
                  <strong>{s.name}</strong>
                  <small>{s.tag}</small>
                  <span className="tc-fitbar" aria-label={`Suits your players ${f} of 100`}><em style={{ width: `${f}%` }} /></span>
                  <b>{f}</b>
                </button>
              );
            })}
          </nav>

          <section className="tc-board-card gx-cut" aria-label="Tactical board">
            <div className="tc-title">
              <div>
                <h2>{def.name}</h2>
                <p>{def.desc}</p>
              </div>
              <span className="tc-needs">Needs: {def.needs}</span>
            </div>

            <svg className="tc-board" viewBox="0 0 100 140" role="img" aria-label={`${def.name} on the pitch`} key={tactic.style}>
              <defs>
                <marker id="tc-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10z" fill="#f4d58a" />
                </marker>
              </defs>
              <rect x="1" y="1" width="98" height="138" className="tc-line" />
              <path d="M1 70H99" className="tc-line" />
              <circle cx="50" cy="70" r="11" className="tc-line" />
              <rect x="26" y="1" width="48" height="18" className="tc-line" />
              <rect x="26" y="121" width="48" height="18" className="tc-line" />
              {play.zone && <rect x="1" y={play.zone[0]} width="98" height={play.zone[1]} className="tc-zone" />}
              {play.paths.map((d, i) => (
                <path key={i} d={d} className="tc-arrow" markerEnd="url(#tc-head)" style={{ animationDelay: `${i * 0.25}s` }} />
              ))}
              {dots.map((d) => (
                <g key={d.id} className="tc-dot" style={{ transform: `translate(${d.x}px, ${d.y}px)` }}>
                  <circle r="4.2" />
                  <text y="8.6" textAnchor="middle">{d.name}</text>
                </g>
              ))}
            </svg>
          </section>

          <aside className="tc-side">
            <section className="tc-card gx-cut" aria-label="Match effect">
              <div className="tc-effect">
                <span>Match effect</span>
                <strong className={bonus >= 0 ? "is-up" : "is-down"}>{bonus > 0 ? "+" : ""}{bonus.toFixed(1)}</strong>
                <em>rating points from tactics</em>
                {formation && <small className="tx-shape">{formation}: {shape > 0 ? `suits ${def.name.toLowerCase()} (+${shape})` : shape < 0 ? `works against ${def.name.toLowerCase()} (${shape})` : "a neutral shape for this style"}</small>}
              </div>
              <dl className="tc-meters">
                <div><dt>Suits your players</dt><dd><span><i style={{ width: `${fit.score}%` }} /></span>{fit.score}</dd></div>
                <div><dt>Plan is coherent</dt><dd><span><i style={{ width: `${coh}%` }} /></span>{coh}</dd></div>
              </dl>
              <ul className="tc-parts">
                {fit.parts.map((p) => <li key={p.label}>{p.label} <b>{p.value}</b></li>)}
              </ul>
            </section>

            {oppClub && theirStyle && (
              <section className="tc-card gx-cut tc-scout" aria-label="Next opponent">
                <header>
                  <img src={oppClub.logo} alt="" />
                  <div><small>Next opponent</small><strong>{oppClub.name}</strong><em>Plays {styleOf(theirStyle).name.toLowerCase()}</em></div>
                </header>
                <p className={edge > 0 ? "is-up" : edge < 0 ? "is-down" : ""}>
                  {edge > 0 ? `Your ${def.name.toLowerCase()} beats their ${styleOf(theirStyle).name.toLowerCase()} (+${edge})` : edge < 0 ? `Their ${styleOf(theirStyle).name.toLowerCase()} is strong against your ${def.name.toLowerCase()} (${edge})` : "An even match-up on style."}
                </p>
              </section>
            )}

            <section className="tc-card gx-cut" aria-label="Sliders">
              {(["tempo", "width", "press", "line"] as const).map((k) => (
                <label key={k} className="tc-slider">
                  <span>{{ tempo: "Tempo", width: "Width", press: "Pressing", line: "Defensive line" }[k]}<b>{label(k, tactic[k])}</b></span>
                  <input type="range" min={0} max={100} value={tactic[k]} onChange={(e) => slide(k, Number(e.target.value))} />
                  <i style={{ left: `${def.ideal[k]}%` }} aria-hidden="true" title="What this style wants" />
                </label>
              ))}
            </section>

            <section className="tc-card gx-cut" aria-label="Team instructions">
              <h3>Team instructions</h3>
              <ul className="tc-opts">
                {OPTIONS.map((o) => {
                  const on = !!tactic.opts[o.id];
                  const fits = def.synergy.includes(o.id);
                  return (
                    <li key={o.id}>
                      <button type="button" role="switch" aria-checked={on} className={on ? "is-on" : ""} onClick={() => toggle(o.id)}>
                        <span><strong>{o.name}</strong><small>{o.note}</small></span>
                        <em>{fits ? "Fits" : ""}</em>
                        <i aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <button type="button" className="gx-btn tc-save" onClick={save} disabled={!dirty && !flash}>
              {flash ? "Tactics saved" : dirty ? "Save tactics" : "Saved"}
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}
