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
import { activeSeason } from "@/lib/football/season";
import { loadTransferState } from "@/lib/football/transfers";
import { bonusFor } from "@/lib/football/strength";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "./squad.css";

type Filter = "ALL" | Position;

const groups: { key: Position; label: string }[] = [
  { key: "GK", label: "Goalkeepers" },
  { key: "DF", label: "Defenders" },
  { key: "MF", label: "Midfielders" },
  { key: "FW", label: "Forwards" },
];

const formationNames = Object.keys(formations) as FormationName[];

function tone(rating: number) {
  return rating >= 85 ? "elite" : rating >= 78 ? "high" : rating >= 70 ? "mid" : "low";
}

export default function SquadPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [clubId, setClubId] = useState("");
  const [userId, setUserId] = useState("");
  const [formation, setFormation] = useState<FormationName>("4-3-3");
  const [starters, setStarters] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [note, setNote] = useState("");

  const club = clubs.find((c) => c.id === clubId);
  const [players, setPlayers] = useState<Player[]>([]);
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.replace("/");

      const { data } = await supabase
        .from("manager_contracts")
        .select("selected_club, selected_league")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data?.selected_club) return router.replace("/game/leagues");
      if (cancelled) return;

      // the squad as it is now: the base players plus every signing and sale
      const state = await loadTransferState(supabase, user.id, data.selected_club, await activeSeason(supabase, user.id, data.selected_league || "premier-league"), null);
      const squad = state.squads[data.selected_club] ?? [];
      if (cancelled) return;
      let name: FormationName = "4-3-3";
      let ids = bestEleven(squad, name).map((p) => p.id);

      // the lineup this manager saved before (kept on this device)
      try {
        const saved = JSON.parse(localStorage.getItem(`gsm-lineup:${user.id}:${data.selected_club}`) ?? "null");
        if (saved && formationNames.includes(saved.formation)) {
          const valid = Array.isArray(saved.starters) && saved.starters.length === 11 &&
            saved.starters.every((id: string) => squad.some((p) => p.id === id));
          name = saved.formation;
          ids = valid ? saved.starters : bestEleven(squad, name).map((p) => p.id);
        }
      } catch {
        /* a fresh lineup is fine */
      }

      setUserId(user.id);
      setClubId(data.selected_club);
      setPlayers(squad);
      setFormation(name);
      setStarters(ids);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function save(name: FormationName, ids: string[]) {
    setFormation(name);
    setStarters(ids);
    try {
      localStorage.setItem(`gsm-lineup:${userId}:${clubId}`, JSON.stringify({ formation: name, starters: ids }));
    } catch {
      /* the lineup still works for this visit */
    }
  }

  function changeFormation(name: FormationName) {
    setPicked(null);
    setNote("");
    save(name, bestEleven(players, name).map((p) => p.id));
  }

  /** Tap a player, then tap another of the same position to swap them. */
  function tapPlayer(p: Player) {
    setNote("");
    if (!picked) return setPicked(p.id);
    if (picked === p.id) return setPicked(null);

    const first = byId.get(picked)!;
    if (first.position !== p.position) {
      setNote(`A ${first.position} can only swap with another ${first.position}.`);
      return setPicked(p.id);
    }

    const a = starters.includes(first.id);
    const b = starters.includes(p.id);
    if (a === b) {
      setNote(a ? "Both players already start." : "Pick one starter and one substitute.");
      return setPicked(p.id);
    }

    save(formation, starters.map((id) => (id === first.id ? p.id : id === p.id ? first.id : id)));
    setPicked(null);
  }

  const eleven = starters.map((id) => byId.get(id)!).filter(Boolean);
  const bench = players.filter((p) => !starters.includes(p.id));
  const rating = teamRating(eleven.length ? eleven : players, formation);
  const effect = bonusFor(eleven, clubId);
  const value = players.reduce((sum, p) => sum + marketValue(p), 0);
  const age = players.length ? players.reduce((s, p) => s + p.age, 0) / players.length : 0;

  const pickedPlayer = picked ? byId.get(picked) ?? null : null;
  // with a player picked, only the players he can swap with are listed
  const candidates = pickedPlayer
    ? players
        .filter((p) => p.position === pickedPlayer.position && starters.includes(p.id) !== starters.includes(pickedPlayer.id))
        .sort((a, b) => b.rating - a.rating)
    : [];
  const rows = (filter === "ALL" ? players : players.filter((p) => p.position === filter))
    .slice()
    .sort((a, b) => b.rating - a.rating);

  if (loading) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Loading your squad...</p>
      </main>
    );
  }

  const shape = { GK: 1, ...formations[formation] };
  const lines = (["FW", "MF", "DF", "GK"] as Position[]).map((g) => ({
    key: g,
    list: eleven.filter((p) => p.position === g).slice(0, shape[g]),
  }));

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

        <div className="sq-grid">
          <section className="sq-pitch-card gx-cut" aria-label="Starting eleven">
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
                  {line.list.map((p) => (
                    <button key={p.id} type="button"
                      className={`sq-dot t-${tone(p.rating)} ${picked === p.id ? "is-picked" : ""}`}
                      onClick={() => tapPlayer(p)}
                      aria-pressed={picked === p.id}
                      aria-label={`${p.name}, ${p.position}, rating ${p.rating}`}>
                      <b>{p.rating}</b>
                      <i>{p.position}</i>
                      <span>{p.name}</span>
                      <small>{p.number ? `#${p.number}` : ""}</small>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <p className="sq-hint" role="status">
              {note || (picked ? "Now pick a substitute of the same position." : "Tap a starter, then a substitute, to swap them.")}
            </p>
          </section>

          {pickedPlayer ? (
            <section className="sq-list sq-swap gx-cut" aria-label="Substitutes">
              <header className="sq-swap-head">
                <div>
                  <small>{starters.includes(pickedPlayer.id) ? "Taking off" : "Bringing on"}</small>
                  <strong>{pickedPlayer.name}</strong>
                  <em>{pickedPlayer.position} · {pickedPlayer.rating}</em>
                </div>
                <button type="button" onClick={() => setPicked(null)}>Cancel</button>
              </header>
              {candidates.length === 0 ? (
                <p className="sq-foot">No {pickedPlayer.position} player is available for this swap.</p>
              ) : (
                <ul className="sq-cards">
                  {candidates.map((p) => (
                    <li key={p.id}>
                      <button type="button" className={`sq-card t-${tone(p.rating)}`} onClick={() => tapPlayer(p)}>
                        <b>{p.rating}</b>
                        <i>{p.position}</i>
                        <strong>{p.name}</strong>
                        <small>{p.age} yrs{p.nationality ? ` · ${p.nationality}` : ""}</small>
                        <span className={p.rating >= pickedPlayer.rating ? "is-up" : "is-down"}>
                          {p.rating >= pickedPlayer.rating ? "+" : ""}{p.rating - pickedPlayer.rating}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
          <section className="sq-list gx-cut" aria-label="Whole squad">
            <div className="sq-tabs" role="tablist" aria-label="Filter by position">
              {(["ALL", "GK", "DF", "MF", "FW"] as Filter[]).map((f) => (
                <button key={f} type="button" role="tab" aria-selected={filter === f}
                  className={filter === f ? "is-on" : ""} onClick={() => setFilter(f)}>
                  {f === "ALL" ? "All" : f}
                </button>
              ))}
            </div>

            <ul>
              {rows.map((p) => {
                const starts = starters.includes(p.id);
                return (
                  <li key={p.id}>
                    <button type="button" className={`sq-row ${picked === p.id ? "is-picked" : ""}`}
                      onClick={() => tapPlayer(p)} aria-pressed={picked === p.id}>
                      <span className="sq-num">{p.number ?? "-"}</span>
                      <span className="sq-name">
                        <strong>{p.name}</strong>
                        <small>{groups.find((g) => g.key === p.position)?.label.replace(/s$/, "")}{p.nationality ? ` · ${p.nationality}` : ""} · {p.age}</small>
                      </span>
                      <span className={`sq-badge ${starts ? "is-start" : ""}`}>{starts ? "XI" : "Sub"}</span>
                      <span className="sq-val">{formatMoney(marketValue(p) * 1_000_000)}</span>
                      <b className={`sq-rate t-${tone(p.rating)}`}>{p.rating}</b>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="sq-foot">{bench.length} substitutes. Ratings and values are game estimates.</p>
          </section>
          )}
        </div>
      </div>
    </main>
  );
}
