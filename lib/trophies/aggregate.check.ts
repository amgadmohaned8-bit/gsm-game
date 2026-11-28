// Quick self-check for the cabinet logic. Run: bun lib/trophies/aggregate.check.ts
import assert from 'node:assert/strict';
import { buildCabinet, formatClubs, formatSeasons, listClubs, plaqueLines, type TrophyWin } from './aggregate';

const wins: TrophyWin[] = [
  { trophy_type: 'league_title', season: 2027, club_id: 'ahly', club_name: 'Al Ahly' },
  { trophy_type: 'league_title', season: 2028, club_id: 'ahly', club_name: 'Al Ahly' },
  { trophy_type: 'league_title', season: 2030, club_id: 'zam', club_name: 'Zamalek' },
  { trophy_type: 'caf_champions_league', season: 2028, club_id: 'ahly', club_name: 'Al Ahly' },
  { trophy_type: 'domestic_cup', season: 2027, club_id: 'ahly', club_name: 'Al Ahly' },
  { trophy_type: 'domestic_cup', season: 2030, club_id: 'zam', club_name: 'Zamalek' },
  { trophy_type: 'manager_of_year', season: 2028, club_id: 'ahly', club_name: 'Al Ahly' },
  { trophy_type: 'manager_of_year', season: 2030, club_id: 'zam', club_name: 'Zamalek' },
  { trophy_type: 'fair_play', season: 2029, club_id: 'pyr', club_name: 'Pyramids' },
  // duplicate row and an unknown type must both be ignored
  { trophy_type: 'fair_play', season: 2029, club_id: 'pyr', club_name: 'Pyramids' },
  { trophy_type: 'not_in_catalog', season: 2029, club_id: 'pyr', club_name: 'Pyramids' },
];

const all = buildCabinet(wins);
assert.equal(all.total, 9);
assert.equal(all.typeCount, 5);
assert.equal(all.clubCount, 3);

const league = all.columns[0].big;
assert.equal(league.def.type, 'league_title');
assert.equal(league.count, 3);
assert.deepEqual(league.seasons, [2027, 2028, 2030]);
assert.deepEqual(league.clubNames, ['Al Ahly', 'Zamalek']);
assert.deepEqual(plaqueLines(league), { title: 'League Title', line2: '2027, 2028, 2030', line3: 'Al Ahly / Zamalek' });

const zam = buildCabinet(wins, 'zam');
assert.equal(zam.total, 3);
assert.equal(zam.columns[0].big.count, 1);
assert.equal(zam.columns[1].big.count, 0); // Champions League was won with Al Ahly only
assert.equal(plaqueLines(zam.columns[1].big).line2, 'Not won yet');

// ordered by each club's first trophy: Al Ahly 2027, Pyramids 2029, Zamalek 2030
assert.deepEqual(listClubs(wins).map((c) => c.id), ['ahly', 'pyr', 'zam']);
assert.equal(formatSeasons([2027, 2028, 2029, 2030, 2031, 2032]), '2027, 2028, 2029 +3');
assert.equal(formatClubs(['A', 'B', 'C']), '3 clubs');
assert.equal(buildCabinet([]).total, 0);

console.log('trophy cabinet logic: all checks passed');
