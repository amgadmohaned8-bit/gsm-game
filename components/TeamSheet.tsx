"use client";

import { useMemo, useState } from "react";
import { absenceOn } from "@/lib/football/availability";
import { bestEleven, formations, type FormationName, type Player } from "@/lib/football/squads";
import { currentLineup, bonusFor, type DayCtx } from "@/lib/football/strength";
import { TIRED_BELOW } from "@/lib/football/fitness";
import "./teamsheet.css";

const GROUPS = ["GK", "DF", "MF", "FW"] as const;
const NAMES = { GK: "Goalkeeper", DF: "Defence", MF: "Midfield", FW: "Attack" } as const;

export default function TeamSheet({
  userId,
  clubId,
  squad,
  day,
  opponent,
  fitness,
  onConfirm,
  onCancel,
}: {
  userId: string;
  clubId: string;
  squad: Player[];
  day: DayCtx;
  opponent: string;
  fitness?: Record<string, number>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const initial = useMemo(() => currentLineup(userId, clubId, squad, day), [userId, clubId, squad, day]);
  const [formation, setFormation] = useState<FormationName>(initial.formation);
  const [ids, setIds] = useState<string[]>(initial.starters.map((p) => p.id));

  const byId = useMemo(() => new Map(squad.map((p) => [p.id, p])), [squad]);
  const out = useMemo(
    () => squad.map((p) => ({ p, a: absenceOn(day.key, day.season, p.id, day.matchday) })).filter((x) => x.a),
    [squad, day]
  );
  const outIds = new Set(out.map((x) => x.p.id));
  const pool = squad.filter((p) => !outIds.has(p.id));
  const starters = ids.map((id) => byId.get(id)).filter(Boolean) as Player[];
  const shape = { GK: 1, ...formations[formation] };
  const rating = starters.length ? Math.round(starters.reduce((s, p) => s + p.rating, 0) / starters.length) : 0;
  const effect = bonusFor(starters, clubId, fitness, formation);
  const fit = (id: string) => fitness?.[id] ?? 100;
  const tiredCount = starters.filter((p) => fit(p.id) < TIRED_BELOW).length;

  function pickFormation(f: FormationName) {
    setFormation(f);
    setIds(bestEleven(pool.length >= 14 ? pool : squad, f).map((p) => p.id));
  }

  /** swap each tired starter for a fresher player of the same position who is almost as good */
  function rest() {
    const used = new Set(ids);
    setIds(
      ids.map((id) => {
        const p = byId.get(id)!;
        if (fit(id) >= TIRED_BELOW) return id;
        const sub = pool
          .filter((x) => x.position === p.position && !used.has(x.id) && fit(x.id) >= 85 && x.rating >= p.rating - 5)
          .sort((a, b) => b.rating - a.rating)[0];
        if (!sub) return id;
        used.add(sub.id);
        return sub.id;
      })
    );
  }

  function swap(slot: string, next: string) {
    setIds((cur) => cur.map((id) => (id === slot ? next : id)));
  }

  function confirm() {
    try {
      localStorage.setItem(`gsm-lineup:${userId}:${clubId}`, JSON.stringify({ formation, starters: ids }));
    } catch {
      /* the match still starts with the best eleven */
    }
    onConfirm();
  }

  return (
    <div className="ts" role="dialog" aria-modal="true" aria-label="Team sheet">
      <div className="ts-card gx-cut">
        <header>
          <div>
            <span>Matchday {day.matchday}</span>
            <h2>Team sheet vs {opponent}</h2>
          </div>
          <button type="button" className="ts-x" onClick={onCancel} aria-label="Close">×</button>
        </header>

        <div className="ts-formations" role="group" aria-label="Formation">
          {(Object.keys(formations) as FormationName[]).map((f) => (
            <button key={f} type="button" aria-pressed={formation === f} onClick={() => pickFormation(f)}>{f}</button>
          ))}
        </div>

        <div className="ts-body">
          <div className="ts-pitch">
            {GROUPS.slice().reverse().map((g) => {
              const line = starters.filter((p) => p.position === g);
              return (
                <div key={g} className="ts-line" data-count={shape[g]}>
                  {line.map((p) => (
                    <label key={p.id} className="ts-slot">
                      <b>{p.rating}</b>
                      <span className={`ts-fit ${fit(p.id) < TIRED_BELOW ? "is-low" : fit(p.id) < 85 ? "is-mid" : ""}`} title="Fitness"><i style={{ width: `${fit(p.id)}%` }} /></span>
                      <select value={p.id} onChange={(e) => swap(p.id, e.target.value)} aria-label={`${NAMES[g]} slot`}>
                        {pool
                          .filter((x) => x.position === g && (x.id === p.id || !ids.includes(x.id)))
                          .sort((a, b) => b.rating - a.rating)
                          .map((x) => (
                            <option key={x.id} value={x.id}>{x.name} ({x.rating}) · {fit(x.id)}%</option>
                          ))}
                      </select>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>

          <aside className="ts-side">
            <div className="ts-stat">
              <span>Eleven rating</span>
              <strong>{rating}</strong>
              <em className={effect >= 0 ? "is-up" : "is-down"}>{effect >= 0 ? "+" : ""}{effect} vs your usual side</em>
            </div>
            <h3>Unavailable</h3>
            {out.length === 0 ? (
              <p className="ts-none">Everyone is fit. No bans.</p>
            ) : (
              <ul>
                {out.map(({ p, a }) => (
                  <li key={p.id} className={a!.kind}>
                    <strong>{p.name}</strong>
                    <small>{a!.kind === "ban" ? "Suspended" : a!.label} · back matchday {a!.to + 1}</small>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>

        <footer>
          <button type="button" className="ts-ghost" onClick={() => pickFormation(formation)}>Pick best eleven</button>
          {tiredCount > 0 && <button type="button" className="ts-ghost" onClick={rest}>Rest {tiredCount} tired {tiredCount === 1 ? "player" : "players"}</button>}
          <button type="button" className="gx-btn" onClick={confirm}>Confirm and kick off</button>
        </footer>
      </div>
    </div>
  );
}
