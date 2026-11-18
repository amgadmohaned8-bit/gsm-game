/**
 * The foreign clubs of the UEFA Champions League and Europa League.
 *
 * They belong to no league of the game: they only exist for the European cups.
 * English clubs enter through their final Premier League position (see lib/football/europe.ts).
 * Logos: a placeholder crest (public/club-logos/europe/<id>.svg) is used until a real
 * <id>.png is put in the same folder and `node scripts/photos.mjs` is run again.
 */

import { EUROPE_LOGOS } from "@/lib/football/europeLogos.generated";

export type EuroClub = { id: string; name: string; short: string; country: string; city: string; stadium: string; rating: number; colors: [string, string]; logo: string };

const e = (id: string, name: string, short: string, country: string, city: string, stadium: string, rating: number, a: string, b: string): EuroClub => ({
  id, name, short, country, city, stadium, rating, colors: [a, b], logo: euroLogo(id),
});

/** Champions League: 32 foreign clubs + 4 English */
export const UCL_CLUBS: EuroClub[] = [
  e("real-madrid", "Real Madrid", "RMA", "Spain", "Madrid", "Santiago Bernabéu", 89, "#ffffff", "#febe10"),
  e("barcelona", "Barcelona", "BAR", "Spain", "Barcelona", "Spotify Camp Nou", 88, "#a50044", "#004d98"),
  e("atletico-madrid", "Atlético Madrid", "ATM", "Spain", "Madrid", "Metropolitano", 84, "#cb3524", "#272e61"),
  e("villarreal", "Villarreal", "VIL", "Spain", "Villarreal", "Estadio de la Cerámica", 77, "#f7e700", "#005c9e"),
  e("real-betis", "Real Betis", "BET", "Spain", "Seville", "Benito Villamarín", 75, "#0bb363", "#ffffff"),
  e("bayern-munich", "Bayern Munich", "BAY", "Germany", "Munich", "Allianz Arena", 89, "#dc052d", "#0066b2"),
  e("borussia-dortmund", "Borussia Dortmund", "BVB", "Germany", "Dortmund", "Signal Iduna Park", 82, "#fde100", "#000000"),
  e("rb-leipzig", "RB Leipzig", "RBL", "Germany", "Leipzig", "Red Bull Arena", 80, "#dd0741", "#ffffff"),
  e("vfb-stuttgart", "VfB Stuttgart", "VFB", "Germany", "Stuttgart", "MHPArena", 77, "#e32219", "#ffffff"),
  e("inter", "Inter", "INT", "Italy", "Milan", "San Siro", 86, "#0068a8", "#000000"),
  e("napoli", "Napoli", "NAP", "Italy", "Naples", "Stadio Maradona", 82, "#12a0d7", "#ffffff"),
  e("as-roma", "AS Roma", "ROM", "Italy", "Rome", "Stadio Olimpico", 78, "#8e1f2f", "#f0bc42"),
  e("como", "Como 1907", "COM", "Italy", "Como", "Stadio Giuseppe Sinigaglia", 71, "#1c4fa3", "#ffffff"),
  e("paris-saint-germain", "Paris Saint-Germain", "PSG", "France", "Paris", "Parc des Princes", 88, "#004170", "#da291c"),
  e("lille", "Lille", "LIL", "France", "Lille", "Decathlon Arena", 75, "#e01e13", "#1c2e5a"),
  e("rc-lens", "RC Lens", "RCL", "France", "Lens", "Stade Bollaert-Delelis", 72, "#f3c300", "#e01e13"),
  e("monaco", "AS Monaco", "ASM", "France", "Monaco", "Stade Louis II", 77, "#e30613", "#ffffff"),
  e("sporting-cp", "Sporting CP", "SCP", "Portugal", "Lisbon", "Estádio José Alvalade", 80, "#008057", "#ffffff"),
  e("porto", "FC Porto", "FCP", "Portugal", "Porto", "Estádio do Dragão", 78, "#003e7e", "#ffffff"),
  e("psv", "PSV Eindhoven", "PSV", "Netherlands", "Eindhoven", "Philips Stadion", 77, "#e2001a", "#ffffff"),
  e("feyenoord", "Feyenoord", "FEY", "Netherlands", "Rotterdam", "De Kuip", 76, "#e2001a", "#ffffff"),
  e("club-brugge", "Club Brugge", "BRU", "Belgium", "Bruges", "Jan Breydel Stadium", 74, "#0b6bb5", "#000000"),
  e("galatasaray", "Galatasaray", "GAL", "Turkey", "Istanbul", "RAMS Park", 76, "#a90432", "#fdb913"),
  e("fenerbahce", "Fenerbahçe", "FEN", "Turkey", "Istanbul", "Şükrü Saracoğlu", 75, "#fcd116", "#0f2e6d"),
  e("shakhtar-donetsk", "Shakhtar Donetsk", "SHA", "Ukraine", "Kyiv", "Arena Lviv", 71, "#f58220", "#000000"),
  e("slavia-praha", "Slavia Praha", "SLA", "Czechia", "Prague", "Fortuna Arena", 68, "#d10a11", "#ffffff"),
  e("bodo-glimt", "FK Bodø/Glimt", "BOD", "Norway", "Bodø", "Aspmyra Stadion", 70, "#ffd500", "#000000"),
  e("viking", "Viking FK", "VIK", "Norway", "Stavanger", "SR-Bank Arena", 62, "#1b458f", "#ffffff"),
  e("sabah", "Sabah FK", "SAB", "Azerbaijan", "Baku", "Bank Respublika Arena", 58, "#1c4fa3", "#ffffff"),
  e("aek-athens", "AEK Athens", "AEK", "Greece", "Athens", "OPAP Arena", 68, "#ffd500", "#000000"),
  e("lask", "LASK", "LSK", "Austria", "Linz", "Raiffeisen Arena", 62, "#000000", "#ffffff"),
  e("slovan-bratislava", "Slovan Bratislava", "SLO", "Slovakia", "Bratislava", "Tehelné pole", 58, "#1c8fe0", "#ffffff"),
];

/** Europa League: 34 foreign clubs + 2 English */
export const UEL_CLUBS: EuroClub[] = [
  e("celta-vigo", "Celta Vigo", "RCC", "Spain", "Vigo", "Balaídos", 73, "#8ac3ee", "#ffffff"),
  e("real-sociedad", "Real Sociedad", "RSO", "Spain", "San Sebastián", "Reale Arena", 76, "#0067b1", "#ffffff"),
  e("bayer-leverkusen", "Bayer Leverkusen", "B04", "Germany", "Leverkusen", "BayArena", 83, "#e32221", "#000000"),
  e("tsg-hoffenheim", "TSG Hoffenheim", "TSG", "Germany", "Sinsheim", "PreZero Arena", 70, "#1961b5", "#ffffff"),
  e("juventus", "Juventus", "JUV", "Italy", "Turin", "Allianz Stadium", 82, "#ffffff", "#000000"),
  e("ac-milan", "AC Milan", "MIL", "Italy", "Milan", "San Siro", 82, "#fb090b", "#000000"),
  e("lyon", "Olympique Lyonnais", "OL", "France", "Lyon", "Groupama Stadium", 75, "#1c2d5c", "#ffffff"),
  e("marseille", "Marseille", "OM", "France", "Marseille", "Stade Vélodrome", 78, "#2faee0", "#ffffff"),
  e("rennes", "Stade Rennais", "REN", "France", "Rennes", "Roazhon Park", 71, "#e13327", "#000000"),
  e("benfica", "Benfica", "SLB", "Portugal", "Lisbon", "Estádio da Luz", 80, "#e30613", "#ffffff"),
  e("braga", "SC Braga", "BRA", "Portugal", "Braga", "Estádio Municipal de Braga", 73, "#e30613", "#ffffff"),
  e("az-alkmaar", "AZ Alkmaar", "AZ", "Netherlands", "Alkmaar", "AFAS Stadion", 72, "#d10a11", "#ffffff"),
  e("nec-nijmegen", "NEC Nijmegen", "NEC", "Netherlands", "Nijmegen", "Goffertstadion", 64, "#d10a11", "#0b8a3c"),
  e("union-saint-gilloise", "Union Saint-Gilloise", "USG", "Belgium", "Brussels", "Stade Joseph Marien", 71, "#ffd500", "#1c2c5b"),
  e("anderlecht", "Anderlecht", "AND", "Belgium", "Brussels", "Lotto Park", 70, "#5b2a86", "#ffffff"),
  e("red-bull-salzburg", "Red Bull Salzburg", "RBS", "Austria", "Salzburg", "Red Bull Arena", 72, "#d90f28", "#1c2c5b"),
  e("sturm-graz", "Sturm Graz", "STU", "Austria", "Graz", "Merkur Arena", 66, "#000000", "#ffffff"),
  e("celtic", "Celtic", "CEL", "Scotland", "Glasgow", "Celtic Park", 72, "#018749", "#ffffff"),
  e("olympiacos", "Olympiacos", "OLY", "Greece", "Piraeus", "Karaiskakis Stadium", 71, "#d9000d", "#ffffff"),
  e("besiktas", "Beşiktaş", "BJK", "Turkey", "Istanbul", "Tüpraş Stadyumu", 71, "#000000", "#ffffff"),
  e("dinamo-zagreb", "Dinamo Zagreb", "DZG", "Croatia", "Zagreb", "Stadion Maksimir", 68, "#1f4fa3", "#ffffff"),
  e("ferencvaros", "Ferencváros", "FTC", "Hungary", "Budapest", "Groupama Aréna", 65, "#009a49", "#ffffff"),
  e("sparta-praha", "Sparta Praha", "SPA", "Czechia", "Prague", "Generali Česká pojišťovna Arena", 67, "#8a1538", "#f3c300"),
  e("viktoria-plzen", "Viktoria Plzeň", "PLZ", "Czechia", "Plzeň", "Doosan Arena", 64, "#d10a11", "#1c4fa3"),
  e("jagiellonia", "Jagiellonia Białystok", "JAG", "Poland", "Białystok", "Chorten Arena", 63, "#ffd500", "#d10a11"),
  e("lech-poznan", "Lech Poznań", "LEC", "Poland", "Poznań", "Stadion Poznań", 64, "#1c4fa3", "#ffffff"),
  e("lillestrom", "Lillestrøm", "LSM", "Norway", "Lillestrøm", "Åråsen Stadion", 56, "#ffd500", "#000000"),
  e("torreense", "SCU Torreense", "SCT", "Portugal", "Torres Vedras", "Estádio Manuel Marques", 52, "#d10a11", "#ffffff"),
  e("hapoel-beer-sheva", "Hapoel Be'er Sheva", "HBS", "Israel", "Beersheba", "Turner Stadium", 60, "#d10a11", "#ffffff"),
  e("ofi-crete", "OFI Crete", "OFI", "Greece", "Heraklion", "Theodoros Vardinogiannis Stadium", 56, "#ffffff", "#000000"),
  e("levski-sofia", "Levski Sofia", "LEV", "Bulgaria", "Sofia", "Georgi Asparuhov Stadium", 57, "#1c4fa3", "#ffffff"),
  e("omonia", "Omonia Nicosia", "OMO", "Cyprus", "Nicosia", "GSP Stadium", 59, "#0b8a3c", "#ffffff"),
  e("ararat-armenia", "Ararat-Armenia", "ARA", "Armenia", "Yerevan", "Vazgen Sargsyan Stadium", 54, "#d10a11", "#ffd500"),
  e("celje", "NK Celje", "CEL", "Slovenia", "Celje", "Stadion Z'dežele", 54, "#1c4fa3", "#ffd500"),
];

export const europeanClubs = [...UCL_CLUBS, ...UEL_CLUBS].map((x) => ({ id: x.id, name: x.name, city: x.city, stadium: x.stadium, logo: x.logo }));
export const europeRatings: Record<string, number> = Object.fromEntries([...UCL_CLUBS, ...UEL_CLUBS].map((x) => [x.id, x.rating]));
export const europeColors: Record<string, [string, string]> = Object.fromEntries([...UCL_CLUBS, ...UEL_CLUBS].map((x) => [x.id, x.colors]));
export const europeShort: Record<string, string> = Object.fromEntries([...UCL_CLUBS, ...UEL_CLUBS].map((x) => [x.id, x.short]));
export const isEuropean = (id: string) => id in europeRatings;

/** Crest of a European club or of the two cups (ids "ucl" and "uel"): the real PNG when it was added, else the placeholder. */
export function euroLogo(id: string) {
  const file = EUROPE_LOGOS[id];
  return file ? `/club-logos/europe/${file}` : `/club-logos/europe/${id}.svg`;
}
