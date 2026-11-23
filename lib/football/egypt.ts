/**
 * Egyptian Premier League, 2026/27: the 20 clubs and their first teams.
 *
 * Names, numbers and positions come from public squad lists (Wikipedia and
 * squad pages) read in November 2026. Ages and ratings are our own estimates
 * for the game, not an official figure, and a few small clubs have thin lists
 * (marked "Youth" players are placeholders). Crests are placeholders until the
 * real club logos are added: replace public/club-logos/<id>.svg.
 *
 * Line format: number name position nationality age rating
 */

export type EgyptClub = { id: string; name: string; city: string; stadium: string; logo: string; colors: [string, string] };

export const egyptClubs: EgyptClub[] = [
  { id: "al-ahly", name: "Al Ahly", city: "Cairo", stadium: "Cairo International Stadium", logo: "/club-logos/al-ahly.png", colors: ["#c8102e", "#ffffff"] },
  { id: "pyramids", name: "Pyramids", city: "Cairo", stadium: "30 June Stadium", logo: "/club-logos/pyramids.png", colors: ["#00a6e0", "#ffd100"] },
  { id: "zamalek", name: "Zamalek", city: "Cairo", stadium: "Cairo International Stadium", logo: "/club-logos/zamalek.png", colors: ["#ffffff", "#c8102e"] },
  { id: "ceramica-cleopatra", name: "Ceramica Cleopatra", city: "Cairo", stadium: "Suez Canal Authority Stadium", logo: "/club-logos/ceramica-cleopatra.png", colors: ["#8b1a3a", "#f2c14e"] },
  { id: "modern-sport", name: "Modern Sport", city: "Cairo", stadium: "Al Salam Stadium", logo: "/club-logos/modern-sport.png", colors: ["#0b3d91", "#ffffff"] },
  { id: "al-ittihad", name: "Al Ittihad", city: "Alexandria", stadium: "Alexandria Stadium", logo: "/club-logos/al-ittihad.png", colors: ["#1a8a3c", "#ffffff"] },
  { id: "arab-contractors", name: "Arab Contractors", city: "Cairo", stadium: "Osman Ahmed Osman Stadium", logo: "/club-logos/arab-contractors.png", colors: ["#f5a300", "#1a1a1a"] },
  { id: "petrojet", name: "Petrojet", city: "Suez", stadium: "Suez Stadium", logo: "/club-logos/petrojet.png", colors: ["#e4572e", "#14213d"] },
  { id: "canal", name: "Canal SC", city: "Ismailia", stadium: "Ismailia Stadium", logo: "/club-logos/canal.png", colors: ["#0077b6", "#ffffff"] },
  { id: "tala3-el-gaish", name: "Tala'ea El Gaish", city: "Cairo", stadium: "Gehaz El Reyada Stadium", logo: "/club-logos/tala3-el-gaish.png", colors: ["#556b2f", "#f0e6c8"] },
  { id: "zed", name: "ZED FC", city: "Cairo", stadium: "Cairo International Stadium", logo: "/club-logos/zed.png", colors: ["#6a0dad", "#ffffff"] },
  { id: "al-masry", name: "Al Masry", city: "Port Said", stadium: "Al Masry Club Stadium", logo: "/club-logos/al-masry.png", colors: ["#1b7f3b", "#1a1a1a"] },
  { id: "national-bank", name: "National Bank of Egypt", city: "Cairo", stadium: "Cairo International Stadium", logo: "/club-logos/national-bank.png", colors: ["#005b3f", "#ffd100"] },
  { id: "wadi-degla", name: "Wadi Degla", city: "Cairo", stadium: "Petro Sport Stadium", logo: "/club-logos/wadi-degla.png", colors: ["#e07b00", "#1a1a1a"] },
  { id: "sharqia-enppi", name: "Sharqia Enppi", city: "Cairo", stadium: "Petro Sport Stadium", logo: "/club-logos/sharqia-enppi.png", colors: ["#00a3a3", "#f5f5f5"] },
  { id: "smouha", name: "Smouha", city: "Alexandria", stadium: "Alexandria Stadium", logo: "/club-logos/smouha.png", colors: ["#1e3a8a", "#ffffff"] },
  { id: "abu-qir-fertilizers", name: "Abu Qir Fertilizers", city: "Alexandria", stadium: "Abu Qir Fertilizers Stadium", logo: "/club-logos/abu-qir-fertilizers.png", colors: ["#2e7d32", "#f9a825"] },
  { id: "el-gouna", name: "El Gouna", city: "El Gouna", stadium: "Khaled Bichara Stadium", logo: "/club-logos/el-gouna.png", colors: ["#00bcd4", "#0d1b2a"] },
  { id: "petrol-asyut", name: "Petrol Asyut", city: "Asyut", stadium: "Asyut University Stadium", logo: "/club-logos/petrol-asyut.png", colors: ["#37474f", "#ff9800"] },
  { id: "ghazl-el-mahalla", name: "Ghazl El Mahalla", city: "El Mahalla", stadium: "Ghazl El Mahalla Stadium", logo: "/club-logos/ghazl-el-mahalla.png", colors: ["#b71c1c", "#ffffff"] },
];


/** Starting strength of each club, used by the match simulation (same scale as the Premier League table). */
export const egyptRatings: Record<string, number> = {
  "pyramids": 82,
  "al-ahly": 81,
  "zamalek": 78,
  "al-masry": 75,
  "ceramica-cleopatra": 75,
  "modern-sport": 74,
  "zed": 74,
  "al-ittihad": 73,
  "arab-contractors": 72,
  "national-bank": 72,
  "smouha": 71,
  "tala3-el-gaish": 71,
  "wadi-degla": 70,
  "sharqia-enppi": 70,
  "petrojet": 69,
  "abu-qir-fertilizers": 68,
  "el-gouna": 68,
  "ghazl-el-mahalla": 67,
  "petrol-asyut": 66,
  "canal": 66,
};

/** Money tier of each club (decides the budget and the board's targets). */
export const egyptTiers: Record<string, "elite" | "mid" | "small"> = {
  "pyramids": "elite",
  "al-ahly": "elite",
  "zamalek": "elite",
  "al-masry": "mid",
  "ceramica-cleopatra": "mid",
  "modern-sport": "mid",
  "zed": "mid",
  "al-ittihad": "mid",
  "arab-contractors": "mid",
  "national-bank": "mid",
  "smouha": "mid",
  "tala3-el-gaish": "small",
  "wadi-degla": "small",
  "sharqia-enppi": "small",
  "petrojet": "small",
  "abu-qir-fertilizers": "small",
  "el-gouna": "small",
  "ghazl-el-mahalla": "small",
  "petrol-asyut": "small",
  "canal": "small",
};

export const egyptColors: Record<string, string> = Object.fromEntries(egyptClubs.map((c) => [c.id, c.colors[0] === "#ffffff" ? c.colors[1] : c.colors[0]]));

export const egyptRaw: Record<string, string> = {
  "al-ahly": `
1 Shenawy GK EG 37 76
31 Shobeir GK EG 27 72
33 Hamza_Alaa GK EG 21 60
2 Yassin_Marei DF EG 23 70
3 Achraf_Dari DF MA 27 75
4 Ahmed_Eid DF EG 25 66
5 Hady_Reyad DF EG 24 66
6 Yasser_Ibrahim DF EG 32 72
20 Youssef_Belammari DF MA 28 71
24 Tawfik_Mohamed DF EG 21 62
26 Amr_El_Gazar DF EG 24 62
30 Mohamed_Hany DF EG 30 72
8 Ahmed_Reda MF EG 23 67
12 Akram_Tawfik MF EG 29 72
13 Marwan_Attia MF EG 27 73
15 Omar_El_Saaiy MF EG 29 68
21 Ali_Mahmoud MF EG 21 60
22 Imam_Ashour MF EG 28 76
34 Kabaka MF EG 21 60
36 Ahmed_Nabil_Koka MF EG 31 72
7 Taher_Mohamed FW EG 29 72
9 Soufiane_Benjdida FW MA 24 70
10 Monsef_Bakrar FW DZ 27 73
14 Hussein_El_Shahat FW EG 34 75
17 Achraf_Bencharki FW MA 32 76
18 Omar_Moawad FW EG 25 68
19 Afsha FW EG 29 70
25 Zizo FW EG 30 74
27 Aqtay_Abdallah FW EG 23 64
29 Reda_Slim FW MA 27 66
`,
  "pyramids": `
1 Ahmed_El_Shenawy GK EG 35 76
28 Mahmoud_Gad GK EG 28 68
31 Hazem_Gamal GK EG 21 62
16 Ziad_Haytham GK EG 20 58
3 Mahmoud_Marei DF EG 28 68
4 Ahmed_Samy DF EG 34 70
6 Osama_Galal DF EG 29 72
12 Ahmed_Tawfik DF EG 35 68
15 Mohamed_Chibi DF MA 33 76
21 Mohamed_Hamdy DF EG 31 70
24 Khaled_Awad DF EG 23 64
29 Karim_Hafez DF EG 30 70
34 Eyad_El_Askalany DF EG 21 68
8 Mahmoud_Saber MF EG 25 70
5 Hamed_Hamdan MF PS 26 70
7 Youssef_Obama MF EG 30 70
9 Ahmed_Abdelkader MF EG 27 72
14 Mohanad_Lasheen MF EG 30 74
18 Walid_El_Karti MF MA 32 76
20 Abdel_Rahman_Magdy MF EG 29 70
22 Nasser_Maher MF EG 29 74
23 Ahmed_Atef MF EG 23 66
32 Ewerton MF BR 29 72
35 Ahmed_Fawzi MF EG 24 62
37 Hassan_Tarek MF EG 21 60
39 Ali_Hamouda FW EG 20 60
11 Mostafa_Fathi FW EG 32 76
13 Nadir_Benbouali FW DZ 26 74
17 Zalaka FW EG 27 72
25 Odeh_Al_Fakhouri FW JO 21 68
26 Mohamed_El_Gabbas FW EG 38 62
30 Mostafa_Ziko FW EG 29 72
39 Mesho FW EG 20 60
40 Ziad_Saoudi MF EG 21 60
`,
 "zamalek": `
1 Mohamed_Awad GK EG 34 70
16 Mohamed_Sobhi GK EG 27 74
37 El_Mahdy_Soliman GK EG 39 68
46 Mahmoud_El_Shenawy GK EG 21 62
38 Omar_Abdelaziz GK EG 17 58
2 Ahmed_Hossam DF EG 25 68
3 Mahmoud_Bentayg DF MA 27 74
4 Omar_Gaber DF EG 34 72
5 Ahmed_Hossam DF EG 25 68
13 Ahmed_Abou_El_Fotouh DF EG 28 76
20 Mostafa_El_Zenari DF EG 27 66
24 Mohamed_Ismail DF EG 27 70
28 Mahmoud_El_Wensh DF EG 31 74
52 Mohamed_Ebrahim DF EG 21 60
58 Mohamed_Farag DF EG 18 58
6 Mahmoud_Gehad MF EG 25 68
12 Ahmed_Rabie MF EG 25 66
14 Seif_Gaafar MF EG 26 68
17 Mohamed_Shehata MF EG 25 74
19 Abdallah_El_Said MF EG 41 76
39 Mohamed_El_Sayed MF EG 20 64
43 El_Sayed_Osama MF EG 20 60
44 Youssef_El_Faransy MF EG 21 62
55 Mohamed_Hamad MF EG 17 60
56 Ahmed_Safwat MF EG 17 58
18 Adam_Kayed MF PS 24 68
7 Hossam_Ashraf FW EG 25 70
9 Nasser_Mansi FW EG 29 74
11 Ahmed_Abdel_Rahim FW EG 22 68
21 Ahmed_El_Gafaly FW TN 23 68
31 Ahmed_Sherif FW EG 23 70
81 Chico_Banza FW AO 27 72
90 Amr_Nasser FW EG 26 68
98 Oday_Dabbagh FW PS 27 74
`,
  "ceramica-cleopatra": `
1 Mohamed_Koko GK EG 33 68
18 Mohamed_Bassam GK EG 33 66
13 Mohamed_Tarek GK EG 25 60
16 Islam_Reisha GK EG 24 58
2 Ahmed_Hany DF EG 27 66
3 Omar_Kamal DF EG 22 66
5 Ragab_Nabil DF EG 31 67
6 Saad_Samir DF EG 28 66
21 Ahmed_Moaz DF EG 25 63
33 Karim_El_Debes DF EG 24 68
34 Ahmed_Abdin DF EG 22 64
66 Mohamed_El_Maghrabi DF EG 25 62
4 Karim_Nedved MF EG 29 68
8 Abdallah_Magdy MF EG 26 66
10 Ahmed_Belhadji MF MA 28 68
14 Hema_Mohamed MF EG 24 62
17 Amr_El_Solia MF EG 38 66
20 Mohamed_Sadek MF EG 27 64
24 Justice_Arthur MF GH 25 68
28 Amr_Kalawa MF EG 27 64
37 Mohamed_Abdallah MF EG 22 66
7 Islam_Issa FW EG 28 69
9 Nejc_Gradisar FW SI 32 69
11 Peter_Gwargis FW IQ 27 66
15 Samir_El_Eraki FW EG 27 63
19 Ayman_Mukka FW EG 24 62
22 Khaled_Al_Nabris FW PS 27 66
25 Shika FW EG 24 64
41 Umar_Abdulrauf FW GH 22 64
77 Bobo FW EG 25 63
`,
  "modern-sport": `
1 Gabaski GK EG 36 68
13 Ahmed_Yehia GK EG 25 60
31 Kamal_El_Sayed GK EG 24 58
99 Mostafa_Makhlouf GK EG 22 62
3 Mohamed_Desouki DF EG 28 66
4 Mahmoud_Rizk DF EG 33 66
5 Tarek_Mohamed DF EG 26 64
6 Ali_El_Fil DF EG 29 65
15 Mostafa_Ashraf DF EG 26 62
21 Mahmoud_Shaaban DF EG 24 62
24 Khaled_Reda DF EG 25 62
30 Ahmed_Mazhoud DF TN 28 68
37 Mohamed_Yousri DF TN 27 66
7 Walid_Farag MF EG 28 66
8 Mohamed_Sabry MF EG 26 66
12 Ahmed_Youssef MF EG 27 64
14 Ahmed_Mostafa MF EG 25 62
17 Abdelrahman_Shika MF EG 24 64
19 Mohamed_Mosaad MF EG 26 64
20 Emad_Hamdi MF EG 27 63
22 Ali_Zazaa MF EG 26 66
25 Mohamed_Helal MF EG 25 62
27 Ghanam_Mohamed MF EG 23 62
38 Arnold_Eba MF CM 25 66
77 Ali_Fawzi MF EG 23 62
9 Fejiri_Okenabirhie FW ENG 30 69
18 Hossam_Hassan FW EG 23 64
23 Godwin_Chika FW NG 26 66
28 Adem_Redjem FW DZ 27 68
35 Mahmoud_Mamdouh FW EG 22 60
`,
  "al-ittihad": `
1 Sobhi_Soliman GK EG 36 66
16 Ahmed_El_Arabi GK EG 30 62
31 Ali_El_Gabry GK EG 29 60
- Mazen_Osama DF EG 23 58
4 Islam_Abdellah DF EG 26 64
5 Mostafa_Ibrahim DF EG 29 64
7 Mido_Mostafa DF EG 28 63
- Abdo_Hesham DF EG 24 58
12 Moamen_Sherif DF EG 26 62
24 Momen_Awad DF EG 25 60
30 Khaled_Mosaad DF EG 27 61
47 Mostafa_Moawad DF EG 20 56
8 Mohamed_Tony MF EG 27 66
- Anas_Wael MF EG 22 57
14 Mohamed_Fakhri MF EG 26 65
19 Ahmed_El_Sayed MF EG 28 64
21 Ahmed_Hamdy MF EG 27 63
23 Saviour_Isaac MF NG 25 67
25 Mahmoud_Emad MF EG 22 62
37 Ahmed_Atef MF EG 28 63
44 Kenneth_Semakula MF UG 29 68
10 Hossam_Hassan FW EG 27 68
11 Youssry_Wahid FW EG 25 64
18 John_Ebuka FW NG 26 69
22 Nour_Alaa FW EG 22 62
35 Pascal_Phiri FW ZM 27 68
80 Joseph_Arumala FW NG 24 66
`,
  "arab-contractors": `
1 Abou_El_Saoud GK EG 33 65
16 Hassan_Shahin GK EG 27 58
2 Amir_Abed DF EG 27 63
11 Louay_Wael DF EG 24 62
20 Ahmed_Alaa DF EG 28 64
21 Farouck_Kabore DF BF 29 66
22 Mohamed_Gharib DF EG 26 62
23 Joseph_Ochaya DF UG 30 66
32 Mohamed_Hozian DF EG 23 58
74 Mostafa_Mokhtar DF EG 21 56
3 Youssef_El_Gohary MF EG 25 62
4 Ahmed_El_Shimi MF EG 29 63
8 Mohamed_Rizk MF EG 27 65
10 Omar_Saviola MF EG 24 66
12 Ahmed_Afifi MF EG 26 61
19 Mohamed_Magli MF EG 28 62
35 Ahmed_Fawzi MF EG 21 56
7 Mamadou_Niass FW MR 26 67
9 Mohamed_Salem FW EG 27 64
14 Gebna FW EG 30 63
17 Fady_Farid FW EG 25 60
24 Luis_Hinestroza FW CO 27 68
28 John_Okoli FW NG 25 65
29 Mahmoud_Wadi FW PS 26 66
- Youth_GK_1 GK EG 19 54
`,
  "petrojet": `
1 Omar_Salah GK EG 28 62
16 Abdelkafi_Ragab GK EG 30 58
77 Mohamed_Khalifa GK EG 22 55
2 Ahmed_Ghoneim DF EG 27 61
4 Mahmoud_Shedid_Kenawi DF EG 29 62
5 Youssef_Limouri DF MA 28 64
15 Ahmed_Bahbah DF EG 31 59
18 Tawfik_Mohamed DF EG 24 58
23 Qobolwakhe_Sibande DF ZA 27 63
25 Barakat_Haggag DF EG 26 59
29 Ahmed_Yassin DF EG 23 57
7 Ammar_Hamdy MF EG 26 62
8 Mohamed_Okasha MF EG 33 65
11 Mohamed_Dodo MF EG 29 61
13 Amadou_Bah MF GN 26 63
14 Mostafa_El_Gamal MF EG 30 60
17 Adham_Hamed MF EG 22 57
19 Mostafa_El_Badry MF EG 25 58
30 Omar_Reda MF EG 21 55
39 Abdoulaye_Diabate MF CI 25 64
9 Bader_Mousa FW PS 27 64
10 Gabriel_Chukwudi FW NG 26 66
20 Rasheed_Ahmed FW NG 22 62
22 Mahmoud_Morsi FW EG 28 60
40 Sekou_Sonko FW SN 24 63
99 Samir_Mohamed FW EG 21 58
`,
  "canal": `
- Mohamed_Shaaban GK EG 30 60
- Ali_El_Fil DF EG 35 60
- Mahmoud_Rizk DF EG 28 59
- Mostafa_Hamada MF EG 27 62
- Ramy_Najjarine MF LB 30 61
- Hafiz_Ibrahim MF GH 20 58
- Mohamed_Sadeq MF EG 26 60
- Mohamed_Hamdy_Zaky MF EG 25 58
- Ziad_Tarek MF EG 22 57
- Mihab_Sami MF EG 22 56
- Mawuli_Wayo FW GH 22 61
- Rudolph_Mensah FW GH 23 60
- Hazem_Abu_Senna FW EG 27 62
- Mody_Shalata FW EG 26 61
- Youth_GK_1 GK EG 19 54
- Youth_GK_2 GK EG 20 55
- Youth_DF_1 DF EG 19 54
- Youth_DF_2 DF EG 20 55
- Youth_DF_3 DF EG 21 56
- Youth_DF_4 DF EG 19 54
- Youth_DF_5 DF EG 20 55
`,
  "tala3-el-gaish": `
1 Omar_Radwan GK EG 29 64
18 Emad_El_Sayed GK EG 31 58
41 Ahmed_Abbas GK EG 21 54
3 Amro_Tarek DF EG 27 62
4 Mohamed_Camacho DF EG 30 65
6 Khaled_Stouhi DF EG 26 62
8 Ahmed_Zola DF EG 28 61
15 Hassan_Magdy DF EG 25 60
21 Ahmed_Meteb DF EG 27 61
28 Hamed_El_Gabry DF EG 24 58
30 Moaz_El_Henawy DF EG 23 57
31 Moamen_Mahmoud DF EG 22 56
33 Khaled_Awad DF EG 26 59
5 Farid_Shawky MF EG 29 64
10 Ahmed_El_Sheikh MF EG 31 66
12 Islam_Mohareb MF EG 30 63
13 Himid_Mao MF TZ 34 66
14 Emad_Fathy MF EG 28 61
19 Ahmed_Samir MF EG 27 60
20 Ali_Hamdy MF EG 25 59
22 Mostafa_El_Khawaga MF EG 26 60
26 Mohamed_Hany MF EG 22 57
- Ghaith_Al_Madadha MF JO 27 62
2 Godwin_Chika FW NG 25 65
7 Riga FW EG 30 64
9 Basem_Morsy FW EG 34 66
11 Karim_Tarek FW EG 26 62
23 Moussa_Diawara FW GN 25 64
35 Fares_Hatem FW EG 21 57
`,
  "zed": `
1 Ali_Lotfi GK EG 33 68
16 Mazzika GK EG 36 62
33 Ahmed_Nader GK EG 24 56
36 Abdelmonem_Tamer GK EG 20 53
3 Abdallah_Bakri DF EG 28 66
4 Ahmed_Castelo DF EG 27 65
5 Ahmed_Tarek DF EG 28 64
8 Ahmed_Sayed_Zizo DF EG 31 68
13 Amara_Keita DF SL 25 65
15 Sameh_Ibrahim DF EG 26 62
22 Ziad_Tarek DF EG 23 61
23 Tarek_Alaa DF EG 30 66
24 Mohamed_Rabia DF EG 25 60
32 Abdallah_Bostangy DF EG 22 57
17 Abdelrahman_El_Banouby MF EG 25 64
19 Abdelrahman_Emad MF EG 23 60
20 Hamdy_Alaa MF EG 26 62
26 Peter_Mutumosi MF CD 26 66
35 Muhammed_Sawaneh MF GM 25 65
37 Mata_Magassa MF MR 25 67
77 Mahmoud_Saber MF EG 24 61
88 Kabaka MF EG 27 63
7 Rafaat_Khalil FW EG 27 66
9 Ahmed_Atef FW EG 29 67
10 Shady_Hussein FW EG 31 69
11 Mostafa_Saad FW EG 28 65
14 Ahmed_Adel FW EG 27 64
25 Mamadou_Bah FW LR 26 66
`,
  "al-masry": `
1 Essam_Tharwat GK EG 27 69
16 Mahmoud_Hamdy GK EG 26 62
31 Mohamed_Shehata GK EG 23 60
- Mohamed_Seha GK EG 23 62
2 Baher_El_Mohamady DF EG 31 70
5 Khaled_Sobhi DF EG 33 67
7 Karim_El_Eraki DF EG 34 68
13 Amr_El_Saadawy DF EG 31 67
29 Mohamed_Hashem DF EG 24 62
- Mohamed_Shokry DF EG 25 66
- Mostafa_El_Aash DF EG 29 66
6 Mohamed_Makhlouf MF EG 29 65
8 Hassan_Ali MF EG 30 70
12 Mostafa_Aboul_Kheir MF EG 26 64
14 Mahmoud_Hamada MF EG 28 63
15 Ahmed_El_Armouty MF EG 24 61
17 Youssef_El_Gohary MF EG 23 62
18 Ameed_Sawafta MF PS 27 65
30 Abderrahim_Deghmoum MF DZ 28 66
- Yassin_El_Mallah MF EG 24 66
9 Salah_Mohsen FW EG 28 69
10 Karim_Bambo FW EG 30 66
11 Mohammed_Al_Shamy FW EG 33 64
25 Mounder_Temine FW DZ 31 67
- Ali_Sulieman FW ER 28 66
- Abdellah_Ziani FW MA 27 65
24 Moustafa_Zeidan MF PS 25 65
`,
  "national-bank": `
1 Ahmed_Sobhi GK EG 32 66
27 Abdelaziz_El_Balouti GK EG 32 60
31 Ahmed_Tarek_Soliman GK EG 25 56
2 Mohamed_Nasr DF EG 26 64
6 Mahmoud_El_Gazzar DF EG 27 63
7 Hesham_Salah DF EG 29 64
12 Ahmed_Meteb DF EG 30 63
13 Shefo DF EG 29 62
20 Amir_Medhat DF EG 35 61
28 Hatem_Sukar DF EG 24 58
33 Cyril_Dao DF BF 19 59
8 Rashad_El_Metwaly MF EG 25 64
14 Ali_Hamdi MF EG 27 63
15 Salah_Bouchama MF DZ 25 66
17 Mody_Naser MF EG 25 62
21 Ahmed_Madbouly MF EG 30 62
24 Mostafa_Dowidar MF EG 28 60
77 Mohamed_Gamal MF EG 26 58
9 Osama_Faisal FW EG 25 70
10 Sayed_Abdallah_Sika FW EG 26 66
22 Anderson_Ceara FW BR 27 68
23 Oufa FW EG 30 62
29 Ahmed_Yasser_Rayyan FW EG 28 63
30 Yaw_Annor FW TG 28 66
18 Karim_Hamed FW EG 20 57
70 Mohamed_Reda FW EG 20 56
`,
  "wadi-degla": `
1 Amr_Hossam GK EG 35 64
18 Greisha GK EG 20 55
99 Abdelrahman_Qattawy GK EG 26 56
13 Seyam GK EG 23 54
2 Shady_Maher DF EG 29 63
3 Omar_Adly DF EG 30 63
5 Ahmed_Dahroug DF EG 30 63
6 Kamal_Aboul_Fetouh DF EG 29 62
21 Ahmed_Reda DF EG 23 60
23 Ahmed_Ayman DF EG 32 59
24 Mohamed_Ragab DF EG 27 58
28 Seif_Teka DF TN 34 62
40 Ahmed_Abdin DF EG 19 54
4 Islam_Adel MF EG 33 61
8 Ahmed_Scholes MF EG 28 64
14 Mohamed_Abdelaati MF EG 30 62
20 Juhayna MF EG 26 61
25 Ibrahim_El_Bahnasi MF EG 24 62
30 Mohamed_Fathy MF EG 32 60
34 Mees_Kaandorp MF NL 28 65
44 Ahmed_El_Shimi MF EG 31 59
7 Ali_Hussein FW EG 26 65
9 Franck_Boli FW CI 32 67
10 Mahmoud_Diasty FW EG 26 64
11 Mohamed_Abdelrahim FW EG 27 63
27 Ahmed_Refaat FW EG 25 59
32 Ahmed_Farouk FW EG 25 60
`,
  "sharqia-enppi": `
1 Samir GK EG 25 63
16 Reda_El_Sayed GK EG 34 61
29 Ramadan_Mostafa GK EG 27 56
3 Marwan_Dawoud DF EG 29 64
4 Ahmed_Kalosha DF EG 28 64
5 Elkhashab DF EG 28 62
8 Hesham_Adel DF EG 28 62
20 Mohamed_Samir DF EG 25 61
31 Ali_Mahmoud DF EG 23 59
32 Hamdy DF EG 23 56
- Temsah DF EG 24 57
6 Kamal MF EG 25 62
17 Hamdi MF EG 26 61
22 Ahmed_El_Agouz MF EG 33 63
25 Said MF EG 25 60
30 Essam MF EG 21 56
39 Suleiman_Kirki MF NG 22 61
66 Shadad MF EG 23 57
10 Kahraba FW EG 32 70
7 Hawash FW EG 23 62
9 El_Nahass FW EG 24 62
11 Sherif FW EG 27 62
14 Emad_Mayhoub FW EG 25 63
18 Hossam_Ghanem FW EG 27 63
28 Abdallah FW EG 21 57
35 Ousseynou_Bodian FW SN 25 65
`,
  "smouha": `
1 Taimour GK EG 26 63
28 Mayhoub GK EG 30 60
- Haidar GK EG 22 54
3 Desouki DF EG 28 65
4 Rasoul DF EG 30 63
6 Amer DF EG 33 62
13 Niyigena DF RW 25 65
24 Ragab DF EG 26 63
30 Gamal DF EG 27 62
- Mohsen DF EG 20 54
2 Hafez MF EG 25 62
7 El_Sisi MF EG 32 64
8 Fekri MF EG 30 64
10 El_Ghandour MF EG 32 66
15 Attidjikou MF BJ 22 64
17 El_Nadry MF EG 26 62
19 Adel MF EG 31 62
22 Samiae MF EG 25 61
66 K_Mohamed MF CI 23 62
99 Amin MF EG 23 58
9 Hamdi FW EG 25 64
11 Farouk FW EG 27 67
14 Saeed FW EG 36 63
20 Badji FW SN 22 65
21 A_Mohamed FW EG 25 63
23 Farid FW EG 29 63
26 Tetah FW MR 24 64
27 Balaha FW EG 30 66
`,
  "abu-qir-fertilizers": `
1 Genesh GK EG 38 62
25 Shika GK EG 33 62
3 Gaber_Kamel DF EG 30 64
4 Dabash DF EG 33 62
5 Fayez DF EG 29 61
6 Alaa DF EG 26 60
12 Ashraf DF EG 27 60
18 Alshobaki DF EG 26 61
20 Ahmed_Awad DF EG 34 63
24 El_Gazar DF EG 22 57
27 Dahesh DF EG 28 62
- Eyad_Salah DF EG 21 58
7 Ocha MF EG 28 64
8 Hamdi MF EG 32 62
13 Mvouo MF CD 26 64
14 Milad MF EG 28 62
15 Ibrahim MF EG 28 60
17 Fathi MF EG 32 63
28 Zyad_Farag MF EG 24 61
30 Hamdi_Ali MF EG 26 60
79 Ziad_Shaker MF EG 20 60
- Seif_El_Agouz MF EG 24 60
9 Mahmoud_Gouda FW EG 28 63
11 Mostafa_Rahim FW EG 25 62
21 Seif_Shika FW EG 25 60
22 Ahmed_Khaled FW EG 28 62
23 Akem FW NG 22 61
29 Ali_Hussein FW EG 33 61
77 Dakwar FW EG 22 58
- Youth_GK_1 GK EG 19 54
`,
  "el-gouna": `
1 Masoud GK EG 34 63
16 Reisha GK EG 28 60
26 Askar GK EG 24 56
2 Taalab DF EG 24 62
3 Khaled_Ahmed DF EG 23 61
4 Abou_Salima DF EG 32 61
5 El_Shimi DF EG 33 62
20 Belia DF EG 25 60
21 Afifi DF EG 25 60
28 Metawea DF EG 22 57
34 Essam DF EG 21 56
44 Turay DF SL 21 59
8 Reda_Salah MF EG 28 63
13 El_Gazar MF EG 21 58
14 Nour_El_Sayed MF EG 42 62
19 Belal_El_Sayed MF EG 25 62
22 Mohamed_Reda MF EG 24 61
33 Simukonda MF ZM 20 60
42 Egbemba MF CM 20 60
90 Teukeu MF CM 21 61
74 El_Shayat MF EG 24 58
7 Hesham FW EG 29 63
9 Marwan_Mohsen FW EG 37 64
11 Ahmed_Zaki FW EG 24 63
24 El_Zahdi FW EG 29 61
27 Salah_Zayed FW EG 25 61
29 Ojo FW NG 23 63
70 Ahmed_Gamal FW EG 25 60
`,
  "petrol-asyut": `
1 A_Youssef GK EG 26 62
16 Emad GK EG 28 60
25 Ahmed GK EG 26 57
5 Alaa DF EG 29 62
6 Magdy DF EG 21 56
7 Younes DF EG 24 60
12 El_Sayed DF EG 24 59
20 Shokry DF EG 31 62
24 Aleim DF EG 32 60
30 Medhat DF EG 24 58
- Mahran DF EG 31 60
17 Hamza MF EG 32 62
18 Hesha MF EG 27 60
19 Abbas MF EG 27 61
21 Bakr MF EG 27 60
26 Al_Khamisi MF EG 26 60
31 Salam MF EG 23 57
32 Abdelrahman_Kamel MF EG 23 59
- Hamzawi MF EG 30 59
- Kashkash MF EG 25 58
8 F_Gamal FW EG 28 61
9 Eid FW EG 29 62
11 Sadafa FW EG 28 61
13 Ashraf FW EG 27 60
15 Khaled FW EG 25 59
35 Bodne FW EG 24 58
38 Egagy FW EG 21 54
`,
  "ghazl-el-mahalla": `
1 El_Nafarawy GK EG 27 62
16 Amer GK EG 39 58
25 Koko GK EG 34 57
3 El_Aash DF EG 28 62
4 Shousha DF EG 33 61
5 Sheta DF EG 24 59
12 Yehia_Zakaria DF EG 24 61
15 Gamal DF EG 32 59
23 Djabri DF DZ 25 62
66 Rashdan DF EG 22 56
6 Youssef_Hassan MF EG 27 60
10 Bassam_Walid MF EG 28 62
14 A_Emad MF EG 27 60
17 Osama MF EG 27 61
19 Armoosha MF EG 25 58
20 Toure MF CI 23 62
22 Etman MF EG 23 59
30 Gomaa MF EG 27 59
32 El_Azab MF EG 23 58
8 Paulikas MF EG 19 55
7 M_Ashraf FW EG 27 60
9 Arfaoui FW TN 30 64
11 Ekbad FW EG 28 60
63 Yehia FW EG 26 59
99 H_Mohamed FW EG 23 58
41 Saidi FW EG 20 55
`,
};
