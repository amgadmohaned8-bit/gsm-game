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
  e("athletic-club", "Athletic Club", "ATH", "Spain", "Bilbao", "San Mamés", 78, "#ee2523", "#ffffff"),
  e("bayern-munich", "Bayern Munich", "BAY", "Germany", "Munich", "Allianz Arena", 89, "#dc052d", "#0066b2"),
  e("borussia-dortmund", "Borussia Dortmund", "BVB", "Germany", "Dortmund", "Signal Iduna Park", 82, "#fde100", "#000000"),
  e("bayer-leverkusen", "Bayer Leverkusen", "B04", "Germany", "Leverkusen", "BayArena", 83, "#e32221", "#000000"),
  e("rb-leipzig", "RB Leipzig", "RBL", "Germany", "Leipzig", "Red Bull Arena", 80, "#dd0741", "#ffffff"),
  e("vfb-stuttgart", "VfB Stuttgart", "VFB", "Germany", "Stuttgart", "MHPArena", 77, "#e32219", "#ffffff"),
  e("eintracht-frankfurt", "Eintracht Frankfurt", "SGE", "Germany", "Frankfurt", "Deutsche Bank Park", 76, "#e1000f", "#000000"),
  e("inter", "Inter", "INT", "Italy", "Milan", "San Siro", 86, "#0068a8", "#000000"),
  e("ac-milan", "AC Milan", "MIL", "Italy", "Milan", "San Siro", 82, "#fb090b", "#000000"),
  e("juventus", "Juventus", "JUV", "Italy", "Turin", "Allianz Stadium", 82, "#ffffff", "#000000"),
  e("napoli", "Napoli", "NAP", "Italy", "Naples", "Stadio Maradona", 82, "#12a0d7", "#ffffff"),
  e("atalanta", "Atalanta", "ATA", "Italy", "Bergamo", "Gewiss Stadium", 81, "#1e71b8", "#000000"),
  e("as-roma", "AS Roma", "ROM", "Italy", "Rome", "Stadio Olimpico", 78, "#8e1f2f", "#f0bc42"),
  e("paris-saint-germain", "Paris Saint-Germain", "PSG", "France", "Paris", "Parc des Princes", 88, "#004170", "#da291c"),
  e("marseille", "Marseille", "OM", "France", "Marseille", "Stade Vélodrome", 78, "#2faee0", "#ffffff"),
  e("monaco", "AS Monaco", "ASM", "France", "Monaco", "Stade Louis II", 77, "#e30613", "#ffffff"),
  e("lille", "Lille", "LIL", "France", "Lille", "Decathlon Arena", 75, "#e01e13", "#1c2e5a"),
  e("benfica", "Benfica", "SLB", "Portugal", "Lisbon", "Estádio da Luz", 80, "#e30613", "#ffffff"),
  e("sporting-cp", "Sporting CP", "SCP", "Portugal", "Lisbon", "Estádio José Alvalade", 80, "#008057", "#ffffff"),
  e("porto", "FC Porto", "FCP", "Portugal", "Porto", "Estádio do Dragão", 78, "#003e7e", "#ffffff"),
  e("psv", "PSV Eindhoven", "PSV", "Netherlands", "Eindhoven", "Philips Stadion", 77, "#e2001a", "#ffffff"),
  e("feyenoord", "Feyenoord", "FEY", "Netherlands", "Rotterdam", "De Kuip", 76, "#e2001a", "#ffffff"),
  e("ajax", "Ajax", "AJA", "Netherlands", "Amsterdam", "Johan Cruijff Arena", 75, "#d2122e", "#ffffff"),
  e("club-brugge", "Club Brugge", "BRU", "Belgium", "Bruges", "Jan Breydel Stadium", 74, "#0b6bb5", "#000000"),
  e("galatasaray", "Galatasaray", "GAL", "Turkey", "Istanbul", "RAMS Park", 76, "#a90432", "#fdb913"),
  e("celtic", "Celtic", "CEL", "Scotland", "Glasgow", "Celtic Park", 72, "#018749", "#ffffff"),
  e("red-bull-salzburg", "Red Bull Salzburg", "RBS", "Austria", "Salzburg", "Red Bull Arena", 72, "#d90f28", "#1c2c5b"),
  e("olympiacos", "Olympiacos", "OLY", "Greece", "Piraeus", "Karaiskakis Stadium", 71, "#d9000d", "#ffffff"),
];

/** Europa League: 34 foreign clubs + 2 English */
export const UEL_CLUBS: EuroClub[] = [
  e("real-betis", "Real Betis", "BET", "Spain", "Seville", "Benito Villamarín", 75, "#0bb363", "#ffffff"),
  e("real-sociedad", "Real Sociedad", "RSO", "Spain", "San Sebastián", "Reale Arena", 76, "#0067b1", "#ffffff"),
  e("sevilla", "Sevilla", "SEV", "Spain", "Seville", "Ramón Sánchez-Pizjuán", 74, "#d4001f", "#ffffff"),
  e("valencia", "Valencia", "VAL", "Spain", "Valencia", "Mestalla", 72, "#f8a21b", "#000000"),
  e("sc-freiburg", "SC Freiburg", "SCF", "Germany", "Freiburg", "Europa-Park Stadion", 73, "#d10a11", "#000000"),
  e("vfl-wolfsburg", "VfL Wolfsburg", "WOB", "Germany", "Wolfsburg", "Volkswagen Arena", 70, "#65b32e", "#ffffff"),
  e("union-berlin", "Union Berlin", "FCU", "Germany", "Berlin", "An der Alten Försterei", 69, "#eb1923", "#ffffff"),
  e("tsg-hoffenheim", "TSG Hoffenheim", "TSG", "Germany", "Sinsheim", "PreZero Arena", 70, "#1961b5", "#ffffff"),
  e("lazio", "Lazio", "LAZ", "Italy", "Rome", "Stadio Olimpico", 76, "#87d8f7", "#ffffff"),
  e("fiorentina", "Fiorentina", "FIO", "Italy", "Florence", "Stadio Franchi", 74, "#482e92", "#ffffff"),
  e("bologna", "Bologna", "BOL", "Italy", "Bologna", "Renato Dall'Ara", 74, "#1a2f48", "#a21c26"),
  e("torino", "Torino", "TOR", "Italy", "Turin", "Stadio Olimpico Grande Torino", 70, "#8a1538", "#ffffff"),
  e("lyon", "Olympique Lyonnais", "OL", "France", "Lyon", "Groupama Stadium", 75, "#1c2d5c", "#ffffff"),
  e("nice", "OGC Nice", "NIC", "France", "Nice", "Allianz Riviera", 72, "#e01e13", "#000000"),
  e("rennes", "Stade Rennais", "REN", "France", "Rennes", "Roazhon Park", 71, "#e13327", "#000000"),
  e("rc-lens", "RC Lens", "RCL", "France", "Lens", "Stade Bollaert-Delelis", 72, "#f3c300", "#e01e13"),
  e("braga", "SC Braga", "BRA", "Portugal", "Braga", "Estádio Municipal de Braga", 73, "#e30613", "#ffffff"),
  e("vitoria-guimaraes", "Vitória SC", "VSC", "Portugal", "Guimarães", "Estádio D. Afonso Henriques", 68, "#ffffff", "#000000"),
  e("az-alkmaar", "AZ Alkmaar", "AZ", "Netherlands", "Alkmaar", "AFAS Stadion", 72, "#d10a11", "#ffffff"),
  e("fc-twente", "FC Twente", "TWE", "Netherlands", "Enschede", "De Grolsch Veste", 69, "#e2001a", "#ffffff"),
  e("union-saint-gilloise", "Union Saint-Gilloise", "USG", "Belgium", "Brussels", "Stade Joseph Marien", 71, "#ffd500", "#1c2c5b"),
  e("anderlecht", "Anderlecht", "AND", "Belgium", "Brussels", "Lotto Park", 70, "#5b2a86", "#ffffff"),
  e("genk", "KRC Genk", "GNK", "Belgium", "Genk", "Cegeka Arena", 68, "#0a4da2", "#ffffff"),
  e("fenerbahce", "Fenerbahçe", "FEN", "Turkey", "Istanbul", "Şükrü Saracoğlu", 75, "#fcd116", "#0f2e6d"),
  e("besiktas", "Beşiktaş", "BJK", "Turkey", "Istanbul", "Tüpraş Stadyumu", 71, "#000000", "#ffffff"),
  e("trabzonspor", "Trabzonspor", "TRA", "Turkey", "Trabzon", "Papara Park", 68, "#7b1e3a", "#00a0d2"),
  e("rangers", "Rangers", "RAN", "Scotland", "Glasgow", "Ibrox Stadium", 70, "#1b458f", "#ffffff"),
  e("hearts", "Heart of Midlothian", "HRT", "Scotland", "Edinburgh", "Tynecastle Park", 64, "#8e1f2f", "#ffffff"),
  e("red-star-belgrade", "Red Star Belgrade", "CZV", "Serbia", "Belgrade", "Rajko Mitić Stadium", 69, "#e30613", "#ffffff"),
  e("dinamo-zagreb", "Dinamo Zagreb", "DZG", "Croatia", "Zagreb", "Stadion Maksimir", 68, "#1f4fa3", "#ffffff"),
  e("slavia-praha", "Slavia Praha", "SLA", "Czechia", "Prague", "Fortuna Arena", 68, "#d10a11", "#ffffff"),
  e("paok", "PAOK", "PAO", "Greece", "Thessaloniki", "Toumba Stadium", 67, "#000000", "#ffffff"),
  e("fc-basel", "FC Basel", "BAS", "Switzerland", "Basel", "St. Jakob-Park", 66, "#d10a11", "#1c2c5b"),
  e("ferencvaros", "Ferencváros", "FTC", "Hungary", "Budapest", "Groupama Aréna", 65, "#009a49", "#ffffff"),
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
