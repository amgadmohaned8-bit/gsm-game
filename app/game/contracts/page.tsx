"use client";

import Flag from "@/components/Flag";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { askFor, contractOf, feeFor, replyTo, seasonsLeft, wageBudget, MAX_YEARS } from "@/lib/football/contracts";
import { startYear } from "@/lib/football/development";
import { useTransfers } from "@/lib/football/useTransfers";
import type { Player } from "@/lib/football/squads";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "./contracts.css";

type Filter = "ALL" | "EXPIRING" | "SAFE";

export default function ContractsPage() {
  const router = useRouter();
  const { ctx, loading, error, reload } = useTransfers();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [open, setOpen] = useState<Player | null>(null);
  const [years, setYears] = useState(2);
  const [offer, setOffer] = useState(0);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const squad: Player[] = ctx?.state.squads[ctx.clubId] ?? [];
  const rows = useMemo(() => {
    if (!ctx) return [];
    return squad
      .map((p) => {
        const c = contractOf(p, ctx.clubId, ctx.state.deals, ctx.state.renewals);
        return { p, c, left: seasonsLeft(c, ctx.season) };
      })
      .filter((r) => (filter === "ALL" ? true : filter === "EXPIRING" ? r.left <= 1 : r.left > 1))
      .sort((a, b) => a.left - b.left || b.p.rating - a.p.rating);
  }, [ctx, squad, filter]);

  if (loading || !ctx) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>{error || "Loading contracts..."}</p>
      </main>
    );
  }

  const bill = squad.reduce((s, p) => s + contractOf(p, ctx.clubId, ctx.state.deals, ctx.state.renewals).wage, 0);
  const budget = wageBudget(ctx.clubId);
  const over = bill > budget;
  const expiring = squad.filter((p) => seasonsLeft(contractOf(p, ctx.clubId, ctx.state.deals, ctx.state.renewals), ctx.season) <= 1).length;

  const ask = open ? askFor(ctx.userId, ctx.season, open) : null;

  function start(p: Player) {
    const a = askFor(ctx!.userId, ctx!.season, p);
    setOpen(p);
    setYears(a.years.includes(2) ? 2 : a.years[0]);
    setOffer(a.wage);
    setReply("");
  }

  async function sign(wage: number) {
    if (!ctx || !open || busy) return;
    const fee = feeFor(wage);
    setBusy(true);
    try {
      const { error: e } = await supabase.from("contract_renewals").insert({
        user_id: ctx.userId,
        club_id: ctx.clubId,
        player_id: open.id,
        season: ctx.season,
        end_year: startYear(ctx.season) + years - 1,
        wage,
        fee,
      });
      if (e) throw e;
      setNote(`${open.name} signed for ${years} ${years === 1 ? "year" : "years"} at ${wage.toFixed(2)}M a year. Fee ${fee.toFixed(2)}M.`);
      setOpen(null);
      await reload();
    } catch (err) {
      console.error("Contract error:", err);
      setReply("It did not save. Make sure supabase/011_achievements_fitness_contracts.sql has been run.");
    } finally {
      setBusy(false);
    }
  }

  function propose() {
    if (!ask) return;
    const r = replyTo(ask, offer);
    setReply(r.line);
    if (r.kind === "accept") void sign(offer);
    else if (r.kind === "counter") setOffer(r.wage);
  }

  const chips: [Filter, string][] = [["ALL", "All"], ["EXPIRING", `Expiring (${expiring})`], ["SAFE", "Secure"]];

  return (
    <main className="ct">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="ct-bg gx-kb" aria-hidden="true" />
      <div className="ct-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="ct-wrap">
        <header className="ct-head">
          <div>
            <p>Club business</p>
            <h1><span className="gx-slant">Contracts</span></h1>
            <small>A player whose contract ends leaves for free when the season is over. Renew him before: he asks for a wage, you pay half a year of it as a signing fee.</small>
          </div>
          <div className={`ct-bill ${over ? "is-over" : ""}`}>
            <span>Wage bill</span>
            <b>{bill.toFixed(1)}M</b>
            <em><i style={{ width: `${Math.min(100, (bill / budget) * 100)}%` }} /></em>
            <small>{over ? `${(bill - budget).toFixed(1)}M over` : `${(budget - bill).toFixed(1)}M under`} the {budget}M a club your size can carry</small>
          </div>
        </header>

        {note && <p className="ct-note" role="status">{note}</p>}

        <div className="ct-tabs" role="tablist" aria-label="Filter">
          {chips.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>

        <ul className="ct-list">
          {rows.map(({ p, c, left }, i) => (
            <li key={p.id} style={{ animationDelay: `${Math.min(i, 20) * 16}ms` }} className={left <= 1 ? "is-exp" : ""}>
              <b>{p.rating}</b>
              <div><strong><Flag code={p.nationality} />{p.name}</strong><small>{p.position} · {p.age} yrs</small></div>
              <span className="ct-wage">{c.wage.toFixed(2)}M<small>a year</small></span>
              <span className={`ct-left ${left <= 1 ? "is-exp" : ""}`}>{left <= 1 ? "Last season" : `${left} seasons`}<small>until {c.endYear + 1}</small></span>
              <button type="button" className="ct-renew" onClick={() => start(p)}>Renew</button>
            </li>
          ))}
        </ul>
      </div>

      {open && ask && (
        <div className="ct-modal" role="dialog" aria-modal="true" aria-label={`Renew ${open.name}`} onClick={() => setOpen(null)}>
          <div className="ct-card" onClick={(e) => e.stopPropagation()}>
            <h2>{open.name}</h2>
            <p>{ask.note}</p>
            <label>Length
              <span className="ct-years">
                {Array.from({ length: MAX_YEARS }, (_, k) => k + 1).map((y) => (
                  <button key={y} type="button" disabled={!ask.years.includes(y)} className={years === y ? "is-on" : ""} onClick={() => setYears(y)}>{y}</button>
                ))}
              </span>
            </label>
            <label>Wage a year: <b>{offer.toFixed(2)}M</b> (he asks {ask.wage.toFixed(2)}M)
              <input type="range" min={Math.round(ask.wage * 0.7 * 100) / 100} max={Math.round(ask.wage * 1.3 * 100) / 100} step={0.01} value={offer} onChange={(e) => setOffer(Number(e.target.value))} />
            </label>
            <small>Signing fee {feeFor(offer).toFixed(2)}M. Balance {ctx.balanceM.toFixed(1)}M.</small>
            {reply && <p className="ct-reply" role="status">{reply}</p>}
            <div className="ct-actions">
              <button type="button" className="ct-ghost" onClick={() => setOpen(null)}>Cancel</button>
              <button type="button" className="gx-btn" disabled={busy} onClick={propose}>{busy ? "Saving..." : "Offer"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
