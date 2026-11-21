/**
 * The world market: players outside the Premier League.
 *
 * Stars, solid pros, young prospects and free agents. Stars come with the
 * league they play in. Prospects and free agents are invented players, so the
 * market always has cheap options for a small club.
 *
 * Line format: name position nationality age rating origin [club]
 * origin: the league he plays in, or Prospect | Free. These leagues do not exist in the game:
 * the players are simply on the market. New lines go at the END (ids follow the line order).
 *
 * Only part of this pool is for sale at any time: see visibleMarket() below.
 */

import type { Player, Position } from "@/lib/football/squads";

export type Origin = "LaLiga" | "Bundesliga" | "SerieA" | "Ligue1" | "Saudi" | "Portugal" | "Netherlands" | "Turkey" | "Brazil" | "MLS" | "Icon" | "Star" | "Prospect" | "Free";

export const originLabel: Record<Origin, string> = {
  LaLiga: "La Liga",
  Bundesliga: "Bundesliga",
  SerieA: "Serie A",
  Ligue1: "Ligue 1",
  Saudi: "Saudi Pro League",
  Portugal: "Primeira Liga",
  Netherlands: "Eredivisie",
  Turkey: "Süper Lig",
  Brazil: "Brasileirão",
  MLS: "MLS",
  Icon: "Icon",
  Star: "Star",
  Prospect: "Young prospect",
  Free: "Free agent",
};

const raw = `
Mbappé FW FR 27 91 LaLiga
Yamal FW ES 19 90 LaLiga
Vinícius_Jr FW BR 26 89 LaLiga
Bellingham MF ENG 23 89 LaLiga
Kane FW ENG 33 90 Bundesliga
Musiala MF DE 23 87 Bundesliga
Olise FW FR 24 86 Bundesliga
Pedri MF ES 23 87 LaLiga
Raphinha FW BR 29 86 LaLiga
Dembélé FW FR 29 87 Ligue1
Vitinha MF PT 26 92 Ligue1
Nuno_Mendes DF PT 24 85 Ligue1
Hakimi DF MA 28 85 Ligue1
Courtois GK BE 34 88 LaLiga
Oblak GK SI 33 86 LaLiga
Valverde MF UY 28 87 LaLiga
Kimmich MF DE 31 86 Bundesliga
Lautaro FW AR 28 87 SerieA
Osimhen FW NG 27 86 SerieA
Kvaratskhelia FW GE 25 86 Ligue1
Leão FW PT 27 84 SerieA
Barella MF IT 29 84 SerieA
Tchouaméni MF FR 26 84 LaLiga
Rüdiger DF DE 33 82 LaLiga
Militão DF BR 28 82 LaLiga
Lewandowski FW PL 38 82 LaLiga
Koundé DF FR 27 84 LaLiga
Bastoni DF IT 27 86 SerieA
Alexander-Arnold DF ENG 27 86 LaLiga
Lucas_Moreno MF ES 28 77 LaLiga
Dani_Bermúdez DF ES 26 76 LaLiga
Mats_Hoffmann MF DE 27 76 Bundesliga
Jonas_Brandt FW DE 26 77 Bundesliga
Luca_Ferraro DF IT 29 76 SerieA
Matteo_Rinaldi MF IT 27 77 SerieA
Andrea_Conti FW IT 25 76 SerieA
Yanis_Mercier MF FR 26 75 Ligue1
Hugo_Perrin FW FR 24 76 Ligue1
Rafael_Duarte DF PT 28 75 Ligue1
Nabil_Haddad MF DZ 27 75 Saudi
Faisal_Al-Harbi FW SA 29 74 Saudi
Thomas_Wouters GK BE 30 75 Bundesliga
Iker_Salvatierra GK ES 31 74 LaLiga
Mateo_Vidal FW AR 19 66 Prospect
Kofi_Mensah MF GH 18 65 Prospect
Eli_Lindqvist DF SE 19 64 Prospect
Tiago_Faria MF PT 18 64 Prospect
Omar_Diallo FW SN 19 66 Prospect
Noah_Bergström FW SE 18 62 Prospect
Nico_Aguilar DF CL 19 63 Prospect
Jamal_Okoro DF NG 18 62 Prospect
Sam_Whitlock GK ENG 19 60 Prospect
Leo_Marchetti MF IT 18 63 Prospect
Dario_Kovač DF HR 19 64 Prospect
Adrien_Lefèvre MF FR 18 63 Prospect
Marcus_Webb DF ENG 33 73 Free
Ivan_Petrov MF RU 32 74 Free
Diego_Quiroga FW UY 32 75 Free
Hassan_Rahim DF EG 31 72 Free
Pablo_Nieto GK ES 34 72 Free
Stefan_Novak MF CZ 31 73 Free
Carlos_Arriaga FW MX 31 74 Free
Felix_Baumann DF DE 32 72 Free
Rodrygo FW BR 25 86 LaLiga Real_Madrid
Arda_Güler MF TR 21 82 LaLiga Real_Madrid
Camavinga MF FR 23 82 LaLiga Real_Madrid
Huijsen DF ES 21 83 LaLiga Real_Madrid
Endrick FW BR 20 78 LaLiga Real_Madrid
Fran_García DF ES 26 77 LaLiga Real_Madrid
Frenkie_de_Jong MF NL 29 82 LaLiga Barcelona
Pau_Cubarsí DF ES 19 82 LaLiga Barcelona
Araújo DF UY 27 82 LaLiga Barcelona
Balde DF ES 22 80 LaLiga Barcelona
Ter_Stegen GK DE 34 83 LaLiga Barcelona
Gavi MF ES 21 80 LaLiga Barcelona
Ferran_Torres FW ES 26 78 LaLiga Barcelona
Julián_Álvarez FW AR 26 85 LaLiga Atlético_Madrid
Álex_Baena MF ES 24 81 LaLiga Atlético_Madrid
Koke MF ES 34 77 LaLiga Atlético_Madrid
Giménez DF UY 31 79 LaLiga Atlético_Madrid
Nico_Williams FW ES 24 83 LaLiga Athletic_Club
Unai_Simón GK ES 28 85 LaLiga Athletic_Club
Oyarzabal FW ES 29 83 LaLiga Real_Sociedad
Takefusa_Kubo FW JP 25 79 LaLiga Real_Sociedad
Álex_Remiro GK ES 31 78 LaLiga Real_Sociedad
Santi_Comesaña MF ES 29 77 LaLiga Villarreal
Gerard_Moreno FW ES 34 75 LaLiga Villarreal
Iago_Aspas FW ES 38 76 LaLiga Celta_Vigo
Isco MF ES 34 76 LaLiga Real_Betis
Antony FW BR 26 77 LaLiga Real_Betis
Luis_Díaz FW CO 29 85 Bundesliga Bayern_Munich
Upamecano DF FR 27 88 Bundesliga Bayern_Munich
Davies DF CA 25 81 Bundesliga Bayern_Munich
Neuer GK DE 40 80 Bundesliga Bayern_Munich
Gnabry FW DE 31 80 Bundesliga Bayern_Munich
Guirassy FW GN 30 82 Bundesliga Borussia_Dortmund
Schlotterbeck DF DE 26 87 Bundesliga Borussia_Dortmund
Kobel GK CH 28 83 Bundesliga Borussia_Dortmund
Julian_Brandt MF DE 30 80 Bundesliga Borussia_Dortmund
Jobe_Bellingham MF ENG 20 78 Bundesliga Borussia_Dortmund
Adeyemi FW DE 24 78 Bundesliga Borussia_Dortmund
Patrik_Schick FW CZ 30 80 Bundesliga Bayer_Leverkusen
Exequiel_Palacios MF AR 27 79 Bundesliga Bayer_Leverkusen
Loïs_Openda FW BE 26 77 Bundesliga RB_Leipzig
Undav FW DE 29 78 Bundesliga VfB_Stuttgart
Hakan_Çalhanoğlu MF TR 32 83 SerieA Inter
Marcus_Thuram FW FR 28 83 SerieA Inter
Dimarco DF IT 28 86 SerieA Inter
Yann_Sommer GK CH 37 80 SerieA Inter
Maignan GK FR 31 85 SerieA AC_Milan
Pulisic FW US 27 82 SerieA AC_Milan
Modrić MF HR 40 80 SerieA AC_Milan
Kenan_Yıldız FW TR 21 82 SerieA Juventus
Bremer DF BR 29 83 SerieA Juventus
Vlahović FW RS 26 79 SerieA Juventus
McTominay MF SCO 29 83 SerieA Napoli
De_Bruyne MF BE 35 84 SerieA Napoli
Buongiorno DF IT 26 81 SerieA Napoli
Lukaku FW BE 33 79 SerieA Napoli
Lookman FW NG 28 83 SerieA Atalanta
Dybala FW AR 32 80 SerieA Roma
Zaccagni MF IT 31 77 SerieA Lazio
Moise_Kean FW IT 26 80 SerieA Fiorentina
Doué FW FR 20 86 Ligue1 Paris_Saint-Germain
João_Neves MF PT 21 89 Ligue1 Paris_Saint-Germain
Marquinhos DF BR 32 85 Ligue1 Paris_Saint-Germain
Zaïre-Emery MF FR 20 83 Ligue1 Paris_Saint-Germain
Lucas_Chevalier GK FR 24 80 Ligue1 Paris_Saint-Germain
Mason_Greenwood FW ENG 24 82 Ligue1 Marseille
Ben_Seghir FW MA 21 78 Ligue1 Monaco
Cristiano_Ronaldo FW PT 41 80 Saudi Al_Nassr
Kingsley_Coman FW FR 30 80 Saudi Al_Nassr
João_Félix FW PT 26 79 Saudi Al_Nassr
Sadio_Mané FW SN 34 78 Saudi Al_Nassr
Benzema FW FR 38 79 Saudi Al_Hilal
Rúben_Neves MF PT 29 79 Saudi Al_Hilal
Bounou GK MA 35 80 Saudi Al_Hilal
Mitrović FW RS 31 78 Saudi Al_Hilal
Kanté MF FR 35 79 Saudi Al_Ittihad
Mahrez FW DZ 35 77 Saudi Al_Ahli
Ivan_Toney FW ENG 30 78 Saudi Al_Ahli
Hjulmand MF DK 26 80 Portugal Sporting_CP
Geovany_Quenda FW PT 19 78 Portugal Sporting_CP
Diogo_Costa GK PT 26 82 Portugal Porto
Gonçalo_Inácio DF PT 24 80 Portugal Sporting_CP
Orkun_Kökçü MF TR 25 78 Portugal Benfica
Otamendi DF AR 38 75 Portugal Benfica
Samu_Aghehowa FW ES 22 77 Portugal Porto
Saibari MF MA 25 77 Netherlands PSV
Pepi FW US 23 76 Netherlands PSV
Mika_Godts FW BE 21 76 Netherlands Ajax
Sané FW DE 30 80 Turkey Galatasaray
Icardi FW AR 33 77 Turkey Galatasaray
Rafa_Silva FW PT 33 76 Turkey Beşiktaş
İsmail_Yüksek MF TR 27 76 Turkey Fenerbahçe
Messi FW AR 39 83 MLS Inter_Miami
Son_Heung-min FW KR 34 80 MLS LAFC
Bouanga FW FR 31 79 MLS LAFC
Luis_Suárez FW UY 39 74 MLS Inter_Miami
Thomas_Müller FW DE 36 74 MLS Vancouver
Gerson MF BR 28 78 Brazil Flamengo
Arrascaeta MF UY 31 78 Brazil Flamengo
Pedro FW BR 28 77 Brazil Flamengo
Raphael_Veiga MF BR 30 76 Brazil Palmeiras
Neymar FW BR 34 76 Brazil Santos
Gustavo_Gómez DF PY 33 75 Brazil Palmeiras`;

const OLD_CLUBS: Record<string, string> = {
  "Mbappé": "Real Madrid", Yamal: "Barcelona", "Vinícius Jr": "Real Madrid", Bellingham: "Real Madrid", Kane: "Bayern Munich", Musiala: "Bayern Munich",
  Olise: "Bayern Munich", Pedri: "Barcelona", Raphinha: "Barcelona", "Dembélé": "Paris Saint-Germain", Vitinha: "Paris Saint-Germain", "Nuno Mendes": "Paris Saint-Germain",
  Hakimi: "Paris Saint-Germain", Courtois: "Real Madrid", Oblak: "Atlético Madrid", Valverde: "Real Madrid", Kimmich: "Bayern Munich", Lautaro: "Inter",
  Osimhen: "Galatasaray", Kvaratskhelia: "Paris Saint-Germain", "Leão": "AC Milan", Barella: "Inter", "Tchouaméni": "Real Madrid", "Rüdiger": "Real Madrid",
  "Militão": "Real Madrid", Lewandowski: "Barcelona", "Koundé": "Barcelona", Bastoni: "Inter", "Alexander-Arnold": "Real Madrid",
};

// invented prospects and free agents on top of the real pool, so a small club always has cheap options
const FIRST: Record<string, string[]> = {
  ES: ["Álvaro", "Hugo", "Iván", "Raúl", "Marc"], FR: ["Théo", "Lucas", "Enzo", "Maël", "Nolan"], IT: ["Gianluca", "Federico", "Lorenzo", "Riccardo", "Davide"],
  DE: ["Lukas", "Finn", "Jonas", "Tim", "Moritz"], PT: ["Tomás", "Rui", "Diogo", "Nuno", "Bruno"], BR: ["Caio", "Matheus", "Vitor", "Gabriel", "Luan"],
  NL: ["Daan", "Sem", "Jesse", "Bram", "Joris"], AR: ["Thiago", "Facundo", "Lautaro", "Julián", "Bautista"], NG: ["Chidi", "Emeka", "Tunde", "Kelechi", "Femi"],
  GH: ["Kwame", "Yaw", "Kojo", "Nii", "Kwesi"], SN: ["Moussa", "Ibrahima", "Cheikh", "Mamadou", "Pape"], EG: ["Omar", "Mostafa", "Karim", "Ziad", "Ahmed"],
  MA: ["Yassine", "Amine", "Hamza", "Ayoub", "Adam"], ENG: ["Jack", "Callum", "Harvey", "Reece", "Mason"],
};
const LAST: Record<string, string[]> = {
  ES: ["Navarro", "Ortega", "Santos", "Molina", "Cabrera"], FR: ["Lambert", "Fournier", "Girard", "Rousseau", "Bertrand"], IT: ["Moretti", "Greco", "Bruno", "Costa", "Ricci"],
  DE: ["Keller", "Vogel", "Schäfer", "Lange", "Krüger"], PT: ["Pereira", "Sousa", "Carvalho", "Teixeira", "Moura"], BR: ["Silva", "Araújo", "Barbosa", "Cardoso", "Nogueira"],
  NL: ["de Wit", "van Dijk", "Bakker", "Mulder", "Smit"], AR: ["Acosta", "Benítez", "Ferreyra", "Sosa", "Ledesma"], NG: ["Adebayo", "Eze", "Okafor", "Balogun", "Nwosu"],
  GH: ["Boateng", "Asamoah", "Owusu", "Appiah", "Tetteh"], SN: ["Sarr", "Ndiaye", "Diop", "Faye", "Gueye"], EG: ["Hassan", "Salem", "Fathy", "Mansour", "Nabil"],
  MA: ["El Idrissi", "Benali", "Amrabat", "Zahouani", "Berrada"], ENG: ["Hartley", "Whitmore", "Pryce", "Gallagher", "Bannister"],
};
const NATS = Object.keys(FIRST);
const POS: Position[] = ["GK", "DF", "DF", "MF", "MF", "FW", "FW", "DF", "MF", "FW"];

function hashOf(t: string) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return h >>> 0;
}
function generated(): string {
  const out: string[] = [];
  for (let i = 0; i < 48; i++) {
    const n = NATS[hashOf(`prospect|${i}`) % NATS.length];
    const f = FIRST[n][hashOf(`pf|${i}`) % 5], l = LAST[n][hashOf(`pl|${i}`) % 5];
    const age = 17 + (hashOf(`pa|${i}`) % 4), rating = 58 + (hashOf(`pr|${i}`) % 11);
    out.push(`${f}_${l.replace(/ /g, "_")} ${POS[hashOf(`pp|${i}`) % POS.length]} ${n} ${age} ${rating} Prospect`);
  }
  for (let i = 0; i < 32; i++) {
    const n = NATS[hashOf(`free|${i}`) % NATS.length];
    const f = FIRST[n][hashOf(`ff|${i}`) % 5], l = LAST[n][hashOf(`fl|${i}`) % 5];
    const age = 29 + (hashOf(`fa|${i}`) % 7), rating = 68 + (hashOf(`fr|${i}`) % 9);
    out.push(`${f}_${l.replace(/ /g, "_")} ${POS[hashOf(`fp|${i}`) % POS.length]} ${n} ${age} ${rating} Free`);
  }
  return out.join("\n");
}

// new stars that reach the market a few at a time (appended last so every old player id stays the same)
const EXTRA = `

Willian_Pacho DF EC 24 82 Ligue1 Paris_Saint-Germain
Ademola_Lookman FW NG 28 82 SerieA Atalanta
Théo_Hernandez DF FR 29 82 Saudi Al-Hilal
Heung-min_Son FW KR 34 80 MLS LAFC
Kalidou_Koulibaly DF SN 35 76 Saudi Al-Hilal
Gianluca_Scamacca FW IT 27 77 SerieA Atalanta
Francisco_Conceição FW PT 23 81 SerieA Juventus
Jorrel_Hato DF NL 20 80 Netherlands Ajax
Wilfried_Singo DF CI 25 80 Turkey Galatasaray
Victor_Boniface FW NG 25 81 Bundesliga Bayer_Leverkusen
Florian_Neuhaus MF DE 29 77 Bundesliga Borussia_Mönchengladbach
Nicolás_González FW AR 27 80 SerieA Juventus
Matías_Soulé FW AR 23 79 SerieA Roma
Paulo_Henrique FW BR 23 77 Brazil Flamengo
Lamine_Camara MF SN 22 79 Ligue1 Monaco
Takumi_Minamino FW JP 31 75 Ligue1 Monaco
Mikautadze FW GE 25 80 Ligue1 Lyon
Nico_Paz MF AR 21 80 SerieA Como
Bradley_Barcola FW FR 24 84 Ligue1 Paris_Saint-Germain
Khéphren_Thuram MF FR 25 79 SerieA Juventus
Teun_Koopmeiners MF NL 28 80 SerieA Juventus
Manuel_Locatelli MF IT 28 79 SerieA Juventus
Vitor_Roque FW BR 21 77 Brazil Palmeiras
Gonçalo_Ramos FW PT 25 80 Ligue1 Paris_Saint-Germain
Kang-in_Lee MF KR 25 78 Ligue1 Paris_Saint-Germain
Randal_Kolo_Muani FW FR 27 78 SerieA Juventus
Rodrigo_De_Paul MF AR 32 79 MLS Inter_Miami
Marcos_Leonardo FW BR 23 77 Saudi Al-Hilal
Aymeric_Laporte DF ES 32 78 LaLiga Athletic_Club
Aleksandar_Mitrović FW RS 31 78 Saudi Al-Hilal
Riyad_Mahrez FW DZ 35 76 Saudi Al-Ahli
Édouard_Mendy GK SN 34 76 Saudi Al-Ahli
Yassine_Bounou GK MA 35 80 Saudi Al-Hilal
Mario_Hermoso DF ES 30 78 SerieA Roma
Evan_Ndicka DF CI 26 79 SerieA Roma
Alessandro_Buongiorno DF IT 27 80 SerieA Napoli
Giacomo_Raspadori FW IT 26 77 LaLiga Atlético_Madrid
Nicolò_Zaniolo MF IT 27 76 SerieA Atalanta
Ronaldo_Nazário FW BR 29 97 Icon Inter_Milan
Diego_Maradona MF AR 29 97 Icon Napoli
Pelé FW BR 29 97 Icon Santos
Ronaldinho MF BR 29 96 Icon Barcelona
Zinedine_Zidane MF FR 29 96 Icon Real_Madrid
Paolo_Maldini DF IT 29 96 Icon AC_Milan
Thierry_Henry FW FR 29 95 Icon Arsenal
Xavi MF ES 29 95 Icon Barcelona
Andrés_Iniesta MF ES 29 95 Icon Barcelona
Franz_Beckenbauer DF DE 29 95 Icon Bayern_Munich
Gianluigi_Buffon GK IT 29 95 Icon Juventus
Lev_Yashin GK RU 29 95 Icon Dynamo_Moscow
Cafu DF BR 29 94 Icon AC_Milan
Roberto_Carlos DF BR 29 94 Icon Real_Madrid
Fabio_Cannavaro DF IT 29 94 Icon Juventus
Iker_Casillas GK ES 29 94 Icon Real_Madrid
Gabriel_Batistuta FW AR 29 94 Icon Fiorentina
Eric_Cantona FW FR 29 94 Icon Manchester_United
Rabiot MF FR 31 86 Star AC_Milan
Mateo_Retegui FW IT 27 85 Star Al_Qadsiah
Sadio_Mané FW SN 34 84 Star Al_Nassr
Domenico_Berardi FW IT 31 82 Star Sassuolo
Edoardo_Rovella MF IT 24 82 Star Lazio
Alexander_Sörloth FW NO 30 83 Star Atlético_Madrid
Franck_Kessié MF CI 29 82 Star Al_Ahli
Marcelo_Brozović MF HR 33 81 Star Al_Nassr
Fabinho MF BR 32 81 Star Al_Ittihad
Breel_Embolo FW CH 28 80 Star Rennes
Niclas_Füllkrug FW DE 33 80 Star AC_Milan
Memphis_Depay FW NL 32 81 Star Corinthians
Gabigol FW BR 30 80 Star Cruzeiro
Ángel_Correa FW AR 31 80 Star Tigres
Roberto_Firmino FW BR 34 78 Star Al_Ahli
Hakim_Ziyech MF MA 33 78 Star Galatasaray
Lorenzo_Insigne FW IT 35 77 Star Toronto_FC
Hirving_Lozano FW MX 30 78 Star PSV
Mohamed_Salah FW EG 33 91 Star Trabzonspor
Rodri MF ES 30 91 Star Barcelona
Kim_Min-jae DF KR 29 85 Star Bayern_Munich
Azzedine_Ounahi MF MA 25 78 Star Girona
Ritsu_Doan MF JP 28 78 Star Eintracht_Frankfurt
Dominik_Livaković GK HR 31 79 Star Fenerbahçe
Sardar_Azmoun FW IR 31 77 Star Roma
Dušan_Tadić FW RS 37 74 Star Fenerbahçe
Alexis_Sánchez FW CL 37 73 Star Udinese`;
const EXTRA_FIRST_PERIOD = 10388; // the period in which the first of them arrives
const EXTRA_PER_PERIOD = 2;

const clubByPlayer = new Map<string, string>();

export const marketPlayers: (Player & { origin: Origin })[] = (raw.trim() + "\n" + generated() + "\n" + EXTRA.trim())
  .split("\n")
  .map((line, i) => {
    const [name, position, nationality, age, rating, origin, club] = line.trim().split(/\s+/);
    const shown = name.replace(/_/g, " ");
    const real = club ? club.replace(/_/g, " ") : OLD_CLUBS[shown];
    if (real) clubByPlayer.set(`mk-${i}`, real);
    return {
      id: `mk-${i}`,
      club: "market",
      number: null,
      name: shown,
      position: position as Position,
      nationality,
      age: Number(age),
      rating: Number(rating),
      origin: origin as Origin,
    };
  });

export function originOf(playerId: string): Origin | null {
  return marketPlayers.find((p) => p.id === playerId)?.origin ?? null;
}

/** The club he really plays for, when known ("Real Madrid"). */
export const realClubOf = (playerId: string) => clubByPlayer.get(playerId) ?? null;

/* ---------- the market moves: a fresh selection every two days ---------- */

/** Days between two refreshes. */
export const REFRESH_DAYS = 2;
const DAY = 86_400_000;
const CAIRO = 2 * 3_600_000;

/** The number of the current two-day period (days counted in Cairo time). */
export const periodOf = (now: number = Date.now()) => Math.floor(Math.floor((now + CAIRO) / DAY) / REFRESH_DAYS);
/** When the next selection arrives. */
export const nextRefresh = (now: number = Date.now()) => ((periodOf(now) + 1) * REFRESH_DAYS * DAY) - CAIRO;

const EXTRA_FROM = marketPlayers.length - EXTRA.trim().split("\n").length;
/** The period from which a player can be on the market (the new stars come a few at a time). */
const unlockOf = (id: string) => {
  const n = Number(id.slice(3));
  if (n < EXTRA_FROM) return 0;
  const k = n - EXTRA_FROM;
  return k < 20 ? EXTRA_FIRST_PERIOD + Math.floor(k / EXTRA_PER_PERIOD) : EXTRA_FIRST_PERIOD; // the second batch is all on sale right away
};

/** How likely a player is on the market in a given period: stars come and go the most, small names stay longer. */
function chance(p: Player & { origin: Origin }) {
  if (p.origin === "Free") return 0.6;
  if (p.origin === "Prospect") return 0.62;
  if (p.rating >= 86) return 0.5;
  if (p.rating >= 82) return 0.6;
  if (p.rating >= 77) return 0.65;
  return 0.7;
}
const tierOf = (p: Player & { origin: Origin }) => (p.origin === "Free" ? "free" : p.origin === "Prospect" ? "prospect" : p.rating >= 86 ? "a" : p.rating >= 82 ? "b" : p.rating >= 77 ? "c" : "d") + p.position;

const periodCache = new Map<string, Set<string>>();
/** Exactly the right share of every group (stars, solid pros, prospects, free agents, by position) is on sale, so every selection is balanced. */
function selection(period: number): Set<string> {
  const k = `world2|${period}`; // the same selection for every manager
  const hit = periodCache.get(k);
  if (hit) return hit;
  const groups = new Map<string, (Player & { origin: Origin })[]>();
  for (const p of marketPlayers) if (p.origin !== "Star" && p.origin !== "Icon" && unlockOf(p.id) <= period) (groups.get(tierOf(p)) ?? groups.set(tierOf(p), []).get(tierOf(p))!).push(p);
  const out = new Set<string>();
  for (const list of groups.values()) {
    const take = Math.max(1, Math.round(chance(list[0]) * list.length));
    list.sort((x, y) => hashOf(`${k}|${x.id}`) - hashOf(`${k}|${y.id}`)).slice(0, take).forEach((p) => out.add(p.id));
  }
  for (const p of marketPlayers) if (unlockOf(p.id) === period) out.add(p.id); // a new star always arrives on sale
  for (const p of marketPlayers) if ((p.origin === "Star" || p.origin === "Icon")) out.add(p.id); // the stars and icons are always for sale
  if (periodCache.size > 40) periodCache.clear();
  periodCache.set(k, out);
  return out;
}
const onSale = (p: Player & { origin: Origin }, period: number) => selection(period).has(p.id);

export type MarketEntry = { player: Player & { origin: Origin }; isNew: boolean; leaving: boolean };

/** Who can be signed right now, and who just arrived or leaves at the next refresh. */
export function visibleMarket(now: number = Date.now()): MarketEntry[] {
  const period = periodOf(now);
  return marketPlayers
    .filter((p) => onSale(p, period))
    .map((player) => ({ player, isNew: !onSale(player, period - 1), leaving: !onSale(player, period + 1) }));
}
