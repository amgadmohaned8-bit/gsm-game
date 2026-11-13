/**
 * Every league in the game. Add a league here and it shows up in the league
 * picker, in "Add a league" on the manager page and in the trophy room.
 * `available: false` shows it as "Coming soon".
 */

export type League = {
  id: string;
  name: string;
  country: string;
  logo: string;
  color: string;
  color2: string;
  available: boolean;
  clubs: number;
  rounds: number;
  blurb: string;
  /** shown instead of "clubs / matchdays" (used by cups) */
  facts?: [string, string][];
};

export const LEAGUES: League[] = [
  { id: "premier-league", name: "Premier League", country: "England", logo: "/league-logos/premier-league.png", color: "#7c3aed", color2: "#ec4899", available: true, clubs: 20, rounds: 38, blurb: "The most watched league on earth. Twenty clubs, no easy weekends." },
  { id: "egyptian-premier-league", name: "Egyptian Premier League", country: "Egypt", logo: "/league-logos/egyptian-premier-league.png", color: "#c9a227", color2: "#8a6a12", available: true, clubs: 20, rounds: 38, blurb: "Cairo derbies, packed stadiums and a title race that goes to the last day." },
  { id: "la-liga", name: "La Liga", country: "Spain", logo: "/league-logos/la-liga.png", color: "#f97316", color2: "#facc15", available: false, clubs: 20, rounds: 38, blurb: "Technical football and two giants at the top." },
  { id: "serie-a", name: "Serie A", country: "Italy", logo: "/league-logos/serie-a.png", color: "#2563eb", color2: "#22d3ee", available: false, clubs: 20, rounds: 38, blurb: "Tactical, patient, unforgiving." },
  { id: "bundesliga", name: "Bundesliga", country: "Germany", logo: "/league-logos/bundesliga.png", color: "#dc2626", color2: "#fb7185", available: false, clubs: 18, rounds: 34, blurb: "Full stadiums, fast attacks, big pressing." },
];

/** Continental cups. Shown in the picker as "Coming soon" until they are built. */
export const CUPS: League[] = [
  { id: "caf-champions-league", name: "CAF Champions League", country: "Africa", logo: "/league-logos/caf-champions-league.png", color: "#caa24a", color2: "#5b3a00", available: true, clubs: 16, rounds: 9, blurb: "Africa's biggest club prize. The best of each league fight for the star.", facts: [["Top 2", "of Egypt qualify"], ["Groups", "then knockouts"]] },
  { id: "caf-confederation-cup", name: "CAF Confederation Cup", country: "Africa", logo: "/league-logos/caf-confederation-cup.png", color: "#e5cf2a", color2: "#1d6b3a", available: true, clubs: 16, rounds: 9, blurb: "The second continental cup, for the clubs just behind the champions.", facts: [["3rd & 4th", "of Egypt qualify"], ["Groups", "then knockouts"]] },
];

export const isCup = (id: string | null | undefined) => CUPS.some((c) => c.id === id);

export const leagueOf = (id: string | null | undefined): League =>
  LEAGUES.find((l) => l.id === id) ??
  CUPS.find((c) => c.id === id) ?? {
    id: id ?? "unknown",
    name: (id ?? "League").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    country: "",
    logo: "",
    color: "#7c3aed",
    color2: "#ec4899",
    available: false,
    clubs: 20,
    rounds: 38,
    blurb: "",
  };
