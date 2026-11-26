
/**
 * Transfers.
 *
 * Squads in the code are the starting point. Every completed deal is a row in
 * `transfers`, and a manager's current squads are the starting squads with
 * those rows applied in order. Money works the same way: the club balance
 * is its opening balance, plus match income, plus sales, minus signings.
 *
 * All fees and prices in this file are in millions.
 */

import { egyptTiers } from "@/lib/football/egypt";
import type { SupabaseClient } from "@supabase/supabase-js";
import { allClubs, clubsOfLeague, leagueOfClub } from "@/lib/football/leagueClubs";
import { africanClubs } from "@/lib/football/africa";
import { getTier } from "@/lib/football/finance";
import { marketValue, squads as baseSquads, type Player, type Position } from "@/lib/football/squads";
import { marketPlayers, originOf } from "@/lib/football/market";
import { contractOf, seasonsLeft, type Renewal } from "@/lib/football/contracts";
import { evolve, gainsAt, type TrainingRow } from "@/lib/football/development";
import { inCareer } from "@/lib/football/leagueIds";
import { loadFriendlies } from "@/lib/football/friendlies";
import { aiDeals, aiDealsAt } from "@/lib/football/aiTransfers";
import { nowMs } from "@/lib/serverTime";
import { gameDay, loadBank, needsSync, syncBank, type Bank } from "@/lib/football/bank";

export const MARKET = "market";
export const ABROAD = "abroad";
export const MAX_SQUAD = 35;
export const MIN_BY_POSITION: Record<Position, number> = { GK: 2, DF: 5, MF: 5, FW: 3 };
/** a listed player stays on the market for the rest of the real day (Cairo time): he can sell at any moment between the listing and midnight */
export const LISTING_DAYS = 0;

export type Deal = {
  id: string;
  user_id: string;
  season: string;
  player_id: string;
  from_club: string;
  to_club: string;
  fee: number;
  kind: "buy" | "sell";
  matchday: number;
  created_at: string;
  /** the team (career) this deal belongs to */
  league_id?: string | null;
};

export type Listing = {
  id: string;
  user_id: string;
  season: string;
  player_id: string;
  asking: number;
  listed_matchday: number;
  status: "open" | "sold" | "withdrawn";
  league_id?: string | null;
  created_at?: string;
};

export type Offer = { player_id: string; matchday: number; club: string; amount: number };

/* ---------- seeded numbers ---------- */

function seed(text: string) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function unit(text: string) {
  let a = seed(text);
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const round1 = (n: number) => Math.round(n * 10) / 10;

/* ---------- squads after the deals ---------- */

export type Squads = Record<string, Player[]>;

export type SquadOpts = {
  season?: string;
  training?: TrainingRow[];
  matchday?: number;
  /** the manager's club and renewals: players whose contract ran out have left it */
  own?: { club: string; renewals: Renewal[] };
  /** deals between the computer clubs, applied in time order with the manager's own */
  ai?: Deal[];
  /** deals of the other managers of a shared league: they only move players that are where they say */
  others?: Deal[];
};

export function applyDeals(deals: Deal[], opts: SquadOpts = {}): Squads {
  const out: Squads = {};
  for (const [club, list] of Object.entries(baseSquads)) out[club] = [...list];
  out[MARKET] = marketPlayers.map((p) => ({ ...p }));

  const mine: { deal: Deal; anywhere: boolean }[] = [
    ...deals.map((deal) => ({ deal, anywhere: true })),
    ...(opts.others ?? []).map((deal) => ({ deal, anywhere: false })),
  ].sort((a, b) => a.deal.created_at.localeCompare(b.deal.created_at));
  const ai = [...(opts.ai ?? [])].sort((a, b) => a.season.localeCompare(b.season) || a.matchday - b.matchday || a.id.localeCompare(b.id));
  // a deal of the manager's in the off-season is recorded as matchday 0: it comes after the whole season
  const keyOf = (d: Deal) => `${d.season}|${String(d.matchday === 0 ? 99 : d.matchday).padStart(3, "0")}`;
  let next = 0;

  const move = (deal: Deal, anywhere: boolean) => {
    let fromClub = deal.from_club;
    let i = out[fromClub]?.findIndex((p) => p.id === deal.player_id) ?? -1;
    if (i < 0 && anywhere) {
      for (const [club, list] of Object.entries(out)) {
        const j = list.findIndex((p) => p.id === deal.player_id);
        if (j >= 0) { fromClub = club; i = j; break; }
      }
    }
    if (i < 0) return; // he is no longer there: nobody can buy him from that club
    const [player] = out[fromClub].splice(i, 1);
    if (deal.to_club === ABROAD) return;
    (out[deal.to_club] ??= []).push({ ...player, club: deal.to_club });
  };

  for (const { deal, anywhere } of mine) {
    const k = keyOf(deal);
    while (next < ai.length && keyOf(ai[next]) <= k) move(ai[next++], false);
    move(deal, anywhere);
  }
  while (next < ai.length) move(ai[next++], false);

  // contracts that ran out: the player leaves the manager's club, unless that would leave a position short
  if (opts.season && opts.own) {
    const club = opts.own.club;
    const mine = out[club];
    if (mine) {
      const gone = (p: Player) => seasonsLeft(contractOf(p, club, deals, opts.own!.renewals), opts.season!) < 1;
      let kept = [...mine];
      for (const p of mine.filter(gone)) {
        const rest = kept.filter((x) => x.id !== p.id);
        const short = Object.entries(MIN_BY_POSITION).some(([pos, n]) => rest.filter((x) => x.position === pos).length < n);
        if (!short && rest.length >= 18) kept = rest;
      }
      out[club] = kept;
    }
  }

  // a year older, and trained: only when the season is known
  if (opts.season) {
    const all = Object.values(out).flat();
    const gains = gainsAt(opts.training ?? [], opts.season, opts.matchday ?? 99, all);
    for (const club of Object.keys(out)) out[club] = out[club].map((p) => evolve(p, opts.season!, gains[p.id] ?? 0));
  }
  return out;
}

export function findPlayer(squads: Squads, playerId: string): Player | null {
  for (const list of Object.values(squads)) {
    const p = list.find((x) => x.id === playerId);
    if (p) return p;
  }
  return null;
}

/** Sales minus signings for one club, in millions. */
export function transfersNet(deals: Deal[], myClub: string) {
  return deals.reduce(
    (sum, d) => sum + (d.to_club === myClub ? -d.fee : d.from_club === myClub ? d.fee : 0),
    0
  );
}

/* ---------- the window ---------- */

export type WindowStatus = { open: boolean; label: string; note: string };

/** Open for matchdays 1-10 and 20-26, and between seasons. */
export function windowStatus(matchday: number | null): WindowStatus {
  return { open: true, label: "Open", note: matchday === null ? "Off-season: the window is open." : "The transfer window is open all season." };
}

/* ---------- asking prices and bids ---------- */

/** How much a club needs the player: 1 = a star of the side, 0 = a squad filler. */
export function importance(squad: Player[], player: Player) {
  const same = [...squad].sort((a, b) => b.rating - a.rating);
  const rank = same.findIndex((p) => p.id === player.id);
  if (rank < 0) return 0.2;
  return rank < 3 ? 1 : rank < 11 ? 0.6 : 0.2;
}

/**
 * What the selling club wants. Fixed for a given manager, player and season,
 * so asking again does not give a different answer.
 */
export function askingPrice(userId: string, season: string, player: Player, sellerSquad: Player[]) {
  const value = marketValue(player);
  const origin = originOf(player.id);

  if (origin === "Free") return round1(Math.max(0.5, value * 0.12));

  const luck = unit(`${userId}|${season}|${player.id}|ask`);

  if (player.club === MARKET) {
    const stars = player.rating >= 84 ? 1.35 : 1.2;
    return round1(value * (stars + 0.25 * luck));
  }

  const tier = getTier(player.club);
  const tierFactor = tier === "elite" ? 1.15 : tier === "mid" ? 1 : 0.92;
  const need = importance(sellerSquad, player);
  return round1(value * tierFactor * (1.15 + 0.25 * luck + 0.4 * need));
}

/** What a world market player costs: his base value, with no haggling (a free agent costs a small signing fee). */
export function worldPrice(userId: string, season: string, player: Player) {
  return originOf(player.id) === "Free" ? askingPrice(userId, season, player, []) : round1(marketValue(player));
}

export type BidResult =
  | { kind: "accept"; price: number; line: string }
  | { kind: "counter"; price: number; line: string }
  | { kind: "reject"; line: string };

export function respondToBid(ask: number, offer: number): BidResult {
  const ratio = offer / ask;
  if (ratio >= 1) return { kind: "accept", price: offer, line: "We have a deal. The player is yours." };
  if (ratio >= 0.85) {
    return { kind: "counter", price: ask, line: `Close, but we need ${ask.toFixed(1)}M. That is our price.` };
  }
  if (ratio >= 0.6) return { kind: "reject", line: "Not enough. We value him much higher." };
  return { kind: "reject", line: "That is an insult. We are not interested." };
}

/* ---------- what a manager may do ---------- */

export function canSell(squad: Player[], player: Player): string | null {
  const left = squad.filter((p) => p.position === player.position && p.id !== player.id).length;
  const need = MIN_BY_POSITION[player.position];
  return left < need ? `You need at least ${need} ${player.position} players.` : null;
}

/** Egyptian league: at most 5 foreign (non-Egyptian) players per club. */
export const MAX_FOREIGN = 5;
export function foreignBlock(clubId: string, squad: { id: string; nationality: string }[], player: { nationality: string } | undefined | null): string | null {
  if (!player || player.nationality === "EG" || !(clubId in egyptTiers)) return null;
  const n = squad.filter((p) => p.nationality !== "EG").length;
  return n >= MAX_FOREIGN ? `Foreign players limit: a club can have only ${MAX_FOREIGN} non-Egyptian players.` : null;
}

export function canBuy(args: {
  balance: number;
  fee: number;
  squadSize: number;
  windowOpen: boolean;
  /** why the bank forbids signings, if it does */
  ban?: string | null;
}): string | null {
  if (args.ban) return args.ban;
  if (!args.windowOpen) return "The transfer window is closed.";
  if (args.squadSize >= MAX_SQUAD) return `Your squad is full (${MAX_SQUAD} players). Sell someone first.`;
  if (args.fee > args.balance) return "Your club cannot afford this fee.";
  return null;
}

/* ---------- listings: bids from AI clubs ---------- */

/** Seconds are counted in Cairo time, so "today" ends at the Cairo midnight. */
export function endOfCairoDay(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms));
  const n = (t: string) => Number(parts.find((x) => x.type === t)?.value ?? 0);
  const into = n("hour") * 3600 + n("minute") * 60 + n("second");
  return ms + (86400 - into) * 1000;
}

/** Every club of the world that can buy a player of the manager: his own league and all the others. */
export function worldBuyers(myClub: string) {
  // the Egyptian league sells inside the league and to the African clubs
  if (leagueOfClub(myClub) === "egyptian-premier-league") return [...clubsOfLeague("egyptian-premier-league").filter((c) => c.id !== myClub), ...africanClubs];
  return allClubs.filter((c) => c.id !== myClub);
}

/** The window of a listing in real time, and the one bid that comes inside it (a club, a price, a moment). */
export function listingBid(userId: string, listing: { id: string; player_id: string; created_at?: string }, player: Player, myClub: string, exclude?: Set<string>) {
  const start = listing.created_at ? Date.parse(listing.created_at) : NaN;
  const legacy = !Number.isFinite(start); // old rows without a time: settled at once
  const from = legacy ? 0 : start;
  const end = legacy ? 0 : endOfCairoDay(start);
  const allBuyers = worldBuyers(myClub);
  // clubs run by other managers never buy from the computer
  const buyers = exclude?.size ? allBuyers.filter((c) => !exclude.has(c.id)) : allBuyers;
  const key = `${userId}|${listing.player_id}|${listing.id}`;
  const club = buyers[Math.floor(unit(`${key}|who`) * buyers.length)]?.id ?? buyers[0].id;
  const factor = 0.95 + 0.75 * unit(`${key}|bid`);
  const at = from + (end - from) * unit(`${key}|when`);
  return { club, amount: round1(marketValue(player) * factor), at, end };
}

/** What the game pays when nobody met the price in time. */
export function fairPrice(player: Player) {
  return round1(marketValue(player) * 0.95);
}

export type Sale = { listing: Listing; player: Player; club: string; fee: number; matchday: number };

/** A listing in a shared league: has a computer club paid his price (or the fair price at midnight) by now? */
export function dueSale(
  userId: string,
  listing: { id: string; player_id: string; asking: number; created_at?: string },
  player: Player,
  myClub: string,
  now: number,
  exclude?: Set<string>
): { club: string; fee: number } | null {
  const bid = listingBid(userId, listing, player, myClub, exclude);
  if (now >= bid.at && bid.amount >= listing.asking) return { club: bid.club, fee: listing.asking };
  if (now >= bid.end) return { club: bid.club, fee: Math.min(fairPrice(player), listing.asking) };
  return null;
}

/** Which open listings are sold by now, and which bids are still waiting. */
export function resolveListings(
  userId: string,
  listings: Listing[],
  squads: Squads,
  myClub: string,
  matchday: number
) {
  const sales: Sale[] = [];
  const offers: Offer[] = [];
  const my = squads[myClub] ?? [];
  const now = nowMs();

  for (const listing of listings.filter((l) => l.status === "open")) {
    const player = my.find((p) => p.id === listing.player_id);
    if (!player) continue;

    const bid = listingBid(userId, listing, player, myClub);
    if (now >= bid.at && bid.amount >= listing.asking) {
      // somebody pays the price at some moment of the day
      sales.push({ listing, player, club: bid.club, fee: listing.asking, matchday });
    } else if (now >= bid.end) {
      // the day is over and nobody met the price
      sales.push({ listing, player, club: bid.club, fee: fairPrice(player), matchday });
    } else if (now >= bid.at && bid.amount >= listing.asking * 0.8) {
      offers.push({ player_id: listing.player_id, matchday, club: bid.club, amount: bid.amount });
    }
  }

  return { sales, offers };
}

/* ---------- database ---------- */

export async function recordDeal(
  client: SupabaseClient,
  deal: Omit<Deal, "id" | "created_at">
) {
  const { error } = await client.from("transfers").insert(deal);
  if (error) throw error;
}

export type TransferState = {
  deals: Deal[];
  listings: Listing[];
  squads: Squads;
  training: TrainingRow[];
  renewals: Renewal[];
  offers: Offer[];
  /** deals between the other clubs of the league up to now */
  aiDeals: Deal[];
  net: number;
  matchday: number | null;
  /** loans, fines and the credit score of this team */
  bank: Bank;
};

/**
 * Loads the manager's deals and listings, completes any sale that is due,
 * and returns the squads and money as they are now.
 */
export async function loadTransferState(
  client: SupabaseClient,
  userId: string,
  myClub: string,
  season: string,
  matchday: number | null,
  leagueId?: string,
  /** only a page that knows the real current matchday may let the bank apply late fines or undo wrong ones */
  syncTheBank = false,
  /** false when the server ("settle-sales") completes the sales: the page then only reads the result */
  settleSales = true
): Promise<TransferState> {
  // each team a manager runs is its own save: only this team's deals, listings and training count
  const mineOnly = <T extends { league_id?: string | null }>(rows: T[] | null | undefined): T[] =>
    (rows ?? []).filter((r) => !leagueId || inCareer(r.league_id, leagueId));
  const [{ data: dealRows0 }, { data: listingRows0 }] = await Promise.all([
    client.from("transfers").select("*").eq("user_id", userId),
    client.from("transfer_listings").select("*").eq("user_id", userId).eq("status", "open"),
  ]);
  const dealRows = mineOnly(dealRows0 as Deal[] | null);
  const listingRows = mineOnly(listingRows0 as Listing[] | null);

  const friendlyMoney = (await loadFriendlies(client, userId, undefined, { leagueId }))
    .filter((f) => f.home_club === myClub || f.away_club === myClub)
    .reduce((sum, f) => sum + Number(f.income), 0);
  let training: TrainingRow[] = [];
  try {
    const { data: t } = await client.from("training_sessions").select("season, matchday, player_id, gain, created_at, league_id").eq("user_id", userId);
    training = mineOnly((t ?? []) as (TrainingRow & { league_id?: string | null })[]);
  } catch {
    /* no training yet */
  }
  let renewals: Renewal[] = [];
  try {
    const { data: r } = await client.from("contract_renewals").select("club_id, player_id, season, end_year, wage, fee").eq("user_id", userId).order("created_at", { ascending: true });
    renewals = (r ?? []) as Renewal[];
  } catch {
    /* no renewals yet */
  }
  // the performance analyst is paid for every match report this club ordered
  let analystFees = 0;
  try {
    const { data: a } = await client.from("analyst_reports").select("fee").eq("user_id", userId).eq("club_id", myClub);
    analystFees = (a ?? []).reduce((sum: number, r: { fee: number }) => sum + Number(r.fee), 0);
  } catch {
    /* no analyst yet */
  }
  // the prize money of each finished season
  let awardMoney = 0;
  try {
    const { data: w } = await client.from("season_awards").select("prize, league_id").eq("user_id", userId).eq("club_id", myClub);
    awardMoney = mineOnly((w ?? []) as { prize: number; league_id?: string | null }[]).reduce((sum, r) => sum + Number(r.prize), 0);
  } catch {
    /* no awards yet */
  }
  const renewalFees = renewals.filter((r) => r.club_id === myClub).reduce((sum, r) => sum + Number(r.fee), 0) + analystFees;
  const league = leagueId || leagueOfClub(myClub);
  // the other managers of a shared league: their clubs do not trade by themselves, and their deals count
  let human: string[] = [];
  let friendDeals: Deal[] = [];
  try {
    const { data: c } = await client.from("manager_contracts").select("room_id").eq("user_id", userId).maybeSingle();
    const rid = (c?.room_id as string | null) ?? null;
    if (rid) {
      const { data: mem } = await client.from("room_members").select("club_id, user_id").eq("room_id", rid);
      human = (mem ?? []).filter((m: { user_id: string }) => m.user_id !== userId).map((m: { club_id: string }) => m.club_id);
      const { data: fd } = await client.rpc("room_member_deals");
      friendDeals = ((fd ?? []) as Deal[]).filter((d) => !leagueId || inCareer(d.league_id, leagueId)).map((d) => ({ ...d, fee: Number(d.fee), created_at: String(d.created_at) }));
    }
  } catch {
    /* playing alone, or supabase/020 has not been run */
  }
  const others = aiDealsAt(aiDeals(userId, league, myClub, season, human), season, matchday);
  const view = (list: Deal[]) => applyDeals(list, { season, training, matchday: matchday ?? 99, own: { club: myClub, renewals }, ai: others, others: friendDeals });
  let deals = (dealRows ?? []) as Deal[];
  let listings = (listingRows ?? []) as Listing[];
  let squads = view(deals);

  // the bank: late stages come due with the game calendar, and a club in crisis has to sell
  const day = gameDay(season, matchday);
  let bank = await loadBank(client, userId, league, season);
  if (bank.ready && syncTheBank && matchday !== null) {
    try {
      // fines stamped with a day that has not come yet were a mistake: take them back
      if (bank.events.some((e) => e.game_day !== null && e.game_day > day && /^stage[1-5]$/.test(e.key ?? ""))) {
        await client.rpc("bank_rewind", { p_league: league, p_day: day, p_season: season, p_matchday: matchday });
        bank = await loadBank(client, userId, league, season);
      }
      if (needsSync(bank, day)) {
        await syncBank(client, league, day, season, matchday);
        bank = await loadBank(client, userId, league, season);
      }
    } catch {
      /* it will be tried again on the next visit */
    }
  }
  const crisisLoan = bank.ready ? bank.loans.find((l) => l.status === "active" && l.stage >= 4) : undefined;
  if (crisisLoan) {
    const round = Math.floor((day - crisisLoan.due_day - 31) / 8);
    const sellable = [...(squads[myClub] ?? [])].sort((a, b) => marketValue(b) - marketValue(a)).slice(3).find((p) => !canSell(squads[myClub] ?? [], p));
    if (round >= 0 && sellable && !bank.events.some((e) => e.key === `forced:${round}`)) {
      try {
        const fee = round1(Math.max(0.5, marketValue(sellable) * 0.8));
        const { data: paid } = await client.rpc("bank_forced_sale", {
          p_loan: crisisLoan.id, p_round: round, p_amount: fee, p_player: sellable.name, p_day: day, p_season: season, p_matchday: matchday,
        });
        if (Number(paid ?? 0) > 0) {
          await recordDeal(client, { user_id: userId, season, player_id: sellable.id, from_club: myClub, to_club: ABROAD, fee, kind: "sell", matchday: matchday ?? 0, league_id: leagueId });
          const { data: d3 } = await client.from("transfers").select("*").eq("user_id", userId);
          deals = mineOnly(d3 as Deal[] | null);
          squads = view(deals);
          bank = await loadBank(client, userId, league, season);
        }
      } catch {
        /* the sale is claimed once; if the deal failed it is not retried */
      }
    }
  }

  // between seasons there is no matchday: the sale is then written as an off-season deal (matchday 0)
  if (listings.length) {
    const { sales, offers } = resolveListings(userId, listings, squads, myClub, matchday ?? 0);

    for (const sale of settleSales ? sales : []) {
      if (canSell(squads[myClub] ?? [], sale.player)) continue; // would leave a position short: keep him
      // claim the listing first: two visits (or the server and a page) can never sell the same player twice
      const claim = await client.from("transfer_listings").update({ status: "sold" }).eq("id", sale.listing.id).eq("status", "open").select("id");
      if (claim.error) console.error("Could not close the listing:", claim.error.message);
      if (claim.error || !(claim.data ?? []).length) continue;
      try {
        await recordDeal(client, {
          user_id: userId,
          season,
          player_id: sale.player.id,
          from_club: myClub,
          to_club: sale.club,
          fee: sale.fee,
          kind: "sell",
          matchday: sale.matchday,
        });
      } catch {
        // the deal failed: put him back on the market, it will be tried again on the next visit
        await client.from("transfer_listings").update({ status: "open" }).eq("id", sale.listing.id);
      }
    }

    if (sales.length) {
      const [{ data: d2 }, { data: l2 }] = await Promise.all([
        client.from("transfers").select("*").eq("user_id", userId),
        client.from("transfer_listings").select("*").eq("user_id", userId).eq("status", "open"),
      ]);
      deals = mineOnly(d2 as Deal[] | null);
      listings = mineOnly(l2 as Listing[] | null);
      squads = view(deals);
    }

    return {
      deals,
      listings,
      squads,
      training,
      renewals,
      offers: resolveListings(userId, listings, squads, myClub, matchday ?? 0).offers,
      aiDeals: others,
      net: transfersNet(deals, myClub) + friendlyMoney + awardMoney - renewalFees + bank.cash,
      matchday,
      bank,
    };
  }

  return {
    deals,
    listings,
    squads,
    training,
    renewals,
    offers: [],
    aiDeals: others,
    net: transfersNet(deals, myClub) + friendlyMoney + awardMoney - renewalFees + bank.cash,
    matchday,
    bank,
  };
}
