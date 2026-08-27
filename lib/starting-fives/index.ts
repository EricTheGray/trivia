import bundled from "@/data/starting-fives.json";
import { createDataset } from "@/lib/dataset";
import { parseLineups, type LineupSet } from "./types";

export * from "./types";

/**
 * Champions' game one starting lineups: `data/starting-fives.json`, or the
 * endpoint in `LINEUPS_API_URL` when one is set.
 */
const lineups = createDataset<LineupSet>({
  name: "starting-fives",
  urlEnv: "LINEUPS_API_URL",
  tokenEnv: "LINEUPS_API_TOKEN",
  bundled,
  parse: parseLineups,
});

export const loadLineups = () => lineups.load();
