/**
 * Friends and shared leagues.
 *
 * A shared league ("room") has one fixture list, stored once in room_fixtures.
 * Every member copies it into their own league_matches. Results come from the
 * same seeded simulation for everyone, so all members see the same scores,
 * and any club without a human manager is simply played by the computer.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSeasonFixtures, type ScheduledFixture } from "@/lib/football/schedule";
import { activeSeason } from "@/lib/football/season";

export type Card = {
  user_id: string;
  manager_name: string;
  avatar: string | null;
  selected_club: string | null;
  selected_league?: string | null;
};

export type Friendship = {
  id: string;
  requester: string;
  addressee: string;
  status: "pending" | "accepted";
};

export type RoomMember = { user_id: string; club_id: string; name: string | null; avatar: string | null };
export type RoomInfo = {
  id: string;
  code: string;
  league_id: string;
  season: string;
  owner: string | null;
  members: RoomMember[];
};

const PENDING_KEY = "gsm-join-code";

export const normalizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);

export function rememberCode(code: string) {
  try { localStorage.setItem(PENDING_KEY, normalizeCode(code)); } catch { /* optional */ }
}
export function pendingCode(): string {
  try { return localStorage.getItem(PENDING_KEY) ?? ""; } catch { return ""; }
}
export function forgetCode() {
  try { localStorage.removeItem(PENDING_KEY); } catch { /* optional */ }
}

/* ---------- friends ---------- */

export async function searchManagers(client: SupabaseClient, me: string, text: string): Promise<Card[]> {
  const q = text.trim().replace(/[%_,]/g, " ");
  if (q.length < 2) return [];
  const { data, error } = await client
    .from("manager_directory")
    .select("user_id, manager_name, avatar, selected_club")
    .ilike("manager_name", `%${q}%`)
    .neq("user_id", me)
    .limit(8);
  if (error) throw error;
  return (data ?? []) as Card[];
}

export async function loadFriends(client: SupabaseClient, me: string) {
  const { data, error } = await client.from("friendships").select("id, requester, addressee, status");
  if (error) throw error;
  const rows = (data ?? []) as Friendship[];
  const ids = [...new Set(rows.map((r) => (r.requester === me ? r.addressee : r.requester)))];
  let cards: Card[] = [];
  if (ids.length) {
    const res = await client
      .from("manager_directory")
      .select("user_id, manager_name, avatar, selected_club")
      .in("user_id", ids);
    cards = (res.data ?? []) as Card[];
  }
  const cardOf = (id: string) =>
    cards.find((c) => c.user_id === id) ?? { user_id: id, manager_name: "Manager", avatar: null, selected_club: null };
  const other = (r: Friendship) => (r.requester === me ? r.addressee : r.requester);

  return {
    friends: rows.filter((r) => r.status === "accepted").map((r) => ({ id: r.id, card: cardOf(other(r)) })),
    incoming: rows.filter((r) => r.status === "pending" && r.addressee === me).map((r) => ({ id: r.id, card: cardOf(r.requester) })),
    sent: rows.filter((r) => r.status === "pending" && r.requester === me).map((r) => ({ id: r.id, card: cardOf(r.addressee) })),
  };
}

export async function sendRequest(client: SupabaseClient, me: string, to: string) {
  const { error } = await client.from("friendships").insert({ requester: me, addressee: to, status: "pending" });
  if (error) throw error;
}
export async function answerRequest(client: SupabaseClient, id: string, accept: boolean) {
  const { error } = accept
    ? await client.from("friendships").update({ status: "accepted" }).eq("id", id)
    : await client.from("friendships").delete().eq("id", id);
  if (error) throw error;
}
export async function removeFriend(client: SupabaseClient, id: string) {
  const { error } = await client.from("friendships").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- rooms ---------- */

export async function previewRoom(client: SupabaseClient, code: string): Promise<RoomInfo | null> {
  const { data, error } = await client.rpc("room_preview", { p_code: normalizeCode(code) });
  if (error) throw error;
  return (data as RoomInfo | null) ?? null;
}

export async function createRoom(client: SupabaseClient, league: string, season: string, club: string) {
  const { data, error } = await client.rpc("create_room", { p_league: league, p_season: season, p_club: club });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { id: row.id as string, code: row.code as string };
}

/** The room a manager belongs to, with its members; null when playing alone. */
export async function myRoom(client: SupabaseClient, roomId: string | null | undefined) {
  if (!roomId) return null;
  const { data: room } = await client.from("rooms").select("id, code, league_id, season, owner_id").eq("id", roomId).maybeSingle();
  if (!room) return null;
  const { data: members } = await client.from("room_members").select("user_id, club_id").eq("room_id", roomId);
  const ids = (members ?? []).map((m: any) => m.user_id);
  let cards: Card[] = [];
  if (ids.length) {
    const res = await client.from("manager_directory").select("user_id, manager_name, avatar, selected_club").in("user_id", ids);
    cards = (res.data ?? []) as Card[];
  }
  return {
    ...(room as any),
    members: (members ?? []).map((m: any) => {
      const c = cards.find((x) => x.user_id === m.user_id);
      return { user_id: m.user_id, club_id: m.club_id, name: c?.manager_name ?? null, avatar: c?.avatar ?? null } as RoomMember;
    }),
  } as { id: string; code: string; league_id: string; season: string; owner_id: string; members: RoomMember[] };
}

async function roomFixtures(client: SupabaseClient, roomId: string, season: string) {
  const { data, error } = await client
    .from("room_fixtures")
    .select("matchday, home_club, away_club, kickoff_at")
    .eq("room_id", roomId)
    .eq("season", season);
  if (error) throw error;
  return (data ?? []) as { matchday: number; home_club: string; away_club: string; kickoff_at: string }[];
}

/**
 * The season's fixtures for this manager. In a shared league the first
 * manager to need a season stores it; everyone else copies the stored list,
 * so the whole room plays the same matches at the same time.
 */
export async function seasonRows(
  client: SupabaseClient,
  userId: string,
  leagueId: string,
  season: string,
  roomId: string | null | undefined
): Promise<ScheduledFixture[]> {
  if (!roomId) return buildSeasonFixtures(userId, leagueId, season);

  let stored = await roomFixtures(client, roomId, season);
  if (stored.length === 0) {
    const built = buildSeasonFixtures(userId, leagueId, season);
    const rows = built.map((m) => ({
      room_id: roomId,
      season,
      matchday: m.matchday,
      home_club: m.home_club,
      away_club: m.away_club,
      kickoff_at: m.kickoff_at,
    }));
    for (let i = 0; i < rows.length; i += 190) {
      await client
        .from("room_fixtures")
        .upsert(rows.slice(i, i + 190), { onConflict: "room_id,season,matchday,home_club", ignoreDuplicates: true });
    }
    stored = await roomFixtures(client, roomId, season); // whoever stored first wins
  }

  return stored.map((m) => ({
    user_id: userId,
    league_id: leagueId,
    season,
    matchday: m.matchday,
    home_club: m.home_club,
    away_club: m.away_club,
    status: "scheduled" as const,
    home_score: null,
    away_score: null,
    kickoff_at: m.kickoff_at,
  }));
}

/**
 * Joins a shared league with a club. Replaces this manager's own copy of the
 * room's season, so the table starts the same for everybody.
 * Returns an error text, or null when it worked.
 */
export async function joinRoom(
  client: SupabaseClient,
  userId: string,
  room: RoomInfo,
  club: string
): Promise<string | null> {
  const mine = await activeSeason(client, userId, room.league_id);
  if (mine > room.season) return "You are already in a later season than this league.";

  const { error } = await client.rpc("join_room", { p_code: room.code, p_club: club });
  if (error) return /taken/i.test(error.message) ? "Somebody just took that club. Pick another." : "Could not join this league.";

  // this manager's old copy of that season (league + cup) makes way for the shared one
  await client.from("league_matches").delete().eq("user_id", userId).eq("league_id", room.league_id).eq("season", room.season);
  await client.from("cup_matches").delete().eq("user_id", userId).eq("season", room.season);

  const rows = await seasonRows(client, userId, room.league_id, room.season, room.id);
  for (let i = 0; i < rows.length; i += 190) {
    const { error: insertError } = await client.from("league_matches").insert(rows.slice(i, i + 190));
    if (insertError) return "Could not copy the fixtures.";
  }
  forgetCode();
  return null;
}

/**
 * Turns this manager's own season into a shared league. The fixtures they
 * already have become the room's fixture list, so friends who join play the
 * very same matches at the very same kickoff times.
 */
export async function startRoom(client: SupabaseClient, userId: string, leagueId: string, season: string, club: string) {
  const room = await createRoom(client, leagueId, season, club);
  const { data } = await client
    .from("league_matches")
    .select("matchday, home_club, away_club, kickoff_at")
    .eq("user_id", userId)
    .eq("league_id", leagueId)
    .eq("season", season);
  const rows = ((data ?? []) as { matchday: number; home_club: string; away_club: string; kickoff_at: string | null }[])
    .filter((m) => m.kickoff_at)
    .map((m) => ({ room_id: room.id, season, matchday: m.matchday, home_club: m.home_club, away_club: m.away_club, kickoff_at: m.kickoff_at as string }));
  for (let i = 0; i < rows.length; i += 190) {
    await client
      .from("room_fixtures")
      .upsert(rows.slice(i, i + 190), { onConflict: "room_id,season,matchday,home_club", ignoreDuplicates: true });
  }
  return room;
}

export const inviteLink = (code: string) =>
  `${typeof window === "undefined" ? "" : window.location.origin}/game/leagues?code=${code}`;
