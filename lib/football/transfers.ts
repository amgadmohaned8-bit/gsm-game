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

import type { SupabaseClient } from "@supabase/supabase-js";
import { allClubs, clubsOfLeague, leagueOfClub } from "@/lib/football/leagueClubs";
import { getTier } from "@/lib/football/finance";
import { marketValue, squads as baseSquads, type Player, type Position } from "@/lib/football/squads";
import { marketPlayers, originOf } from "@/lib/football/market";
import { contractOf, seasonsLeft, type Renewal } from "@/lib/football/contracts";
import { evolve, gainsAt, type TrainingRow } from "@/lib/football/development";
import { loadFriendlies } from "@/lib/football/friendlies";
import { aiDeals, aiDealsAt } from "@/lib/football/aiTransfers";

export const MARKET = "market";
export const ABROAD = "abroad";
export const MAX_SQUAD = 35;
export const MIN_BY_POSITION: Record<Position, number> = { GK: 2, DF: 5, MF: 5, FW: 3 };
/** a listed player is sold by the game after this many matchdays */
export const LISTING_DAYS = 3;

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
};

export type Listing = {
  id: string;
  user_id: string;
  season: string;
  player_id: string;
  asking: number;
  listed_matchday: number;
  status: "open" | "sold" | "withdrawn";
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
  if (matchday === null) return { open: true, label: "Open", note: "Off-season: the window is open." };
  if (matchday <= 10) return { open: true, label: "Summer window", note: `Closes after matchday 10 (now matchday ${matchday}).` };
  if (matchday < 20) return { open: false, label: "Closed", note: "The winter window opens at matchday 20." };
  if (matchday <= 26) return { open: true, label: "Winter window", note: `Closes after matchday 26 (now matchday ${matchday}).` };
  return { open: false, label: "Closed", note: "Closed until the next season's summer window." };
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

export function canBuy(args: {
  balance: number;
  fee: number;
  squadSize: number;
  windowOpen: boolean;
}): string | null {
  if (!args.windowOpen) return "The transfer window is closed.";
  if (args.squadSize >= MAX_SQUAD) return `Your squad is full (${MAX_SQUAD} players). Sell someone first.`;
  if (args.fee > args.balance) return "Your club cannot afford this fee.";
  return null;
}

/* ---------- listings: bids from AI clubs ---------- */

/** Bids that came in for a listed player, one per matchday since listing. */
export function bidsFor(userId: string, listing: Listing, player: Player, myClub: string, matchday: number): Offer[] {
  const value = marketValue(player);
  const buyers = clubsOfLeague(leagueOfClub(myClub)).filter((c) => c.id !== myClub);
  const out: Offer[] = [];

  for (let d = listing.listed_matchday + 1; d <= matchday; d++) {
    const rnd = unit(`${userId}|${listing.player_id}|${d}|bid`);
    const club = buyers[Math.floor(unit(`${userId}|${listing.player_id}|${d}|who`) * buyers.length)].id;
    out.push({ player_id: listing.player_id, matchday: d, club, amount: round1(value * (0.78 + 0.34 * rnd)) });
  }
  return out;
}

/** What the game pays when nobody met the price in time. */
export function fairPrice(player: Player) {
  return round1(marketValue(player) * 0.95);
}

export type Sale = { listing: Listing; player: Player; club: string; fee: number; matchday: number };

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

  for (const listing of listings.filter((l) => l.status === "open")) {
    const player = my.find((p) => p.id === listing.player_id);
    if (!player) continue;

    const bids = bidsFor(userId, listing, player, myClub, matchday);
    const hit = bids.find((b) => b.amount >= listing.asking);

    if (hit) {
      sales.push({ listing, player, club: hit.club, fee: listing.asking, matchday: hit.matchday });
    } else if (matchday >= listing.listed_matchday + LISTING_DAYS) {
      const last = bids[bids.length - 1];
      sales.push({ listing, player, club: last?.club ?? clubsOfLeague(leagueOfClub(myClub)).find((c) => c.id !== myClub)!.id, fee: fairPrice(player), matchday });
    } else {
      offers.push(...bids.filter((b) => b.amount >= listing.asking * 0.8));
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
  leagueId?: string
): Promise<TransferState> {
  const [{ data: dealRows }, { data: listingRows }] = await Promise.all([
    client.from("transfers").select("*").eq("user_id", userId),
    client.from("transfer_listings").select("*").eq("user_id", userId).eq("status", "open"),
  ]);

  const friendlyMoney = (await loadFriendlies(client, userId, undefined, { leagueId }))
    .filter((f) => f.home_club === myClub || f.away_club === myClub)
    .reduce((sum, f) => sum + Number(f.income), 0);
  let training: TrainingRow[] = [];
  try {
    const { data: t } = await client.from("training_sessions").select("season, matchday, player_id, gain, created_at").eq("user_id", userId);
    training = (t ?? []) as TrainingRow[];
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
  const renewalFees = renewals.filter((r) => r.club_id === myClub).reduce((sum, r) => sum + Number(r.fee), 0);
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
      friendDeals = ((fd ?? []) as Deal[]).map((d) => ({ ...d, fee: Number(d.fee), created_at: String(d.created_at) }));
    }
  } catch {
    /* playing alone, or supabase/020 has not been run */
  }
  const others = aiDealsAt(aiDeals(userId, league, myClub, season, human), season, matchday);
  const view = (list: Deal[]) => applyDeals(list, { season, training, matchday: matchday ?? 99, own: { club: myClub, renewals }, ai: others, others: friendDeals });
  let deals = (dealRows ?? []) as Deal[];
  let listings = (listingRows ?? []) as Listing[];
  let squads = view(deals);

  if (matchday !== null && listings.length) {
    const { sales, offers } = resolveListings(userId, listings, squads, myClub, matchday);

    for (const sale of sales) {
      if (canSell(squads[myClub] ?? [], sale.player)) continue; // would leave a position short: keep him
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
        await client.from("transfer_listings").update({ status: "sold" }).eq("id", sale.listing.id);
      } catch {
        /* it will be tried again on the next visit */
      }
    }

    if (sales.length) {
      const [{ data: d2 }, { data: l2 }] = await Promise.all([
        client.from("transfers").select("*").eq("user_id", userId),
        client.from("transfer_listings").select("*").eq("user_id", userId).eq("status", "open"),
      ]);
      deals = (d2 ?? []) as Deal[];
      listings = (l2 ?? []) as Listing[];
      squads = view(deals);
    }
    return { deals, listings, squads, training, renewals, offers: resolveListings(userId, listings, squads, myClub, matchday).offers, aiDeals: others, net: transfersNet(deals, myClub) + friendlyMoney - renewalFees, matchday };
  }

  return { deals, listings, squads, training, renewals, offers: [], aiDeals: others, net: transfersNet(deals, myClub) + friendlyMoney - renewalFees, matchday };
}
