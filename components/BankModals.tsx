"use client";

import { useEffect, useRef, useState } from "react";
import {
  MAX_LOAN,
  MIN_LOAN,
  RESCHEDULE_OPTIONS,
  creditLimit,
  dayLabel,
  newRequest,
  owed,
  quote,
  ratingOf,
  rescheduleQuote,
  repayLoan,
  rescheduleLoan,
  takeLoan,
  type Bank,
  type Loan,
} from "@/lib/football/bank";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import "./transfers.css";
import "./bank.css";

/** millions, with up to two decimals and no trailing zeros: 1.2 -> €1.2M, 1.53 -> €1.53M */
export const fm = (m: number) => {
  const sign = m < 0 ? "-" : "";
  const a = Math.abs(m);
  if (a >= 1000) return `${sign}€${(a / 1000).toFixed(2)}B`;
  return `${sign}€${(Math.round(a * 100) / 100).toString()}M`;
};

type When = { day: number; season: string; matchday: number | null };

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="tb bk-modal" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tb-panel gx-cut" role="dialog" aria-modal="true" aria-label={title}>
        <button ref={ref} type="button" className="tb-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
        <header className="bk-mh">
          <span className="bk-mh-ic"><Icon name="wallet" size={22} /></span>
          <h2>{title}</h2>
        </header>
        {children}
      </div>
    </div>
  );
}

function Done({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <div className="tb-stage tb-done">
      <div className="tb-stamp is-yes"><Icon name="check" size={34} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      <button type="button" className="gx-btn" onClick={onClose}>Back to the bank</button>
    </div>
  );
}

function Rows({ rows }: { rows: [string, string, ("bad" | "good" | "")?][] }) {
  return (
    <dl className="bk-sum">
      {rows.map(([k, v, tone]) => (
        <div key={k}><dt>{k}</dt><dd className={tone ? `is-${tone}` : ""}>{v}</dd></div>
      ))}
    </dl>
  );
}

function message(err: unknown) {
  const text = err instanceof Error ? err.message : "";
  if (/bank_|function|schema cache|does not exist/i.test(text)) return "The bank is not set up yet. Run supabase/022_bank.sql, then try again.";
  return text || "The bank could not do that. Try again.";
}

/* ------------------------------------------------------------------ */
/* a new loan                                                          */
/* ------------------------------------------------------------------ */

export function LoanModal({
  bank, when, leagueId, clubId, balanceM, onClose, onDone,
}: {
  bank: Bank; when: When; leagueId: string; clubId: string; balanceM: number; onClose: () => void; onDone: () => Promise<void> | void;
}) {
  const limit = creditLimit(bank.score);
  const out = bank.loans.filter((l) => l.status === "active").reduce((s, l) => s + l.principal, 0);
  const room = Math.max(0, limit - out);
  const top = Math.min(MAX_LOAN, room);
  const rating = ratingOf(bank.score);

  const [amount, setAmount] = useState(String(Math.min(top, Math.max(MIN_LOAN, 50))));
  const [phase, setPhase] = useState<"form" | "confirm" | "done">("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(newRequest());

  const value = Math.round(Number(amount) || 0);
  const q = quote(value, bank.score, when.day);
  const daysLeft = q.dueDay - when.day;
  const problem =
    bank.noLoans ? "The bank has blocked new loans until your overdue debt is paid."
    : top < MIN_LOAN ? `Your ${rating.grade} rating leaves no room for a new loan (limit ${fm(limit)}, already borrowed ${fm(out)}).`
    : value < MIN_LOAN || value > MAX_LOAN ? `Loans run from ${fm(MIN_LOAN)} to ${fm(MAX_LOAN)}.`
    : value > top ? `Your ${rating.grade} rating allows ${fm(top)} more.`
    : null;

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await takeLoan(supabase, { leagueId, request: request.current, principal: value, day: when.day, season: when.season, matchday: when.matchday, club: clubId });
      await onDone();
      setPhase("done");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="New loan" onClose={onClose}>
      {phase === "done" ? (
        <Done title="Loan approved" text={`${fm(value)} has been added to the club balance. Repay ${fm(q.total)} by ${dayLabel(q.dueDay)}.`} onClose={onClose} />
      ) : phase === "confirm" ? (
        <div className="tb-stage">
          <p className="bk-ask">Please confirm. The money goes straight into the club balance.</p>
          <Rows rows={[
            ["Loan", fm(value)],
            ["Interest rate", `${Math.round(q.rate * 1000) / 10}%`],
            ["Interest, charged once", fm(q.interest)],
            ["To repay in total", fm(q.total), "bad"],
            ["Due", `${dayLabel(q.dueDay)} (${daysLeft} days)`],
            ["Balance after", fm(balanceM + value), "good"],
          ]} />
          <p className="tb-note">Late payments add fines, block loans and signings, and can cost league points.</p>
          {error && <p className="tb-error" role="alert">{error}</p>}
          <button type="button" className="gx-btn" disabled={busy} onClick={confirm}>{busy ? "Signing..." : `Confirm ${fm(value)} loan`}</button>
          <button type="button" className="tb-ghost" disabled={busy} onClick={() => setPhase("form")}>Change the amount</button>
        </div>
      ) : (
        <div className="tb-stage">
          <label className="tb-label" htmlFor="bk-amount">How much do you need? (millions)</label>
          <div className="tb-input">
            <span>€</span>
            <input id="bk-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} />
            <span>M</span>
          </div>
          <input
            className="bk-range"
            type="range"
            min={MIN_LOAN}
            max={Math.max(MIN_LOAN, top || MAX_LOAN)}
            step={1}
            value={Math.min(Math.max(value, MIN_LOAN), Math.max(MIN_LOAN, top || MAX_LOAN))}
            onChange={(e) => setAmount(e.target.value)}
            aria-label="Loan amount"
          />
          <div className="tb-quick" role="group" aria-label="Quick amounts">
            {[10, 50, 100, 200, 300].map((n) => (
              <button key={n} type="button" disabled={n > top} onClick={() => setAmount(String(n))}>{n}M</button>
            ))}
          </div>
          <Rows rows={[
            ["Interest rate", `${Math.round(q.rate * 1000) / 10}%${q.adjust ? ` (${q.adjust < 0 ? "" : "+"}${Math.round(q.adjust * 100)}% for your rating)` : ""}`],
            ["Interest, charged once", fm(q.interest)],
            ["You will repay", fm(q.total), "bad"],
            ["Due", `${dayLabel(q.dueDay)} · ${daysLeft} days`],
          ]} />
          {problem ? <p className="tb-error" role="alert">{problem}</p> : <p className="tb-note">Rating {rating.grade} ({bank.score}). You can borrow {fm(top)} more.</p>}
          <button type="button" className="gx-btn" disabled={!!problem} onClick={() => setPhase("confirm")}>Review the loan</button>
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* paying a loan back                                                  */
/* ------------------------------------------------------------------ */

export function RepayModal({
  loan, when, balanceM, onClose, onDone,
}: {
  loan: Loan; when: When; balanceM: number; onClose: () => void; onDone: () => Promise<void> | void;
}) {
  const debt = owed(loan);
  const [amount, setAmount] = useState(String(Math.min(debt, Math.max(0, Math.floor(balanceM * 100) / 100))));
  const [phase, setPhase] = useState<"form" | "confirm" | "done">("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(newRequest());

  const pay = Math.min(debt, Math.max(0, Math.round((Number(amount) || 0) * 100) / 100));
  const left = Math.round((debt - pay) * 100) / 100;
  const early = when.day < loan.due_day;
  const problem = pay <= 0 ? "Enter an amount to pay." : pay > balanceM ? "The club balance does not cover that payment." : null;

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await repayLoan(supabase, { loan: loan.id, request: request.current, amount: pay, day: when.day, season: when.season, matchday: when.matchday });
      await onDone();
      setPhase("done");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Repay the loan" onClose={onClose}>
      {phase === "done" ? (
        <Done title={left <= 0 ? "Loan cleared" : "Payment made"} text={left <= 0 ? "The debt is paid in full. Any bank restrictions are lifted and your rating goes up." : `${fm(pay)} paid. ${fm(left)} is still owed.`} onClose={onClose} />
      ) : phase === "confirm" ? (
        <div className="tb-stage">
          <p className="bk-ask">Please confirm this payment.</p>
          <Rows rows={[
            ["Payment", fm(pay)],
            ["Still owed after", fm(left), left > 0 ? "bad" : "good"],
            ["Club balance after", fm(balanceM - pay)],
          ]} />
          {error && <p className="tb-error" role="alert">{error}</p>}
          <button type="button" className="gx-btn" disabled={busy} onClick={confirm}>{busy ? "Paying..." : `Pay ${fm(pay)}`}</button>
          <button type="button" className="tb-ghost" disabled={busy} onClick={() => setPhase("form")}>Change the amount</button>
        </div>
      ) : (
        <div className="tb-stage">
          <Rows rows={[
            ["Principal", fm(loan.principal)],
            ["Interest and fines", fm(loan.interest + loan.fees + loan.penalties)],
            ["Already paid", fm(loan.paid)],
            ["Owed now", fm(debt), "bad"],
          ]} />
          <label className="tb-label" htmlFor="bk-pay">Amount to pay (millions)</label>
          <div className="tb-input">
            <span>€</span>
            <input id="bk-pay" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
            <span>M</span>
          </div>
          <div className="tb-quick" role="group" aria-label="Quick amounts">
            {[0.25, 0.5, 1].map((f) => (
              <button key={f} type="button" onClick={() => setAmount(String(Math.min(debt, Math.round(debt * f * 100) / 100)))}>{f === 1 ? "All of it" : `${f * 100}%`}</button>
            ))}
          </div>
          {problem ? <p className="tb-error" role="alert">{problem}</p> : <p className="tb-note">{early ? "Paying early is welcome: it lifts your credit rating." : "This loan is overdue. Pay in full to stop the penalties."}</p>}
          <button type="button" className="gx-btn" disabled={!!problem} onClick={() => setPhase("confirm")}>Review the payment</button>
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* more time, for a fee                                                */
/* ------------------------------------------------------------------ */

export function RescheduleModal({
  loan, when, onClose, onDone,
}: {
  loan: Loan; when: When; onClose: () => void; onDone: () => Promise<void> | void;
}) {
  const [days, setDays] = useState<number>(RESCHEDULE_OPTIONS[0].days);
  const [phase, setPhase] = useState<"form" | "confirm" | "done">("form");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(newRequest());
  const q = rescheduleQuote(loan, days, when.day);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await rescheduleLoan(supabase, { loan: loan.id, request: request.current, days, day: when.day, season: when.season, matchday: when.matchday });
      await onDone();
      setPhase("done");
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Reschedule the loan" onClose={onClose}>
      {phase === "done" ? (
        <Done title="New due date set" text={`Pay ${fm(q.owed)} by ${dayLabel(q.newDue)}.`} onClose={onClose} />
      ) : phase === "confirm" ? (
        <div className="tb-stage">
          <p className="bk-ask">Please confirm. The fee is added to the debt and your rating drops a little.</p>
          <Rows rows={[
            ["Extra time", `${days} days`],
            ["Fee added to the debt", fm(q.fee), "bad"],
            ["New amount owed", fm(q.owed), "bad"],
            ["New due date", `${dayLabel(q.newDue)} · ${q.newDue - when.day} days`],
          ]} />
          {error && <p className="tb-error" role="alert">{error}</p>}
          <button type="button" className="gx-btn" disabled={busy} onClick={confirm}>{busy ? "Saving..." : "Confirm the new date"}</button>
          <button type="button" className="tb-ghost" disabled={busy} onClick={() => setPhase("form")}>Back</button>
        </div>
      ) : (
        <div className="tb-stage">
          <div className="bk-opts" role="radiogroup" aria-label="Extra time">
            {RESCHEDULE_OPTIONS.map((o) => {
              const r = rescheduleQuote(loan, o.days, when.day);
              return (
                <button key={o.days} type="button" role="radio" aria-checked={days === o.days} className={days === o.days ? "is-on" : ""} onClick={() => setDays(o.days)}>
                  <b>{o.days} days</b>
                  <span>Fee {Math.round(o.fee * 100)}% · {fm(r.fee)}</span>
                  <small>New due: {dayLabel(r.newDue)}</small>
                </button>
              );
            })}
          </div>
          <Rows rows={[
            ["Owed now", fm(owed(loan))],
            ["Owed after the fee", fm(q.owed), "bad"],
          ]} />
          <p className="tb-note">A loan can be rescheduled twice. Not possible once it is more than a week late.</p>
          <button type="button" className="gx-btn" onClick={() => setPhase("confirm")}>Review the new date</button>
        </div>
      )}
    </Shell>
  );
}
