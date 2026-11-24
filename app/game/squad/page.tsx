"use client";

import { pushPref } from "@/lib/prefsSync";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import {
  bestEleven,
  formations,
  teamRating,
  type FormationName,
  type Player,
  type Position,
} from "@/lib/football/squads";
import { bonusFor, slotPositions } from "@/lib/football/strength";
import { useTransfers } from "@/lib/football/useTransfers";
import PlayerFace from "@/components/PlayerFace";
import { photoOf } from "@/lib/football/playerPhotos";
import GsmMark from "@/components/GsmMark";
import GameMenu from "@/components/GameMenu";
import Icon from "@/components/Icon";
import "./squad.css";
import "./lineup.css";

type Filter = "ALL" | Position;

const ORDER: Position[] = ["GK", "DF", "MF", "FW"];
const formationNames = Object.keys(formations) as FormationName[];

function tone(rating: number) {
  return rating >= 85 ? "elite" : rating >= 78 ? "high" : rating >= 70 ? "mid" : "low";
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
  const [showAll, setShowAll] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [note, setNote] = useState("");

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


  function save(name: FormationName, ids: string[]) {
    setFormation(name);
    setStarters(ids);
    try {
      localStorage.setItem(`gsm-lineup:${userId}:${clubId}`, JSON.stringify({ formation: name, starters: ids, slots: true }));
      pushPref(`gsm-lineup:${userId}:${clubId}`);
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
  const effect = bonusFor(eleven, clubId, undefined, formation);
  // the chosen bench: the best of each position (one goalkeeper, two of every other line)
  const BENCH: Record<Position, number> = { GK: 1, DF: 2, MF: 2, FW: 2 };
  const chosen = ORDER.map((g) => ({ g, list: bench.filter((p) => p.position === g).slice(0, BENCH[g]) }));
  const everyone = filter === "ALL" ? bench : bench.filter((p) => p.position === filter);

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

  const roleName: Record<Position, string> = { GK: "Goalkeeper", DF: "Defender", MF: "Midfielder", FW: "Forward" };
  const groupName: Record<Position, string> = { GK: "Goalkeepers", DF: "Defenders", MF: "Midfielders", FW: "Forwards" };

  /** a substitute was tapped in the sheet: swap with the picked starter, or pick him and go back to the pitch */
  function tapSub(p: Player) {
    tapPlayer(p);
    setSubsOpen(false);
  }

  const card = (p: Player, opts: { slot?: Position; small?: boolean; onTap: () => void }) => {
    const off = opts.slot && p.position !== opts.slot;
    return (
      <button key={p.id} type="button"
        className={`lu-card t-${tone(p.rating)} ${opts.small ? "is-small" : ""} ${picked === p.id ? "is-picked" : ""} ${off ? "is-off" : ""}`}
        onClick={opts.onTap}
        aria-pressed={picked === p.id}
        aria-label={`${p.name}, ${p.position}${off ? ` playing as ${opts.slot}` : ""}, rating ${p.rating}`}>
        {photoOf(p) ? <PlayerFace player={p} /> : <s className="lu-ph" aria-hidden="true" />}
        <em className="lu-pos">{off ? `${p.position}>${opts.slot}` : p.position}</em>
        <b className="lu-rate">{p.rating}</b>
        <span className="lu-name">{p.name}</span>
      </button>
    );
  };

  return (
    <main className="lu">
      <div className="lu-bg" aria-hidden="true" />

      <header className="lu-top">
        <button type="button" className="lu-icon" onClick={() => router.push("/game/dashboard")} aria-label="Back to the dashboard">
          <Icon name="arrow-left" size={22} />
        </button>
        <div className="lu-title">
          <small>{club?.name}</small>
          <strong>Lineups</strong>
        </div>
        <dl className="lu-kpis">
          <div><dt>Rating</dt><dd>{rating}</dd></div>
          <div title="How much this eleven moves your club rating in matches"><dt>Effect</dt><dd className={effect >= 0 ? "is-up" : "is-down"}>{effect > 0 ? "+" : ""}{effect.toFixed(1)}</dd></div>
        </dl>
        <div className="lu-actions">
          <div className="lu-formwrap">
            <button type="button" className="lu-btn" aria-haspopup="listbox" aria-expanded={formsOpen} onClick={() => setFormsOpen((v) => !v)}>
              <Icon name="table" size={18} /><span>{formation}</span>
            </button>
            {formsOpen && (
              <div className="lu-forms" role="listbox" aria-label="Formation">
                {formationNames.map((f) => (
                  <button key={f} type="button" role="option" aria-selected={f === formation} className={f === formation ? "is-on" : ""}
                    onClick={() => { changeFormation(f); setFormsOpen(false); }}>
                    {f}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="lu-btn" onClick={() => router.push("/game/tactics")}>
            <Icon name="tactics" size={18} /><span>Tactics</span>
          </button>
          <button type="button" className="lu-btn is-gold" onClick={() => setSubsOpen(true)}>
            <Icon name="squad" size={18} /><span>Subs</span><b>{bench.length}</b>
          </button>
          <GameMenu />
        </div>
      </header>

      <section className="lu-pitch" aria-label="Starting eleven">
        <div className="lu-marks" aria-hidden="true"><i className="lu-box lu-box-t" /><i className="lu-circle" /><i className="lu-box lu-box-b" /></div>
        {lines.map((line) => (
          <div key={line.key} className="lu-line">
            {line.list.map(({ slot, p }) => p && card(p, { slot, onTap: () => tapPlayer(p) }))}
          </div>
        ))}
      </section>

      <p className="lu-hint" role="status">
        {note || (pickedPlayer
          ? `${pickedPlayer.name} picked. Tap a ${starters.includes(pickedPlayer.id) ? "starter to swap places, or open Subs to bring a substitute on" : "starter to bring him on"}.`
          : "Tap a player, then another, to change their places.")}
      </p>

      {subsOpen && (
        <div className="lu-veil" onClick={() => setSubsOpen(false)}>
          <section className="lu-sheet" role="dialog" aria-label="Substitutes" onClick={(e) => e.stopPropagation()}>
            <header>
              <strong>Substitutes</strong>
              <span>{pickedPlayer && starters.includes(pickedPlayer.id) ? `Pick who replaces ${pickedPlayer.name}` : "Pick a substitute, then the starter he replaces"}</span>
              <button type="button" className="lu-toggle" aria-pressed={showAll} onClick={() => setShowAll((v) => !v)}>{showAll ? "Chosen bench" : "All players"}</button>
              <button type="button" className="lu-icon" onClick={() => setSubsOpen(false)} aria-label="Close"><Icon name="close" size={20} /></button>
            </header>

            {!showAll ? (
              <div className="lu-bench">
                {chosen.map(({ g, list }) => (
                  <div key={g} className="lu-col">
                    <h3>{groupName[g]}</h3>
                    {list.map((p) => card(p, { small: true, onTap: () => tapSub(p) }))}
                    {Array.from({ length: BENCH[g] - list.length }, (_, k) => <div key={k} className="lu-empty">{roleName[g]}</div>)}
                  </div>
                ))}
              </div>
            ) : (
              <>
                <div className="lu-tabs" role="tablist" aria-label="Filter by position">
                  {(["ALL", "GK", "DF", "MF", "FW"] as Filter[]).map((f) => (
                    <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)}>{f === "ALL" ? "All" : f}</button>
                  ))}
                </div>
                <div className="lu-all">
                  {everyone.map((p) => card(p, { small: true, onTap: () => tapSub(p) }))}
                  {everyone.length === 0 && <p className="lu-none">No substitutes in this position.</p>}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
