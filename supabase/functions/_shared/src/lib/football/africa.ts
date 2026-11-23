// @ts-nocheck
/**
 * The African clubs of the CAF cups, and how the Egyptian clubs get in.
 *
 * These clubs are NOT part of any league: they only exist for the continental
 * cups. Egyptian clubs are never listed here. They enter through their
 * final league position (see `egyptSlots`).
 * Logos are drawn as placeholder crests until real files are added: set `logo`
 * to a path like "/club-logos/mamelodi-sundowns.png" and it replaces the crest.
 */

/** clubs that already have their real logo (png) */
const REAL = new Set(["js-kabylie", "usm-alger", "al-merreikh", "enyimba", "asante-kotoko", "hearts-of-oak", "maniema-union", "rs-berkane", "rivers-united", "kaizer-chiefs", "stellenbosch", "cs-sfaxien", "etoile-sahel", "mamelodi-sundowns", "orlando-pirates", "esperance-tunis", "wydad-ac", "raja-ca", "tp-mazembe", "as-far", "cr-belouizdad", "young-africans", "al-hilal-omdurman", "petro-luanda", "simba-sc", "horoya-ac", "asec-mimosas", "cs-constantine"]);

export type AfricanClub = { id: string; name: string; short: string; country: string; city: string; stadium: string; rating: number; colors: [string, string]; logo: string };

const CITY: Record<string, [string, string]> = {"mamelodi-sundowns": ["Pretoria", "Loftus Versfeld Stadium"], "orlando-pirates": ["Johannesburg", "Orlando Stadium"], "esperance-tunis": ["Tunis", "Stade Hammadi Agrebi"], "wydad-ac": ["Casablanca", "Stade Mohammed V"], "raja-ca": ["Casablanca", "Stade Mohammed V"], "tp-mazembe": ["Lubumbashi", "Stade TP Mazembe"], "as-far": ["Rabat", "Stade Prince Moulay Abdellah"], "cr-belouizdad": ["Algiers", "Stade 5 Juillet 1962"], "young-africans": ["Dar es Salaam", "Benjamin Mkapa Stadium"], "al-hilal-omdurman": ["Omdurman", "Al Hilal Stadium"], "petro-luanda": ["Luanda", "Estadio 11 de Novembro"], "simba-sc": ["Dar es Salaam", "Benjamin Mkapa Stadium"], "horoya-ac": ["Conakry", "Stade du 28 Septembre"], "asec-mimosas": ["Abidjan", "Stade Felix Houphouet-Boigny"], "rs-berkane": ["Berkane", "Stade Municipal de Berkane"], "usm-alger": ["Algiers", "Stade Omar Hamadi"], "kaizer-chiefs": ["Johannesburg", "FNB Stadium"], "stellenbosch": ["Stellenbosch", "Danie Craven Stadium"], "cs-constantine": ["Constantine", "Stade Mohamed Hamlaoui"], "etoile-sahel": ["Sousse", "Stade Olympique de Sousse"], "cs-sfaxien": ["Sfax", "Stade Taieb Mhiri"], "js-kabylie": ["Tizi Ouzou", "Stade du 1er Novembre"], "al-merreikh": ["Omdurman", "Al Merreikh Stadium"], "enyimba": ["Aba", "Enyimba International Stadium"], "rivers-united": ["Port Harcourt", "Yakubu Gowon Stadium"], "asante-kotoko": ["Kumasi", "Baba Yara Stadium"], "hearts-of-oak": ["Accra", "Accra Sports Stadium"], "maniema-union": ["Kindu", "Stade Joseph Kabila"]};

/** logo: a placeholder crest. To use a real logo, put the file in public/club-logos/africa/ and change the extension here. */
const c = (id: string, name: string, short: string, country: string, rating: number, a: string, b: string): AfricanClub => ({
  id, name, short, country, city: CITY[id]?.[0] ?? country, stadium: CITY[id]?.[1] ?? `${name} Stadium`, rating, colors: [a, b], logo: `/club-logos/africa/${id}.${REAL.has(id) ? "png" : "svg"}`,
});

/** Champions League: 14 clubs + 2 from Egypt */
export const CL_CLUBS: AfricanClub[] = [
  c("mamelodi-sundowns", "Mamelodi Sundowns", "MS", "South Africa", 84, "#ffd100", "#0a3d91"),
  c("orlando-pirates", "Orlando Pirates", "OP", "South Africa", 80, "#111111", "#e0e0e0"),
  c("esperance-tunis", "Espérance de Tunis", "EST", "Tunisia", 79, "#d71920", "#f5c400"),
  c("wydad-ac", "Wydad AC", "WAC", "Morocco", 79, "#d71920", "#ffffff"),
  c("raja-ca", "Raja CA", "RCA", "Morocco", 78, "#1b7f3b", "#ffffff"),
  c("tp-mazembe", "TP Mazembe", "TPM", "DR Congo", 77, "#111111", "#ffffff"),
  c("as-far", "AS FAR", "FAR", "Morocco", 76, "#1b5e20", "#c9a227"),
  c("cr-belouizdad", "CR Belouizdad", "CRB", "Algeria", 75, "#d71920", "#ffffff"),
  c("young-africans", "Young Africans", "YAN", "Tanzania", 75, "#1b7f3b", "#ffd100"),
  c("al-hilal-omdurman", "Al Hilal Omdurman", "HIL", "Sudan", 72, "#0a3d91", "#ffffff"),
  c("petro-luanda", "Petro de Luanda", "PET", "Angola", 72, "#c9a227", "#1b5e20"),
  c("simba-sc", "Simba SC", "SIM", "Tanzania", 72, "#d71920", "#ffffff"),
  c("horoya-ac", "Horoya AC", "HOR", "Guinea", 70, "#f5c400", "#d71920"),
  c("asec-mimosas", "ASEC Mimosas", "ASE", "Ivory Coast", 70, "#f5c400", "#111111"),
];

/** Confederation Cup: 14 clubs + 2 from Egypt */
export const CC_CLUBS: AfricanClub[] = [
  c("rs-berkane", "RS Berkane", "RSB", "Morocco", 77, "#f26b21", "#111111"),
  c("usm-alger", "USM Alger", "USM", "Algeria", 76, "#d71920", "#111111"),
  c("kaizer-chiefs", "Kaizer Chiefs", "KC", "South Africa", 74, "#f5c400", "#111111"),
  c("stellenbosch", "Stellenbosch", "STE", "South Africa", 73, "#7a1230", "#c9a227"),
  c("cs-constantine", "CS Constantine", "CSC", "Algeria", 72, "#1b7f3b", "#111111"),
  c("etoile-sahel", "Étoile du Sahel", "ESS", "Tunisia", 72, "#d71920", "#ffffff"),
  c("cs-sfaxien", "CS Sfaxien", "CSS", "Tunisia", 71, "#111111", "#ffffff"),
  c("js-kabylie", "JS Kabylie", "JSK", "Algeria", 70, "#1b7f3b", "#f5c400"),
  c("al-merreikh", "Al Merreikh", "MER", "Sudan", 68, "#d71920", "#ffffff"),
  c("enyimba", "Enyimba", "ENY", "Nigeria", 68, "#0a3d91", "#ffffff"),
  c("rivers-united", "Rivers United", "RIV", "Nigeria", 67, "#0a7e8c", "#ffffff"),
  c("asante-kotoko", "Asante Kotoko", "KOT", "Ghana", 66, "#d71920", "#ffffff"),
  c("hearts-of-oak", "Hearts of Oak", "HOO", "Ghana", 65, "#0a3d91", "#d71920"),
  c("maniema-union", "Maniema Union", "MAN", "DR Congo", 62, "#1b7f3b", "#ffd100"),
];

export type CafCup = { id: string; name: string; clubs: AfricanClub[]; egypt: number[] };

/** Egypt's places, tied to the final table: cup id -> league positions that qualify. */
export const CAF_CUPS: CafCup[] = [
  { id: "caf-champions-league", name: "CAF Champions League", clubs: CL_CLUBS, egypt: [1, 2] },
  { id: "caf-confederation-cup", name: "CAF Confederation Cup", clubs: CC_CLUBS, egypt: [3, 4] },
];

export const EGYPT_LEAGUE = "egyptian-premier-league";

/** Every African club, as a plain club record (names, logos) for the lookups used across the game. */
export const africanClubs = [...CL_CLUBS, ...CC_CLUBS].map((x) => ({ id: x.id, name: x.name, city: x.city, stadium: x.stadium, logo: x.logo }));
export const africaRatings: Record<string, number> = Object.fromEntries([...CL_CLUBS, ...CC_CLUBS].map((x) => [x.id, x.rating]));
export const africaColors: Record<string, string> = Object.fromEntries([...CL_CLUBS, ...CC_CLUBS].map((x) => [x.id, x.colors[0]]));
export const isAfrican = (id: string) => id in africaRatings;
export const isCafCup = (id: string | null | undefined) => CAF_CUPS.some((c) => c.id === id);
