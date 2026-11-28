// Every trophy a manager can win. The cabinet is built from this list:
// add a trophy here (and drop its PNG in public/trophies) and a new slot shows up.

export type TrophySize = 'big' | 'small';

export interface TrophyDef {
  /** Stored in manager_trophies.trophy_type. Never rename once used. */
  type: string;
  /** Shown on the brass plaque. */
  name: string;
  /** Big trophies stand on the top shelf, small ones (awards) on the lower shelf. */
  size: TrophySize;
  /** Transparent PNG, front view. */
  image: string;
}

export const TROPHY_CATALOG: readonly TrophyDef[] = [
  // Top shelf (cups)
  { type: 'league_title', name: 'League Title', size: 'big', image: '/trophies/league_title.png' },
  { type: 'caf_champions_league', name: 'Champions League', size: 'big', image: '/trophies/caf_champions_league.png' },
  { type: 'domestic_cup', name: 'Domestic Cup', size: 'big', image: '/trophies/domestic_cup.png' },
  { type: 'caf_confederation_cup', name: 'Confederation Cup', size: 'big', image: '/trophies/caf_confederation_cup.png' },
  { type: 'super_cup', name: 'Super Cup', size: 'big', image: '/trophies/super_cup.png' },

  // Lower shelf (manager awards)
  { type: 'manager_of_year', name: 'Manager of the Year', size: 'small', image: '/trophies/manager_of_year.png' },
  { type: 'fair_play', name: 'Fair Play Award', size: 'small', image: '/trophies/fair_play.png' },
  { type: 'unbeaten_season', name: 'Unbeaten Season', size: 'small', image: '/trophies/unbeaten_season.png' },
  { type: 'manager_of_month', name: 'Manager of the Month', size: 'small', image: '/trophies/manager_of_month.png' },
  { type: 'winning_streak', name: 'Winning Streak', size: 'small', image: '/trophies/winning_streak.png' },
];

export const TROPHY_TYPES: ReadonlySet<string> = new Set(TROPHY_CATALOG.map((t) => t.type));

export interface CabinetColumnDef {
  big: TrophyDef;
  small: TrophyDef;
}

/** Pairs the n-th big trophy with the n-th small one: one column of the cabinet each. */
export function cabinetLayout(): CabinetColumnDef[] {
  const bigs = TROPHY_CATALOG.filter((t) => t.size === 'big');
  const smalls = TROPHY_CATALOG.filter((t) => t.size === 'small');
  if (bigs.length !== smalls.length) {
    throw new Error('Trophy catalog needs the same number of big and small trophies');
  }
  return bigs.map((big, i) => ({ big, small: smalls[i] }));
}
