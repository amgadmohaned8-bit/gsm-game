"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs, clubsOfLeague, leagueOfClub } from "@/lib/football/leagueClubs";
import { getTier } from "@/lib/football/finance";
import { squads as baseSquads, marketValue, teamRating, type Player, type Position } from "@/lib/football/squads";
import { marketPlayers, nextRefresh, originOf, visibleMarket } from "@/lib/football/market";
import {
  MARKET,
  askingPrice,
  canBuy,
  canSell,
  findPlayer,
  recordDeal,
  windowStatus,
} from "@/lib/football/transfers";
import { useTransfers } from "@/lib/football/useTransfers";
import { BidModal, SellModal, money, sellerLabel } from "@/components/TransferModals";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import "./transfers.css";

type Tab = "targets" | "clubs" | "squad" | "deals";
type Pos = "ALL" | Position;
type Source = "world" | "managers";
type MListing = { id: string; room_id: string; seller_id: string; seller_club: string; player_id: string; asking: number; status: string };
type Sort = "rating" | "value" | "age";

const PAGE = 40;

function useWatchlist(userId: string) {
  const key = `gsm-watch:${userId}`;
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    if (!userId) return;
    try {
      setIds(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      setIds([]);
    }
  }, [key, userId]);
  const toggle = (id: string) =>
    setIds((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* the list still works for this visit */
      }
      return next;
    });
  return { ids, toggle };
}

function untilRefresh(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

function useCountUp(target: number) {
  const [v, setV] = useState(target);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 900);
      setV(from + (target - from) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

export default function TransfersPage() {
  const router = useRouter();
  const { ctx, loading, error, reload } = useTransfers();
  const [tab, setTab] = useState<Tab>("targets");
  const [pos, setPos] = useState<Pos>("ALL");
  const [source, setSource] = useState<Source>("world");
  const [sort, setSort] = useState<Sort>("rating");
  const [query, setQuery] = useState("");
  const [shortlist, setShortlist] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [bid, setBid] = useState<Player | null>(null);
  const [sell, setSell] = useState<Player | null>(null);
  const [busy, setBusy] = useState("");
  const watch = useWatchlist(ctx?.userId ?? "");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [mlist, setMlist] = useState<MListing[]>([]);
  const [sellMgr, setSellMgr] = useState<Player | null>(null);
  const [notice, setNotice] = useState("");

  const loadManagerListings = useCallback(async (uid: string) => {
    try {
      const { data: c } = await supabase.from("manager_contracts").select("room_id").eq("user_id", uid).maybeSingle();
      const rid = (c?.room_id as string | null) ?? null;
      setRoomId(rid);
      if (!rid) return setMlist([]);
      const { data } = await supabase.from("manager_listings").select("*").eq("room_id", rid).eq("status", "open");
      setMlist((data ?? []) as MListing[]);
    } catch {
      setMlist([]);
    }
  }, []);
  const uid = ctx?.userId;
  useEffect(() => {
    if (uid) loadManagerListings(uid);
  }, [uid, loadManagerListings]);

  const balance = useCountUp(ctx?.balanceM ?? 0);

  // the market is a different selection every two days: who is on sale now, who is new, who leaves at the next refresh
  const [now, setNow] = useState(0); // set after mount: Date.now() during the first render breaks static prerendering
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const squads = ctx?.state.squads;
  const mine = useMemo(() => (ctx && squads ? (squads[ctx.clubId] ?? []) : []), [ctx, squads]);
  const window = windowStatus(ctx?.matchday ?? null);

  const onSale = useMemo(() => {
    if (!ctx || !squads) return { list: [] as Player[], isNew: new Set<string>(), leaving: new Set<string>() };
    const stock = new Map((squads[MARKET] ?? []).map((p) => [p.id, p]));
    const entries = (now ? visibleMarket(ctx.userId, now) : []).filter((e) => stock.has(e.player.id));
    return {
      list: entries.map((e) => stock.get(e.player.id)!),
      isNew: new Set(entries.filter((e) => e.isNew).map((e) => e.player.id)),
      leaving: new Set(entries.filter((e) => e.leaving).map((e) => e.player.id)),
    };
  }, [ctx, squads, now]);

  const targets = useMemo(() => {
    if (!ctx || !squads) return [];
    // only players from outside the league, or that another manager put up for sale
    const all =
      source === "managers"
        ? mlist
            .filter((l) => l.seller_id !== ctx.userId)
            .map((l) => findPlayer(squads, l.player_id))
            .filter(Boolean) as Player[]
        : onSale.list;
    const q = query.trim().toLowerCase();
    return all
      .filter((p) => (pos === "ALL" ? true : p.position === pos))
      .filter((p) => (shortlist ? watch.ids.includes(p.id) : true))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .sort((a, b) =>
        sort === "rating" ? b.rating - a.rating : sort === "value" ? marketValue(b) - marketValue(a) : a.age - b.age
      );
  }, [ctx, squads, pos, source, sort, query, shortlist, watch.ids, mlist, onSale]);

  const featured = useMemo(
    () => onSale.list.slice().sort((a, b) => b.rating - a.rating).slice(0, 3),
    [onSale]
  );

  if (loading) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p>Opening the transfer market...</p>
      </main>
    );
  }

  if (!ctx || !squads) {
    return (
      <main className="fx-loading">
        <GsmMark size={60} />
        <p role="alert">{error || "Could not load the market."}</p>
        <button type="button" onClick={() => router.push("/game/dashboard")}>Back to the club</button>
      </main>
    );
  }

  const myClub = clubs.find((c) => c.id === ctx.clubId);
  const blocked = canBuy({ balance: ctx.balanceM, fee: 0, squadSize: mine.length, windowOpen: window.open });
  const listedIds = new Set(ctx.state.listings.map((l) => l.player_id));

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

  async function buyFromManager(player: Player) {
    const l = mlist.find((x) => x.player_id === player.id);
    if (!l) return;
    const why = canBuy({ balance: ctx!.balanceM, fee: l.asking, squadSize: mine.length, windowOpen: window.open });
    if (why) return setNotice(why);
    setBusy(player.id);
    setNotice("");
    try {
      // where he started in the game: the world market, or the club the seller got him from
      const fromClub = (baseSquads[l.seller_club] ?? []).some((x) => x.id === player.id) || !(baseSquads[MARKET] ?? marketPlayers).some((x) => x.id === player.id) ? l.seller_club : MARKET;
      const { error: e } = await supabase.rpc("buy_manager_listing", {
        p_listing: l.id,
        p_buyer_club: ctx!.clubId,
        p_from_club: fromClub,
        p_season: ctx!.season,
        p_matchday: ctx!.matchday ?? 0,
      });
      if (e) throw e;
      await reload();
      await loadManagerListings(ctx!.userId);
    } catch (err) {
      console.error(err);
      setNotice("That deal did not go through. The player may already be sold, or supabase/009 has not been run.");
    } finally {
      setBusy("");
    }
  }

  async function listToManagers(player: Player, asking: number) {
    if (!roomId) throw new Error("no room");
    const { error: e } = await supabase.from("manager_listings").insert({
      room_id: roomId,
      seller_id: ctx!.userId,
      seller_club: ctx!.clubId,
      player_id: player.id,
      asking,
    });
    if (e) throw e;
    await loadManagerListings(ctx!.userId);
  }

  async function withdrawManager(id: string) {
    setBusy(id);
    await supabase.from("manager_listings").update({ status: "withdrawn" }).eq("id", id);
    await loadManagerListings(ctx!.userId);
    setBusy("");
  }

  async function list(player: Player, asking: number) {
    const { error: e } = await supabase.from("transfer_listings").insert({
      user_id: ctx!.userId,
      season: ctx!.season,
      player_id: player.id,
      asking,
      listed_matchday: ctx!.matchday ?? 0,
    });
    if (e) throw e;
    await reload();
  }

  async function withdraw(id: string) {
    setBusy(id);
    await supabase.from("transfer_listings").update({ status: "withdrawn" }).eq("id", id);
    await reload();
    setBusy("");
  }

  async function accept(playerId: string, club: string, amount: number) {
    const listing = ctx!.state.listings.find((l) => l.player_id === playerId);
    const player = mine.find((p) => p.id === playerId);
    if (!listing || !player || canSell(mine, player)) return;
    setBusy(playerId);
    try {
      await recordDeal(supabase, {
        user_id: ctx!.userId,
        season: ctx!.season,
        player_id: playerId,
        from_club: ctx!.clubId,
        to_club: club,
        fee: amount,
        kind: "sell",
        matchday: ctx!.matchday ?? 0,
      });
      await supabase.from("transfer_listings").update({ status: "sold" }).eq("id", listing.id);
      await reload();
    } finally {
      setBusy("");
    }
  }

  const otherClubs = clubsOfLeague(leagueOfClub(ctx.clubId)).filter((c) => c.id !== ctx.clubId);
  const recent = [...ctx.state.deals].reverse().slice(0, 6);

  return (
    <main className="tr">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="tr-bg gx-kb" aria-hidden="true" />
      <div className="tr-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="tr-wrap">
        <header className="tr-head">
          <div>
            <p>{myClub?.name}</p>
            <h1><span className="gx-slant">Transfers</span></h1>
          </div>
          <div className="tr-money gx-cut" aria-live="polite">
            <small>Club balance</small>
            <strong>{money(balance)}</strong>
            <span className={`tr-window ${window.open ? "is-open" : "is-shut"}`}>
              <i aria-hidden="true" /> {window.label}
            </span>
            <em>{window.note}</em>
          </div>
        </header>

        {recent.length > 0 && (
          <div className="tr-ticker" aria-label="Recent deals">
            <div>
              {[...recent, ...recent].map((d, i) => {
                const p = findPlayer(squads, d.player_id);
                return (
                  <span key={`${d.id}-${i}`}>
                    <b>{d.kind === "buy" ? "IN" : "OUT"}</b> {p?.name ?? "Player"} · {money(d.fee)}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {tab === "targets" && featured.length > 0 && !query && pos === "ALL" && source === "world" && (
          <section className="tr-stars" aria-label="World stars">
            {featured.map((p, i) => {
              const ask = askingPrice(ctx.userId, ctx.season, p, squads[MARKET]);
              return (
                <button key={p.id} type="button" className="tr-star gx-cut" style={{ animationDelay: `${i * 90}ms` }} onClick={() => setBid(p)}>
                  <em className="tr-shine" aria-hidden="true" />
                  <b>{p.rating}</b>
                  <strong>{p.name}</strong>
                  <small>{p.position} · {p.age} · {sellerLabel(p)}</small>
                  <span>From about {money(marketValue(p))}</span>
                  <i aria-hidden="true">{ask > ctx.balanceM ? "Out of budget" : "Make an offer"}</i>
                </button>
              );
            })}
          </section>
        )}

        <p className="tr-rule">Clubs of this league do not sell to you. Sign players from outside the league (the selection changes every two days){roomId ? ", or buy from another manager who put a player up for sale" : ""}.</p>
        {notice && <p className="tr-rule is-warn" role="alert">{notice}</p>}

        <div className="tr-fresh" aria-label="Market refresh">
          <span><i aria-hidden="true" /> New selection in <b>{untilRefresh(nextRefresh(now) - now)}</b></span>
          <span>{onSale.list.length} players on sale</span>
          <span>{onSale.isNew.size} new</span>
          <span>{onSale.leaving.size} leave at the refresh</span>
        </div>

        <nav className="tr-tabs" role="tablist" aria-label="Transfer sections">
          {([
            ["targets", "Targets"],
            ["clubs", "Clubs"],
            ["squad", `My squad${ctx.state.listings.length ? ` (${ctx.state.listings.length} listed)` : ""}`],
            ["deals", "Deals"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-on" : ""} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </nav>

        {tab === "targets" && (
          <section className="tr-panel gx-cut" aria-label="Targets">
            <div className="tr-filters">
              <label className="tr-search">
                <Icon name="search" size={18} />
                <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Search a player" aria-label="Search a player" />
              </label>
              <div className="tr-chips" role="group" aria-label="Position">
                {(["ALL", "GK", "DF", "MF", "FW"] as Pos[]).map((p) => (
                  <button key={p} type="button" className={pos === p ? "is-on" : ""} onClick={() => { setPos(p); setLimit(PAGE); }}>{p === "ALL" ? "All" : p}</button>
                ))}
              </div>
              <div className="tr-chips" role="group" aria-label="Where from">
                {([["world", "World market"], ...(roomId ? [["managers", `Other managers (${mlist.filter((l) => l.seller_id !== ctx.userId).length})`]] : [])] as [Source, string][]).map(([k, l]) => (
                  <button key={k} type="button" className={source === k ? "is-on" : ""} onClick={() => { setSource(k); setLimit(PAGE); }}>{l}</button>
                ))}
              </div>
              <div className="tr-chips" role="group" aria-label="Sort">
                {([["rating", "Rating"], ["value", "Value"], ["age", "Youngest"]] as [Sort, string][]).map(([k, l]) => (
                  <button key={k} type="button" className={sort === k ? "is-on" : ""} onClick={() => setSort(k)}>{l}</button>
                ))}
                <button type="button" className={shortlist ? "is-on" : ""} onClick={() => setShortlist((s) => !s)} aria-pressed={shortlist}>
                  <Icon name="star" size={14} /> Shortlist ({watch.ids.length})
                </button>
              </div>
            </div>

            <ul className="tr-list">
              {targets.slice(0, limit).map((p) => {
                const club = clubs.find((c) => c.id === p.club);
                const watched = watch.ids.includes(p.id);
                return (
                  <li key={p.id}>
                    <div className="tr-row">
                      <b className={`tr-rate ${p.rating >= 85 ? "is-elite" : p.rating >= 78 ? "is-high" : ""}`}>{p.rating}</b>
                      <span className="tr-name">
                        <strong>{p.name}{source === "world" && onSale.isNew.has(p.id) && <em className="tr-tag is-new">New</em>}{source === "world" && onSale.leaving.has(p.id) && <em className="tr-tag is-leaving">Leaving soon</em>}</strong>
                        <small>{p.position} · {p.age} · {p.nationality || "-"}</small>
                      </span>
                      <span className="tr-from">
                        {club ? <img src={club.logo} alt="" /> : <Icon name="pin" size={16} />}
                        {sellerLabel(p)}
                      </span>
                      <span className="tr-val">{originOf(p.id) === "Free" ? "Free agent" : money(marketValue(p))}</span>
                      <button type="button" className={`tr-star-btn ${watched ? "is-on" : ""}`} onClick={() => watch.toggle(p.id)} aria-pressed={watched} aria-label={watched ? `Remove ${p.name} from the shortlist` : `Add ${p.name} to the shortlist`}>
                        <Icon name="star" size={18} />
                      </button>
                      {source === "managers" ? (
                        <button type="button" className="tr-offer" disabled={busy === p.id} onClick={() => buyFromManager(p)}>
                          Buy {money(mlist.find((l) => l.player_id === p.id)?.asking ?? 0)}
                        </button>
                      ) : (
                        <button type="button" className="tr-offer" onClick={() => setBid(p)}>Offer</button>
                      )}
                    </div>
                  </li>
                );
              })}
              {targets.length === 0 && <li className="tr-empty">No player matches this search.</li>}
            </ul>
            {targets.length > limit && (
              <button type="button" className="tr-more" onClick={() => setLimit((l) => l + PAGE)}>Show more ({targets.length - limit} left)</button>
            )}
          </section>
        )}

        {tab === "clubs" && (
          <section className="tr-clubs" aria-label="Clubs">
            {otherClubs.map((c, i) => (
              <Link key={c.id} href={`/game/club/${c.id}`} className="tr-club gx-cut" style={{ animationDelay: `${i * 30}ms` }}>
                <img src={c.logo} alt="" />
                <strong>{c.name}</strong>
                <small>{getTier(c.id) === "elite" ? "Big club" : getTier(c.id) === "mid" ? "Mid-table" : "Smaller club"}</small>
                <span>Team rating <b>{teamRating(squads[c.id] ?? [])}</b></span>
              </Link>
            ))}
          </section>
        )}

        {tab === "squad" && (
          <section className="tr-panel gx-cut" aria-label="My squad">
            {ctx.state.offers.length > 0 && (
              <div className="tr-offers">
                <h2>Offers for your players</h2>
                {ctx.state.offers.map((o) => {
                  const p = mine.find((x) => x.id === o.player_id);
                  const c = clubs.find((x) => x.id === o.club);
                  if (!p) return null;
                  return (
                    <div key={`${o.player_id}-${o.matchday}`} className="tr-offer-row">
                      <span><strong>{c?.name}</strong> bid {money(o.amount)} for <strong>{p.name}</strong></span>
                      <button type="button" className="tr-offer" disabled={busy === p.id || !!canSell(mine, p)} onClick={() => accept(p.id, o.club, o.amount)}>Accept</button>
                    </div>
                  );
                })}
              </div>
            )}

            <ul className="tr-list">
              {mine.slice().sort((a, b) => b.rating - a.rating).map((p) => {
                const listing = ctx.state.listings.find((l) => l.player_id === p.id);
                const mgr = mlist.find((l) => l.seller_id === ctx.userId && l.player_id === p.id);
                return (
                  <li key={p.id}>
                    <div className="tr-row">
                      <b className={`tr-rate ${p.rating >= 85 ? "is-elite" : p.rating >= 78 ? "is-high" : ""}`}>{p.rating}</b>
                      <span className="tr-name">
                        <strong>{p.name}</strong>
                        <small>{p.position} · {p.age} · {p.nationality || "-"}</small>
                      </span>
                      <span className="tr-from">{listing ? `Listed ${money(listing.asking)}` : ""}</span>
                      <span className="tr-val">{money(marketValue(p))}</span>
                      {listing ? (
                        <button type="button" className="tr-offer is-ghost" disabled={busy === listing.id} onClick={() => withdraw(listing.id)}>Withdraw</button>
                      ) : mgr ? (
                        <button type="button" className="tr-offer is-ghost" disabled={busy === mgr.id} onClick={() => withdrawManager(mgr.id)}>Listed to managers {money(mgr.asking)} · Withdraw</button>
                      ) : (
                        <>
                          <button type="button" className="tr-offer is-ghost" onClick={() => setSell(p)}>Sell</button>
                          {roomId && <button type="button" className="tr-offer is-ghost" onClick={() => setSellMgr(p)}>To managers</button>}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="tr-foot">{mine.length} of 35 places used. Listed players: {listedIds.size}.</p>
          </section>
        )}

        {tab === "deals" && (
          <section className="tr-panel gx-cut" aria-label="Deals">
            {ctx.state.deals.length === 0 ? (
              <p className="tr-empty">No deals yet. Your first signing will show here.</p>
            ) : (
              <ul className="tr-list">
                {[...ctx.state.deals].reverse().map((d) => {
                  const p = findPlayer(squads, d.player_id);
                  const other = d.kind === "buy" ? d.from_club : d.to_club;
                  const otherName = clubs.find((c) => c.id === other)?.name ?? (other === MARKET ? "World market" : "Abroad");
                  return (
                    <li key={d.id}>
                      <div className="tr-row is-deal">
                        <b className={`tr-dir ${d.kind}`}>{d.kind === "buy" ? "IN" : "OUT"}</b>
                        <span className="tr-name"><strong>{p?.name ?? "Player"}</strong><small>{d.kind === "buy" ? "from" : "to"} {otherName} · season {d.season}</small></span>
                        <span className="tr-val">{d.kind === "buy" ? "-" : "+"}{money(d.fee)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {bid && (
        <BidModal
          player={bid}
          ask={askingPrice(ctx.userId, ctx.season, bid, squads[bid.club] ?? [])}
          userId={ctx.userId}
          season={ctx.season}
          matchday={ctx.matchday}
          balanceM={ctx.balanceM}
          blocked={blocked}
          onClose={() => setBid(null)}
          onSign={(fee) => sign(bid, fee)}
        />
      )}
      {sellMgr && (
        <SellModal player={sellMgr} warning={canSell(mine, sellMgr)} onClose={() => setSellMgr(null)} onList={(price) => listToManagers(sellMgr, price)} />
      )}
      {sell && (
        <SellModal player={sell} warning={canSell(mine, sell)} onClose={() => setSell(null)} onList={(price) => list(sell, price)} />
      )}
    </main>
  );
}
