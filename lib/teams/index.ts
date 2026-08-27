import bundled from "@/data/teams.json";
import { createDataset } from "@/lib/dataset";
import type { Aliases, PoolEntry } from "@/lib/matching";
import { parseTeamList, type TeamList } from "./types";

export * from "./types";

/**
 * The teams behind typed-answer autocomplete: `data/teams.json`, or the
 * endpoint in `TEAMS_API_URL` when one is set.
 */
const teams = createDataset<TeamList>({
  name: "teams",
  urlEnv: "TEAMS_API_URL",
  tokenEnv: "TEAMS_API_TOKEN",
  bundled,
  parse: parseTeamList,
});

export const loadTeams = () => teams.load();

/**
 * Colloquial names people type. Every current nickname is already unique, so
 * "lakers" and "celtics" need no entry here.
 */
export const TEAM_ALIASES: Aliases = {
  sixers: "Philadelphia 76ers",
  philly: "Philadelphia 76ers",
  cavs: "Cleveland Cavaliers",
  mavs: "Dallas Mavericks",
  wolves: "Minnesota Timberwolves",
  twolves: "Minnesota Timberwolves",
  blazers: "Portland Trail Blazers",
  "rip city": "Portland Trail Blazers",
  dubs: "Golden State Warriors",
  lakeshow: "Los Angeles Lakers",
  clips: "LA Clippers",
  grizz: "Memphis Grizzlies",
  wiz: "Washington Wizards",
  pels: "New Orleans Pelicans",
  nola: "New Orleans Pelicans",
  knickerbockers: "New York Knicks",
};

/**
 * Extra things each team can be found by: the city or metro when the franchise
 * is not named for it, and the tri-code. Searchable, never displayed — so
 * "san francisco", "slc" and "gsw" all find their team even though none of them
 * appear in a team's name.
 */
const TEAM_TERMS: Record<string, string[]> = {
  "Atlanta Hawks": ["atl"],
  "Boston Celtics": ["bos"],
  "Brooklyn Nets": ["bkn", "new york"],
  "Charlotte Hornets": ["cha", "clt"],
  "Chicago Bulls": ["chi"],
  "Cleveland Cavaliers": ["cle"],
  "Dallas Mavericks": ["dal"],
  "Denver Nuggets": ["den"],
  "Detroit Pistons": ["det"],
  "Golden State Warriors": ["gsw", "san francisco", "bay area", "sf"],
  "Houston Rockets": ["hou"],
  "Indiana Pacers": ["ind", "indianapolis", "indy"],
  "LA Clippers": ["lac", "los angeles"],
  "Los Angeles Lakers": ["lal"],
  "Memphis Grizzlies": ["mem"],
  "Miami Heat": ["mia"],
  "Milwaukee Bucks": ["mil"],
  "Minnesota Timberwolves": ["min", "minneapolis"],
  "New Orleans Pelicans": ["nop"],
  "New York Knicks": ["nyk", "new york city", "nyc"],
  "Oklahoma City Thunder": ["okc"],
  "Orlando Magic": ["orl"],
  "Philadelphia 76ers": ["phi"],
  "Phoenix Suns": ["phx"],
  "Portland Trail Blazers": ["por"],
  "Sacramento Kings": ["sac"],
  "San Antonio Spurs": ["sas", "san antone"],
  "Toronto Raptors": ["tor"],
  "Utah Jazz": ["uta", "salt lake city", "salt lake", "slc"],
  "Washington Wizards": ["was", "washington dc", "dc"],
};

/** Pairs each team with the terms it can also be found by. */
export function teamPool(teams: string[]): PoolEntry[] {
  return teams.map((name) => ({ name, terms: TEAM_TERMS[name] ?? [] }));
}
