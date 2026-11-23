// @ts-nocheck
/**
 * The market of the Egyptian league: African and Arab players only.
 *
 *   CAFCL  players of the CAF Champions League clubs
 *   CAFCC  players of the Confederation Cup clubs
 *   Arab   Arab professionals who play abroad
 *   Africa invented squad players of the African leagues (like the prospects and free agents of the
 *          world market, they are not real people): so a club always has plenty to choose from
 *
 * Ratings are our own estimates on the scale of the Egyptian league (its best players are 76-80), so a
 * 70 here is a good signing and a 77 is a star. Prices come from marketValue() like every other player.
 *
 * Line format: name position nationality age rating origin [club]
 * Appended to the world pool by market.ts (new lines go at the END: ids follow the line order).
 */

export const REGIONAL_ORIGINS = ["CAFCL", "CAFCC", "Arab", "Africa"] as const;

const REAL = `
Ronwen_Williams GK ZA 34 75 CAFCL Mamelodi_Sundowns
Khuliso_Mudau DF ZA 30 71 CAFCL Mamelodi_Sundowns
Mothobi_Mvala DF ZA 31 70 CAFCL Mamelodi_Sundowns
Grant_Kekana DF ZA 33 69 CAFCL Mamelodi_Sundowns
Aubrey_Modiba DF ZA 30 70 CAFCL Mamelodi_Sundowns
Teboho_Mokoena MF ZA 29 76 CAFCL Mamelodi_Sundowns
Marcelo_Allende MF CL 27 73 CAFCL Mamelodi_Sundowns
Themba_Zwane MF ZA 36 70 CAFCL Mamelodi_Sundowns
Lucas_Ribeiro FW BR 27 75 CAFCL Mamelodi_Sundowns
Peter_Shalulile FW NA 32 74 CAFCL Mamelodi_Sundowns
Iqraam_Rayners FW ZA 30 71 CAFCL Mamelodi_Sundowns
Sipho_Chaine GK ZA 29 70 CAFCL Orlando_Pirates
Nkosinathi_Sibisi DF ZA 30 71 CAFCL Orlando_Pirates
Olisa_Ndah DF NG 26 70 CAFCL Orlando_Pirates
Mbekezeli_Mbokazi DF ZA 20 70 CAFCL Orlando_Pirates
Thalente_Mbatha MF ZA 27 70 CAFCL Orlando_Pirates
Patrick_Maswanganyi MF ZA 27 71 CAFCL Orlando_Pirates
Miguel_Timm MF ZA 29 69 CAFCL Orlando_Pirates
Relebohile_Mofokeng FW ZA 21 72 CAFCL Orlando_Pirates
Oswin_Appollis FW ZA 24 73 CAFCL Orlando_Pirates
Tshegofatso_Mabasa FW ZA 29 72 CAFCL Orlando_Pirates
Béchir_Ben_Saïd GK TN 31 70 CAFCL Espérance_de_Tunis
Yassine_Meriah DF TN 32 69 CAFCL Espérance_de_Tunis
Mohamed_Amine_Ben_Hamida DF TN 29 68 CAFCL Espérance_de_Tunis
Mohamed_Ali_Ben_Romdhane MF TN 26 72 CAFCL Espérance_de_Tunis
Youssef_Belaïli FW TN 33 72 CAFCL Espérance_de_Tunis
Elias_Saad FW TN 26 71 CAFCL Espérance_de_Tunis
Rodrigo_Rodrigues FW BR 30 70 CAFCL Espérance_de_Tunis
Haythem_Jouini FW TN 22 68 CAFCL Espérance_de_Tunis
Yahya_Attiat_Allah DF MA 29 70 CAFCL Wydad_AC
Mohamed_Rayhi MF MA 28 69 CAFCL Wydad_AC
Amine_Farhane FW MA 31 69 CAFCL Wydad_AC
Guy_Mbenza FW CD 29 70 CAFCL Wydad_AC
Anas_Zniti GK MA 36 68 CAFCL Raja_CA
Marwane_Saâdane DF MA 33 67 CAFCL Raja_CA
Mohsine_Moutouali MF MA 29 72 CAFCL Raja_CA
Glody_Likonza MF CD 31 70 CAFCL TP_Mazembe
Meschack_Elia FW CD 28 72 CAFCL TP_Mazembe
Djigui_Diarra GK ML 32 70 CAFCL Young_Africans
Ibrahim_Bacca DF TZ 28 68 CAFCL Young_Africans
Dickson_Job DF TZ 25 67 CAFCL Young_Africans
Khalid_Aucho MF UG 31 69 CAFCL Young_Africans
Pacôme_Zouzoua FW CI 25 70 CAFCL Young_Africans
Prince_Dube FW ZW 28 70 CAFCL Young_Africans
Max_Nzengeli FW CD 24 69 CAFCL Young_Africans
Clement_Mzize FW TZ 22 68 CAFCL Young_Africans
Ayoub_Lakred GK MA 31 69 CAFCL Simba_SC
Che_Malone_Fondoh DF CM 26 68 CAFCL Simba_SC
Mohamed_Hussein DF TZ 29 69 CAFCL Simba_SC
Fabrice_Ngoma MF CD 28 70 CAFCL Simba_SC
Jean_Charles_Ahoua FW CI 23 71 CAFCL Simba_SC
Kibu_Denis FW TZ 26 67 CAFCL Simba_SC
Steven_Mukwala FW UG 26 69 CAFCL Simba_SC
Oussama_Benbot GK DZ 31 70 CAFCC USM_Alger
Bruce_Bvuma GK ZA 30 68 CAFCC Kaizer_Chiefs
Edmilson_Dove DF MZ 30 68 CAFCC Kaizer_Chiefs
Yusuf_Maart MF ZA 30 68 CAFCC Kaizer_Chiefs
Gaston_Sirino MF UY 34 68 CAFCC Kaizer_Chiefs
Ashley_Du_Preez FW ZA 29 68 CAFCC Kaizer_Chiefs
Wandile_Duba FW ZA 28 67 CAFCC Kaizer_Chiefs
Sihle_Nduli MF ZA 30 66 CAFCC Stellenbosch
Ramy_Bensebaini DF DZ 30 77 Arab Borussia_Dortmund
Aïssa_Mandi DF DZ 34 71 Arab Lille
Youcef_Atal DF DZ 29 74 Arab Nice
Ismaël_Bennacer MF DZ 28 77 Arab AC_Milan
Houssem_Aouar MF DZ 27 74 Arab
Said_Benrahma FW DZ 30 75 Arab
Baghdad_Bounedjah FW DZ 34 72 Arab Al_Sadd
Mohamed_Amoura FW DZ 25 77 Arab Wolfsburg
Farès_Chaïbi MF DZ 22 74 Arab
Adem_Zorgane MF DZ 25 70 Arab Charleroi
Yassine_Bounou GK MA 34 79 Arab Al_Hilal
Nayef_Aguerd DF MA 30 77 Arab
Sofyan_Amrabat MF MA 29 76 Arab
Azzedine_Ounahi MF MA 25 75 Arab
Abde_Ezzalzouli FW MA 24 77 Arab Real_Betis
Zakaria_Aboukhlal FW MA 25 74 Arab
Selim_Amallah MF MA 29 72 Arab
Ilias_Chair MF MA 28 72 Arab
Amine_Harit MF MA 28 72 Arab
Romain_Saïss DF MA 35 71 Arab
Jawad_El_Yamiq DF MA 33 69 Arab
Bilal_El_Khannouss MF MA 21 76 Arab
Ellyes_Skhiri MF TN 30 75 Arab Eintracht_Frankfurt
Montassar_Talbi DF TN 27 72 Arab
Dylan_Bronn DF TN 30 70 Arab
Hannibal_Mejbri MF TN 22 71 Arab
Aïssa_Laïdouni MF TN 28 72 Arab
Wahbi_Khazri FW TN 34 71 Arab
Ali_Maâloul DF TN 35 69 Arab
Naïm_Sliti MF TN 33 69 Arab
Mohamed_Dräger MF TN 29 70 Arab
Ali_Abdi DF TN 31 70 Arab
Ferjani_Sassi MF TN 33 69 Arab
Salem_Al_Dawsari FW SA 34 76 Arab Al_Hilal
Firas_Al_Buraikan FW SA 25 74 Arab Al_Ahli
Mohammed_Kanno MF SA 32 73 Arab Al_Hilal
Saud_Abdulhamid DF SA 26 72 Arab
Nawaf_Al_Aqidi GK SA 26 70 Arab
Yasser_Al_Shahrani DF SA 33 70 Arab Al_Hilal
Abdulelah_Al_Amri DF SA 28 70 Arab
Ali_Al_Bulaihi DF SA 29 69 Arab
Akram_Afif FW QA 29 76 Arab Al_Sadd
Almoez_Ali FW QA 29 72 Arab
Hassan_Al_Haydos MF QA 35 69 Arab Al_Sadd
Boualem_Khoukhi DF QA 35 67 Arab Al_Sadd
Tarek_Salman DF QA 28 68 Arab
Ali_Mabkhout FW AE 35 70 Arab
Musa_Al_Taamari FW JO 28 75 Arab Rennes
Yazan_Al_Naimat FW JO 26 70 Arab
Ali_Olwan FW JO 25 69 Arab
Mahmoud_Al_Mardi FW JO 31 68 Arab
Aymen_Hussein FW IQ 29 70 Arab
Mohanad_Ali FW IQ 25 70 Arab
Ali_Al_Hamadi FW IQ 23 68 Arab
Amir_Al_Ammari MF IQ 28 69 Arab Cercle_Brugge
Omar_Khribin FW SY 32 69 Arab
Walieldin_Khedr MF SD 32 70 Arab
Hamdou_Elhouni MF LY 31 70 Arab`;

/* ---------- invented squad players of the African leagues ---------- */

const FIRST: Record<string, string[]> = {
  DZ: ["Riad", "Nabil", "Sofiane", "Karim", "Walid"], TN: ["Mehdi", "Oussama", "Firas", "Aymen", "Slim"],
  MA: ["Zakaria", "Brahim", "Younes", "Anas", "Mehdi"], SD: ["Omar", "Mohamed", "Salah", "Abdelrahman", "Yasir"],
  CI: ["Kouassi", "Yao", "Serge", "Ismaël", "Franck"], CM: ["Eric", "Brice", "Collins", "Olivier", "Jean"],
  ZA: ["Thabo", "Sipho", "Lungelo", "Bongani", "Kagiso"], TZ: ["Juma", "Abdul", "Hassan", "Ally", "Salum"],
  CD: ["Jean", "Patient", "Merveille", "Héritier", "Trésor"], ML: ["Mamadou", "Boubacar", "Sékou", "Adama", "Moussa"],
  NG: ["Chidi", "Emeka", "Tunde", "Kelechi", "Femi"], GH: ["Kwame", "Yaw", "Kojo", "Nii", "Kwesi"],
  SN: ["Moussa", "Ibrahima", "Cheikh", "Mamadou", "Pape"], IQ: ["Ali", "Hussein", "Mustafa", "Ahmed", "Ibrahim"],
  JO: ["Odai", "Hamza", "Mahmoud", "Anas", "Baha"], SA: ["Fahad", "Turki", "Abdullah", "Saleh", "Nasser"],
};
const LAST: Record<string, string[]> = {
  DZ: ["Benali", "Boudaoui", "Merah", "Belkacem", "Slimani"], TN: ["Ben Salah", "Trabelsi", "Jebali", "Haddad", "Khemiri"],
  MA: ["El Fassi", "Berrada", "Tahiri", "Ouazzani", "Lahlou"], SD: ["Osman", "Ibrahim", "Babiker", "Hamid", "Adam"],
  CI: ["Konan", "Traoré", "Coulibaly", "Kouamé", "Bamba"], CM: ["Mbarga", "Ndzie", "Etame", "Fouda", "Tchoumi"],
  ZA: ["Dlamini", "Mokoena", "Ndlovu", "Khumalo", "Mahlangu"], TZ: ["Mwakyusa", "Kapombe", "Msuva", "Nyoni", "Salum"],
  CD: ["Mbemba", "Kabongo", "Kalala", "Ilunga", "Mukendi"], ML: ["Keita", "Sissoko", "Diarra", "Coulibaly", "Dembélé"],
  NG: ["Adebayo", "Eze", "Okafor", "Balogun", "Nwosu"], GH: ["Boateng", "Asamoah", "Owusu", "Appiah", "Tetteh"],
  SN: ["Sarr", "Ndiaye", "Diop", "Faye", "Gueye"], IQ: ["Al Jabouri", "Hassan", "Al Dulaimi", "Kareem", "Saadoun"],
  JO: ["Al Khatib", "Haddad", "Al Zoubi", "Masri", "Qasem"], SA: ["Al Harbi", "Al Qahtani", "Al Otaibi", "Al Ghamdi", "Al Zahrani"],
};
const NATS = Object.keys(FIRST);
const ARABIC = new Set(["IQ", "JO", "SA", "DZ", "TN", "MA", "SD"]);
const POS = ["GK", "DF", "DF", "MF", "MF", "FW", "FW", "DF", "MF", "FW"];

function hashOf(t: string) {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  h ^= h >>> 16; h = Math.imul(h, 2246822507); h ^= h >>> 13; h = Math.imul(h, 3266489909); h ^= h >>> 16;
  return h >>> 0;
}

function invented(): string {
  const out: string[] = [];
  const used = new Set(REAL.trim().split("\n").map((l) => l.split(" ")[0]));
  for (let i = 0; i < 110; i++) {
    const n = NATS[hashOf(`reg|${i}`) % NATS.length];
    let name = "";
    // two players never share a name
    for (let t = 0; t < 40; t++) {
      const f = FIRST[n][hashOf(`rf|${i}|${t}`) % 5];
      const l = LAST[n][hashOf(`rl|${i}|${t}`) % 5];
      name = `${f}_${l.replace(/ /g, "_")}`;
      if (!used.has(name)) break;
    }
    used.add(name);
    const age = 20 + (hashOf(`ra|${i}`) % 12);
    const rating = 64 + (hashOf(`rr|${i}`) % 9);
    const pos = POS[hashOf(`rp|${i}`) % POS.length];
    out.push(`${name} ${pos} ${n} ${age} ${rating} ${ARABIC.has(n) && hashOf(`ro|${i}`) % 2 ? "Arab" : "Africa"}`);
  }
  return out.join("\n");
}

/** All the lines of the regional market (real players first, then the invented ones). */
export const REGIONAL_LINES = (REAL.trim() + "\n" + invented()).trim();
