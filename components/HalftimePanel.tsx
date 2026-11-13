"use client";

import { useMemo, useState } from "react";
import { MAX_SUBS, type Style } from "@/lib/football/halftime";
import { bonusFor } from "@/lib/football/strength";
import type { Player } from "@/lib/football/squads";
import "./teamsheet.css";

export type HalftimeChange = { starters: Player[]; style: Style; subs: number };

const GROUPS = ["FW", "MF", "DF", "GK"] as const;
const STYLES: { id: Style; label: string; note: string }[] = [
  { id: "attack", label: "All out attack", note: "More goals at both ends" },
  { id: "balanced", label: "Keep shape", note: "No big risks" },
  { id: "defend", label: "Shut up shop", note: "Fewer goals at both ends" },
];

export default function HalftimePanel({
  clubId,
  starters,
  bench,
  score,
  onApply,
  onSkip,
}: {
  clubId: string;
  starters: Player[];
  /** players who can come on: fit, not in the eleven */
  bench: Player[];
  score: string;
  onApply: (c: HalftimeChange) => void;
  onSkip: () => void;
}) {
  const [ids, setIds] = useState(starters.map((p) => p.id));
  const [style, setStyle] = useState<Style>("balanced");
  const [note, setNote] = useState("");
  const all = useMemo(() => new Map([...starters, ...bench].map((p) => [p.id, p])), [starters, bench]);
  const start = new Set(starters.map((p) => p.id));
  const subs = ids.filter((id) => !start.has(id)).length;
  const now = ids.map((id) => all.get(id)!).filter(Boolean);
  const effect = bonusFor(now, clubId) - bonusFor(starters, clubId);

  function swap(slot: string, next: string) {
    const nextIds = ids.map((id) => (id === slot ? next : id));
    const used = nextIds.filter((id) => !start.has(id)).length;
    if (used > MAX_SUBS) return setNote(`Only ${MAX_SUBS} substitutes are allowed.`);
    setNote("");
    setIds(nextIds);
  }

  return (
    <div className="ts ts-half" role="dialog" aria-modal="true" aria-label="Half-time">
      <div className="ts-card gx-cut">
        <header>
          <div>
            <span>Half-time · {score}</span>
            <h2>Second-half changes</h2>
          </div>
        </header>

        <div className="ts-formations" role="group" aria-label="Style">
          {STYLES.map((s) => (
            <button key={s.id} type="button" aria-pressed={style === s.id} onClick={() => setStyle(s.id)} title={s.note}>{s.label}</button>
          ))}
        </div>
        <p className="ts-note">{STYLES.find((s) => s.id === style)?.note}. Substitutes used: {subs} of {MAX_SUBS}. {note}</p>

        <div className="ts-body">
          <div className="ts-pitch">
            {GROUPS.map((g) => (
              <div key={g} className="ts-line">
                {now.filter((p) => p.position === g).map((p) => (
                  <label key={p.id} className={`ts-slot ${start.has(p.id) ? "" : "is-sub"}`}>
                    <b>{p.rating}</b>
                    <select value={p.id} onChange={(e) => swap(p.id, e.target.value)} aria-label={`${g} slot`}>
                      <option value={p.id}>{p.name} ({p.rating})</option>
                      {[...starters, ...bench]
                        .filter((x) => x.position === g && x.id !== p.id && !ids.includes(x.id))
                        .sort((a, b) => b.rating - a.rating)
                        .map((x) => (
                          <option key={x.id} value={x.id}>{start.has(x.id) ? "↺ " : "⇄ "}{x.name} ({x.rating})</option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <aside className="ts-side">
            <div className="ts-stat">
              <span>Change in strength</span>
              <strong>{effect >= 0 ? "+" : ""}{effect.toFixed(1)}</strong>
              <em className={effect >= 0 ? "is-up" : "is-down"}>for the second half</em>
            </div>
          </aside>
        </div>

        <footer>
          <button type="button" className="ts-ghost" onClick={onSkip}>No changes</button>
          <button type="button" className="gx-btn" onClick={() => onApply({ starters: now, style, subs })}>Start second half</button>
        </footer>
      </div>
    </div>
  );
}
