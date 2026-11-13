"use client";

import { useEffect, useRef, useState } from "react";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { marketValue, type Player } from "@/lib/football/squads";
import { originLabel, originOf, realClubOf } from "@/lib/football/market";
import { respondToBid, fairPrice, LISTING_DAYS, type BidResult } from "@/lib/football/transfers";
import Icon from "@/components/Icon";
import "./transfers.css";

const money = (m: number) => (m >= 1000 ? `€${(m / 1000).toFixed(2)}B` : `€${m.toFixed(1)}M`);
export { money };

export function sellerLabel(p: Player) {
  const origin = originOf(p.id);
  const real = realClubOf(p.id);
  if (origin && real) return `${real} · ${originLabel[origin]}`;
  return origin ? originLabel[origin] : (clubs.find((c) => c.id === p.club)?.name ?? p.club);
}

function Shell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
    <div className="tb" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tb-panel gx-cut" role="dialog" aria-modal="true" aria-label={title}>
        <button ref={ref} type="button" className="tb-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>
        {children}
      </div>
    </div>
  );
}

function PlayerHead({ player, sub }: { player: Player; sub: string }) {
  return (
    <div className="tb-head">
      <div className="tb-rate">
        <b>{player.rating}</b>
        <small>{player.position}</small>
      </div>
      <div>
        <h2>{player.name}</h2>
        <p>
          {player.age} years{player.nationality ? ` · ${player.nationality}` : ""} · {sub}
        </p>
        <p className="tb-value">Market value {money(marketValue(player))}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* buying: make an offer, the club answers                             */
/* ------------------------------------------------------------------ */

type Talks = { fails: number; day: number };

export function BidModal({
  player,
  ask,
  userId,
  season,
  matchday,
  balanceM,
  blocked,
  onClose,
  onSign,
}: {
  player: Player;
  /** the price the club wants (hidden from the manager until it answers) */
  ask: number;
  userId: string;
  season: string;
  matchday: number | null;
  balanceM: number;
  /** why the manager cannot sign anyone right now (window closed, squad full...) */
  blocked: string | null;
  onClose: () => void;
  onSign: (fee: number) => Promise<void>;
}) {
  const value = marketValue(player);
  const free = originOf(player.id) === "Free";
  const key = `gsm-talks:${userId}:${season}:${player.id}`;
  const today = matchday ?? 0;

  const [offer, setOffer] = useState(String(free ? Math.max(0.5, Math.round(value * 0.12 * 10) / 10) : value.toFixed(1)));
  const [phase, setPhase] = useState<"offer" | "thinking" | "answer" | "done">("offer");
  const [result, setResult] = useState<BidResult | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [talks, setTalks] = useState<Talks>({ fails: 0, day: today });

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null") as Talks | null;
      if (saved) setTalks(saved);
    } catch {
      /* no history */
    }
  }, [key]);

  const suspended = talks.fails >= 2 && talks.day === today;
  const amount = Math.max(0, Number(offer) || 0);
  const problem = blocked ?? (amount > balanceM ? "Your club cannot afford that offer." : null);

  function send() {
    if (problem || suspended || amount <= 0) return;
    setPhase("thinking");
    setError("");

    window.setTimeout(() => {
      const answer = respondToBid(ask, amount);
      setResult(answer);
      setPhase("answer");

      if (answer.kind === "reject" || answer.kind === "counter") {
        const next: Talks = { fails: (talks.day === today ? talks.fails : 0) + 1, day: today };
        setTalks(next);
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          /* fine */
        }
      }
    }, 1400);
  }

  async function sign(fee: number) {
    if (fee > balanceM) {
      setError("Your club cannot afford that fee.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSign(fee);
      setPhase("done");
    } catch (err) {
      console.error(err);
      setError("The deal could not be saved. Run supabase/004_transfers.sql and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title={`Offer for ${player.name}`} onClose={onClose}>
      <PlayerHead player={player} sub={sellerLabel(player)} />

      {phase === "done" ? (
        <div className="tb-stage tb-done">
          <div className="tb-stamp is-yes"><Icon name="check" size={34} /></div>
          <h3>Signed</h3>
          <p>{player.name} is now a player of your club.</p>
          <button type="button" className="gx-btn" onClick={onClose}>Back to the market</button>
        </div>
      ) : phase === "thinking" ? (
        <div className="tb-stage" role="status" aria-live="polite">
          <div className="tb-dots" aria-hidden="true"><i /><i /><i /></div>
          <p>{sellerLabel(player)} are considering your offer of {money(amount)}...</p>
        </div>
      ) : phase === "answer" && result ? (
        <div className="tb-stage" role="status" aria-live="polite">
          <div className={`tb-stamp is-${result.kind === "accept" ? "yes" : result.kind === "counter" ? "mid" : "no"}`}>
            <Icon name={result.kind === "accept" ? "check" : result.kind === "counter" ? "transfer" : "close"} size={34} />
          </div>
          <h3>{result.kind === "accept" ? "Offer accepted" : result.kind === "counter" ? "Counter offer" : "Offer rejected"}</h3>
          <p>{result.line}</p>
          {(result.kind === "accept" || result.kind === "counter") && (
            <div className="tb-actions">
              <button type="button" className="gx-btn" disabled={saving} onClick={() => sign(result.price)}>
                {saving ? "Signing..." : `Sign for ${money(result.price)}`}
              </button>
              <button type="button" className="tb-ghost" onClick={() => setPhase("offer")}>Walk away</button>
            </div>
          )}
          {result.kind === "reject" && (
            <div className="tb-actions">
              <button type="button" className="tb-ghost" onClick={() => setPhase("offer")}>
                {talks.fails >= 2 && talks.day === today ? "Talks suspended" : "Try a new offer"}
              </button>
            </div>
          )}
          {error && <p className="tb-error" role="alert">{error}</p>}
        </div>
      ) : (
        <div className="tb-stage">
          <label className="tb-label" htmlFor="tb-offer">Your offer (millions)</label>
          <div className="tb-input">
            <span>€</span>
            <input id="tb-offer" inputMode="decimal" value={offer} onChange={(e) => setOffer(e.target.value.replace(/[^0-9.]/g, ""))} />
            <span>M</span>
          </div>
          <div className="tb-quick" role="group" aria-label="Quick amounts">
            {[0.8, 1, 1.2, 1.5].map((f) => (
              <button key={f} type="button" onClick={() => setOffer((Math.round(value * f * 10) / 10).toString())}>
                {Math.round(f * 100)}%
              </button>
            ))}
          </div>

          <dl className="tb-facts">
            <div><dt>Your balance</dt><dd>{money(balanceM)}</dd></div>
            <div><dt>After the deal</dt><dd className={amount > balanceM ? "is-bad" : ""}>{money(balanceM - amount)}</dd></div>
          </dl>

          {suspended ? (
            <p className="tb-error" role="alert">The club has ended talks for today. Try again after the next matchday.</p>
          ) : problem ? (
            <p className="tb-error" role="alert">{problem}</p>
          ) : (
            <p className="tb-note">Clubs rarely sell below their price. Two failed offers end the talks until the next matchday.</p>
          )}

          <button type="button" className="gx-btn" onClick={send} disabled={!!problem || suspended || amount <= 0}>
            Send offer
          </button>
        </div>
      )}
    </Shell>
  );
}

/* ------------------------------------------------------------------ */
/* selling: put a player on the list                                   */
/* ------------------------------------------------------------------ */

export function SellModal({
  player,
  warning,
  onClose,
  onList,
}: {
  player: Player;
  /** why he cannot be sold (not enough players in his position) */
  warning: string | null;
  onClose: () => void;
  onList: (asking: number) => Promise<void>;
}) {
  const value = marketValue(player);
  const [price, setPrice] = useState(value.toFixed(1));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const amount = Math.max(0, Number(price) || 0);

  async function list() {
    if (warning || amount <= 0) return;
    setSaving(true);
    setError("");
    try {
      await onList(Math.round(amount * 10) / 10);
      setDone(true);
    } catch (err) {
      console.error(err);
      setError("Could not list the player. Run supabase/004_transfers.sql and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell title={`Sell ${player.name}`} onClose={onClose}>
      <PlayerHead player={player} sub="Your player" />

      {done ? (
        <div className="tb-stage tb-done">
          <div className="tb-stamp is-yes"><Icon name="check" size={34} /></div>
          <h3>Listed for {money(amount)}</h3>
          <p>Clubs bid each matchday. If nobody pays your price in {LISTING_DAYS} matchdays, the club sells him for about {money(fairPrice(player))}.</p>
          <button type="button" className="gx-btn" onClick={onClose}>Done</button>
        </div>
      ) : (
        <div className="tb-stage">
          <label className="tb-label" htmlFor="tb-price">Your asking price (millions)</label>
          <div className="tb-input">
            <span>€</span>
            <input id="tb-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} />
            <span>M</span>
          </div>
          <div className="tb-quick" role="group" aria-label="Price presets">
            {[
              ["Quick sale", 0.85],
              ["Fair", 1],
              ["Ambitious", 1.3],
            ].map(([label, f]) => (
              <button key={label as string} type="button" onClick={() => setPrice((Math.round(value * (f as number) * 10) / 10).toString())}>
                {label}
              </button>
            ))}
          </div>
          <p className="tb-note">
            A high price may sell for more, but it can also wait. After {LISTING_DAYS} matchdays without a buyer at your price, he goes for a fair price of about {money(fairPrice(player))}.
          </p>
          {warning && <p className="tb-error" role="alert">{warning}</p>}
          {error && <p className="tb-error" role="alert">{error}</p>}
          <button type="button" className="gx-btn" onClick={list} disabled={saving || !!warning || amount <= 0}>
            {saving ? "Listing..." : "Put up for sale"}
          </button>
        </div>
      )}
    </Shell>
  );
}
