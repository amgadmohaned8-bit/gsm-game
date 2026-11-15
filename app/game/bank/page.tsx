"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { useTransfers } from "@/lib/football/useTransfers";
import {
  STAGES,
  creditLimit,
  dayLabel,
  describeEvent,
  gameDay,
  lateDays,
  owed,
  ratingOf,
  stageForLate,
  type Loan,
} from "@/lib/football/bank";
import { LoanModal, RepayModal, RescheduleModal, fm } from "@/components/BankModals";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import "./bank.css";

/** numbers roll up to their value (instant if motion is reduced) */
function useCount(target: number, duration = 1000) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setV(target);
    let frame = 0;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      setV(target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return v;
}

const KIND: Record<string, string> = {
  loan: "Loan",
  repay: "Payment",
  cleared: "Cleared",
  reschedule: "Rescheduled",
  warning: "Warning",
  restriction: "Restricted",
  freeze: "Frozen",
  crisis: "Crisis",
  points: "Points cut",
  forced_sale: "Forced sale",
};

export default function BankPage() {
  const router = useRouter();
  const { ctx, loading, error, reload } = useTransfers();
  const [modal, setModal] = useState<null | { kind: "loan" } | { kind: "repay" | "move"; loan: Loan }>(null);

  const balance = useCount(ctx?.balanceM ?? 0);

  if (loading) {
    return (
      <main className="bk-loading">
        <GsmMark size={60} />
        <p>Opening the bank...</p>
      </main>
    );
  }
  if (error || !ctx) {
    return (
      <main className="bk-loading">
        <p>{error || "Could not open the bank."}</p>
        <button type="button" onClick={() => router.push("/game/dashboard")}>Back to dashboard</button>
      </main>
    );
  }

  const bank = ctx.state.bank;
  const club = clubs.find((c) => c.id === ctx.clubId);
  const day = gameDay(ctx.season, ctx.matchday);
  const when = { day, season: ctx.season, matchday: ctx.matchday };
  const rating = ratingOf(bank.score);
  const active = bank.loans.filter((l) => l.status === "active");
  const closed = bank.loans.filter((l) => l.status !== "active");

  const loansTotal = active.reduce((s, l) => s + l.principal, 0);
  const debt = active.reduce((s, l) => s + owed(l), 0);
  const costs = active.reduce((s, l) => s + l.interest + l.fees + l.penalties, 0);
  const next = [...active].sort((a, b) => a.due_day - b.due_day)[0];
  const left = next ? next.due_day - day : null;
  const worst = active.reduce((m, l) => Math.max(m, l.stage, stageForLate(lateDays(l, day))), 0);

  async function refresh() {
    await reload();
  }

  const arc = Math.max(0.02, bank.score / 1000);

  return (
    <main className="tr bk">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="bk-bg" aria-hidden="true" />
      <div className="bk-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="bk-wrap">
        {/* the banker and the balance */}
        <section className="bk-hero gx-cut" aria-label="Bank overview">
          <div className="bk-hero-pic" aria-hidden="true" />
          <div className="bk-hero-in">
            <p className="bk-club">{club?.name ?? "Your club"}</p>
            <h1><span className="gx-slant">The Bank</span></h1>
            <div className="bk-bal" aria-live="polite">
              <small>Club balance</small>
              <strong>{fm(Math.round(balance * 10) / 10)}</strong>
              {bank.frozenShare > 0 && <em>{fm(ctx.spendM)} spendable, the rest is frozen</em>}
            </div>
            <div className="bk-hero-act">
              <button type="button" className="gx-btn" onClick={() => setModal({ kind: "loan" })} disabled={!bank.ready}>Request a loan</button>
              <span className="bk-day">{dayLabel(day)} · day {day + 1}</span>
            </div>
          </div>
        </section>

        {!bank.ready && (
          <p className="bk-alert is-warn" role="alert"><Icon name="warning" size={18} /> The bank is not set up yet. Run supabase/022_bank.sql in Supabase, then reload.</p>
        )}
        {worst > 0 && bank.ready && (
          <p className={`bk-alert ${worst >= 3 ? "is-bad" : "is-warn"}`} role="alert">
            <Icon name="warning" size={18} />
            <span><b>{STAGES[worst - 1].title}.</b> {STAGES[worst - 1].note} Pay the overdue loan to lift every restriction.</span>
          </p>
        )}

        <section className="bk-kpis" aria-label="Your debts">
          <div className="bk-kpi"><span>Total loans</span><strong>{fm(loansTotal)}</strong><small>{active.length} active</small></div>
          <div className="bk-kpi is-debt"><span>Total debt</span><strong>{fm(debt)}</strong><small>{debt > 0 ? "still to repay" : "no debt"}</small></div>
          <div className="bk-kpi"><span>Interest and fines</span><strong>{fm(costs)}</strong><small>on open loans</small></div>
          <div className={`bk-kpi ${left !== null && left < 0 ? "is-late" : ""}`}>
            <span>Next payment</span>
            <strong>{next ? (left! < 0 ? `${-left!} late` : left === 0 ? "Today" : `${left} days`) : "None"}</strong>
            <small>{next ? dayLabel(next.due_day) : "nothing due"}</small>
          </div>
          <div className="bk-kpi bk-score">
            <svg viewBox="0 0 120 70" aria-hidden="true">
              <path d="M10 62 A50 50 0 0 1 110 62" pathLength="100" className="bk-arc-bg" />
              <path d="M10 62 A50 50 0 0 1 110 62" pathLength="100" className={`bk-arc is-${rating.tone}`} style={{ strokeDasharray: `${arc * 100} 100` }} />
            </svg>
            <span>Credit rating</span>
            <strong>{bank.score}</strong>
            <small>{rating.grade} · {rating.label}</small>
          </div>
        </section>

        <div className="bk-cols">
          <section className="bk-card gx-cut" aria-label="Your loans">
            <h2>Your loans</h2>
            {active.length === 0 ? (
              <p className="bk-empty">No open loans. Borrow {fm(10)} to {fm(Math.min(300, creditLimit(bank.score)))} against your {rating.grade} rating.</p>
            ) : (
              <ul className="bk-loans">
                {active.map((l) => {
                  const late = lateDays(l, day);
                  const total = l.principal + l.interest + l.fees + l.penalties;
                  const pct = Math.min(100, Math.round((l.paid / total) * 100));
                  const stage = Math.max(l.stage, stageForLate(late));
                  return (
                    <li key={l.id} className={late > 0 ? "is-late" : ""}>
                      <div className="bk-loan-top">
                        <div>
                          <b>{fm(l.principal)} loan</b>
                          <small>{Math.round(l.rate * 1000) / 10}% · taken {dayLabel(l.taken_day)}</small>
                        </div>
                        <span className={`bk-due ${late > 0 ? "is-bad" : ""}`}>
                          {late > 0 ? `${late} days late` : l.due_day - day === 0 ? "Due today" : `${l.due_day - day} days left`}
                        </span>
                      </div>
                      <div className="bk-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${pct}%` }} /></div>
                      <div className="bk-loan-nums">
                        <span>Owed <b>{fm(owed(l))}</b></span>
                        <span>Paid <b>{fm(l.paid)}</b></span>
                        <span>Due <b>{dayLabel(l.due_day)}</b></span>
                      </div>
                      {stage > 0 && <p className="bk-stage">Stage {stage}: {STAGES[stage - 1].title}</p>}
                      <div className="bk-loan-act">
                        <button type="button" className="bk-pay" onClick={() => setModal({ kind: "repay", loan: l })}>Repay</button>
                        <button type="button" className="bk-alt" onClick={() => setModal({ kind: "move", loan: l })} disabled={l.stage >= 2 || l.reschedules >= 2}>Reschedule</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="bk-card gx-cut" aria-label="Late payment rules">
            <h2>If you pay late</h2>
            <ol className="bk-ladder">
              {STAGES.map((s) => (
                <li key={s.stage} className={worst >= s.stage ? "is-hit" : ""}>
                  <i aria-hidden="true">{worst >= s.stage ? <Icon name="warning" size={14} /> : s.stage}</i>
                  <div>
                    <b>{s.title}</b>
                    <small>From day {s.from} late{s.stage === 5 ? "" : ""}. {s.note}</small>
                  </div>
                </li>
              ))}
            </ol>
            <p className="bk-fine">Days are matchdays of your season. Mid-season is matchday 19. Borrow after it and the bill falls due at the next mid-season.</p>
          </section>
        </div>

        <section className="bk-card bk-hist gx-cut" aria-label="History">
          <h2>History</h2>
          {bank.events.length === 0 && closed.length === 0 ? (
            <p className="bk-empty">Loans, payments and fines will appear here.</p>
          ) : (
            <div className="bk-table">
              <table>
                <thead>
                  <tr><th>When</th><th>Type</th><th>What happened</th><th>Money</th><th>Rating</th></tr>
                </thead>
                <tbody>
                  {bank.events.map((e) => (
                    <tr key={e.id}>
                      <td>{e.game_day !== null ? dayLabel(e.game_day) : "—"}</td>
                      <td><span className={`bk-tag k-${e.kind}`}>{KIND[e.kind] ?? e.kind}</span></td>
                      <td>{describeEvent(e)}{e.points ? ` (−${e.points} points)` : ""}</td>
                      <td className={e.amount > 0 ? "is-up" : e.amount < 0 ? "is-down" : ""}>{e.amount ? fm(e.amount) : e.debt > 0 && e.kind !== "loan" ? `+${fm(e.debt)} debt` : "—"}</td>
                      <td className={e.score_delta > 0 ? "is-up" : e.score_delta < 0 ? "is-down" : ""}>{e.score_delta ? (e.score_delta > 0 ? `+${e.score_delta}` : e.score_delta) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {modal?.kind === "loan" && (
        <LoanModal bank={bank} when={when} leagueId={ctx.leagueId} clubId={ctx.clubId} balanceM={ctx.balanceM} onClose={() => setModal(null)} onDone={refresh} />
      )}
      {modal?.kind === "repay" && (
        <RepayModal loan={modal.loan} when={when} balanceM={ctx.balanceM} onClose={() => setModal(null)} onDone={refresh} />
      )}
      {modal?.kind === "move" && (
        <RescheduleModal loan={modal.loan} when={when} onClose={() => setModal(null)} onDone={refresh} />
      )}
    </main>
  );
}
