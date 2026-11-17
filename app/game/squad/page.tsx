"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import {
  bestEleven,
  formations,
  marketValue,
  teamRating,
  type FormationName,
  type Player,
  type Position,
} from "@/lib/football/squads";
import { formatMoney } from "@/lib/football/finance";
import { bonusFor, slotPositions } from "@/lib/football/strength";
import { loadFitness, TIRED_BELOW } from "@/lib/football/fitness";
import { useTransfers } from "@/lib/football/useTransfers";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "./squad.css";

type Filter = "ALL" | Position;

const ORDER: Position[] = ["GK", "DF", "MF", "FW"];
const formationNames = Object.keys(formations) as FormationName[];

function tone(rating: number) {
  return rating >= 85 ? "elite" : rating >= 78 ? "high" : rating >= 70 ? "mid" : "low";
}

/** the tiredness bar: green when fresh, amber when he needs a rest, red when he is worn out */
function Fit({ value }: { value: number }) {
  const cls = value < TIRED_BELOW ? "is-low" : value < 85 ? "is-mid" : "";
  return (
    <span className={`sq-fit ${cls}`} role="img" aria-label={`Fitness ${value} percent`} title={`Fitness ${value}%`}>
      <i style={{ width: `${value}%` }} />
      <small>{value}%</small>
    </span>
  );
}

export default function SquadPage() {
  const router = useRouter();
  const { ctx, loading } = useTransfers();
  const [formation, setFormation] = useState<FormationName>("4-3-3");
  /** the eleven in slot order: goalkeeper, then the defenders, midfielders and forwards of the formation */
  const [starters, setStarters] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [subsOpen, setSubsOpen] = useState(false);
  const [note, setNote] = useState("");
  const [fitness, setFitness] = useState<Record<string, number>>({});

  const clubId = ctx?.clubId ?? "";
  const userId = ctx?.userId ?? "";
  const club = clubs.find((c) => c.id === clubId);
  const players = useMemo(() => (ctx ? (ctx.state.squads[ctx.clubId] ?? []) : []), [ctx]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // the lineup this manager saved before (kept on this device)
  useEffect(() => {
    if (!ctx || ready) return;
    let name: FormationName = "4-3-3";
    let ids = bestEleven(players, name).map((p) => p.id);
    try {
      const saved = JSON.parse(localStorage.getItem(`gsm-lineup:${ctx.userId}:${ctx.clubId}`) ?? "null");
      if (saved && formationNames.includes(saved.formation) && Array.isArray(saved.starters) && saved.starters.length === 11 && saved.starters.every((id: string) => byId.has(id))) {
        name = saved.formation;
        // an older save has no slot order: line it up by position
        ids = saved.slots ? saved.starters : ORDER.flatMap((g) => (saved.starters as string[]).filter((id) => byId.get(id)?.position === g));
      } else if (saved && formationNames.includes(saved.formation)) {
        name = saved.formation;
        ids = bestEleven(players, name).map((p) => p.id);
      }
    } catch {
      /* a fresh lineup is fine */
    }
    setFormation(name);
    setStarters(ids);
    setReady(true);
  }, [ctx, ready, players, byId]);

  // how tired everybody is today, from the matches and training they played
  useEffect(() => {
    if (!ctx) return;
    let cancelled = false;
    loadFitness(supabase, ctx.userId, ctx.season, ctx.matchday ?? 39, ctx.state.training, players).then((f) => { if (!cancelled) setFitness(f); });
    return () => { cancelled = true; };
  }, [ctx, players]);
  const fit = (id: string) => fitness[id] ?? 100;

  function save(name: FormationName, ids: string[]) {
    setFormation(name);
    setStarters(ids);
    try {
      localStorage.setItem(`gsm-lineup:${userId}:${clubId}`, JSON.stringify({ formation: name, starters: ids, slots: true }));
    } catch {
      /* the lineup still works for this visit */
    }
  }

  function changeFormation(name: FormationName) {
    setPicked(null);
    setNote("");
    save(name, bestEleven(players, name).map((p) => p.id));
  }

  /** Tap a player, then tap another: they change places. Starters swap slots, a substitute takes a starter's slot. */
  function tapPlayer(p: Player) {
    setNote("");
    if (!picked) return setPicked(p.id);
    if (picked === p.id) return setPicked(null);

    const a = starters.includes(picked);
    const b = starters.includes(p.id);
    if (!a && !b) return setPicked(p.id); // two substitutes: nothing to swap

    const next = starters.map((id) => (id === picked ? p.id : id === p.id ? picked : id));
    save(formation, next);
    setPicked(null);
    const slots = slotPositions(formation);
    const off = next.map((id, i) => ({ pl: byId.get(id), slot: slots[i] })).filter((x) => x.pl && x.pl.position !== x.slot && (x.pl.id === p.id || x.pl.id === picked));
    if (off.length) setNote(off.map((x) => `${x.pl!.name} is a ${x.pl!.position} playing as ${x.slot}: his rating counts for less there.`).join(" "));
  }

  const eleven = starters.map((id) => byId.get(id)!).filter(Boolean);
  const bench = players.filter((p) => !starters.includes(p.id)).sort((a, b) => b.rating - a.rating);
  const rating = teamRating(eleven.length ? eleven : players, formation);
  const effect = bonusFor(eleven, clubId, fitness, formation);
  const value = players.reduce((sum, p) => sum + marketValue(p), 0);
  const age = players.length ? players.reduce((s, p) => s + p.age, 0) / players.length : 0;
  const subs = (filter === "ALL" ? bench : bench.filter((p) => p.position === filter));

  if (loading || !ctx || !ready) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Loading your squad...</p>
      </main>
    );
  }

  const slots = slotPositions(formation);
  // the pitch from the forwards down to the goalkeeper; each line is a run of slots
  const shape = { GK: 1, ...formations[formation] };
  let at = 0;
  const lines = ORDER.map((g) => {
    const list = Array.from({ length: shape[g] }, (_, k) => ({ slot: g, idx: at + k, p: byId.get(starters[at + k]) }));
    at += shape[g];
    return { key: g, list };
  }).reverse();
  const pickedPlayer = picked ? byId.get(picked) ?? null : null;
  const tiredStarters = eleven.filter((p) => fit(p.id) < TIRED_BELOW).length;

  return (
    <main className="sq">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="sq-bg gx-kb" aria-hidden="true" />
      <div className="sq-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="sq-wrap">
        <header className="sq-head">
          <div>
            <p>{club?.name}</p>
            <h1><span className="gx-slant">Squad</span></h1>
          </div>
          <dl className="sq-kpis">
            <div><dt>Team rating</dt><dd>{rating}</dd></div>
            <div title="How much this eleven moves your club rating in matches"><dt>Match effect</dt><dd>{effect > 0 ? "+" : ""}{effect.toFixed(1)}</dd></div>
            <div><dt>Players</dt><dd>{players.length}</dd></div>
            <div><dt>Average age</dt><dd>{age.toFixed(1)}</dd></div>
            <div><dt>Squad value</dt><dd>{formatMoney(value * 1_000_000)}</dd></div>
          </dl>
        </header>

        <section className="sq-pitch-card sq-one gx-cut" aria-label="Starting eleven">
          <div className="sq-forms" role="radiogroup" aria-label="Formation">
            {formationNames.map((f) => (
              <button key={f} type="button" role="radio" aria-checked={f === formation}
                className={f === formation ? "is-on" : ""} onClick={() => changeFormation(f)}>
                {f}
              </button>
            ))}
          </div>

          <div className="sq-pitch">
            {lines.map((line) => (
              <div key={line.key} className="sq-line">
                {line.list.map(({ slot, idx, p }) => p && (
                  <button key={p.id} type="button"
                    className={`sq-dot t-${tone(p.rating)} ${picked === p.id ? "is-picked" : ""} ${p.position !== slots[idx] ? "is-off" : ""}`}
                    onClick={() => tapPlayer(p)}
                    aria-pressed={picked === p.id}
                    aria-label={`${p.name}, ${p.position}${p.position !== slot ? ` playing as ${slot}` : ""}, rating ${p.rating}, fitness ${fit(p.id)} percent`}>
                    <b>{p.rating}</b>
                    <i>{p.position !== slot ? `${p.position}>${slot}` : p.position}</i>
                    <span>{p.name}</span>
                    <Fit value={fit(p.id)} />
                  </button>
                ))}
              </div>
            ))}
          </div>

          <p className="sq-hint" role="status">
            {note || (pickedPlayer
              ? `${pickedPlayer.name} picked. Tap a ${starters.includes(pickedPlayer.id) ? "starter to swap places, or a substitute to bring him on" : "starter to bring him on"}.`
              : tiredStarters > 0 ? `${tiredStarters} of your starters ${tiredStarters === 1 ? "is" : "are"} tired. Tap a starter, then a substitute, to rest him.` : "Tap a player, then another, to change their places.")}
          </p>

          <button type="button" className={`sq-subs-toggle ${subsOpen ? "is-open" : ""}`} aria-expanded={subsOpen} onClick={() => setSubsOpen((v) => !v)}>
            <strong>Subs</strong>
            <span>{bench.length} players</span>
            <i aria-hidden="true" />
          </button>

          {subsOpen && (
            <div className="sq-subs">
              <div className="sq-tabs" role="tablist" aria-label="Filter by position">
                {(["ALL", "GK", "DF", "MF", "FW"] as Filter[]).map((f) => (
                  <button key={f} type="button" role="tab" aria-selected={filter === f}
                    className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)}>
                    {f === "ALL" ? "All" : f}
                  </button>
                ))}
              </div>
              <ul className="sq-benchgrid">
                {subs.map((p) => (
                  <li key={p.id}>
                    <button type="button" className={`sq-card t-${tone(p.rating)} ${picked === p.id ? "is-picked" : ""}`} onClick={() => tapPlayer(p)} aria-pressed={picked === p.id}>
                      <b>{p.rating}</b>
                      <i>{p.position}</i>
                      <strong>{p.name}</strong>
                      <small>{p.age} yrs{p.nationality ? ` · ${p.nationality}` : ""}</small>
                      <Fit value={fit(p.id)} />
                      <em className={fit(p.id) < TIRED_BELOW ? "is-low" : fit(p.id) < 85 ? "is-mid" : ""}>{fit(p.id) >= 85 ? "Fresh" : fit(p.id) < TIRED_BELOW ? "Tired" : "A bit tired"} · {fit(p.id)}%</em>
                    </button>
                  </li>
                ))}
                {subs.length === 0 && <li className="sq-foot">No substitutes in this position.</li>}
              </ul>
            </div>
          )}
          <p className="sq-foot">Ratings and values are game estimates. A tired player plays below his rating.</p>
        </section>
      </div>
    </main>
  );
}
