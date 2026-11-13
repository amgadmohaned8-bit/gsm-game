
"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { getTier } from "@/lib/football/finance";
import {
  marketValue,
  teamRating,
  type Player,
  type Position,
} from "@/lib/football/squads";
import {
  askingPrice,
  canBuy,
  recordDeal,
  windowStatus,
} from "@/lib/football/transfers";
import { useTransfers } from "@/lib/football/useTransfers";
import { BidModal, money } from "@/components/TransferModals";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import "../../transfers/transfers.css";
import "./club.css";

const groups: { key: Position; label: string }[] = [
  { key: "GK", label: "Goalkeepers" },
  { key: "DF", label: "Defenders" },
  { key: "MF", label: "Midfielders" },
  { key: "FW", label: "Forwards" },
];

const tierLabel = {
  elite: "Big club",
  mid: "Mid-table club",
  small: "Smaller club",
} as const;

function ClubPageContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clubId = String(params?.id ?? "");

  const { ctx, loading, error, reload } = useTransfers();
  const [bid, setBid] = useState<Player | null>(null);

  const club = clubs.find((c) => c.id === clubId);

  const squad = useMemo(
    () => (ctx ? ctx.state.squads[clubId] ?? [] : []),
    [ctx, clubId]
  );

  if (loading) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Opening the club...</p>
      </main>
    );
  }

  if (!ctx || !club) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p role="alert">{error || "This club does not exist."}</p>
        <button
          type="button"
          onClick={() => router.push("/game/standings")}
        >
          Back to the table
        </button>
      </main>
    );
  }

  const own = club.id === ctx.clubId;
  const window = windowStatus(ctx.matchday);
  const mine = ctx.state.squads[ctx.clubId] ?? [];

  const blocked = canBuy({
    balance: ctx.balanceM,
    fee: 0,
    squadSize: mine.length,
    windowOpen: window.open,
  });

  const tier = getTier(club.id);
  const sorted = squad.slice().sort((a, b) => b.rating - a.rating);
  const stars = sorted.slice(0, 3);

  async function sign(player: Player, fee: number) {
    await recordDeal(supabase, {
      user_id: ctx!.userId,
      season: ctx!.season,
      player_id: player.id,
      from_club: player.club,
      to_club: ctx!.clubId,
      fee,
      kind: "buy",
      matchday: ctx!.matchday ?? 0,
    });

    await reload();
  }

  return (
    <main className="tr cl">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="tr-bg gx-kb" aria-hidden="true" />
      <div className="tr-shade" aria-hidden="true" />

      <GameHud onBack={() => router.back()} />

      <div className="tr-wrap">
        <header className="cl-hero gx-cut">
          <img src={club.logo} alt="" />

          <div>
            <p>
              {tierLabel[tier]} · {club.city}
            </p>
            <h1>
              <span className="gx-slant">{club.name}</span>
            </h1>
            <small>{club.stadium}</small>
          </div>

          <dl>
            <div>
              <dt>Team rating</dt>
              <dd>{teamRating(squad)}</dd>
            </div>

            <div>
              <dt>Players</dt>
              <dd>{squad.length}</dd>
            </div>

            <div>
              <dt>Transfers</dt>
              <dd className={window.open ? "is-open" : "is-shut"}>
                {window.open ? "Open" : "Shut"}
              </dd>
            </div>
          </dl>
        </header>

        {own ? (
          <p className="cl-note">
            This is your club. Manage the squad and the lineup from the squad page.
            {" "}
            <Link href="/game/squad">Open squad</Link>
            {" "}·{" "}
            <Link href="/game/transfers">Sell players</Link>
          </p>
        ) : (
          <p className="cl-note">
            Players of this league cannot be signed. Look for players outside
            the league on the{" "}
            <Link href="/game/transfers">transfer market</Link>.
          </p>
        )}

        {false && (
          <section className="tr-stars" aria-label="Best players">
            {stars.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className="tr-star gx-cut"
                style={{ animationDelay: `${i * 90}ms` }}
                onClick={() => setBid(p)}
              >
                <em className="tr-shine" aria-hidden="true" />
                <b>{p.rating}</b>
                <strong>{p.name}</strong>
                <small>
                  {p.position} · {p.age}
                </small>
                <span>Value about {money(marketValue(p))}</span>
                <i aria-hidden="true">Make an offer</i>
              </button>
            ))}
          </section>
        )}

        {groups.map((g) => {
          const list = sorted.filter((p) => p.position === g.key);

          if (!list.length) return null;

          return (
            <section
              key={g.key}
              className="tr-panel gx-cut"
              aria-label={g.label}
            >
              <h2 className="cl-group">
                {g.label} <span>{list.length}</span>
              </h2>

              <ul className="tr-list">
                {list.map((p) => (
                  <li key={p.id}>
                    <div className="tr-row cl-row">
                      <b
                        className={`tr-rate ${
                          p.rating >= 85
                            ? "is-elite"
                            : p.rating >= 78
                              ? "is-high"
                              : ""
                        }`}
                      >
                        {p.rating}
                      </b>

                      <span className="tr-name">
                        <strong>{p.name}</strong>
                        <small>
                          {p.position} · {p.age} · {p.nationality || "-"}
                        </small>
                      </span>

                      <span className="tr-val">
                        {money(marketValue(p))}
                      </span>

                      <span />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {bid && (
        <BidModal
          player={bid}
          ask={askingPrice(ctx.userId, ctx.season, bid, squad)}
          userId={ctx.userId}
          season={ctx.season}
          matchday={ctx.matchday}
          balanceM={ctx.balanceM}
          blocked={blocked}
          onClose={() => setBid(null)}
          onSign={(fee) => sign(bid, fee)}
        />
      )}
    </main>
  );
}

export default function ClubPage() {
  return (
    <Suspense
      fallback={
        <main className="fx-loading">
          <GsmMark size={60} />
          <p>Opening the club...</p>
        </main>
      }
    >
      <ClubPageContent />
    </Suspense>
  );
}
