/**
 * A manager can run up to four teams, even in the same league. Every career
 * has its own league id: the first team of a league keeps the plain id
 * ("egyptian-premier-league"), the next ones get a number ("egyptian-premier-league~2").
 * All saved data (matches, cup, transfers, training) is keyed by that id, so
 * the careers never mix. Anything that looks a league up (clubs, names,
 * logos) uses baseLeague().
 */

export const MAX_CAREERS = 4;

/** "egyptian-premier-league~2" -> "egyptian-premier-league" */
export const baseLeague = <T extends string | null | undefined>(id: T): T =>
  (typeof id === "string" ? id.split("~")[0] : id) as T;

/** true for the second, third and fourth team in a league */
export const isSlot = (id: string | null | undefined) => !!id && id.includes("~");

/** The first free career id for this league: the plain id, then ~2, ~3, ~4. */
export function freeSlot(base: string, taken: string[]): string {
  const b = baseLeague(base);
  if (!taken.includes(b)) return b;
  for (let n = 2; n <= MAX_CAREERS; n++) if (!taken.includes(`${b}~${n}`)) return `${b}~${n}`;
  return `${b}~${MAX_CAREERS + 1}`;
}

/** Does a saved row (transfer, training, listing) belong to this career? Old rows have no career: they are the first team's. */
export const inCareer = (rowLeague: string | null | undefined, career: string | null | undefined) =>
  rowLeague ? rowLeague === career : !isSlot(career);
