"use client";

import Flag from "@/components/Flag";
import { signingBan } from "@/lib/football/bank";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allClubs as clubs, clubsOfLeague, leagueOfClub } from "@/lib/football/leagueClubs";
import { getTier } from "@/lib/football/finance";
import { marketValue, teamRating, type Player, type Position } from "@/lib/football/squads";
import { hiddenOrigin, nextRefresh, originOf, visibleMarket, visibleRegional } from "@/lib/football/market";
import {
  MARKET,
  askingPrice,
  worldPrice,
  canBuy,
  foreignBlock,
  canSell,
  findPlayer,
  recordDeal,
  windowStatus,
  MIN_BY_POSITION,
  worldBuyers,
  dueSale,
} from "@/lib/football/transfers";
import { useTransfers } from "@/lib/football/useTransfers";
import { BidModal, OfferModal, SellModal, money, sellerLabel } from "@/components/TransferModals";
import { myRoom, type RoomMember } from "@/lib/football/rooms";
import { loadOffers, tellAbout, type ManagerOffer } from "@/lib/football/offers";
import {
  acceptOffer as dbAccept, answerOffer, buyNow, dealError, listPlayer, loadListings, loadLog, makeOffer, sellToComputer, signFromClub, withdrawListing,
  type DealCtx, type LogRow, type ManagerListing,
} from "@/lib/football/dealing";
import PlayerFace from "@/components/PlayerFace";
import GsmMark from "@/components/GsmMark";
import DxBar from "@/components/DxBar";
import Icon from "@/components/Icon";
import "./transfers.css";

import { nowMs } from "@/lib/serverTime";
type Tab = "market" | "talks" | "clubs" | "windows";
type MView = "sale" | "world" | "mine";
type Pos = "ALL" | Position;
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
const tierLabel = (id: string) => (getTier(id) === "elite" ? "Big club" : getTier(id) === "mid" ? "Mid-table" : "Smaller club");
const dateOf = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };

export default function TransfersPage() {
  const router = useRouter();
  const { ctx, loading, error, reload } = useTransfers();
  const [tab, setTab] = useState<Tab>("market");
  const [view, setView] = useState<MView>("sale");
  const [pos, setPos] = useState<Pos>("ALL");
  const [sort, setSort] = useState<Sort>("rating");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [bid, setBid] = useState<Player | null>(null);
  const [sell, setSell] = useState<Player | null>(null);
  const [busy, setBusy] = useState("");
  const [mlist, setMlist] = useState<ManagerListing[]>([]);
  const [notice, setNotice] = useState("");
  const [good, setGood] = useState("");

  // good news disappears by itself; a problem stays until you close it
  useEffect(() => {
    if (!good) return;
    const id = setTimeout(() => setGood(""), 5000);
    return () => clearTimeout(id);
  }, [good]);
  const [confirm, setConfirm] = useState("");
  const [logMine, setLogMine] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [offers, setOffers] = useState<ManagerOffer[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [offerFor, setOfferFor] = useState<{ player: Player; asking?: number } | null>(null);
  const [counterId, setCounterId] = useState("");
  const [counterVal, setCounterVal] = useState("");
  const [openClub, setOpenClub] = useState<string | null>(null);

  const uid = ctx?.userId;
  const roomId = ctx?.roomId ?? null;

  const refreshShared = useCallback(async (u: string, rid: string | null) => {
    setOffers(await loadOffers(supabase, u));
    if (!rid) { setMlist([]); setLog([]); return; }
    const [l, g] = await Promise.all([loadListings(supabase, rid), loadLog(supabase, rid)]);
    setMlist(l);
    setLog(g);
  }, []);
  useEffect(() => {
    if (!uid) return;
    void refreshShared(uid, roomId);
    const t = setInterval(() => void refreshShared(uid, roomId), 15_000);
    return () => clearInterval(t);
  }, [uid, roomId, refreshShared]);
  useEffect(() => {
    if (!roomId) return setMembers([]);
    myRoom(supabase, roomId).then((r) => setMembers(r?.members ?? [])).catch(() => setMembers([]));
  }, [roomId]);

  // the world market is a different selection every two days
  const [now, setNow] = useState(0); // set after mount: nowMs() during the first render breaks static prerendering
  useEffect(() => {
    setNow(nowMs());
    const t = setInterval(() => setNow(nowMs()), 60_000);
    return () => clearInterval(t);
  }, []);

  const squads = ctx?.state.squads;
  const mine = useMemo(() => (ctx && squads ? (squads[ctx.clubId] ?? []) : []), [ctx, squads]);
  const window = windowStatus(ctx?.matchday ?? null);
  const leagueId = ctx ? leagueOfClub(ctx.clubId) : "";
  // Egypt: its clubs trade between themselves, and the market is African and Arab players only
  const egyptOnly = leagueId === "egyptian-premier-league";
  useEffect(() => {
    if (!egyptOnly || roomId) return;
    setView((v) => (v === "sale" ? "world" : v));
  }, [egyptOnly, roomId]);
  /** clubs another person manages: they answer offers themselves */
  const humans = useMemo(() => new Map<string, RoomMember>(members.filter((m) => m.user_id !== ctx?.userId).map((m) => [m.club_id, m] as [string, RoomMember])), [members, ctx?.userId]);
  const myName = members.find((m) => m.user_id === ctx?.userId)?.name || "A manager";

  // a shared league: a listed player is also sold to a computer club on the day, like in a solo league
  const settling = useRef(new Set<string>());
  useEffect(() => {
    if (!ctx || !roomId || members.length === 0 || mlist.length === 0) return;
    const humanClubs = new Set(members.map((m) => m.club_id));
    const nowT = nowMs();
    for (const l of mlist) {
      if (l.seller_id !== ctx.userId || settling.current.has(l.id)) continue;
      const player = mine.find((p) => p.id === l.player_id);
      if (!player || canSell(mine, player)) continue;
      const sale = dueSale(ctx.userId, l, player, ctx.clubId, nowT, humanClubs);
      if (!sale) continue;
      settling.current.add(l.id);
      sellToComputer(supabase, l.id, sale.club, sale.fee, ctx.season, ctx.matchday ?? 0)
        .then(async () => {
          await reload();
          await refreshShared(ctx.userId, roomId);
        })
        .catch((err) => { console.error("Computer sale failed (run 038_sell_listing_to_computer.sql?):", err); }); // not retried until the page is opened again
    }
  }, [ctx, roomId, members, mlist, mine, reload, refreshShared]);
  const toAnswer = offers.filter((o) => ctx && ((o.status === "open" && o.seller_id === ctx.userId) || (o.status === "countered" && o.buyer_id === ctx.userId))).length;
  const listingOf = useMemo(() => new Map(mlist.map((l) => [l.player_id, l])), [mlist]);

  const onSale = useMemo(() => {
    if (!ctx || !squads) return { list: [] as Player[], isNew: new Set<string>(), leaving: new Set<string>() };
    const stock = new Map((squads[MARKET] ?? []).map((p) => [p.id, p]));
    const hide = hiddenOrigin(leagueId);
    // the Egyptian league signs African and Arab players only (and trades inside the league)
    const entries = (now ? (leagueId === "egyptian-premier-league" ? visibleRegional(now) : visibleMarket(now)) : []).filter((e) => stock.has(e.player.id) && e.player.origin !== hide);
    return {
      list: entries.map((e) => stock.get(e.player.id)!),
      isNew: new Set(entries.filter((e) => e.isNew).map((e) => e.player.id)),
      leaving: new Set(entries.filter((e) => e.leaving).map((e) => e.player.id)),
    };
  }, [ctx, squads, now, leagueId]);

  const targets = useMemo(() => {
    if (!ctx || !squads) return [];
    let all: Player[];
    if (view === "sale") all = mlist.map((l) => findPlayer(squads, l.player_id)).filter(Boolean) as Player[];
    else all = onSale.list;
    const q = query.trim().toLowerCase();
    return all
      .filter((p) => (pos === "ALL" ? true : p.position === pos))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) || clubName(p.club).toLowerCase().includes(q) : true))
      .sort((a, b) => (sort === "rating" ? b.rating - a.rating : sort === "value" ? marketValue(b) - marketValue(a) : a.age - b.age));
  }, [ctx, squads, pos, view, sort, query, mlist, onSale]);

  /** every transfer of the league, newest first: the managers' shared record, plus the computer clubs' trades */
  const rows = useMemo(() => {
    if (!ctx) return [];
    type Row = { id: string; player_id: string; from: string; to: string; fee: number; season: string; matchday: number; at: string; mine: boolean; ai: boolean };
    const shared: Row[] = log.map((r) => ({ id: r.id, player_id: r.player_id, from: r.from_club, to: r.to_club, fee: r.fee, season: r.season, matchday: r.matchday, at: r.created_at, mine: r.from_club === ctx.clubId || r.to_club === ctx.clubId, ai: false }));
    const seen = new Set(shared.map((r) => `${r.player_id}|${r.at.slice(0, 16)}`));
    const own: Row[] = roomId
      ? []
      : ctx.state.deals.map((d) => ({ id: d.id, player_id: d.player_id, from: d.from_club, to: d.to_club, fee: d.fee, season: d.season, matchday: d.matchday, at: d.created_at, mine: true, ai: false }));
    const ai: Row[] = ctx.state.aiDeals.filter((d) => !seen.has(`${d.player_id}|${String(d.created_at).slice(0, 16)}`)).map((d) => ({ id: d.id, player_id: d.player_id, from: d.from_club, to: d.to_club, fee: d.fee, season: d.season, matchday: d.matchday, at: d.created_at, mine: false, ai: true }));
    const dayOf = (r: Row) => (r.matchday === 0 ? 99 : r.matchday);
    return [...shared, ...own, ...ai]
      .filter((r) => (logMine ? r.mine : true))
      .sort((a, b) => b.season.localeCompare(a.season) || dayOf(b) - dayOf(a) || b.at.localeCompare(a.at));
  }, [ctx, log, logMine, roomId]);

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
  const blocked = canBuy({ ban: signingBan(ctx.state.bank), balance: ctx.spendM, fee: 0, squadSize: mine.length, windowOpen: window.open });
  const otherClubs = clubsOfLeague(leagueId).filter((c) => c.id !== ctx.clubId);
  const dctx: DealCtx = { roomId, userId: ctx.userId, clubId: ctx.clubId, leagueId: ctx.leagueId, season: ctx.season, matchday: ctx.matchday, spendM: ctx.spendM, squadSize: mine.length };
  const free = 35 - mine.length;

  /** runs one deal, shows the database's own answer, and refreshes everything from the database */
  async function run(key: string, work: () => Promise<string | void>) {
    setBusy(key);
    setNotice("");
    setGood("");
    try {
      const done = await work();
      await reload();
      await refreshShared(ctx!.userId, roomId);
      if (done) setGood(done);
    } catch (err) {
      console.error(err);
      setNotice(dealError(err));
      await refreshShared(ctx!.userId, roomId);
    } finally {
      setBusy("");
      setConfirm("");
    }
  }

  async function sign(player: Player, fee: number) {
    const fb = foreignBlock(ctx!.clubId, mine, player);
    if (fb) throw new Error(fb);
    await signFromClub(supabase, dctx, player, fee);
    await reload();
    await refreshShared(ctx!.userId, roomId);
  }

  /** the world market: the player is signed at once for his base price, no offer to make */
  function buyWorld(player: Player) {
    const fee = worldPrice(ctx!.userId, ctx!.season, player);
    const why = canBuy({ ban: signingBan(ctx!.state.bank), balance: ctx!.spendM, fee, squadSize: mine.length, windowOpen: window.open });
    if (why) return setNotice(why);
    const fb = foreignBlock(ctx!.clubId, mine, player);
    if (fb) return setNotice(fb);
    void run(player.id, async () => {
      await sign(player, fee);
      return `${player.name} is yours. ${money(fee)} paid.`;
    });
  }

  function buyListed(l: ManagerListing) {
    const p = findPlayer(squads!, l.player_id);
    const why = canBuy({ ban: signingBan(ctx!.state.bank), balance: ctx!.spendM, fee: l.asking, squadSize: mine.length, windowOpen: window.open });
    if (why) return setNotice(why);
    const fb = foreignBlock(ctx!.clubId, mine, p);
    if (fb) return setNotice(fb);
    if (confirm !== l.id) return setConfirm(l.id);
    void run(l.id, async () => {
      await buyNow(supabase, dctx, l);
      const seller = humans.get(l.seller_club);
      if (seller) await tellAbout(supabase, seller.user_id, ctx!.userId, myName, ctx!.season, `${myName} bought ${p?.name ?? "your player"} for ${money(l.asking)}.`);
      return `${p?.name ?? "The player"} is yours. ${money(l.asking)} paid.`;
    });
  }

  async function listForSale(player: Player, asking: number) {
    if (roomId) {
      await listPlayer(supabase, roomId, player.id, asking);
      await refreshShared(ctx!.userId, roomId);
      return;
    }
    const { error: e } = await supabase.from("transfer_listings").insert({ league_id: ctx!.leagueId, user_id: ctx!.userId, season: ctx!.season, player_id: player.id, asking, listed_matchday: ctx!.matchday ?? 0 });
    if (e) throw e;
    await reload();
  }

  function withdraw(player: Player) {
    const m = listingOf.get(player.id);
    const l = ctx!.state.listings.find((x) => x.player_id === player.id);
    void run(player.id, async () => {
      if (m && m.seller_id === ctx!.userId) await withdrawListing(supabase, m.id);
      else if (l) { const { error: e } = await supabase.from("transfer_listings").update({ status: "withdrawn" }).eq("id", l.id); if (e) throw e; }
    });
  }

  function acceptComputerOffer(playerId: string, club: string, amount: number) {
    const listing = ctx!.state.listings.find((l) => l.player_id === playerId);
    const player = mine.find((p) => p.id === playerId);
    if (!listing || !player || canSell(mine, player)) return;
    void run(playerId, async () => {
      await recordDeal(supabase, { league_id: ctx!.leagueId, user_id: ctx!.userId, season: ctx!.season, player_id: playerId, from_club: ctx!.clubId, to_club: club, fee: amount, kind: "sell", matchday: ctx!.matchday ?? 0 });
      await supabase.from("transfer_listings").update({ status: "sold" }).eq("id", listing.id);
      return `${player.name} sold for ${money(amount)}.`;
    });
  }

  /** sell at once for a lower price: the way to get money before a signing */
  function quickSell(player: Player) {
    const why = canSell(mine, player);
    if (why) return setNotice(why);
    if (!window.open) return setNotice("The transfer window is closed.");
    // any club in the world can be the buyer, not only the clubs of this league
    const buyers = worldBuyers(ctx!.clubId).filter((c) => !humans.has(c.id));
    const buyer = buyers[Math.floor(Math.random() * buyers.length)] ?? buyers[0];
    const fee = Math.round(marketValue(player) * QUICK * 10) / 10;
    void run(player.id, async () => {
      await recordDeal(supabase, { league_id: ctx!.leagueId, user_id: ctx!.userId, season: ctx!.season, player_id: player.id, from_club: ctx!.clubId, to_club: buyer.id, fee, kind: "sell", matchday: ctx!.matchday ?? 0 });
      const own = ctx!.state.listings.find((l) => l.player_id === player.id);
      if (own) await supabase.from("transfer_listings").update({ status: "sold" }).eq("id", own.id);
      const mgr = listingOf.get(player.id);
      if (mgr && mgr.seller_id === ctx!.userId) await withdrawListing(supabase, mgr.id).catch(() => undefined);
      return `${player.name} sold for ${money(fee)}.`;
    });
  }

  async function sendOffer(player: Player, amount: number) {
    const m = humans.get(player.club);
    if (!m) throw new Error("That club is run by the computer: use a normal offer.");
    const fb = foreignBlock(ctx!.clubId, mine, player);
    if (fb) throw new Error(fb);
    await makeOffer(supabase, dctx, player.id, amount);
    await tellAbout(supabase, m.user_id, ctx!.userId, myName, ctx!.season, `${myName} offers ${money(amount)} for ${player.name}. Answer in Transfers, Negotiations.`);
    await refreshShared(ctx!.userId, roomId);
  }

  function answer(o: ManagerOffer, action: "reject" | "counter" | "withdraw", counter?: number) {
    const p = findPlayer(squads!, o.player_id);
    const other = o.seller_id === ctx!.userId ? o.buyer_id : o.seller_id;
    void run(o.id, async () => {
      await answerOffer(supabase, o.id, action, counter);
      const what = action === "counter" ? `${myName} wants ${money(counter ?? 0)} for ${p?.name ?? "the player"}.` : action === "reject" ? `${myName} refused the offer for ${p?.name ?? "the player"}.` : `${myName} withdrew the offer for ${p?.name ?? "the player"}.`;
      await tellAbout(supabase, other, ctx!.userId, myName, ctx!.season, what);
      setCounterId("");
    });
  }

  function acceptNegotiation(o: ManagerOffer) {
    const selling = o.seller_id === ctx!.userId;
    const price = selling ? o.amount : (o.counter ?? o.amount);
    const p = findPlayer(squads!, o.player_id);
    if (!p) return setNotice("That player is not available any more.");
    const why = selling
      ? (mine.some((x) => x.id === p.id) ? canSell(mine, p) : "He is no longer in your squad.")
      : canBuy({ ban: signingBan(ctx!.state.bank), balance: ctx!.spendM, fee: price, squadSize: mine.length, windowOpen: window.open });
    if (why) return setNotice(why);
    const fb = selling ? null : foreignBlock(ctx!.clubId, mine, p);
    if (fb) return setNotice(fb);
    void run(o.id, async () => {
      await dbAccept(supabase, dctx, o.id, o.room_id, o.player_id, o.buyer_club);
      await tellAbout(supabase, selling ? o.buyer_id : o.seller_id, ctx!.userId, myName, ctx!.season, `${myName} accepted ${money(price)} for ${p.name}. The deal is done.`);
      return `Deal done: ${p.name} for ${money(price)}.`;
    });
  }

  const tabs: [Tab, string][] = [
    ["market", `Transfer Market${mlist.filter((l) => l.seller_id !== ctx.userId).length ? ` (${mlist.filter((l) => l.seller_id !== ctx.userId).length})` : ""}`],
    ["talks", `Negotiations${toAnswer ? ` (${toAnswer})` : ""}`],
    ["clubs", "Clubs"],
    ["windows", "Transfer Windows"],
  ];
  const internal = leagueId === "egyptian-premier-league";
  const views: [MView, string][] = [
    ["sale", `For sale (${mlist.length})`],
    ["world", internal ? "Africa & Arab market" : "World market"],
    ["mine", "My players"],
  ];
  const posChips = (
    <div className="tx-chips" role="group" aria-label="Position">
      {(["ALL", "GK", "DF", "MF", "FW"] as Pos[]).map((x) => (
        <button key={x} type="button" className={pos === x ? "is-on" : ""} onClick={() => { setPos(x); setLimit(PAGE); }}>{x === "ALL" ? "All" : x}</button>
      ))}
    </div>
  );

  /** one player of the list: rating, name, and what to do with him */
  const rateCls = (p: Player) => `tx-rate ${p.rating >= 85 ? "is-elite" : p.rating >= 78 ? "is-high" : ""}`;

  const clubPlayers = openClub ? (squads[openClub] ?? []).slice().sort((a, b) => b.rating - a.rating) : [];
  const openMeta = openClub ? clubs.find((c) => c.id === openClub) : undefined;
  const openHuman = openClub ? humans.get(openClub) : undefined;

  return (
    <main className="tr tx dxp">
      <DxBar title="Transfers" onBack={() => router.push("/game/dashboard")} />

      <div className="tr-wrap tx-wrap">
        <header className="tx-top">
          <div className="tx-title">
            <h1><span className="gx-slant">Transfers</span></h1>
            <p>{myClub?.name} · {mine.length} players, {free} free places</p>
          </div>
          <div className="tx-bal" aria-live="polite">
            <small>Balance</small>
            <strong>{money(ctx.balanceM)}</strong>
            {ctx.state.bank.noSigning && (
              <Link href="/game/bank" className="tx-frozen">Bank freeze: {money(ctx.spendM)} spendable, signings banned</Link>
            )}
            <span className={`tx-win ${window.open ? "is-open" : "is-shut"}`}><i aria-hidden="true" />{window.label}</span>
          </div>
        </header>

        <nav className="tx-tabs" role="tablist" aria-label="Transfer sections">
          {tabs.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? "is-on" : ""} onClick={() => { setTab(key); setNotice(""); setGood(""); setConfirm(""); setLimit(PAGE); }}>
              {label}
            </button>
          ))}
        </nav>

        {!window.open && tab === "market" && (
          <p className="tx-closed" role="status">
            <b>The transfer window is closed.</b> {window.note} You can still list a player for sale, and every deal you started stays open.
          </p>
        )}

        {(notice || good) && (
          <div className={`tx-toast ${notice ? "is-warn" : "is-good"}`} role={notice ? "alert" : "status"} aria-live={notice ? "assertive" : "polite"}>
            <p>{notice || good}</p>
            <button type="button" aria-label="Close message" onClick={() => { setNotice(""); setGood(""); }}>Close</button>
          </div>
        )}

        {tab === "market" && (
          <section className="tx-pane" aria-label="Transfer market">
            <div className="tx-bar">
              <div className="tx-chips" role="group" aria-label="Market">
                {views.map(([k, l]) => (
                  (k !== "sale" || roomId) && <button key={k} type="button" className={view === k ? "is-on" : ""} onClick={() => { setView(k); setLimit(PAGE); setConfirm(""); }}>{l}</button>
                ))}
              </div>
              {view !== "mine" && (
                <>
                  <label className="tx-search">
                    <Icon name="search" size={16} />
                    <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Search players" aria-label="Search a player" />
                  </label>
                  {posChips}
                  <div className="tx-chips" role="group" aria-label="Sort">
                    {([["rating", "Best"], ["value", "Value"], ["age", "Young"]] as [Sort, string][]).map(([k, l]) => (
                      <button key={k} type="button" className={sort === k ? "is-on" : ""} onClick={() => setSort(k)}>{l}</button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {view === "sale" && (
              <>
                <p className="tx-hint">Players the managers of your league have put up for sale. <b>Buy now</b> pays the asking price and the player is yours at once. <b>Make offer</b> sends a different price to his manager: you will answer each other in Negotiations.</p>
                <ul className="tx-list">
                  {targets.slice(0, limit).map((p) => {
                    const l = listingOf.get(p.id)!;
                    const own = l.seller_id === ctx.userId;
                    const seller = humans.get(l.seller_club);
                    return (
                      <li key={l.id} className="tx-row is-market">
                        <b className={rateCls(p)}><PlayerFace player={p} className="tx-face" /><i>{p.rating}</i></b>
                        <span className="tx-name">
                          <strong><Flag code={p.nationality} />{p.name}<em className="tr-tag is-new">For sale</em></strong>
                          <small>{p.position} · {p.age} · {clubName(l.seller_club)}{seller ? ` · ${seller.name}` : own ? " · you" : ""} · value {money(marketValue(p))}</small>
                        </span>
                        <span className="tx-price"><small>Asking</small><b>{money(l.asking)}</b></span>
                        <span className="tx-acts">
                          {own ? (
                            <button type="button" className="tx-btn is-ghost" disabled={busy === p.id} onClick={() => withdraw(p)}>Withdraw</button>
                          ) : (
                            <>
                              <button type="button" className="tx-btn is-ghost" disabled={!window.open || busy === l.id} onClick={() => setOfferFor({ player: p, asking: l.asking })}>Make offer</button>
                              <button type="button" className={`tx-btn ${confirm === l.id ? "is-sure" : ""}`} disabled={busy === l.id || !window.open} onClick={() => buyListed(l)}>
                                {busy === l.id ? "Buying..." : confirm === l.id ? `Confirm ${money(l.asking)}` : "Buy now"}
                              </button>
                            </>
                          )}
                        </span>
                      </li>
                    );
                  })}
                  {targets.length === 0 && <li className="tx-empty">{mlist.length ? "No listed player matches your filters." : "Nobody has listed a player yet. List one of yours in My players, or open a club in Clubs and send an offer."}</li>}
                </ul>
              </>
            )}

            {view === "world" && (
              <>
                <p className="tx-hint">
                  {internal ? "Players of the African clubs and Arab professionals." : "Free agents and players from abroad."} New selection in <b>{untilRefresh(nextRefresh(now) - now)}</b>. Buy a player at his base price: he is yours at once and leaves the market for everyone.
                  {ctx.balanceM < 5 && <> Your balance is low: sell a player first.</>}
                </p>
                <ul className="tx-list">
                  {targets.slice(0, limit).map((p) => {
                    const club = clubs.find((c) => c.id === p.club);
                    return (
                      <li key={p.id} className="tx-row">
                        <b className={rateCls(p)}><PlayerFace player={p} className="tx-face" /><i>{p.rating}</i></b>
                        <span className="tx-name">
                          <strong><Flag code={p.nationality} />{p.name}{onSale.isNew.has(p.id) && <em className="tr-tag is-new">New</em>}{onSale.leaving.has(p.id) && <em className="tr-tag is-leaving">Leaving soon</em>}</strong>
                          <small>{p.position} · {p.age} · {club ? club.name : sellerLabel(p)}</small>
                        </span>
                        <span className="tx-val">{originOf(p.id) === "Free" ? "Free agent" : "Base price"}</span>
                        <button type="button" className="tx-btn" disabled={!window.open || busy === p.id} onClick={() => buyWorld(p)}>{busy === p.id ? "Signing..." : `Buy ${money(worldPrice(ctx.userId, ctx.season, p))}`}</button>
                      </li>
                    );
                  })}
                  {targets.length === 0 && <li className="tx-empty">No player matches. Try another position or clear the search.</li>}
                </ul>
              </>
            )}

            {view === "mine" && (
              <>
                <p className="tx-hint">
                  <b>List</b> sets your asking price: {roomId ? "every manager of the league sees it, can buy at that price at once, or send you an offer" : "he stays on the market until midnight (Cairo time) and can be sold at any moment of the day; use Sell now for an instant sale"}. <b>Sell now</b> pays {Math.round(QUICK * 100)}% of the value at once. A listed player stays in your squad until a deal is done.
                  {!window.open && <> The window is closed, so players can only be listed.</>}
                </p>
                {ctx.state.offers.length > 0 && (
                  <div className="tx-offers">
                    {ctx.state.offers.map((o) => {
                      const p = mine.find((x) => x.id === o.player_id);
                      if (!p) return null;
                      return (
                        <div key={`${o.player_id}-${o.matchday}`} className="tx-offer">
                          <span><strong>{clubName(o.club)}</strong> offer {money(o.amount)} for <strong><Flag code={p.nationality} />{p.name}</strong></span>
                          <button type="button" className="tx-btn" disabled={busy === p.id || !!canSell(mine, p)} onClick={() => acceptComputerOffer(p.id, o.club, o.amount)}>Accept</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <ul className="tx-list">
                  {mine.slice().sort((a, b) => b.rating - a.rating).map((p) => {
                    const own = ctx.state.listings.find((l) => l.player_id === p.id);
                    const mgr = listingOf.get(p.id);
                    const asking = mgr && mgr.seller_id === ctx.userId ? mgr.asking : own?.asking;
                    const quick = Math.round(marketValue(p) * QUICK * 10) / 10;
                    return (
                      <li key={p.id} className="tx-row is-sell">
                        <b className={rateCls(p)}><PlayerFace player={p} className="tx-face" /><i>{p.rating}</i></b>
                        <span className="tx-name">
                          <strong><Flag code={p.nationality} />{p.name}{asking !== undefined && <em className="tr-tag is-leaving">Listed</em>}</strong>
                          <small>{p.position} · {p.age}{asking !== undefined ? ` · asking ${money(asking)}` : ""}</small>
                        </span>
                        <span className="tx-val">{money(marketValue(p))}</span>
                        <span className="tx-acts">
                          {asking !== undefined ? (
                            <button type="button" className="tx-btn is-ghost" disabled={busy === p.id} onClick={() => withdraw(p)}>Withdraw</button>
                          ) : (
                            <button type="button" className="tx-btn is-ghost" onClick={() => setSell(p)}>List</button>
                          )}
                          <button type="button" className="tx-btn" disabled={busy === p.id || !window.open} onClick={() => quickSell(p)}>
                            {busy === p.id ? "Selling..." : `Sell now ${money(quick)}`}
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            {view !== "mine" && targets.length > limit && (
              <button type="button" className="tx-more" onClick={() => setLimit((l) => l + PAGE)}>Show more ({targets.length - limit})</button>
            )}
          </section>
        )}

        {tab === "talks" && (
          <section className="tx-pane" aria-label="Negotiations">
            {!roomId ? (
              <p className="tx-empty">Negotiations are between the managers of a shared league. Create a league or join one with a code from Rooms, and the offers you send and receive appear here.</p>
            ) : (
              (() => {
                const mineOffers = offers.filter((o) => o.buyer_id === ctx.userId || o.seller_id === ctx.userId);
                const turn = (o: ManagerOffer) => (o.status === "open" && o.seller_id === ctx.userId) || (o.status === "countered" && o.buyer_id === ctx.userId);
                const groups: [string, string, ManagerOffer[]][] = [
                  ["Waiting for your answer", "Accept, refuse or send a counter offer.", mineOffers.filter(turn)],
                  ["Waiting for the other manager", "You will be told as soon as he answers.", mineOffers.filter((o) => (o.status === "open" || o.status === "countered") && !turn(o))],
                  ["Finished", "Deals done and offers that ended.", mineOffers.filter((o) => o.status !== "open" && o.status !== "countered").slice(0, 20)],
                ];
                return (
                  <>
                    <p className="tx-hint">Offers you sent, offers you received, and the talks in progress. The player stays with his club until a deal is done.</p>
                    {groups.map(([title, sub, list]) => (
                      <div key={title} className="tx-group">
                        <h2>{title} <span>{list.length}</span></h2>
                        <small>{sub}</small>
                        <ul className="tx-list">
                          {list.map((o) => {
                            const p = findPlayer(squads, o.player_id);
                            const selling = o.seller_id === ctx.userId;
                            const otherClub = selling ? o.buyer_club : o.seller_club;
                            const who = humans.get(otherClub)?.name || clubName(otherClub);
                            const closed = o.status === "accepted" || o.status === "rejected" || o.status === "withdrawn";
                            const mt = turn(o);
                            return (
                              <li key={o.id} className={`tx-row is-talk ${closed ? "is-closed" : ""}`}>
                                <b className="tx-rate">{p?.rating ?? "-"}</b>
                                <span className="tx-name">
                                  <strong>{p?.name ?? "Player"}<em className={`tr-tag ${selling ? "is-leaving" : "is-new"}`}>{selling ? "Selling" : "Buying"}</em></strong>
                                  <small>
                                    {who} · offer {money(o.amount)}{o.counter ? ` · counter ${money(o.counter)}` : ""} ·{" "}
                                    {o.status === "open" ? (selling ? "he is waiting for you" : "waiting for him")
                                      : o.status === "countered" ? (selling ? "waiting for his answer" : "he wants " + money(o.counter ?? 0))
                                      : o.status === "accepted" ? `deal done at ${money(o.counter ?? o.amount)}` : o.status === "rejected" ? "refused" : "withdrawn"}
                                  </small>
                                </span>
                                <span className="tx-price"><small>{o.status === "countered" ? "Counter" : "Offer"}</small><b>{money(o.status === "countered" ? (o.counter ?? o.amount) : o.amount)}</b></span>
                                <span className="tx-acts">
                                  {mt && counterId !== o.id && (
                                    <>
                                      <button type="button" className="tx-btn" disabled={busy === o.id || !window.open} onClick={() => acceptNegotiation(o)}>Accept</button>
                                      {selling && <button type="button" className="tx-btn is-ghost" onClick={() => { setCounterId(o.id); setCounterVal(String(Math.round(o.amount * 1.2 * 10) / 10)); }}>Counter</button>}
                                      <button type="button" className="tx-btn is-ghost" disabled={busy === o.id} onClick={() => answer(o, "reject")}>Reject</button>
                                    </>
                                  )}
                                  {mt && counterId === o.id && (
                                    <>
                                      <span className="tx-counter">€<input inputMode="decimal" value={counterVal} onChange={(e) => setCounterVal(e.target.value.replace(/[^0-9.]/g, ""))} aria-label="Your price in millions" />M</span>
                                      <button type="button" className="tx-btn" disabled={busy === o.id || !(Number(counterVal) > 0)} onClick={() => answer(o, "counter", Math.round(Number(counterVal) * 10) / 10)}>Send</button>
                                      <button type="button" className="tx-btn is-ghost" onClick={() => setCounterId("")}>Cancel</button>
                                    </>
                                  )}
                                  {!mt && !closed && !selling && (
                                    <button type="button" className="tx-btn is-ghost" disabled={busy === o.id} onClick={() => answer(o, "withdraw")}>Withdraw</button>
                                  )}
                                </span>
                              </li>
                            );
                          })}
                          {list.length === 0 && <li className="tx-empty is-small">Nothing here.</li>}
                        </ul>
                      </div>
                    ))}
                  </>
                );
              })()
            )}
          </section>
        )}

        {tab === "clubs" && !openClub && (
          <section className="tx-pane" aria-label="Clubs">
            <p className="tx-hint">Open a club to see its players. To sign one, send an offer to the club that owns him.</p>
            <div className="tx-clubs">
              {otherClubs.map((c) => (
                <button key={c.id} type="button" className="tx-club" onClick={() => { setOpenClub(c.id); setNotice(""); setGood(""); }}>
                  <img src={c.logo} alt="" />
                  <span>
                    <strong>{c.name}</strong>
                    <small>{humans.get(c.id) ? `Manager: ${humans.get(c.id)!.name}` : tierLabel(c.id)} · rating {teamRating(squads[c.id] ?? [])}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {tab === "clubs" && openClub && openMeta && (
          <section className="tx-pane" aria-label={openMeta.name}>
            <div className="tx-clubhead">
              <button type="button" className="tx-btn is-ghost" onClick={() => setOpenClub(null)}><Icon name="arrow-left" size={14} /> Clubs</button>
              <img src={openMeta.logo} alt="" />
              <span>
                <strong>{openMeta.name}</strong>
                <small>{openHuman ? `Manager: ${openHuman.name}. He answers your offers himself.` : "Run by the computer. The club decides the price."} · {clubPlayers.length} players</small>
              </span>
            </div>
            <ul className="tx-list">
              {clubPlayers.map((p) => {
                const l = listingOf.get(p.id);
                const last = clubPlayers.filter((x) => x.position === p.position).length - 1 < MIN_BY_POSITION[p.position];
                return (
                  <li key={p.id} className="tx-row is-market">
                    <b className={rateCls(p)}><PlayerFace player={p} className="tx-face" /><i>{p.rating}</i></b>
                    <span className="tx-name">
                      <strong><Flag code={p.nationality} />{p.name}{l && <em className="tr-tag is-new">For sale</em>}</strong>
                      <small>{p.position} · {p.age} · {p.nationality || "-"}</small>
                    </span>
                    <span className="tx-price"><small>{l ? "Asking" : "Value"}</small><b>{money(l ? l.asking : marketValue(p))}</b></span>
                    <span className="tx-acts">
                      {openHuman ? (
                        <>
                          <button type="button" className="tx-btn is-ghost" disabled={!window.open} onClick={() => setOfferFor({ player: p, asking: l?.asking })}>Make offer</button>
                          {l && <button type="button" className={`tx-btn ${confirm === l.id ? "is-sure" : ""}`} disabled={busy === l.id || !window.open} onClick={() => buyListed(l)}>{confirm === l.id ? `Confirm ${money(l.asking)}` : "Buy now"}</button>}
                        </>
                      ) : (
                        <button type="button" className="tx-btn" disabled={!window.open || last} title={last ? `${openMeta.name} cannot sell their last ${p.position} players.` : undefined} onClick={() => setBid(p)}>Make offer</button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {tab === "windows" && (
          <section className="tx-pane" aria-label="Transfer windows">
            <div className="tx-bar">
              <div className="tx-chips" role="group" aria-label="Show">
                <button type="button" className={!logMine ? "is-on" : ""} onClick={() => { setLogMine(false); setLimit(PAGE); }}>All clubs</button>
                <button type="button" className={logMine ? "is-on" : ""} onClick={() => { setLogMine(true); setLimit(PAGE); }}>My deals</button>
              </div>
            </div>
            <p className="tx-hint">Every transfer in your league: the player, who sold him, who bought him, the fee and the date. All managers of the league see the same record.</p>
            <ul className="tx-list">
              {rows.slice(0, limit).map((d) => {
                const p = findPlayer(squads, d.player_id);
                const from = clubs.find((c) => c.id === d.from);
                const to = clubs.find((c) => c.id === d.to);
                return (
                  <li key={d.id} className={`tx-row is-news ${d.mine ? "is-mine" : ""}`}>
                    <b className="tx-rate">{p?.rating ?? "-"}</b>
                    <span className="tx-name">
                      <strong>{p?.name ?? "Player"}{d.mine && <em className="tr-tag is-new">{d.to === ctx.clubId ? "Signed" : "Sold"}</em>}</strong>
                      <small>{dateOf(d.at)}{dateOf(d.at) ? " · " : ""}{d.matchday === 0 ? "Off-season" : `Matchday ${d.matchday}`} · {d.season.replace("-20", "/")}</small>
                    </span>
                    <span className="tx-move">
                      {from ? <img src={from.logo} alt="" /> : <i aria-hidden="true" />}
                      <small>{clubName(d.from)}</small>
                      <Icon name="arrow-right" size={14} />
                      {to ? <img src={to.logo} alt="" /> : <i aria-hidden="true" />}
                      <small>{clubName(d.to)}</small>
                    </span>
                    <span className="tx-val">{money(d.fee)}</span>
                  </li>
                );
              })}
              {rows.length === 0 && <li className="tx-empty">No transfers yet. They appear here as soon as the first deal is done.</li>}
            </ul>
            {rows.length > limit && (
              <button type="button" className="tx-more" onClick={() => setLimit((l) => l + PAGE)}>Show more ({rows.length - limit})</button>
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
          balanceM={ctx.spendM}
          blocked={blocked}
          onClose={() => setBid(null)}
          onSign={(fee) => sign(bid, fee)}
        />
      )}
      {offerFor && (
        <OfferModal
          player={offerFor.player}
          manager={humans.get(offerFor.player.club)?.name || clubName(offerFor.player.club)}
          balanceM={ctx.spendM}
          blocked={blocked}
          asking={offerFor.asking}
          onClose={() => setOfferFor(null)}
          onSend={(amount) => sendOffer(offerFor.player, amount)}
        />
      )}
      {sell && (
        <SellModal player={sell} warning={canSell(mine, sell)} onClose={() => setSell(null)} onList={(price) => listForSale(sell, price)} />
      )}
    </main>
  );
}
