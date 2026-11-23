/**
 * The world market: every player outside the league you manage in (see hiddenOrigin).
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

import { nowMs } from "@/lib/serverTime";
export type Origin = "LaLiga" | "Bundesliga" | "SerieA" | "Ligue1" | "Saudi" | "Portugal" | "Netherlands" | "Turkey" | "Brazil" | "MLS" | "England" | "Egypt" | "Belgium" | "Scotland" | "Austria" | "Greece" | "Ukraine" | "Czech" | "Croatia" | "Argentina" | "Mexico" | "Japan" | "Korea" | "Icon" | "Star" | "Prospect" | "Free";

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
  England: "Premier League",
  Egypt: "Egyptian League",
  Belgium: "Pro League",
  Scotland: "Scottish Premiership",
  Austria: "Austrian Bundesliga",
  Greece: "Super League Greece",
  Ukraine: "Ukrainian League",
  Czech: "Czech First League",
  Croatia: "HNL",
  Argentina: "Liga Argentina",
  Mexico: "Liga MX",
  Japan: "J1 League",
  Korea: "K League",
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
Kvaratskhelia FW GE 25 89 Ligue1
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
Alexis_Sánchez FW CL 37 73 Star Udinese
Pau_Torres DF ES 29 81 LaLiga Villarreal
Jesús_Navas DF ES 40 72 LaLiga Sevilla
Isaac_Romero FW ES 25 76 LaLiga Sevilla
Lucien_Agoumé MF FR 24 75 LaLiga Sevilla
Dodi_Lukébakio FW BE 28 78 LaLiga Sevilla
Hugo_Duro FW ES 26 76 LaLiga Valencia
Javi_Guerra MF ES 23 76 LaLiga Valencia
Viktor_Tsygankov FW UA 28 79 LaLiga Girona
Abel_Ruiz FW ES 25 75 LaLiga Girona
Álex_Berenguer FW ES 31 77 LaLiga Athletic_Club
Iñaki_Williams FW GH 32 79 LaLiga Athletic_Club
Dani_Vivian DF ES 26 80 LaLiga Athletic_Club
Oihan_Sancet MF ES 26 82 LaLiga Athletic_Club
Mikel_Jauregizar MF ES 22 76 LaLiga Athletic_Club
Aitor_Paredes DF ES 26 77 LaLiga Athletic_Club
Sadiq_Umar FW NG 28 75 LaLiga Real_Sociedad
Ante_Budimir FW HR 34 77 LaLiga Osasuna
Aimar_Oroz MF ES 24 77 LaLiga Osasuna
Vedat_Muriqi FW XK 32 78 LaLiga Mallorca
Pablo_Maffeo DF ES 28 73 LaLiga Mallorca
Dani_Rodríguez MF ES 37 73 LaLiga Mallorca
Álvaro_García FW ES 33 75 LaLiga Rayo_Vallecano
Isi_Palazón MF ES 31 77 LaLiga Rayo_Vallecano
Pathé_Ciss MF SN 31 74 LaLiga Rayo_Vallecano
Borja_Mayoral FW ES 29 76 LaLiga Getafe
Luis_Milla MF ES 32 75 LaLiga Getafe
Djené_Dakonam DF TG 34 75 LaLiga Getafe
Carlos_Soler MF ES 29 77 LaLiga Espanyol
Javi_Puado FW ES 27 76 LaLiga Espanyol
Nick_Woltemade FW DE 24 82 Bundesliga Bayern_Munich
Jarell_Quansah DF ENG 23 79 Bundesliga Bayer_Leverkusen
Can_Uzun FW TR 20 77 Bundesliga Eintracht_Frankfurt
Robin_Koch DF DE 29 79 Bundesliga Eintracht_Frankfurt
Kevin_Trapp GK DE 36 77 Bundesliga Eintracht_Frankfurt
Vincenzo_Grifo FW IT 33 78 Bundesliga SC_Freiburg
Maximilian_Eggestein MF DE 29 77 Bundesliga SC_Freiburg
Lucas_Höler FW DE 31 74 Bundesliga SC_Freiburg
Matthias_Ginter DF DE 32 76 Bundesliga SC_Freiburg
Jonas_Hofmann MF DE 33 77 Bundesliga Bayer_Leverkusen
Jonathan_Burkardt FW DE 25 80 Bundesliga Eintracht_Frankfurt
Jonas_Omlin GK CH 32 76 Bundesliga Borussia_Mönchengladbach
Franck_Honorat MF FR 29 76 Bundesliga Borussia_Mönchengladbach
Tim_Kleindienst FW DE 30 78 Bundesliga Borussia_Mönchengladbach
Julian_Weigl MF DE 30 76 Bundesliga Borussia_Mönchengladbach
Jae-sung_Lee MF KR 33 76 Bundesliga Mainz_05
Nadiem_Amiri MF DE 29 77 Bundesliga Mainz_05
Mitchel_Bakker DF NL 26 75 Bundesliga Bayer_Leverkusen
Jérôme_Roussillon DF FR 33 73 Bundesliga Union_Berlin
Rani_Khedira MF DE 31 76 Bundesliga Union_Berlin
Josip_Juranović DF HR 30 75 Bundesliga Union_Berlin
Marvin_Ducksch FW DE 32 77 Bundesliga Werder_Bremen
Romano_Schmid MF AT 25 77 Bundesliga Werder_Bremen
Jens_Stage MF DK 29 76 Bundesliga Werder_Bremen
Kevin_Mbabu DF CH 31 75 Bundesliga VfL_Wolfsburg
Jonas_Wind FW DK 27 77 Bundesliga VfL_Wolfsburg
Yannick_Gerhardt MF DE 31 74 Bundesliga VfL_Wolfsburg
Mario_Pašalić MF HR 31 80 SerieA Atalanta
Charles_De_Ketelaere FW BE 25 82 SerieA Atalanta
Marten_de_Roon MF NL 35 77 SerieA Atalanta
Berat_Djimsiti DF AL 33 78 SerieA Atalanta
Marco_Carnesecchi GK IT 25 80 SerieA Atalanta
Isak_Hien DF SE 27 79 SerieA Atalanta
Matías_Vecino MF UY 34 74 SerieA Lazio
Boulaye_Dia FW SN 29 77 SerieA Lazio
Ivan_Provedel GK IT 32 80 SerieA Lazio
Alessio_Romagnoli DF IT 31 77 SerieA Lazio
Albert_Guðmundsson FW IS 28 79 SerieA Fiorentina
Robin_Gosens DF DE 31 76 SerieA Fiorentina
Danilo_Cataldi MF IT 31 74 SerieA Fiorentina
David_de_Gea GK ES 35 79 SerieA Fiorentina
Riccardo_Orsolini FW IT 29 79 SerieA Bologna
Lewis_Ferguson MF SCO 26 79 SerieA Bologna
Santiago_Castro FW AR 21 77 SerieA Bologna
Jhon_Lucumí DF CO 27 79 SerieA Bologna
Lukasz_Skorupski GK PL 34 76 SerieA Bologna
Antonio_Sanabria FW PY 30 74 SerieA Torino
Che_Adams FW SCO 29 76 SerieA Torino
Adrien_Tameze MF FR 32 73 SerieA Torino
Andrea_Belotti FW IT 32 74 SerieA Como
Matteo_Politano FW IT 32 77 SerieA Napoli
Andrea_Pinamonti FW IT 27 75 SerieA Sassuolo
Armand_Laurienté FW FR 27 75 SerieA Sassuolo
Nemanja_Matić MF RS 38 72 SerieA Sassuolo
Gianluca_Gaetano MF IT 25 76 SerieA Cagliari
Sebastiano_Esposito FW IT 24 75 SerieA Cagliari
Michel_Adopo MF FR 25 74 SerieA Cagliari
Nahuel_Estévez MF AR 24 74 SerieA Genoa
Mattia_Bani DF IT 32 73 SerieA Genoa
Mikael_Ellertsson MF IS 26 72 SerieA Genoa
Jesper_Karlström MF SE 30 76 SerieA Udinese
Thomas_Kristensen DF DK 24 74 SerieA Udinese
Mandela_Keita MF BE 24 75 SerieA Parma
Evann_Guessand FW CI 24 78 Ligue1 Nice
Jérémie_Boga FW CI 29 77 Ligue1 Nice
Jonathan_Clauss DF FR 33 77 Ligue1 Nice
Hicham_Boudaoui MF DZ 26 76 Ligue1 Nice
Mahmoud_Dahoud MF DE 30 75 Ligue1 Nice
Amine_Gouiri FW DZ 26 82 Ligue1 Marseille
Mamadou_Sarr DF FR 20 75 Ligue1 Strasbourg
Diego_Moreira FW BR 21 75 Ligue1 Strasbourg
Moïse_Bombito DF CA 26 77 Ligue1 Nantes
Matthis_Abline FW FR 23 76 Ligue1 Nantes
Salem_Al-Dawsari FW SA 34 79 Saudi Al_Hilal
Joao_Cancelo DF PT 32 81 Saudi Al_Hilal
Ayman_Yahya FW SA 25 74 Saudi Al_Nassr
Mohamed_Simakan DF FR 25 78 Saudi Al_Nassr
Otávio MF PT 31 78 Saudi Al_Nassr
Houssem_Aouar MF DZ 28 77 Saudi Al_Ittihad
Steven_Bergwijn FW NL 28 79 Saudi Al_Ittihad
Danilo_Pereira MF PT 34 75 Saudi Al_Ittihad
Moussa_Diaby FW FR 26 79 Saudi Al_Ittihad
Roger_Ibañez DF BR 27 79 Saudi Al_Ahli
Merih_Demiral DF TR 28 79 Saudi Al_Ahli
Allan_Saint-Maximin FW FR 29 77 Saudi Al_Ahli
Julián_Quiñones FW MX 28 76 Saudi Al_Qadsiah
Nahitan_Nández MF UY 30 75 Saudi Al_Qadsiah
Musa_Barrow FW GM 27 75 Saudi Al_Ettifaq
Georginio_Wijnaldum MF NL 35 76 Saudi Al_Ettifaq
Yannick_Carrasco MF BE 33 77 Saudi Al_Shabab
Samuel_Omorodion FW ES 21 79 Portugal Porto
Matteo_Dams DF NL 23 76 Netherlands PSV
Bart_Nieuwkoop DF NL 30 74 Netherlands Feyenoord
Steven_Berghuis MF NL 34 76 Netherlands Ajax
Kenneth_Taylor MF NL 24 77 Netherlands Ajax
Michel_Vlap MF NL 29 73 Netherlands FC_Twente
Sam_Lammers FW NL 29 75 Netherlands FC_Twente
Edin_Džeko FW BA 40 74 Turkey Fenerbahçe
Paul_Onuachu FW NG 31 77 Turkey Trabzonspor
Trézéguet FW EG 31 77 Turkey Trabzonspor
Enis_Bardhi MF MK 30 75 Turkey İstanbul_Başakşehir
Tristan_Degreef MF BE 24 75 Belgium Anderlecht
Konstantinos_Karetsas MF GR 18 77 Belgium Genk
Yaimar_Medina DF CO 22 75 Belgium Genk
Reo_Hatate MF JP 28 79 Scotland Celtic
James_Tavernier DF ENG 34 76 Scotland Rangers
Nedim_Bajrami MF AL 27 76 Scotland Rangers
Rasmus_Kristensen DF DK 28 75 Scotland Rangers
Neto_Borges DF BR 28 74 Scotland Rangers
Dejan_Joveljić FW RS 26 75 Scotland Hearts
Bobby_Clark MF ENG 20 74 Austria RB_Salzburg
Matthäus_Taferner MF AT 22 74 Austria SK_Sturm_Graz
Philip_Zinckernagel FW DK 31 75 Greece Olympiacos
Eli_Dasa DF IL 33 72 Greece PAOK
Andrija_Živković FW RS 29 76 Greece PAOK
Brandon_Thomas-Asante FW GH 27 74 Greece PAOK
Kevin_Kelsy FW BR 21 75 Ukraine Shakhtar_Donetsk
Vladyslav_Vanat FW UA 24 77 Ukraine Dynamo_Kyiv
Marko_Livaja FW HR 32 77 Croatia Hajduk_Split
Facundo_Colidio FW AR 26 77 Argentina River_Plate
Franco_Armani GK AR 39 76 Argentina River_Plate
Miguel_Merentiel FW UY 29 77 Argentina Boca_Juniors
Cristian_Medina MF AR 23 76 Argentina Boca_Juniors
Maximiliano_Salas FW AR 28 76 Argentina Racing_Club
Giuliano_Galoppo MF AR 26 75 Argentina Independiente
Luiz_Araújo FW BR 29 77 Brazil Flamengo
Léo_Ortiz DF BR 29 78 Brazil Flamengo
Agustín_Giay DF AR 25 76 Brazil Palmeiras
Estêvão_Willian FW BR 19 82 Brazil Palmeiras
Gustavo_Scarpa MF BR 31 76 Brazil Atlético_Mineiro
Hulk FW BR 40 74 Brazil Atlético_Mineiro
Gabriel_Menino DF BR 25 76 Brazil Atlético_Mineiro
Yuri_Alberto FW BR 25 79 Brazil Corinthians
Rodrigo_Garro MF AR 27 76 Brazil Corinthians
Cássio GK BR 39 74 Brazil Corinthians
Luciano_Juba DF BR 26 75 Brazil Bahia
Pedro_Raul FW BR 28 75 Brazil Botafogo
Savarino MF VE 29 77 Brazil Botafogo
Matheus_Pereira MF BR 29 77 Brazil Cruzeiro
Kaio_Jorge FW BR 24 76 Brazil Cruzeiro
Sergio_Busquets MF ES 38 77 MLS Inter_Miami
Jordi_Alba DF ES 37 74 MLS Inter_Miami
Tadeo_Allende FW AR 27 77 MLS Inter_Miami
Hugo_Lloris GK FR 39 72 MLS LAFC
Federico_Bernardeschi MF IT 32 76 MLS Toronto_FC
Riqui_Puig MF ES 26 77 MLS LA_Galaxy
Joseph_Paintsil FW GH 28 76 MLS LA_Galaxy
Gabriel_Pec FW BR 25 77 MLS LA_Galaxy
Wilfried_Zaha FW CI 33 75 MLS Charlotte_FC
Cristian_Arango FW CO 30 75 MLS Seattle_Sounders
Albert_Rusnák MF SK 31 76 MLS Seattle_Sounders
Evander MF BR 28 78 MLS FC_Cincinnati
Luciano_Acosta MF AR 31 76 MLS FC_Cincinnati
Henry_Martín FW MX 33 76 Mexico Club_América
Álvaro_Fidalgo MF ES 28 77 Mexico Club_América
André-Pierre_Gignac FW FR 40 75 Mexico Tigres_UANL
Fernando_Gorriarán MF UY 30 75 Mexico Tigres_UANL
Sebastián_Cáceres DF UY 26 77 Mexico Club_América
Yuya_Osako FW JP 35 73 Japan Vissel_Kobe
Takuma_Asano FW JP 31 74 Japan Vissel_Kobe
Hwang_Hee-chan FW KR 30 78 Korea Ulsan_HD
Raya GK ES 31 88 England Arsenal
Kepa GK ES 32 78 England Arsenal
Meslier GK FR 26 74 England Arsenal
Saliba DF FR 25 88 England Arsenal
Mosquera DF ES 22 78 England Arsenal
White DF ENG 29 82 England Arsenal
Hincapié DF EC 24 80 England Arsenal
Gabriel DF BR 28 89 England Arsenal
Timber DF NL 25 84 England Arsenal
Konsa DF ENG 29 84 England Arsenal
Calafiori DF IT 24 84 England Arsenal
Lewis-Skelly DF ENG 20 78 England Arsenal
Ødegaard MF NO 27 86 England Arsenal
Eze MF ENG 28 84 England Arsenal
Madueke MF ENG 24 80 England Arsenal
Merino MF ES 30 81 England Arsenal
Zubimendi MF ES 27 84 England Arsenal
Guimarães MF BR 28 86 England Arsenal
Rice MF ENG 27 88 England Arsenal
Saka FW ENG 25 87 England Arsenal
Gyökeres FW SE 28 86 England Arsenal
Tzolis FW GR 24 74 England Arsenal
Havertz FW DE 27 82 England Arsenal
Suzuki GK JP 24 78 England Aston_Villa
Bizot GK NL 35 74 England Aston_Villa
Cash DF PL 29 80 England Aston_Villa
Lindelöf DF SE 32 78 England Aston_Villa
Harwood-Bellis DF ENG 24 76 England Aston_Villa
Mings DF ENG 33 74 England Aston_Villa
Ruggeri DF IT 24 76 England Aston_Villa
Pau_Francisco DF ES 29 80 England Aston_Villa
Maatsen DF NL 24 77 England Aston_Villa
Bogarde DF NL 22 72 England Aston_Villa
Wan-Bissaka DF ENG 28 78 England Aston_Villa
Barkley MF ENG 32 74 England Aston_Villa
McGinn MF SCO 32 79 England Aston_Villa
Kamara MF FR 26 81 England Aston_Villa
Buendía MF AR 29 79 England Aston_Villa
Onana MF BE 25 80 England Aston_Villa
Goretzka MF DE 31 82 England Aston_Villa
Gomes MF BR 25 73 England Aston_Villa
Manzambi MF CH 21 72 England Aston_Villa
Jackson FW SN 25 79 England Aston_Villa
Garnacho FW AR 22 79 England Aston_Villa
Abraham FW ENG 29 74 England Aston_Villa
Edward FW BR 20 70 England Aston_Villa
Petrović GK RS 27 77 England Bournemouth
Di_Gregorio GK IT 29 75 England Bournemouth
Aarons DF ENG 26 72 England Bournemouth
Truffert DF FR 24 75 England Bournemouth
Hill DF ENG 24 75 England Bournemouth
Silva DF PT 23 72 England Bournemouth
Diakité DF FR 25 74 England Bournemouth
Sánchez DF ES 23 70 England Bournemouth
Cook MF ENG 29 74 England Bournemouth
Brooks MF WAL 29 76 England Bournemouth
Scott MF ENG 23 77 England Bournemouth
R._Christie MF SCO 31 74 England Bournemouth
Adams MF US 27 76 England Bournemouth
Tavernier MF ENG 27 76 England Bournemouth
Kluivert MF NL 27 78 England Bournemouth
Tóth MF HU 21 70 England Bournemouth
Rayan MF BR 20 76 England Bournemouth
Evanilson FW BR 27 77 England Bournemouth
Doak FW SCO 20 72 England Bournemouth
Adli FW MA 26 76 England Bournemouth
Kroupi FW FR 20 77 England Bournemouth
Kelleher GK IE 27 77 England Brentford
Hickey DF SCO 24 73 England Brentford
Henry DF ENG 29 74 England Brentford
van_den_Berg DF NL 24 76 England Brentford
Ajer DF NO 28 77 England Brentford
Collins DF IE 25 74 England Brentford
Lewis-Potter DF ENG 25 74 England Brentford
Kayode DF IT 22 72 England Brentford
Yarmolyuk MF UA 22 74 England Brentford
Jensen MF DK 30 76 England Brentford
Dasilva MF ENG 28 74 England Brentford
Carvalho MF PT 24 77 England Brentford
Sangaré MF ML 24 72 England Brentford
Damsgaard MF DK 26 77 England Brentford
Janelt MF DE 28 74 England Brentford
Schade FW DE 24 77 England Brentford
Thiago FW BR 25 76 England Brentford
Ouattara FW BF 24 75 England Brentford
Wilson FW ENG 34 72 England Brentford
Anthony FW ENG 26 71 England Brentford
Verbruggen GK NL 24 77 England Brighton
Hadjam DF DZ 23 72 England Brighton
Struijk DF NL 27 75 England Brighton
Dunk DF ENG 34 76 England Brighton
Costinha DF PT 26 72 England Brighton
Boscagli DF FR 28 74 England Brighton
Kadıoğlu DF TR 27 80 England Brighton
Svoboda DF AT 28 72 England Brighton
Vušković DF HR 19 76 England Brighton
Hinshelwood MF ENG 21 76 England Brighton
Groß MF DE 35 76 England Brighton
Gómez MF PY 23 76 England Brighton
Ayari MF SE 23 74 England Brighton
Wieffer MF NL 26 74 England Brighton
De_Cuyper MF BE 25 75 England Brighton
O'Riley MF DK 25 77 England Brighton
Tzimas FW GR 20 71 England Brighton
Rutter FW FR 24 78 England Brighton
Minteh FW GM 22 75 England Brighton
David FW CA 25 80 England Brighton
Kostoulas FW GR 19 74 England Brighton
Mitoma FW JP 29 77 England Brighton
Ferguson FW IE 22 72 England Brighton
Martínez GK AR 34 81 England Chelsea
Palestra DF IT 21 74 England Chelsea
Fofana DF FR 25 78 England Chelsea
Lacroix DF FR 26 78 England Chelsea
Colwill DF ENG 23 79 England Chelsea
Hato DF NL 20 75 England Chelsea
James DF ENG 26 80 England Chelsea
Gusto DF FR 23 78 England Chelsea
Chavarría DF ES 28 70 England Chelsea
Barco MF AR 22 72 England Chelsea
Palmer MF ENG 24 86 England Chelsea
Henderson MF ENG 36 74 England Chelsea
Rogers MF ENG 24 76 England Chelsea
Quenda MF GW 19 76 England Chelsea
Caicedo MF EC 25 83 England Chelsea
Estêvão MF BR 19 82 England Chelsea
Lavia MF BE 22 78 England Chelsea
Neto FW PT 26 80 England Chelsea
Bynoe-Gittens FW ENG 22 76 England Chelsea
Welbeck FW ENG 35 71 England Chelsea
Emegha FW NL 23 75 England Chelsea
Wilson GK ENG 34 70 England Coventry_City
Rushworth GK ENG 25 70 England Coventry_City
Pinnock DF JM 33 70 England Coventry_City
Dasilva DF ENG 28 70 England Coventry_City
Thomas DF ENG 25 71 England Coventry_City
Latibeaudiere DF JM 26 70 England Coventry_City
Rudoni MF ENG 25 72 England Coventry_City
Grimes MF ENG 31 71 England Coventry_City
Sakamoto MF JP 30 72 England Coventry_City
Mason-Clark MF ENG 27 70 England Coventry_City
Onyeka MF NG 28 73 England Coventry_City
Eccles MF ENG 26 71 England Coventry_City
Torp MF DK 27 71 England Coventry_City
Gboho MF FR 25 70 England Coventry_City
Hamer MF NL 29 70 England Coventry_City
Simms FW ENG 25 70 England Coventry_City
Wright FW US 28 72 England Coventry_City
Awoniyi FW NG 29 74 England Coventry_City
Tchaouna FW FR 23 72 England Coventry_City
Thomas-Asante FW ENG 27 70 England Coventry_City
Henderson GK ENG 29 78 England Crystal_Palace
Riad DF MA 23 72 England Crystal_Palace
Disasi DF FR 28 76 England Crystal_Palace
Tomiyasu DF JP 28 74 England Crystal_Palace
Richards DF US 26 76 England Crystal_Palace
Chilwell DF ENG 29 74 England Crystal_Palace
Mitchell MF ENG 27 76 England Crystal_Palace
Lerma MF CO 32 77 England Crystal_Palace
Pino MF ES 24 76 England Crystal_Palace
McNeil MF ENG 26 75 England Crystal_Palace
Kamada MF JP 30 77 England Crystal_Palace
Hughes MF ENG 31 76 England Crystal_Palace
Wharton MF ENG 22 80 England Crystal_Palace
Timber MF NL 25 72 England Crystal_Palace
Darío_Osorio MF CL 22 74 England Crystal_Palace
Doucouré MF ML 26 75 England Crystal_Palace
Mingueza MF ES 27 72 England Crystal_Palace
Sarr FW SN 28 79 England Crystal_Palace
Nketiah FW ENG 27 74 England Crystal_Palace
Mateta FW FR 29 79 England Crystal_Palace
Larsen FW NO 26 75 England Crystal_Palace
Guessand FW FR 25 72 England Crystal_Palace
Pickford GK ENG 32 80 England Everton
Travers GK IE 27 70 England Everton
Branthwaite DF ENG 24 81 England Everton
Keane DF ENG 33 75 England Everton
Tarkowski DF ENG 33 77 England Everton
O'Brien DF IE 25 72 England Everton
Mykolenko DF UA 27 74 England Everton
Maitland-Niles MF ENG 29 70 England Everton
Dewsbury-Hall MF ENG 28 76 England Everton
Grealish MF ENG 31 80 England Everton
T._George MF ENG 20 71 England Everton
Nørgaard MF DK 32 75 England Everton
Alcaraz MF AR 23 74 England Everton
Hackney MF SCO 24 70 England Everton
Garner MF ENG 25 74 England Everton
Barry FW FR 24 76 England Everton
Dibling FW ENG 20 70 England Everton
Johnson FW WAL 25 77 England Everton
Leno GK DE 34 78 England Fulham
Lecomte GK FR 35 70 England Fulham
Tete DF NL 31 74 England Fulham
Bassey DF NG 26 75 England Fulham
Cuenca DF ES 26 70 England Fulham
Andersen DF DK 30 79 England Fulham
Castagne DF BE 30 73 England Fulham
Affengruber DF AT 25 70 England Fulham
Robinson DF US 29 77 England Fulham
Reed MF ENG 31 73 England Fulham
Palacios MF ES 21 72 England Fulham
Cairney MF SCO 35 70 England Fulham
Bobb MF NO 23 73 England Fulham
Larsson MF SE 22 70 England Fulham
Berge MF NO 28 77 England Fulham
Iwobi MF NG 30 76 England Fulham
Sessegnon MF ENG 26 72 England Fulham
Rowe MF ENG 26 72 England Fulham
García FW ES 22 72 England Fulham
Muniz FW BR 25 74 England Fulham
Kevin FW BR 23 72 England Fulham
Butland GK ENG 33 70 England Hull_City
Norton-Cuffy DF ENG 22 70 England Hull_City
Targett DF ENG 31 70 England Hull_City
Morita MF JP 31 72 England Hull_City
Matazo MF BE 24 70 England Hull_City
Gyabi MF ENG 22 70 England Hull_City
Crooks MF ENG 32 70 England Hull_City
Ömür MF TR 27 70 England Hull_City
Iroegbunam MF ENG 23 70 England Hull_City
Palmer GK ENG 30 70 England Ipswich_Town
Scherpen GK NL 26 70 England Ipswich_Town
Kipré DF CI 29 70 England Ipswich_Town
Diop DF FR 29 72 England Ipswich_Town
Greaves DF ENG 26 70 England Ipswich_Town
O'Shea DF IE 27 70 England Ipswich_Town
Matusiwa MF NL 28 71 England Ipswich_Town
Fatawu MF GH 22 74 England Ipswich_Town
Enciso MF PY 22 72 England Ipswich_Town
Philogene MF ENG 24 74 England Ipswich_Town
Florentino MF PT 27 72 England Ipswich_Town
Taylor MF IE 28 70 England Ipswich_Town
Lukić MF RS 30 73 England Ipswich_Town
Palacios MF AR 28 70 England Ipswich_Town
Núñez MF CL 26 70 England Ipswich_Town
Flemming FW NL 28 70 England Ipswich_Town
Emersonn FW BR 22 70 England Ipswich_Town
McAteer FW ENG 24 70 England Ipswich_Town
Akpom FW ENG 31 70 England Ipswich_Town
Maeda FW JP 29 73 England Ipswich_Town
Trafford GK ENG 24 76 England Leeds_United
Zetterer GK DE 31 72 England Leeds_United
Muharemović DF BA 23 70 England Leeds_United
Rodon DF WAL 29 76 England Leeds_United
Bijol DF SI 27 75 England Leeds_United
Justin DF ENG 28 73 England Leeds_United
Bard DF FR 26 72 England Leeds_United
Elvedi DF CH 30 73 England Leeds_United
Bogle MF ENG 26 72 England Leeds_United
Gudmundsson MF SE 27 74 England Leeds_United
Ampadu MF WAL 26 77 England Leeds_United
D._James MF WAL 28 76 England Leeds_United
Longstaff MF ENG 29 74 England Leeds_United
Wilson MF WAL 29 73 England Leeds_United
Aaronson MF US 26 77 England Leeds_United
Stach MF DE 27 74 England Leeds_United
Tanaka MF JP 28 75 England Leeds_United
Gruev MF BG 26 73 England Leeds_United
Calvert-Lewin FW ENG 29 77 England Leeds_United
Nmecha FW DE 27 74 England Leeds_United
Okafor FW CH 26 74 England Leeds_United
Becker GK BR 34 87 England Liverpool
Mamardashvili GK GE 26 79 England Liverpool
Gomez DF ENG 29 78 England Liverpool
van_Dijk DF NL 35 87 England Liverpool
Jacquet DF FR 21 76 England Liverpool
Kerkez DF HU 23 77 England Liverpool
C._Bradley DF NIR 23 76 England Liverpool
Tsimikas DF GR 30 75 England Liverpool
Endo MF JP 33 72 England Liverpool
Wirtz MF DE 23 86 England Liverpool
Szoboszlai MF HU 26 85 England Liverpool
Mac_Allister MF AR 27 86 England Liverpool
Muñoz MF ES 23 70 England Liverpool
Frimpong MF NL 25 82 England Liverpool
Gravenberch MF NL 24 85 England Liverpool
Nyoni MF ENG 19 70 England Liverpool
McConnell MF ENG 22 72 England Liverpool
Ngumoha MF ENG 18 70 England Liverpool
Isak FW SE 27 87 England Liverpool
Chiesa FW IT 29 76 England Liverpool
Gakpo FW NL 27 83 England Liverpool
Ekitike FW FR 24 83 England Liverpool
Barcola FW FR 24 82 England Liverpool
Donnarumma GK IT 27 89 England Manchester_City
Rulli GK AR 34 76 England Manchester_City
Dias DF PT 29 85 England Manchester_City
Guéhi DF ENG 26 82 England Manchester_City
Aït-Nouri DF DZ 25 80 England Manchester_City
Nunes DF BR 20 70 England Manchester_City
Gvardiol DF HR 24 85 England Manchester_City
M._Nunes DF PT 28 78 England Manchester_City
O'Reilly DF ENG 21 76 England Manchester_City
Khusanov DF UZ 22 76 England Manchester_City
Lewis DF ENG 21 72 England Manchester_City
Anderson MF SCO 24 80 England Manchester_City
Ndiaye MF SN 26 80 England Manchester_City
Kovačić MF HR 32 82 England Manchester_City
Cherki MF FR 23 82 England Manchester_City
Fernández MF AR 25 79 England Manchester_City
Bouaddi MF FR 19 74 England Manchester_City
Foden MF ENG 26 85 England Manchester_City
Haaland FW NO 26 91 England Manchester_City
Doku FW BE 24 83 England Manchester_City
Allan FW BR 22 70 England Manchester_City
Semenyo FW GH 26 83 England Manchester_City
Lammens GK BE 24 78 England Manchester_United
Dalot DF PT 27 78 England Manchester_United
Mazraoui DF MA 28 78 England Manchester_United
de_Ligt DF NL 27 80 England Manchester_United
Maguire DF ENG 33 79 England Manchester_United
Martínez DF AR 28 80 England Manchester_United
Dorgu DF DK 22 74 England Manchester_United
Yoro DF FR 20 78 England Manchester_United
Shaw DF ENG 31 76 England Manchester_United
Heaven DF ENG 20 74 England Manchester_United
Mount MF ENG 27 76 England Manchester_United
Fernandes MF PT 32 87 England Manchester_United
Cunha MF BR 27 83 England Manchester_United
Diallo MF CI 24 79 England Manchester_United
Santos MF BR 22 74 England Manchester_United
Tielemans MF BE 29 85 England Manchester_United
Baleba MF CM 22 79 England Manchester_United
Ugarte MF UY 25 79 England Manchester_United
Mainoo MF ENG 21 80 England Manchester_United
Rashford FW ENG 29 82 England Manchester_United
Zirkzee FW NL 25 75 England Manchester_United
Mbeumo FW CM 27 84 England Manchester_United
Šeško FW SI 23 80 England Manchester_United
Pope GK ENG 34 81 England Newcastle_United
Horníček GK CZ 24 72 England Newcastle_United
Livramento DF ENG 23 78 England Newcastle_United
Hall DF ENG 22 77 England Newcastle_United
Botman DF NL 26 82 England Newcastle_United
Schär DF CH 34 77 England Newcastle_United
Thiaw DF DE 25 78 England Newcastle_United
Burn DF ENG 34 76 England Newcastle_United
Dedić DF BA 24 72 England Newcastle_United
González MF ES 24 78 England Newcastle_United
Joelinton MF BR 30 80 England Newcastle_United
Bamba MF FR 20 70 England Newcastle_United
Barnes MF ENG 28 80 England Newcastle_United
Touré MF CI 20 72 England Newcastle_United
Elanga MF SE 24 77 England Newcastle_United
Murphy MF ENG 31 74 England Newcastle_United
Willock MF ENG 27 76 England Newcastle_United
Ramsey MF ENG 25 74 England Newcastle_United
Wissa FW CD 30 77 England Newcastle_United
Osula FW DK 23 76 England Newcastle_United
Fernandez-Pardo FW BE 21 70 England Newcastle_United
Sels GK BE 34 77 England Nottingham_Forest
Diomande DF CI 22 76 England Nottingham_Forest
Murillo DF BR 24 80 England Nottingham_Forest
Jair DF BR 21 72 England Nottingham_Forest
Netz DF DE 23 72 England Nottingham_Forest
Muñoz DF CO 30 76 England Nottingham_Forest
Milenković DF RS 29 77 England Nottingham_Forest
Savona DF IT 23 72 England Nottingham_Forest
Williams MF WAL 25 72 England Nottingham_Forest
Sangaré MF CI 28 78 England Nottingham_Forest
Domínguez MF AR 28 76 England Nottingham_Forest
Gibbs-White MF ENG 26 82 England Nottingham_Forest
Ndoye MF CH 26 77 England Nottingham_Forest
Schlager MF AT 29 75 England Nottingham_Forest
Yates MF ENG 28 74 England Nottingham_Forest
McAtee MF ENG 24 74 England Nottingham_Forest
Aina MF NG 30 72 England Nottingham_Forest
Hudson-Odoi FW ENG 25 76 England Nottingham_Forest
Wood FW NZ 34 76 England Nottingham_Forest
Jesus FW BR 25 77 England Nottingham_Forest
Kalimuendo FW FR 24 74 England Nottingham_Forest
Delap FW ENG 23 77 England Nottingham_Forest
Roefs GK NL 23 77 England Sunderland
Danso DF AT 28 76 England Sunderland
Ballard DF NIR 27 74 England Sunderland
Methalie DF FR 20 70 England Sunderland
Meunier DF BE 35 72 England Sunderland
Alderete DF PY 29 72 England Sunderland
Reinildo DF MZ 32 72 England Sunderland
Mukiele DF FR 29 74 England Sunderland
Angulo MF EC 23 70 England Sunderland
Rigg MF ENG 19 74 England Sunderland
Diarra MF FR 22 73 England Sunderland
Sadiki MF BE 21 74 England Sunderland
Le_Fée MF FR 26 76 England Sunderland
Xhaka MF CH 34 80 England Sunderland
Talbi FW MA 21 74 England Sunderland
Brobbey FW NL 24 78 England Sunderland
Isidor FW FR 26 72 England Sunderland
T._Tuterov FW UA 21 70 England Sunderland
Kinský GK CZ 23 76 England Tottenham
Dúbravka GK SK 37 72 England Tottenham
Robertson DF SCO 32 77 England Tottenham
Adarabioyo DF ENG 29 75 England Tottenham
Senesi DF AR 29 76 England Tottenham
van_Hecke DF NL 26 78 England Tottenham
Udogie DF IT 23 77 England Tottenham
Gray DF ENG 20 70 England Tottenham
Porro DF ES 27 80 England Tottenham
van_de_Ven DF NL 25 81 England Tottenham
Simons MF NL 23 82 England Tottenham
Gallagher MF ENG 26 78 England Tottenham
Maddison MF ENG 29 80 England Tottenham
Tel MF FR 21 76 England Tottenham
Bergvall MF SE 20 74 England Tottenham
Tonali MF IT 26 83 England Tottenham
Fernandes MF PT 22 76 England Tottenham
Kudus MF GH 26 80 England Tottenham
Kulusevski MF SE 26 78 England Tottenham
Marmoush MF EG 27 82 England Tottenham
Bentancur MF UY 29 77 England Tottenham
Richarlison FW BR 29 77 England Tottenham
Sávio FW BR 22 75 England Tottenham
Solanke FW ENG 29 77 England Tottenham
Mudryk FW UA 25 72 England Tottenham
Odobert FW FR 21 72 England Tottenham
Shenawy GK EG 37 76 Egypt Al_Ahly
Shobeir GK EG 27 68 Egypt Al_Ahly
Yassin_Marei DF EG 23 70 Egypt Al_Ahly
Achraf_Dari DF MA 27 75 Egypt Al_Ahly
Ahmed_Eid DF EG 25 66 Egypt Al_Ahly
Hady_Reyad DF EG 24 66 Egypt Al_Ahly
Yasser_Ibrahim DF EG 32 72 Egypt Al_Ahly
Youssef_Belammari DF MA 28 71 Egypt Al_Ahly
Mohamed_Hany DF EG 30 72 Egypt Al_Ahly
Ahmed_Reda MF EG 23 67 Egypt Al_Ahly
Akram_Tawfik MF EG 29 72 Egypt Al_Ahly
Marwan_Attia MF EG 27 73 Egypt Al_Ahly
Omar_El_Saaiy MF EG 29 68 Egypt Al_Ahly
Imam_Ashour MF EG 28 76 Egypt Al_Ahly
Ahmed_Nabil_Koka MF EG 31 72 Egypt Al_Ahly
Taher_Mohamed FW EG 29 72 Egypt Al_Ahly
Soufiane_Benjdida FW MA 24 70 Egypt Al_Ahly
Monsef_Bakrar FW DZ 27 73 Egypt Al_Ahly
Hussein_El_Shahat FW EG 34 75 Egypt Al_Ahly
Achraf_Bencharki FW MA 32 76 Egypt Al_Ahly
Omar_Moawad FW EG 25 68 Egypt Al_Ahly
Afsha FW EG 29 70 Egypt Al_Ahly
Zizo FW EG 30 74 Egypt Al_Ahly
Reda_Slim FW MA 27 66 Egypt Al_Ahly
Ahmed_El_Shenawy GK EG 35 76 Egypt Pyramids
Mahmoud_Marei DF EG 26 66 Egypt Pyramids
Ahmed_Samy DF EG 28 72 Egypt Pyramids
Ali_Gabr DF EG 37 73 Egypt Pyramids
Osama_Galal DF EG 25 72 Egypt Pyramids
Mohamed_Chibi DF MA 27 68 Egypt Pyramids
Mohamed_Hamdy DF EG 26 66 Egypt Pyramids
Karim_Hafez DF EG 30 70 Egypt Pyramids
Youssef_Obama MF EG 28 74 Egypt Pyramids
Mohanad_Lasheen MF EG 30 74 Egypt Pyramids
Zalaka MF EG 29 70 Egypt Pyramids
Walid_El_Karti MF MA 30 74 Egypt Pyramids
Ahmed_Atef MF EG 24 66 Egypt Pyramids
Nasser_Maher MF EG 29 66 Egypt Pyramids
Ewerton MF BR 27 72 Egypt Pyramids
Hamed_Hamdan MF PS 25 68 Egypt Pyramids
Fiston_Mayele FW CD 32 80 Egypt Pyramids
Ramadan_Sobhi FW EG 29 79 Egypt Pyramids
Mostafa_Fathi FW EG 33 76 Egypt Pyramids
Marwan_Hamdy FW EG 28 70 Egypt Pyramids
Odeh_Al_Fakhouri FW JO 26 68 Egypt Pyramids
Mostafa_Ziko FW EG 25 68 Egypt Pyramids
Pascal_Phiri FW ZM 22 66 Egypt Pyramids
Mohamed_Sobhy GK EG 27 72 Egypt Zamalek
El_Mahdy_Soliman GK EG 27 68 Egypt Zamalek
Ahmed_Hossam DF EG 27 68 Egypt Zamalek
Mahmoud_Bentayg DF MA 29 71 Egypt Zamalek
Omar_Gaber DF EG 34 72 Egypt Zamalek
Ahmed_Abou_El_Fotouh DF EG 27 68 Egypt Zamalek
Mostafa_El_Zenary DF EG 29 66 Egypt Zamalek
Mohamed_Ismail DF EG 27 66 Egypt Zamalek
Mahmoud_Hamdy_Wara DF EG 31 72 Egypt Zamalek
Mahmoud_Gehad MF EG 30 66 Egypt Zamalek
Seif_Gaafar MF EG 24 66 Egypt Zamalek
Mohamed_Shehata MF EG 28 70 Egypt Zamalek
Adam_Kaied MF PS 24 70 Egypt Zamalek
Abdallah_El_Said MF EG 27 68 Egypt Zamalek
Hossam_Ashraf FW EG 25 66 Egypt Zamalek
Nasser_Mansi FW EG 29 72 Egypt Zamalek
Ahmed_Jafeli FW TN 28 66 Egypt Zamalek
Chico_Banza FW AO 26 72 Egypt Zamalek
Oday_Dabbagh FW PS 27 72 Egypt Zamalek
Mohamed_Koko GK EG 33 68 Egypt Ceramica_Cleopatra
Mohamed_Bassam GK EG 33 66 Egypt Ceramica_Cleopatra
Ahmed_Hany DF EG 27 66 Egypt Ceramica_Cleopatra
Omar_Kamal DF EG 22 66 Egypt Ceramica_Cleopatra
Ragab_Nabil DF EG 31 67 Egypt Ceramica_Cleopatra
Saad_Samir DF EG 28 66 Egypt Ceramica_Cleopatra
Karim_El_Debes DF EG 24 68 Egypt Ceramica_Cleopatra
Karim_Nedved MF EG 29 68 Egypt Ceramica_Cleopatra
Abdallah_Magdy MF EG 26 66 Egypt Ceramica_Cleopatra
Ahmed_Belhadji MF MA 28 68 Egypt Ceramica_Cleopatra
Amr_El_Solia MF EG 38 66 Egypt Ceramica_Cleopatra
Justice_Arthur MF GH 25 68 Egypt Ceramica_Cleopatra
Mohamed_Abdallah MF EG 22 66 Egypt Ceramica_Cleopatra
Islam_Issa FW EG 28 69 Egypt Ceramica_Cleopatra
Nejc_Gradisar FW SI 32 69 Egypt Ceramica_Cleopatra
Peter_Gwargis FW IQ 27 66 Egypt Ceramica_Cleopatra
Khaled_Al_Nabris FW PS 27 66 Egypt Ceramica_Cleopatra
Gabaski GK EG 36 68 Egypt Modern_Sport
Mohamed_Desouki DF EG 28 66 Egypt Modern_Sport
Mahmoud_Rizk DF EG 33 66 Egypt Modern_Sport
Ali_El_Fil DF EG 29 65 Egypt Modern_Sport
Ahmed_Mazhoud DF TN 28 68 Egypt Modern_Sport
Mohamed_Yousri DF TN 27 66 Egypt Modern_Sport
Walid_Farag MF EG 28 66 Egypt Modern_Sport
Mohamed_Sabry MF EG 26 66 Egypt Modern_Sport
Ali_Zazaa MF EG 26 66 Egypt Modern_Sport
Arnold_Eba MF CM 25 66 Egypt Modern_Sport
Fejiri_Okenabirhie FW ENG 30 69 Egypt Modern_Sport
Godwin_Chika FW NG 26 66 Egypt Modern_Sport
Adem_Redjem FW DZ 27 68 Egypt Modern_Sport
Sobhi_Soliman GK EG 36 66 Egypt Al_Ittihad_Alexandria
Mohamed_Tony MF EG 27 66 Egypt Al_Ittihad_Alexandria
Mohamed_Fakhri MF EG 26 65 Egypt Al_Ittihad_Alexandria
Saviour_Isaac MF NG 25 67 Egypt Al_Ittihad_Alexandria
Kenneth_Semakula MF UG 29 68 Egypt Al_Ittihad_Alexandria
Hossam_Hassan FW EG 27 68 Egypt Al_Ittihad_Alexandria
John_Ebuka FW NG 26 69 Egypt Al_Ittihad_Alexandria
Pascal_Phiri FW ZM 27 68 Egypt Al_Ittihad_Alexandria
Joseph_Arumala FW NG 24 66 Egypt Al_Ittihad_Alexandria
Abou_El_Saoud GK EG 33 65 Egypt Arab_Contractors
Farouck_Kabore DF BF 29 66 Egypt Arab_Contractors
Joseph_Ochaya DF UG 30 66 Egypt Arab_Contractors
Mohamed_Rizk MF EG 27 65 Egypt Arab_Contractors
Omar_Saviola MF EG 24 66 Egypt Arab_Contractors
Mamadou_Niass FW MR 26 67 Egypt Arab_Contractors
Luis_Hinestroza FW CO 27 68 Egypt Arab_Contractors
John_Okoli FW NG 25 65 Egypt Arab_Contractors
Mahmoud_Wadi FW PS 26 66 Egypt Arab_Contractors
Mohamed_Okasha MF EG 33 65 Egypt Petrojet
Gabriel_Chukwudi FW NG 26 66 Egypt Petrojet
Mohamed_Camacho DF EG 30 65 Egypt Tala'ea_El_Gaish
Ahmed_El_Sheikh MF EG 31 66 Egypt Tala'ea_El_Gaish
Himid_Mao MF TZ 34 66 Egypt Tala'ea_El_Gaish
Godwin_Chika FW NG 25 65 Egypt Tala'ea_El_Gaish
Basem_Morsy FW EG 34 66 Egypt Tala'ea_El_Gaish
Ali_Lotfi GK EG 33 68 Egypt ZED
Abdallah_Bakri DF EG 28 66 Egypt ZED
Ahmed_Castelo DF EG 27 65 Egypt ZED
Ahmed_Sayed_Zizo DF EG 31 68 Egypt ZED
Amara_Keita DF SL 25 65 Egypt ZED
Tarek_Alaa DF EG 30 66 Egypt ZED
Peter_Mutumosi MF CD 26 66 Egypt ZED
Muhammed_Sawaneh MF GM 25 65 Egypt ZED
Mata_Magassa MF MR 25 67 Egypt ZED
Rafaat_Khalil FW EG 27 66 Egypt ZED
Ahmed_Atef FW EG 29 67 Egypt ZED
Shady_Hussein FW EG 31 69 Egypt ZED
Mostafa_Saad FW EG 28 65 Egypt ZED
Mamadou_Bah FW LR 26 66 Egypt ZED
Essam_Tharwat GK EG 27 68 Egypt Al_Masry
Baher_El_Mohamady DF EG 31 70 Egypt Al_Masry
Khaled_Sobhi DF EG 33 67 Egypt Al_Masry
Karim_El_Eraki DF EG 34 68 Egypt Al_Masry
Amr_El_Saadawy DF EG 31 67 Egypt Al_Masry
Mohamed_Shokry DF EG 25 66 Egypt Al_Masry
Mostafa_El_Aash DF EG 29 66 Egypt Al_Masry
Mohamed_Makhlouf MF EG 29 65 Egypt Al_Masry
Hassan_Ali MF EG 30 70 Egypt Al_Masry
Ameed_Sawafta MF PS 27 65 Egypt Al_Masry
Abderrahim_Deghmoum MF DZ 28 66 Egypt Al_Masry
Yassin_El_Mallah MF EG 24 66 Egypt Al_Masry
Salah_Mohsen FW EG 28 69 Egypt Al_Masry
Karim_Bambo FW EG 30 66 Egypt Al_Masry
Mounder_Temine FW DZ 31 67 Egypt Al_Masry
Ali_Sulieman FW ER 28 66 Egypt Al_Masry
Abdellah_Ziani FW MA 27 65 Egypt Al_Masry
Ahmed_Sobhi GK EG 32 66 Egypt National_Bank
Salah_Bouchama MF DZ 25 66 Egypt National_Bank
Osama_Faisal FW EG 25 70 Egypt National_Bank
Sayed_Abdallah_Sika FW EG 26 66 Egypt National_Bank
Anderson_Ceara FW BR 27 68 Egypt National_Bank
Yaw_Annor FW TG 28 66 Egypt National_Bank
Mees_Kaandorp MF NL 28 65 Egypt Wadi_Degla
Ali_Hussein FW EG 26 65 Egypt Wadi_Degla
Franck_Boli FW CI 32 67 Egypt Wadi_Degla
Kahraba FW EG 32 70 Egypt ENPPI
Ousseynou_Bodian FW SN 25 65 Egypt ENPPI
Desouki DF EG 28 65 Egypt Smouha
Niyigena DF RW 25 65 Egypt Smouha
El_Ghandour MF EG 32 66 Egypt Smouha
Farouk FW EG 27 67 Egypt Smouha
Badji FW SN 22 65 Egypt Smouha
Balaha FW EG 30 66 Egypt Smouha`;
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

/** The origin of the league a manager plays in: the market does not offer its players (his own league's clubs are where he trades with them). */
export const hiddenOrigin = (leagueId: string | null | undefined): Origin | null =>
  leagueId === "premier-league" ? "England" : leagueId === "egyptian-premier-league" ? "Egypt" : null;

/** The club he really plays for, when known ("Real Madrid"). */
export const realClubOf = (playerId: string) => clubByPlayer.get(playerId) ?? null;

/* ---------- the market moves: a fresh selection every two days ---------- */

/** Days between two refreshes. */
export const REFRESH_DAYS = 2;
const DAY = 86_400_000;
const CAIRO = 2 * 3_600_000;

/** The number of the current two-day period (days counted in Cairo time). */
export const periodOf = (now: number = nowMs()) => Math.floor(Math.floor((now + CAIRO) / DAY) / REFRESH_DAYS);
/** When the next selection arrives. */
export const nextRefresh = (now: number = nowMs()) => ((periodOf(now) + 1) * REFRESH_DAYS * DAY) - CAIRO;

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
export function visibleMarket(now: number = nowMs()): MarketEntry[] {
  const period = periodOf(now);
  return marketPlayers
    .filter((p) => onSale(p, period))
    .map((player) => ({ player, isNew: !onSale(player, period - 1), leaving: !onSale(player, period + 1) }));
}
