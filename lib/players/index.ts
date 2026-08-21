import bundled from "@/data/players.json";
import { createDataset } from "@/lib/dataset";
import { parseRoster, type Roster } from "./types";

export * from "./types";
export * from "./matching";

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
