"use client";

import { useEffect, useMemo, useState } from "react";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { computeStats, type PlayerStat, type StatMatch } from "@/lib/football/stats";
import type { Renewal } from "@/lib/football/contracts";
import type { TrainingRow } from "@/lib/football/development";
import { applyDeals, type Deal } from "@/lib/football/transfers";
import { marketValue } from "@/lib/football/squads";

export type LeaderTab = "scorers" | "assists" | "teams" | "best" | "value";

const clubOf = (id: string) => clubs.find((c) => c.id === id);

function useCountUp(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function Num({ n }: { n: number }) {
  return <>{useCountUp(n)}</>;
}

const TITLES: Record<LeaderTab, { title: string; unit: string; sub: string }> = {
  scorers: { title: "Golden Boot", unit: "goals", sub: "Top scorers of the season" },
  assists: { title: "Playmakers", unit: "assists", sub: "Most assists of the season" },
  teams: { title: "Best attack", unit: "goals", sub: "Teams that scored the most" },
  best: { title: "Player of the season", unit: "G+A", sub: "Goals plus assists" },
  value: { title: "Market value", unit: "€M", sub: "Total value of every squad, with the number of players" },
};

type Row = { key: string; name: string; club: string; value: number; extra: string; position?: string };

export default function Leaders({
  tab,
  matches,
  deals,
  training,
  renewals,
  leagueKey,
  myClub,
}: {
  tab: LeaderTab;
  matches: StatMatch[];
  deals: Deal[];
  training: TrainingRow[];
  renewals: Renewal[];
  leagueKey: string;
  myClub: string;
}) {
  const stats = useMemo(() => computeStats({ matches, deals, leagueKey, training, own: { club: myClub, renewals } }), [matches, deals, leagueKey, training, renewals, myClub]);

  const rows: Row[] = useMemo(() => {
    const fromPlayers = (list: PlayerStat[], value: (p: PlayerStat) => number, extra: (p: PlayerStat) => string): Row[] =>
      list.slice(0, 15).map((p) => ({ key: p.id, name: p.name, club: p.club, value: value(p), extra: extra(p), position: p.position }));
    if (tab === "scorers") return fromPlayers(stats.scorers, (p) => p.goals, (p) => `${p.assists} assists`);
    if (tab === "assists") return fromPlayers(stats.assisters, (p) => p.assists, (p) => `${p.goals} goals`);
    if (tab === "best") return fromPlayers(stats.best.filter((p) => p.total > 0), (p) => p.total, (p) => `${p.goals}G · ${p.assists}A`);
    if (tab === "value") {
      const season = matches[0]?.season;
      const ids = [...new Set(matches.flatMap((m) => [m.home_club, m.away_club]))];
      const squads = applyDeals(deals, { season, training, matchday: 999, own: { club: myClub, renewals } });
      return ids
        .map((id) => {
          const list = squads[id] ?? [];
          return { key: id, name: clubOf(id)?.name ?? id, club: id, value: Math.round(list.reduce((n, p) => n + marketValue(p), 0)), extra: `${list.length} players` };
        })
        .sort((a, b) => b.value - a.value);
    }
    return stats.teams.slice(0, 20).map((t) => ({ key: t.club, name: clubOf(t.club)?.name ?? t.club, club: t.club, value: t.goals, extra: `${t.per.toFixed(2)} per match` }));
  }, [stats, tab, matches, deals, training, renewals, myClub]);

  const meta = TITLES[tab];
  const max = Math.max(1, ...rows.map((r) => r.value));
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  if (!rows.length) {
    return (
      <div className="ld-empty gx-cut">
        <span aria-hidden="true">⚽</span>
        <h3>No goals yet</h3>
        <p>Play a matchday and the leaderboards light up.</p>
      </div>
    );
  }

  const order = [1, 0, 2].filter((i) => podium[i]);

  return (
    <section className="ld" key={tab} aria-label={meta.title}>
      <header className="ld-head">
        <h2>{meta.title}</h2>
        <p>{meta.sub}</p>
      </header>

      <div className="ld-podium">
        {order.map((i) => {
          const r = podium[i];
          const c = clubOf(r.club);
          return (
            <article key={r.key} className={`ld-pod is-${i + 1} ${r.club === myClub ? "is-mine" : ""}`} style={{ animationDelay: `${i === 0 ? 0.35 : i === 1 ? 0.15 : 0.5}s` }}>
              <span className="ld-medal" aria-hidden="true">{i + 1}</span>
              {c && <img src={c.logo} alt="" />}
              <strong>{r.name}</strong>
              {tab === "value" ? <small>{r.extra}</small> : tab !== "teams" && <small>{c?.name}</small>}
              <b className="ld-big"><Num n={r.value} /></b>
              <em>{meta.unit}</em>
              <div className="ld-step" aria-hidden="true" />
            </article>
          );
        })}
      </div>

      {rest.length > 0 && (
        <ol className="ld-list" start={4}>
          {rest.map((r, i) => {
            const c = clubOf(r.club);
            return (
              <li key={r.key} className={r.club === myClub ? "is-mine" : ""} style={{ animationDelay: `${0.5 + i * 0.05}s` }}>
                <span className="ld-rank">{i + 4}</span>
                {c && <img src={c.logo} alt="" />}
                <div className="ld-who">
                  <strong>{r.name}</strong>
                  <small>{tab === "teams" || tab === "value" ? r.extra : `${c?.name ?? ""} · ${r.extra}`}</small>
                  <i aria-hidden="true"><b style={{ width: `${(r.value / max) * 100}%`, animationDelay: `${0.6 + i * 0.05}s` }} /></i>
                </div>
                <span className="ld-val"><Num n={r.value} /></span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
