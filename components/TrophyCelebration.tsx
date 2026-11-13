"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { allClubs } from "@/lib/football/leagueClubs";
import { seasonLabel } from "@/lib/football/season";
import { kindInfo, LEAGUE_OVERRIDES, trophyTitle } from "@/lib/football/trophyCatalog";
import "./celebration.css";

type Row = { kind: string; season: string; league_id: string; club_id: string | null };
const BIG = new Set(["league", "league_cup", "continental_cup"]);
const idOf = (r: Row) => `${r.kind}|${r.season}|${r.league_id}`;

/**
 * Opens on top of the dashboard when the manager has won something new:
 * the trophy in the middle, "Congratulations", confetti. Every trophy is
 * shown once; what was already in the cabinet before this feature is not
 * replayed (only the latest one, the first time).
 */
export default function TrophyCelebration() {
  const [queue, setQueue] = useState<Row[]>([]);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("trophies").select("kind, season, league_id, club_id").eq("user_id", user.id).order("season", { ascending: false });
        const rows = ((data ?? []) as Row[]).filter((r) => BIG.has(r.kind));
        const k = `gsm-seen-trophies-${user.id}`;
        let seen: string[] | null = null;
        try { const raw = localStorage.getItem(k); seen = raw ? (JSON.parse(raw) as string[]) : null; } catch { /* no storage */ }
        let fresh: Row[];
        if (seen === null) fresh = rows.slice(0, 1); // first run: only the latest
        else fresh = rows.filter((r) => !seen!.includes(idOf(r)));
        try { localStorage.setItem(k, JSON.stringify(rows.map(idOf))); } catch { /* shown again next time */ }
        if (!off && fresh.length) setQueue(fresh);
      } catch { /* the trophy room still has it */ }
    })();
    return () => { off = true; };
  }, []);

  const now = queue[0];
  const confetti = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ x: (i * 53) % 100, d: 5 + (i % 6), delay: -((i * 0.7) % 6), w: 6 + (i % 4) * 2, r: (i * 47) % 360, c: ["#e3b258", "#f7db96", "#ffffff", "#7dd3fc", "#f87171", "#86efac"][i % 6] })), []);
  if (!now) return null;

  const image = LEAGUE_OVERRIDES[now.league_id]?.[now.kind]?.image ?? kindInfo(now.kind).image;
  const club = allClubs.find((c) => c.id === now.club_id);

  return (
    <div className="tc" role="dialog" aria-modal="true" aria-label="Trophy won">
      <div className="tc-confetti" aria-hidden="true">
        {confetti.map((p, i) => <i key={i} style={{ left: `${p.x}%`, width: p.w, height: p.w * 1.6, background: p.c, animationDuration: `${p.d}s`, animationDelay: `${p.delay}s`, rotate: `${p.r}deg` }} />)}
      </div>
      <div className="tc-card">
        <small>Season {seasonLabel(now.season)}</small>
        <img className="tc-trophy" src={image} alt="" />
        <h2>Congratulations!</h2>
        <p className="tc-ar" dir="rtl" lang="ar">مبروك يا مدرب!</p>
        <strong>{trophyTitle(now.kind, now.league_id)}</strong>
        {club && <span className="tc-club"><img src={club.logo} alt="" />{club.name}</span>}
        <button type="button" className="gx-btn" onClick={() => setQueue((q) => q.slice(1))} autoFocus>{queue.length > 1 ? "Next trophy" : "Continue"}</button>
      </div>
    </div>
  );
}
