import { TROPHY_TYPES, cabinetLayout, type TrophyDef } from './catalog';

/** One row of manager_trophies. */
export interface TrophyWin {
  id?: string;
  trophy_type: string;
  season: number;
  club_id: string;
  club_name: string;
}

export interface CabinetSlot {
  def: TrophyDef;
  /** How many times it was won (0 = empty slot). */
  count: number;
  /** Seasons it was won, oldest first. */
  seasons: number[];
  /** Clubs it was won with, in the order of the seasons. */
  clubNames: string[];
}

export interface Cabinet {
  columns: { big: CabinetSlot; small: CabinetSlot }[];
  total: number;
  /** Different trophy types won. */
  typeCount: number;
  clubCount: number;
}

export interface ClubOption {
  id: string;
  name: string;
}

/** Clubs the manager has won something with, oldest first. Used for the filter. */
export function listClubs(wins: readonly TrophyWin[]): ClubOption[] {
  const sorted = [...wins].sort((a, b) => a.season - b.season);
  const seen = new Map<string, ClubOption>();
  for (const w of sorted) {
    if (!seen.has(w.club_id)) seen.set(w.club_id, { id: w.club_id, name: w.club_name });
  }
  return [...seen.values()];
}

function dedupe(wins: readonly TrophyWin[]): TrophyWin[] {
  const seen = new Set<string>();
  const out: TrophyWin[] = [];
  for (const w of wins) {
    const key = `${w.trophy_type}|${w.season}|${w.club_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(w);
    }
  }
  return out;
}

/**
 * Groups wins into the cabinet slots.
 * @param clubId only count wins made with this club; null = all clubs
 */
export function buildCabinet(wins: readonly TrophyWin[], clubId: string | null = null): Cabinet {
  const filtered = dedupe(wins)
    .filter((w) => TROPHY_TYPES.has(w.trophy_type))
    .filter((w) => clubId === null || w.club_id === clubId)
    .sort((a, b) => a.season - b.season);

  const slotFor = (def: TrophyDef): CabinetSlot => {
    const mine = filtered.filter((w) => w.trophy_type === def.type);
    const clubNames: string[] = [];
    for (const w of mine) if (!clubNames.includes(w.club_name)) clubNames.push(w.club_name);
    return { def, count: mine.length, seasons: mine.map((w) => w.season), clubNames };
  };

  const columns = cabinetLayout().map((c) => ({ big: slotFor(c.big), small: slotFor(c.small) }));

  return {
    columns,
    total: filtered.length,
    typeCount: new Set(filtered.map((w) => w.trophy_type)).size,
    clubCount: new Set(filtered.map((w) => w.club_id)).size,
  };
}

/** "2027, 2028, 2030"; long lists are shortened to "2027, 2028, 2029 +4". */
export function formatSeasons(seasons: readonly number[]): string {
  if (seasons.length <= 4) return seasons.join(', ');
  return `${seasons.slice(0, 3).join(', ')} +${seasons.length - 3}`;
}

/** "Al Ahly / Zamalek"; three or more clubs become "3 clubs". */
export function formatClubs(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' / ');
  return `${names.length} clubs`;
}

/** The three lines written on the plaque under a trophy. */
export function plaqueLines(slot: CabinetSlot): { title: string; line2: string; line3: string } {
  if (slot.count === 0) return { title: slot.def.name, line2: 'Not won yet', line3: '' };
  return {
    title: slot.def.name,
    line2: formatSeasons(slot.seasons),
    line3: formatClubs(slot.clubNames),
  };
}
