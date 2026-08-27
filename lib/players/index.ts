import bundled from "@/data/players.json";
import { createDataset } from "@/lib/dataset";
import type { Aliases } from "@/lib/matching";
import { parseRoster, type Roster } from "./types";

export * from "./types";

/**
 * The roster behind typed-answer autocomplete: `data/players.json`, or the
 * endpoint in `PLAYERS_API_URL` when one is set.
 */
const roster = createDataset<Roster>({
  name: "players",
  urlEnv: "PLAYERS_API_URL",
  tokenEnv: "PLAYERS_API_TOKEN",
  bundled,
  parse: parseRoster,
});

export const loadRoster = () => roster.load();

/** What people actually type. Values are matched against the pool's spelling. */
export const PLAYER_ALIASES: Aliases = {
  giannis: "Giannis Antetokounmpo",
  "greek freak": "Giannis Antetokounmpo",
  steph: "Stephen Curry",
  "steph curry": "Stephen Curry",
  "chef curry": "Stephen Curry",
  bron: "LeBron James",
  lebron: "LeBron James",
  "king james": "LeBron James",
  kd: "Kevin Durant",
  durantula: "Kevin Durant",
  sga: "Shai Gilgeous-Alexander",
  shai: "Shai Gilgeous-Alexander",
  joker: "Nikola Jokic",
  jokic: "Nikola Jokic",
  "nikola jokic": "Nikola Jokic",
  "the process": "Joel Embiid",
  jojo: "Joel Embiid",
  russ: "Russell Westbrook",
  westbrick: "Russell Westbrook",
  wemby: "Victor Wembanyama",
  luka: "Luka Doncic",
  "luka doncic": "Luka Doncic",
  dame: "Damian Lillard",
  kawhi: "Kawhi Leonard",
  "the beard": "James Harden",
  zion: "Zion Williamson",
  melo: "LaMelo Ball",
  kat: "Karl-Anthony Towns",
  jjj: "Jaren Jackson Jr.",
  gobert: "Rudy Gobert",
  dray: "Draymond Green",
  "sweet lou": "Lou Williams",
  mcw: "Michael Carter-Williams",
  "d rose": "Derrick Rose",
};
