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
  type Deal,
} from "@/lib/football/transfers";
import { useTransfers } from "@/lib/football/useTransfers";
import { BidModal, OfferModal, SellModal, money, sellerLabel } from "@/components/TransferModals";
import { myRoom, type RoomMember } from "@/lib/football/rooms";
import { loadOffers, tellAbout, type ManagerOffer } from "@/lib/football/offers";
import GsmMark from "@/components/GsmMark";
import GameHud from "@/components/GameHud";
import Icon from "@/components/Icon";
import "./transfers.css";

type Tab = "buy" | "sell" | "talks" | "clubs" | "news";
type Pos = "ALL" | Position;
type Source = "world" | "league" | "managers";
type MListing = { id: string; room_id: string; seller_id: string; seller_club: string; player_id: string; asking: number; status: string };
type Sort = "rating" | "value" | "age";

const PAGE = 40;
/** what the game pays at once for a player: less than the market value, the price of a quick sale */
const QUICK = 0.75;

function untilRefresh(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

const clubName = (id: string) => clubs.find((c) => c.id === id)?.name ?? (id === MARKET ? "World market" : "Abroad");

export default function TransfersPage() {
  const router = useRouter();
  const { ctx, loading, error, reload } = useTransfers();
  const [tab, setTab] = useState<Tab>("buy");
  const [pos, setPos] = useState<Pos>("ALL");
  const [source, setSource] = useState<Source>("world");
  const [sort, setSort] = useState<Sort>("rating");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [bid, setBid] = useState<Player | null>(null);
  const [sell, setSell] = useState<Player | null>(null);
  const [busy, setBusy] = useState("");
  const [roomId, setRoomId] = useState<string | null>(null);
  const [mlist, setMlist] = useState<MListing[]>([]);
  const [sellMgr, setSellMgr] = useState<Player | null>(null);
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState("");
  const [newsMine, setNewsMine] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [offers, setOffers] = useState<ManagerOffer[]>([]);
  const [offerFor, setOfferFor] = useState<Player | null>(null);
  const [counterId, setCounterId] = useState("");
  const [counterVal, setCounterVal] = useState("");

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

  const loadTalks = useCallback(async (u: string) => {
    setOffers(await loadOffers(supabase, u));
  }, []);
  useEffect(() => {
    if (!uid) return;
    void loadTalks(uid);
    const t = setInterval(() => void loadTalks(uid), 30_000);
    return () => clearInterval(t);
  }, [uid, loadTalks]);
  useEffect(() => {
    if (!roomId) return setMembers([]);
    myRoom(supabase, roomId).then((r) => setMembers(r?.members ?? [])).catch(() => setMembers([]));
  }, [roomId]);

  // the world market is a different selection every two days
  const [now, setNow] = useState(0); // set after mount: Date.now() during the first render breaks static prerendering
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const squads = ctx?.state.squads;
  const mine = useMemo(() => (ctx && squads ? (squads[ctx.clubId] ?? []) : []), [ctx, squads]);
  const window = windowStatus(ctx?.matchday ?? null);
  const leagueId = ctx ? leagueOfClub(ctx.clubId) : "";
  /** clubs another person manages: they answer offers themselves */
  const humans = useMemo(() => new Map<string, RoomMember>(members.filter((m) => m.user_id !== ctx?.userId).map((m) => [m.club_id, m] as [string, RoomMember])), [members, ctx?.userId]);
  const myName = members.find((m) => m.user_id === ctx?.userId)?.name || "A manager";
  const live = useMemo(() => offers.filter((o) => ctx && (o.buyer_club === ctx.clubId || o.seller_club === ctx.clubId)), [offers, ctx]);
  const toAnswer = live.filter((o) => ctx && ((o.status === "open" && o.seller_id === ctx.userId) || (o.status === "countered" && o.buyer_id === ctx.userId))).length;

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
    let all: Player[];
    if (source === "managers") {
      all = mlist.filter((l) => l.seller_id !== ctx.userId).map((l) => findPlayer(squads, l.player_id)).filter(Boolean) as Player[];
    } else if (source === "league") {
      all = clubsOfLeague(leagueId).filter((c) => c.id !== ctx.clubId).flatMap((c) => squads[c.id] ?? []);
    } else {
      all = onSale.list;
    }
    const q = query.trim().toLowerCase();
    return all
      .filter((p) => (pos === "ALL" ? true : p.position === pos))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || (source === "league" && clubName(p.club).toLowerCase().includes(q)) : true))
      .sort((a, b) => (sort === "rating" ? b.rating - a.rating : sort === "value" ? marketValue(b) - marketValue(a) : a.age - b.age));
  }, [ctx, squads, pos, source, sort, query, mlist, onSale, leagueId]);

  /** every transfer of the league: the other clubs' and the manager's own, newest first */
  const news = useMemo(() => {
    if (!ctx) return [];
    const all: (Deal & { mine: boolean })[] = [
      ...ctx.state.aiDeals.map((d) => ({ ...d, mine: false })),
      ...ctx.state.deals.map((d) => ({ ...d, mine: true })),
    ];
    const dayOf = (d: Deal) => (d.matchday === 0 ? 99 : d.matchday);
    return all
      .filter((d) => (newsMine ? d.mine : true))
      .sort((a, b) => b.season.localeCompare(a.season) || dayOf(b) - dayOf(a) || b.created_at.localeCompare(a.created_at));
  }, [ctx, newsMine]);

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
  const otherClubs = clubsOfLeague(leagueId).filter((c) => c.id !== ctx.clubId);

  async function sign(player: Player, fee: number) {
    await recordDeal(supabase, {
      league_id: ctx!.leagueId,
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
      league_id: ctx!.leagueId,
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
        league_id: ctx!.leagueId,
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

  /** sell at once for a lower price: the way to get money before a signing */
  async function quickSell(player: Player) {
    if (confirm !== player.id) {
      setConfirm(player.id);
      return;
    }
    const why = canSell(mine, player);
    if (why) return setNotice(why);
    setConfirm("");
    setBusy(player.id);
    setNotice("");
    try {
      const buyers = otherClubs.filter((c) => (squads![c.id] ?? []).length < 33);
      const buyer = buyers[(player.rating + player.age) % Math.max(1, buyers.length)] ?? otherClubs[0];
      const listing = ctx!.state.listings.find((l) => l.player_id === player.id);
      await recordDeal(supabase, {
        league_id: ctx!.leagueId,
        user_id: ctx!.userId,
        season: ctx!.season,
        player_id: player.id,
        from_club: ctx!.clubId,
        to_club: buyer.id,
        fee: Math.round(marketValue(player) * QUICK * 10) / 10,
        kind: "sell",
        matchday: ctx!.matchday ?? 0,
      });
      if (listing) await supabase.from("transfer_listings").update({ status: "sold" }).eq("id", listing.id);
      await reload();
    } catch (err) {
      console.error(err);
      setNotice("The sale did not go through. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function sendOffer(player: Player, amount: number) {
    const m = humans.get(player.club);
    if (!m || !roomId) throw new Error("no manager");
    const { error: e } = await supabase.from("manager_offers").insert({
      room_id: roomId,
      buyer_id: ctx!.userId,
      buyer_club: ctx!.clubId,
      seller_id: m.user_id,
      seller_club: player.club,
      player_id: player.id,
      amount,
      season: ctx!.season,
    });
    if (e) throw e;
    await tellAbout(supabase, m.user_id, ctx!.userId, myName, ctx!.season, `${myName} offers ${money(amount)} for ${player.name}. Answer in Transfers, Talks.`);
    await loadTalks(ctx!.userId);
  }

  async function answer(o: ManagerOffer, to: "rejected" | "withdrawn" | "countered", counter?: number) {
    setBusy(o.id);
    setNotice("");
    try {
      const patch: Record<string, unknown> = { status: to, updated_at: new Date().toISOString() };
      if (to === "countered") patch.counter = counter;
      const { error: e } = await supabase.from("manager_offers").update(patch).eq("id", o.id);
      if (e) throw e;
      const p = findPlayer(squads!, o.player_id);
      const other = o.seller_id === ctx!.userId ? o.buyer_id : o.seller_id;
      const what = to === "countered" ? `${myName} wants ${money(counter ?? 0)} for ${p?.name ?? "the player"}.` : to === "rejected" ? `${myName} refused your offer for ${p?.name ?? "the player"}.` : `${myName} withdrew the offer for ${p?.name ?? "the player"}.`;
      await tellAbout(supabase, other, ctx!.userId, myName, ctx!.season, what);
      setCounterId("");
      await loadTalks(ctx!.userId);
    } catch (err) {
      console.error(err);
      setNotice("That did not go through. Try again.");
    } finally {
      setBusy("");
    }
  }

  async function acceptOffer(o: ManagerOffer) {
    const selling = o.seller_id === ctx!.userId;
    const price = selling ? o.amount : (o.counter ?? o.amount);
    const p = findPlayer(squads!, o.player_id);
    if (!p) return setNotice("That player is not available any more.");
    const why = selling
      ? (mine.some((x) => x.id === p.id) ? canSell(mine, p) : "He is no longer in your squad.")
      : canBuy({ balance: ctx!.balanceM, fee: price, squadSize: mine.length, windowOpen: window.open });
    if (why) return setNotice(why);
    setBusy(o.id);
    setNotice("");
    try {
      const { error: e } = await supabase.rpc("accept_manager_offer", { p_offer: o.id, p_season: ctx!.season, p_matchday: ctx!.matchday ?? 0 });
      if (e) throw e;
      await tellAbout(supabase, selling ? o.buyer_id : o.seller_id, ctx!.userId, myName, ctx!.season, `${myName} accepted ${money(price)} for ${p.name}. The deal is done.`);
      await reload();
      await loadTalks(ctx!.userId);
    } catch (err) {
      console.error(err);
      setNotice("The deal did not go through. The offer may have been withdrawn, or supabase/020 has not been run.");
    } finally {
      setBusy("");
    }
  }

  const tabs: [Tab, string][] = [
    ["buy", "Buy"],
    ["sell", `Sell${ctx.state.offers.length ? ` (${ctx.state.offers.length})` : ""}`],
    ...(roomId ? ([["talks", `Talks${toAnswer ? ` (${toAnswer})` : ""}`]] as [Tab, string][]) : []),
    ["clubs", "Clubs"],
    ["news", "News"],
  ];
  const sources: [Source, string][] = [
    ["world", "World market"],
    ["league", "League clubs"],
    ...(roomId ? ([["managers", `Managers (${mlist.filter((l) => l.seller_id !== ctx.userId).length})`]] as [Source, string][]) : []),
  ];
  const free = 35 - mine.length;

  return (
    <main className="tr tx">
      <div className="gx-curtain" aria-hidden="true" />
      <div className="tr-bg gx-kb" aria-hidden="true" />
      <div className="tr-shade" aria-hidden="true" />
      <GameHud onBack={() => router.push("/game/dashboard")} />

      <div className="tr-wrap tx-wrap">
        <header className="tx-top">
          <div className="tx-title">
            <h1><span className="gx-slant">Transfers</span></h1>
            <p>{myClub?.name} · {mine.length} players, {free} free places</p>
          </div>
          <div className="tx-bal" aria-live="polite">
            <small>Balance</small>
            <strong>{money(ctx.balanceM)}</strong>
            <span className={`tx-win ${window.open ? "is-open" : "is-shut"}`}><i aria-hidden="true" />{window.label}</span>
          </div>
        </header>

        <nav className="tx-tabs" role="tablist" aria-label="Transfer sections">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-on" : ""} onClick={() => { setTab(key); setNotice(""); setConfirm(""); }}>
              {label}
            </button>
          ))}
        </nav>

        {notice && <p className="tx-note is-warn" role="alert">{notice}</p>}

        {tab === "buy" && (
          <section className="tx-pane" aria-label="Buy players">
            <div className="tx-bar">
              <label className="tx-search">
                <Icon name="search" size={16} />
                <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Search" aria-label="Search a player" />
              </label>
              <div className="tx-chips" role="group" aria-label="Where from">
                {sources.map(([k, l]) => (
                  <button key={k} type="button" className={source === k ? "is-on" : ""} onClick={() => { setSource(k); setLimit(PAGE); }}>{l}</button>
                ))}
              </div>
              <div className="tx-chips" role="group" aria-label="Position">
                {(["ALL", "GK", "DF", "MF", "FW"] as Pos[]).map((p) => (
                  <button key={p} type="button" className={pos === p ? "is-on" : ""} onClick={() => { setPos(p); setLimit(PAGE); }}>{p === "ALL" ? "All" : p}</button>
                ))}
              </div>
              <div className="tx-chips" role="group" aria-label="Sort">
                {([["rating", "Best"], ["value", "Value"], ["age", "Young"]] as [Sort, string][]).map(([k, l]) => (
                  <button key={k} type="button" className={sort === k ? "is-on" : ""} onClick={() => setSort(k)}>{l}</button>
                ))}
              </div>
            </div>

            <p className="tx-hint">
              {source === "world"
                ? <>New selection in <b>{untilRefresh(nextRefresh(now) - now)}</b>. A player you sign leaves the market for everyone.</>
                : source === "league"
                  ? <>Any club can be asked, but a good player costs more. Clubs run by a friend answer themselves: tap Negotiate.</>
                  : <>Players other managers of your league put up for sale.</>}
              {ctx.balanceM < 5 && <> Your balance is low: sell a player first.</>}
            </p>

            <ul className="tx-list">
              {targets.slice(0, limit).map((p) => {
                const club = clubs.find((c) => c.id === p.club);
                const ml = source === "managers" ? mlist.find((l) => l.player_id === p.id) : undefined;
                return (
                  <li key={p.id} className="tx-row">
                    <b className={`tx-rate ${p.rating >= 85 ? "is-elite" : p.rating >= 78 ? "is-high" : ""}`}>{p.rating}</b>
                    <span className="tx-name">
                      <strong>{p.name}{source === "world" && onSale.isNew.has(p.id) && <em className="tr-tag is-new">New</em>}{source === "world" && onSale.leaving.has(p.id) && <em className="tr-tag is-leaving">Leaving soon</em>}</strong>
                      <small>{p.position} · {p.age} · {club ? club.name : sellerLabel(p)}{humans.get(p.club) ? ` · ${humans.get(p.club)?.name ?? "manager"}` : ""}</small>
                    </span>
                    <span className="tx-val">{originOf(p.id) === "Free" ? "Free agent" : money(marketValue(p))}</span>
                    {ml ? (
                      <button type="button" className="tx-btn" disabled={busy === p.id} onClick={() => buyFromManager(p)}>Buy {money(ml.asking)}</button>
                    ) : humans.has(p.club) ? (
                      <button type="button" className="tx-btn" disabled={!window.open} onClick={() => setOfferFor(p)}>Negotiate</button>
                    ) : (
                      <button type="button" className="tx-btn" disabled={!window.open} onClick={() => setBid(p)}>Offer</button>
                    )}
                  </li>
                );
              })}
              {targets.length === 0 && <li className="tx-empty">No player matches. Try another position or clear the search.</li>}
            </ul>
            {targets.length > limit && (
              <button type="button" className="tx-more" onClick={() => setLimit((l) => l + PAGE)}>Show more ({targets.length - limit})</button>
            )}
          </section>
        )}

        {tab === "sell" && (
          <section className="tx-pane" aria-label="Sell players">
            <p className="tx-hint">
              <b>Sell now</b> pays {Math.round(QUICK * 100)}% of the value at once. <b>List</b> asks for more, but clubs answer over the next matchdays.
              {!window.open && <> The window is closed, so players can only be listed.</>}
            </p>

            {ctx.state.offers.length > 0 && (
              <div className="tx-offers">
                {ctx.state.offers.map((o) => {
                  const p = mine.find((x) => x.id === o.player_id);
                  if (!p) return null;
                  return (
                    <div key={`${o.player_id}-${o.matchday}`} className="tx-offer">
                      <span><strong>{clubName(o.club)}</strong> offer {money(o.amount)} for <strong>{p.name}</strong></span>
                      <button type="button" className="tx-btn" disabled={busy === p.id || !!canSell(mine, p)} onClick={() => accept(p.id, o.club, o.amount)}>Accept</button>
                    </div>
                  );
                })}
              </div>
            )}

            <ul className="tx-list">
              {mine.slice().sort((a, b) => b.rating - a.rating).map((p) => {
                const listing = ctx.state.listings.find((l) => l.player_id === p.id);
                const mgr = mlist.find((l) => l.seller_id === ctx.userId && l.player_id === p.id);
                const quick = Math.round(marketValue(p) * QUICK * 10) / 10;
                return (
                  <li key={p.id} className="tx-row is-sell">
                    <b className={`tx-rate ${p.rating >= 85 ? "is-elite" : p.rating >= 78 ? "is-high" : ""}`}>{p.rating}</b>
                    <span className="tx-name">
                      <strong>{p.name}</strong>
                      <small>{p.position} · {p.age}{listing ? ` · listed ${money(listing.asking)}` : mgr ? ` · listed to managers ${money(mgr.asking)}` : ""}</small>
                    </span>
                    <span className="tx-val">{money(marketValue(p))}</span>
                    <span className="tx-acts">
                      {listing ? (
                        <button type="button" className="tx-btn is-ghost" disabled={busy === listing.id} onClick={() => withdraw(listing.id)}>Withdraw</button>
                      ) : mgr ? (
                        <button type="button" className="tx-btn is-ghost" disabled={busy === mgr.id} onClick={() => withdrawManager(mgr.id)}>Withdraw</button>
                      ) : (
                        <>
                          <button type="button" className="tx-btn is-ghost" onClick={() => setSell(p)}>List</button>
                          {roomId && <button type="button" className="tx-btn is-ghost" onClick={() => setSellMgr(p)}>Managers</button>}
                        </>
                      )}
                      <button type="button" className={`tx-btn ${confirm === p.id ? "is-sure" : ""}`} disabled={busy === p.id || !window.open} onClick={() => quickSell(p)}>
                        {confirm === p.id ? `Confirm ${money(quick)}` : `Sell now ${money(quick)}`}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tab === "talks" && (
          <section className="tx-pane" aria-label="Talks with managers">
            <p className="tx-hint">Offers between you and the other managers of your league. Whoever gets an offer can accept it, refuse it, or ask for another price.</p>
            <ul className="tx-list">
              {live.map((o) => {
                const p = findPlayer(squads, o.player_id);
                const selling = o.seller_id === ctx.userId;
                const m = humans.get(selling ? o.buyer_club : o.seller_club);
                const who = m?.name || clubName(selling ? o.buyer_club : o.seller_club);
                const closed = o.status === "accepted" || o.status === "rejected" || o.status === "withdrawn";
                const line = o.status === "open"
                  ? selling ? `${who} offers ${money(o.amount)}` : `Waiting for ${who} · you offered ${money(o.amount)}`
                  : o.status === "countered"
                    ? selling ? `Waiting for ${who} · you ask ${money(o.counter ?? 0)}` : `${who} asks ${money(o.counter ?? 0)} (you offered ${money(o.amount)})`
                    : o.status === "accepted" ? `Deal done at ${money(o.counter ?? o.amount)}` : o.status === "rejected" ? "Refused" : "Withdrawn";
                const myTurn = (o.status === "open" && selling) || (o.status === "countered" && !selling);
                return (
                  <li key={o.id} className={`tx-row is-talk ${closed ? "is-closed" : ""}`}>
                    <b className="tx-rate">{p?.rating ?? "-"}</b>
                    <span className="tx-name">
                      <strong>{p?.name ?? "Player"}<em className={`tr-tag ${selling ? "is-leaving" : "is-new"}`}>{selling ? "Selling" : "Buying"}</em></strong>
                      <small>{line}</small>
                    </span>
                    <span className="tx-acts">
                      {myTurn && counterId !== o.id && (
                        <>
                          <button type="button" className="tx-btn" disabled={busy === o.id} onClick={() => acceptOffer(o)}>Accept</button>
                          {selling && <button type="button" className="tx-btn is-ghost" onClick={() => { setCounterId(o.id); setCounterVal(String(Math.round(o.amount * 1.2 * 10) / 10)); }}>Ask more</button>}
                          <button type="button" className="tx-btn is-ghost" disabled={busy === o.id} onClick={() => answer(o, selling ? "rejected" : "withdrawn")}>{selling ? "Refuse" : "Walk away"}</button>
                        </>
                      )}
                      {myTurn && counterId === o.id && (
                        <>
                          <span className="tx-counter">€<input inputMode="decimal" value={counterVal} onChange={(e) => setCounterVal(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Your price in millions" />M</span>
                          <button type="button" className="tx-btn" disabled={busy === o.id || !(Number(counterVal) > 0)} onClick={() => answer(o, "countered", Math.round(Number(counterVal) * 10) / 10)}>Send</button>
                          <button type="button" className="tx-btn is-ghost" onClick={() => setCounterId("")}>Cancel</button>
                        </>
                      )}
                      {!myTurn && !closed && !selling && (
                        <button type="button" className="tx-btn is-ghost" disabled={busy === o.id} onClick={() => answer(o, "withdrawn")}>Withdraw</button>
                      )}
                    </span>
                  </li>
                );
              })}
              {live.length === 0 && <li className="tx-empty">No talks yet. In Buy, choose League clubs and tap Negotiate on a player of a club run by a friend.</li>}
            </ul>
          </section>
        )}

        {tab === "clubs" && (
          <section className="tx-clubs" aria-label="Clubs">
            {otherClubs.map((c) => (
              <Link key={c.id} href={`/game/club/${c.id}`} className="tx-club">
                <img src={c.logo} alt="" />
                <span>
                  <strong>{c.name}</strong>
                  <small>{getTier(c.id) === "elite" ? "Big club" : getTier(c.id) === "mid" ? "Mid-table" : "Smaller club"} · rating {teamRating(squads[c.id] ?? [])}</small>
                </span>
              </Link>
            ))}
          </section>
        )}

        {tab === "news" && (
          <section className="tx-pane" aria-label="League transfers">
            <div className="tx-bar">
              <div className="tx-chips" role="group" aria-label="Show">
                <button type="button" className={!newsMine ? "is-on" : ""} onClick={() => { setNewsMine(false); setLimit(PAGE); }}>All clubs</button>
                <button type="button" className={newsMine ? "is-on" : ""} onClick={() => { setNewsMine(true); setLimit(PAGE); }}>My deals</button>
              </div>
            </div>
            <ul className="tx-list">
              {news.slice(0, limit).map((d) => {
                const p = findPlayer(squads, d.player_id);
                const from = clubs.find((c) => c.id === d.from_club);
                const to = clubs.find((c) => c.id === d.to_club);
                const mineDeal = d.mine;
                return (
                  <li key={d.id} className={`tx-row is-news ${mineDeal ? "is-mine" : ""}`}>
                    <b className="tx-rate">{p?.rating ?? "-"}</b>
                    <span className="tx-name">
                      <strong>{p?.name ?? "Player"}{mineDeal && <em className="tr-tag is-new">{d.kind === "buy" ? "Signed" : "Sold"}</em>}</strong>
                      <small>{d.matchday === 0 ? "Off-season" : `Matchday ${d.matchday}`} · {d.season.replace("-20", "/")}</small>
                    </span>
                    <span className="tx-move">
                      {from ? <img src={from.logo} alt="" /> : <i aria-hidden="true" />}
                      <small>{clubName(d.from_club)}</small>
                      <Icon name="arrow-right" size={14} />
                      {to ? <img src={to.logo} alt="" /> : <i aria-hidden="true" />}
                      <small>{clubName(d.to_club)}</small>
                    </span>
                    <span className="tx-val">{money(d.fee)}</span>
                  </li>
                );
              })}
              {news.length === 0 && <li className="tx-empty">No transfers yet. The clubs start trading when the window opens.</li>}
            </ul>
            {news.length > limit && (
              <button type="button" className="tx-more" onClick={() => setLimit((l) => l + PAGE)}>Show more ({news.length - limit})</button>
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
      {offerFor && (
        <OfferModal
          player={offerFor}
          manager={humans.get(offerFor.club)?.name || clubName(offerFor.club)}
          balanceM={ctx.balanceM}
          blocked={blocked}
          onClose={() => setOfferFor(null)}
          onSend={(amount) => sendOffer(offerFor, amount)}
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
