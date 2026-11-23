// @ts-nocheck
/**
 * Premier League squads, 2026/27.
 *
 * Source: club squad lists as of 31 October to 7 November 2026 (new signings
 * included). The list is the first team of each club; academy players and
 * loans are left out. Ratings are our own estimates for the game, not an
 * official figure.
 *
 * Line format: number name position nationality age rating
 * "-" means no shirt number yet. "_" inside a name is a space.
 */

import { clubs } from "./clubs.ts";
import { allClubs } from "./leagueClubs.ts";
import { egyptRaw } from "./egypt.ts";
import { africaRaw } from "./africaSquads.ts";
import { europeRaw } from "./europeSquads.ts";

export type Position = "GK" | "DF" | "MF" | "FW";

export type Player = {
  id: string;
  club: string;
  number: number | null;
  name: string;
  position: Position;
  nationality: string;
  age: number;
  rating: number;
};

const raw: Record<string, string> = {
  arsenal: `
1 Raya GK ES 31 88
13 Kepa GK ES 32 78
30 Meslier GK FR 26 74
2 Saliba DF FR 25 88
3 Mosquera DF ES 22 78
4 White DF ENG 29 82
5 Hincapié DF EC 24 80
6 Gabriel DF BR 28 89
12 Timber DF NL 25 84
15 Konsa DF ENG 29 84
33 Calafiori DF IT 24 84
49 Lewis-Skelly DF ENG 20 78
89 Salmon DF ENG 17 62
8 Ødegaard MF NO 27 86
10 Eze MF ENG 28 84
20 Madueke MF ENG 24 80
23 Merino MF ES 30 81
36 Zubimendi MF ES 27 84
39 Guimarães MF BR 28 86
41 Rice MF ENG 27 88
7 Saka FW ENG 25 87
14 Gyökeres FW SE 28 86
17 Tzolis FW GR 24 74
29 Havertz FW DE 27 82
43 Annous FW ENG 18 62
53 O'Neill FW NIR 18 61
56 Dowman FW ENG 16 66`,
  "aston-villa": `
1 Suzuki GK JP 24 78
40 Bizot GK NL 35 74
2 Cash DF PL 29 80
3 Lindelöf DF SE 32 78
4 Harwood-Bellis DF ENG 24 76
5 Mings DF ENG 33 74
13 Ruggeri DF IT 24 76
14 Pau_Francisco DF ES 29 80
22 Maatsen DF NL 24 77
26 Bogarde DF NL 22 72
29 Wan-Bissaka DF ENG 28 78
6 Barkley MF ENG 32 74
7 McGinn MF SCO 32 79
8 Kamara MF FR 26 81
10 Buendía MF AR 29 79
24 Onana MF BE 25 80
27 Goretzka MF DE 31 82
35 Gomes MF BR 25 73
44 Manzambi MF CH 21 72
11 Jackson FW SN 25 79
17 Garnacho FW AR 22 79
18 Abraham FW ENG 29 74
19 Mbaye FW FR 18 62
39 Madjo FW ENG 17 58
47 Edward FW BR 20 70
53 Hemmings FW ENG 19 60`,
  bournemouth: `
1 Petrović GK RS 27 77
17 Forster GK ENG 38 66
20 Di_Gregorio GK IT 29 75
2 Aarons DF ENG 26 72
3 Truffert DF FR 24 75
5 Hill DF ENG 24 75
6 Soler DF AR 21 66
14 Silva DF PT 23 72
15 Smith DF ENG 35 66
18 Diakité DF FR 25 74
24 Sánchez DF ES 23 70
- Araujo DF MX 25 72
4 Cook MF ENG 29 74
7 Brooks MF WAL 29 76
8 Scott MF ENG 23 77
10 R._Christie MF SCO 31 74
12 Adams MF US 27 76
16 Tavernier MF ENG 27 76
19 Kluivert MF NL 27 78
27 Tóth MF HU 21 70
37 Rayan MF BR 20 76
9 Evanilson FW BR 27 77
11 Doak FW SCO 20 72
21 Adli FW MA 26 76
22 Kroupi FW FR 20 77
29 Jebbison FW CA 23 66
30 Rodríguez FW UY 22 68`,
  brentford: `
1 Kelleher GK IE 27 77
12 Valdimarsson GK IS 25 65
31 Balcombe GK ENG 27 66
2 Hickey DF SCO 24 73
3 Henry DF ENG 29 74
4 van_den_Berg DF NL 24 76
20 Ajer DF NO 28 77
22 Collins DF IE 25 74
23 Lewis-Potter DF ENG 25 74
25 Diouf DF SN 21 67
33 Kayode DF IT 22 72
44 Schuster DF AT 20 65
6 Yarmolyuk MF UA 22 74
8 Jensen MF DK 30 76
10 Dasilva MF ENG 28 74
14 Carvalho MF PT 24 77
18 Sangaré MF ML 24 72
24 Damsgaard MF DK 26 77
27 Janelt MF DE 28 74
7 Schade FW DE 24 77
9 Thiago FW BR 25 76
11 Ouattara FW BF 24 75
13 Wilson FW ENG 34 72
19 Anthony FW ENG 26 71
- Furo FW BE 19 62`,
  brighton: `
1 Verbruggen GK NL 24 77
23 Steele GK ENG 36 66
38 McGill GK CA 26 66
3 Hadjam DF DZ 23 72
4 Struijk DF NL 27 75
5 Dunk DF ENG 34 76
20 Costinha DF PT 26 72
21 Boscagli DF FR 28 74
24 Kadıoğlu DF TR 27 80
30 Svoboda DF AT 28 72
44 Vušković DF HR 19 76
8 Hinshelwood MF ENG 21 76
13 Groß MF DE 35 76
14 Chema_Andrés MF ES 21 68
25 Gómez MF PY 23 76
26 Ayari MF SE 23 74
27 Wieffer MF NL 26 74
29 De_Cuyper MF BE 25 75
33 O'Riley MF DK 25 77
35 Yalcouyé MF ML 20 68
59 Ibrahim MF XX 18 60
- Azeez MF ENG 25 60
9 Tzimas FW GR 20 71
10 Rutter FW FR 24 78
11 Minteh FW GM 22 75
12 David FW CA 25 80
15 Osman FW GH 21 69
19 Kostoulas FW GR 19 74
22 Mitoma FW JP 29 77
- Ferguson FW IE 22 72`,
  chelsea: `
1 Martínez GK AR 34 81
28 Sharman-Lowe GK ENG 23 66
39 Penders GK BE 21 68
44 Słonina GK US 22 67
2 Palestra DF IT 21 74
3 Fofana DF FR 25 78
5 Lacroix DF FR 26 78
6 Colwill DF ENG 23 79
21 Hato DF NL 20 75
24 James DF ENG 26 80
27 Gusto DF FR 23 78
29 Chavarría DF ES 28 70
34 Acheampong DF ENG 20 66
4 Barco MF AR 22 72
8 Watson MF XX 16 55
10 Palmer MF ENG 24 86
14 Henderson MF ENG 36 74
17 Rogers MF ENG 24 87
23 Quenda MF GW 19 76
25 Caicedo MF EC 25 83
41 Estêvão MF BR 19 82
45 Lavia MF BE 22 78
7 Neto FW PT 26 80
9 Pedro FW BR 25 82
11 Bynoe-Gittens FW ENG 22 76
18 Welbeck FW ENG 35 71
22 Emegha FW NL 23 75`,
  coventry: `
13 Wilson GK ENG 34 70
19 Rushworth GK ENG 25 70
25 Bentley GK ENG 33 66
2 Pinnock DF JM 33 70
3 Dasilva DF ENG 28 70
4 Thomas DF ENG 25 71
12 Mfuni DF ENG 18 58
20 Kesler-Hayden DF ENG 24 68
21 Bidwell DF ENG 33 66
22 Latibeaudiere DF JM 26 70
24 Amenda DF CH 23 69
26 Woolfenden DF ENG 28 68
27 van_Ewijk DF NL 26 69
5 Rudoni MF ENG 25 72
6 Grimes MF ENG 31 71
7 Sakamoto MF JP 30 72
8 Yirenkyi MF GH 20 68
10 Mason-Clark MF ENG 27 70
16 Onyeka MF NG 28 73
28 Eccles MF ENG 26 71
29 Torp MF DK 27 71
34 Gboho MF FR 25 70
38 Hamer MF NL 29 70
9 Simms FW ENG 25 70
11 Wright FW US 28 72
14 Awoniyi FW NG 29 74
17 Tchaouna FW FR 23 72
23 Thomas-Asante FW ENG 27 70
49 Cherif FW FR 19 66`,
  "crystal-palace": `
1 Henderson GK ENG 29 78
31 Matthews GK ENG 32 66
44 Benítez GK AR 33 69
4 Riad DF MA 23 72
5 Disasi DF FR 28 76
6 Canvot DF FR 20 66
17 Tomiyasu DF JP 28 74
21 Ahanor DF IT 18 68
25 Khalaili DF IL 22 66
26 Richards DF US 26 76
33 Chilwell DF ENG 29 74
- Benamar DF XX 18 55
- King DF XX 19 55
3 Mitchell MF ENG 27 76
8 Lerma MF CO 32 77
10 Pino MF ES 24 76
11 McNeil MF ENG 26 75
18 Kamada MF JP 30 77
19 Hughes MF ENG 31 76
20 Wharton MF ENG 22 80
23 Timber MF NL 25 72
24 Darío_Osorio MF CL 22 74
28 Doucouré MF ML 26 75
30 Mingueza MF ES 27 72
- Drakes-Thomas MF XX 17 55
7 Sarr FW SN 28 79
9 Nketiah FW ENG 27 74
12 Gozo FW US 19 62
14 Mateta FW FR 29 79
22 Larsen FW NO 26 75
29 Guessand FW FR 25 72`,
  everton: `
1 Pickford GK ENG 32 85
12 Travers GK IE 27 70
31 King GK WAL 31 68
4 Branthwaite DF ENG 24 81
5 Keane DF ENG 33 75
6 Tarkowski DF ENG 33 77
15 O'Brien DF IE 25 72
16 Mykolenko DF UA 27 74
2 Maitland-Niles MF ENG 29 70
8 Dewsbury-Hall MF ENG 28 76
10 Grealish MF ENG 31 80
19 T._George MF ENG 20 71
23 Nørgaard MF DK 32 75
24 Alcaraz MF AR 23 74
30 Hackney MF SCO 24 70
34 Röhl MF DE 24 66
37 Garner MF ENG 25 74
45 Armstrong MF ENG 19 66
- Sherif MF XX 18 55
11 Barry FW FR 24 76
20 Dibling FW ENG 20 70
22 Johnson FW WAL 25 77`,
  fulham: `
1 Leno GK DE 34 78
23 Lecomte GK FR 35 70
2 Tete DF NL 31 74
3 Bassey DF NG 26 75
4 Cuenca DF ES 26 70
5 Andersen DF DK 30 79
21 Castagne DF BE 30 73
22 Affengruber DF AT 25 70
33 Robinson DF US 29 77
6 Reed MF ENG 31 73
8 Palacios MF ES 21 72
10 Cairney MF SCO 35 70
14 Bobb MF NO 23 73
15 Larsson MF SE 22 70
16 Berge MF NO 28 77
17 Iwobi MF NG 30 76
19 Charles MF NIR 23 68
20 Ángel MF ES 22 69
24 King MF ENG 19 64
30 Sessegnon MF ENG 26 72
32 Rowe MF ENG 26 72
7 García FW ES 22 72
9 Muniz FW BR 25 74
11 Kevin FW BR 23 72
- Kusi-Asare FW SE 19 60`,
  "hull-city": `
1 Butland GK ENG 33 70
12 Phillips GK ENG 31 66
19 Tzolakis GK GR 23 68
2 Coyle DF ENG 31 68
3 Giles DF ENG 26 66
4 Hughes DF ENG 23 68
6 Ajayi DF NG 32 69
15 Egan DF IE 34 69
17 McNair DF NIR 31 68
18 Norton-Cuffy DF ENG 22 70
22 Herrington DF AU 19 60
23 Targett DF ENG 31 70
32 Mendy DF FR 22 66
5 Morita MF JP 31 72
8 Matazo MF BE 24 70
10 Belloumi MF DZ 24 68
14 Hjertø-Dahl MF NO 21 62
20 Óscar_Zambrano MF EC 22 68
21 Stroud MF SE 24 66
24 Gyabi MF ENG 22 70
25 Crooks MF ENG 32 70
26 Dowell MF ENG 29 68
27 Slater MF ENG 27 68
29 Gourna-Douath MF FR 23 69
33 Ömür MF TR 27 70
36 Mouzakitis MF GR 19 62
42 Iroegbunam MF ENG 23 70
7 Thomas FW WAL 27 68
9 McBurnie FW SCO 30 68
11 Gelhardt FW ENG 24 69
47 Vaz FW FR 19 64
50 Cho FW FR 22 67
- Ansah FW DE 21 64`,
  ipswich: `
1 Palmer GK ENG 30 70
27 Button GK ENG 37 64
28 Walton GK ENG 30 68
37 Scherpen GK NL 26 70
2 Furlong DF ENG 31 68
3 Davis DF ENG 26 69
4 Kipré DF CI 29 70
6 Diop DF FR 29 72
24 Greaves DF ENG 26 70
26 O'Shea DF IE 27 70
42 Ouattara DF FR 21 66
5 Matusiwa MF NL 28 71
7 Fatawu MF GH 22 74
10 Enciso MF PY 22 72
11 Philogene MF ENG 24 74
12 Florentino MF PT 27 72
14 Taylor MF IE 28 70
23 Lukić MF RS 30 73
25 Palacios MF AR 28 70
32 Núñez MF CL 26 70
8 Egeli FW NO 20 66
9 Flemming FW NL 28 70
19 Emersonn FW BR 22 70
20 McAteer FW ENG 24 70
29 Akpom FW ENG 31 70
33 Mehmeti FW AL 25 68
38 Maeda FW JP 29 73
47 Clarke FW ENG 25 68`,
  leeds: `
1 Trafford GK ENG 24 76
16 Zetterer GK DE 31 72
21 Cairns GK ENG 33 62
5 Muharemović DF BA 23 70
6 Rodon DF WAL 29 76
15 Bijol DF SI 27 75
24 Justin DF ENG 28 73
26 Bard DF FR 26 72
30 Elvedi DF CH 30 73
2 Bogle MF ENG 26 72
3 Gudmundsson MF SE 27 74
4 Ampadu MF WAL 26 77
7 D._James MF WAL 28 76
8 Longstaff MF ENG 29 74
10 Wilson MF WAL 29 73
11 Aaronson MF US 26 77
18 Stach MF DE 27 74
22 Tanaka MF JP 28 75
44 Gruev MF BG 26 73
9 Calvert-Lewin FW ENG 29 77
14 Nmecha FW DE 27 74
19 Okafor FW CH 26 74
- Joseph FW ENG 23 62`,
  liverpool: `
1 Becker GK BR 34 87
25 Mamardashvili GK GE 26 79
28 Woodman GK ENG 29 66
2 Gomez DF ENG 29 78
4 van_Dijk DF NL 35 87
5 Jacquet DF FR 21 76
6 Kerkez DF HU 23 77
12 C._Bradley DF NIR 23 76
21 Tsimikas DF GR 30 75
33 Araújo DF UY 27 80
44 Chambers DF ENG 22 66
3 Endo MF JP 33 72
7 Wirtz MF DE 23 86
8 Szoboszlai MF HU 26 85
10 Mac_Allister MF AR 27 86
23 Muñoz MF ES 23 70
30 Frimpong MF NL 25 82
38 Gravenberch MF NL 24 85
42 Nyoni MF ENG 19 70
53 McConnell MF ENG 22 72
73 Ngumoha MF ENG 18 70
9 Isak FW SE 27 87
14 Chiesa FW IT 29 76
18 Gakpo FW NL 27 83
22 Ekitike FW FR 24 83
29 Barcola FW FR 24 82
40 Abe FW XX 15 50
67 Koumas FW ENG 21 66
- Lambie FW ENG 18 62`,
  "man-city": `
1 Donnarumma GK IT 27 89
13 Bettinelli GK ENG 34 66
28 Rulli GK AR 34 76
3 Dias DF PT 29 85
6 Guéhi DF ENG 26 82
21 Aït-Nouri DF DZ 25 80
22 Nunes DF BR 20 70
24 Gvardiol DF HR 24 85
27 M._Nunes DF PT 28 78
33 O'Reilly DF ENG 21 76
45 Khusanov DF UZ 22 76
82 Lewis DF ENG 21 72
5 Anderson MF SCO 24 80
7 Ndiaye MF SN 26 80
8 Kovačić MF HR 32 82
10 Cherki MF FR 23 82
17 Fernández MF AR 25 86
32 Bouaddi MF FR 19 74
47 Foden MF ENG 26 85
9 Haaland FW NO 26 91
11 Doku FW BE 24 83
37 Allan FW BR 22 70
42 Semenyo FW GH 26 83
56 McAidoo FW ENG 18 62
75 Samba FW XX 16 52`,
  "man-united": `
1 Lammens GK BE 24 78
12 Darlow GK ENG 36 62
22 Heaton GK ENG 40 62
45 Mee GK NIR 23 62
2 Dalot DF PT 27 78
3 Mazraoui DF MA 28 78
4 de_Ligt DF NL 27 80
5 Maguire DF ENG 33 79
6 Martínez DF AR 28 80
13 Dorgu DF DK 22 74
15 Yoro DF FR 20 78
23 Shaw DF ENG 31 76
26 Heaven DF ENG 20 74
7 Mount MF ENG 27 76
8 Fernandes MF PT 32 87
10 Cunha MF BR 27 83
16 Diallo MF CI 24 79
17 Santos MF BR 22 74
18 Tielemans MF BE 29 85
20 Baleba MF CM 22 79
25 Ugarte MF UY 25 79
37 Mainoo MF ENG 21 80
9 Rashford FW ENG 29 82
11 Zirkzee FW NL 25 75
19 Mbeumo FW CM 27 84
27 T._Thompson FW ENG 18 62
30 Šeško FW SI 23 80
31 Lacey FW ENG 19 62`,
  newcastle: `
1 Pope GK ENG 34 81
21 Horníček GK CZ 24 72
24 Jaouen GK FR 20 62
29 Gillespie GK ENG 34 62
2 Livramento DF ENG 23 78
3 Hall DF ENG 22 77
4 Botman DF NL 26 82
5 Schär DF CH 34 77
12 Thiaw DF DE 25 78
33 Burn DF ENG 34 76
37 Dedić DF BA 24 72
6 González MF ES 24 78
7 Joelinton MF BR 30 80
8 Bamba MF FR 20 70
11 Barnes MF ENG 28 80
14 Steur MF NL 18 62
17 Touré MF CI 20 72
19 Elanga MF SE 24 77
23 Murphy MF ENG 31 74
28 Willock MF ENG 27 76
41 Ramsey MF ENG 25 74
67 L._Miley MF ENG 20 66
9 Wissa FW CD 30 77
10 Osula FW DK 23 76
20 Fernandez-Pardo FW BE 21 70`,
  "nottingham-forest": `
1 Bott GK ENG 22 66
12 John GK BR 30 66
13 Benda GK DE 28 66
26 Sels GK BE 34 77
2 Diomande DF CI 22 76
5 Murillo DF BR 24 80
23 Jair DF BR 21 72
25 Netz DF DE 23 72
27 Muñoz DF CO 30 76
31 Milenković DF RS 29 77
37 Savona DF IT 23 72
65 Hanks DF ENG 22 62
3 Williams MF WAL 25 72
6 Sangaré MF CI 28 78
8 Domínguez MF AR 28 76
10 Gibbs-White MF ENG 26 82
14 Ndoye MF CH 26 77
21 Schlager MF AT 29 75
22 Yates MF ENG 28 74
24 McAtee MF ENG 24 74
34 Aina MF NG 30 72
7 Hudson-Odoi FW ENG 25 76
9 Wood FW NZ 34 76
11 Jesus FW BR 25 77
15 Kalimuendo FW FR 24 74
19 Delap FW ENG 23 77`,
  sunderland: `
21 Moore GK ENG 36 66
22 Roefs GK NL 23 77
31 Ellborg GK SE 23 64
4 Danso DF AT 28 76
5 Ballard DF NIR 27 74
6 Methalie DF FR 20 70
8 Browne DF IE 31 68
12 Meunier DF BE 35 72
15 Alderete DF PY 29 72
17 Reinildo DF MZ 32 72
20 Mukiele DF FR 29 74
32 Hume DF NIR 24 68
- Alese DF ENG 25 68
- Laplacette DF XX 25 66
10 Angulo MF EC 23 70
11 Rigg MF ENG 19 74
13 O'Nien MF ENG 31 68
19 Diarra MF FR 22 73
27 Sadiki MF BE 21 74
28 Le_Fée MF FR 26 76
34 Xhaka MF CH 34 80
7 Talbi FW MA 21 74
9 Brobbey FW NL 24 78
14 Mundle FW ENG 23 68
18 Isidor FW FR 26 72
37 Bi FW CI 21 68
39 Fofana FW BE 21 68
57 T._Tuterov FW UA 21 70`,
  tottenham: `
31 Kinský GK CZ 23 76
39 Dúbravka GK SK 37 72
40 Austin GK ENG 27 66
3 Robertson DF SCO 32 77
4 Adarabioyo DF ENG 29 75
5 Senesi DF AR 29 76
6 van_Hecke DF NL 26 78
13 Udogie DF IT 23 77
14 Gray DF ENG 20 70
23 Porro DF ES 27 80
33 Davies DF WAL 33 70
37 van_de_Ven DF NL 25 81
7 Simons MF NL 23 82
8 Gallagher MF ENG 26 78
10 Maddison MF ENG 29 80
11 Tel MF FR 21 76
15 Bergvall MF SE 20 74
16 Tonali MF IT 26 83
18 Fernandes MF PT 22 76
20 Kudus MF GH 26 80
21 Kulusevski MF SE 26 78
22 Marmoush MF EG 27 82
30 Bentancur MF UY 29 77
9 Richarlison FW BR 29 77
17 Sávio FW BR 22 75
19 Solanke FW ENG 29 77
27 Mudryk FW UA 25 72
28 Odobert FW FR 21 72`,
};

function parse(clubId: string, text: string): Player[] {
  return text
    .trim()
    .split("\n")
    .map((line, i) => {
      const [num, name, position, nationality, age, rating] = line.trim().split(/\s+/);
      return {
        id: `${clubId}-${i}`,
        club: clubId,
        number: num === "-" ? null : Number(num),
        name: name.replace(/_/g, " "),
        position: position as Position,
        nationality: nationality === "XX" ? "" : nationality,
        age: Number(age),
        rating: Number(rating),
      };
    });
}

export const squads: Record<string, Player[]> = Object.fromEntries(
  Object.entries({ ...raw, ...egyptRaw, ...africaRaw, ...europeRaw }).map(([club, text]) => [club, parse(club, text)])
);

export function squadOf(clubId: string): Player[] {
  return squads[clubId] ?? [];
}

/* ---------- formations and the best eleven ---------- */

export const formations = {
  "4-3-3": { DF: 4, MF: 3, FW: 3 },
  "4-4-2": { DF: 4, MF: 4, FW: 2 },
  "4-2-3-1": { DF: 4, MF: 5, FW: 1 },
  "3-5-2": { DF: 3, MF: 5, FW: 2 },
  "5-3-2": { DF: 5, MF: 3, FW: 2 },
  "3-4-3": { DF: 3, MF: 4, FW: 3 },
} as const;

export type FormationName = keyof typeof formations;

/** The strongest eleven for a formation, goalkeeper first. */
export function bestEleven(players: Player[], formation: FormationName): Player[] {
  const need = { GK: 1, ...formations[formation] };
  const used = new Set<string>();
  const out: Player[] = [];

  for (const group of ["GK", "DF", "MF", "FW"] as const) {
    const pick = players
      .filter((p) => p.position === group)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, need[group]);
    pick.forEach((p) => used.add(p.id));
    out.push(...pick);
  }

  return out;
}

export function teamRating(players: Player[], formation: FormationName = "4-3-3") {
  const eleven = bestEleven(players, formation);
  if (eleven.length === 0) return 0;
  return Math.round(eleven.reduce((sum, p) => sum + p.rating, 0) / eleven.length);
}

/** Market value in millions, from rating and age. */
export function marketValue(p: Player): number {
  const base = 1.5 * Math.exp(0.154 * (p.rating - 60));
  const age = p.age <= 21 ? 1.35 : p.age <= 25 ? 1.15 : p.age <= 29 ? 1 : p.age <= 32 ? 0.6 : 0.3;
  return Math.max(0.2, Math.round(base * age * 10) / 10);
}

/** Every club in the game has a squad. */
export const clubsWithoutSquad = allClubs.filter((c) => !squads[c.id]).map((c) => c.id);
