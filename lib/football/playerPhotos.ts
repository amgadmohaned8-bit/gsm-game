/**
 * Player pictures. Put the files in public/players (any name like
 * "dominik-szoboszlai-liverpool-2026-27-portrait-footylogos.png") and run
 * `node scripts/photos.mjs`. Each picture is matched to a player of the right club by the
 * player's name; a player without a picture keeps the shirt silhouette.
 */

import { allClubs } from "@/lib/football/leagueClubs";
import { PHOTO_FILES } from "@/lib/football/playerPhotos.generated";
import { squads, type Player } from "@/lib/football/squads";

export const PHOTO_DIR = "/players/";

/** lower case, no accents, words joined by "-" */
export function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/gi, "o").replace(/æ/gi, "ae").replace(/œ/gi, "oe").replace(/ł/gi, "l").replace(/[đð]/gi, "d").replace(/ß/g, "ss").replace(/þ/gi, "th")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** do the words of `needle` appear in `hay` next to each other, in order? */
function hasWords(hay: string[], needle: string[]) {
  if (!needle.length) return false;
  for (let i = 0; i + needle.length <= hay.length; i++) if (needle.every((w, k) => hay[i + k] === w)) return true;
  return false;
}

type Entry = { file: string; words: string[] };
let index: Map<string, string> | null = null;

function build() {
  const out = new Map<string, string>();
  const entries: Entry[] = PHOTO_FILES.map((file) => {
    const text = slug(file.replace(/\.[a-z0-9]+$/i, "")).replace(/(-?20\d\d-\d\d)?(-?(portrait|headshot|face|photo))?(-?footylogos)*$/g, "");
    return { file, words: text.split("-").filter(Boolean) };
  });
  if (!entries.length) return out;

  const claimed = new Set<string>();
  const clubKeys = new Map(allClubs.map((c) => [c.id, [slug(c.name).split("-"), c.id.split("-")]] as [string, string[][]]));
  const all: { p: Player; words: string[] }[] = [];
  for (const [club, list] of Object.entries(squads)) for (const p of list) all.push({ p: { ...p, club }, words: slug(p.name).split("-").filter(Boolean) });
  // the names with the most words choose first: "Gabriel Jesus" before "Gabriel"
  all.sort((a, b) => b.words.length - a.words.length || b.p.rating - a.p.rating);

  const take = (id: string, e: Entry) => { claimed.add(e.file); out.set(id, PHOTO_DIR + encodeURIComponent(e.file)); };
  const pick = (list: Entry[], words: string[]) => list.filter((e) => !claimed.has(e.file) && hasWords(e.words, words)).sort((a, b) => a.words.length - b.words.length)[0];

  // 1. the right name at the right club
  for (const { p, words } of all) {
    const keys = clubKeys.get(p.club) ?? [p.club.split("-")];
    const mine = entries.filter((e) => keys.some((k) => hasWords(e.words, k)));
    const hit = pick(mine, words);
    if (hit) take(p.id, hit);
  }
  // 2. the club is written another way in the file name: take the name when only one picture fits
  for (const { p, words } of all) {
    if (out.has(p.id) || (words.length < 2 && words.join("").length < 5)) continue;
    const fits = entries.filter((e) => !claimed.has(e.file) && hasWords(e.words, words));
    if (fits.length === 1) take(p.id, fits[0]);
  }
  return out;
}

/** the picture of a player, or null when there is none */
export function photoOf(p: Pick<Player, "id">): string | null {
  if (!PHOTO_FILES.length) return null;
  if (!index) index = build();
  return index.get(p.id) ?? null;
}
