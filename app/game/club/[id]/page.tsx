"use client";

import { signingBan } from "@/lib/football/bank";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs } from "@/lib/football/leagueClubs";
import { marketValue, type Player, type Position } from "@/lib/football/squads";
import { askingPrice, canBuy, canSell, MIN_BY_POSITION, windowStatus } from "@/lib/football/transfers";
import { listPlayer, signFromClub } from "@/lib/football/dealing";
import { useTransfers } from "@/lib/football/useTransfers";
import { myRoom } from "@/lib/football/rooms";
import { BidModal, SellModal, money } from "@/components/TransferModals";
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

export default function ClubPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const clubId = String(params?.id ?? "");
  const { ctx, loading, error, reload } = useTransfers();
  const [bid, setBid] = useState<Player | null>(null);
  const [sell, setSell] = useState<Player | null>(null);

  // a club run by a friend answers offers itself: those go through Negotiations
  const [managed, setManaged] = useState<string | null>(null);
  const uid = ctx?.userId;
  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const { data: c } = await supabase.from("manager_contracts").select("room_id").eq("user_id", uid).maybeSingle();
        const room = await myRoom(supabase, (c?.room_id as string | null) ?? null);
        const m = room?.members.find((x) => x.club_id === clubId && x.user_id !== uid);
        setManaged(m ? (m.name || "a friend") : null);
      } catch {
        setManaged(null);
      }
    })();
  }, [uid, clubId]);

  const club = clubs.find((c) => c.id === clubId);
  const squad = useMemo(() => (ctx ? (ctx.state.squads[clubId] ?? []) : []), [ctx, clubId]);

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
        <button type="button" onClick={() => router.push("/game/standings")}>Back to the table</button>
      </main>
    );
  }

  const own = club.id === ctx.clubId;
  const window = windowStatus(ctx.matchday);
  const mine = ctx.state.squads[ctx.clubId] ?? [];
  const blocked = canBuy({ ban: signingBan(ctx.state.bank), balance: ctx.spendM, fee: 0, squadSize: mine.length, windowOpen: window.open });
  const sorted = squad.slice().sort((a, b) => b.rating - a.rating);
  const stars = sorted.slice(0, 3);

  /** put one of my players on the market, as the Transfers page does */
  async function listForSale(player: Player, asking: number) {
    if (ctx!.roomId) {
      await listPlayer(supabase, ctx!.roomId, player.id, asking);
    } else {
      const { error: e } = await supabase.from("transfer_listings").insert({ league_id: ctx!.leagueId, user_id: ctx!.userId, season: ctx!.season, player_id: player.id, asking, listed_matchday: ctx!.matchday ?? 0 });
      if (e) throw e;
    }
    await reload();
  }

  const listedIds = new Set(ctx.state.listings.filter((l) => l.status === "open").map((l) => l.player_id));

  async function sign(player: Player, fee: number) {
    await signFromClub(supabase, { roomId: ctx!.roomId, userId: ctx!.userId, clubId: ctx!.clubId, leagueId: ctx!.leagueId, season: ctx!.season, matchday: ctx!.matchday, spendM: ctx!.spendM, squadSize: mine.length }, player, fee);
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
            <p>{club.city}</p>
            <h1><span className="gx-slant">{club.name}</span></h1>
            <small>{club.stadium}</small>
          </div>
          <dl>
            <div><dt>Players</dt><dd>{squad.length}</dd></div>
            <div><dt>Transfers</dt><dd className={window.open ? "is-open" : "is-shut"}>{window.open ? "Open" : "Shut"}</dd></div>
          </dl>
        </header>

        {own ? (
          <p className="cl-note">This is your squad. Tap <b>Sell</b> next to a player to put him on the market. Formation and tactics are in <Link href="/game/squad">Lineups</Link>.</p>
        ) : (
          <p className="cl-note">
            {managed
              ? <>{club.name} are managed by <b>{managed}</b>. Send your offer from <Link href="/game/transfers">Transfers</Link>, Clubs: he answers in Negotiations.</>
              : window.open
              ? <>Tap <b>Offer</b> next to any player to bid for him. {club.name} decide the price, so a low bid can be turned down.</>
              : <>The transfer window is closed, so no offers can be made right now.</>}
            {" "}You can also browse the <Link href="/game/transfers">transfer market</Link>.
          </p>
        )}

        {false && (
          <section className="tr-stars" aria-label="Best players">
            {stars.map((p, i) => (
              <button key={p.id} type="button" className="tr-star gx-cut" style={{ animationDelay: `${i * 90}ms` }} onClick={() => setBid(p)}>
                <em className="tr-shine" aria-hidden="true" />
                <b>{p.rating}</b>
                <strong>{p.name}</strong>
                <small>{p.position} · {p.age}</small>
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
            <section key={g.key} className="tr-panel gx-cut" aria-label={g.label}>
              <h2 className="cl-group">{g.label} <span>{list.length}</span></h2>
              <ul className="tr-list">
                {list.map((p) => (
                  <li key={p.id}>
                    <div className="tr-row cl-row">
                      <b className={`tr-rate ${p.rating >= 85 ? "is-elite" : p.rating >= 78 ? "is-high" : ""}`}>{p.rating}</b>
                      <span className="tr-name">
                        <strong>{p.name}</strong>
                        <small>{p.position} · {p.age} · {p.nationality || "-"}</small>
                      </span>
                      <span className="tr-val">{money(marketValue(p))}</span>
                      {own ? (
                        listedIds.has(p.id) ? <span className="tr-val">On sale</span> : <button type="button" className="tr-offer" onClick={() => setSell(p)}>Sell</button>
                      ) : managed ? <span /> : (
                        <button
                          type="button"
                          className="tr-offer"
                          disabled={!window.open || squad.filter((x) => x.position === p.position).length - 1 < MIN_BY_POSITION[p.position]}
                          title={squad.filter((x) => x.position === p.position).length - 1 < MIN_BY_POSITION[p.position] ? `${club.name} cannot sell their last ${p.position} players.` : undefined}
                          onClick={() => setBid(p)}
                        >Offer</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {sell && (
        <SellModal player={sell} warning={canSell(mine, sell)} onClose={() => setSell(null)} onList={(price) => listForSale(sell, price)} />
      )}

      {bid && (
        <BidModal
          player={bid}
          ask={askingPrice(ctx.userId, ctx.season, bid, squad)}
          userId={ctx.userId}
          season={ctx.season}
          matchday={ctx.matchday}
          balanceM={ctx.spendM}
          blocked={blocked}
          onClose={() => setBid(null)}
          onSign={(fee) => sign(bid, fee)}
        />
      )}
    </main>
  );
}
