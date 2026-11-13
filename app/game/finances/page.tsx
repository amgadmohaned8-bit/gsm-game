"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { activeSeason } from "@/lib/football/season";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import {
  buildFinance,
  formatMoney,
  type FinanceMatch,
} from "@/lib/football/finance";
import { loadTransferState } from "@/lib/football/transfers";
import { currentMatchday } from "@/lib/football/useTransfers";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import "./finances.css";


type ManagerData = {
  selected_club: string;
  selected_league: string;
};

/** numbers roll up to their value when the screen opens (instant if motion is reduced) */
function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    let frame = 0;
    let start = 0;

    const tick = (time: number) => {
      if (!start) start = time;
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(target * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}

export default function FinancesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<ManagerData | null>(null);
  const [matches, setMatches] = useState<FinanceMatch[]>([]);
  const [net, setNet] = useState(0);
  const [error, setError] = useState("");
  const [barsReady, setBarsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/");
          return;
        }

        const { data: contract, error: contractError } = await supabase
          .from("manager_contracts")
          .select("selected_club, selected_league")
          .eq("user_id", user.id)
          .maybeSingle();

        if (contractError) throw contractError;

        if (!contract?.selected_club || !contract?.selected_league) {
          router.replace("/game/leagues");
          return;
        }

        const season = await activeSeason(supabase, user.id, contract.selected_league);

        const { data: matchData, error: matchesError } = await supabase
          .from("league_matches")
          .select("home_club, away_club, home_score, away_score, status, matchday")
          .eq("user_id", user.id)
          .eq("league_id", contract.selected_league)
          .eq("season", season);

        if (matchesError) throw matchesError;
        const ts = await loadTransferState(supabase, user.id, contract.selected_club, season, currentMatchday(matchData ?? []));

        if (!cancelled) {
          setManager(contract as ManagerData);
          setMatches((matchData ?? []) as FinanceMatch[]);
          setNet(ts.net);
        }
      } catch (err) {
        console.error("Finances loading error:", err);
        if (!cancelled) setError("Could not load club finances. Refresh the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // bars start empty, then grow
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(() => setBarsReady(true), 120);
    return () => clearTimeout(timer);
  }, [loading]);

  const club = clubs.find((item) => item.id === manager?.selected_club);

  const finance = useMemo(
    () => (manager ? buildFinance(manager.selected_club, matches, net * 1_000_000) : null),
    [manager, matches, net]
  );

  const animatedBalance = useCountUp(finance?.balance ?? 0);

  if (loading) {
    return (
      <main className="fn-loading">
        <GsmMark size={60} />
        <p>Opening the books...</p>
      </main>
    );
  }

  if (error || !manager || !club || !finance) {
    return (
      <main className="fn-loading">
        <p>{error || "Could not load club finances."}</p>
        <button type="button" onClick={() => router.push("/game/dashboard")}>
          Back to dashboard
        </button>
      </main>
    );
  }

  const delta = finance.balance - finance.opening;

  const incomeRows = [
    { label: "TV rights", value: finance.incomeByType.tv },
    { label: "Sponsors", value: finance.incomeByType.sponsors },
    { label: "Matchday tickets", value: finance.incomeByType.gate },
    { label: "Match prizes", value: finance.incomeByType.prize },
  ];
  const expenseRows = [
    { label: "Player wages", value: finance.expensesByType.wages },
    { label: "Club operations", value: finance.expensesByType.operations },
    { label: "Win bonuses", value: finance.expensesByType.bonuses },
  ];

  const incomeMax = Math.max(1, ...incomeRows.map((row) => row.value));
  const expenseMax = Math.max(1, ...expenseRows.map((row) => row.value));

  return (
    <main className="fn gx-grain">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="fn-bg gx-kb" aria-hidden="true" />
      <div className="fn-shade" aria-hidden="true" />

      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="fn-body">
        <section className="fn-hero">
          <div className="fn-title">
            <p className="fn-tier" data-tier={finance.tier}>
              {finance.profile.label}
            </p>
            <h1>
              <span className="gx-slant">Club finances</span>
            </h1>
            <p className="fn-note">{finance.profile.note}</p>
          </div>

          <div className="fn-balance gx-cut" aria-live="polite">
            <small>Club balance</small>
            <strong>{formatMoney(animatedBalance)}</strong>
            <span className={delta >= 0 ? "is-up" : "is-down"}>
              {formatMoney(delta, true)} since the season started
            </span>
            <em>Opening balance {formatMoney(finance.opening)}</em>
          </div>
        </section>

        <section className="fn-kpis" aria-label="Season totals">
          <div className="fn-kpi">
            <Icon name="arrow-right" size={18} className="fn-kpi-up" />
            <span>Income</span>
            <strong>{formatMoney(finance.totalIncome)}</strong>
          </div>
          <div className="fn-kpi">
            <Icon name="arrow-left" size={18} className="fn-kpi-down" />
            <span>Spending</span>
            <strong>{formatMoney(finance.totalExpenses)}</strong>
          </div>
          <div className="fn-kpi">
            <Icon name="wallet" size={18} />
            <span>Net this season</span>
            <strong className={finance.net >= 0 ? "is-up" : "is-down"}>
              {formatMoney(finance.net, true)}
            </strong>
          </div>
        </section>

        <section className="fn-split">
          <article className="fn-panel gx-cut">
            <h2>Where the money comes from</h2>
            <ul>
              {incomeRows.map((row) => (
                <li key={row.label}>
                  <div>
                    <span>{row.label}</span>
                    <b>{formatMoney(row.value)}</b>
                  </div>
                  <i
                    className="is-in"
                    style={{ width: barsReady ? `${(row.value / incomeMax) * 100}%` : "0%" }}
                  />
                </li>
              ))}
            </ul>
          </article>

          <article className="fn-panel gx-cut">
            <h2>Where it goes</h2>
            <ul>
              {expenseRows.map((row) => (
                <li key={row.label}>
                  <div>
                    <span>{row.label}</span>
                    <b>{formatMoney(row.value)}</b>
                  </div>
                  <i
                    className="is-out"
                    style={{ width: barsReady ? `${(row.value / expenseMax) * 100}%` : "0%" }}
                  />
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="fn-ledger gx-cut" aria-label="Round by round">
          <h2>Round by round</h2>

          {finance.ledger.length === 0 ? (
            <div className="fn-empty">
              <Icon name="ball" size={28} />
              <div>
                <strong>No money has moved yet.</strong>
                <p>
                  Income and spending are recorded after every match you play. A home match
                  earns about {formatMoney(finance.perRound.home, true)} for your club, an away
                  match about {formatMoney(finance.perRound.away, true)}, before prizes and bonuses.
                </p>
              </div>
            </div>
          ) : (
            <div className="fn-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Round</th>
                    <th className="fn-left">Match</th>
                    <th>Income</th>
                    <th>Spending</th>
                    <th>Net</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {[...finance.ledger].reverse().map((entry) => {
                    const opponent = clubs.find((item) => item.id === entry.opponentId);
                    return (
                      <tr key={`${entry.matchday}-${entry.opponentId}`}>
                        <td className="fn-round">{entry.matchday}</td>
                        <td className="fn-left">
                          <div className="fn-match">
                            {opponent && <img src={opponent.logo} alt="" />}
                            <span>
                              {entry.home ? "vs" : "at"} {opponent?.name ?? entry.opponentId}
                            </span>
                            <em data-result={entry.result}>
                              {entry.goalsFor}-{entry.goalsAgainst}
                            </em>
                          </div>
                        </td>
                        <td className="is-up">{formatMoney(entry.totalIncome, true)}</td>
                        <td className="is-down">-{formatMoney(entry.totalExpenses).replace("-", "")}</td>
                        <td className={entry.net >= 0 ? "is-up" : "is-down"}>
                          {formatMoney(entry.net, true)}
                        </td>
                        <td className="fn-bal">{formatMoney(entry.balanceAfter)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
